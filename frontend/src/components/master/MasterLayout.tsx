import React, { useState } from 'react';
import { Search, LayoutList, LayoutGrid, Plus, ArrowLeft, Filter, RefreshCw, Database } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ModuleTabs } from './ModuleTabs';
import { useGlobalLoading } from '../../utils/clientCache';

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
  hideTabs?: boolean;
  filterOptions?: { label: string; value: string }[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  isLoading?: boolean;
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
  hideTabs = false,
  filterOptions,
  activeFilter,
  onFilterChange,
  isLoading: propLoading,
  children
}: MasterLayoutProps) {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const globalLoading = useGlobalLoading();
  const isLoading = propLoading !== undefined ? propLoading : globalLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Module sub-tabs */}
      {!hideTabs && <ModuleTabs />}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {viewMode === 'form' && onBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              title="Back to list"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {isLoading && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                <RefreshCw size={11} className="animate-spin text-blue-600" />
                <span>Loading DB Data...</span>
              </span>
            )}
          </div>
        </div>

        {viewMode !== 'form' && (
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            {!hideSearch && onSearchChange && (
              <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[280px]">
                {isLoading && searchTerm ? (
                  <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 animate-spin" size={16} />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                )}
                <Input
                  placeholder="Search entire database..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 h-10 w-full bg-white border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 shadow-xs"
                />
              </div>
            )}

            {/* Filter Button */}
            {filterOptions && filterOptions.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 shadow-xs cursor-pointer transition-colors"
                >
                  <Filter size={16} className="text-slate-400" />
                  <span>Filters</span>
                </button>
                
                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-30">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Filter By</div>
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          onFilterChange?.(opt.value);
                          setShowFilterMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          activeFilter === opt.value
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                        {activeFilter === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* View Mode Toggle Switcher */}
            {onViewModeChange && (
              <div 
                className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/90 shadow-2xs gap-0.5"
                role="group"
                aria-label="View mode switcher"
              >
                <button
                  type="button"
                  onClick={() => onViewModeChange('list')}
                  className={`flex items-center justify-center h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-lg cursor-pointer transition-all duration-150 ${
                    viewMode === 'list' 
                      ? 'bg-white text-blue-600 shadow-xs font-bold ring-1 ring-slate-200/80 scale-[1.02]' 
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
                  }`}
                  title="List View"
                  aria-pressed={viewMode === 'list'}
                >
                  <LayoutList size={18} className={viewMode === 'list' ? 'text-blue-600 stroke-[2.2]' : 'text-slate-400'} />
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('kanban')}
                  className={`flex items-center justify-center h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-lg cursor-pointer transition-all duration-150 ${
                    viewMode === 'kanban' 
                      ? 'bg-white text-blue-600 shadow-xs font-bold ring-1 ring-slate-200/80 scale-[1.02]' 
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
                  }`}
                  title="Kanban Grid View"
                  aria-pressed={viewMode === 'kanban'}
                >
                  <LayoutGrid size={18} className={viewMode === 'kanban' ? 'text-blue-600 stroke-[2.2]' : 'text-slate-400'} />
                </button>
              </div>
            )}
            
            {/* New Button */}
            {!hideNewButton && onNew && (
              <button
                onClick={onNew}
                className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus size={18} />
                <span>New</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {children}
      </div>
    </div>
  );
}
