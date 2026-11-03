import mongoose, { Schema, Document } from 'mongoose';

export interface IIdempotencyKey extends Document {
  key: string;
  endpoint: string;
  accountId: mongoose.Types.ObjectId;
  requestHash: string;
  responseStatus?: number;
  responseBody?: any;
  status: 'PENDING' | 'RESOLVED';
  createdAt: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    responseStatus: {
      type: Number,
    },
    responseBody: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED'],
      default: 'PENDING',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '24h' }, // Retain idempotency cache for 24 hours
    },
  },
  {
    timestamps: false,
  }
);

export const IdempotencyKey = mongoose.model<IIdempotencyKey>('IdempotencyKey', IdempotencyKeySchema);

