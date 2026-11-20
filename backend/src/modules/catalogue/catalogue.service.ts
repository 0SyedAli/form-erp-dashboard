import mongoose from 'mongoose';
import {
  Brand,
  Category,
  ProductLine,
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
  IProductLine,
  ISize,
  IThickness,
  IVariant,
} from '../../models/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { PosService } from '../pos/pos.service.js';
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
  ProductLineInput,
  SizeInput,
  ThicknessInput,
  CreateProductWithVariantInput,
  UpdatePricesInput,
  UpdateSkuInput,
} from './catalogue.schema.js';

export function generateSmartProductLineAbbr(plNameOrCode?: string): string {
  if (!plNameOrCode) return '';
  let clean = plNameOrCode
    .replace(/^PL[-_]?/i, '')
    .replace(/[-_]\d+$/, '')
    .replace(/\+\+/g, ' DPLUS ')
    .replace(/\+/g, ' PLUS ')
    .replace(/&/g, ' AND ')
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GEN';

  if (words.length === 1) {
    if (words[0].toLowerCase() === 'commander') return 'CMDR';
    return words[0].slice(0, 4).toUpperCase();
  }

  // 2 words: e.g. "Flex Firm" -> "FLFM", "Flex Soft" -> "FLSF"
  if (words.length === 2) {
    const w1 = words[0].slice(0, 2);
    let w2 = words[1].slice(0, 2);
    if (words[1].toLowerCase() === 'firm') w2 = 'FM';
    else if (words[1].toLowerCase() === 'soft') w2 = 'SF';
    else if (words[1].toLowerCase() === 'foam') w2 = 'FO';
    return (w1 + w2).toUpperCase().padEnd(4, 'X').slice(0, 4);
  }

  // 3 words: e.g. "Molty Sleep Memory" -> "MSPM"
  if (words.length === 3) {
    const w1 = words[0][0];
    const w2 = words[1].slice(0, 2);
    const w3 = words[2][0];
    return (w1 + w2 + w3).toUpperCase().slice(0, 4);
  }

  // 4 words or more: specific distinctive abbreviations
  const lower = clean.toLowerCase();
  if (lower.includes('memory ortho')) return 'EFME'; // Ext Firm Memory Ortho
  if (lower.includes('cool gel ortho')) return 'EFCG'; // Ext Firm Cool Gel Ortho
  if (lower.includes('molty ortho duo')) return '3MOD'; // 3in1 Molty Ortho Duo
  if (lower.includes('molty ortho fold')) return 'MOFB'; // Molty Ortho Fold-A-Bed
  if (lower.includes('molty firm fold')) return 'MFMB'; // Molty Firm Fold-A-Bed
  if (lower.includes('molty foam fold')) return 'MFFB'; // Molty Foam Fold-A-Bed
  if (lower.includes('master fold')) return 'MAFB'; // Master Fold-A-Bed
  if (lower.includes('jet khi fold')) return 'JKFB'; // Jet KHI Fold-A-Bed
  if (lower.includes('molty ortho')) {
    if (lower.includes('ext firm')) return 'EFMO';
    return 'MOOR';
  }

  return words.slice(0, 4).map(w => w[0]).join('').toUpperCase().slice(0, 4);
}

export function generateSkuCode(
  brandCode: string,
  categoryCode: string,
  sizeDisplayLabel: string,
  thicknessValue?: number | null,
  productLineCodeOrName?: string
): string {
  const bCode = (brandCode || 'MOLT').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'MOLT';
  const cCode = (categoryCode || 'CAT').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'CAT';
  const plCode = productLineCodeOrName ? generateSmartProductLineAbbr(productLineCodeOrName) : '';
  const sLabel = (sizeDisplayLabel || 'STD')
    .replace(/[\s×xX]/g, 'X')
    .replace(/[^0-9X]/g, '')
    .toUpperCase();
  const tVal = thicknessValue !== undefined && thicknessValue !== null ? String(thicknessValue).replace(/[^0-9]/g, '') : '';
  const spec = tVal ? `${sLabel}-${tVal}` : sLabel;
  return plCode ? `${bCode}-${cCode}-${plCode}-${spec}` : `${bCode}-${cCode}-${spec}`;
}

// In-memory master dictionary cache for instant search indexing (eliminates 5 DB queries per search)
interface MasterMetadataCache {
  timestamp: number;
  brands: Array<{ _id: any; name: string }>;
  categories: Array<{ _id: any; name: string }>;
  lines: Array<{ _id: any; name: string }>;
  sizes: Array<{ _id: any; displayLabel: string; length?: number; width?: number }>;
  thicknesses: Array<{ _id: any; displayLabel: string; value?: number }>;
}

let masterMetadataCache: MasterMetadataCache | null = null;
const MASTER_METADATA_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export function invalidateMasterMetadataCache() {
  masterMetadataCache = null;
}

