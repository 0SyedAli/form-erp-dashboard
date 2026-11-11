import mongoose, { Schema, Document } from 'mongoose';
import { CUSTOMER_TYPES, CustomerType } from '../constants/index.js';

export interface ICustomer extends Document {
  name: string;
  phone: string;
  customerType: CustomerType;
  businessName?: string;
  email?: string;
  address?: string;
  city?: string;
  taxNumber?: string;
  branchId?: mongoose.Types.ObjectId;
  creditEnabled: boolean;
  creditLimit: number;
  creditTerms: string;
  defaultDueDays: number;
  outstandingBalance: number;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerType: {
      type: String,
      enum: Object.values(CUSTOMER_TYPES),
      default: CUSTOMER_TYPES.WALK_IN,
      index: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
    },
    city: {
      type: String,
      default: 'Karachi',
    },
    taxNumber: {
      type: String,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    creditEnabled: {
      type: Boolean,
      default: false,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditTerms: {
      type: String,
      default: 'Net 30',
    },
    defaultDueDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    outstandingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
      index: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CustomerSchema.virtual('currentOutstanding').get(function () {
  return this.outstandingBalance;
});

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);

