import { TryOnProvider, TryOnRequest, TryOnResult } from './provider.interface';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Development stand-in. Returns the shopper's own photo back after a realistic
 * delay so the full pipeline — queue, polling, storage, every UI state — can be
 * exercised without an API key or a bill. `simulated: true` propagates to the
 * widget, which labels the result rather than passing it off as a real render.
 */
export class MockProvider implements TryOnProvider {
  readonly name = 'mock';

  async generate(request: TryOnRequest): Promise<TryOnResult> {
    logger.info(`mock provider: pretending to render "${request.garmentName}"`);
    await new Promise((resolve) => setTimeout(resolve, env.ai.mockDelayMs));

    return {
      image: request.person.buffer,
      mimeType: request.person.mimeType,
      simulated: true,
      providerRef: 'mock',
    };
  }
}
