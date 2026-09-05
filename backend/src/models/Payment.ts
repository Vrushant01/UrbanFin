import mongoose, { Document, Schema, Model } from 'mongoose';
import { PaymentType, PaymentVia } from '../types/index.js';

export interface IPayment extends Document {
  id: string;
  type: PaymentType;
  partnerId: string;
  amount: number;
  date: string;
  via: PaymentVia;
  note: string;
  billId?: string;
  invoiceId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

const paymentSchema = new Schema<IPayment>(
  {
    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: true,
    },
    partnerId: {
      type: String,
      required: [true, 'Partner ID is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    date: {
      type: String,
      required: [true, 'Payment date is required'],
    },
    via: {
      type: String,
      enum: Object.values(PaymentVia),
      default: PaymentVia.Bank,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    billId: {
      type: String,
      default: undefined,
    },
    invoiceId: {
      type: String,
      default: undefined,
    },
    razorpayOrderId: {
      type: String,
      default: undefined,
    },
    razorpayPaymentId: {
      type: String,
      default: undefined,
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

paymentSchema.index({ partnerId: 1, date: -1 });
paymentSchema.index({ type: 1, date: -1 });
paymentSchema.index({ billId: 1 });
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ createdAt: -1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema);

