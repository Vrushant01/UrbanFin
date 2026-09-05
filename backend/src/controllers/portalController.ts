import { Response, NextFunction } from 'express';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Role, CustomerInvoiceStatus, PaymentType, PaymentVia, ContactType } from '../types/index.js';
import { recordPaymentAndUpdateDocument } from './paymentController.js';

export const getPortalInvoices = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const { customerId: queryCustomerId } = req.query;
    const { Contact } = await import('../models/Contact.js');

    // 1. If Administrator, MasterAdmin, or Accountant, allow querying all or specific customer invoices
    if (userRole === Role.Administrator || userRole === Role.MasterAdmin || userRole === Role.SubAdmin || userRole === Role.Accountant) {
      const filter: any = {
        $or: [
          { status: { $ne: CustomerInvoiceStatus.Draft } },
          { paymentRequested: true },
        ],
      };
      if (queryCustomerId) {
        filter.customerId = queryCustomerId;
      }
      const invoices = await CustomerInvoice.find(filter).sort({ invoiceDate: -1, createdAt: -1 });
      const customerIds = Array.from(new Set(invoices.map((i) => i.customerId).filter(Boolean)));
      const contacts = customerIds.length > 0 ? await Contact.find({ _id: { $in: customerIds } }).lean() : [];
      const contactMap = new Map(contacts.map((c) => [c._id.toString(), c]));

      const formatted = invoices.map((inv) => {
        const json: any = inv.toJSON();
        const cust = contactMap.get(inv.customerId);
        json.customerName = cust?.name || 'Customer';
        json.customerEmail = cust?.email || '';
        return json;
      });

      res.status(200).json(formatted);
      return;
    }

    // 2. Strict Customer User Resolution
    let contactId = req.user?.contactId;
    const userEmail = req.user?.email?.toLowerCase();
    const userName = req.user?.name;

    if (!contactId && req.user) {
      // Try exact match first by email, then name
      let contact = await Contact.findOne({
        $or: [
          ...(userEmail ? [{ email: new RegExp(`^${userEmail}$`, 'i') }] : []),
          ...(userName ? [{ name: new RegExp(`^${userName}$`, 'i') }] : []),
        ],
      });
      // Fallback: partial name match (e.g., "Ananya Sharma" matching "Ananya Sharma Trading")
      if (!contact && userName) {
        const nameParts = userName.trim().split(/\s+/).filter(Boolean);
        if (nameParts.length >= 2) {
          const pattern = nameParts.map((p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
          contact = await Contact.findOne({
            name: new RegExp(pattern, 'i'),
            type: ContactType.Customer,
          });
        }
      }
      if (contact) {
        contactId = contact._id.toString();
      }
    }

    if (!contactId) {
      // Customer has no linked contact or no invoices yet - return empty array strictly
      res.status(200).json([]);
      return;
    }

    // Match this customer's invoices: non-draft OR payment-requested
    const invoices = await CustomerInvoice.find({
      customerId: contactId,
      $or: [
        { status: { $ne: CustomerInvoiceStatus.Draft } },
        { paymentRequested: true },
      ],
    }).sort({ invoiceDate: -1, createdAt: -1 });

    const cust = await Contact.findById(contactId).lean();

    const formatted = invoices.map((inv) => {
      const json: any = inv.toJSON();
      json.customerName = cust?.name || 'Customer';
      json.customerEmail = cust?.email || userEmail || '';
      return json;
    });

    res.status(200).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const payPortalInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const userRole = req.user?.role;
    const { Contact } = await import('../models/Contact.js');

    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    let contactId = req.user?.contactId;
    if (!contactId && req.user) {
      const userEmail = req.user.email?.toLowerCase();
      const userName = req.user.name;
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

    // Role check: Admin/Accountant can pay any invoice for testing; Customer can pay their own
    const isOwner =
      userRole === Role.Administrator ||
      userRole === Role.Accountant ||
      !contactId ||
      invoice.customerId === contactId ||
      invoice.customerId === req.user?.id;

    if (!isOwner) {
      res.status(403).json({ message: 'Access denied. You do not own this invoice.' });
      return;
    }

    const total = (invoice.lines || []).reduce(
      (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
      0
    );
    const amountDue = Math.max(0, total - (invoice.amountPaid || 0));

    if (amountDue <= 0) {
      res.status(400).json({ message: 'Invoice is already fully paid.' });
      return;
    }

    const result = await recordPaymentAndUpdateDocument({
      type: PaymentType.Receive,
      partnerId: invoice.customerId,
      amount: amountDue,
      via: paymentMethod === 'cash' ? PaymentVia.Cash : PaymentVia.Bank,
      note: 'Online Customer Portal Payment',
      invoiceId: invoice._id.toString(),
    });

    res.status(200).json({
      success: true,
      message: 'Invoice paid successfully',
      invoice: result.updatedDocument,
    });
  } catch (error) {
    next(error);
  }
};
