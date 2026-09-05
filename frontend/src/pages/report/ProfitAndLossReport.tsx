import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { AccountType, type Account } from '../../types';
import { mockDb } from '../../mock/db';
import { Button } from '../../components/ui/Button';
import { Printer } from 'lucide-react';

export function ProfitAndLossReport() {
  const [year, setYear] = useState('2026');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    const allAccounts = mockDb.getAccounts();
    setAccounts(allAccounts);

    const newBalances: Record<string, number> = {};
    allAccounts.forEach(acc => {
      newBalances[acc.id] = mockDb.computeAccountBalance(acc.id, year);
    });
    setBalances(newBalances);
  }, [year]);

  // Calculations
  const incomeAccounts = accounts.filter(a => a.type === AccountType.Income);
  const purchaseExpenseAccounts = accounts.filter(a => a.type === AccountType.Expenses);
  const otherExpenseAccounts = accounts.filter(a => a.type === AccountType.OtherExpenses);

  const totalIncome = incomeAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const totalPurchase = purchaseExpenseAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const totalOther = otherExpenseAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  
  const totalExpenses = totalPurchase + totalOther;
  const netIncome = totalIncome - totalExpenses;

  const handlePrint = () => {
    alert('Mock: Generating PDF of Profit & Loss Report...');
  };

  return (
    <MasterLayout
      title="Profit & Loss Report"
      viewMode="form"
      onViewModeChange={() => {}}
      hideNewButton
      hideSearch
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-700">Financial Year:</label>
            <select 
              className="h-10 px-4 rounded-lg border border-slate-300 bg-white shadow-sm font-medium"
              value={year}
              onChange={e => setYear(e.target.value)}
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer size={16} /> Print / PDF
          </Button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
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
                  <td colSpan={2} className="py-3 font-bold text-lg text-indigo-900 border-b-2 border-slate-800">
                    Income
                  </td>
                </tr>
                {incomeAccounts.map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-4 text-slate-700">{acc.name}</td>
                    <td className="py-3 text-right font-medium">
                      Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
                <tr className="bg-indigo-50/50">
                  <td className="py-4 pl-4 font-bold text-indigo-900">Total Income</td>
                  <td className="py-4 text-right font-bold text-indigo-700 text-lg border-t-2 border-indigo-200">
                    Rs. {totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}
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
                {purchaseExpenseAccounts.map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-8 text-slate-700">{acc.name}</td>
                    <td className="py-3 text-right font-medium">
                      Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-50/50">
                  <td colSpan={2} className="py-2 pl-4 font-semibold text-slate-600 text-sm uppercase tracking-wide mt-2">
                    Indirect / Other Expenses
                  </td>
                </tr>
                {otherExpenseAccounts.map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-8 text-slate-700">{acc.name}</td>
                    <td className="py-3 text-right font-medium">
                      Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
                
                <tr className="bg-rose-50/50">
                  <td className="py-4 pl-4 font-bold text-rose-900">Total Expenses</td>
                  <td className="py-4 text-right font-bold text-rose-700 text-lg border-t-2 border-rose-200">
                    Rs. {totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                </tr>

                {/* Spacer */}
                <tr><td colSpan={2} className="h-12"></td></tr>

                {/* Net Income Section */}
                <tr className={netIncome >= 0 ? "bg-emerald-50" : "bg-red-50"}>
                  <td className={`py-5 pl-4 text-xl font-black ${netIncome >= 0 ? 'text-emerald-900' : 'text-red-900'} uppercase`}>
                    Net Income
                  </td>
                  <td className={`py-5 text-right text-2xl font-black ${netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'} border-y-4 ${netIncome >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
                    Rs. {netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}
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
