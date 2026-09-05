import { Budget, IBudget } from '../models/Budget.js';
import { VendorBill } from '../models/VendorBill.js';
import { CustomerInvoice } from '../models/CustomerInvoice.js';
import { AnalyticAccount } from '../models/AnalyticAccount.js';
import { BudgetStatus, VendorBillStatus, CustomerInvoiceStatus, AnalyticAccountType } from '../types/index.js';
import { cache } from '../utils/cache.js';

export const computeAnalyticAchievedAmount = async (
  analyticAccountId: string,
  startDate: string,
  endDate: string
): Promise<number> => {
  let achieved = 0;

  // 1. Sum matching Vendor Bill lines (Expenses)
  const bills = await VendorBill.find({
    status: { $in: [VendorBillStatus.Confirmed, VendorBillStatus.PartiallyPaid, VendorBillStatus.Paid] },
    billDate: { $gte: startDate, $lte: endDate },
    'lines.analyticAccountId': analyticAccountId,
  });

  bills.forEach((bill) => {
    (bill.lines || []).forEach((line) => {
      if (line.analyticAccountId === analyticAccountId) {
        achieved += (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
      }
    });
  });

  // 2. Sum matching Customer Invoice lines (Income)
  const invoices = await CustomerInvoice.find({
    status: { $in: [CustomerInvoiceStatus.Confirmed, CustomerInvoiceStatus.PartiallyPaid, CustomerInvoiceStatus.Paid] },
    invoiceDate: { $gte: startDate, $lte: endDate },
    'lines.analyticAccountId': analyticAccountId,
  });

  invoices.forEach((inv) => {
    (inv.lines || []).forEach((line) => {
      if (line.analyticAccountId === analyticAccountId) {
        achieved += (Number(line.qty) || 0) * (Number(line.unitPrice) || 0);
      }
    });
  });

  return Math.round(achieved * 100) / 100;
};

export const updateBudgetLiveAchieved = async (budget: IBudget): Promise<IBudget> => {
  if (budget.status === BudgetStatus.Confirmed && budget.startDate && budget.endDate) {
    const updatedLines = await Promise.all(
      budget.lines.map(async (line) => {
        const achieved = await computeAnalyticAchievedAmount(
          line.analyticAccountId,
          budget.startDate,
          budget.endDate
        );
        return {
          id: line.id,
          analyticAccountId: line.analyticAccountId,
          type: line.type,
          committedAmount: line.committedAmount,
          achievedAmount: achieved,
        };
      })
    );

    budget.lines = updatedLines;
    await budget.save();
  }
  return budget;
};

export const reviseBudget = async (budgetId: string): Promise<{ original: IBudget; revised: IBudget }> => {
  const original = await Budget.findById(budgetId);
  if (!original) {
    throw new Error('Original budget not found');
  }

  // Create revised budget with cloned lines
  const revisedName = original.name.includes('Revised') ? `${original.name} (New)` : `${original.name} Revised`;

  const revised = await Budget.create({
    name: revisedName,
    startDate: original.startDate,
    endDate: original.endDate,
    responsibleId: original.responsibleId,
    status: BudgetStatus.Draft,
    revisionOfId: original._id.toString(),
    lines: original.lines.map((l) => ({
      id: Math.random().toString(36).substr(2, 9),
      analyticAccountId: l.analyticAccountId,
      type: l.type,
      committedAmount: l.committedAmount,
      achievedAmount: 0,
    })),
  });

  original.status = BudgetStatus.Revised;
  original.revisedById = revised._id.toString();
  await original.save();

  cache.invalidate('budgets:');
  cache.invalidate('dashboard:');

  return { original, revised };
};

export const getMatchingBudgetTransactions = async (
  analyticAccountId: string,
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const transactions: any[] = [];

  // Matching Vendor Bills
  const bills = await VendorBill.find({
    status: { $in: [VendorBillStatus.Confirmed, VendorBillStatus.PartiallyPaid, VendorBillStatus.Paid] },
    billDate: { $gte: startDate, $lte: endDate },
    'lines.analyticAccountId': analyticAccountId,
  });

  bills.forEach((b) => {
    b.lines.forEach((l) => {
      if (l.analyticAccountId === analyticAccountId) {
        transactions.push({
          type: 'Vendor Bill',
          documentNumber: b.number,
          date: b.billDate,
          partnerId: b.vendorId,
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          total: l.qty * l.unitPrice,
        });
      }
    });
  });

  // Matching Customer Invoices
  const invoices = await CustomerInvoice.find({
    status: { $in: [CustomerInvoiceStatus.Confirmed, CustomerInvoiceStatus.PartiallyPaid, CustomerInvoiceStatus.Paid] },
    invoiceDate: { $gte: startDate, $lte: endDate },
    'lines.analyticAccountId': analyticAccountId,
  });

  invoices.forEach((inv) => {
    inv.lines.forEach((l) => {
      if (l.analyticAccountId === analyticAccountId) {
        transactions.push({
          type: 'Customer Invoice',
          documentNumber: inv.number,
          date: inv.invoiceDate,
          partnerId: inv.customerId,
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          total: l.qty * l.unitPrice,
        });
      }
    });
  });

  return transactions;
};
