import mongoose from 'mongoose';
import {
  PaymentCollection,
  Customer,
  SalesInvoice,
  CustomerLedgerEntry,
  Payment,
  IdempotencyKey,
} from '../../models/index.js';
import { PAYMENT_STATUSES } from '../../constants/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { runTransaction } from '../../utils/transaction.js';
import { generateDailySequence } from '../../utils/sequence.js';
import { CreateCollectionInput, CollectionQuery } from './collection.schema.js';

export interface UserContext {
  accountId: string;
  loginId: string;
  role: 'SUPER_ADMIN' | 'BRANCH';
  branchId?: string;
}

export class CollectionService {
  /**
   * 1. CREATE PAYMENT COLLECTION & ALLOCATE TO INVOICES
   * Runs in an atomic multi-document transaction:
   * - Validates customer & outstanding balances
   * - Allocates collection (manually or oldest-first)
   * - Updates invoice payment statuses
   * - Reduces customer outstanding balance
   * - Posts credit to customer ledger
   * - Generates durable collection receipt
   */
  public static async createCollection(input: CreateCollectionInput, userContext: UserContext) {
    return await runTransaction(async (session) => {
      // 1. Idempotency Check
      if (input.idempotencyKey) {
        const existingCol = await PaymentCollection.findOne({
          idempotencyKey: input.idempotencyKey,
        }).session(session);

        if (existingCol) {
          return {
            collection: existingCol,
            message: 'Idempotent replay: original collection record returned.',
            isReplay: true,
          };
        }
      }

      // 2. Resolve Branch
      let effectiveBranchId: mongoose.Types.ObjectId;
      if (userContext.role === 'SUPER_ADMIN' && input.branchId) {
        effectiveBranchId = new mongoose.Types.ObjectId(input.branchId);
      } else if (userContext.branchId) {
        effectiveBranchId = new mongoose.Types.ObjectId(userContext.branchId);
      } else {
        throw new AppError('Branch assignment required for recording payment collections.', 403, 'NO_BRANCH_ASSIGNED');
      }

      // 3. Find Customer
      const customer = await Customer.findById(input.customerId).session(session);
      if (!customer) {
        throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
      }

      // 4. Find open invoices with balanceDue > 0
      const openInvoices = await SalesInvoice.find({
        customerId: customer._id,
        balanceDue: { $gt: 0 },
      })
        .sort({ createdAt: 1 }) // FIFO / Oldest first
        .session(session);

      const totalOutstanding = openInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

      // 5. Determine Allocations
      let remainingToAllocate = input.amount;
      const finalAllocations: Array<{
        invoiceId: mongoose.Types.ObjectId;
        invoiceNumber: string;
        allocatedAmount: number;
      }> = [];

      if (input.allocations && input.allocations.length > 0) {
        // Manual allocation
        let manualSum = 0;
        for (const alloc of input.allocations) {
          const inv = openInvoices.find((i) => i._id.toString() === alloc.invoiceId);
          if (!inv) {
            throw new AppError(
              `Invoice ${alloc.invoiceId} is not an outstanding invoice for customer ${customer.name}.`,
              400,
              'INVALID_INVOICE_FOR_CUSTOMER'
            );
          }

          if (alloc.allocatedAmount > inv.balanceDue) {
            throw new AppError(
              `Allocation of Rs. ${alloc.allocatedAmount} exceeds invoice #${inv.invoiceNumber} balance due of Rs. ${inv.balanceDue}.`,
              400,
              'OVER_ALLOCATION_ON_INVOICE'
            );
          }

          manualSum += alloc.allocatedAmount;
          finalAllocations.push({
            invoiceId: inv._id as mongoose.Types.ObjectId,
            invoiceNumber: inv.invoiceNumber,
            allocatedAmount: alloc.allocatedAmount,
          });
        }

        if (manualSum > input.amount) {
          throw new AppError(
            `Total manual invoice allocations (Rs. ${manualSum}) exceed collection amount (Rs. ${input.amount}).`,
            400,
            'TOTAL_ALLOCATION_EXCEEDS_COLLECTION'
          );
        }

        remainingToAllocate = input.amount - manualSum;
      } else {
        // Automatic oldest-invoice-first FIFO allocation
        for (const inv of openInvoices) {
          if (remainingToAllocate <= 0) break;
          const allocAmount = Math.min(remainingToAllocate, inv.balanceDue);
          finalAllocations.push({
            invoiceId: inv._id as mongoose.Types.ObjectId,
            invoiceNumber: inv.invoiceNumber,
            allocatedAmount: allocAmount,
          });
          remainingToAllocate -= allocAmount;
        }
      }

      // 6. Update Each Allocated Invoice
      let totalAppliedToInvoices = 0;
      for (const alloc of finalAllocations) {
        totalAppliedToInvoices += alloc.allocatedAmount;

        const inv = openInvoices.find((i) => i._id.toString() === alloc.invoiceId.toString());
        if (inv) {
          inv.paidAmount += alloc.allocatedAmount;
          inv.balanceDue = Math.max(0, inv.balanceDue - alloc.allocatedAmount);
          inv.paymentStatus = inv.balanceDue === 0 ? PAYMENT_STATUSES.PAID : PAYMENT_STATUSES.PARTIAL;
          await inv.save({ session });
        }
      }

      // 7. Update Customer Outstanding Balance
      const previousOutstanding = customer.outstandingBalance || 0;
      const newOutstanding = Math.max(0, previousOutstanding - totalAppliedToInvoices);
      customer.outstandingBalance = newOutstanding;
      await customer.save({ session });

      // 8. Generate Sequential Collection Reference & Receipt
      const collectionNumber = await generateDailySequence('COL', session);
      const receiptNumber = await generateDailySequence('RCP', session);

      // 9. Post Customer Ledger Entry (reduces receivable)
      await CustomerLedgerEntry.create(
        [
          {
            customerId: customer._id,
            branchId: effectiveBranchId,
            entryType: 'PAYMENT',
            referencePaymentId: collectionNumber,
            debit: 0,
            credit: input.amount,
            runningBalance: newOutstanding,
            narration: `Payment Collection #${collectionNumber} (${input.paymentMethod}) - Received: Rs. ${input.amount.toLocaleString()}, Allocated to ${finalAllocations.length} invoices`,
            performedBy: userContext.loginId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      // 10. Record Payment Collection Document
      const [collection] = await PaymentCollection.create(
        [
          {
            collectionNumber,
            branchId: effectiveBranchId,
            customerId: customer._id,
            customerName: customer.name,
            totalCollected: input.amount,
            paymentMethod: input.paymentMethod,
            reference: input.reference,
            allocations: finalAllocations,
            unallocatedAmount: remainingToAllocate,
            notes: input.notes,
            collectedBy: userContext.loginId,
            receiptNumber,
            collectionDate: new Date(),
            idempotencyKey: input.idempotencyKey,
          },
        ],
        { session }
      );

      // 11. Create Standard Payment Record for Cash/Bank Book
      const paymentDocNumber = await generateDailySequence('PAY', session);
      await Payment.create(
        [
          {
            paymentNumber: paymentDocNumber,
            customerId: customer._id,
            branchId: effectiveBranchId,
            amount: input.amount,
            paymentMethod: input.paymentMethod,
            reference: collectionNumber,
            notes: `Customer debt recovery collection ${collectionNumber}`,
            collectedBy: userContext.loginId,
            paymentDate: new Date(),
          },
        ],
        { session }
      );

      // 12. Persist Idempotency Store
      if (input.idempotencyKey) {
        await IdempotencyKey.create(
          [
            {
              key: input.idempotencyKey,
              endpoint: '/collections',
              responseStatus: 201,
              responseBody: { collectionNumber },
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          ],
          { session }
        );
      }

      return {
        collection,
        appliedAmount: totalAppliedToInvoices,
        unallocatedAmount: remainingToAllocate,
        newCustomerOutstanding: newOutstanding,
        message: 'Payment collection recorded and allocated successfully.',
        isReplay: false,
      };
    });
  }

  /**
   * 2. LIST COLLECTIONS WITH FILTERS
   */
  public static async getCollections(query: CollectionQuery, userContext: UserContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (userContext.role !== 'SUPER_ADMIN') {
      filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    } else if (query.branchId && query.branchId !== 'ALL') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.customerId && query.customerId !== 'ALL') {
      filter.customerId = new mongoose.Types.ObjectId(query.customerId);
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (query.dateFrom) dateFilter.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
      filter.collectionDate = dateFilter;
    }

    const [total, collections] = await Promise.all([
      PaymentCollection.countDocuments(filter),
      PaymentCollection.find(filter)
        .populate('customerId', 'name phone customerType outstandingBalance')
        .populate('branchId', 'name code shopNumber')
        .sort({ collectionDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return {
      collections,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. GET COLLECTION BY ID
   */
  public static async getCollectionById(id: string, userContext: UserContext) {
    const col: any = await PaymentCollection.findById(id)
      .populate('customerId', 'name phone customerType address outstandingBalance creditLimit')
      .populate('branchId', 'name code shopNumber address city phone')
      .lean();

    if (!col) throw new AppError('Payment collection record not found.', 404, 'COLLECTION_NOT_FOUND');

    if (userContext.role !== 'SUPER_ADMIN' && col.branchId?._id?.toString() !== userContext.branchId) {
      throw new AppError('Unauthorized access to collection of another branch.', 403, 'FORBIDDEN_BRANCH');
    }

    return col;
  }

  /**
   * 4. GET COLLECTION RECEIPT VIEW
   */
  public static async getCollectionReceipt(id: string, userContext: UserContext) {
    const col: any = await this.getCollectionById(id, userContext);
    const branch = col.branchId;
    const customer = col.customerId;

    return {
      receiptNumber: col.receiptNumber || col.collectionNumber,
      collectionNumber: col.collectionNumber,
      date: col.collectionDate,
      branch: {
        name: branch?.name || 'Molty Foam Branch',
        shopNumber: branch?.shopNumber || 'Shop #12-14',
        address: branch?.address || 'Karachi',
        phone: branch?.phone || '021-34567890',
      },
      customer: {
        name: col.customerName,
        phone: customer?.phone || '—',
        outstandingRemaining: customer?.outstandingBalance || 0,
      },
      amountCollected: col.totalCollected,
      paymentMethod: col.paymentMethod,
      reference: col.reference || '—',
      allocations: col.allocations,
      unallocatedAdvance: col.unallocatedAmount || 0,
      collectedBy: col.collectedBy,
      notes: col.notes,
    };
  }

  /**
   * 5. GET OUTSTANDING RECEIVABLES ACROSS CUSTOMERS
   */
  public static async getOutstandingCustomers(userContext: UserContext) {
    const filter: Record<string, unknown> = {
      outstandingBalance: { $gt: 0 },
    };

    const customers = await Customer.find(filter)
      .sort({ outstandingBalance: -1 })
      .lean();

    const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);

    return {
      totalOutstanding,
      customerCount: customers.length,
      customers: customers.map((c: any) => ({
        id: c._id.toString(),
        name: c.name,
        phone: c.phone,
        customerType: c.customerType,
        creditLimit: c.creditLimit,
        outstandingBalance: c.outstandingBalance,
        availableCredit: Math.max(0, (c.creditLimit || 0) - (c.outstandingBalance || 0)),
      })),
    };
  }

  /**
   * 6. GET OVERDUE CUSTOMERS & INVOICES
   */
  public static async getOverdueCustomers(userContext: UserContext) {
    const now = new Date();
    const invFilter: Record<string, unknown> = {
      balanceDue: { $gt: 0 },
      dueDate: { $lt: now },
    };

    if (userContext.role !== 'SUPER_ADMIN') {
      invFilter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
    }

    const overdueInvoices = await SalesInvoice.find(invFilter)
      .populate('customerId', 'name phone customerType')
      .populate('branchId', 'name code')
      .sort({ dueDate: 1 })
      .lean();

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

    return {
      totalOverdue,
      overdueCount: overdueInvoices.length,
      invoices: overdueInvoices,
    };
  }
}

