import { Request, Response, NextFunction } from 'express';
import { Budget } from '../models/Budget.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { PaymentTerm } from '../models/PaymentTerm.js';
import { PurchaseOrderStatus, SalesOrderStatus } from '../types/index.js';
import { updateBudgetLiveAchieved } from '../services/budgetService.js';
import { cache } from '../utils/cache.js';

const DASHBOARD_CACHE_KEY = 'dashboard:summary';

export const getDashboardSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cached = cache.get<any>(DASHBOARD_CACHE_KEY);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    // 1. Budget Stats
    const budgets = await Budget.find();
    let committed = 0;
    let achieved = 0;

    for (const b of budgets) {
      const updated = await updateBudgetLiveAchieved(b);
      (updated.lines || []).forEach((l) => {
        committed += Number(l.committedAmount) || 0;
        achieved += Number(l.achievedAmount) || 0;
      });
    }

    // 2. Purchase Stats
    const pos = await PurchaseOrder.find();
    const confirmedPoCount = pos.filter((p) => p.status === PurchaseOrderStatus.Confirmed).length;
    const draftPoCount = pos.filter((p) => p.status === PurchaseOrderStatus.Draft).length;

    // 3. Sales Stats
    const sos = await SalesOrder.find();
    const confirmedSoCount = sos.filter((s) => s.status === SalesOrderStatus.Confirmed).length;
    const draftSoCount = sos.filter((s) => s.status === SalesOrderStatus.Draft).length;

    const summary = {
      budgetStats: {
        achieved: Math.round(achieved),
        budget: budgets.length,
        committed: Math.round(committed),
      },
      purchaseStats: {
        all: pos.length,
        confirmed: confirmedPoCount,
        draft: draftPoCount,
      },
      salesStats: {
        all: sos.length,
        confirmed: confirmedSoCount,
        draft: draftSoCount,
      },
    };

    cache.set(DASHBOARD_CACHE_KEY, summary, 30);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const getPaymentTerms = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const defaultTerms = ['Immediate Payment', '15 Days', '30 Days', '45 Days'];
    const termsInDb = await PaymentTerm.find();

    const result = termsInDb.length > 0 ? termsInDb.map((t) => t.name) : defaultTerms;
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const addPaymentTerm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Payment term name is required' });
      return;
    }

    let term = await PaymentTerm.findOne({ name: name.trim() });
    if (!term) {
      term = await PaymentTerm.create({ name: name.trim() });
    }

    res.status(201).json(term.toJSON());
  } catch (error) {
    next(error);
  }
};
