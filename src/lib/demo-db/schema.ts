import { BranchType, BranchSettings } from '@/types';

export const DEMO_DB_VERSION = 'v5_flow05';

export const STORAGE_KEYS = {
  BRANCHES: 'molty_erp_branches_v2', // backward compatible with Flow 02 branches
  USERS: 'molty_erp_users_v3',
  ROLES: 'molty_erp_roles_v3',
  BRANDS: 'molty_erp_brands_v4',
  CATEGORIES: 'molty_erp_categories_v4',
  SIZES: 'molty_erp_sizes_v4',
  THICKNESS: 'molty_erp_thickness_v4',
  PRODUCTS: 'molty_erp_products_v4',
  VARIANTS: 'molty_erp_variants_v4',
  PRICING_HISTORY: 'molty_erp_pricing_history_v4',
  STOCK_LOCATIONS: 'molty_erp_stock_locations_v5',
  INVENTORY_BALANCES: 'molty_erp_inventory_balances_v5',
  STOCK_MOVEMENTS: 'molty_erp_stock_movements_v5',
  STOCK_TRANSFERS: 'molty_erp_stock_transfers_v5',
  STOCK_COUNTS: 'molty_erp_stock_counts_v5',
  DB_VERSION: 'molty_erp_db_version',
  INVOICES: 'molty_erp_invoices_v2',
  HELD_SALES: 'molty_erp_held_sales_v6',
  POS_SETTINGS: 'molty_erp_pos_settings_v6',
  POS_CART: 'molty_erp_pos_cart_v6',
  CUSTOMERS: 'molty_erp_customers_v7',
  CUSTOMER_LEDGER: 'molty_erp_customer_ledger_v7',
  PAYMENT_COLLECTIONS: 'molty_erp_collections_v7',
  CUSTOMER_ADVANCES: 'molty_erp_customer_advances_v7',
  PRICE_LISTS: 'molty_erp_price_lists_v7',
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

export class CatalogueValidationError extends Error {
  public errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[] = []) {
    super(message);
    this.name = 'CatalogueValidationError';
    this.errors = errors;
  }
}

import { CatalogueItemStatus } from '@/types';

// --- Brand DTOs ---
export interface CreateBrandDTO {
  name: string;
  code: string;
  description?: string;
  logo?: string;
  logoUrl?: string;
  status?: CatalogueItemStatus;
}

export interface UpdateBrandDTO {
  name?: string;
  code?: string;
  description?: string;
  logo?: string;
  logoUrl?: string;
  status?: CatalogueItemStatus;
}

