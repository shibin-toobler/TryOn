import { Types } from 'mongoose';
import { productRepository } from '../repositories/product.repository';
import { ProductDoc, GarmentCategory } from '../models';
import { AppError } from '../utils/errors';

export interface ProductInput {
  externalId: string;
  name: string;
  imageUrl: string;
  color?: string;
  price?: number;
  currency?: string;
  description?: string;
  category?: GarmentCategory;
  promptHint?: string;
  active?: boolean;
}

export class CatalogService {
  list(merchant: Types.ObjectId, includeInactive = false): Promise<ProductDoc[]> {
    return productRepository.listForMerchant(merchant, includeInactive);
  }

  async requireByExternalId(merchant: Types.ObjectId, externalId: string): Promise<ProductDoc> {
    const product = await productRepository.findByExternalId(merchant, externalId);
    if (!product) {
      throw AppError.notFound(
        `No active product with SKU "${externalId}". Sync it via POST /v1/admin/products first.`,
      );
    }
    return product;
  }

  upsert(merchant: Types.ObjectId, input: ProductInput): Promise<ProductDoc> {
    return productRepository.upsertByExternalId(merchant, input.externalId, input as Partial<ProductDoc>);
  }

  /** Bulk feed import. Reports per-SKU failures instead of aborting the batch. */
  async bulkUpsert(merchant: Types.ObjectId, items: ProductInput[]) {
    const created: ProductDoc[] = [];
    const failed: { externalId: string; reason: string }[] = [];

    for (const item of items) {
      try {
        created.push(await this.upsert(merchant, item));
      } catch (error) {
        failed.push({ externalId: item.externalId, reason: (error as Error).message });
      }
    }

    return { created, failed };
  }

  async remove(merchant: Types.ObjectId, externalId: string): Promise<void> {
    const product = await productRepository.findOne({ merchant, externalId });
    if (!product) throw AppError.notFound(`No product with SKU "${externalId}".`);
    await productRepository.deleteById(product._id);
  }
}

export const catalogService = new CatalogService();
