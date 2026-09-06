import { Request, Response, NextFunction } from 'express';
import { JournalEntry, IJournalEntry } from '../models/JournalEntry.js';
import { Journal } from '../models/Journal.js';
import { Contact } from '../models/Contact.js';
import { JournalEntryStatus } from '../types/index.js';
import {
  createJournalEntry,
  validateJournalEntryBalance,
} from '../services/journalEntryService.js';
import { getNextJournalEntryNumber } from '../services/sequenceService.js';
import { cache } from '../utils/cache.js';

export const getJournalEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, journalId, status } = req.query;
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const limit = hasSearch ? 500 : (Number(req.query.limit) || 120);
    const cacheKey = `journal_entries:list:${search || ''}:${journalId || ''}:${status || ''}:${limit}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (journalId) filter.journalId = journalId;
    if (status) filter.status = status;

    if (hasSearch) {
      const term = (search as string).trim();
      const matchingJournals = await Journal.find({ name: { $regex: term, $options: 'i' } });
      const jIds = matchingJournals.map(j => j._id.toString());
      const matchingPartners = await Contact.find({ name: { $regex: term, $options: 'i' } });
      const pIds = matchingPartners.map(p => p._id.toString());

      filter.$or = [
        { number: { $regex: term, $options: 'i' } },
        { date: { $regex: term, $options: 'i' } },
        { status: { $regex: term, $options: 'i' } },
        { journalId: { $in: jIds } },
        { partnerId: { $in: pIds } },
      ];
    }

    const entries = await JournalEntry.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit);
    const formatted = entries.map((e) => e.toJSON());

    cache.set(cacheKey, formatted, 30);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getJournalEntryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const entry = await JournalEntry.findById(id);
    if (!entry) {
      res.status(404).json({ message: 'Journal entry not found' });
      return;
    }
    const json: any = entry.toJSON();

    // Enrich with partner name
    if (entry.partnerId) {
      const partner = await Contact.findById(entry.partnerId).lean();
      if (partner) {
        json.partnerName = partner.name;
      }
    }

    // Enrich with journal name
    if (entry.journalId) {
      const journal = await Journal.findById(entry.journalId).lean();
      if (journal) {
        json.journalName = journal.name;
      }
    }

    // Enrich with source document label
    if (entry.sourceDocument?.model && entry.sourceDocument?.id) {
      try {
        if (entry.sourceDocument.model === 'CustomerInvoice') {
          const { CustomerInvoice } = await import('../models/CustomerInvoice.js');
          const inv = await CustomerInvoice.findById(entry.sourceDocument.id).lean() as any;
          if (inv) {
            json.sourceLabel = `Customer Invoice ${inv.number}`;
            json.sourceNumber = inv.number;
          }
        } else if (entry.sourceDocument.model === 'VendorBill') {
          const { VendorBill } = await import('../models/VendorBill.js');
          const bill = await VendorBill.findById(entry.sourceDocument.id).lean() as any;
          if (bill) {
            json.sourceLabel = `Vendor Bill ${bill.number}`;
            json.sourceNumber = bill.number;
          }
        } else if (entry.sourceDocument.model === 'Payment') {
          const { Payment } = await import('../models/Payment.js');
          const pay = await Payment.findById(entry.sourceDocument.id).lean() as any;
          if (pay) {
            json.sourceLabel = `Payment (${pay.type}) — ${pay.via} — Rs. ${pay.amount}`;
          }
        }
      } catch (sourceErr) {
        console.warn('[JournalEntry] Could not enrich source document:', sourceErr);
      }
    }

    res.status(200).json(json);
  } catch (error) {
    next(error);
  }
};

export const createJournalEntryHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { date, journalId, partnerId, status, lines, number, sourceDocument } = req.body;

    if (!date) {
      res.status(400).json({ message: 'Date is required' });
      return;
    }

    if (!journalId) {
      res.status(400).json({ message: 'Journal is required' });
      return;
    }

    const entry = await createJournalEntry({
      date,
      journalId,
      partnerId,
      status: status || JournalEntryStatus.Draft,
      lines: lines || [],
      number,
      sourceDocument,
    });

    res.status(201).json(entry.toJSON());
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to create journal entry' });
  }
};

export const updateJournalEntryHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { date, journalId, partnerId, status, lines } = req.body;

    const entry = await JournalEntry.findById(id);
    if (!entry) {
      res.status(404).json({ message: 'Journal entry not found' });
      return;
    }

    if (date !== undefined) entry.date = date;
    if (journalId !== undefined) entry.journalId = journalId;
    if (partnerId !== undefined) entry.partnerId = partnerId;
    if (lines !== undefined) entry.lines = lines;

    const balanceCheck = validateJournalEntryBalance(entry.lines);
    entry.total = balanceCheck.totalDebit;

    if (status === JournalEntryStatus.Posted) {
      if (!balanceCheck.isBalanced) {
        res.status(400).json({ message: balanceCheck.error });
        return;
      }
      entry.status = JournalEntryStatus.Posted;
    } else if (status !== undefined) {
      entry.status = status;
    }

    await entry.save();
    cache.invalidate('journal_entries:');
    cache.invalidate('reports:');
    cache.invalidate('dashboard:');

    res.status(200).json(entry.toJSON());
  } catch (error) {
    next(error);
  }
};

export const postJournalEntryHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const entry = await JournalEntry.findById(id);
    if (!entry) {
      res.status(404).json({ message: 'Journal entry not found' });
      return;
    }

    const balanceCheck = validateJournalEntryBalance(entry.lines);
    if (!balanceCheck.isBalanced) {
      res.status(400).json({
        message: balanceCheck.error || 'Journal entry must be balanced before posting.',
      });
      return;
    }

    entry.status = JournalEntryStatus.Posted;
    entry.total = balanceCheck.totalDebit;

    if (!entry.number || entry.number.trim() === '') {
      entry.number = await getNextJournalEntryNumber();
    }

    await entry.save();
    cache.invalidate('journal_entries:');
    cache.invalidate('reports:');
    cache.invalidate('dashboard:');

    res.status(200).json(entry.toJSON());
  } catch (error) {
    next(error);
  }
};

export const resetJournalEntryToDraftHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const entry = await JournalEntry.findById(id);
    if (!entry) {
      res.status(404).json({ message: 'Journal entry not found' });
      return;
    }

    entry.status = JournalEntryStatus.Draft;
    await entry.save();

    cache.invalidate('journal_entries:');
    cache.invalidate('reports:');
    cache.invalidate('dashboard:');

    res.status(200).json(entry.toJSON());
  } catch (error) {
    next(error);
  }
};

export const deleteJournalEntryHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const entry = await JournalEntry.findByIdAndDelete(id);
    if (!entry) {
      res.status(404).json({ message: 'Journal entry not found' });
      return;
    }

    cache.invalidate('journal_entries:');
    cache.invalidate('reports:');
    cache.invalidate('dashboard:');

    res.status(200).json({ success: true, message: 'Journal entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};

