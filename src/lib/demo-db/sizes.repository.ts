import { MattressSize, CatalogueItemStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateSizeDTO,
  UpdateSizeDTO,
  SizeFilterOptions,
  CatalogueValidationError,
} from './schema';
import { SEED_SIZES } from './seed';
import { demoStorage } from './storage';

class SizesRepository {
  private getSizesInternal(): MattressSize[] {
    const list = demoStorage.getItem<MattressSize[]>(STORAGE_KEYS.SIZES, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.SIZES, [...SEED_SIZES]);
      return [...SEED_SIZES];
    }
    return list;
  }

  private saveSizesInternal(sizes: MattressSize[]): void {
    demoStorage.setItem(STORAGE_KEYS.SIZES, sizes);
  }

  public getAll(filter?: SizeFilterOptions): MattressSize[] {
    let list = this.getSizesInternal();

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.displayLabel.toLowerCase().includes(q) ||
          `${s.length}x${s.width}`.includes(q) ||
          `${s.length}*${s.width}`.includes(q) ||
          `${s.length} ${s.width}`.includes(q)
      );
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((s) => s.status === filter.status);
    }

    if (filter.unit && filter.unit !== 'all') {
      list = list.filter((s) => s.unit === filter.unit);
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (filter.sortBy === 'displayLabel') return a.displayLabel.localeCompare(b.displayLabel) * order;
        if (filter.sortBy === 'length') return (a.length - b.length) * order;
        if (filter.sortBy === 'width') return (a.width - b.width) * order;
        if (filter.sortBy === 'status') return a.status.localeCompare(b.status) * order;
        return 0;
      });
    }

    return list;
  }

  public getById(id: string): MattressSize | null {
    const list = this.getSizesInternal();
    return list.find((s) => s.id === id) || null;
  }

  public getByDimensions(length: number, width: number): MattressSize | null {
    const list = this.getSizesInternal();
    return list.find((s) => s.length === length && s.width === width) || null;
  }

  public create(input: CreateSizeDTO): MattressSize {
    const errors: Array<{ field: string; message: string }> = [];

    if (!input.length || input.length <= 0) {
      errors.push({ field: 'length', message: 'Length must be a positive number.' });
    }
    if (!input.width || input.width <= 0) {
      errors.push({ field: 'width', message: 'Width must be a positive number.' });
    }

    const unit = (input.unit || 'in').trim();
    const length = Number(input.length);
    const width = Number(input.width);

    // Duplicate check on length, width, unit
    const conflict = this.getSizesInternal().find(
      (s) => s.length === length && s.width === width && s.unit.toLowerCase() === unit.toLowerCase()
    );
    if (conflict) {
      errors.push({
        field: 'dimensions',
        message: `Mattress size ${length} × ${width} ${unit} already exists (${conflict.displayLabel}).`,
      });
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Size validation failed', errors);
    }

    const displayLabel = input.displayLabel?.trim() || `${length} × ${width}`;
    const now = new Date().toISOString();
    const newSize: MattressSize = {
      id: `SIZE-${length}${width}-${Date.now().toString().slice(-4)}`,
      length,
      width,
      unit,
      displayLabel,
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getSizesInternal();
    list.push(newSize);
    this.saveSizesInternal(list);

    return newSize;
  }

  public update(id: string, input: UpdateSizeDTO): MattressSize {
    const list = this.getSizesInternal();
    const index = list.findIndex((s) => s.id === id);

    if (index === -1) {
      throw new CatalogueValidationError(`Size with ID "${id}" not found.`, [
        { field: 'id', message: 'Size does not exist.' },
      ]);
    }

    const existing = list[index];
    const errors: Array<{ field: string; message: string }> = [];

    const targetLength = input.length !== undefined ? Number(input.length) : existing.length;
    const targetWidth = input.width !== undefined ? Number(input.width) : existing.width;
    const targetUnit = input.unit !== undefined ? input.unit.trim() : existing.unit;

    if (targetLength <= 0) {
      errors.push({ field: 'length', message: 'Length must be a positive number.' });
    }
    if (targetWidth <= 0) {
      errors.push({ field: 'width', message: 'Width must be a positive number.' });
    }

    if (targetLength !== existing.length || targetWidth !== existing.width || targetUnit !== existing.unit) {
      const conflict = list.find(
        (s) =>
          s.id !== id &&
          s.length === targetLength &&
          s.width === targetWidth &&
          s.unit.toLowerCase() === targetUnit.toLowerCase()
      );
      if (conflict) {
        errors.push({
          field: 'dimensions',
          message: `Mattress size ${targetLength} × ${targetWidth} ${targetUnit} already exists (${conflict.displayLabel}).`,
        });
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Size update failed', errors);
    }

    const updated: MattressSize = {
      ...existing,
      length: targetLength,
      width: targetWidth,
      unit: targetUnit,
      displayLabel: input.displayLabel !== undefined ? input.displayLabel.trim() : existing.displayLabel,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveSizesInternal(list);

    return updated;
  }

  public toggleStatus(id: string, explicitStatus?: CatalogueItemStatus): MattressSize {
    const size = this.getById(id);
    if (!size) {
      throw new CatalogueValidationError(`Size with ID "${id}" not found.`, [
        { field: 'id', message: 'Size does not exist.' },
      ]);
    }

    const nextStatus = explicitStatus !== undefined
      ? explicitStatus
      : (size.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.update(id, { status: nextStatus });
  }

  public getCounts(): { total: number; active: number; inactive: number } {
    const list = this.getSizesInternal();
    return {
      total: list.length,
      active: list.filter((s) => s.status === 'ACTIVE').length,
      inactive: list.filter((s) => s.status === 'INACTIVE').length,
    };
  }

  public resetToSeed(): void {
    this.saveSizesInternal([...SEED_SIZES]);
  }
}

export const sizesRepository = new SizesRepository();
