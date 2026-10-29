import { Category, CatalogueItemStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryFilterOptions,
  CatalogueValidationError,
} from './schema';
import { SEED_CATEGORIES } from './seed';
import { demoStorage } from './storage';
import { brandsRepository } from './brands.repository';

class CategoriesRepository {
  private getCategoriesInternal(): Category[] {
    const list = demoStorage.getItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.CATEGORIES, [...SEED_CATEGORIES]);
      return [...SEED_CATEGORIES];
    }
    return list;
  }

  private saveCategoriesInternal(categories: Category[]): void {
    demoStorage.setItem(STORAGE_KEYS.CATEGORIES, categories);
  }

  public getAll(filter?: CategoryFilterOptions): Category[] {
    let list = this.getCategoriesInternal();

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    if (filter.brandId && filter.brandId !== 'all') {
      list = list.filter((c) => c.brandId === filter.brandId);
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((c) => c.status === filter.status);
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (filter.sortBy === 'name') return a.name.localeCompare(b.name) * order;
        if (filter.sortBy === 'code') return a.code.localeCompare(b.code) * order;
        if (filter.sortBy === 'brand') return a.brandId.localeCompare(b.brandId) * order;
        if (filter.sortBy === 'status') return a.status.localeCompare(b.status) * order;
        if (filter.sortBy === 'createdAt') return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
        return 0;
      });
    }

    return list;
  }

  public getByBrand(brandId: string): Category[] {
    const list = this.getCategoriesInternal();
    return list.filter((c) => c.brandId === brandId);
  }

  public getByBrandId(brandId: string): Category[] {
    return this.getByBrand(brandId);
  }

  public getById(id: string): Category | null {
    const list = this.getCategoriesInternal();
    return list.find((c) => c.id === id) || null;
  }

  public create(input: CreateCategoryDTO): Category {
    const errors: Array<{ field: string; message: string }> = [];

    if (!input.name || !input.name.trim()) {
      errors.push({ field: 'name', message: 'Category name is required.' });
    }
    const cleanName = (input.name || '').trim();
    const cleanCode = (input.code && input.code.trim())
      ? input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_')
      : cleanName.toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 15);

    if (!cleanCode) {
      errors.push({ field: 'code', message: 'Category code or name is required.' });
    }
    if (!input.brandId || !input.brandId.trim()) {
      errors.push({ field: 'brandId', message: 'Parent brand assignment is required.' });
    } else {
      const brand = brandsRepository.getById(input.brandId);
      if (!brand) {
        errors.push({ field: 'brandId', message: `Assigned brand "${input.brandId}" does not exist.` });
      }
    }

    if (cleanName && input.brandId) {
      const existingInBrand = this.getCategoriesInternal().find(
        (c) => c.brandId === input.brandId && c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (existingInBrand) {
        errors.push({
          field: 'name',
          message: `Category "${cleanName}" already exists under the selected brand.`,
        });
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Category validation failed', errors);
    }

    const brand = brandsRepository.getById(input.brandId.trim());
    const now = new Date().toISOString();
    const newCategory: Category = {
      id: `CAT-${input.brandId.replace('BRAND-', '')}-${cleanCode}-${Date.now().toString().slice(-4)}`,
      brandId: input.brandId.trim(),
      brandName: brand?.name,
      name: cleanName,
      code: cleanCode,
      description: input.description?.trim() || '',
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getCategoriesInternal();
    list.unshift(newCategory);
    this.saveCategoriesInternal(list);

    return newCategory;
  }

  public update(id: string, input: UpdateCategoryDTO): Category {
    const list = this.getCategoriesInternal();
    const index = list.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new CatalogueValidationError(`Category with ID "${id}" not found.`, [
        { field: 'id', message: 'Category does not exist.' },
      ]);
    }

    const existing = list[index];
    const errors: Array<{ field: string; message: string }> = [];

    const targetBrandId = input.brandId !== undefined ? input.brandId.trim() : existing.brandId;
    if (!targetBrandId) {
      errors.push({ field: 'brandId', message: 'Category must be assigned to a valid brand.' });
    } else {
      const brand = brandsRepository.getById(targetBrandId);
      if (!brand) {
        errors.push({ field: 'brandId', message: `Assigned brand "${targetBrandId}" does not exist.` });
      }
    }

    const targetName = input.name !== undefined ? input.name.trim() : existing.name;
    if (!targetName) {
      errors.push({ field: 'name', message: 'Category name cannot be empty.' });
    } else if (targetName.toLowerCase() !== existing.name.toLowerCase() || targetBrandId !== existing.brandId) {
      const conflict = list.find(
        (c) =>
          c.id !== id &&
          c.brandId === targetBrandId &&
          c.name.toLowerCase() === targetName.toLowerCase()
      );
      if (conflict) {
        errors.push({
          field: 'name',
          message: `Category "${targetName}" already exists under the selected brand.`,
        });
      }
    }

    let cleanCode = existing.code;
    if (input.code !== undefined) {
      cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
      if (!cleanCode) {
        errors.push({ field: 'code', message: 'Category code cannot be empty.' });
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Category update failed', errors);
    }

    const updated: Category = {
      ...existing,
      brandId: targetBrandId,
      name: targetName,
      code: cleanCode,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveCategoriesInternal(list);

    return updated;
  }

  public toggleStatus(id: string, explicitStatus?: CatalogueItemStatus): Category {
    const cat = this.getById(id);
    if (!cat) {
      throw new CatalogueValidationError(`Category with ID "${id}" not found.`, [
        { field: 'id', message: 'Category does not exist.' },
      ]);
    }

    const nextStatus = explicitStatus !== undefined
      ? explicitStatus
      : (cat.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.update(id, { status: nextStatus });
  }

  public getCounts(brandId?: string): { total: number; active: number; inactive: number } {
    let list = this.getCategoriesInternal();
    if (brandId && brandId !== 'all') {
      list = list.filter((c) => c.brandId === brandId);
    }
    return {
      total: list.length,
      active: list.filter((c) => c.status === 'ACTIVE').length,
      inactive: list.filter((c) => c.status === 'INACTIVE').length,
    };
  }

  public resetToSeed(): void {
    this.saveCategoriesInternal([...SEED_CATEGORIES]);
  }
}

export const categoriesRepository = new CategoriesRepository();
