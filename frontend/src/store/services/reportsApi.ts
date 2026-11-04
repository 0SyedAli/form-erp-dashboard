import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom'
  | 'all';

export interface ReportQueryParams {
  preset?: DatePreset;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  supplierId?: string;
  limit?: number;
  page?: number;
}

export interface AdminDashboardData {
  period: {
    preset: DatePreset;
    label: string;
    start?: string;
    end?: string;
  };
  sales: {
    grossSales: number;
    discountAmount: number;
    returnAmount: number;
    netSales: number;
    invoiceCount: number;
    averageInvoiceValue: number;
    walkInSales: number;
    wholesaleSales: number;
    distributorSales: number;
  };
  collections: {
    totalConfirmedCollections: number;
    collectionsThisMonth: number;
    totalCustomerReceivables: number;
    overdueCustomerReceivables: number;
    overdueInvoicesCount: number;
    customersWithOutstandingCount: number;
  };
  inventory: {
    totalStockUnits: number;
    reservedStock: number;
    availableStock: number;
    lowStockSkuCount: number;
    outOfStockSkuCount: number;
    activeInTransitTransfers: number;
    inTransitUnits: number;
    inventoryValuation: number;
    valuationStatus: string;
  };
  purchases: {
    purchaseOrdersCount: number;
    purchaseOrdersValue: number;
    postedBillsCount: number;
    postedBillsAmount: number;
    supplierPaymentsCount: number;
    supplierPaymentsAmount: number;
    outstandingSupplierPayables: number;
    unallocatedAdvances: number;
    overdueSupplierPayables: number;
    overdueBillsCount: number;
  };
  branches: Array<{
    branchId: string;
    code: string;
    name: string;
    shopNumber: string;
    type: string;
    grossSales: number;
    netSales: number;
    invoiceCount: number;
    collections: number;
    outstandingReceivables: number;
    stockUnits: number;
    lowStockCount: number;
    purchaseValue: number;
    supplierPayables: number;
  }>;
  salesTrends: Array<{
    date: string;
    netSales: number;
    invoicesCount: number;
  }>;
  topProducts: Array<{
    sku: string;
    productName: string;
    sizeLabel: string;
    thicknessLabel: string;
    unitsSold: number;
    revenue: number;
  }>;
}

export interface BranchDashboardData {
  branch: {
    id: string;
    code: string;
    name: string;
    shopNumber: string;
  };
  period: {
    preset: DatePreset;
    label: string;
    start?: string;
    end?: string;
  };
  today: {
    sales: number;
    invoicesCount: number;
    collections: number;
    creditSales: number;
  };
  periodMetrics: {
    netSales: number;
    invoicesCount: number;
    collections: number;
    creditSales: number;
  };
  inventory: {
    onHand: number;
    reserved: number;
    available: number;
    lowStockAlertsCount: number;
    lowStockItems: Array<{
      sku: string;
      productName?: string;
      onHand: number;
      reserved: number;
      available: number;
      isOutOfStock: boolean;
    }>;
  };
  recentInvoices: Array<{
    invoiceNumber: string;
    customerName: string;
    netAmount: number;
    amountPaid: number;
    amountDue: number;
    saleType: string;
    paymentStatus: string;
    date: string;
  }>;
}

export interface ReconciliationAuditData {
  generatedAt: string;
  summary: {
    totalChecks: number;
    passedChecks: number;
    warningsCount: number;
    criticalCount: number;
    overallStatus: 'RECONCILED' | 'ATTENTION_REQUIRED' | 'CRITICAL_DISCREPANCY';
  };
  checks: Array<{
    category: string;
    recordReference: string;
    expectedValue: number;
    actualValue: number;
    difference: number;
    severity: 'OK' | 'WARNING' | 'CRITICAL';
    message: string;
  }>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export const reportsApi = createApi({
  reducerPath: 'reportsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: ['Dashboard', 'Reports', 'Reconciliation'],
  endpoints: (builder) => ({
    // 1. Dashboards
    getAdminDashboard: builder.query<AdminDashboardData, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/dashboard/admin',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Dashboard'],
    }),

    getBranchDashboard: builder.query<BranchDashboardData, { branchId?: string; preset?: DatePreset; startDate?: string; endDate?: string } | void>({
      query: (params) => ({
        url: '/reports/dashboard/branch',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Dashboard'],
    }),

    // 2. Sales Reports
    getSalesSummary: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/sales/summary',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getSalesTrends: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/sales/trends',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getSalesByBranch: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/sales/by-branch',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getSalesByTier: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/sales/by-tier',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getSalesByProduct: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/sales/by-product',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    // 3. Receivables & Aging
    getReceivablesSummary: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/receivables/summary',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getReceivablesAging: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/receivables/aging',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getCollectionsSummary: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/collections/summary',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    // 4. Inventory Reports
    getInventorySummary: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/inventory/summary',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getInventoryLowStock: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/inventory/low-stock',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getInventoryValuation: builder.query<any, void>({
      query: () => '/reports/inventory/valuation',
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getInventoryMovements: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/inventory/movements',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    // 5. Purchasing & Payables
    getPurchasingSummary: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/purchases/summary',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getPurchasingBySupplier: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/purchases/by-supplier',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getPurchasingByBranch: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/purchases/by-branch',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getPayablesSummary: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/payables/summary',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    getPayablesAging: builder.query<any, ReportQueryParams | void>({
      query: (params) => ({
        url: '/reports/payables/aging',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Reports'],
    }),

    // 6. Reconciliation Audit
    getReconciliationAudit: builder.query<ReconciliationAuditData, void>({
      query: () => '/reports/reconciliation',
      transformResponse: (res: any) => res.data,
      providesTags: ['Reconciliation'],
    }),
  }),
});

export const {
  useGetAdminDashboardQuery,
  useGetBranchDashboardQuery,
  useGetSalesSummaryQuery,
  useGetSalesTrendsQuery,
  useGetSalesByBranchQuery,
  useGetSalesByTierQuery,
  useGetSalesByProductQuery,
  useGetReceivablesSummaryQuery,
  useGetReceivablesAgingQuery,
  useGetCollectionsSummaryQuery,
  useGetInventorySummaryQuery,
  useGetInventoryLowStockQuery,
  useGetInventoryValuationQuery,
  useGetInventoryMovementsQuery,
  useGetPurchasingSummaryQuery,
  useGetPurchasingBySupplierQuery,
  useGetPurchasingByBranchQuery,
  useGetPayablesSummaryQuery,
  useGetPayablesAgingQuery,
  useGetReconciliationAuditQuery,
} = reportsApi;

