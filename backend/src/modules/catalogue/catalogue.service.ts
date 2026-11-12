import mongoose from 'mongoose';
import {
  Brand,
  Category,
  Size,
  Thickness,
  Product,
  Variant,
  PriceHistory,
  StockLocation,
  StockBalance,
  StockMovement,
  Branch,
  IBrand,
  ICategory,
  ISize,
  IThickness,
  IVariant,
} from '../../models/index.js';
import { AppError } from '../../utils/apiResponse.js';
import {
  toPaisa,
  toRupees,
  calculatePurchasePrice,
  calculateRetailPrice,
  calculateWholesalePrice,
  calculateDistributorPrice,
  calculateDiscountPercent,
  calculateMarkupPercent,
  validatePriceReconciliation,
} from '../../utils/financial.js';
import {
  BrandInput,
  CategoryInput,
  SizeInput,
  ThicknessInput,
  CreateProductWithVariantInput,
  UpdatePricesInput,
  UpdateSkuInput,
} from './catalogue.schema.js';

export function generateSkuCode(
  brandCode: string,
  categoryCode: string,
  sizeDisplayLabel: string,
  thicknessValue: number
): string {
  const bCode = brandCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
  const cCode = categoryCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
  const sLabel = sizeDisplayLabel
    .replace(/[\s×xX]/g, 'X')
    .replace(/[^0-9X]/g, '')
    .toUpperCase();
  const tVal = String(thicknessValue).replace(/[^0-9]/g, '');
  return `${bCode}-${cCode}-${sLabel}-${tVal}`;
}

export class CatalogueService {
  // ==========================================
  // BRANDS
  // ==========================================

  public static async getBrands(query: { search?: string; status?: string; branchId?: string } = {}) {
    const filter: any = {};
    if (query?.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query?.branchId && query.branchId !== 'ALL' && mongoose.Types.ObjectId.isValid(query.branchId)) {
      filter.$or = [
        { branchId: new mongoose.Types.ObjectId(query.branchId) },
        { branchId: { $exists: false } },
        { branchId: null },
      ];
    }
    if (query?.search) {
      const searchOr = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }
    return Brand.find(filter).sort({ name: 1 });
  }

