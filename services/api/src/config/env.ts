import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const str = (key: string, fallback = ''): string => process.env[key]?.trim() || fallback;
const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const list = (key: string): string[] =>
  str(key)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  port: num('PORT', 4000),
  publicBaseUrl: str('PUBLIC_BASE_URL', `http://localhost:${num('PORT', 4000)}`).replace(/\/$/, ''),

  mongoUri: str('MONGODB_URI', 'mongodb://127.0.0.1:27017/tryon'),

  ai: {
    provider: str('AI_PROVIDER', 'mock').toLowerCase(),
    openaiApiKey: str('OPENAI_API_KEY'),
    imageModel: str('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
    imageQuality: str('OPENAI_IMAGE_QUALITY', 'medium'),
    /**
     * 'auto' lets the model keep the shopper photo's own aspect ratio. Forcing a
     * fixed size makes it re-compose the shot, which is a large part of why a
     * render comes back with the background rebuilt.
     */
    imageSize: str('OPENAI_IMAGE_SIZE', 'auto'),
    /**
     * How much of the shopper survives the edit — the face above all. Distinct
     * from imageQuality, which is how finely the output is rendered: cut quality
     * to save money, never fidelity. Empty string disables it entirely.
     */
    inputFidelity: str('OPENAI_IMAGE_FIDELITY', 'high'),
    timeoutMs: num('AI_TIMEOUT_MS', 120_000),
    mockDelayMs: num('MOCK_DELAY_MS', 2500),
  },

  /**
   * USD per 1M tokens, billed separately for text in, image in and image out.
   * Defaults are gpt-image-1's published rates; they are env-overridable because
   * a price change must never mean a code change. Verify against
   * https://openai.com/api/pricing/ before trusting a spend report.
   */
  pricing: {
    textInputPerMTok: num('PRICE_TEXT_INPUT_PER_MTOK', 5),
    imageInputPerMTok: num('PRICE_IMAGE_INPUT_PER_MTOK', 10),
    imageOutputPerMTok: num('PRICE_IMAGE_OUTPUT_PER_MTOK', 40),
    /**
     * Some models emit output text tokens alongside the image. Defaults to the
     * image-output rate, which over-estimates rather than under-estimates — the
     * safer direction for a budget.
     */
    textOutputPerMTok: num('PRICE_TEXT_OUTPUT_PER_MTOK', num('PRICE_IMAGE_OUTPUT_PER_MTOK', 40)),
    /** Which model the global rates above were actually set for. */
    ratedModel: str('PRICE_RATED_MODEL', 'gpt-image-1'),
    /** Display only — the ledger itself is always stored in USD. */
    usdToInr: num('USD_TO_INR', 88),
  },

  storage: {
    driver: str('STORAGE_DRIVER', 'local').toLowerCase(),
    dir: path.isAbsolute(str('STORAGE_DIR', 'storage'))
      ? str('STORAGE_DIR', 'storage')
      : path.resolve(__dirname, '../..', str('STORAGE_DIR', 'storage')),
    maxUploadBytes: num('MAX_UPLOAD_BYTES', 8 * 1024 * 1024),
  },

  s3: {
    /** ap-south-1 is Mumbai; ap-south-2 is Hyderabad. */
    region: str('AWS_REGION', 'ap-south-1'),
    bucket: str('S3_BUCKET'),
    /**
     * Left empty on a deployed box: the SDK then walks its default credential
     * chain and picks up the IAM role, which beats long-lived keys in a file.
     */
    accessKeyId: str('AWS_ACCESS_KEY_ID'),
    secretAccessKey: str('AWS_SECRET_ACCESS_KEY'),
    sessionToken: str('AWS_SESSION_TOKEN'),
    /** Key prefix inside the bucket, so one bucket can hold more than this app. */
    prefix: str('S3_PREFIX', 'tryon'),
    /**
     * 'presigned' keeps the bucket private and hands out signed, expiring URLs —
     * the right default for photographs of real people. 'public' assumes the
     * objects are world-readable and returns a plain, cacheable URL.
     */
    delivery: str('S3_DELIVERY', 'presigned').toLowerCase() === 'public'
      ? ('public' as const)
      : ('presigned' as const),
    /** SigV4 caps a presigned URL at 7 days; an hour outlives any browsing session. */
    urlExpirySeconds: num('S3_URL_EXPIRY_SECONDS', 3600),
    /** Set for MinIO or any S3-compatible endpoint; empty means real AWS. */
    endpoint: str('S3_ENDPOINT'),
    forcePathStyle: str('S3_FORCE_PATH_STYLE').toLowerCase() === 'true',
    /** Serve through CloudFront instead of the bucket host, when delivery=public. */
    publicBaseUrl: str('S3_PUBLIC_BASE_URL').replace(/\/$/, ''),
  },

  cloudinary: {
    /** Single-string form; encodes cloud name, key and secret together. */
    url: str('CLOUDINARY_URL'),
    cloudName: str('CLOUDINARY_CLOUD_NAME'),
    apiKey: str('CLOUDINARY_API_KEY'),
    apiSecret: str('CLOUDINARY_API_SECRET'),
    folder: str('CLOUDINARY_FOLDER', 'tryon'),
    /** 'authenticated' assets require a signed URL; 'public' ones do not. */
    delivery: str('CLOUDINARY_DELIVERY', 'authenticated').toLowerCase() === 'public'
      ? ('public' as const)
      : ('authenticated' as const),
  },

  retention: {
    photoDays: num('PHOTO_RETENTION_DAYS', 30),
  },

  security: {
    adminBootstrapToken: str('ADMIN_BOOTSTRAP_TOKEN'),
    adminCorsOrigins: list('ADMIN_CORS_ORIGINS'),
    rateLimitPerMinute: num('RATE_LIMIT_PER_MINUTE', 60),
    generationLimitPerHour: num('GENERATION_LIMIT_PER_HOUR', 20),
  },

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
} as const;

