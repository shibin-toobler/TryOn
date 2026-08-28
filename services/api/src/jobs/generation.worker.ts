import { Types } from 'mongoose';
import { generationRepository } from '../repositories/generation.repository';
import { photoRepository } from '../repositories/photo.repository';
import { productRepository } from '../repositories/product.repository';
import { getTryOnProvider } from '../providers/ai';
import { EMPTY_USAGE } from '../providers/ai/pricing';
import { GenerationDoc } from '../models';
import { storage } from '../storage';
import { fetchImage } from '../utils/fetchImage';
import { logger } from '../utils/logger';
import { generationQueue } from './generation.queue';
import { env } from '../config/env';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Runs one queued generation end to end. Never throws — failures land on the doc. */
export async function processGeneration(generationId: Types.ObjectId): Promise<void> {
  const generation = await generationRepository.findById(generationId);
  if (!generation) {
    logger.warn(`generation ${generationId.toString()} vanished before processing`);
    return;
  }
  if (generation.status !== 'queued') return;

  const startedAt = new Date();
  await generationRepository.markStatus(generation._id, 'processing', { startedAt });

  try {
    const [photo, product] = await Promise.all([
      photoRepository.findById(generation.photo),
      productRepository.findById(generation.product),
    ]);
    if (!photo) throw new Error('The shopper photo for this render is no longer available.');
    if (!product) throw new Error('The product for this render no longer exists.');

    const [personBuffer, garment] = await Promise.all([
      storage.read(photo.storageKey),
      fetchImage(product.imageUrl),
    ]);

    const provider = getTryOnProvider();
    const result = await provider.generate({
      person: {
        buffer: personBuffer,
        mimeType: photo.mimeType,
        filename: `person.${EXTENSION_BY_MIME[photo.mimeType] ?? 'png'}`,
      },
      garment: {
        buffer: garment.buffer,
        mimeType: garment.mimeType,
        filename: `garment.${EXTENSION_BY_MIME[garment.mimeType] ?? 'png'}`,
      },
      garmentName: product.name,
      garmentColor: product.color,
      garmentDescription: product.description,
      category: product.category,
      promptHint: product.promptHint,
    });

    const stored = await storage.save(
      `generations/${generation.merchant.toString()}/${generation.visitor.toString()}`,
      result.image,
      result.mimeType,
    );

    const completedAt = new Date();
    await generationRepository.markStatus(generation._id, 'succeeded', {
      resultKey: stored.key,
      resultMimeType: stored.mimeType,
      simulated: result.simulated,
      modelName: result.model ?? null,
      usage: result.usage ?? EMPTY_USAGE,
      costUsd: result.costUsd ?? 0,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      error: null,
      // Renders age out with the photo that produced them.
      expiresAt: photo.expiresAt,
    } as Partial<GenerationDoc>);

    logger.info(
      `generation ${generation._id.toString()} succeeded in ${
        completedAt.getTime() - startedAt.getTime()
      }ms via ${provider.name} — $${(result.costUsd ?? 0).toFixed(4)}`,
    );
  } catch (error) {
    const message = (error as Error).message || 'Generation failed.';
    const completedAt = new Date();

    await generationRepository.markStatus(generation._id, 'failed', {
      error: message,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    });
    logger.error(`generation ${generation._id.toString()} failed: ${message}`);
  }
}

export function startGenerationWorker(): void {
  generationQueue.register(processGeneration);

  // Anything still queued or processing well past the provider timeout was
  // orphaned by a restart. Release it so the widget stops polling forever.
  const staleAfterMs = env.ai.timeoutMs + 60_000;
  setInterval(() => {
    generationRepository
      .failStale(new Date(Date.now() - staleAfterMs))
      .then((n) => n > 0 && logger.warn(`released ${n} stale generation(s)`))
      .catch((error) => logger.error('stale sweep failed', error));
  }, 60_000).unref();
}
