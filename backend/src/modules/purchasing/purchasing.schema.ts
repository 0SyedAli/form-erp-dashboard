import { z } from 'zod';

export const poItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: z.number().min(0, 'Unit cost must be non-negative'),
  lineDiscount: z.number().min(0).optional().default(0),
  taxAmount: z.number().min(0).optional().default(0),
});

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    branchId: z.string().optional(),
    stockLocationId: z.string().optional(),
    expectedDeliveryDate: z.string().or(z.date()).optional(),
    paymentTerms: z.string().optional().default('Net 30 Days'),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(poItemSchema).min(1, 'Order must contain at least one line item'),
  }),
});

export const updatePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    supplierId: z.string().optional(),
    stockLocationId: z.string().optional(),
    expectedDeliveryDate: z.string().or(z.date()).optional(),
    paymentTerms: z.string().optional(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(poItemSchema).optional(),
  }),
});

export const receiveOrderSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Order ID is required'),
  }),
  body: z.object({
    deliveryReference: z.string().min(1, 'Delivery reference / challan number is required'),
    stockLocationId: z.string().optional(),
    notes: z.string().optional(),
    items: z
      .array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          quantityReceived: z.number().int().min(0, 'Received quantity must be non-negative'),
          damagedQuantity: z.number().int().min(0).optional().default(0),
        })
      )
      .min(1, 'At least one item must be received'),
  }),
});

export const createSupplierBillSchema = z.object({
  body: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    supplierInvoiceNumber: z.string().min(1, 'Supplier invoice reference is required'),
    branchId: z.string().optional(),
    purchaseOrderId: z.string().optional(),
    grnIds: z.array(z.string()).optional(),
    billDate: z.string().or(z.date()).optional(),
    dueDate: z.string().or(z.date()),
    notes: z.string().optional(),
    items: z
      .array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1'),
          unitCost: z.number().min(0, 'Unit cost must be non-negative'),
          discount: z.number().min(0).optional().default(0),
          tax: z.number().min(0).optional().default(0),
        })
      )
      .min(1, 'Bill must contain at least one item'),
  }),
});

export const createSupplierPaymentSchema = z.object({
  body: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    branchId: z.string().optional(),
    amount: z.number().min(1, 'Payment amount must be at least 1'),
    paymentMethod: z
      .enum(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'PAYPAK_CARD'])
      .default('BANK_TRANSFER'),
    reference: z.string().optional(),
    notes: z.string().optional(),
    chequeDate: z.string().or(z.date()).optional(),
    allocations: z
      .array(
        z.object({
          billId: z.string().min(1, 'Bill ID is required'),
          allocatedAmount: z.number().min(1, 'Allocated amount must be at least 1'),
        })
      )
      .optional(), // If omitted, oldest-due-first auto-allocation is applied
    idempotencyKey: z.string().optional(),
  }),
});

export const createPurchaseReturnSchema = z.object({
  body: z.object({
    supplierId: z.string().min(1, 'Supplier ID is required'),
    branchId: z.string().optional(),
    stockLocationId: z.string().optional(),
    purchaseOrderId: z.string().optional(),
    billId: z.string().optional(),
    receiptId: z.string().optional(),
    reason: z.string().min(3, 'Return reason must be at least 3 characters'),
    notes: z.string().optional(),
    items: z
      .array(
        z.object({
          sku: z.string().min(1, 'SKU is required'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1'),
          unitCost: z.number().min(0).optional(),
          reason: z.string().optional(),
        })
      )
      .min(1, 'Return must contain at least one line item'),
  }),
});

export const poQuerySchema = z.object({
  query: z.object({
    branchId: z.string().optional(),
    supplierId: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

export const idParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID is required'),
  }),
});

export type CreatePOInput = z.infer<typeof createPurchaseOrderSchema>['body'];
export type UpdatePOInput = z.infer<typeof updatePurchaseOrderSchema>['body'];
export type ReceiveOrderInput = z.infer<typeof receiveOrderSchema>['body'];
export type CreateSupplierBillInput = z.infer<typeof createSupplierBillSchema>['body'];
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>['body'];
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>['body'];
export type POQuery = z.infer<typeof poQuerySchema>['query'];
