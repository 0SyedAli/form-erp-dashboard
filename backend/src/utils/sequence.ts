import { ClientSession } from 'mongoose';
import { Counter } from '../models/counter.model.js';

export async function generateDailySequence(
  prefix: string,
  session?: ClientSession | null,
  date: Date = new Date()
): Promise<string> {
  // Format YYYYMMDD in PKT (UTC+5) or system local date
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const key = `${prefix}-${dateStr}`;

  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session }
  );

  const seqNumber = counter.seq;
  const seqPadded = seqNumber < 10000 ? String(seqNumber).padStart(4, '0') : String(seqNumber);

  return `${prefix}-${dateStr}-${seqPadded}`;
}
