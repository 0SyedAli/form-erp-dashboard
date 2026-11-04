import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Supplier name must be at least 2 characters'),
    contactPerson: z.string().optional(),
    phone: z.string().min(7, 'Valid phone number is required'),
    whatsapp: z.string().optional(),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional().default('Karachi'),
    ntn: z.string().optional(),
    suppliedBrands: z.array(z.string()).optional().default([]),
    creditEnabled: z.boolean().optional().default(true),
    defaultCreditDays: z.number().min(0).optional().default(30),
    paymentTerms: z.string().optional().default('Net 30 Days'),
    creditLimit: z.number().min(0).optional().default(1000000),
    openingPayable: z.number().min(0).optional().default(0),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).optional(),
    contactPerson: z.string().optional(),
    phone: z.string().min(7).optional(),
    whatsapp: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
    ntn: z.string().optional(),
    suppliedBrands: z.array(z.string()).optional(),
    creditEnabled: z.boolean().optional(),
    defaultCreditDays: z.number().min(0).optional(),
    paymentTerms: z.string().optional(),
    creditLimit: z.number().min(0).optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    notes: z.string().optional(),
  }),
});

export const updateSupplierStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
  }),
});

export const supplierQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    city: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  }),
});

export const supplierParamSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Supplier ID is required'),
  }),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>['body'];
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>['body'];
export type SupplierQuery = z.infer<typeof supplierQuerySchema>['query'];

