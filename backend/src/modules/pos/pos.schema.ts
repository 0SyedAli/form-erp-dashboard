import { z } from 'zod';
import { SALE_TYPES, PAYMENT_ARRANGEMENTS } from '../../constants/index.js';

export const checkoutItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0).optional(), // Client preview only, backend authoritative price used
  discount: z.number().min(0).optional().default(0),
});

export const checkoutSchema = z.object({
  body: z.object({
    branchId: z.string().optional(), // Super Admin only; for Branch, server session branchId is always enforced
    stockLocationId: z.string().optional(), // Defaults to branch default stockroom
    customerId: z.string().optional(),
    customerName: z.string().optional().default('Walk-in Customer'),
    customerPhone: z.string().optional(),
    customerType: z.string().optional(),
    saleType: z.enum([SALE_TYPES.WALK_IN, SALE_TYPES.WHOLESALE, SALE_TYPES.DISTRIBUTOR]),
    paymentArrangement: z.enum([
      PAYMENT_ARRANGEMENTS.FULL,
      PAYMENT_ARRANGEMENTS.PARTIAL,
      PAYMENT_ARRANGEMENTS.CREDIT,
    ]),
    paymentMethod: z
      .enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'CREDIT_30D'])
      .default('CASH'),
    items: z.array(checkoutItemSchema).min(1, 'At least one item is required for checkout'),
    discountAmount: z.number().min(0).optional().default(0),
    amountReceived: z.number().min(0).optional().default(0),
    cashReceived: z.number().min(0).optional().default(0),
    dueDate: z.string().or(z.date()).optional(),
    creditOverride: z.boolean().optional().default(false),
    creditApprovedBy: z.string().optional(),
    overrideReason: z.string().optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }),
});

export const heldSaleSchema = z.object({
  body: z.object({
    customerId: z.string().optional(),
    customerName: z.string().optional().default('Walk-in Customer'),
    customerPhone: z.string().optional(),
    saleType: z
      .enum([SALE_TYPES.WALK_IN, SALE_TYPES.WHOLESALE, SALE_TYPES.DISTRIBUTOR])
      .optional()
      .default(SALE_TYPES.WALK_IN),
    paymentArrangement: z
      .enum([PAYMENT_ARRANGEMENTS.FULL, PAYMENT_ARRANGEMENTS.PARTIAL, PAYMENT_ARRANGEMENTS.CREDIT])
      .optional()
      .default(PAYMENT_ARRANGEMENTS.FULL),
    items: z.array(
      z.object({
        sku: z.string().min(1),
        productId: z.string().optional(),
        productName: z.string(),
        sizeLabel: z.string().optional(),
        thicknessLabel: z.string().optional(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().min(0),
        lineTotal: z.number().min(0),
      })
    ).min(1, 'Cart must contain at least one item'),
    subtotal: z.number().min(0),
    discountAmount: z.number().min(0).optional().default(0),
    taxAmount: z.number().min(0).optional().default(0),
    grandTotal: z.number().min(0),
    notes: z.string().optional(),
  }),
});

export const heldSaleParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Held sale ID is required'),
  }),
});

export const availabilityParamSchema = z.object({
  params: z.object({
    skuId: z.string().min(1, 'SKU ID or SKU code is required'),
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>['body'];
export type HeldSaleInput = z.infer<typeof heldSaleSchema>['body'];
