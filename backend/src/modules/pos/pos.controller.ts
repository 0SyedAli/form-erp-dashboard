import { Request, Response } from 'express';
import { PosService, UserContext } from './pos.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class PosController {
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
    const isWriteConflict =
      err.code === 112 ||
      err.codeName === 'WriteConflict' ||
      (err.errorLabels && err.errorLabels.includes('TransientTransactionError'));

    if (isWriteConflict) {
      sendError(res, 'Concurrent checkout conflict. Please retry the sale.', 409, 'WRITE_CONFLICT');
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
        : 'INTERNAL_ERROR');
    sendError(res, msg, status, code, err.details);
  }

  public static async getCatalogue(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const data = await PosService.getPOSCatalogue(userContext);
      sendSuccess(res, data, 'POS catalogue retrieved successfully.');
    } catch (error) {
      PosController.handleError(res, error, 'Failed to retrieve POS catalogue.');
    }
  }

  public static async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const skuId = Array.isArray(req.params.skuId) ? req.params.skuId[0] : req.params.skuId;
      const data = await PosService.getSkuAvailability(skuId, userContext);
      sendSuccess(res, data, 'Stock availability retrieved.');
    } catch (error) {
      PosController.handleError(res, error, 'Failed to fetch SKU availability.');
    }
  }

  public static async checkout(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const result = await PosService.checkout(req.body, userContext);
      sendSuccess(res, result, result.message, result.isReplay ? 200 : 201);
    } catch (error) {
      PosController.handleError(res, error, 'Checkout failed.');
    }
  }

  public static async getHeldSales(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const data = await PosService.getHeldSales(userContext);
      sendSuccess(res, data, 'Held sales retrieved.');
    } catch (error) {
      PosController.handleError(res, error, 'Failed to retrieve held sales.');
    }
  }

  public static async createHeldSale(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const data = await PosService.createHeldSale(req.body, userContext);
      sendSuccess(res, data, 'Sale held successfully.', 201);
    } catch (error) {
      PosController.handleError(res, error, 'Failed to hold sale.');
    }
  }

  public static async resumeHeldSale(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await PosService.resumeHeldSale(id, userContext);
      sendSuccess(res, data, 'Held sale resumed.');
    } catch (error) {
      PosController.handleError(res, error, 'Failed to resume held sale.');
    }
  }

  public static async deleteHeldSale(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await PosService.deleteHeldSale(id, userContext);
      sendSuccess(res, data, data.message);
    } catch (error) {
      PosController.handleError(res, error, 'Failed to delete held sale.');
    }
  }
}
