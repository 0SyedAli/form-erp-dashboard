import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseOrderItem {
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  productName: string;
  brandName?: string;
  categoryName?: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  lineDiscount?: number;
  taxAmount?: number;
  lineTotal: number;
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

export interface IPurchaseOrder extends Document {
  orderNumber: string;
  supplierId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  stockLocationId?: mongoose.Types.ObjectId;
  items: IPurchaseOrderItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  paymentTerms: string;
  referenceNumber?: string;
  createdBy: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    sku: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    productName: { type: String, default: '' },
    brandName: { type: String },
    categoryName: { type: String },
    sizeLabel: { type: String },
    thicknessLabel: { type: String },
    orderedQuantity: { type: Number, required: true, min: 1 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineDiscount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
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
    stockLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'StockLocation',
      index: true,
    },
    items: [PurchaseOrderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
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
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'PARTIALLY_RECEIVED',
        'FULLY_RECEIVED',
        'CANCELLED',
        'CLOSED',
      ],
      default: 'DRAFT',
      index: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    paymentTerms: {
      type: String,
      default: 'Net 30 Days',
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    createdByName: {
      type: String,
    },
    approvedBy: {
      type: String,
    },
    approvedByName: {
      type: String,
    },
    approvedAt: {
      type: Date,
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
