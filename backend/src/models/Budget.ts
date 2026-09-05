import mongoose, { Document, Schema, Model } from 'mongoose';
import { BudgetStatus, BudgetLine, AnalyticAccountType } from '../types/index.js';

export interface IBudget extends Document {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  responsibleId: string;
  status: BudgetStatus;
  revisionOfId?: string;
  revisedById?: string;
  lines: BudgetLine[];
}

const budgetLineSchema = new Schema<BudgetLine>(
  {
    id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
    analyticAccountId: { type: String, required: true },
    type: { type: String, enum: Object.values(AnalyticAccountType), required: true },
    committedAmount: { type: Number, required: true, default: 0 },
    achievedAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const budgetSchema = new Schema<IBudget>(
  {
    name: {
      type: String,
      required: [true, 'Budget name is required'],
      trim: true,
    },
    startDate: {
      type: String,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: String,
      required: [true, 'End date is required'],
    },
    responsibleId: {
      type: String,
      required: [true, 'Responsible contact/user ID is required'],
    },
    status: {
      type: String,
      enum: Object.values(BudgetStatus),
      default: BudgetStatus.Draft,
      required: true,
    },
    revisionOfId: {
      type: String,
      default: undefined,
    },
    revisedById: {
      type: String,
      default: undefined,
    },
    lines: {
      type: [budgetLineSchema],
      default: [],
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

budgetSchema.index({ name: 'text' });
budgetSchema.index({ status: 1 });

export const Budget: Model<IBudget> =
  mongoose.models.Budget || mongoose.model<IBudget>('Budget', budgetSchema);
