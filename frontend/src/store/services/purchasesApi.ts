import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface Supplier {
  _id: string;
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  ntn?: string;
  creditEnabled: boolean;
  defaultCreditDays: number;
  paymentTerms: string;
  creditLimit: number;
  openingPayable: number;
  currentOutstanding: number;
  balancePayable: number;
  bankName?: string;
  bankAccountNumber?: string;
  taxNumber?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderItem {
  sku: string;
  variantId?: string;
  productName: string;
  brandName?: string;
  categoryName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  lineDiscount?: number;
  taxAmount?: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  _id: string;
  id?: string;
  orderNumber: string;
  poNumber?: string;
  supplierCode?: string;
  destinationBranchName?: string;
  receivingLocationName?: string;
  destinationLocationName?: string;
  grandTotal?: number;
  supplierId: any;
  branchId: any;
  stockLocationId?: any;
  items: PurchaseOrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status:
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms: string;
  referenceNumber?: string;
  createdBy: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  receipts?: any[];
  bills?: any[];
}

export interface SupplierBill {
  _id: string;
  id?: string;
  billNumber: string;
  supplierInvoiceNumber: string;
  supplierId: any;
  branchId: any;
  purchaseOrderId?: any;
  grnIds?: any[];
  billDate: string;
  dueDate: string;
  items: any[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  grandTotal?: number;
  paidAmount: number;
  balanceDue: number;
  amountDue?: number;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  createdBy: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  _id: string;
  id?: string;
  paymentNumber: string;
  supplierId: any;
  branchId: any;
  amount: number;
  paymentMethod: string;
  reference?: string;
  chequeDate?: string;
  chequeStatus?: string;
  allocations: any[];
  unallocatedAdvance: number;
  paidBy: string;
  notes?: string;
  paymentDate: string;
  createdAt: string;
}

export interface PurchaseReturn {
  _id: string;
  id?: string;
  returnNumber: string;
  debitNoteNumber: string;
  supplierId: any;
  branchId: any;
  stockLocationId: any;
  purchaseOrderId?: any;
  billId?: any;
  receiptId?: any;
  items: any[];
  totalAmount: number;
  returnDate: string;
  reason: string;
  status: 'COMPLETED' | 'CANCELLED';
  processedBy: string;
  notes?: string;
  createdAt: string;
}

export interface PurchasingSummary {
  totalOrders: number;
  pendingApprovalOrders: number;
  totalGoodsReceipts: number;
  totalBilledAmount: number;
  totalBalanceDue: number;
  totalPaidAmount: number;
  totalOverdueAmount: number;
  overdueBillsCount: number;
  activeSuppliersCount: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export const purchasesApi = createApi({
  reducerPath: 'purchasesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: [
    'Supplier',
    'PurchaseOrder',
    'SupplierBill',
    'SupplierPayment',
    'PurchaseReturn',
    'PurchasingSummary',
    'SupplierLedger',
  ],
  endpoints: (builder) => ({
    // ==========================================
    // SUPPLIERS
    // ==========================================
    getSuppliers: builder.query<
      { suppliers: Supplier[]; pagination: any },
      { search?: string; status?: string; city?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/suppliers',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Supplier'],
    }),

    getSupplierById: builder.query<Supplier, string>({
      query: (id) => `/suppliers/${id}`,
      transformResponse: (res: any) => res.data,
      providesTags: (_res, _err, id) => [{ type: 'Supplier', id }],
    }),

    createSupplier: builder.mutation<Supplier, Partial<Supplier>>({
      query: (body) => ({
        url: '/suppliers',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Supplier', 'PurchasingSummary'],
    }),

    updateSupplier: builder.mutation<Supplier, { id: string;[key: string]: any }>({
      query: ({ id, ...body }) => ({
        url: `/suppliers/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Supplier', id }, 'Supplier'],
    }),

    updateSupplierStatus: builder.mutation<Supplier, { id: string; status: 'ACTIVE' | 'INACTIVE' }>({
      query: ({ id, status }) => ({
        url: `/suppliers/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, { id }) => [{ type: 'Supplier', id }, 'Supplier'],
    }),

    getSupplierLedger: builder.query<
      any,
      { id: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }
    >({
      query: ({ id, ...params }) => ({
        url: `/suppliers/${id}/ledger`,
        params,
      }),
      transformResponse: (res: any) => res.data,
      providesTags: (_res, _err, { id }) => [{ type: 'SupplierLedger', id }],
    }),

    getSupplierOutstandingBills: builder.query<SupplierBill[], string>({
      query: (id) => `/suppliers/${id}/outstanding`,
      transformResponse: (res: any) => res.data,
      providesTags: ['SupplierBill'],
    }),

    // ==========================================
    // PURCHASE ORDERS
    // ==========================================
    getPurchaseOrders: builder.query<
      { orders: PurchaseOrder[]; pagination: any },
      { branchId?: string; supplierId?: string; status?: string; search?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/purchases/orders',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['PurchaseOrder'],
    }),

    getPurchaseOrderById: builder.query<PurchaseOrder, string>({
      query: (id) => `/purchases/orders/${id}`,
      transformResponse: (res: any) => res.data,
      providesTags: (_res, _err, id) => [{ type: 'PurchaseOrder', id }],
    }),

    createPurchaseOrder: builder.mutation<PurchaseOrder, any>({
      query: (body) => ({
        url: '/purchases/orders',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['PurchaseOrder', 'PurchasingSummary'],
    }),

    updatePurchaseOrder: builder.mutation<PurchaseOrder, { id: string;[key: string]: any }>({
      query: ({ id, ...body }) => ({
        url: `/purchases/orders/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, { id }) => [{ type: 'PurchaseOrder', id }, 'PurchaseOrder'],
    }),

    submitPurchaseOrder: builder.mutation<PurchaseOrder, string>({
      query: (id) => ({
        url: `/purchases/orders/${id}/submit`,
        method: 'POST',
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, id) => [{ type: 'PurchaseOrder', id }, 'PurchaseOrder', 'PurchasingSummary'],
    }),

    approvePurchaseOrder: builder.mutation<PurchaseOrder, string>({
      query: (id) => ({
        url: `/purchases/orders/${id}/approve`,
        method: 'POST',
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, id) => [{ type: 'PurchaseOrder', id }, 'PurchaseOrder', 'PurchasingSummary'],
    }),

    cancelPurchaseOrder: builder.mutation<PurchaseOrder, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/purchases/orders/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, { id }) => [{ type: 'PurchaseOrder', id }, 'PurchaseOrder', 'PurchasingSummary'],
    }),

    receivePurchaseOrder: builder.mutation<any, { id: string; deliveryReference: string; stockLocationId?: string; notes?: string; items: any[] }>({
      query: ({ id, ...body }) => ({
        url: `/purchases/orders/${id}/receive`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'PurchaseOrder', id },
        'PurchaseOrder',
        'PurchasingSummary',
      ],
    }),

    // ==========================================
    // SUPPLIER BILLS
    // ==========================================
    getSupplierBills: builder.query<
      { bills: SupplierBill[]; pagination: any },
      { supplierId?: string; branchId?: string; paymentStatus?: string; search?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/purchases/bills',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['SupplierBill'],
    }),

    createSupplierBill: builder.mutation<SupplierBill, any>({
      query: (body) => ({
        url: '/purchases/bills',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['SupplierBill', 'Supplier', 'SupplierLedger', 'PurchasingSummary'],
    }),

    // ==========================================
    // SUPPLIER PAYMENTS
    // ==========================================
    getSupplierPayments: builder.query<
      { payments: SupplierPayment[]; pagination: any },
      { supplierId?: string; branchId?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/purchases/payments',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['SupplierPayment'],
    }),

    createSupplierPayment: builder.mutation<SupplierPayment, any>({
      query: (body) => ({
        url: '/purchases/payments',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['SupplierPayment', 'SupplierBill', 'Supplier', 'SupplierLedger', 'PurchasingSummary'],
    }),

    // ==========================================
    // PURCHASE RETURNS
    // ==========================================
    getPurchaseReturns: builder.query<
      { returns: PurchaseReturn[]; pagination: any },
      { supplierId?: string; branchId?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/purchases/returns',
        params: params || {},
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['PurchaseReturn'],
    }),

    createPurchaseReturn: builder.mutation<PurchaseReturn, any>({
      query: (body) => ({
        url: '/purchases/returns',
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['PurchaseReturn', 'Supplier', 'SupplierLedger', 'PurchasingSummary'],
    }),

    // ==========================================
    // SUMMARY
    // ==========================================
    getPurchasingSummary: builder.query<PurchasingSummary, void>({
      query: () => '/purchases/summary',
      transformResponse: (res: any) => res.data,
      providesTags: ['PurchasingSummary'],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  useGetSupplierByIdQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useUpdateSupplierStatusMutation,
  useGetSupplierLedgerQuery,
  useGetSupplierOutstandingBillsQuery,
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderByIdQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useApprovePurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useGetSupplierBillsQuery,
  useCreateSupplierBillMutation,
  useGetSupplierPaymentsQuery,
  useCreateSupplierPaymentMutation,
  useGetPurchaseReturnsQuery,
  useCreatePurchaseReturnMutation,
  useGetPurchasingSummaryQuery,
} = purchasesApi;
