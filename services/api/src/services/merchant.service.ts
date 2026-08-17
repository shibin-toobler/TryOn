import { merchantRepository } from '../repositories/merchant.repository';
import { MerchantDoc } from '../models';
import { publishableKey, secretKey } from '../utils/ids';
import { AppError } from '../utils/errors';

export interface CreateMerchantInput {
  name: string;
  allowedOrigins?: string[];
  theme?: { accent?: string; headline?: string };
}

export class MerchantService {
  async create(input: CreateMerchantInput): Promise<MerchantDoc> {
    return merchantRepository.create({
      name: input.name,
      publishableKey: publishableKey(),
      secretKey: secretKey(),
      allowedOrigins: input.allowedOrigins ?? [],
      theme: {
        accent: input.theme?.accent ?? '#d06c4f',
        headline: input.theme?.headline ?? "Let's see it on you.",
      },
    } as Partial<MerchantDoc>);
  }

  async requireByPublishableKey(key: string): Promise<MerchantDoc> {
    const merchant = await merchantRepository.findByPublishableKey(key);
    if (!merchant) throw AppError.unauthorized('Unknown or inactive publishable key.');
    return merchant;
  }

  async requireBySecretKey(key: string): Promise<MerchantDoc> {
    const merchant = await merchantRepository.findBySecretKey(key);
    if (!merchant) throw AppError.unauthorized('Unknown or inactive secret key.');
    return merchant;
  }

  /**
   * An empty allowlist means "any origin" — convenient in development, and the
   * thing to lock down before a merchant goes live.
   */
  isOriginAllowed(merchant: MerchantDoc, origin: string | undefined): boolean {
    const allowed = merchant.allowedOrigins;
    if (!allowed.length || allowed.includes('*')) return true;
    if (!origin) return false;

    return allowed.some((entry) => {
      if (entry === origin) return true;
      // Wildcard subdomains: https://*.example.com
      if (entry.includes('*')) {
        const pattern = new RegExp(
          `^${entry.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')}$`,
        );
        return pattern.test(origin);
      }
      return false;
    });
  }
}

export const merchantService = new MerchantService();
