import { Request, Response, NextFunction } from 'express';
import { Journal, IJournal } from '../models/Journal.js';
import { JournalType } from '../types/index.js';
import { cache } from '../utils/cache.js';

const CACHE_KEY = 'journals:list';

export const getJournals = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cached = cache.get<any[]>(CACHE_KEY);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const journals = await Journal.find().sort({ name: 1 });
    const formatted = journals.map((j) => j.toJSON());

    cache.set(CACHE_KEY, formatted, 60);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getJournalById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const journal = await Journal.findById(id);
    if (!journal) {
      res.status(404).json({ message: 'Journal not found' });
      return;
    }
    res.status(200).json(journal.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createJournal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, type, defaultAccountId } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Journal name is required' });
      return;
    }

    if (!type || !Object.values(JournalType).includes(type)) {
      res.status(400).json({ message: 'Valid journal type is required' });
      return;
    }

    if (!defaultAccountId) {
      res.status(400).json({ message: 'Default account ID is required' });
      return;
    }

    const newJournal = await Journal.create({
      name: name.trim(),
      type,
      defaultAccountId,
    });

    cache.invalidate('journals:');
    res.status(201).json(newJournal.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateJournal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, defaultAccountId } = req.body;

    const journal = await Journal.findById(id);
    if (!journal) {
      res.status(404).json({ message: 'Journal not found' });
      return;
    }

    if (name !== undefined) journal.name = name.trim();
    if (type !== undefined && Object.values(JournalType).includes(type)) journal.type = type;
    if (defaultAccountId !== undefined) journal.defaultAccountId = defaultAccountId;

    await journal.save();
    cache.invalidate('journals:');
    res.status(200).json(journal.toJSON());
  } catch (error) {
    next(error);
  }
};

export const deleteJournal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const journal = await Journal.findByIdAndDelete(id);
    if (!journal) {
      res.status(404).json({ message: 'Journal not found' });
      return;
    }

    cache.invalidate('journals:');
    res.status(200).json({ success: true, message: 'Journal deleted successfully' });
  } catch (error) {
    next(error);
  }
};

