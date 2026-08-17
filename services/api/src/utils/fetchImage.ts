import { AppError } from './errors';
import { env } from '../config/env';

const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export interface FetchedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Pulls a garment image from the merchant's CDN so it can be handed to the
 * model. Merchant-supplied URLs are attacker-adjacent input, so http(s) only
 * and a hard size ceiling.
 */
export async function fetchImage(url: string, timeoutMs = 20_000): Promise<FetchedImage> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw AppError.badRequest(`Product image URL is not a valid URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw AppError.badRequest('Product image URL must be http or https.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) {
      throw AppError.upstream(`Could not fetch product image (HTTP ${response.status}).`);
    }

    const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.has(mimeType)) {
      throw AppError.badRequest(`Product image must be JPEG, PNG or WebP (got "${mimeType}").`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > env.storage.maxUploadBytes) {
      throw AppError.payloadTooLarge('Product image is too large.');
    }

    return { buffer, mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as Error).name === 'AbortError') {
      throw AppError.upstream('Timed out fetching the product image.');
    }
    throw AppError.upstream((error as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
