import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  code: string;
  name: string;
  contactPerson?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city: string;
  ntn?: string;
  suppliedBrands: string[];
  creditEnabled: boolean;
  defaultCreditDays: number;
  paymentTerms: string;
  creditLimit: number;
  openingPayable: number;
  currentOutstanding: number;
  balancePayable: number;
  unallocatedAdvances: number;
  supplierCreditBalance: number;
  bankName?: string;
  bankAccountNumber?: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
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
    whatsapp: {
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
      default: '',
    },
    city: {
      type: String,
      default: 'Karachi',
    },
    ntn: {
      type: String,
      trim: true,
    },
    suppliedBrands: {
      type: [String],
      default: [],
    },
    creditEnabled: {
      type: Boolean,
      default: true,
    },
    defaultCreditDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    paymentTerms: {
      type: String,
      default: 'Net 30 Days',
    },
    creditLimit: {
      type: Number,
      default: 1000000,
      min: 0,
    },
    openingPayable: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentOutstanding: {
      type: Number,
      default: 0,
    },
    balancePayable: {
      type: Number,
      default: 0,
    },
    unallocatedAdvances: {
      type: Number,
      default: 0,
    },
    supplierCreditBalance: {
      type: Number,
      default: 0,
    },
    bankName: {
      type: String,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual alias to ensure backward compatibility between currentOutstanding and balancePayable
SupplierSchema.pre('save', function (next) {
  if (this.isModified('currentOutstanding')) {
    this.balancePayable = this.currentOutstanding;
  } else if (this.isModified('balancePayable')) {
    this.currentOutstanding = this.balancePayable;
  }
  next();
});

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema);
