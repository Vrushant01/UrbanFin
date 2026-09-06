import { Request, Response, NextFunction } from 'express';
import { Budget } from '../models/Budget.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { VendorBill } from '../models/VendorBill.js';
import { Payment } from '../models/Payment.js';
import { Contact } from '../models/Contact.js';
import { PaymentTerm } from '../models/PaymentTerm.js';
import { 
  PurchaseOrderStatus, 
  SalesOrderStatus, 
  CustomerInvoiceStatus, 
  VendorBillStatus,
  ContactType,
  PaymentType 
} from '../types/index.js';
import { cache } from '../utils/cache.js';

const DASHBOARD_CACHE_KEY = 'dashboard:summary';

export const getDashboardSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cached = cache.get<any>(DASHBOARD_CACHE_KEY);
    if (cached) {
      res.status(200).json(cached);
      return;
    }

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${currentYear}-12-31T23:59:59.999Z`);
    
    // 6 weeks ago
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

    const [
      budgets,
      totalPos,
      confirmedPoCount,
      draftPoCount,
      totalSos,
      confirmedSoCount,
      draftSoCount,
      totalCustomers,
      totalVendors,
      custOrderAgg,
      totalInvoices,
      paidInvoices,
      totalBills,
      paidBills,
      totalPaymentsMade,
      invoiceRevenueAgg,
      billExpenseAgg,
      recentInvoices,
      recentBills,
      monthlySalesAgg,
      weeklySalesAgg
    ] = await Promise.all([
      Budget.find().lean(),
      PurchaseOrder.countDocuments(),
      PurchaseOrder.countDocuments({ status: PurchaseOrderStatus.Confirmed }),
      PurchaseOrder.countDocuments({ status: PurchaseOrderStatus.Draft }),
      SalesOrder.countDocuments(),
      SalesOrder.countDocuments({ status: SalesOrderStatus.Confirmed }),
      SalesOrder.countDocuments({ status: SalesOrderStatus.Draft }),
      Contact.countDocuments({ type: { $in: [ContactType.Customer, ContactType.Both] } }),
      Contact.countDocuments({ type: { $in: [ContactType.Vendor, ContactType.Both] } }),
      SalesOrder.aggregate([
        { $match: { customerId: { $exists: true, $ne: '' } } },
        { $group: { _id: '$customerId', orderCount: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            returning: { $sum: { $cond: [{ $gte: ['$orderCount', 2] }, 1, 0] } },
            newCust: { $sum: { $cond: [{ $eq: ['$orderCount', 1] }, 1, 0] } }
          }
        }
      ]),
      CustomerInvoice.countDocuments(),
      CustomerInvoice.countDocuments({ status: CustomerInvoiceStatus.Paid }),
      VendorBill.countDocuments(),
      VendorBill.countDocuments({ status: VendorBillStatus.Paid }),
      Payment.countDocuments({ type: PaymentType.Send }),
      CustomerInvoice.aggregate([
        { $match: { status: { $in: [CustomerInvoiceStatus.Paid, CustomerInvoiceStatus.Confirmed] } } },
        { $unwind: { path: '$lines', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, totalRevenue: { $sum: { $multiply: [{ $ifNull: ['$lines.qty', 1] }, { $ifNull: ['$lines.unitPrice', 0] }] } } } }
      ]),
      VendorBill.aggregate([
        { $match: { status: { $in: [VendorBillStatus.Paid, VendorBillStatus.Confirmed] } } },
        { $unwind: { path: '$lines', preserveNullAndEmptyArrays: true } },
        { $group: { _id: null, totalExpense: { $sum: { $multiply: [{ $ifNull: ['$lines.qty', 1] }, { $ifNull: ['$lines.unitPrice', 0] }] } } } }
      ]),
      CustomerInvoice.find().sort({ createdAt: -1 }).limit(5).lean(),
      VendorBill.find().sort({ createdAt: -1 }).limit(5).lean(),
      
      // Monthly Sales Dynamics Aggregation
      CustomerInvoice.aggregate([
        { 
          $match: { 
            status: { $in: [CustomerInvoiceStatus.Paid, CustomerInvoiceStatus.Confirmed] },
            invoiceDate: { $gte: startOfYear.toISOString().split('T')[0], $lte: endOfYear.toISOString().split('T')[0] }
          } 
        },
        { $unwind: { path: '$lines', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $substr: ['$invoiceDate', 5, 2] }, // Group by MM
            total: { $sum: { $multiply: [{ $ifNull: ['$lines.qty', 1] }, { $ifNull: ['$lines.unitPrice', 0] }] } }
          }
        }
      ]),

      // Weekly Revenue Trend Aggregation (Last 6 weeks)
      CustomerInvoice.aggregate([
        { 
          $match: { 
            status: { $in: [CustomerInvoiceStatus.Paid, CustomerInvoiceStatus.Confirmed] },
            invoiceDate: { $gte: sixWeeksAgo.toISOString().split('T')[0] }
          } 
        },
        { $unwind: { path: '$lines', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$invoiceDate',
            total: { $sum: { $multiply: [{ $ifNull: ['$lines.qty', 1] }, { $ifNull: ['$lines.unitPrice', 0] }] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // 1. Real Customer Stats
    const orderAggResult = custOrderAgg[0] || { returning: 0, newCust: 0 };
    const returning = orderAggResult.returning || 0;
    const newCust = orderAggResult.newCust || 0;
    const inactive = Math.max(0, totalCustomers - returning - newCust);

    // 2. Real Financial Figures
    const monthlyRevenue = invoiceRevenueAgg[0]?.totalRevenue || 0;
    const totalExpenses = billExpenseAgg[0]?.totalExpense || 0;
    const netProfit = (monthlyRevenue > 0 || totalExpenses > 0) ? (monthlyRevenue - totalExpenses) : null;

    // 3. Real Budget Progress
    let onTrackCount = 0;
    let overBudgetCount = 0;
    let committed = 0;
    let achieved = 0;

    for (const b of (budgets as any[])) {
      let bCommitted = 0;
      let bAchieved = 0;
      (b.lines || []).forEach((l: any) => {
        bCommitted += Number(l.committedAmount) || 0;
        bAchieved += Number(l.achievedAmount) || 0;
      });
      committed += bCommitted;
      achieved += bAchieved;
      if (bAchieved > bCommitted && bCommitted > 0) {
        overBudgetCount++;
      } else {
        onTrackCount++;
      }
    }

    // 4. Real Recent Transactions
    const recentTransactions: any[] = [];
    for (const inv of recentInvoices) {
      const invTotal = (inv.lines || []).reduce((s: number, l: any) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
      recentTransactions.push({
        id: (inv as any)._id ? (inv as any)._id.toString() : inv.id,
        number: inv.number,
        date: inv.invoiceDate,
        amount: invTotal,
        status: inv.status.toUpperCase(),
        type: 'invoice'
      });
    }
    for (const bill of recentBills) {
      const billTotal = (bill.lines || []).reduce((s: number, l: any) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
      recentTransactions.push({
        id: (bill as any)._id ? (bill as any)._id.toString() : bill.id,
        number: bill.number,
        date: bill.billDate,
        amount: billTotal,
        status: bill.status.toUpperCase(),
        type: 'bill'
      });
    }
    recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const topRecent = recentTransactions.slice(0, 5);

    // 5. Monthly Sales Dynamics
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const salesDynamics = monthNames.map((month, index) => {
      const monthStr = String(index + 1).padStart(2, '0');
      const found = monthlySalesAgg.find((m: any) => m._id === monthStr);
      return { month, val1: found ? found.total : 0 };
    });

    // 6. Revenue Trend (Group by Week)
    const revenueTrend: any[] = [];
    // Initialize 6 weeks with 0
    for(let i=0; i<6; i++) {
      const weekStart = new Date(sixWeeksAgo);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const label = `Week ${i + 1}`;
      const dateRange = `${weekStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${weekEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`;
      
      // Sum totals for this week
      const weekTotal = weeklySalesAgg.reduce((sum: number, item: any) => {
        const itemDate = new Date(item._id);
        if (itemDate >= weekStart && itemDate <= weekEnd) {
          return sum + item.total;
        }
        return sum;
      }, 0);

      revenueTrend.push({ label, dateRange, revenue: weekTotal });
    }

    const summary = {
      customerStats: {
        total: totalCustomers,
        new: newCust,
        returning: returning,
        inactive: inactive,
      },
      vendorStats: {
        total: totalVendors,
      },
      salesStats: {
        all: totalSos,
        confirmed: confirmedSoCount,
        draft: draftSoCount,
      },
      purchaseStats: {
        all: totalPos,
        confirmed: confirmedPoCount,
        draft: draftPoCount,
      },
      budgetStats: {
        budget: budgets.length,
        onTrack: onTrackCount,
        over: overBudgetCount,
        committed: Math.round(committed),
        achieved: Math.round(achieved),
      },
      financialStats: {
        monthlyRevenue: Math.round(monthlyRevenue),
        netProfit: netProfit !== null ? Math.round(netProfit) : null,
        paidInvoicesCount: paidInvoices,
        totalInvoicesCount: totalInvoices,
        paidInvoicesPercent: totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0,
        paymentsMadeCount: totalPaymentsMade,
        totalBillsCount: totalBills,
        paymentsMadePercent: totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 0,
      },
      recentTransactions: topRecent,
      salesDynamics,
      revenueTrend
    };

    cache.set(DASHBOARD_CACHE_KEY, summary, 45);
    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
};

export const getPaymentTerms = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const defaultTerms = ['Immediate Payment', '15 Days', '30 Days', '45 Days'];
    const termsInDb = await PaymentTerm.find();

    const result = termsInDb.length > 0 ? termsInDb.map((t) => t.name) : defaultTerms;
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const addPaymentTerm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Payment term name is required' });
      return;
    }

    let term = await PaymentTerm.findOne({ name: name.trim() });
    if (!term) {
      term = await PaymentTerm.create({ name: name.trim() });
    }

    res.status(201).json(term.toJSON());
  } catch (error) {
    next(error);
  }
};
