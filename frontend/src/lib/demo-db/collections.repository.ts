import { PaymentCollection, CustomerAdvance } from '@/types';
import {
  STORAGE_KEYS,
  CreatePaymentCollectionDTO,
  CollectionFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { customersRepository } from './customers.repository';
import { customerLedgerRepository } from './customer-ledger.repository';
import { salesRepository } from './sales.repository';
import { branchesRepository } from './branches.repository';

export class CollectionsRepository {
  private getCollectionsInternal(): PaymentCollection[] {
    return demoStorage.getItem<PaymentCollection[]>(STORAGE_KEYS.PAYMENT_COLLECTIONS, []);
  }

  private saveCollectionsInternal(collections: PaymentCollection[]): void {
    demoStorage.setItem(STORAGE_KEYS.PAYMENT_COLLECTIONS, collections);
  }

  private getAdvancesInternal(): CustomerAdvance[] {
    return demoStorage.getItem<CustomerAdvance[]>(STORAGE_KEYS.CUSTOMER_ADVANCES, []);
  }

  private saveAdvancesInternal(advances: CustomerAdvance[]): void {
    demoStorage.setItem(STORAGE_KEYS.CUSTOMER_ADVANCES, advances);
  }

  public getAll(filter?: CollectionFilterOptions): PaymentCollection[] {
    let list = this.getCollectionsInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
      );
    }

    if (filter.customerId) {
      list = list.filter((c) => c.customerId === filter.customerId);
    }

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter((c) => c.branchId === filter.branchId);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((c) => new Date(c.collectedAt).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((c) => new Date(c.collectedAt).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.receiptNumber.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q) ||
          (c.reference && c.reference.toLowerCase().includes(q))
      );
    }

    return list.sort(
      (a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()
    );
  }

  public getById(id: string): PaymentCollection | null {
    const list = this.getCollectionsInternal();
    return list.find((c) => c.id === id || c.receiptNumber === id) || null;
  }

  public getAdvancesByCustomer(customerId: string): CustomerAdvance[] {
    return this.getAdvancesInternal().filter((a) => a.customerId === customerId);
  }

  public getNextReceiptNumber(): string {
    const list = this.getCollectionsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((c) => c.receiptNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `REC-${todayStr}-${nextSeq}`;
  }

  /**
   * Process a payment recovery collection.
   * Atomically allocates to open invoices, updates customer outstanding, records customer ledger entry,
   * and saves unallocated excess as an advance.
   */
  public createCollection(dto: CreatePaymentCollectionDTO): PaymentCollection {
    if (dto.amount <= 0) {
      throw new Error('Collection amount must be a positive number.');
    }

    const customer = customersRepository.getById(dto.customerId);
    if (!customer) {
      throw new Error(`Customer with ID "${dto.customerId}" not found.`);
    }

    const branch = branchesRepository.getById(dto.branchId) || {
      id: dto.branchId,
      name: 'Main Branch',
    };

    const receiptNumber = this.getNextReceiptNumber();
    const nowIso = new Date().toISOString();

    let totalAllocated = 0;
    const finalAllocations: PaymentCollection['allocations'] = [];

    // Process invoice allocations
    if (Array.isArray(dto.allocations) && dto.allocations.length > 0) {
      for (const alloc of dto.allocations) {
        if (alloc.allocatedAmount <= 0) continue;

        const invoice = salesRepository.getById(alloc.invoiceId);
        if (invoice) {
          const prevOutstanding = invoice.amountDue;
          if (alloc.allocatedAmount > prevOutstanding) {
            throw new Error(
              `Allocation of Rs. ${alloc.allocatedAmount.toLocaleString()} exceeds invoice outstanding balance of Rs. ${prevOutstanding.toLocaleString()}.`
            );
          }
          const actualAlloc = alloc.allocatedAmount;

          // Update invoice
          const newPaid = invoice.amountPaid + actualAlloc;
          const newDue = Math.max(0, invoice.amountDue - actualAlloc);
          const newStatus = newDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

          salesRepository.updateInvoicePayment(invoice.id, {
            amountPaid: newPaid,
            amountDue: newDue,
            paymentStatus: newStatus,
          });

          totalAllocated += actualAlloc;
          finalAllocations.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            allocatedAmount: actualAlloc,
            totalInvoiceAmount: invoice.netAmount,
            previousOutstanding: prevOutstanding,
            newOutstanding: newDue,
          });
        }
      }
    }

    const unallocatedAdvance = Math.max(0, dto.amount - totalAllocated);

    // Update customer outstanding in CustomersRepository
    customersRepository.adjustOutstanding(customer.id, -totalAllocated);

    // Add entry to Customer Ledger
    customerLedgerRepository.addEntry({
      customerId: customer.id,
      customerName: customer.name,
      date: nowIso,
      type: 'PAYMENT',
      referenceNumber: receiptNumber,
      description: `Payment Recovery [${dto.paymentMethod}] ${dto.reference ? `Ref: ${dto.reference}` : ''} - Allocated Rs. ${totalAllocated.toLocaleString()}${unallocatedAdvance > 0 ? ` (Advance Rs. ${unallocatedAdvance.toLocaleString()})` : ''}`,
      debit: 0,
      credit: dto.amount,
      branchId: branch.id,
      branchName: branch.name,
      createdByName: dto.collectedByName || 'Admin',
    });

    // Save advance if excess
    if (unallocatedAdvance > 0 && dto.saveExcessAsAdvance !== false) {
      const advances = this.getAdvancesInternal();
      advances.push({
        id: `ADV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
        customerId: customer.id,
        customerName: customer.name,
        collectionId: receiptNumber,
        amount: unallocatedAdvance,
        originalAmount: unallocatedAdvance,
        remainingAmount: unallocatedAdvance,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      this.saveAdvancesInternal(advances);
    }

    const newCollection: PaymentCollection = {
      id: `COL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      receiptNumber,
      customerId: customer.id,
      customerName: customer.name,
      branchId: branch.id,
      branchName: branch.name,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      reference: dto.reference?.trim() || undefined,
      notes: dto.notes?.trim() || undefined,
      allocations: finalAllocations,
      unallocatedAdvance,
      collectedById: dto.collectedById,
      collectedByName: dto.collectedByName || 'Admin',
      collectedAt: nowIso,
    };

    const collections = this.getCollectionsInternal();
    collections.unshift(newCollection);
    this.saveCollectionsInternal(collections);

    return newCollection;
  }

  public resetToSeed(): PaymentCollection[] {
    demoStorage.setItem(STORAGE_KEYS.PAYMENT_COLLECTIONS, []);
    demoStorage.setItem(STORAGE_KEYS.CUSTOMER_ADVANCES, []);
    return [];
  }
}

export const collectionsRepository = new CollectionsRepository();
