import { Router } from 'express';
import { SupplierController } from './supplier.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  updateSupplierStatusSchema,
  supplierQuerySchema,
  supplierParamSchema,
} from './supplier.schema.js';

export const supplierRoutes = Router();

// All supplier endpoints require authentication and 'suppliers' permission
supplierRoutes.use(authenticate, requireBranchPermission('suppliers'));

supplierRoutes.get('/', validateRequest(supplierQuerySchema), SupplierController.getSuppliers);
supplierRoutes.post('/', validateRequest(createSupplierSchema), SupplierController.createSupplier);

supplierRoutes.get('/:id', validateRequest(supplierParamSchema), SupplierController.getSupplierById);
supplierRoutes.patch('/:id', validateRequest(updateSupplierSchema), SupplierController.updateSupplier);
supplierRoutes.patch('/:id/status', validateRequest(updateSupplierStatusSchema), SupplierController.updateStatus);

supplierRoutes.get('/:id/ledger', validateRequest(supplierParamSchema), SupplierController.getSupplierLedger);
supplierRoutes.get('/:id/outstanding', validateRequest(supplierParamSchema), SupplierController.getSupplierOutstanding);
supplierRoutes.get('/:id/bills', validateRequest(supplierParamSchema), SupplierController.getSupplierBills);
supplierRoutes.get('/:id/payments', validateRequest(supplierParamSchema), SupplierController.getSupplierPayments);

