import { Request, Response, NextFunction } from 'express';
import { SupplierService } from './supplier.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export class SupplierController {
  public static async createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userContext = {
        id: req.account!._id.toString(),
        loginId: req.account!.loginId,
        branchId: req.account!.branchId?.toString(),
      };
      const data = await SupplierService.createSupplier(req.body, userContext);
      sendSuccess(res, data, 'Supplier created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await SupplierService.getSuppliers(req.query as any);
      sendSuccess(res, result, 'Suppliers retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.getSupplierById(id);
      sendSuccess(res, data, 'Supplier retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.updateSupplier(id, req.body);
      sendSuccess(res, data, 'Supplier updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.updateStatus(id, req.body.status);
      sendSuccess(res, data, `Supplier status updated to ${req.body.status}`);
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.getSupplierLedger(id, req.query as any);
      sendSuccess(res, data, 'Supplier ledger statement retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierOutstanding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.getSupplierOutstandingBills(id);
      sendSuccess(res, data, 'Supplier outstanding bills retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierBills(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.getSupplierBills(id);
      sendSuccess(res, data, 'Supplier bills retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getSupplierPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await SupplierService.getSupplierPayments(id);
      sendSuccess(res, data, 'Supplier payments retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
