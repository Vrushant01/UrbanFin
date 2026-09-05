import React from 'react';
import { Search, LayoutList, LayoutGrid, Plus, ArrowLeft } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface MasterLayoutProps {
  title: string;
  viewMode: 'list' | 'kanban' | 'form';
  onViewModeChange?: (mode: 'list' | 'kanban') => void;
  onNew?: () => void;
  onBack?: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  hideNewButton?: boolean;
  hideSearch?: boolean;
  children: React.ReactNode;
}

export function MasterLayout({
  title,
  viewMode,
  onViewModeChange,
  onNew,
  onBack,
  searchTerm = '',
  onSearchChange,
  hideNewButton = false,
  hideSearch = false,
  children
}: MasterLayoutProps) {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {viewMode === 'form' && onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-colors"
              title="Back to list"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        </div>

        {viewMode !== 'form' && (
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!hideSearch && onSearchChange && (
              <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-10 w-full"
                />
              </div>
            )}
            
            {onViewModeChange && (
              <div className="flex bg-white rounded-md border border-slate-200 p-1 shadow-sm">
                <button
                  onClick={() => onViewModeChange('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="List View"
                >
                  <LayoutList size={18} />
                </button>
                <button
                  onClick={() => onViewModeChange('kanban')}
                  className={`p-1.5 rounded ${viewMode === 'kanban' ? 'bg-slate-100 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Kanban View"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
            )}
            
            {!hideNewButton && onNew && (
              <Button onClick={onNew} className="gap-2 whitespace-nowrap">
                <Plus size={18} /> New
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}
