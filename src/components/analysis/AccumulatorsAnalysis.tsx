import React, { useMemo, useState } from 'react';
import { Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { TickData, isVolatilityIndex } from './types';
import { cn } from '../../lib/utils';

interface AccumulatorsAnalysisProps {
  symbol: string;
  ticks: TickData[];
  decimals: number;
}

export const AccumulatorsAnalysis: React.FC<AccumulatorsAnalysisProps> = ({
  symbol,
  ticks,
  decimals,
}) => {
  const [growthRate, setGrowthRate] = useState<number>(2);

  const isVol = isVolatilityIndex(symbol);

  const metrics = useMemo(() => {
    const slice = ticks.slice(-60);
    if (slice.length < 10) {
      return {
        noiseScore: 50,
        choppiness: 50,
        spikeRisk: 'MEDIUM' as const,
        avgStep: 0,
        maxStep: 0,
        safeRunEstimate: 0,
        verdict: 'WAIT' as const,
        recentSteps: [] as number[],
      };
    }

    const deltas: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      deltas.push(Math.abs(slice[i].quote - slice[i - 1].quote));
    }
    const avgStep = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const maxStep = Math.max(...deltas);
    const recent10 = deltas.slice(-10);
    const recentAvg =
      recent10.reduce((a, b) => a + b, 0) / Math.max(1, recent10.length);

    // Choppiness / direction flips
    let flips = 0;
    for (let i = 2; i < slice.length; i++) {
      const prevDir = slice[i - 1].quote - slice[i - 2].quote;
      const curDir = slice[i].quote - slice[i - 1].quote;
      if (prevDir * curDir < 0) flips++;
    }
    const flipRate = (flips / Math.max(1, slice.length - 2)) * 100;

    // Noise score (lower is calmer)
    const accelRatio = avgStep > 0 ? recentAvg / avgStep : 1;
    const noiseScore = Math.max(
      12,
      Math.min(98, Math.round(accelRatio * 38 + (100 - flipRate) * 0.25))
    );

    const spikeRisk: 'LOW' | 'MEDIUM' | 'HIGH' =
      noiseScore <= 42 ? 'LOW' : noiseScore <= 64 ? 'MEDIUM' : 'HIGH';

    // Tightness limit scales inversely with growth rate
    const barrierFactor = 6 - growthRate; // 1% -> 5, 5% -> 1
    const safeRunEstimate = Math.max(
      1,
      Math.round((100 - noiseScore) / (8 - barrierFactor))
    );

    const verdict: 'ENTER' | 'WAIT' =
      isVol && noiseScore <= 46 && spikeRisk !== 'HIGH' ? 'ENTER' : 'WAIT';

    return {
      noiseScore,
      choppiness: Math.round(flipRate),
      spikeRisk,
      avgStep,
      maxStep,
      safeRunEstimate,
      verdict,
      recentSteps: deltas.slice(-16),
    };
  }, [ticks, growthRate, isVol]);

  return (
    <div className="space-y-4">
      {!isVol && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center gap-2">
          <ShieldAlert size={16} className="text-amber-400 shrink-0" />
          <span>
            Deriv Accumulators require a Volatility Index (e.g. R_10..R_100 or 1HZ10V..1HZ100V). Switch this window to a Volatility symbol.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            Growth Rate:
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setGrowthRate(pct)}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-mono text-xs font-black border cursor-pointer transition-all',
                  growthRate === pct
                    ? 'bg-amber-500 text-black border-amber-400'
                    : 'bg-[#0a0b0d] text-slate-400 border-[#2d2f36] hover:text-white'
                )}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'px-3 py-1 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center gap-1.5',
            metrics.verdict === 'ENTER'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          )}
        >
          {metrics.verdict === 'ENTER' ? (
            <CheckCircle2 size={14} />
          ) : (
            <Zap size={14} />
          )}
          <span>AMFE Verdict: {metrics.verdict}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-3.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
            Noise Score
          </span>
          <div
            className={cn(
              'text-2xl font-black font-mono mt-1',
              metrics.noiseScore <= 42
                ? 'text-emerald-400'
                : metrics.noiseScore <= 64
                ? 'text-amber-400'
                : 'text-rose-400'
            )}
          >
            {metrics.noiseScore}/100
          </div>
          <span className="text-[9px] text-slate-500 font-mono">Calm &le; 42</span>
        </div>

        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-3.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
            Spike Risk
          </span>
          <div
            className={cn(
              'text-xl font-black mt-1',
              metrics.spikeRisk === 'LOW'
                ? 'text-emerald-400'
                : metrics.spikeRisk === 'MEDIUM'
                ? 'text-amber-400'
                : 'text-rose-400'
            )}
          >
            {metrics.spikeRisk}
          </div>
          <span className="text-[9px] text-slate-500 font-mono">
            Chop: {metrics.choppiness}%
          </span>
        </div>

        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-3.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
            Avg Tick Step
          </span>
          <div className="text-lg font-black font-mono text-white mt-1">
            {metrics.avgStep.toFixed(decimals)}
          </div>
          <span className="text-[9px] text-slate-500 font-mono">
            Max: {metrics.maxStep.toFixed(decimals)}
          </span>
        </div>

        <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-3.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
            Est. Safe Ticks
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {metrics.safeRunEstimate}t
          </div>
          <span className="text-[9px] text-slate-500 font-mono">
            @ {growthRate}% Growth
          </span>
        </div>
      </div>

      {/* Recent Tick Step Magnitude Bars */}
      <div className="rounded-xl border border-[#2d2f36] bg-[#0a0b0d] p-3 space-y-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
          Recent Tick Displacement Impulse
        </span>
        <div className="flex items-end gap-1.5 h-16">
          {metrics.recentSteps.map((step, i) => {
            const ratio =
              metrics.maxStep > 0 ? Math.max(8, (step / metrics.maxStep) * 100) : 20;
            const isSpike = metrics.avgStep > 0 && step > metrics.avgStep * 1.65;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-t transition-all',
                  isSpike ? 'bg-rose-500' : 'bg-amber-400/80'
                )}
                style={{ height: `${ratio}%` }}
                title={`Step ${step.toFixed(decimals)}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
