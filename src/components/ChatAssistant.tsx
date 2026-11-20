import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, Download, ExternalLink, FileText, ImagePlus, Laptop, Loader2, MessageCircle, RotateCcw, Send, Timer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { destroyTrainingSample, generateCustomTrainingSample, generateTrainingSample, isCustomSampleRequest, parseSampleRequest, SAMPLE_LIFETIME_MS, type SampleForm, type TrainingSample } from '../lib/trainingSample';
import { parseAcord27Reply } from '../lib/acord27Layout';
import type { Acord25Data } from '../lib/acord25Layout';

interface ChatImage { media_type: string; data: string; preview: string }
interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: ChatImage[];
  /** Handled inside the app (training samples); never sent to the AI. */
  local?: boolean;
  sample?: TrainingSample;
  expired?: boolean;
}

/** The ACORD Assistant bridge on the owner's PC (scripts/assistant-bridge.mjs). Only reachable from that PC. */
const BRIDGE_URL = 'http://127.0.0.1:5174';

/** Forms the assistant can make watermarked training samples of. */
const SAMPLE_CARDS: { form: SampleForm; name: string; examples: string }[] = [
  { form: '27', name: 'Evidence of Property', examples: "for example a declarations page or the lender's request" },
  { form: '25', name: 'Certificate of Insurance', examples: 'for example declarations pages or the COI request email' },
];
const MAX_IMAGES_PER_MESSAGE = 4;
const MAX_IMAGES_SENT = 4;      // across the conversation, newest first
const MAX_EDGE = 1568;          // Claude's recommended max image edge
const SUGGESTIONS = [
  'What is the difference between the ACORD 125 and 126?',
  'When does a signature need to be on the form?',
  'How do I list two owners on the ACORD 130?',
  'What does coinsurance mean on the ACORD 140?',
];

