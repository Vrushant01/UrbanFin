import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw } from 'lucide-react';
import { useGlobalLoading } from '../../utils/clientCache';

interface MasterKanbanViewProps<T> {
  data: T[];
  renderCard: (item: T) => React.ReactNode;
  onCardClick: (item: T) => void;
  keyExtractor: (item: T) => string;
  initialPageSize?: number;
  enablePagination?: boolean;
  isLoading?: boolean;
}

export function MasterKanbanView<T>({ 
  data, 
  renderCard, 
  onCardClick, 
  keyExtractor,
  initialPageSize = 12,
  enablePagination = true,
  isLoading: propLoading
}: MasterKanbanViewProps<T>) {
  const globalLoading = useGlobalLoading();
  const isLoading = propLoading !== undefined ? propLoading : globalLoading;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalRecords = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const paginatedData = useMemo(() => {
    if (!enablePagination) return data;
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, currentPage, pageSize, enablePagination]);

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  if (totalRecords === 0 && isLoading) {
    return (
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-3 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-slate-200" />
              <div className="w-3/4 h-4 rounded bg-slate-200" />
              <div className="w-1/2 h-3 rounded bg-slate-100" />
              <div className="w-full h-8 rounded-lg bg-slate-100 mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (totalRecords === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 py-12">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 text-xl">
          📭
        </div>
        <p className="font-semibold text-slate-600 text-sm">No records found</p>
        <p className="text-xs text-slate-400 mt-1">Create a new entry or adjust your search filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cards Grid */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {paginatedData.map((item) => (
            <div 
              key={keyExtractor(item)} 
              onClick={() => onCardClick(item)}
              className="cursor-pointer"
            >
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Footer */}
      {enablePagination && (
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 select-none">
          {/* Record Range & Size */}
          <div className="flex items-center gap-4">
            <span className="font-medium">
              Showing <strong className="text-slate-900 font-bold">{startRecord}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{endRecord}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{totalRecords.toLocaleString()}</strong> cards
            </span>

            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span>Cards per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={8}>8</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="First page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 py-1 bg-white border border-slate-200 rounded font-bold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Last page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
