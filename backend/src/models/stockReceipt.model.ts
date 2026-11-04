import mongoose, { Schema, Document } from 'mongoose';

export interface IReceiptItem {
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  productName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  quantityOrdered: number;
  quantityReceived: number;
  damagedQuantity?: number;
  unitCost: number;
  lineTotal: number;
}

export interface IStockReceipt extends Document {
  receiptNumber: string;
  purchaseOrderId?: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  supplierId?: mongoose.Types.ObjectId;
  supplierReference?: string;
  stockLocationId: mongoose.Types.ObjectId;
  items: IReceiptItem[];
  totalQuantity: number;
  totalCost: number;
  receivedBy: string;
  receivedDate: Date;
  status: 'COMPLETED' | 'PARTIAL' | 'CANCELLED';
  notes?: string;
  createdAt: Date;
}

const ReceiptItemSchema = new Schema<IReceiptItem>(
  {
    sku: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    productName: { type: String },
    sizeLabel: { type: String },
    thicknessLabel: { type: String },
    quantityOrdered: { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, required: true, min: 0 },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const StockReceiptSchema = new Schema<IStockReceipt>(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
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
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'Supplier',
      required: false,
      index: true,
    },
    supplierReference: {
      type: String,
      trim: true,
    },
    stockLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'StockLocation',
      required: true,
      index: true,
    },
    items: [ReceiptItemSchema],
    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedBy: {
      type: String,
      required: true,
    },
    receivedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PARTIAL', 'CANCELLED'],
      default: 'COMPLETED',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const StockReceipt = mongoose.model<IStockReceipt>('StockReceipt', StockReceiptSchema);
