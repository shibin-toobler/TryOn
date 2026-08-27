export type Product = {
  /** Links this listing to the same product in the try-on engine. */
  sku: string;
  name: string;
  color: string;
  price: number;
  currency: string;
  image: string;
  description: string;
  /** Garment type — the engine uses it to decide which garment to replace. */
  category: string;
};

const API_URL = process.env.NEXT_PUBLIC_TRYON_API_URL ?? 'http://localhost:4000';
const KEY = process.env.NEXT_PUBLIC_TRYON_KEY ?? '';
/**
 * Sent as the Origin header on the server-side fetch below. A browser sets this
 * automatically; a server request has to say who it is, and the merchant's
 * origin allowlist is checked against it.
 */
const ORIGIN = process.env.NEXT_PUBLIC_STORE_ORIGIN ?? 'http://localhost:3000';

/** One row as the engine returns it from GET /v1/widget/products. */
type ApiProduct = {
  id: string;
  externalId: string;
  name: string;
  color: string;
  price: number;
  currency: string;
  imageUrl: string;
  description: string;
  category: string;
};

export type CatalogResult =
  | { ok: true; products: Product[] }
  | { ok: false; products: Product[]; error: string };

/**
 * The merchant's catalog, read live from the engine on every request.
 *
 * `catalog.json` is still the feed `npm run seed` imports, but nothing renders
 * from it any more: add, edit or deactivate a product in the database and the
 * storefront reflects it on the next page load, with no rebuild. That is what a
 * real merchant's product listing does.
 */
export async function fetchProducts(): Promise<CatalogResult> {
  if (!KEY) {
    return { ok: false, products: [], error: 'NEXT_PUBLIC_TRYON_KEY is not set.' };
  }

  try {
    const response = await fetch(`${API_URL}/v1/widget/products`, {
      headers: { 'x-tryon-key': KEY, origin: ORIGIN },
      // No caching anywhere: the catalog is the live state of the database.
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      return {
        ok: false,
        products: [],
        error: body?.error?.message ?? `The try-on engine returned HTTP ${response.status}.`,
      };
    }

    const { products } = (await response.json()) as { products: ApiProduct[] };
    return { ok: true, products: products.map(toStoreProduct) };
  } catch (error) {
    // Almost always the API simply not running yet — say so plainly on the page
    // rather than crashing the whole storefront.
    return {
      ok: false,
      products: [],
      error: `Could not reach the try-on engine at ${API_URL}. ${(error as Error).message}`,
    };
  }
}

/** The engine's field names on the left, the storefront's on the right. */
const toStoreProduct = (p: ApiProduct): Product => ({
  sku: p.externalId,
  name: p.name,
  color: p.color,
  price: p.price,
  currency: p.currency,
  image: p.imageUrl,
  description: p.description,
  category: p.category,
});
