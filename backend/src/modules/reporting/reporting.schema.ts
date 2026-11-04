import { z } from 'zod';

export const dateRangePresetEnum = z.enum([
  'today',
  'yesterday',
  'last7days',
  'thisMonth',
  'lastMonth',
  'custom',
  'all',
]);

export const reportQuerySchema = z.object({
  query: z.object({
    preset: dateRangePresetEnum.optional().default('thisMonth'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format').optional(),
    branchId: z.string().optional(),
    supplierId: z.string().optional(),
    customerId: z.string().optional(),
    sku: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    page: z.coerce.number().min(1).optional().default(1),
  }),
});

export type ReportQueryParams = z.infer<typeof reportQuerySchema>['query'];

