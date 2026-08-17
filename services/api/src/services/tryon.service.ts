import { Types } from 'mongoose';
import { generationRepository } from '../repositories/generation.repository';
import { GenerationDoc, MerchantDoc, VisitorDoc } from '../models';
import { catalogService } from './catalog.service';
import { photoService } from './photo.service';
import { generationQueue } from '../jobs/generation.queue';
import { getTryOnProvider } from '../providers/ai';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export interface TryOnInput {
  merchant: MerchantDoc;
  visitor: VisitorDoc;
  /** Merchant SKU from `data-tryon-product` on their page. */
  externalId: string;
  /** Skip the cache and render again from the same photo. */
  force?: boolean;
}

export class TryOnService {
  /**
   * Queues a render and returns immediately. The widget polls
   * GET /v1/widget/generations/:id until it settles.
   */
  async request(input: TryOnInput): Promise<{ generation: GenerationDoc; cached: boolean }> {
    const { merchant, visitor, externalId, force = false } = input;

    const product = await catalogService.requireByExternalId(merchant._id, externalId);
    const photo = await photoService.requireActive(visitor);

    if (!force) {
      const cached = await generationRepository.findSucceededFor(
        visitor._id,
        product._id,
        photo._id,
      );
      // Same person, same garment, same photo — no reason to pay for it twice.
      if (cached) return { generation: cached, cached: true };
    }

    await this.enforceRateLimit(visitor._id);

    const generation = await generationRepository.create({
      merchant: merchant._id,
      visitor: visitor._id,
      product: product._id,
      photo: photo._id,
      status: 'queued',
      provider: getTryOnProvider().name,
    } as Partial<GenerationDoc>);

    generationQueue.enqueue(generation._id);

    await generation.populate('product');
    return { generation, cached: false };
  }

  async requireForVisitor(visitor: VisitorDoc, generationId: string): Promise<GenerationDoc> {
    const generation = await generationRepository.findByIdPopulated(generationId);
    if (!generation) throw AppError.notFound('Unknown generation.');
    // Scoped lookup: one visitor must never be able to read another's renders.
    if (!generation.visitor.equals(visitor._id)) throw AppError.notFound('Unknown generation.');
    return generation;
  }

  listRecent(visitor: VisitorDoc, limit = 12): Promise<GenerationDoc[]> {
    return generationRepository.listForVisitor(visitor._id, limit);
  }

  private async enforceRateLimit(visitor: Types.ObjectId): Promise<void> {
    const limit = env.security.generationLimitPerHour;
    if (limit <= 0) return;

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const used = await generationRepository.countSince(visitor, since);
    if (used >= limit) {
      throw AppError.tooManyRequests(
        `You have reached the limit of ${limit} try-ons per hour. Try again a little later.`,
      );
    }
  }
}

export const tryOnService = new TryOnService();
