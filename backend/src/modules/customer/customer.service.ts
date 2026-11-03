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
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const formattedCustomers = customers.map((c: any) => ({
      ...c,
      id: c._id.toString(),
      currentOutstanding: c.outstandingBalance || 0,
      availableCredit: Math.max(0, (c.creditLimit || 0) - (c.outstandingBalance || 0)),
    }));

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
  public static async getCustomerById(id: string, _userContext: UserContext) {
    const customer: any = await Customer.findById(id).lean();
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    return {
      ...customer,
      id: customer._id.toString(),
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

    const customer = await Customer.create({
      name: input.name.trim(),
      phone: input.phone.trim(),
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

    await customer.save();
    return customer;
  }

  /**
   * 5. GET CUSTOMER FINANCIAL LEDGER
   * Deterministic running balance journal statement
   */
  public static async getCustomerLedger(customerId: string, _userContext: UserContext) {
    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    const entries = await CustomerLedgerEntry.find({
      customerId: new mongoose.Types.ObjectId(customerId),
    })
      .populate('branchId', 'name code shopNumber')
      .sort({ timestamp: 1, _id: 1 })
      .lean();

    return {
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        businessName: customer.businessName,
        customerType: customer.customerType,
        creditLimit: customer.creditLimit,
        creditTerms: customer.creditTerms,
        outstandingBalance: customer.outstandingBalance,
      },
      entries,
    };
  }

  /**
   * 6. GET CUSTOMER OUTSTANDING INVOICES (FOR RECOVERY / COLLECTIONS)
   */
  public static async getCustomerOutstanding(customerId: string, _userContext: UserContext) {
    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');

    const invoices = await SalesInvoice.find({
      customerId: new mongoose.Types.ObjectId(customerId),
      balanceDue: { $gt: 0 },
    })
      .populate('branchId', 'name code shopNumber')
      .sort({ createdAt: 1 }) // Oldest invoice first for standard aging allocation
      .lean();

    return {
      customer: {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.phone,
        outstandingBalance: customer.outstandingBalance,
        creditLimit: customer.creditLimit,
      },
      invoices,
    };
  }

  /**
   * 7. GET ALL CUSTOMER PURCHASE INVOICES
   */
  public static async getCustomerInvoices(customerId: string, _userContext: UserContext) {
    return await SalesInvoice.find({
      customerId: new mongoose.Types.ObjectId(customerId),
    })
      .populate('branchId', 'name code shopNumber')
      .sort({ createdAt: -1 })
      .lean();
  }
}

