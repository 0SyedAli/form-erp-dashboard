import mongoose, { Schema, Document } from 'mongoose';

export type SupplierLedgerEntryType =
  | 'BILL'
  | 'PAYMENT'
  | 'DEBIT_NOTE'
  | 'ADVANCE'
  | 'OPENING_BALANCE'
  | 'REVERSAL';

export interface ISupplierLedgerEntry extends Document {
  supplierId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  entryDate: Date;
  entryType: SupplierLedgerEntryType;
  referenceNumber: string;
  referenceBillId?: string;
  referencePaymentId?: string;
  debit: number; // Payments / Debit notes made to supplier (reduces our payable)
  credit: number; // Bills received from supplier (increases our payable)
  runningBalance: number;
  narration: string;
  performedBy: string;
  timestamp: Date;
}

const SupplierLedgerEntrySchema = new Schema<ISupplierLedgerEntry>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    entryType: {
      type: String,
      enum: ['BILL', 'PAYMENT', 'DEBIT_NOTE', 'ADVANCE', 'OPENING_BALANCE', 'REVERSAL'],
      required: true,
      index: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    referenceBillId: {
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
    timestamps: false,
  }
);

SupplierLedgerEntrySchema.index({ supplierId: 1, entryDate: -1, timestamp: -1 });

export const SupplierLedgerEntry = mongoose.model<ISupplierLedgerEntry>(
  'SupplierLedgerEntry',
  SupplierLedgerEntrySchema
);
