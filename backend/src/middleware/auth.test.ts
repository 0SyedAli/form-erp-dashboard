import { describe, it, expect, vi } from 'vitest';
import { requireSuperAdmin, requireBranchAccount, enforceBranchBoundary } from './auth.middleware.js';
import { ACCOUNT_ROLES } from '../constants/index.js';
import { Request, Response } from 'express';

describe('Authentication & Branch Boundary Middleware', () => {
  const createMockReqRes = (account?: any, params: any = {}, body: any = {}, query: any = {}) => {
    const req = {
      account,
      params,
      body,
      query,
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();
    return { req, res, next };
  };

  describe('requireSuperAdmin', () => {
    it('denies branch account access to Super Admin routes', () => {
      const { req, res, next } = createMockReqRes({ role: ACCOUNT_ROLES.BRANCH });
      requireSuperAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('allows Super Admin account access', () => {
      const { req, res, next } = createMockReqRes({ role: ACCOUNT_ROLES.SUPER_ADMIN });
      requireSuperAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireBranchAccount', () => {
    it('allows branch account', () => {
      const { req, res, next } = createMockReqRes({ role: ACCOUNT_ROLES.BRANCH });
      requireBranchAccount(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('enforceBranchBoundary', () => {
    it('allows Super Admin to access any branch', () => {
      const { req, res, next } = createMockReqRes(
        { role: ACCOUNT_ROLES.SUPER_ADMIN },
        { branchId: 'BR-ANY-99' }
      );
      enforceBranchBoundary(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows branch account to access its own assigned branch', () => {
      const branchId = '660000000000000000000001';
      const { req, res, next } = createMockReqRes(
        { role: ACCOUNT_ROLES.BRANCH, branchId },
        { branchId }
      );
      enforceBranchBoundary(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('strictly blocks branch account attempting to access another branch', () => {
      const assignedBranchId = '660000000000000000000001';
      const otherBranchId = '660000000000000000000002';
      const { req, res, next } = createMockReqRes(
        { role: ACCOUNT_ROLES.BRANCH, branchId: assignedBranchId },
        { branchId: otherBranchId }
      );

      enforceBranchBoundary(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'CROSS_BRANCH_ACCESS_DENIED' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});

