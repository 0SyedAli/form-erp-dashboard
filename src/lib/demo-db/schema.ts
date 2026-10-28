import { BranchType, BranchSettings } from '@/types';

export const DEMO_DB_VERSION = 'v3_flow03';

export const STORAGE_KEYS = {
  BRANCHES: 'molty_erp_branches_v2', // backward compatible with Flow 02 branches
  USERS: 'molty_erp_users_v3',
  ROLES: 'molty_erp_roles_v3',
  DB_VERSION: 'molty_erp_db_version',
  INVOICES: 'molty_erp_invoices_v2',
  LAST_RESET: 'molty_erp_last_reset',
} as const;

export interface CreateUserDTO {
  name: string;
  email: string;
  phone?: string;
  role: string;
  roleId?: string;
  assignedBranchId?: string;
  assignedBranchIds?: string[];
  designation?: string;
  avatarUrl?: string;
  customPermissions?: string[];
  isActive?: boolean;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  roleId?: string;
  assignedBranchId?: string;
  assignedBranchIds?: string[];
  designation?: string;
  avatarUrl?: string;
  customPermissions?: string[];
  isActive?: boolean;
}

export interface UserFilterOptions {
  search?: string;
  role?: string | 'all';
  branchId?: string | 'all';
  status?: 'all' | 'active' | 'inactive';
  sortBy?: 'name' | 'email' | 'role' | 'branch' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateRoleDTO {
  name: string;
  code: string;
  description: string;
  permissions: string[];
}

export interface UpdateRoleDTO {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface RoleFilterOptions {
  search?: string;
  isSystem?: boolean;
}

export interface CreateBranchDTO {
  name: string;
  code: string;
  shopNumber: string;
  type: BranchType;
  city: string;
  address: string;
  phone: string;
  managerId?: string;
  managerName?: string;
  managerEmail?: string;
  targetMonthlySales?: number;
  imageUrl?: string;
  settings?: Partial<BranchSettings>;
}

export interface UpdateBranchDTO {
  name?: string;
  code?: string;
  shopNumber?: string;
  type?: BranchType;
  city?: string;
  address?: string;
  phone?: string;
  managerId?: string;
  managerName?: string;
  managerEmail?: string;
  targetMonthlySales?: number;
  imageUrl?: string;
  settings?: Partial<BranchSettings>;
  isActive?: boolean;
}

export interface BranchFilterOptions {
  search?: string;
  type?: 'all' | 'retail' | 'warehouse' | BranchType;
  status?: 'all' | 'active' | 'inactive';
  sortBy?: 'name' | 'code' | 'shopNumber' | 'targetMonthlySales' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const DEFAULT_BRANCH_SETTINGS: BranchSettings = {
  allowRetailSales: true,
  allowWholesaleSales: true,
  manageOwnInventory: false,
  showInReports: true,
};

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class BranchValidationError extends Error {
  public errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[] = []) {
    super(message);
    this.name = 'BranchValidationError';
    this.errors = errors;
  }
}

export class UserValidationError extends Error {
  public errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[] = []) {
    super(message);
    this.name = 'UserValidationError';
    this.errors = errors;
  }
}

export class RoleValidationError extends Error {
  public errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[] = []) {
    super(message);
    this.name = 'RoleValidationError';
    this.errors = errors;
  }
}

