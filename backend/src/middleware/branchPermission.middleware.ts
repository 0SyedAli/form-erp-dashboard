import { Request, Response, NextFunction } from 'express';
import { BranchPermissions, ACCOUNT_ROLES } from '../constants/index.js';
import { sendError } from '../utils/apiResponse.js';

export function requireBranchPermission(permissionKey: keyof BranchPermissions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.account) {
      sendError(res, 'Authentication required to evaluate permissions.', 401, 'UNAUTHORIZED');
      return;
    }

    // Super Admin has full unrestricted access across all modules
    if (req.account.role === ACCOUNT_ROLES.SUPER_ADMIN) {
      return next();
    }

    // Branch account permission check
    const accountPermissions = req.account.permissions as Record<string, boolean> | undefined;
    const hasPermission = Boolean(accountPermissions && accountPermissions[permissionKey] === true);

    if (!hasPermission) {
      sendError(
        res,
        `Branch account lacks the required permission: "${String(permissionKey)}". Please contact Super Admin.`,
        403,
        'INSUFFICIENT_PERMISSIONS',
        { requiredPermission: permissionKey }
      );
      return;
    }

    next();
  };
}

export function requireAnyBranchPermission(permissionKeys: (keyof BranchPermissions)[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.account) {
      sendError(res, 'Authentication required to evaluate permissions.', 401, 'UNAUTHORIZED');
      return;
    }

    if (req.account.role === ACCOUNT_ROLES.SUPER_ADMIN) {
      return next();
    }

    const accountPermissions = req.account.permissions as Record<string, boolean> | undefined;
    const hasAny = permissionKeys.some((k) => Boolean(accountPermissions && accountPermissions[k] === true));

    if (!hasAny) {
      sendError(
        res,
        `Branch account lacks any of the required permissions: [${permissionKeys.join(', ')}]. Please contact Super Admin.`,
        403,
        'INSUFFICIENT_PERMISSIONS',
        { requiredPermissions: permissionKeys }
      );
      return;
    }

    next();
  };
}

