import mongoose from 'mongoose';
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { VendorProduct, IVendorProduct } from '../models/VendorProduct.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { VendorBill } from '../models/VendorBill.js';
import { Contact } from '../models/Contact.js';
import { Product } from '../models/Product.js';
import { Account } from '../models/Account.js';
import { PurchaseOrderStatus, VendorBillStatus, AccountType, ProductType, ContactType } from '../types/index.js';
import { getNextBillNumber, getNextPONumber } from '../services/sequenceService.js';
import { cache } from '../utils/cache.js';

/**
 * Helper to resolve the vendor's Contact ID from authenticated request
 */
export const resolveVendorContact = async (req: AuthenticatedRequest): Promise<any> => {
  if (!req.user) return null;

  if (req.user.contactId) {
    const contact = await Contact.findById(req.user.contactId);
    if (contact) return contact;
  }

  // Fallback: match by email or loginId
  let contact = await Contact.findOne({
    email: req.user.email.toLowerCase(),
    type: { $in: [ContactType.Vendor, ContactType.Both] },
  });

  if (!contact) {
    // Create contact record if missing
    contact = await Contact.create({
      name: req.user.name,
      type: ContactType.Vendor,
      email: req.user.email.toLowerCase(),
      phone: '',
      hasPortalAccess: true,
    });
  }

  return contact;
};

/**
 * Get all products listed by the logged-in vendor
 */
export const getVendorProducts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorContact = await resolveVendorContact(req);
    if (!vendorContact) {
      res.status(404).json({ message: 'Vendor contact record not found' });
      return;
    }

    const products = await VendorProduct.find({
      $or: [{ vendorId: vendorContact._id.toString() }, { vendorId: req.user?.id }],
    }).sort({ createdAt: -1 }).limit(120);

    res.status(200).json(products.map((p) => p.toJSON()));
  } catch (error) {
    next(error);
  }
};

/**
 * Add a new product to the vendor's catalog & sync to global product catalog
 */
export const addVendorProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorContact = await resolveVendorContact(req);
    if (!vendorContact) {
      res.status(404).json({ message: 'Vendor contact record not found' });
      return;
    }

    const { name, categoryId, price, stockQuantity, description, image } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Product name is required' });
      return;
    }

    if (price === undefined || Number(price) < 0) {
      res.status(400).json({ message: 'Valid non-negative price is required' });
      return;
    }

    const numStock = Number(stockQuantity) || 0;
    const numPrice = Number(price) || 0;

    const newVendorProduct = await VendorProduct.create({
      vendorId: vendorContact._id.toString(),
      name: name.trim(),
      categoryId: categoryId || undefined,
      price: numPrice,
      stockQuantity: numStock,
      description: description?.trim() || '',
      image: image || undefined,
    });

    // Sync / Upsert into main Product catalog so company can choose it in POs
    let globalProduct = await Product.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (!globalProduct) {
      globalProduct = await Product.create({
        name: name.trim(),
        type: ProductType.Goods,
        categoryId: categoryId || 'cat1',
        salesPrice: Math.round(numPrice * 1.2), // Default retail markup
        cost: numPrice,
        image: image || undefined,
      });
    }

    cache.invalidate('products:');
    res.status(201).json(newVendorProduct.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing vendor product's stock or price
 */
export const updateVendorProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, categoryId, price, stockQuantity, description, image } = req.body;

    const vendorContact = await resolveVendorContact(req);
    const vendorId = vendorContact ? vendorContact._id.toString() : req.user?.id;

    const product = await VendorProduct.findOne({
      _id: id,
      $or: [{ vendorId }, { vendorId: req.user?.id }],
    });

    if (!product) {
      res.status(404).json({ message: 'Vendor product not found or access denied' });
      return;
    }

    if (name !== undefined) product.name = name.trim();
    if (categoryId !== undefined) product.categoryId = categoryId;
    if (price !== undefined) product.price = Number(price) || 0;
    if (stockQuantity !== undefined) product.stockQuantity = Number(stockQuantity) || 0;
    if (description !== undefined) product.description = description.trim();
    if (image !== undefined) product.image = image;

    await product.save();
    cache.invalidate('products:');

    res.status(200).json(product.toJSON());
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product from the vendor's catalog
 */
