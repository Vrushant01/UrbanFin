import { Router } from 'express';
import {
  getSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder,
  createInvoiceFromSalesOrder,
} from '../controllers/salesOrderController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getSalesOrders);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getSalesOrderById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createSalesOrder);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateSalesOrder);
router.post('/:id/confirm', requireAuth, requireRole([Role.Administrator, Role.Accountant]), confirmSalesOrder);
router.post('/:id/cancel', requireAuth, requireRole([Role.Administrator, Role.Accountant]), cancelSalesOrder);
router.post('/:id/create-invoice', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createInvoiceFromSalesOrder);

export default router;
