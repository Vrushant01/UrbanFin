import React, { useState } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface MasterListViewProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick: (item: T) => void;
  keyExtractor: (item: T) => string;
}

export function MasterListView<T>({ data, columns, onRowClick, keyExtractor }: MasterListViewProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(keyExtractor)));
    }
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent row click
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>No records found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm font-medium">
            <th className="p-4 w-12 text-center">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                checked={data.length > 0 && selectedIds.size === data.length}
                onChange={toggleSelectAll}
              />
            </th>
            {columns.map(col => (
              <th key={col.key} className="p-4 whitespace-nowrap">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const id = keyExtractor(item);
            const isSelected = selectedIds.has(id);
            return (
              <tr 
                key={id} 
                className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                onClick={() => onRowClick(item)}
              >
                <td className="p-4 text-center w-12" onClick={(e) => toggleSelect(e, id)}>
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={isSelected}
                    readOnly
                  />
                </td>
                {columns.map(col => (
                  <td key={col.key} className="p-4 align-middle">
                    {col.render ? col.render(item) : String((item as any)[col.key] || '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
