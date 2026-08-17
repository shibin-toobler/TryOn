import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const message = {
  error: { code: 'rate_limited', message: 'Too many requests. Slow down and try again shortly.' },
};

export const widgetRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.security.rateLimitPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

/** Uploads are heavier than reads, so they get their own tighter budget. */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(5, Math.floor(env.security.rateLimitPerMinute / 6)),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});
