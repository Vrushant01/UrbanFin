import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPaymentTerm extends Document {
  id: string;
  name: string;
}

const paymentTermSchema = new Schema<IPaymentTerm>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
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

export const PaymentTerm: Model<IPaymentTerm> =
  mongoose.models.PaymentTerm || mongoose.model<IPaymentTerm>('PaymentTerm', paymentTermSchema);
