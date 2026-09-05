import { Router } from 'express';
import {
  getVendorBills,
  getVendorBillById,
  createVendorBill,
  updateVendorBill,
  confirmVendorBill,
} from '../controllers/vendorBillController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getVendorBills);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getVendorBillById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createVendorBill);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateVendorBill);
router.post('/:id/confirm', requireAuth, requireRole([Role.Administrator, Role.Accountant]), confirmVendorBill);

export default router;
