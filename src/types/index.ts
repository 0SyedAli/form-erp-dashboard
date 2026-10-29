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
  branchId?: string; // alias for primary assigned branch
  assignedBranchIds?: string[]; // multi-branch assignments
  designation?: string;
  avatarUrl?: string;
  isActive?: boolean;
  status?: 'ACTIVE' | 'INACTIVE';
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
  | 'Accessories'
  | (string & {});

export type CatalogueItemStatus = 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE';

export interface Brand {
  id: string;
  name: string;
  code: string;
  description: string;
  logo?: string;
  logoUrl?: string;
  status: CatalogueItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  brandId: string;
  brandName?: string;
  name: string;
  code: string;
  description: string;
  status: CatalogueItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MattressSize {
  id: string;
  length: number;
  width: number;
  unit: string;
  displayLabel: string;
  name?: string;
  dimensionsFormatted?: string;
  widthInches?: number;
  lengthInches?: number;
  status: CatalogueItemStatus;
  createdAt: string;
  updatedAt: string;
}

export type Size = MattressSize;

export interface MattressThickness {
  id: string;
  value: number;
  unit: string;
  displayLabel: string;
  thicknessInches?: number;
  status: CatalogueItemStatus;
  createdAt: string;
  updatedAt: string;
}

export type Thickness = MattressThickness;

export interface CatalogueProduct {
  id: string;
  name: string;
  code: string;
  brandId: string;
  categoryId: string;
  description: string;
  imageUrl?: string;
  status: CatalogueItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sizeId: string;
  thicknessId: string;
  sku: string;
  barcode?: string;
  retailPrice: number;
  walkInPrice?: number; // alias for retailPrice
  wholesalePrice: number;
  distributorPrice?: number;
  status: CatalogueItemStatus;
  createdAt: string;
  updatedAt: string;
  // Denormalized/resolved fields for presentation convenience
  productName?: string;
  productCode?: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
}

export interface PricingHistoryRecord {
  id: string;
  variantId: string;
  sku: string;
  oldRetailPrice: number;
  newRetailPrice: number;
  oldWholesalePrice: number;
  newWholesalePrice: number;
  oldDistributorPrice?: number;
  newDistributorPrice?: number;
  changedBy: string;
  changeReason?: string;
  reason?: string;
  createdAt: string;
  timestamp?: string;
}

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
  brandId?: string;
  categoryId?: string;
  productId?: string;
}

export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'WALK_IN' | 'DISTRIBUTOR';

export type SaleType = 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR';

export type PriceListType = 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR';

export type PaymentArrangement = 'FULL' | 'PARTIAL' | 'CREDIT';

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type PaymentMethod = 
  | 'CASH' 
  | 'BANK_TRANSFER' 
  | 'PAYPAK_CARD' 
  | 'CHEQUE' 
  | 'CREDIT_30D';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'PARTIALLY_PAID' | 'UNPAID' | 'REFUNDED' | 'OVERDUE';
export type InvoicePaymentStatus = PaymentStatus;

export type InvoiceStatus = 'COMPLETED' | 'PARTIAL' | 'REFUNDED' | 'CANCELLED';

export interface InvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  lineTotal?: number; // alias for total
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
  createdAt?: string; // alias for date
  issueDate?: string; // alias for date
  items: InvoiceItem[];
  grossAmount: number;
  subtotal?: number; // alias for grossAmount
  discountAmount: number;
  returnAmount: number;
  taxAmount: number;
  netAmount: number;
  grandTotal?: number; // alias for netAmount
  amountPaid: number;
  amountReceived?: number; // alias for amountPaid
  amountDue: number;
  changeAmount?: number; // alias for change
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: InvoiceStatus;
  salesPerson: string;
  cashierName?: string; // alias for salesPerson
  saleType?: SaleType;
  appliedPriceList?: PriceListType;
  customerId?: string;
  paymentArrangement?: PaymentArrangement;
  dueDate?: string;
  isOverdue?: boolean;
  creditOverride?: boolean;
  creditApprovedBy?: string;
  notes?: string;
}

