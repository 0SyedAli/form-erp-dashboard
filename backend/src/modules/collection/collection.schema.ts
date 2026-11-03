import { z } from 'zod';

export const createCollectionSchema = z.object({
  body: z.object({
    customerId: z.string().min(1, 'Customer ID is required'),
    branchId: z.string().optional(),
    amount: z.number().min(1, 'Collection amount must be at least 1'),
    paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE']).default('CASH'),
    reference: z.string().optional(),
    notes: z.string().optional(),
    allocations: z
      .array(
        z.object({
          invoiceId: z.string().min(1),
          allocatedAmount: z.number().min(1),
        })
      )
      .optional(), // If omitted, oldest-first auto-allocation is applied
    idempotencyKey: z.string().optional(),
  }),
});

export const collectionQuerySchema = z.object({
  query: z.object({
    branchId: z.string().optional(),
    customerId: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

export const collectionParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Collection ID is required'),
  }),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>['body'];
export type CollectionQuery = z.infer<typeof collectionQuerySchema>['query'];

