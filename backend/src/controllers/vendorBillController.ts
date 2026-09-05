import { Request, Response, NextFunction } from 'express';
import { VendorBill, IVendorBill } from '../models/VendorBill.js';
import { Journal } from '../models/Journal.js';
import { Account } from '../models/Account.js';
import { Contact } from '../models/Contact.js';
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
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const limit = hasSearch ? 500 : (Number(req.query.limit) || 120);
    const cacheKey = `vendor_bills:list:${search || ''}:${status || ''}:${vendorId || ''}:${limit}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;
    if (vendorId) filter.vendorId = vendorId;
    if (hasSearch) {
      const term = (search as string).trim();
      const matchingVendors = await Contact.find({
        name: { $regex: term, $options: 'i' },
      });
      const vendorIds = matchingVendors.map((v) => v._id.toString());

      filter.$or = [
        { number: { $regex: term, $options: 'i' } },
        { billReference: { $regex: term, $options: 'i' } },
        { status: { $regex: term, $options: 'i' } },
        { vendorId: { $in: vendorIds } },
      ];
    }

    const bills = await VendorBill.find(filter).sort({ createdAt: -1 }).limit(limit);
    const vendorIds = Array.from(new Set(bills.map((b) => b.vendorId).filter(Boolean)));
    const contacts = vendorIds.length > 0 ? await Contact.find({ _id: { $in: vendorIds } }).lean() : [];
    const contactMap = new Map(contacts.map((c) => [c._id.toString(), c]));

    const formatted = bills.map((b) => {
      const json: any = b.toJSON();
      const vend = contactMap.get(b.vendorId);
      json.vendorName = vend?.name || 'Vendor';
      json.vendorEmail = vend?.email || '';
      json.vendorPhone = vend?.phone || '';
      return json;
    });

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
    const json: any = bill.toJSON();
    if (bill.vendorId) {
      const vend = await Contact.findById(bill.vendorId).lean();
      if (vend) {
        json.vendorName = vend.name;
        json.vendorEmail = vend.email;
        json.vendorPhone = vend.phone;
      }
    }
    res.status(200).json(json);
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
