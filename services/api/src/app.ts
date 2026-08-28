import path from 'path';
import express, { Express } from 'express';
import cors from 'cors';
import { routes } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { env } from './config/env';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // The widget is embedded on merchant domains we do not know ahead of time, so
  // CORS is permissive here and the real gate is each merchant's origin
  // allowlist, enforced in requirePublishableKey.
  app.use(
    cors({
      origin: true,
      credentials: false,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-tryon-key', 'x-tryon-secret', 'x-admin-token'],
      exposedHeaders: ['RateLimit', 'RateLimit-Policy'],
      maxAge: 86400,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Stored photos and renders. Only needed for the local driver — with
  // Cloudinary the browser fetches straight from their CDN.
  if (env.storage.driver === 'local') {
    app.use(
      '/files',
      express.static(env.storage.dir, {
        maxAge: '7d',
        index: false,
        dotfiles: 'deny',
        setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
      }),
    );
  }

  // The plugin bundle itself, so a merchant's <script src> points at this API.
  const widgetDist = path.resolve(__dirname, '../../../packages/tryon-widget/dist');
  app.use(
    '/tryon.js',
    express.static(path.join(widgetDist, 'tryon.js'), {
      maxAge: env.isProduction ? '1h' : 0,
      setHeaders: (res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
