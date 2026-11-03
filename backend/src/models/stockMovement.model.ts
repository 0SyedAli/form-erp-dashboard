import mongoose, { Schema, Document } from 'mongoose';
import { STOCK_MOVEMENT_TYPES, StockMovementType } from '../constants/index.js';

export interface IStockMovement extends Document {
  movementNumber: string;
  branchId: mongoose.Types.ObjectId;
  stockLocationId: mongoose.Types.ObjectId;
  sku: string;
  movementType: StockMovementType;
  quantityDifference: number; // positive for addition, negative for deduction
  previousBalance: number;
  newBalance: number;
  referenceType?: string; // 'INVOICE' | 'PURCHASE_RECEIPT' | 'TRANSFER' | 'ADJUSTMENT'
  referenceId?: string;
  reason?: string;
  performedBy: string;
  timestamp: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    movementNumber: {
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
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: Object.values(STOCK_MOVEMENT_TYPES),
      required: true,
      index: true,
    },
    quantityDifference: {
      type: Number,
      required: true,
    },
    previousBalance: {
      type: Number,
      required: true,
    },
    newBalance: {
      type: Number,
      required: true,
    },
    referenceType: {
      type: String,
      trim: true,
    },
    referenceId: {
      type: String,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    performedBy: {
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
    timestamps: false, // Immutable audit document
  }
);

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', StockMovementSchema);

