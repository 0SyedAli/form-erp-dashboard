export const ACCOUNT_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  BRANCH: 'BRANCH',
} as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[keyof typeof ACCOUNT_ROLES];

export const BRANCH_CODES = {
  MAIN: 'SHOP-12-14',
  DISPLAY: 'SHOP-18',
  WHOLESALE: 'SHOP-24-A',
  ORTHO: 'SHOP-06',
  EXPRESS: 'SHOP-31',
} as const;

export const STANDARD_BRANCH_PERMISSIONS = {
  pos: true,
  viewOwnSales: true,
  viewProducts: true,
  addEditProducts: false,
  viewStock: true,
  manageStock: false,
  stockTransfers: false,
  customers: true,
  customerCredit: false,
  collections: true,
  purchases: false,
  suppliers: false,
  reports: false,
  returns: false,
  discountsOverrides: false,
};

export type BranchPermissions = typeof STANDARD_BRANCH_PERMISSIONS;

export const SALE_TYPES = {
  WALK_IN: 'WALK_IN',
  WHOLESALE: 'WHOLESALE',
  DISTRIBUTOR: 'DISTRIBUTOR',
} as const;

export type SaleType = (typeof SALE_TYPES)[keyof typeof SALE_TYPES];

export const PAYMENT_STATUSES = {
  PAID: 'PAID',
  PARTIAL: 'PARTIAL',
  UNPAID: 'UNPAID',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const PAYMENT_ARRANGEMENTS = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  CREDIT: 'CREDIT',
  CASH: 'CASH',
  SPLIT: 'SPLIT',
} as const;

export type PaymentArrangement = (typeof PAYMENT_ARRANGEMENTS)[keyof typeof PAYMENT_ARRANGEMENTS];

export const INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  VOID: 'VOID',
  REFUNDED: 'REFUNDED',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

export const STOCK_LOCATION_TYPES = {
  SALES_FLOOR: 'SALES_FLOOR',
  WAREHOUSE: 'WAREHOUSE',
  BACK_ROOM: 'BACK_ROOM',
  RETURNS_DAMAGED: 'RETURNS_DAMAGED',
} as const;

export type StockLocationType = (typeof STOCK_LOCATION_TYPES)[keyof typeof STOCK_LOCATION_TYPES];

export const STOCK_MOVEMENT_TYPES = {
  OPENING_BALANCE: 'OPENING_BALANCE',
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  SALE_DEDUCTION: 'SALE_DEDUCTION',
  TRANSFER_IN: 'TRANSFER_IN',
  TRANSFER_OUT: 'TRANSFER_OUT',
  PHYSICAL_COUNT: 'PHYSICAL_COUNT',
  ADMINISTRATIVE_ADJUSTMENT: 'ADMINISTRATIVE_ADJUSTMENT',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  RETURN_RESTOCK: 'RETURN_RESTOCK',
  PURCHASE_RETURN: 'PURCHASE_RETURN',
} as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[keyof typeof STOCK_MOVEMENT_TYPES];

export const CUSTOMER_TYPES = {
  WALK_IN: 'WALK_IN',
  WHOLESALE: 'WHOLESALE',
  DISTRIBUTOR: 'DISTRIBUTOR',
  RETAIL: 'RETAIL',
} as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES];

