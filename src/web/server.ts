import express from 'express';

export interface WebOptions { port: number; host: string; }

export async function startWebServer(opts: WebOptions) {
  const app = express();
  app.get('/', (_req, res) => res.send('Torrent Subtitle Extractor Web UI coming soon'));
  await new Promise<void>((resolve) => {
    app.listen(opts.port, opts.host, () => resolve());
  });
  // eslint-disable-next-line no-console
  console.log(`Web UI listening at http://${opts.host}:${opts.port}`);
}