/** Shrinks big photos/screenshots so uploads stay small; returns base64 without the data: prefix. */
async function prepareImage(file: File): Promise<ChatImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file could not be read as an image.'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process the image.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return { media_type: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Tiny Markdown renderer for the assistant's replies: paragraphs, bullet/numbered lists, **bold**, `code`. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i} className="text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i} className="px-1 rounded bg-bg-base font-mono text-[12px]">{part.slice(1, -1)}</code>;
    return part;
  });
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(<Tag key={blocks.length} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>{list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(heading
      ? <p key={blocks.length} className="font-semibold text-white">{renderInline(heading[1])}</p>
      : <p key={blocks.length}>{renderInline(line)}</p>);
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

/** Watermarked training sample with a live 20-minute countdown; deleted from the app when time is up. */
function SampleCard({ sample, expired, onExpire }: { sample: TrainingSample; expired?: boolean; onExpire: (url: string) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (expired) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [expired]);
  const left = Math.max(0, sample.expiresAt - now);
  useEffect(() => { if (!expired && left === 0) onExpire(sample.url); }, [expired, left, onExpire, sample.url]);
  if (expired) {
    return (
      <div className="p-3 rounded-lg border border-line-subtle bg-bg-base text-xs text-muted-500">
        This ACORD {sample.moduleId} training sample expired after 20 minutes and was removed.
      </div>
    );
  }
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  return (
    <div className="p-3 rounded-lg border border-lava-600/30 bg-lava-600/5 space-y-2.5">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-lava-400" />
        <span className="text-sm font-medium text-white flex-1">Training sample: ACORD {sample.moduleId}</span>
        <span className={`flex items-center gap-1 text-xs font-mono ${left < 120000 ? 'text-lava-300' : 'text-muted-400'}`}><Timer className="w-3.5 h-3.5" />{mm}:{ss}</span>
      </div>
      <p className="text-xs text-muted-400">
        {sample.fileName.includes('custom') ? `Filled with your information (${sample.fieldCount} fields)` : `Filled with the practice scenario's correct answers (${sample.fieldCount} fields)`} and watermarked "TRAINING PURPOSES ONLY". It is removed from the app when the timer reaches 00:00.
      </p>
      <div className="flex gap-2">
        <a href={sample.url} target="_blank" rel="noreferrer" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Open sample</a>
        <a href={sample.url} download={sample.fileName} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Download</a>
      </div>
    </div>
  );
}

/** Sends the conversation with only the newest few images, to keep requests small. Sample messages stay in the app. */
function toPayload(allMessages: ChatMessage[]) {
  const messages = allMessages.filter((m) => !m.local);
  let budget = MAX_IMAGES_SENT;
  return messages.slice().reverse().map((m) => {
    const keep = (m.images ?? []).slice(0, Math.max(0, budget));
    budget -= keep.length;
    const dropped = (m.images?.length ?? 0) - keep.length;
    const text = dropped > 0 ? `${m.text}\n[${dropped} earlier image(s) not re-sent]` : m.text;
    return { role: m.role, text, images: keep.map(({ media_type, data }) => ({ media_type, data })) };
  }).reverse();
}

export function ChatAssistant() {
  const { isAdmin, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<ChatImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Where answers come from: this website's own /api/chat (API key), or the ACORD Assistant bridge running on
  // this PC (Claude Code with the owner's Claude account, scripts/assistant-bridge.mjs).
  // null = still checking; false = neither is available.
  const [ready, setReady] = useState<boolean | null>(null);
  const [apiBase, setApiBase] = useState('');
  useEffect(() => {
    // Keep checking every few seconds until connected, so it connects by itself once the PC helper is up.
    if (!open || ready === true) return;
    let cancelled = false;
    const probe = async (base: string) => {
      try {
        const r = await fetch(`${base}/api/chat`, { method: 'GET', signal: AbortSignal.timeout(3000) });
        return r.ok && !!((await r.json()) as { ready?: boolean }).ready;
      } catch {
        return false;
      }
    };
    const check = async () => {
      let base: string | null = null;
      if (await probe('')) base = '';
      // Only the administrator's own PC runs the Claude Code helper; don't make trainers' browsers look for it.
      else if (isAdmin && await probe(BRIDGE_URL)) base = BRIDGE_URL;
      if (cancelled) return;
      if (base !== null) { setApiBase(base); setReady(true); } else setReady(false);
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [open, ready, isAdmin]);
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const viaPc = apiBase === BRIDGE_URL;

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const addFiles = async (files: Iterable<File>) => {
    setError(null);
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    if (!images.length) { setError('Only images can be attached (PNG, JPG, screenshots).'); return; }
    const room = MAX_IMAGES_PER_MESSAGE - pending.length;
    if (room <= 0) { setError(`You can attach up to ${MAX_IMAGES_PER_MESSAGE} images per message.`); return; }
    try {
      const prepared = await Promise.all(images.slice(0, room).map(prepareImage));
      setPending((p) => [...p, ...prepared]);
      if (images.length > room) setError(`Only the first ${MAX_IMAGES_PER_MESSAGE} images were attached.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // ---------------------------------------------------------------- training samples (built in the app, not by the AI)
  const samplesRef = useRef<TrainingSample[]>([]);
  useEffect(() => () => samplesRef.current.forEach(destroyTrainingSample), []);

  const expireSample = useCallback((url: string) => {
    const s = samplesRef.current.find((x) => x.url === url);
    if (s) destroyTrainingSample(s);
    samplesRef.current = samplesRef.current.filter((x) => x.url !== url);
    setMessages((m) => m.map((x) => (x.sample?.url === url ? { ...x, expired: true } : x)));
  }, []);

  const clearConversation = () => {
    samplesRef.current.forEach(destroyTrainingSample);
    samplesRef.current = [];
    setMessages([]);
    setError(null);
  };

  /** Reads a streamed /api/chat reply to the end. */
  const readReply = async (res: Response) => {
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error ?? 'The assistant is not available right now.');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    return text;
  };

  /**
   * Standard sample: the practice scenario's correct answers.
   * Custom sample: the AI reads the user's own question, notes and photos and the app fills the form with them.
   */
  const makeSample = async (requestText: string, form: SampleForm | 'other', custom = false) => {
    const images = custom ? pending : [];
    const userMsg: ChatMessage = { role: 'user', text: requestText || `Create a sample ACORD ${form} from this.`, images, local: !custom };
    const history = [...messages, userMsg];
    setInput('');
    if (custom) setPending([]);
    setError(null);
    const reply = (m: Partial<ChatMessage>) => setMessages((all) => [...all.slice(0, -1), { role: 'assistant', text: '', local: true, ...m }]);
    setMessages([...history, { role: 'assistant', text: '', local: true }]);
    if (form === 'other') {
      reply({ text: 'Training samples are available for the **ACORD 27** and the **ACORD 25** only. Ask me for a "sample ACORD 27" or a "sample ACORD 25".' });
      return;
    }
    if (custom && ready !== true) {
      reply({ text: isAdmin
        ? "To build a sample from your own information I need the AI chat, which isn't connected yet. Wait a moment for it to connect, then ask again. The standard sample works right now."
        : `Building a sample from your own information needs the AI chat, which runs on the administrator's computer. You can still create the standard sample ACORD ${form}.` });
      return;
    }
    setBusy(true);
    try {
      let sample: TrainingSample;
      let text: string;
      if (custom) {
        reply({ text: `Reading your information and filling the ACORD ${form}…` });
        const { data } = await supabase.auth.getSession();
        const res = await fetch(`${apiBase}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
          body: JSON.stringify({ task: `acord${form}`, messages: toPayload(history) }),
        });
        // The reply is one JSON object; the same parser works for both forms.
        const extracted = parseAcord27Reply(await readReply(res)) as Acord25Data;
        sample = await generateCustomTrainingSample(form, extracted);
        const missing = (extracted.missing ?? []).filter(Boolean);
        text = `${extracted.summary ?? `Here is your ACORD ${form} built from your information.`}${missing.length ? `\n\n**Not in your information (left blank):** ${missing.join(', ')}.` : ''}\n\nIt is watermarked for training and will be removed in ${SAMPLE_LIFETIME_MS / 60000} minutes.`;
      } else {
        sample = await generateTrainingSample(form);
        text = `Here is a watermarked ACORD ${form} sample. Use it to check that each answer sits in the right box. It will be removed in ${SAMPLE_LIFETIME_MS / 60000} minutes.`;
      }
      samplesRef.current.push(sample);
      reply({ text, sample });
    } catch (e) {
      reply({ text: `I couldn't create the sample: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  /** Puts a starter sentence in the box so the user can add their details or a photo. */
  const startCustomSample = (form: SampleForm) => {
    setInput(`Create a sample ACORD ${form} from this information: `);
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (busy || (!text && pending.length === 0)) return;
    const sampleRequest = isStaff && text ? parseSampleRequest(text) : null;
    if (sampleRequest) {
      const custom = sampleRequest !== 'other' && isCustomSampleRequest(text, pending.length > 0, messages.some((m) => m.role === 'user' && !m.local));
      await makeSample(text, sampleRequest, custom);
      return;
    }
    if (ready !== true) {
      setError(isStaff ? "The AI chat isn't connected right now. You can still create a training sample." : "The AI chat isn't connected right now.");
      return;
    }
    const userMsg: ChatMessage = { role: 'user', text: text || 'Please look at this image.', images: pending };
    const history = [...messages, userMsg];
    setMessages([...history, { role: 'assistant', text: '' }]);
    setInput(''); setPending([]); setError(null); setBusy(true);

    const update = (t: string) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', text: t }]);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: toPayload(history) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? (res.status === 413 ? 'Those images are too large. Try fewer or smaller images.' : 'The assistant is not available right now.'));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        update(reply);
      }
      if (!reply.trim()) update('Sorry, I did not get an answer. Please try again.');
    } catch (e) {
      setMessages(history.slice(0, -1));
      setInput(userMsg.text === 'Please look at this image.' ? '' : userMsg.text);
      setPending(userMsg.images ?? []);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Ask the ACORD Assistant"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-lava-600 hover:bg-lava-500 text-white shadow-lg shadow-black/40 text-sm font-medium transition-colors">
        <MessageCircle className="w-5 h-5" /> Ask ACORD Assistant
      </button>
    );
  }

  return (
    <div
      className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:h-[min(640px,calc(100vh-40px))] flex flex-col bg-bg-surface sm:rounded-2xl border border-line-subtle shadow-2xl shadow-black/50 overflow-hidden"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line-subtle">
        <div className="w-8 h-8 rounded-full bg-lava-600/20 flex items-center justify-center"><Bot className="w-4 h-4 text-lava-400" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">ACORD Assistant</div>
          <div className="text-[11px] text-muted-500">
            {ready === null ? 'Connecting…' : viaPc ? 'Ask about ACORD forms · via Claude Code on your PC' : 'Ask about ACORD 125, 126, 127, 130, 140, 27, 25'}
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearConversation} disabled={busy} title="New conversation" className="p-1.5 rounded-md text-muted-400 hover:text-white hover:bg-bg-hover"><RotateCcw className="w-4 h-4" /></button>
        )}
        <button onClick={() => setOpen(false)} title="Close" className="p-1.5 rounded-md text-muted-400 hover:text-white hover:bg-bg-hover"><X className="w-4 h-4" /></button>
      </div>

      {ready === false && messages.length === 0 && !isStaff ? (
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 text-sm text-muted-400 leading-relaxed">
          <div className="w-10 h-10 rounded-full bg-lava-600/15 flex items-center justify-center"><Laptop className="w-5 h-5 text-lava-400" /></div>
          {isLocal ? (
            <>
              <p className="text-white font-medium">The assistant isn't switched on for this PC.</p>
              <p>Add <code className="px-1 rounded bg-bg-base font-mono text-[12px]">CHAT_ENGINE=claude-code</code> to the <code className="px-1 rounded bg-bg-base font-mono text-[12px]">.env</code> file, then restart the app.</p>
            </>
          ) : (
            <>
              <p className="text-white font-medium flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-lava-400" /> Connecting to the assistant on your PC…</p>
              <p>The assistant answers through Claude Code on your computer and starts by itself when you sign in to Windows. Right after the PC starts it can take up to a minute. This window connects automatically as soon as it's ready.</p>
              <p>If your browser asks to let this site <span className="text-slate-200">access apps on this device</span>, click <span className="text-slate-200">Allow</span>.</p>
              <p className="text-[11px] text-muted-500">Still not connecting after a few minutes? Double-click <span className="text-slate-300">Start ACORD Assistant</span> on your desktop. It only works on the computer where Claude Code is installed and signed in.</p>
            </>
          )}
        </div>
      ) : (
      <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        {messages.length === 0 && ready === false && (
          <div className="p-3 rounded-lg border border-line-subtle bg-bg-base text-xs text-muted-400 leading-relaxed space-y-1.5">
            {isAdmin ? (
              <>
                <p className="text-slate-200 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-lava-400" /> Connecting to the AI chat on your PC…</p>
                <p>It starts by itself when you sign in to Windows and connects here automatically. If your browser asks to let this site access apps on this device, click Allow. Training samples work right away.</p>
              </>
            ) : (
              <p>The AI chat runs on the administrator's computer, so it isn't available here. You can still create a watermarked training sample below.</p>
            )}
          </div>
        )}
        {messages.length === 0 && ready !== false && (
          <div className="space-y-3">
            <p className="text-muted-400 leading-relaxed">
              Hi! Ask me anything about ACORD forms. You can also <span className="text-slate-200">paste (Ctrl+V)</span>, drag in or attach a screenshot or photo of a form and ask about it.
            </p>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full text-left px-3 py-2 rounded-lg border border-line-subtle bg-bg-base hover:border-lava-600/40 text-xs text-slate-300">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && isStaff && SAMPLE_CARDS.map((c) => (
          <div key={c.form} className="space-y-1.5">
            <button onClick={() => makeSample(`Generate a sample ACORD ${c.form}`, c.form)} disabled={busy}
              className="w-full text-left p-3 rounded-lg border border-lava-600/30 bg-lava-600/5 hover:bg-lava-600/10 space-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-white"><FileText className="w-4 h-4 text-lava-400" /> Generate a sample ACORD {c.form} <span className="text-muted-400 font-normal">({c.name})</span></span>
              <span className="block text-xs text-muted-400">Trainers: the ACORD {c.form} filled with the practice scenario's correct answers, watermarked "Training purposes only". Available for 20 minutes.</span>
            </button>
            <button onClick={() => startCustomSample(c.form)} disabled={busy}
              className="w-full text-left p-3 rounded-lg border border-line-subtle bg-bg-base hover:border-lava-600/40 space-y-1">
              <span className="flex items-center gap-2 text-sm font-medium text-white"><ImagePlus className="w-4 h-4 text-lava-400" /> ACORD {c.form} from my information</span>
              <span className="block text-xs text-muted-400">Type the details or attach a photo ({c.examples}). The assistant fills an ACORD {c.form} with them, watermarked, for 20 minutes.</span>
            </button>
          </div>
        ))}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex gap-2'}>
            {m.role === 'assistant' && <div className="w-6 h-6 rounded-full bg-lava-600/20 flex items-center justify-center shrink-0 mt-0.5"><Bot className="w-3.5 h-3.5 text-lava-400" /></div>}
            <div className={m.role === 'user'
              ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-lava-600/20 border border-lava-600/20 px-3 py-2 text-slate-100 space-y-2'
              : 'max-w-[90%] text-slate-300 leading-relaxed'}>
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.images.map((img, j) => <img key={j} src={img.preview} alt="Attached" className="h-20 rounded-md border border-line-subtle object-cover" />)}
                </div>
              )}
              {m.role === 'user'
                ? <p className="whitespace-pre-wrap">{m.text}</p>
                : m.text ? <Markdown text={m.text} /> : <Loader2 className="w-4 h-4 animate-spin text-muted-400" />}
              {m.sample && <SampleCard sample={m.sample} expired={m.expired} onExpire={expireSample} />}
            </div>
          </div>
        ))}
      </div>

      {dragging && <div className="absolute inset-0 bg-lava-600/10 border-2 border-dashed border-lava-500 flex items-center justify-center text-sm text-white pointer-events-none">Drop the image here</div>}

      <div className="border-t border-line-subtle p-3 space-y-2">
        {error && <div className="text-xs text-lava-300">{error}</div>}
        {isStaff && messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_CARDS.map((c) => (
              <span key={c.form} className="contents">
                <button onClick={() => makeSample(`Generate a sample ACORD ${c.form}`, c.form)} disabled={busy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-lava-600/30 text-[11px] text-slate-300 hover:bg-lava-600/10">
                  <FileText className="w-3.5 h-3.5 text-lava-400" /> Sample ACORD {c.form}
                </button>
                <button onClick={() => startCustomSample(c.form)} disabled={busy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line-subtle text-[11px] text-slate-300 hover:bg-bg-hover">
                  <ImagePlus className="w-3.5 h-3.5 text-lava-400" /> ACORD {c.form} from my info
                </button>
              </span>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.preview} alt="To send" className="h-14 w-14 rounded-md object-cover border border-line-subtle" />
                <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} title="Remove" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bg-base border border-line-subtle flex items-center justify-center text-muted-400 hover:text-white"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={busy} title="Attach a photo or screenshot" className="p-2 rounded-lg text-muted-400 hover:text-white hover:bg-bg-hover"><ImagePlus className="w-5 h-5" /></button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
              if (files.length) { e.preventDefault(); addFiles(files); }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            maxLength={8000}
            placeholder="Type a question, or paste a screenshot…"
            className="input flex-1 resize-none max-h-32 text-sm py-2"
          />
          <button onClick={() => send()} disabled={busy || (!input.trim() && pending.length === 0)} title="Send" className="btn-primary p-2.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-600">AI answers can be wrong. Check important details with your trainer.</p>
      </div>
      </>
      )}
    </div>
  );
}
