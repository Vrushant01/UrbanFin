import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role } from '../types/index.js';

export interface IUser extends Document {
  id: string;
  name: string;
  loginId: string;
  email: string;
  passwordHash: string;
  role: Role;
  contactId?: string;
  isSuspended: boolean;
  isMasterAdmin: boolean;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  resetTokenUsedAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    loginId: {
      type: String,
      required: [true, 'Login ID is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Login ID must be at least 3 characters'],
      maxlength: [40, 'Login ID must be at most 40 characters'],
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.Accountant,
      required: true,
    },
    contactId: {
      type: String,
      default: undefined,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    isMasterAdmin: {
      type: Boolean,
      default: false,
    },
    resetTokenHash: {
      type: String,
      default: undefined,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: undefined,
    },
    resetTokenUsedAt: {
      type: Date,
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
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
