import mongoose, { Schema, Document } from 'mongoose';
import { STOCK_LOCATION_TYPES, StockLocationType } from '../constants/index.js';

export interface IStockLocation extends Document {
  branchId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  type: StockLocationType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StockLocationSchema = new Schema<IStockLocation>(
  {
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
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
    type: {
      type: String,
      enum: Object.values(STOCK_LOCATION_TYPES),
      default: STOCK_LOCATION_TYPES.SALES_FLOOR,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

StockLocationSchema.index({ branchId: 1, code: 1 }, { unique: true });

export const StockLocation = mongoose.model<IStockLocation>('StockLocation', StockLocationSchema);

