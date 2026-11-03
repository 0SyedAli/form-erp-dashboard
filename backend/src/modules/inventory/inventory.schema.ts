import { z } from 'zod';
import { STOCK_MOVEMENT_TYPES } from '../../constants/index.js';

export const stockQuerySchema = z.object({
  query: z.object({
    branchId: z.string().optional(),
    stockLocationId: z.string().optional(),
    sku: z.string().optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

export const updateMinimumStockSchema = z.object({
  params: z.object({
    skuId: z.string().min(1, 'SKU or Variant ID is required'),
  }),
  body: z.object({
    reorderLevel: z.number().int().min(0, 'Minimum stock must be non-negative'),
    stockLocationId: z.string().optional(),
    branchId: z.string().optional(),
  }),
});

export const openingStockSchema = z.object({
  body: z.object({
    branchId: z.string().optional(),
    stockLocationId: z.string().min(1, 'Stock location is required'),
    sku: z.string().min(1, 'SKU is required'),
    quantity: z.number().int().min(0, 'Quantity cannot be negative'),
    minimumStock: z.number().int().min(0).optional(),
    notes: z.string().optional(),
  }),
});

export const createStockReceiptSchema = z.object({
  body: z.object({
    branchId: z.string().optional(),
    stockLocationId: z.string().min(1, 'Stock location ID is required'),
    receiptNumber: z.string().optional(),
    supplierId: z.string().optional(),
    supplierReference: z.string().optional(),
    receivedDate: z.string().optional(),
    items: z
      .array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          quantityOrdered: z.number().int().min(1).optional(),
          quantityReceived: z.number().int().min(1, 'Quantity received must be at least 1'),
          unitCost: z.number().min(0).optional(),
        })
      )
      .min(1, 'Receipt must contain at least one line item'),
    idempotencyKey: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const createAdjustmentSchema = z.object({
  body: z.object({
    branchId: z.string().optional(),
    stockLocationId: z.string().min(1, 'Stock location ID is required'),
    items: z
      .array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          newPhysicalQuantity: z.number().int().min(0, 'Physical quantity cannot be negative'),
          adjustmentType: z
            .enum(['PHYSICAL_COUNT', 'ADMINISTRATIVE', 'DAMAGE_WRITE_OFF'])
            .optional()
            .default('PHYSICAL_COUNT'),
          reason: z.string().min(1, 'Adjustment reason is required'),
        })
      )
      .min(1, 'Adjustment must contain at least one item'),
    idempotencyKey: z.string().optional(),
  }),
});

export const createTransferSchema = z.object({
  body: z.object({
    fromBranchId: z.string().optional(),
    toBranchId: z.string().min(1, 'Destination branch ID is required'),
    fromStockLocationId: z.string().min(1, 'Source stock location ID is required'),
    toStockLocationId: z.string().min(1, 'Destination stock location ID is required'),
    items: z
      .array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        })
      )
      .min(1, 'Transfer must contain at least one item'),
    notes: z.string().optional(),
  }),
});

export const transferActionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Transfer ID is required'),
  }),
  body: z
    .object({
      notes: z.string().optional(),
    })
    .optional(),
});

export const movementsQuerySchema = z.object({
  query: z.object({
    branchId: z.string().optional(),
    stockLocationId: z.string().optional(),
    sku: z.string().optional(),
    movementType: z.enum(Object.values(STOCK_MOVEMENT_TYPES) as [string, ...string[]]).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

export const alertsQuerySchema = z.object({
  query: z.object({
    branchId: z.string().optional(),
    status: z.enum(['ALL', 'OUT_OF_STOCK', 'LOW_STOCK']).optional().default('ALL'),
    brandId: z.string().optional(),
    categoryId: z.string().optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

export const skuParamSchema = z.object({
  params: z.object({
    sku: z.string().min(1, 'SKU is required'),
  }),
});

