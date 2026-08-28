import { Types } from 'mongoose';
import {
  generationRepository,
  UsageSummary,
  DailyUsage,
  ProductUsage,
} from '../repositories/generation.repository';
import { usdToInr } from '../providers/ai/pricing';
import { GenerationDoc } from '../models';
import { env } from '../config/env';

export interface UsageWindow {
  from?: string;
  to?: string;
  timezone?: string;
}

export interface UsageReport {
  window: { from: string; to: string; timezone: string };
  rates: {
    currency: 'USD';
    textInputPerMTok: number;
    imageInputPerMTok: number;
    imageOutputPerMTok: number;
    usdToInr: number;
  };
  totals: UsageSummary & {
    costInr: number;
    savedInr: number;
    /** Blended cost of one billable render — the number worth watching. */
    avgCostPerRenderUsd: number;
  };
  daily: DailyUsage[];
  topProducts: ProductUsage[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class UsageService {
  /**
   * What this merchant has spent, over a window and broken down by day and by
   * product. Reads the per-render costs recorded at call time; it never reprices
   * anything, so a rate change cannot rewrite history.
   */
  async report(merchant: Types.ObjectId, input: UsageWindow = {}): Promise<UsageReport> {
    const to = input.to ? new Date(input.to) : new Date();
    const from = input.from ? new Date(input.from) : new Date(to.getTime() - 30 * DAY_MS);
    const timezone = input.timezone || 'Asia/Kolkata';

    const [totals, daily, topProducts] = await Promise.all([
      generationRepository.usageSummary(merchant, from, to),
      generationRepository.dailyUsage(merchant, from, to, timezone),
      generationRepository.usageByProduct(merchant, from, to),
    ]);

    // Simulated renders are free, so counting them in the average would make the
    // per-render cost look better than it is.
    const billable = totals.succeeded - totals.simulated;

    return {
      window: { from: from.toISOString(), to: to.toISOString(), timezone },
      rates: {
        currency: 'USD',
        textInputPerMTok: env.pricing.textInputPerMTok,
        imageInputPerMTok: env.pricing.imageInputPerMTok,
        imageOutputPerMTok: env.pricing.imageOutputPerMTok,
        usdToInr: env.pricing.usdToInr,
      },
      totals: {
        ...totals,
        costUsd: round(totals.costUsd),
        savedUsd: round(totals.savedUsd),
        costInr: usdToInr(totals.costUsd),
        savedInr: usdToInr(totals.savedUsd),
        avgCostPerRenderUsd: billable > 0 ? round(totals.costUsd / billable) : 0,
      },
      daily: daily.map((d) => ({ ...d, costUsd: round(d.costUsd) })),
      topProducts: topProducts.map((p) => ({ ...p, costUsd: round(p.costUsd) })),
    };
  }

  /** The merchant's latest renders, each with what it cost. */
  recent(merchant: Types.ObjectId, limit = 25): Promise<GenerationDoc[]> {
    return generationRepository.listForMerchant(merchant, limit);
  }
}

const round = (n: number): number => Math.round((n ?? 0) * 1e6) / 1e6;

export const usageService = new UsageService();
