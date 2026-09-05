import { Router } from 'express';
import {
  getAccounts,
  createAccount,
  updateAccount,
} from '../controllers/accountController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getAccounts);
router.post('/', requireAuth, requireRole([Role.Administrator]), createAccount);
router.put('/:id', requireAuth, requireRole([Role.Administrator]), updateAccount);

export default router;
