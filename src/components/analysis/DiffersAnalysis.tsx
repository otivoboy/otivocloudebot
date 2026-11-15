import React, { useMemo, useState } from 'react';
import { Target, ShieldCheck, Globe } from 'lucide-react';
import { ANALYSIS_SYMBOLS, TickData } from './types';
import { cn } from '../../lib/utils';

interface DiffersAnalysisProps {
  symbol: string;
  ticks: TickData[];
  allMarketTicks?: Record<string, TickData[]>;
}

export const DiffersAnalysis: React.FC<DiffersAnalysisProps> = ({
  symbol,
  ticks,
  allMarketTicks = {},
}) => {
  const [selectedDigit, setSelectedDigit] = useState<number | null>(null);

  const engine = useMemo(() => {
    const counts = Array(10).fill(0);
    for (const t of ticks) counts[t.digit]++;
    const total = Math.max(1, ticks.length);
    const pcts = counts.map((c) => (c / total) * 100);

    const recent15 = ticks.slice(-15);
    const recent15Counts = Array(10).fill(0);
    for (const t of recent15) recent15Counts[t.digit]++;
    const recent15Pcts = recent15Counts.map((c) =>
      recent15.length > 0 ? (c / recent15.length) * 100 : 10
    );

    // Gap / absence since last seen
    const gaps = Array(10).fill(ticks.length);
    for (let d = 0; d <= 9; d++) {
      for (let i = ticks.length - 1; i >= 0; i--) {
        if (ticks[i].digit === d) {
          gaps[d] = ticks.length - 1 - i;
          break;
        }
      }
    }

    // Markov 1st-order transition P(next = d | current = lastDigit)
    const lastDigit = ticks.length > 0 ? ticks[ticks.length - 1].digit : 0;
    const transCounts = Array(10).fill(0);
    let transTotal = 0;
    for (let i = 0; i < ticks.length - 1; i++) {
      if (ticks[i].digit === lastDigit) {
        transCounts[ticks[i + 1].digit]++;
        transTotal++;
      }
    }
    const transProbs = transCounts.map((c) =>
      transTotal > 0 ? (c / transTotal) * 100 : 10
    );

    // Consecutive repeat rate
    let repeats = 0;
    for (let i = 1; i < ticks.length; i++) {
      if (ticks[i].digit === ticks[i - 1].digit) repeats++;
    }
    const repeatPct = ticks.length > 1 ? (repeats / (ticks.length - 1)) * 100 : 10;

    // 10-Tool composite safety score for DIFFERS (higher = safer to Differ on digit d)
    const scores = Array.from({ length: 10 }, (_, d) => {
      const longFreqPenalty = pcts[d] * 2.2;
      const shortFreqPenalty = recent15Pcts[d] * 1.4;
      const markovPenalty = transProbs[d] * 2.5;
      const lastRepeatBonus = d === lastDigit ? 6 : 0;
      const gapPenalty = gaps[d] > 18 ? 4 : 0; // slight mean-reversion penalty when overdue
      const safety = Math.max(
        50,
        Math.min(
          99.5,
          105 - longFreqPenalty * 0.35 - shortFreqPenalty * 0.25 - markovPenalty * 0.3 + lastRepeatBonus - gapPenalty
        )
      );
      return {
        digit: d,
        freq: pcts[d],
        recent15: recent15Pcts[d],
        gap: gaps[d],
        markovNextProb: transProbs[d],
        differWinScore: safety,
      };
    });

    const sortedBySafety = [...scores].sort((a, b) => b.differWinScore - a.differWinScore);
    const rankedByFreq = [...scores].sort((a, b) => a.freq - b.freq);
    const recommendedTarget = sortedBySafety[0]?.digit ?? 0;

    return {
      scores,
      sortedBySafety,
      rankedByFreq,
      recommendedTarget,
      lastDigit,
      repeatPct,
      antiRepeatPct: 100 - repeatPct,
    };
  }, [ticks]);

  // Multi-market Differs scanner across all subscribed symbols
  const multiMarketRankings = useMemo(() => {
    return Object.entries(allMarketTicks)
      .filter(([, list]) => list && list.length >= 15)
      .map(([sym, list]) => {
        const counts = Array(10).fill(0);
        for (const t of list) counts[t.digit]++;
        const total = list.length;
        let minD = 0;
        for (let d = 1; d <= 9; d++) {
          if (counts[d] < counts[minD]) minD = d;
        }
        const pct = (counts[minD] / total) * 100;
        const name = ANALYSIS_SYMBOLS.find((s) => s.id === sym)?.name || sym;
        return {
          symbol: sym,
          name,
          digit: minD,
          freq: pct,
          differConf: Math.max(80, Math.min(99.9, 100 - pct)),
          sample: total,
        };
      })
      .sort((a, b) => a.freq - b.freq)
      .slice(0, 8);
  }, [allMarketTicks]);

  const activeTarget = selectedDigit ?? engine.recommendedTarget;
  const activeStats = engine.scores[activeTarget];

  return (
    <div className="space-y-4">
      {/* Top Summary 10-Tool KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-purple-300">
            <span>Optimal Differ Target ({symbol})</span>
            <Target size={14} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-white">
              Digit {activeTarget}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">
              {activeStats?.differWinScore.toFixed(1)}% Safety
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Freq: {activeStats?.freq.toFixed(1)}% · Absent: {activeStats?.gap}t
          </p>
        </div>

        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>Coldest vs Hottest</span>
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-xs font-black">
              Cold: {engine.rankedByFreq[0]?.digit} ({engine.rankedByFreq[0]?.freq.toFixed(1)}%)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-black">
              Hot: {engine.rankedByFreq[9]?.digit} ({engine.rankedByFreq[9]?.freq.toFixed(1)}%)
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono pt-0.5">
            Markov P(Next={activeTarget}|{engine.lastDigit}):{' '}
            {activeStats?.markovNextProb.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-4 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Anti-Repeat Engine
          </span>
          <div className="text-2xl font-black font-mono text-indigo-400 tabular-nums">
            {engine.antiRepeatPct.toFixed(1)}%
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Repeat Rate: {engine.repeatPct.toFixed(1)}% · Current: {engine.lastDigit}
          </p>
        </div>
      </div>

      {/* 10-Digit Diagnostic Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {engine.scores.map((item) => {
          const isRec = item.digit === engine.recommendedTarget;
          const isSelected = item.digit === activeTarget;
          return (
            <button
              key={item.digit}
              type="button"
              onClick={() => setSelectedDigit(item.digit)}
              className={cn(
                'rounded-xl border p-2.5 text-left transition-all cursor-pointer',
                isSelected
                  ? 'border-purple-400 bg-purple-500/15 shadow-md shadow-purple-500/10'
                  : isRec
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-[#2d2f36] bg-[#0a0b0d] hover:border-slate-600'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-black font-mono text-white">
                  #{item.digit}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                    item.differWinScore >= 90
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-300'
                  )}
                >
                  {item.differWinScore.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] font-mono text-slate-400">
                <span>Freq {item.freq.toFixed(1)}%</span>
                <span>Gap {item.gap}t</span>
              </div>
              <div className="mt-0.5 text-[9px] font-mono text-slate-500">
                15t: {item.recent15.toFixed(0)}% · MKV: {item.markovNextProb.toFixed(0)}%
              </div>
            </button>
          );
        })}
      </div>

      {/* Multi-Market Differs Matrix */}
      {multiMarketRankings.length > 0 && (
        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
              <Globe size={13} /> Multi-Market Differs Prediction Scanner
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              Ranked by Lowest Frequency
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {multiMarketRankings.map((m) => (
              <div
                key={m.symbol}
                className="rounded-xl border border-white/5 bg-[#111217] p-2.5 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-white truncate">
                    {m.symbol}
                  </div>
                  <div className="text-[9px] font-mono text-slate-400">
                    Freq: {m.freq.toFixed(1)}%
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center font-mono font-black text-sm text-purple-300 shrink-0">
                  {m.digit}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
