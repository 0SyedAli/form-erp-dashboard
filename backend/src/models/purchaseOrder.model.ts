import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseOrderItem {
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface IPurchaseOrder extends Document {
  orderNumber: string;
  supplierId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  items: IPurchaseOrderItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  status: 'DRAFT' | 'SUBMITTED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';
  expectedDeliveryDate?: Date;
  createdBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    sku: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    orderNumber: {
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
    items: [PurchaseOrderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED'],
      default: 'SUBMITTED',
      index: true,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    createdBy: {
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

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);

