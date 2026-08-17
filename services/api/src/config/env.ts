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
    imageSize: str('OPENAI_IMAGE_SIZE', '1024x1536'),
    timeoutMs: num('AI_TIMEOUT_MS', 120_000),
    mockDelayMs: num('MOCK_DELAY_MS', 2500),
  },

  storage: {
    driver: str('STORAGE_DRIVER', 'local').toLowerCase(),
    dir: path.isAbsolute(str('STORAGE_DIR', 'storage'))
      ? str('STORAGE_DIR', 'storage')
      : path.resolve(__dirname, '../..', str('STORAGE_DIR', 'storage')),
    maxUploadBytes: num('MAX_UPLOAD_BYTES', 8 * 1024 * 1024),
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

/** Fails fast on config that would only blow up later, mid-request. */
export function assertEnv(): void {
  const problems: string[] = [];

  if (env.ai.provider === 'openai' && !env.ai.openaiApiKey) {
    problems.push('AI_PROVIDER=openai but OPENAI_API_KEY is empty.');
  }
  if (!['openai', 'mock'].includes(env.ai.provider)) {
    problems.push(`AI_PROVIDER must be "openai" or "mock", got "${env.ai.provider}".`);
  }
  if (!['local', 'cloudinary'].includes(env.storage.driver)) {
    problems.push(`STORAGE_DRIVER must be "local" or "cloudinary", got "${env.storage.driver}".`);
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
