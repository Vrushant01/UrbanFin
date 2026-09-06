import { Router } from 'express';
import {
  login,
  signup,
  forgotPassword,
  resetPassword,
  createUser,
  logout,
  getMe,
  getAllUsers,
  toggleSuspendUser,
  deleteUser,
} from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

// User Management Routes (MasterAdmin & Administrator & SubAdmin)
router.get(
  '/users',
  requireAuth,
  requireRole([Role.MasterAdmin, Role.Administrator, Role.SubAdmin]),
  getAllUsers
);
router.post(
  '/create-user',
  requireAuth,
  requireRole([Role.MasterAdmin, Role.Administrator, Role.SubAdmin]),
  createUser
);
router.post(
  '/users/:id/suspend',
  requireAuth,
  requireRole([Role.MasterAdmin, Role.Administrator]),
  toggleSuspendUser
);
router.delete(
  '/users/:id',
  requireAuth,
  requireRole([Role.MasterAdmin, Role.Administrator]),
  deleteUser
);

export default router;