export interface BrandFilterOptions {
  search?: string;
  status?: 'all' | CatalogueItemStatus;
  sortBy?: 'name' | 'code' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// --- Category DTOs ---
export interface CreateCategoryDTO {
  brandId: string;
  name: string;
  code?: string;
  description?: string;
  status?: CatalogueItemStatus;
}

export interface UpdateCategoryDTO {
  brandId?: string;
  name?: string;
  code?: string;
  description?: string;
  status?: CatalogueItemStatus;
}

export interface CategoryFilterOptions {
  search?: string;
  brandId?: string | 'all';
  status?: 'all' | CatalogueItemStatus;
  sortBy?: 'name' | 'code' | 'brand' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// --- Size DTOs ---
export interface CreateSizeDTO {
  length: number;
  width: number;
  unit?: string;
  displayLabel?: string;
  status?: CatalogueItemStatus;
}

export interface UpdateSizeDTO {
  length?: number;
  width?: number;
  unit?: string;
  displayLabel?: string;
  status?: CatalogueItemStatus;
}

export interface SizeFilterOptions {
  search?: string;
  status?: 'all' | CatalogueItemStatus;
  unit?: string;
  sortBy?: 'displayLabel' | 'length' | 'width' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// --- Thickness DTOs ---
export interface CreateThicknessDTO {
  value: number;
  unit?: string;
  displayLabel?: string;
  status?: CatalogueItemStatus;
}

export interface UpdateThicknessDTO {
  value?: number;
  unit?: string;
  displayLabel?: string;
  status?: CatalogueItemStatus;
}

export interface ThicknessFilterOptions {
  search?: string;
  status?: 'all' | CatalogueItemStatus;
  sortBy?: 'value' | 'displayLabel' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// --- Catalogue Product DTOs ---
export interface CreateCatalogueProductDTO {
  name: string;
  code: string;
  brandId: string;
  categoryId: string;
  description?: string;
  imageUrl?: string;
  status?: CatalogueItemStatus;
}

export interface UpdateCatalogueProductDTO {
  name?: string;
  code?: string;
  brandId?: string;
  categoryId?: string;
  description?: string;
  imageUrl?: string;
  status?: CatalogueItemStatus;
}

export interface ProductFilterOptions {
  search?: string;
  brandId?: string | 'all';
  categoryId?: string | 'all';
  status?: 'all' | CatalogueItemStatus;
  sortBy?: 'name' | 'code' | 'brand' | 'category' | 'variants' | 'status' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// --- Product Variant DTOs ---
export interface CreateVariantDTO {
  productId: string;
  sizeId: string;
  thicknessId: string;
  sku: string;
  barcode?: string;
  retailPrice: number;
  wholesalePrice: number;
  status?: CatalogueItemStatus;
}

export interface UpdateVariantDTO {
  sku?: string;
  barcode?: string;
  retailPrice?: number;
  walkInPrice?: number;
  wholesalePrice?: number;
  distributorPrice?: number;
  status?: CatalogueItemStatus;
}

export interface GenerateVariantsDTO {
  productId: string;
  sizeIds?: string[];
  thicknessIds?: string[];
  defaultRetailPrice?: number;
  defaultWholesalePrice?: number;
  combinations?: Array<{
    sizeId: string;
    thicknessId: string;
    sku: string;
    retailPrice: number;
    wholesalePrice: number;
  }>;
}

export interface VariantFilterOptions {
  search?: string;
  productId?: string | 'all';
  brandId?: string | 'all';
  categoryId?: string | 'all';
  sizeId?: string | 'all';
  thicknessId?: string | 'all';
  status?: 'all' | CatalogueItemStatus;
  sortBy?: 'sku' | 'product' | 'brand' | 'category' | 'retailPrice' | 'wholesalePrice' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// --- Pricing DTOs ---
export interface UpdatePricingDTO {
  variantId: string;
  retailPrice?: number;
  walkInPrice?: number;
  wholesalePrice?: number;
  distributorPrice?: number;
  changedBy: string;
  changeReason?: string;
  reason?: string;
}

export interface BulkUpdatePricingDTO {
  updates: Array<{
    variantId: string;
    retailPrice?: number;
    wholesalePrice?: number;
    distributorPrice?: number;
  }>;
  changedBy: string;
  changeReason?: string;
  reason?: string;
}

// --- Flow 07: Customers, Ledgers & Collections DTOs ---
export interface CreateCustomerDTO {
  code?: string;
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  customerType: 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR' | 'RETAIL';
  address?: string;
  city?: string;
  ntn?: string;
  taxNumber?: string;
  notes?: string;
  creditEnabled?: boolean;
  creditLimit?: number;
  creditTerms?: string;
  defaultDueDays?: number;
  openingBalance?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface UpdateCustomerDTO {
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  customerType?: 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR' | 'RETAIL';
  address?: string;
  city?: string;
  ntn?: string;
  taxNumber?: string;
  notes?: string;
  creditEnabled?: boolean;
  creditLimit?: number;
  creditTerms?: string;
  defaultDueDays?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface CustomerFilterOptions {
  search?: string;
  customerType?: 'ALL' | 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR' | 'RETAIL';
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  hasOutstanding?: boolean;
}

export interface CreateLedgerEntryDTO {
  customerId: string;
  customerName?: string;
  date?: string;
  type: 'INVOICE' | 'PAYMENT' | 'ADVANCE' | 'CREDIT_NOTE' | 'OPENING_BALANCE' | 'REVERSAL';
  referenceNumber: string;
  invoiceId?: string;
  description: string;
  debit?: number;
  credit?: number;
  branchId?: string;
  branchName?: string;
  createdById?: string;
  createdByName?: string;
}

export interface CreatePaymentCollectionDTO {
  customerId: string;
  branchId: string;
  amount: number;
  paymentMethod: import('@/types').PaymentMethod;
  reference?: string;
  notes?: string;
  allocations: Array<{
    invoiceId: string;
    allocatedAmount: number;
    invoiceNumber?: string;
  }>;
  saveExcessAsAdvance?: boolean;
  collectedById?: string;
  collectedByName?: string;
}

export interface CollectionFilterOptions {
  search?: string;
  customerId?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
}


