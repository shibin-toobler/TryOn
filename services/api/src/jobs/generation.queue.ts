import { Types } from 'mongoose';
import { logger } from '../utils/logger';

type Handler = (generationId: Types.ObjectId) => Promise<void>;

/**
 * In-process job queue with a concurrency cap.
 *
 * Image generation takes 10-40s, far too long to hold an HTTP request open, so
 * the API returns 202 and the widget polls. One API instance is enough for a
 * pilot; moving to multiple instances means swapping this for BullMQ/Redis or
 * Vercel Queues without touching the service layer above it.
 */
export class GenerationQueue {
  private readonly pending: Types.ObjectId[] = [];
  private active = 0;
  private handler: Handler | null = null;

  constructor(private readonly concurrency = 2) {}

  register(handler: Handler): void {
    this.handler = handler;
  }

  enqueue(generationId: Types.ObjectId): void {
    this.pending.push(generationId);
    queueMicrotask(() => this.drain());
  }

  get depth(): number {
    return this.pending.length + this.active;
  }

  private drain(): void {
    if (!this.handler) {
      logger.error('generation queue has no handler registered');
      return;
    }

    while (this.active < this.concurrency && this.pending.length > 0) {
      const id = this.pending.shift()!;
      this.active += 1;

      this.handler(id)
        .catch((error) => logger.error(`generation ${id.toString()} threw`, error))
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }
}

export const generationQueue = new GenerationQueue(
  Number(process.env.GENERATION_CONCURRENCY ?? 2),
);
