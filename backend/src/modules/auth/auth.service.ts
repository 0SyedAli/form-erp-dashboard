import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Account, Session, AuditLog, Branch, hashToken } from '../../models/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';
import { LoginInput, ChangePasswordInput } from './auth.schema.js';

export class AuthService {
  /**
   * Authenticates user, creates hashed session in MongoDB, and logs audit trail.
   */
  public static async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const loginIdNormalized = input.loginId.trim().toLowerCase();

    const account = await Account.findOne({
      $or: [{ loginId: loginIdNormalized }, { email: loginIdNormalized }],
    });
    if (!account) {
      // Audit login failure without recording passwords
      await AuditLog.create({
        action: 'AUTH_LOGIN_FAILED',
        entity: 'Account',
        details: { loginId: loginIdNormalized, reason: 'ACCOUNT_NOT_FOUND' },
        ipAddress,
      });
      throw new AppError('Invalid login ID or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!account.isActive) {
      await AuditLog.create({
        action: 'AUTH_LOGIN_BLOCKED',
        entity: 'Account',
        entityId: account._id.toString(),
        accountId: account._id,
        branchId: account.branchId,
        details: { loginId: account.loginId, reason: 'ACCOUNT_INACTIVE' },
        ipAddress,
      });
      throw new AppError('Account is inactive. Please contact Super Admin.', 403, 'ACCOUNT_INACTIVE');
    }

    const isMatch = await bcrypt.compare(input.password, account.passwordHash);
    if (!isMatch) {
      await AuditLog.create({
        action: 'AUTH_LOGIN_FAILED',
        entity: 'Account',
        entityId: account._id.toString(),
        accountId: account._id,
        branchId: account.branchId,
        details: { loginId: account.loginId, reason: 'INVALID_PASSWORD' },
        ipAddress,
      });
      throw new AppError('Invalid login ID or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Generate cryptographically secure opaque session token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

    // Persist only the SHA-256 hash in MongoDB
    await Session.create({
      tokenHash,
      accountId: account._id,
      branchId: account.branchId || null,
      role: account.role,
      expiresAt,
      ipAddress,
      userAgent,
      isValid: true,
    });

    // Update last login
    account.lastLoginAt = new Date();
    await account.save();

    // Audit log
    await AuditLog.create({
      action: 'AUTH_LOGIN_SUCCESS',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: account._id,
      branchId: account.branchId,
      details: { role: account.role, loginId: account.loginId },
      ipAddress,
    });

    // Fetch branch info if assigned
    let branchInfo: any = null;
    if (account.branchId) {
      branchInfo = await Branch.findById(account.branchId);
    }

    return {
      rawToken,
      expiresAt,
      account: {
        id: account._id.toString(),
        loginId: account.loginId,
        name: account.name,
        email: account.email,
        role: account.role,
        branchId: account.branchId?.toString(),
        permissions: account.permissions,
        branch: branchInfo
          ? {
              id: branchInfo._id.toString(),
              code: branchInfo.code,
              name: branchInfo.name,
              shopNumber: branchInfo.shopNumber,
              type: branchInfo.type,
              city: branchInfo.city,
            }
          : null,
      },
    };
  }

  /**
   * Invalidates active session.
   */
  public static async logout(rawToken: string, accountId?: string) {
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await Session.updateOne({ tokenHash }, { isValid: false });
    }

    if (accountId) {
      await AuditLog.create({
        action: 'AUTH_LOGOUT',
        entity: 'Account',
        entityId: accountId,
        details: { timestamp: new Date() },
      });
    }
  }

  /**
   * Returns current authenticated account context.
   */
  public static async getProfile(accountId: string) {
    const account = await Account.findById(accountId);
    if (!account || !account.isActive) {
      throw new AppError('Account not found or inactive.', 404, 'ACCOUNT_NOT_FOUND');
    }

    let branchInfo: any = null;
    if (account.branchId) {
      branchInfo = await Branch.findById(account.branchId);
    }

    return {
      id: account._id.toString(),
      loginId: account.loginId,
      name: account.name,
      email: account.email,
      role: account.role,
      branchId: account.branchId?.toString(),
      permissions: account.permissions,
      branch: branchInfo
        ? {
            id: branchInfo._id.toString(),
            code: branchInfo.code,
            name: branchInfo.name,
            shopNumber: branchInfo.shopNumber,
            type: branchInfo.type,
            city: branchInfo.city,
          }
        : null,
    };
  }

  /**
   * Changes account password and invalidates all other active sessions.
   */
  public static async changePassword(
    accountId: string,
    input: ChangePasswordInput,
    currentRawToken?: string
  ) {
    const account = await Account.findById(accountId);
    if (!account || !account.isActive) {
      throw new AppError('Account not found or inactive.', 404, 'ACCOUNT_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(input.currentPassword, account.passwordHash);
    if (!isMatch) {
      throw new AppError('Incorrect current password.', 400, 'INVALID_CURRENT_PASSWORD');
    }

    account.passwordHash = await bcrypt.hash(input.newPassword, 10);
    await account.save();

    // Invalidate all other sessions for this account except the current session (or all sessions)
    const currentTokenHash = currentRawToken ? hashToken(currentRawToken) : null;
    if (currentTokenHash) {
      await Session.updateMany(
        { accountId: account._id, tokenHash: { $ne: currentTokenHash } },
        { isValid: false }
      );
    } else {
      await Session.updateMany({ accountId: account._id }, { isValid: false });
    }

    await AuditLog.create({
      action: 'AUTH_PASSWORD_CHANGED',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: account._id,
      branchId: account.branchId,
      details: { timestamp: new Date() },
    });

    return { success: true, message: 'Password changed successfully.' };
  }
}
