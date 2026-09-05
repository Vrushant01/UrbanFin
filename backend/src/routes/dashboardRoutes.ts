import { Router } from 'express';
import {
  getDashboardSummary,
  getPaymentTerms,
  addPaymentTerm,
} from '../controllers/dashboardController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/summary', requireAuth, getDashboardSummary);
router.get('/payment-terms', getPaymentTerms);
router.post('/payment-terms', requireAuth, requireRole([Role.Administrator, Role.Accountant]), addPaymentTerm);

export default router;
