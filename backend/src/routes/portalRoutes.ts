import { Router } from 'express';
import {
  getPortalInvoices,
  payPortalInvoice,
} from '../controllers/portalController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get(
  '/invoices',
  requireAuth,
  requireRole([Role.User, Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]),
  getPortalInvoices
);
router.post(
  '/invoices/:id/pay',
  requireAuth,
  requireRole([Role.User, Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]),
  payPortalInvoice
);

export default router;
