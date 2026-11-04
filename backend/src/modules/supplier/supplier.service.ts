import mongoose from 'mongoose';
import {
  Supplier,
  SupplierLedgerEntry,
  SupplierBill,
  SupplierPayment,
  Branch,
  Counter,
} from '../../models/index.js';
import { AppError } from '../../utils/apiResponse.js';
import { runTransaction } from '../../utils/transaction.js';
import { CreateSupplierInput, UpdateSupplierInput, SupplierQuery } from './supplier.schema.js';

export class SupplierService {
  /**
   * Generates a sequential supplier code atomically: SUP-1001, SUP-1002, etc.
   */
  public static async generateSupplierCode(session?: mongoose.ClientSession | null): Promise<string> {
    const counter = await Counter.findOneAndUpdate(
      { key: 'SUPPLIER_CODE' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session: session || undefined }
    );
    const seq = 1000 + counter.seq;
    return `SUP-${seq}`;
  }

  /**
   * 1. CREATE SUPPLIER
   */
  public static async createSupplier(input: CreateSupplierInput, userContext: { id: string; loginId: string; branchId?: string }) {
    const existing = await Supplier.findOne({
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
    });
    if (existing) {
      throw new AppError(`A supplier with the name '${input.name}' already exists.`, 409, 'SUPPLIER_ALREADY_EXISTS');
    }

    return await runTransaction(async (session) => {
      const code = await SupplierService.generateSupplierCode(session);

      const openingPayable = Math.max(0, input.openingPayable || 0);

      const [supplier] = await Supplier.create(
        [
          {
            code,
            name: input.name.trim(),
            contactPerson: input.contactPerson?.trim(),
            phone: input.phone.trim(),
            whatsapp: input.whatsapp?.trim(),
            email: input.email?.trim() || undefined,
            address: input.address?.trim() || '',
            city: input.city?.trim() || 'Karachi',
            ntn: input.ntn?.trim() || undefined,
            suppliedBrands: input.suppliedBrands || [],
            creditEnabled: input.creditEnabled ?? true,
            defaultCreditDays: input.defaultCreditDays ?? 30,
            paymentTerms: input.paymentTerms || 'Net 30 Days',
            creditLimit: input.creditLimit ?? 1000000,
            openingPayable,
            currentOutstanding: openingPayable,
            balancePayable: openingPayable,
            bankName: input.bankName?.trim(),
            bankAccountNumber: input.bankAccountNumber?.trim(),
            notes: input.notes?.trim(),
            status: 'ACTIVE',
          },
        ],
        { session }
      );

      // Record opening balance in supplier ledger if > 0
      if (openingPayable > 0) {
        let branchId = userContext.branchId;
        if (!branchId) {
          const mainBranch = await Branch.findOne({ code: 'SHOP-12-14' }).session(session);
          branchId = mainBranch ? mainBranch._id.toString() : supplier._id.toString();
        }

        await SupplierLedgerEntry.create(
          [
            {
              supplierId: supplier._id,
              branchId: new mongoose.Types.ObjectId(branchId),
              entryDate: new Date(),
              entryType: 'OPENING_BALANCE',
              referenceNumber: `${code}-OPENING`,
              debit: 0,
              credit: openingPayable,
              runningBalance: openingPayable,
              narration: 'Initial opening payable balance recorded on supplier onboarding',
              performedBy: userContext.loginId || 'System',
              timestamp: new Date(),
            },
          ],
          { session }
        );
      }

      return {
        ...supplier.toObject(),
        id: supplier._id.toString(),
      };
    });
  }

