import { Request, Response, NextFunction } from 'express';
import { CustomerInvoice, ICustomerInvoice } from '../models/CustomerInvoice.js';
import { Journal } from '../models/Journal.js';
import { Account } from '../models/Account.js';
import {
  CustomerInvoiceStatus,
  JournalType,
  AccountType,
  JournalEntryStatus,
} from '../types/index.js';
import { getNextInvoiceNumber } from '../services/sequenceService.js';
import { createJournalEntry } from '../services/journalEntryService.js';
import { cache } from '../utils/cache.js';

export const getCustomerInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status, customerId } = req.query;
    const cacheKey = `customer_invoices:list:${search || ''}:${status || ''}:${customerId || ''}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (search && typeof search === 'string' && search.trim()) {
      filter.$or = [
        { number: { $regex: search.trim(), $options: 'i' } },
        { invoiceReference: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const invoices = await CustomerInvoice.find(filter).sort({ createdAt: -1 });
    const formatted = invoices.map((inv) => inv.toJSON());

    cache.set(cacheKey, formatted, 30);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getCustomerInvoiceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Customer Invoice not found' });
      return;
    }
    res.status(200).json(invoice.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createCustomerInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, invoiceReference, invoiceDate, dueDate, soReferenceId, lines, status } = req.body;

    if (!customerId) {
      res.status(400).json({ message: 'Customer is required' });
      return;
    }

    if (!invoiceDate || !dueDate) {
      res.status(400).json({ message: 'Invoice date and Due date are required' });
      return;
    }

    const number = await getNextInvoiceNumber();

    const newInvoice = await CustomerInvoice.create({
      number,
      customerId,
      invoiceReference: invoiceReference || '',
      invoiceDate,
      dueDate,
      soReferenceId: soReferenceId || undefined,
      status: status || CustomerInvoiceStatus.Draft,
      lines: lines || [],
      amountPaid: 0,
      cashPaid: 0,
      bankPaid: 0,
    });

    if (newInvoice.status === CustomerInvoiceStatus.Confirmed) {
      await autoPostInvoiceJournalEntry(newInvoice);
    }

    cache.invalidate('customer_invoices:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(201).json(newInvoice.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateCustomerInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { customerId, invoiceReference, invoiceDate, dueDate, soReferenceId, lines, status } = req.body;

    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Customer Invoice not found' });
      return;
    }

    const previousStatus = invoice.status;

    if (customerId !== undefined) invoice.customerId = customerId;
    if (invoiceReference !== undefined) invoice.invoiceReference = invoiceReference;
    if (invoiceDate !== undefined) invoice.invoiceDate = invoiceDate;
    if (dueDate !== undefined) invoice.dueDate = dueDate;
    if (soReferenceId !== undefined) invoice.soReferenceId = soReferenceId;
    if (lines !== undefined) invoice.lines = lines;
    if (status !== undefined) invoice.status = status;

    await invoice.save();

    // Cross-module trigger: If transitioning from Draft to Confirmed, auto-post Journal Entry
    if (previousStatus === CustomerInvoiceStatus.Draft && invoice.status === CustomerInvoiceStatus.Confirmed) {
      await autoPostInvoiceJournalEntry(invoice);
    }

    cache.invalidate('customer_invoices:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(invoice.toJSON());
  } catch (error) {
    next(error);
  }
};

export const confirmCustomerInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Customer Invoice not found' });
      return;
    }

    if (invoice.status !== CustomerInvoiceStatus.Draft) {
      res.status(200).json(invoice.toJSON());
      return;
    }

    invoice.status = CustomerInvoiceStatus.Confirmed;
    await invoice.save();

    await autoPostInvoiceJournalEntry(invoice);

    cache.invalidate('customer_invoices:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    res.status(200).json(invoice.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Auto-posts double-entry ledger entry for confirmed Customer Invoice:
 * Debit: Debtors A/c (total)
 * Credit: Sales Income A/c (total)
 */
export const autoPostInvoiceJournalEntry = async (invoice: ICustomerInvoice): Promise<void> => {
  const total = (invoice.lines || []).reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
    0
  );

  if (total <= 0) return;

  const salesJournal = await Journal.findOne({ type: JournalType.Sales });
  const salesAcc = await Account.findOne({ type: AccountType.Income });
  const debAcc =
    (await Account.findOne({ type: AccountType.Asset, name: { $regex: /debtor/i } })) ||
    (await Account.findOne({ type: AccountType.Asset }));

  if (salesJournal && salesAcc && debAcc) {
    await createJournalEntry({
      date: invoice.invoiceDate,
      journalId: salesJournal._id.toString(),
      partnerId: invoice.customerId,
      number: invoice.number,
      status: JournalEntryStatus.Posted,
      sourceDocument: {
        model: 'CustomerInvoice',
        id: invoice._id.toString(),
      },
      lines: [
        {
          accountId: debAcc._id.toString(),
          partnerId: invoice.customerId,
          debit: total,
          credit: 0,
        },
        {
          accountId: salesAcc._id.toString(),
          partnerId: invoice.customerId,
          debit: 0,
          credit: total,
        },
      ],
    });
  }
};
