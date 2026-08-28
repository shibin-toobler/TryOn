import { Router } from 'express';
import mongoose from 'mongoose';
import { widgetRoutes } from './widget.routes';
import { adminRoutes } from './admin.routes';
import { generationQueue } from '../jobs/generation.queue';
import { env } from '../config/env';

const router = Router();

router.get('/health', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    database: dbUp ? 'connected' : 'disconnected',
    provider: env.ai.provider,
    queueDepth: generationQueue.depth,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

router.use('/v1/widget', widgetRoutes);
router.use('/v1/admin', adminRoutes);

export const routes = router;
