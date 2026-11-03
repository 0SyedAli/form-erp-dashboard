import mongoose from 'mongoose';
import { SalesInvoice, Branch, Customer, Payment, PaymentCollection } from '../../models/index.js';
import { SALE_TYPES, PAYMENT_STATUSES } from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { SalesQuery } from './sales.schema.js';

export interface UserContext {
  accountId: string;
  loginId: string;
  role: 'SUPER_ADMIN' | 'BRANCH';
  branchId?: string;
}

export class SalesService {
  /**
   * 1. GET INVOICES WITH BRANCH ISOLATION & FILTERS
   */
  public static async getInvoices(query: SalesQuery, userContext: UserContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    // Branch isolation: Branch accounts only see their own branch invoices
    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId && query.branchId !== 'ALL') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.customerId && query.customerId !== 'ALL') {
      filter.customerId = new mongoose.Types.ObjectId(query.customerId);
    }

    if (query.saleType && (query.saleType as string) !== 'ALL') {
      filter.saleType = query.saleType;
    }

    if (query.paymentStatus && (query.paymentStatus as string) !== 'ALL') {
      filter.paymentStatus = query.paymentStatus;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: q, $options: 'i' } },
        { customerName: { $regex: q, $options: 'i' } },
        { customerPhone: { $regex: q, $options: 'i' } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
      filter.createdAt = dateFilter;
    }

    const [total, invoices] = await Promise.all([
      SalesInvoice.countDocuments(filter),
      SalesInvoice.find(filter)
        .populate('branchId', 'name code shopNumber address city phone')
        .populate('customerId', 'name phone customerType outstandingBalance creditLimit')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 2. GET INVOICE BY ID (WITH BRANCH ISOLATION GUARD)
   */
  public static async getInvoiceById(id: string, userContext: UserContext) {
    const invoice = await SalesInvoice.findById(id)
      .populate('branchId', 'name code shopNumber address city phone email')
      .populate('customerId', 'name phone customerType businessName address outstandingBalance creditLimit')
      .lean();

    if (!invoice) {
      throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
    }

    if (
      userContext.role !== 'SUPER_ADMIN' &&
      invoice.branchId?._id?.toString() !== userContext.branchId &&
      invoice.branchId?.toString() !== userContext.branchId
    ) {
      throw new AppError('Unauthorized access to invoice of another branch.', 403, 'FORBIDDEN_BRANCH');
    }

    return invoice;
  }

  /**
   * 3. GET INVOICE RECEIPT VIEW (80mm Thermal / A4 Commercial format)
   */
  public static async getInvoiceReceipt(id: string, userContext: UserContext) {
    const invoice: any = await this.getInvoiceById(id, userContext);
    const branch = invoice.branchId;

    return {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt,
      branch: {
        name: branch?.name || 'Molty Foam Branch',
        code: branch?.code || 'SHOP',
        shopNumber: branch?.shopNumber || 'Shop #12-14',
        address: branch?.address || 'Main Commercial Area, Karachi',
        phone: branch?.phone || '021-34567890',
        city: branch?.city || 'Karachi',
      },
      customer: {
        name: invoice.customerName,
        phone: invoice.customerPhone || '—',
        type: invoice.customerType,
      },
      cashier: invoice.cashierName,
      saleType: invoice.saleType,
      paymentArrangement: invoice.paymentArrangement,
      paymentStatus: invoice.paymentStatus,
      items: invoice.items.map((it: any) => ({
        sku: it.sku,
        productName: it.productName,
        specification: `${it.sizeLabel} | ${it.thicknessLabel}`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
      financials: {
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        balanceDue: invoice.balanceDue,
        cashReceived: invoice.cashReceived || 0,
        changeReturned: invoice.changeReturned || 0,
        dueDate: invoice.dueDate,
      },
      creditDetails: invoice.balanceDue > 0 ? {
        creditOverride: invoice.creditOverride,
        creditApprovedBy: invoice.creditApprovedBy,
        dueDate: invoice.dueDate,
      } : null,
      notes: invoice.notes,
    };
  }

  /**
   * 4. GET SALES SUMMARY METRICS
   * Keeps Invoiced Revenue strictly separate from Collections (Section 22).
   */
  public static async getSalesSummary(userContext: UserContext) {
    const filter: Record<string, unknown> = {};
    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    }

    const invoices = await SalesInvoice.find(filter).lean();

    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let walkInSales = 0;
    let wholesaleSales = 0;
    let distributorSales = 0;
    let totalCashReceived = 0;
    let totalReceivablesOutstanding = 0;
    let overdueReceivables = 0;

    const now = new Date();

    for (const inv of invoices) {
      grossSales += inv.subtotal;
      totalDiscount += inv.discount || 0;
      netSales += inv.total;
      totalCashReceived += inv.paidAmount || 0;

      if (inv.balanceDue > 0) {
        totalReceivablesOutstanding += inv.balanceDue;
        if (inv.dueDate && new Date(inv.dueDate) < now) {
          overdueReceivables += inv.balanceDue;
        }
      }

      switch (inv.saleType) {
        case SALE_TYPES.WHOLESALE:
          wholesaleSales += inv.total;
          break;
        case SALE_TYPES.DISTRIBUTOR:
          distributorSales += inv.total;
          break;
        case SALE_TYPES.WALK_IN:
        default:
          walkInSales += inv.total;
          break;
      }
    }

    // Direct Collections from collection records (Separate from sales revenue)
    const colFilter: Record<string, unknown> = {};
    if (userContext.role !== 'SUPER_ADMIN') {
      colFilter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    }
    const collections = await PaymentCollection.find(colFilter).lean();
    let totalCollectionsRecovered = 0;
    for (const col of collections) {
      totalCollectionsRecovered += col.totalCollected;
    }

    return {
      grossInvoicedSales: grossSales,
      totalDiscounts: totalDiscount,
      netInvoicedSales: netSales,
      walkInSales,
      wholesaleSales,
      distributorSales,
      invoiceCount: invoices.length,
      cashReceivedAtPOS: totalCashReceived,
      collectionsRecovered: totalCollectionsRecovered,
      totalCashCollected: totalCashReceived + totalCollectionsRecovered,
      totalOutstandingReceivables: totalReceivablesOutstanding,
      overdueReceivables,
    };
  }
}

