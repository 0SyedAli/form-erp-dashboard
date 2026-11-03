import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  key: string; // e.g. "INV-20261103" or "COL-20261103"
  seq: number;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounter>(
  {
    key: { type: String, required: true, unique: true, index: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

