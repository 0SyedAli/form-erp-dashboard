import { Request, Response } from 'express';
import { CatalogueService } from './catalogue.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export class CatalogueController {
  // BRANDS
  public static async getBrands(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.getBrands({
        search: req.query.search as string,
        status: req.query.status as string,
      });
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch brands.', (error as any).statusCode || 500);
    }
  }

  public static async getBrandById(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.getBrandById(id);
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Brand not found.', (error as any).statusCode || 404);
    }
  }

  public static async createBrand(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.createBrand(req.body);
      sendSuccess(res, data, 'Brand created successfully.', 201);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to create brand.', (error as any).statusCode || 500, (error as any).code);
    }
  }

  public static async updateBrand(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.updateBrand(id, req.body);
      sendSuccess(res, data, 'Brand updated successfully.');
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to update brand.', (error as any).statusCode || 500, (error as any).code);
    }
  }

  public static async toggleBrandStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.toggleBrandStatus(id, req.body.status);
      sendSuccess(res, data, `Brand marked as ${req.body.status}.`);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to toggle brand status.', (error as any).statusCode || 500);
    }
  }

  // CATEGORIES
  public static async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.getCategories({
        brandId: req.query.brandId as string,
        search: req.query.search as string,
        status: req.query.status as string,
      });
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch categories.', (error as any).statusCode || 500);
    }
  }

  public static async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.getCategoryById(id);
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Category not found.', (error as any).statusCode || 404);
    }
  }

  public static async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.createCategory(req.body);
      sendSuccess(res, data, 'Category created successfully.', 201);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to create category.', (error as any).statusCode || 500, (error as any).code);
    }
  }

  public static async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.updateCategory(id, req.body);
      sendSuccess(res, data, 'Category updated successfully.');
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to update category.', (error as any).statusCode || 500, (error as any).code);
    }
  }

  public static async toggleCategoryStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.toggleCategoryStatus(id, req.body.status);
      sendSuccess(res, data, `Category marked as ${req.body.status}.`);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to toggle category status.', (error as any).statusCode || 500);
    }
  }

  // SIZES
  public static async getSizes(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.getSizes({
        status: req.query.status as string,
      });
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch sizes.', (error as any).statusCode || 500);
    }
  }

  public static async createSize(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.createSize(req.body);
      sendSuccess(res, data, 'Size added successfully.', 201);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to add size.', (error as any).statusCode || 500, (error as any).code);
    }
  }

  public static async updateSize(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.updateSize(id, req.body);
      sendSuccess(res, data, 'Size updated successfully.');
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to update size.', (error as any).statusCode || 500);
    }
  }

  public static async toggleSizeStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.toggleSizeStatus(id, req.body.status);
      sendSuccess(res, data, `Size marked as ${req.body.status}.`);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to toggle size status.', (error as any).statusCode || 500);
    }
  }

  // THICKNESSES
  public static async getThicknesses(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.getThicknesses({
        status: req.query.status as string,
      });
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch thicknesses.', (error as any).statusCode || 500);
    }
  }

  public static async createThickness(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.createThickness(req.body);
      sendSuccess(res, data, 'Thickness added successfully.', 201);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to add thickness.', (error as any).statusCode || 500, (error as any).code);
    }
  }

  public static async updateThickness(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.updateThickness(id, req.body);
      sendSuccess(res, data, 'Thickness updated successfully.');
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to update thickness.', (error as any).statusCode || 500);
    }
  }

  public static async toggleThicknessStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.toggleThicknessStatus(id, req.body.status);
      sendSuccess(res, data, `Thickness marked as ${req.body.status}.`);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to toggle thickness status.', (error as any).statusCode || 500);
    }
  }

  // PRODUCTS
  public static async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const data = await CatalogueService.getProducts({
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        search: req.query.search as string,
        brandId: req.query.brandId as string,
        categoryId: req.query.categoryId as string,
        status: req.query.status as string,
      });
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch products.', (error as any).statusCode || 500);
    }
  }

  public static async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.getProductById(id);
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Product not found.', (error as any).statusCode || 404);
    }
  }

  public static async createProductWithVariant(req: Request, res: Response): Promise<void> {
    try {
      const accountId = req.account?._id.toString();
      const branchId = req.account?.branchId?.toString();
      const result = await CatalogueService.createProductWithVariant(req.body, accountId, branchId);
      sendSuccess(res, result, 'Product and SKU variant created successfully.', 201);
    } catch (error) {
      sendError(
        res,
        (error as any).message || 'Failed to create product variant.',
        (error as any).statusCode || 500,
        (error as any).code
      );
    }
  }

  // SKUS & PRICING
  public static async getSkus(req: Request, res: Response): Promise<void> {
    try {
      const isSuperAdmin = req.account?.role === 'SUPER_ADMIN';
      const data = await CatalogueService.getSkus(
        {
          search: req.query.search as string,
          productId: req.query.productId as string,
          status: req.query.status as string,
        },
        isSuperAdmin
      );
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch SKUs.', (error as any).statusCode || 500);
    }
  }

  public static async getSkuById(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const isSuperAdmin = req.account?.role === 'SUPER_ADMIN';
      const canViewCost =
        isSuperAdmin ||
        Boolean((req.account?.permissions as any)?.viewCostPrice) ||
        Boolean((req.account?.permissions as any)?.addEditProducts);
      const data = await CatalogueService.getSkuById(id, canViewCost);
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'SKU not found.', (error as any).statusCode || 404);
    }
  }

  public static async updateSkuPrices(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const accountId = req.account?._id.toString();
      const data = await CatalogueService.updateSkuPrices(id, req.body, accountId);
      sendSuccess(res, data, 'SKU prices updated successfully.');
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to update SKU prices.', (error as any).statusCode || 500);
    }
  }

  public static async getSkuPriceHistory(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.getSkuPriceHistory(id);
      sendSuccess(res, data);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to retrieve price history.', (error as any).statusCode || 500);
    }
  }

  public static async toggleSkuStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await CatalogueService.toggleSkuStatus(id, req.body.status);
      sendSuccess(res, data, `SKU marked as ${req.body.status}.`);
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to toggle SKU status.', (error as any).statusCode || 500);
    }
  }

  public static async getBranches(_req: Request, res: Response): Promise<void> {
    try {
      const branches = await CatalogueService.getBranches();
      sendSuccess(res, branches, 'Branches retrieved successfully.');
    } catch (error) {
      sendError(res, (error as any).message || 'Failed to fetch branches.', (error as any).statusCode || 500);
    }
  }
}

