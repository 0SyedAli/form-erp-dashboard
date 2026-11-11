import mongoose from 'mongoose';
import {
  SalesInvoice,
  Branch,
  Customer,
  Payment,
  PaymentCollection,
  StockBalance,
  StockLocation,
  StockMovement,
  CustomerLedgerEntry,
  AuditLog,
} from '../../models/index.js';
import {
  SALE_TYPES,
  PAYMENT_STATUSES,
  INVOICE_STATUSES,
  STOCK_MOVEMENT_TYPES,
} from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { runTransaction } from '../../utils/transaction.js';
import { generateDailySequence } from '../../utils/sequence.js';
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

    const isDispatchesTab = query.scope === 'dispatches';

    if (isDispatchesTab) {
      // Dispatches view: Invoices where stock was fulfilled from this branch for another terminal
      filter.isInterBranch = true;
      if (userContext.role !== 'SUPER_ADMIN') {
        filter.sourceBranchId = new mongoose.Types.ObjectId(userContext.branchId);
      } else if (query.branchId && query.branchId !== 'ALL') {
        filter.sourceBranchId = new mongoose.Types.ObjectId(query.branchId);
      }
    } else {
      // Standard sales view: Invoices issued at this terminal
      if (userContext.role !== 'SUPER_ADMIN') {
        filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
      } else if (query.branchId && query.branchId !== 'ALL') {
        filter.branchId = new mongoose.Types.ObjectId(query.branchId);
      }
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
        .populate('sourceBranchId', 'name code shopNumber address city phone')
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
      .populate('sourceBranchId', 'name code shopNumber address city phone email')
      .populate('customerId', 'name phone customerType businessName address outstandingBalance creditLimit')
      .lean();

    if (!invoice) {
      throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
    }

    const sellingBranchId = (invoice.branchId as any)?._id?.toString() || invoice.branchId?.toString();
    const sourceBranchId = (invoice.sourceBranchId as any)?._id?.toString() || invoice.sourceBranchId?.toString();

    if (
      userContext.role !== 'SUPER_ADMIN' &&
      sellingBranchId !== userContext.branchId &&
      sourceBranchId !== userContext.branchId
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
      isInterBranch: invoice.isInterBranch || false,
      sourceBranch: invoice.sourceBranchId
        ? {
            name: invoice.sourceBranchId.name,
            code: invoice.sourceBranchId.code,
            shopNumber: invoice.sourceBranchId.shopNumber,
          }
        : undefined,
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
   * 4. DELETE / VOID INVOICE (With Option to Return Stock or Delete Only)
   */
  public static async deleteInvoice(
    id: string,
    options: { returnStock: boolean },
    userContext: UserContext
  ) {
    return await runTransaction(async (session) => {
      const invoice = await SalesInvoice.findById(id).session(session);
      if (!invoice) {
        throw new AppError('Invoice not found.', 404, 'INVOICE_NOT_FOUND');
      }

      if (invoice.status === INVOICE_STATUSES.VOID) {
        throw new AppError('This invoice has already been voided/deleted.', 400, 'INVOICE_ALREADY_VOID');
      }

      const sellingBranchId = invoice.branchId?.toString();
      if (userContext.role !== 'SUPER_ADMIN' && sellingBranchId !== userContext.branchId) {
        throw new AppError('Unauthorized: You cannot delete invoices of another branch.', 403, 'FORBIDDEN_BRANCH');
      }

      // 1. Stock Return (If requested)
      if (options.returnStock && invoice.items && invoice.items.length > 0) {
        const sourceBranchId = invoice.sourceBranchId || invoice.branchId;

        // Find default or sales floor stock location for the source branch
        let targetLocation = await StockLocation.findOne({
          branchId: sourceBranchId,
          type: 'SALES_FLOOR',
          isActive: true,
        }).session(session);

        if (!targetLocation) {
          targetLocation = await StockLocation.findOne({
            branchId: sourceBranchId,
            isActive: true,
          }).session(session);
        }

        if (targetLocation) {
          for (const item of invoice.items) {
            const skuKey = item.sku.toUpperCase();
            const prevBal = await StockBalance.findOne({
              branchId: sourceBranchId,
              stockLocationId: targetLocation._id,
              sku: skuKey,
            }).session(session);

            const prevOnHand = prevBal ? prevBal.onHand : 0;

            await StockBalance.findOneAndUpdate(
              {
                branchId: sourceBranchId,
                stockLocationId: targetLocation._id,
                sku: skuKey,
              },
              {
                $inc: { onHand: item.quantity },
              },
              { session, upsert: true, new: true }
            );

            const movementNumber = await generateDailySequence('MOV-RET', session);
            await StockMovement.create(
              [
                {
                  movementNumber,
                  branchId: sourceBranchId,
                  stockLocationId: targetLocation._id,
                  sku: skuKey,
                  movementType: STOCK_MOVEMENT_TYPES.RETURN_RESTOCK,
                  quantityDifference: item.quantity,
                  previousBalance: prevOnHand,
                  newBalance: prevOnHand + item.quantity,
                  referenceType: 'SALES_INVOICE',
                  referenceId: invoice.invoiceNumber,
                  reason: `Stock returned from deleted/voided invoice #${invoice.invoiceNumber}`,
                  performedBy: userContext.loginId,
                  timestamp: new Date(),
                },
              ],
              { session }
            );
          }
        }
      }

      // 2. Reverse Customer Dues if invoice had balanceDue > 0
      if (invoice.balanceDue > 0 && invoice.customerId) {
        const customer = await Customer.findById(invoice.customerId).session(session);
        if (customer) {
          const duesToReverse = invoice.balanceDue;
          customer.outstandingBalance = Math.max(0, (customer.outstandingBalance || 0) - duesToReverse);
          await customer.save({ session: session || undefined });

          // Decrement branch specific customer balance
          await Customer.updateOne(
            { _id: customer._id, 'branchBalances.branchId': invoice.branchId },
            { $inc: { 'branchBalances.$.outstanding': -duesToReverse } },
            { session: session || undefined }
          );

          await CustomerLedgerEntry.create(
            [
              {
                customerId: customer._id,
                branchId: invoice.branchId,
                entryType: 'REFUND',
                referenceInvoiceId: invoice.invoiceNumber,
                debit: 0,
                credit: duesToReverse,
                runningBalance: customer.outstandingBalance,
                narration: `Reversal of dues for deleted invoice #${invoice.invoiceNumber}${
                  options.returnStock ? ' (Stock Returned)' : ' (Invoice Cancelled)'
                }`,
                performedBy: userContext.loginId,
                timestamp: new Date(),
              },
            ],
            { session }
          );
        }
      }

      // 3. Audit Log
      await AuditLog.create(
        [
          {
            accountId: userContext.accountId ? new mongoose.Types.ObjectId(userContext.accountId) : undefined,
            action: options.returnStock ? 'INVOICE_VOID_RETURN_STOCK' : 'INVOICE_VOID_ONLY',
            entity: 'SalesInvoice',
            entityId: invoice.invoiceNumber,
            details: {
              invoiceId: invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
              returnStock: options.returnStock,
              itemsCount: invoice.items?.length || 0,
              totalAmount: invoice.total,
              balanceDue: invoice.balanceDue,
              reason: options.returnStock
                ? 'Returned stock and deleted invoice'
                : 'Deleted invoice without stock return',
            },
          },
        ],
        { session }
      );

      // 4. Update Invoice Status to VOID
      invoice.status = INVOICE_STATUSES.VOID;
      invoice.balanceDue = 0;
      invoice.notes = `${invoice.notes || ''} [DELETED/VOIDED by ${userContext.loginId} on ${new Date().toISOString()} - ${
        options.returnStock ? 'Stock Restored to Inventory' : 'Stock Not Returned'
      }]`.trim();
      await invoice.save({ session: session || undefined });

      return {
        success: true,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        stockReturned: options.returnStock,
        message: options.returnStock
          ? `Invoice #${invoice.invoiceNumber} deleted and items returned to stock successfully.`
          : `Invoice #${invoice.invoiceNumber} deleted successfully (stock not affected).`,
      };
    });
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

