import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { AccountRole, ACCOUNT_ROLES } from '../constants/index.js';

/**
 * SHA-256 hash helper for opaque session tokens.
 * Only hashed tokens are stored in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface ISession extends Document {
  tokenHash: string;
  accountId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  role: AccountRole;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(ACCOUNT_ROLES),
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '0s' }, // MongoDB automatic TTL index
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    isValid: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Session = mongoose.model<ISession>('Session', SessionSchema);
