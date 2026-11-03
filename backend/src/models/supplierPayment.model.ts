import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierPayment extends Document {
  paymentNumber: string;
  supplierId: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  amount: number;
  paymentMethod: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'ONLINE';
  reference?: string;
  notes?: string;
  paidBy: string;
  paymentDate: Date;
  createdAt: Date;
}

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
    billId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierBill',
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
      enum: ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'ONLINE'],
      default: 'BANK_TRANSFER',
    },
    reference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
    },
    paidBy: {
      type: String,
      required: true,
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

export const SupplierPayment = mongoose.model<ISupplierPayment>('SupplierPayment', SupplierPaymentSchema);

