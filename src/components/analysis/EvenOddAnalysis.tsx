import React, { useMemo } from 'react';
import { Scale, Zap } from 'lucide-react';
import { TickData } from './types';
import { cn } from '../../lib/utils';

interface EvenOddAnalysisProps {
  symbol: string;
  ticks: TickData[];
}

export const EvenOddAnalysis: React.FC<EvenOddAnalysisProps> = ({ symbol, ticks }) => {
  const stats = useMemo(() => {
    const counts = Array(10).fill(0);
    let even = 0;
    let odd = 0;
    let alternations = 0;

    for (let i = 0; i < ticks.length; i++) {
      const d = ticks[i].digit;
      counts[d]++;
      if (d % 2 === 0) even++;
      else odd++;
      if (i > 0 && ticks[i].digit % 2 !== ticks[i - 1].digit % 2) {
        alternations++;
      }
    }

    const total = Math.max(1, ticks.length);
    const recent25 = ticks.slice(-25);
    const recentEven = recent25.filter((t) => t.digit % 2 === 0).length;
    const recentEvenPct =
      recent25.length > 0 ? (recentEven / recent25.length) * 100 : 50;

    let currentParity: 'EVEN' | 'ODD' =
      ticks.length > 0 && ticks[ticks.length - 1].digit % 2 === 0 ? 'EVEN' : 'ODD';
    let streak = 0;
    for (let i = ticks.length - 1; i >= 0; i--) {
      const p: 'EVEN' | 'ODD' = ticks[i].digit % 2 === 0 ? 'EVEN' : 'ODD';
      if (p === currentParity) streak++;
      else break;
    }

    const evenPct = (even / total) * 100;
    const oddPct = (odd / total) * 100;
    const altRate = ticks.length > 1 ? (alternations / (ticks.length - 1)) * 100 : 50;

    const signal: 'EVEN' | 'ODD' =
      streak >= 4
        ? currentParity === 'EVEN'
          ? 'ODD'
          : 'EVEN'
        : evenPct >= oddPct
        ? 'EVEN'
        : 'ODD';

    return {
      evenPct,
      oddPct,
      recentEvenPct,
      recentOddPct: 100 - recentEvenPct,
      currentParity,
      streak,
      altRate,
      signal,
      digitPcts: counts.map((c) => (c / total) * 100),
    };
  }, [ticks]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
            EVEN DIGITS (0,2,4,6,8)
          </span>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {stats.evenPct.toFixed(1)}%
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${stats.evenPct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            25t Window: {stats.recentEvenPct.toFixed(0)}%
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
            ODD DIGITS (1,3,5,7,9)
          </span>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {stats.oddPct.toFixed(1)}%
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${stats.oddPct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            25t Window: {stats.recentOddPct.toFixed(0)}%
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-amber-300">
            <span>Parity Engine ({symbol})</span>
            <Scale size={14} />
          </div>
          <div className="text-xl font-black text-white flex items-center gap-2">
            <span>{stats.signal}</span>
            <Zap size={15} className="text-amber-400" />
          </div>
          <p className="text-[10px] font-mono text-slate-300">
            Active Streak: {stats.streak}x {stats.currentParity}
          </p>
          <p className="text-[10px] font-mono text-slate-400">
            Alternation Rate: {stats.altRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Parity Breakdown per Digit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#2d2f36] bg-[#0a0b0d] p-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-2">
            Even Digits Breakdown
          </span>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[0, 2, 4, 6, 8].map((d) => (
              <div
                key={d}
                className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-1.5"
              >
                <div className="text-xs font-black text-white font-mono">{d}</div>
                <div className="text-[9px] text-emerald-300 font-mono">
                  {stats.digitPcts[d].toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#2d2f36] bg-[#0a0b0d] p-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block mb-2">
            Odd Digits Breakdown
          </span>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[1, 3, 5, 7, 9].map((d) => (
              <div
                key={d}
                className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 py-1.5"
              >
                <div className="text-xs font-black text-white font-mono">{d}</div>
                <div className="text-[9px] text-indigo-300 font-mono">
                  {stats.digitPcts[d].toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Even/Odd Sequence */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 shrink-0 mr-1">
          Parity Stream:
        </span>
        {ticks.slice(-24).map((t, idx) => {
          const isEven = t.digit % 2 === 0;
          return (
            <span
              key={`${t.epoch}-${idx}`}
              className={cn(
                'px-2 h-6 rounded-md flex items-center justify-center text-[10px] font-black font-mono shrink-0 border',
                isEven
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
              )}
            >
              {isEven ? 'E' : 'O'}({t.digit})
            </span>
          );
        })}
      </div>
    </div>
  );
};
