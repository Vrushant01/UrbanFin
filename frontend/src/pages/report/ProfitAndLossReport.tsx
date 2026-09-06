import React, { useState, useEffect, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { AccountType, type Account } from '../../types';
import { mockDb, apiCall } from '../../mock/db';
import { Button } from '../../components/ui/Button';
import { Printer, RefreshCw, TrendingUp } from 'lucide-react';

interface AccountReportItem {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

interface ProfitAndLossReportData {
  year: string;
  incomeAccounts: AccountReportItem[];
  purchaseExpenseAccounts: AccountReportItem[];
  otherExpenseAccounts: AccountReportItem[];
  totalIncome: number;
  totalPurchaseExpenses: number;
  totalOtherExpenses: number;
  totalExpenses: number;
  netIncome: number;
}

export function ProfitAndLossReport() {
  const [year, setYear] = useState('2026');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ProfitAndLossReportData | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      await mockDb.syncWithBackend();
      
      // Attempt to fetch computed report from backend API
      const backendData = await apiCall<ProfitAndLossReportData>('GET', `/reports/profit-and-loss?year=${year}`);
      if (backendData && (backendData.totalIncome !== undefined || backendData.incomeAccounts)) {
        setReportData(backendData);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Backend P&L API fetch failed, computing from local synced state:', err);
    }

    // Fallback: Compute from synced mockDb
    const allAccounts = mockDb.getAccounts();
    const balances: Record<string, number> = {};
    allAccounts.forEach(acc => {
      balances[acc.id] = mockDb.computeAccountBalance(acc.id, year);
    });

    const incomeAccounts: AccountReportItem[] = [];
    const purchaseExpenseAccounts: AccountReportItem[] = [];
    const otherExpenseAccounts: AccountReportItem[] = [];

    allAccounts.forEach(acc => {
      const item: AccountReportItem = {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        balance: balances[acc.id] || 0
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

    setReportData({
      year,
      incomeAccounts,
      purchaseExpenseAccounts,
      otherExpenseAccounts,
      totalIncome,
      totalPurchaseExpenses,
      totalOtherExpenses,
      totalExpenses,
      netIncome,
    });
    setLoading(false);
  }, [year]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <MasterLayout
      title="Profit & Loss Report"
      viewMode="form"
      onViewModeChange={() => {}}
      hideNewButton
      hideSearch
    >
      <div className="max-w-4xl mx-auto px-6 py-2">
        <div className="flex justify-between items-center mb-6 mt-4 print:hidden">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-700">Financial Year:</label>
            <select 
              className="h-10 px-4 rounded-lg border border-slate-300 bg-white shadow-sm font-medium"
              value={year}
              onChange={e => setYear(e.target.value)}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer size={16} /> Print / PDF
          </Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
          <div className="p-8 border-b border-slate-200 bg-slate-50 text-center print:bg-transparent">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Urban Furniture</h1>
            <h2 className="text-xl font-medium text-slate-600">Profit & Loss Statement</h2>
            <p className="text-sm text-slate-500 mt-2">For the Year Ended {year}</p>
          </div>

          <div className="p-8">
            <table className="w-full text-left">
              <tbody>
                
                {/* Income Section */}
                <tr>
                  <td colSpan={2} className="py-3 font-bold text-lg text-blue-900 border-b-2 border-slate-800">
                    Income
                  </td>
                </tr>
                {(reportData?.incomeAccounts || []).map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-4 text-slate-700">{acc.name}</td>
                    <td className="py-3 text-right font-medium">
                      Rs. {(acc.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50">
                  <td className="py-4 pl-4 font-bold text-blue-900">Total Income</td>
                  <td className="py-4 text-right font-bold text-blue-700 text-lg border-t-2 border-blue-200">
                    Rs. {(reportData?.totalIncome || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>
                
                {/* Spacer */}
                <tr><td colSpan={2} className="h-8"></td></tr>

                {/* Expenses Section */}
                <tr>
                  <td colSpan={2} className="py-3 font-bold text-lg text-rose-900 border-b-2 border-slate-800">
                    Expenses
                  </td>
                </tr>
                
                <tr className="bg-slate-50/50">
                  <td colSpan={2} className="py-2 pl-4 font-semibold text-slate-600 text-sm uppercase tracking-wide">
                    Direct Expenses (Purchases)
                  </td>
                </tr>
                {(reportData?.purchaseExpenseAccounts || []).map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-8 text-slate-700">{acc.name}</td>
                    <td className="py-3 text-right font-medium">
                      Rs. {(acc.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-50/50">
                  <td colSpan={2} className="py-2 pl-4 font-semibold text-slate-600 text-sm uppercase tracking-wide mt-2">
                    Indirect / Other Expenses
                  </td>
                </tr>
                {(reportData?.otherExpenseAccounts || []).map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-8 text-slate-700">{acc.name}</td>
                    <td className="py-3 text-right font-medium">
                      Rs. {(acc.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
                
                <tr className="bg-rose-50/50">
                  <td className="py-4 pl-4 font-bold text-rose-900">Total Expenses</td>
                  <td className="py-4 text-right font-bold text-rose-700 text-lg border-t-2 border-rose-200">
                    Rs. {(reportData?.totalExpenses || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>

                {/* Spacer */}
                <tr><td colSpan={2} className="h-12"></td></tr>

                {/* Net Income Section */}
                <tr className={(reportData?.netIncome || 0) >= 0 ? "bg-emerald-50" : "bg-red-50"}>
                  <td className={`py-5 pl-4 text-xl font-black ${(reportData?.netIncome || 0) >= 0 ? 'text-emerald-900' : 'text-red-900'} uppercase`}>
                    Net Income
                  </td>
                  <td className={`py-5 text-right text-2xl font-black ${(reportData?.netIncome || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} border-y-4 ${(reportData?.netIncome || 0) >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
                    Rs. {(reportData?.netIncome || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MasterLayout>
  );
}
