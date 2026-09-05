import { Router } from 'express';
import {
  getBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  confirmBudget,
  reviseBudgetHandler,
  cancelBudget,
  getMatchingTransactionsHandler,
} from '../controllers/budgetController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/transactions', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getMatchingTransactionsHandler);
router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getBudgets);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getBudgetById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createBudget);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateBudget);
router.post('/:id/confirm', requireAuth, requireRole([Role.Administrator, Role.Accountant]), confirmBudget);
router.post('/:id/revise', requireAuth, requireRole([Role.Administrator, Role.Accountant]), reviseBudgetHandler);
router.post('/:id/cancel', requireAuth, requireRole([Role.Administrator, Role.Accountant]), cancelBudget);

export default router;
