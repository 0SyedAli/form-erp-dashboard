import mongoose from 'mongoose';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Customer, CustomerLedgerEntry, Payment, PaymentCollection, SalesInvoice,
} from '../../models/index.js';
import { CollectionService } from './collection.service.js';

vi.mock('../../utils/transaction.js', () => ({
  runTransaction: (work: (session: object) => unknown) => work({}),
}));
vi.mock('../../utils/sequence.js', () => ({
  generateDailySequence: async (prefix: string) => `${prefix}-001`,
}));

afterEach(() => vi.restoreAllMocks());

it('settles the selected walk-in invoice and leaves the other branch dues unchanged', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const otherBranchId = new mongoose.Types.ObjectId();
  const invoice = {
    _id: new mongoose.Types.ObjectId(),
    invoiceNumber: 'INV-20261123-0008',
    paidAmount: 5000,
    balanceDue: 16700,
    paymentStatus: 'PARTIAL',
    save: vi.fn(),
  };
  const customer = { _id: customerId, name: 'Walk-in', branchId: otherBranchId, outstandingBalance: 18700, save: vi.fn() };
  vi.spyOn(Customer, 'findById').mockReturnValue({ session: async () => customer } as never);
  const invoiceQuery = vi.spyOn(SalesInvoice, 'find').mockReturnValue(
    { sort: () => ({ session: async () => [invoice] }) } as never
  );
  vi.spyOn(SalesInvoice, 'aggregate').mockReturnValue({ session: async () => [{ total: 2000 }] } as never);
  const ledger = vi.spyOn(CustomerLedgerEntry, 'create').mockResolvedValue([] as never);
  vi.spyOn(Payment, 'create').mockResolvedValue([] as never);
  vi.spyOn(PaymentCollection, 'create').mockImplementation((async ([record]: Record<string, unknown>[]) => [
    { ...record, _id: new mongoose.Types.ObjectId(), toObject: () => record },
  ]) as never);

  const result = await CollectionService.createCollection({
    customerId: customerId.toString(),
    branchId: branchId.toString(),
    amount: 16700,
    paymentMethod: 'CASH',
    allocations: [{ invoiceId: invoice._id.toString(), allocatedAmount: 16700 }],
  }, { accountId: 'admin', loginId: 'admin', role: 'SUPER_ADMIN', branchId: otherBranchId.toString() });

  expect(invoiceQuery).toHaveBeenCalledWith(expect.objectContaining({ branchId }));
  expect(invoice).toMatchObject({ paidAmount: 21700, balanceDue: 0, paymentStatus: 'PAID' });
  expect(customer.outstandingBalance).toBe(2000);
  expect(ledger).toHaveBeenCalledWith([expect.objectContaining({ branchId, credit: 16700 })], expect.anything());
  expect(result.collection).toMatchObject({
    amount: 16700,
    receiptNumber: 'RCP-001',
    allocations: [expect.objectContaining({ invoiceId: invoice._id, allocatedAmount: 16700 })],
  });
});

it('rejects a cashier attempting to record payment against another branch', async () => {
  const customerId = new mongoose.Types.ObjectId();
  vi.spyOn(Customer, 'findById').mockReturnValue({ session: async () => ({ _id: customerId }) } as never);
  const invoiceQuery = vi.spyOn(SalesInvoice, 'find');
  await expect(CollectionService.createCollection({
    customerId: customerId.toString(),
    branchId: new mongoose.Types.ObjectId().toString(),
    amount: 16700,
    paymentMethod: 'CASH',
  }, { accountId: 'branch', loginId: 'cashier', role: 'BRANCH', branchId: new mongoose.Types.ObjectId().toString() }))
    .rejects.toMatchObject({ code: 'FORBIDDEN_CROSS_BRANCH_COLLECTION' });
  expect(invoiceQuery).not.toHaveBeenCalled();
});
