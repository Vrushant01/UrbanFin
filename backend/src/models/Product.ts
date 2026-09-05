import mongoose, { Document, Schema, Model } from 'mongoose';
import { ProductType } from '../types/index.js';

export interface IProduct extends Document {
  id: string;
  name: string;
  type: ProductType;
  categoryId: string;
  salesPrice: number;
  cost: number;
  image?: string;
  imageId?: string;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(ProductType),
      default: ProductType.Goods,
      required: true,
    },
    categoryId: {
      type: String,
      required: [true, 'Category ID is required'],
      trim: true,
    },
    salesPrice: {
      type: Number,
      required: [true, 'Sales price is required'],
      min: [0, 'Sales price must be greater than or equal to 0'],
      default: 0,
    },
    cost: {
      type: Number,
      required: [true, 'Cost is required'],
      min: [0, 'Cost must be greater than or equal to 0'],
      default: 0,
    },
    image: {
      type: String,
      default: undefined,
    },
    imageId: {
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

productSchema.index({ name: 'text' });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);
