import { Request, Response } from 'express';
import { SalesService, UserContext } from './sales.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class SalesController {
  private static getUserContext(req: Request): UserContext {
    return {
      accountId: req.account?._id?.toString() || '',
      loginId: req.account?.loginId || '',
      role: req.account?.role || 'BRANCH',
      branchId: req.account?.branchId?._id?.toString() || req.account?.branchId?.toString(),
    };
  }

  private static handleError(res: Response, error: unknown, defaultMessage: string, defaultStatus = 500) {
    const err = error as any;
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
        : 'INTERNAL_ERROR');
    sendError(res, msg, status, code, err.details);
  }

  public static async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const userContext = SalesController.getUserContext(req);
      const data = await SalesService.getInvoices(req.query as any, userContext);
      sendSuccess(res, data.invoices, 'Sales invoices retrieved.', 200, data.pagination);
    } catch (error) {
      SalesController.handleError(res, error, 'Failed to fetch invoices.');
    }
  }

  public static async getInvoiceById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = SalesController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SalesService.getInvoiceById(id, userContext);
      sendSuccess(res, data, 'Invoice details retrieved.');
    } catch (error) {
      SalesController.handleError(res, error, 'Failed to fetch invoice.');
    }
  }

  public static async getInvoiceReceipt(req: Request, res: Response): Promise<void> {
    try {
      const userContext = SalesController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SalesService.getInvoiceReceipt(id, userContext);
      sendSuccess(res, data, 'Invoice receipt format retrieved.');
    } catch (error) {
      SalesController.handleError(res, error, 'Failed to fetch invoice receipt.');
    }
  }

  public static async getSalesSummary(req: Request, res: Response): Promise<void> {
    try {
      const userContext = SalesController.getUserContext(req);
      const data = await SalesService.getSalesSummary(userContext);
      sendSuccess(res, data, 'Sales summary retrieved.');
    } catch (error) {
      SalesController.handleError(res, error, 'Failed to calculate sales summary.');
    }
  }

  public static async deleteInvoice(req: Request, res: Response): Promise<void> {
    try {
      const userContext = SalesController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const returnStock = req.body?.returnStock !== false; // Default to true if omitted
      const result = await SalesService.deleteInvoice(id, { returnStock }, userContext);
      sendSuccess(res, result, result.message, 200);
    } catch (error) {
      SalesController.handleError(res, error, 'Failed to delete/void invoice.');
    }
  }
}

