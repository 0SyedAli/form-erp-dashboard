import mongoose, { Schema, Document } from 'mongoose';

export interface IStockBalance extends Document {
  branchId: mongoose.Types.ObjectId;
  stockLocationId: mongoose.Types.ObjectId;
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  onHand: number;
  reserved: number;
  reorderLevel: number;
  updatedAt: Date;
}

const StockBalanceSchema = new Schema<IStockBalance>(
  {
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
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'Variant',
      index: true,
    },
    onHand: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock balance cannot be negative under standard ERP rules'],
    },
    reserved: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderLevel: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

StockBalanceSchema.virtual('available').get(function () {
  return Math.max(0, (this.onHand || 0) - (this.reserved || 0));
});

// Compound unique index ensuring one balance record per SKU per location per branch
StockBalanceSchema.index({ branchId: 1, stockLocationId: 1, sku: 1 }, { unique: true });

export const StockBalance = mongoose.model<IStockBalance>('StockBalance', StockBalanceSchema);

