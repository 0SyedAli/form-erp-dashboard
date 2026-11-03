import mongoose, { Schema, Document } from 'mongoose';

export type PriceTier = 'LIST' | 'PURCHASE' | 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';

export interface IPriceHistory extends Document {
  variantId: mongoose.Types.ObjectId;
  sku: string;
  tier: PriceTier;
  previousPrice: number; // in Paisa
  newPrice: number; // in Paisa
  previousPercent?: number;
  newPercent?: number;
  changedByAccountId?: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PriceHistorySchema = new Schema<IPriceHistory>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: 'Variant',
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
    tier: {
      type: String,
      enum: ['LIST', 'PURCHASE', 'RETAIL', 'WHOLESALE', 'DISTRIBUTOR'],
      required: true,
      index: true,
    },
    previousPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    newPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    previousPercent: {
      type: Number,
    },
    newPercent: {
      type: Number,
    },
    changedByAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

PriceHistorySchema.index({ sku: 1, createdAt: -1 });

export const PriceHistory = mongoose.model<IPriceHistory>('PriceHistory', PriceHistorySchema);

