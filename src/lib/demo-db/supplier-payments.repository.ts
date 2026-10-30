import { SupplierPayment, SupplierPaymentAllocationItem } from '@/types';
import {
  STORAGE_KEYS,
  CreateSupplierPaymentDTO,
  SupplierPaymentFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { SEED_SUPPLIER_PAYMENTS } from './seed';
import { suppliersRepository } from './suppliers.repository';
import { branchesRepository } from './branches.repository';
import { purchaseBillsRepository } from './purchase-bills.repository';
import { supplierLedgerRepository } from './supplier-ledger.repository';

export class SupplierPaymentsRepository {
  private getPaymentsInternal(): SupplierPayment[] {
    const list = demoStorage.getItem<SupplierPayment[]>(STORAGE_KEYS.SUPPLIER_PAYMENTS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.SUPPLIER_PAYMENTS, [...SEED_SUPPLIER_PAYMENTS]);
      return [...SEED_SUPPLIER_PAYMENTS];
    }
    return list;
  }

  private savePaymentsInternal(payments: SupplierPayment[]): void {
    demoStorage.setItem(STORAGE_KEYS.SUPPLIER_PAYMENTS, payments);
  }

  public getAll(filter?: SupplierPaymentFilterOptions): SupplierPayment[] {
    let list = this.getPaymentsInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      );
    }

    if (filter.supplierId && filter.supplierId !== 'ALL') {
      list = list.filter((p) => p.supplierId === filter.supplierId);
    }

    if (filter.branchId && filter.branchId !== 'all' && filter.branchId !== 'ALL') {
      list = list.filter((p) => p.branchId === filter.branchId);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((p) => new Date(p.paymentDate).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((p) => new Date(p.paymentDate).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.voucherNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q))
      );
    }

    return [...list].sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  }

  public getById(id: string): SupplierPayment | null {
    const list = this.getPaymentsInternal();
    return list.find((p) => p.id === id || p.voucherNumber === id) || null;
  }

  public getNextVoucherNumber(): string {
    const list = this.getPaymentsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((p) => p.voucherNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `PV-${todayStr}-${nextSeq}`;
  }

  public create(dto: CreateSupplierPaymentDTO): SupplierPayment {
    return this.createPayment(dto);
  }

  /**
   * Process a supplier payment voucher.
   * Atomically:
   * 1. Validates amount and allocations against open bills.
   * 2. Updates bill amountPaid, amountDue, and paymentStatus.
   * 3. Decreases supplier outstanding accounts payable.
   * 4. Posts DEBIT entry to supplier ledger (decreases liability balance).
   * 5. Saves supplier payment record.
   */
  public createPayment(dto: CreateSupplierPaymentDTO): SupplierPayment {
    if (dto.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const supplier = suppliersRepository.getById(dto.supplierId);
    if (!supplier) {
      throw new Error(`Supplier with ID "${dto.supplierId}" not found.`);
    }

    const branch = branchesRepository.getById(dto.branchId) || {
      id: dto.branchId,
      name: 'Main Branch',
    };

    let totalAllocated = 0;
    const finalAllocations: SupplierPaymentAllocationItem[] = [];

    if (Array.isArray(dto.allocations) && dto.allocations.length > 0) {
      for (const alloc of dto.allocations) {
        if (alloc.allocatedAmount <= 0) continue;

        const bill = purchaseBillsRepository.getById(alloc.billId);
        if (!bill) {
          throw new Error(`Supplier bill with ID "${alloc.billId}" not found.`);
        }

        if (alloc.allocatedAmount > bill.amountDue) {
          throw new Error(
            `Allocated amount (Rs. ${alloc.allocatedAmount.toLocaleString()}) exceeds bill outstanding balance of Rs. ${bill.amountDue.toLocaleString()} on Bill #${bill.billNumber}.`
          );
        }

        const newPaid = bill.amountPaid + alloc.allocatedAmount;
        const newDue = Math.max(0, bill.amountDue - alloc.allocatedAmount);
        const paymentStatus = newDue === 0 ? 'PAID' : 'PARTIALLY_PAID';

        purchaseBillsRepository.updatePayment(bill.id, {
          amountPaid: newPaid,
          amountDue: newDue,
          paymentStatus,
        });

        totalAllocated += alloc.allocatedAmount;
        finalAllocations.push({
          billId: bill.id,
          billNumber: bill.billNumber,
          supplierInvoiceNumber: bill.supplierInvoiceNumber,
          allocatedAmount: alloc.allocatedAmount,
          previousDue: bill.amountDue,
          newDue,
        });
      }
    }

    if (totalAllocated > dto.amount) {
      throw new Error('Total allocations exceed the payment voucher amount.');
    }

    const unallocatedAdvance = Math.max(0, dto.amount - totalAllocated);
    const voucherNumber = this.getNextVoucherNumber();
    const now = new Date().toISOString();

    // 1. Update Supplier Outstanding (reduces payable by payment amount)
    suppliersRepository.adjustOutstanding(supplier.id, -dto.amount);

    // 2. Post to Supplier Ledger (DEBIT entry: decreases payable)
    supplierLedgerRepository.addEntry({
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: dto.paymentDate || now.slice(0, 10),
      type: unallocatedAdvance > 0 && totalAllocated === 0 ? 'ADVANCE' : 'PAYMENT',
      referenceNumber: voucherNumber,
      description: `Payment Voucher #${voucherNumber} (${dto.paymentMethod}) ${
        dto.referenceNumber ? `Ref #${dto.referenceNumber}` : ''
      }`,
      debit: dto.amount,
      credit: 0,
      branchId: branch.id,
      branchName: branch.name,
      createdByName: dto.paidBy,
    });

    const newPayment: SupplierPayment = {
      id: `PAY-SUP-${Date.now().toString().slice(-6)}`,
      voucherNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      branchId: branch.id,
      branchName: branch.name,
      paymentDate: dto.paymentDate || now.slice(0, 10),
      paymentMethod: dto.paymentMethod,
      amount: dto.amount,
      referenceNumber: dto.referenceNumber?.trim() || undefined,
      chequeDate: dto.chequeDate,
      chequeStatus: dto.paymentMethod === 'CHEQUE' ? 'CLEARED' : undefined,
      allocations: finalAllocations,
      unallocatedAdvance,
      paidBy: dto.paidBy || 'Finance Officer',
      notes: dto.notes?.trim() || undefined,
      createdAt: now,
    };

    const list = this.getPaymentsInternal();
    list.unshift(newPayment);
    this.savePaymentsInternal(list);

    return newPayment;
  }

  public getSummary(branchId?: string): {
    totalPayments: number;
    totalAmountPaid: number;
    paymentsThisMonth: number;
  } {
    let list = this.getPaymentsInternal();
    if (branchId && branchId !== 'all') {
      list = list.filter((p) => p.branchId === branchId);
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonth = list.filter((p) => p.paymentDate.startsWith(currentMonth));

    return {
      totalPayments: list.length,
      totalAmountPaid: list.reduce((sum, p) => sum + p.amount, 0),
      paymentsThisMonth: thisMonth.reduce((sum, p) => sum + p.amount, 0),
    };
  }

  public resetToSeed(): SupplierPayment[] {
    const seed = [...SEED_SUPPLIER_PAYMENTS];
    demoStorage.setItem(STORAGE_KEYS.SUPPLIER_PAYMENTS, seed);
    return seed;
  }
}

export const supplierPaymentsRepository = new SupplierPaymentsRepository();
