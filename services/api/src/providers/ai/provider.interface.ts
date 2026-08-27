import { TokenUsage } from './pricing';

export interface ImageInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface TryOnRequest {
  /** The shopper's uploaded body photo. */
  person: ImageInput;
  /** The garment as listed in the merchant's catalog. */
  garment: ImageInput;
  garmentName: string;
  garmentColor?: string;
  garmentDescription?: string;
  category: string;
  /** Merchant-authored extra instructions from the product record. */
  promptHint?: string;
}

export interface TryOnResult {
  image: Buffer;
  mimeType: string;
  /** True when no real model ran, so the UI can label the render honestly. */
  simulated: boolean;
  /** Provider-side identifier, for support tickets and cost attribution. */
  providerRef?: string;
  /** Exact model that ran, recorded per render so a model switch stays auditable. */
  model?: string;
  /** Token counts as the provider reported them. Zeroes for a simulated render. */
  usage?: TokenUsage;
  /** What this render cost, in USD, priced from `usage`. */
  costUsd?: number;
}

/**
 * The engine slot. Everything above this line is provider-agnostic: swapping
 * OpenAI for another model means adding one file here and changing AI_PROVIDER.
 */
export interface TryOnProvider {
  readonly name: string;
  generate(request: TryOnRequest): Promise<TryOnResult>;
}
