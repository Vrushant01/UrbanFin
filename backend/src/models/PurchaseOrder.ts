import mongoose, { Document, Schema, Model } from 'mongoose';
import { PurchaseOrderStatus, PurchaseOrderLine } from '../types/index.js';

export interface IPurchaseOrder extends Document {
  id: string;
  number: string;
  vendorId: string;
  date: string;
  paymentTerms: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
}

const purchaseOrderLineSchema = new Schema<PurchaseOrderLine>(
  {
    id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
    productId: { type: String, required: true },
    analyticAccountId: { type: String, default: undefined },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    number: {
      type: String,
      required: true,
      unique: true,
    },
    vendorId: {
      type: String,
      required: [true, 'Vendor ID is required'],
    },
    date: {
      type: String,
      required: [true, 'PO Date is required'],
    },
    paymentTerms: {
      type: String,
      default: 'Immediate Payment',
    },
    status: {
      type: String,
      enum: Object.values(PurchaseOrderStatus),
      default: PurchaseOrderStatus.Draft,
      required: true,
    },
    lines: {
      type: [purchaseOrderLineSchema],
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

purchaseOrderSchema.index({ vendorId: 1 });

export const PurchaseOrder: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
