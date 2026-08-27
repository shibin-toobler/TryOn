import { Storefront } from './Storefront';
import { fetchProducts } from './products';

/**
 * Rendered on the server, on every request, against the live catalog in the
 * try-on engine's database. Nothing about the listing is baked in at build time.
 */
export const dynamic = 'force-dynamic';

export default async function Home() {
  const result = await fetchProducts();

  return (
    <Storefront products={result.products} error={result.ok ? undefined : result.error} />
  );
}
