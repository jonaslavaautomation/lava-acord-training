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
The people you talk to are mostly virtual assistants (VAs) learning to fill out commercial insurance ACORD forms for US insurance agencies: ACORD 125 (Commercial Insurance Application), 126 (Commercial General Liability), 127 (Business Auto), 130 (Workers Compensation) and 140 (Property). Trainers and the administrator use you too.

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

Transcripts of the LAVA training videos (automatic speech-to-text: "Accord", "a court" and "farm" mean ACORD and form; timestamps are [minutes:seconds]):

${VIDEO_TRANSCRIPTS}`;

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

  let body: { messages?: unknown };
  try { body = await request.json(); } catch { return json(400, 'Bad request.'); }
  const messages = toAnthropicMessages(body.messages);
  if (typeof messages === 'string') return json(400, messages);

  const encoder = new TextEncoder();

  if (useClaudeCode) {
    const local = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (s: string) => controller.enqueue(encoder.encode(s));
        try {
          const { streamViaClaudeCode } = await import('./_claude-code.js');
          await streamViaClaudeCode(SYSTEM_PROMPT, messages, send);
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
          // The long system prompt (instructions + video transcripts) is cached between requests.
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } }],
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
