import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { ProductModel, ProductDoc } from '../models';

export class ProductRepository extends BaseRepository<ProductDoc> {
  constructor() {
    super(ProductModel);
  }

  findByExternalId(merchant: Types.ObjectId, externalId: string): Promise<ProductDoc | null> {
    return this.findOne({ merchant, externalId, active: true });
  }

  listForMerchant(merchant: Types.ObjectId, includeInactive = false): Promise<ProductDoc[]> {
    return this.find(
      { merchant, ...(includeInactive ? {} : { active: true }) },
      { sort: { createdAt: 1 } },
    );
  }

  /** Idempotent catalog sync — merchants can push the same feed repeatedly. */
  async upsertByExternalId(
    merchant: Types.ObjectId,
    externalId: string,
    data: Partial<ProductDoc>,
  ): Promise<ProductDoc> {
    const doc = await ProductModel.findOneAndUpdate(
      { merchant, externalId },
      { $set: { ...data, merchant, externalId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).exec();
    return doc as ProductDoc;
  }
}

export const productRepository = new ProductRepository();
