import { Router } from 'express';
import {
  getProfitAndLoss,
  getBalanceSheet,
  getProfitAndLossPDF,
  getBalanceSheetPDF,
} from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Role } from '../types/index.js';

const router = Router();

router.get('/profit-loss', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getProfitAndLoss);
router.get('/profit-and-loss', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getProfitAndLoss);
router.get('/profit-loss/pdf', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getProfitAndLossPDF);
router.get('/profit-and-loss/pdf', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getProfitAndLossPDF);

router.get('/balance-sheet', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getBalanceSheet);
router.get('/balance-sheet/pdf', requireAuth, requireRole([Role.Administrator, Role.Accountant]), getBalanceSheetPDF);

export default router;
