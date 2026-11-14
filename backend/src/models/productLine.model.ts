import mongoose, { Schema, Document } from 'mongoose';

export interface IProductLine extends Document {
  brandId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ProductLineSchema = new Schema<IProductLine>(
  {
    brandId: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
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

// Compound index to ensure uniqueness within a brand and category
ProductLineSchema.index({ brandId: 1, categoryId: 1, name: 1 }, { unique: true });
ProductLineSchema.index({ code: 1 }, { unique: true });

export const ProductLine =
  mongoose.models.ProductLine ||
  mongoose.model<IProductLine>('ProductLine', ProductLineSchema);

