import { Router } from 'express';
import {
  getCustomerInvoices,
  getCustomerInvoiceById,
  createCustomerInvoice,
  updateCustomerInvoice,
  confirmCustomerInvoice,
} from '../controllers/customerInvoiceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getCustomerInvoices);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getCustomerInvoiceById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createCustomerInvoice);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateCustomerInvoice);
router.post('/:id/confirm', requireAuth, requireRole([Role.Administrator, Role.Accountant]), confirmCustomerInvoice);

export default router;
