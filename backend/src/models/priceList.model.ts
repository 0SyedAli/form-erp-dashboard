import mongoose, { Schema, Document } from 'mongoose';
import { SALE_TYPES, SaleType } from '../constants/index.js';

export interface IPriceItem {
  variantId: mongoose.Types.ObjectId;
  price: number;
}

export interface IPriceList extends Document {
  name: string;
  type: SaleType;
  prices: IPriceItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PriceItemSchema = new Schema<IPriceItem>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'Variant',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const PriceListSchema = new Schema<IPriceList>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(SALE_TYPES),
      required: true,
      unique: true,
      index: true,
    },
    prices: [PriceItemSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PriceList = mongoose.model<IPriceList>('PriceList', PriceListSchema);

