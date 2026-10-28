export type DefaultRoleKey = 
  | 'SUPER_ADMIN' 
  | 'BRANCH_MANAGER' 
  | 'CASHIER' 
  | 'WHOLESALE_STAFF' 
  | 'INVENTORY_OFFICER' 
  | 'ACCOUNTANT';

export type UserRole = DefaultRoleKey | (string & {});

export type PermissionScope = 'GLOBAL' | 'BRANCH';

export type PermissionCategory = 
  | 'branches' 
  | 'users' 
  | 'pos' 
  | 'wholesale' 
  | 'inventory' 
  | 'reports' 
  | 'settings';

export interface Permission {
  key: string;
  label: string;
  category: PermissionCategory;
  description: string;
  scope: PermissionScope;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  roleId?: string;
  roleName?: string;
  assignedBranchId?: string; // primary assigned branch
  assignedBranchIds?: string[]; // multi-branch assignments
  designation: string;
  avatarUrl?: string;
  isActive?: boolean;
  customPermissions?: string[]; // explicit permission overrides
  createdAt?: string;
  updatedAt?: string;
}

export type BranchType = 
  | 'RETAIL_STORE' 
  | 'SHOWROOM' 
  | 'WHOLESALE_DEPOT' 
  | 'WAREHOUSE' 
  | 'EXPRESS_COUNTER';

export interface BranchSettings {
  allowRetailSales: boolean;
  allowWholesaleSales: boolean;
  manageOwnInventory: boolean;
  showInReports: boolean;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  shopNumber?: string;
  type?: BranchType;
  city: string;
  address: string;
  phone: string;
  managerId?: string;
  managerName: string;
  managerEmail: string;
  isActive: boolean;
  targetMonthlySales: number;
  imageUrl?: string;
  settings?: BranchSettings;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductCategory = 
  | 'Original Foam' 
  | 'Orthopedic' 
  | 'Spring Luxury' 
  | 'Medical Care' 
  | 'Ergonomic Pillows' 
  | 'Accessories';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  retailPrice: number;
  wholesalePrice: number;
  dimensions: string;
  warrantyYears: number;
  stockByBranch: Record<string, number>;
  minThreshold: number;
  isSharedCatalogue: true;
}

export type CustomerType = 'RETAIL' | 'WHOLESALE';

export type PaymentMethod = 
  | 'CASH' 
  | 'BANK_TRANSFER' 
  | 'PAYPAK_CARD' 
  | 'CHEQUE' 
  | 'CREDIT_30D';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

export type InvoiceStatus = 'COMPLETED' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED';

export interface InvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  branchId: string;
  branchName: string;
  customerType: CustomerType;
  customerName: string;
  customerPhone: string;
  customerNTN?: string;
  businessName?: string;
  date: string; // ISO string in Asia/Karachi (UTC+5)
  items: InvoiceItem[];
  grossAmount: number;
  discountAmount: number;
  returnAmount: number;
  taxAmount: number;
  netAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: InvoiceStatus;
  salesPerson: string;
  notes?: string;
}

export interface DashboardKPIs {
  totalNetSales: number;
  totalGrossSales: number;
  totalDiscounts: number;
  totalReturns: number;
  retailRevenue: number;
  wholesaleRevenue: number;
  retailRevenuePercent: number;
  wholesaleRevenuePercent: number;
  totalInvoices: number;
  retailInvoicesCount: number;
  wholesaleInvoicesCount: number;
  averageOrderValue: number;
  totalCollections: number;
  collectionsByMethod: Record<PaymentMethod, number>;
  pendingReceivables: number;
  todaySales: number;
  todayInvoices: number;
  salesGrowthPercentage: number;
}

export type DateRangePreset = 'today' | 'last7days' | 'mtd' | 'ytd' | 'custom';

export interface FilterState {
  branchId: string; // 'all' or branch ID
  dateRange: DateRangePreset;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  customerTypeFilter?: 'ALL' | CustomerType;
}

export interface BranchPerformanceMetric {
  branchId: string;
  branchCode: string;
  branchName: string;
  city: string;
  netSales: number;
  retailSales: number;
  wholesaleSales: number;
  invoiceCount: number;
  targetMonthlySales: number;
  achievementPercentage: number;
  avgOrderValue: number;
}

export interface SalesTrendDataPoint {
  date: string; // "2026-10-01" or time label
  label: string;
  retail: number;
  wholesale: number;
  netTotal: number;
  invoices: number;
}

export interface TopProductMetric {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unitsSold: number;
  totalRevenue: number;
  retailRevenue: number;
  wholesaleRevenue: number;
  stockRemainingInBranch?: number;
  totalCatalogueStock: number;
}
