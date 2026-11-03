import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  ntn?: string;
  balancePayable: number;
  status: 'ACTIVE' | 'INACTIVE';
  paymentTerms: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
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
    ntn: {
      type: String,
      trim: true,
    },
    balancePayable: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    paymentTerms: {
      type: String,
      default: 'Net 30 Days',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema);

