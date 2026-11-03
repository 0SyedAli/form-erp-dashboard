import mongoose, { Schema, Document } from 'mongoose';

export interface ISize extends Document {
  length: number;
  width: number;
  unit: string;
  displayLabel: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const SizeSchema = new Schema<ISize>(
  {
    length: {
      type: Number,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      default: 'in',
    },
    displayLabel: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

SizeSchema.index({ length: 1, width: 1, unit: 1 }, { unique: true });

export const Size = mongoose.model<ISize>('Size', SizeSchema);

