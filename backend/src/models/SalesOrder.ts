import mongoose, { Document, Schema, Model } from 'mongoose';
import { SalesOrderStatus, SalesOrderLine } from '../types/index.js';

export interface ISalesOrder extends Document {
  id: string;
  number: string;
  customerId: string;
  date: string;
  status: SalesOrderStatus;
  lines: SalesOrderLine[];
}

const salesOrderLineSchema = new Schema<SalesOrderLine>(
  {
    id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
    productId: { type: String, required: true },
    analyticAccountId: { type: String, default: undefined },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const salesOrderSchema = new Schema<ISalesOrder>(
  {
    number: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: String,
      required: [true, 'Customer ID is required'],
    },
    date: {
      type: String,
      required: [true, 'SO Date is required'],
    },
    status: {
      type: String,
      enum: Object.values(SalesOrderStatus),
      default: SalesOrderStatus.Draft,
      required: true,
    },
    lines: {
      type: [salesOrderLineSchema],
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

salesOrderSchema.index({ customerId: 1 });

export const SalesOrder: Model<ISalesOrder> =
  mongoose.models.SalesOrder || mongoose.model<ISalesOrder>('SalesOrder', salesOrderSchema);
