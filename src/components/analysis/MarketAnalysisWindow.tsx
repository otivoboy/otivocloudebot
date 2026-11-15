import React from 'react';
import { Copy, Maximize2, Minimize2, X } from 'lucide-react';
import {
  AnalysisMarketWindow,
  CandleData,
  DerivContractAnalysisType,
  DerivTimeframe,
  SymbolDefinition,
  TickData,
  getSymbolDecimals,
  isVolatilityIndex,
} from './types';
import { OverUnderAnalysis } from './OverUnderAnalysis';
import { EvenOddAnalysis } from './EvenOddAnalysis';
import { RiseFallAnalysis } from './RiseFallAnalysis';
import { DiffersAnalysis } from './DiffersAnalysis';
import { AccumulatorsAnalysis } from './AccumulatorsAnalysis';
import { DigitPressureNoiseAnalysis } from './DigitPressureNoiseAnalysis';
import { cn } from '../../lib/utils';

interface MarketAnalysisWindowProps {
  window: AnalysisMarketWindow;
  ticks: TickData[];
  candles: CandleData[];
  timeframeCandles: Record<string, CandleData[]>;
  allMarketTicks?: Record<string, TickData[]>;
  isSingleView: boolean;
  onUpdateWindow: (updates: Partial<AnalysisMarketWindow>) => void;
  onCloseWindow: () => void;
  onFocusWindow: () => void;
  onDuplicateWindow: () => void;
  globalContractMode: DerivContractAnalysisType;
  globalTimeframe: DerivTimeframe;
  allSymbols: SymbolDefinition[];
  canClose: boolean;
  windowIndex: number;
}

export const MarketAnalysisWindow: React.FC<MarketAnalysisWindowProps> = ({
  window: win,
  ticks,
  candles,
  timeframeCandles,
  allMarketTicks,
  isSingleView,
  onUpdateWindow,
  onCloseWindow,
  onFocusWindow,
  onDuplicateWindow,
  globalContractMode,
  globalTimeframe,
  allSymbols,
  canClose,
  windowIndex,
}) => {
  const effectiveMode = win.contractMode || globalContractMode;
  const decimals = getSymbolDecimals(win.symbol);
  const latest = ticks.length > 0 ? ticks[ticks.length - 1] : null;
  const prev = ticks.length > 1 ? ticks[ticks.length - 2] : latest;
  const isUp = latest && prev ? latest.quote >= prev.quote : true;

  const availableSymbols =
    effectiveMode === 'accumulators'
      ? allSymbols.filter((s) => isVolatilityIndex(s.id))
      : allSymbols;

  return (
    <div className="rounded-3xl border border-[#2d2f36] bg-[#111217] p-4 sm:p-5 shadow-xl space-y-4">
      {/* Window Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2d2f36]/80 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-black font-mono text-indigo-300">
            #{windowIndex + 1}
          </span>

          <select
            value={win.symbol}
            onChange={(e) => onUpdateWindow({ symbol: e.target.value })}
            className="rounded-xl border border-[#2d2f36] bg-[#0a0b0d] px-2.5 py-1.5 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            {availableSymbols.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id})
              </option>
            ))}
          </select>

          <select
            value={effectiveMode}
            onChange={(e) =>
              onUpdateWindow({
                contractMode: e.target.value as DerivContractAnalysisType,
              })
            }
            className="rounded-xl border border-[#2d2f36] bg-[#0a0b0d] px-2.5 py-1.5 text-xs font-bold text-slate-300 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="pressure_noise">Digit Pressure &amp; Noise</option>
            <option value="over_under">Over / Under</option>
            <option value="even_odd">Even / Odd</option>
            <option value="rise_fall">Rise / Fall</option>
            <option value="differs">Matches / Differs</option>
            <option value="accumulators">Accumulators (AMFE)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {latest ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0a0b0d] border border-[#2d2f36] font-mono text-xs">
              <span className={cn('font-bold', isUp ? 'text-emerald-400' : 'text-rose-400')}>
                {latest.quote.toFixed(decimals)}
              </span>
              <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-[11px]">
                {latest.digit}
              </span>
            </div>
          ) : (
            <span className="text-[10px] font-mono text-slate-500">Connecting...</span>
          )}

          <button
            type="button"
            onClick={onDuplicateWindow}
            title="Duplicate window"
            className="p-1.5 rounded-lg border border-[#2d2f36] bg-[#0a0b0d] text-slate-400 hover:text-white cursor-pointer"
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            onClick={onFocusWindow}
            title={isSingleView ? 'Return to grid view' : 'Expand single view'}
            className="p-1.5 rounded-lg border border-[#2d2f36] bg-[#0a0b0d] text-slate-400 hover:text-white cursor-pointer"
          >
            {isSingleView ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {canClose && (
            <button
              type="button"
              onClick={onCloseWindow}
              title="Close window"
              className="p-1.5 rounded-lg border border-[#2d2f36] bg-[#0a0b0d] text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Mode Specific Sub-Engine */}
      {effectiveMode === 'pressure_noise' && (
        <DigitPressureNoiseAnalysis symbol={win.symbol} ticks={ticks} decimals={decimals} />
      )}
      {effectiveMode === 'over_under' && (
        <OverUnderAnalysis symbol={win.symbol} ticks={ticks} decimals={decimals} compact={!isSingleView} />
      )}
      {effectiveMode === 'even_odd' && (
        <EvenOddAnalysis symbol={win.symbol} ticks={ticks} />
      )}
      {effectiveMode === 'rise_fall' && (
        <RiseFallAnalysis
          symbol={win.symbol}
          ticks={ticks}
          candles={candles}
          timeframeCandles={timeframeCandles}
          activeTimeframe={globalTimeframe}
        />
      )}
      {effectiveMode === 'differs' && (
        <DiffersAnalysis
          symbol={win.symbol}
          ticks={ticks}
          allMarketTicks={allMarketTicks}
        />
      )}
      {effectiveMode === 'accumulators' && (
        <AccumulatorsAnalysis symbol={win.symbol} ticks={ticks} decimals={decimals} />
      )}
    </div>
  );
};