async function getMasterMetadata(): Promise<MasterMetadataCache> {
  const now = Date.now();
  if (masterMetadataCache && now - masterMetadataCache.timestamp < MASTER_METADATA_TTL_MS) {
    return masterMetadataCache;
  }
  const [brands, categories, lines, sizes, thicknesses] = await Promise.all([
    Brand.find().select('_id name').lean(),
    Category.find().select('_id name').lean(),
    ProductLine.find().select('_id name').lean(),
    Size.find().select('_id displayLabel length width').lean(),
    Thickness.find().select('_id displayLabel value').lean(),
  ]);
  masterMetadataCache = {
    timestamp: now,
    brands: brands as any,
    categories: categories as any,
    lines: lines as any,
    sizes: sizes as any,
    thicknesses: thicknesses as any,
  };
  return masterMetadataCache;
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
    const hasThickness = input.hasThickness !== undefined ? input.hasThickness : true;
    if (existing) {
      if (input.name) existing.name = input.name.trim();
      if (input.description !== undefined) existing.description = input.description?.trim();
      if (input.logoUrl !== undefined) existing.logoUrl = input.logoUrl;
      existing.hasThickness = hasThickness;
      existing.status = targetStatus;
      invalidateMasterMetadataCache();
      return existing.save();
    }
    invalidateMasterMetadataCache();
    return Brand.create({
      code,
      name: input.name.trim(),
      description: input.description?.trim(),
      logoUrl: input.logoUrl,
      hasThickness,
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
    if (input.hasThickness !== undefined) brand.hasThickness = input.hasThickness;
    if ((input as any).status) brand.status = (input as any).status.toUpperCase();
    invalidateMasterMetadataCache();
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
  // PRODUCT LINES (SUB-CATEGORIES)
  // ==========================================

  public static async getProductLines(query: {
    brandId?: string;
    categoryId?: string;
    search?: string;
    status?: string;
    branchId?: string;
  } = {}) {
    const filter: any = {};
    if (query?.brandId) {
      filter.brandId = query.brandId;
    }
    if (query?.categoryId) {
      filter.categoryId = query.categoryId;
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
    return ProductLine.find(filter)
      .populate('brandId', 'name code')
      .populate('categoryId', 'name code')
      .sort({ name: 1 });
  }

  public static async getProductLineById(id: string): Promise<IProductLine> {
    let productLine: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      productLine = await ProductLine.findById(id)
        .populate('brandId', 'name code')
        .populate('categoryId', 'name code');
    }
    if (!productLine) {
      const cleanCode = id.replace(/^PL-/i, '').replace(/-\d+$/, '').toUpperCase();
      productLine = await ProductLine.findOne({
        $or: [
          { code: id.toUpperCase() },
          { code: cleanCode },
          { code: { $regex: new RegExp(`^${cleanCode}`, 'i') } },
          { name: id },
        ],
      })
        .populate('brandId', 'name code')
        .populate('categoryId', 'name code');
    }
    if (!productLine) throw new AppError(`Product Line '${id}' not found.`, 404, 'PRODUCT_LINE_NOT_FOUND');
    return productLine;
  }

  public static async createProductLine(input: ProductLineInput): Promise<IProductLine> {
    const [brand, category] = await Promise.all([
      Brand.findById(input.brandId),
      Category.findById(input.categoryId),
    ]);
    if (!brand) throw new AppError(`Brand '${input.brandId}' does not exist.`, 404, 'BRAND_NOT_FOUND');
    if (!category) throw new AppError(`Category '${input.categoryId}' does not exist.`, 404, 'CATEGORY_NOT_FOUND');

    const existing = await ProductLine.findOne({
      brandId: brand._id,
      categoryId: category._id,
      name: new RegExp(`^${input.name.trim()}$`, 'i'),
    });
    if (existing) {
      throw new AppError(
        `Product Line '${input.name}' already exists under category '${category.name}'.`,
        409,
        'DUPLICATE_PRODUCT_LINE'
      );
    }

    return ProductLine.create({
      brandId: brand._id,
      categoryId: category._id,
      code: input.code.toUpperCase(),
      name: input.name.trim(),
      description: input.description?.trim(),
      imageUrl: (input as any).imageUrl?.trim() || '',
      status: 'ACTIVE',
      ...(input.branchId ? { branchId: input.branchId } : {}),
    });
  }

  public static async updateProductLine(id: string, input: Partial<ProductLineInput>): Promise<IProductLine> {
    const productLine = await this.getProductLineById(id);
    if (input.code && input.code.toUpperCase() !== productLine.code) {
      const existing = await ProductLine.findOne({
        code: input.code.toUpperCase(),
        _id: { $ne: id },
      });
      if (existing) throw new AppError(`Product Line code '${input.code}' already exists.`, 409, 'DUPLICATE_PRODUCT_LINE_CODE');
      productLine.code = input.code.toUpperCase();
    }
    if (input.name) productLine.name = input.name.trim();
    if (input.description !== undefined) productLine.description = input.description?.trim();
    if ((input as any).imageUrl !== undefined) (productLine as any).imageUrl = (input as any).imageUrl?.trim() || '';
    if (input.brandId) (productLine as any).brandId = input.brandId;
    if (input.categoryId) (productLine as any).categoryId = input.categoryId;
    if ((input as any).status) productLine.status = (input as any).status.toUpperCase();
    return productLine.save();
  }

  public static async toggleProductLineStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<IProductLine> {
    const productLine = await this.getProductLineById(id);
    productLine.status = status;
    return productLine.save();
  }

  public static async deleteProductLine(id: string): Promise<{ deleted: boolean; message: string }> {
    const productLine = await this.getProductLineById(id);
    const productLineId = productLine._id;

    // Find products for this product line
    const products = await Product.find({ productLineId });
    const productIds = products.map((p) => p._id);

    const variants = await Variant.find({ productId: { $in: productIds } });
    const variantIds = variants.map((v) => v._id);
    const skus = variants.map((v) => v.sku);

    await StockBalance.deleteMany({ $or: [{ variantId: { $in: variantIds } }, { sku: { $in: skus } }] });
    await PriceHistory.deleteMany({ variantId: { $in: variantIds } });
    await Variant.deleteMany({ _id: { $in: variantIds } });
    await Product.deleteMany({ _id: { $in: productIds } });
    await ProductLine.findByIdAndDelete(productLineId);

    return { deleted: true, message: `Product Line '${productLine.name}' removed successfully.` };
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
    productLineId?: string;
    status?: string;
    branchId?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(1000, query.limit || 10));
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
    if (query.productLineId) {
      filter.productLineId = query.productLineId;
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
        { branchId: { $exists: false } },
        { branchId: null },
        { _id: { $in: stockedProdIds } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('brandId', 'name code logoUrl')
        .populate('categoryId', 'name code')
        .populate('productLineId', 'name code imageUrl')
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
        distributorPrice: toRupees(v.distributorPrice || 0),
        posDisplayName: v.posDisplayName || '',
        notes: v.notes || '',
        status: v.status,
      });
    }

    const items = products.map((p: any) => {
      const b = p.brandId;
      const c = p.categoryId;
      const pl = p.productLineId;
      const bCode = b?.code || 'MF';
      const cCode = c?.code || 'CAT';
      const code = p.code || `${bCode}-${cCode}`.toUpperCase();
      const bId = b?._id ? b._id.toString() : b?.toString() || '';
      const cId = c?._id ? c._id.toString() : c?.toString() || '';
      const plId = pl?._id ? pl._id.toString() : pl?.toString() || '';
      const plImage = (pl && typeof pl === 'object' && pl.imageUrl) ? pl.imageUrl : (p.imageUrl || undefined);

      return {
        id: p._id.toString(),
        name: p.name,
        code,
        brandId: bId,
        categoryId: cId,
        productLineId: plId || undefined,
        productLine: pl,
        imageUrl: plImage,
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
      .populate('categoryId', 'name code')
      .populate('productLineId', 'name code imageUrl');
    if (!product) throw new AppError(`Product '${id}' not found.`, 404, 'PRODUCT_NOT_FOUND');

    const variants = await Variant.find({ productId: product._id })
      .populate('sizeId', 'length width displayLabel')
      .populate('thicknessId', 'value displayLabel');

    return {
      id: product._id.toString(),
      name: product.name,
      brand: product.brandId,
      category: product.categoryId,
      productLine: product.productLineId,
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
        distributorPrice: toRupees(v.distributorPrice || 0),
        distributorDiscountPercent: v.distributorDiscountPercent,
        posDisplayName: v.posDisplayName || '',
        notes: v.notes || '',
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

    const [brand, category, productLine, size, thickness] = await Promise.all([
      resolveEntity(Brand, input.brandId),
      resolveEntity(Category, input.categoryId),
      input.productLineId ? resolveEntity(ProductLine, input.productLineId) : Promise.resolve(null),
      resolveEntity(Size, input.sizeId),
      input.thicknessId ? resolveEntity(Thickness, input.thicknessId) : Promise.resolve(null),
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

    const brandRequiresThickness = brand.hasThickness !== false;
    if (brandRequiresThickness) {
      if (!thickness || thickness.status !== 'ACTIVE') {
        throw new AppError(`Thickness is required for Brand '${brand.name}'.`, 400, 'INVALID_THICKNESS');
      }
    }

    // 2. Resolve primary branch and location for opening stock & product association
    const branchAndLoc = await this.resolvePrimaryBranchAndLocation(callerBranchId, input.destinationBranchId);
    const targetBranch = branchAndLoc?.branch;

    if (!targetBranch) {
      throw new AppError(
        'A valid branch must be selected to register this product.',
        400,
        'BRANCH_REQUIRED'
      );
    }

    // Generate Product Name: Product Line Name (or Brand Name + Category Name if no line)
    const productName = productLine ? productLine.name : `${brand.name} - ${category.name}`;

    // 3. Generate unique SKU and validate variant does not already exist BEFORE touching products
    const plIdentifier = productLine?.name || productLine?.code || '';
    const sku = generateSkuCode(brand.code, category.code, size.displayLabel, thickness ? thickness.value : undefined, plIdentifier);

    const existingVariant = await Variant.findOne({ sku });
    if (existingVariant) {
      const thickText = thickness?.displayLabel ? `, ${thickness.displayLabel}` : '';
      throw new AppError(
        `A variant with SKU '${sku}' (${productName}, ${size.displayLabel}${thickText}) already exists.`,
        409,
        'SKU_ALREADY_EXISTS'
      );
    }

    // 4. Compute and Reconcile Authoritative Integer-Paisa Pricing BEFORE creating product
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

    // Find or create base Product (scoped strictly to target branch and productLine if present)
    let isNewlyCreatedProduct = false;
    const productQuery: any = {
      brandId: brand._id,
      categoryId: category._id,
      branchId: targetBranch._id,
    };
    if (productLine) {
      productQuery.productLineId = productLine._id;
    }
    let product = await Product.findOne(productQuery);

    if (!product) {
      product = await Product.create({
        brandId: brand._id,
        categoryId: category._id,
        ...(productLine ? { productLineId: productLine._id } : {}),
        name: productName,
        branchId: targetBranch._id,
        imageUrl: input.imageUrl?.trim() || '',
        status: 'ACTIVE',
      });
      isNewlyCreatedProduct = true;
    } else if (input.imageUrl && input.imageUrl.trim()) {
      product.imageUrl = input.imageUrl.trim();
      await product.save();
    }

    let variant: any;
    try {
      // 5. Create Variant
      variant = await Variant.create({
        productId: product._id,
        sizeId: size._id,
        ...(thickness ? { thicknessId: thickness._id } : {}),
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
          distributorPrice: toRupees(variant.distributorPrice || 0),
          distributorDiscountPercent: variant.distributorDiscountPercent,
          initialStockCommitted: initialStockCreated,
          onHand: input.stock || 0,
          minimumStock: input.minimumStock ?? 5,
        },
      };
    } catch (variantErr) {
      // Rollback newly created product if variant creation or stock balance failed
      if (isNewlyCreatedProduct && product?._id) {
        await Product.findByIdAndDelete(product._id).catch(() => {});
      }
      throw variantErr;
    }
  }

  // ==========================================
  // SKUs & PRICING
  // ==========================================

  public static async getSkus(
    query: {
      search?: string;
      productId?: string;
      brandId?: string;
      categoryId?: string;
      productLineId?: string;
      status?: string;
      stockStatus?: string;
      branchId?: string;
      page?: number;
      limit?: number;
      all?: boolean;
    },
    isSuperAdmin = false
  ) {
    const andConditions: any[] = [];

    if (query.productId) {
      andConditions.push({ productId: query.productId });
    }

    if (isSuperAdmin) {
      if (query.status && query.status !== 'ALL') {
        andConditions.push({ status: query.status });
      }
    } else {
      // Non-admin branch accounts are strictly restricted to ACTIVE catalogue records
      andConditions.push({ status: 'ACTIVE' });
    }

    if (query.branchId) {
      const branchProducts = await Product.find({ branchId: query.branchId }).select('_id').lean();
      const branchProductIds = branchProducts.map((p) => p._id);

      const branchStock = await StockBalance.find({ branchId: query.branchId }).select('variantId sku').lean();
      const stockedVariantIds = branchStock.map((s) => s.variantId).filter(Boolean);
      const stockedSkus = branchStock.map((s) => s.sku).filter(Boolean);

      andConditions.push({
        $or: [
          { productId: { $in: branchProductIds } },
          { _id: { $in: stockedVariantIds } },
          { sku: { $in: stockedSkus } },
        ],
      });
    }

    // Direct Brand / Category / ProductLine filters
    if (query.brandId || query.categoryId || query.productLineId) {
      const prodQuery: any = {};
      if (query.brandId) prodQuery.brandId = query.brandId;
      if (query.categoryId) prodQuery.categoryId = query.categoryId;
      if (query.productLineId) prodQuery.productLineId = query.productLineId;

      const matchingProductDocs = await Product.find(prodQuery).select('_id').lean();
      const pIds = matchingProductDocs.map((p) => p._id);
      andConditions.push({ productId: { $in: pIds } });
    }

    // Multi-dimensional High-Speed Search Engine (Memory-cached dictionaries + indexed lookup)
    if (query.search && query.search.trim()) {
      const rawTerm = query.search.trim();
      const escapedTerm = rawTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, 'i');

      // 1. Instant resolution from server in-memory master cache (< 0.1ms without 5 DB round-trips)
      const meta = await getMasterMetadata();
      const mBrands = meta.brands.filter((b) => regex.test(b.name));
      const mCategories = meta.categories.filter((c) => regex.test(c.name));
      const mLines = meta.lines.filter((l) => regex.test(l.name));
      const mSizes = meta.sizes.filter(
        (s) =>
          regex.test(s.displayLabel) ||
          (s.length && s.width && regex.test(`${s.length}x${s.width}`)) ||
          (s.length && s.width && regex.test(`${s.length} × ${s.width}`))
      );
      const mThicknesses = meta.thicknesses.filter(
        (t) => regex.test(t.displayLabel) || (t.value !== undefined && regex.test(String(t.value)))
      );

      // 2. Targeted product query
      const mProductFilter: any = {
        $or: [
          { name: regex },
          ...(mBrands.length > 0 ? [{ brandId: { $in: mBrands.map((b) => b._id) } }] : []),
          ...(mCategories.length > 0 ? [{ categoryId: { $in: mCategories.map((c) => c._id) } }] : []),
          ...(mLines.length > 0 ? [{ productLineId: { $in: mLines.map((l) => l._id) } }] : []),
        ],
      };
      const mProducts = await Product.find(mProductFilter).select('_id').lean();

      const searchOrClauses: any[] = [
        { sku: regex },
        { posDisplayName: regex },
      ];

      if (mProducts.length > 0) {
        searchOrClauses.push({ productId: { $in: mProducts.map((p) => p._id) } });
      }
      if (mSizes.length > 0) {
        searchOrClauses.push({ sizeId: { $in: mSizes.map((s) => s._id) } });
      }
      if (mThicknesses.length > 0) {
        searchOrClauses.push({ thicknessId: { $in: mThicknesses.map((t) => t._id) } });
      }

      andConditions.push({ $or: searchOrClauses });
    }

    // Stock Status filter ('IN_STOCK' or 'OUT_OF_STOCK')
    if (query.stockStatus === 'IN_STOCK' || query.stockStatus === 'in_stock') {
      const stockCriteria: any = { onHand: { $gt: 0 } };
      if (query.branchId) stockCriteria.branchId = query.branchId;
      const inStockBalances = await StockBalance.find(stockCriteria).select('variantId sku').lean();
      const inStockVariantIds = inStockBalances.map((s) => s.variantId).filter(Boolean);
      const inStockSkus = inStockBalances.map((s) => s.sku).filter(Boolean);

      andConditions.push({
        $or: [
          { _id: { $in: inStockVariantIds } },
          { sku: { $in: inStockSkus } },
        ],
      });
    } else if (query.stockStatus === 'OUT_OF_STOCK' || query.stockStatus === 'out_of_stock') {
      const stockCriteria: any = { onHand: { $gt: 0 } };
      if (query.branchId) stockCriteria.branchId = query.branchId;
      const inStockBalances = await StockBalance.find(stockCriteria).select('variantId sku').lean();
      const inStockVariantIds = inStockBalances.map((s) => s.variantId).filter(Boolean);
      const inStockSkus = inStockBalances.map((s) => s.sku).filter(Boolean);

      andConditions.push({
        _id: { $nin: inStockVariantIds },
        sku: { $nin: inStockSkus },
      });
    }

    const filter: any = andConditions.length > 0 ? { $and: andConditions } : {};

    // Parallel count queries for 2x faster pagination metadata
    const [total, activeCount] = await Promise.all([
      Variant.countDocuments(filter),
      Variant.countDocuments({ ...filter, status: 'ACTIVE' }),
    ]);

    // 3. Paginated Query Builder
    let queryBuilder = Variant.find(filter)
      .populate({
        path: 'productId',
        populate: [
          { path: 'brandId', select: 'name code' },
          { path: 'categoryId', select: 'name code' },
          { path: 'productLineId', select: 'name code' },
        ],
      })
      .populate('sizeId', 'length width displayLabel')
      .populate('thicknessId', 'value displayLabel')
      .sort({ sku: 1 });

    const page = Math.max(1, query.page || 1);
    const isPaginated = Boolean(query.page || (query.limit && query.limit > 0));
    const isFetchAll = query.all === true || query.limit === -1 || query.limit === 0 || !isPaginated;
    const limit = isFetchAll ? 0 : (query.limit && query.limit > 0 ? query.limit : 10);

    if (limit > 0) {
      const skip = (page - 1) * limit;
      queryBuilder = queryBuilder.skip(skip).limit(limit);
    }

    const variants = await queryBuilder.lean();

    // 4. Stock balances only for the returned slice of items
    const variantIds = variants.map((v: any) => v._id);
    const variantSkus = variants.map((v: any) => v.sku);
    const stockQuery: any = {
      $or: [{ variantId: { $in: variantIds } }, { sku: { $in: variantSkus } }],
    };
    if (query.branchId) {
      stockQuery.branchId = query.branchId;
    }
    const stockBalances = await StockBalance.find(stockQuery).lean();
    const stockMap = new Map<string, { onHand: number; reorderLevel: number }>();
    stockBalances.forEach((sb: any) => {
      const existing = stockMap.get(sb.sku) || { onHand: 0, reorderLevel: sb.reorderLevel ?? 5 };
      existing.onHand += sb.onHand || 0;
      stockMap.set(sb.sku, existing);
    });

    const items = variants.map((v: any) => {
      const stockInfo = stockMap.get(v.sku) || { onHand: 0, reorderLevel: 5 };
      const p = v.productId;
      const pId = p?._id ? p._id.toString() : p?.toString() || '';
      const b = p?.brandId;
      const c = p?.categoryId;
      const pl = p?.productLineId;
      const bId = b?._id ? b._id.toString() : b?.toString() || '';
      const cId = c?._id ? c._id.toString() : c?.toString() || '';
      const plId = pl?._id ? pl._id.toString() : pl?.toString() || '';
      const sId = v.sizeId?._id ? v.sizeId._id.toString() : v.sizeId?.toString() || '';
      const tId = v.thicknessId?._id ? v.thicknessId._id.toString() : v.thicknessId?.toString() || '';

      const baseObj: any = {
        id: v._id.toString(),
        sku: v.sku,
        posDisplayName: v.posDisplayName || '',
        productName: p?.name || 'Mattress',
        productId: pId,
        brandId: bId,
        branchId: p?.branchId?.toString() || '',
        categoryId: cId,
        productLineId: plId,
        productLineName: pl?.name || '',
        sizeId: sId,
        thicknessId: tId,
        brand: b,
        category: c,
        productLine: pl,
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

    return {
      items,
      pagination: {
        page,
        limit: limit > 0 ? limit : total,
        total,
        totalPages: limit > 0 ? (Math.ceil(total / limit) || 1) : 1,
      },
      counts: {
        total,
        active: activeCount,
        inactive: Math.max(0, total - activeCount),
      },
    };
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
          { path: 'productLineId', select: 'name code' },
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
      distributorPrice: toRupees(variant.distributorPrice || 0),
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
          { path: 'productLineId' },
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
    const currentLine = currentProd?.productLineId;
    const currentSize = variant.sizeId as any;
    const currentThick = variant.thicknessId as any;

    const brand = input.brandId
      ? await resolveEntity(Brand, input.brandId)
      : currentBrand;
    const category = input.categoryId
      ? await resolveEntity(Category, input.categoryId)
      : currentCat;
    const productLine = input.productLineId
      ? await resolveEntity(ProductLine, input.productLineId)
      : (currentLine?._id ? currentLine : (currentLine ? await resolveEntity(ProductLine, currentLine.toString()) : null));
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

    // Preserve product identity: do NOT reassign to an arbitrary product if hierarchy is unchanged
    let product: any = null;
    const currentBrandIdStr = (currentBrand?._id || currentBrand)?.toString();
    const currentCatIdStr = (currentCat?._id || currentCat)?.toString();
    const currentLineIdStr = (currentLine?._id || currentLine)?.toString();

    const targetBrandIdStr = brand?._id?.toString();
    const targetCatIdStr = category?._id?.toString();
    const targetLineIdStr = productLine?._id?.toString();

    const isProductHierarchySame =
      currentProd &&
      currentBrandIdStr === targetBrandIdStr &&
      currentCatIdStr === targetCatIdStr &&
      (!targetLineIdStr || currentLineIdStr === targetLineIdStr);

    if (isProductHierarchySame) {
      product = currentProd;
      if (productLine && !currentProd.productLineId) {
        product.productLineId = productLine._id;
        await product.save();
      }
    } else {
      const prodQuery: any = {
        brandId: brand._id,
        categoryId: category._id,
      };
      if (productLine) {
        prodQuery.productLineId = productLine._id;
      }
      if (currentProd?.branchId) {
        prodQuery.branchId = currentProd.branchId;
      }
      product = await Product.findOne(prodQuery);
      if (!product) {
        const lineSuffix = productLine?.name ? ` - ${productLine.name}` : '';
        product = await Product.create({
          brandId: brand._id,
          categoryId: category._id,
          ...(productLine ? { productLineId: productLine._id } : {}),
          ...(currentProd?.branchId ? { branchId: currentProd.branchId } : {}),
          name: `${brand.name} - ${category.name}${lineSuffix}`,
          imageUrl: input.imageUrl?.trim() || '',
          status: 'ACTIVE',
        });
      }
    }

    if (input.imageUrl && input.imageUrl.trim() && product) {
      product.imageUrl = input.imageUrl.trim();
      await product.save();
    }

    variant.productId = product._id;
    variant.sizeId = size._id;
    variant.thicknessId = thickness._id;

    // Check for duplicate variant under the target product
    const duplicateVariant = await Variant.findOne({
      _id: { $ne: variant._id },
      productId: product._id,
      sizeId: size._id,
      thicknessId: thickness._id,
    });
    if (duplicateVariant) {
      throw new AppError(
        `A variant with size '${size.displayLabel}' and thickness '${thickness.displayLabel || thickness.value}' already exists for product '${product.name}' (SKU: ${duplicateVariant.sku}).`,
        409,
        'DUPLICATE_VARIANT'
      );
    }

    // Check if specifications actually changed before mutating SKU
    const isSpecChanged =
      (input.brandId && input.brandId !== currentBrandIdStr) ||
      (input.categoryId && input.categoryId !== currentCatIdStr) ||
      (input.productLineId && input.productLineId !== currentLineIdStr) ||
      (input.sizeId && input.sizeId !== currentSize?._id?.toString()) ||
      (input.thicknessId && input.thicknessId !== currentThick?._id?.toString());

    if (isSpecChanged) {
      const plCode = productLine?.name || productLine?.code;
      const newSku = generateSkuCode(brand.code, category.code, size.displayLabel, thickness.value, plCode);
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

      const branchAndLoc = await this.resolvePrimaryBranchAndLocation();

      if (!stockDoc && branchAndLoc) {
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

      if (stockDoc) {
        if (!stockDoc.variantId) {
          stockDoc.variantId = variant._id;
        }

        // Auto-heal missing stockLocationId or branchId so location error never happens
        if (!stockDoc.stockLocationId && branchAndLoc?.location) {
          stockDoc.stockLocationId = branchAndLoc.location._id;
        }
        if (!stockDoc.branchId && branchAndLoc?.branch) {
          stockDoc.branchId = branchAndLoc.branch._id;
        }

        const effectiveLocId = stockDoc.stockLocationId || branchAndLoc?.location?._id;
        const effectiveBranchId = stockDoc.branchId || branchAndLoc?.branch?._id;

        if (input.stock !== undefined) {
          const oldOnHand = stockDoc.onHand || 0;
          const newOnHand = Math.max(0, input.stock);
          if (oldOnHand !== newOnHand && effectiveLocId && effectiveBranchId) {
            stockDoc.onHand = newOnHand;
            await StockMovement.create({
              movementNumber: `MOV-EDIT-${variant.sku}-${Date.now().toString().slice(-6)}`,
              branchId: effectiveBranchId,
              stockLocationId: effectiveLocId,
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

    try {
      await variant.save();
    } catch (saveErr: any) {
      if (saveErr?.code === 11000) {
        throw new AppError(
          `A variant with these specifications or SKU already exists in this product catalogue.`,
          409,
          'DUPLICATE_VARIANT'
        );
      }
      throw saveErr;
    }

    if (auditHistoryRecords.length > 0) {
      await PriceHistory.insertMany(auditHistoryRecords);
    }

    const finalStockDoc =
      (await StockBalance.findOne({ variantId: variant._id })) ||
      (await StockBalance.findOne({ sku: variant.sku }));

    PosService.invalidatePOSCache();

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
      distributorPrice: toRupees(variant.distributorPrice || 0),
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

  public static async importCatalogueFromRows(
    rows: any[],
    callerBranchId?: string,
    options?: { updateDuplicates?: boolean }
  ): Promise<{
    totalRows: number;
    successCount: number;
    duplicateCount: number;
    updatedCount: number;
    duplicates: Array<{
      itemNo: string;
      posDisplayName: string;
      brand: string;
      category: string;
      productLine: string;
      size: string;
      height: number;
      reason: string;
    }>;
    created: Array<any>;
    updated: Array<any>;
  }> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError('No rows provided for import.', 400, 'EMPTY_IMPORT_DATA');
    }

    // Resolve branch and stock location
    let targetBranch: any = null;
    if (callerBranchId && mongoose.Types.ObjectId.isValid(callerBranchId)) {
      targetBranch = await Branch.findById(callerBranchId);
    }
    if (!targetBranch) {
      targetBranch = await Branch.findOne({ isActive: true });
    }
    if (!targetBranch) {
      targetBranch = await Branch.findOne({});
    }

    let targetLocation: any = null;
    if (targetBranch) {
      targetLocation = await StockLocation.findOne({ branchId: targetBranch._id, isDefault: true })
        || await StockLocation.findOne({ branchId: targetBranch._id });
      if (!targetLocation) {
        targetLocation = await StockLocation.create({
          branchId: targetBranch._id,
          name: `${targetBranch.name} - Main Location`,
          code: `LOC-MAIN-${targetBranch.code || 'MAIN'}`,
          type: 'WAREHOUSE',
          isDefault: true,
        });
      }
    }

    // Pre-load all catalogue metadata in parallel (1 single fast fetch)
    const [allBrands, allCategories, allLines, allProducts, allSizes, allThicks, allVariants, allBalances] = await Promise.all([
      Brand.find({}).lean(),
      Category.find({}).lean(),
      ProductLine.find({}).lean(),
      Product.find({}).lean(),
      Size.find({}).lean(),
      Thickness.find({}).lean(),
      Variant.find({}).select('_id productId sizeId thicknessId sku listPrice retailPrice wholesalePrice distributorPrice notes minStock posDisplayName').lean(),
      targetBranch ? StockBalance.find({ branchId: targetBranch._id }).lean() : Promise.resolve([]),
    ]);

    const brandsCache = new Map<string, any>();
    const categoriesCache = new Map<string, any>();
    const productLinesCache = new Map<string, any>();
    const productsCache = new Map<string, any>();
    const sizesCache = new Map<string, any>();
    const thicknessesCache = new Map<string, any>();

    // Seed caches from DB
    for (const b of allBrands) {
      brandsCache.set(b.name.toLowerCase(), b);
      if (b.code) brandsCache.set(b.code.toLowerCase(), b);
    }
    for (const c of allCategories) {
      categoriesCache.set(`${c.brandId.toString()}::${c.name.toLowerCase()}`, c);
    }
    for (const pl of allLines) {
      productLinesCache.set(`${pl.brandId.toString()}::${pl.categoryId.toString()}::${pl.name.toLowerCase()}`, pl);
      productLinesCache.set(pl.code.toUpperCase(), pl);
    }
    for (const p of allProducts) {
      const plId = p.productLineId ? p.productLineId.toString() : '';
      productsCache.set(`${p.brandId.toString()}::${p.categoryId.toString()}::${plId}`, p);
    }
    for (const s of allSizes) {
      sizesCache.set(`${s.length}x${s.width}_${(s.displayLabel || '').toLowerCase()}`, s);
      sizesCache.set(`${s.length}x${s.width}`, s);
    }
    for (const t of allThicks) {
      thicknessesCache.set(`${t.value}`, t);
    }

    // Existing variants index by productId + sizeId + thicknessId
    const existingVariantMap = new Map<string, any>();
    const existingSkuSet = new Set<string>();

    for (const v of allVariants) {
      if (v.productId && v.sizeId && v.thicknessId) {
        existingVariantMap.set(`${v.productId.toString()}::${v.sizeId.toString()}::${v.thicknessId.toString()}`, v);
      }
      if (v.sku) existingSkuSet.add(v.sku.toUpperCase());
    }

    // Existing balance index by variantId and sku
    const existingBalanceMap = new Map<string, any>();
    for (const b of allBalances) {
      if (b.variantId) existingBalanceMap.set(b.variantId.toString(), b);
      if (b.sku) existingBalanceMap.set(b.sku.toUpperCase(), b);
    }

    // Bulk collection buffers for high-speed batch operations
    const variantsToInsert: any[] = [];
    const priceHistoriesToInsert: any[] = [];
    const stockBalancesToInsert: any[] = [];
    const stockMovementsToInsert: any[] = [];

    const variantBulkUpdates: any[] = [];
    const balanceBulkOps: any[] = [];
    const syncPriceHistories: any[] = [];
    const syncStockMovements: any[] = [];

    const duplicates: Array<any> = [];
    const created: Array<any> = [];
    const updated: Array<any> = [];
    const seenInFile = new Set<string>();
    const now = new Date();

    const getCol = (row: any, ...keys: string[]): string => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          return String(row[k]).trim();
        }
        const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerKey) {
            if (row[rowKey] !== undefined && row[rowKey] !== null && String(row[rowKey]).trim() !== '') {
              return String(row[rowKey]).trim();
            }
          }
        }
      }
      return '';
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const itemNo = getCol(row, 'Item #', 'Item', 'Item No', 'No', '#') || (i + 1).toString();
      const brandRaw = getCol(row, 'Brand');
      const categoryRaw = getCol(row, 'Category');
      const productLineRaw = getCol(row, 'Product Line', 'ProductLine', 'Line');

      // Skip completely empty lines
      if (!brandRaw && !categoryRaw && !productLineRaw) continue;

      const brandName = brandRaw || 'MoltyFoam';
      const categoryName = categoryRaw || 'General';
      const productLineName = productLineRaw || 'Standard';

      const posDisplayNameRaw = getCol(row, 'POS Display Name', 'POSDisplayName', 'POS Name', 'DisplayName');
      const lengthRaw = getCol(row, 'Length (in)', 'Length', 'L');
      const widthRaw = getCol(row, 'Width (in)', 'Width', 'W');
      const heightRaw = getCol(row, 'Height (in)', 'Height', 'Thickness (in)', 'Thickness', 'Depth');
      const displayLabelRaw = getCol(row, 'Display label', 'Display Label', 'Size');
      const notes = getCol(row, 'Variant / Notes', 'Variant', 'Notes', 'Description') || 'Standard';
      const stockRaw = getCol(row, 'Current Stock', 'Stock', 'Qty', 'Quantity');
      const minStockRaw = getCol(row, 'Minimum Stock', 'Min Stock', 'MinStock', 'Reorder Level');
      const priceRaw = getCol(row, 'List Price', 'Price', 'Retail Price', 'ListPrice');
      const effectiveDateRaw = getCol(row, 'Effective Date', 'Date');

      let length = parseFloat(lengthRaw) || 0;
      let width = parseFloat(widthRaw) || 0;
      let height = parseFloat(heightRaw) || 0;

      if ((length === 0 || width === 0) && displayLabelRaw) {
        const parts = displayLabelRaw.toLowerCase().split(/[x*×]/);
        if (parts.length >= 2) {
          length = parseFloat(parts[0]) || 0;
          width = parseFloat(parts[1]) || 0;
          if (parts.length >= 3 && height === 0) {
            height = parseFloat(parts[2]) || 0;
          }
        }
      }

      const displayLabel = (length > 0 && width > 0)
        ? `${length}x${width}`
        : (displayLabelRaw || 'Standard');

      const posDisplayName = posDisplayNameRaw || `${productLineName} ${displayLabel}${height > 0 ? `x${height}` : ''}`;

      const fileKey = `${brandName.toLowerCase()}::${categoryName.toLowerCase()}::${productLineName.toLowerCase()}::${displayLabel.toLowerCase()}::${height}`;
      if (seenInFile.has(fileKey)) {
        duplicates.push({
          itemNo,
          posDisplayName,
          brand: brandName,
          category: categoryName,
          productLine: productLineName,
          size: displayLabel,
          height,
          reason: 'Duplicate entry in uploaded file',
        });
        continue;
      }
      seenInFile.add(fileKey);

      const cleanPriceStr = priceRaw.replace(/[^0-9.]/g, '');
      const listPrice = parseFloat(cleanPriceStr) || 0;
      const currentStock = parseInt(stockRaw.replace(/[^0-9-]/g, ''), 10) || 0;
      const minStock = parseInt(minStockRaw.replace(/[^0-9-]/g, ''), 10) || 0;
      let effectiveDate = new Date();
      if (effectiveDateRaw) {
        const parsedD = new Date(effectiveDateRaw);
        if (!isNaN(parsedD.getTime())) effectiveDate = parsedD;
      }

      // 1. Resolve Brand
      const brandKey = brandName.toLowerCase();
      let brand = brandsCache.get(brandKey);
      if (!brand) {
        brand = await Brand.findOne({
          $or: [
            { name: { $regex: new RegExp(`^${brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
            { code: brandName.toUpperCase() },
          ],
        });
        if (!brand) {
          const brandCode = brandName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'BRD';
          brand = await Brand.create({
            name: brandName,
            code: brandCode,
            status: 'ACTIVE',
            ...(targetBranch ? { branchId: targetBranch._id } : {}),
          });
        }
        brandsCache.set(brandKey, brand);
      }

      // 2. Resolve Category
      const catKey = `${brand._id.toString()}::${categoryName.toLowerCase()}`;
      let category = categoriesCache.get(catKey);
      if (!category) {
        category = await Category.findOne({
          brandId: brand._id,
          name: { $regex: new RegExp(`^${categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });
        if (!category) {
          const catCode = `${categoryName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4)}-${brand.code.slice(0, 3)}`;
          category = await Category.create({
            brandId: brand._id,
            name: categoryName,
            code: catCode,
            status: 'ACTIVE',
            ...(targetBranch ? { branchId: targetBranch._id } : {}),
          });
        }
        categoriesCache.set(catKey, category);
      }

      // 3. Resolve Product Line
      const plKey = `${brand._id.toString()}::${category._id.toString()}::${productLineName.toLowerCase()}`;
      let productLine = productLinesCache.get(plKey);
      if (!productLine) {
        productLine = await ProductLine.findOne({
          brandId: brand._id,
          categoryId: category._id,
          name: { $regex: new RegExp(`^${productLineName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });
        if (!productLine) {
          const plCode = `PL-${productLineName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)}`;
          let candidateCode = plCode;
          let plCount = 1;
          while (await ProductLine.findOne({ code: candidateCode })) {
            candidateCode = `${plCode}-${plCount++}`;
          }
          productLine = await ProductLine.create({
            brandId: brand._id,
            categoryId: category._id,
            name: productLineName,
            code: candidateCode,
            status: 'ACTIVE',
            ...(targetBranch ? { branchId: targetBranch._id } : {}),
          });
        }
        productLinesCache.set(plKey, productLine);
      }

      // 4. Resolve Base Product
      const prodKey = `${brand._id.toString()}::${category._id.toString()}::${productLine._id.toString()}`;
      let product = productsCache.get(prodKey);
      if (!product) {
        product = await Product.findOne({
          brandId: brand._id,
          categoryId: category._id,
          productLineId: productLine._id,
        });
        if (!product) {
          product = await Product.create({
            brandId: brand._id,
            categoryId: category._id,
            productLineId: productLine._id,
            name: productLineName,
            posDisplayName,
            code: productLine.code,
            status: 'ACTIVE',
            ...(targetBranch ? { branchId: targetBranch._id } : {}),
          });
        }
        productsCache.set(prodKey, product);
      }

      // 5. Resolve Size (with smart fallback and race-safe catch)
      const targetLength = length > 0 ? length : 78;
      const targetWidth = width > 0 ? width : 72;
      const sizeKey = `${targetLength}x${targetWidth}_${displayLabel.toLowerCase()}`;
      let size = sizesCache.get(sizeKey);
      if (!size) {
        size = await Size.findOne({
          $or: [
            { length: targetLength, width: targetWidth },
            { displayLabel: { $regex: new RegExp(`^${displayLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          ],
        });
        if (!size) {
          try {
            size = await Size.create({
              length: targetLength,
              width: targetWidth,
              unit: 'in',
              displayLabel,
              status: 'ACTIVE',
            });
          } catch {
            size = await Size.findOne({
              $or: [
                { length: targetLength, width: targetWidth },
                { displayLabel },
              ],
            });
            if (!size) size = await Size.findOne({});
          }
        }
        if (size) sizesCache.set(sizeKey, size);
      }

      // 6. Resolve Thickness (pehle targetHeight nikalenge taake value: 4 search ho aur duplicate error na aaye)
      const targetHeight = height > 0 ? height : 4;
      const thickKey = `${targetHeight}`;
      let thickness = thicknessesCache.get(thickKey);
      if (!thickness) {
        thickness = await Thickness.findOne({ value: targetHeight });
        if (!thickness) {
          try {
            thickness = await Thickness.create({
              value: targetHeight,
              unit: 'in',
              displayLabel: `${targetHeight}"`,
              status: 'ACTIVE',
            });
          } catch {
            thickness = await Thickness.findOne({ value: targetHeight });
            if (!thickness) thickness = await Thickness.findOne({});
          }
        }
        if (thickness) thicknessesCache.set(thickKey, thickness);
      }

      // 7. Instant In-Memory Duplicate Check (O(1))
      const varKey = `${product._id.toString()}::${size._id.toString()}::${thickness._id.toString()}`;
      const existingVariant = existingVariantMap.get(varKey);

      if (existingVariant) {
        if (options?.updateDuplicates) {
          const pricePaisa = toPaisa(listPrice);
          const varId = existingVariant._id;

          // Queue variant price & detail update
          variantBulkUpdates.push({
            updateOne: {
              filter: { _id: varId },
              update: {
                $set: {
                  listPrice: pricePaisa,
                  purchasePrice: pricePaisa,
                  retailPrice: pricePaisa,
                  wholesalePrice: pricePaisa,
                  distributorPrice: pricePaisa,
                  ...(posDisplayNameRaw ? { posDisplayName } : {}),
                  ...(notes ? { notes } : {}),
                  minStock,
                },
              },
            },
          });

          // Queue Price History
          syncPriceHistories.push({
            variantId: varId,
            sku: existingVariant.sku,
            tier: 'RETAIL',
            previousPrice: existingVariant.retailPrice || 0,
            newPrice: pricePaisa,
            reason: 'EXCEL_CATALOGUE_SYNC',
            createdAt: now,
            updatedAt: now,
          });

          // Stock balance handling
          if (targetBranch && targetLocation) {
            const existingBal =
              existingBalanceMap.get(varId.toString()) ||
              existingBalanceMap.get((existingVariant.sku || '').toUpperCase());

            const prevOnHand = existingBal ? (existingBal.onHand || 0) : 0;

            if (existingBal) {
              balanceBulkOps.push({
                updateOne: {
                  filter: { _id: existingBal._id },
                  update: {
                    $set: {
                      onHand: currentStock,
                      reorderLevel: minStock,
                      stockLocationId: existingBal.stockLocationId || targetLocation._id,
                    },
                  },
                },
              });
              existingBal.onHand = currentStock;
            } else {
              const newBalId = new mongoose.Types.ObjectId();
              const newBalDoc = {
                _id: newBalId,
                branchId: targetBranch._id,
                stockLocationId: targetLocation._id,
                variantId: varId,
                sku: existingVariant.sku,
                onHand: currentStock,
                reserved: 0,
                reorderLevel: minStock,
                createdAt: now,
                updatedAt: now,
              };
              balanceBulkOps.push({ insertOne: { document: newBalDoc } });
              existingBalanceMap.set(varId.toString(), newBalDoc);
              existingBalanceMap.set((existingVariant.sku || '').toUpperCase(), newBalDoc);
            }

            if (currentStock !== prevOnHand) {
              syncStockMovements.push({
                movementNumber: `MOV-SYNC-${existingVariant.sku}-${Date.now().toString().slice(-6)}-${updated.length + 1}`,
                branchId: targetBranch._id,
                stockLocationId: targetLocation._id,
                sku: existingVariant.sku,
                movementType: 'ADMINISTRATIVE_ADJUSTMENT',
                quantityDifference: currentStock - prevOnHand,
                previousBalance: prevOnHand,
                newBalance: currentStock,
                referenceType: 'EXCEL_SYNC',
                reason: `Excel catalogue sync stock update (${itemNo})`,
                performedBy: 'System',
                timestamp: now,
                createdAt: now,
                updatedAt: now,
              });
            }
          }

          updated.push({
            itemNo,
            sku: existingVariant.sku,
            posDisplayName,
            brand: brandName,
            category: categoryName,
            productLine: productLineName,
            size: displayLabel,
            height: targetHeight,
            price: listPrice,
            stock: currentStock,
          });
          continue;
        }

        duplicates.push({
          itemNo,
          posDisplayName,
          brand: brandName,
          category: categoryName,
          productLine: productLineName,
          size: displayLabel,
          height: targetHeight,
          reason: `Already exists in database (SKU: ${existingVariant.sku})`,
        });
        continue;
      }

      // 8. Generate Unique SKU (Instant in-memory uniqueness verification)
      const baseSku = generateSkuCode(brand.code, category.code, size.displayLabel, thickness.value, productLine.name || productLine.code);
      let uniqueSku = baseSku;
      let skuSuffix = 1;
      while (existingSkuSet.has(uniqueSku.toUpperCase())) {
        uniqueSku = `${baseSku}-${skuSuffix++}`;
      }
      existingSkuSet.add(uniqueSku.toUpperCase());

      // 9. Pricing rule: listPrice = retailPrice = wholesalePrice
      const pricePaisa = toPaisa(listPrice);
      const newVariantId = new mongoose.Types.ObjectId();

      const newVariantDoc = {
        _id: newVariantId,
        productId: product._id,
        sizeId: size._id,
        thicknessId: thickness._id,
        sku: uniqueSku,
        posDisplayName,
        notes,
        minStock,
        listPrice: pricePaisa,
        purchasePrice: pricePaisa,
        retailPrice: pricePaisa,
        wholesalePrice: pricePaisa,
        distributorPrice: pricePaisa,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };

      variantsToInsert.push(newVariantDoc);
      existingVariantMap.set(varKey, newVariantDoc);

      // 10. Initial Price History Record (in-memory buffer)
      priceHistoriesToInsert.push({
        variantId: newVariantId,
        sku: uniqueSku,
        tier: 'RETAIL',
        previousPrice: 0,
        newPrice: pricePaisa,
        reason: 'EXCEL_CATALOGUE_IMPORT',
        createdAt: now,
        updatedAt: now,
      });

      // 11. Initial Stock Balance (in-memory buffer)
      if (targetBranch && targetLocation) {
        stockBalancesToInsert.push({
          branchId: targetBranch._id,
          stockLocationId: targetLocation._id,
          variantId: newVariantId,
          sku: uniqueSku,
          onHand: currentStock,
          reserved: 0,
          reorderLevel: minStock,
          createdAt: now,
          updatedAt: now,
        });

        if (currentStock > 0) {
          stockMovementsToInsert.push({
            movementNumber: `MOV-INIT-${uniqueSku}-${Date.now().toString().slice(-6)}-${created.length + 1}`,
            branchId: targetBranch._id,
            stockLocationId: targetLocation._id,
            sku: uniqueSku,
            movementType: 'OPENING_BALANCE',
            quantityDifference: currentStock,
            previousBalance: 0,
            newBalance: currentStock,
            referenceType: 'EXCEL_IMPORT',
            reason: `Excel catalogue initial stock import (${itemNo})`,
            performedBy: 'System',
            timestamp: now,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      created.push({
        itemNo,
        sku: uniqueSku,
        posDisplayName,
        brand: brandName,
        category: categoryName,
        productLine: productLineName,
        size: displayLabel,
        height: targetHeight,
        price: listPrice,
        stock: currentStock,
      });
    }

    // =========================================================================
    // HIGH-SPEED BATCH EXECUTION: Flush all buffers in bulk chunks (1000 items)
    // =========================================================================
    const BATCH_SIZE = 1000;

    if (variantsToInsert.length > 0) {
      for (let b = 0; b < variantsToInsert.length; b += BATCH_SIZE) {
        await Variant.insertMany(variantsToInsert.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    if (priceHistoriesToInsert.length > 0) {
      for (let b = 0; b < priceHistoriesToInsert.length; b += BATCH_SIZE) {
        await PriceHistory.insertMany(priceHistoriesToInsert.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    if (stockBalancesToInsert.length > 0) {
      for (let b = 0; b < stockBalancesToInsert.length; b += BATCH_SIZE) {
        await StockBalance.insertMany(stockBalancesToInsert.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    if (stockMovementsToInsert.length > 0) {
      for (let b = 0; b < stockMovementsToInsert.length; b += BATCH_SIZE) {
        await StockMovement.insertMany(stockMovementsToInsert.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    // Flush duplicate updates
    if (variantBulkUpdates.length > 0) {
      for (let b = 0; b < variantBulkUpdates.length; b += BATCH_SIZE) {
        await Variant.bulkWrite(variantBulkUpdates.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    if (balanceBulkOps.length > 0) {
      for (let b = 0; b < balanceBulkOps.length; b += BATCH_SIZE) {
        await StockBalance.bulkWrite(balanceBulkOps.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    if (syncPriceHistories.length > 0) {
      for (let b = 0; b < syncPriceHistories.length; b += BATCH_SIZE) {
        await PriceHistory.insertMany(syncPriceHistories.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    if (syncStockMovements.length > 0) {
      for (let b = 0; b < syncStockMovements.length; b += BATCH_SIZE) {
        await StockMovement.insertMany(syncStockMovements.slice(b, b + BATCH_SIZE), { ordered: false });
      }
    }

    PosService.invalidatePOSCache();

    return {
      totalRows: rows.length,
      successCount: created.length,
      duplicateCount: duplicates.length,
      updatedCount: updated.length,
      duplicates,
      created,
      updated,
    };
  }
}
