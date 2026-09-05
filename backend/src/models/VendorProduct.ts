import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IVendorProduct extends Document {
  id: string;
  vendorId: string;
  name: string;
  categoryId?: string;
  price: number;
  stockQuantity: number;
  description?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorProductSchema = new Schema<IVendorProduct>(
  {
    vendorId: {
      type: String,
      required: [true, 'Vendor ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    categoryId: {
      type: String,
      default: undefined,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be non-negative'],
      default: 0,
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
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

vendorProductSchema.index({ name: 'text', description: 'text' });
vendorProductSchema.index({ vendorId: 1, name: 1 });

export const VendorProduct: Model<IVendorProduct> =
  mongoose.models.VendorProduct ||
  mongoose.model<IVendorProduct>('VendorProduct', vendorProductSchema);
