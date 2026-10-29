import { CustomerLedgerEntry } from '@/types';
import { STORAGE_KEYS, CreateLedgerEntryDTO } from './schema';
import { SEED_CUSTOMER_LEDGER } from './seed';
import { demoStorage } from './storage';

export class CustomerLedgerRepository {
  private getLedgerInternal(): CustomerLedgerEntry[] {
    const list = demoStorage.getItem<CustomerLedgerEntry[]>(STORAGE_KEYS.CUSTOMER_LEDGER, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.CUSTOMER_LEDGER, [...SEED_CUSTOMER_LEDGER]);
      return [...SEED_CUSTOMER_LEDGER];
    }
    return list;
  }

  private saveLedgerInternal(entries: CustomerLedgerEntry[]): void {
    demoStorage.setItem(STORAGE_KEYS.CUSTOMER_LEDGER, entries);
  }

  public getAll(): CustomerLedgerEntry[] {
    const list = this.getLedgerInternal();
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  public getByCustomerId(customerId: string): CustomerLedgerEntry[] {
    const list = this.getLedgerInternal();
    return list
      .filter((e) => e.customerId === customerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  public addEntry(dto: CreateLedgerEntryDTO): CustomerLedgerEntry {
    const list = this.getLedgerInternal();
    const customerEntries = this.getByCustomerId(dto.customerId);

    // Compute running balance: previous balance + debit - credit
    const previousBalance =
      customerEntries.length > 0
        ? customerEntries[customerEntries.length - 1].runningBalance
        : 0;

    const debit = dto.debit || 0;
    const credit = dto.credit || 0;
    const runningBalance = Math.max(0, previousBalance + debit - credit);
    const nowIso = dto.date || new Date().toISOString();
    const branchId = dto.branchId || 'BR-MAIN-01';

    const newEntry: CustomerLedgerEntry = {
      id: `LEDG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      customerId: dto.customerId,
      customerName: dto.customerName,
      date: nowIso,
      type: dto.type,
      referenceNumber: dto.referenceNumber,
      invoiceId: dto.invoiceId,
      description: dto.description,
      debit,
      credit,
      runningBalance,
      branchId,
      branchName: dto.branchName,
      createdById: dto.createdById,
      createdByName: dto.createdByName || 'Admin',
      createdAt: nowIso,
    };

    list.push(newEntry);
    this.saveLedgerInternal(list);
    return newEntry;
  }

  public resetToSeed(): CustomerLedgerEntry[] {
    const seed = [...SEED_CUSTOMER_LEDGER];
    demoStorage.setItem(STORAGE_KEYS.CUSTOMER_LEDGER, seed);
    return seed;
  }
}

export const customerLedgerRepository = new CustomerLedgerRepository();
