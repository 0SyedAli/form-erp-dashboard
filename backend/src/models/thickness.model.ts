import mongoose, { Schema, Document } from 'mongoose';

export interface IThickness extends Document {
  value: number;
  unit: string;
  displayLabel: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const ThicknessSchema = new Schema<IThickness>(
  {
    value: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    unit: {
      type: String,
      default: 'in',
    },
    displayLabel: {
      type: String,
      required: true,
      trim: true,
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

export const Thickness = mongoose.model<IThickness>('Thickness', ThicknessSchema);

