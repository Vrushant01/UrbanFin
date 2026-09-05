import { Request, Response, NextFunction } from 'express';
import { Budget, IBudget } from '../models/Budget.js';
import { BudgetStatus } from '../types/index.js';
import {
  updateBudgetLiveAchieved,
  reviseBudget,
  getMatchingBudgetTransactions,
} from '../services/budgetService.js';
import { cache } from '../utils/cache.js';

export const getBudgets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status } = req.query;
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const limit = hasSearch ? 500 : (Number(req.query.limit) || 120);
    const cacheKey = `budgets:list:${search || ''}:${status || ''}:${limit}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;
    if (hasSearch) {
      filter.name = { $regex: (search as string).trim(), $options: 'i' };
    }

    const rawBudgets = await Budget.find(filter).sort({ createdAt: -1 }).limit(limit);

    // Update live achieved calculations for confirmed budgets
    const budgets = await Promise.all(
      rawBudgets.map(async (b) => {
        const updated = await updateBudgetLiveAchieved(b);
        return updated.toJSON();
      })
    );

    cache.set(cacheKey, budgets, 30);
    res.status(200).json(budgets);
  } catch (error) {
    next(error);
  }
};

export const getBudgetById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const budget = await Budget.findById(id);
    if (!budget) {
      res.status(404).json({ message: 'Budget not found' });
      return;
    }

    const updated = await updateBudgetLiveAchieved(budget);
    res.status(200).json(updated.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, startDate, endDate, responsibleId, lines, status } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Budget name is required' });
      return;
    }

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'Start date and End date are required' });
      return;
    }

    if (!responsibleId) {
      res.status(400).json({ message: 'Responsible person is required' });
      return;
    }

    const newBudget = await Budget.create({
      name: name.trim(),
      startDate,
      endDate,
      responsibleId,
      status: status || BudgetStatus.Draft,
      lines: lines || [],
    });

    if (newBudget.status === BudgetStatus.Confirmed) {
      await updateBudgetLiveAchieved(newBudget);
    }

    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(201).json(newBudget.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, responsibleId, lines, status } = req.body;

    const budget = await Budget.findById(id);
    if (!budget) {
      res.status(404).json({ message: 'Budget not found' });
      return;
    }

    if (name !== undefined) budget.name = name.trim();
    if (startDate !== undefined) budget.startDate = startDate;
    if (endDate !== undefined) budget.endDate = endDate;
    if (responsibleId !== undefined) budget.responsibleId = responsibleId;
    if (lines !== undefined) budget.lines = lines;
    if (status !== undefined) budget.status = status;

    if (budget.status === BudgetStatus.Confirmed) {
      await updateBudgetLiveAchieved(budget);
    } else {
      await budget.save();
    }

    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(budget.toJSON());
  } catch (error) {
    next(error);
  }
};

export const confirmBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const budget = await Budget.findById(id);
    if (!budget) {
      res.status(404).json({ message: 'Budget not found' });
      return;
    }

    budget.status = BudgetStatus.Confirmed;
    await updateBudgetLiveAchieved(budget);

    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(budget.toJSON());
  } catch (error) {
    next(error);
  }
};

export const reviseBudgetHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await reviseBudget(id as string);
    res.status(201).json({
      original: result.original.toJSON(),
      revised: result.revised.toJSON(),
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to revise budget' });
  }
};

export const cancelBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const budget = await Budget.findById(id);
    if (!budget) {
      res.status(404).json({ message: 'Budget not found' });
      return;
    }

    budget.status = BudgetStatus.Cancelled;
    await budget.save();

    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(budget.toJSON());
  } catch (error) {
    next(error);
  }
};

export const deleteBudget = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const budget = await Budget.findByIdAndDelete(id);
    if (!budget) {
      res.status(404).json({ message: 'Budget not found' });
      return;
    }

    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json({ success: true, message: 'Budget deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getMatchingTransactionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { analyticAccountId, startDate, endDate } = req.query;

    if (!analyticAccountId || !startDate || !endDate) {
      res.status(400).json({ message: 'analyticAccountId, startDate, and endDate query params required' });
      return;
    }

    const txs = await getMatchingBudgetTransactions(
      analyticAccountId as string,
      startDate as string,
      endDate as string
    );

    res.status(200).json(txs);
  } catch (error) {
    next(error);
  }
};

