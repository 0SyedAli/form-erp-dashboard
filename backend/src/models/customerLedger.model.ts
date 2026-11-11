import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomerLedgerEntry extends Document {
  customerId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  entryType: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT' | 'OPENING_BALANCE' | 'REVERSAL';
  referenceInvoiceId?: string;
  referencePaymentId?: string;
  debit: number; // Charges/Invoices (increases customer debt)
  credit: number; // Payments received (reduces customer debt)
  runningBalance: number; // Cumulative balance after this transaction
  narration: string;
  performedBy: string;
  timestamp: Date;
}

const CustomerLedgerEntrySchema = new Schema<ICustomerLedgerEntry>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: ['INVOICE', 'PAYMENT', 'ADJUSTMENT', 'OPENING_BALANCE', 'REVERSAL'],
      required: true,
    },
    referenceInvoiceId: {
      type: String,
      trim: true,
      index: true,
    },
    referencePaymentId: {
      type: String,
      trim: true,
      index: true,
    },
    debit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    credit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    runningBalance: {
      type: Number,
      required: true,
    },
    narration: {
      type: String,
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // Immutable financial journal
  }
);

CustomerLedgerEntrySchema.index({ customerId: 1, timestamp: -1 });
CustomerLedgerEntrySchema.index({ customerId: 1, branchId: 1, timestamp: -1 });
CustomerLedgerEntrySchema.index({ branchId: 1, timestamp: -1 });

export const CustomerLedgerEntry = mongoose.model<ICustomerLedgerEntry>(
  'CustomerLedgerEntry',
  CustomerLedgerEntrySchema
);

