import React, { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Target } from 'lucide-react';
import { TickData } from './types';
import { cn } from '../../lib/utils';

interface OverUnderAnalysisProps {
  symbol: string;
  ticks: TickData[];
  decimals: number;
  compact?: boolean;
}

export const OverUnderAnalysis: React.FC<OverUnderAnalysisProps> = ({
  symbol,
  ticks,
  decimals,
  compact = false,
}) => {
  const [barrier, setBarrier] = useState<number>(4);

  const metrics = useMemo(() => {
    const counts = Array(10).fill(0);
    let overCount = 0;
    let underCount = 0;
    let equalCount = 0;
    let over5 = 0;
    let under4 = 0;
    let over1 = 0;
    let under8 = 0;

    for (const t of ticks) {
      counts[t.digit]++;
      if (t.digit > barrier) overCount++;
      else if (t.digit < barrier) underCount++;
      else equalCount++;

      if (t.digit > 5) over5++;
      if (t.digit < 4) under4++;
      if (t.digit > 1) over1++;
      if (t.digit < 8) under8++;
    }

    const total = Math.max(1, ticks.length);
    const overPct = (overCount / total) * 100;
    const underPct = (underCount / total) * 100;
    const equalPct = (equalCount / total) * 100;

    const recent25 = ticks.slice(-25);
    const recentOver = recent25.filter((t) => t.digit > barrier).length;
    const recentUnder = recent25.filter((t) => t.digit < barrier).length;

    let streakSide: 'OVER' | 'UNDER' | 'BARRIER' = 'BARRIER';
    let streakLen = 0;
    for (let i = ticks.length - 1; i >= 0; i--) {
      const side: 'OVER' | 'UNDER' | 'BARRIER' =
        ticks[i].digit > barrier
          ? 'OVER'
          : ticks[i].digit < barrier
          ? 'UNDER'
          : 'BARRIER';
      if (i === ticks.length - 1) {
        streakSide = side;
        streakLen = 1;
      } else if (side === streakSide) {
        streakLen++;
      } else {
        break;
      }
    }

    const digitPcts = counts.map((c) => (c / total) * 100);
    const recommended: 'OVER' | 'UNDER' = overPct >= underPct ? 'OVER' : 'UNDER';
    const edgePct = Math.max(overPct, underPct);

    return {
      overPct,
      underPct,
      equalPct,
      over5Pct: (over5 / total) * 100,
      under4Pct: (under4 / total) * 100,
      over1Pct: (over1 / total) * 100,
      under8Pct: (under8 / total) * 100,
      recentOverPct: recent25.length > 0 ? (recentOver / recent25.length) * 100 : 50,
      recentUnderPct: recent25.length > 0 ? (recentUnder / recent25.length) * 100 : 50,
      streakSide,
      streakLen,
      digitPcts,
      recommended,
      edgePct,
    };
  }, [ticks, barrier]);

  const latest = ticks[ticks.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Barrier Digit:
          </span>
          <div className="flex flex-wrap gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setBarrier(d)}
                className={cn(
                  'h-7 w-7 rounded-lg font-mono text-xs font-black transition-all cursor-pointer border',
                  barrier === d
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                    : 'bg-[#0a0b0d] text-slate-400 border-[#2d2f36] hover:text-white'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500">{symbol}</span>
          {latest && (
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white font-bold">
              {latest.quote.toFixed(decimals)} ({latest.digit})
            </span>
          )}
        </div>
      </div>

      {/* Over vs Under Split Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <span>OVER {barrier}</span>
            <TrendingUp size={14} />
          </div>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {metrics.overPct.toFixed(1)}%
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${metrics.overPct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Last 25t: {metrics.recentOverPct.toFixed(0)}%
          </p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-rose-400">
            <span>UNDER {barrier}</span>
            <TrendingDown size={14} />
          </div>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {metrics.underPct.toFixed(1)}%
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-rose-500 transition-all duration-300"
              style={{ width: `${metrics.underPct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Last 25t: {metrics.recentUnderPct.toFixed(0)}%
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-indigo-300">
            <span>Active Entry Bias</span>
            <Target size={14} />
          </div>
          <div className="text-xl font-black text-white">
            {metrics.recommended} {barrier}
          </div>
          <p className="text-[11px] font-mono text-indigo-300">
            Strength: {metrics.edgePct.toFixed(1)}% · Equal: {metrics.equalPct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Streak: {metrics.streakLen}x {metrics.streakSide}
          </p>
        </div>
      </div>

      {/* High-Probability Preset Pairs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Over 1 Rate', val: metrics.over1Pct, good: metrics.over1Pct >= 80 },
          { label: 'Under 8 Rate', val: metrics.under8Pct, good: metrics.under8Pct >= 80 },
          { label: 'Over 5+ Rate', val: metrics.over5Pct, good: metrics.over5Pct >= 45 },
          { label: 'Under 4 Rate', val: metrics.under4Pct, good: metrics.under4Pct >= 45 },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[#2d2f36] bg-[#0a0b0d] px-3 py-2 flex items-center justify-between"
          >
            <span className="text-[10px] font-bold uppercase text-slate-400">
              {item.label}
            </span>
            <span
              className={cn(
                'font-mono text-xs font-black tabular-nums',
                item.good ? 'text-emerald-400' : 'text-slate-300'
              )}
            >
              {item.val.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* 0-9 Distribution Relative to Barrier */}
      {!compact && (
        <div className="grid grid-cols-10 gap-1.5 pt-1">
          {metrics.digitPcts.map((pct, d) => {
            const isOver = d > barrier;
            const isUnder = d < barrier;
            return (
              <div
                key={d}
                className={cn(
                  'rounded-xl border p-2 text-center transition-all',
                  isOver
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : isUnder
                    ? 'border-rose-500/30 bg-rose-500/10'
                    : 'border-amber-500/40 bg-amber-500/10'
                )}
              >
                <div className="text-xs font-black text-white font-mono">{d}</div>
                <div className="text-[9px] font-mono text-slate-300">
                  {pct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent 20 Digits Tape */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 shrink-0 mr-1">
          Tape:
        </span>
        {ticks.slice(-20).map((t, idx) => (
          <span
            key={`${t.epoch}-${idx}`}
            className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black font-mono shrink-0 border',
              t.digit > barrier
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : t.digit < barrier
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            )}
          >
            {t.digit}
          </span>
        ))}
      </div>
    </div>
  );
};
