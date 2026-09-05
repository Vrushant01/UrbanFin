import { Request, Response, NextFunction } from 'express';
import { PurchaseOrder, IPurchaseOrder } from '../models/PurchaseOrder.js';
import { VendorBill } from '../models/VendorBill.js';
import { Account } from '../models/Account.js';
import { PurchaseOrderStatus, AccountType, VendorBillStatus } from '../types/index.js';
import { getNextPONumber, getNextBillNumber } from '../services/sequenceService.js';
import { cache } from '../utils/cache.js';

export const getPurchaseOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status } = req.query;
    const cacheKey = `purchase_orders:list:${search || ''}:${status || ''}`;

    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const filter: any = {};
    if (status) filter.status = status;
    if (search && typeof search === 'string' && search.trim()) {
      filter.$or = [
        { number: { $regex: search.trim(), $options: 'i' } },
        { paymentTerms: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pos = await PurchaseOrder.find(filter).sort({ createdAt: -1 });
    const formatted = pos.map((p) => p.toJSON());

    cache.set(cacheKey, formatted, 30);
    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found' });
      return;
    }
    res.status(200).json(po.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, date, paymentTerms, lines, status } = req.body;

    if (!vendorId) {
      res.status(400).json({ message: 'Vendor is required' });
      return;
    }

    if (!date) {
      res.status(400).json({ message: 'Order date is required' });
      return;
    }

    const number = await getNextPONumber();

    const newPO = await PurchaseOrder.create({
      number,
      vendorId,
      date,
      paymentTerms: paymentTerms || 'Immediate Payment',
      status: status || PurchaseOrderStatus.Draft,
      lines: lines || [],
    });

    cache.invalidate('purchase_orders:');
    cache.invalidate('dashboard:');

    res.status(201).json(newPO.toJSON());
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { vendorId, date, paymentTerms, lines, status } = req.body;

    const po = await PurchaseOrder.findById(id);
    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found' });
      return;
    }

    if (vendorId !== undefined) po.vendorId = vendorId;
    if (date !== undefined) po.date = date;
    if (paymentTerms !== undefined) po.paymentTerms = paymentTerms;
    if (lines !== undefined) po.lines = lines;
    if (status !== undefined) po.status = status;

    await po.save();
    cache.invalidate('purchase_orders:');
    cache.invalidate('dashboard:');

    res.status(200).json(po.toJSON());
  } catch (error) {
    next(error);
  }
};

export const confirmPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found' });
      return;
    }

    po.status = PurchaseOrderStatus.Confirmed;
    await po.save();

    cache.invalidate('purchase_orders:');
    cache.invalidate('dashboard:');

    res.status(200).json(po.toJSON());
  } catch (error) {
    next(error);
  }
};

export const cancelPurchaseOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found' });
      return;
    }

    po.status = PurchaseOrderStatus.Cancelled;
    await po.save();

    cache.invalidate('purchase_orders:');
    cache.invalidate('dashboard:');

    res.status(200).json(po.toJSON());
  } catch (error) {
    next(error);
  }
};

export const createBillFromPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findById(id);
    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found' });
      return;
    }

    // Lookup default purchase expense account
    const purchaseExpenseAcc =
      (await Account.findOne({ type: AccountType.Expenses })) ||
      (await Account.findOne({ name: { $regex: /purchase/i } }));

    const defaultAccId = purchaseExpenseAcc?._id.toString() || 'a7';

    const billNumber = await getNextBillNumber();

    const newBill = await VendorBill.create({
      number: billNumber,
      vendorId: po.vendorId,
      billReference: po.number,
      billDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      poReferenceId: po._id.toString(),
      status: VendorBillStatus.Draft,
      lines: (po.lines || []).map((line) => ({
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

    cache.invalidate('vendor_bills:');
    cache.invalidate('dashboard:');

    res.status(201).json(newBill.toJSON());
  } catch (error) {
    next(error);
  }
};
