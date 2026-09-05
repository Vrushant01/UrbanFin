import mongoose, { Document, Schema, Model } from 'mongoose';
import { CustomerInvoiceStatus, CustomerInvoiceLine } from '../types/index.js';

export interface ICustomerInvoice extends Document {
  id: string;
  number: string;
  customerId: string;
  invoiceReference: string;
  invoiceDate: string;
  dueDate: string;
  soReferenceId?: string;
  status: CustomerInvoiceStatus;
  lines: CustomerInvoiceLine[];
  amountPaid: number;
  cashPaid: number;
  bankPaid: number;
  total: number;
  amountDue: number;
  paymentRequested?: boolean;
  paymentRequestedAt?: string;
}

const customerInvoiceLineSchema = new Schema<CustomerInvoiceLine>(
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

const customerInvoiceSchema = new Schema<ICustomerInvoice>(
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
    invoiceReference: {
      type: String,
      default: '',
    },
    invoiceDate: {
      type: String,
      required: [true, 'Invoice date is required'],
    },
    dueDate: {
      type: String,
      required: [true, 'Due date is required'],
    },
    soReferenceId: {
      type: String,
      default: undefined,
    },
    status: {
      type: String,
      enum: Object.values(CustomerInvoiceStatus),
      default: CustomerInvoiceStatus.Draft,
      required: true,
    },
    lines: {
      type: [customerInvoiceLineSchema],
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
    paymentRequested: {
      type: Boolean,
      default: false,
    },
    paymentRequestedAt: {
      type: String,
      default: undefined,
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

customerInvoiceSchema.index({ customerId: 1, invoiceDate: -1 });
customerInvoiceSchema.index({ status: 1, invoiceDate: -1 });
customerInvoiceSchema.index({ invoiceReference: 1 });
customerInvoiceSchema.index({ createdAt: -1 });

export const CustomerInvoice: Model<ICustomerInvoice> =
  mongoose.models.CustomerInvoice ||
  mongoose.model<ICustomerInvoice>('CustomerInvoice', customerInvoiceSchema);

