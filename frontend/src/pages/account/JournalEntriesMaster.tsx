import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type JournalEntry, type JournalEntryLine, JournalEntryStatus, 
  type Journal, type Account, type Contact 
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { FileText, Plus, Trash2, AlertCircle, CheckCircle2, Link } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { fetchWithCache, clientCache } from '../../utils/clientCache';

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
  const debouncedSearch = useDebounce(searchTerm, 200);
  
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [editingEntry, setEditingEntry] = useState<Partial<JournalEntry> | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('urbanfin_jwt_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadData = useCallback(async (query: string = debouncedSearch) => {
    try {
      const jeData = await fetchWithCache<JournalEntry[]>(`/api/journal-entries?search=${encodeURIComponent(query)}`);
      setEntries(jeData);
    } catch {
      setEntries(mockDb.getJournalEntries());
    }

    try {
      const jData = await fetchWithCache<Journal[]>('/api/journals');
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

    try {
      const cData = await fetchWithCache<Contact[]>('/api/contacts');
      setContacts(cData);
    } catch {
      setContacts(mockDb.getContacts());
    }
  }, [debouncedSearch]);

  // Load data & live backend sync
  useEffect(() => {
    loadData(debouncedSearch);
  }, [loadData, debouncedSearch, viewMode]);

  const filteredEntries = entries;

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

  const handleEdit = async (entry: JournalEntry) => {
    // Fetch the enriched version (with sourceLabel, partnerName, journalName)
    try {
      const res = await fetch(`/api/journal-entries/${entry.id}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const enriched = await res.json();
        setEditingEntry({ ...enriched });
        setViewMode('form');
        return;
      }
    } catch (err) {
      console.warn('[JournalEntries] Could not fetch enriched entry:', err);
    }
    // Fallback to local data
    setEditingEntry({ ...entry });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingEntry(null);
    setViewMode('list');
  };

  const handleSave = async (status: JournalEntryStatus = JournalEntryStatus.Draft) => {
    if (!editingEntry || !editingEntry.journalId || !editingEntry.date) return;

    const payload = {
      date: editingEntry.date,
      journalId: editingEntry.journalId,
      partnerId: editingEntry.partnerId,
      status,
      lines: editingEntry.lines || [],
      number: editingEntry.number,
      sourceDocument: editingEntry.sourceDocument,
    };

    try {
      if (editingEntry.id) {
        // Update existing entry via real API
        await fetch(`/api/journal-entries/${editingEntry.id}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        // Create new entry via real API
        await fetch('/api/journal-entries', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }
    } catch (err) {
      console.warn('[JournalEntries] API call failed, falling back to mockDb sync:', err);
      if (editingEntry.id) {
        mockDb.updateJournalEntry(editingEntry.id, { ...editingEntry, status, total: totalDebit } as any);
      } else {
        mockDb.addJournalEntry({ ...editingEntry, status, total: totalDebit } as any);
      }
    }

    clientCache.invalidate('journal_entries');
    await loadData();
    setViewMode('list');
    setEditingEntry(null);
  };

  const handleDelete = async () => {
    if (!editingEntry?.id) return;
    if (window.confirm(`Are you sure you want to delete entry "${editingEntry.number || 'Draft'}"?`)) {
      try {
        await fetch(`/api/journal-entries/${editingEntry.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      } catch (err) {
        console.warn('[JournalEntries] Delete API failed, using mockDb:', err);
        mockDb.deleteJournalEntry(editingEntry.id);
        await mockDb.syncWithBackend();
      }
      clientCache.invalidate('journal_entries');
      await loadData();
      setViewMode('list');
      setEditingEntry(null);
    }
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
  const handlePost = async () => {
    if (!isBalanced) {
      alert(`Cannot post: Total Debit (Rs. ${totalDebit.toFixed(2)}) must equal Total Credit (Rs. ${totalCredit.toFixed(2)}).`);
      return;
    }
    if (editingEntry?.id) {
      // Use the dedicated POST endpoint for an existing entry
      try {
        const res = await fetch(`/api/journal-entries/${editingEntry.id}/post`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.message || 'Failed to post journal entry.');
          return;
        }
      } catch (err) {
        console.warn('[JournalEntries] Post API failed:', err);
        return;
      }
      clientCache.invalidate('journal_entries');
      await loadData();
      setViewMode('list');
      setEditingEntry(null);
    } else {
      // New entry — save as Posted in one shot
      await handleSave(JournalEntryStatus.Posted);
    }
  };

  const handleReset = async () => {
    if (!editingEntry || !editingEntry.id) return;
    try {
      await fetch(`/api/journal-entries/${editingEntry.id}/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.warn('[JournalEntries] Reset API failed, using mockDb:', err);
      mockDb.updateJournalEntry(editingEntry.id, { status: JournalEntryStatus.Draft });
      await mockDb.syncWithBackend();
    }
    clientCache.invalidate('journal_entries');
    await loadData();
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
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset to Draft
          </Button>
          <Button 
            type="button" 
            variant="outline"
            onClick={handleDelete}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1 ml-2"
          >
            <Trash2 size={16} /> Delete
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
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
          disabled={!isBalanced || (editingEntry.lines?.length || 0) === 0}
          onClick={handlePost}
        >
          Post
        </Button>
        {editingEntry.id && (
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
        <MasterKanbanView
          data={filteredEntries}
          keyExtractor={entry => entry.id}
          onCardClick={handleEdit}
          renderCard={(entry) => {
            const contact = contacts.find(c => c.id === entry.partnerId);
            const journal = journals.find(j => j.id === entry.journalId);
            return (
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {entry.number || 'New'}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                      entry.status === JournalEntryStatus.Posted
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {entry.status}
                    </span>
                  </div>

                  <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors text-base truncate">
                    {journal?.name || 'Journal Entry'}
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-slate-600 flex items-center justify-between">
                      <span className="text-slate-400">Date:</span>
                      <span className="font-medium text-slate-700">{entry.date}</span>
                    </div>
                    {contact && (
                      <div className="text-sm text-slate-600 flex items-center justify-between">
                        <span className="text-slate-400">Partner:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[120px]">{contact.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
                  <span className="font-black text-lg text-slate-800">
                    Rs. {entry.total.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          }}
        />
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
                <SearchableSelect
                  label="Partner (Optional)"
                  placeholder="Select or search partner..."
                  value={editingEntry.partnerId || ''}
                  disabled={isReadonly}
                  asyncSearchUrl="/api/contacts"
                  options={contacts.map(c => ({
                    id: c.id,
                    name: c.name,
                    subtitle: c.email || c.phone,
                  }))}
                  onChange={(val) => setEditingEntry({ ...editingEntry, partnerId: val })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-8 border border-slate-200 rounded-xl overflow-visible bg-white">
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
                      <td className="p-2 min-w-[200px]">
                        <SearchableSelect
                          size="sm"
                          placeholder="Select Account..."
                          value={line.accountId}
                          disabled={isReadonly}
                          asyncSearchUrl="/api/accounts"
                          options={accounts.map(a => ({
                            id: a.id,
                            name: a.name,
                            subtitle: a.type,
                          }))}
                          onChange={(val) => updateLine(line.id, 'accountId', val)}
                        />
                      </td>
                      <td className="p-2 min-w-[180px]">
                        <SearchableSelect
                          size="sm"
                          placeholder="(Optional)"
                          value={line.partnerId || ''}
                          disabled={isReadonly}
                          asyncSearchUrl="/api/contacts"
                          options={contacts.map(c => ({
                            id: c.id,
                            name: c.name,
                            subtitle: c.email || c.phone,
                          }))}
                          onChange={(val) => updateLine(line.id, 'partnerId', val)}
                        />
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
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-blue-600">
                    <Plus size={16} /> Add Line
                  </Button>
                </div>
              )}
            </div>

            {/* Source Document Reference (for auto-generated entries) */}
            {editingEntry.sourceDocument?.id && (editingEntry as any).sourceLabel && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                <Link size={16} className="text-blue-500 flex-shrink-0" />
                <span className="text-blue-700">
                  <span className="font-semibold">Source: </span>
                  {(editingEntry as any).sourceLabel}
                </span>
              </div>
            )}

            {/* Validation Warning */}
            {!isReadonly && (editingEntry.lines?.length || 0) > 0 && (
              <div className={`p-4 rounded-lg border ${
                isBalanced
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-orange-50 border-orange-200 text-orange-800'
              }`}>
                <div className="flex items-start gap-2">
                  {isBalanced
                    ? <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    : <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="font-semibold mb-1">
                      {isBalanced ? '✓ Journal Entry is balanced' : '⚠ Debit and Credit amounts do not match'}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-0.5">Total Debit</div>
                        <div className="font-bold text-base">Rs. {totalDebit.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-0.5">Total Credit</div>
                        <div className="font-bold text-base">Rs. {totalCredit.toFixed(2)}</div>
                      </div>
                      {!isBalanced && (
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-0.5">Difference</div>
                          <div className="font-bold text-base">Rs. {Math.abs(totalDebit - totalCredit).toFixed(2)}</div>
                        </div>
                      )}
                    </div>
                    {!isBalanced && (
                      <div className="mt-2 text-xs opacity-80">
                        Please add or correct the journal lines before posting.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
