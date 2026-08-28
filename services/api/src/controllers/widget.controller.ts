import { Request, Response, NextFunction } from 'express';
import { visitorService } from '../services/visitor.service';
import { photoService } from '../services/photo.service';
import { catalogService } from '../services/catalog.service';
import { tryOnService } from '../services/tryon.service';
import {
  toPublicGeneration,
  toPublicPhoto,
  toPublicProduct,
  toWidgetMerchant,
} from '../dto/mappers';
import { AppError } from '../utils/errors';
import { BootstrapQuery, RecentQuery, TryOnBody } from '../validators/widget.validators';

/**
 * Public surface consumed by the embedded widget. Every handler is scoped to
 * `req.merchant`, set by requirePublishableKey.
 */
export class WidgetController {
  /**
   * First call on page load. Returns the merchant's theme, a visitor token
   * (minted if the browser has none), whether a photo is already on file — which
   * is what decides upload-modal vs. straight-to-panel — and recent looks.
   */
  bootstrap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const merchant = req.merchant!;
      const { visitorToken, productId } = req.query as unknown as BootstrapQuery;

      const visitor = await visitorService.resolve(merchant._id, visitorToken);
      const [photo, recent] = await Promise.all([
        photoService.getActive(visitor),
        tryOnService.listRecent(visitor, 12),
      ]);

      const product = productId
        ? await catalogService.requireByExternalId(merchant._id, productId).catch(() => null)
        : null;

      res.json({
        merchant: toWidgetMerchant(merchant),
        visitorToken: visitor.token,
        hasPhoto: Boolean(photo),
        photo: photo ? await toPublicPhoto(photo) : null,
        product: product ? toPublicProduct(product) : null,
        recent: await Promise.all(recent.map(toPublicGeneration)),
      });
    } catch (error) {
      next(error);
    }
  };

  listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const products = await catalogService.list(req.merchant!._id);
      res.json({ products: products.map(toPublicProduct) });
    } catch (error) {
      next(error);
    }
  };

  getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const product = await catalogService.requireByExternalId(
        req.merchant!._id,
        req.params.externalId,
      );
      res.json({ product: toPublicProduct(product) });
    } catch (error) {
      next(error);
    }
  };

  /** multipart/form-data: `photo` file + `visitorToken` field. */
  uploadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const merchant = req.merchant!;
      const file = req.file;
      if (!file) throw AppError.badRequest('No photo was uploaded. Send a "photo" file field.');

      const rawToken = (req.body?.visitorToken as string | undefined)?.trim();
      const visitor = await visitorService.resolve(merchant._id, rawToken);

      const photo = await photoService.upload(merchant._id, visitor, {
        buffer: file.buffer,
        mimeType: file.mimetype,
        size: file.size,
      });

      res.status(201).json({
        visitorToken: visitor.token,
        photo: await toPublicPhoto(photo),
      });
    } catch (error) {
      next(error);
    }
  };

  deletePhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visitor = await visitorService.require(req.merchant!._id, req.body.visitorToken);
      await photoService.deleteActive(visitor);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /** Queues a render. 202 + a generation the widget then polls. */
  requestTryOn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const merchant = req.merchant!;
      const { visitorToken, productId, force } = req.body as TryOnBody;

      const visitor = await visitorService.require(merchant._id, visitorToken);
      const { generation, cached } = await tryOnService.request({
        merchant,
        visitor,
        externalId: productId,
        force,
      });

      res.status(cached ? 200 : 202).json({
        cached,
        generation: await toPublicGeneration(generation),
      });
    } catch (error) {
      next(error);
    }
  };

  getGeneration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const visitorToken = (req.query.visitorToken as string | undefined)?.trim();
      if (!visitorToken) throw AppError.badRequest('visitorToken query parameter is required.');

      const visitor = await visitorService.require(req.merchant!._id, visitorToken);
      const generation = await tryOnService.requireForVisitor(visitor, req.params.id);

      res.json({ generation: await toPublicGeneration(generation) });
    } catch (error) {
      next(error);
    }
  };

  listRecent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { visitorToken, limit } = req.query as unknown as RecentQuery;
      const visitor = await visitorService.require(req.merchant!._id, visitorToken);
      const recent = await tryOnService.listRecent(visitor, limit);

      res.json({ generations: await Promise.all(recent.map(toPublicGeneration)) });
    } catch (error) {
      next(error);
    }
  };
}

export const widgetController = new WidgetController();
