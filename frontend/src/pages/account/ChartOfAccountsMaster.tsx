import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type Account, AccountType } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { BookOpen, Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

const DEFAULT_ACCOUNT: Partial<Account> = {
  name: '',
  type: AccountType.Asset,
};

export function ChartOfAccountsMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const aData = await fetchWithCache<Account[]>(`/api/accounts?search=${encodeURIComponent(query)}`);
      setAccounts(aData);
    } catch {
      setAccounts(mockDb.getAccounts());
    }
  }, [debouncedSearch]);

  // Load data & live backend sync
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredAccounts = accounts;

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

  const handleSave = async () => {
    if (!editingAccount || !editingAccount.name) return;

    if (editingAccount.id) {
      mockDb.updateAccount(editingAccount.id, editingAccount as Account);
    } else {
      mockDb.addAccount(editingAccount as Omit<Account, 'id'>);
    }
    
    await mockDb.syncWithBackend();
    loadData();
    setViewMode('list');
    setEditingAccount(null);
  };

  const handleDelete = async () => {
    if (!editingAccount?.id) return;
    if (window.confirm(`Are you sure you want to delete "${editingAccount.name}"?`)) {
      mockDb.deleteAccount(editingAccount.id);
      await mockDb.syncWithBackend();
      loadData();
      setViewMode('list');
      setEditingAccount(null);
    }
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
          <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${isBalanceSheet ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
            {a.type}
          </span>
        );
      }
    }
  ];

  const isFormValid = !!(editingAccount?.name);

  const renderFormActions = () => (
    <div className="flex items-center gap-2">
      <Button 
        type="button" 
        variant="secondary" 
        onClick={handleNewFromForm}
      >
        New
      </Button>
      <Button 
        type="button" 
        variant="primary"
        disabled={!isFormValid}
        onClick={handleSave}
      >
        Confirm
      </Button>
      {editingAccount?.id && (
        <Button 
          type="button" 
          variant="outline"
          onClick={handleDelete}
          className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1 ml-2"
        >
          <Trash2 size={16} /> Delete
        </Button>
      )}
    </div>
  );

  return (
    <MasterLayout
      title="Chart of Accounts"
      viewMode={viewMode}
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
        <MasterFormView renderActions={renderFormActions}>
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

