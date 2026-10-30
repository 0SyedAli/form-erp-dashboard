import { PurchaseReturn, PurchaseReturnItem, StockMovement } from '@/types';
import {
  STORAGE_KEYS,
  CreatePurchaseReturnDTO,
  PurchaseReturnFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { SEED_PURCHASE_RETURNS } from './seed';
import { suppliersRepository } from './suppliers.repository';
import { branchesRepository } from './branches.repository';
import { stockLocationsRepository } from './stock-locations.repository';
import { inventoryRepository } from './inventory.repository';
import { supplierLedgerRepository } from './supplier-ledger.repository';
import { variantsRepository } from './variants.repository';
import { productsRepository } from './products.repository';

export class PurchaseReturnsRepository {
  private getReturnsInternal(): PurchaseReturn[] {
    const list = demoStorage.getItem<PurchaseReturn[]>(STORAGE_KEYS.PURCHASE_RETURNS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.PURCHASE_RETURNS, [...SEED_PURCHASE_RETURNS]);
      return [...SEED_PURCHASE_RETURNS];
    }
    return list;
  }

  private saveReturnsInternal(returns: PurchaseReturn[]): void {
    demoStorage.setItem(STORAGE_KEYS.PURCHASE_RETURNS, returns);
  }

  public getAll(filter?: PurchaseReturnFilterOptions): PurchaseReturn[] {
    let list = this.getReturnsInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime()
      );
    }

    if (filter.supplierId && filter.supplierId !== 'ALL') {
      list = list.filter((r) => r.supplierId === filter.supplierId);
    }

    if (filter.branchId && filter.branchId !== 'all' && filter.branchId !== 'ALL') {
      list = list.filter((r) => r.branchId === filter.branchId);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((r) => new Date(r.returnDate).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((r) => new Date(r.returnDate).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.returnNumber.toLowerCase().includes(q) ||
          r.debitNoteNumber.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }

    return [...list].sort(
      (a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime()
    );
  }

  public getById(id: string): PurchaseReturn | null {
    const list = this.getReturnsInternal();
    return list.find((r) => r.id === id || r.returnNumber === id || r.debitNoteNumber === id) || null;
  }

  public getNextReturnNumber(): string {
    const list = this.getReturnsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((r) => r.returnNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `PR-${todayStr}-${nextSeq}`;
  }

  public getNextDebitNoteNumber(): string {
    const list = this.getReturnsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((r) => r.debitNoteNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `DN-${todayStr}-${nextSeq}`;
  }

  public create(dto: CreatePurchaseReturnDTO): PurchaseReturn {
    return this.createReturn(dto).purchaseReturn;
  }

  /**
   * Process a purchase return to supplier and generate a debit note.
   * Atomically:
   * 1. Deducts items from inventory at destination stock location.
   * 2. Reduces supplier accounts payable outstanding.
   * 3. Posts DEBIT entry to supplier ledger.
   * 4. Issues Debit Note.
   */
  public createReturn(dto: CreatePurchaseReturnDTO): {
    purchaseReturn: PurchaseReturn;
    movements: StockMovement[];
  } {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('At least one item must be returned.');
    }

    const supplier = suppliersRepository.getById(dto.supplierId);
    if (!supplier) {
      throw new Error(`Supplier with ID "${dto.supplierId}" not found.`);
    }

    const branch = branchesRepository.getById(dto.branchId);
    if (!branch) {
      throw new Error(`Branch with ID "${dto.branchId}" not found.`);
    }

    const location = stockLocationsRepository.getById(dto.locationId);
    if (!location) {
      throw new Error(`Stock location with ID "${dto.locationId}" not found.`);
    }

    let totalAmount = 0;
    const returnItems: PurchaseReturnItem[] = [];

    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new Error(`Return quantity for SKU "${item.sku}" must be greater than zero.`);
      }

      const variant = variantsRepository.getBySku(item.sku);
      const product = variant ? productsRepository.getById(variant.productId) : null;
      const unitCost = item.unitCost !== undefined ? item.unitCost : 0;
      const totalCost = item.quantity * unitCost;

      totalAmount += totalCost;
      returnItems.push({
        sku: item.sku,
        variantId: variant?.id || `VAR-${item.sku}`,
        productName: product?.name || item.sku,
        quantity: item.quantity,
        unitCost,
        totalCost,
      });
    }

    const returnNumber = this.getNextReturnNumber();
    const debitNoteNumber = this.getNextDebitNoteNumber();
    const now = new Date().toISOString();

    // 1. Deduct stock from the specified location
    const movements = inventoryRepository.deductStockForPurchaseReturn(
      branch.id,
      location.id,
      dto.items,
      debitNoteNumber,
      dto.createdByName || 'Purchasing Officer'
    );

    // 2. Reduce supplier outstanding accounts payable
    suppliersRepository.adjustOutstanding(supplier.id, -totalAmount);

    // 3. Post to Supplier Ledger (DEBIT entry: reduces payable)
    supplierLedgerRepository.addEntry({
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: dto.returnDate || now.slice(0, 10),
      type: 'DEBIT_NOTE',
      referenceNumber: debitNoteNumber,
      description: `Purchase Return #${returnNumber} (Debit Note #${debitNoteNumber}): ${dto.reason.trim()}`,
      debit: totalAmount,
      credit: 0,
      branchId: branch.id,
      branchName: branch.name,
      createdByName: dto.createdByName,
    });

    const newReturn: PurchaseReturn = {
      id: `PR-${Date.now().toString().slice(-6)}`,
      returnNumber,
      debitNoteNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      branchId: branch.id,
      branchName: branch.name,
      locationId: location.id,
      locationName: location.name,
      poId: dto.poId,
      billId: dto.billId,
      returnDate: dto.returnDate || now.slice(0, 10),
      reason: dto.reason.trim(),
      items: returnItems,
      totalAmount,
      status: 'COMPLETED',
      createdByName: dto.createdByName || 'Purchasing Officer',
      createdAt: now,
    };

    const list = this.getReturnsInternal();
    list.unshift(newReturn);
    this.saveReturnsInternal(list);

    return {
      purchaseReturn: newReturn,
      movements,
    };
  }

  public resetToSeed(): PurchaseReturn[] {
    const seed = [...SEED_PURCHASE_RETURNS];
    demoStorage.setItem(STORAGE_KEYS.PURCHASE_RETURNS, seed);
    return seed;
  }
}

export const purchaseReturnsRepository = new PurchaseReturnsRepository();
