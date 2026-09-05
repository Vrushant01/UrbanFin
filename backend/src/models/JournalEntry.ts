import mongoose, { Document, Schema, Model } from 'mongoose';
import { JournalEntryStatus, JournalEntryLine } from '../types/index.js';

export interface IJournalEntry extends Document {
  id: string;
  date: string;
  number: string;
  journalId: string;
  partnerId?: string;
  status: JournalEntryStatus;
  lines: JournalEntryLine[];
  total: number;
  sourceDocument?: {
    model: 'VendorBill' | 'CustomerInvoice' | 'Payment';
    id: string;
  };
}

const journalEntryLineSchema = new Schema<JournalEntryLine>(
  {
    id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
    accountId: { type: String, required: true },
    partnerId: { type: String, default: undefined },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const journalEntrySchema = new Schema<IJournalEntry>(
  {
    date: {
      type: String,
      required: [true, 'Entry date is required'],
    },
    number: {
      type: String,
      required: true,
      unique: true,
    },
    journalId: {
      type: String,
      required: [true, 'Journal ID is required'],
    },
    partnerId: {
      type: String,
      default: undefined,
    },
    status: {
      type: String,
      enum: Object.values(JournalEntryStatus),
      default: JournalEntryStatus.Draft,
      required: true,
    },
    lines: {
      type: [journalEntryLineSchema],
      default: [],
    },
    total: {
      type: Number,
      default: 0,
    },
    sourceDocument: {
      model: { type: String, enum: ['VendorBill', 'CustomerInvoice'] },
      id: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

journalEntrySchema.index({ journalId: 1, date: -1 });
journalEntrySchema.index({ partnerId: 1, date: -1 });
journalEntrySchema.index({ status: 1, date: -1 });
journalEntrySchema.index({ createdAt: -1 });

export const JournalEntry: Model<IJournalEntry> =
  mongoose.models.JournalEntry ||
  mongoose.model<IJournalEntry>('JournalEntry', journalEntrySchema);

