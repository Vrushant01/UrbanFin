import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../types/index.js';

export interface AuthPayload {
  id: string;
  loginId: string;
  email: string;
  role: Role;
  name: string;
  contactId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export const generateToken = (payload: AuthPayload): string => {
  const secret = process.env.JWT_SECRET || 'urban_furniture_super_secret_jwt_key_2026';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'urban_furniture_super_secret_jwt_key_2026';

    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required.' });
      return;
    }

    // MasterAdmin has top-level superuser privileges across admin routes
    const effectiveRoles = [...allowedRoles];
    if (
      allowedRoles.includes(Role.Administrator) ||
      allowedRoles.includes(Role.SubAdmin) ||
      allowedRoles.includes(Role.Accountant)
    ) {
      effectiveRoles.push(Role.MasterAdmin);
    }

    if (!effectiveRoles.includes(req.user.role)) {
      res.status(403).json({
        message: `Access denied. Role "${req.user.role}" does not have permission for this resource.`,
      });
      return;
    }

    next();
  };
};
