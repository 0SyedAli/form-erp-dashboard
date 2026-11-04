import {
  Branch,
  Permission,
  Role,
  User,
  Brand,
  Category,
  MattressSize,
  MattressThickness,
  CatalogueProduct,
  ProductVariant,
  PricingHistoryRecord,
  StockLocation,
  InventoryBalance,
  StockMovement,
  StockTransfer,
  StockCount,
  Customer,
  CustomerLedgerEntry,
  Supplier,
  PurchaseOrder,
  GoodsReceiptNote,
  SupplierBill,
  SupplierPayment,
  SupplierLedgerEntry,
  PurchaseReturn,
} from '@/types';

/**
 * Enterprise permission catalogue covering all functional modules.
 */
export const SEED_PERMISSIONS: Permission[] = [
  // Branches
  {
    key: 'branches:view',
    label: 'View Branches',
    category: 'branches',
    description: 'View list and details of commercial market shops and depots',
    scope: 'BRANCH',
  },
  {
    key: 'branches:manage',
    label: 'Manage Branches',
    category: 'branches',
    description: 'Register, edit, activate/deactivate branches and update governance settings',
    scope: 'GLOBAL',
  },
  // Users & Roles
  {
    key: 'users:view',
    label: 'View Staff & Users',
    category: 'users',
    description: 'View list of team members and staff profiles',
    scope: 'BRANCH',
  },
  {
    key: 'users:manage',
    label: 'Manage Users',
    category: 'users',
    description: 'Add, modify, and activate/deactivate user accounts',
    scope: 'GLOBAL',
  },
  {
    key: 'roles:manage',
    label: 'Manage Roles & Matrix',
    category: 'users',
    description: 'Create and configure custom roles and permission assignments',
    scope: 'GLOBAL',
  },
  // POS & Retail Sales
  {
    key: 'pos:create',
    label: 'Create POS Invoices',
    category: 'pos',
    description: 'Process walk-in counter retail sales and print tax receipts',
    scope: 'BRANCH',
  },
  {
    key: 'pos:view',
    label: 'View Invoices',
    category: 'pos',
    description: 'Look up past invoices and transaction receipts',
    scope: 'BRANCH',
  },
  {
    key: 'pos:returns',
    label: 'Process Returns & Refunds',
    category: 'pos',
    description: 'Authorize item returns, warranty replacements, and refunds',
    scope: 'BRANCH',
  },
  // Wholesale & Commercial
  {
    key: 'wholesale:create',
    label: 'Book Wholesale Orders',
    category: 'wholesale',
    description: 'Book bulk commercial orders and generate dispatch notes',
    scope: 'BRANCH',
  },
  {
    key: 'wholesale:view',
    label: 'View Wholesale Ledgers',
    category: 'wholesale',
    description: 'Review B2B customer ledgers and dealer payment terms',
    scope: 'BRANCH',
  },
  {
    key: 'wholesale:discounts',
    label: 'Apply Commercial Discounts',
    category: 'wholesale',
    description: 'Override standard wholesale prices with approved volume discounts',
    scope: 'BRANCH',
  },
  // Products & Inventory
  {
    key: 'inventory:view',
    label: 'View Stock & Catalogue',
    category: 'inventory',
    description: 'Check real-time stock levels across shops and godowns',
    scope: 'BRANCH',
  },
  {
    key: 'inventory:manage',
    label: 'Adjust Inventory & Transfers',
    category: 'inventory',
    description: 'Perform stock counts, damage write-offs, and inter-shop transfers',
    scope: 'BRANCH',
  },
  {
    key: 'catalogue:view',
    label: 'View Catalogue & Variants',
    category: 'inventory',
    description: 'Look up products, sizes, thicknesses, and price catalogues',
    scope: 'BRANCH',
  },
  {
    key: 'catalogue:manage',
    label: 'Manage Products & Variants',
    category: 'inventory',
    description: 'Create and edit brands, categories, products, sizes, and generate SKUs',
    scope: 'GLOBAL',
  },
  {
    key: 'pricing:manage',
    label: 'Manage Pricing & Discounts',
    category: 'inventory',
    description: 'Update retail and wholesale prices and perform bulk pricing revisions',
    scope: 'GLOBAL',
  },
  // Reports & Financials
  {
    key: 'reports:view',
    label: 'View Analytics & KPIs',
    category: 'reports',
    description: 'Access sales trends, top product metrics, and branch performance',
    scope: 'BRANCH',
  },
  {
    key: 'reports:financial',
    label: 'Financial Auditing & P&L',
    category: 'reports',
    description: 'Export consolidated P&L, NTN tax reports, and balance statements',
    scope: 'GLOBAL',
  },
  // Settings
  {
    key: 'settings:manage',
    label: 'System & ERP Settings',
    category: 'settings',
    description: 'Configure organization parameters, print templates, and system rules',
    scope: 'GLOBAL',
  },
];

