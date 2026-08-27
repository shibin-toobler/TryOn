import { env, modelRateOverride } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * What one render consumed, as reported by the provider. These models bill
 * several meters separately — the prompt text, the reference images going in,
 * and the generated image coming out, which is the expensive one. Some models
 * also emit output *text* tokens alongside the image.
 */
export interface TokenUsage {
  textInputTokens: number;
  imageInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Portion of outputTokens that was image. */
  outputImageTokens: number;
  /** Portion of outputTokens that was text — gpt-image-1.5 reports these. */
  outputTextTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
  textInputTokens: 0,
  imageInputTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  outputImageTokens: 0,
  outputTextTokens: 0,
};

export interface Rates {
  textInputPerMTok: number;
  imageInputPerMTok: number;
  imageOutputPerMTok: number;
  textOutputPerMTok: number;
}

const warned = new Set<string>();

/**
 * Rates for one model.
 *
 * Different image models do not bill alike — measured on the same try-on,
 * gpt-image-2 consumed 3x the input image tokens of gpt-image-1 — so pricing
 * every model off one table quietly reports the wrong number. Per-model
 * overrides come from env as PRICE_<MODEL>_<METER>_PER_MTOK, e.g.
 * PRICE_GPT_IMAGE_2_IMAGE_OUTPUT_PER_MTOK.
 *
 * A model with no overrides falls back to the global rates and says so once, so
 * an unpriced model shows up in the logs rather than silently reporting a
 * plausible-looking figure.
 */
export function ratesFor(model: string | undefined): Rates {
  const base: Rates = {
    textInputPerMTok: env.pricing.textInputPerMTok,
    imageInputPerMTok: env.pricing.imageInputPerMTok,
    imageOutputPerMTok: env.pricing.imageOutputPerMTok,
    textOutputPerMTok: env.pricing.textOutputPerMTok,
  };

  if (!model) return base;

  const overrides = {
    textInputPerMTok: modelRateOverride(model, 'TEXT_INPUT'),
    imageInputPerMTok: modelRateOverride(model, 'IMAGE_INPUT'),
    imageOutputPerMTok: modelRateOverride(model, 'IMAGE_OUTPUT'),
    textOutputPerMTok: modelRateOverride(model, 'TEXT_OUTPUT'),
  };

  const any = Object.values(overrides).some((v) => v !== null);
  if (!any && !warned.has(model)) {
    warned.add(model);
    logger.warn(
      `no per-model rates for "${model}" — costs are being reported at the global ` +
        `PRICE_* rates, which were set for ${env.pricing.ratedModel}. Set ` +
        `PRICE_${envKey(model)}_IMAGE_OUTPUT_PER_MTOK (and siblings) to price it properly.`,
    );
  }

  return {
    textInputPerMTok: overrides.textInputPerMTok ?? base.textInputPerMTok,
    imageInputPerMTok: overrides.imageInputPerMTok ?? base.imageInputPerMTok,
    imageOutputPerMTok: overrides.imageOutputPerMTok ?? base.imageOutputPerMTok,
    textOutputPerMTok: overrides.textOutputPerMTok ?? base.textOutputPerMTok,
  };
}

/** 'gpt-image-1.5' -> 'GPT_IMAGE_1_5', matching the env variable naming. */
export const envKey = (model: string): string =>
  model.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Cost of one render in USD, from the provider's own token counts and the rates
 * for the model that produced it. Rounded to six decimals — a single render
 * lands around $0.07, so cents are too coarse to total honestly over a month.
 */
export function priceUsage(usage: TokenUsage, model?: string): number {
  const rates = ratesFor(model);

  const usd =
    (usage.textInputTokens / 1_000_000) * rates.textInputPerMTok +
    (usage.imageInputTokens / 1_000_000) * rates.imageInputPerMTok +
    (usage.outputImageTokens / 1_000_000) * rates.imageOutputPerMTok +
    (usage.outputTextTokens / 1_000_000) * rates.textOutputPerMTok;

  return Math.round(usd * 1e6) / 1e6;
}

/**
 * Normalises the provider's usage payload. The breakdowns are nested and any
 * field can be absent — an unreported meter must read as zero rather than NaN,
 * or one missing number poisons the whole ledger.
 */
export function normaliseUsage(raw: unknown): TokenUsage {
  const u = raw as
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { text_tokens?: number; image_tokens?: number };
        output_tokens_details?: { text_tokens?: number; image_tokens?: number };
      }
    | undefined;

  if (!u) return { ...EMPTY_USAGE };

  const textInputTokens = u.input_tokens_details?.text_tokens ?? 0;
  const imageInputTokens = u.input_tokens_details?.image_tokens ?? 0;
  const inputTokens = u.input_tokens ?? textInputTokens + imageInputTokens;
  const outputTokens = u.output_tokens ?? 0;

  const outputTextTokens = u.output_tokens_details?.text_tokens ?? 0;
  const outputImageTokens =
    u.output_tokens_details?.image_tokens ?? Math.max(outputTokens - outputTextTokens, 0);

  return {
    textInputTokens,
    // If only the total came back, treat it as image input — the reference
    // photos dominate it, and the alternative is to under-bill ourselves.
    imageInputTokens: imageInputTokens || Math.max(inputTokens - textInputTokens, 0),
    inputTokens,
    outputTokens,
    outputImageTokens,
    outputTextTokens,
  };
}

/** Display helper for the admin surface; the stored ledger stays in USD. */
export const usdToInr = (usd: number): number =>
  Math.round(usd * env.pricing.usdToInr * 100) / 100;
