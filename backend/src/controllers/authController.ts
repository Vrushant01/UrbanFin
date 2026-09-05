import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
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

    res.status(200).json({
      success: true,
      message: `If an account matches ${target}, a password reset link has been sent.`,
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
