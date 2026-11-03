import { StockLocation, StockLocationType } from '@/types';
import { demoStorage } from './storage';
import { STORAGE_KEYS } from './schema';
import { SEED_STOCK_LOCATIONS } from './seed';

class StockLocationsRepository {
  private getLocationsInternal(): StockLocation[] {
    const list = demoStorage.getItem<StockLocation[]>(STORAGE_KEYS.STOCK_LOCATIONS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.STOCK_LOCATIONS, [...SEED_STOCK_LOCATIONS]);
      return [...SEED_STOCK_LOCATIONS];
    }
    return list;
  }

  private saveLocationsInternal(locations: StockLocation[]): void {
    demoStorage.setItem(STORAGE_KEYS.STOCK_LOCATIONS, locations);
  }

  public getAll(filter?: {
    branchId?: string;
    type?: StockLocationType;
    isActive?: boolean;
    search?: string;
  }): StockLocation[] {
    let list = this.getLocationsInternal();

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (loc) =>
          loc.name.toLowerCase().includes(q) ||
          loc.code.toLowerCase().includes(q) ||
          loc.description?.toLowerCase().includes(q)
      );
    }

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter((loc) => loc.branchId === filter.branchId);
    }

    if (filter.type) {
      list = list.filter((loc) => loc.type === filter.type);
    }

    if (filter.isActive !== undefined) {
      list = list.filter((loc) => loc.isActive === filter.isActive);
    }

    return list;
  }

  public getById(id: string): StockLocation | undefined {
    return this.getLocationsInternal().find((loc) => loc.id === id);
  }

  public getByCode(code: string): StockLocation | undefined {
    return this.getLocationsInternal().find(
      (loc) => loc.code.toUpperCase() === code.trim().toUpperCase()
    );
  }

  public getByBranchId(branchId: string): StockLocation[] {
    return this.getLocationsInternal().filter((loc) => loc.branchId === branchId);
  }

  public create(dto: {
    branchId?: string | null;
    name: string;
    code: string;
    type: StockLocationType;
    isActive?: boolean;
    inventoryEnabled?: boolean;
    description?: string;
  }): StockLocation {
    const list = this.getLocationsInternal();

    const existing = this.getByCode(dto.code);
    if (existing) {
      throw new Error(`Stock location with code "${dto.code}" already exists.`);
    }

    const now = new Date().toISOString();
    const newLocation: StockLocation = {
      id: `LOC-${Date.now().toString(36).toUpperCase()}`,
      branchId: dto.branchId ?? null,
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      type: dto.type,
      isActive: dto.isActive ?? true,
      inventoryEnabled: dto.inventoryEnabled ?? true,
      description: dto.description?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    list.push(newLocation);
    this.saveLocationsInternal(list);
    return newLocation;
  }

  public update(id: string, dto: Partial<StockLocation>): StockLocation {
    const list = this.getLocationsInternal();
    const idx = list.findIndex((loc) => loc.id === id);
    if (idx === -1) {
      throw new Error(`Stock location with ID "${id}" not found.`);
    }

    if (dto.code && dto.code.toUpperCase() !== list[idx].code.toUpperCase()) {
      const existing = this.getByCode(dto.code);
      if (existing && existing.id !== id) {
        throw new Error(`Stock location with code "${dto.code}" already exists.`);
      }
    }

    list[idx] = {
      ...list[idx],
      ...dto,
      code: dto.code ? dto.code.trim().toUpperCase() : list[idx].code,
      name: dto.name ? dto.name.trim() : list[idx].name,
      updatedAt: new Date().toISOString(),
    };

    this.saveLocationsInternal(list);
    return list[idx];
  }

  public delete(id: string): boolean {
    const list = this.getLocationsInternal();
    const filtered = list.filter((loc) => loc.id !== id);
    if (filtered.length === list.length) return false;

    this.saveLocationsInternal(filtered);
    return true;
  }

  public resetToSeed(): StockLocation[] {
    demoStorage.setItem(STORAGE_KEYS.STOCK_LOCATIONS, [...SEED_STOCK_LOCATIONS]);
    return [...SEED_STOCK_LOCATIONS];
  }
}

export const stockLocationsRepository = new StockLocationsRepository();
