import { Request, Response } from 'express';
import { PurchasingService } from './purchasing.service.js';
import { SupplierPayment, PurchaseReturn } from '../../models/index.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class PurchasingController {
  private static getUserContext(req: Request) {
    return {
      id: req.account?._id?.toString() || '',
      loginId: req.account?.loginId || '',
      role: (req.account?.role || 'BRANCH') as 'SUPER_ADMIN' | 'BRANCH',
      branchId: req.account?.branchId?._id?.toString() || req.account?.branchId?.toString(),
      branchName: (req.account?.branchId as any)?.name,
      permissions: req.account?.permissions as Record<string, boolean> | undefined,
    };
  }

  private static getParam(req: Request, key: string): string {
    const val = req.params[key];
    return Array.isArray(val) ? val[0] : (val as string) || '';
  }

  private static handleError(res: Response, error: unknown, defaultMessage: string, defaultStatus = 500) {
    const err = error as any;
    const isWriteConflict =
      err.code === 112 ||
      err.codeName === 'WriteConflict' ||
      (err.errorLabels && err.errorLabels.includes('TransientTransactionError'));

    if (isWriteConflict) {
      sendError(res, 'Concurrent database conflict. Please retry the operation.', 409, 'WRITE_CONFLICT');
      return;
    }

    const msg = err.message || defaultMessage;
    const status = err.statusCode || defaultStatus;
    const code =
      err.code ||
      (status === 404
        ? 'NOT_FOUND'
        : status === 403
        ? 'FORBIDDEN'
        : status === 409
        ? 'CONFLICT'
        : status === 400
        ? 'BAD_REQUEST'
        : 'INTERNAL_ERROR');
    sendError(res, msg, status, code, err.details);
  }

  // --- Purchase Orders ---

  public static async createPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.createPurchaseOrder(req.body, userContext);
      sendSuccess(res, data, 'Purchase order created successfully in DRAFT status.', 201);
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to create purchase order.');
    }
  }

  public static async getPurchaseOrders(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.getPurchaseOrders(req.query as any, userContext);
      sendSuccess(res, data, 'Purchase orders retrieved successfully.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to retrieve purchase orders.');
    }
  }

  public static async getPurchaseOrderById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const id = PurchasingController.getParam(req, 'id');
      const data = await PurchasingService.getPurchaseOrderById(id, userContext);
      sendSuccess(res, data, 'Purchase order details retrieved.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to retrieve purchase order details.');
    }
  }

  public static async updatePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const id = PurchasingController.getParam(req, 'id');
      const data = await PurchasingService.updatePurchaseOrder(id, req.body, userContext);
      sendSuccess(res, data, 'Purchase order updated successfully.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to update purchase order.');
    }
  }

  public static async submitPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const id = PurchasingController.getParam(req, 'id');
      const data = await PurchasingService.submitPurchaseOrder(id, userContext);
      sendSuccess(res, data, 'Purchase order submitted for approval.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to submit purchase order.');
    }
  }

  public static async approvePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const id = PurchasingController.getParam(req, 'id');
      const data = await PurchasingService.approvePurchaseOrder(id, userContext);
      sendSuccess(res, data, 'Purchase order approved successfully.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to approve purchase order.');
    }
  }

  public static async cancelPurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const id = PurchasingController.getParam(req, 'id');
      const reason = req.body.reason || 'Cancelled by user';
      const data = await PurchasingService.cancelPurchaseOrder(id, reason, userContext);
      sendSuccess(res, data, 'Purchase order cancelled successfully.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to cancel purchase order.');
    }
  }

  // --- Goods Receiving / GRN ---

  public static async receivePurchaseOrder(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const id = PurchasingController.getParam(req, 'id');
      const data = await PurchasingService.receivePurchaseOrder(id, req.body, userContext);
      sendSuccess(res, data, 'Goods received and inventory balances updated.', 201);
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to receive goods against purchase order.');
    }
  }

  // --- Supplier Bills ---

  public static async createSupplierBill(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.createSupplierBill(req.body, userContext);
      sendSuccess(res, data, 'Supplier bill created and liability posted to ledger.', 201);
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to create supplier bill.');
    }
  }

  public static async getSupplierBills(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.getSupplierBills(req.query as any, userContext);
      sendSuccess(res, data, 'Supplier bills retrieved.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to retrieve supplier bills.');
    }
  }

  // --- Supplier Payments ---

  public static async createSupplierPayment(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.createSupplierPayment(req.body, userContext);
      sendSuccess(res, data, 'Supplier payment recorded and ledger updated.', 201);
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to record supplier payment.');
    }
  }

  public static async getSupplierPayments(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const filter: Record<string, any> = {};
      if (userContext.role === 'BRANCH') {
        filter.branchId = userContext.branchId;
      } else if (req.query.branchId) {
        filter.branchId = req.query.branchId;
      }
      if (req.query.supplierId) {
        filter.supplierId = req.query.supplierId;
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        SupplierPayment.find(filter)
          .populate('supplierId', 'code name phone')
          .populate('branchId', 'code name')
          .sort({ paymentDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SupplierPayment.countDocuments(filter),
      ]);

      sendSuccess(
        res,
        {
          payments,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        'Supplier payments retrieved.'
      );
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to retrieve supplier payments.');
    }
  }

  // --- Purchase Returns ---

  public static async createPurchaseReturn(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.createPurchaseReturn(req.body, userContext);
      sendSuccess(res, data, 'Purchase return completed, inventory deducted, and debit note generated.', 201);
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to process purchase return.');
    }
  }

  public static async getPurchaseReturns(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const filter: Record<string, any> = {};
      if (userContext.role === 'BRANCH') {
        filter.branchId = userContext.branchId;
      } else if (req.query.branchId) {
        filter.branchId = req.query.branchId;
      }
      if (req.query.supplierId) {
        filter.supplierId = req.query.supplierId;
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      const [returns, total] = await Promise.all([
        PurchaseReturn.find(filter)
          .populate('supplierId', 'code name phone')
          .populate('branchId', 'code name')
          .populate('stockLocationId', 'code name')
          .sort({ returnDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        PurchaseReturn.countDocuments(filter),
      ]);

      sendSuccess(
        res,
        {
          returns,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        'Purchase returns retrieved.'
      );
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to retrieve purchase returns.');
    }
  }

  // --- Summary Metrics ---

  public static async getPurchasingSummary(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PurchasingController.getUserContext(req);
      const data = await PurchasingService.getPurchasingSummary(userContext);
      sendSuccess(res, data, 'Purchasing summary metrics retrieved.');
    } catch (error) {
      PurchasingController.handleError(res, error, 'Failed to retrieve purchasing summary.');
    }
  }
}
