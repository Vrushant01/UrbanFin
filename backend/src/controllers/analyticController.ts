import { Request, Response, NextFunction } from 'express';
import { AnalyticAccount, IAnalyticAccount } from '../models/AnalyticAccount.js';
import { AnalyticAccountType } from '../types/index.js';
import { cache } from '../utils/cache.js';

const CACHE_KEY = 'analytics:list';

export const getAnalyticAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search } = req.query;
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const cacheKey = `${CACHE_KEY}:${search || ''}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (hasSearch) {
      filter.name = { $regex: (search as string).trim(), $options: 'i' };
    }

    const analytics = await AnalyticAccount.find(filter).sort({ name: 1 });
    const formatted = analytics.map((a) => a.toJSON());

    cache.set(cacheKey, formatted, 60);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getAnalyticAccountById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const analytic = await AnalyticAccount.findById(id);
    if (!analytic) {
      res.status(404).json({ message: 'Analytic account not found' });
      return;
    }
    res.status(200).json(analytic.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createAnalyticAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Analytic account name is required' });
      return;
    }

    if (!type || !Object.values(AnalyticAccountType).includes(type)) {
      res.status(400).json({ message: 'Valid analytic account type is required (Income/Expenses)' });
      return;
    }

    const newAnalytic = await AnalyticAccount.create({
      name: name.trim(),
      type,
    });

    cache.invalidate('analytics:');
    res.status(201).json(newAnalytic.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateAnalyticAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    const analytic = await AnalyticAccount.findById(id);
    if (!analytic) {
      res.status(404).json({ message: 'Analytic account not found' });
      return;
    }

    if (name !== undefined) analytic.name = name.trim();
    if (type !== undefined && Object.values(AnalyticAccountType).includes(type)) analytic.type = type;

    await analytic.save();
    cache.invalidate('analytics:');
    res.status(200).json(analytic.toJSON());
  } catch (error) {
    next(error);
  }
};

export const deleteAnalyticAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const analytic = await AnalyticAccount.findByIdAndDelete(id);
    if (!analytic) {
      res.status(404).json({ message: 'Analytic account not found' });
      return;
    }

    cache.invalidate('analytics:');
    res.status(200).json({ success: true, message: 'Analytic account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

