import OpenAI, { toFile } from 'openai';
import { TryOnProvider, TryOnRequest, TryOnResult } from './provider.interface';
import { buildTryOnPrompt } from './prompt';
import { normaliseUsage, priceUsage } from './pricing';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';

/** gpt-image-1 / 1.5 / 1-mini accept input_fidelity; gpt-image-2 errors on it. */
const SUPPORTS_INPUT_FIDELITY = /^gpt-image-1/;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const extOf = (mime: string): string => EXT_BY_MIME[mime] ?? 'jpg';

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

    // Order matters, and so do the filenames: the model reads them, so calling
    // these "customer" and "garment" says which is which far more reliably than
    // "the first image" / "the second image" in the prompt text. Same labels the
    // jewellery POC settled on (`fileLabels` in its domain config).
    const images = await Promise.all([
      toFile(request.person.buffer, `customer.${extOf(request.person.mimeType)}`, {
        type: request.person.mimeType,
      }),
      toFile(request.garment.buffer, `garment.${extOf(request.garment.mimeType)}`, {
        type: request.garment.mimeType,
      }),
    ]);

    try {
      const response = await this.client.images.edit({
        model: env.ai.imageModel,
        image: images,
        prompt,
        n: 1,
        size: env.ai.imageSize as never,
        quality: env.ai.imageQuality as never,
        // input_fidelity is what keeps the shopper's face intact, but it is a
        // gpt-image-1-family parameter: gpt-image-2 rejects it with a 400 rather
        // than ignoring it, so it only goes out where it exists.
        ...(env.ai.inputFidelity && SUPPORTS_INPUT_FIDELITY.test(env.ai.imageModel)
          ? { input_fidelity: env.ai.inputFidelity as never }
          : {}),
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) {
        throw AppError.upstream('Image model returned no image data.');
      }

      // Priced at the moment of the call, not at read time: today's render must
      // keep today's rate even if PRICE_* changes next month.
      const usage = normaliseUsage((response as { usage?: unknown }).usage);
      const costUsd = priceUsage(usage, env.ai.imageModel);

      logger.info(
        `openai render: ${usage.outputTokens} output tokens, $${costUsd.toFixed(4)} ` +
          `(${env.ai.imageModel} ${env.ai.imageSize} ${env.ai.imageQuality})`,
      );

      return {
        image: Buffer.from(b64, 'base64'),
        mimeType: 'image/png',
        simulated: false,
        providerRef: (response as { created?: number }).created?.toString(),
        model: env.ai.imageModel,
        usage,
        costUsd,
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
