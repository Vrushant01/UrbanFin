import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type Account, AccountType } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { BookOpen } from 'lucide-react';

const DEFAULT_ACCOUNT: Partial<Account> = {
  name: '',
  type: AccountType.Asset,
};

export function ChartOfAccountsMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);

  // Load data
  useEffect(() => {
    setAccounts(mockDb.getAccounts());
  }, [viewMode]);

  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const lower = searchTerm.toLowerCase();
    return accounts.filter(a => 
      a.name.toLowerCase().includes(lower) || 
      a.type.toLowerCase().includes(lower)
    );
  }, [accounts, searchTerm]);

  // Actions
  const handleNew = () => {
    setEditingAccount({ ...DEFAULT_ACCOUNT });
    setViewMode('form');
  };

  const handleEdit = (account: Account) => {
    setEditingAccount({ ...account });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingAccount(null);
    setViewMode('list');
  };

  const handleSave = () => {
    if (!editingAccount || !editingAccount.name) return;

    if (editingAccount.id) {
      mockDb.updateAccount(editingAccount.id, editingAccount as Account);
    } else {
      mockDb.addAccount(editingAccount as Omit<Account, 'id'>);
    }
    
    setAccounts(mockDb.getAccounts());
    setViewMode('list');
    setEditingAccount(null);
  };

  const handleNewFromForm = () => {
    setEditingAccount({ ...DEFAULT_ACCOUNT });
  };

  // List View configuration
  const columns: Column<Account>[] = [
    {
      key: 'icon',
      header: '',
      render: () => <div className="text-slate-400 flex justify-center"><BookOpen size={20} /></div>
    },
    { key: 'name', header: 'Account Name' },
    { 
      key: 'type', 
      header: 'Type',
      render: (a) => {
        // Simple visual grouping by color based on type
        const isBalanceSheet = [AccountType.Asset, AccountType.Liability, AccountType.Bank, AccountType.Capital, AccountType.Cash].includes(a.type);
        return (
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${isBalanceSheet ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
            {a.type}
          </span>
        );
      }
    }
  ];

  const isFormValid = !!(editingAccount?.name);

  return (
    <MasterLayout
      title="Chart of Accounts"
      viewMode={viewMode}
      onViewModeChange={setViewMode} // Note: Kanban doesn't make much sense for CoA, but allowed by the wrapper. We just don't implement the kanban view prop or we map it to list.
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredAccounts} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={a => a.id} 
        />
      )}

      {viewMode === 'kanban' && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <BookOpen size={48} className="mb-4 text-slate-300" />
          <p>Kanban view is not available for Chart of Accounts.</p>
          <button onClick={() => setViewMode('list')} className="mt-4 text-indigo-600 hover:underline">Switch to List View</button>
        </div>
      )}

      {viewMode === 'form' && editingAccount && (
        <MasterFormView onSave={handleSave} onNew={handleNewFromForm} isFormValid={isFormValid}>
          <div className="max-w-2xl mx-auto space-y-6">
            <Input 
              label="Account Name" 
              required 
              value={editingAccount.name || ''} 
              onChange={e => setEditingAccount({ ...editingAccount, name: e.target.value })}
              placeholder="e.g. Office Supplies Expense"
            />
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={editingAccount.type || AccountType.Asset}
                onChange={e => setEditingAccount({ ...editingAccount, type: e.target.value as AccountType })}
              >
                <optgroup label="Balance Sheet">
                  <option value={AccountType.Asset}>Asset</option>
                  <option value={AccountType.Liability}>Liability</option>
                  <option value={AccountType.Bank}>Bank</option>
                  <option value={AccountType.Capital}>Capital</option>
                  <option value={AccountType.Cash}>Cash</option>
                </optgroup>
                <optgroup label="Profit & Loss">
                  <option value={AccountType.Income}>Income</option>
                  <option value={AccountType.Expenses}>Expenses</option>
                  <option value={AccountType.OtherExpenses}>Other Expenses</option>
                </optgroup>
              </select>
            </div>
          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
