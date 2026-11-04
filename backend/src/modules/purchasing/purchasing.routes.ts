import { Router } from 'express';
import { PurchasingController } from './purchasing.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receiveOrderSchema,
  createSupplierBillSchema,
  createSupplierPaymentSchema,
  createPurchaseReturnSchema,
  poQuerySchema,
  idParamSchema,
} from './purchasing.schema.js';

export const purchasingRoutes = Router();

// Require authentication and 'purchases' branch permission across all purchasing routes
purchasingRoutes.use(authenticate, requireBranchPermission('purchases'));

// --- Overview Summary ---
purchasingRoutes.get('/summary', PurchasingController.getPurchasingSummary);

// --- Purchase Orders ---
purchasingRoutes.get(
  '/orders',
  validateRequest(poQuerySchema),
  PurchasingController.getPurchaseOrders
);

purchasingRoutes.post(
  '/orders',
  validateRequest(createPurchaseOrderSchema),
  PurchasingController.createPurchaseOrder
);

purchasingRoutes.get(
  '/orders/:id',
  validateRequest(idParamSchema),
  PurchasingController.getPurchaseOrderById
);

purchasingRoutes.patch(
  '/orders/:id',
  validateRequest(updatePurchaseOrderSchema),
  PurchasingController.updatePurchaseOrder
);

purchasingRoutes.post(
  '/orders/:id/submit',
  validateRequest(idParamSchema),
  PurchasingController.submitPurchaseOrder
);

purchasingRoutes.post(
  '/orders/:id/approve',
  validateRequest(idParamSchema),
  PurchasingController.approvePurchaseOrder
);

purchasingRoutes.post(
  '/orders/:id/cancel',
  validateRequest(idParamSchema),
  PurchasingController.cancelPurchaseOrder
);

// --- Goods Receiving / GRN ---
purchasingRoutes.post(
  '/orders/:id/receive',
  validateRequest(receiveOrderSchema),
  PurchasingController.receivePurchaseOrder
);

// --- Supplier Bills ---
purchasingRoutes.get('/bills', PurchasingController.getSupplierBills);

purchasingRoutes.post(
  '/bills',
  validateRequest(createSupplierBillSchema),
  PurchasingController.createSupplierBill
);

// --- Supplier Payments ---
purchasingRoutes.get('/payments', PurchasingController.getSupplierPayments);

purchasingRoutes.post(
  '/payments',
  validateRequest(createSupplierPaymentSchema),
  PurchasingController.createSupplierPayment
);

// --- Purchase Returns & Debit Notes ---
purchasingRoutes.get('/returns', PurchasingController.getPurchaseReturns);

purchasingRoutes.post(
  '/returns',
  validateRequest(createPurchaseReturnSchema),
  PurchasingController.createPurchaseReturn
);

