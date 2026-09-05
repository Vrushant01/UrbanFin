import { Request, Response, NextFunction } from 'express';
import { Account, IAccount } from '../models/Account.js';
import { AccountType } from '../types/index.js';
import { cache } from '../utils/cache.js';

const CACHE_KEY = 'accounts:list';

export const getAccounts = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cached = cache.get<any[]>(CACHE_KEY);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const accounts = await Account.find().sort({ name: 1 });
    const formatted = accounts.map((a) => a.toJSON());

    cache.set(CACHE_KEY, formatted, 60);
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
