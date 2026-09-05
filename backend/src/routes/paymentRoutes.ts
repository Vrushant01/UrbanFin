import { Router } from 'express';
import {
  getPayments,
  registerPayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/paymentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyRazorpayPayment);
router.get('/', requireAuth, requireRole([Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant, Role.User]), getPayments);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]), registerPayment);

export default router;
