import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { GenerationModel, GenerationDoc, GenerationStatus } from '../models';

export interface UsageSummary {
  generations: number;
  succeeded: number;
  failed: number;
  simulated: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number;
  savedUsd: number;
  avgDurationMs: number | null;
}

export interface DailyUsage {
  date: string;
  generations: number;
  succeeded: number;
  costUsd: number;
  cacheHits: number;
}

export interface ProductUsage {
  externalId?: string;
  name?: string;
  generations: number;
  costUsd: number;
  cacheHits: number;
}

/** An empty window is zero spend, not a missing report. */
const EMPTY_SUMMARY: UsageSummary = {
  generations: 0,
  succeeded: 0,
  failed: 0,
  simulated: 0,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheHits: 0,
  savedUsd: 0,
  avgDurationMs: null,
};

export class GenerationRepository extends BaseRepository<GenerationDoc> {
  constructor() {
    super(GenerationModel);
  }

  /** Recent looks for the panel's thumbnail dock. Product is populated for name/image. */
  listForVisitor(visitor: Types.ObjectId, limit = 12): Promise<GenerationDoc[]> {
    return GenerationModel.find({ visitor, status: 'succeeded' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('product')
      .exec();
  }

  /** Newest renders for one merchant, for the admin spend view. */
  listForMerchant(merchant: Types.ObjectId, limit = 25): Promise<GenerationDoc[]> {
    return GenerationModel.find({ merchant })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('product')
      .exec();
  }

  findByIdPopulated(id: string | Types.ObjectId): Promise<GenerationDoc | null> {
    if (!this.isValidId(id)) return Promise.resolve(null);
    return GenerationModel.findById(id).populate('product').exec();
  }

  /** Cache hit: this visitor already rendered this product against this photo. */
  findSucceededFor(
    visitor: Types.ObjectId,
    product: Types.ObjectId,
    photo: Types.ObjectId,
  ): Promise<GenerationDoc | null> {
    return GenerationModel.findOne({ visitor, product, photo, status: 'succeeded' })
      .sort({ createdAt: -1 })
      .populate('product')
      .exec();
  }

  countSince(visitor: Types.ObjectId, since: Date): Promise<number> {
    return this.count({ visitor, createdAt: { $gte: since } });
  }

  /** One more request answered by an existing render instead of the model. */
  async recordCacheHit(id: Types.ObjectId): Promise<void> {
    await GenerationModel.updateOne({ _id: id }, { $inc: { cacheHits: 1 } }).exec();
  }

  /**
   * Spend and volume for one merchant over a window. Everything is summed in
   * Mongo rather than in Node — a busy month is far too many documents to pull
   * across the wire just to add up a column.
   */
  async usageSummary(merchant: Types.ObjectId, from: Date, to: Date): Promise<UsageSummary> {
    const [row] = await GenerationModel.aggregate<UsageSummary>([
      { $match: { merchant, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          generations: { $sum: 1 },
          succeeded: { $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          simulated: { $sum: { $cond: ['$simulated', 1, 0] } },
          costUsd: { $sum: '$costUsd' },
          inputTokens: { $sum: '$usage.inputTokens' },
          outputTokens: { $sum: '$usage.outputTokens' },
          cacheHits: { $sum: '$cacheHits' },
          // What those cache hits would have cost at the price of the render
          // they were served from.
          savedUsd: { $sum: { $multiply: ['$cacheHits', '$costUsd'] } },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
      { $project: { _id: 0 } },
    ]).exec();

    return row ?? EMPTY_SUMMARY;
  }

  /** The same numbers per calendar day, for a spend-over-time view. */
  dailyUsage(merchant: Types.ObjectId, from: Date, to: Date, timezone = 'Asia/Kolkata') {
    return GenerationModel.aggregate<DailyUsage>([
      { $match: { merchant, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone } },
          generations: { $sum: 1 },
          succeeded: { $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 1, 0] } },
          costUsd: { $sum: '$costUsd' },
          cacheHits: { $sum: '$cacheHits' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', generations: 1, succeeded: 1, costUsd: 1, cacheHits: 1 } },
    ]).exec();
  }

  /** Most expensive products, so a merchant can see where the budget goes. */
  usageByProduct(merchant: Types.ObjectId, from: Date, to: Date, limit = 10) {
    return GenerationModel.aggregate<ProductUsage>([
      { $match: { merchant, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$product',
          generations: { $sum: 1 },
          costUsd: { $sum: '$costUsd' },
          cacheHits: { $sum: '$cacheHits' },
        },
      },
      { $sort: { costUsd: -1, generations: -1 } },
      { $limit: limit },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          externalId: '$product.externalId',
          name: '$product.name',
          generations: 1,
          costUsd: 1,
          cacheHits: 1,
        },
      },
    ]).exec();
  }

  markStatus(
    id: Types.ObjectId,
    status: GenerationStatus,
    patch: Partial<GenerationDoc> = {},
  ): Promise<GenerationDoc | null> {
    return this.updateById(id, { $set: { status, ...patch } });
  }

  /** Frees jobs orphaned by a crash mid-render. */
  async failStale(olderThan: Date): Promise<number> {
    const res = await GenerationModel.updateMany(
      { status: { $in: ['queued', 'processing'] }, createdAt: { $lte: olderThan } },
      { $set: { status: 'failed', error: 'Generation timed out.', completedAt: new Date() } },
    ).exec();
    return res.modifiedCount ?? 0;
  }
}

export const generationRepository = new GenerationRepository();
