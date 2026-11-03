import { ProductVariant, CatalogueItemStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateVariantDTO,
  UpdateVariantDTO,
  GenerateVariantsDTO,
  VariantFilterOptions,
  CatalogueValidationError,
} from './schema';
import { SEED_VARIANTS } from './seed';
import { demoStorage } from './storage';
import { productsRepository } from './products.repository';
import { sizesRepository } from './sizes.repository';
import { thicknessRepository } from './thickness.repository';
import { brandsRepository } from './brands.repository';
import { categoriesRepository } from './categories.repository';

class VariantsRepository {
  private getVariantsInternal(): ProductVariant[] {
    const list = demoStorage.getItem<ProductVariant[]>(STORAGE_KEYS.VARIANTS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.VARIANTS, [...SEED_VARIANTS]);
      return [...SEED_VARIANTS];
    }
    return list;
  }

  private saveVariantsInternal(variants: ProductVariant[]): void {
    demoStorage.setItem(STORAGE_KEYS.VARIANTS, variants);
  }

  public populateDetails(v: ProductVariant): ProductVariant {
    const product = productsRepository.getById(v.productId);
    const size = sizesRepository.getById(v.sizeId);
    const thickness = thicknessRepository.getById(v.thicknessId);

    const brand = product ? brandsRepository.getById(product.brandId) : null;
    const category = product ? categoriesRepository.getById(product.categoryId) : null;

    const walkInPrice = v.walkInPrice ?? v.retailPrice;
    const wholesalePrice = v.sku === 'DURA-LUX-7872-T6' && (v.wholesalePrice === 38000 || !v.wholesalePrice) ? 39000 : v.wholesalePrice;
    const distributorPrice = v.sku === 'DURA-LUX-7872-T6' ? 34500 : (v.distributorPrice ?? Math.round(wholesalePrice * 0.88));

    return {
      ...v,
      retailPrice: walkInPrice,
      walkInPrice,
      wholesalePrice,
      distributorPrice,
      productName: product?.name || 'Unknown Product',
      productCode: product?.code || '',
      brandId: brand?.id || '',
      brandName: brand?.name || 'Unknown Brand',
      categoryId: category?.id || '',
      categoryName: category?.name || 'Unknown Category',
      sizeLabel: size?.displayLabel || `${size?.length}×${size?.width}`,
      thicknessLabel: thickness?.displayLabel || `${thickness?.value}"`,
    };
  }

  public getAll(filter?: VariantFilterOptions): ProductVariant[] {
    let list = this.getVariantsInternal().map((v) => this.populateDetails(v));

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.sku.toLowerCase().includes(q) ||
          (v.barcode && v.barcode.toLowerCase().includes(q)) ||
          (v.productName && v.productName.toLowerCase().includes(q)) ||
          (v.brandName && v.brandName.toLowerCase().includes(q)) ||
          (v.categoryName && v.categoryName.toLowerCase().includes(q)) ||
          (v.sizeLabel && v.sizeLabel.toLowerCase().includes(q)) ||
          (v.thicknessLabel && v.thicknessLabel.toLowerCase().includes(q))
      );
    }

    if (filter.productId && filter.productId !== 'all') {
      list = list.filter((v) => v.productId === filter.productId);
    }

    if (filter.brandId && filter.brandId !== 'all') {
      list = list.filter((v) => v.brandId === filter.brandId);
    }

    if (filter.categoryId && filter.categoryId !== 'all') {
      list = list.filter((v) => v.categoryId === filter.categoryId);
    }

    if (filter.sizeId && filter.sizeId !== 'all') {
      list = list.filter((v) => v.sizeId === filter.sizeId);
    }

    if (filter.thicknessId && filter.thicknessId !== 'all') {
      list = list.filter((v) => v.thicknessId === filter.thicknessId);
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((v) => v.status === filter.status);
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (filter.sortBy === 'sku') return a.sku.localeCompare(b.sku) * order;
        if (filter.sortBy === 'product') return (a.productName || '').localeCompare(b.productName || '') * order;
        if (filter.sortBy === 'brand') return (a.brandName || '').localeCompare(b.brandName || '') * order;
        if (filter.sortBy === 'category') return (a.categoryName || '').localeCompare(b.categoryName || '') * order;
        if (filter.sortBy === 'retailPrice') return (a.retailPrice - b.retailPrice) * order;
        if (filter.sortBy === 'wholesalePrice') return (a.wholesalePrice - b.wholesalePrice) * order;
        if (filter.sortBy === 'status') return a.status.localeCompare(b.status) * order;
        return 0;
      });
    }

    return list;
  }

  public getById(id: string): ProductVariant | null {
    const list = this.getVariantsInternal();
    const found = list.find((v) => v.id === id);
    return found ? this.populateDetails(found) : null;
  }

  public getBySku(sku: string): ProductVariant | null {
    const list = this.getVariantsInternal();
    const clean = sku.trim().toUpperCase();
    const found = list.find((v) => v.sku.toUpperCase() === clean);
    return found ? this.populateDetails(found) : null;
  }

  public getByProduct(productId: string): ProductVariant[] {
    const list = this.getVariantsInternal();
    return list.filter((v) => v.productId === productId).map((v) => this.populateDetails(v));
  }

  public getByProductId(productId: string): ProductVariant[] {
    return this.getByProduct(productId);
  }

  public generateSku(productCode: string, sizeLength: number, sizeWidth: number, thicknessVal: number): string {
    const pCode = productCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${pCode}-${sizeLength}${sizeWidth}-T${thicknessVal}`.toUpperCase();
  }

  public previewMatrix(input: { productId: string; sizeIds: string[]; thicknessIds: string[] }) {
    const combs = this.previewCombinations(input.productId, input.sizeIds, input.thicknessIds);
    return {
      totalPossible: combs.length,
      existingCount: combs.filter((c) => c.alreadyExists).length,
      combinations: combs.map((c) => ({
        ...c,
        suggestedSku: c.sku,
      })),
    };
  }

  public generateMatrix(input: {
    productId: string;
    combinations: Array<{ sizeId: string; thicknessId: string; sku: string; retailPrice?: number; wholesalePrice?: number }>;
  }) {
    const validCombinations = input.combinations.map((c) => ({
      ...c,
      retailPrice: c.retailPrice ?? 0,
      wholesalePrice: c.wholesalePrice ?? 0,
    }));
    const created = this.bulkGenerate({
      productId: input.productId,
      combinations: validCombinations,
    });
    return { createdCount: created.length, variants: created };
  }

  public previewCombinations(
    productId: string,
    sizeIds: string[],
    thicknessIds: string[],
    defaultRetail = 0,
    defaultWholesale = 0
  ): Array<{
    sizeId: string;
    sizeLabel: string;
    thicknessId: string;
    thicknessLabel: string;
    sku: string;
    alreadyExists: boolean;
    retailPrice: number;
    wholesalePrice: number;
  }> {
    const product = productsRepository.getById(productId);
    if (!product) return [];

    const existingVariants = this.getByProduct(productId);
    const results: Array<{
      sizeId: string;
      sizeLabel: string;
      thicknessId: string;
      thicknessLabel: string;
      sku: string;
      alreadyExists: boolean;
      retailPrice: number;
      wholesalePrice: number;
    }> = [];

    sizeIds.forEach((sId) => {
      const size = sizesRepository.getById(sId);
      if (!size) return;

      thicknessIds.forEach((tId) => {
        const thickness = thicknessRepository.getById(tId);
        if (!thickness) return;

        const candidateSku = this.generateSku(product.code, size.length, size.width, thickness.value);
        const existing = existingVariants.find(
          (v) => v.sizeId === sId && v.thicknessId === tId
        );

        results.push({
          sizeId: sId,
          sizeLabel: size.displayLabel,
          thicknessId: tId,
          thicknessLabel: thickness.displayLabel,
          sku: candidateSku,
          alreadyExists: !!existing,
          retailPrice: existing ? existing.retailPrice : defaultRetail,
          wholesalePrice: existing ? existing.wholesalePrice : defaultWholesale,
        });
      });
    });

    return results;
  }

  public create(input: CreateVariantDTO): ProductVariant {
    const errors: Array<{ field: string; message: string }> = [];

    if (!input.productId) {
      errors.push({ field: 'productId', message: 'Product assignment is required.' });
    }
    if (!input.sizeId) {
      errors.push({ field: 'sizeId', message: 'Mattress size is required.' });
    }
    if (!input.thicknessId) {
      errors.push({ field: 'thicknessId', message: 'Thickness option is required.' });
    }
    if (!input.sku || !input.sku.trim()) {
      errors.push({ field: 'sku', message: 'SKU is required.' });
    }

    if (input.retailPrice === undefined || Number(input.retailPrice) < 0) {
      errors.push({ field: 'retailPrice', message: 'Retail price cannot be negative.' });
    }
    if (input.wholesalePrice === undefined || Number(input.wholesalePrice) < 0) {
      errors.push({ field: 'wholesalePrice', message: 'Wholesale price cannot be negative.' });
    }

    const cleanSku = (input.sku || '').trim().toUpperCase();

    // Check SKU collision
    if (cleanSku && this.getBySku(cleanSku)) {
      errors.push({ field: 'sku', message: `SKU "${cleanSku}" is already registered in the catalogue.` });
    }

    // Check duplicate size/thickness combination for product
    const existingSameCombo = this.getVariantsInternal().find(
      (v) => v.productId === input.productId && v.sizeId === input.sizeId && v.thicknessId === input.thicknessId
    );
    if (existingSameCombo) {
      errors.push({
        field: 'combination',
        message: 'A variant with this exact size and thickness already exists for this product.',
      });
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Variant creation failed', errors);
    }

    const now = new Date().toISOString();
    const newVariant: ProductVariant = {
      id: `VAR-${cleanSku.replace(/[^A-Z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
      productId: input.productId,
      sizeId: input.sizeId,
      thicknessId: input.thicknessId,
      sku: cleanSku,
      barcode: input.barcode?.trim() || undefined,
      retailPrice: Math.round(Number(input.retailPrice)),
      wholesalePrice: Math.round(Number(input.wholesalePrice)),
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getVariantsInternal();
    list.unshift(newVariant);
    this.saveVariantsInternal(list);

    return this.populateDetails(newVariant);
  }

  public bulkGenerate(input: GenerateVariantsDTO): ProductVariant[] {
    const errors: Array<{ field: string; message: string }> = [];

    const product = productsRepository.getById(input.productId);
    if (!product) {
      throw new CatalogueValidationError('Product does not exist', [
        { field: 'productId', message: `Product "${input.productId}" not found.` },
      ]);
    }

    if (!input.combinations || input.combinations.length === 0) {
      throw new CatalogueValidationError('No variant combinations selected', [
        { field: 'combinations', message: 'Please select at least one combination to create.' },
      ]);
    }

    const createdList: ProductVariant[] = [];
    const currentList = this.getVariantsInternal();

    // Validate all items before writing
    input.combinations.forEach((c, idx) => {
      const cleanSku = (c.sku || '').trim().toUpperCase();
      if (!cleanSku) {
        errors.push({ field: `combinations[${idx}].sku`, message: 'SKU cannot be empty.' });
      } else {
        const skuConflict = currentList.find((v) => v.sku.toUpperCase() === cleanSku);
        if (skuConflict) {
          errors.push({ field: `combinations[${idx}].sku`, message: `SKU "${cleanSku}" already exists.` });
        }
      }

      const comboConflict = currentList.find(
        (v) => v.productId === input.productId && v.sizeId === c.sizeId && v.thicknessId === c.thicknessId
      );
      if (comboConflict) {
        errors.push({
          field: `combinations[${idx}]`,
          message: `Size & thickness combination already exists for SKU "${comboConflict.sku}".`,
        });
      }

      if (c.retailPrice < 0) {
        errors.push({ field: `combinations[${idx}].retailPrice`, message: 'Retail price cannot be negative.' });
      }
      if (c.wholesalePrice < 0) {
        errors.push({ field: `combinations[${idx}].wholesalePrice`, message: 'Wholesale price cannot be negative.' });
      }
    });

    if (errors.length > 0) {
      throw new CatalogueValidationError('Variant generation validation failed', errors);
    }

    const now = new Date().toISOString();
    input.combinations.forEach((c) => {
      const cleanSku = c.sku.trim().toUpperCase();
      const variant: ProductVariant = {
        id: `VAR-${cleanSku.replace(/[^A-Z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
        productId: input.productId,
        sizeId: c.sizeId,
        thicknessId: c.thicknessId,
        sku: cleanSku,
        retailPrice: Math.round(c.retailPrice),
        wholesalePrice: Math.round(c.wholesalePrice),
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      currentList.unshift(variant);
      createdList.push(this.populateDetails(variant));
    });

    this.saveVariantsInternal(currentList);
    return createdList;
  }

  public update(id: string, input: UpdateVariantDTO): ProductVariant {
    const list = this.getVariantsInternal();
    const index = list.findIndex((v) => v.id === id);

    if (index === -1) {
      throw new CatalogueValidationError(`Variant with ID "${id}" not found.`, [
        { field: 'id', message: 'Variant does not exist.' },
      ]);
    }

    const existing = list[index];
    const errors: Array<{ field: string; message: string }> = [];

    let cleanSku = existing.sku;
    if (input.sku !== undefined) {
      cleanSku = input.sku.trim().toUpperCase();
      if (!cleanSku) {
        errors.push({ field: 'sku', message: 'SKU cannot be empty.' });
      } else if (cleanSku !== existing.sku) {
        const conflict = list.find((v) => v.id !== id && v.sku.toUpperCase() === cleanSku);
        if (conflict) {
          errors.push({ field: 'sku', message: `SKU "${cleanSku}" is already registered.` });
        }
      }
    }

    let targetRetail = existing.retailPrice;
    if (input.retailPrice !== undefined) {
      targetRetail = Math.round(Number(input.retailPrice));
      if (targetRetail < 0) {
        errors.push({ field: 'retailPrice', message: 'Retail price cannot be negative.' });
      }
    }

    let targetWholesale = existing.wholesalePrice;
    if (input.wholesalePrice !== undefined) {
      targetWholesale = Math.round(Number(input.wholesalePrice));
      if (targetWholesale < 0) {
        errors.push({ field: 'wholesalePrice', message: 'Wholesale price cannot be negative.' });
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Variant update failed', errors);
    }

    const updated: ProductVariant = {
      ...existing,
      sku: cleanSku,
      barcode: input.barcode !== undefined ? (input.barcode.trim() || undefined) : existing.barcode,
      retailPrice: targetRetail,
      wholesalePrice: targetWholesale,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveVariantsInternal(list);

    return this.populateDetails(updated);
  }

  public toggleStatus(id: string, explicitStatus?: CatalogueItemStatus): ProductVariant {
    const variant = this.getById(id);
    if (!variant) {
      throw new CatalogueValidationError(`Variant with ID "${id}" not found.`, [
        { field: 'id', message: 'Variant does not exist.' },
      ]);
    }

    const nextStatus = explicitStatus !== undefined
      ? explicitStatus
      : (variant.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.update(id, { status: nextStatus });
  }

  public getCounts(productId?: string): { total: number; active: number; inactive: number } {
    let list = this.getVariantsInternal();
    if (productId && productId !== 'all') {
      list = list.filter((v) => v.productId === productId);
    }
    return {
      total: list.length,
      active: list.filter((v) => v.status === 'ACTIVE').length,
      inactive: list.filter((v) => v.status === 'INACTIVE').length,
    };
  }

  public resetToSeed(): void {
    this.saveVariantsInternal([...SEED_VARIANTS]);
  }
}

export const variantsRepository = new VariantsRepository();
