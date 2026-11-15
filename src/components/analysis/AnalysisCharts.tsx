import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export interface OtivoSignal {
  id: string;
  type: 'over' | 'under' | 'differ';
  symbol: string;
  seq: string;
  conf: number;
  target?: number;
  time: string;
  pastOutcomes?: number[];
}

interface DigitChartPoint {
  digit: number;
  frequency: number;
  count: number;
}

export const DigitFrequencyBarChart: React.FC<{
  data: DigitChartPoint[];
  rankedDigits: { digit: number; freq: number }[];
  mostFrequent?: number;
  leastFrequent?: number;
}> = ({ data, rankedDigits, mostFrequent, leastFrequent }) => {
  const [hovered, setHovered] = useState<DigitChartPoint | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-72 w-full flex items-center justify-center text-xs font-mono text-slate-500">
        Collecting live digit histogram...
      </div>
    );
  }

  const maxFreq = Math.max(15, ...data.map((d) => d.frequency));
  const yMax = Math.ceil(maxFreq / 5) * 5;
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  const getFill = (digit: number) => {
    if (rankedDigits.length >= 10) {
      const highest = rankedDigits[0].digit;
      const secondHighest = rankedDigits[1].digit;
      const lowest = rankedDigits[rankedDigits.length - 1].digit;
      const secondLowest = rankedDigits[rankedDigits.length - 2].digit;
      if (digit === highest) return '#29a79a';
      if (digit === lowest) return '#f44336';
      if (digit === secondHighest) return '#3b82f6';
      if (digit === secondLowest) return '#f97316';
      return '#1a1c23';
    }
    if (digit === mostFrequent) return '#29a79a';
    if (digit === leastFrequent) return '#f44336';
    return '#1a1c23';
  };

  return (
    <div className="h-72 w-full relative select-none">
      {hovered && (
        <div className="absolute top-1 right-2 z-20 rounded-xl border border-[#2d2f36] bg-[#111217]/95 px-3 py-2 text-xs shadow-xl pointer-events-none">
          <div className="font-bold text-white">Digit {hovered.digit}</div>
          <div className="font-bold text-indigo-400">
            frequency : {hovered.frequency.toFixed(1)}% ({hovered.count})
          </div>
        </div>
      )}

      <svg viewBox="0 0 640 250" className="w-full h-full overflow-visible">
        {yTicks.map((val, idx) => {
          const y = 215 - (val / yMax) * 190;
          return (
            <g key={idx}>
              <line
                x1={38}
                y1={y}
                x2={630}
                y2={y}
                stroke="#2d2f36"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={32}
                y={y + 4}
                textAnchor="end"
                fill="#555"
                fontSize={11}
                fontWeight="600"
              >
                {val.toFixed(0)}%
              </text>
            </g>
          );
        })}

        {data.map((entry, idx) => {
          const slotW = (630 - 46) / 10;
          const barW = Math.min(36, slotW * 0.68);
          const x = 46 + idx * slotW + (slotW - barW) / 2;
          const barH = Math.max(2, (entry.frequency / yMax) * 190);
          const y = 215 - barH;
          const fill = getFill(entry.digit);
          const isHovered = hovered?.digit === entry.digit;

          return (
            <g
              key={entry.digit}
              onMouseEnter={() => setHovered(entry)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              {isHovered && (
                <rect
                  x={46 + idx * slotW}
                  y={20}
                  width={slotW}
                  height={195}
                  fill="rgba(255,255,255,0.03)"
                  rx={4}
                />
              )}
              <path
                d={`M${x},${y + 6} a6,6 0 0 1 6,-6 h${barW - 12} a6,6 0 0 1 6,6 v${Math.max(
                  0,
                  barH - 6
                )} h-${barW} z`}
                fill={fill}
                opacity={isHovered ? 0.9 : 1}
              />
              <text
                x={x + barW / 2}
                y={236}
                textAnchor="middle"
                fill="#9ba1a6"
                fontSize={13}
                fontWeight="bold"
              >
                {entry.digit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const MarketMomentumAreaChart: React.FC<{
  data: { time: string; price: number }[];
}> = ({ data }) => {
  if (!data || data.length < 2) {
    return (
      <div className="h-60 w-full flex items-center justify-center text-xs font-mono text-slate-500">
        Waiting for momentum tick stream...
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const w = 640;
  const h = 210;
  const padY = 12;

  const pts = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = h - padY - ((d.price - minP) / range) * (h - padY * 2);
    return { x, y };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  return (
    <div className="h-60 w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio, idx) => (
          <line
            key={idx}
            x1={0}
            y1={h * ratio}
            x2={w}
            y2={h * ratio}
            stroke="#2d2f36"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
        ))}
        <path d={areaPath} fill="url(#colorPrice)" />
        <path d={linePath} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export function AnalysisCard({
  title,
  value,
  sub,
  icon,
  color,
  trend,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'rose' | 'amber';
  trend?: 'up' | 'down' | 'neutral';
}) {
  const colorMap: Record<'indigo' | 'emerald' | 'rose' | 'amber', string> = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-500 bg-amber-400/10 border-amber-400/20',
  };

  return (
    <div className="bg-[#111217] rounded-3xl border border-[#2d2f36] p-6 space-y-4 hover:border-[#3d3f46] transition-all shadow-lg group">
      <div className="flex items-center justify-between">
        <div className={cn('p-2.5 rounded-xl transition-colors', colorMap[color])}>{icon}</div>
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#555] group-hover:text-[#9ba1a6] transition-colors">
          {title}
        </h4>
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
          {trend === 'up' && <ArrowUpRight size={16} className="text-emerald-400 mb-1" />}
          {trend === 'down' && <ArrowDownRight size={16} className="text-rose-400 mb-1" />}
        </div>
        <p
          className={cn(
            'text-[10px] font-black uppercase tracking-widest',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-[#555]'
          )}
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

export function SignalRow({
  label,
  signal,
  hint,
  confidence,
  onClick,
}: {
  label: string;
  signal: string;
  hint: string;
  confidence: 'High' | 'Medium';
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-4 bg-[#0a0b0d] border border-[#2d2f36] rounded-2xl transition-all hover:bg-[#111217] hover:border-indigo-500/30 group cursor-pointer',
        onClick && 'active:scale-[0.98]'
      )}
    >
      <div className="space-y-0.5">
        <h5 className="text-[10px] font-black uppercase tracking-widest text-white group-hover:text-indigo-400 transition-colors">
          {label}
        </h5>
        <p className="text-[9px] font-bold text-[#555] uppercase tracking-tighter">{hint}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-indigo-400 tracking-widest uppercase">{signal}</p>
        <p
          className={cn(
            'text-[9px] font-bold uppercase tracking-widest',
            confidence === 'High' ? 'text-emerald-400' : 'text-amber-400'
          )}
        >
          {confidence} Conf.
        </p>
      </div>
    </div>
  );
}

export function OtivoSignalCard({
  signal,
  onClick,
}: {
  signal: OtivoSignal;
  onClick: () => void;
}) {
  const colors = {
    over: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5',
    under: 'border-blue-500/50 text-blue-400 bg-blue-500/5',
    differ: 'border-purple-500/50 text-purple-400 bg-purple-500/5',
  };

  const labels = {
    over: 'OVER 5+',
    under: 'UNDER 4',
    differ: `DIFFER ${signal.target}`,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, x: 5 }}
      onClick={onClick}
      className={cn(
        'p-4 sm:p-5 rounded-2xl border-l-[6px] border border-transparent transition-all cursor-pointer group relative overflow-hidden bg-[#0b1220]',
        colors[signal.type]
      )}
    >
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        {signal.type === 'over' ? (
          <TrendingUp size={32} className="sm:w-[48px] sm:h-[48px]" />
        ) : signal.type === 'under' ? (
          <TrendingDown size={32} className="sm:w-[48px] sm:h-[48px]" />
        ) : (
          <Target size={32} className="sm:w-[48px] sm:h-[48px]" />
        )}
      </div>

      <div className="flex justify-between items-start mb-2 sm:mb-3 relative z-10">
        <div>
          <span className="font-black text-white text-[10px] sm:text-xs uppercase tracking-widest block mb-1">
            {signal.symbol}
          </span>
          <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
            Recurrence Found
          </span>
        </div>
        <div className="text-right">
          <span className="text-[8px] sm:text-[9px] text-slate-500 font-bold block">{signal.time}</span>
          <span className="text-[9px] sm:text-[10px] font-black text-emerald-400">
            {Number(signal.conf || 0).toFixed(0)}% STRENGTH
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 relative z-10">
        {signal.seq.split(',').map((digit, i) => (
          <div
            key={i}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-[10px] sm:text-xs font-black text-white"
          >
            {digit}
          </div>
        ))}
        <ChevronRight size={14} className="text-slate-600" />
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[10px] sm:text-xs font-black text-indigo-400 animate-pulse">
          {signal.type === 'differ' ? signal.target : signal.type === 'over' ? '5+' : '4-'}
        </div>
      </div>

      {signal.pastOutcomes && (
        <div className="flex flex-col gap-1 sm:gap-1.5 mb-3 sm:mb-4 relative z-10">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
            Empirical Outcomes
          </span>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {signal.pastOutcomes.slice(-8).map((out, i) => (
              <div
                key={i}
                className={cn(
                  'w-4 h-4 sm:w-5 sm:h-5 rounded-md flex items-center justify-center text-[8px] sm:text-[9px] font-black shrink-0',
                  signal.type === 'over'
                    ? out > 5
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-500'
                    : signal.type === 'under'
                    ? out < 4
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-800 text-slate-500'
                    : out !== signal.target
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-rose-500/20 text-rose-400'
                )}
              >
                {out}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center relative z-10">
        <span className="font-black text-[10px] sm:text-xs uppercase tracking-tight text-white">
          {labels[signal.type]}
        </span>
        <div className="flex items-center gap-1 sm:gap-1.5">
          {signal.pastOutcomes && signal.pastOutcomes.length >= 100 && (
            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded-md font-black mr-1 sm:mr-2 tracking-tighter">
              CONFIRMED
            </span>
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[8px] sm:text-[9px] font-bold text-emerald-400 uppercase">Live</span>
        </div>
      </div>
    </motion.div>
  );
}
