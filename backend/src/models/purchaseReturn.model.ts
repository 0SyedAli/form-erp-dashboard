import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseReturnItem {
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason?: string;
}

export interface IPurchaseReturn extends Document {
  returnNumber: string;
  debitNoteNumber: string;
  supplierId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  stockLocationId: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId;
  receiptId?: mongoose.Types.ObjectId;
  items: IPurchaseReturnItem[];
  totalAmount: number;
  returnDate: Date;
  reason: string;
  status: 'COMPLETED' | 'CANCELLED';
  processedBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseReturnItemSchema = new Schema<IPurchaseReturnItem>(
  {
    sku: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    reason: { type: String },
  },
  { _id: false }
);

const PurchaseReturnSchema = new Schema<IPurchaseReturn>(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    debitNoteNumber: {
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
    stockLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'StockLocation',
      required: true,
      index: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      index: true,
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: 'SupplierBill',
      index: true,
    },
    receiptId: {
      type: Schema.Types.ObjectId,
      ref: 'StockReceipt',
      index: true,
    },
    items: [PurchaseReturnItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    returnDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    processedBy: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const PurchaseReturn = mongoose.model<IPurchaseReturn>(
  'PurchaseReturn',
  PurchaseReturnSchema
);