  /**
   * 2. GET SUPPLIERS LIST
   */
  public static async getSuppliers(query: SupplierQuery): Promise<any> {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.city) {
      filter.city = { $regex: new RegExp(query.city, 'i') };
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { contactPerson: { $regex: q, $options: 'i' } },
        { ntn: { $regex: q, $options: 'i' } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const [total, suppliers] = await Promise.all([
      Supplier.countDocuments(filter),
      Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    ]);

    const formatted = suppliers.map((s) => ({
      ...s,
      id: s._id.toString(),
      currentOutstanding: s.currentOutstanding ?? s.balancePayable ?? 0,
    }));

    return {
      suppliers: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 3. GET SUPPLIER BY ID
   */
  public static async getSupplierById(idOrCode: string): Promise<any> {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrCode);
    const supplier = isObjectId
      ? await Supplier.findById(idOrCode).lean()
      : await Supplier.findOne({ code: idOrCode.toUpperCase() }).lean();

    if (!supplier) {
      throw new AppError(`Supplier '${idOrCode}' not found.`, 404, 'SUPPLIER_NOT_FOUND');
    }

    return {
      ...supplier,
      id: supplier._id.toString(),
      currentOutstanding: supplier.currentOutstanding ?? supplier.balancePayable ?? 0,
    };
  }

  /**
   * 4. UPDATE SUPPLIER
   */
  public static async updateSupplier(id: string, input: UpdateSupplierInput) {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError(`Supplier '${id}' not found.`, 404, 'SUPPLIER_NOT_FOUND');
    }

    if (input.name && input.name.trim() !== supplier.name) {
      const existing = await Supplier.findOne({
        name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
        _id: { $ne: supplier._id },
      });
      if (existing) {
        throw new AppError(`Supplier name '${input.name}' is already taken.`, 409, 'SUPPLIER_NAME_TAKEN');
      }
      supplier.name = input.name.trim();
    }

    if (input.contactPerson !== undefined) supplier.contactPerson = input.contactPerson.trim();
    if (input.phone !== undefined) supplier.phone = input.phone.trim();
    if (input.whatsapp !== undefined) supplier.whatsapp = input.whatsapp.trim();
    if (input.email !== undefined) supplier.email = input.email.trim() || undefined;
    if (input.address !== undefined) supplier.address = input.address.trim();
    if (input.city !== undefined) supplier.city = input.city.trim();
    if (input.ntn !== undefined) supplier.ntn = input.ntn.trim();
    if (input.suppliedBrands !== undefined) supplier.suppliedBrands = input.suppliedBrands;
    if (input.creditEnabled !== undefined) supplier.creditEnabled = input.creditEnabled;
    if (input.defaultCreditDays !== undefined) supplier.defaultCreditDays = input.defaultCreditDays;
    if (input.paymentTerms !== undefined) supplier.paymentTerms = input.paymentTerms;
    if (input.creditLimit !== undefined) supplier.creditLimit = input.creditLimit;
    if (input.bankName !== undefined) supplier.bankName = input.bankName.trim();
    if (input.bankAccountNumber !== undefined) supplier.bankAccountNumber = input.bankAccountNumber.trim();
    if (input.status !== undefined) supplier.status = input.status;
    if (input.notes !== undefined) supplier.notes = input.notes.trim();

    await supplier.save();

    return {
      ...supplier.toObject(),
      id: supplier._id.toString(),
    };
  }

  /**
   * 5. UPDATE STATUS (ACTIVATE / DEACTIVATE)
   */
  public static async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      throw new AppError(`Supplier '${id}' not found.`, 404, 'SUPPLIER_NOT_FOUND');
    }

    supplier.status = status;
    await supplier.save();

    return {
      ...supplier.toObject(),
      id: supplier._id.toString(),
    };
  }

  /**
   * 6. GET SUPPLIER LEDGER
   */
  public static async getSupplierLedger(
    supplierId: string,
    query: { dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}
  ): Promise<any> {
    const supplier = await Supplier.findById(supplierId).lean();
    if (!supplier) {
      throw new AppError(`Supplier '${supplierId}' not found.`, 404, 'SUPPLIER_NOT_FOUND');
    }

    const filter: Record<string, any> = {
      supplierId: new mongoose.Types.ObjectId(supplierId),
    };

    if (query.dateFrom || query.dateTo) {
      filter.entryDate = {};
      if (query.dateFrom) filter.entryDate.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.entryDate.$lte = new Date(query.dateTo);
    }

    const entries = await SupplierLedgerEntry.find(filter)
      .sort({ entryDate: 1, timestamp: 1 })
      .populate('branchId', 'name code')
      .lean();

    let totalDebit = 0;
    let totalCredit = 0;

    for (const e of entries) {
      totalDebit += e.debit || 0;
      totalCredit += e.credit || 0;
    }

    const formattedEntries = entries.map((e) => ({
      ...e,
      id: e._id.toString(),
      type: e.entryType,
      date: e.entryDate.toISOString(),
      balance: e.runningBalance,
    }));

    return {
      supplier: {
        ...supplier,
        id: supplier._id.toString(),
        currentOutstanding: supplier.currentOutstanding ?? supplier.balancePayable ?? 0,
      },
      entries: formattedEntries,
      summary: {
        openingPayable: supplier.openingPayable || 0,
        totalDebit,
        totalCredit,
        currentBalance: supplier.currentOutstanding ?? supplier.balancePayable ?? 0,
      },
    };
  }

  /**
   * 7. GET SUPPLIER OUTSTANDING BILLS
   */
  public static async getSupplierOutstandingBills(supplierId: string): Promise<any> {
    const bills = await SupplierBill.find({
      supplierId: new mongoose.Types.ObjectId(supplierId),
      balanceDue: { $gt: 0 },
      status: { $ne: 'CANCELLED' },
    })
      .sort({ dueDate: 1 })
      .lean();

    return bills.map((b) => ({
      ...b,
      id: b._id.toString(),
      amountDue: b.balanceDue,
    }));
  }

  /**
   * 8. GET ALL BILLS FOR SUPPLIER
   */
  public static async getSupplierBills(supplierId: string): Promise<any> {
    const bills = await SupplierBill.find({
      supplierId: new mongoose.Types.ObjectId(supplierId),
    })
      .sort({ billDate: -1 })
      .lean();

    return bills.map((b) => ({
      ...b,
      id: b._id.toString(),
    }));
  }

  /**
   * 9. GET ALL PAYMENTS FOR SUPPLIER
   */
  public static async getSupplierPayments(supplierId: string): Promise<any> {
    const payments = await SupplierPayment.find({
      supplierId: new mongoose.Types.ObjectId(supplierId),
    })
      .sort({ paymentDate: -1 })
      .lean();

    return payments.map((p) => ({
      ...p,
      id: p._id.toString(),
    }));
  }
}