export interface DashboardKPIs {
  totalNetSales: number;
  totalGrossSales: number;
  totalDiscounts: number;
  totalReturns: number;
  retailRevenue: number;
  walkInRevenue?: number;
  walkInSales?: number; // alias
  wholesaleRevenue: number;
  distributorRevenue?: number;
  distributorSales?: number; // alias
  retailRevenuePercent: number;
  wholesaleRevenuePercent: number;
  totalInvoices: number;
  retailInvoicesCount: number;
  wholesaleInvoicesCount: number;
  averageOrderValue: number;
  totalCollections: number;
  collectionsByMethod: Record<PaymentMethod, number>;
  pendingReceivables: number;
  totalOutstandingReceivables?: number; // alias
  overdueAmount?: number;
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

// -------------------------------------------------------------------------
// Flow 05: Inventory, Stock Locations, Transfers & Movements
// -------------------------------------------------------------------------

export type StockLocationType =
  | 'RETAIL_STOCKROOM'
  | 'SHOWROOM_DISPLAY'
  | 'WHOLESALE_DEPOT'
  | 'WAREHOUSE'
  | 'RETURNS_DAMAGED';

export interface StockLocation {
  id: string;
  branchId?: string | null; // Nullable for independent/central facilities
  name: string;
  code: string;
  type: StockLocationType;
  isActive: boolean;
  inventoryEnabled: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryBalance {
  id: string;
  stockLocationId: string;
  branchId: string;
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  brandName: string;
  categoryName: string;
  sizeLabel: string;
  thicknessInches: number;
  onHand: number;
  reserved: number;
  available: number; // onHand - reserved
  reorderLevel: number;
  unitCost?: number; // actual cost information only
  stockStatus: StockStatus;
  lastCountDate?: string;
  updatedAt: string;
}

export type StockMovementType =
  | 'OPENING_BALANCE'
  | 'STOCK_RECEIPT'
  | 'TRANSFER_DISPATCH'
  | 'TRANSFER_RECEIPT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGED_STOCK'
  | 'RETURN_TO_SALEABLE'
  | 'POS_SALE';

export interface StockMovement {
  id: string;
  documentReference: string;
  sku: string;
  productId: string;
  variantId: string;
  sourceLocationId?: string;
  sourceBranchId?: string;
  destinationLocationId?: string;
  destinationBranchId?: string;
  movementType: StockMovementType;
  type?: StockMovementType; // alias for movementType
  quantity: number; // positive magnitude
  unitCost?: number;
  createdBy: string;
  timestamp: string;
  notes?: string;
  relatedTransactionId?: string;
}

export type StockTransferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface StockTransferItem {
  sku: string;
  variantId: string;
  productName: string;
  sizeLabel: string;
  thicknessInches: number;
  requestedQuantity: number;
  dispatchedQuantity?: number;
  receivedQuantity?: number;
  unitCost?: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceLocationId: string;
  destinationBranchId: string;
  destinationLocationId: string;
  status: StockTransferStatus;
  items: StockTransferItem[];
  notes?: string;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  dispatchedBy?: string;
  dispatchedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StockCountStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StockCountItem {
  sku: string;
  variantId: string;
  productName: string;
  sizeLabel: string;
  thicknessInches: number;
  systemQuantity: number;
  physicalQuantity: number;
  variance: number; // physicalQuantity - systemQuantity
  unitCost?: number;
  notes?: string;
}

export interface StockCount {
  id: string;
  countNumber: string;
  branchId: string;
  stockLocationId: string;
  status: StockCountStatus;
  items: StockCountItem[];
  totalDiscrepancy: number;
  notes?: string;
  countedBy: string;
  countedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StockAdjustmentReason =
  | 'PHYSICAL_CORRECTION'
  | 'DAMAGED_MATTRESS'
  | 'LOST_STOCK'
  | 'ADMINISTRATIVE'
  | 'RETURN_TO_SALEABLE'
  | 'OTHER';

export interface StockAdjustmentInput {
  branchId: string;
  stockLocationId: string;
  sku: string;
  adjustmentType: StockAdjustmentReason;
  quantityDifference: number; // can be positive or negative
  reason: string; // mandatory reason
  notes?: string;
  authorizedBy: string;
}

export interface StockReceivingItemInput {
  sku: string;
  quantity: number;
  unitCost?: number;
}

export interface StockReceivingInput {
  destinationBranchId: string;
  destinationLocationId: string;
  supplierName?: string;
  referenceNumber?: string;
  notes?: string;
  receivedBy: string;
  items: StockReceivingItemInput[];
}

export interface OpeningStockItemInput {
  sku: string;
  openingQuantity: number;
  unitCost?: number;
}

export interface OpeningStockInput {
  branchId: string;
  stockLocationId: string;
  referenceNumber?: string;
  notes?: string;
  createdBy: string;
  items: OpeningStockItemInput[];
}

/**
 * Flow 06 — Point of Sale (POS) & Checkout Interfaces
 */
export interface POSCartItem {
  id?: string; // unique cart item id
  productId: string;
  productName: string;
  productImageUrl?: string;
  imageUrl?: string;
  brandId?: string;
  brandName: string;
  categoryId?: string;
  categoryName: string;
  variantId: string;
  sku: string;
  sizeLabel: string;
  dimensionInches?: string;
  thicknessInches?: number;
  thicknessLabel?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availableStock: number;
  saleType?: SaleType;
  walkInPrice?: number;
  wholesalePrice?: number;
  distributorPrice?: number;
}

export interface HeldSale {
  id: string;
  holdReference: string; // e.g. "HOLD-1001"
  holdNumber?: string; // alias
  branchId: string;
  branchName?: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: POSCartItem[];
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  grandTotal?: number;
  totalAmount?: number; // alias
  notes?: string;
  createdAt: string;
}

export interface POSSettings {
  selectedBranchId: string;
  branchId?: string; // alias
  cashierName: string;
  receiptFormat: 'THERMAL_80MM' | 'STANDARD_A4';
  autoPrint?: boolean;
  autoPrintReceipt?: boolean; // alias
  showThumbnails?: boolean;
  showProductThumbnails?: boolean; // alias
  shiftName: string;
  taxRatePercent: number; // default 0
  defaultPaymentMethod?: string;
}

export interface POSCheckoutItemInput {
  sku: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface POSCheckoutInput {
  branchId: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  saleType?: SaleType;
  paymentArrangement?: PaymentArrangement;
  appliedPriceList?: PriceListType;
  dueDate?: string;
  creditOverride?: boolean;
  creditApprovedBy?: string;
  items: POSCheckoutItemInput[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  amountReceived: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface POSCheckoutResult {
  invoice: Invoice;
  receiptNumber: string;
  deductedMovements: StockMovement[];
  ledgerEntry?: CustomerLedgerEntry;
}

/**
 * Flow 07 — Customers, Ledgers, Pricing Tiers & Collections
 */
export interface Customer {
  id: string;
  code: string;
  customerCode?: string;
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  customerType: CustomerType;
  address?: string;
  city?: string;
  ntn?: string;
  taxNumber?: string;
  notes?: string;
  creditEnabled: boolean;
  creditLimit: number;
  currentOutstanding: number;
  availableCredit: number;
  creditTerms: string; // e.g. 'Net 30', 'Net 15', 'Due on Receipt'
  defaultDueDays: number; // e.g. 30
  openingBalance?: number;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export type CustomerLedgerEntryType =
  | 'INVOICE'
  | 'PAYMENT'
  | 'ADVANCE'
  | 'CREDIT_NOTE'
  | 'OPENING_BALANCE'
  | 'REVERSAL';

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  customerName?: string;
  date: string;
  transactionDate?: string;
  type: CustomerLedgerEntryType;
  referenceNumber: string;
  invoiceId?: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  branchId: string;
  branchName?: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;
}

export interface PaymentAllocationItem {
  invoiceId: string;
  invoiceNumber: string;
  allocatedAmount: number;
  totalInvoiceAmount?: number;
  previousOutstanding?: number;
  newOutstanding?: number;
}

export interface PaymentCollection {
  id: string;
  receiptNumber: string; // e.g. "REC-YYYYMM-XXXX"
  customerId: string;
  customerName: string;
  branchId: string;
  branchName?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  allocations: PaymentAllocationItem[];
  unallocatedAdvance: number;
  collectedById?: string;
  collectedByName: string;
  collectedAt: string;
}

export interface CustomerAdvance {
  id: string;
  customerId: string;
  customerName?: string;
  collectionId: string;
  amount?: number;
  originalAmount: number;
  remainingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListItem {
  id: string;
  priceListType: PriceListType;
  variantId: string;
  sku: string;
  price: number;
  minQuantity?: number;
  effectiveFrom?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

