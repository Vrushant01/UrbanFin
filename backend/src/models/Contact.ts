import mongoose, { Document, Schema, Model } from 'mongoose';
import { ContactType, Address } from '../types/index.js';

export interface IContact extends Document {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string;
  image?: string;
  imageId?: string;
  address: Address;
  hasPortalAccess: boolean;
}

const addressSchema = new Schema<Address>(
  {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    pincode: { type: String, default: '' },
  },
  { _id: false }
);

const contactSchema = new Schema<IContact>(
  {
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(ContactType),
      default: ContactType.Customer,
      required: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: undefined,
    },
    imageId: {
      type: String,
      default: undefined,
    },
    address: {
      type: addressSchema,
      default: () => ({
        street: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
      }),
    },
    hasPortalAccess: {
      type: Boolean,
      default: false,
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

contactSchema.index({ name: 'text', email: 'text', phone: 'text' });

export const Contact: Model<IContact> =
  mongoose.models.Contact || mongoose.model<IContact>('Contact', contactSchema);
