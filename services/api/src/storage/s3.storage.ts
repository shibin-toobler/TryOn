import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageDriver, StoredObject } from './storage.interface';
import { env } from '../config/env';
import { token } from '../utils/ids';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * S3-backed storage for shopper photos and generated renders.
 *
 * The bucket is expected to be private, with Block Public Access left on: every
 * URL handed to a browser is presigned and expires, so a leaked link stops
 * working and nothing is reachable by guessing a key. Set S3_DELIVERY=public
 * only for a bucket that is genuinely meant to be world-readable — usually one
 * fronted by CloudFront.
 *
 * Works against any S3-compatible endpoint (MinIO, R2) via S3_ENDPOINT.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const { bucket, region, accessKeyId, secretAccessKey, sessionToken, endpoint, forcePathStyle } =
      env.s3;

    if (!bucket) throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET.');
    this.bucket = bucket;

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : { forcePathStyle }),
      // Omitting credentials entirely is deliberate: the SDK then walks its
      // default chain (env, shared config, IAM role) instead of being handed
      // a half-populated object it would treat as authoritative.
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } }
        : {}),
    });
  }

  /** Namespaces every object under S3_PREFIX so one bucket can serve more than this app. */
  private scoped(key: string): string {
    return env.s3.prefix ? `${env.s3.prefix}/${key}`.replace(/\/+/g, '/') : key;
  }

  async save(prefix: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const ext = EXTENSIONS[mimeType] ?? 'bin';
    const key = `${prefix}/${Date.now()}-${token(12)}.${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.scoped(key),
          Body: data,
          ContentType: mimeType,
          // At-rest encryption with S3's own keys: free, and one less finding
          // in anybody's security review.
          ServerSideEncryption: 'AES256',
        }),
      );
    } catch (error) {
      throw AppError.upstream(`S3 upload failed: ${(error as Error).message}`);
    }

    // The stored key stays prefix-free so STORAGE_PREFIX can change without
    // orphaning every row already in Mongo.
    return { key, bytes: data.byteLength, mimeType };
  }

  async read(key: string): Promise<Buffer> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.scoped(key) }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) throw new Error('empty body');
      return Buffer.from(bytes);
    } catch (error) {
      throw AppError.notFound(`S3 object not readable: ${(error as Error).message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: this.scoped(key) }),
      );
    } catch (error) {
      // Deleting is idempotent; a missing object is not worth raising.
      logger.warn(`s3 delete failed for ${key}`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.scoped(key) }));
      return true;
    } catch {
      return false;
    }
  }

  async urlFor(key: string): Promise<string> {
    const scoped = this.scoped(key);

    if (env.s3.delivery === 'public') {
      const base =
        env.s3.publicBaseUrl ||
        (env.s3.endpoint
          ? `${env.s3.endpoint.replace(/\/$/, '')}/${this.bucket}`
          : `https://${this.bucket}.s3.${env.s3.region}.amazonaws.com`);
      return `${base}/${scoped}`;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: scoped }),
      { expiresIn: env.s3.urlExpirySeconds },
    );
  }
}
