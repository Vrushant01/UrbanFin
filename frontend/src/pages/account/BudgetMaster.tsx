import React, { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '../../components/master/MasterLayout';
import { MasterListView, type Column } from '../../components/master/MasterListView';
import { MasterKanbanView } from '../../components/master/MasterKanbanView';
import { MasterFormView } from '../../components/master/MasterFormView';
import { 
  type Budget, BudgetStatus, type BudgetLine, 
  type AnalyticAccount, type Contact 
} from '../../types';
import { mockDb } from '../../mock/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Target, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const DEFAULT_BUDGET: Partial<Budget> = {
  name: '',
  startDate: '',
  endDate: '',
  status: BudgetStatus.Draft,
  lines: []
};

// Simple inline donut chart SVG component
const DonutChart = ({ percent }: { percent: number }) => {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  return (
    <svg width="40" height="40" viewBox="0 0 42 42" className="inline-block">
      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e2e8f0" strokeWidth="6"></circle>
      <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke={safePercent > 100 ? "#ef4444" : "#10b981"} strokeWidth="6" strokeDasharray={`${safePercent} ${100 - safePercent}`} strokeDashoffset="25"></circle>
    </svg>
  );
};

export function BudgetMaster() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  const [editingBudget, setEditingBudget] = useState<Partial<Budget> | null>(null);

  // Load data
  useEffect(() => {
    setBudgets(mockDb.getBudgets());
    setAnalytics(mockDb.getAnalyticAccounts());
    setContacts(mockDb.getContacts());
  }, [viewMode]);

  // Handle deep linking from Analytic Accounts
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam && budgets.length > 0) {
      const b = budgets.find(b => b.id === idParam);
      if (b) {
        setEditingBudget(b);
        setViewMode('form');
        setSearchParams({}); // Clear param after navigation
      }
    }
  }, [searchParams, budgets, setSearchParams]);

  const filteredBudgets = useMemo(() => {
    if (!searchTerm) return budgets;
    const lower = searchTerm.toLowerCase();
    return budgets.filter(b => 
      b.name.toLowerCase().includes(lower) || 
      b.status.toLowerCase().includes(lower)
    );
  }, [budgets, searchTerm]);

  // Actions
  const handleNew = () => {
    setEditingBudget({ 
      ...DEFAULT_BUDGET, 
      responsibleId: contacts.length > 0 ? contacts[0].id : '' 
    });
    setViewMode('form');
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget({ ...budget });
    setViewMode('form');
  };

  const handleBack = () => {
    setEditingBudget(null);
    setViewMode('list');
  };

  const handleSave = (status: BudgetStatus = BudgetStatus.Draft) => {
    if (!editingBudget || !editingBudget.name) return;

    let finalBudget = { ...editingBudget, status } as Budget;

    // Trigger mock re-computations if moving to confirmed
    if (status === BudgetStatus.Confirmed && finalBudget.startDate && finalBudget.endDate) {
      finalBudget.lines = finalBudget.lines.map(line => ({
        ...line,
        achievedAmount: mockDb.computeAchievedAmount(line.analyticAccountId, finalBudget.startDate, finalBudget.endDate)
      }));
    }

    if (finalBudget.id) {
      mockDb.updateBudget(finalBudget.id, finalBudget);
    } else {
      mockDb.addBudget(finalBudget as Omit<Budget, 'id'>);
    }
    
    setBudgets(mockDb.getBudgets());
    setViewMode('list');
    setEditingBudget(null);
  };

  const handleRevise = () => {
    if (!editingBudget || !editingBudget.id) return;
    
    // Set original to Revised status
    mockDb.updateBudget(editingBudget.id, { status: BudgetStatus.Revised });
    
    // Create new budget in Draft
    const newBudget: Partial<Budget> = {
      name: `${editingBudget.name} Revised`,
      startDate: editingBudget.startDate,
      endDate: editingBudget.endDate,
      responsibleId: editingBudget.responsibleId,
      status: BudgetStatus.Draft,
      revisionOfId: editingBudget.id,
      lines: editingBudget.lines?.map(l => ({ ...l, achievedAmount: 0 })) || [] // reset achieved
    };
    
    const savedNewBudget = mockDb.addBudget(newBudget as Omit<Budget, 'id'>);
    setBudgets(mockDb.getBudgets());
    setEditingBudget(savedNewBudget);
  };

  const handleCancel = () => {
    if (!editingBudget || !editingBudget.id) return;
    mockDb.updateBudget(editingBudget.id, { status: BudgetStatus.Cancelled });
    setBudgets(mockDb.getBudgets());
    setViewMode('list');
    setEditingBudget(null);
  };

  // Line item manipulation
  const addLine = () => {
    if (!editingBudget) return;
    const initialAnalytic = analytics.length > 0 ? analytics[0] : null;
    const newLine: BudgetLine = {
      id: Math.random().toString(36).substr(2, 9),
      analyticAccountId: initialAnalytic ? initialAnalytic.id : '',
      type: initialAnalytic ? initialAnalytic.type : 'Expenses' as any,
      committedAmount: 0,
      achievedAmount: 0
    };
    setEditingBudget({
      ...editingBudget,
      lines: [...(editingBudget.lines || []), newLine]
    });
  };

  const removeLine = (id: string) => {
    if (!editingBudget) return;
    setEditingBudget({
      ...editingBudget,
      lines: editingBudget.lines?.filter(l => l.id !== id)
    });
  };

  const updateLine = (id: string, field: keyof BudgetLine, value: any) => {
    if (!editingBudget) return;
    setEditingBudget({
      ...editingBudget,
      lines: editingBudget.lines?.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        
        // Auto-fill type when analytic account changes
        if (field === 'analyticAccountId') {
          const analytic = analytics.find(a => a.id === value);
          if (analytic) updated.type = analytic.type;
        }
        
        return updated;
      })
    });
  };

  // List View configuration
  const columns: Column<Budget>[] = [
    { key: 'name', header: 'Budget Name' },
    { key: 'startDate', header: 'Start Date' },
    { key: 'endDate', header: 'End Date' },
    { 
      key: 'status', 
      header: 'Status',
      render: (b) => {
        const colors = {
          [BudgetStatus.Draft]: 'bg-slate-100 text-slate-700',
          [BudgetStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
          [BudgetStatus.Revised]: 'bg-blue-50 text-blue-700',
          [BudgetStatus.Cancelled]: 'bg-red-50 text-red-700',
        };
        return (
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors[b.status]}`}>
            {b.status}
          </span>
        );
      }
    },
    {
      key: 'chart',
      header: 'Achieved %',
      render: (b) => {
        if (b.status === BudgetStatus.Draft) return <span className="text-slate-400 text-xs">N/A</span>;
        
        let totalCommitted = 0;
        let totalAchieved = 0;
        b.lines.forEach(l => {
          totalCommitted += l.committedAmount;
          totalAchieved += l.achievedAmount;
        });
        
        const percent = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : 0;
        
        return (
          <div className="flex items-center gap-2">
            <DonutChart percent={percent} />
            <span className="text-xs font-semibold">{percent.toFixed(0)}%</span>
          </div>
        );
      }
    }
  ];

  // Kanban View configuration
  const renderCard = (b: Budget) => {
    let totalCommitted = 0;
    let totalAchieved = 0;
    b.lines.forEach(l => {
      totalCommitted += l.committedAmount;
      totalAchieved += l.achievedAmount;
    });
    const percent = totalCommitted > 0 ? (totalAchieved / totalCommitted) * 100 : 0;

    const colors = {
      [BudgetStatus.Draft]: 'bg-slate-100 text-slate-700',
      [BudgetStatus.Confirmed]: 'bg-emerald-50 text-emerald-700',
      [BudgetStatus.Revised]: 'bg-blue-50 text-blue-700',
      [BudgetStatus.Cancelled]: 'bg-red-50 text-red-700',
    };

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full p-5 relative group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Target size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{b.name}</h3>
              <span className={`inline-block px-2 py-0.5 mt-1 text-[10px] font-bold uppercase tracking-wider rounded ${colors[b.status]}`}>
                {b.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-slate-500 mb-4 border-b border-slate-100 pb-4">
          <div className="flex justify-between mb-1">
            <span>Start:</span>
            <span className="font-medium text-slate-700">{b.startDate || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span>End:</span>
            <span className="font-medium text-slate-700">{b.endDate || '-'}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Committed</p>
            <p className="font-bold text-slate-800">Rs. {totalCommitted.toLocaleString()}</p>
          </div>
          {b.status !== BudgetStatus.Draft && (
            <div className="flex flex-col items-end">
               <DonutChart percent={percent} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFormActions = () => {
    if (!editingBudget) return null;
    
    if (editingBudget.status === BudgetStatus.Confirmed) {
      return (
        <>
          <Button type="button" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Cancel Budget
          </Button>
          <Button type="button" variant="primary" onClick={handleRevise}>
            Revise Budget
          </Button>
        </>
      );
    }

    if (editingBudget.status === BudgetStatus.Revised || editingBudget.status === BudgetStatus.Cancelled) {
      return null; // Readonly, no main actions
    }

    // Draft
    return (
      <>
        {editingBudget.id && (
          <Button type="button" variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Cancel Budget
          </Button>
        )}
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => handleSave(BudgetStatus.Draft)}
        >
          Save Draft
        </Button>
        <Button 
          type="button" 
          variant="primary"
          disabled={!editingBudget.lines?.length || !editingBudget.name}
          onClick={() => handleSave(BudgetStatus.Confirmed)}
        >
          Confirm
        </Button>
      </>
    );
  };

  const isReadonly = editingBudget?.status !== BudgetStatus.Draft;
  const isConfirmed = editingBudget?.status === BudgetStatus.Confirmed;
  const revisionOfOriginal = editingBudget?.revisionOfId ? budgets.find(b => b.id === editingBudget.revisionOfId) : null;

  return (
    <MasterLayout
      title="Analytical Budget"
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onNew={handleNew}
      onBack={handleBack}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {viewMode === 'list' && (
        <MasterListView 
          data={filteredBudgets} 
          columns={columns} 
          onRowClick={handleEdit} 
          keyExtractor={b => b.id} 
        />
      )}
      
      {viewMode === 'kanban' && (
        <MasterKanbanView 
          data={filteredBudgets} 
          renderCard={renderCard} 
          onCardClick={handleEdit} 
          keyExtractor={b => b.id} 
        />
      )}

      {viewMode === 'form' && editingBudget && (
        <MasterFormView renderActions={renderFormActions}>
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Header Status Badge */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                {editingBudget.name || 'New Budget'}
                {revisionOfOriginal && (
                  <span className="text-sm font-normal text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 flex items-center gap-1 cursor-pointer hover:bg-indigo-100 transition-colors" onClick={() => handleEdit(revisionOfOriginal)}>
                    Revision of: {revisionOfOriginal.name} <ArrowRight size={14} />
                  </span>
                )}
              </div>
              <span className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-full border 
                ${editingBudget.status === BudgetStatus.Confirmed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                  editingBudget.status === BudgetStatus.Revised ? 'bg-blue-100 text-blue-800 border-blue-200' :
                  editingBudget.status === BudgetStatus.Cancelled ? 'bg-red-100 text-red-800 border-red-200' :
                  'bg-slate-200 text-slate-800 border-slate-300'}`}>
                {editingBudget.status}
              </span>
            </div>

            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2">
                <Input 
                  label="Budget Name" 
                  required 
                  disabled={isReadonly}
                  value={editingBudget.name || ''} 
                  onChange={e => setEditingBudget({ ...editingBudget, name: e.target.value })}
                  placeholder="e.g. Q1 Marketing Budget"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsible</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingBudget.responsibleId || ''}
                  disabled={isReadonly}
                  onChange={e => setEditingBudget({ ...editingBudget, responsibleId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select User</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="hidden md:block"></div> {/* Spacer */}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingBudget.startDate || ''}
                  onChange={e => setEditingBudget({ ...editingBudget, startDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input 
                  type="date"
                  required
                  disabled={isReadonly}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                  value={editingBudget.endDate || ''}
                  onChange={e => setEditingBudget({ ...editingBudget, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Budget Lines</h3>
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                <table className="w-full text-left text-sm min-w-max">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                    <tr>
                      <th className="p-3">Analytic Account</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Committed Amount</th>
                      <th className="p-3 text-right bg-indigo-50 border-l border-indigo-100">Achieved Amount</th>
                      <th className="p-3 text-right bg-indigo-50">Achieved %</th>
                      <th className="p-3 text-right bg-indigo-50">Amount to Achieve</th>
                      {!isReadonly && <th className="p-3 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editingBudget.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No lines added yet.
                        </td>
                      </tr>
                    ) : null}
                    
                    {(editingBudget.lines || []).map((line) => {
                      const percent = line.committedAmount > 0 ? (line.achievedAmount / line.committedAmount) * 100 : 0;
                      const toAchieve = line.committedAmount - line.achievedAmount;
                      
                      return (
                        <tr key={line.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="p-2">
                            <select 
                              className="w-full min-w-[200px] h-8 px-2 border border-slate-300 rounded text-sm disabled:bg-transparent disabled:border-transparent font-medium"
                              value={line.analyticAccountId}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                            >
                              <option value="" disabled>Select Analytic...</option>
                              {analytics.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                              {line.type}
                            </span>
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              min="0" step="0.01"
                              className="w-full h-8 px-2 border border-slate-300 rounded text-sm text-right disabled:bg-transparent disabled:border-transparent font-semibold"
                              value={line.committedAmount || ''}
                              disabled={isReadonly}
                              onChange={e => updateLine(line.id, 'committedAmount', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-2 text-right bg-indigo-50/30 border-l border-indigo-50">
                            {isConfirmed ? (
                              <button className="text-indigo-600 hover:underline font-bold" onClick={() => alert('Will open matching transactions in Module 5/6')}>
                                Rs. {line.achievedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-2 text-right bg-indigo-50/30">
                            {isConfirmed ? (
                              <span className={`font-bold ${percent >= 100 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {percent.toFixed(1)}%
                              </span>
                            ) : <span className="text-slate-400">-</span>}
                          </td>
                          <td className="p-2 text-right bg-indigo-50/30">
                            {isConfirmed ? (
                              <span className="font-semibold text-slate-700">
                                Rs. {toAchieve.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </span>
                            ) : <span className="text-slate-400">-</span>}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {!isReadonly && (
                <div className="mt-3">
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100">
                    <Plus size={16} /> Add Budget Line
                  </Button>
                </div>
              )}
            </div>

          </div>
        </MasterFormView>
      )}
    </MasterLayout>
  );
}
