import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierPaymentAllocation {
  billId: mongoose.Types.ObjectId;
  billNumber: string;
  supplierInvoiceNumber?: string;
  allocatedAmount: number;
  previousDue?: number;
  newDue?: number;
}

export interface ISupplierPayment extends Document {
  paymentNumber: string;
  supplierId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE' | 'PAYPAK_CARD';
  reference?: string;
  chequeDate?: Date;
  chequeStatus?: 'PENDING_CLEARANCE' | 'CLEARED' | 'BOUNCED';
  allocations: ISupplierPaymentAllocation[];
  unallocatedAdvance: number;
  paidBy: string;
  createdBy?: string;
  notes?: string;
  paymentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationSchema = new Schema<ISupplierPaymentAllocation>(
  {
    billId: { type: Schema.Types.ObjectId, ref: 'SupplierBill', required: true },
    billNumber: { type: String, required: true },
    supplierInvoiceNumber: { type: String },
    allocatedAmount: { type: Number, required: true, min: 0 },
    previousDue: { type: Number },
    newDue: { type: Number },
  },
  { _id: false }
);

const SupplierPaymentSchema = new Schema<ISupplierPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
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
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE', 'PAYPAK_CARD'],
      default: 'BANK_TRANSFER',
    },
    reference: {
      type: String,
      trim: true,
    },
    chequeDate: {
      type: Date,
    },
    chequeStatus: {
      type: String,
      enum: ['PENDING_CLEARANCE', 'CLEARED', 'BOUNCED'],
      default: 'CLEARED',
    },
    allocations: [AllocationSchema],
    unallocatedAdvance: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidBy: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
    },
    notes: {
      type: String,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const SupplierPayment = mongoose.model<ISupplierPayment>(
  'SupplierPayment',
  SupplierPaymentSchema
);
