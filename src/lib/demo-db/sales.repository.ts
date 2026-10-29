import {
  Invoice,
  InvoiceItem,
  POSCheckoutInput,
  POSCheckoutResult,
  StockMovement,
  CustomerType,
  InvoiceStatus,
  SaleType,
  PaymentArrangement,
  PriceListType,
  PaymentStatus,
} from '@/types';
import { STORAGE_KEYS } from './schema';
import { demoStorage } from './storage';
import { INITIAL_MOCK_INVOICES } from '@/data/mockData';
import { branchesRepository } from './branches.repository';
import { inventoryRepository } from './inventory.repository';
import { stockLocationsRepository } from './stock-locations.repository';
import { customersRepository } from './customers.repository';
import { customerLedgerRepository } from './customer-ledger.repository';

export interface SalesFilterOptions {
  branchId?: string | 'all';
  search?: string;
  startDate?: string;
  endDate?: string;
  cashier?: string;
  customerType?: CustomerType;
  saleType?: SaleType | 'all';
  paymentStatus?: PaymentStatus | 'all';
  status?: InvoiceStatus | 'all';
  customerId?: string;
  limit?: number;
}

class SalesRepository {
  private getInvoicesInternal(): Invoice[] {
    const list = demoStorage.getItem<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    if (!list || list.length === 0) {
      demoStorage.setItem(STORAGE_KEYS.INVOICES, [...INITIAL_MOCK_INVOICES]);
      return [...INITIAL_MOCK_INVOICES];
    }
    return list;
  }

  private saveInvoicesInternal(invoices: Invoice[]): void {
    demoStorage.setItem(STORAGE_KEYS.INVOICES, invoices);
  }

  public getAll(filter?: SalesFilterOptions): Invoice[] {
    let list = this.getInvoicesInternal();

    if (!filter) {
      return [...list].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    if (filter.branchId && filter.branchId !== 'all') {
      list = list.filter((inv) => inv.branchId === filter.branchId);
    }

    if (filter.customerType) {
      list = list.filter((inv) => inv.customerType === filter.customerType);
    }

    if (filter.saleType && filter.saleType !== 'all') {
      list = list.filter((inv) => inv.saleType === filter.saleType);
    }

    if (filter.paymentStatus && filter.paymentStatus !== 'all') {
      list = list.filter((inv) => inv.paymentStatus === filter.paymentStatus);
    }

    if (filter.customerId) {
      list = list.filter((inv) => inv.customerId === filter.customerId);
    }

    if (filter.status && filter.status !== 'all') {
      list = list.filter((inv) => inv.status === filter.status);
    }

    if (filter.cashier && filter.cashier !== 'all') {
      list = list.filter((inv) =>
        inv.salesPerson.toLowerCase().includes(filter.cashier!.toLowerCase())
      );
    }

    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      list = list.filter((inv) => new Date(inv.date).getTime() >= start);
    }

    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      list = list.filter((inv) => new Date(inv.date).getTime() <= end);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerName.toLowerCase().includes(q) ||
          inv.customerPhone.toLowerCase().includes(q) ||
          inv.salesPerson.toLowerCase().includes(q) ||
          (inv.saleType && inv.saleType.toLowerCase().includes(q)) ||
          inv.items.some(
            (item) =>
              item.productName.toLowerCase().includes(q) ||
              item.sku.toLowerCase().includes(q)
          )
      );
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (filter.limit && filter.limit > 0) {
      return list.slice(0, filter.limit);
    }

