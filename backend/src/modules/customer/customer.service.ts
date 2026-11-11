import mongoose from 'mongoose';
import { Customer, CustomerLedgerEntry, SalesInvoice } from '../../models/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { CustomerQuery, CreateCustomerInput, UpdateCustomerInput } from './customer.schema.js';

export interface UserContext {
  accountId: string;
  loginId: string;
  role: 'SUPER_ADMIN' | 'BRANCH';
  branchId?: string;
  permissions?: Record<string, boolean>;
}

export class CustomerService {
  /**
   * 1. LIST CUSTOMERS WITH SEARCH & FILTERS
   */
  public static async getCustomers(query: CustomerQuery, _userContext: UserContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 50));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (query.customerType && (query.customerType as string) !== 'ALL') {
      filter.customerType = query.customerType;
    }

    if (query.status && (query.status as string) !== 'ALL') {
      filter.status = query.status;
    }

    // Branch Isolation: Branch users strictly see only their own branch customers
    if (_userContext.role !== 'SUPER_ADMIN' && _userContext.branchId) {
      filter.branchId = new mongoose.Types.ObjectId(_userContext.branchId);
    } else if (query.branchId && query.branchId !== 'ALL') {
      filter.branchId = new mongoose.Types.ObjectId(query.branchId);
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { businessName: { $regex: q, $options: 'i' } },
      ];
    }

    const [total, customers] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter)
        .populate('branchId', 'name code shopNumber')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Branch Isolation: Calculate branch-specific dues for branch users
    const branchDuesMap = new Map<string, number>();
    const isBranchUser = _userContext.role !== 'SUPER_ADMIN' && !!_userContext.branchId;

    if (isBranchUser && customers.length > 0) {
      const customerIds = customers.map((c) => c._id);
      const branchDues = await SalesInvoice.aggregate([
        {
          $match: {
            customerId: { $in: customerIds },
            branchId: new mongoose.Types.ObjectId(_userContext.branchId),
            balanceDue: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$customerId',
            totalDue: { $sum: '$balanceDue' },
          },
        },
      ]);
      branchDues.forEach((d) => {
        branchDuesMap.set(d._id.toString(), d.totalDue);
      });
    }

    const formattedCustomers = customers.map((c: any) => {
      const outstanding = isBranchUser
        ? (branchDuesMap.get(c._id.toString()) || 0)
        : (c.outstandingBalance || 0);

      const branchObj = typeof c.branchId === 'object' && c.branchId ? c.branchId : null;
      const bId = branchObj ? branchObj._id?.toString() || branchObj.id : (c.branchId ? c.branchId.toString() : '');
      const bName = branchObj ? branchObj.name : 'Unassigned';
      const bCode = branchObj ? branchObj.code || branchObj.shopNumber : '';

      return {
        ...c,
        id: c._id.toString(),
        branchId: bId,
        branchName: bName,
        branchCode: bCode,
        currentOutstanding: outstanding,
        availableCredit: Math.max(0, (c.creditLimit || 0) - outstanding),
      };
    });

    return {
      customers: formattedCustomers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 2. GET CUSTOMER BY ID
   */
  public static async getCustomerById(id: string, userContext: UserContext) {
    const customer: any = await Customer.findById(id).populate('branchId', 'name code shopNumber').lean();
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    if (userContext.role !== 'SUPER_ADMIN' && userContext.branchId) {
      const custBranchStr = customer.branchId?._id?.toString() || customer.branchId?.toString();
      if (custBranchStr && custBranchStr !== userContext.branchId) {
        throw new AppError('Access denied. Customer belongs to another branch.', 403, 'FORBIDDEN_BRANCH_ACCESS');
      }
    }

    const branchObj = typeof customer.branchId === 'object' && customer.branchId ? customer.branchId : null;
    const bId = branchObj ? branchObj._id?.toString() || branchObj.id : (customer.branchId ? customer.branchId.toString() : '');
    const bName = branchObj ? branchObj.name : 'Unassigned';
    const bCode = branchObj ? branchObj.code || branchObj.shopNumber : '';

    return {
      ...customer,
      id: customer._id.toString(),
      branchId: bId,
      branchName: bName,
      branchCode: bCode,
      currentOutstanding: customer.outstandingBalance || 0,
      availableCredit: Math.max(0, (customer.creditLimit || 0) - (customer.outstandingBalance || 0)),
    };
  }

  /**
   * 3. CREATE CUSTOMER
   */
  public static async createCustomer(input: CreateCustomerInput, userContext: UserContext) {
    // Check duplicate phone where practical
    const existing = await Customer.findOne({ phone: input.phone.trim() });
    if (existing) {
      throw new AppError(
        `Customer with phone number "${input.phone}" already exists (${existing.name}).`,
        409,
        'DUPLICATE_CUSTOMER_PHONE'
      );
    }

    // Permission guard: Modifying creditLimit > 0 requires customerCredit permission or Super Admin
    if (input.creditLimit > 0 && userContext.role !== 'SUPER_ADMIN') {
      if (!userContext.permissions?.customerCredit) {
        throw new AppError(
          'Insufficient permissions to grant initial credit limit to customer. Super Admin approval required.',
          403,
          'INSUFFICIENT_CREDIT_PERMISSIONS'
        );
      }
    }

    const effectiveBranchId =
      userContext.role !== 'SUPER_ADMIN'
        ? userContext.branchId
        : input.branchId || undefined;

    const customer = await Customer.create({
      name: input.name.trim(),
      phone: input.phone.trim(),
      branchId: effectiveBranchId ? new mongoose.Types.ObjectId(effectiveBranchId) : undefined,
      customerType: input.customerType,
      businessName: input.businessName?.trim(),
      email: input.email?.trim() || undefined,
      address: input.address?.trim(),
      city: input.city || 'Karachi',
      taxNumber: input.taxNumber?.trim(),
      creditEnabled: input.creditEnabled ?? false,
      creditLimit: input.creditLimit || 0,
      creditTerms: input.creditTerms || 'Net 30',
      defaultDueDays: input.defaultDueDays || 30,
      outstandingBalance: 0,
      status: 'ACTIVE',
      notes: input.notes,
    });

    return customer;
  }

  /**
   * 4. UPDATE CUSTOMER
   */
  public static async updateCustomer(id: string, input: UpdateCustomerInput, userContext: UserContext) {
    const customer = await Customer.findById(id);
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    // Phone uniqueness check
    if (input.phone && input.phone.trim() !== customer.phone) {
      const existing = await Customer.findOne({ phone: input.phone.trim(), _id: { $ne: customer._id } });
      if (existing) {
        throw new AppError(
          `Phone number "${input.phone}" is already associated with customer ${existing.name}.`,
          409,
          'DUPLICATE_CUSTOMER_PHONE'
        );
      }
      customer.phone = input.phone.trim();
    }

    // Permission check for modifying credit settings
    if (
      (input.creditLimit !== undefined && input.creditLimit !== customer.creditLimit) ||
      (input.creditEnabled !== undefined && input.creditEnabled !== customer.creditEnabled)
    ) {
      if (userContext.role !== 'SUPER_ADMIN' && !userContext.permissions?.customerCredit) {
        throw new AppError(
          'Changing customer credit limits requires supervisor credit authorization.',
          403,
          'INSUFFICIENT_CREDIT_PERMISSIONS'
        );
      }
    }

    if (input.name) customer.name = input.name.trim();
    if (input.customerType) customer.customerType = input.customerType;
    if (input.businessName !== undefined) customer.businessName = input.businessName;
    if (input.email !== undefined) customer.email = input.email || undefined;
    if (input.address !== undefined) customer.address = input.address;
    if (input.city !== undefined) customer.city = input.city;
    if (input.taxNumber !== undefined) customer.taxNumber = input.taxNumber;
    if (input.creditEnabled !== undefined) customer.creditEnabled = input.creditEnabled;
    if (input.creditLimit !== undefined) customer.creditLimit = input.creditLimit;
    if (input.creditTerms !== undefined) customer.creditTerms = input.creditTerms;
    if (input.defaultDueDays !== undefined) customer.defaultDueDays = input.defaultDueDays;
    if (input.status) customer.status = input.status;
    if (input.notes !== undefined) customer.notes = input.notes;
    if (input.branchId !== undefined && userContext.role === 'SUPER_ADMIN') {
      customer.branchId = input.branchId ? new mongoose.Types.ObjectId(input.branchId) : undefined;
    }

    await customer.save();
    return customer;
  }

  /**
   * 5. GET CUSTOMER FINANCIAL LEDGER
   * Deterministic running balance journal statement with strict branch-isolation
   */
  public static async getCustomerLedger(
    customerId: string,
    userContext: UserContext,
    branchFilter?: string
  ): Promise<any> {
    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    let effectiveBranchId: string | undefined = undefined;
    if (userContext.role !== 'SUPER_ADMIN') {
      const branchStr = userContext.branchId || branchFilter;
      if (!branchStr) {
        throw new AppError('Branch assignment required to view customer ledger.', 403, 'NO_BRANCH_ASSIGNED');
      }
      effectiveBranchId = branchStr;
    } else if (branchFilter && branchFilter !== 'ALL') {
      effectiveBranchId = branchFilter;
    }

    const query: Record<string, unknown> = {
      customerId: new mongoose.Types.ObjectId(customerId),
    };

    if (effectiveBranchId) {
      query.branchId = new mongoose.Types.ObjectId(effectiveBranchId);
    }

    // Retrieve entries in ascending order to compute running balance accurately for this branch scope
    const rawEntries = await CustomerLedgerEntry.find(query)
      .populate('branchId', 'name code shopNumber')
      .sort({ timestamp: 1, _id: 1 })
      .lean();

    let running = 0;
    const computedEntries = rawEntries.map((e: any) => {
      const debit = Number(e.debit || 0);
      const credit = Number(e.credit || 0);
      running = running + debit - credit;
      return {
        ...e,
        id: e._id.toString(),
        date: e.timestamp || e.createdAt,
        type: e.entryType,
        referenceNumber: e.referenceInvoiceId || e.referencePaymentId || '-',
        description: e.narration || 'Transaction',
        branchName: e.branchId?.name || e.branchId?.code || 'Main Branch',
        branchCode: e.branchId?.code || '',
        branchId: e.branchId?._id?.toString() || e.branchId?.toString(),
        performedBy: e.performedBy || 'System',
        debit,
        credit,
        runningBalance: running,
      };
    });

    const totalDebit = computedEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = computedEntries.reduce((sum, e) => sum + e.credit, 0);
    const branchBalance = totalDebit - totalCredit;

    // Display newest entries first for UI table
    const reversedEntries = [...computedEntries].reverse();

    return {
      customer: {
        ...customer,
        id: customer._id.toString(),
        code: (customer as any).customerCode || `CUST-${customer.phone?.slice(-4)}`,
        currentOutstanding: effectiveBranchId ? branchBalance : (customer.outstandingBalance || 0),
        availableCredit: Math.max(
          0,
          (customer.creditLimit || 0) - (effectiveBranchId ? branchBalance : (customer.outstandingBalance || 0))
        ),
        scopeBranchId: effectiveBranchId || null,
      },
      summary: {
        totalDebit,
        totalCredit,
        currentBalance: effectiveBranchId ? branchBalance : (customer.outstandingBalance || 0),
        transactionCount: computedEntries.length,
      },
      entries: reversedEntries,
    };
  }

  /**
   * 6. GET CUSTOMER OUTSTANDING INVOICES (FOR RECOVERY / COLLECTIONS)
   * Strictly filtered by branch so a branch only recovers its own receivables
   */
  public static async getCustomerOutstanding(
    customerId: string,
    userContext: UserContext,
    branchFilter?: string
  ) {
    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    let effectiveBranchId: string | undefined = undefined;
    if (userContext.role !== 'SUPER_ADMIN') {
      const branchStr = userContext.branchId || branchFilter;
      if (branchStr) {
        effectiveBranchId = branchStr;
      }
    } else if (branchFilter && branchFilter !== 'ALL') {
      effectiveBranchId = branchFilter;
    }

    const invoiceFilter: Record<string, unknown> = {
      customerId: new mongoose.Types.ObjectId(customerId),
      balanceDue: { $gt: 0 },
    };

    if (effectiveBranchId) {
      invoiceFilter.branchId = new mongoose.Types.ObjectId(effectiveBranchId);
    }

    const invoices = await SalesInvoice.find(invoiceFilter)
      .populate('branchId', 'name code shopNumber')
      .sort({ createdAt: 1 }) // Oldest invoice first for standard aging allocation
      .lean();

    const branchOutstanding = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

    return {
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        outstandingBalance: effectiveBranchId ? branchOutstanding : (customer.outstandingBalance || 0),
        creditLimit: customer.creditLimit,
      },
      invoices: invoices.map((inv: any) => ({
        id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate || inv.createdAt,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceDue: inv.balanceDue,
        branchId: inv.branchId?._id?.toString() || inv.branchId?.toString(),
        branchName: inv.branchId?.name || inv.branchId?.code || 'Branch',
      })),
      totalOutstanding: effectiveBranchId ? branchOutstanding : (customer.outstandingBalance || 0),
    };
  }

  /**
   * 7. GET ALL CUSTOMER PURCHASE INVOICES
   */
  public static async getCustomerInvoices(
    customerId: string,
    userContext: UserContext,
    branchFilter?: string
  ) {
    const filter: Record<string, unknown> = {
      customerId: new mongoose.Types.ObjectId(customerId),
    };

    if (userContext.role !== 'SUPER_ADMIN') {
      if (userContext.branchId) {
        filter.branchId = new mongoose.Types.ObjectId(userContext.branchId);
      }
    } else if (branchFilter && branchFilter !== 'ALL') {
      filter.branchId = new mongoose.Types.ObjectId(branchFilter);
    }

    return await SalesInvoice.find(filter)
      .populate('branchId', 'name code shopNumber')
      .sort({ createdAt: -1 })
      .lean();
  }
}

