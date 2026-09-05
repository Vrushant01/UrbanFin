import { Router } from 'express';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
  createBillFromPurchaseOrder,
} from '../controllers/purchaseOrderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getPurchaseOrders);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getPurchaseOrderById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createPurchaseOrder);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updatePurchaseOrder);
router.post('/:id/confirm', requireAuth, requireRole([Role.Administrator, Role.Accountant]), confirmPurchaseOrder);
router.post('/:id/cancel', requireAuth, requireRole([Role.Administrator, Role.Accountant]), cancelPurchaseOrder);
router.post('/:id/create-bill', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createBillFromPurchaseOrder);

export default router;
