import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type JournalEntry, type JournalEntryLine, JournalEntryStatus, 
  type Journal, type Account, type Contact 
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { FileText, Plus, Trash2, AlertCircle } from 'lucide-react';

const DEFAULT_ENTRY: Partial<JournalEntry> = {
  date: new Date().toISOString().split('T')[0],
  status: JournalEntryStatus.Draft,
  total: 0,
  lines: [],
  number: ''
};

export function JournalEntriesMaster() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [editingEntry, setEditingEntry] = useState<Partial<JournalEntry> | null>(null);

  // Load data
  useEffect(() => {
    setEntries(mockDb.getJournalEntries());
    setJournals(mockDb.getJournals());
    setAccounts(mockDb.getAccounts());
    setContacts(mockDb.getContacts());
  }, [viewMode]);

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const lower = searchTerm.toLowerCase();
    return entries.filter(e => 
      e.number.toLowerCase().includes(lower) || 
      (journals.find(j => j.id === e.journalId)?.name || '').toLowerCase().includes(lower) ||
      (contacts.find(c => c.id === e.partnerId)?.name || '').toLowerCase().includes(lower)
    );
  }, [entries, journals, contacts, searchTerm]);

  // Derived state for line items
  const totalDebit = useMemo(() => {
    return editingEntry?.lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
  }, [editingEntry?.lines]);

  const totalCredit = useMemo(() => {
    return editingEntry?.lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;
  }, [editingEntry?.lines]);

  const isBalanced = totalDebit > 0 && totalDebit === totalCredit;

  // Actions
  const handleNew = () => {
    setEditingEntry({ ...DEFAULT_ENTRY, journalId: journals.length > 0 ? journals[0].id : '' });
    setViewMode('form');
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry({ ...entry });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingEntry(null);
    setViewMode('list');
  };

  const handleSave = (status: JournalEntryStatus = JournalEntryStatus.Draft) => {
    if (!editingEntry || !editingEntry.journalId || !editingEntry.date) return;

    const payload = {
      ...editingEntry,
      status,
      total: totalDebit
    } as JournalEntry;

    if (payload.id) {
      mockDb.updateJournalEntry(payload.id, payload);
    } else {
      mockDb.addJournalEntry(payload as Omit<JournalEntry, 'id'>);
    }
    
    setEntries(mockDb.getJournalEntries());
    setViewMode('list');
    setEditingEntry(null);
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingEntry) return;
    const newLine: JournalEntryLine = {
      id: Math.random().toString(36).substr(2, 9),
      accountId: accounts.length > 0 ? accounts[0].id : '',
      debit: 0,
      credit: 0
    };
    setEditingEntry({
      ...editingEntry,
      lines: [...(editingEntry.lines || []), newLine]
    });
  };

  const removeLine = (id: string) => {
    if (!editingEntry) return;
    setEditingEntry({
      ...editingEntry,
      lines: editingEntry.lines?.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof JournalEntryLine, value: any) => {
    if (!editingEntry) return;
    setEditingEntry({
      ...editingEntry,
      lines: editingEntry.lines?.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // If they set debit, clear credit and vice versa for simple entry UX
        if (field === 'debit' && value > 0) updated.credit = 0;
        if (field === 'credit' && value > 0) updated.debit = 0;
        return updated;
      })
    });
  };

  // Status-based actions
  const handlePost = () => {
    if (isBalanced) {
      handleSave(JournalEntryStatus.Posted);
    }
  };

  const handleReset = () => {
    if (!editingEntry || !editingEntry.id) return;
    mockDb.updateJournalEntry(editingEntry.id, { status: JournalEntryStatus.Draft });
    setEntries(mockDb.getJournalEntries());
    setViewMode('list');
    setEditingEntry(null);
  };

  // List View configuration
  const columns: Column<JournalEntry>[] = [
    {
      key: 'icon',
      header: '',
      render: () => <div className="text-slate-400 flex justify-center"><FileText size={20} /></div>
    },
    { key: 'date', header: 'Date' },
    { key: 'number', header: 'Number', render: (e) => e.number || 'New' },
    { key: 'partner', header: 'Partner', render: (e) => contacts.find(c => c.id === e.partnerId)?.name || '-' },
    { key: 'journal', header: 'Journal', render: (e) => journals.find(j => j.id === e.journalId)?.name || '-' },
    { key: 'total', header: 'Total', render: (e) => `Rs. ${e.total.toFixed(2)}` },
    { 
      key: 'status', 
      header: 'Status',
      render: (e) => (
        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${e.status === JournalEntryStatus.Posted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
          {e.status}
        </span>
      )
    }
  ];

  const renderFormActions = () => {
    if (!editingEntry) return null;
    
    if (editingEntry.status === JournalEntryStatus.Posted) {
      return (
        <>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset to Draft
          </Button>
          {editingEntry.number?.startsWith('Bill') || editingEntry.number?.startsWith('Inv') ? (
            <Button type="button" variant="primary" onClick={() => alert('Pay action - wiring in Module 5/6')}>
              Register Payment
            </Button>
          ) : null}
        </>
      );
    }

    return (
      <>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => handleSave(JournalEntryStatus.Draft)}
        >
          Save Draft
        </Button>
        <Button 
          type="button" 
          variant="primary"
          disabled={!isBalanced || editingEntry.lines?.length === 0}
          onClick={handlePost}
        >
          Post
        </Button>
      </>
    );
  };

  const isReadonly = editingEntry?.status === JournalEntryStatus.Posted;

  return (
    <MasterLayout
      title="Journal Entries"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredEntries} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={e => e.id} 
        />
      )}

      {viewMode === 'kanban' && (
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
          <FileText size={48} className="mb-4 text-slate-300" />
          <p>Kanban view is not available for Journal Entries.</p>
          <button onClick={() => setViewMode('list')} className="mt-4 text-indigo-600 hover:underline">Switch to List View</button>
        </div>
      )}

      {viewMode === 'form' && editingEntry && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800">
                {editingEntry.number || 'New Entry'}
              </div>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${editingEntry.status === JournalEntryStatus.Posted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-200 text-slate-800 border-slate-300'}`}>
                {editingEntry.status}
              </span>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Accounting Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingEntry.date || ''}
                  onChange={e => setEditingEntry({ ...editingEntry, date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Journal</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingEntry.journalId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingEntry({ ...editingEntry, journalId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select Journal</option>
                  {journals.map(j => (
                    <option key={j.id} value={j.id}>{j.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Partner (Optional)</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingEntry.partnerId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingEntry({ ...editingEntry, partnerId: e.target.value })}
                >
                  <option value="">None</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="p-3">Account</th>
                    <th className="p-3">Partner</th>
                    <th className="p-3 text-right w-32">Debit (Rs)</th>
                    <th className="p-3 text-right w-32">Credit (Rs)</th>
                    {!isReadonly && <th className="p-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(editingEntry.lines || []).map((line, idx) => (
                    <tr key={line.id} className="border-b border-slate-100 last:border-0">
                      <td className="p-2">
                        <select 
                          className="w-full h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent"
                          value={line.accountId}
                          disabled={isReadonly}
                          onChange={e => updateLine(line.id, 'accountId', e.target.value)}
                        >
                          <option value="" disabled>Select...</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select 
                          className="w-full h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent"
                          value={line.partnerId || ''}
                          disabled={isReadonly}
                          onChange={e => updateLine(line.id, 'partnerId', e.target.value)}
                        >
                          <option value="">None</option>
                          {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          min="0" step="0.01"
                          className="w-full h-8 px-2 border border-slate-300 rounded text-sm text-right disabled:bg-transparent disabled:border-transparent"
                          value={line.debit || ''}
                          disabled={isReadonly}
                          onChange={e => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          min="0" step="0.01"
                          className="w-full h-8 px-2 border border-slate-300 rounded text-sm text-right disabled:bg-transparent disabled:border-transparent"
                          value={line.credit || ''}
                          disabled={isReadonly}
                          onChange={e => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      {!isReadonly && (
                        <td className="p-2 text-center">
                          <button 
                            type="button" 
                            onClick={() => removeLine(line.id)}
                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td colSpan={2} className="p-3 text-right">Totals:</td>
                    <td className={`p-3 text-right ${totalDebit !== totalCredit ? 'text-red-600' : 'text-slate-800'}`}>
                      {totalDebit.toFixed(2)}
                    </td>
                    <td className={`p-3 text-right ${totalDebit !== totalCredit ? 'text-red-600' : 'text-slate-800'}`}>
                      {totalCredit.toFixed(2)}
                    </td>
                    {!isReadonly && <td></td>}
                  </tr>
                </tfoot>
              </table>
              
              {!isReadonly && (
                <div className="p-2 border-t border-slate-200">
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-indigo-600">
                    <Plus size={16} /> Add Line
                  </Button>
                </div>
              )}
            </div>

            {/* Validation Warning */}
            {!isReadonly && !isBalanced && (editingEntry.lines?.length || 0) > 0 && (
              <div className="flex items-center gap-2 p-4 bg-orange-50 text-orange-800 rounded-lg border border-orange-200">
                <AlertCircle size={20} />
                <span className="font-medium">Total Debits must equal Total Credits to post this entry. Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
              </div>
            )}

          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
