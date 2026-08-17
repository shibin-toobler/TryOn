import { photoRepository } from '../repositories/photo.repository';
import { storage } from '../storage';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Mongo's TTL index drops expired photo rows on its own, but it knows nothing
 * about the files behind them. This sweeps files for rows that have passed
 * their expiry but not yet been collected.
 */
export async function sweepExpiredPhotos(): Promise<number> {
  if (env.retention.photoDays <= 0) return 0;

  const expired = await photoRepository.findExpired();
  let removed = 0;

  for (const photo of expired) {
    try {
      await storage.delete(photo.storageKey);
      await photoRepository.deleteById(photo._id);
      removed += 1;
    } catch (error) {
      logger.warn(`could not sweep photo ${photo._id.toString()}`, error);
    }
  }

  if (removed) logger.info(`retention sweep removed ${removed} photo(s)`);
  return removed;
}

export function startRetentionJob(intervalMs = 60 * 60 * 1000): void {
  if (env.retention.photoDays <= 0) {
    logger.warn('PHOTO_RETENTION_DAYS=0 — shopper photos are kept indefinitely.');
    return;
  }

  sweepExpiredPhotos().catch((error) => logger.error('retention sweep failed', error));
  setInterval(() => {
    sweepExpiredPhotos().catch((error) => logger.error('retention sweep failed', error));
  }, intervalMs).unref();
}
