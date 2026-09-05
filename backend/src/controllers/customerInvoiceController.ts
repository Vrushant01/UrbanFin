import { Request, Response, NextFunction } from 'express';
import { CustomerInvoice, ICustomerInvoice } from '../models/CustomerInvoice.js';
import { Journal } from '../models/Journal.js';
import { Account } from '../models/Account.js';
import { Contact } from '../models/Contact.js';
import {
  CustomerInvoiceStatus,
  JournalType,
  AccountType,
  JournalEntryStatus,
  Role,
} from '../types/index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getNextInvoiceNumber } from '../services/sequenceService.js';
import { createJournalEntry } from '../services/journalEntryService.js';
import { cache } from '../utils/cache.js';

export const getCustomerInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userRole = authReq.user?.role;
    const userId = authReq.user?.id || 'anonymous';
    const { search, status, customerId } = req.query;
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const limit = hasSearch ? 500 : (Number(req.query.limit) || 120);
    const cacheKey = `customer_invoices:list:${userId}:${userRole || ''}:${search || ''}:${status || ''}:${customerId || ''}:${limit}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;

    // Strict customer isolation for standard user role
    if (userRole === Role.User) {
      let contactId = authReq.user?.contactId;
      if (!contactId && authReq.user) {
        const userEmail = authReq.user.email?.toLowerCase();
        const userName = authReq.user.name;
        const contact = await Contact.findOne({
          $or: [
            ...(userEmail ? [{ email: new RegExp(`^${userEmail}$`, 'i') }] : []),
            ...(userName ? [{ name: new RegExp(`^${userName}$`, 'i') }] : []),
          ],
        });
        if (contact) {
          contactId = contact._id.toString();
        }
      }

      if (!contactId) {
        res.status(200).json([]);
        return;
      }
      filter.customerId = contactId;
    } else if (customerId) {
      filter.customerId = customerId;
    }

    if (hasSearch) {
      const term = (search as string).trim();
      const matchingCustomers = await Contact.find({
        name: { $regex: term, $options: 'i' },
      });
      const customerIds = matchingCustomers.map((c) => c._id.toString());

      filter.$or = [
        { number: { $regex: term, $options: 'i' } },
        { invoiceReference: { $regex: term, $options: 'i' } },
        { status: { $regex: term, $options: 'i' } },
        { customerId: { $in: customerIds } },
      ];
    }

    const invoices = await CustomerInvoice.find(filter).sort({ createdAt: -1 }).limit(limit);
    const customerIds = Array.from(new Set(invoices.map((inv) => inv.customerId).filter(Boolean)));
    const contacts = customerIds.length > 0 ? await Contact.find({ _id: { $in: customerIds } }).lean() : [];
    const contactMap = new Map(contacts.map((c) => [c._id.toString(), c]));

    const formatted = invoices.map((inv) => {
      const json: any = inv.toJSON();
      const cust = contactMap.get(inv.customerId);
      json.customerName = cust?.name || 'Customer';
      json.customerEmail = cust?.email || '';
      json.customerPhone = cust?.phone || '';
      return json;
    });

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
    const json: any = invoice.toJSON();
    if (invoice.customerId) {
      const cust = await Contact.findById(invoice.customerId).lean();
      if (cust) {
        json.customerName = cust.name;
        json.customerEmail = cust.email;
        json.customerPhone = cust.phone;
      }
    }
    res.status(200).json(json);
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

    const defaultIncomeAcc =
      (await Account.findOne({ type: AccountType.Income })) ||
      (await Account.findOne({ name: { $regex: /sales|revenue|income/i } })) ||
      (await Account.findOne());

    const processedLines = (lines || []).map((l: any) => ({
      productId: l.productId,
      accountId: l.accountId || defaultIncomeAcc?._id.toString() || 'default_income_acc',
      analyticAccountId: l.analyticAccountId || undefined,
      qty: Number(l.qty) || 1,
      unitPrice: Number(l.unitPrice) || 0,
    }));

    const number = await getNextInvoiceNumber();

    const newInvoice = await CustomerInvoice.create({
      number,
      customerId,
      invoiceReference: invoiceReference || '',
      invoiceDate,
      dueDate,
      soReferenceId: soReferenceId || undefined,
      status: status || CustomerInvoiceStatus.Draft,
      lines: processedLines,
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

    const json: any = newInvoice.toJSON();
    const cust = await Contact.findById(customerId).lean();
    if (cust) {
      json.customerName = cust.name;
      json.customerEmail = cust.email;
      json.customerPhone = cust.phone;
    }

    res.status(201).json(json);
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

export const requestCustomerPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Customer Invoice not found' });
      return;
    }

    invoice.paymentRequested = true;
    invoice.paymentRequestedAt = new Date().toISOString();

    // Auto-confirm Draft invoices when payment is requested, so customer can see & pay them
    if (invoice.status === CustomerInvoiceStatus.Draft) {
      invoice.status = CustomerInvoiceStatus.Confirmed;
      await invoice.save();
      await autoPostInvoiceJournalEntry(invoice);
    } else {
      await invoice.save();
    }

    cache.invalidate('customer_invoices:');
    cache.invalidate('budgets:');
    cache.invalidate('dashboard:');

    const cust = await Contact.findById(invoice.customerId).lean();

    res.status(200).json({
      success: true,
      message: `Payment request sent successfully to ${cust?.name || 'Customer'} (${cust?.email || ''})`,
      invoice: invoice.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};
