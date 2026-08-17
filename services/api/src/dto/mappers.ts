import { GenerationDoc, MerchantDoc, PhotoDoc, ProductDoc } from '../models';
import { storage } from '../storage';

export const toPublicProduct = (p: ProductDoc) => ({
  id: p._id.toString(),
  externalId: p.externalId,
  name: p.name,
  color: p.color,
  price: p.price,
  currency: p.currency,
  imageUrl: p.imageUrl,
  description: p.description,
  category: p.category,
});

export const toAdminProduct = (p: ProductDoc) => ({
  ...toPublicProduct(p),
  promptHint: p.promptHint,
  active: p.active,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export const toPublicPhoto = (photo: PhotoDoc) => ({
  id: photo._id.toString(),
  url: storage.urlFor(photo.storageKey),
  uploadedAt: photo.createdAt,
  expiresAt: photo.expiresAt,
});

export const toPublicGeneration = (gen: GenerationDoc) => {
  const product = gen.populated('product') ? (gen.product as unknown as ProductDoc) : null;

  return {
    id: gen._id.toString(),
    status: gen.status,
    simulated: gen.simulated,
    resultUrl: gen.resultKey ? storage.urlFor(gen.resultKey) : null,
    error: gen.error,
    durationMs: gen.durationMs,
    createdAt: gen.createdAt,
    product: product ? toPublicProduct(product) : { id: gen.product.toString() },
  };
};

export const toWidgetMerchant = (m: MerchantDoc) => ({
  id: m._id.toString(),
  name: m.name,
  theme: { accent: m.theme.accent, headline: m.theme.headline },
});

export const toAdminMerchant = (m: MerchantDoc, includeSecret = false) => ({
  id: m._id.toString(),
  name: m.name,
  publishableKey: m.publishableKey,
  ...(includeSecret ? { secretKey: m.secretKey } : {}),
  allowedOrigins: m.allowedOrigins,
  status: m.status,
  theme: m.theme,
  createdAt: m.createdAt,
});
