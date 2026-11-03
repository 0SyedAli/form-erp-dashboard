import { SupplierBill, SupplierBillItem, SupplierBillPaymentStatus } from '@/types';
import {
  STORAGE_KEYS,
  CreateSupplierBillDTO,
  SupplierBillFilterOptions,
} from './schema';
import { demoStorage } from './storage';
import { SEED_SUPPLIER_BILLS } from './seed';
import { suppliersRepository } from './suppliers.repository';
import { branchesRepository } from './branches.repository';
import { supplierLedgerRepository } from './supplier-ledger.repository';

export class PurchaseBillsRepository {
  private getBillsInternal(): SupplierBill[] {
    const list = demoStorage.getItem<SupplierBill[]>(STORAGE_KEYS.SUPPLIER_BILLS, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.SUPPLIER_BILLS, [...SEED_SUPPLIER_BILLS]);
      return [...SEED_SUPPLIER_BILLS];
    }
    return list;
  }

  private saveBillsInternal(bills: SupplierBill[]): void {
    demoStorage.setItem(STORAGE_KEYS.SUPPLIER_BILLS, bills);
  }

  public getAll(filter?: SupplierBillFilterOptions): SupplierBill[] {
    let list = this.getBillsInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime()
      );
    }

    if (filter.supplierId && filter.supplierId !== 'ALL') {
      list = list.filter((b) => b.supplierId === filter.supplierId);
    }

    if (filter.branchId && filter.branchId !== 'all' && filter.branchId !== 'ALL') {
      list = list.filter((b) => b.branchId === filter.branchId);
    }

    if (filter.status && filter.status !== 'ALL') {
      list = list.filter((b) => b.status === filter.status);
    }

    if (filter.paymentStatus && filter.paymentStatus !== 'ALL') {
      list = list.filter((b) => b.paymentStatus === filter.paymentStatus);
    }

    if (filter.overdueOnly) {
      const now = new Date().toISOString().slice(0, 10);
      list = list.filter((b) => b.amountDue > 0 && b.dueDate < now);
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((b) => new Date(b.billDate).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((b) => new Date(b.billDate).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.billNumber.toLowerCase().includes(q) ||
          b.supplierInvoiceNumber.toLowerCase().includes(q) ||
          b.supplierName.toLowerCase().includes(q) ||
          (b.poNumber && b.poNumber.toLowerCase().includes(q))
      );
    }

    return [...list].sort(
      (a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime()
    );
  }

  public getById(id: string): SupplierBill | null {
    const list = this.getBillsInternal();
    return list.find((b) => b.id === id || b.billNumber === id) || null;
  }

  public getNextBillNumber(): string {
    const list = this.getBillsInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todays = list.filter((b) => b.billNumber.includes(todayStr));
    const nextSeq = String(todays.length + 1).padStart(4, '0');
    return `BILL-${todayStr}-${nextSeq}`;
  }

  public create(dto: CreateSupplierBillDTO): SupplierBill {
    if (!dto.items || dto.items.length === 0) {
      throw new Error('Supplier bill must contain at least one line item.');
    }

    const supplier = suppliersRepository.getById(dto.supplierId);
    if (!supplier) {
      throw new Error(`Supplier with ID "${dto.supplierId}" not found.`);
    }

    const branch = branchesRepository.getById(dto.branchId);
    if (!branch) {
      throw new Error(`Branch with ID "${dto.branchId}" not found.`);
    }

    const invoiceRef = dto.supplierInvoiceNumber.trim();
    if (!invoiceRef) {
      throw new Error('Supplier Invoice Number / Reference is required.');
    }

    // Check duplicate supplier invoice reference for this supplier
    const list = this.getBillsInternal();
    if (
      list.some(
        (b) =>
          b.supplierId === supplier.id &&
          b.supplierInvoiceNumber.toLowerCase() === invoiceRef.toLowerCase()
      )
    ) {
      throw new Error(
        `Supplier Invoice #${invoiceRef} has already been registered for supplier "${supplier.name}".`
      );
    }

    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    const items: SupplierBillItem[] = dto.items.map((i) => {
      const lineSub = i.quantity * i.unitCost;
      const d = i.discount || 0;
      const t = i.tax || 0;
      const lineTotal = Math.max(0, lineSub - d + t);

      subtotal += lineSub;
      discountAmount += d;
      taxAmount += t;

      return {
        sku: i.sku,
        variantId: i.variantId || '',
        productName: i.productName || 'Mattress Product',
        quantity: i.quantity,
        unitCost: i.unitCost,
        discount: d,
        tax: t,
        total: lineTotal,
      };
    });

    const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount);
    const billNumber = this.getNextBillNumber();
    const now = new Date().toISOString();

    const defaultDays = supplier.defaultCreditDays || 30;
    const dueDate =
      dto.dueDate ||
      new Date(Date.now() + defaultDays * 86400000).toISOString().slice(0, 10);

    const newBill: SupplierBill = {
      id: `BILL-${Date.now().toString().slice(-6)}`,
      billNumber,
      supplierInvoiceNumber: invoiceRef,
      supplierId: supplier.id,
      supplierName: supplier.name,
      branchId: branch.id,
      branchName: branch.name,
      poId: dto.poId,
      poNumber: dto.poId, // will be displayed or enriched
      grnIds: dto.grnIds || [],
      billDate: dto.billDate || now.slice(0, 10),
      dueDate,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
      amountPaid: 0,
      amountDue: grandTotal,
      status: 'POSTED',
      paymentStatus: 'UNPAID',
      notes: dto.notes?.trim() || undefined,
      createdBy: dto.createdBy || 'Accounts Payable',
      createdAt: now,
      updatedAt: now,
    };

    list.unshift(newBill);
    this.saveBillsInternal(list);

    // 1. Update Supplier Outstanding (increases payable)
    suppliersRepository.adjustOutstanding(supplier.id, grandTotal);

    // 2. Post to Supplier Ledger (CREDIT entry: increases liability)
    supplierLedgerRepository.addEntry({
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: newBill.billDate,
      type: 'BILL',
      referenceNumber: billNumber,
      documentId: newBill.id,
      description: `Supplier Bill #${billNumber} (Inv #${invoiceRef}) for ${branch.name}`,
      debit: 0,
      credit: grandTotal,
      branchId: branch.id,
      branchName: branch.name,
      createdByName: dto.createdBy || 'Accounts Officer',
    });

    return newBill;
  }

  public updatePayment(
    billId: string,
    updates: { amountPaid: number; amountDue: number; paymentStatus: SupplierBillPaymentStatus }
  ): SupplierBill {
    const list = this.getBillsInternal();
    const index = list.findIndex((b) => b.id === billId || b.billNumber === billId);
    if (index === -1) {
      throw new Error(`Supplier bill with ID "${billId}" not found.`);
    }

    const current = list[index];
    const updated: SupplierBill = {
      ...current,
      amountPaid: updates.amountPaid,
      amountDue: updates.amountDue,
      paymentStatus: updates.paymentStatus,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.saveBillsInternal(list);
    return updated;
  }

  public getSummary(branchId?: string): {
    totalBills: number;
    totalAmount: number;
    totalPaid: number;
    totalDue: number;
    overdueBillsCount: number;
    overdueBillsAmount: number;
  } {
    let list = this.getBillsInternal().filter((b) => b.status === 'POSTED');
    if (branchId && branchId !== 'all') {
      list = list.filter((b) => b.branchId === branchId);
    }

    const now = new Date().toISOString().slice(0, 10);
    const overdue = list.filter((b) => b.amountDue > 0 && b.dueDate < now);

    return {
      totalBills: list.length,
      totalAmount: list.reduce((sum, b) => sum + b.grandTotal, 0),
      totalPaid: list.reduce((sum, b) => sum + b.amountPaid, 0),
      totalDue: list.reduce((sum, b) => sum + b.amountDue, 0),
      overdueBillsCount: overdue.length,
      overdueBillsAmount: overdue.reduce((sum, b) => sum + b.amountDue, 0),
    };
  }

  public resetToSeed(): SupplierBill[] {
    const seed = [...SEED_SUPPLIER_BILLS];
    demoStorage.setItem(STORAGE_KEYS.SUPPLIER_BILLS, seed);
    return seed;
  }
}

export const purchaseBillsRepository = new PurchaseBillsRepository();
