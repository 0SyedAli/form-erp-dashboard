import mongoose, { Schema, Document } from 'mongoose';

export interface IStockAdjustment extends Document {
  adjustmentNumber: string;
  branchId: mongoose.Types.ObjectId;
  stockLocationId: mongoose.Types.ObjectId;
  sku: string;
  adjustmentType: 'PHYSICAL_COUNT' | 'ADMINISTRATIVE' | 'DAMAGE_WRITE_OFF';
  quantityDifference: number;
  reason: string;
  authorizedBy: string;
  timestamp: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustment>(
  {
    adjustmentNumber: {
      type: String,
      required: true,
      unique: true,
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
      required: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: ['PHYSICAL_COUNT', 'ADMINISTRATIVE', 'DAMAGE_WRITE_OFF'],
      required: true,
    },
    quantityDifference: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    authorizedBy: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const StockAdjustment = mongoose.model<IStockAdjustment>('StockAdjustment', StockAdjustmentSchema);

