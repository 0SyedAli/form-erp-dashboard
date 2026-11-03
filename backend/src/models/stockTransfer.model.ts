import mongoose, { Schema, Document } from 'mongoose';

export const TRANSFER_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  DISPATCHED: 'DISPATCHED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[keyof typeof TRANSFER_STATUSES];

export interface ITransferItem {
  sku: string;
  variantId?: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IStockTransfer extends Document {
  transferNumber: string;
  fromBranchId: mongoose.Types.ObjectId;
  toBranchId: mongoose.Types.ObjectId;
  fromStockLocationId: mongoose.Types.ObjectId;
  toStockLocationId: mongoose.Types.ObjectId;
  items: ITransferItem[];
  status: TransferStatus;
  initiatedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  receivedBy?: string;
  dispatchedAt?: Date;
  receivedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransferItemSchema = new Schema<ITransferItem>(
  {
    sku: { type: String, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'Variant' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const StockTransferSchema = new Schema<IStockTransfer>(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fromBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    toBranchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    fromStockLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'StockLocation',
      required: true,
    },
    toStockLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'StockLocation',
      required: true,
    },
    items: [TransferItemSchema],
    status: {
      type: String,
      enum: Object.values(TRANSFER_STATUSES),
      default: TRANSFER_STATUSES.PENDING_APPROVAL,
      index: true,
    },
    initiatedBy: {
      type: String,
      required: true,
    },
    approvedBy: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
    receivedBy: {
      type: String,
    },
    dispatchedAt: {
      type: Date,
    },
    receivedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const StockTransfer = mongoose.model<IStockTransfer>('StockTransfer', StockTransferSchema);

