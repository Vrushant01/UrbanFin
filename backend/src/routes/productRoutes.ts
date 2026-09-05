import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getProducts);
router.get('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getProductById);
router.post('/', requireAuth, requireRole([Role.Administrator, Role.Accountant]), createProduct);
router.put('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), updateProduct);
router.delete('/:id', requireAuth, requireRole([Role.Administrator, Role.Accountant]), deleteProduct);

export default router;
