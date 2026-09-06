import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type AnalyticAccount, AnalyticAccountType, type Budget } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PieChart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

const DEFAULT_ANALYTIC: Partial<AnalyticAccount> = {
  name: '',
  type: AnalyticAccountType.Income,
};

export function AnalyticAccountsMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editingAnalytic, setEditingAnalytic] = useState<Partial<AnalyticAccount> | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const aData = await fetchWithCache<AnalyticAccount[]>(`/api/analytic-accounts?search=${encodeURIComponent(query)}`);
      setAnalytics(aData);
    } catch {
      setAnalytics(mockDb.getAnalyticAccounts());
    }

    try {
      const bData = await fetchWithCache<Budget[]>('/api/budgets');
      setBudgets(bData);
    } catch {
      setBudgets(mockDb.getBudgets());
    }
  }, [debouncedSearch]);

  // Load data & live backend sync
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredAnalytics = analytics;

  // Find all budgets associated with the currently editing analytic account
  const relatedBudgets = useMemo(() => {
    if (!editingAnalytic?.id) return [];
    return budgets.filter(b => 
      b.lines.some(line => line.analyticAccountId === editingAnalytic.id)
    );
  }, [editingAnalytic, budgets]);

  // Actions
  const handleNew = () => {
    setEditingAnalytic({ ...DEFAULT_ANALYTIC });
    setViewMode('form');
  };

  const handleEdit = (analytic: AnalyticAccount) => {
    setEditingAnalytic({ ...analytic });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingAnalytic(null);
    setViewMode('list');
  };

  const handleSave = async () => {
    if (!editingAnalytic || !editingAnalytic.name) return;

    if (editingAnalytic.id) {
      mockDb.updateAnalyticAccount(editingAnalytic.id, editingAnalytic as AnalyticAccount);
    } else {
      mockDb.addAnalyticAccount(editingAnalytic as Omit<AnalyticAccount, 'id'>);
    }
    
    await mockDb.syncWithBackend();
    loadData();
    setViewMode('list');
    setEditingAnalytic(null);
  };

  const handleDelete = async () => {
    if (!editingAnalytic?.id) return;
    if (window.confirm(`Are you sure you want to delete "${editingAnalytic.name}"?`)) {
      mockDb.deleteAnalyticAccount(editingAnalytic.id);
      await mockDb.syncWithBackend();
      loadData();
      setViewMode('list');
      setEditingAnalytic(null);
    }
  };

  const handleNewFromForm = () => {
    setEditingAnalytic({ ...DEFAULT_ANALYTIC });
  };

  // List View configuration
  const columns: Column<AnalyticAccount>[] = [
    {
      key: 'icon',
      header: '',
      render: () => <div className="text-slate-400 flex justify-center"><PieChart size={20} /></div>
    },
    { key: 'name', header: 'Analytic Account Name' },
    { 
      key: 'type', 
      header: 'Type',
      render: (a) => (
        <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${a.type === AnalyticAccountType.Income ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {a.type}
        </span>
      )
    }
  ];

  const isFormValid = !!(editingAnalytic?.name);

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
      {editingAnalytic?.id && (
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
      title="Analytic Accounts"
      viewMode={viewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredAnalytics} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={a => a.id} 
        />
      )}

      {viewMode === 'kanban' && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <PieChart size={48} className="mb-4 text-slate-300" />
          <p>Kanban view is not available for Analytic Accounts.</p>
          <button onClick={() => setViewMode('list')} className="mt-4 text-blue-600 hover:underline">Switch to List View</button>
        </div>
      )}

      {viewMode === 'form' && editingAnalytic && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
              <Input 
                label="Analytic Account Name" 
                required 
                value={editingAnalytic.name || ''} 
                onChange={e => setEditingAnalytic({ ...editingAnalytic, name: e.target.value })}
                placeholder="e.g. Project Alpha"
              />
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={editingAnalytic.type || AnalyticAccountType.Income}
                  onChange={e => setEditingAnalytic({ ...editingAnalytic, type: e.target.value as AnalyticAccountType })}
                >
                  <option value={AnalyticAccountType.Income}>Income (Sales / Invoices)</option>
                  <option value={AnalyticAccountType.Expenses}>Expenses (Purchases / Bills)</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Determines which transaction lines can use this account.</p>
              </div>
            </div>

            {/* Related Budgets Table */}
            {editingAnalytic.id && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Related Budgets</h3>
                {relatedBudgets.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <tr>
                          <th className="p-3">Budget</th>
                          <th className="p-3">Start Date</th>
                          <th className="p-3">End Date</th>
                          <th className="p-3 text-right">Committed</th>
                          <th className="p-3 text-right">Achieved</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {relatedBudgets.map(b => {
                          const matchingLine = b.lines.find(l => l.analyticAccountId === editingAnalytic.id);
                          return (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="p-3 font-medium text-blue-600">
                                <Link to={`/account/analytical-budget?id=${b.id}`}>{b.name}</Link>
                              </td>
                              <td className="p-3">{b.startDate}</td>
                              <td className="p-3">{b.endDate}</td>
                              <td className="p-3 text-right">Rs. {matchingLine?.committedAmount.toFixed(2)}</td>
                              <td className="p-3 text-right">Rs. {matchingLine?.achievedAmount.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                    This analytic account is not used in any budgets yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}

