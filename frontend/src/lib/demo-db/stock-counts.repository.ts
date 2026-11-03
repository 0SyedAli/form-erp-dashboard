import {
  StockCount,
  StockCountStatus,
  StockCountItem,
  StockMovement,
} from '@/types';
import { demoStorage } from './storage';
import { STORAGE_KEYS } from './schema';
import { SEED_STOCK_COUNTS } from './seed';
import { inventoryRepository } from './inventory.repository';
import { stockMovementsRepository } from './stock-movements.repository';
import { variantsRepository } from './variants.repository';

class StockCountsRepository {
  private getCountsInternal(): StockCount[] {
    const list = demoStorage.getItem<StockCount[]>(STORAGE_KEYS.STOCK_COUNTS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.STOCK_COUNTS, [...SEED_STOCK_COUNTS]);
      return [...SEED_STOCK_COUNTS];
    }
    return list;
  }

  private saveCountsInternal(counts: StockCount[]): void {
    demoStorage.setItem(STORAGE_KEYS.STOCK_COUNTS, counts);
  }

  public getAll(filter?: {
    branchId?: string;
    status?: StockCountStatus | 'all';
    search?: string;
  }): StockCount[] {
    let list = this.getCountsInternal();

    // Newest first
    list.sort((a, b) => new Date(b.countedAt || b.createdAt || 0).getTime() - new Date(a.countedAt || a.createdAt || 0).getTime());

    if (!filter) return list;

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.countNumber.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q) ||
          c.countedBy.toLowerCase().includes(q)
      );
    }

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter((c) => c.branchId === filter.branchId);
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((c) => c.status === filter.status);
    }

    return list;
  }

  public getById(id: string): StockCount | undefined {
    return this.getCountsInternal().find((c) => c.id === id);
  }

  public getByCountNumber(num: string): StockCount | undefined {
    return this.getCountsInternal().find((c) => c.countNumber === num);
  }

  /**
   * Initialize a new Physical Stock Count audit session.
   */
  public createStockCount(dto: {
    branchId: string;
    stockLocationId: string;
    skus: string[];
    notes?: string;
    countedBy: string;
  }): StockCount {
    if (!dto.skus || dto.skus.length === 0) {
      throw new Error('At least one SKU must be selected for stock counting.');
    }

    const items: StockCountItem[] = [];
    for (const sku of dto.skus) {
      const balance = inventoryRepository.getBalance(dto.stockLocationId, sku);
      const systemQuantity = balance ? balance.onHand : 0;
      const variant = variantsRepository.getBySku(sku);

      items.push({
        sku,
        variantId: variant?.id || '',
        productName: variant?.productName || balance?.productName || sku,
        sizeLabel: variant?.sizeLabel || balance?.sizeLabel || '',
        thicknessInches: balance?.thicknessInches || 6,
        systemQuantity,
        physicalQuantity: systemQuantity, // defaults to system until counted
        variance: 0,
        unitCost: balance?.unitCost,
      });
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countNumber = `CNT-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const stockCount: StockCount = {
      id: `CNT-${Date.now().toString(36).toUpperCase()}`,
      countNumber,
      branchId: dto.branchId,
      stockLocationId: dto.stockLocationId,
      status: 'IN_PROGRESS',
      items,
      totalDiscrepancy: 0,
      notes: dto.notes?.trim(),
      countedBy: dto.countedBy,
      countedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const list = this.getCountsInternal();
    list.unshift(stockCount);
    this.saveCountsInternal(list);
    return stockCount;
  }

  /**
   * Update counted physical values and calculate differences.
   */
  public updateCountItems(
    countId: string,
    itemUpdates: Array<{ sku: string; physicalQuantity: number; notes?: string }>
  ): StockCount {
    const list = this.getCountsInternal();
    const idx = list.findIndex((c) => c.id === countId);
    if (idx === -1) throw new Error(`Stock count "${countId}" not found.`);

    const count = list[idx];
    if (count.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot update items for a count in status "${count.status}".`);
    }

    let totalDiscrepancy = 0;
    for (const update of itemUpdates) {
      const item = count.items.find((i) => i.sku === update.sku);
      if (item) {
        if (update.physicalQuantity < 0 || !Number.isFinite(update.physicalQuantity)) {
          throw new Error(`Physical quantity cannot be negative for SKU "${update.sku}".`);
        }
        item.physicalQuantity = update.physicalQuantity;
        item.variance = item.physicalQuantity - item.systemQuantity;
        if (update.notes) item.notes = update.notes.trim();
        totalDiscrepancy += Math.abs(item.variance);
      }
    }

    count.totalDiscrepancy = totalDiscrepancy;
    count.updatedAt = new Date().toISOString();

    this.saveCountsInternal(list);
    return count;
  }

  /**
   * Reconcile and post adjustments to inventory balance with double-post prevention.
   */
  public reconcileAndPostCount(
    countId: string,
    approvedBy: string
  ): {
    count: StockCount;
    movements: StockMovement[];
  } {
    const list = this.getCountsInternal();
    const idx = list.findIndex((c) => c.id === countId);
    if (idx === -1) throw new Error(`Stock count "${countId}" not found.`);

    const count = list[idx];

    // Accidental double posting prevention
    if (count.status === 'COMPLETED') {
      throw new Error(`Stock count "${count.countNumber}" has already been finalized and posted.`);
    }
    if (count.status === 'CANCELLED') {
      throw new Error(`Cannot post adjustments for cancelled count "${count.countNumber}".`);
    }

    const now = new Date().toISOString();
    const movements: StockMovement[] = [];

    for (const item of count.items) {
      if (item.variance !== 0) {
        // Adjust inventory balance
        inventoryRepository.updateBalanceInternal(count.stockLocationId, item.sku, (b) => {
          b.onHand = item.physicalQuantity;
          b.lastCountDate = now;
        });

        // Record adjustment movement
        const movement = stockMovementsRepository.logMovement({
          documentReference: count.countNumber,
          sku: item.sku,
          productId: item.variantId,
          variantId: item.variantId,
          sourceLocationId: item.variance < 0 ? count.stockLocationId : undefined,
          sourceBranchId: item.variance < 0 ? count.branchId : undefined,
          destinationLocationId: item.variance > 0 ? count.stockLocationId : undefined,
          destinationBranchId: item.variance > 0 ? count.branchId : undefined,
          movementType: item.variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: Math.abs(item.variance),
          unitCost: item.unitCost,
          createdBy: approvedBy,
          timestamp: now,
          notes: `[Reconciliation ${count.countNumber}] System: ${item.systemQuantity}, Counted: ${item.physicalQuantity}, Variance: ${item.variance > 0 ? `+${item.variance}` : item.variance}`,
          relatedTransactionId: count.id,
        });
        movements.push(movement);
      } else {
        // Just mark lastCountDate
        inventoryRepository.updateBalanceInternal(count.stockLocationId, item.sku, (b) => {
          b.lastCountDate = now;
        });
      }
    }

    count.status = 'COMPLETED';
    count.approvedBy = approvedBy;
    count.approvedAt = now;
    count.updatedAt = now;

    this.saveCountsInternal(list);
    return { count, movements };
  }

  public resetToSeed(): StockCount[] {
    demoStorage.setItem(STORAGE_KEYS.STOCK_COUNTS, [...SEED_STOCK_COUNTS]);
    return [...SEED_STOCK_COUNTS];
  }
}

export const stockCountsRepository = new StockCountsRepository();
