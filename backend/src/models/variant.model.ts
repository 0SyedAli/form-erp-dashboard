import mongoose, { Schema, Document } from 'mongoose';

export interface IVariant extends Document {
  productId: mongoose.Types.ObjectId;
  sizeId: mongoose.Types.ObjectId;
  thicknessId: mongoose.Types.ObjectId;
  sku: string;
  barcode?: string;
  listPrice: number; // in Paisa
  purchasePrice: number; // in Paisa
  purchaseDiscountPercent?: number;
  retailPrice: number; // in Paisa
  retailMarkupPercent?: number;
  wholesalePrice: number; // in Paisa
  wholesaleDiscountPercent?: number;
  distributorPrice: number; // in Paisa
  distributorDiscountPercent?: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IVariant>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sizeId: {
      type: Schema.Types.ObjectId,
      ref: 'Size',
      required: true,
      index: true,
    },
    thicknessId: {
      type: Schema.Types.ObjectId,
      ref: 'Thickness',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    listPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    purchaseDiscountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    retailPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    retailMarkupPercent: {
      type: Number,
      min: 0,
    },
    wholesalePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    wholesaleDiscountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    distributorPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    distributorDiscountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate specifications under the same base product
VariantSchema.index({ productId: 1, sizeId: 1, thicknessId: 1 }, { unique: true });

export const Variant = mongoose.model<IVariant>('Variant', VariantSchema);
