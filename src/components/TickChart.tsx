import React from 'react';
import { MARKETS, TickPoint } from '../types';
import { MarketLogo } from './ContractIcons';

interface TickChartProps {
  market: string;
  ticks: TickPoint[];
}

export const TickChart: React.FC<TickChartProps> = ({ market, ticks }) => {
  const marketInfo = MARKETS.find((m) => m.symbol === market) ?? {
    label: market,
    symbol: market,
    decimals: 2,
  };

  const latest = ticks.length > 0 ? ticks[ticks.length - 1] : null;
  const prev = ticks.length > 1 ? ticks[ticks.length - 2] : null;
  const delta = latest && prev ? latest.quote - prev.quote : 0;

  const recentDigits = ticks.slice(-16);

  // SVG Geometry
  const width = 760;
  const height = 180;
  const padTop = 14;
  const padBottom = 14;
  const plotH = height - padTop - padBottom;

  let pathD = '';
  let areaD = '';
  let lastX = 0;
  let lastY = height / 2;
  let minVal = 0;
  let maxVal = 0;

  if (ticks.length >= 2) {
    const quotes = ticks.map((t) => t.quote);
    minVal = Math.min(...quotes);
    maxVal = Math.max(...quotes);
    const range = maxVal - minVal || 0.01;

    const coords = ticks.map((t, idx) => {
      const x = (idx / (ticks.length - 1)) * width;
      const y = padTop + (1 - (t.quote - minVal) / range) * plotH;
      return { x, y };
    });

    pathD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L 0 ${height} Z`;
    lastX = coords[coords.length - 1].x;
    lastY = coords[coords.length - 1].y;
  }

  return (
    <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <MarketLogo symbol={marketInfo.symbol} />
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-white">{marketInfo.label}</h2>
            <span className="font-mono text-xs text-slate-500">{marketInfo.symbol}</span>
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          {latest ? (
            <>
              <span className="font-mono text-2xl font-semibold text-white tabular-nums">
                {latest.quote.toFixed(marketInfo.decimals)}
              </span>
              <span
                className={`font-mono text-xs font-medium tabular-nums ${
                  delta > 0
                    ? 'text-emerald-400'
                    : delta < 0
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
              >
                {delta > 0 ? '+' : ''}
                {delta.toFixed(marketInfo.decimals)}
              </span>
            </>
          ) : (
            <span className="font-mono text-sm text-slate-500">Connecting tick feed...</span>
          )}
        </div>
      </div>

      {/* Live Tick Sparkline */}
      <div className="relative w-full overflow-hidden rounded-lg border border-[#1F2937] bg-[#0B0F17] px-2 py-2">
        {ticks.length < 2 ? (
          <div className="flex h-[180px] items-center justify-center text-xs text-slate-500">
            Waiting for live Deriv market ticks...
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[180px] w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="tickAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75].map((ratio) => (
                <line
                  key={ratio}
                  x1={0}
                  x2={width}
                  y1={padTop + ratio * plotH}
                  y2={padTop + ratio * plotH}
                  stroke="#1F2937"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
              ))}

              <path d={areaD} fill="url(#tickAreaGrad)" />
              <path
                d={pathD}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={lastX} cy={lastY} r="4" fill="#60A5FA" />
            </svg>

            <div className="pointer-events-none absolute right-2 top-1 font-mono text-[11px] text-slate-500 tabular-nums">
              H: {maxVal.toFixed(marketInfo.decimals)}
            </div>
            <div className="pointer-events-none absolute right-2 bottom-1 font-mono text-[11px] text-slate-500 tabular-nums">
              L: {minVal.toFixed(marketInfo.decimals)}
            </div>
          </div>
        )}
      </div>

      {/* Recent Last Digits */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-400">Recent last digits</span>
        <div className="flex items-center gap-1.5">
          {recentDigits.length === 0 ? (
            <span className="font-mono text-xs text-slate-600">—</span>
          ) : (
            recentDigits.map((pt, i) => {
              const isLatest = i === recentDigits.length - 1;
              return (
                <span
                  key={`${pt.epoch}-${i}`}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-semibold tabular-nums ${
                    isLatest
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0B0F17] border border-[#1F2937] text-slate-300'
                  }`}
                >
                  {pt.lastDigit}
                </span>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
