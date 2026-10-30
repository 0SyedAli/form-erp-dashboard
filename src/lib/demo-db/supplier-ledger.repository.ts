import { SupplierLedgerEntry, SupplierLedgerEntryType } from '@/types';
import { STORAGE_KEYS, SupplierLedgerFilterOptions } from './schema';
import { demoStorage } from './storage';
import { SEED_SUPPLIER_LEDGER } from './seed';

export interface CreateSupplierLedgerEntryInput {
  supplierId: string;
  supplierName?: string;
  date: string;
  type: SupplierLedgerEntryType;
  referenceNumber: string;
  documentId?: string;
  description: string;
  debit: number; // Reduces payable (Payment, Debit Note)
  credit: number; // Increases payable (Bill, Opening Balance)
  branchId?: string;
  branchName?: string;
  createdByName?: string;
}

export class SupplierLedgerRepository {
  private getLedgerInternal(): SupplierLedgerEntry[] {
    const list = demoStorage.getItem<SupplierLedgerEntry[]>(STORAGE_KEYS.SUPPLIER_LEDGER, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.SUPPLIER_LEDGER, [...SEED_SUPPLIER_LEDGER]);
      return [...SEED_SUPPLIER_LEDGER];
    }
    return list;
  }

  private saveLedgerInternal(entries: SupplierLedgerEntry[]): void {
    demoStorage.setItem(STORAGE_KEYS.SUPPLIER_LEDGER, entries);
  }

  public getAll(filter?: SupplierLedgerFilterOptions): SupplierLedgerEntry[] {
    let list = this.getLedgerInternal();

    if (filter?.supplierId) {
      list = list.filter((e) => e.supplierId === filter.supplierId);
    }

    if (filter?.type && filter.type !== 'ALL') {
      list = list.filter((e) => e.type === filter.type);
    }

    if (filter?.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((e) => new Date(e.date).getTime() >= start);
    }

    if (filter?.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((e) => new Date(e.date).getTime() <= end);
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.referenceNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      );
    }

    return [...list].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  public getBySupplierId(supplierId: string): SupplierLedgerEntry[] {
    const list = this.getLedgerInternal();
    return list
      .filter((e) => e.supplierId === supplierId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  public getLedger(supplierId: string): SupplierLedgerEntry[] {
    return this.getBySupplierId(supplierId);
  }

  public getSummary(supplierId: string): {
    totalBilled: number;
    totalPaid: number;
    totalDebitNotes: number;
    currentBalance: number;
  } {
    const entries = this.getBySupplierId(supplierId);
    const totalBilled = entries
      .filter((e) => e.type === 'BILL')
      .reduce((sum, e) => sum + e.credit, 0);
    const totalPaid = entries
      .filter((e) => e.type === 'PAYMENT')
      .reduce((sum, e) => sum + e.debit, 0);
    const totalDebitNotes = entries
      .filter((e) => e.type === 'DEBIT_NOTE')
      .reduce((sum, e) => sum + e.debit, 0);
    const currentBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;

    return { totalBilled, totalPaid, totalDebitNotes, currentBalance };
  }

  public getRunningBalance(supplierId: string): number {
    const entries = this.getBySupplierId(supplierId);
    if (entries.length === 0) return 0;
    return entries[entries.length - 1].balance;
  }

  /**
   * Add a new entry to the supplier accounts payable ledger.
   * Accounting convention for accounts payable (liability):
   * Credit = increases payable (e.g. Bills)
   * Debit = decreases payable (e.g. Payments, Debit Notes / Returns)
   * New Balance = previous balance + credit - debit
   */
  public addEntry(input: CreateSupplierLedgerEntryInput): SupplierLedgerEntry {
    const list = this.getLedgerInternal();
    const supplierEntries = list
      .filter((e) => e.supplierId === input.supplierId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const lastBalance = supplierEntries.length > 0 ? supplierEntries[supplierEntries.length - 1].balance : 0;
    const debit = Math.max(0, input.debit || 0);
    const credit = Math.max(0, input.credit || 0);
    const newBalance = Math.max(0, lastBalance + credit - debit);

    const now = new Date().toISOString();
    const newEntry: SupplierLedgerEntry = {
      id: `SLEDG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      date: input.date || now,
      type: input.type,
      referenceNumber: input.referenceNumber,
      documentId: input.documentId,
      description: input.description,
      debit,
      credit,
      balance: newBalance,
      branchId: input.branchId,
      branchName: input.branchName,
      createdByName: input.createdByName || 'Accounts Payable Officer',
      createdAt: now,
    };

    list.push(newEntry);
    this.saveLedgerInternal(list);
    return newEntry;
  }

  public resetToSeed(): SupplierLedgerEntry[] {
    const seed = [...SEED_SUPPLIER_LEDGER];
    demoStorage.setItem(STORAGE_KEYS.SUPPLIER_LEDGER, seed);
    return seed;
  }
}

export const supplierLedgerRepository = new SupplierLedgerRepository();
