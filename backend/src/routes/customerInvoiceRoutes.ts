import { Router } from 'express';
import {
  getCustomerInvoices,
  getCustomerInvoiceById,
  createCustomerInvoice,
  updateCustomerInvoice,
  confirmCustomerInvoice,
  requestCustomerPayment,
} from '../controllers/customerInvoiceController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, getCustomerInvoices);
router.get('/:id', requireAuth, getCustomerInvoiceById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]), createCustomerInvoice);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]), updateCustomerInvoice);
router.post('/:id/confirm', requireAuth, requireRole([Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]), confirmCustomerInvoice);
router.post('/:id/request-payment', requireAuth, requireRole([Role.Administrator, Role.MasterAdmin, Role.SubAdmin, Role.Accountant]), requestCustomerPayment);

export default router;
