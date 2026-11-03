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

export interface StockBalance {
  _id: string;
  id?: string;
  sku: string;
  branchId: string;
  stockLocationId: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  maxLevel?: number;
  variant?: {
    _id: string;
    sku: string;
    listPrice: number;
    retailPrice: number;
    wholesalePrice: number;
    size?: { displayLabel: string; length: number; width: number };
    thickness?: { displayLabel: string; value: number };
    product?: { name: string; code: string };
  };
  branch?: {
    _id: string;
    id: string;
    name: string;
    code: string;
  };
  location?: {
    _id: string;
    id: string;
    name: string;
    code: string;
    type: string;
  };
  updatedAt: string;
}

export interface StockLocation {
  _id: string;
  id: string;
  branchId: string;
  name: string;
  code: string;
  type: string;
  isDefault: boolean;
  isActive: boolean;
  branch?: {
    _id: string;
    name: string;
    code: string;
  };
}

export interface StockMovement {
  _id: string;
  id?: string;
  sku: string;
  movementType: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  sourceBranchId?: string;
  sourceLocationId?: string;
  destinationBranchId?: string;
  destinationLocationId?: string;
  documentReference?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface StockReceiptItem {
  sku: string;
  skuId?: string;
  quantity: number;
  unitCost?: number;
}

export interface StockReceipt {
  _id: string;
  id?: string;
  receiptNumber: string;
  branchId: string;
  stockLocationId: string;
  supplierId?: string;
  supplierReference?: string;
  status: string;
  notes?: string;
  items: StockReceiptItem[];
  receivedBy: string;
  receivedAt: string;
}

export interface StockAdjustmentItem {
  sku: string;
  skuId?: string;
  systemQuantity: number;
  countedQuantity: number;
  adjustmentQuantity: number;
  notes?: string;
}

export interface StockAdjustment {
  _id: string;
  id?: string;
  adjustmentNumber: string;
  branchId: string;
  stockLocationId: string;
  reason: string;
  notes?: string;
  items: StockAdjustmentItem[];
  authorizedBy: string;
  createdAt: string;
}

export interface StockTransferItem {
  sku: string;
  skuId?: string;
  quantity: number;
}

export interface StockTransfer {
  _id: string;
  id?: string;
  transferNumber: string;
  fromBranchId: string;
  fromLocationId: string;
  toBranchId: string;
  toLocationId: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  items: StockTransferItem[];
  requestedBy: string;
  approvedBy?: string;
  dispatchedBy?: string;
  receivedBy?: string;
  requestedAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export interface StockAlertItem {
  sku: string;
  branchId: string;
  branchName?: string;
  locationId: string;
  locationName?: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderLevel: number;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
  productName?: string;
  brandName?: string;
  categoryName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
}

export interface StockAlertsData {
  alerts: StockAlertItem[];
  metrics: {
    totalAlerts: number;
    outOfStockCount: number;
    lowStockCount: number;
  };
}

export interface InventorySummaryData {
  totalSKUs: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  totalUnitsAvailable: number;
  lowStockSKUs: number;
  outOfStockSKUs: number;
  activeTransfers: number;
  locationsCount: number;
  estimatedStockValuePKR?: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const inventoryApi = createApi({
  reducerPath: 'inventoryApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    credentials: 'include',
  }),
  tagTypes: [
    'StockBalance',
    'StockLocation',
    'StockReceipt',
    'StockAdjustment',
    'StockTransfer',
    'StockMovement',
    'StockAlert',
    'InventorySummary',
  ],
  endpoints: (builder) => ({
    // 1. Stock Balances
    getStockBalances: builder.query<
      StockBalance[],
      {
        branchId?: string;
        stockLocationId?: string;
        sku?: string;
        search?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/inventory/stock',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockBalance[]>) => response.data || [],
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ _id, sku }) => ({ type: 'StockBalance' as const, id: _id || sku })),
              { type: 'StockBalance', id: 'LIST' },
            ]
          : [{ type: 'StockBalance', id: 'LIST' }],
    }),

    // 2. Stock by SKU
    getStockBySku: builder.query<
      {
        sku: string;
        totalOnHand: number;
        totalReserved: number;
        totalAvailable: number;
        balances: StockBalance[];
      },
      { sku: string; branchId?: string }
    >({
      query: ({ sku, branchId }) => ({
        url: `/inventory/stock/${encodeURIComponent(sku)}`,
        params: branchId ? { branchId } : {},
      }),
      transformResponse: (response: ApiResponse<any>) => response.data,
      providesTags: (_res, _err, { sku }) => [{ type: 'StockBalance', id: sku }],
    }),

    // 3. Stock Locations
    getStockLocations: builder.query<StockLocation[], { branchId?: string } | void>({
      query: (params) => ({
        url: '/inventory/locations',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockLocation[]>) =>
        (response.data || []).map((loc) => ({
          ...loc,
          id: loc.id || loc._id,
        })),
      providesTags: [{ type: 'StockLocation', id: 'LIST' }],
    }),

    // 4. Update Minimum Stock / Reorder Level
    updateMinimumStock: builder.mutation<
      StockBalance,
      {
        skuId: string;
        reorderLevel: number;
        stockLocationId: string;
        branchId?: string;
      }
    >({
      query: ({ skuId, ...body }) => ({
        url: `/inventory/stock/${skuId}/minimum`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockAlert', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    // 5. Post Opening Stock
    postOpeningStock: builder.mutation<
      StockBalance[],
      {
        branchId: string;
        locationId: string;
        items: Array<{ skuId: string; onHand: number; reorderLevel?: number }>;
      }
    >({
      query: (body) => ({
        url: '/inventory/opening-stock',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockMovement', id: 'LIST' },
        { type: 'StockAlert', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    // 6. Create Stock Receipts
    createStockReceipt: builder.mutation<
      StockReceipt,
      {
        branchId: string;
        locationId: string;
        supplierId?: string;
        supplierReference?: string;
        notes?: string;
        idempotencyKey?: string;
        items: Array<{ skuId: string; quantity: number; unitCost?: number }>;
      }
    >({
      query: (body) => ({
        url: '/inventory/receipts',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockReceipt', id: 'LIST' },
        { type: 'StockMovement', id: 'LIST' },
        { type: 'StockAlert', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    // 7. Get Stock Receipts
    getStockReceipts: builder.query<
      StockReceipt[],
      {
        branchId?: string;
        supplierId?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/inventory/receipts',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockReceipt[]>) => response.data || [],
      providesTags: [{ type: 'StockReceipt', id: 'LIST' }],
    }),

    // 8. Create Stock Adjustments (Manage Stock Reconciliation)
    createAdjustments: builder.mutation<
      StockAdjustment,
      {
        branchId: string;
        stockLocationId: string;
        reason: string;
        notes?: string;
        items: Array<{
          sku: string;
          systemQuantity?: number;
          countedQuantity: number;
          physicalQuantity?: number;
        }>;
      }
    >({
      query: (body) => ({
        url: '/inventory/adjustments',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockAdjustment', id: 'LIST' },
        { type: 'StockMovement', id: 'LIST' },
        { type: 'StockAlert', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    // 9. Get Stock Adjustments
    getAdjustments: builder.query<
      StockAdjustment[],
      { branchId?: string; page?: number; limit?: number } | void
    >({
      query: (params) => ({
        url: '/inventory/adjustments',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockAdjustment[]>) => response.data || [],
      providesTags: [{ type: 'StockAdjustment', id: 'LIST' }],
    }),

    // 10. Transfers
    getTransfers: builder.query<
      StockTransfer[],
      {
        fromBranchId?: string;
        toBranchId?: string;
        status?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/inventory/transfers',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockTransfer[]>) => response.data || [],
      providesTags: [{ type: 'StockTransfer', id: 'LIST' }],
    }),

    createTransfer: builder.mutation<
      StockTransfer,
      {
        sourceBranchId: string;
        sourceLocationId: string;
        destinationBranchId: string;
        destinationLocationId: string;
        notes?: string;
        items: Array<{ sku: string; quantity: number }>;
      }
    >({
      query: (body) => ({
        url: '/inventory/transfers',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'StockTransfer', id: 'LIST' },
        { type: 'StockBalance', id: 'LIST' },
      ],
    }),

    approveTransfer: builder.mutation<StockTransfer, string>({
      query: (id) => ({
        url: `/inventory/transfers/${id}/approve`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'StockTransfer', id: 'LIST' },
        { type: 'StockBalance', id: 'LIST' },
      ],
    }),

    dispatchTransfer: builder.mutation<StockTransfer, string>({
      query: (id) => ({
        url: `/inventory/transfers/${id}/dispatch`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'StockTransfer', id: 'LIST' },
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockMovement', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    receiveTransfer: builder.mutation<StockTransfer, string>({
      query: (id) => ({
        url: `/inventory/transfers/${id}/receive`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'StockTransfer', id: 'LIST' },
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockMovement', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    cancelTransfer: builder.mutation<StockTransfer, { id: string; reason?: string }>({
      query: ({ id, reason }) => ({
        url: `/inventory/transfers/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: [
        { type: 'StockTransfer', id: 'LIST' },
        { type: 'StockBalance', id: 'LIST' },
        { type: 'StockMovement', id: 'LIST' },
        { type: 'InventorySummary', id: 'CURRENT' },
      ],
    }),

    // 11. Stock Movements & Audit Ledger
    getStockMovements: builder.query<
      StockMovement[],
      {
        branchId?: string;
        stockLocationId?: string;
        sku?: string;
        movementType?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/inventory/movements',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockMovement[]>) => response.data || [],
      providesTags: [{ type: 'StockMovement', id: 'LIST' }],
    }),

    // 12. Stock Alerts
    getStockAlerts: builder.query<
      StockAlertsData,
      {
        branchId?: string;
        status?: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'ALL';
        brandId?: string;
        categoryId?: string;
        search?: string;
        page?: number;
        limit?: number;
      } | void
    >({
      query: (params) => ({
        url: '/inventory/alerts',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<StockAlertsData>) =>
        response.data || { alerts: [], metrics: { totalAlerts: 0, outOfStockCount: 0, lowStockCount: 0 } },
      providesTags: [{ type: 'StockAlert', id: 'LIST' }],
    }),

    // 13. Inventory Summary
    getInventorySummary: builder.query<InventorySummaryData, { branchId?: string } | void>({
      query: (params) => ({
        url: '/inventory/summary',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<InventorySummaryData>) => response.data,
      providesTags: [{ type: 'InventorySummary', id: 'CURRENT' }],
    }),
  }),
});

export const {
  useGetStockBalancesQuery,
  useGetStockBySkuQuery,
  useGetStockLocationsQuery,
  useUpdateMinimumStockMutation,
  usePostOpeningStockMutation,
  useCreateStockReceiptMutation,
  useGetStockReceiptsQuery,
  useCreateAdjustmentsMutation,
  useGetAdjustmentsQuery,
  useGetTransfersQuery,
  useCreateTransferMutation,
  useApproveTransferMutation,
  useDispatchTransferMutation,
  useReceiveTransferMutation,
  useCancelTransferMutation,
  useGetStockMovementsQuery,
  useGetStockAlertsQuery,
  useGetInventorySummaryQuery,
} = inventoryApi;

