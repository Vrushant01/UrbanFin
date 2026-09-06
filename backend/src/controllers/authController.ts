import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { User, IUser } from '../models/User.js';
import { Contact } from '../models/Contact.js';
import { Role, ContactType } from '../types/index.js';
import { generateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { validateLoginId, validatePassword, validateEmail } from '../utils/validation.js';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      res.status(400).json({ message: 'Login ID and password are required' });
      return;
    }

    const identifier = loginId.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ loginId: identifier }, { email: identifier }],
    });
    if (!user) {
      res.status(401).json({ message: 'Invalid Login Id or Password' });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({
        message: 'Your account has been suspended by the Master Administrator. Please contact support.',
      });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid Login Id or Password' });
      return;
    }

    const token = generateToken({
      id: user.id,
      loginId: user.loginId,
      email: user.email,
      role: user.role,
      name: user.name,
      contactId: user.contactId,
    });

    res.status(200).json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, loginId, email, password, role: requestedRole, phone } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    const loginIdError = validateLoginId(loginId);
    if (loginIdError) {
      res.status(400).json({ message: loginIdError });
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ message: emailError });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ message: passwordError });
      return;
    }

    // Check if user already exists
    const cleanEmail = email.trim().toLowerCase();
    const cleanLoginId = loginId.trim().toLowerCase();
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { loginId: cleanLoginId }],
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (existingUser) {
      // Existing portal user self-activating or setting password
      existingUser.passwordHash = passwordHash;
      if (name && name.trim()) existingUser.name = name.trim();
      if (!existingUser.contactId) {
        const contact = await Contact.findOne({ email: cleanEmail });
        if (contact) existingUser.contactId = contact._id.toString();
      }
      await existingUser.save();

      const token = generateToken({
        id: existingUser.id,
        loginId: existingUser.loginId,
        email: existingUser.email,
        role: existingUser.role,
        name: existingUser.name,
        contactId: existingUser.contactId,
      });

      res.status(200).json({
        token,
        user: existingUser.toJSON(),
      });
      return;
    }

    let existingContact = await Contact.findOne({ email: cleanEmail });
    if (!existingContact && phone) {
      existingContact = await Contact.findOne({ phone: phone.trim() });
    }

    let assignedRole = Role.Accountant;
    let contactId: string | undefined = undefined;

    if (requestedRole === Role.Vendor || requestedRole === 'Vendor' || (existingContact && existingContact.type === ContactType.Vendor)) {
      assignedRole = Role.Vendor;
      if (existingContact) {
        contactId = existingContact._id.toString();
        existingContact.hasPortalAccess = true;
        await existingContact.save();
      } else {
        const newContact = await Contact.create({
          name: name.trim(),
          type: ContactType.Vendor,
          email: cleanEmail,
          phone: phone?.trim() || '',
          hasPortalAccess: true,
        });
        contactId = newContact._id.toString();
      }
    } else if (requestedRole === Role.User || requestedRole === 'Customer' || (existingContact && existingContact.type === ContactType.Customer)) {
      assignedRole = Role.User;
      if (existingContact) {
        contactId = existingContact._id.toString();
        existingContact.hasPortalAccess = true;
        await existingContact.save();
      } else {
        const newContact = await Contact.create({
          name: name.trim(),
          type: ContactType.Customer,
          email: cleanEmail,
          phone: phone?.trim() || '',
          hasPortalAccess: true,
        });
        contactId = newContact._id.toString();
      }
    } else if (existingContact) {
      contactId = existingContact._id.toString();
      assignedRole = existingContact.type === ContactType.Vendor ? Role.Vendor : Role.User;
    }

    const newUser = await User.create({
      name: name.trim(),
      loginId: cleanLoginId,
      email: cleanEmail,
      passwordHash,
      role: assignedRole,
      contactId,
      isSuspended: false,
      isMasterAdmin: false,
    });

    const token = generateToken({
      id: newUser.id,
      loginId: newUser.loginId,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
      contactId: newUser.contactId,
    });

    res.status(201).json({
      token,
      user: newUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, email, loginId } = req.body;
    const target = identifier || email || loginId;

    if (!target) {
      res.status(400).json({ message: 'Login ID or Email is required' });
      return;
    }

    const cleanTarget = target.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanTarget }, { loginId: cleanTarget }],
    });

    if (user) {
      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Set expiration to 30 minutes
      const resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

      user.resetTokenHash = resetTokenHash;
      user.resetTokenExpiresAt = resetTokenExpiresAt;
      user.resetTokenUsedAt = undefined;
      await user.save();

      // Send Email
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: parseInt(process.env.SMTP_PORT || '587') === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        const mailOptions = {
          from: process.env.SMTP_FROM || 'UrbanFin ERP <noreply@urbanfin.com>',
          to: user.email,
          subject: 'Reset your UrbanFin ERP password',
          text: `Hello ${user.name},\n\nWe received a request to reset your UrbanFin ERP password.\n\nPlease visit the following link to create a new password:\n\n${resetUrl}\n\nThis link will expire in 30 minutes and can only be used once.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nRegards,\nUrbanFin ERP`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e293b; margin-bottom: 20px;">UrbanFin ERP Password Reset</h2>
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>We received a request to reset your UrbanFin ERP password.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">RESET PASSWORD</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 14px; word-break: break-all;">${resetUrl}</p>
              <p>This link will expire in 30 minutes and can only be used once.</p>
              <p>If you did not request a password reset, you can safely ignore this email.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">Regards,<br>UrbanFin ERP Team</p>
            </div>
          `,
        };

        try {
          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error('Failed to send reset email:', emailError);
          // Do not leak email failure to the frontend
        }
      } else {
        console.warn('SMTP credentials missing. Would have sent reset link:', `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `If an account matches ${target}, a password reset link has been sent.`,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: 'Token and new password are required' });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ message: passwordError });
      return;
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetTokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
      resetTokenUsedAt: { $exists: false },
    });

    if (!user) {
      res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    user.passwordHash = passwordHash;
    user.resetTokenUsedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.status(200).json(users.map((u) => u.toJSON()));
  } catch (error) {
    next(error);
  }
};