  public static async getBrandById(id: string): Promise<IBrand> {
    let brand: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      brand = await Brand.findById(id);
    }
    if (!brand) {
      const cleanCode = id.replace(/^BRAND-/i, '').replace(/-\d+$/, '').toUpperCase();
      brand = await Brand.findOne({
        $or: [
          { code: id.toUpperCase() },
          { code: cleanCode },
          { code: { $regex: new RegExp(`^${cleanCode}`, 'i') } },
        ],
      });
    }
    if (!brand) throw new AppError(`Brand '${id}' not found.`, 404, 'BRAND_NOT_FOUND');
    return brand;
  }

  public static async createBrand(input: BrandInput): Promise<IBrand> {
    const code = input.code.trim().toUpperCase();
    const existing = await Brand.findOne({ code });
    const targetStatus = (input as any).status ? (input as any).status.toUpperCase() : 'ACTIVE';
    if (existing) {
      if (input.name) existing.name = input.name.trim();
      if (input.description !== undefined) existing.description = input.description?.trim();
      if (input.logoUrl !== undefined) existing.logoUrl = input.logoUrl;
      existing.status = targetStatus;
      return existing.save();
    }
    return Brand.create({
      code,
      name: input.name.trim(),
      description: input.description?.trim(),
      logoUrl: input.logoUrl,
      status: targetStatus,
    });
  }

  public static async updateBrand(id: string, input: Partial<BrandInput>): Promise<IBrand> {
    const brand = await this.getBrandById(id);
    if (input.code && input.code.toUpperCase() !== brand.code) {
      const existing = await Brand.findOne({ code: input.code.toUpperCase(), _id: { $ne: brand._id } });
      if (existing) throw new AppError(`Brand code '${input.code}' already exists.`, 409, 'DUPLICATE_BRAND_CODE');
      brand.code = input.code.toUpperCase();
    }
    if (input.name) brand.name = input.name.trim();
    if (input.description !== undefined) brand.description = input.description.trim();
    if (input.logoUrl !== undefined) brand.logoUrl = input.logoUrl;
    if ((input as any).status) brand.status = (input as any).status.toUpperCase();
    return brand.save();
  }

  public static async toggleBrandStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<IBrand> {
    const brand = await this.getBrandById(id);
    brand.status = status;
    return brand.save();
  }

  public static async deleteBrand(id: string): Promise<{ deleted: boolean; message: string }> {
    const brand = await this.getBrandById(id);
    const brandId = brand._id;

    // Find all categories for this brand
    const categories = await Category.find({ brandId });
    const categoryIds = categories.map((c) => c._id);

    // Find all products for this brand
    const products = await Product.find({ $or: [{ brandId }, { categoryId: { $in: categoryIds } }] });
    const productIds = products.map((p) => p._id);

    // Find all variants for these products
    const variants = await Variant.find({ productId: { $in: productIds } });
    const variantIds = variants.map((v) => v._id);
    const skus = variants.map((v) => v.sku);

    // Delete stock balances and price histories for these variants
    await StockBalance.deleteMany({ $or: [{ variantId: { $in: variantIds } }, { sku: { $in: skus } }] });
    await PriceHistory.deleteMany({ variantId: { $in: variantIds } });

    // Delete variants
    await Variant.deleteMany({ _id: { $in: variantIds } });

    // Delete products
    await Product.deleteMany({ _id: { $in: productIds } });

    // Delete categories
    await Category.deleteMany({ _id: { $in: categoryIds } });

    // Delete brand
    await Brand.findByIdAndDelete(brandId);

    return { deleted: true, message: `Brand '${brand.name}' removed successfully.` };
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  public static async getCategories(query: { brandId?: string; search?: string; status?: string; branchId?: string } = {}) {
    const filter: any = {};
    if (query?.brandId) {
      filter.brandId = query.brandId;
    }
    if (query?.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query?.branchId && query.branchId !== 'ALL' && mongoose.Types.ObjectId.isValid(query.branchId)) {
      filter.$or = [
        { branchId: new mongoose.Types.ObjectId(query.branchId) },
        { branchId: { $exists: false } },
        { branchId: null },
      ];
    }
    if (query?.search) {
      const searchOr = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }
    return Category.find(filter).populate('brandId', 'name code').sort({ name: 1 });
  }

  public static async getCategoryById(id: string): Promise<ICategory> {
    let category: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id).populate('brandId', 'name code');
    }
    if (!category) {
      const cleanCode = id.replace(/^CAT-/i, '').replace(/-\d+$/, '').toUpperCase();
      category = await Category.findOne({
        $or: [
          { code: id.toUpperCase() },
          { code: cleanCode },
          { code: { $regex: new RegExp(`^${cleanCode}`, 'i') } },
          { name: id },
        ],
      }).populate('brandId', 'name code');
    }
    if (!category) throw new AppError(`Category '${id}' not found.`, 404, 'CATEGORY_NOT_FOUND');
    return category;
  }

  public static async createCategory(input: CategoryInput): Promise<ICategory> {
    const brand = await Brand.findById(input.brandId);
    if (!brand) throw new AppError(`Brand '${input.brandId}' does not exist.`, 404, 'BRAND_NOT_FOUND');

    const existing = await Category.findOne({
      brandId: brand._id,
      code: input.code.toUpperCase(),
    });
    if (existing) {
      throw new AppError(
        `Category code '${input.code}' already exists under brand '${brand.name}'.`,
        409,
        'DUPLICATE_CATEGORY_CODE'
      );
    }

    return Category.create({
      brandId: brand._id,
      code: input.code.toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim(),
      status: 'ACTIVE',
    });
  }

  public static async updateCategory(id: string, input: Partial<CategoryInput>): Promise<ICategory> {
    const category = await this.getCategoryById(id);
    if (input.code && input.code.toUpperCase() !== category.code) {
      const existing = await Category.findOne({
        brandId: category.brandId,
        code: input.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existing) throw new AppError(`Category code '${input.code}' already exists.`, 409, 'DUPLICATE_CATEGORY_CODE');
      category.code = input.code.toUpperCase();
    }
    if (input.name) category.name = input.name.trim();
    if (input.description !== undefined) category.description = input.description.trim();
    if ((input as any).status) category.status = (input as any).status.toUpperCase();
    return category.save();
  }

  public static async toggleCategoryStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<ICategory> {
    const category = await this.getCategoryById(id);
    category.status = status;
    return category.save();
  }

  public static async deleteCategory(id: string): Promise<{ deleted: boolean; message: string }> {
    const category = await this.getCategoryById(id);
    const categoryId = category._id;

    // Find products for this category
    const products = await Product.find({ categoryId });
    const productIds = products.map((p) => p._id);

    const variants = await Variant.find({ productId: { $in: productIds } });
    const variantIds = variants.map((v) => v._id);
    const skus = variants.map((v) => v.sku);

    await StockBalance.deleteMany({ $or: [{ variantId: { $in: variantIds } }, { sku: { $in: skus } }] });
    await PriceHistory.deleteMany({ variantId: { $in: variantIds } });
    await Variant.deleteMany({ _id: { $in: variantIds } });
    await Product.deleteMany({ _id: { $in: productIds } });
    await Category.findByIdAndDelete(categoryId);

    return { deleted: true, message: `Category '${category.name}' removed successfully.` };
  }

  // ==========================================
  // SIZES
  // ==========================================

  public static async getSizes(query: { status?: string }) {
    const filter: any = {};
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    return Size.find(filter).sort({ length: 1, width: 1 });
  }

  public static async createSize(input: SizeInput): Promise<ISize> {
    const existing = await Size.findOne({
      length: input.length,
      width: input.width,
      unit: input.unit || 'in',
    });
    const targetStatus = (input as any).status ? (input as any).status.toUpperCase() : 'ACTIVE';
    if (existing) {
      if (input.displayLabel) existing.displayLabel = input.displayLabel.trim();
      existing.status = targetStatus;
      return existing.save();
    }
    return Size.create({
      length: input.length,
      width: input.width,
      unit: input.unit || 'in',
      displayLabel: input.displayLabel.trim(),
      status: targetStatus,
    });
  }

  public static async getSizeById(id: string): Promise<ISize> {
    let size: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      size = await Size.findById(id);
    }
    if (!size) {
      size = await Size.findOne({
        $or: [{ displayLabel: id }, { displayLabel: { $regex: new RegExp(`^${id}`, 'i') } }],
      });
    }
    if (!size) throw new AppError(`Size '${id}' not found.`, 404, 'SIZE_NOT_FOUND');
    return size;
  }

  public static async updateSize(id: string, input: Partial<SizeInput>): Promise<ISize> {
    const size = await this.getSizeById(id);
    if (input.displayLabel) size.displayLabel = input.displayLabel.trim();
    if (input.length) size.length = input.length;
    if (input.width) size.width = input.width;
    if (input.unit) size.unit = input.unit;
    if ((input as any).status) size.status = (input as any).status.toUpperCase();
    return size.save();
  }

  public static async toggleSizeStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<ISize> {
    const size = await this.getSizeById(id);
    size.status = status;
    return size.save();
  }

  public static async deleteSize(id: string): Promise<{ deleted: boolean; message: string }> {
    const size = await this.getSizeById(id);
    const sizeId = size._id;

    const variants = await Variant.find({ sizeId });
    const variantIds = variants.map((v) => v._id);
    const skus = variants.map((v) => v.sku);

    await StockBalance.deleteMany({ $or: [{ variantId: { $in: variantIds } }, { sku: { $in: skus } }] });
    await PriceHistory.deleteMany({ variantId: { $in: variantIds } });
    await Variant.deleteMany({ _id: { $in: variantIds } });
    await Size.findByIdAndDelete(sizeId);

    return { deleted: true, message: `Size '${size.displayLabel}' removed successfully.` };
  }

  // ==========================================
  // THICKNESSES
  // ==========================================

  public static async getThicknesses(query: { status?: string }) {
    const filter: any = {};
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    return Thickness.find(filter).sort({ value: 1 });
  }

  public static async getThicknessById(id: string): Promise<IThickness> {
    let thickness: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      thickness = await Thickness.findById(id);
    }
    if (!thickness) {
      thickness = await Thickness.findOne({
        $or: [{ displayLabel: id }, { value: isNaN(Number(id)) ? -1 : Number(id) }],
      });
    }
    if (!thickness) throw new AppError(`Thickness '${id}' not found.`, 404, 'THICKNESS_NOT_FOUND');
    return thickness;
  }

  public static async createThickness(input: ThicknessInput): Promise<IThickness> {
    const existing = await Thickness.findOne({ value: input.value });
    const targetStatus = (input as any).status ? (input as any).status.toUpperCase() : 'ACTIVE';
    if (existing) {
      if (input.displayLabel) existing.displayLabel = input.displayLabel.trim();
      existing.status = targetStatus;
      return existing.save();
    }
    return Thickness.create({
      value: input.value,
      unit: input.unit || 'in',
      displayLabel: input.displayLabel.trim(),
      status: targetStatus,
    });
  }

  public static async updateThickness(id: string, input: Partial<ThicknessInput>): Promise<IThickness> {
    const thickness = await this.getThicknessById(id);
    if (input.displayLabel) thickness.displayLabel = input.displayLabel.trim();
    if (input.value) thickness.value = input.value;
    if (input.unit) thickness.unit = input.unit;
    if ((input as any).status) thickness.status = (input as any).status.toUpperCase();
    return thickness.save();
  }

  public static async toggleThicknessStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<IThickness> {
    const thickness = await this.getThicknessById(id);
    thickness.status = status;
    return thickness.save();
  }

  public static async deleteThickness(id: string): Promise<{ deleted: boolean; message: string }> {
    const thickness = await this.getThicknessById(id);
    const thicknessId = thickness._id;

    const variants = await Variant.find({ thicknessId });
    const variantIds = variants.map((v) => v._id);
    const skus = variants.map((v) => v.sku);

    await StockBalance.deleteMany({ $or: [{ variantId: { $in: variantIds } }, { sku: { $in: skus } }] });
    await PriceHistory.deleteMany({ variantId: { $in: variantIds } });
    await Variant.deleteMany({ _id: { $in: variantIds } });
    await Thickness.findByIdAndDelete(thicknessId);

    return { deleted: true, message: `Thickness '${thickness.displayLabel}' removed successfully.` };
  }

  // ==========================================
  // PRODUCTS & SIMPLIFIED PRODUCT CREATION
  // ==========================================

  public static async getProducts(query: {
    page?: number;
    limit?: number;
    search?: string;
    brandId?: string;
    categoryId?: string;
    status?: string;
    branchId?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query.brandId) {
      filter.brandId = query.brandId;
    }
    if (query.categoryId) {
      filter.categoryId = query.categoryId;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }
    if (query.branchId) {
      const branchStock = await StockBalance.find({ branchId: query.branchId }).select('variantId');
      const stockedVariantIds = branchStock.map((s) => s.variantId).filter(Boolean);
      const stockedVariants = await Variant.find({ _id: { $in: stockedVariantIds } }).select('productId');
      const stockedProdIds = stockedVariants.map((v) => v.productId).filter(Boolean);
      filter.$or = [
        { branchId: query.branchId },
        { _id: { $in: stockedProdIds } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('brandId', 'name code logoUrl')
        .populate('categoryId', 'name code')
        .populate('branchId', 'name code shopNumber city')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    // Populate variants for each product
    const productIds = products.map((p) => p._id);
    const variants = await Variant.find({ productId: { $in: productIds } })
      .populate('sizeId', 'length width displayLabel')
      .populate('thicknessId', 'value displayLabel')
      .sort({ sku: 1 });

    const variantsByProduct = new Map<string, any[]>();
    for (const v of variants) {
      const pId = v.productId.toString();
      const sId = (v.sizeId as any)?._id ? (v.sizeId as any)._id.toString() : v.sizeId?.toString();
      const tId = (v.thicknessId as any)?._id ? (v.thicknessId as any)._id.toString() : v.thicknessId?.toString();

      if (!variantsByProduct.has(pId)) variantsByProduct.set(pId, []);
      variantsByProduct.get(pId)!.push({
        id: v._id.toString(),
        sku: v.sku,
        productId: pId,
        size: v.sizeId,
        sizeId: sId,
        thickness: v.thicknessId,
        thicknessId: tId,
        listPrice: toRupees(v.listPrice),
        purchasePrice: toRupees(v.purchasePrice),
        retailPrice: toRupees(v.retailPrice),
        wholesalePrice: toRupees(v.wholesalePrice),
        distributorPrice: toRupees(v.distributorPrice),
        status: v.status,
      });
    }

    const items = products.map((p: any) => {
      const b = p.brandId;
      const c = p.categoryId;
      const bCode = b?.code || 'MF';
      const cCode = c?.code || 'CAT';
      const code = p.code || `${bCode}-${cCode}`.toUpperCase();
      const bId = b?._id ? b._id.toString() : b?.toString() || '';
      const cId = c?._id ? c._id.toString() : c?.toString() || '';

      return {
        id: p._id.toString(),
        name: p.name,
        code,
        brandId: bId,
        categoryId: cId,
        branchId: p.branchId?._id ? p.branchId._id.toString() : p.branchId?.toString() || undefined,
        branch: p.branchId,
        brand: b,
        category: c,
        status: p.status,
        variants: variantsByProduct.get(p._id.toString()) || [],
        createdAt: p.createdAt,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  public static async getProductById(id: string) {
    const product = await Product.findById(id)
      .populate('brandId', 'name code logoUrl')
      .populate('categoryId', 'name code');
    if (!product) throw new AppError(`Product '${id}' not found.`, 404, 'PRODUCT_NOT_FOUND');

    const variants = await Variant.find({ productId: product._id })
      .populate('sizeId', 'length width displayLabel')
      .populate('thicknessId', 'value displayLabel');

    return {
      id: product._id.toString(),
      name: product.name,
      brand: product.brandId,
      category: product.categoryId,
      status: product.status,
      variants: variants.map((v) => ({
        id: v._id.toString(),
        sku: v.sku,
        size: v.sizeId,
        thickness: v.thicknessId,
        listPrice: toRupees(v.listPrice),
        purchasePrice: toRupees(v.purchasePrice),
        purchaseDiscountPercent: v.purchaseDiscountPercent,
        retailPrice: toRupees(v.retailPrice),
        retailMarkupPercent: v.retailMarkupPercent,
        wholesalePrice: toRupees(v.wholesalePrice),
        wholesaleDiscountPercent: v.wholesaleDiscountPercent,
        distributorPrice: toRupees(v.distributorPrice),
        distributorDiscountPercent: v.distributorDiscountPercent,
        status: v.status,
      })),
      createdAt: product.createdAt,
    };
  }

  private static async resolvePrimaryBranchAndLocation(callerBranchId?: string, destinationBranchId?: string) {
    let branch: any = null;
    if (destinationBranchId && mongoose.Types.ObjectId.isValid(destinationBranchId)) {
      branch = await Branch.findById(destinationBranchId);
    }
    if (!branch && callerBranchId && mongoose.Types.ObjectId.isValid(callerBranchId)) {
      branch = await Branch.findById(callerBranchId);
    }
    if (!branch) {
      branch =
        (await Branch.findOne({ $or: [{ code: 'MAIN' }, { isMain: true }, { code: 'SHOP-12' }] })) ||
        (await Branch.findOne({ isActive: true })) ||
        (await Branch.findOne());
    }
    if (!branch) return null;

    let location = await StockLocation.findOne({
      branchId: branch._id,
      $or: [{ code: 'MAIN-LOC-01' }, { code: 'LOC-FLOOR' }, { type: 'SALES_FLOOR' }],
    });
    if (!location) {
      location = await StockLocation.findOne({ branchId: branch._id });
    }
    if (!location) {
      location = await StockLocation.create({
        branchId: branch._id,
        name: `${branch.name} Sales Floor`,
        code: `${branch.code || 'LOC'}-FLOOR`,
        type: 'SALES_FLOOR',
        status: 'ACTIVE',
      });
    }

    return { branch, location };
  }

  /**
   * Main Simplified Product Creation Workflow:
   * Brand -> Category -> Size -> Thickness -> Pricing -> Opening Stock
   */
  public static async createProductWithVariant(
    input: CreateProductWithVariantInput,
    accountId?: string,
    callerBranchId?: string
  ) {
    // 1. Resolve master entities
    const resolveEntity = async (model: any, idOrCode: string) => {
      if (!idOrCode) return null;
      if (mongoose.Types.ObjectId.isValid(idOrCode)) {
        const doc = await model.findById(idOrCode);
        if (doc) return doc;
      }
      return await model.findOne({
        $or: [
          { code: idOrCode },
          { name: idOrCode },
          { displayLabel: idOrCode },
        ],
      });
    };

    const [brand, category, size, thickness] = await Promise.all([
      resolveEntity(Brand, input.brandId),
      resolveEntity(Category, input.categoryId),
      resolveEntity(Size, input.sizeId),
      resolveEntity(Thickness, input.thicknessId),
    ]);

    if (!brand || brand.status !== 'ACTIVE') {
      throw new AppError('Brand not found or inactive.', 400, 'INVALID_BRAND');
    }
    if (!category || category.status !== 'ACTIVE') {
      throw new AppError('Category not found or inactive.', 400, 'INVALID_CATEGORY');
    }
    if (category.brandId.toString() !== brand._id.toString()) {
      throw new AppError(
        `Category '${category.name}' does not belong to Brand '${brand.name}'.`,
        400,
        'CATEGORY_BRAND_MISMATCH'
      );
    }
    if (!size || size.status !== 'ACTIVE') {
      throw new AppError('Size not found or inactive.', 400, 'INVALID_SIZE');
    }
    if (!thickness || thickness.status !== 'ACTIVE') {
      throw new AppError('Thickness not found or inactive.', 400, 'INVALID_THICKNESS');
    }

    // 2. Resolve primary branch and location for opening stock & product association
    const branchAndLoc = await this.resolvePrimaryBranchAndLocation(callerBranchId, input.destinationBranchId);
    const targetBranch = branchAndLoc?.branch;

    // Generate Product Name: Brand Name + Category Name
    const productName = `${brand.name} - ${category.name}`;

    // Find or create base Product (scoped to target branch if specified)
    let product = await Product.findOne({
      brandId: brand._id,
      categoryId: category._id,
      ...(targetBranch ? { branchId: targetBranch._id } : {}),
    });

    if (!product) {
      product = await Product.create({
        brandId: brand._id,
        categoryId: category._id,
        name: productName,
        branchId: targetBranch?._id,
        status: 'ACTIVE',
      });
    }

    // 3. Generate unique SKU
    const sku = generateSkuCode(brand.code, category.code, size.displayLabel, thickness.value);

    // Check if variant with this specification or SKU already exists
    const existingVariant = await Variant.findOne({
      $or: [
        { productId: product._id, sizeId: size._id, thicknessId: thickness._id },
        { sku },
      ],
    });

    if (existingVariant) {
      throw new AppError(
        `A mattress variant with SKU '${sku}' (${productName}, ${size.displayLabel}, ${thickness.displayLabel}) already exists.`,
        409,
        'SKU_ALREADY_EXISTS'
      );
    }

    // 4. Compute and Reconcile Authoritative Integer-Paisa Pricing
    const listPricePaisa = toPaisa(input.listPrice);
    if (listPricePaisa <= 0) {
      throw new AppError('List Price must be greater than zero.', 400, 'INVALID_LIST_PRICE');
    }

    // Purchase Price
    let purchasePricePaisa = 0;
    let purchaseDiscountPercent = input.purchasePercent ?? 0;
    if (input.purchasePrice !== undefined) {
      purchasePricePaisa = toPaisa(input.purchasePrice);
      purchaseDiscountPercent = calculateDiscountPercent(listPricePaisa, purchasePricePaisa);
    } else {
      purchasePricePaisa = calculatePurchasePrice(listPricePaisa, purchaseDiscountPercent);
    }

    // Retail Price
    let retailPricePaisa = 0;
    let retailMarkupPercent = input.retailPercent ?? 0;
    if (input.retailPrice !== undefined) {
      retailPricePaisa = toPaisa(input.retailPrice);
      retailMarkupPercent = calculateMarkupPercent(listPricePaisa, retailPricePaisa);
    } else {
      retailPricePaisa = calculateRetailPrice(listPricePaisa, retailMarkupPercent);
    }

    // Wholesale Price
    let wholesalePricePaisa = 0;
    let wholesaleDiscountPercent = input.wholesalePercent ?? 0;
    if (input.wholesalePrice !== undefined) {
      wholesalePricePaisa = toPaisa(input.wholesalePrice);
      wholesaleDiscountPercent = calculateDiscountPercent(listPricePaisa, wholesalePricePaisa);
    } else {
      wholesalePricePaisa = calculateWholesalePrice(listPricePaisa, wholesaleDiscountPercent);
    }

    // Distributor Price
    let distributorPricePaisa = 0;
    let distributorDiscountPercent = input.distributorPercent ?? 0;
    if (input.distributorPrice !== undefined) {
      distributorPricePaisa = toPaisa(input.distributorPrice);
      distributorDiscountPercent = calculateDiscountPercent(listPricePaisa, distributorPricePaisa);
    } else {
      distributorPricePaisa = calculateDistributorPrice(listPricePaisa, distributorDiscountPercent);
    }

    // 5. Create Variant
    const variant = await Variant.create({
      productId: product._id,
      sizeId: size._id,
      thicknessId: thickness._id,
      sku,
      listPrice: listPricePaisa,
      purchasePrice: purchasePricePaisa,
      purchaseDiscountPercent,
      retailPrice: retailPricePaisa,
      retailMarkupPercent,
      wholesalePrice: wholesalePricePaisa,
      wholesaleDiscountPercent,
      distributorPrice: distributorPricePaisa,
      distributorDiscountPercent,
      status: 'ACTIVE',
    });

    // 6. Record Initial Price History
    const accountObjectId = accountId && mongoose.Types.ObjectId.isValid(accountId)
      ? new mongoose.Types.ObjectId(accountId)
      : undefined;

    await PriceHistory.insertMany([
      {
        variantId: variant._id,
        sku,
        tier: 'LIST',
        previousPrice: 0,
        newPrice: listPricePaisa,
        changedByAccountId: accountObjectId,
        reason: 'Initial Product Catalogue Registration',
      },
      {
        variantId: variant._id,
        sku,
        tier: 'PURCHASE',
        previousPrice: 0,
        newPrice: purchasePricePaisa,
        newPercent: purchaseDiscountPercent,
        changedByAccountId: accountObjectId,
        reason: 'Initial Product Catalogue Registration',
      },
      {
        variantId: variant._id,
        sku,
        tier: 'RETAIL',
        previousPrice: 0,
        newPrice: retailPricePaisa,
        newPercent: retailMarkupPercent,
        changedByAccountId: accountObjectId,
        reason: 'Initial Product Catalogue Registration',
      },
      {
        variantId: variant._id,
        sku,
        tier: 'WHOLESALE',
        previousPrice: 0,
        newPrice: wholesalePricePaisa,
        newPercent: wholesaleDiscountPercent,
        changedByAccountId: accountObjectId,
        reason: 'Initial Product Catalogue Registration',
      },
      {
        variantId: variant._id,
        sku,
        tier: 'DISTRIBUTOR',
        previousPrice: 0,
        newPrice: distributorPricePaisa,
        newPercent: distributorDiscountPercent,
        changedByAccountId: accountObjectId,
        reason: 'Initial Product Catalogue Registration',
      },
    ]);

    // 7. Initial Stock Balance Handling
    const stockQty = Math.max(0, input.stock || 0);
    const minStockQty = input.minimumStock !== undefined ? Math.max(0, input.minimumStock) : 5;
    let initialStockCreated = false;

    if (branchAndLoc) {
      const { branch: targetBranch, location: floorLocation } = branchAndLoc;

      let stockBalance = await StockBalance.findOne({
        branchId: targetBranch._id,
        stockLocationId: floorLocation._id,
        sku,
      });

      if (!stockBalance) {
        stockBalance = await StockBalance.create({
          branchId: targetBranch._id,
          stockLocationId: floorLocation._id,
          sku,
          variantId: variant._id,
          onHand: stockQty,
          reserved: 0,
          reorderLevel: minStockQty,
        });
      } else {
        stockBalance.onHand = stockQty;
        stockBalance.reorderLevel = minStockQty;
        stockBalance.variantId = variant._id;
        await stockBalance.save();
      }

      if (stockQty > 0) {
        await StockMovement.create({
          movementNumber: `MOV-INIT-${sku}-${Date.now().toString().slice(-6)}`,
          branchId: targetBranch._id,
          stockLocationId: floorLocation._id,
          sku,
          movementType: 'OPENING_BALANCE',
          quantityDifference: stockQty,
          previousBalance: 0,
          newBalance: stockQty,
          referenceType: 'OPENING_BALANCE',
          reason: 'Product catalogue opening stock registration',
          performedBy: accountId || 'System',
          timestamp: new Date(),
        });
      }
      initialStockCreated = true;
    }

    return {
      product: {
        id: product._id.toString(),
        name: product.name,
        brand: { id: brand._id.toString(), name: brand.name, code: brand.code },
        category: { id: category._id.toString(), name: category.name, code: category.code },
      },
      variant: {
        id: variant._id.toString(),
        sku: variant.sku,
        size: { id: size._id.toString(), label: size.displayLabel },
        thickness: { id: thickness._id.toString(), label: thickness.displayLabel },
        listPrice: toRupees(variant.listPrice),
        purchasePrice: toRupees(variant.purchasePrice),
        purchaseDiscountPercent: variant.purchaseDiscountPercent,
        retailPrice: toRupees(variant.retailPrice),
        retailMarkupPercent: variant.retailMarkupPercent,
        wholesalePrice: toRupees(variant.wholesalePrice),
        wholesaleDiscountPercent: variant.wholesaleDiscountPercent,
        distributorPrice: toRupees(variant.distributorPrice),
        distributorDiscountPercent: variant.distributorDiscountPercent,
        initialStockCommitted: initialStockCreated,
        onHand: input.stock || 0,
        minimumStock: input.minimumStock ?? 5,
      },
    };
  }

  // ==========================================
  // SKUs & PRICING
  // ==========================================

  public static async getSkus(
    query: { search?: string; productId?: string; status?: string; branchId?: string },
    isSuperAdmin = false
  ) {
    const filter: any = {};
    if (query.productId) filter.productId = query.productId;
    if (isSuperAdmin) {
      if (query.status && query.status !== 'ALL') filter.status = query.status;
    } else {
      // Non-admin branch accounts are strictly restricted to ACTIVE catalogue records
      filter.status = 'ACTIVE';
    }
    if (query.search) {
      filter.sku = { $regex: query.search, $options: 'i' };
    }

    if (query.branchId) {
      const branchProducts = await Product.find({ branchId: query.branchId }).select('_id');
      const branchProductIds = branchProducts.map((p) => p._id);

      const branchStock = await StockBalance.find({ branchId: query.branchId }).select('variantId sku');
      const stockedVariantIds = branchStock.map((s) => s.variantId).filter(Boolean);
      const stockedSkus = branchStock.map((s) => s.sku).filter(Boolean);

      filter.$or = [
        { productId: { $in: branchProductIds } },
        { _id: { $in: stockedVariantIds } },
        { sku: { $in: stockedSkus } },
      ];
    }

    const variants = await Variant.find(filter)
      .populate({
        path: 'productId',
        populate: [
          { path: 'brandId', select: 'name code' },
          { path: 'categoryId', select: 'name code' },
        ],
      })
      .populate('sizeId', 'length width displayLabel')
      .populate('thicknessId', 'value displayLabel')
      .sort({ sku: 1 });

    const variantIds = variants.map((v) => v._id);
    const stockQuery: any = {
      $or: [{ variantId: { $in: variantIds } }, { sku: { $in: variants.map((v) => v.sku) } }],
    };
    if (query.branchId) {
      stockQuery.branchId = query.branchId;
    }
    const stockBalances = await StockBalance.find(stockQuery);
    const stockMap = new Map<string, { onHand: number; reorderLevel: number }>();
    stockBalances.forEach((sb) => {
      const existing = stockMap.get(sb.sku) || { onHand: 0, reorderLevel: sb.reorderLevel ?? 5 };
      existing.onHand += sb.onHand || 0;
      stockMap.set(sb.sku, existing);
    });

    return variants.map((v: any) => {
      const stockInfo = stockMap.get(v.sku) || { onHand: 0, reorderLevel: 5 };
      const p = v.productId;
      const pId = p?._id ? p._id.toString() : p?.toString() || '';
      const b = p?.brandId;
      const c = p?.categoryId;
      const bId = b?._id ? b._id.toString() : b?.toString() || '';
      const cId = c?._id ? c._id.toString() : c?.toString() || '';
      const sId = v.sizeId?._id ? v.sizeId._id.toString() : v.sizeId?.toString() || '';
      const tId = v.thicknessId?._id ? v.thicknessId._id.toString() : v.thicknessId?.toString() || '';

      const baseObj: any = {
        id: v._id.toString(),
        sku: v.sku,
        productName: p?.name || 'Mattress',
        productId: pId,
        brandId: bId,
        branchId: p?.branchId?.toString() || '',
        categoryId: cId,
        sizeId: sId,
        thicknessId: tId,
        brand: b,
        category: c,
        size: v.sizeId,
        thickness: v.thicknessId,
        listPrice: toRupees(v.listPrice),
        retailPrice: toRupees(v.retailPrice),
        walkInPrice: toRupees(v.retailPrice),
        wholesalePrice: toRupees(v.wholesalePrice),
        distributorPrice: toRupees(v.distributorPrice),
        stock: stockInfo.onHand,
        onHand: stockInfo.onHand,
        minimumStock: stockInfo.reorderLevel,
        status: v.status,
      };

      // Only expose purchase cost to Super Admin
      if (isSuperAdmin) {
        baseObj.purchasePrice = toRupees(v.purchasePrice);
      }

      return baseObj;
    });
  }

  public static async getSkuById(id: string, isSuperAdmin = false) {
    let variant: any;
    if (mongoose.Types.ObjectId.isValid(id)) {
      variant = await Variant.findById(id);
    }
    if (!variant) {
      variant = await Variant.findOne({ sku: id.toUpperCase() });
    }
    if (!variant) throw new AppError(`SKU '${id}' not found.`, 404, 'SKU_NOT_FOUND');

    // Non-admin branch accounts cannot inspect INACTIVE SKUs
    if (!isSuperAdmin && variant.status !== 'ACTIVE') {
      throw new AppError(`SKU '${id}' not found.`, 404, 'SKU_NOT_FOUND');
    }

    await variant.populate([
      {
        path: 'productId',
        populate: [
          { path: 'brandId', select: 'name code' },
          { path: 'categoryId', select: 'name code' },
        ],
      },
      { path: 'sizeId', select: 'length width displayLabel' },
      { path: 'thicknessId', select: 'value displayLabel' },
    ]);

    const stockDoc =
      (await StockBalance.findOne({ variantId: variant._id })) ||
      (await StockBalance.findOne({ sku: variant.sku }));

    const res: any = {
      id: variant._id.toString(),
      sku: variant.sku,
      product: variant.productId,
      size: variant.sizeId,
      thickness: variant.thicknessId,
      listPrice: toRupees(variant.listPrice),
      retailPrice: toRupees(variant.retailPrice),
      retailMarkupPercent: variant.retailMarkupPercent,
      wholesalePrice: toRupees(variant.wholesalePrice),
      wholesaleDiscountPercent: variant.wholesaleDiscountPercent,
      distributorPrice: toRupees(variant.distributorPrice),
      distributorDiscountPercent: variant.distributorDiscountPercent,
      status: variant.status,
      stock: stockDoc ? stockDoc.onHand : 0,
      minimumStock: stockDoc?.reorderLevel ?? 5,
    };

    if (isSuperAdmin) {
      res.purchasePrice = toRupees(variant.purchasePrice);
      res.purchaseDiscountPercent = variant.purchaseDiscountPercent;
    }

    return res;
  }

  public static async updateSku(id: string, input: UpdateSkuInput, accountId?: string) {
    const variant = mongoose.Types.ObjectId.isValid(id)
      ? await Variant.findById(id)
      : await Variant.findOne({ sku: id.toUpperCase() });

    if (!variant) throw new AppError(`SKU '${id}' not found.`, 404, 'SKU_NOT_FOUND');

    await variant.populate([
      {
        path: 'productId',
        populate: [
          { path: 'brandId' },
          { path: 'categoryId' },
        ],
      },
      'sizeId',
      'thicknessId',
    ]);

    const resolveEntity = async (model: any, idOrCode?: string) => {
      if (!idOrCode) return null;
      if (mongoose.Types.ObjectId.isValid(idOrCode)) {
        const doc = await model.findById(idOrCode);
        if (doc) return doc;
      }
      return await model.findOne({
        $or: [
          { code: idOrCode },
          { code: idOrCode.toUpperCase() },
          { name: idOrCode },
          { displayLabel: idOrCode },
        ],
      });
    };

    const currentProd = variant.productId as any;
    const currentBrand = currentProd?.brandId;
    const currentCat = currentProd?.categoryId;
    const currentSize = variant.sizeId as any;
    const currentThick = variant.thicknessId as any;

    const brand = input.brandId
      ? await resolveEntity(Brand, input.brandId)
      : currentBrand;
    const category = input.categoryId
      ? await resolveEntity(Category, input.categoryId)
      : currentCat;
    const size = input.sizeId
      ? await resolveEntity(Size, input.sizeId)
      : currentSize;
    const thickness = input.thicknessId
      ? await resolveEntity(Thickness, input.thicknessId)
      : currentThick;

    if (!brand || brand.status !== 'ACTIVE') {
      throw new AppError('Brand not found or inactive.', 400, 'INVALID_BRAND');
    }
    if (!category || category.status !== 'ACTIVE') {
      throw new AppError('Category not found or inactive.', 400, 'INVALID_CATEGORY');
    }
    if (category.brandId.toString() !== brand._id.toString()) {
      throw new AppError(
        `Category '${category.name}' does not belong to Brand '${brand.name}'.`,
        400,
        'CATEGORY_BRAND_MISMATCH'
      );
    }
    if (!size || size.status !== 'ACTIVE') {
      throw new AppError('Size not found or inactive.', 400, 'INVALID_SIZE');
    }
    if (!thickness || thickness.status !== 'ACTIVE') {
      throw new AppError('Thickness not found or inactive.', 400, 'INVALID_THICKNESS');
    }

    // Find or create base product
    const productName = `${brand.name} - ${category.name}`;
    let product = await Product.findOne({
      brandId: brand._id,
      categoryId: category._id,
    });
    if (!product) {
      product = await Product.create({
        brandId: brand._id,
        categoryId: category._id,
        name: productName,
        status: 'ACTIVE',
      });
    }

    variant.productId = product._id;
    variant.sizeId = size._id;
    variant.thicknessId = thickness._id;

    // Check SKU
    const newSku = generateSkuCode(brand.code, category.code, size.displayLabel, thickness.value);
    const oldSku = variant.sku;

    if (newSku !== oldSku) {
      const duplicate = await Variant.findOne({ sku: newSku, _id: { $ne: variant._id } });
      if (duplicate) {
        throw new AppError(
          `A mattress variant with SKU '${newSku}' already exists.`,
          409,
          'DUPLICATE_SKU'
        );
      }
      variant.sku = newSku;

      // Update associated stock records
      await StockBalance.updateMany(
        { $or: [{ variantId: variant._id }, { sku: oldSku }] },
        { $set: { sku: newSku, variantId: variant._id } }
      );
      await StockMovement.updateMany(
        { sku: oldSku },
        { $set: { sku: newSku } }
      );
    }

    if (input.status) {
      variant.status = input.status.toUpperCase() as 'ACTIVE' | 'INACTIVE';
    }

    const accountObjectId = accountId && mongoose.Types.ObjectId.isValid(accountId)
      ? new mongoose.Types.ObjectId(accountId)
      : undefined;

    const auditHistoryRecords: any[] = [];

    // 1. List Price update
    let currentListPaisa = variant.listPrice;
    if (input.listPrice !== undefined) {
      const newListPaisa = toPaisa(input.listPrice);
      if (newListPaisa !== currentListPaisa) {
        auditHistoryRecords.push({
          variantId: variant._id,
          sku: variant.sku,
          tier: 'LIST',
          previousPrice: currentListPaisa,
          newPrice: newListPaisa,
          changedByAccountId: accountObjectId,
          reason: input.reason || 'List Price Update',
        });
        currentListPaisa = newListPaisa;
        variant.listPrice = newListPaisa;
      }
    }

    // 2. Purchase Price update
    if (input.purchasePrice !== undefined || input.purchasePercent !== undefined) {
      const newPurchasePaisa = input.purchasePrice !== undefined
        ? toPaisa(input.purchasePrice)
        : calculatePurchasePrice(currentListPaisa, input.purchasePercent ?? variant.purchaseDiscountPercent ?? 0);
      const newPct = input.purchasePercent !== undefined
        ? input.purchasePercent
        : calculateDiscountPercent(currentListPaisa, newPurchasePaisa);

      if (newPurchasePaisa !== variant.purchasePrice) {
        auditHistoryRecords.push({
          variantId: variant._id,
          sku: variant.sku,
          tier: 'PURCHASE',
          previousPrice: variant.purchasePrice,
          newPrice: newPurchasePaisa,
          previousPercent: variant.purchaseDiscountPercent,
          newPercent: newPct,
          changedByAccountId: accountObjectId,
          reason: input.reason || 'Purchase Price Update',
        });
        variant.purchasePrice = newPurchasePaisa;
        variant.purchaseDiscountPercent = newPct;
      }
    }

    // 3. Retail Price update
    if (input.retailPrice !== undefined || input.retailPercent !== undefined) {
      const newRetailPaisa = input.retailPrice !== undefined
        ? toPaisa(input.retailPrice)
        : calculateRetailPrice(currentListPaisa, input.retailPercent ?? variant.retailMarkupPercent ?? 0);
      const newPct = input.retailPercent !== undefined
        ? input.retailPercent
        : calculateMarkupPercent(currentListPaisa, newRetailPaisa);

      if (newRetailPaisa !== variant.retailPrice) {
        auditHistoryRecords.push({
          variantId: variant._id,
          sku: variant.sku,
          tier: 'RETAIL',
          previousPrice: variant.retailPrice,
          newPrice: newRetailPaisa,
          previousPercent: variant.retailMarkupPercent,
          newPercent: newPct,
          changedByAccountId: accountObjectId,
          reason: input.reason || 'Retail Price Update',
        });
        variant.retailPrice = newRetailPaisa;
        variant.retailMarkupPercent = newPct;
      }
    }

    // 4. Wholesale Price update
    if (input.wholesalePrice !== undefined || input.wholesalePercent !== undefined) {
      const newWholesalePaisa = input.wholesalePrice !== undefined
        ? toPaisa(input.wholesalePrice)
        : calculateWholesalePrice(currentListPaisa, input.wholesalePercent ?? variant.wholesaleDiscountPercent ?? 0);
      const newPct = input.wholesalePercent !== undefined
        ? input.wholesalePercent
        : calculateDiscountPercent(currentListPaisa, newWholesalePaisa);

      if (newWholesalePaisa !== variant.wholesalePrice) {
        auditHistoryRecords.push({
          variantId: variant._id,
          sku: variant.sku,
          tier: 'WHOLESALE',
          previousPrice: variant.wholesalePrice,
          newPrice: newWholesalePaisa,
          previousPercent: variant.wholesaleDiscountPercent,
          newPercent: newPct,
          changedByAccountId: accountObjectId,
          reason: input.reason || 'Wholesale Price Update',
        });
        variant.wholesalePrice = newWholesalePaisa;
        variant.wholesaleDiscountPercent = newPct;
      }
    }

    // 5. Distributor Price update
    if (input.distributorPrice !== undefined || input.distributorPercent !== undefined) {
      const newDistributorPaisa = input.distributorPrice !== undefined
        ? toPaisa(input.distributorPrice)
        : calculateDistributorPrice(currentListPaisa, input.distributorPercent ?? variant.distributorDiscountPercent ?? 0);
      const newPct = input.distributorPercent !== undefined
        ? input.distributorPercent
        : calculateDiscountPercent(currentListPaisa, newDistributorPaisa);

      if (newDistributorPaisa !== variant.distributorPrice) {
        auditHistoryRecords.push({
          variantId: variant._id,
          sku: variant.sku,
          tier: 'DISTRIBUTOR',
          previousPrice: variant.distributorPrice,
          newPrice: newDistributorPaisa,
          previousPercent: variant.distributorDiscountPercent,
          newPercent: newPct,
          changedByAccountId: accountObjectId,
          reason: input.reason || 'Distributor Price Update',
        });
        variant.distributorPrice = newDistributorPaisa;
        variant.distributorDiscountPercent = newPct;
      }
    }

    // 6. Stock & Minimum Stock updates
    if (input.stock !== undefined || input.minimumStock !== undefined) {
      let stockDoc =
        (await StockBalance.findOne({ variantId: variant._id })) ||
        (await StockBalance.findOne({ sku: variant.sku }));

      if (!stockDoc) {
        const branchAndLoc = await this.resolvePrimaryBranchAndLocation();
        if (branchAndLoc) {
          stockDoc = await StockBalance.create({
            branchId: branchAndLoc.branch._id,
            stockLocationId: branchAndLoc.location._id,
            sku: variant.sku,
            variantId: variant._id,
            onHand: 0,
            reserved: 0,
            reorderLevel: 5,
          });
        }
      }

      if (stockDoc) {
        if (!stockDoc.variantId) {
          stockDoc.variantId = variant._id;
        }
        if (input.stock !== undefined) {
          const oldOnHand = stockDoc.onHand || 0;
          const newOnHand = Math.max(0, input.stock);
          if (oldOnHand !== newOnHand) {
            stockDoc.onHand = newOnHand;
            await StockMovement.create({
              movementNumber: `MOV-EDIT-${variant.sku}-${Date.now().toString().slice(-6)}`,
              branchId: stockDoc.branchId,
              stockLocationId: stockDoc.stockLocationId,
              sku: variant.sku,
              movementType: 'ADMINISTRATIVE_ADJUSTMENT',
              quantityDifference: newOnHand - oldOnHand,
              previousBalance: oldOnHand,
              newBalance: newOnHand,
              referenceType: 'ADJUSTMENT',
              reason: input.reason || 'Product catalogue edit stock update',
              performedBy: accountId || 'System',
              timestamp: new Date(),
            });
          }
        }
        if (input.minimumStock !== undefined) {
          stockDoc.reorderLevel = Math.max(0, input.minimumStock);
        }
        await stockDoc.save();
      }
    }

    await variant.save();

    if (auditHistoryRecords.length > 0) {
      await PriceHistory.insertMany(auditHistoryRecords);
    }

    const finalStockDoc =
      (await StockBalance.findOne({ variantId: variant._id })) ||
      (await StockBalance.findOne({ sku: variant.sku }));

    return {
      id: variant._id.toString(),
      sku: variant.sku,
      listPrice: toRupees(variant.listPrice),
      purchasePrice: toRupees(variant.purchasePrice),
      purchaseDiscountPercent: variant.purchaseDiscountPercent,
      retailPrice: toRupees(variant.retailPrice),
      retailMarkupPercent: variant.retailMarkupPercent,
      wholesalePrice: toRupees(variant.wholesalePrice),
      wholesaleDiscountPercent: variant.wholesaleDiscountPercent,
      distributorPrice: toRupees(variant.distributorPrice),
      distributorDiscountPercent: variant.distributorDiscountPercent,
      stock: finalStockDoc ? finalStockDoc.onHand : 0,
      minimumStock: finalStockDoc?.reorderLevel ?? 5,
      changesRecorded: auditHistoryRecords.length,
    };
  }

  public static async updateSkuPrices(id: string, input: UpdatePricesInput, accountId?: string) {
    return this.updateSku(id, input, accountId);
  }

  public static async getSkuPriceHistory(id: string) {
    const variant = mongoose.Types.ObjectId.isValid(id)
      ? await Variant.findById(id)
      : await Variant.findOne({ sku: id.toUpperCase() });

    if (!variant) throw new AppError(`SKU '${id}' not found.`, 404, 'SKU_NOT_FOUND');

    const history = await PriceHistory.find({ variantId: variant._id })
      .populate('changedByAccountId', 'name loginId role')
      .sort({ createdAt: -1 });

    return history.map((h) => ({
      id: h._id.toString(),
      sku: h.sku,
      tier: h.tier,
      previousPrice: toRupees(h.previousPrice),
      newPrice: toRupees(h.newPrice),
      previousPercent: h.previousPercent,
      newPercent: h.newPercent,
      changedBy: h.changedByAccountId,
      reason: h.reason,
      createdAt: h.createdAt,
    }));
  }

  public static async toggleSkuStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<IVariant> {
    const variant = mongoose.Types.ObjectId.isValid(id)
      ? await Variant.findById(id)
      : await Variant.findOne({ sku: id.toUpperCase() });

    if (!variant) throw new AppError(`SKU '${id}' not found.`, 404, 'SKU_NOT_FOUND');
    variant.status = status;
    return variant.save();
  }

  public static async getBranches(): Promise<Array<Record<string, any>>> {
    const branches = await Branch.find({ isActive: true }).sort({ name: 1 }).lean();
    return branches.map((b) => ({
      ...b,
      id: b._id.toString(),
      _id: b._id.toString(),
    }));
  }
}
