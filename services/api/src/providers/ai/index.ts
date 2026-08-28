import { TryOnProvider } from './provider.interface';
import { OpenAIProvider } from './openai.provider';
import { MockProvider } from './mock.provider';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

let instance: TryOnProvider | null = null;

/** Lazily built so the API still boots when a key is missing in development. */
export function getTryOnProvider(): TryOnProvider {
  if (instance) return instance;

  instance = env.ai.provider === 'openai' ? new OpenAIProvider() : new MockProvider();
  logger.info(`try-on provider: ${instance.name}`);
  return instance;
}

export type {
  TryOnProvider,
  TryOnRequest,
  TryOnResult,
  ImageInput,
} from './provider.interface';
