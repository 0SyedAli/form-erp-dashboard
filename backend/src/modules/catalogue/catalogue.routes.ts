import { Router } from 'express';
import { CatalogueController } from './catalogue.controller.js';
import { authenticate, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import { requireBranchPermission } from '../../middleware/branchPermission.middleware.js';
import { validateRequest } from '../../middleware/validateRequest.middleware.js';
import {
  brandSchema,
  updateBrandSchema,
  categorySchema,
  updateCategorySchema,
  sizeSchema,
  updateSizeSchema,
  thicknessSchema,
  updateThicknessSchema,
  createProductWithVariantSchema,
  updatePricesSchema,
  statusToggleSchema,
  idParamSchema,
  paginationQuerySchema,
} from './catalogue.schema.js';

export const catalogueRoutes = Router();

// ==========================================
// BRANDS
// ==========================================
catalogueRoutes.get(
  '/brands',
  authenticate,
  requireBranchPermission('viewProducts'),
  CatalogueController.getBrands
);

catalogueRoutes.get(
  '/brands/:id',
  authenticate,
  requireBranchPermission('viewProducts'),
  validateRequest(idParamSchema),
  CatalogueController.getBrandById
);

catalogueRoutes.post(
  '/brands',
  authenticate,
  requireSuperAdmin,
  validateRequest(brandSchema),
  CatalogueController.createBrand
);

catalogueRoutes.patch(
  '/brands/:id',
  authenticate,
  requireSuperAdmin,
  validateRequest(updateBrandSchema),
  CatalogueController.updateBrand
);

catalogueRoutes.patch(
  '/brands/:id/status',
  authenticate,
  requireSuperAdmin,
  validateRequest(statusToggleSchema),
  CatalogueController.toggleBrandStatus
);

// ==========================================
// CATEGORIES
// ==========================================
catalogueRoutes.get(
  '/categories',
  authenticate,
  requireBranchPermission('viewProducts'),
  CatalogueController.getCategories
);

catalogueRoutes.get(
  '/categories/:id',
  authenticate,
  requireBranchPermission('viewProducts'),
  validateRequest(idParamSchema),
  CatalogueController.getCategoryById
);

catalogueRoutes.post(
  '/categories',
  authenticate,
  requireSuperAdmin,
  validateRequest(categorySchema),
  CatalogueController.createCategory
);

catalogueRoutes.patch(
  '/categories/:id',
  authenticate,
  requireSuperAdmin,
  validateRequest(updateCategorySchema),
  CatalogueController.updateCategory
);

catalogueRoutes.patch(
  '/categories/:id/status',
  authenticate,
  requireSuperAdmin,
  validateRequest(statusToggleSchema),
  CatalogueController.toggleCategoryStatus
);

// ==========================================
// SIZES
// ==========================================
catalogueRoutes.get(
  '/sizes',
  authenticate,
  requireBranchPermission('viewProducts'),
  CatalogueController.getSizes
);

catalogueRoutes.post(
  '/sizes',
  authenticate,
  requireSuperAdmin,
  validateRequest(sizeSchema),
  CatalogueController.createSize
);

catalogueRoutes.patch(
  '/sizes/:id',
  authenticate,
  requireSuperAdmin,
  validateRequest(updateSizeSchema),
  CatalogueController.updateSize
);

catalogueRoutes.patch(
  '/sizes/:id/status',
  authenticate,
  requireSuperAdmin,
  validateRequest(statusToggleSchema),
  CatalogueController.toggleSizeStatus
);

// ==========================================
// THICKNESSES
// ==========================================
catalogueRoutes.get(
  '/thicknesses',
  authenticate,
  requireBranchPermission('viewProducts'),
  CatalogueController.getThicknesses
);

catalogueRoutes.post(
  '/thicknesses',
  authenticate,
  requireSuperAdmin,
  validateRequest(thicknessSchema),
  CatalogueController.createThickness
);

catalogueRoutes.patch(
  '/thicknesses/:id',
  authenticate,
  requireSuperAdmin,
  validateRequest(updateThicknessSchema),
  CatalogueController.updateThickness
);

catalogueRoutes.patch(
  '/thicknesses/:id/status',
  authenticate,
  requireSuperAdmin,
  validateRequest(statusToggleSchema),
  CatalogueController.toggleThicknessStatus
);

// ==========================================
// PRODUCTS & VARIANTS
// ==========================================
catalogueRoutes.get(
  '/products',
  authenticate,
  requireBranchPermission('viewProducts'),
  validateRequest(paginationQuerySchema),
  CatalogueController.getProducts
);

catalogueRoutes.get(
  '/products/:id',
  authenticate,
  requireBranchPermission('viewProducts'),
  validateRequest(idParamSchema),
  CatalogueController.getProductById
);

// Simplified Product Creation Endpoint
catalogueRoutes.post(
  '/products',
  authenticate,
  requireBranchPermission('addEditProducts'),
  validateRequest(createProductWithVariantSchema),
  CatalogueController.createProductWithVariant
);

catalogueRoutes.get(
  '/products/:id/skus',
  authenticate,
  requireBranchPermission('viewProducts'),
  validateRequest(idParamSchema),
  CatalogueController.getSkus
);

// ==========================================
// SKUs & PRICING
// ==========================================
catalogueRoutes.get(
  '/skus',
  authenticate,
  requireBranchPermission('viewProducts'),
  CatalogueController.getSkus
);

catalogueRoutes.get(
  '/skus/:id',
  authenticate,
  requireBranchPermission('viewProducts'),
  validateRequest(idParamSchema),
  CatalogueController.getSkuById
);

catalogueRoutes.patch(
  '/skus/:id/status',
  authenticate,
  requireSuperAdmin,
  validateRequest(statusToggleSchema),
  CatalogueController.toggleSkuStatus
);

catalogueRoutes.get(
  '/skus/:id/prices',
  authenticate,
  requireSuperAdmin,
  validateRequest(idParamSchema),
  CatalogueController.getSkuPriceHistory
);

catalogueRoutes.patch(
  '/skus/:id/prices',
  authenticate,
  requireSuperAdmin,
  validateRequest(updatePricesSchema),
  CatalogueController.updateSkuPrices
);

// ==========================================
// BRANCHES (read-only for all authenticated accounts)
// ==========================================
catalogueRoutes.get(
  '/branches',
  authenticate,
  CatalogueController.getBranches
);


