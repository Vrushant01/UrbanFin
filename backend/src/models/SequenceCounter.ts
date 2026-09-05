import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISequenceCounter extends Document {
  key: string;
  seq: number;
}

const sequenceCounterSchema = new Schema<ISequenceCounter>(
  {
    key: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const SequenceCounter: Model<ISequenceCounter> =
  mongoose.models.SequenceCounter ||
  mongoose.model<ISequenceCounter>('SequenceCounter', sequenceCounterSchema);
