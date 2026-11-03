import { Request, Response } from 'express';
import { BranchAccountService } from './branch-account.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class BranchAccountController {
  public static async getAccount(req: Request, res: Response): Promise<void> {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await BranchAccountService.getBranchAccount(branchId);
      sendSuccess(res, result);
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to retrieve branch account.', 500, 'INTERNAL_ERROR');
    }
  }

  public static async createAccount(req: Request, res: Response): Promise<void> {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const adminId = req.account?._id.toString();
      const result = await BranchAccountService.createBranchAccount(branchId, req.body, adminId);
      sendSuccess(res, result, 'Branch account created successfully.', 201);
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to create branch account.', 500, 'INTERNAL_ERROR');
    }
  }

  public static async updateAccount(req: Request, res: Response): Promise<void> {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const adminId = req.account?._id.toString();
      const result = await BranchAccountService.updateBranchAccount(branchId, req.body, adminId);
      sendSuccess(res, result, 'Branch account updated successfully.');
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to update branch account.', 500, 'INTERNAL_ERROR');
    }
  }

  public static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const adminId = req.account?._id.toString();
      const result = await BranchAccountService.resetPassword(branchId, req.body, adminId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to reset branch password.', 500, 'INTERNAL_ERROR');
    }
  }

  public static async updatePermissions(req: Request, res: Response): Promise<void> {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const adminId = req.account?._id.toString();
      const result = await BranchAccountService.updatePermissions(branchId, req.body, adminId);
      sendSuccess(res, result, 'Branch permissions updated successfully.');
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to update branch permissions.', 500, 'INTERNAL_ERROR');
    }
  }

  public static async deactivateAccount(req: Request, res: Response): Promise<void> {
    try {
      const branchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const adminId = req.account?._id.toString();
      const result = await BranchAccountService.deactivateAccount(branchId, adminId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      if ((error as any).statusCode) {
        sendError(res, (error as any).message, (error as any).statusCode, (error as any).code);
        return;
      }
      sendError(res, 'Failed to deactivate branch account.', 500, 'INTERNAL_ERROR');
    }
  }
}