/**
 * Per-model rate override, e.g. PRICE_GPT_IMAGE_2_IMAGE_OUTPUT_PER_MTOK.
 * Returns null when unset, so the caller can fall back and say so.
 */
export function modelRateOverride(model: string, meter: string): number | null {
  const key = `PRICE_${model.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')}_${meter}_PER_MTOK`;
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Fails fast on config that would only blow up later, mid-request. */
export function assertEnv(): void {
  const problems: string[] = [];

  if (env.ai.provider === 'openai' && !env.ai.openaiApiKey) {
    problems.push('AI_PROVIDER=openai but OPENAI_API_KEY is empty.');
  }
  if (!['openai', 'mock'].includes(env.ai.provider)) {
    problems.push(`AI_PROVIDER must be "openai" or "mock", got "${env.ai.provider}".`);
  }
  if (!['local', 's3', 'cloudinary'].includes(env.storage.driver)) {
    problems.push(
      `STORAGE_DRIVER must be "local", "s3" or "cloudinary", got "${env.storage.driver}".`,
    );
  }
  if (env.storage.driver === 's3') {
    if (!env.s3.bucket) problems.push('STORAGE_DRIVER=s3 requires S3_BUCKET.');
    if (!env.s3.region) problems.push('STORAGE_DRIVER=s3 requires AWS_REGION.');
    // One key without the other is a typo, not a credential-chain fallback.
    if (Boolean(env.s3.accessKeyId) !== Boolean(env.s3.secretAccessKey)) {
      problems.push(
        'Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or neither to use the ' +
          "instance's IAM role.",
      );
    }
    if (env.s3.delivery === 'presigned' && env.s3.urlExpirySeconds > 604_800) {
      problems.push('S3_URL_EXPIRY_SECONDS cannot exceed 604800 (7 days), the SigV4 limit.');
    }
  }
  if (env.storage.driver === 'cloudinary') {
    const { url, cloudName, apiKey, apiSecret } = env.cloudinary;
    if (!url && !(cloudName && apiKey && apiSecret)) {
      problems.push(
        'STORAGE_DRIVER=cloudinary requires either CLOUDINARY_URL, or all of ' +
          'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      );
    }
  }
  if (env.isProduction && !env.security.adminBootstrapToken) {
    problems.push('ADMIN_BOOTSTRAP_TOKEN must be set in production.');
  }

  if (problems.length) {
    throw new Error(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
  }
}
