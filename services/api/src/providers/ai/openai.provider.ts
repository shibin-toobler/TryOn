import OpenAI, { toFile } from 'openai';
import { TryOnProvider, TryOnRequest, TryOnResult } from './provider.interface';
import { buildTryOnPrompt } from './prompt';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/**
 * Real try-on generation through OpenAI's image edit endpoint. Both the person
 * photo and the garment photo go in as reference images; the model returns a
 * single composite.
 */
export class OpenAIProvider implements TryOnProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor() {
    if (!env.ai.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai.');
    }
    this.client = new OpenAI({
      apiKey: env.ai.openaiApiKey,
      timeout: env.ai.timeoutMs,
      maxRetries: 1,
    });
  }

  async generate(request: TryOnRequest): Promise<TryOnResult> {
    const prompt = buildTryOnPrompt(request);

    // Order matters — the prompt refers to "the first image" and "the second image".
    const images = await Promise.all([
      toFile(request.person.buffer, request.person.filename, { type: request.person.mimeType }),
      toFile(request.garment.buffer, request.garment.filename, { type: request.garment.mimeType }),
    ]);

    try {
      const response = await this.client.images.edit({
        model: env.ai.imageModel,
        image: images,
        prompt,
        n: 1,
        size: env.ai.imageSize as never,
        quality: env.ai.imageQuality as never,
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) {
        throw AppError.upstream('Image model returned no image data.');
      }

      return {
        image: Buffer.from(b64, 'base64'),
        mimeType: 'image/png',
        simulated: false,
        providerRef: (response as { created?: number }).created?.toString(),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;

      const err = error as { status?: number; message?: string; code?: string };
      logger.error('openai generation failed', {
        status: err.status,
        code: err.code,
        message: err.message,
      });

      // Content filters are a shopper-facing problem, not a system fault: the
      // photo needs to change, so say so rather than reporting a server error.
      if (err.status === 400 && /moderation|safety|content|policy/i.test(err.message ?? '')) {
        throw AppError.badRequest(
          'That photo could not be processed. Try a clear, fully-clothed full-body photo.',
        );
      }
      if (err.status === 429) {
        throw AppError.tooManyRequests('The image service is busy. Try again in a moment.');
      }

      throw AppError.upstream(err.message ?? 'Image generation failed.');
    }
  }
}
