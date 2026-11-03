import mongoose, { Schema, Document } from 'mongoose';
import { BranchPermissions, STANDARD_BRANCH_PERMISSIONS } from '../constants/index.js';

export interface IBranch extends Document {
  code: string;
  name: string;
  shopNumber: string;
  type: string;
  city: string;
  address: string;
  phone: string;
  loginId: string;
  targetMonthlySales: number;
  permissions: BranchPermissions;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shopNumber: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['MAIN', 'SHOWROOM', 'DEPOT', 'STUDIO', 'EXPRESS', 'RETAIL_STORE', 'WAREHOUSE', 'WHOLESALE_DEPOT', 'EXPRESS_COUNTER'],
      default: 'RETAIL_STORE',
    },
    city: {
      type: String,
      default: 'Karachi',
    },
    address: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    loginId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    targetMonthlySales: {
      type: Number,
      default: 0,
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: () => ({ ...STANDARD_BRANCH_PERMISSIONS }),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Branch = mongoose.model<IBranch>('Branch', BranchSchema);

