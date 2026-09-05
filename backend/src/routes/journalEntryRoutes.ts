import { Router } from 'express';
import {
  getJournalEntries,
  getJournalEntryById,
  createJournalEntryHandler,
  updateJournalEntryHandler,
  postJournalEntryHandler,
  resetJournalEntryToDraftHandler,
  deleteJournalEntryHandler,
} from '../controllers/journalEntryController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getJournalEntries);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getJournalEntryById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createJournalEntryHandler);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateJournalEntryHandler);
router.post('/:id/post', requireAuth, requireRole([Role.Administrator, Role.Accountant]), postJournalEntryHandler);
router.post('/:id/reset-to-draft', requireAuth, requireRole([Role.Administrator, Role.Accountant]), resetJournalEntryToDraftHandler);
router.delete('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), deleteJournalEntryHandler);

export default router;

