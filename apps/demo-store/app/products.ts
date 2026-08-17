import catalog from '../catalog.json';

export type Product = {
  /** Links this listing to the same product in the try-on engine. */
  sku: string;
  name: string;
  color: string;
  price: number;
  currency: string;
  image: string;
  description: string;
  /** Garment type and styling notes — only the engine reads these. */
  category: string;
  promptHint: string;
};

/**
 * The merchant's catalog, and the single source of truth for it in this repo.
 * The storefront renders from it; `npm run seed` pushes the same file into the
 * try-on engine, which is exactly what a real merchant's catalog sync would do.
 */
export const products: Product[] = catalog;
