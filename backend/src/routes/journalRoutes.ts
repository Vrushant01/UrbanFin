import { Router } from 'express';
import {
  getJournals,
  getJournalById,
  createJournal,
  updateJournal,
} from '../controllers/journalController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getJournals);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getJournalById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createJournal);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateJournal);

export default router;
