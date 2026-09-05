import mongoose, { Document, Schema, Model } from 'mongoose';
import { AnalyticAccountType } from '../types/index.js';

export interface IAnalyticAccount extends Document {
  id: string;
  name: string;
  type: AnalyticAccountType;
}

const analyticAccountSchema = new Schema<IAnalyticAccount>(
  {
    name: {
      type: String,
      required: [true, 'Analytic account name is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(AnalyticAccountType),
      required: [true, 'Analytic account type is required'],
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

export const AnalyticAccount: Model<IAnalyticAccount> =
  mongoose.models.AnalyticAccount ||
  mongoose.model<IAnalyticAccount>('AnalyticAccount', analyticAccountSchema);
