import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ArrowRight, Play } from 'lucide-react';
import {
  BotSettings,
  DEFAULT_SETTINGS,
  MARKETS,
  MT5_SYMBOLS,
  SessionStats,
  TickPoint,
  TradeType,
} from '../types';
import { ContractIcon, MarketLogo } from '../components/ContractIcons';

interface AnalysisPageProps {
  multiTicks: Record<string, TickPoint[]>;
  connected: boolean;
  session: SessionStats;
  currentSettings: BotSettings;
  onSubscribeMarkets: (symbols: string[]) => void;
  onLoadToTerminal: (settings: BotSettings) => void;
  onStartWithSettings: (settings: BotSettings) => Promise<void>;
}

type AnalysisMode =
  | 'over_under'
  | 'even_odd'
  | 'rise_fall'
  | 'differs'
  | 'accumulators';

const ALL_ANALYSIS_MARKETS = [
  ...MARKETS,
  ...MT5_SYMBOLS.filter((m) => !MARKETS.some((x) => x.symbol === m.symbol)),
];

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  multiTicks,
  connected,
  session,
  currentSettings,
  onSubscribeMarkets,
  onLoadToTerminal,
  onStartWithSettings,
}) => {
  const [symbol, setSymbol] = useState<string>(
    () => localStorage.getItem('otivo_analysis_symbol') || 'R_100'
  );
  const [windowSize, setWindowSize] = useState<number>(() =>
    Math.min(200, Math.max(25, Number(localStorage.getItem('otivo_analysis_window')) || 100))
  );
  const [mode, setMode] = useState<AnalysisMode>(
    () => (localStorage.getItem('otivo_analysis_mode') as AnalysisMode) || 'over_under'
  );
  const [barrierDigit, setBarrierDigit] = useState<number>(() =>
    Number(localStorage.getItem('otivo_analysis_barrier') ?? 4)
  );
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('otivo_analysis_symbol', symbol);
  }, [symbol]);

  useEffect(() => {
    localStorage.setItem('otivo_analysis_window', String(windowSize));
  }, [windowSize]);

  useEffect(() => {
    localStorage.setItem('otivo_analysis_mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('otivo_analysis_barrier', String(barrierDigit));
  }, [barrierDigit]);

  useEffect(() => {
    onSubscribeMarkets([symbol]);
  }, [symbol]);

  const rawTicks = multiTicks[symbol] || [];
  const ticks = useMemo(() => rawTicks.slice(-windowSize), [rawTicks, windowSize]);
  const latestTick = ticks.length > 0 ? ticks[ticks.length - 1] : null;
  const isRunning = session.status === 'running' || session.status === 'stopping';

  const stats = useMemo(() => {
    const counts = Array(10).fill(0);
    let even = 0;
    let odd = 0;
    let rises = 0;
    let falls = 0;
    let overCount = 0;
    let underCount = 0;
    let deltas: number[] = [];

    for (let i = 0; i < ticks.length; i++) {
      const d = ticks[i].lastDigit;
      counts[d]++;
      if (d % 2 === 0) even++;
      else odd++;
      if (d > barrierDigit) overCount++;
      if (d < barrierDigit) underCount++;
      if (i > 0) {
        const diff = ticks[i].quote - ticks[i - 1].quote;
        deltas.push(Math.abs(diff));
        if (diff > 0) rises++;
        else if (diff < 0) falls++;
      }
    }

    const total = Math.max(1, ticks.length);
    const pcts = counts.map((c) => (c / total) * 100);
    const ranked = pcts
      .map((pct, digit) => ({ digit, pct, count: counts[digit] }))
      .sort((a, b) => b.pct - a.pct);

    const hottest = ranked[0]?.digit ?? 0;
    const secondHottest = ranked[1]?.digit ?? 1;
    const coldest = ranked[ranked.length - 1]?.digit ?? 9;
    const secondColdest = ranked[ranked.length - 2]?.digit ?? 8;

    const avgDelta =
      deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const lastDelta = deltas.length > 0 ? deltas[deltas.length - 1] : 0;
    const calmScore =
      avgDelta > 0 ? Math.max(10, Math.min(99, Math.round(100 - (lastDelta / avgDelta) * 35))) : 50;

    return {
      pcts,
      counts,
      hottest,
      secondHottest,
      coldest,
      secondColdest,
      evenPct: (even / total) * 100,
      oddPct: (odd / total) * 100,
      risePct: rises + falls > 0 ? (rises / (rises + falls)) * 100 : 50,
      fallPct: rises + falls > 0 ? (falls / (rises + falls)) * 100 : 50,
      overPct: (overCount / total) * 100,
      underPct: (underCount / total) * 100,
      calmScore,
    };
  }, [ticks, barrierDigit]);

  const getDigitColor = (digit: number) => {
    if (digit === stats.hottest) return '#00a79e';
    if (digit === stats.secondHottest) return '#3b82f6';
    if (digit === stats.coldest) return '#ff444f';
    if (digit === stats.secondColdest) return '#f59e0b';
    return '#64748b';
  };

  const recommendedSignal = useMemo((): {
    type: TradeType;
    digit?: number;
    growth?: number;
    headline: string;
    detail: string;
  } => {
    if (mode === 'over_under') {
      const pickOver = stats.overPct >= stats.underPct;
      return {
        type: pickOver ? 'Over' : 'Under',
        digit: barrierDigit,
        headline: `${pickOver ? 'OVER' : 'UNDER'} ${barrierDigit} (${Math.max(stats.overPct, stats.underPct).toFixed(1)}%)`,
        detail: `Over ${barrierDigit}: ${stats.overPct.toFixed(1)}% vs Under ${barrierDigit}: ${stats.underPct.toFixed(1)}% over last ${ticks.length} ticks.`,
      };
    }
    if (mode === 'even_odd') {
      const pickEven = stats.evenPct >= stats.oddPct;
      return {
        type: pickEven ? 'Even' : 'Odd',
        headline: `${pickEven ? 'EVEN' : 'ODD'} Momentum (${Math.max(stats.evenPct, stats.oddPct).toFixed(1)}%)`,
        detail: `Even ${stats.evenPct.toFixed(1)}% · Odd ${stats.oddPct.toFixed(1)}% across ${ticks.length} ticks.`,
      };
    }
    if (mode === 'rise_fall') {
      const pickRise = stats.risePct >= stats.fallPct;
      return {
        type: pickRise ? 'Rise' : 'Fall',
        headline: `${pickRise ? 'RISE' : 'FALL'} Bias (${Math.max(stats.risePct, stats.fallPct).toFixed(1)}%)`,
        detail: `Upward ticks ${stats.risePct.toFixed(1)}% vs Downward ticks ${stats.fallPct.toFixed(1)}%.`,
      };
    }
    if (mode === 'accumulators') {
      const growth = stats.calmScore >= 75 ? 0.03 : stats.calmScore >= 55 ? 0.02 : 0.01;
      return {
        type: 'Accumulator',
        growth,
        headline: `Accumulator ${Math.round(growth * 100)}% (Stability ${stats.calmScore}%)`,
        detail: `Tick step calm index at ${stats.calmScore}/100 suggests ${Math.round(growth * 100)}% growth band.`,
      };
    }
    return {
      type: 'Differs',
      digit: stats.coldest,
      headline: `DIFFERS Digit ${stats.coldest} (${stats.pcts[stats.coldest].toFixed(1)}%)`,
      detail: `Digit ${stats.coldest} appeared least frequently (${stats.counts[stats.coldest]} times in ${ticks.length} ticks).`,
    };
  }, [mode, stats, barrierDigit, ticks.length]);

  const buildSettingsFromSignal = (): BotSettings => {
    const next: BotSettings = {
      ...currentSettings,
      market: MARKETS.some((m) => m.symbol === symbol) ? symbol : DEFAULT_SETTINGS.market,
      mode: 'single',
      types: [recommendedSignal.type],
    };
    if (recommendedSignal.digit !== undefined) {
      if (
        recommendedSignal.type === 'Differs' ||
        recommendedSignal.type === 'Over' ||
        recommendedSignal.type === 'Under'
      ) {
        next.digits = {
          ...next.digits,
          [recommendedSignal.type]: recommendedSignal.digit,
        };
      }
    }
    if (recommendedSignal.growth !== undefined) {
      next.growth = recommendedSignal.growth;
    }
    return next;
  };

  const handleQuickRun = async () => {
    setActionError(null);
    if (!connected) {
      setActionError('Connect your Deriv API token using the red button in the top bar first.');
      return;
    }
    try {
      await onStartWithSettings(buildSettingsFromSignal());
    } catch (err: any) {
      setActionError(err?.message || 'Could not start signal trade.');
    }
  };

  const maxBarPct = Math.max(15, ...stats.pcts);

  return (
    <div className="space-y-5">
      {/* Header Controls */}
      <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <MarketLogo symbol={symbol} className="w-10 h-10" />
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <h1 className="text-base font-semibold text-white">Live Market Analysis Tool</h1>
            </div>
            <p className="mt-0.5 font-mono text-xs text-slate-400 tabular-nums">
              {latestTick
                ? `Spot: ${latestTick.quote} · Last Digit: ${latestTick.lastDigit} · Sample: ${ticks.length} ticks`
                : 'Connecting to live Deriv tick feed...'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            {ALL_ANALYSIS_MARKETS.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                {m.label} ({m.symbol})
              </option>
            ))}
          </select>

          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            {[50, 100, 150, 200].map((w) => (
              <option key={w} value={w}>
                Last {w} ticks
              </option>
            ))}
          </select>
        </div>
      </section>

      {actionError && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-xs text-red-300">
          {actionError}
        </div>
      )}

      {/* Digit Frequency Chart + 2x5 Circular Digit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SVG Frequency Bar Chart */}
        <section className="lg:col-span-6 rounded-xl border border-[#1F2937] bg-[#111827] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Digit Frequency Distribution</h2>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#00a79e]" /> Hottest ({stats.hottest})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#ff444f]" /> Coldest ({stats.coldest})
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 400 185" className="w-full h-48">
              {[0, 5, 10, 15, 20].map((pctMark) => {
                const y = 150 - (pctMark / maxBarPct) * 125;
                if (y < 15) return null;
                return (
                  <g key={pctMark}>
                    <line
                      x1="28"
                      y1={y}
                      x2="392"
                      y2={y}
                      stroke="#1F2937"
                      strokeDasharray="3 3"
                    />
                    <text
                      x="24"
                      y={y + 3}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="var(--font-sans)"
                    >
                      {pctMark}%
                    </text>
                  </g>
                );
              })}

              {stats.pcts.map((pct, d) => {
                const barW = 24;
                const x = 36 + d * 36;
                const h = Math.max(3, (pct / maxBarPct) * 125);
                const y = 150 - h;
                const color = getDigitColor(d);
                const isLatest = latestTick?.lastDigit === d;

                return (
                  <g key={d}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx="4"
                      fill={color}
                      opacity={isLatest ? 1 : 0.85}
                      stroke={isLatest ? '#ffffff' : 'none'}
                      strokeWidth={isLatest ? 1.5 : 0}
                    />
                    <text
                      x={x + barW / 2}
                      y={y - 5}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      fontSize="9"
                      fontFamily="var(--font-sans)"
                    >
                      {pct.toFixed(1)}
                    </text>
                    <text
                      x={x + barW / 2}
                      y={168}
                      textAnchor="middle"
                      fill={isLatest ? '#ffffff' : '#94a3b8'}
                      fontWeight={isLatest ? '700' : '500'}
                      fontSize="11"
                      fontFamily="var(--font-sans)"
                    >
                      {d}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>

        {/* 2x5 Circular Digit Grid with Animated Active Pointer */}
        <section className="lg:col-span-6 rounded-xl border border-[#1F2937] bg-[#111827] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Live Digit Circles (0–9)</h2>
            <span className="font-mono text-xs text-slate-400">
              Active:{' '}
              <strong className="text-white">
                {latestTick ? latestTick.lastDigit : '—'}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-5 gap-3 sm:gap-4 pt-1">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
              const pct = stats.pcts[d];
              const color = getDigitColor(d);
              const isCurrent = latestTick?.lastDigit === d;

              return (
                <div key={d} className="flex flex-col items-center">
                  <div
                    className={`relative flex h-14 w-14 sm:h-16 sm:w-16 flex-col items-center justify-center rounded-full border-2 transition-transform ${
                      isCurrent ? 'scale-105 bg-[#0B0F17]' : 'bg-[#0B0F17]'
                    }`}
                    style={{ borderColor: color }}
                  >
                    <span className="font-mono text-sm sm:text-base font-bold text-white leading-none">
                      {d}
                    </span>
                    <span className="mt-1 font-mono text-[10px] text-slate-300 tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 mt-1 flex items-center justify-center">
                    {isCurrent && (
                      <span
                        className="text-[10px] leading-none text-[#ff444f]"
                        aria-label="Current digit pointer"
                      >
                        ▲
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Mode Tabs & One-Click Trade Recommendation */}
      <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-[#1F2937] pb-3">
          {(
            [
              { id: 'over_under', label: 'Over / Under' },
              { id: 'even_odd', label: 'Even / Odd' },
              { id: 'rise_fall', label: 'Rise / Fall' },
              { id: 'differs', label: 'Differs' },
              { id: 'accumulators', label: 'Accumulators' },
            ] as const
          ).map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0B0F17] text-slate-400 hover:text-white border border-[#1F2937]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {mode === 'over_under' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Barrier Digit:</span>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setBarrierDigit(d)}
                  className={`h-8 w-8 rounded-md font-mono text-xs font-semibold ${
                    barrierDigit === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0B0F17] border border-[#1F2937] text-slate-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-3">
                <span className="text-xs text-slate-400">Over {barrierDigit}</span>
                <div className="mt-1 font-mono text-xl font-bold text-[#00a79e] tabular-nums">
                  {stats.overPct.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-3">
                <span className="text-xs text-slate-400">Under {barrierDigit}</span>
                <div className="mt-1 font-mono text-xl font-bold text-[#ff444f] tabular-nums">
                  {stats.underPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'even_odd' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-4">
              <span className="text-xs text-slate-400">Even Digits (0,2,4,6,8)</span>
              <div className="mt-1 font-mono text-xl font-bold text-[#00a79e] tabular-nums">
                {stats.evenPct.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-4">
              <span className="text-xs text-slate-400">Odd Digits (1,3,5,7,9)</span>
              <div className="mt-1 font-mono text-xl font-bold text-[#ff444f] tabular-nums">
                {stats.oddPct.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {mode === 'rise_fall' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-4">
              <span className="text-xs text-slate-400">Rise Ticks</span>
              <div className="mt-1 font-mono text-xl font-bold text-[#00a79e] tabular-nums">
                {stats.risePct.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-[#1F2937] bg-[#0B0F17] p-4">
              <span className="text-xs text-slate-400">Fall Ticks</span>
              <div className="mt-1 font-mono text-xl font-bold text-[#ff444f] tabular-nums">
                {stats.fallPct.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#1F2937] bg-[#0B0F17] p-4">
          <div className="flex items-center gap-3">
            <ContractIcon type={recommendedSignal.type} className="w-8 h-8" />
            <div>
              <div className="text-sm font-semibold text-white">
                Signal: {recommendedSignal.headline}
              </div>
              <p className="text-xs text-slate-400">{recommendedSignal.detail}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onLoadToTerminal(buildSettingsFromSignal())}
              className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#111827] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-700"
            >
              <span>Load to Terminal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              disabled={!connected || isRunning}
              onClick={handleQuickRun}
              className="flex items-center gap-1.5 rounded-lg bg-[#00a79e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00948c] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Quick Run Signal</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
