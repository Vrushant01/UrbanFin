import { Router } from 'express';
import {
  login,
  signup,
  forgotPassword,
  createUser,
  logout,
  getMe,
} from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.post('/login', login);
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

// Administrator-only route
router.post('/create-user', requireAuth, requireRole([Role.Administrator]), createUser);

export default router;
