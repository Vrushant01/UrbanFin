import mongoose, { Document, Schema, Model } from 'mongoose';
import { VendorBillStatus, VendorBillLine } from '../types/index.js';

export interface IVendorBill extends Document {
  id: string;
  number: string;
  vendorId: string;
  billReference: string;
  billDate: string;
  dueDate: string;
  poReferenceId?: string;
  status: VendorBillStatus;
  lines: VendorBillLine[];
  amountPaid: number;
  cashPaid: number;
  bankPaid: number;
  total: number;
  amountDue: number;
}

const vendorBillLineSchema = new Schema<VendorBillLine>(
  {
    id: { type: String, default: () => Math.random().toString(36).substr(2, 9) },
    productId: { type: String, required: true },
    accountId: { type: String, required: true },
    analyticAccountId: { type: String, default: undefined },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const vendorBillSchema = new Schema<IVendorBill>(
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
    billReference: {
      type: String,
      default: '',
    },
    billDate: {
      type: String,
      required: [true, 'Bill date is required'],
    },
    dueDate: {
      type: String,
      required: [true, 'Due date is required'],
    },
    poReferenceId: {
      type: String,
      default: undefined,
    },
    status: {
      type: String,
      enum: Object.values(VendorBillStatus),
      default: VendorBillStatus.Draft,
      required: true,
    },
    lines: {
      type: [vendorBillLineSchema],
      default: [],
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    cashPaid: {
      type: Number,
      default: 0,
    },
    bankPaid: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc: any, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        const total = (doc.lines || []).reduce(
          (sum: number, l: any) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
          0
        );
        ret.total = total;
        ret.amountDue = Math.max(0, total - (ret.amountPaid || 0));
        return ret;
      },
    },
  }
);

vendorBillSchema.index({ vendorId: 1, billDate: -1 });
vendorBillSchema.index({ status: 1, billDate: -1 });
vendorBillSchema.index({ billReference: 1 });
vendorBillSchema.index({ createdAt: -1 });

export const VendorBill: Model<IVendorBill> =
  mongoose.models.VendorBill || mongoose.model<IVendorBill>('VendorBill', vendorBillSchema);

