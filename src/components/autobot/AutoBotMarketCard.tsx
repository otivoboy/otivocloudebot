import React from 'react';
import {
  Activity,
  Lock,
  Radio,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { MarketLogo } from '../ContractIcons';
import type { AutoBotMarketConfig } from '../../lib/autobotEngines';
import type {
  AccuNoiseSignal,
  CircleOuMarketData,
  DiffersCalmNoiseMetrics,
  DiffersCalmNoiseSignal,
  StreakMode,
} from '../../types/autobot';
import { cn } from '../../lib/utils';

export interface AutoBotTickCardData {
  price: number;
  lastDigit: number;
  digits: number[];
  streak: number;
  prevPrice?: number;
  coldDigit?: number | null;
  patternMatched?: boolean;
  bestDifferDigit?: number;
  matchedPatternKey?: string;
  typesSignal?: { prediction: number; reason: string; strategyName: string } | null;
  percentageValue?: number;
  axaSignal?: { prediction: number; confidence: number; pattern: string; symbol: string } | null;
  axaMetrics?: { pattern: string; targetDigit: number; cluster: number[] };
  overUnderSignal?: {
    type: 'digitover' | 'digitunder';
    barrier: number;
    prediction: number;
    label: string;
  } | null;
  overUnderMetrics?: {
    freqs: number[];
    over1LossZone: number;
    under8LossZone: number;
    isOver1Cold: boolean;
    isUnder8Cold: boolean;
    sampleCount: number;
  };
  edmsSignal?: {
    type: 'digitover' | 'digitunder';
    label: string;
    ssOver: number;
    ssUnder: number;
  } | null;
  edmsMetrics?: {
    V: number;
    P: number;
    M: number;
    VOL: number;
    T: number;
    sOver: number;
    sUnder: number;
  };
  accumulatorMetrics?: {
    aiProb: number;
    accuNoise: AccuNoiseSignal;
    satisfied: Record<string, boolean>;
  } | null;
  ladPrngSignal?: {
    prediction: number;
    patternStr: string;
    occurrences: number;
    missingDigits: number[];
  } | null;
  differsCalmNoiseSignal?: DiffersCalmNoiseSignal | null;
  differsCalmNoiseMetrics?: DiffersCalmNoiseMetrics;
  priceDigitsSignal?: { matched: boolean; target: string | null; priceStr: string };
  circleOuData?: CircleOuMarketData;
  consecTouchData?: {
    opposingCount: number;
    streakAchieved: boolean;
    touchCount: number;
    reqOpposing: number;
    reqTouches: number;
    isOverTarget: boolean;
    activeBarrier: number;
    touchType: 'target' | 'any';
  };
}

interface AutoBotMarketCardProps {
  symbol: string;
  config: AutoBotMarketConfig;
  data: AutoBotTickCardData;
  tickHistories: React.MutableRefObject<Record<string, number[]>>;
  priceHistories: React.MutableRefObject<Record<string, number[]>>;
  effectiveIsCirclesMode: boolean;
  circlesTicksLimit: number;
  contractType: string;
  streakMode: StreakMode;
  recoveryStreakMode: StreakMode;
  isRecoveryStreakModeEnabled: boolean;
  lossStreakThreshold: number;
  isLossStreakThresholdEnabled: boolean;
  streakThreshold: number;
  targetDigit: number;
  customPattern: string;
  percentageThreshold: number;
  isExactPercentage: boolean;
  priceDigitsInput: string;
  recoveryPriceDigitsInput: string;
  pmfPatternLen: number;
  pmfMinOccurrences: number;
  pmfFollowerLen: number;
  accuStrategies: Record<string, boolean>;
  isDigitMatchingHelper: (
    digit: number,
    lastDigit?: number,
    coldDigit?: number | null,
    index?: number,
    digits?: number[],
    symbol?: string
  ) => boolean;
  lockedVirtualMarket: string | null;
}

export const AutoBotMarketCard: React.FC<AutoBotMarketCardProps> = ({
  symbol,
  config,
  data,
  tickHistories,
  effectiveIsCirclesMode,
  circlesTicksLimit,
  contractType,
  streakMode,
  streakThreshold,
  percentageThreshold,
  isExactPercentage,
  accuStrategies,
  isDigitMatchingHelper,
  lockedVirtualMarket,
}) => {
  const history = tickHistories.current[symbol] || [];
  const priceDisplay = data.price > 0 ? data.price.toFixed(config.decimals) : 'Connecting...';
  const isVirtualLocked = lockedVirtualMarket === symbol;

  // Circle distribution math when Circles Mode is active
  const circlesSlice = history.slice(-Math.max(10, circlesTicksLimit || 1000));
  const totalCircles = circlesSlice.length;
  const counts = new Array(10).fill(0);
  circlesSlice.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });
  const stats = Array.from({ length: 10 }, (_, d) => ({
    digit: d,
    pct: totalCircles > 0 ? (counts[d] / totalCircles) * 100 : 10,
    count: counts[d],
  }));
  const sortedDesc = [...stats].sort((a, b) => b.pct - a.pct);
  const top1Digit = sortedDesc[0]?.digit;
  const top2Digit = sortedDesc[1]?.digit;
  const bottom2Digit = sortedDesc[8]?.digit;
  const bottom1Digit = sortedDesc[9]?.digit;

  // Accumulator readiness count
  const enabledAccuKeys = Object.entries(accuStrategies)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const satisfiedAccuCount =
    data.accumulatorMetrics && enabledAccuKeys.length > 0
      ? enabledAccuKeys.filter((k) => data.accumulatorMetrics?.satisfied?.[k]).length
      : 0;
  const accuReady =
    contractType === 'accumulator' &&
    enabledAccuKeys.length > 0 &&
    satisfiedAccuCount === enabledAccuKeys.length;

  const hasSignalHighlight =
    Boolean(data.axaSignal) ||
    Boolean(data.patternMatched) ||
    Boolean(data.typesSignal) ||
    Boolean(data.differsCalmNoiseSignal) ||
    Boolean(data.ladPrngSignal) ||
    Boolean(data.overUnderSignal) ||
    Boolean(data.edmsSignal) ||
    Boolean(data.priceDigitsSignal?.matched) ||
    Boolean(data.circleOuData?.triggered) ||
    accuReady ||
    (streakMode === 'percentage' &&
      (data.percentageValue ?? 0) >= percentageThreshold &&
      (!isExactPercentage || data.percentageValue === percentageThreshold)) ||
    data.streak >= streakThreshold;

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-all space-y-2.5 bg-[#111214]',
        isVirtualLocked
          ? 'border-purple-500/70 shadow-[0_0_18px_rgba(168,85,247,0.18)]'
          : hasSignalHighlight
          ? 'border-[#00a79e]/70 shadow-[0_0_16px_rgba(0,167,158,0.14)]'
          : 'border-[#222428]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MarketLogo symbol={symbol} className="w-7 h-7 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate">{config.shortName}</span>
              {isVirtualLocked && (
                <span className="inline-flex items-center gap-0.5 rounded bg-purple-500/20 border border-purple-500/40 px-1 py-0.5 text-[8px] font-mono font-bold text-purple-300">
                  <Lock size={8} /> V-LOCK
                </span>
              )}
            </div>
            <span className="block font-mono text-[10px] text-slate-400 tabular-nums">
              {priceDisplay}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span
            className={cn(
              'h-6 w-6 rounded-md flex items-center justify-center font-mono text-xs font-black tabular-nums border',
              data.lastDigit % 2 === 0
                ? 'bg-[#00a79e]/15 text-[#00a79e] border-[#00a79e]/40'
                : 'bg-[#ff444f]/15 text-[#ff444f] border-[#ff444f]/40'
            )}
          >
            {data.price > 0 ? data.lastDigit : '-'}
          </span>
          {data.streak > 0 && (
            <span className="text-[9px] font-mono font-bold text-amber-400 mt-0.5">
              x{data.streak}
            </span>
          )}
        </div>
      </div>

      {/* Circles Mode Grid or Last 5 Digits Strip */}
      {effectiveIsCirclesMode ? (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            {stats.map((st) => {
              const isCurrent = data.price > 0 && st.digit === data.lastDigit;
              const isGreen = st.digit === top1Digit;
              const isBlue = st.digit === top2Digit;
              const isOrange = st.digit === bottom2Digit;
              const isRed = st.digit === bottom1Digit;

              return (
                <div
                  key={st.digit}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border py-1 px-0.5 transition-all',
                    isCurrent && 'ring-2 ring-white/80',
                    isGreen
                      ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300'
                      : isBlue
                      ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                      : isOrange
                      ? 'bg-amber-500/15 border-amber-500/60 text-amber-300'
                      : isRed
                      ? 'bg-rose-500/15 border-rose-500/60 text-rose-300'
                      : 'bg-[#0b0c0e] border-[#222428] text-slate-300'
                  )}
                >
                  <span className="font-mono text-[11px] font-black leading-none">{st.digit}</span>
                  <span className="font-mono text-[8.5px] opacity-85 tabular-nums mt-0.5">
                    {st.pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {data.circleOuData && streakMode === 'circle_over_under' && (
            <div className="rounded-lg bg-[#0b0c0e] border border-[#222428] p-1.5 text-[9px] font-mono space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Circle O/U:</span>
                <span
                  className={
                    data.circleOuData.isFocused ? 'text-[#12d6c2] font-bold' : 'text-slate-500'
                  }
                >
                  {data.circleOuData.isFocused ? 'FOCUSED' : 'SCANNING'}
                </span>
              </div>
              <div className="text-[8.5px] text-amber-300 truncate">
                {data.circleOuData.stage} · O:{data.circleOuData.overTouchCount}/
                {data.circleOuData.reqOverTouches}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {data.digits.length === 0 ? (
            <span className="text-[10px] text-slate-500 font-mono">Waiting for ticks...</span>
          ) : (
            data.digits.map((d, idx) => {
              const matched = isDigitMatchingHelper(
                d,
                data.lastDigit,
                data.coldDigit,
                idx,
                data.digits,
                symbol
              );
              const isLast = idx === data.digits.length - 1;
              return (
                <span
                  key={idx}
                  className={cn(
                    'flex-1 h-7 rounded-md flex items-center justify-center font-mono text-xs font-bold tabular-nums border',
                    isLast
                      ? 'bg-[#ff444f] border-[#ff444f] text-white'
                      : matched
                      ? 'bg-[#00a79e]/20 border-[#00a79e]/60 text-[#00a79e]'
                      : 'bg-[#0b0c0e] border-[#222428] text-slate-300'
                  )}
                >
                  {d}
                </span>
              );
            })
          )}
        </div>
      )}

      {/* Strategy Telemetry Badges */}
      <div className="pt-1.5 border-t border-[#1c1e22] space-y-1 text-[9.5px] font-mono">
        {contractType === 'accumulator' && data.accumulatorMetrics ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Activity size={10} className="text-emerald-400" />
              Accu Gates:
            </span>
            <span
              className={cn(
                'font-bold',
                accuReady ? 'text-emerald-400' : 'text-slate-300'
              )}
            >
              {satisfiedAccuCount}/{enabledAccuKeys.length} · Noise{' '}
              {data.accumulatorMetrics.accuNoise.metrics.noiseScore}
            </span>
          </div>
        ) : streakMode === 'axa' && data.axaMetrics ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">AXA Seq:</span>
            <span
              className={
                data.axaSignal ? 'text-[#00a79e] font-bold' : 'text-slate-300'
              }
            >
              {data.axaMetrics.pattern}{' '}
              {data.axaSignal ? `→ DIFF ${data.axaSignal.prediction}` : ''}
            </span>
          </div>
        ) : streakMode === 'differs_noise' && data.differsCalmNoiseMetrics ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">Noise/Calm:</span>
            <span
              className={
                data.differsCalmNoiseSignal ? 'text-emerald-400 font-bold' : 'text-slate-300'
              }
            >
              N:{data.differsCalmNoiseMetrics.noiseScore} · C:
              {data.differsCalmNoiseMetrics.calmStreak}
              {data.differsCalmNoiseSignal ? ` → DIFF ${data.differsCalmNoiseSignal.prediction}` : ''}
            </span>
          </div>
        ) : streakMode === 'lad_prng' ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">Follower:</span>
            <span className={data.ladPrngSignal ? 'text-sky-400 font-bold' : 'text-slate-400'}>
              {data.ladPrngSignal
                ? `[${data.ladPrngSignal.patternStr}] → DIFF ${data.ladPrngSignal.prediction}`
                : 'Scanning...'}
            </span>
          </div>
        ) : streakMode === 'types' ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">Types AI:</span>
            <span
              className={cn(
                'truncate',
                data.typesSignal ? 'text-rose-400 font-bold' : 'text-slate-400'
              )}
            >
              {data.typesSignal
                ? `${data.typesSignal.strategyName} (${data.typesSignal.prediction})`
                : 'Waiting signal...'}
            </span>
          </div>
        ) : streakMode === 'over_under' ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">O1/U8 Zone:</span>
            <span
              className={
                data.edmsSignal || data.overUnderSignal
                  ? 'text-[#00a79e] font-bold'
                  : 'text-slate-300'
              }
            >
              {data.edmsSignal
                ? data.edmsSignal.label
                : data.overUnderSignal
                ? data.overUnderSignal.label
                : data.overUnderMetrics
                ? `0-1:${data.overUnderMetrics.over1LossZone.toFixed(0)}% · 8-9:${data.overUnderMetrics.under8LossZone.toFixed(0)}%`
                : 'Scanning...'}
            </span>
          </div>
        ) : streakMode === 'percentage' ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">Window %:</span>
            <span
              className={
                (data.percentageValue ?? 0) >= percentageThreshold
                  ? 'text-[#00a79e] font-bold'
                  : 'text-slate-300'
              }
            >
              {data.percentageValue ?? 0}% / {percentageThreshold}%
            </span>
          </div>
        ) : streakMode === 'price_digits' ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">Price Match:</span>
            <span
              className={
                data.priceDigitsSignal?.matched ? 'text-[#00a79e] font-bold' : 'text-slate-400'
              }
            >
              {data.priceDigitsSignal?.matched
                ? `HIT (${data.priceDigitsSignal.target})`
                : 'Watching...'}
            </span>
          </div>
        ) : streakMode === 'consecutive_touch' && data.consecTouchData ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400">Opp / Touch:</span>
            <span
              className={
                data.consecTouchData.streakAchieved ? 'text-[#00a79e] font-bold' : 'text-slate-300'
              }
            >
              {data.consecTouchData.opposingCount}/{data.consecTouchData.reqOpposing} · T:
              {data.consecTouchData.touchCount}/{data.consecTouchData.reqTouches}
            </span>
          </div>
        ) : streakMode === 'analysis_tool' ? (
          <div className="flex items-center justify-between gap-1">
            <span className="text-purple-400 flex items-center gap-1">
              <Radio size={9} /> Bridge:
            </span>
            <span className="text-slate-300">
              Coldest D{data.coldDigit ?? '-'} · {history.length}t
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <span className="text-slate-400 flex items-center gap-1">
              {data.patternMatched ? (
                <Sparkles size={10} className="text-[#00a79e]" />
              ) : (
                <TrendingUp size={10} className="text-slate-500" />
              )}
              Coldest / Streak:
            </span>
            <span className="text-slate-300">
              D{data.coldDigit ?? '-'} · {data.streak}/{streakThreshold}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