export const toggleSuspendUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { isSuspended } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Safety: Cannot suspend Master Admin
    if (user.isMasterAdmin || user.role === Role.MasterAdmin || user.loginId === 'admin123') {
      res.status(400).json({ message: 'Master Administrator account cannot be suspended.' });
      return;
    }

    user.isSuspended = isSuspended !== undefined ? isSuspended : !user.isSuspended;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.name} has been ${user.isSuspended ? 'suspended' : 'activated'}.`,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isMasterAdmin || user.role === Role.MasterAdmin || user.loginId === 'admin123') {
      res.status(400).json({ message: 'Master Administrator account cannot be deleted.' });
      return;
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, loginId, email, role, password, phone } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }

    const loginIdError = validateLoginId(loginId);
    if (loginIdError) {
      res.status(400).json({ message: loginIdError });
      return;
    }

    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ message: emailError });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ message: passwordError });
      return;
    }

    if (!role || !Object.values(Role).includes(role)) {
      res.status(400).json({ message: `Valid role is required (${Object.values(Role).join(', ')})` });
      return;
    }

    // Check uniqueness
    const existingLogin = await User.findOne({ loginId: loginId.trim().toLowerCase() });
    if (existingLogin) {
      res.status(409).json({ message: 'Login ID is already taken.' });
      return;
    }

    const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      res.status(409).json({ message: 'Email is already registered.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let contactId: string | undefined = undefined;

    if (role === Role.Vendor) {
      const newContact = await Contact.create({
        name: name.trim(),
        type: ContactType.Vendor,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || '',
        hasPortalAccess: true,
      });
      contactId = newContact._id.toString();
    } else if (role === Role.User) {
      const newContact = await Contact.create({
        name: name.trim(),
        type: ContactType.Customer,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || '',
        hasPortalAccess: true,
      });
      contactId = newContact._id.toString();
    }

    const newUser = await User.create({
      name: name.trim(),
      loginId: loginId.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      role,
      passwordHash,
      contactId,
      isSuspended: false,
      isMasterAdmin: role === Role.MasterAdmin,
    });

    res.status(201).json({
      success: true,
      user: newUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (user.isSuspended) {
      res.status(403).json({ message: 'Account is suspended' });
      return;
    }

    res.status(200).json({
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};
