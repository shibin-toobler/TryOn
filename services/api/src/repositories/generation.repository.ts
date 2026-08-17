import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { GenerationModel, GenerationDoc, GenerationStatus } from '../models';

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
