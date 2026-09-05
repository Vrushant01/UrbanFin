import { Request, Response, NextFunction } from 'express';
import { VendorBill, IVendorBill } from '../models/VendorBill.js';
import { Journal } from '../models/Journal.js';
import { Account } from '../models/Account.js';
import {
  VendorBillStatus,
  JournalType,
  AccountType,
  JournalEntryStatus,
} from '../types/index.js';
import { getNextBillNumber } from '../services/sequenceService.js';
import { createJournalEntry } from '../services/journalEntryService.js';
import { cache } from '../utils/cache.js';

export const getVendorBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status, vendorId } = req.query;
    const cacheKey = `vendor_bills:list:${search || ''}:${status || ''}:${vendorId || ''}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;
    if (vendorId) filter.vendorId = vendorId;
    if (search && typeof search === 'string' && search.trim()) {
      filter.$or = [
        { number: { $regex: search.trim(), $options: 'i' } },
        { billReference: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const bills = await VendorBill.find(filter).sort({ createdAt: -1 });
    const formatted = bills.map((b) => b.toJSON());

    cache.set(cacheKey, formatted, 30);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getVendorBillById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const bill = await VendorBill.findById(id);
    if (!bill) {
      res.status(404).json({ message: 'Vendor Bill not found' });
      return;
    }
    res.status(200).json(bill.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createVendorBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, billReference, billDate, dueDate, poReferenceId, lines, status } = req.body;

    if (!vendorId) {
      res.status(400).json({ message: 'Vendor is required' });
      return;
    }

    if (!billDate || !dueDate) {
      res.status(400).json({ message: 'Bill date and Due date are required' });
      return;
    }

    const number = await getNextBillNumber();

    const newBill = await VendorBill.create({
      number,
      vendorId,
      billReference: billReference || '',
      billDate,
      dueDate,
      poReferenceId: poReferenceId || undefined,
      status: status || VendorBillStatus.Draft,
      lines: lines || [],
      amountPaid: 0,
      cashPaid: 0,
      bankPaid: 0,
    });

    if (newBill.status === VendorBillStatus.Confirmed) {
      await autoPostBillJournalEntry(newBill);
    }

    cache.invalidate('vendor_bills:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(201).json(newBill.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateVendorBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { vendorId, billReference, billDate, dueDate, poReferenceId, lines, status } = req.body;

    const bill = await VendorBill.findById(id);
    if (!bill) {
      res.status(404).json({ message: 'Vendor Bill not found' });
      return;
    }

    const previousStatus = bill.status;

    if (vendorId !== undefined) bill.vendorId = vendorId;
    if (billReference !== undefined) bill.billReference = billReference;
    if (billDate !== undefined) bill.billDate = billDate;
    if (dueDate !== undefined) bill.dueDate = dueDate;
    if (poReferenceId !== undefined) bill.poReferenceId = poReferenceId;
    if (lines !== undefined) bill.lines = lines;
    if (status !== undefined) bill.status = status;

    await bill.save();

    // Cross-module trigger: If transitioning from Draft to Confirmed, auto-post Journal Entry
    if (previousStatus === VendorBillStatus.Draft && bill.status === VendorBillStatus.Confirmed) {
      await autoPostBillJournalEntry(bill);
    }

    cache.invalidate('vendor_bills:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(bill.toJSON());
  } catch (error) {
    next(error);
  }
};

export const confirmVendorBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const bill = await VendorBill.findById(id);
    if (!bill) {
      res.status(404).json({ message: 'Vendor Bill not found' });
      return;
    }

    if (bill.status !== VendorBillStatus.Draft) {
      res.status(200).json(bill.toJSON());
      return;
    }

    bill.status = VendorBillStatus.Confirmed;
    await bill.save();

    await autoPostBillJournalEntry(bill);

    cache.invalidate('vendor_bills:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(bill.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Auto-posts double-entry ledger entry for confirmed Vendor Bill:
 * Debit: Purchase Expense A/c (total)
 * Credit: Creditors A/c (total)
 */
export const autoPostBillJournalEntry = async (bill: IVendorBill): Promise<void> => {
  const total = (bill.lines || []).reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
    0
  );

  if (total <= 0) return;

  const purchaseJournal = await Journal.findOne({ type: JournalType.Purchase });
  const purchaseAcc = await Account.findOne({ type: AccountType.Expenses });
  const credAcc = await Account.findOne({ type: AccountType.Liability });

  if (purchaseJournal && purchaseAcc && credAcc) {
    await createJournalEntry({
      date: bill.billDate,
      journalId: purchaseJournal._id.toString(),
      partnerId: bill.vendorId,
      number: bill.number,
      status: JournalEntryStatus.Posted,
      sourceDocument: {
        model: 'VendorBill',
        id: bill._id.toString(),
      },
      lines: [
        {
          accountId: purchaseAcc._id.toString(),
          partnerId: bill.vendorId,
          debit: total,
          credit: 0,
        },
        {
          accountId: credAcc._id.toString(),
          partnerId: bill.vendorId,
          debit: 0,
          credit: total,
        },
      ],
    });
  }
};
