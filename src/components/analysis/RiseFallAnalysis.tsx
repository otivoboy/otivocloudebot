import React, { useMemo } from 'react';
import { TrendingDown, TrendingUp, Activity } from 'lucide-react';
import { CandleData, DerivTimeframe, TickData, TimeframeSignal } from './types';
import { DERIV_TIMEFRAME_CONFIG, evaluateTimeframeSignal } from './derivTimeframes';
import { cn } from '../../lib/utils';

interface RiseFallAnalysisProps {
  symbol: string;
  ticks: TickData[];
  candles: CandleData[];
  timeframeCandles: Record<string, CandleData[]>;
  activeTimeframe: DerivTimeframe;
}

export const RiseFallAnalysis: React.FC<RiseFallAnalysisProps> = ({
  symbol,
  ticks,
  timeframeCandles,
  activeTimeframe,
}) => {
  const tfSignals = useMemo<TimeframeSignal[]>(() => {
    const list: DerivTimeframe[] = ['1t', '1m', '3m', '5m', '15m', '30m', '1h', '5h', '1d'];
    return list.map((tf) => {
      const cfg = DERIV_TIMEFRAME_CONFIG[tf];
      let data = timeframeCandles[tf];
      if (tf === '1t' || !data || data.length === 0) {
        data = ticks.slice(-150).map((t) => ({
          epoch: t.epoch,
          open: t.quote,
          high: t.quote,
          low: t.quote,
          close: t.quote,
        }));
      }
      return evaluateTimeframeSignal(tf, cfg.label, data);
    });
  }, [timeframeCandles, ticks]);

  const momentum = useMemo(() => {
    let rises = 0;
    let falls = 0;
    for (let i = 1; i < ticks.length; i++) {
      if (ticks[i].quote > ticks[i - 1].quote) rises++;
      else if (ticks[i].quote < ticks[i - 1].quote) falls++;
    }
    const total = Math.max(1, rises + falls);
    const risePct = (rises / total) * 100;
    const fallPct = (falls / total) * 100;

    const riseVotes = tfSignals.filter((s) => s.direction === 'RISE').length;
    const fallVotes = tfSignals.filter((s) => s.direction === 'FALL').length;
    const consensus: 'RISE' | 'FALL' | 'NEUTRAL' =
      riseVotes > fallVotes + 1
        ? 'RISE'
        : fallVotes > riseVotes + 1
        ? 'FALL'
        : risePct > fallPct + 4
        ? 'RISE'
        : fallPct > risePct + 4
        ? 'FALL'
        : 'NEUTRAL';

    return { risePct, fallPct, riseVotes, fallVotes, consensus };
  }, [ticks, tfSignals]);

  // Mini SVG sparkline for recent 60 ticks
  const sparkPath = useMemo(() => {
    const slice = ticks.slice(-60);
    if (slice.length < 2) return { line: '', area: '' };
    const quotes = slice.map((t) => t.quote);
    const min = Math.min(...quotes);
    const max = Math.max(...quotes);
    const range = max - min || 1;
    const w = 400;
    const h = 90;
    const pts = slice.map((t, idx) => {
      const x = (idx / (slice.length - 1)) * w;
      const y = h - 8 - ((t.quote - min) / range) * (h - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return {
      line: `M ${pts.join(' L ')}`,
      area: `M 0,${h} L ${pts.join(' L ')} L ${w},${h} Z`,
    };
  }, [ticks]);

  const activeSig =
    tfSignals.find((s) => s.tf === activeTimeframe) || tfSignals[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-400">
            <span>Tick Rise Flow</span>
            <TrendingUp size={14} />
          </div>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {momentum.risePct.toFixed(1)}%
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            TF Bullish Votes: {momentum.riseVotes}/{tfSignals.length}
          </p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-rose-400">
            <span>Tick Fall Flow</span>
            <TrendingDown size={14} />
          </div>
          <div className="text-2xl font-black font-mono text-white tabular-nums">
            {momentum.fallPct.toFixed(1)}%
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            TF Bearish Votes: {momentum.fallVotes}/{tfSignals.length}
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-indigo-300">
            <span>Consensus ({symbol})</span>
            <Activity size={14} />
          </div>
          <div
            className={cn(
              'text-xl font-black',
              momentum.consensus === 'RISE'
                ? 'text-emerald-400'
                : momentum.consensus === 'FALL'
                ? 'text-rose-400'
                : 'text-amber-300'
            )}
          >
            {momentum.consensus}
          </div>
          <p className="text-[10px] font-mono text-slate-300">
            {activeTimeframe.toUpperCase()} RSI: {activeSig?.rsi ?? 50} · Conf:{' '}
            {activeSig?.strength ?? 50}%
          </p>
        </div>
      </div>

      {/* Price Flow Sparkline */}
      <div className="rounded-2xl border border-[#2d2f36] bg-[#0a0b0d] p-3">
        <svg viewBox="0 0 400 90" className="w-full h-24">
          <defs>
            <linearGradient id={`rf-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={momentum.consensus === 'FALL' ? '#f43f5e' : '#10b981'}
                stopOpacity="0.35"
              />
              <stop
                offset="100%"
                stopColor={momentum.consensus === 'FALL' ? '#f43f5e' : '#10b981'}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {sparkPath.area && (
            <path d={sparkPath.area} fill={`url(#rf-${symbol})`} />
          )}
          {sparkPath.line && (
            <path
              d={sparkPath.line}
              fill="none"
              stroke={momentum.consensus === 'FALL' ? '#f43f5e' : '#10b981'}
              strokeWidth="2.5"
            />
          )}
        </svg>
      </div>

      {/* Multi-Timeframe Matrix */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
        {tfSignals.map((sig) => (
          <div
            key={sig.tf}
            className={cn(
              'rounded-xl border p-2 text-center transition-all',
              sig.tf === activeTimeframe
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-[#2d2f36] bg-[#0a0b0d]'
            )}
          >
            <div className="text-[9px] font-black uppercase text-slate-400">
              {sig.tf}
            </div>
            <div
              className={cn(
                'text-[11px] font-black mt-0.5',
                sig.direction === 'RISE'
                  ? 'text-emerald-400'
                  : sig.direction === 'FALL'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              )}
            >
              {sig.direction}
            </div>
            <div className="text-[9px] font-mono text-slate-500">
              RSI {sig.rsi.toFixed(0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