export const deleteVendorProduct = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendorContact = await resolveVendorContact(req);
    const vendorId = vendorContact ? vendorContact._id.toString() : req.user?.id;

    const deleted = await VendorProduct.findOneAndDelete({
      _id: id,
      $or: [{ vendorId }, { vendorId: req.user?.id }],
    });

    if (!deleted) {
      res.status(404).json({ message: 'Product not found or access denied' });
      return;
    }

    res.status(200).json({ success: true, message: 'Vendor product removed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all incoming purchase orders for this vendor
 */
export const getVendorOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorContact = await resolveVendorContact(req);
    const vendorIds = [vendorContact?._id.toString(), req.user?.id, req.user?.contactId].filter(Boolean);

    const orders = await PurchaseOrder.find({
      vendorId: { $in: vendorIds },
    }).sort({ createdAt: -1 }).limit(120);

    // Populate products for line items
    const allProducts = await Product.find({});
    const productMap = new Map(allProducts.map((p) => [p._id.toString(), p.name]));

    const formatted = orders.map((order) => {
      const json: any = order.toJSON ? order.toJSON() : { ...order };
      json.lines = (json.lines || []).map((line: any) => ({
        ...line,
        productName: productMap.get(line.productId) || 'Item',
      }));
      json.total = (json.lines || []).reduce((sum: number, l: any) => sum + l.qty * l.unitPrice, 0);
      return json;
    });

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor accepts an order -> Automatically creates the VendorBill for admin settlement
 */
export const acceptVendorOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendorContact = await resolveVendorContact(req);
    const vendorIds = [vendorContact?._id.toString(), req.user?.id, req.user?.contactId].filter(Boolean);

    const po = await PurchaseOrder.findOne({
      _id: id,
      vendorId: { $in: vendorIds },
    });

    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found or access denied' });
      return;
    }

    // Update PO status to Accepted / Confirmed
    po.status = PurchaseOrderStatus.Accepted;
    await po.save();

    // Deduct vendor stock quantity
    for (const line of po.lines || []) {
      const vProd = await VendorProduct.findOne({
        vendorId: { $in: vendorIds },
        $or: [
          { name: { $regex: new RegExp(line.productId, 'i') } }, 
          ...(mongoose.Types.ObjectId.isValid(line.productId) ? [{ _id: line.productId }] : [])
        ],
      });
      if (vProd) {
        vProd.stockQuantity = Math.max(0, vProd.stockQuantity - (line.qty || 1));
        await vProd.save();
      }
    }

    // Lookup default expense account
    const expenseAcc =
      (await Account.findOne({ type: AccountType.Expenses })) ||
      (await Account.findOne({ name: { $regex: /purchase/i } }));
    const defaultAccId = expenseAcc?._id.toString() || 'acc_expense';

    // Check if bill already exists for this PO
    let existingBill = await VendorBill.findOne({ poReferenceId: po._id.toString() });
    if (!existingBill) {
      const billNumber = await getNextBillNumber();
      existingBill = await VendorBill.create({
        number: billNumber,
        vendorId: po.vendorId,
        billReference: po.number,
        billDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        poReferenceId: po._id.toString(),
        status: VendorBillStatus.Confirmed,
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
    } else {
      existingBill.status = VendorBillStatus.Confirmed;
      await existingBill.save();
    }

    cache.invalidate('purchase_orders:');
    cache.invalidate('vendor_bills:');
    cache.invalidate('dashboard:');

    res.status(200).json({
      success: true,
      message: 'Order accepted and Bill generated successfully for Admin payment.',
      order: po.toJSON(),
      bill: existingBill.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Vendor rejects an order
 */
export const rejectVendorOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const vendorContact = await resolveVendorContact(req);
    const vendorIds = [vendorContact?._id.toString(), req.user?.id, req.user?.contactId].filter(Boolean);

    const po = await PurchaseOrder.findOne({
      _id: id,
      vendorId: { $in: vendorIds },
    });

    if (!po) {
      res.status(404).json({ message: 'Purchase Order not found or access denied' });
      return;
    }

    po.status = PurchaseOrderStatus.Cancelled;
    await po.save();

    cache.invalidate('purchase_orders:');
    res.status(200).json({
      success: true,
      message: 'Order has been rejected.',
      order: po.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Vendor Bills belonging to this vendor
 */
export const getVendorBills = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vendorContact = await resolveVendorContact(req);
    const vendorIds = [vendorContact?._id.toString(), req.user?.id, req.user?.contactId].filter(Boolean);

    const bills = await VendorBill.find({
      vendorId: { $in: vendorIds },
    }).sort({ createdAt: -1 }).limit(120);

    res.status(200).json(bills.map((b) => b.toJSON()));
  } catch (error) {
    next(error);
  }
};

/**
 * Public/Organization Procurement Sourcing Search across all vendors
 */
export const searchVendorSourcing = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { query } = req.query;
    const hasQuery = !!(query && typeof query === 'string' && query.trim());
    const limit = hasQuery ? 500 : (Number(req.query.limit) || 120);
    const filter: any = {};

    if (hasQuery) {
      const term = (query as string).trim();
      const matchingVendors = await Contact.find({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { 'address.city': { $regex: term, $options: 'i' } },
        ]
      });
      const vendorIds = matchingVendors.map((v) => v._id.toString());

      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { vendorId: { $in: vendorIds } },
      ];
    }

    const vendorProducts = await VendorProduct.find(filter).sort({ stockQuantity: -1 }).limit(limit);

    // Populate vendor contact information
    const vendorIds = [...new Set(vendorProducts.map((vp) => vp.vendorId))];
    const contacts = await Contact.find({ _id: { $in: vendorIds } });
    const contactMap = new Map(contacts.map((c) => [c._id.toString(), c]));

    const results = vendorProducts.map((vp) => {
      const contact = contactMap.get(vp.vendorId);
      const json = vp.toJSON();
      return {
        ...json,
        vendorName: contact ? contact.name : 'Registered Vendor',
        vendorEmail: contact ? contact.email : '',
        vendorPhone: contact ? contact.phone : '',
        vendorCity: contact?.address?.city || '',
      };
    });

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin sends a Purchase Request (Req) directly from Sourcing Hub to a Vendor
 */
export const createVendorPurchaseRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vendorId, productName, qty, unitPrice, paymentTerms } = req.body;

    if (!vendorId) {
      res.status(400).json({ message: 'Vendor ID is required' });
      return;
    }

    const orderQty = Math.max(1, Number(qty) || 1);
    const orderPrice = Number(unitPrice) || 0;

    const poNumber = await getNextPONumber();

    // Ensure product exists in global product catalog or find matching product
    let product = await Product.findOne({ name: { $regex: new RegExp(`^${productName}$`, 'i') } });
    if (!product) {
      product = await Product.create({
        name: productName || 'Requested Sourcing Item',
        type: ProductType.Goods,
        categoryId: 'cat1',
        salesPrice: Math.round(orderPrice * 1.2),
        cost: orderPrice,
      });
    }

    const newPO = await PurchaseOrder.create({
      number: poNumber,
      vendorId: vendorId,
      date: new Date().toISOString().split('T')[0],
      paymentTerms: paymentTerms || '15 Days',
      status: PurchaseOrderStatus.SentToVendor,
      lines: [
        {
          id: Math.random().toString(36).substr(2, 9),
          productId: product._id.toString(),
          qty: orderQty,
          unitPrice: orderPrice,
        },
      ],
    });

    cache.invalidate('purchase_orders:');
    res.status(201).json({
      success: true,
      message: `Purchase Request ${poNumber} sent to vendor successfully!`,
      order: newPO.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

