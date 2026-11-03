import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierBill extends Document {
  billNumber: string;
  supplierId: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  invoiceNumberSupplier?: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: Date;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOID';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierBillSchema = new Schema<ISupplierBill>(
  {
    billNumber: {
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
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    invoiceNumberSupplier: {
      type: String,
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDue: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['UNPAID', 'PARTIAL', 'PAID', 'VOID'],
      default: 'UNPAID',
      index: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const SupplierBill = mongoose.model<ISupplierBill>('SupplierBill', SupplierBillSchema);

