import { Router } from 'express';
import { getCategories, createCategory } from '../controllers/productController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getCategories);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createCategory);

export default router;
