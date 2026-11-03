import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import {
  requireBranchPermission,
  requireAnyBranchPermission,
} from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  stockQuerySchema,
  updateMinimumStockSchema,
  openingStockSchema,
  createStockReceiptSchema,
  createAdjustmentSchema,
  createTransferSchema,
  movementsQuerySchema,
  alertsQuerySchema,
  idParamSchema,
  skuParamSchema,
} from './inventory.schema.js';

export const inventoryRoutes = Router();

// ==========================================
// STOCK BALANCES & LOCATIONS
// ==========================================
inventoryRoutes.get(
  '/stock',
  authenticate,
  requireBranchPermission('viewStock'),
  validateRequest(stockQuerySchema),
  InventoryController.getStockBalances
);

inventoryRoutes.get(
  '/stock/:sku',
  authenticate,
  requireAnyBranchPermission(['viewStock', 'pos']),
  validateRequest(skuParamSchema),
  InventoryController.getStockBySku
);

inventoryRoutes.get(
  '/locations',
  authenticate,
  requireBranchPermission('viewStock'),
  InventoryController.getStockLocations
);

inventoryRoutes.patch(
  '/stock/:skuId/minimum',
  authenticate,
  requireBranchPermission('manageStock'),
  validateRequest(updateMinimumStockSchema),
  InventoryController.updateMinimumStock
);

// ==========================================
// OPENING STOCK
// ==========================================
inventoryRoutes.post(
  '/opening-stock',
  authenticate,
  requireBranchPermission('manageStock'),
  validateRequest(openingStockSchema),
  InventoryController.postOpeningStock
);

// ==========================================
// STOCK RECEIVING (GOODS RECEIVING)
// ==========================================
inventoryRoutes.get(
  '/receipts',
  authenticate,
  requireBranchPermission('viewStock'),
  InventoryController.getStockReceipts
);

inventoryRoutes.post(
  '/receipts',
  authenticate,
  requireBranchPermission('manageStock'),
  validateRequest(createStockReceiptSchema),
  InventoryController.createStockReceipt
);

inventoryRoutes.get(
  '/receipts/:id',
  authenticate,
  requireBranchPermission('viewStock'),
  validateRequest(idParamSchema),
  InventoryController.getStockReceiptById
);

// ==========================================
// STOCK ADJUSTMENTS (MANAGE STOCK)
// ==========================================
inventoryRoutes.post(
  '/adjustments',
  authenticate,
  requireBranchPermission('manageStock'),
  validateRequest(createAdjustmentSchema),
  InventoryController.createAdjustments
);

inventoryRoutes.get(
  '/adjustments',
  authenticate,
  requireBranchPermission('viewStock'),
  InventoryController.getAdjustments
);

// ==========================================
// STOCK TRANSFERS (BRANCH-TO-BRANCH)
// ==========================================
inventoryRoutes.get(
  '/transfers',
  authenticate,
  requireBranchPermission('stockTransfers'),
  InventoryController.getTransfers
);

inventoryRoutes.post(
  '/transfers',
  authenticate,
  requireBranchPermission('stockTransfers'),
  validateRequest(createTransferSchema),
  InventoryController.createTransfer
);

inventoryRoutes.get(
  '/transfers/:id',
  authenticate,
  requireBranchPermission('stockTransfers'),
  validateRequest(idParamSchema),
  InventoryController.getTransferById
);

inventoryRoutes.post(
  '/transfers/:id/approve',
  authenticate,
  requireSuperAdmin,
  validateRequest(idParamSchema),
  InventoryController.approveTransfer
);

inventoryRoutes.post(
  '/transfers/:id/dispatch',
  authenticate,
  requireBranchPermission('stockTransfers'),
  validateRequest(idParamSchema),
  InventoryController.dispatchTransfer
);

inventoryRoutes.post(
  '/transfers/:id/receive',
  authenticate,
  requireBranchPermission('stockTransfers'),
  validateRequest(idParamSchema),
  InventoryController.receiveTransfer
);

inventoryRoutes.post(
  '/transfers/:id/cancel',
  authenticate,
  requireBranchPermission('stockTransfers'),
  validateRequest(idParamSchema),
  InventoryController.cancelTransfer
);

// ==========================================
// STOCK MOVEMENTS (HISTORY & AUDIT)
// ==========================================
inventoryRoutes.get(
  '/movements',
  authenticate,
  requireBranchPermission('viewStock'),
  validateRequest(movementsQuerySchema),
  InventoryController.getStockMovements
);

inventoryRoutes.get(
  '/movements/:id',
  authenticate,
  requireBranchPermission('viewStock'),
  validateRequest(idParamSchema),
  InventoryController.getStockMovementById
);

// ==========================================
// STOCK ALERTS
// ==========================================
inventoryRoutes.get(
  '/alerts',
  authenticate,
  requireBranchPermission('viewStock'),
  validateRequest(alertsQuerySchema),
  InventoryController.getStockAlerts
);

// ==========================================
// INVENTORY SUMMARY
// ==========================================
inventoryRoutes.get(
  '/summary',
  authenticate,
  requireBranchPermission('viewStock'),
  InventoryController.getInventorySummary
);

