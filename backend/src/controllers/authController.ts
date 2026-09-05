import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User.js';
import { Role } from '../types/index.js';
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
    const { name, loginId, email, password } = req.body;

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

    // Check uniqueness
    const existingLoginId = await User.findOne({ loginId: loginId.trim().toLowerCase() });
    if (existingLoginId) {
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

    const newUser = await User.create({
      name: name.trim(),
      loginId: loginId.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: Role.Accountant, // Default per spec
    });

    const token = generateToken({
      id: newUser.id,
      loginId: newUser.loginId,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
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

    // Per spec: mock/stub the email send, return a success state
    res.status(200).json({
      success: true,
      message: `If an account matches ${target}, a password reset link has been sent.`,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, loginId, email, role, password } = req.body;

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
      res.status(400).json({ message: 'Valid role is required (Administrator, Accountant, User)' });
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

    const newUser = await User.create({
      name: name.trim(),
      loginId: loginId.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      role,
      passwordHash,
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

    res.status(200).json({
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};
