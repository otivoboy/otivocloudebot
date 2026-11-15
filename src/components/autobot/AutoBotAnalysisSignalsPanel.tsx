import React from 'react';
import { Radio, Zap } from 'lucide-react';
import {
  computeAccumulatorSignal,
  computeDiffersSignal,
  computeMatchSignal,
  computeOverUnderSignal,
} from '../../lib/autobotSignals';
import { StreakMode } from '../../types/autobot';
import { cn } from '../../lib/utils';

interface AutoBotAnalysisSignalsPanelProps {
  contractType: string;
  targetDigit: number;
  activeSymbol: string;
  digits: number[];
  quotes: number[];
  streakMode: StreakMode;
  onSetStreakMode: (mode: StreakMode) => void;
  isRunning: boolean;
}

export const AutoBotAnalysisSignalsPanel: React.FC<AutoBotAnalysisSignalsPanelProps> = ({
  contractType,
  targetDigit,
  activeSymbol,
  digits,
  quotes,
  streakMode,
  onSetStreakMode,
  isRunning,
}) => {
  const differSig = computeDiffersSignal(digits, activeSymbol);
  const ouSig = computeOverUnderSignal(
    digits,
    activeSymbol,
    targetDigit >= 0 && targetDigit <= 8 ? targetDigit : 4,
    4
  );
  const accuSig = computeAccumulatorSignal(quotes, digits, activeSymbol);
  const matchSig = computeMatchSignal(digits);

  return (
    <div className="bg-[#111214] border border-purple-500/35 rounded-2xl p-4 space-y-3 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-purple-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-purple-300">
            Analysis Signal Bridge · {activeSymbol}
          </span>
        </div>

        {streakMode !== 'analysis_tool' && (
          <button
            type="button"
            disabled={isRunning}
            onClick={() => onSetStreakMode('analysis_tool')}
            className="inline-flex items-center gap-1 rounded-lg bg-purple-600/20 border border-purple-500/40 px-2.5 py-1 text-[10px] font-bold text-purple-300 hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-50"
          >
            <Zap size={10} />
            Activate Analysis Mode
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div
          className={cn(
            'rounded-xl border p-2.5 bg-[#0c0d0f]',
            contractType === 'digitdiff' ? 'border-purple-500/50' : 'border-[#222428]'
          )}
        >
          <span className="block text-[9px] font-bold uppercase text-slate-400">
            Differs Signal
          </span>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-sm font-black text-white">Digit {differSig.prediction}</span>
            <span className="text-[11px] font-bold text-emerald-400">{differSig.confidence}%</span>
          </div>
        </div>

        <div
          className={cn(
            'rounded-xl border p-2.5 bg-[#0c0d0f]',
            ['digitover', 'digitunder', 'over_under', 'dual_ou'].includes(contractType)
              ? 'border-purple-500/50'
              : 'border-[#222428]'
          )}
        >
          <span className="block text-[9px] font-bold uppercase text-slate-400">
            Over / Under Edge
          </span>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-sm font-black text-white">{ouSig.direction}</span>
            <span className="text-[11px] font-bold text-sky-400">{ouSig.confidence}%</span>
          </div>
        </div>

        <div
          className={cn(
            'rounded-xl border p-2.5 bg-[#0c0d0f]',
            contractType === 'digitmatch' ? 'border-purple-500/50' : 'border-[#222428]'
          )}
        >
          <span className="block text-[9px] font-bold uppercase text-slate-400">Match Target</span>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-sm font-black text-white">Digit {matchSig.prediction}</span>
            <span className="text-[11px] font-bold text-amber-400">{matchSig.confidence}%</span>
          </div>
        </div>

        <div
          className={cn(
            'rounded-xl border p-2.5 bg-[#0c0d0f]',
            contractType === 'accumulator' ? 'border-purple-500/50' : 'border-[#222428]'
          )}
        >
          <span className="block text-[9px] font-bold uppercase text-slate-400">
            Accumulator State
          </span>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-sm font-black text-white">{accuSig.action}</span>
            <span className="text-[11px] font-bold text-emerald-400">
              {accuSig.isNeutral5050 ? '50/50' : `${accuSig.confidence}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
