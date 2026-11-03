import { StockMovement, StockMovementType } from '@/types';
import { demoStorage } from './storage';
import { STORAGE_KEYS } from './schema';
import { SEED_STOCK_MOVEMENTS } from './seed';

class StockMovementsRepository {
  private getMovementsInternal(): StockMovement[] {
    const list = demoStorage.getItem<StockMovement[]>(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, [...SEED_STOCK_MOVEMENTS]);
      return [...SEED_STOCK_MOVEMENTS];
    }
    return list;
  }

  private saveMovementsInternal(movements: StockMovement[]): void {
    demoStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  }

  public getAll(filter?: {
    sku?: string;
    branchId?: string;
    locationId?: string;
    movementType?: StockMovementType | 'all';
    startDate?: string;
    endDate?: string;
    search?: string;
  }): StockMovement[] {
    let list = this.getMovementsInternal();

    // Sort newest first by default
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.sku.toLowerCase().includes(q) ||
          m.documentReference.toLowerCase().includes(q) ||
          m.createdBy.toLowerCase().includes(q) ||
          m.notes?.toLowerCase().includes(q)
      );
    }

    if (filter.sku && filter.sku !== 'all') {
      list = list.filter((m) => m.sku.toUpperCase() === filter.sku!.toUpperCase());
    }

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter(
        (m) => m.sourceBranchId === filter.branchId || m.destinationBranchId === filter.branchId
      );
    }

    if (filter.locationId && filter.locationId !== 'all') {
      list = list.filter(
        (m) =>
          m.sourceLocationId === filter.locationId ||
          m.destinationLocationId === filter.locationId
      );
    }

    if (filter.movementType && filter.movementType !== 'all') {
      list = list.filter((m) => m.movementType === filter.movementType);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((m) => new Date(m.timestamp).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((m) => new Date(m.timestamp).getTime() <= end);
    }

    return list;
  }

  public getById(id: string): StockMovement | undefined {
    return this.getMovementsInternal().find((m) => m.id === id);
  }

  public getBySku(sku: string): StockMovement[] {
    return this.getAll({ sku });
  }

  /**
   * Post an immutable stock movement record.
   */
  public logMovement(
    movement: Omit<StockMovement, 'id' | 'timestamp'> & { timestamp?: string }
  ): StockMovement {
    const list = this.getMovementsInternal();
    const now = movement.timestamp || new Date().toISOString();
    const newMovement: StockMovement = {
      ...movement,
      type: movement.movementType,
      id: `MOV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: now,
      quantity: Math.abs(movement.quantity), // Always positive magnitude
    };

    list.unshift(newMovement);
    this.saveMovementsInternal(list);
    return newMovement;
  }

  public resetToSeed(): StockMovement[] {
    demoStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, [...SEED_STOCK_MOVEMENTS]);
    return [...SEED_STOCK_MOVEMENTS];
  }
}

export const stockMovementsRepository = new StockMovementsRepository();
