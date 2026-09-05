import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type Journal, JournalType, type Account } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { BookMarked, Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

const DEFAULT_JOURNAL: Partial<Journal> = {
  name: '',
  type: JournalType.Sales,
  defaultAccountId: ''
};

export function JournalsMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingJournal, setEditingJournal] = useState<Partial<Journal> | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const jData = await fetchWithCache<Journal[]>(`/api/journals?search=${encodeURIComponent(query)}`);
      setJournals(jData);
    } catch {
      setJournals(mockDb.getJournals());
    }

    try {
      const aData = await fetchWithCache<Account[]>('/api/accounts');
      setAccounts(aData);
    } catch {
      setAccounts(mockDb.getAccounts());
    }
  }, [debouncedSearch]);

  // Sync with Backend database on load
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredJournals = journals;

  // Actions
  const handleNew = () => {
    setEditingJournal({ ...DEFAULT_JOURNAL, defaultAccountId: accounts.length > 0 ? accounts[0].id : '' });
    setViewMode('form');
  };

  const handleEdit = (journal: Journal) => {
    setEditingJournal({ ...journal });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingJournal(null);
    setViewMode('list');
  };

  const handleSave = async () => {
    if (!editingJournal || !editingJournal.name || !editingJournal.defaultAccountId) return;

    if (editingJournal.id) {
      mockDb.updateJournal(editingJournal.id, editingJournal as Journal);
    } else {
      mockDb.addJournal(editingJournal as Omit<Journal, 'id'>);
    }
    
    await mockDb.syncWithBackend();
    loadData();
    setViewMode('list');
    setEditingJournal(null);
  };

  const handleDelete = async () => {
    if (!editingJournal?.id) return;
    if (window.confirm(`Are you sure you want to delete "${editingJournal.name}"?`)) {
      mockDb.deleteJournal(editingJournal.id);
      await mockDb.syncWithBackend();
      loadData();
      setViewMode('list');
      setEditingJournal(null);
    }
  };

  const handleNewFromForm = () => {
    setEditingJournal({ ...DEFAULT_JOURNAL, defaultAccountId: accounts.length > 0 ? accounts[0].id : '' });
  };

  // List View configuration
  const columns: Column<Journal>[] = [
    {
      key: 'icon',
      header: '',
      render: () => <div className="text-slate-400 flex justify-center"><BookMarked size={20} /></div>
    },
    { key: 'name', header: 'Journal Name' },
    { 
      key: 'type', 
      header: 'Type',
      render: (j) => (
        <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 capitalize">
          {j.type}
        </span>
      )
    },
    { 
      key: 'defaultAccountId', 
      header: 'Default Account',
      render: (j) => accounts.find(a => a.id === j.defaultAccountId)?.name || '-'
    }
  ];

  const isFormValid = !!(editingJournal?.name && editingJournal?.defaultAccountId);

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
      {editingJournal?.id && (
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
      title="Journals"
      viewMode={viewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredJournals} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={j => j.id} 
        />
      )}

      {viewMode === 'kanban' && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <BookMarked size={48} className="mb-4 text-slate-300" />
          <p>Kanban view is not available for Journals.</p>
          <button onClick={() => setViewMode('list')} className="mt-4 text-indigo-600 hover:underline">Switch to List View</button>
        </div>
      )}

      {viewMode === 'form' && editingJournal && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-2xl mx-auto space-y-6">
            <Input 
              label="Journal Name" 
              required 
              value={editingJournal.name || ''} 
              onChange={e => setEditingJournal({ ...editingJournal, name: e.target.value })}
              placeholder="e.g. Miscellaneous"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Journal Type</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={editingJournal.type || JournalType.Sales}
                  onChange={e => setEditingJournal({ ...editingJournal, type: e.target.value as JournalType })}
                >
                  <option value={JournalType.Sales}>Sales</option>
                  <option value={JournalType.Purchase}>Purchase</option>
                  <option value={JournalType.Bank}>Bank</option>
                  <option value={JournalType.Cash}>Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Default Account</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={editingJournal.defaultAccountId || ''}
                  onChange={e => setEditingJournal({ ...editingJournal, defaultAccountId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select an account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}

