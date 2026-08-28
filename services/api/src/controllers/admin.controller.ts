import { Request, Response, NextFunction } from 'express';
import { merchantService } from '../services/merchant.service';
import { catalogService } from '../services/catalog.service';
import { usageService } from '../services/usage.service';
import { toAdminGeneration, toAdminMerchant, toAdminProduct } from '../dto/mappers';
import { UsageQuery } from '../validators/admin.validators';
import { env } from '../config/env';

/** Server-to-server surface: merchant onboarding and catalog sync. */
export class AdminController {
  createMerchant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const merchant = await merchantService.create(req.body);

      // The only time the secret key is ever returned. It is not readable again.
      res.status(201).json({
        merchant: toAdminMerchant(merchant, true),
        embedSnippet: buildSnippet(merchant.publishableKey),
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const merchant = req.merchant!;
      res.json({
        merchant: toAdminMerchant(merchant),
        embedSnippet: buildSnippet(merchant.publishableKey),
      });
    } catch (error) {
      next(error);
    }
  };

  /** Spend report: what the model has cost this merchant, and what the cache saved. */
  usage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { from, to, timezone } = req.query as unknown as UsageQuery;
      const report = await usageService.report(req.merchant!._id, { from, to, timezone });
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  /** Recent renders with their individual costs, newest first. */
  listGenerations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(Number(req.query.limit) || 25, 100);
      const generations = await usageService.recent(req.merchant!._id, limit);
      res.json({ generations: await Promise.all(generations.map(toAdminGeneration)) });
    } catch (error) {
      next(error);
    }
  };

  listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await catalogService.list(req.merchant!._id, true);
      res.json({ products: products.map(toAdminProduct) });
    } catch (error) {
      next(error);
    }
  };

  upsertProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { created, failed } = await catalogService.bulkUpsert(
        req.merchant!._id,
        req.body.products,
      );
      res.status(200).json({
        synced: created.length,
        products: created.map(toAdminProduct),
        ...(failed.length ? { failed } : {}),
      });
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await catalogService.remove(req.merchant!._id, req.params.externalId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

const buildSnippet = (key: string) =>
  `<script async src="${env.publicBaseUrl}/tryon.js" data-tryon-key="${key}"></script>`;

export const adminController = new AdminController();
