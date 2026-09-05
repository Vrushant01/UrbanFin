import mongoose, { Document, Schema, Model } from 'mongoose';
import { AccountType } from '../types/index.js';

export interface IAccount extends Document {
  id: string;
  name: string;
  type: AccountType;
}

const accountSchema = new Schema<IAccount>(
  {
    name: {
      type: String,
      required: [true, 'Account name is required'],
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(AccountType),
      required: [true, 'Account type is required'],
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

accountSchema.index({ name: 'text' });

export const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>('Account', accountSchema);
