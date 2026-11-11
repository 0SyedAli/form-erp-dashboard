import { Request, Response } from 'express';
import { CustomerService, UserContext } from './customer.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class CustomerController {
  private static getUserContext(req: Request): UserContext {
    return {
      accountId: req.account?._id?.toString() || '',
      loginId: req.account?.loginId || '',
      role: req.account?.role || 'BRANCH',
      branchId: req.account?.branchId?._id?.toString() || req.account?.branchId?.toString(),
      permissions: req.account?.permissions as Record<string, boolean>,
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

  public static async getCustomers(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const data = await CustomerService.getCustomers(req.query as any, userContext);
      sendSuccess(res, data.customers, 'Customers retrieved.', 200, data.pagination);
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to fetch customers.');
    }
  }

  public static async getCustomerById(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CustomerService.getCustomerById(id, userContext);
      sendSuccess(res, data, 'Customer profile retrieved.');
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to fetch customer profile.');
    }
  }

  public static async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const data = await CustomerService.createCustomer(req.body, userContext);
      sendSuccess(res, data, 'Customer created successfully.', 201);
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to create customer.');
    }
  }

  public static async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CustomerService.updateCustomer(id, req.body, userContext);
      sendSuccess(res, data, 'Customer profile updated.');
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to update customer.');
    }
  }

  public static async getCustomerLedger(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const branchIdQuery = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
      const data = await CustomerService.getCustomerLedger(id, userContext, branchIdQuery);
      sendSuccess(res, data, 'Customer account ledger retrieved.');
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to fetch customer ledger.');
    }
  }

  public static async getCustomerOutstanding(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const branchIdQuery = typeof req.query.branchId === 'string' ? req.query.branchId : undefined;
      const data = await CustomerService.getCustomerOutstanding(id, userContext, branchIdQuery);
      sendSuccess(res, data, 'Customer outstanding invoices retrieved.');
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to fetch customer outstanding invoices.');
    }
  }

  public static async getCustomerInvoices(req: Request, res: Response): Promise<void> {
    try {
      const userContext = CustomerController.getUserContext(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CustomerService.getCustomerInvoices(id, userContext);
      sendSuccess(res, data, 'Customer invoices retrieved.');
    } catch (error) {
      CustomerController.handleError(res, error, 'Failed to fetch customer invoices.');
    }
  }
}

