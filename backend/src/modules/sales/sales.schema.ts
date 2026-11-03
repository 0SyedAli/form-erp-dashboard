import { z } from 'zod';
import { SALE_TYPES, PAYMENT_STATUSES } from '../../constants/index.js';

export const salesQuerySchema = z.object({
  query: z.object({
    branchId: z.string().optional(),
    customerId: z.string().optional(),
    saleType: z.enum([SALE_TYPES.WALK_IN, SALE_TYPES.WHOLESALE, SALE_TYPES.DISTRIBUTOR]).optional(),
    paymentStatus: z
      .enum([PAYMENT_STATUSES.PAID, PAYMENT_STATUSES.PARTIAL, PAYMENT_STATUSES.UNPAID])
      .optional(),
    search: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

export const invoiceParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Invoice ID is required'),
  }),
});

export type SalesQuery = z.infer<typeof salesQuerySchema>['query'];

