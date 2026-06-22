import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get(
    '**',
    express.static(browserDistFolder, {
      maxAge: '1y',
      index: 'index.html',
    }),
  );

  // Rutas protegidas (admin/seller/collector): dependen de APIs del navegador
  // (localStorage, window, document) para auth y UI. Servimos el shell CSR
  // puro (index.csr.html) y dejamos que Angular renderice todo client-side.
  // OJO: NO usar index.html — con `prerender: true` ese archivo trae HTML
  // pre-renderizado (ej. la pantalla de login), lo que provoca el "pestañeo"
  // de login antes de que el router resuelva la ruta real en el cliente.
  server.get(
    [
      '/admin',
      '/admin/*',
      '/seller',
      '/seller/*',
      '/collector',
      '/collector/*',
    ],
    (req, res) => {
      res.sendFile(join(browserDistFolder, 'index.csr.html'));
    },
  );

  // All regular routes use the Angular engine
  server.get('**', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
