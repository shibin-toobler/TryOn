import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireBootstrapToken, requireSecretKey } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createMerchantSchema,
  externalIdParamsSchema,
  productBatchSchema,
  usageQuerySchema,
} from '../validators/admin.validators';

const router = Router();

// Bootstrap-token guarded: creates the merchant and its keys.
router.post(
  '/merchants',
  requireBootstrapToken,
  validate(createMerchantSchema),
  adminController.createMerchant,
);

// Everything below is authenticated with the merchant's own secret key.
router.use(requireSecretKey);

router.get('/me', adminController.me);
router.get('/usage', validate(usageQuerySchema, 'query'), adminController.usage);
router.get('/generations', adminController.listGenerations);
router.get('/products', adminController.listProducts);
router.post('/products', validate(productBatchSchema), adminController.upsertProducts);
router.delete(
  '/products/:externalId',
  validate(externalIdParamsSchema, 'params'),
  adminController.deleteProduct,
);

export const adminRoutes = router;
