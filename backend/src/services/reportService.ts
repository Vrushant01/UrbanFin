import { Account, IAccount } from '../models/Account.js';
import { JournalEntry } from '../models/JournalEntry.js';
import { AccountType, JournalEntryStatus } from '../types/index.js';

export interface AccountBalanceItem {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface ProfitAndLossData {
  year: string;
  incomeAccounts: AccountBalanceItem[];
  purchaseExpenseAccounts: AccountBalanceItem[];
  otherExpenseAccounts: AccountBalanceItem[];
  totalIncome: number;
  totalPurchaseExpenses: number;
  totalOtherExpenses: number;
  totalExpenses: number;
  netIncome: number;
}

export interface BalanceSheetData {
  year: string;
  bankAccounts: AccountBalanceItem[];
  cashAccounts: AccountBalanceItem[];
  otherAssetAccounts: AccountBalanceItem[];
  capitalAccounts: AccountBalanceItem[];
  liabilityAccounts: AccountBalanceItem[];
  totalBank: number;
  totalCash: number;
  totalOtherAssets: number;
  totalAssets: number;
  totalCapital: number;
  totalLiabilities: number;
  netIncome: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export const computeAccountBalanceForYear = async (
  accountId: string,
  year: string
): Promise<number> => {
  const account = await Account.findById(accountId);
  if (!account) return 0;

  const entries = await JournalEntry.find({
    status: JournalEntryStatus.Posted,
    date: { $regex: `^${year}` },
    'lines.accountId': accountId,
  });

  let balance = 0;
  entries.forEach((entry) => {
    (entry.lines || []).forEach((line) => {
      if (line.accountId === accountId) {
        // Asset, Expenses, OtherExpenses, Bank, Cash = Debit - Credit
        if (
          [
            AccountType.Asset,
            AccountType.Expenses,
            AccountType.OtherExpenses,
            AccountType.Bank,
            AccountType.Cash,
          ].includes(account.type)
        ) {
          balance += (Number(line.debit) || 0) - (Number(line.credit) || 0);
        } else {
          // Liability, Capital, Income = Credit - Debit
          balance += (Number(line.credit) || 0) - (Number(line.debit) || 0);
        }
      }
    });
  });

  return Math.round(balance * 100) / 100;
};

export const generateProfitAndLossReport = async (
  year: string
): Promise<ProfitAndLossData> => {
  const accounts = await Account.find().sort({ name: 1 });

  const balances: Record<string, number> = {};
  await Promise.all(
    accounts.map(async (acc) => {
      balances[acc._id.toString()] = await computeAccountBalanceForYear(
        acc._id.toString(),
        year
      );
    })
  );

  const incomeAccounts: AccountBalanceItem[] = [];
  const purchaseExpenseAccounts: AccountBalanceItem[] = [];
  const otherExpenseAccounts: AccountBalanceItem[] = [];

  accounts.forEach((acc) => {
    const item: AccountBalanceItem = {
      id: acc._id.toString(),
      name: acc.name,
      type: acc.type,
      balance: balances[acc._id.toString()] || 0,
    };

    if (acc.type === AccountType.Income) incomeAccounts.push(item);
    else if (acc.type === AccountType.Expenses) purchaseExpenseAccounts.push(item);
    else if (acc.type === AccountType.OtherExpenses) otherExpenseAccounts.push(item);
  });

  const totalIncome = incomeAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalPurchaseExpenses = purchaseExpenseAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalOtherExpenses = otherExpenseAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = totalPurchaseExpenses + totalOtherExpenses;
  const netIncome = totalIncome - totalExpenses;

  return {
    year,
    incomeAccounts,
    purchaseExpenseAccounts,
    otherExpenseAccounts,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalPurchaseExpenses: Math.round(totalPurchaseExpenses * 100) / 100,
    totalOtherExpenses: Math.round(totalOtherExpenses * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netIncome: Math.round(netIncome * 100) / 100,
  };
};

export const generateBalanceSheetReport = async (
  year: string
): Promise<BalanceSheetData> => {
  const accounts = await Account.find().sort({ name: 1 });
  const pnl = await generateProfitAndLossReport(year);

  const balances: Record<string, number> = {};
  await Promise.all(
    accounts.map(async (acc) => {
      balances[acc._id.toString()] = await computeAccountBalanceForYear(
        acc._id.toString(),
        year
      );
    })
  );

  const bankAccounts: AccountBalanceItem[] = [];
  const cashAccounts: AccountBalanceItem[] = [];
  const otherAssetAccounts: AccountBalanceItem[] = [];
  const capitalAccounts: AccountBalanceItem[] = [];
  const liabilityAccounts: AccountBalanceItem[] = [];

  accounts.forEach((acc) => {
    const item: AccountBalanceItem = {
      id: acc._id.toString(),
      name: acc.name,
      type: acc.type,
      balance: balances[acc._id.toString()] || 0,
    };

    if (acc.type === AccountType.Bank) bankAccounts.push(item);
    else if (acc.type === AccountType.Cash) cashAccounts.push(item);
    else if (acc.type === AccountType.Asset) otherAssetAccounts.push(item);
    else if (acc.type === AccountType.Capital) capitalAccounts.push(item);
    else if (acc.type === AccountType.Liability) liabilityAccounts.push(item);
  });

  const totalBank = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalOtherAssets = otherAssetAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalAssets = totalBank + totalCash + totalOtherAssets;

  const totalCapital = capitalAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilitiesAndEquity = totalCapital + totalLiabilities + pnl.netIncome;

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    year,
    bankAccounts,
    cashAccounts,
    otherAssetAccounts,
    capitalAccounts,
    liabilityAccounts,
    totalBank: Math.round(totalBank * 100) / 100,
    totalCash: Math.round(totalCash * 100) / 100,
    totalOtherAssets: Math.round(totalOtherAssets * 100) / 100,
    totalAssets: Math.round(totalAssets * 100) / 100,
    totalCapital: Math.round(totalCapital * 100) / 100,
    totalLiabilities: Math.round(totalLiabilities * 100) / 100,
    netIncome: pnl.netIncome,
    totalLiabilitiesAndEquity: Math.round(totalLiabilitiesAndEquity * 100) / 100,
    isBalanced,
  };
};
