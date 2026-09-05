import React, { useState, useEffect } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { AccountType, type Account } from '../../types';
import { mockDb } from '../../mock/db';
import { Button } from '../../components/ui/Button';
import { Printer, CheckCircle, AlertTriangle } from 'lucide-react';

export function BalanceSheet() {
  const [year, setYear] = useState('2026');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [netIncome, setNetIncome] = useState(0);

  useEffect(() => {
    const allAccounts = mockDb.getAccounts();
    setAccounts(allAccounts);

    const newBalances: Record<string, number> = {};
    allAccounts.forEach(acc => {
      newBalances[acc.id] = mockDb.computeAccountBalance(acc.id, year);
    });
    setBalances(newBalances);

    // Compute Net Income for Current Year Earnings
    const incomeAccounts = allAccounts.filter(a => a.type === AccountType.Income);
    const expenseAccounts = allAccounts.filter(a => a.type === AccountType.Expenses || a.type === AccountType.OtherExpenses);
    
    const totalIncome = incomeAccounts.reduce((sum, a) => sum + (newBalances[a.id] || 0), 0);
    const totalExpenses = expenseAccounts.reduce((sum, a) => sum + (newBalances[a.id] || 0), 0);
    
    setNetIncome(totalIncome - totalExpenses);
  }, [year]);

  // Assets
  const bankAccounts = accounts.filter(a => a.type === AccountType.Bank);
  const cashAccounts = accounts.filter(a => a.type === AccountType.Cash);
  const assetAccounts = accounts.filter(a => a.type === AccountType.Asset); // Debtors etc

  const totalBank = bankAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const totalCash = cashAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const totalOtherAssets = assetAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  
  const totalAssets = totalBank + totalCash + totalOtherAssets;

  // Liabilities & Equity
  const capitalAccounts = accounts.filter(a => a.type === AccountType.Capital);
  const liabilityAccounts = accounts.filter(a => a.type === AccountType.Liability); // Creditors etc

  const totalCapital = capitalAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + (balances[a.id] || 0), 0);
  
  const totalEquityAndLiabilities = totalCapital + totalLiabilities + netIncome;

  const isBalanced = Math.abs(totalAssets - totalEquityAndLiabilities) < 0.01;

  const handlePrint = () => {
    alert('Mock: Generating PDF of Balance Sheet...');
  };

  return (
    <MasterLayout
      title="Balance Sheet"
      viewMode="form"
      onViewModeChange={() => {}}
      hideNewButton
      hideSearch
    >
      <div className="max-w-6xl mx-auto">
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
          
          <div className="flex items-center gap-4">
            {isBalanced ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold">
                <CheckCircle size={16} /> Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-800 text-sm font-bold">
                <AlertTriangle size={16} /> Out of Balance
              </span>
            )}
            
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer size={16} /> Print / PDF
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
          <div className="p-8 border-b border-slate-200 bg-slate-50 text-center print:bg-transparent">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Urban Furniture</h1>
            <h2 className="text-xl font-medium text-slate-600">Balance Sheet</h2>
            <p className="text-sm text-slate-500 mt-2">As of December 31, {year}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            
            {/* Assets Column */}
            <div className="p-8">
              <h3 className="text-xl font-bold text-indigo-900 border-b-2 border-slate-800 pb-3 mb-4">
                Assets
              </h3>
              
              <table className="w-full text-left">
                <tbody>
                  {/* Bank */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-2 pl-2 font-semibold text-slate-600 text-sm uppercase tracking-wide">
                      Bank
                    </td>
                  </tr>
                  {bankAccounts.map(acc => (
                    <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pl-6 text-slate-700">{acc.name}</td>
                      <td className="py-3 text-right font-medium">
                        Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}

                  {/* Cash */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-2 pl-2 font-semibold text-slate-600 text-sm uppercase tracking-wide mt-2">
                      Cash
                    </td>
                  </tr>
                  {cashAccounts.map(acc => (
                    <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pl-6 text-slate-700">{acc.name}</td>
                      <td className="py-3 text-right font-medium">
                        Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}

                  {/* Other Assets / Debtors */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-2 pl-2 font-semibold text-slate-600 text-sm uppercase tracking-wide mt-2">
                      Current & Other Assets
                    </td>
                  </tr>
                  {assetAccounts.map(acc => (
                    <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pl-6 text-slate-700">{acc.name}</td>
                      <td className="py-3 text-right font-medium">
                        Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}

                  <tr><td colSpan={2} className="h-8"></td></tr>

                  <tr className="bg-indigo-50/50">
                    <td className="py-5 pl-4 text-lg font-bold text-indigo-900">Total Assets</td>
                    <td className="py-5 text-right font-black text-xl text-indigo-700 border-t-2 border-indigo-200 border-b-4">
                      Rs. {totalAssets.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Liabilities & Equity Column */}
            <div className="p-8">
              <h3 className="text-xl font-bold text-rose-900 border-b-2 border-slate-800 pb-3 mb-4">
                Liabilities & Equity
              </h3>
              
              <table className="w-full text-left">
                <tbody>
                  {/* Equity */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-2 pl-2 font-semibold text-slate-600 text-sm uppercase tracking-wide">
                      Equity / Capital
                    </td>
                  </tr>
                  {capitalAccounts.map(acc => (
                    <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pl-6 text-slate-700">{acc.name}</td>
                      <td className="py-3 text-right font-medium">
                        Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Current Year Earnings (Net Income) */}
                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pl-6 text-slate-700 font-medium">Current Year Earnings</td>
                    <td className="py-3 text-right font-semibold text-emerald-600">
                      Rs. {netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>

                  {/* Liabilities */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="py-2 pl-2 font-semibold text-slate-600 text-sm uppercase tracking-wide mt-2">
                      Liabilities
                    </td>
                  </tr>
                  {liabilityAccounts.map(acc => (
                    <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pl-6 text-slate-700">{acc.name}</td>
                      <td className="py-3 text-right font-medium">
                        Rs. {(balances[acc.id] || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}

                  <tr><td colSpan={2} className="h-8"></td></tr>

                  <tr className="bg-rose-50/50">
                    <td className="py-5 pl-4 text-lg font-bold text-rose-900">Total Liability & Equity</td>
                    <td className="py-5 text-right font-black text-xl text-rose-700 border-t-2 border-rose-200 border-b-4">
                      Rs. {totalEquityAndLiabilities.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
          </div>
        </div>
      </div>
    </MasterLayout>
  );
}
