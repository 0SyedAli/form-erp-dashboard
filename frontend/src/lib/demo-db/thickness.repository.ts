import { MattressThickness, CatalogueItemStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateThicknessDTO,
  UpdateThicknessDTO,
  ThicknessFilterOptions,
  CatalogueValidationError,
} from './schema';
import { SEED_THICKNESS } from './seed';
import { demoStorage } from './storage';

class ThicknessRepository {
  private getThicknessInternal(): MattressThickness[] {
    const list = demoStorage.getItem<MattressThickness[]>(STORAGE_KEYS.THICKNESS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.THICKNESS, [...SEED_THICKNESS]);
      return [...SEED_THICKNESS];
    }
    return list;
  }

  private saveThicknessInternal(items: MattressThickness[]): void {
    demoStorage.setItem(STORAGE_KEYS.THICKNESS, items);
  }

  public getAll(filter?: ThicknessFilterOptions): MattressThickness[] {
    let list = this.getThicknessInternal();

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.displayLabel.toLowerCase().includes(q) ||
          t.value.toString().includes(q) ||
          t.unit.toLowerCase().includes(q)
      );
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((t) => t.status === filter.status);
    }

    if (filter.sortBy) {
      const order = filter.sortOrder === 'desc' ? -1 : 1;
      list.sort((a, b) => {
        if (filter.sortBy === 'value') return (a.value - b.value) * order;
        if (filter.sortBy === 'displayLabel') return a.displayLabel.localeCompare(b.displayLabel) * order;
        if (filter.sortBy === 'status') return a.status.localeCompare(b.status) * order;
        return 0;
      });
    }

    return list;
  }

  public getById(id: string): MattressThickness | null {
    const list = this.getThicknessInternal();
    return list.find((t) => t.id === id) || null;
  }

  public create(input: CreateThicknessDTO): MattressThickness {
    const errors: Array<{ field: string; message: string }> = [];

    if (!input.value || input.value <= 0) {
      errors.push({ field: 'value', message: 'Thickness value must be a positive number.' });
    }

    const value = Number(input.value);
    const unit = (input.unit || 'in').trim();

    const conflict = this.getThicknessInternal().find(
      (t) => t.value === value && t.unit.toLowerCase() === unit.toLowerCase()
    );
    if (conflict) {
      errors.push({
        field: 'value',
        message: `Thickness ${value} ${unit} already exists (${conflict.displayLabel}).`,
      });
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Thickness validation failed', errors);
    }

    const displayLabel = input.displayLabel?.trim() || `${value} Inches`;
    const now = new Date().toISOString();
    const newThickness: MattressThickness = {
      id: `THICK-${value}-${Date.now().toString().slice(-4)}`,
      value,
      unit,
      displayLabel,
      status: input.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getThicknessInternal();
    list.push(newThickness);
    this.saveThicknessInternal(list);

    return newThickness;
  }

  public update(id: string, input: UpdateThicknessDTO): MattressThickness {
    const list = this.getThicknessInternal();
    const index = list.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new CatalogueValidationError(`Thickness with ID "${id}" not found.`, [
        { field: 'id', message: 'Thickness option does not exist.' },
      ]);
    }

    const existing = list[index];
    const errors: Array<{ field: string; message: string }> = [];

    const targetValue = input.value !== undefined ? Number(input.value) : existing.value;
    const targetUnit = input.unit !== undefined ? input.unit.trim() : existing.unit;

    if (targetValue <= 0) {
      errors.push({ field: 'value', message: 'Thickness value must be a positive number.' });
    }

    if (targetValue !== existing.value || targetUnit !== existing.unit) {
      const conflict = list.find(
        (t) =>
          t.id !== id &&
          t.value === targetValue &&
          t.unit.toLowerCase() === targetUnit.toLowerCase()
      );
      if (conflict) {
        errors.push({
          field: 'value',
          message: `Thickness ${targetValue} ${targetUnit} already exists (${conflict.displayLabel}).`,
        });
      }
    }

    if (errors.length > 0) {
      throw new CatalogueValidationError('Thickness update failed', errors);
    }

    const updated: MattressThickness = {
      ...existing,
      value: targetValue,
      unit: targetUnit,
      displayLabel: input.displayLabel !== undefined ? input.displayLabel.trim() : existing.displayLabel,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveThicknessInternal(list);

    return updated;
  }

  public toggleStatus(id: string, explicitStatus?: CatalogueItemStatus): MattressThickness {
    const item = this.getById(id);
    if (!item) {
      throw new CatalogueValidationError(`Thickness with ID "${id}" not found.`, [
        { field: 'id', message: 'Thickness option does not exist.' },
      ]);
    }

    const nextStatus = explicitStatus !== undefined
      ? explicitStatus
      : (item.status?.toUpperCase() === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.update(id, { status: nextStatus });
  }

  public getCounts(): { total: number; active: number; inactive: number } {
    const list = this.getThicknessInternal();
    return {
      total: list.length,
      active: list.filter((t) => t.status === 'ACTIVE').length,
      inactive: list.filter((t) => t.status === 'INACTIVE').length,
    };
  }

  public resetToSeed(): void {
    this.saveThicknessInternal([...SEED_THICKNESS]);
  }
}

export const thicknessRepository = new ThicknessRepository();
