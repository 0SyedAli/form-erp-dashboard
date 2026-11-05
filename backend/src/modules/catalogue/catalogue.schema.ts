import { z } from 'zod';

export const brandSchema = z.object({
  body: z.object({
    code: z.string().trim().min(2).max(10).toUpperCase(),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().optional(),
    logoUrl: z.string().trim().optional().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'active', 'inactive']).optional(),
  }),
});

export const updateBrandSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    code: z.string().trim().min(2).max(10).toUpperCase().optional(),
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().optional(),
    logoUrl: z.string().trim().optional().or(z.literal('')),
    status: z.enum(['ACTIVE', 'INACTIVE', 'active', 'inactive']).optional(),
  }),
});

export const categorySchema = z.object({
  body: z.object({
    brandId: z.string({ required_error: 'Brand ID is required' }),
    code: z.string().trim().min(2).max(10).toUpperCase(),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'active', 'inactive']).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    brandId: z.string().optional(),
    code: z.string().trim().min(2).max(10).toUpperCase().optional(),
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'active', 'inactive']).optional(),
  }),
});

export const sizeSchema = z.object({
  body: z.object({
    length: z.coerce.number().positive(),
    width: z.coerce.number().positive(),
    unit: z.string().default('in'),
    displayLabel: z.string().trim().min(3),
  }),
});

export const updateSizeSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    length: z.coerce.number().positive().optional(),
    width: z.coerce.number().positive().optional(),
    unit: z.string().optional(),
    displayLabel: z.string().trim().min(3).optional(),
  }),
});

export const thicknessSchema = z.object({
  body: z.object({
    value: z.coerce.number().positive(),
    unit: z.string().default('in'),
    displayLabel: z.string().trim().min(2),
  }),
});

export const updateThicknessSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    value: z.coerce.number().positive().optional(),
    unit: z.string().optional(),
    displayLabel: z.string().trim().min(2).optional(),
  }),
});

export const createProductWithVariantSchema = z.object({
  body: z.object({
    brandId: z.string({ required_error: 'Brand is required' }),
    categoryId: z.string({ required_error: 'Category is required' }),
    sizeId: z.string({ required_error: 'Size is required' }),
    thicknessId: z.string({ required_error: 'Thickness is required' }),
    // Financials in Rupees
    listPrice: z.coerce.number().min(0, 'List Price must be positive'),
    purchasePercent: z.coerce.number().min(0).max(100).optional(),
    purchasePrice: z.coerce.number().min(0).optional(),
    retailPercent: z.coerce.number().min(0).optional(),
    retailPrice: z.coerce.number().min(0).optional(),
    wholesalePercent: z.coerce.number().min(0).max(100).optional(),
    wholesalePrice: z.coerce.number().min(0).optional(),
    distributorPercent: z.coerce.number().min(0).max(100).optional(),
    distributorPrice: z.coerce.number().min(0).optional(),
    // Initial stock parameters
    stock: z.coerce.number().int().min(0).default(0),
    minimumStock: z.coerce.number().int().min(0).default(5),
    destinationBranchId: z.string().optional(),
  }),
});

export const updateSkuSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    brandId: z.string().optional(),
    categoryId: z.string().optional(),
    sizeId: z.string().optional(),
    thicknessId: z.string().optional(),
    listPrice: z.coerce.number().min(0).optional(),
    purchasePercent: z.coerce.number().min(0).max(100).optional(),
    purchasePrice: z.coerce.number().min(0).optional(),
    retailPercent: z.coerce.number().min(0).optional(),
    retailPrice: z.coerce.number().min(0).optional(),
    wholesalePercent: z.coerce.number().min(0).max(100).optional(),
    wholesalePrice: z.coerce.number().min(0).optional(),
    distributorPercent: z.coerce.number().min(0).max(100).optional(),
    distributorPrice: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().min(0).optional(),
    minimumStock: z.coerce.number().min(0).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'active', 'inactive']).optional(),
    reason: z.string().trim().optional(),
  }),
});

export const updatePricesSchema = updateSkuSchema;

export const statusToggleSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    status: z
      .enum(['ACTIVE', 'INACTIVE', 'active', 'inactive'])
      .transform((val) => val.toUpperCase() as 'ACTIVE' | 'INACTIVE'),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string() }),
});

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ACTIVE'),
    brandId: z.string().optional(),
    categoryId: z.string().optional(),
  }),
});

export type BrandInput = z.infer<typeof brandSchema>['body'];
export type CategoryInput = z.infer<typeof categorySchema>['body'];
export type SizeInput = z.infer<typeof sizeSchema>['body'];
export type ThicknessInput = z.infer<typeof thicknessSchema>['body'];
export type CreateProductWithVariantInput = z.infer<typeof createProductWithVariantSchema>['body'];
export type UpdatePricesInput = z.infer<typeof updatePricesSchema>['body'];
export type UpdateSkuInput = z.infer<typeof updateSkuSchema>['body'];

