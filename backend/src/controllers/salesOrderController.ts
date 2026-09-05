import { Request, Response, NextFunction } from 'express';
import { SalesOrder, ISalesOrder } from '../models/SalesOrder.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { Account } from '../models/Account.js';
import { Contact } from '../models/Contact.js';
import { SalesOrderStatus, AccountType, CustomerInvoiceStatus } from '../types/index.js';
import { getNextSONumber, getNextInvoiceNumber } from '../services/sequenceService.js';
import { cache } from '../utils/cache.js';

export const getSalesOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status } = req.query;
    const hasSearch = !!(search && typeof search === 'string' && search.trim());
    const limit = hasSearch ? 500 : (Number(req.query.limit) || 120);
    const cacheKey = `sales_orders:list:${search || ''}:${status || ''}:${limit}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;
    if (hasSearch) {
      const term = (search as string).trim();
      const matchingCustomers = await Contact.find({
        name: { $regex: term, $options: 'i' },
      });
      const customerIds = matchingCustomers.map((c) => c._id.toString());

      filter.$or = [
        { number: { $regex: term, $options: 'i' } },
        { status: { $regex: term, $options: 'i' } },
        { customerId: { $in: customerIds } },
      ];
    }

    const sos = await SalesOrder.find(filter).sort({ createdAt: -1 }).limit(limit);
    const customerIds = Array.from(new Set(sos.map((s) => s.customerId).filter(Boolean)));
    const contacts = customerIds.length > 0 ? await Contact.find({ _id: { $in: customerIds } }).lean() : [];
    const contactMap = new Map(contacts.map((c) => [c._id.toString(), c]));

    const formatted = sos.map((s) => {
      const json: any = s.toJSON();
      const cust = contactMap.get(s.customerId);
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

export const getSalesOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const so = await SalesOrder.findById(id);
    if (!so) {
      res.status(404).json({ message: 'Sales Order not found' });
      return;
    }
    const json: any = so.toJSON();
    if (so.customerId) {
      const cust = await Contact.findById(so.customerId).lean();
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

export const createSalesOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId, date, lines, status } = req.body;

    if (!customerId) {
      res.status(400).json({ message: 'Customer is required' });
      return;
    }

    if (!date) {
      res.status(400).json({ message: 'Order date is required' });
      return;
    }

    const number = await getNextSONumber();

    const newSO = await SalesOrder.create({
      number,
      customerId,
      date,
      status: status || SalesOrderStatus.Draft,
      lines: lines || [],
    });

    cache.invalidate('sales_orders:');
    cache.invalidate('dashboard:');

    res.status(201).json(newSO.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updateSalesOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { customerId, date, lines, status } = req.body;

    const so = await SalesOrder.findById(id);
    if (!so) {
      res.status(404).json({ message: 'Sales Order not found' });
      return;
    }

    if (customerId !== undefined) so.customerId = customerId;
    if (date !== undefined) so.date = date;
    if (lines !== undefined) so.lines = lines;
    if (status !== undefined) so.status = status;

    await so.save();
    cache.invalidate('sales_orders:');
    cache.invalidate('dashboard:');

    res.status(200).json(so.toJSON());
  } catch (error) {
    next(error);
  }
};

export const confirmSalesOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const so = await SalesOrder.findById(id);
    if (!so) {
      res.status(404).json({ message: 'Sales Order not found' });
      return;
    }

    so.status = SalesOrderStatus.Confirmed;
    await so.save();

    cache.invalidate('sales_orders:');
    cache.invalidate('dashboard:');

    res.status(200).json(so.toJSON());
  } catch (error) {
    next(error);
  }
};

export const cancelSalesOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const so = await SalesOrder.findById(id);
    if (!so) {
      res.status(404).json({ message: 'Sales Order not found' });
      return;
    }

    so.status = SalesOrderStatus.Cancelled;
    await so.save();

    cache.invalidate('sales_orders:');
    cache.invalidate('dashboard:');

    res.status(200).json(so.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createInvoiceFromSalesOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const so = await SalesOrder.findById(id);
    if (!so) {
      res.status(404).json({ message: 'Sales Order not found' });
      return;
    }

    // Lookup default sales income account
    const salesIncomeAcc =
      (await Account.findOne({ type: AccountType.Income })) ||
      (await Account.findOne({ name: { $regex: /sales/i } }));

    const defaultAccId = salesIncomeAcc?._id.toString() || 'a6';

    const invoiceNumber = await getNextInvoiceNumber();

    const newInvoice = await CustomerInvoice.create({
      number: invoiceNumber,
      customerId: so.customerId,
      invoiceReference: so.number,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      soReferenceId: so._id.toString(),
      status: CustomerInvoiceStatus.Draft,
      lines: (so.lines || []).map((line) => ({
        id: Math.random().toString(36).substr(2, 9),
        productId: line.productId,
        accountId: defaultAccId,
        analyticAccountId: line.analyticAccountId,
        qty: line.qty,
        unitPrice: line.unitPrice,
      })),
      amountPaid: 0,
      cashPaid: 0,
      bankPaid: 0,
    });

    cache.invalidate('customer_invoices:');
    cache.invalidate('dashboard:');

    res.status(201).json(newInvoice.toJSON());
  } catch (error) {
    next(error);
  }
};
