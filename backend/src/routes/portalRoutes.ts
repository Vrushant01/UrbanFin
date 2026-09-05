import { Router } from 'express';
import {
  getPortalInvoices,
  payPortalInvoice,
} from '../controllers/portalController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/invoices', requireAuth, requireRole([Role.User]), getPortalInvoices);
router.post('/invoices/:id/pay', requireAuth, requireRole([Role.User]), payPortalInvoice);

export default router;
