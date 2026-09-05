import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { type Journal, JournalType, type Account } from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { BookMarked } from 'lucide-react';

const DEFAULT_JOURNAL: Partial<Journal> = {
  name: '',
  type: JournalType.Sales,
  defaultAccountId: ''
};

export function JournalsMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingJournal, setEditingJournal] = useState<Partial<Journal> | null>(null);

  // Load data
  useEffect(() => {
    setJournals(mockDb.getJournals());
    setAccounts(mockDb.getAccounts());
  }, [viewMode]);

  const filteredJournals = useMemo(() => {
    if (!searchTerm) return journals;
    const lower = searchTerm.toLowerCase();
    return journals.filter(j => 
      j.name.toLowerCase().includes(lower) || 
      j.type.toLowerCase().includes(lower) ||
      (accounts.find(a => a.id === j.defaultAccountId)?.name || '').toLowerCase().includes(lower)
    );
  }, [journals, accounts, searchTerm]);

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

  const handleSave = () => {
    if (!editingJournal || !editingJournal.name || !editingJournal.defaultAccountId) return;

    if (editingJournal.id) {
      mockDb.updateJournal(editingJournal.id, editingJournal as Journal);
    } else {
      mockDb.addJournal(editingJournal as Omit<Journal, 'id'>);
    }
    
    setJournals(mockDb.getJournals());
    setViewMode('list');
    setEditingJournal(null);
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
    { key: 'type', header: 'Type' },
    { 
      key: 'defaultAccountId', 
      header: 'Default Account',
      render: (j) => accounts.find(a => a.id === j.defaultAccountId)?.name || '-'
    }
  ];

  const isFormValid = !!(editingJournal?.name && editingJournal?.defaultAccountId);

  return (
    <MasterLayout
      title="Journals"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
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
        <MasterFormView onSave={handleSave} onNew={handleNewFromForm} isFormValid={isFormValid}>
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
