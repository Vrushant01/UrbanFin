import React from 'react';
import { useGlobalLoading, getActiveRequestsCount } from '../../utils/clientCache';
import { RefreshCw } from 'lucide-react';

export function GlobalLoadingBar() {
  const isLoading = useGlobalLoading();
  const activeCount = getActiveRequestsCount();

  return (
    <>
      {/* Sleek Top Screen Progress Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-opacity duration-300 ${
          isLoading ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="h-full w-full bg-gradient-to-r from-blue-600 via-slate-600 to-blue-500 animate-pulse" />
        <div className="absolute inset-0 bg-white/30 animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>

      {/* Floating DB Sync Status Badge */}
      <div
        className={`fixed bottom-5 right-5 z-40 transition-all duration-300 pointer-events-none ${
          isLoading
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-3 opacity-0 scale-95'
        }`}
      >
        <div className="bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-slate-700/80 flex items-center gap-2.5 text-xs font-semibold">
          <RefreshCw size={14} className="text-blue-400 animate-spin" />
          <span className="text-slate-200">
            Fetching data from database... {activeCount > 1 ? `(${activeCount})` : ''}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-1" />
        </div>
      </div>
    </>
  );
}

/**
 * Live Database Connection / Sync Indicator for the Header
 */
export function DatabaseStatusIndicator() {
  const isLoading = useGlobalLoading();

  return (
    <div
      className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
        isLoading
          ? 'bg-blue-50/90 text-blue-800 border-blue-200 shadow-sm'
          : 'bg-emerald-50/70 text-emerald-800 border-emerald-200/60 shadow-sm'
      }`}
      title={isLoading ? 'Actively fetching live data from MongoDB Atlas' : 'Connected to MongoDB Atlas'}
    >
      {isLoading ? (
        <>
          <RefreshCw size={13} className="text-blue-600 animate-spin" />
          <span className="font-bold">Syncing DB...</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-slate-700">Live DB</span>
        </>
      )}
    </div>
  );
}
