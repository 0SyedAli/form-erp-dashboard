import { Router } from 'express';
import { SalesController } from './sales.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import { salesQuerySchema, invoiceParamSchema, deleteInvoiceSchema } from './sales.schema.js';

export const salesRoutes = Router();

salesRoutes.get(
  '/invoices',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(salesQuerySchema),
  SalesController.getInvoices
);

salesRoutes.get(
  '/summary',
  authenticate,
  requireBranchPermission('pos'),
  SalesController.getSalesSummary
);

salesRoutes.get(
  '/invoices/:id',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(invoiceParamSchema),
  SalesController.getInvoiceById
);

salesRoutes.get(
  '/invoices/:id/receipt',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(invoiceParamSchema),
  SalesController.getInvoiceReceipt
);

salesRoutes.delete(
  '/invoices/:id',
  authenticate,
  requireBranchPermission('pos'),
  validateRequest(deleteInvoiceSchema),
  SalesController.deleteInvoice
);

