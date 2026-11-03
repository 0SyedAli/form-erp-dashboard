import { Request, Response } from 'express';
import { CollectionService, UserContext } from './collection.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class CollectionController {
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

  public static async createCollection(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CollectionController.getUserContext(req);
      const result = await CollectionService.createCollection(req.body, userContext);
      sendSuccess(res, result, result.message, result.isReplay ? 200 : 201);
    } catch (error) {
      CollectionController.handleError(res, error, 'Failed to record payment collection.');
    }
  }

  public static async getCollections(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CollectionController.getUserContext(req);
      const data = await CollectionService.getCollections(req.query as any, userContext);
      sendSuccess(res, data.collections, 'Payment collections retrieved.', 200, data.pagination);
    } catch (error) {
      CollectionController.handleError(res, error, 'Failed to fetch collections.');
    }
  }

  public static async getCollectionById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CollectionController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CollectionService.getCollectionById(id, userContext);
      sendSuccess(res, data, 'Collection record retrieved.');
    } catch (error) {
      CollectionController.handleError(res, error, 'Failed to fetch collection.');
    }
  }

  public static async getCollectionReceipt(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CollectionController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CollectionService.getCollectionReceipt(id, userContext);
      sendSuccess(res, data, 'Collection receipt retrieved.');
    } catch (error) {
      CollectionController.handleError(res, error, 'Failed to fetch collection receipt.');
    }
  }

  public static async getOutstanding(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CollectionController.getUserContext(req);
      const data = await CollectionService.getOutstandingCustomers(userContext);
      sendSuccess(res, data, 'Outstanding customer receivables retrieved.');
    } catch (error) {
      CollectionController.handleError(res, error, 'Failed to fetch outstanding receivables.');
    }
  }

  public static async getOverdue(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CollectionController.getUserContext(req);
      const data = await CollectionService.getOverdueCustomers(userContext);
      sendSuccess(res, data, 'Overdue customer receivables retrieved.');
    } catch (error) {
      CollectionController.handleError(res, error, 'Failed to fetch overdue receivables.');
    }
  }
}