    return list;
  }

  public getById(id: string): Invoice | null {
    const list = this.getInvoicesInternal();
    return list.find((inv) => inv.id === id || inv.invoiceNumber === id) || null;
  }

  public getNextInvoiceNumber(): string {
    const list = this.getInvoicesInternal();
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const todaysInvoices = list.filter((inv) => inv.invoiceNumber.includes(todayStr));
    const nextSeq = String(todaysInvoices.length + 1).padStart(4, '0');
    return `INV-${todayStr}-${nextSeq}`;
  }

  /**
   * Update payment balances on an existing invoice (used by Payment Collections)
   */
  public updateInvoicePayment(
    invoiceId: string,
    updates: { amountPaid: number; amountDue: number; paymentStatus: PaymentStatus }
  ): Invoice {
    const list = this.getInvoicesInternal();
    const index = list.findIndex((inv) => inv.id === invoiceId || inv.invoiceNumber === invoiceId);
    if (index === -1) {
      throw new Error(`Invoice with ID "${invoiceId}" not found.`);
    }

    const current = list[index];
    const updated: Invoice = {
      ...current,
      amountPaid: updates.amountPaid,
      amountReceived: updates.amountPaid,
      amountDue: updates.amountDue,
      paymentStatus: updates.paymentStatus,
      status: updates.paymentStatus === 'PAID' ? 'COMPLETED' : 'PARTIAL',
    };

    list[index] = updated;
    this.saveInvoicesInternal(list);
    return updated;
  }

  /**
   * Complete a Unified POS sale (Walk-in, Wholesale, or Distributor).
   * Supports Full Payment, Partial Payment, and Full Credit with customer credit validation,
   * inventory deduction, and customer ledger posting.
   */
  public createSale(input: POSCheckoutInput): POSCheckoutResult {
    const branch = branchesRepository.getById(input.branchId);
    if (!branch) {
      throw new Error(`Branch with ID "${input.branchId}" does not exist.`);
    }

    if (!branch.isActive) {
      throw new Error(`Branch "${branch.name}" is inactive. Cannot process sales.`);
    }

    const saleType: SaleType = input.saleType || 'WALK_IN';

    // Verify branch retail permissions for walk-in
    if (saleType === 'WALK_IN' && branch.settings && branch.settings.allowRetailSales === false) {
      throw new Error(`Branch "${branch.name}" does not have retail sales enabled.`);
    }

    // Verify branch wholesale permissions
    if ((saleType === 'WHOLESALE' || saleType === 'DISTRIBUTOR') && branch.settings && branch.settings.allowWholesaleSales === false) {
      throw new Error(`Branch "${branch.name}" does not have wholesale/commercial sales enabled.`);
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Cart cannot be empty: Cart is empty.');
    }

    // Resolve payment arrangement & credit amounts
    const grandTotal = Math.max(0, input.grandTotal);
    const amountReceived = Math.max(0, input.amountReceived || 0);
    const creditAmount = Math.max(0, grandTotal - amountReceived);
    const changeAmount = Math.max(0, amountReceived - grandTotal);

    const paymentArrangement: PaymentArrangement =
      input.paymentArrangement ||
      (amountReceived >= grandTotal ? 'FULL' : amountReceived > 0 ? 'PARTIAL' : 'CREDIT');

    // Customer resolution and validation
    const customer = input.customerId ? customersRepository.getById(input.customerId) : null;

    if (saleType === 'WHOLESALE' && !customer) {
      throw new Error('Wholesale checkout requires an identified wholesale customer account.');
    }

    if (saleType === 'DISTRIBUTOR') {
      if (!customer) {
        throw new Error('Distributor checkout requires an identified distributor account.');
      }
      if (customer.customerType !== 'DISTRIBUTOR' && !input.creditOverride) {
        throw new Error(`Customer "${customer.name}" is not an authorized distributor account.`);
      }
    }

    // Credit validation
    if (creditAmount > 0) {
      if (!customer) {
        throw new Error(
          'Insufficient payment: Credit and partial payment sales require an identified customer account. Please select or register a customer.'
        );
      }

      if (customer.status !== 'ACTIVE') {
        throw new Error(`Customer "${customer.name}" status is ${customer.status}. Cannot issue credit.`);
      }

      if (!customer.creditEnabled) {
        throw new Error(`Credit privileges are disabled for customer "${customer.name}".`);
      }

      // Check credit limit
      if (creditAmount > customer.availableCredit && !input.creditOverride) {
        throw new Error(
          `Credit limit exceeded! Customer available credit is Rs. ${customer.availableCredit.toLocaleString()}, but credit requested is Rs. ${creditAmount.toLocaleString()}. Supervisor override required.`
        );
      }
    }

    // Determine target stock location for this branch
    const branchLocations = stockLocationsRepository.getByBranchId(input.branchId);
    const saleableLocation =
      branchLocations.find(
        (loc) =>
          loc.isActive &&
          loc.inventoryEnabled &&
          (loc.type === 'RETAIL_STOCKROOM' || loc.type === 'SHOWROOM_DISPLAY' || loc.type === 'WAREHOUSE')
      ) || branchLocations[0];

    if (!saleableLocation) {
      throw new Error(`No active stock location found for branch "${branch.name}".`);
    }

    const invoiceNumber = this.getNextInvoiceNumber();
    const nowIso = new Date().toISOString();

    // Deduct stock and log movements
    const deductedMovements: StockMovement[] = inventoryRepository.deductStockForSale(
      input.branchId,
      saleableLocation.id,
      input.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      invoiceNumber,
      input.cashierName
    );

    // Build Invoice Items
    const invoiceItems: InvoiceItem[] = input.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      total: item.unitPrice * item.quantity - (item.discount || 0),
    }));

    // Calculate Due Date for credit sales
    const defaultDays = customer?.defaultDueDays || 30;
    const dueDate =
      input.dueDate ||
      (creditAmount > 0
        ? new Date(Date.now() + defaultDays * 86400000).toISOString().slice(0, 10)
        : undefined);

    const paymentStatus: PaymentStatus =
      creditAmount <= 0 ? 'PAID' : amountReceived > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

    const customerTypeCategory: CustomerType =
      saleType === 'WALK_IN' ? 'RETAIL' : saleType === 'DISTRIBUTOR' ? 'DISTRIBUTOR' : 'WHOLESALE';

    const newInvoice: Invoice = {
      id: `INV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber,
      branchId: branch.id,
      branchName: branch.name,
      customerType: customerTypeCategory,
      customerName: customer ? customer.name : (input.customerName?.trim() || 'Walk-in Retail Customer'),
      customerPhone: customer ? customer.phone : (input.customerPhone?.trim() || '0300-0000000'),
      businessName: customer?.businessName,
      customerNTN: customer?.ntn,
      date: nowIso,
      items: invoiceItems,
      grossAmount: input.subtotal,
      discountAmount: input.discountAmount,
      returnAmount: 0,
      taxAmount: input.taxAmount,
      netAmount: grandTotal,
      amountPaid: amountReceived,
      amountDue: creditAmount,
      changeAmount: input.changeAmount !== undefined ? input.changeAmount : changeAmount,
      subtotal: input.subtotal,
      grandTotal,
      amountReceived,
      cashierName: input.cashierName,
      createdAt: nowIso,
      issueDate: nowIso,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      status: paymentStatus === 'PAID' ? 'COMPLETED' : 'PARTIAL',
      salesPerson: input.cashierName,
      saleType,
      appliedPriceList: saleType as PriceListType,
      customerId: customer?.id,
      paymentArrangement,
      dueDate,
      isOverdue: false,
      creditOverride: input.creditOverride,
      creditApprovedBy: input.creditApprovedBy,
      notes: input.notes?.trim() || undefined,
    };

    // Save Invoice
    const currentInvoices = this.getInvoicesInternal();
    currentInvoices.unshift(newInvoice);
    this.saveInvoicesInternal(currentInvoices);

    let ledgerEntry: import('@/types').CustomerLedgerEntry | undefined;

    // Post to Customer Ledger and adjust customer outstanding if customer is linked
    if (customer) {
      if (creditAmount > 0) {
        customersRepository.adjustOutstanding(customer.id, creditAmount);
      }

      ledgerEntry = customerLedgerRepository.addEntry({
        customerId: customer.id,
        customerName: customer.name,
        date: nowIso,
        type: 'INVOICE',
        referenceNumber: invoiceNumber,
        invoiceId: newInvoice.id,
        description: `${saleType} ${creditAmount > 0 ? (amountReceived > 0 ? 'Partial Credit' : 'Full Credit') : 'Sale'} #${invoiceNumber} (Total: Rs. ${grandTotal.toLocaleString()})`,
        debit: grandTotal,
        credit: amountReceived,
        branchId: branch.id,
        branchName: branch.name,
        createdByName: input.cashierName,
      });
    }

    return {
      invoice: newInvoice,
      receiptNumber: invoiceNumber,
      deductedMovements,
      ledgerEntry,
    };
  }

  public resetToSeed(): Invoice[] {
    const seed = [...INITIAL_MOCK_INVOICES];
    demoStorage.setItem(STORAGE_KEYS.INVOICES, seed);
    return seed;
  }
}

export const salesRepository = new SalesRepository();
