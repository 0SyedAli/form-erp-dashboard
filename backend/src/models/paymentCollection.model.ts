import mongoose, { Schema, Document } from 'mongoose';

export interface ICollectionAllocation {
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  allocatedAmount: number;
}

export interface IPaymentCollection extends Document {
  collectionNumber: string; // e.g. "COL-20261103-0001"
  branchId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  totalCollected: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';
  reference?: string;
  allocations: ICollectionAllocation[];
  unallocatedAmount: number;
  notes?: string;
  collectedBy: string;
  receiptNumber: string;
  collectionDate: Date;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionAllocationSchema = new Schema<ICollectionAllocation>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'SalesInvoice', required: true },
    invoiceNumber: { type: String, required: true },
    allocatedAmount: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const PaymentCollectionSchema = new Schema<IPaymentCollection>(
  {
    collectionNumber: { type: String, required: true, unique: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    totalCollected: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'],
      default: 'CASH',
    },
    reference: { type: String, trim: true },
    allocations: { type: [CollectionAllocationSchema], default: [] },
    unallocatedAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String },
    collectedBy: { type: String, required: true },
    receiptNumber: { type: String, required: true },
    collectionDate: { type: Date, default: Date.now, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
  },
  { timestamps: true }
);

PaymentCollectionSchema.index({ branchId: 1, collectionDate: -1 });

export const PaymentCollection = mongoose.model<IPaymentCollection>('PaymentCollection', PaymentCollectionSchema);

