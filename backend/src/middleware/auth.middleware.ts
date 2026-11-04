import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { Session, Account, IAccount, ISession, hashToken } from '../models/index.js';
import { ACCOUNT_ROLES } from '../constants/index.js';
import { sendError } from '../utils/apiResponse.js';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      account?: IAccount;
      sessionRecord?: ISession;
    }
  }
}

export const SESSION_COOKIE_NAME = 'molty_session_id';

/**
 * Authenticates the caller via Session Cookie or Authorization Header.
 * Finds session by SHA-256 hash of the opaque session token.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Check cookie first (normal or signed), fallback to Authorization: Bearer <token>
    let rawToken: string | undefined =
      req.cookies?.[SESSION_COOKIE_NAME] || req.signedCookies?.[SESSION_COOKIE_NAME];

    if (!rawToken && req.headers.authorization?.startsWith('Bearer ')) {
      rawToken = req.headers.authorization.split(' ')[1];
    }

    if (!rawToken) {
      sendError(res, 'Authentication required. No active session found.', 401, 'UNAUTHORIZED');
      return;
    }

    const tokenHash = hashToken(rawToken);

    const session = await Session.findOne({
      tokenHash,
      isValid: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        path: '/',
      });
      sendError(res, 'Session is invalid or has expired. Please log in again.', 401, 'SESSION_EXPIRED');
      return;
    }

    const account = await Account.findById(session.accountId);

    if (!account || !account.isActive) {
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        path: '/',
      });
      sendError(res, 'Session is invalid or account deactivated. Please log in again.', 401, 'SESSION_EXPIRED');
      return;
    }

    req.sessionRecord = session;
    req.account = account;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role Guard: Requires Super Admin account.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.account) {
    sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    return;
  }

  if (req.account.role !== ACCOUNT_ROLES.SUPER_ADMIN) {
    sendError(res, 'Access denied. Super Admin privileges required.', 403, 'FORBIDDEN_NOT_ADMIN');
    return;
  }

  next();
}

/**
 * Role Guard: Requires Branch account.
 */
export function requireBranchAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.account) {
    sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    return;
  }

  if (req.account.role !== ACCOUNT_ROLES.BRANCH && req.account.role !== ACCOUNT_ROLES.SUPER_ADMIN) {
    sendError(res, 'Access denied. Branch operator account required.', 403, 'FORBIDDEN_NOT_BRANCH');
    return;
  }

  next();
}

/**
 * Security Rule: Enforces that a Branch Account can only access its own assigned branch data.
 * Even if a branch user supplies a different `branchId` in body or query params, this middleware
 * strictly overrides or rejects cross-branch tampering.
 */
export function enforceBranchBoundary(req: Request, res: Response, next: NextFunction): void {
  if (!req.account) {
    sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
    return;
  }

  // Super Admin can access any branch
  if (req.account.role === ACCOUNT_ROLES.SUPER_ADMIN) {
    return next();
  }

  const assignedBranchId = req.account.branchId?.toString();
  if (!assignedBranchId) {
    sendError(res, 'Branch account has no assigned branch.', 403, 'UNASSIGNED_BRANCH_ACCOUNT');
    return;
  }

  // Check branchId parameter in route params
  if (req.params.branchId && req.params.branchId !== assignedBranchId) {
    sendError(
      res,
      'Cross-branch access denied. You are restricted to your assigned branch.',
      403,
      'CROSS_BRANCH_ACCESS_DENIED'
    );
    return;
  }

  // Check branchId in query params
  if (req.query.branchId && req.query.branchId !== assignedBranchId) {
    sendError(
      res,
      'Cross-branch access denied. You are restricted to your assigned branch.',
      403,
      'CROSS_BRANCH_ACCESS_DENIED'
    );
    return;
  }

  // Check branchId in JSON body if provided
  if (req.body && req.body.branchId && req.body.branchId !== assignedBranchId) {
    sendError(
      res,
      'Cross-branch access denied. You cannot modify records for another branch.',
      403,
      'CROSS_BRANCH_ACCESS_DENIED'
    );
    return;
  }

  // Auto-inject assigned branchId to guarantee scope safety
  if (req.body && typeof req.body === 'object') {
    req.body.branchId = assignedBranchId;
  }

  next();
}