/**
 * Default System Roles with preset permissions.
 */
export const SEED_ROLES: Role[] = [
  {
    id: 'ROLE_SUPER_ADMIN',
    code: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Unrestricted master access across all cluster branches, accounting, users, and governance',
    isSystem: true,
    permissions: SEED_PERMISSIONS.map((p) => p.key),
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_BRANCH_MANAGER',
    code: 'BRANCH_MANAGER',
    name: 'Branch Manager',
    description: 'Operational manager for assigned branch(es) with POS, wholesale, staff oversight, and stock control',
    isSystem: true,
    permissions: [
      'branches:view',
      'users:view',
      'pos:create',
      'pos:view',
      'pos:returns',
      'wholesale:create',
      'wholesale:view',
      'inventory:view',
      'inventory:manage',
      'catalogue:view',
      'reports:view',
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_CASHIER',
    code: 'CASHIER',
    name: 'Cashier',
    description: 'Front-counter billing specialist for walk-in retail mattress and accessory sales',
    isSystem: true,
    permissions: [
      'pos:create',
      'pos:view',
      'pos:returns',
      'inventory:view',
      'catalogue:view',
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_WHOLESALE_STAFF',
    code: 'WHOLESALE_STAFF',
    name: 'Wholesale Staff',
    description: 'Commercial sales executive for bulk dealer orders and godown dispatch coordination',
    isSystem: true,
    permissions: [
      'wholesale:create',
      'wholesale:view',
      'wholesale:discounts',
      'inventory:view',
      'catalogue:view',
      'pos:view',
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_INVENTORY_OFFICER',
    code: 'INVENTORY_OFFICER',
    name: 'Inventory Officer',
    description: 'Godown stock keeper managing warehouse replenishment, inter-shop transfers, and audits',
    isSystem: true,
    permissions: [
      'inventory:view',
      'inventory:manage',
      'catalogue:view',
      'catalogue:manage',
      'branches:view',
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ROLE_ACCOUNTANT',
    code: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Financial analyst auditing consolidated sales, receivables, tax ledgers, and revenue',
    isSystem: true,
    permissions: [
      'reports:view',
      'reports:financial',
      'pos:view',
      'wholesale:view',
      'branches:view',
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// Clean baseline: all business entity collections are empty by default.
// Production data is sourced directly from MongoDB Atlas via the backend Express API.
export const SEED_BRANCHES: Branch[] = [];
export const SEED_USERS: User[] = [];
export const SEED_BRANDS: Brand[] = [];
export const SEED_CATEGORIES: Category[] = [];
export const SEED_SIZES: MattressSize[] = [];
export const SEED_THICKNESS: MattressThickness[] = [];
export const SEED_CATALOGUE_PRODUCTS: CatalogueProduct[] = [];
export const SEED_VARIANTS: ProductVariant[] = [];
export const SEED_PRICING_HISTORY: PricingHistoryRecord[] = [];
export const SEED_STOCK_LOCATIONS: StockLocation[] = [];
export const SEED_INVENTORY_BALANCES: InventoryBalance[] = [];
export const SEED_STOCK_MOVEMENTS: StockMovement[] = [];
export const SEED_STOCK_TRANSFERS: StockTransfer[] = [];
export const SEED_STOCK_COUNTS: StockCount[] = [];
export const SEED_CUSTOMERS: Customer[] = [];
export const SEED_CUSTOMER_LEDGER: CustomerLedgerEntry[] = [];
export const SEED_SUPPLIERS: Supplier[] = [];
export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [];
export const SEED_GOODS_RECEIPTS: GoodsReceiptNote[] = [];
export const SEED_SUPPLIER_BILLS: SupplierBill[] = [];
export const SEED_SUPPLIER_PAYMENTS: SupplierPayment[] = [];
export const SEED_SUPPLIER_LEDGER: SupplierLedgerEntry[] = [];
export const SEED_PURCHASE_RETURNS: PurchaseReturn[] = [];
