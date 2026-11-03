import { z } from 'zod';
import { CUSTOMER_TYPES } from '../../constants/index.js';

export const customerQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    customerType: z
      .enum([CUSTOMER_TYPES.WALK_IN, CUSTOMER_TYPES.WHOLESALE, CUSTOMER_TYPES.DISTRIBUTOR])
      .optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  }),
});

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Customer name must be at least 2 characters'),
    phone: z.string().min(7, 'Valid phone number required'),
    customerType: z
      .enum([CUSTOMER_TYPES.WALK_IN, CUSTOMER_TYPES.WHOLESALE, CUSTOMER_TYPES.DISTRIBUTOR])
      .default(CUSTOMER_TYPES.WALK_IN),
    businessName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional().default('Karachi'),
    taxNumber: z.string().optional(),
    creditEnabled: z.boolean().optional().default(false),
    creditLimit: z.number().min(0).optional().default(0),
    creditTerms: z.string().optional().default('Net 30'),
    defaultDueDays: z.number().min(0).optional().default(30),
    notes: z.string().optional(),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(7).optional(),
    customerType: z
      .enum([CUSTOMER_TYPES.WALK_IN, CUSTOMER_TYPES.WHOLESALE, CUSTOMER_TYPES.DISTRIBUTOR])
      .optional(),
    businessName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
    taxNumber: z.string().optional(),
    creditEnabled: z.boolean().optional(),
    creditLimit: z.number().min(0).optional(),
    creditTerms: z.string().optional(),
    defaultDueDays: z.number().min(0).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
    notes: z.string().optional(),
  }),
});

export const customerParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Customer ID is required'),
  }),
});

export type CustomerQuery = z.infer<typeof customerQuerySchema>['query'];
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>['body'];

