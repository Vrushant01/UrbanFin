import { Router } from 'express';
import {
  getContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  checkUniqueContactEmail,
} from '../controllers/contactController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/check-unique-email', checkUniqueContactEmail);
router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getContacts);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getContactById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createContact);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateContact);
router.delete('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), deleteContact);

export default router;
