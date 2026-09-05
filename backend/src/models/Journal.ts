import mongoose, { Document, Schema, Model } from 'mongoose';
import { JournalType } from '../types/index.js';

export interface IJournal extends Document {
  id: string;
  name: string;
  type: JournalType;
  defaultAccountId: string;
}

const journalSchema = new Schema<IJournal>(
  {
    name: {
      type: String,
      required: [true, 'Journal name is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(JournalType),
      required: [true, 'Journal type is required'],
    },
    defaultAccountId: {
      type: String,
      required: [true, 'Default account ID is required'],
      trim: true,
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

export const Journal: Model<IJournal> =
  mongoose.models.Journal || mongoose.model<IJournal>('Journal', journalSchema);
