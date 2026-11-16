// Local-only engine for the ACORD Assistant: answers through the Claude Code CLI installed on this PC,
// signed in with the owner's own Claude account (no API key). Used when CHAT_ENGINE=claude-code in .env
// and the app runs with `npm run dev`. It never runs on Vercel and is limited to the administrator,
// because a personal Claude plan is for the account owner's own use.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';

const TIMEOUT_MS = 180_000;

/** Turns the chat history into one prompt; attached images are saved as files Claude Code can open with Read. */
async function buildPrompt(dir: string, messages: Anthropic.Beta.BetaMessageParam[]): Promise<{ prompt: string; images: number }> {
  let images = 0;
  const turns: string[] = [];
  for (const m of messages) {
    const blocks = typeof m.content === 'string' ? [{ type: 'text' as const, text: m.content }] : (m.content ?? []);
    const text: string[] = [];
    const files: string[] = [];
    for (const b of blocks) {
      if (b.type === 'text') text.push(b.text);
      else if (b.type === 'image' && b.source.type === 'base64') {
        const ext = b.source.media_type.split('/')[1].replace('jpeg', 'jpg');
        const name = `image-${++images}.${ext}`;
        await writeFile(path.join(dir, name), Buffer.from(b.source.data, 'base64'));
        files.push(path.join(dir, name));
      }
    }
    const who = m.role === 'user' ? 'User' : 'You (ACORD Assistant)';
    const attached = files.length ? `\n[Attached image file(s), open each with the Read tool before answering: ${files.join(', ')}]` : '';
    turns.push(`${who}: ${text.join('\n')}${attached}`);
  }
  const history = turns.slice(0, -1);
  const prompt = (history.length ? `Conversation so far:\n\n${history.join('\n\n')}\n\n---\n\n` : '')
    + `${turns[turns.length - 1]}\n\nReply to the user's last message as the ACORD Assistant. Write only the reply itself.`;
  return { prompt, images };
}

export async function streamViaClaudeCode(
  systemPrompt: string,
  messages: Anthropic.Beta.BetaMessageParam[],
  send: (text: string) => void,
): Promise<void> {
  if (process.env.VERCEL) throw new Error('The Claude Code engine only runs on your own PC.');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'acord-assistant-'));
  try {
    await writeFile(path.join(dir, 'system-prompt.txt'), systemPrompt);
    const { prompt, images } = await buildPrompt(dir, messages);
    const args = [
      '-p',
      '--system-prompt-file', path.join(dir, 'system-prompt.txt'),
      // No tools at all, except reading the attached images in this temporary folder.
      '--tools', images ? 'Read' : '',
      ...(images ? ['--allowedTools', 'Read'] : []),
      '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
      '--no-session-persistence', '--setting-sources', '', '--strict-mcp-config',
    ];

    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.env.CLAUDE_CODE_PATH || 'claude', args, { cwd: dir, windowsHide: true });
      const timer = setTimeout(() => { child.kill(); reject(new Error('Claude Code took too long to answer.')); }, TIMEOUT_MS);
      let buffer = '';
      let stderr = '';
      let sentText = false;
      let resultError: string | null = null;

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        buffer += chunk;
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: { type?: string; is_error?: boolean; result?: string; event?: { type?: string; delta?: { type?: string; text?: string } } };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta' && ev.event.delta.text) {
            send(ev.event.delta.text);
            sentText = true;
          } else if (ev.type === 'stream_event' && ev.event?.type === 'message_start' && sentText) {
            send('\n\n'); // next turn after reading an image
          } else if (ev.type === 'result' && ev.is_error) {
            resultError = ev.result || 'Claude Code reported an error.';
          }
        }
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (d: string) => { stderr += d; });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error((err as NodeJS.ErrnoException).code === 'ENOENT'
          ? 'Claude Code was not found on this PC. Install it, or set CLAUDE_CODE_PATH in .env.'
          : err.message));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (resultError) reject(new Error(resultError));
        else if (code !== 0 && !sentText) reject(new Error(stderr.trim().split('\n').pop() || `Claude Code exited with code ${code}.`));
        else resolve();
      });
      child.stdin.end(prompt);
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
