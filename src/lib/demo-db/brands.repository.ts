import { Brand, CatalogueItemStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateBrandDTO,
  UpdateBrandDTO,
  BrandFilterOptions,
  CatalogueValidationError,
} from './schema';
import { SEED_BRANDS } from './seed';
import { demoStorage } from './storage';

class BrandsRepository {
  private getBrandsInternal(): Brand[] {
    const list = demoStorage.getItem<Brand[]>(STORAGE_KEYS.BRANDS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.BRANDS, [...SEED_BRANDS]);
      return [...SEED_BRANDS];
    }
    return list;
  }

  private saveBrandsInternal(brands: Brand[]): void {
    demoStorage.setItem(STORAGE_KEYS.BRANDS, brands);
  }

  public getAll(filter?: BrandFilterOptions): Brand[] {
    let list = this.getBrandsInternal();

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.code.toLowerCase().includes(q) ||
          (b.description && b.description.toLowerCase().includes(q))
      );
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((b) => b.status === filter.status);
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (filter.sortBy === 'name') return a.name.localeCompare(b.name) * order;
        if (filter.sortBy === 'code') return a.code.localeCompare(b.code) * order;
        if (filter.sortBy === 'status') return a.status.localeCompare(b.status) * order;
        if (filter.sortBy === 'createdAt') return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * order;
        return 0;
      });
    }

    return list;
  }

  public getById(id: string): Brand | null {
    const list = this.getBrandsInternal();
    return list.find((b) => b.id === id) || null;
  }

  public getByCode(code: string): Brand | null {
    const list = this.getBrandsInternal();
    const clean = code.trim().toUpperCase();
    return list.find((b) => b.code.toUpperCase() === clean) || null;
  }

  public create(input: CreateBrandDTO): Brand {
    const errors: Array<{ field: string; message: string }> = [];

    if (!input.name || !input.name.trim()) {
      errors.push({ field: 'name', message: 'Brand name is required.' });
    }
    if (!input.code || !input.code.trim()) {
      errors.push({ field: 'code', message: 'Brand code is required.' });
    }

    const cleanCode = (input.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');

    if (cleanCode && this.getByCode(cleanCode)) {
      errors.push({ field: 'code', message: `Brand code "${cleanCode}" is already in use.` });
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Brand validation failed', errors);
    }

    const now = new Date().toISOString();
    const newBrand: Brand = {
      id: `BRAND-${cleanCode}-${Date.now().toString().slice(-4)}`,
      name: input.name.trim(),
      code: cleanCode,
      description: input.description?.trim() || '',
      logoUrl: input.logoUrl?.trim() || undefined,
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getBrandsInternal();
    list.unshift(newBrand);
    this.saveBrandsInternal(list);

    return newBrand;
  }

  public update(id: string, input: UpdateBrandDTO): Brand {
    const list = this.getBrandsInternal();
    const index = list.findIndex((b) => b.id === id);

    if (index === -1) {
      throw new CatalogueValidationError(`Brand with ID "${id}" not found.`, [
        { field: 'id', message: 'Brand does not exist.' },
      ]);
    }

    const existing = list[index];
    const errors: Array<{ field: string; message: string }> = [];

    if (input.name !== undefined && !input.name.trim()) {
      errors.push({ field: 'name', message: 'Brand name cannot be empty.' });
    }

    let cleanCode = existing.code;
    if (input.code !== undefined) {
      cleanCode = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
      if (!cleanCode) {
        errors.push({ field: 'code', message: 'Brand code cannot be empty.' });
      } else if (cleanCode !== existing.code) {
        const conflict = list.find((b) => b.id !== id && b.code === cleanCode);
        if (conflict) {
          errors.push({ field: 'code', message: `Brand code "${cleanCode}" is already in use.` });
        }
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Brand update failed', errors);
    }

    const updated: Brand = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      code: cleanCode,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      logoUrl: input.logoUrl !== undefined ? (input.logoUrl.trim() || undefined) : existing.logoUrl,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveBrandsInternal(list);

    return updated;
  }

  public toggleStatus(id: string, explicitStatus?: CatalogueItemStatus): Brand {
    const brand = this.getById(id);
    if (!brand) {
      throw new CatalogueValidationError(`Brand with ID "${id}" not found.`, [
        { field: 'id', message: 'Brand does not exist.' },
      ]);
    }

    const nextStatus = explicitStatus !== undefined
      ? explicitStatus
      : (brand.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.update(id, { status: nextStatus });
  }

  public getCounts(): { total: number; active: number; inactive: number } {
    const list = this.getBrandsInternal();
    return {
      total: list.length,
      active: list.filter((b) => b.status === 'ACTIVE').length,
      inactive: list.filter((b) => b.status === 'INACTIVE').length,
    };
  }

  public resetToSeed(): void {
    this.saveBrandsInternal([...SEED_BRANDS]);
  }
}

export const brandsRepository = new BrandsRepository();
