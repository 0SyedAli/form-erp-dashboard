import { describe, it, expect, vi } from 'vitest';
import { requireBranchPermission } from './branchPermission.middleware.js';
import { ACCOUNT_ROLES, STANDARD_BRANCH_PERMISSIONS } from '../constants/index.js';
import { Request, Response } from 'express';

describe('Branch Permission Middleware', () => {
  const createMockReqRes = (account?: any) => {
    const req = {
      account,
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn();
    return { req, res, next };
  };

  it('rejects unauthenticated requests with 401', () => {
    const { req, res, next } = createMockReqRes(undefined);
    const middleware = requireBranchPermission('pos');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows Super Admin unconditionally across all permissions', () => {
    const superAdminAccount = {
      role: ACCOUNT_ROLES.SUPER_ADMIN,
      permissions: {},
    };
    const { req, res, next } = createMockReqRes(superAdminAccount);
    const middleware = requireBranchPermission('manageStock');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows branch account when specific permission is enabled', () => {
    const branchAccount = {
      role: ACCOUNT_ROLES.BRANCH,
      permissions: {
        ...STANDARD_BRANCH_PERMISSIONS,
        pos: true,
      },
    };
    const { req, res, next } = createMockReqRes(branchAccount);
    const middleware = requireBranchPermission('pos');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('denies branch account with 403 when permission is disabled', () => {
    const branchAccount = {
      role: ACCOUNT_ROLES.BRANCH,
      permissions: {
        ...STANDARD_BRANCH_PERMISSIONS,
        manageStock: false, // manageStock disabled
      },
    };
    const { req, res, next } = createMockReqRes(branchAccount);
    const middleware = requireBranchPermission('manageStock');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INSUFFICIENT_PERMISSIONS' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});

