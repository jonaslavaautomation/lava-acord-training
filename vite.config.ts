import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { Readable } from 'node:stream';

/**
 * Runs the Vercel function api/chat.ts inside `npm run dev`, so the ACORD Assistant works on this PC
 * (http://localhost:5173) without deploying. Reads ANTHROPIC_API_KEY from the local .env file.
 * Only used by the dev server; production uses the Vercel function directly.
 */
function localApi(): Plugin {
  return {
    name: 'local-api-chat',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://localhost${req.originalUrl ?? '/api/chat'}`, {
            method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          const mod = await server.ssrLoadModule('/api/chat.ts');
          if (req.method !== 'POST' && req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
          const response: Response = req.method === 'GET' ? mod.GET() : await mod.POST(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (response.body) Readable.fromWeb(response.body as never).pipe(res);
          else res.end();
        } catch (err) {
          server.config.logger.error(`[api/chat] ${(err as Error).stack ?? err}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Local assistant error — see the terminal running npm run dev.' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Make .env values (ANTHROPIC_API_KEY, CHAT_ACCESS, VITE_SUPABASE_*) visible to api/chat.ts in dev.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v;
  return {
    plugins: [react(), localApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react', 'pdfjs-dist'],
    },
  };
});
