import { HeldSale, POSCartItem } from '@/types';
import { STORAGE_KEYS } from './schema';
import { demoStorage } from './storage';

export interface CreateHeldSaleDTO {
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: POSCartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  totalAmount?: number;
  notes?: string;
}

class HeldSalesRepository {
  private getHeldSalesInternal(): HeldSale[] {
    return demoStorage.getItem<HeldSale[]>(STORAGE_KEYS.HELD_SALES, []);
  }

  private saveHeldSalesInternal(sales: HeldSale[]): void {
    demoStorage.setItem(STORAGE_KEYS.HELD_SALES, sales);
  }

  public getAll(branchId?: string): HeldSale[] {
    const list = this.getHeldSalesInternal();
    if (!branchId || branchId === 'all') {
      return [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return list
      .filter((s) => s.branchId === branchId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getById(id: string): HeldSale | null {
    const list = this.getHeldSalesInternal();
    return list.find((s) => s.id === id || s.holdReference === id) || null;
  }

  public holdSale(dto: CreateHeldSaleDTO): HeldSale {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('Cannot hold an empty cart.');
    }

    const list = this.getHeldSalesInternal();
    const holdNumber = 1000 + list.length + 1;
    const holdReference = `HOLD-${holdNumber}`;

    const newHeldSale: HeldSale = {
      id: `HELD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      holdReference,
      branchId: dto.branchId,
      branchName: dto.branchName,
      cashierId: dto.cashierId,
      cashierName: dto.cashierName,
      customerName: dto.customerName?.trim() || undefined,
      customerPhone: dto.customerPhone?.trim() || undefined,
      items: dto.items,
      subtotal: dto.subtotal,
      discountAmount: dto.discountAmount,
      taxAmount: dto.taxAmount,
      grandTotal: dto.grandTotal,
      notes: dto.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    list.unshift(newHeldSale);
    this.saveHeldSalesInternal(list);
    return newHeldSale;
  }

  public deleteHeldSale(id: string): boolean {
    const list = this.getHeldSalesInternal();
    const filtered = list.filter((s) => s.id !== id && s.holdReference !== id);
    if (filtered.length === list.length) {
      return false;
    }
    this.saveHeldSalesInternal(filtered);
    return true;
  }

  public resetToSeed(): void {
    demoStorage.setItem(STORAGE_KEYS.HELD_SALES, []);
  }
}

export const heldSalesRepository = new HeldSalesRepository();
