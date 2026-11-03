import { Router } from 'express';
import { BranchAccountController } from './branch-account.controller.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  createBranchAccountSchema,
  updateBranchAccountSchema,
  resetPasswordSchema,
  updatePermissionsSchema,
  branchParamSchema,
} from './branch-account.schema.js';

export const branchAccountRoutes = Router();

// Apply Super Admin authentication guard to all branch account management routes
branchAccountRoutes.use(authenticate, requireSuperAdmin);

branchAccountRoutes.get(
  '/branches/:id/account',
  validateRequest(branchParamSchema),
  BranchAccountController.getAccount
);

branchAccountRoutes.post(
  '/branches/:id/account',
  validateRequest(createBranchAccountSchema),
  BranchAccountController.createAccount
);

branchAccountRoutes.patch(
  '/branches/:id/account',
  validateRequest(updateBranchAccountSchema),
  BranchAccountController.updateAccount
);

branchAccountRoutes.post(
  '/branches/:id/reset-password',
  validateRequest(resetPasswordSchema),
  BranchAccountController.resetPassword
);

branchAccountRoutes.patch(
  '/branches/:id/permissions',
  validateRequest(updatePermissionsSchema),
  BranchAccountController.updatePermissions
);

branchAccountRoutes.post(
  '/branches/:id/deactivate-account',
  validateRequest(branchParamSchema),
  BranchAccountController.deactivateAccount
);

