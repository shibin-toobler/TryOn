import fs from 'fs/promises';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { merchantRepository } from '../repositories/merchant.repository';
import { merchantService } from '../services/merchant.service';
import { catalogService, ProductInput } from '../services/catalog.service';
import { MerchantDoc, GarmentCategory } from '../models';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const MERCHANT_NAME = 'Selene';
const DEMO_ROOT = path.resolve(__dirname, '../../../../apps/demo-store');
const CATALOG_FILE = path.join(DEMO_ROOT, 'catalog.json');

/** One row of the merchant's own catalog feed. */
interface CatalogRow {
  sku: string;
  name: string;
  color?: string;
  price?: number;
  currency?: string;
  image: string;
  description?: string;
  category?: GarmentCategory;
  promptHint?: string;
}

/**
 * Reads the demo store's catalog and maps it to our product shape. This is the
 * translation step every real merchant integration needs: their field names on
 * the left, ours on the right.
 */
async function readCatalog(): Promise<ProductInput[]> {
  const raw = await fs.readFile(CATALOG_FILE, 'utf8').catch(() => {
    throw new Error(`Could not read the demo catalog at ${CATALOG_FILE}`);
  });

  const rows = JSON.parse(raw) as CatalogRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${CATALOG_FILE} is empty or not an array.`);
  }

  return rows.map((row) => ({
    externalId: row.sku,
    name: row.name,
    imageUrl: row.image,
    color: row.color ?? '',
    price: row.price ?? 0,
    currency: row.currency ?? 'INR',
    description: row.description ?? '',
    category: row.category ?? 'dress',
    promptHint: row.promptHint ?? '',
    active: true,
  }));
}

/** Points the demo store at the merchant we just created. Gitignored. */
async function writeDemoEnv(merchant: MerchantDoc): Promise<string> {
  const file = path.join(DEMO_ROOT, '.env.local');
  const body = [
    '# Written by `npm run seed`. Safe to delete and regenerate.',
    `NEXT_PUBLIC_TRYON_API_URL=${env.publicBaseUrl}`,
    `NEXT_PUBLIC_TRYON_KEY=${merchant.publishableKey}`,
    '# Sent as Origin on the storefront\'s server-side catalog fetch, which has no',
    '# browser to set one. Must be on the merchant\'s allowlist once that is filled in.',
    `NEXT_PUBLIC_STORE_ORIGIN=${process.env.STORE_ORIGIN ?? 'http://localhost:3000'}`,
    '',
  ].join('\n');

  await fs.writeFile(file, body, 'utf8');
  return file;
}

async function seed(): Promise<void> {
  const catalog = await readCatalog();
  await connectDatabase();

  let merchant = await merchantRepository.findOne({ name: MERCHANT_NAME });
  let secret = '(unchanged — merchant already existed)';

  if (!merchant) {
    merchant = await merchantService.create({
      name: MERCHANT_NAME,
      // Empty in development means any origin; lock this down before going live.
      allowedOrigins: [],
      theme: { accent: '#d06c4f', headline: "Let's see it on you." },
    });
    secret = merchant.secretKey;
    logger.info(`created merchant "${MERCHANT_NAME}"`);
  } else {
    logger.info(`merchant "${MERCHANT_NAME}" already exists — syncing catalog only`);
  }

  const { created, failed } = await catalogService.bulkUpsert(merchant._id, catalog);
  logger.info(
    `synced ${created.length}/${catalog.length} product(s) from catalog.json` +
      (failed.length ? `, ${failed.length} failed` : ''),
  );
  failed.forEach((f) => logger.warn(`  ${f.externalId}: ${f.reason}`));

  const envFile = await writeDemoEnv(merchant);

  console.log(`
──────────────────────────────────────────────────────────────
  Seed complete.

  Merchant        ${merchant.name}
  Publishable key ${merchant.publishableKey}
  Secret key      ${secret}
  Products        ${created.map((p) => p.externalId).join(', ')}

  Embed snippet:
  <script async src="${env.publicBaseUrl}/tryon.js"
          data-tryon-key="${merchant.publishableKey}"></script>

  Demo store env written to:
  ${envFile}
──────────────────────────────────────────────────────────────
`);

  await disconnectDatabase();
}

seed().catch(async (error) => {
  logger.error('seed failed', error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
