import { Response, NextFunction } from 'express';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { CustomerInvoiceStatus, PaymentType, PaymentVia } from '../types/index.js';
import { recordPaymentAndUpdateDocument } from './paymentController.js';

export const getPortalInvoices = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let contactId = req.user?.contactId;

    if (!contactId && req.user) {
      const { Contact } = await import('../models/Contact.js');
      const contact = await Contact.findOne({
        $or: [{ email: req.user.email }, { hasPortalAccess: true }],
      });
      if (contact) {
        contactId = contact._id.toString();
      }
    }

    if (!contactId) {
      res.status(200).json([]);
      return;
    }

    const invoices = await CustomerInvoice.find({
      customerId: contactId,
      status: { $ne: CustomerInvoiceStatus.Draft },
    }).sort({ invoiceDate: -1 });

    const formatted = invoices.map((inv) => inv.toJSON());
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
    const contactId = req.user?.contactId;

    const invoice = await CustomerInvoice.findById(id);
    if (!invoice) {
      res.status(404).json({ message: 'Invoice not found' });
      return;
    }

    if (contactId && invoice.customerId !== contactId) {
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
