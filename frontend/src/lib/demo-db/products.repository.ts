import { CatalogueProduct, CatalogueItemStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateCatalogueProductDTO,
  UpdateCatalogueProductDTO,
  ProductFilterOptions,
  CatalogueValidationError,
} from './schema';
import { SEED_CATALOGUE_PRODUCTS } from './seed';
import { demoStorage } from './storage';
import { brandsRepository } from './brands.repository';
import { categoriesRepository } from './categories.repository';

class ProductsRepository {
  private getProductsInternal(): CatalogueProduct[] {
    const list = demoStorage.getItem<CatalogueProduct[]>(STORAGE_KEYS.PRODUCTS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.PRODUCTS, [...SEED_CATALOGUE_PRODUCTS]);
      return [...SEED_CATALOGUE_PRODUCTS];
    }
    return list;
  }

  private saveProductsInternal(products: CatalogueProduct[]): void {
    demoStorage.setItem(STORAGE_KEYS.PRODUCTS, products);
  }

  public getAll(filter?: ProductFilterOptions): CatalogueProduct[] {
    let list = this.getProductsInternal();

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (filter.brandId && filter.brandId !== 'all') {
      list = list.filter((p) => p.brandId === filter.brandId);
    }

    if (filter.categoryId && filter.categoryId !== 'all') {
      list = list.filter((p) => p.categoryId === filter.categoryId);
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((p) => p.status === filter.status);
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (filter.sortBy === 'name') return a.name.localeCompare(b.name) * order;
        if (filter.sortBy === 'code') return a.code.localeCompare(b.code) * order;
        if (filter.sortBy === 'brand') return a.brandId.localeCompare(b.brandId) * order;
        if (filter.sortBy === 'category') return a.categoryId.localeCompare(b.categoryId) * order;
        if (filter.sortBy === 'status') return a.status.localeCompare(b.status) * order;
        if (filter.sortBy === 'createdAt') return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
        return 0;
      });
    }

    return list;
  }

  public getById(id: string): CatalogueProduct | null {
    const list = this.getProductsInternal();
    return list.find((p) => p.id === id) || null;
  }

  public getByCode(code: string): CatalogueProduct | null {
    const list = this.getProductsInternal();
    const clean = code.trim().toUpperCase();
    return list.find((p) => p.code.toUpperCase() === clean) || null;
  }

  public create(input: CreateCatalogueProductDTO): CatalogueProduct {
    const errors: Array<{ field: string; message: string }> = [];

    if (!input.name || !input.name.trim()) {
      errors.push({ field: 'name', message: 'Product name is required.' });
    }
    if (!input.code || !input.code.trim()) {
      errors.push({ field: 'code', message: 'Product code is required.' });
    }
    if (!input.brandId || !input.brandId.trim()) {
      errors.push({ field: 'brandId', message: 'Brand assignment is required.' });
    }
    if (!input.categoryId || !input.categoryId.trim()) {
      errors.push({ field: 'categoryId', message: 'Category assignment is required.' });
    }

    const cleanCode = (input.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');

    if (cleanCode && this.getByCode(cleanCode)) {
      errors.push({ field: 'code', message: `Product code "${cleanCode}" is already in use.` });
    }

    // Referential integrity check: Brand exists
    const brand = brandsRepository.getById(input.brandId);
    if (!brand) {
      errors.push({ field: 'brandId', message: `Assigned brand "${input.brandId}" does not exist.` });
    }

    // Referential integrity check: Category exists and belongs to Brand
    const category = categoriesRepository.getById(input.categoryId);
    if (!category) {
      errors.push({ field: 'categoryId', message: `Assigned category "${input.categoryId}" does not exist.` });
    } else if (brand && category.brandId !== brand.id) {
      errors.push({
        field: 'categoryId',
        message: `Category "${category.name}" belongs to a different brand and cannot be assigned to "${brand.name}".`,
      });
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Product validation failed', errors);
    }

    const now = new Date().toISOString();
    const newProduct: CatalogueProduct = {
      id: `PROD-${cleanCode}-${Date.now().toString().slice(-4)}`,
      name: input.name.trim(),
      code: cleanCode,
      brandId: input.brandId.trim(),
      categoryId: input.categoryId.trim(),
      description: input.description?.trim() || '',
      imageUrl: input.imageUrl?.trim() || undefined,
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getProductsInternal();
    list.unshift(newProduct);
    this.saveProductsInternal(list);

    return newProduct;
  }

  public update(id: string, input: UpdateCatalogueProductDTO): CatalogueProduct {
    const list = this.getProductsInternal();
    const index = list.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new CatalogueValidationError(`Product with ID "${id}" not found.`, [
        { field: 'id', message: 'Product does not exist.' },
      ]);
    }

    const existing = list[index];
    const errors: Array<{ field: string; message: string }> = [];

    const targetBrandId = input.brandId !== undefined ? input.brandId.trim() : existing.brandId;
    const targetCategoryId = input.categoryId !== undefined ? input.categoryId.trim() : existing.categoryId;

    const brand = brandsRepository.getById(targetBrandId);
    if (!brand) {
      errors.push({ field: 'brandId', message: `Assigned brand "${targetBrandId}" does not exist.` });
    }

    const category = categoriesRepository.getById(targetCategoryId);
    if (!category) {
      errors.push({ field: 'categoryId', message: `Assigned category "${targetCategoryId}" does not exist.` });
    } else if (brand && category.brandId !== brand.id) {
      errors.push({
        field: 'categoryId',
        message: `Category "${category.name}" belongs to a different brand and cannot be assigned to "${brand.name}".`,
      });
    }

    let cleanCode = existing.code;
    if (input.code !== undefined) {
      cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
      if (!cleanCode) {
        errors.push({ field: 'code', message: 'Product code cannot be empty.' });
      } else if (cleanCode !== existing.code) {
        const conflict = list.find((p) => p.id !== id && p.code === cleanCode);
        if (conflict) {
          errors.push({ field: 'code', message: `Product code "${cleanCode}" is already in use.` });
        }
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Product update failed', errors);
    }

    const updated: CatalogueProduct = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      code: cleanCode,
      brandId: targetBrandId,
      categoryId: targetCategoryId,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      imageUrl: input.imageUrl !== undefined ? (input.imageUrl.trim() || undefined) : existing.imageUrl,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveProductsInternal(list);

    return updated;
  }

  public toggleStatus(id: string, explicitStatus?: CatalogueItemStatus): CatalogueProduct {
    const prod = this.getById(id);
    if (!prod) {
      throw new CatalogueValidationError(`Product with ID "${id}" not found.`, [
        { field: 'id', message: 'Product does not exist.' },
      ]);
    }

    const nextStatus = explicitStatus !== undefined
      ? explicitStatus
      : (prod.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.update(id, { status: nextStatus });
  }

  public getCounts(brandId?: string): { total: number; active: number; inactive: number } {
    let list = this.getProductsInternal();
    if (brandId && brandId !== 'all') {
      list = list.filter((p) => p.brandId === brandId);
    }
    return {
      total: list.length,
      active: list.filter((p) => p.status === 'ACTIVE').length,
      inactive: list.filter((p) => p.status === 'INACTIVE').length,
    };
  }

  public resetToSeed(): void {
    this.saveProductsInternal([...SEED_CATALOGUE_PRODUCTS]);
  }
}

export const productsRepository = new ProductsRepository();
