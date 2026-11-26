import { defineConfig } from 'astro/config';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function muntrumeAiDev() {
  const mount = (server) => {
    server.middlewares.use(async (req, res, next) => {
      const path = (req.url || '').split('?')[0];
      if (path !== '/api/ai') return next();
      try {
        const mod = await server.ssrLoadModule('/src/server/ai-handler.ts');
        const raw = await readBody(req);
        const headers = new Headers();
        if (req.headers['content-type']) headers.set('content-type', String(req.headers['content-type']));
        if (req.headers.origin) headers.set('origin', String(req.headers.origin));
        if (req.headers['x-forwarded-for']) headers.set('x-forwarded-for', String(req.headers['x-forwarded-for']));
        const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
          method: req.method,
          headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : raw,
        });
        const response = await mod.handleAiRequest(request, {});
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        if (!response.body) {
          res.end();
          return;
        }
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch {
        if (!res.headersSent) {
          res.statusCode = 200;
          res.setHeader('content-type', 'text/event-stream; charset=utf-8');
          res.end('data: {"token":"Respondo con el motor local."}\n\ndata: [DONE]\n\n');
          return;
        }
        res.end();
      }
    });
  };
  return {
    name: 'muntrume-ai-dev',
    configureServer: mount,
    configurePreviewServer(server) {
      if (typeof server.ssrLoadModule === 'function') mount(server);
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://muntru.me',
  outDir: '_site',
  build: {
    format: 'directory'
  },
  vite: {
    plugins: [muntrumeAiDev()]
  }
});
