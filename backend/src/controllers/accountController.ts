import { Request, Response, NextFunction } from 'express';
import { Account, IAccount } from '../models/Account.js';
import { AccountType } from '../types/index.js';
import { cache } from '../utils/cache.js';

const CACHE_KEY = 'accounts:list';

export const getAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

    const accounts = await Account.find(filter).sort({ name: 1 });
    const formatted = accounts.map((a) => a.toJSON());

    cache.set(cacheKey, formatted, 60);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Account name is required' });
      return;
    }

    if (!type || !Object.values(AccountType).includes(type)) {
      res.status(400).json({ message: 'Valid account type is required' });
      return;
    }

    const newAccount = await Account.create({
      name: name.trim(),
      type,
    });

    cache.invalidate('accounts:');
    cache.invalidate('reports:');

    res.status(201).json(newAccount.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    const account = await Account.findById(id);
    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    if (name !== undefined) account.name = name.trim();
    if (type !== undefined && Object.values(AccountType).includes(type)) account.type = type;

    await account.save();
    cache.invalidate('accounts:');
    cache.invalidate('reports:');

    res.status(200).json(account.toJSON());
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const account = await Account.findByIdAndDelete(id);
    if (!account) {
      res.status(404).json({ message: 'Account not found' });
      return;
    }

    cache.invalidate('accounts:');
    cache.invalidate('reports:');

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};


