import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
}

export interface POSCatalogueItem {
  id: string;
  sku: string;
  productId: string;
  productName: string;
  brandName?: string;
  categoryName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  listPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  onHand: number;
  reserved: number;
  available: number;
  inStock: boolean;
}

export interface POSAvailabilityItem {
  sku: string;
  branchId: string;
  onHand: number;
  reserved: number;
  available: number;
  inStock: boolean;
  listPrice: number;
  retailPrice: number;
  wholesalePrice: number;
}

export interface CheckoutItemInput {
  sku: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
}

export interface POSCheckoutInput {
  branchId?: string;
  stockLocationId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerType?: string;
  saleType: 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR';
  paymentArrangement: 'FULL' | 'PARTIAL' | 'CREDIT';
  paymentMethod?: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE' | 'CREDIT_30D' | string;
  items: CheckoutItemInput[];
  discountAmount?: number;
  amountReceived?: number;
  cashReceived?: number;
  dueDate?: string;
  creditOverride?: boolean;
  creditApprovedBy?: string;
  overrideReason?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface POSHeldSaleItem {
  sku: string;
  productId?: string;
  productName: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface POSHeldSale {
  _id: string;
  id?: string;
  branchId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  saleType: string;
  paymentArrangement: string;
  items: POSHeldSaleItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  totalAmount?: number;
  notes?: string;
  heldAt: string;
  createdAt: string;
}

export interface SalesInvoiceItem {
  sku: string;
  productId?: string;
  productName: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface SalesInvoice {
  _id: string;
  id: string;
  invoiceNumber: string;
  branchId: string;
  branch?: { _id: string; name: string; code: string; address?: string; phone?: string };
  customerId?: string;
  customer?: { _id: string; name: string; phone: string; address?: string; currentOutstanding?: number };
  customerName: string;
  customerPhone?: string;
  customerType: string;
  saleType: 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR';
  paymentArrangement: 'FULL' | 'PARTIAL' | 'CREDIT';
  paymentMethod: string;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  status: 'ISSUED' | 'PAID' | 'CANCELLED';
  items: SalesInvoiceItem[];
  subtotal: number;
  grossAmount?: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  netAmount?: number;
  amountPaid: number;
  amountReceived?: number;
  amountDue: number;
  changeAmount?: number;
  dueDate?: string;
  creditOverride?: boolean;
  creditApprovedBy?: string;
  overrideReason?: string;
  salesPerson?: string;
  cashierName?: string;
  notes?: string;
  createdAt: string;
  date?: string;
}

export interface CustomerData {
  _id: string;
  id: string;
  code?: string;
  customerCode?: string;
  name: string;
  phone: string;
  customerType: 'WALK_IN' | 'WHOLESALE' | 'DISTRIBUTOR' | 'RETAIL' | string;
  businessName?: string;
  email?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  creditEnabled: boolean;
  creditLimit: number;
  currentOutstanding: number;
  availableCredit: number;
  creditTerms: string;
  defaultDueDays: number;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerLedgerEntryData {
  _id: string;
  id: string;
  customerId: string;
  branchId?: string;
  entryDate: string;
  entryType: 'INVOICE' | 'PAYMENT' | 'ADVANCE' | 'CREDIT_NOTE' | 'OPENING_BALANCE' | 'REVERSAL';
  documentNumber: string;
  referenceNumber?: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerLedgerResponse {
  customer: CustomerData;
  entries: CustomerLedgerEntryData[];
  summary: {
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    currentBalance: number;
  };
}

export interface PaymentCollectionItem {
  _id: string;
  id: string;
  collectionNumber: string;
  receiptNumber?: string;
  customerId: string;
  customer?: { _id: string; name: string; phone: string };
  branchId: string;
  branch?: { _id: string; name: string; code: string };
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';
  reference?: string;
  notes?: string;
  allocations: Array<{
    invoiceId: string;
    allocatedAmount: number;
    invoiceNumber?: string;
  }>;
  collectedBy: string;
  collectedByName?: string;
  collectionDate: string;
  createdAt: string;
}

export interface CreateCollectionPayload {
  customerId: string;
  branchId?: string;
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';
  reference?: string;
  notes?: string;
  allocations?: Array<{
    invoiceId: string;
    allocatedAmount: number;
  }>;
  idempotencyKey?: string;
}

export interface SalesSummaryData {
  totalInvoiced: number;
  totalCashCollectedAtSale: number;
  totalCreditIssued: number;
  invoiceCount: number;
  bySaleType: Record<string, { count: number; invoiced: number }>;
  byPaymentStatus: Record<string, { count: number; invoiced: number; balanceDue: number }>;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const posApi = createApi({
  reducerPath: 'posApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: [
    'POSCatalogue',
    'POSAvailability',
    'SalesInvoice',
    'HeldSale',
    'Customer',
    'CustomerLedger',
    'PaymentCollection',
    'StockBalance',
  ],
  endpoints: (builder) => ({
    // 1. POS Catalogue
    getBranches: builder.query<any[], void>({
      query: () => '/branches',
      transformResponse: (response: ApiResponse<any[]>) =>
        (response.data || []).map((b) => ({
          ...b,
          id: b.id || b._id || '',
        })),
    }),

    getPOSCatalogue: builder.query<
      POSCatalogueItem[],
      { branchId?: string; search?: string; brand?: string; category?: string } | void
    >({
      query: (params) => ({
        url: '/pos/catalogue',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<{ items: POSCatalogueItem[]; branchId: string; totalItems: number }>) =>
        response.data.items,
      providesTags: ['POSCatalogue'],
    }),

    // 2. Product Availability
    getSkuAvailability: builder.query<
      POSAvailabilityItem,
      { skuId: string; branchId?: string }
    >({
      query: ({ skuId, branchId }) => ({
        url: `/pos/products/${encodeURIComponent(skuId)}/availability`,
        params: branchId ? { branchId } : {},
      }),
      transformResponse: (response: ApiResponse<POSAvailabilityItem>) => response.data,
      providesTags: (_result, _error, { skuId }) => [{ type: 'POSAvailability', id: skuId }],
    }),

    // 3. Complete Checkout Mutation
    completeCheckout: builder.mutation<
      { invoice: SalesInvoice; stockMovements: any[]; ledgerEntry?: any },
      POSCheckoutInput
    >({
      query: (body) => ({
        url: '/pos/checkout',
        method: 'POST',
        body,
      }),
      transformResponse: (
        response: ApiResponse<{ invoice: SalesInvoice; stockMovements: any[]; ledgerEntry?: any }>
      ) => response.data,
      invalidatesTags: [
        'SalesInvoice',
        'StockBalance',
        'POSAvailability',
        'POSCatalogue',
        'Customer',
        'CustomerLedger',
      ],
    }),

    // 4. Held Sales
    getHeldSales: builder.query<POSHeldSale[], { branchId?: string } | void>({
      query: (params) => ({
        url: '/pos/held-sales',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<POSHeldSale[]>) => response.data,
      providesTags: ['HeldSale'],
    }),

    holdSale: builder.mutation<POSHeldSale, Partial<POSHeldSale>>({
      query: (body) => ({
        url: '/pos/held-sales',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<POSHeldSale>) => response.data,
      invalidatesTags: ['HeldSale'],
    }),

    resumeHeldSale: builder.mutation<POSHeldSale, string>({
      query: (id) => ({
        url: `/pos/held-sales/${encodeURIComponent(id)}/resume`,
        method: 'POST',
      }),
      transformResponse: (response: ApiResponse<POSHeldSale>) => response.data,
      invalidatesTags: ['HeldSale'],
    }),

    deleteHeldSale: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/pos/held-sales/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      transformResponse: (response: ApiResponse<{ message: string }>) => response.data,
      invalidatesTags: ['HeldSale'],
    }),

    // 5. Sales Invoices
    getInvoices: builder.query<
      SalesInvoice[],
      {
        branchId?: string;
        customerId?: string;
        saleType?: string;
        paymentStatus?: string;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/sales/invoices',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<SalesInvoice[]>) => response.data,
      providesTags: ['SalesInvoice'],
    }),

    getInvoiceById: builder.query<SalesInvoice, string>({
      query: (id) => `/sales/invoices/${encodeURIComponent(id)}`,
      transformResponse: (response: ApiResponse<SalesInvoice>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'SalesInvoice', id }],
    }),

    getInvoiceReceipt: builder.query<any, string>({
      query: (id) => `/sales/invoices/${encodeURIComponent(id)}/receipt`,
      transformResponse: (response: ApiResponse<any>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'SalesInvoice', id }],
    }),

    getSalesSummary: builder.query<
      SalesSummaryData,
      { branchId?: string; dateFrom?: string; dateTo?: string } | void
    >({
      query: (params) => ({
        url: '/sales/summary',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<SalesSummaryData>) => response.data,
      providesTags: ['SalesInvoice'],
    }),

    // 6. Customers
    getCustomers: builder.query<
      CustomerData[],
      {
        search?: string;
        customerType?: string;
        status?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/customers',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<CustomerData[]>) => response.data,
      providesTags: ['Customer'],
    }),

    getCustomerById: builder.query<CustomerData, string>({
      query: (id) => `/customers/${encodeURIComponent(id)}`,
      transformResponse: (response: ApiResponse<CustomerData>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'Customer', id }],
    }),

    createCustomer: builder.mutation<CustomerData, Partial<CustomerData>>({
      query: (body) => ({
        url: '/customers',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<CustomerData>) => response.data,
      invalidatesTags: ['Customer'],
    }),

    updateCustomer: builder.mutation<CustomerData, { id: string; body: Partial<CustomerData> }>({
      query: ({ id, body }) => ({
        url: `/customers/${encodeURIComponent(id)}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (response: ApiResponse<CustomerData>) => response.data,
      invalidatesTags: ['Customer', 'CustomerLedger'],
    }),

    getCustomerLedger: builder.query<
      CustomerLedgerResponse,
      { id: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
    >({
      query: ({ id, ...params }) => ({
        url: `/customers/${encodeURIComponent(id)}/ledger`,
        params,
      }),
      transformResponse: (response: ApiResponse<CustomerLedgerResponse>) => response.data,
      providesTags: (_result, _error, { id }) => [{ type: 'CustomerLedger', id }],
    }),

    getCustomerOutstandingInvoices: builder.query<SalesInvoice[], string>({
      query: (id) => `/customers/${encodeURIComponent(id)}/outstanding`,
      transformResponse: (response: ApiResponse<SalesInvoice[]>) => response.data,
      providesTags: ['SalesInvoice'],
    }),

    getCustomerInvoices: builder.query<SalesInvoice[], string>({
      query: (id) => `/customers/${encodeURIComponent(id)}/invoices`,
      transformResponse: (response: ApiResponse<SalesInvoice[]>) => response.data,
      providesTags: ['SalesInvoice'],
    }),

    // 7. Payment Collections
    getCollections: builder.query<
      PaymentCollectionItem[],
      {
        branchId?: string;
        customerId?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/collections',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<PaymentCollectionItem[]>) => response.data,
      providesTags: ['PaymentCollection'],
    }),

    createCollection: builder.mutation<PaymentCollectionItem, CreateCollectionPayload>({
      query: (body) => ({
        url: '/collections',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<PaymentCollectionItem>) => response.data,
      invalidatesTags: [
        'PaymentCollection',
        'SalesInvoice',
        'Customer',
        'CustomerLedger',
      ],
    }),

    getCollectionById: builder.query<PaymentCollectionItem, string>({
      query: (id) => `/collections/${encodeURIComponent(id)}`,
      transformResponse: (response: ApiResponse<PaymentCollectionItem>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'PaymentCollection', id }],
    }),

    getCollectionReceipt: builder.query<any, string>({
      query: (id) => `/collections/${encodeURIComponent(id)}/receipt`,
      transformResponse: (response: ApiResponse<any>) => response.data,
      providesTags: (_result, _error, id) => [{ type: 'PaymentCollection', id }],
    }),

    getOutstandingSummary: builder.query<any, void>({
      query: () => '/collections/outstanding',
      transformResponse: (response: ApiResponse<any>) => response.data,
      providesTags: ['PaymentCollection', 'SalesInvoice', 'Customer'],
    }),

    getOverdueSummary: builder.query<any, void>({
      query: () => '/collections/overdue',
      transformResponse: (response: ApiResponse<any>) => response.data,
      providesTags: ['PaymentCollection', 'SalesInvoice'],
    }),
  }),
});

export const {
  useGetBranchesQuery,
  useGetPOSCatalogueQuery,
  useGetSkuAvailabilityQuery,
  useCompleteCheckoutMutation,
  useGetHeldSalesQuery,
  useHoldSaleMutation,
  useResumeHeldSaleMutation,
  useDeleteHeldSaleMutation,
  useGetInvoicesQuery,
  useGetInvoiceByIdQuery,
  useGetInvoiceReceiptQuery,
  useGetSalesSummaryQuery,
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useGetCustomerLedgerQuery,
  useGetCustomerOutstandingInvoicesQuery,
  useGetCustomerInvoicesQuery,
  useGetCollectionsQuery,
  useCreateCollectionMutation,
  useGetCollectionByIdQuery,
  useGetCollectionReceiptQuery,
  useGetOutstandingSummaryQuery,
  useGetOverdueSummaryQuery,
} = posApi;
