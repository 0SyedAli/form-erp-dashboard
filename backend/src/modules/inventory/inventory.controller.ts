import { Request, Response } from 'express';
import { InventoryService, UserContext } from './inventory.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class InventoryController {
  private static getUserContext(req: Request): UserContext {
    return {
      accountId: req.account?._id?.toString() || '',
      loginId: req.account?.loginId || '',
      role: req.account?.role || 'BRANCH',
      branchId: req.account?.branchId?._id?.toString() || req.account?.branchId?.toString(),
    };
  }

  private static handleError(
    res: Response,
    error: unknown,
    defaultMessage: string,
    defaultStatus = 500
  ): void {
    const err = error as any;
    const msg = err.message || defaultMessage;
    const status = err.statusCode || defaultStatus;
    const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT' : 'INTERNAL_ERROR');
    sendError(res, msg, status, code, err.details);
  }

  // ==========================================
  // STOCK BALANCES
  // ==========================================

  public static async getStockBalances(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getStockBalances(
        {
          branchId: req.query.branchId as string,
          stockLocationId: req.query.stockLocationId as string,
          sku: req.query.sku as string,
          search: req.query.search as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
        userContext
      );
      sendSuccess(res, data.balances, 'Stock balances retrieved successfully.', 200, data.pagination);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch stock balances.');
    }
  }

  public static async getStockBySku(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
      const data = await InventoryService.getStockBySku(sku, userContext);
      sendSuccess(res, data);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch stock for SKU.', 404);
    }
  }

  public static async getStockLocations(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const branchId = req.query.branchId as string | undefined;
      const data = await InventoryService.getStockLocations(branchId, userContext);
      sendSuccess(res, data);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch stock locations.');
    }
  }

  public static async updateMinimumStock(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const skuId = Array.isArray(req.params.skuId) ? req.params.skuId[0] : req.params.skuId;
      const data = await InventoryService.updateMinimumStock(
        skuId,
        req.body.reorderLevel,
        req.body.stockLocationId,
        req.body.branchId,
        userContext
      );
      sendSuccess(res, data, 'Minimum stock level updated successfully.');
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to update minimum stock.');
    }
  }

  // ==========================================
  // OPENING STOCK
  // ==========================================

  public static async postOpeningStock(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.postOpeningStock(req.body, userContext);
      sendSuccess(res, data, 'Opening stock recorded successfully.', 201);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to post opening stock.');
    }
  }

  // ==========================================
  // STOCK RECEIVING
  // ==========================================

  public static async createStockReceipt(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.createStockReceipt(req.body, userContext);
      sendSuccess(res, data, 'Goods received and stock updated successfully.', 201);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to process goods receipt.');
    }
  }

  public static async getStockReceipts(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getStockReceipts(
        {
          branchId: req.query.branchId as string,
          supplierId: req.query.supplierId as string,
          dateFrom: req.query.dateFrom as string,
          dateTo: req.query.dateTo as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
        userContext
      );
      sendSuccess(res, data.receipts, 'Stock receipts retrieved.', 200, data.pagination);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch receipts.');
    }
  }

  public static async getStockReceiptById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.getStockReceiptById(id, userContext);
      sendSuccess(res, data);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch receipt.', 404);
    }
  }

  // ==========================================
  // STOCK ADJUSTMENTS
  // ==========================================

  public static async createAdjustments(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.createAdjustments(req.body, userContext);
      sendSuccess(res, data, 'Stock adjustments applied and reconciled successfully.', 201);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to apply stock adjustments.');
    }
  }

  public static async getAdjustments(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getAdjustments(
        {
          branchId: req.query.branchId as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
        userContext
      );
      sendSuccess(res, data.adjustments, 'Stock adjustments retrieved.', 200, data.pagination);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch adjustments.');
    }
  }

  // ==========================================
  // STOCK TRANSFERS
  // ==========================================

  public static async getTransfers(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getTransfers(
        {
          fromBranchId: req.query.fromBranchId as string,
          toBranchId: req.query.toBranchId as string,
          status: req.query.status as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
        userContext
      );
      sendSuccess(res, data.transfers, 'Stock transfers retrieved.', 200, data.pagination);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch transfers.');
    }
  }

  public static async createTransfer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.createTransfer(req.body, userContext);
      sendSuccess(res, data, 'Stock transfer initiated successfully.', 201);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to initiate transfer.');
    }
  }

  public static async getTransferById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.getTransferById(id, userContext);
      sendSuccess(res, data);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch transfer.', 404);
    }
  }

  public static async approveTransfer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.approveTransfer(id, userContext);
      sendSuccess(res, data, 'Stock transfer approved and source stock reserved.');
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to approve transfer.');
    }
  }

  public static async dispatchTransfer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.dispatchTransfer(id, userContext);
      sendSuccess(res, data, 'Stock transfer dispatched and in transit.');
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to dispatch transfer.');
    }
  }

  public static async receiveTransfer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.receiveTransfer(id, userContext);
      sendSuccess(res, data, 'Stock transfer received and destination stock incremented.');
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to receive transfer.');
    }
  }

  public static async cancelTransfer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.cancelTransfer(id, userContext);
      sendSuccess(res, data, 'Stock transfer cancelled successfully.');
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to cancel transfer.');
    }
  }

  // ==========================================
  // STOCK MOVEMENTS & HISTORY
  // ==========================================

  public static async getStockMovements(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getStockMovements(
        {
          branchId: req.query.branchId as string,
          stockLocationId: req.query.stockLocationId as string,
          sku: req.query.sku as string,
          movementType: req.query.movementType as string,
          dateFrom: req.query.dateFrom as string,
          dateTo: req.query.dateTo as string,
          search: req.query.search as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        },
        userContext
      );
      sendSuccess(res, data.movements, 'Stock movements retrieved.', 200, data.pagination);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch movements.');
    }
  }

  public static async getStockMovementById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await InventoryService.getStockMovementById(id, userContext);
      sendSuccess(res, data);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch movement.', 404);
    }
  }

  // ==========================================
  // STOCK ALERTS
  // ==========================================

  public static async getStockAlerts(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getStockAlerts(
        {
          branchId: req.query.branchId as string,
          status: req.query.status as any,
          brandId: req.query.brandId as string,
          categoryId: req.query.categoryId as string,
          search: req.query.search as string,
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        },
        userContext
      );
      sendSuccess(res, { alerts: data.alerts, metrics: data.metrics }, 'Stock alerts retrieved.', 200, data.pagination);
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch stock alerts.');
    }
  }

  // ==========================================
  // INVENTORY SUMMARY
  // ==========================================

  public static async getInventorySummary(req: Request, res: Response): Promise<void> {
    try {
      const userContext = InventoryController.getUserContext(req);
      const data = await InventoryService.getInventorySummary(userContext);
      sendSuccess(res, data, 'Inventory summary retrieved.');
    } catch (error) {
      InventoryController.handleError(res, error, 'Failed to fetch inventory summary.');
    }
  }
}
