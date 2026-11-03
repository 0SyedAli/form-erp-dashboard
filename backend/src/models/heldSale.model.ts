import mongoose, { Schema, Document } from 'mongoose';
import { SALE_TYPES, SaleType, PAYMENT_ARRANGEMENTS, PaymentArrangement } from '../constants/index.js';

export interface IHeldCartItem {
  sku: string;
  productId?: string;
  productName: string;
  sizeLabel?: string;
  thicknessLabel?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IHeldSale extends Document {
  heldNumber: string;
  branchId: mongoose.Types.ObjectId;
  cashierId?: string;
  cashierName: string;
  customerId?: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone?: string;
  saleType: SaleType;
  paymentArrangement: PaymentArrangement;
  items: IHeldCartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HeldCartItemSchema = new Schema<IHeldCartItem>(
  {
    sku: { type: String, required: true },
    productId: { type: String },
    productName: { type: String, required: true },
    sizeLabel: { type: String },
    thicknessLabel: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const HeldSaleSchema = new Schema<IHeldSale>(
  {
    heldNumber: { type: String, required: true, unique: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    cashierId: { type: String },
    cashierName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, required: true, default: 'Walk-in Customer' },
    customerPhone: { type: String },
    saleType: { type: String, enum: Object.values(SALE_TYPES), default: SALE_TYPES.WALK_IN },
    paymentArrangement: { type: String, enum: Object.values(PAYMENT_ARRANGEMENTS), default: PAYMENT_ARRANGEMENTS.FULL },
    items: { type: [HeldCartItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

HeldSaleSchema.index({ branchId: 1, createdAt: -1 });

export const HeldSale = mongoose.model<IHeldSale>('HeldSale', HeldSaleSchema);

