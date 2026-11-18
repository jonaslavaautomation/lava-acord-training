// ACORD Assistant — Vercel serverless function (POST /api/chat).
// The Anthropic API key stays on the server (Vercel env var ANTHROPIC_API_KEY); the browser never sees it.
// Only signed-in users of the app (trainees, trainers, admin) can call it.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { VIDEO_TRANSCRIPTS } from './_acord-knowledge.js';

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 30;
const MAX_TEXT = 8000;
const MAX_IMAGES = 4;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const SYSTEM_PROMPT = `You are the LAVA ACORD Assistant, a friendly tutor inside LAVA Automation's ACORD Training Simulator.
The people you talk to are mostly virtual assistants (VAs) learning to fill out commercial insurance ACORD forms for US insurance agencies: ACORD 125 (Commercial Insurance Application), 126 (Commercial General Liability), 127 (Business Auto), 130 (Workers Compensation), 140 (Property) and 27 (Evidence of Property Insurance, issued to a mortgagee or lender as proof that property coverage is in force; it is evidence only and does not change the policy). Trainers and the administrator use you too.

How to help:
- Answer questions about ACORD forms: what a section or box means, what goes in it, how to format entries (dates MM/DD/YYYY, money without cents, VINs exactly), when something is required for a quote versus for binding, and the insurance terms behind it (coinsurance, valuation, class codes, experience mod, employer's liability limits, symbols, and so on).
- Users may share screenshots or photos of a form, a field, an email or an error. Read them carefully, describe what you see when it matters, and point to the exact box or section by its label. If an image is blurry or cut off, say what you can't read instead of guessing.
- Prefer what the LAVA training videos teach (transcripts below). When you use them, mention which video and roughly when, e.g. "(ACORD 130 video, around 4:06)", so the trainee can rewatch it. If the videos don't cover something, answer from general ACORD and insurance knowledge and say that it goes beyond the videos.
- Rules differ by carrier and state. When an answer depends on the carrier, the state or the agency's own procedures, say so and suggest checking with their trainer or agency.
- Keep answers short and practical: a direct answer first, then brief steps or bullets if useful. Use plain English, since many users speak English as a second language. Use simple Markdown (bold, bullet lists) and no tables unless asked.

Coaching rules for assessments and quizzes:
- The app has a Knowledge Check quiz after each video and a graded ACORD form assessment. If a trainee pastes a quiz question or asks you to fill in their assessment form for them, do not just hand over the answer. Explain the concept, point them to the relevant part of the video, and let them choose or type it themselves. Checking their reasoning ("I put X because Y, is that right?") is fine; confirm or correct the reasoning and explain why.
- You cannot see the trainee's scores, answer keys or account. If they ask about a score, a reset or a technical problem with the app, tell them to contact their trainer.

Stay on topic: ACORD forms, commercial insurance and the VA's work at an insurance agency. For unrelated requests, politely say you're here to help with ACORD and insurance questions.
Never ask for or repeat real customers' sensitive data (full SSNs, full driver's license numbers, bank details). If a screenshot contains such data, don't repeat it back; suggest they blur it next time.

Transcripts of the LAVA training videos (automatic speech-to-text: "Accord", "a court", "ACORA" and "farm" mean ACORD and form; timestamps are [minutes:seconds]), followed by written step-by-step process guides (<process_guide>) where available. For "how do I complete" questions, walk through the process guide's steps:

${VIDEO_TRANSCRIPTS}`;

/**
 * task "acord27": read the user's own question, notes and photos (dec pages, emails...) and return the ACORD 27
 * box values as JSON. The app then fills a watermarked training sample with them (src/lib/acord27Layout.ts).
 */
export function acord27Prompt(): string {
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'America/New_York' });
  return `You fill out an ACORD 27 (Evidence of Property Insurance, 2006/07 edition) for a TRAINING SAMPLE, using only the information, documents and photos the user provided in this conversation (for example a declarations page, an email from a lender, or typed notes).

Reply with ONLY one JSON object: no prose, no code fences. Omit any key you have no information for. Never invent names, policy or loan numbers, amounts, dates or addresses: if something isn't in the user's information, leave it out and list it in "missing".

Keys (all values are strings unless noted):
- issue_date: date the evidence is issued, MM/DD/YYYY. If not given, use today: ${today}
- agency_name_address: producer/agency name and mailing address (use \\n between lines)
- agency_phone, agency_fax, agency_email, agency_code, agency_subcode, agency_customer_id
- company_name_address: the insurance company (insurer) name, and address if given
- insured_name_address: first named insured name and mailing address (\\n between lines)
- loan_number: the insured's loan number shown at the top (usually the same as the lender's loan number)
- policy_number: exactly as shown, including prefix
- effective_date, expiration_date: MM/DD/YYYY
- continued_until_terminated: boolean, only true if the policy is continuous until terminated
- replaces_prior_evidence_dated: MM/DD/YYYY, only if this replaces a prior evidence
- property_location_description: street address of the location and a brief description of the building or property (no "Location 1:" label). For equipment or machinery include year, make, model and serial number
- coverages: array (max 8) of { "description": coverage name + causes of loss (basic, broad or special) + form number if given, at most 70 characters because the box is one line (for example "Business Income w/ EE, 12 mo, Special Form CP 10 30"), "amount": amount of insurance like "$1,250,000" or "Actual Loss Sustained", "deductible": like "$2,500" }
- remarks: special conditions or additional comments, if any
- cancellation_notice_days: number of days written notice of cancellation to the additional interest
- additional_interest_name_address: lender or other interest name and address (\\n between lines); include ISAOA/ATIMA if given
- interest_mortgagee, interest_additional_insured, interest_loss_payee: booleans for the interest type
- interest_other: text, only for an interest type other than mortgagee, additional insured or loss payee (for example "Lender's Loss Payable")
- additional_interest_loan_number: loan or account number the additional interest assigned to the insured
- authorized_representative: name of the person signing, if given
- summary: one or two plain-English sentences saying what you filled in
- missing: array of important ACORD 27 items not found in the user's information

If the user's information is not about a property policy at all, reply {"summary": "<short reason>", "missing": []}.`;
}

