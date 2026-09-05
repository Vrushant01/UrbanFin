import { Router } from 'express';
import {
  getAnalyticAccounts,
  getAnalyticAccountById,
  createAnalyticAccount,
  updateAnalyticAccount,
  deleteAnalyticAccount,
} from '../controllers/analyticController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getAnalyticAccounts);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getAnalyticAccountById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createAnalyticAccount);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateAnalyticAccount);
router.delete('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), deleteAnalyticAccount);

export default router;

