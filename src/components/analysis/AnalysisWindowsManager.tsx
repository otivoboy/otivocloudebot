import React from 'react';
import { Columns, LayoutGrid, Plus, RefreshCw, Square, X } from 'lucide-react';
import {
  AnalysisMarketWindow,
  DerivContractAnalysisType,
  SymbolDefinition,
  getSymbolDecimals,
} from './types';
import { cn } from '../../lib/utils';

interface AnalysisWindowsManagerProps {
  windows: AnalysisMarketWindow[];
  activeWindowId: string;
  onSelectActiveWindow: (id: string) => void;
  onAddWindow: (newSymbol?: string) => void;
  onRemoveWindow: (id: string) => void;
  onSyncAutoBotMarkets: () => void;
  layoutMode: 'grid' | 'single';
  onSetLayoutMode: (mode: 'grid' | 'single') => void;
  gridColumns: 1 | 2 | 3;
  onSetGridColumns: (cols: 1 | 2 | 3) => void;
  globalContractMode: DerivContractAnalysisType | 'classic_frequency';
  onSetGlobalContractMode: (mode: DerivContractAnalysisType | 'classic_frequency') => void;
  allSymbols: SymbolDefinition[];
  marketLastQuotes: Record<string, { quote: number; digit: number; isUp: boolean }>;
  autoBotMarketCount: number;
}

export const AnalysisWindowsManager: React.FC<AnalysisWindowsManagerProps> = ({
  windows,
  activeWindowId,
  onSelectActiveWindow,
  onAddWindow,
  onRemoveWindow,
  onSyncAutoBotMarkets,
  layoutMode,
  onSetLayoutMode,
  gridColumns,
  onSetGridColumns,
  marketLastQuotes,
  autoBotMarketCount,
}) => {
  return (
    <div className="rounded-2xl border border-[#2d2f36] bg-[#111217] p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      {/* Window Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
        {windows.map((win) => {
          const isActive = win.id === activeWindowId;
          const q = marketLastQuotes[win.symbol];
          const dec = getSymbolDecimals(win.symbol);
          return (
            <div
              key={win.id}
              onClick={() => onSelectActiveWindow(win.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all shrink-0',
                isActive
                  ? 'border-indigo-400 bg-indigo-500/15 text-white shadow-sm'
                  : 'border-[#2d2f36] bg-[#0a0b0d] text-slate-400 hover:text-white'
              )}
            >
              <span className="font-mono font-black">{win.symbol}</span>
              {q && (
                <span
                  className={cn(
                    'text-[10px] font-mono tabular-nums',
                    q.isUp ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {q.quote.toFixed(dec)} ({q.digit})
                </span>
              )}
              {windows.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveWindow(win.id);
                  }}
                  aria-label={`Close ${win.symbol} window`}
                  className="text-slate-500 hover:text-rose-400 ml-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => onAddWindow()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-300 text-xs font-bold shrink-0 cursor-pointer transition-all"
        >
          <Plus size={13} />
          <span>Add Market</span>
        </button>
      </div>

      {/* Layout & AutoBot Sync Controls */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {autoBotMarketCount > 0 && (
          <button
            type="button"
            onClick={onSyncAutoBotMarkets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-bold cursor-pointer transition-all"
          >
            <RefreshCw size={12} />
            <span>Sync AutoBot ({autoBotMarketCount})</span>
          </button>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-[#2d2f36] bg-[#0a0b0d] p-0.5">
          <button
            type="button"
            onClick={() => onSetLayoutMode('grid')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer',
              layoutMode === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <LayoutGrid size={12} />
            <span>Grid</span>
          </button>
          <button
            type="button"
            onClick={() => onSetLayoutMode('single')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer',
              layoutMode === 'single'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Square size={12} />
            <span>Focus</span>
          </button>
        </div>

        {layoutMode === 'grid' && (
          <div className="flex items-center gap-1 rounded-xl border border-[#2d2f36] bg-[#0a0b0d] p-0.5">
            <Columns size={12} className="text-slate-500 mx-1" />
            {([1, 2, 3] as const).map((cols) => (
              <button
                key={cols}
                type="button"
                onClick={() => onSetGridColumns(cols)}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-mono font-black cursor-pointer',
                  gridColumns === cols
                    ? 'bg-[#2d2f36] text-white'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {cols}C
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