interface ChatImage { media_type: string; data: string }
interface ChatMessage { role: 'user' | 'assistant'; text: string; images?: ChatImage[] }

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

function toAnthropicMessages(input: unknown): Anthropic.Beta.BetaMessageParam[] | string {
  if (!Array.isArray(input) || input.length === 0) return 'No messages.';
  const msgs = input.slice(-MAX_MESSAGES) as ChatMessage[];
  let imageCount = 0;
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of msgs) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'Bad message.';
    const text = typeof m.text === 'string' ? m.text.slice(0, MAX_TEXT) : '';
    const images = m.role === 'user' && Array.isArray(m.images) ? m.images : [];
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const img of images) {
      if (!img || !IMAGE_TYPES.has(img.media_type) || typeof img.data !== 'string') return 'Unsupported image type.';
      if (++imageCount > MAX_IMAGES) return `Please send at most ${MAX_IMAGES} images at a time.`;
      content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type as 'image/png', data: img.data } });
    }
    if (text.trim()) content.push({ type: 'text', text });
    if (content.length === 0) continue;
    out.push({ role: m.role, content });
  }
  // The conversation must start with the user.
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return 'The last message must be from the user.';
  return out;
}

/** Lets the chat window know whether it can answer here, before the user types anything. */
export function GET(): Response {
  const useClaudeCode = process.env.CHAT_ENGINE === 'claude-code' && !process.env.VERCEL;
  const ready = !!process.env.VITE_SUPABASE_URL && (useClaudeCode || !!process.env.ANTHROPIC_API_KEY);
  return new Response(JSON.stringify({ ready, engine: useClaudeCode ? 'claude-code' : 'api' }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  // CHAT_ENGINE=claude-code (local .env only): answer through Claude Code on this PC with the owner's Claude account.
  const useClaudeCode = process.env.CHAT_ENGINE === 'claude-code' && !process.env.VERCEL;
  if (!supabaseUrl || !supabaseKey || (!useClaudeCode && !apiKey)) {
    return json(503, 'The ACORD Assistant is not set up yet. Add ANTHROPIC_API_KEY to the .env file (on your PC) or to the Vercel environment variables, or set CHAT_ENGINE=claude-code in .env to use Claude Code on your PC.');
  }

  // Only signed-in users of the app.
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, 'Please sign in first.');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json(401, 'Your session has expired. Please refresh the page.');

  // Who may use the assistant: CHAT_ACCESS = "admin" (default), "staff" (admin + trainers) or "everyone".
  // A personal Claude plan (Claude Code engine) is for the owner only, so that mode is always admin-only.
  const access = useClaudeCode ? 'admin' : (process.env.CHAT_ACCESS ?? 'admin').toLowerCase();
  if (access !== 'everyone') {
    const { data: me } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
    const allowed = access === 'staff' ? ['admin', 'trainer'] : ['admin'];
    if (!me || !allowed.includes(me.role)) return json(403, 'The ACORD Assistant is not available for your account yet.');
  }

  let body: { messages?: unknown; task?: unknown };
  try { body = await request.json(); } catch { return json(400, 'Bad request.'); }
  const messages = toAnthropicMessages(body.messages);
  if (typeof messages === 'string') return json(400, messages);
  // task "acord27" = fill an ACORD 27 training sample from the user's information (JSON reply); default = tutor chat.
  const fillAcord27 = body.task === 'acord27';
  const systemText = fillAcord27 ? acord27Prompt() : SYSTEM_PROMPT;

  const encoder = new TextEncoder();

  if (useClaudeCode) {
    const local = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (s: string) => controller.enqueue(encoder.encode(s));
        try {
          const { streamViaClaudeCode } = await import('./_claude-code.js');
          await streamViaClaudeCode(systemText, messages, send);
        } catch (err) {
          console.error('ACORD Assistant (Claude Code) error', err);
          send(`\n\n${(err as Error).message}`);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(local, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }

  const client = new Anthropic({ apiKey });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        const response = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          output_config: { effort: 'medium' },
          // If a safety classifier declines on this model, the API retries on a suitable fallback model.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          // The long tutor prompt (instructions + video transcripts) is cached between requests.
          system: fillAcord27
            ? [{ type: 'text', text: systemText }]
            : [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } }],
          messages,
          metadata: { user_id: auth.user.id },
        });
        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') send(event.delta.text);
        }
        const final = await response.finalMessage();
        if (final.stop_reason === 'refusal') send("\n\nSorry, I can't help with that one. Try rephrasing, or ask your trainer.");
        else if (final.stop_reason === 'max_tokens') send('\n\n(My answer was cut off. Ask me to continue.)');
      } catch (err) {
        console.error('ACORD Assistant error', err);
        const busy = err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError;
        send(busy ? '\n\nThe assistant is busy right now. Please try again in a minute.' : '\n\nSomething went wrong. Please try again.');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
