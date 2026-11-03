import mongoose, { Schema, Document } from 'mongoose';
import { ACCOUNT_ROLES, AccountRole, STANDARD_BRANCH_PERMISSIONS, BranchPermissions } from '../constants/index.js';

export interface IAccount extends Document {
  loginId: string;
  name: string;
  email?: string;
  passwordHash: string;
  role: AccountRole;
  branchId?: mongoose.Types.ObjectId;
  permissions: BranchPermissions;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionsSchema = new Schema<BranchPermissions>(
  {
    pos: { type: Boolean, default: true },
    viewOwnSales: { type: Boolean, default: true },
    viewProducts: { type: Boolean, default: true },
    addEditProducts: { type: Boolean, default: false },
    viewStock: { type: Boolean, default: true },
    manageStock: { type: Boolean, default: false },
    stockTransfers: { type: Boolean, default: false },
    customers: { type: Boolean, default: true },
    customerCredit: { type: Boolean, default: false },
    purchases: { type: Boolean, default: false },
    suppliers: { type: Boolean, default: false },
    reports: { type: Boolean, default: false },
    returns: { type: Boolean, default: false },
    discountsOverrides: { type: Boolean, default: false },
  },
  { _id: false }
);

const AccountSchema = new Schema<IAccount>(
  {
    loginId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(ACCOUNT_ROLES),
      required: true,
      default: ACCOUNT_ROLES.BRANCH,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    permissions: {
      type: PermissionsSchema,
      default: () => ({ ...STANDARD_BRANCH_PERMISSIONS }),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const Account = mongoose.model<IAccount>('Account', AccountSchema);

