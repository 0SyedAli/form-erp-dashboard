import { Request, Response } from 'express';
import { ReportingService } from './reporting.service.js';
import { ReconciliationService } from './reconciliation.service.js';
import { sendSuccess, sendError, AppError } from '../../utils/apiResponse.js';

export class ReportingController {
  private static getValidatedUser(req: Request) {
    const user = req.account || (req as any).user;
    if (!user) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    return {
      id: user._id?.toString() || user.id || '',
      role: user.role,
      branchId: user.branchId?._id?.toString() || user.branchId?.toString(),
      permissions: user.permissions as Record<string, boolean> | undefined,
    };
  }

  // 1. Super Admin Consolidated Dashboard
  public static async getAdminDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Super Admin privileges required to view consolidated dashboard.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getAdminDashboard(req.query as any);
      sendSuccess(res, data, 'Consolidated dashboard metrics loaded.');
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load admin dashboard.', error.statusCode || 500, error.code);
    }
  }

  // 2. Branch Dashboard (Strict Session Isolation)
  public static async getBranchDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      let targetBranchId: string;

      if (user.role === 'SUPER_ADMIN') {
        targetBranchId = (req.query.branchId as string) || (user.branchId ? user.branchId.toString() : '');
        if (!targetBranchId) {
          throw new AppError('branchId query parameter is required for Super Admin.', 400, 'BRANCH_REQUIRED');
        }
      } else {
        // Branch accounts strictly access their own session branch
        if (!user.permissions?.reports) {
          throw new AppError('Branch account lacks report viewing permission.', 403, 'PERMISSION_DENIED');
        }
        if (!user.branchId) {
          throw new AppError('Branch identity not linked to account session.', 403, 'BRANCH_NOT_LINKED');
        }
        targetBranchId = user.branchId.toString();
      }

      const data = await ReportingService.getBranchDashboard(targetBranchId, req.query as any);
      sendSuccess(res, data, 'Branch dashboard metrics loaded.');
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load branch dashboard.', error.statusCode || 500, error.code);
    }
  }

  // 3. Sales Reports
  public static async getSalesSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getSalesSummary(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load sales summary.', error.statusCode || 500, error.code);
    }
  }

  public static async getSalesTrends(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getSalesTrends(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load sales trends.', error.statusCode || 500, error.code);
    }
  }

  public static async getSalesByBranch(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Cross-branch sales report is restricted to Super Admin.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getSalesByBranch(req.query as any);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load branch sales.', error.statusCode || 500, error.code);
    }
  }

  public static async getSalesByTier(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getSalesByTier(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load tier sales.', error.statusCode || 500, error.code);
    }
  }

  public static async getSalesByProduct(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getSalesByProduct(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load product sales.', error.statusCode || 500, error.code);
    }
  }

  // 4. Receivables & Collections Reports
  public static async getReceivablesSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role === 'BRANCH' && !user.permissions?.customerCredit && !user.permissions?.reports) {
        throw new AppError('Branch account lacks credit reporting permissions.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getReceivablesSummary();
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load receivables summary.', error.statusCode || 500, error.code);
    }
  }

  public static async getReceivablesAging(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role === 'BRANCH' && !user.permissions?.customerCredit && !user.permissions?.reports) {
        throw new AppError('Branch account lacks credit aging permissions.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getReceivablesAging();
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load receivables aging.', error.statusCode || 500, error.code);
    }
  }

  public static async getCollectionsSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getCollectionsSummary(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load collections summary.', error.statusCode || 500, error.code);
    }
  }

  // 5. Inventory Reports
  public static async getInventorySummary(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getInventorySummary(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load inventory summary.', error.statusCode || 500, error.code);
    }
  }

  public static async getInventoryLowStock(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getInventoryLowStock(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load low stock report.', error.statusCode || 500, error.code);
    }
  }

  public static async getInventoryValuation(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Inventory valuation is restricted to Super Admin.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getInventoryValuation();
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load inventory valuation.', error.statusCode || 500, error.code);
    }
  }

  public static async getInventoryMovements(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getInventoryMovements(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load inventory movements.', error.statusCode || 500, error.code);
    }
  }

  // 6. Purchasing & Payables Reports
  public static async getPurchasingSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      const query = { ...(req.query as any) };
      if (user.role === 'BRANCH') {
        if (!user.permissions?.purchases) {
          throw new AppError('Branch lacks purchasing reporting permission.', 403, 'FORBIDDEN');
        }
        query.branchId = user.branchId.toString();
      }
      const data = await ReportingService.getPurchasingSummary(query);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load purchasing summary.', error.statusCode || 500, error.code);
    }
  }

  public static async getPurchasingBySupplier(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN' && !user.permissions?.suppliers) {
        throw new AppError('Access to supplier purchasing report is restricted.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getPurchasingBySupplier(req.query as any);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load supplier purchasing report.', error.statusCode || 500, error.code);
    }
  }

  public static async getPurchasingByBranch(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Cross-branch purchasing report is restricted to Super Admin.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getPurchasingByBranch(req.query as any);
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load branch purchasing report.', error.statusCode || 500, error.code);
    }
  }

  public static async getPayablesSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Accounts payable reporting is restricted to Super Admin.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getPayablesSummary();
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load payables summary.', error.statusCode || 500, error.code);
    }
  }

  public static async getPayablesAging(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Accounts payable aging is restricted to Super Admin.', 403, 'FORBIDDEN');
      }
      const data = await ReportingService.getPayablesAging();
      sendSuccess(res, data);
    } catch (error: any) {
      sendError(res, error.message || 'Failed to load payables aging.', error.statusCode || 500, error.code);
    }
  }

  // 7. Cross-Module Audit & Reconciliation
  public static async getReconciliationAudit(req: Request, res: Response): Promise<void> {
    try {
      const user = ReportingController.getValidatedUser(req);
      if (user.role !== 'SUPER_ADMIN') {
        throw new AppError('Reconciliation audit is restricted to Super Admin only.', 403, 'FORBIDDEN');
      }
      const data = await ReconciliationService.runFullAudit();
      sendSuccess(res, data, 'Cross-module financial reconciliation audit complete.');
    } catch (error: any) {
      sendError(res, error.message || 'Failed to execute reconciliation audit.', error.statusCode || 500, error.code);
    }
  }
}
