import { Router } from 'express';
import { widgetController } from '../controllers/widget.controller';
import { requirePublishableKey } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { uploadPhoto } from '../middlewares/upload.middleware';
import { widgetRateLimiter, uploadRateLimiter } from '../middlewares/rateLimit.middleware';
import {
  bootstrapQuerySchema,
  recentQuerySchema,
  tryOnBodySchema,
  visitorTokenBodySchema,
} from '../validators/widget.validators';

const router = Router();

router.use(widgetRateLimiter, requirePublishableKey);

router.get('/bootstrap', validate(bootstrapQuerySchema, 'query'), widgetController.bootstrap);

router.get('/products', widgetController.listProducts);
router.get('/products/:externalId', widgetController.getProduct);

// multipart, so validation happens in the controller after multer parses it.
router.post('/photos', uploadRateLimiter, uploadPhoto, widgetController.uploadPhoto);
router.delete('/photos', validate(visitorTokenBodySchema), widgetController.deletePhoto);

router.post('/tryon', uploadRateLimiter, validate(tryOnBodySchema), widgetController.requestTryOn);

router.get('/generations', validate(recentQuerySchema, 'query'), widgetController.listRecent);
router.get('/generations/:id', widgetController.getGeneration);

export const widgetRoutes = router;
