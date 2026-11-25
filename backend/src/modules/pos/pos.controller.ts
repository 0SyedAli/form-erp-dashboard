import { Request, Response } from 'express';
import { PosService, UserContext } from './pos.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';
import { subscribeToPOSChanges } from './posChanges.js';

export class PosController {
  private static getUserContext(req: Request): UserContext {
    return {
      accountId: req.account?._id?.toString() || '',
      loginId: req.account?.loginId || '',
      role: req.account?.role || 'BRANCH',
      branchId: req.account?.branchId?._id?.toString() || req.account?.branchId?.toString(),
      name: (req.account?.branchId as any)?.name,
      permissions: req.account?.permissions as Record<string, boolean> | undefined,
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

  public static async getBootstrap(req: Request, res: Response): Promise<void> {
    try {
      const branchId = (req.query.branchId as string) || (req.account as any)?.assignedBranchId?.toString();
      const clientVersion = (req.headers['if-none-match'] as string) || (req.query.version as string);
      const forceRefresh = req.query.refresh === '1';
      res.setHeader('Cache-Control', 'private, no-store');
      if (forceRefresh) PosService.invalidatePOSCache();
      const data = await PosService.getPOSBootstrap(branchId, forceRefresh ? undefined : clientVersion);
      if (data.notModified) {
        res.status(304).end();
        return;
      }
      if (data.versionHash) {
        res.setHeader('ETag', data.versionHash);
      }
      sendSuccess(res, data, 'POS bootstrap data loaded successfully.');
    } catch (error) {
      PosController.handleError(res, error, 'Failed to retrieve POS bootstrap data.');
    }
  }

  public static streamChanges(_req: Request, res: Response): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'private, no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');
    const unsubscribe = subscribeToPOSChanges(() => res.write('data: changed\n\n'));
    const heartbeat = setInterval(() => {
      if (res.writableNeedDrain) res.end();
      else res.write(': heartbeat\n\n');
    }, 15000);
    const lifetime = setTimeout(() => res.end(), 300000);
    res.once('close', () => {
      unsubscribe();
      clearInterval(heartbeat);
      clearTimeout(lifetime);
    });
  }

  public static async getOutOfStock(req: Request, res: Response): Promise<void> {
    try {
      const userContext = PosController.getUserContext(req);
      const branchId = (req.query.branchId as string) || userContext.branchId;
      res.setHeader('Cache-Control', 'private, no-store');
      const data = await PosService.getPOSOutOfStockCatalogue(userContext, branchId);
      sendSuccess(res, data, 'Out of stock catalogue retrieved successfully.');
    } catch (error) {
      PosController.handleError(res, error, 'Failed to retrieve out of stock catalogue.');
    }
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
