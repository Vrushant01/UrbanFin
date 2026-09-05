import React from 'react';

interface MasterKanbanViewProps<T> {
  data: T[];
  renderCard: (item: T) => React.ReactNode;
  onCardClick: (item: T) => void;
  keyExtractor: (item: T) => string;
}

export function MasterKanbanView<T>({ data, renderCard, onCardClick, keyExtractor }: MasterKanbanViewProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>No records found.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {data.map((item) => (
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
  );
}
