import mongoose, { Schema, Document } from 'mongoose';
import {
  SALE_TYPES,
  SaleType,
  PAYMENT_STATUSES,
  PaymentStatus,
  PAYMENT_ARRANGEMENTS,
  PaymentArrangement,
  INVOICE_STATUSES,
  InvoiceStatus,
  CUSTOMER_TYPES,
  CustomerType,
} from '../constants/index.js';

export interface IInvoiceLineItem {
  variantId?: mongoose.Types.ObjectId;
  sku: string;
  productName: string;
  sizeLabel: string;
  thicknessLabel: string;
  quantity: number;
  unitPrice: number; // Snapshot of price at time of sale
  lineTotal: number;
}

export interface ISalesInvoice extends Document {
  invoiceNumber: string;
  branchId: mongoose.Types.ObjectId;
  sourceBranchId?: mongoose.Types.ObjectId;
  isInterBranch?: boolean;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  customerType: CustomerType;
  saleType: SaleType;
  items: IInvoiceLineItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentArrangement: PaymentArrangement;
  status: InvoiceStatus;
  cashReceived?: number;
  changeReturned?: number;
  dueDate?: Date;
  idempotencyKey?: string;
  cashierName: string;
  creditOverride?: boolean;
  creditApprovedBy?: string;
  overrideReason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    sizeLabel: { type: String, required: true },
    thicknessLabel: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const SalesInvoiceSchema = new Schema<ISalesInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    sourceBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    isInterBranch: {
      type: Boolean,
      default: false,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
      default: 'Walk-in Customer',
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerType: {
      type: String,
      enum: Object.values(CUSTOMER_TYPES),
      default: CUSTOMER_TYPES.WALK_IN,
    },
    saleType: {
      type: String,
      enum: Object.values(SALE_TYPES),
      required: true,
      default: SALE_TYPES.WALK_IN,
      index: true,
    },
    items: {
      type: [InvoiceLineItemSchema],
      required: true,
      validate: [(v: IInvoiceLineItem[]) => v.length > 0, 'Invoice must contain at least one line item'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceDue: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      required: true,
      default: PAYMENT_STATUSES.PAID,
      index: true,
    },
    paymentArrangement: {
      type: String,
      enum: Object.values(PAYMENT_ARRANGEMENTS),
      required: true,
      default: PAYMENT_ARRANGEMENTS.CASH,
    },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: INVOICE_STATUSES.CONFIRMED,
      index: true,
    },
    cashReceived: {
      type: Number,
      default: 0,
    },
    changeReturned: {
      type: Number,
      default: 0,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    cashierName: {
      type: String,
      required: true,
    },
    creditOverride: {
      type: Boolean,
      default: false,
    },
    creditApprovedBy: {
      type: String,
    },
    overrideReason: {
      type: String,
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

SalesInvoiceSchema.virtual('netAmount').get(function () {
  return this.total;
});
SalesInvoiceSchema.virtual('grossAmount').get(function () {
  return this.subtotal;
});
SalesInvoiceSchema.virtual('discountAmount').get(function () {
  return this.discount;
});
SalesInvoiceSchema.virtual('amountPaid').get(function () {
  return this.paidAmount;
});
SalesInvoiceSchema.virtual('amountDue').get(function () {
  return this.balanceDue;
});
SalesInvoiceSchema.virtual('date').get(function () {
  return this.createdAt;
});

SalesInvoiceSchema.index({ branchId: 1, createdAt: -1 });

export const SalesInvoice = mongoose.model<ISalesInvoice>('SalesInvoice', SalesInvoiceSchema);

