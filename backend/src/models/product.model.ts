import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  brandId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  productLineId?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  imageUrl?: string;
  branchId?: mongoose.Types.ObjectId;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
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
    productLineId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductLine',
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
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

export const Product = mongoose.model<IProduct>('Product', ProductSchema);

