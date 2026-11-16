// ACORD Assistant bridge: lets the LIVE website's chatbot answer through Claude Code on this PC
// (the owner's company Claude account, no API key).
//
//   node scripts/assistant-bridge.mjs        (started automatically at Windows sign-in; see scripts/assistant-bridge.bat)
//
// It listens on http://127.0.0.1:5174 only (not reachable from other computers), accepts requests only from the
// LAVA web app, and reuses api/chat.ts, which still checks that the caller is signed in as the administrator.
// Claude Code runs with no tools except reading the photos attached to a question.
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createServer as createVite, loadEnv } from 'vite';

const PORT = Number(process.env.ASSISTANT_BRIDGE_PORT || 5174);
const ALLOWED_ORIGINS = new Set([
  'https://lava-acord-training.vercel.app',
  'http://localhost:5173',
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const [k, v] of Object.entries(loadEnv('development', root, ''))) process.env[k] ??= v;
process.env.CHAT_ENGINE = 'claude-code';

// Vite compiles api/chat.ts (TypeScript) on the fly, exactly like `npm run dev` does.
const vite = await createVite({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

const log = (...a) => console.log(new Date().toISOString(), ...a);

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const allowed = typeof origin === 'string' && ALLOWED_ORIGINS.has(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') { res.statusCode = allowed ? 204 : 403; res.end(); return; }
  // Browsers always send Origin on these cross-site requests; anything else (other sites, scripts) is refused.
  if (!allowed) { res.statusCode = 403; res.end('Forbidden'); return; }

  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/api/chat' || (req.method !== 'GET' && req.method !== 'POST')) { res.statusCode = 404; res.end(); return; }

  try {
    const mod = await vite.ssrLoadModule('/api/chat.ts');
    let response;
    if (req.method === 'GET') {
      response = mod.GET();
    } else {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      response = await mod.POST(new Request('http://localhost/api/chat', { method: 'POST', headers, body: Buffer.concat(chunks) }));
      log('chat request ->', response.status);
    }
    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch (err) {
    log('error', err?.stack ?? err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'The assistant on your PC hit an error. See the bridge log.' }));
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') { log(`Port ${PORT} is already in use: the bridge is probably already running.`); process.exit(0); }
  throw err;
});
server.listen(PORT, '127.0.0.1', () => log(`ACORD Assistant bridge ready on http://127.0.0.1:${PORT}`));
