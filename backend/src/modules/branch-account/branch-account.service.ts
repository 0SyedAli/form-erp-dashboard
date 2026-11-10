import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Branch, Account, Session, AuditLog, StockLocation, IAccount } from '../../models/index.js';
import { ACCOUNT_ROLES, STANDARD_BRANCH_PERMISSIONS, BranchPermissions } from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import {
  CreateBranchInput,
  CreateBranchAccountInput,
  UpdateBranchAccountInput,
  ResetPasswordInput,
  UpdatePermissionsInput,
} from './branch-account.schema.js';

export class BranchAccountService {
  /**
   * Helper to locate branch by Mongo ObjectId or branch code/loginId.
   */
  private static async findBranch(identifier: string) {
    let query: any;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = { $or: [{ _id: identifier }, { code: identifier.toUpperCase() }] };
    } else {
      query = { $or: [{ code: identifier.toUpperCase() }, { loginId: identifier.toLowerCase() }] };
    }

    const branch = await Branch.findOne(query);
    if (!branch) {
      throw new AppError(`Branch with identifier '${identifier}' not found.`, 404, 'BRANCH_NOT_FOUND');
    }
    return branch;
  }

  /**
   * Helper to sanitize account payload (strips passwordHash).
   */
  private static sanitizeAccount(account: IAccount, branch: any) {
    return {
      id: account._id.toString(),
      loginId: account.loginId,
      name: account.name,
      email: account.email || null,
      role: account.role,
      branchId: account.branchId ? account.branchId.toString() : null,
      branch: {
        id: branch._id.toString(),
        code: branch.code,
        name: branch.name,
        shopNumber: branch.shopNumber,
        city: branch.city,
      },
      permissions: account.permissions,
      isActive: account.isActive,
      lastLoginAt: account.lastLoginAt || null,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /**
   * Retrieves branch account status.
   */
  public static async getBranchAccount(branchIdentifier: string) {
    const branch = await this.findBranch(branchIdentifier);
    const account = await Account.findOne({ branchId: branch._id });

    if (!account) {
      return {
        hasAccount: false,
        branch: {
          id: branch._id.toString(),
          code: branch.code,
          name: branch.name,
          shopNumber: branch.shopNumber,
        },
        account: null,
      };
    }

    return {
      hasAccount: true,
      branch: {
        id: branch._id.toString(),
        code: branch.code,
        name: branch.name,
        shopNumber: branch.shopNumber,
      },
      account: this.sanitizeAccount(account, branch),
    };
  }

  /**
   * Creates a login account for a branch.
   */
  public static async createBranchAccount(
    branchIdentifier: string,
    input: CreateBranchAccountInput,
    adminAccountId?: string
  ) {
    const branch = await this.findBranch(branchIdentifier);

    // Verify branch does not already have an account
    const existingBranchAccount = await Account.findOne({ branchId: branch._id });
    if (existingBranchAccount) {
      throw new AppError(
        `Branch '${branch.name}' already has an account (${existingBranchAccount.loginId}).`,
        400,
        'BRANCH_ACCOUNT_ALREADY_EXISTS'
      );
    }

    // Verify loginId uniqueness
    const normalizedLoginId = input.loginId.trim().toLowerCase();
    const duplicateLogin = await Account.findOne({ loginId: normalizedLoginId });
    if (duplicateLogin) {
      throw new AppError(
        `Login ID '${normalizedLoginId}' is already in use by another account.`,
        400,
        'LOGIN_ID_ALREADY_TAKEN'
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const account = await Account.create({
      loginId: normalizedLoginId,
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase(),
      passwordHash,
      role: ACCOUNT_ROLES.BRANCH,
      branchId: branch._id,
      permissions: { ...STANDARD_BRANCH_PERMISSIONS, ...(branch.permissions || {}) },
      isActive: true,
    });

    // Update branch loginId reference
    branch.loginId = normalizedLoginId;
    await branch.save();

    await AuditLog.create({
      action: 'BRANCH_ACCOUNT_CREATED',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: adminAccountId ? new mongoose.Types.ObjectId(adminAccountId) : undefined,
      branchId: branch._id,
      details: { loginId: normalizedLoginId, branchCode: branch.code },
    });

    return this.sanitizeAccount(account, branch);
  }

  /**
   * Updates branch account details (name, email, loginId).
   */
  public static async updateBranchAccount(
    branchIdentifier: string,
    input: UpdateBranchAccountInput,
    adminAccountId?: string
  ) {
    const branch = await this.findBranch(branchIdentifier);
    const account = await Account.findOne({ branchId: branch._id });

    if (!account) {
      throw new AppError(`No account found for branch '${branch.name}'.`, 404, 'ACCOUNT_NOT_FOUND');
    }

    if (input.loginId) {
      const normalizedLoginId = input.loginId.trim().toLowerCase();
      if (normalizedLoginId !== account.loginId) {
        const duplicate = await Account.findOne({ loginId: normalizedLoginId });
        if (duplicate) {
          throw new AppError(`Login ID '${normalizedLoginId}' is already in use.`, 400, 'LOGIN_ID_ALREADY_TAKEN');
        }
        account.loginId = normalizedLoginId;
        branch.loginId = normalizedLoginId;
        await branch.save();
      }
    }

    if (input.name !== undefined) account.name = input.name.trim();
    if (input.email !== undefined) account.email = input.email ? input.email.trim().toLowerCase() : undefined;
    if (input.isActive !== undefined) account.isActive = input.isActive;

    await account.save();

    await AuditLog.create({
      action: 'BRANCH_ACCOUNT_UPDATED',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: adminAccountId ? new mongoose.Types.ObjectId(adminAccountId) : undefined,
      branchId: branch._id,
      details: input,
    });

    return this.sanitizeAccount(account, branch);
  }

  /**
   * Admin resets branch password. Invalidates all active sessions for this account immediately.
   */
  public static async resetPassword(
    branchIdentifier: string,
    input: ResetPasswordInput,
    adminAccountId?: string
  ) {
    const branch = await this.findBranch(branchIdentifier);
    let account = await Account.findOne({ branchId: branch._id });

    const rawPassword = input.newPassword || input.password;
    if (!rawPassword) {
      throw new AppError('Password is required.', 400, 'PASSWORD_REQUIRED');
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    if (!account) {
      // Auto-create branch account if missing
      const loginId = (branch.loginId || branch.code || `branch_${branch.shopNumber}`).toLowerCase();
      account = await Account.create({
        loginId,
        name: branch.name,
        email: (branch as any).email || `${loginId}@moltyfoam.local`,
        passwordHash,
        role: ACCOUNT_ROLES.BRANCH,
        branchId: branch._id,
        permissions: branch.permissions || STANDARD_BRANCH_PERMISSIONS,
        isActive: true,
      });
      branch.loginId = loginId;
      await branch.save();
    } else {
      account.passwordHash = passwordHash;
      await account.save();
    }

    // Invalidate all active sessions for this account immediately
    await Session.updateMany({ accountId: account._id }, { isValid: false });

    await AuditLog.create({
      action: 'BRANCH_PASSWORD_RESET',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: adminAccountId ? new mongoose.Types.ObjectId(adminAccountId) : undefined,
      branchId: branch._id,
      details: { timestamp: new Date() },
    });

    return {
      success: true,
      message: `Password reset successfully for branch '${branch.name}'. All active sessions have been invalidated.`,
    };
  }

  /**
   * Toggles branch permissions. Takes effect on the very next request.
   */
  public static async updatePermissions(
    branchIdentifier: string,
    input: UpdatePermissionsInput,
    adminAccountId?: string
  ) {
    const branch = await this.findBranch(branchIdentifier);
    let account = await Account.findOne({ branchId: branch._id });

    const mergedPermissions: BranchPermissions = {
      ...STANDARD_BRANCH_PERMISSIONS,
      ...(account ? account.permissions : (branch.permissions || {})),
      ...input.permissions,
    };

    if (!account) {
      const loginId = (branch.loginId || branch.code || `branch_${branch.shopNumber}`).toLowerCase();
      account = await Account.create({
        loginId,
        name: branch.name,
        email: (branch as any).email || `${loginId}@moltyfoam.local`,
        passwordHash: await bcrypt.hash('password123', 10),
        role: ACCOUNT_ROLES.BRANCH,
        branchId: branch._id,
        permissions: mergedPermissions,
        isActive: true,
      });
      branch.loginId = loginId;
    } else {
      account.permissions = mergedPermissions;
      await account.save();
    }

    branch.permissions = mergedPermissions;
    await branch.save();

    await AuditLog.create({
      action: 'BRANCH_PERMISSIONS_UPDATED',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: adminAccountId ? new mongoose.Types.ObjectId(adminAccountId) : undefined,
      branchId: branch._id,
      details: { updatedKeys: Object.keys(input.permissions) },
    });

    return this.sanitizeAccount(account, branch);
  }

  /**
   * Deactivates branch account. Invalidates all active sessions immediately.
   */
  public static async deactivateAccount(branchIdentifier: string, adminAccountId?: string) {
    const branch = await this.findBranch(branchIdentifier);
    const account = await Account.findOne({ branchId: branch._id });

    if (!account) {
      throw new AppError(`No account found for branch '${branch.name}'.`, 404, 'ACCOUNT_NOT_FOUND');
    }

    account.isActive = false;
    await account.save();

    // Revoke all active sessions
    await Session.updateMany({ accountId: account._id }, { isValid: false });

    await AuditLog.create({
      action: 'BRANCH_ACCOUNT_DEACTIVATED',
      entity: 'Account',
      entityId: account._id.toString(),
      accountId: adminAccountId ? new mongoose.Types.ObjectId(adminAccountId) : undefined,
      branchId: branch._id,
      details: { timestamp: new Date() },
    });

    return {
      success: true,
      message: `Branch account '${account.loginId}' deactivated. All active sessions invalidated.`,
    };
  }

  /**
   * Creates a brand new Branch, default StockLocation, and Branch Account atomically.
   */
  public static async createBranch(input: CreateBranchInput, adminAccountId?: string) {
    const shopNum = (input.shopNumber || '').trim();
    const cleanShop = shopNum.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '01';

    // Auto-generate code if not explicitly provided or empty
    let code = (input.code || '').trim().toUpperCase();
    if (!code) {
      let candidate = `SHOP-${cleanShop}`;
      let counter = 1;
      while (await Branch.findOne({ code: candidate })) {
        counter++;
        candidate = `SHOP-${cleanShop}-${counter}`;
      }
      code = candidate;
    }

    const loginId = input.loginId.trim().toLowerCase();

    // Check if code or loginId already in use
    const existingBranch = await Branch.findOne({
      $or: [{ code }, { loginId }],
    });
    if (existingBranch) {
      if (existingBranch.code === code) {
        throw new AppError(`Branch with code '${code}' already exists.`, 409, 'BRANCH_EXISTS');
      }
      throw new AppError(`Branch with login ID '${loginId}' already exists.`, 409, 'LOGIN_ID_EXISTS');
    }

    const existingAccount = await Account.findOne({
      $or: [{ loginId }, ...(input.email ? [{ email: input.email.toLowerCase() }] : [])],
    });
    if (existingAccount) {
      throw new AppError(`Account with login ID or email already exists.`, 409, 'ACCOUNT_EXISTS');
    }

    // Default permissions: ONLY pos and viewOwnSales enabled by default
    const permissions: BranchPermissions = {
      ...STANDARD_BRANCH_PERMISSIONS,
      pos: true,
      viewOwnSales: true,
      ...(input.settings?.manageOwnInventory ? { manageStock: true } : {}),
      ...(input.settings?.allowWholesaleSales ? { customerCredit: true } : {}),
    };

    const branchName = input.name?.trim() || `Shop #${shopNum}`;

    const branch = await Branch.create({
      name: branchName,
      code,
      shopNumber: shopNum,
      type: input.type || 'RETAIL_STORE',
      city: input.city?.trim() || 'Karachi',
      address: input.address?.trim() || 'Commercial Market',
      phone: input.phone?.trim() || 'N/A',
      loginId,
      targetMonthlySales: input.targetMonthlySales || 0,
      permissions,
      isActive: true,
    });

    // Create default primary StockLocation
    await StockLocation.create({
      branchId: branch._id,
      code: `${code}-LOC-01`,
      name: `${branch.name} Stockroom`,
      type: 'SALES_FLOOR',
      isActive: true,
    });

    // Create Account
    const rawPassword = input.password || 'password123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const account = await Account.create({
      loginId,
      name: branchName,
      email: input.email?.trim().toLowerCase() || `${loginId}@moltyfoam.local`,
      passwordHash,
      role: ACCOUNT_ROLES.BRANCH,
      branchId: branch._id,
      permissions,
      isActive: true,
    });

    // Audit log
    await AuditLog.create({
      action: 'BRANCH_CREATED',
      entity: 'Branch',
      entityId: branch._id.toString(),
      accountId: adminAccountId ? new mongoose.Types.ObjectId(adminAccountId) : undefined,
      branchId: branch._id,
      details: { code, name: branch.name, loginId },
    });

    return {
      ...branch.toObject(),
      id: branch._id.toString(),
      _id: branch._id.toString(),
      account: {
        id: account._id.toString(),
        loginId: account.loginId,
        role: account.role,
      },
    };
  }
}

