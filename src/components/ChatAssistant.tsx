import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, ImagePlus, Loader2, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ChatImage { media_type: string; data: string; preview: string }
interface ChatMessage { role: 'user' | 'assistant'; text: string; images?: ChatImage[] }

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

/** Sends the conversation with only the newest few images, to keep requests small. */
function toPayload(messages: ChatMessage[]) {
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

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (busy || (!text && pending.length === 0)) return;
    const userMsg: ChatMessage = { role: 'user', text: text || 'Please look at this image.', images: pending };
    const history = [...messages, userMsg];
    setMessages([...history, { role: 'assistant', text: '' }]);
    setInput(''); setPending([]); setError(null); setBusy(true);

    const update = (t: string) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', text: t }]);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/chat', {
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
          <div className="text-[11px] text-muted-500">Ask about ACORD 125, 126, 127, 130, 140</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setError(null); }} disabled={busy} title="New conversation" className="p-1.5 rounded-md text-muted-400 hover:text-white hover:bg-bg-hover"><RotateCcw className="w-4 h-4" /></button>
        )}
        <button onClick={() => setOpen(false)} title="Close" className="p-1.5 rounded-md text-muted-400 hover:text-white hover:bg-bg-hover"><X className="w-4 h-4" /></button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
        {messages.length === 0 && (
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
            </div>
          </div>
        ))}
      </div>

      {dragging && <div className="absolute inset-0 bg-lava-600/10 border-2 border-dashed border-lava-500 flex items-center justify-center text-sm text-white pointer-events-none">Drop the image here</div>}

      <div className="border-t border-line-subtle p-3 space-y-2">
        {error && <div className="text-xs text-lava-300">{error}</div>}
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
    </div>
  );
}
