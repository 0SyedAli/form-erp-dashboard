import { Router } from 'express';
import { CustomerController } from './customer.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireAnyBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  customerQuerySchema,
  createCustomerSchema,
  updateCustomerSchema,
  customerParamSchema,
} from './customer.schema.js';

export const customerRoutes = Router();

// List customers (POS cashiers and customer managers)
customerRoutes.get(
  '/',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos']),
  validateRequest(customerQuerySchema),
  CustomerController.getCustomers
);

// Create customer
customerRoutes.post(
  '/',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos']),
  validateRequest(createCustomerSchema),
  CustomerController.createCustomer
);

// Get customer profile
customerRoutes.get(
  '/:id',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos']),
  validateRequest(customerParamSchema),
  CustomerController.getCustomerById
);

// Update customer
customerRoutes.patch(
  '/:id',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos']),
  validateRequest(updateCustomerSchema),
  CustomerController.updateCustomer
);

// Customer Account Ledger
customerRoutes.get(
  '/:id/ledger',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos']),
  validateRequest(customerParamSchema),
  CustomerController.getCustomerLedger
);

// Customer Outstanding Invoices
customerRoutes.get(
  '/:id/outstanding',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos', 'collections']),
  validateRequest(customerParamSchema),
  CustomerController.getCustomerOutstanding
);

// Customer Purchase Invoices
customerRoutes.get(
  '/:id/invoices',
  authenticate,
  requireAnyBranchPermission(['customers', 'pos']),
  validateRequest(customerParamSchema),
  CustomerController.getCustomerInvoices
);

