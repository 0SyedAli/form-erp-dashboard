import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierBillItem {
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  productName: string;
  quantity: number;
  unitCost: number;
  discount?: number;
  tax?: number;
  total: number;
}

export type SupplierBillStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type SupplierBillPaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface ISupplierBill extends Document {
  billNumber: string;
  supplierInvoiceNumber: string;
  supplierId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  purchaseOrderId?: mongoose.Types.ObjectId;
  grnIds: mongoose.Types.ObjectId[];
  billDate: Date;
  dueDate: Date;
  items: ISupplierBillItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: SupplierBillStatus;
  paymentStatus: SupplierBillPaymentStatus;
  createdBy: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierBillItemSchema = new Schema<ISupplierBillItem>(
  {
    sku: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

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
    supplierInvoiceNumber: {
      type: String,
      required: true,
      trim: true,
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
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      index: true,
    },
    grnIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'StockReceipt',
      },
    ],
    billDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    items: [SupplierBillItemSchema],
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
    status: {
      type: String,
      enum: ['DRAFT', 'POSTED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
      index: true,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

SupplierBillSchema.virtual('amountDue').get(function () {
  return this.balanceDue;
});

// Prevent duplicate supplier invoice numbers for the same supplier
SupplierBillSchema.index(
  { supplierId: 1, supplierInvoiceNumber: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'CANCELLED' } } }
);

export const SupplierBill = mongoose.model<ISupplierBill>('SupplierBill', SupplierBillSchema);
