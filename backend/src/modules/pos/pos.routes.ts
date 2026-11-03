import { Router } from 'express';
import { PosController } from './pos.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  checkoutSchema,
  heldSaleSchema,
  heldSaleParamSchema,
  availabilityParamSchema,
} from './pos.schema.js';

export const posRoutes = Router();

// 1. POS Catalogue
posRoutes.get(
  '/catalogue',
  authenticate,
  requireBranchPermission('pos'),
  PosController.getCatalogue
);

// 2. POS Stock Availability for SKU
posRoutes.get(
  '/products/:skuId/availability',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(availabilityParamSchema),
  PosController.getAvailability
);

// 3. Complete Checkout
posRoutes.post(
  '/checkout',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(checkoutSchema),
  PosController.checkout
);

// 4. Held Sales
posRoutes.get(
  '/held-sales',
  authenticate,
  requireBranchPermission('pos'),
  PosController.getHeldSales
);

posRoutes.post(
  '/held-sales',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(heldSaleSchema),
  PosController.createHeldSale
);

posRoutes.post(
  '/held-sales/:id/resume',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(heldSaleParamSchema),
  PosController.resumeHeldSale
);

posRoutes.delete(
  '/held-sales/:id',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(heldSaleParamSchema),
  PosController.deleteHeldSale
);

