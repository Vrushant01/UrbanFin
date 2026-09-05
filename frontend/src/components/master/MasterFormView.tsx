import React from 'react';
import { Button } from '../ui/Button';

interface MasterFormViewProps {
  onSave?: () => void; // Made optional for custom forms
  onNew?: () => void;  // Made optional for custom forms
  isFormValid?: boolean;
  renderActions?: () => React.ReactNode;
  children: React.ReactNode;
}

export function MasterFormView({ onSave, onNew, isFormValid = true, renderActions, children }: MasterFormViewProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && onSave) {
      onSave();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full relative">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        {renderActions ? (
          renderActions()
        ) : (
          <>
            {onNew && (
              <Button 
                type="button" 
                variant="secondary" 
                onClick={onNew}
              >
                New
              </Button>
            )}
            {onSave && (
              <Button 
                type="submit" 
                variant="primary"
                disabled={!isFormValid}
              >
                Confirm
              </Button>
            )}
          </>
        )}
      </div>
      
      {/* Form Content */}
      <div className="p-6 flex-1 overflow-y-auto">
        {children}
      </div>
    </form>
  );
}
