import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Database } from 'lucide-react';
import { useGlobalLoading } from '../../utils/clientCache';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface MasterListViewProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick: (item: T) => void;
  keyExtractor: (item: T) => string;
  showSrNo?: boolean;
  initialPageSize?: number;
  enablePagination?: boolean;
  isLoading?: boolean;
}

export function MasterListView<T>({ 
  data, 
  columns, 
  onRowClick, 
  keyExtractor,
  showSrNo = true,
  initialPageSize = 10,
  enablePagination = true,
  isLoading: propLoading
}: MasterListViewProps<T>) {
  const globalLoading = useGlobalLoading();
  const isLoading = propLoading !== undefined ? propLoading : globalLoading;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  // Reset to page 1 whenever data or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const totalRecords = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Current page records slice
  const paginatedData = useMemo(() => {
    if (!enablePagination) return data;
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, currentPage, pageSize, enablePagination]);

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  if (totalRecords === 0 && isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Shimmering Loader Header */}
        <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-blue-700">
            <RefreshCw size={14} className="animate-spin text-blue-600" />
            <span>Fetching data from MongoDB Atlas database...</span>
          </div>
          <span className="text-[11px] text-blue-500 font-semibold">Applying compound indexes</span>
        </div>

        {/* Skeleton Table Rows */}
        <div className="divide-y divide-slate-100 p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2.5 animate-pulse">
              <div className="w-5 h-5 rounded bg-slate-200" />
              <div className="w-12 h-4 rounded bg-slate-200" />
              <div className="w-32 h-4 rounded bg-slate-200" />
              <div className="flex-1 h-4 rounded bg-slate-100" />
              <div className="w-24 h-4 rounded bg-slate-200" />
              <div className="w-20 h-6 rounded-full bg-slate-100" />
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
    <div className="flex flex-col h-full relative">
      {/* Active syncing progress line */}
      {isLoading && (
        <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-blue-500 to-slate-500 animate-pulse" />
      )}
      {/* Table Container */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              {showSrNo && (
                <th className="py-3 px-4 w-20 text-slate-500 font-bold whitespace-nowrap">
                  SR. NO.
                </th>
              )}
              {columns.map(col => (
                <th key={col.key} className="py-3 px-4 text-slate-500 font-bold whitespace-nowrap">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.map((item, index) => {
              const id = keyExtractor(item);
              const globalIndex = (currentPage - 1) * pageSize + index + 1;
              return (
                <tr 
                  key={id} 
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors bg-white group"
                  onClick={() => onRowClick(item)}
                >
                  {showSrNo && (
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {globalIndex}
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} className="py-3.5 px-4 text-[13px] text-slate-700 align-middle whitespace-nowrap">
                      {col.render ? col.render(item, index) : String((item as any)[col.key] || '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {enablePagination && (
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 select-none">
          {/* Record Count Range */}
          <div className="flex items-center gap-4">
            <span className="font-medium">
              Showing <strong className="text-slate-900 font-bold">{startRecord}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{endRecord}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{totalRecords.toLocaleString()}</strong> records
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-2 border border-slate-300 rounded bg-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="First page"
            >
              <ChevronsLeft size={16} />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 px-1">
              {getPageNumbers().map((p, i) => {
                if (p === '...') {
                  return <span key={`dots-${i}`} className="px-1.5 text-slate-400 font-bold">...</span>;
                }
                const pageNum = Number(p);
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[28px] h-7 px-2 rounded text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Next page"
            >
              <ChevronRight size={16} />
            </button>

            {/* Last Page */}
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
