import { Router } from 'express';
import { ReportingController } from './reporting.controller.js';
import {
  authenticate,
  requireSuperAdmin,
  enforceBranchBoundary,
} from '../../middleware/auth.middleware.js';
import { requireBranchPermission } from '../../middleware/branchPermission.middleware.js';

export const reportingRoutes = Router();

// Apply session authentication to all reporting endpoints
reportingRoutes.use(authenticate);

// 1. Dashboards
reportingRoutes.get('/dashboard/admin', requireSuperAdmin, ReportingController.getAdminDashboard);
reportingRoutes.get(
  '/dashboard/branch',
  requireBranchPermission('reports'),
  enforceBranchBoundary,
  ReportingController.getBranchDashboard
);

// 2. Sales Reports
reportingRoutes.get('/sales/summary', requireBranchPermission('reports'), ReportingController.getSalesSummary);
reportingRoutes.get('/sales/trends', requireBranchPermission('reports'), ReportingController.getSalesTrends);
reportingRoutes.get('/sales/by-branch', requireSuperAdmin, ReportingController.getSalesByBranch);
reportingRoutes.get('/sales/by-tier', requireBranchPermission('reports'), ReportingController.getSalesByTier);
reportingRoutes.get('/sales/by-product', requireBranchPermission('reports'), ReportingController.getSalesByProduct);

// 3. Receivables & Collections Reports
reportingRoutes.get('/receivables/summary', requireBranchPermission('reports'), ReportingController.getReceivablesSummary);
reportingRoutes.get('/receivables/aging', requireBranchPermission('reports'), ReportingController.getReceivablesAging);
reportingRoutes.get('/collections/summary', requireBranchPermission('reports'), ReportingController.getCollectionsSummary);

// 4. Inventory Reports
reportingRoutes.get('/inventory/summary', requireBranchPermission('reports'), ReportingController.getInventorySummary);
reportingRoutes.get('/inventory/low-stock', requireBranchPermission('reports'), ReportingController.getInventoryLowStock);
reportingRoutes.get('/inventory/valuation', requireSuperAdmin, ReportingController.getInventoryValuation);
reportingRoutes.get('/inventory/movements', requireBranchPermission('reports'), ReportingController.getInventoryMovements);

// 5. Purchasing & Payables Reports
reportingRoutes.get('/purchases/summary', requireBranchPermission('reports'), ReportingController.getPurchasingSummary);
reportingRoutes.get('/purchases/by-supplier', requireSuperAdmin, ReportingController.getPurchasingBySupplier);
reportingRoutes.get('/purchases/by-branch', requireSuperAdmin, ReportingController.getPurchasingByBranch);
reportingRoutes.get('/payables/summary', requireSuperAdmin, ReportingController.getPayablesSummary);
reportingRoutes.get('/payables/aging', requireSuperAdmin, ReportingController.getPayablesAging);

// 6. Cross-Module Financial Audit & Reconciliation
reportingRoutes.get('/reconciliation', requireSuperAdmin, ReportingController.getReconciliationAudit);

