import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { StorageDriver, StoredObject } from './storage.interface';
import { env } from '../config/env';
import { token } from '../utils/ids';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Cloudinary-backed storage for shopper photos and generated renders.
 *
 * Assets default to Cloudinary's `authenticated` delivery type, which means the
 * URL carries a signature and cannot be guessed from the public_id alone —
 * important, because these are photographs of real people. Flip
 * CLOUDINARY_DELIVERY=public for plain cacheable CDN URLs.
 */
export class CloudinaryStorageDriver implements StorageDriver {
  readonly name = 'cloudinary';
  private readonly deliveryType: 'authenticated' | 'upload';

  constructor() {
    const { url, cloudName, apiKey, apiSecret } = env.cloudinary;

    if (url) {
      // The SDK reads CLOUDINARY_URL from the environment on its own.
      cloudinary.config({ secure: true });
    } else if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    } else {
      throw new Error(
        'Cloudinary is not configured. Set CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + ' +
          'CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.',
      );
    }

    this.deliveryType = env.cloudinary.delivery === 'public' ? 'upload' : 'authenticated';
  }

  /**
   * `prefix` is the logical path the service layer chose
   * (e.g. photos/<merchantId>/<visitorId>); it becomes the Cloudinary folder so
   * the media library stays navigable.
   */
  async save(prefix: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const folder = `${env.cloudinary.folder}/${prefix}`.replace(/\/+/g, '/');
    const publicId = `${Date.now()}-${token(12)}`;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'image',
          type: this.deliveryType,
          overwrite: false,
          // Nothing here should be indexed or transformed on the way in.
          unique_filename: false,
          use_filename: false,
        },
        (error, response) => {
          if (error || !response) {
            reject(AppError.upstream(error?.message ?? 'Cloudinary upload failed.'));
            return;
          }
          resolve(response);
        },
      );
      stream.end(data);
    });

    return {
      // public_id already includes the folder path — it is the whole key.
      key: result.public_id,
      bytes: result.bytes ?? data.byteLength,
      mimeType,
    };
  }

  async read(key: string): Promise<Buffer> {
    const response = await fetch(await this.urlFor(key));
    if (!response.ok) {
      throw AppError.notFound(`Cloudinary asset not readable (HTTP ${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(key, {
        resource_type: 'image',
        type: this.deliveryType,
        invalidate: true,
      });
    } catch (error) {
      // Deleting is idempotent; a missing asset is not an error worth raising.
      logger.warn(`cloudinary delete failed for ${key}`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await cloudinary.api.resource(key, { resource_type: 'image', type: this.deliveryType });
      return true;
    } catch {
      return false;
    }
  }

  async urlFor(key: string): Promise<string> {
    return cloudinary.url(key, {
      secure: true,
      resource_type: 'image',
      type: this.deliveryType,
      // Signing is what makes an authenticated asset reachable at all.
      sign_url: this.deliveryType === 'authenticated',
    });
  }
}
