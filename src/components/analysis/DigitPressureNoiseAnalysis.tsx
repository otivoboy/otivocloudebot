import React, { useMemo } from 'react';
import { Activity, Zap } from 'lucide-react';
import { TickData } from './types';
import { cn } from '../../lib/utils';

interface DigitPressureNoiseAnalysisProps {
  symbol: string;
  ticks: TickData[];
  decimals: number;
}

export const DigitPressureNoiseAnalysis: React.FC<DigitPressureNoiseAnalysisProps> = ({
  symbol,
  ticks,
  decimals,
}) => {
  const analysis = useMemo(() => {
    const counts = Array(10).fill(0);
    const recent30 = ticks.slice(-30);
    const recentCounts = Array(10).fill(0);

    for (const t of ticks) counts[t.digit]++;
    for (const t of recent30) recentCounts[t.digit]++;

    const total = Math.max(1, ticks.length);
    const recentTotal = Math.max(1, recent30.length);

    // Entropy / Noise measurement across 0-9
    let entropy = 0;
    const digitMetrics = Array.from({ length: 10 }, (_, d) => {
      const longPct = (counts[d] / total) * 100;
      const shortPct = (recentCounts[d] / recentTotal) * 100;
      const p = counts[d] / total;
      if (p > 0) entropy -= p * Math.log2(p);
      // Pressure: rising recent short-window vs long-term baseline
      const pressure = shortPct - longPct;
      return { digit: d, longPct, shortPct, pressure };
    });

    const maxEntropy = Math.log2(10); // ~3.3219
    const noiseIndex = Math.round((entropy / maxEntropy) * 100);

    const highPressurePct =
      ticks.length > 0
        ? (ticks.filter((t) => t.digit >= 5).length / ticks.length) * 100
        : 50;
    const lowPressurePct = 100 - highPressurePct;

    const over1Pct =
      recent30.length > 0
        ? (recent30.filter((t) => t.digit > 1).length / recent30.length) * 100
        : 80;
    const under8Pct =
      recent30.length > 0
        ? (recent30.filter((t) => t.digit < 8).length / recent30.length) * 100
        : 80;

    const entryRecommendation =
      over1Pct >= 86.7
        ? { label: 'OVER 1 PRESSURE', side: 'over', strength: over1Pct }
        : under8Pct >= 86.7
        ? { label: 'UNDER 8 PRESSURE', side: 'under', strength: under8Pct }
        : highPressurePct >= 56
        ? { label: 'OVER 4 MOMENTUM', side: 'over', strength: highPressurePct }
        : { label: 'UNDER 5 MOMENTUM', side: 'under', strength: lowPressurePct };

    return {
      digitMetrics,
      noiseIndex,
      highPressurePct,
      lowPressurePct,
      over1Pct,
      under8Pct,
      entryRecommendation,
    };
  }, [ticks]);

  const latest = ticks[ticks.length - 1];

  return (
    <div className="space-y-4">
      {/* Summary Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-indigo-300">
            <span>Digit Entropy / Noise</span>
            <Activity size={14} />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {analysis.noiseIndex}%
          </div>
          <p className="text-[10px] font-mono text-slate-400">
            {symbol} · Spot {latest ? latest.quote.toFixed(decimals) : '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-4 space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            High (5–9) vs Low (0–4) Pressure
          </span>
          <div className="flex items-center justify-between text-xs font-mono font-black">
            <span className="text-emerald-400">
              High: {analysis.highPressurePct.toFixed(1)}%
            </span>
            <span className="text-rose-400">
              Low: {analysis.lowPressurePct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-rose-500/40 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${analysis.highPressurePct}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-300">
            <span>Pressure Entry Engine</span>
            <Zap size={14} />
          </div>
          <div className="text-lg font-black text-white">
            {analysis.entryRecommendation.label}
          </div>
          <p className="text-[10px] font-mono text-emerald-300">
            30t Confidence: {analysis.entryRecommendation.strength.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* 0-9 Digit Pressure Vectors */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
        {analysis.digitMetrics.map((m) => {
          const isSurge = m.pressure > 2.5;
          const isDrop = m.pressure < -2.5;
          return (
            <div
              key={m.digit}
              className={cn(
                'rounded-xl border p-2 text-center transition-all',
                isSurge
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : isDrop
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : 'border-[#2d2f36] bg-[#0a0b0d]'
              )}
            >
              <div className="text-xs font-black text-white font-mono">{m.digit}</div>
              <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                {m.shortPct.toFixed(0)}%
              </div>
              <div
                className={cn(
                  'text-[9px] font-mono font-bold mt-0.5',
                  m.pressure >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {m.pressure >= 0 ? '+' : ''}
                {m.pressure.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
