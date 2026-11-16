import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  DollarSign,
  Gauge,
  LineChart as LineIcon,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import {
  AnalysisCard,
  DigitFrequencyBarChart,
  MarketMomentumAreaChart,
  SignalRow,
} from './AnalysisCharts';
import { DerivContractAnalysisType, TickData } from './types';
import type { CloudBotsSnapshot, FrequencyCloudState } from '../../types/cloudBots';

export interface ClassicAnalysisResult {
  frequencies: number[];
  mostFrequent: number;
  leastFrequent: number;
  predictedDigit: number;
  smaMid: number;
  smaLong: number;
  currentPrice: number;
  priceChange: number;
  shortMomentum: string;
  trendBias: string;
  volatilityScore: number;
  aiSignals?: {
    market_state: string;
    confidence: number;
    rise_fall: string;
    accumulator: string;
    volatility_pct?: number;
    rsi?: number;
  };
  predictions: {
    matches: { signal: number; confidence: string; detail: string };
    differs: { signal: number; confidence: string; detail: string };
    evenOdd: string;
    overUnder: string;
    riseFall: string;
    accumulator: string;
  };
}

interface ClassicFrequencyViewProps {
  symbol: string;
  onChangeSymbol: (sym: string) => void;
  ticks: TickData[];
  analysis: ClassicAnalysisResult | null;
  rankedDigits: { digit: number; freq: number }[];
  coldestHistory: number[];
  analysisWindow: number;
  connected: boolean;
  accountBalance: number;
  onSwitchContractMode: (mode: DerivContractAnalysisType) => void;
  marketSwitchMode: 'off' | 'loss' | 'always';
  onSetMarketSwitchMode: (mode: 'off' | 'loss' | 'always') => void;
  scanBestMarket: any;
  lastScanTime: string | null;
  isAutoTrading: boolean;
  onStartAutoTrade: (best: any) => void;
  onStopAutoTrade: () => void;
  onLoadSignalToTerminal: (sig: {
    symbol: string;
    type: 'over' | 'under' | 'differ';
    target?: number;
    digit?: number;
  }) => void;
  onTriggerBackgroundRescan: (excludeSymbol?: string) => Promise<string | null>;
  onNotify: (level: 'success' | 'info' | 'warn' | 'error', msg: string) => void;
  hasVirtualToken?: boolean;
  cloudState?: FrequencyCloudState;
  onCloudBotsUpdate?: (snap: CloudBotsSnapshot) => void;
}

export const ClassicFrequencyView: React.FC<ClassicFrequencyViewProps> = ({
  symbol,
  onChangeSymbol,
  ticks,
  analysis,
  rankedDigits,
  coldestHistory,
  analysisWindow,
  connected,
  accountBalance,
  onSwitchContractMode,
  marketSwitchMode,
  onSetMarketSwitchMode,
  scanBestMarket,
  lastScanTime,
  isAutoTrading,
  onStartAutoTrade,
  onStopAutoTrade,
  onLoadSignalToTerminal,
  onNotify,
  hasVirtualToken = false,
  cloudState,
  onCloudBotsUpdate,
}) => {
  const [frequencyBotStake, setFrequencyBotStake] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_stake') || '1')
  );
  const [frequencyBotAutoStakeEnabled, setFrequencyBotAutoStakeEnabled] = useState(
    () => localStorage.getItem('freq_bot_auto_stake_enabled') === 'true'
  );
  const [frequencyBotAutoStakePct, setFrequencyBotAutoStakePct] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_auto_stake_pct') || '1.0')
  );
  const [frequencyBotMartingale, setFrequencyBotMartingale] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_martingale') || '2')
  );
  const [frequencyBotTargetPct, setFrequencyBotTargetPct] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_target_pct') || '10.0')
  );
  const [frequencyBotContractType, setFrequencyBotContractType] = useState<
    'coldest' | 'differ' | 'over' | 'under' | 'even' | 'odd'
  >(() => (localStorage.getItem('freq_bot_contract_type') || 'differ') as any);
  const [frequencyBotSessionProfit, setFrequencyBotSessionProfit] = useState(0);
  const [frequencyBotTp, setFrequencyBotTp] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_tp') || '10')
  );
  const [frequencyBotMaxRunsEnabled, setFrequencyBotMaxRunsEnabled] = useState(
    () => localStorage.getItem('freq_bot_max_runs_enabled') === 'true'
  );
  const [frequencyBotMaxRuns, setFrequencyBotMaxRuns] = useState(() =>
    parseInt(localStorage.getItem('freq_bot_max_runs') || '10', 10)
  );
  const [frequencyBotSl, setFrequencyBotSl] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_sl') || '50')
  );
  const [frequencyBotDuration, setFrequencyBotDuration] = useState(() =>
    parseInt(localStorage.getItem('freq_bot_duration') || '1', 10)
  );
  const [frequencyBotEvenOddMode, setFrequencyBotEvenOddMode] = useState<
    'high_even' | 'low_even' | 'low_odd' | 'high_odd'
  >(() => (localStorage.getItem('freq_bot_even_odd_mode') || 'high_even') as any);
  const [frequencyBotBenchmarkPct, setFrequencyBotBenchmarkPct] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_benchmark_pct') || '10.3')
  );
  const [frequencyBotDigitFilterEnabled, setFrequencyBotDigitFilterEnabled] = useState(
    () => localStorage.getItem('freq_bot_digit_filter_enabled') === 'true'
  );
  const [frequencyBotFilterDigits, setFrequencyBotFilterDigits] = useState(
    () => localStorage.getItem('freq_bot_filter_digits') || '0'
  );
  const [frequencyBotFilterCompareMode, setFrequencyBotFilterCompareMode] = useState<
    'higher' | 'lower'
  >(() => (localStorage.getItem('freq_bot_filter_compare_mode') || 'higher') as any);
  const [frequencyBotSmartRecoveryEnabled, setFrequencyBotSmartRecoveryEnabled] = useState(
    () => localStorage.getItem('freq_bot_smart_recovery_enabled') === 'true'
  );
  const [frequencyBotCircleModeEnabled, setFrequencyBotCircleModeEnabled] = useState(
    () => localStorage.getItem('freq_bot_circle_mode_enabled') === 'true'
  );
  const [frequencyBotCircleType, setFrequencyBotCircleType] = useState<
    'green' | 'red' | 'blue' | 'orange'
  >(() => (localStorage.getItem('freq_bot_circle_type') || 'green') as any);
  const [frequencyBotRecoveryCircleType, setFrequencyBotRecoveryCircleType] = useState<
    'green' | 'red' | 'blue' | 'orange'
  >(() => (localStorage.getItem('freq_bot_recovery_circle_type') || 'green') as any);
  const [frequencyBotPredictionDigit, setFrequencyBotPredictionDigit] = useState<number>(() =>
    parseInt(localStorage.getItem('freq_bot_prediction_digit') || '5', 10)
  );
  const [frequencyBotRecoveryPredictionDigit, setFrequencyBotRecoveryPredictionDigit] =
    useState<number>(() =>
      parseInt(localStorage.getItem('freq_bot_recovery_prediction_digit') || '5', 10)
    );
  const [frequencyBotRecoveryContractType, setFrequencyBotRecoveryContractType] = useState<
    'coldest' | 'differ' | 'over' | 'under' | 'even' | 'odd'
  >(() => (localStorage.getItem('freq_bot_recovery_contract_type') || 'differ') as any);
  const [frequencyBotRecoveryTargetPct, setFrequencyBotRecoveryTargetPct] = useState(() =>
    parseFloat(localStorage.getItem('freq_bot_recovery_target_pct') || '10.0')
  );
  const [frequencyBotRecoveryCompareMode, setFrequencyBotRecoveryCompareMode] = useState<
    'higher' | 'lower'
  >(() => (localStorage.getItem('freq_bot_recovery_compare_mode') || 'higher') as any);
  const [frequencyBotRecoveryFilterDigits, setFrequencyBotRecoveryFilterDigits] = useState(
    () => localStorage.getItem('freq_bot_recovery_filter_digits') || '0'
  );

  const [frequencyBotVirtualMode, setFrequencyBotVirtualMode] = useState(
    () => localStorage.getItem('freq_bot_virtual_mode') === 'true'
  );
  const [frequencyBotVirtualLossesTarget, setFrequencyBotVirtualLossesTarget] = useState(() =>
    Math.max(1, parseInt(localStorage.getItem('freq_bot_virtual_losses_target') || '1', 10) || 1)
  );

  const isFrequencyBotTrading = Boolean(cloudState?.running);
  const effectiveSessionProfit = cloudState?.sessionProfit ?? frequencyBotSessionProfit;
  const frequencyBotWins = cloudState?.wins ?? 0;
  const frequencyBotLosses = cloudState?.losses ?? 0;
  const frequencyBotVirtualWins = cloudState?.virtualWins ?? 0;
  const frequencyBotVirtualLosses = cloudState?.virtualLosses ?? 0;

  const lastCloudToastIdRef = useRef<number>(cloudState?.lastEvent?.id ?? 0);
  const lastCloudSymbolRef = useRef<string | null>(cloudState?.symbol ?? null);

  useEffect(() => {
    setFrequencyBotSessionProfit(cloudState?.sessionProfit ?? 0);
  }, [cloudState?.sessionProfit]);

  useEffect(() => {
    const evt = cloudState?.lastEvent;
    if (evt && evt.id > lastCloudToastIdRef.current) {
      lastCloudToastIdRef.current = evt.id;
      onNotify(evt.type, evt.message);
    }
  }, [cloudState?.lastEvent, onNotify]);

  useEffect(() => {
    if (cloudState?.running && cloudState.symbol && cloudState.symbol !== lastCloudSymbolRef.current) {
      lastCloudSymbolRef.current = cloudState.symbol;
      if (cloudState.symbol !== symbol) {
        onChangeSymbol(cloudState.symbol);
      }
    } else if (!cloudState?.running) {
      lastCloudSymbolRef.current = null;
    }
  }, [cloudState?.running, cloudState?.symbol, onChangeSymbol, symbol]);

  // Persist inputs
  useEffect(() => {
    localStorage.setItem('freq_bot_circle_mode_enabled', frequencyBotCircleModeEnabled.toString());
  }, [frequencyBotCircleModeEnabled]);
  useEffect(() => {
    localStorage.setItem('freq_bot_circle_type', frequencyBotCircleType);
  }, [frequencyBotCircleType]);
  useEffect(() => {
    localStorage.setItem('freq_bot_recovery_circle_type', frequencyBotRecoveryCircleType);
  }, [frequencyBotRecoveryCircleType]);
  useEffect(() => {
    localStorage.setItem('freq_bot_prediction_digit', frequencyBotPredictionDigit.toString());
  }, [frequencyBotPredictionDigit]);
  useEffect(() => {
    localStorage.setItem(
      'freq_bot_recovery_prediction_digit',
      frequencyBotRecoveryPredictionDigit.toString()
    );
  }, [frequencyBotRecoveryPredictionDigit]);
  useEffect(() => {
    localStorage.setItem('freq_bot_stake', frequencyBotStake.toString());
  }, [frequencyBotStake]);
  useEffect(() => {
    localStorage.setItem('freq_bot_auto_stake_enabled', frequencyBotAutoStakeEnabled.toString());
  }, [frequencyBotAutoStakeEnabled]);
  useEffect(() => {
    localStorage.setItem('freq_bot_auto_stake_pct', frequencyBotAutoStakePct.toString());
  }, [frequencyBotAutoStakePct]);
  useEffect(() => {
    localStorage.setItem('freq_bot_max_runs_enabled', frequencyBotMaxRunsEnabled.toString());
  }, [frequencyBotMaxRunsEnabled]);
  useEffect(() => {
    localStorage.setItem('freq_bot_max_runs', frequencyBotMaxRuns.toString());
  }, [frequencyBotMaxRuns]);
  useEffect(() => {
    localStorage.setItem('freq_bot_martingale', frequencyBotMartingale.toString());
  }, [frequencyBotMartingale]);
  useEffect(() => {
    localStorage.setItem('freq_bot_target_pct', frequencyBotTargetPct.toString());
  }, [frequencyBotTargetPct]);
  useEffect(() => {
    localStorage.setItem('freq_bot_contract_type', frequencyBotContractType);
  }, [frequencyBotContractType]);
  useEffect(() => {
    localStorage.setItem('freq_bot_tp', frequencyBotTp.toString());
  }, [frequencyBotTp]);
  useEffect(() => {
    localStorage.setItem('freq_bot_duration', frequencyBotDuration.toString());
  }, [frequencyBotDuration]);
  useEffect(() => {
    localStorage.setItem('freq_bot_even_odd_mode', frequencyBotEvenOddMode);
  }, [frequencyBotEvenOddMode]);
  useEffect(() => {
    localStorage.setItem('freq_bot_benchmark_pct', frequencyBotBenchmarkPct.toString());
  }, [frequencyBotBenchmarkPct]);
  useEffect(() => {
    localStorage.setItem('freq_bot_sl', frequencyBotSl.toString());
  }, [frequencyBotSl]);
  useEffect(() => {
    localStorage.setItem(
      'freq_bot_digit_filter_enabled',
      frequencyBotDigitFilterEnabled.toString()
    );
  }, [frequencyBotDigitFilterEnabled]);
  useEffect(() => {
    localStorage.setItem('freq_bot_filter_digits', frequencyBotFilterDigits);
  }, [frequencyBotFilterDigits]);
  useEffect(() => {
    localStorage.setItem('freq_bot_filter_compare_mode', frequencyBotFilterCompareMode);
  }, [frequencyBotFilterCompareMode]);
  useEffect(() => {
    localStorage.setItem(
      'freq_bot_smart_recovery_enabled',
      frequencyBotSmartRecoveryEnabled.toString()
    );
  }, [frequencyBotSmartRecoveryEnabled]);
  useEffect(() => {
    localStorage.setItem('freq_bot_recovery_contract_type', frequencyBotRecoveryContractType);
  }, [frequencyBotRecoveryContractType]);
  useEffect(() => {
    localStorage.setItem('freq_bot_recovery_target_pct', frequencyBotRecoveryTargetPct.toString());
  }, [frequencyBotRecoveryTargetPct]);
  useEffect(() => {
    localStorage.setItem('freq_bot_recovery_compare_mode', frequencyBotRecoveryCompareMode);
  }, [frequencyBotRecoveryCompareMode]);
  useEffect(() => {
    localStorage.setItem('freq_bot_recovery_filter_digits', frequencyBotRecoveryFilterDigits);
  }, [frequencyBotRecoveryFilterDigits]);
  useEffect(() => {
    localStorage.setItem('freq_bot_virtual_mode', frequencyBotVirtualMode.toString());
  }, [frequencyBotVirtualMode]);
  useEffect(() => {
    localStorage.setItem('freq_bot_virtual_losses_target', frequencyBotVirtualLossesTarget.toString());
  }, [frequencyBotVirtualLossesTarget]);
  useEffect(() => {
    if (!hasVirtualToken && frequencyBotVirtualMode) {
      setFrequencyBotVirtualMode(false);
    }
  }, [hasVirtualToken, frequencyBotVirtualMode]);

  // Sync Auto Stake with real connected balance
  useEffect(() => {
    if (frequencyBotAutoStakeEnabled && !isFrequencyBotTrading) {
      const bal = accountBalance > 0 ? accountBalance : 100;
      const calcStake = Math.max(
        0.35,
        parseFloat((bal * (frequencyBotAutoStakePct / 100)).toFixed(2))
      );
      setFrequencyBotStake(calcStake);
    }
  }, [
    frequencyBotAutoStakeEnabled,
    frequencyBotAutoStakePct,
    accountBalance,
    isFrequencyBotTrading,
  ]);

  const stopFrequencyBot = async () => {
    try {
      const res = await fetch('/api/cloud-bots/frequency/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data?.error || 'Failed to stop Frequency Bot.');
      } else {
        if (data?.cloudBots && onCloudBotsUpdate) onCloudBotsUpdate(data.cloudBots);
        onNotify('info', 'Digit Frequency Bot stopped.');
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to stop Frequency Bot.');
    }
  };

  const startFrequencyBot = async () => {
    if (!connected) {
      onNotify('error', 'Connect your Deriv API token via Deriv API Connection first.');
      return;
    }
    if (isAutoTrading) {
      onStopAutoTrade();
    }

    let initialStake = frequencyBotStake;
    if (frequencyBotAutoStakeEnabled) {
      const bal = accountBalance > 0 ? accountBalance : 100;
      initialStake = Math.max(
        0.35,
        parseFloat((bal * (frequencyBotAutoStakePct / 100)).toFixed(2))
      );
      setFrequencyBotStake(initialStake);
    }

    try {
      const res = await fetch('/api/cloud-bots/frequency/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          analysisWindow,
          stake: initialStake,
          autoStakeEnabled: frequencyBotAutoStakeEnabled,
          autoStakePct: frequencyBotAutoStakePct,
          martingale: frequencyBotMartingale,
          targetPct: frequencyBotTargetPct,
          contractType: frequencyBotContractType,
          tp: frequencyBotTp,
          sl: frequencyBotSl,
          maxRunsEnabled: frequencyBotMaxRunsEnabled,
          maxRuns: frequencyBotMaxRuns,
          duration: frequencyBotDuration,
          evenOddMode: frequencyBotEvenOddMode,
          benchmarkPct: frequencyBotBenchmarkPct,
          digitFilterEnabled: frequencyBotDigitFilterEnabled,
          filterDigits: frequencyBotFilterDigits,
          filterCompareMode: frequencyBotFilterCompareMode,
          smartRecoveryEnabled: frequencyBotSmartRecoveryEnabled,
          circleModeEnabled: frequencyBotCircleModeEnabled,
          circleType: frequencyBotCircleType,
          recoveryCircleType: frequencyBotRecoveryCircleType,
          predictionDigit: frequencyBotPredictionDigit,
          recoveryPredictionDigit: frequencyBotRecoveryPredictionDigit,
          recoveryContractType: frequencyBotRecoveryContractType,
          recoveryTargetPct: frequencyBotRecoveryTargetPct,
          recoveryCompareMode: frequencyBotRecoveryCompareMode,
          recoveryFilterDigits: frequencyBotRecoveryFilterDigits,
          virtualMode: Boolean(hasVirtualToken && frequencyBotVirtualMode),
          virtualLossesTarget: frequencyBotVirtualLossesTarget,
          marketSwitchMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onNotify('error', data?.error || 'Failed to start Frequency Bot.');
      } else {
        if (data?.cloudBots && onCloudBotsUpdate) onCloudBotsUpdate(data.cloudBots);
        onNotify('success', `Exact Frequency Match Bot started on ${symbol} (Cloud 24/7).`);
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to start Frequency Bot.');
    }
  };

  const digitChartData = useMemo(() => {
    if (!analysis) return [];
    return analysis.frequencies.map((f, i) => ({
      digit: i,
      frequency: parseFloat(f.toFixed(1)),
      count: Math.round((f / 100) * ticks.length),
    }));
  }, [analysis, ticks.length]);

  const priceHistoryData = useMemo(() => {
    return ticks.slice(-100).map((t) => ({
      time: new Date(t.epoch * 1000).toLocaleTimeString([], {
        hour12: false,
        minute: '2-digit',
        second: '2-digit',
      }),
      price: t.quote,
    }));
  }, [ticks]);

  const lastDigit = ticks.length > 0 ? ticks[ticks.length - 1].digit : 0;

  // Synchronous pointer cursor tracking
  useEffect(() => {
    const updateCursor = () => {
      const cursorEl = document.getElementById('deriv-digit-cursor');
      const targetEl = document.getElementById(`digit-${lastDigit}`);
      const gridEl = document.getElementById('grid');

      if (cursorEl && targetEl && gridEl) {
        const gridRect = gridEl.getBoundingClientRect();
        const circleEl = targetEl.querySelector('.circle-wrapper');
        const refRect = circleEl
          ? circleEl.getBoundingClientRect()
          : targetEl.getBoundingClientRect();

        const isMobile = window.innerWidth < 640;
        const widthOffset = isMobile ? 6 : 8;
        const gap = isMobile ? 6 : 10;

        const x = refRect.left - gridRect.left + refRect.width / 2 - widthOffset;
        const y = refRect.top - gridRect.top + refRect.height + gap;

        if (refRect.width > 0 && refRect.height > 0) {
          cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          cursorEl.style.opacity = '1';
        }
      } else if (cursorEl) {
        cursorEl.style.opacity = '0';
      }
    };

    const rAF = requestAnimationFrame(updateCursor);
    const timeoutId = setTimeout(updateCursor, 0);
    window.addEventListener('resize', updateCursor);
    return () => {
      cancelAnimationFrame(rAF);
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateCursor);
    };
  }, [lastDigit, ticks.length]);

  return (
    <>
      {/* Real-time Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalysisCard
          title="Last Price"
          value={analysis?.currentPrice?.toFixed(2) ?? '0.00'}
          sub={
            analysis
              ? `${analysis.priceChange > 0 ? '+' : ''}${
                  analysis.priceChange?.toFixed(4) ?? '0.0000'
                }`
              : '0.000'
          }
          icon={<DollarSign size={20} />}
          color="indigo"
          trend={analysis ? (analysis.priceChange >= 0 ? 'up' : 'down') : 'neutral'}
        />
        <AnalysisCard
          title="Trend Bias"
          value={analysis?.predictions.riseFall ?? 'Neutral'}
          sub={analysis ? `SMA-500: ${analysis.smaLong?.toFixed(2) ?? '0.00'}` : 'Scanning...'}
          icon={<TrendingUp size={20} />}
          color={analysis?.predictions.riseFall === 'RISE' ? 'emerald' : 'rose'}
          trend={analysis?.predictions.riseFall === 'RISE' ? 'up' : 'down'}
        />
        <AnalysisCard
          title="Most Frequent Digit"
          value={analysis?.mostFrequent.toString() ?? '—'}
          sub={`${analysis?.frequencies[analysis.mostFrequent]?.toFixed(1) ?? '0'}% Frequency`}
          icon={<Zap size={20} />}
          color="amber"
        />
        <AnalysisCard
          title="AI Predicted Digit"
          value={analysis?.predictedDigit.toString() ?? '—'}
          sub={`${analysis?.frequencies[analysis.predictedDigit]?.toFixed(1) ?? '0'}% Frequency`}
          icon={<Target size={20} />}
          color="indigo"
        />
      </div>

      {/* Cold Digit Ticker */}
      <div className="bg-[#111217] rounded-2xl border border-[#2d2f36] p-4 flex items-center gap-6 overflow-hidden">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#9ba1a6]">
            Coldest Ticker:
          </span>
        </div>
        <div className="flex items-center gap-3 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {coldestHistory.map((d, i) => (
              <motion.div
                key={`${i}-${d}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-black text-indigo-400 shrink-0"
              >
                {d}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left: Detailed Digit Frequency & History */}
        <div className="xl:col-span-2 space-y-8">
          <div className="bg-[#111217] rounded-3xl border border-[#2d2f36] p-4 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#9ba1a6] flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-400" />
                  Digit Frequency Analysis
                </h3>
                <p className="text-xs text-[#555]">Calculated from the last {analysisWindow} ticks</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSwitchContractMode('pressure_noise')}
                  className="px-3 py-1 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 hover:from-indigo-600/30 hover:to-violet-600/30 text-indigo-300 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <span>Pressure &amp; Noise</span>
                </button>
                <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                  Reliability: High
                </div>
              </div>
            </div>

            <div className="mb-10">
              <DigitFrequencyBarChart
                data={digitChartData}
                rankedDigits={rankedDigits}
                mostFrequent={analysis?.mostFrequent}
                leastFrequent={analysis?.leastFrequent}
              />
            </div>

            {/* 2x5 Round Grid Setup */}
            <div
              id="grid"
              className="grid grid-cols-5 gap-y-12 gap-x-1.5 xs:gap-x-2 sm:gap-x-4 relative pb-10 pt-4 px-1 xs:px-2 select-none"
            >
              {Array.from({ length: 10 }).map((_, i) => {
                const freq = analysis?.frequencies[i] ?? 0;
                let circleColorClass = 'border-[#2a2e2e]';
                let itemExtraClass = '';

                if (rankedDigits.length >= 10) {
                  const highest = rankedDigits[0].digit;
                  const secondHighest = rankedDigits[1].digit;
                  const lowest = rankedDigits[rankedDigits.length - 1].digit;
                  const secondLowest = rankedDigits[rankedDigits.length - 2].digit;

                  if (i === highest) {
                    circleColorClass = 'border-[#29a79a] bg-[#29a79a]/5';
                    itemExtraClass = 'max-freq';
                  } else if (i === lowest) {
                    circleColorClass = 'border-[#f44336] bg-[#f44336]/5';
                    itemExtraClass = 'min-freq';
                  } else if (i === secondHighest) {
                    circleColorClass = 'border-blue-500 bg-blue-500/5';
                  } else if (i === secondLowest) {
                    circleColorClass = 'border-orange-500 bg-orange-500/5';
                  }
                } else {
                  if (i === analysis?.mostFrequent) {
                    circleColorClass = 'border-[#29a79a] bg-[#29a79a]/5';
                    itemExtraClass = 'max-freq';
                  } else if (i === analysis?.leastFrequent) {
                    circleColorClass = 'border-[#f44336] bg-[#f44336]/5';
                    itemExtraClass = 'min-freq';
                  }
                }

                return (
                  <div
                    key={i}
                    id={`digit-${i}`}
                    className={cn(
                      'digit-item flex flex-col items-center justify-center relative h-16 sm:h-20 transition-all',
                      itemExtraClass
                    )}
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className={cn(
                        'circle-wrapper w-[52px] h-[52px] sm:w-[70px] sm:h-[70px] rounded-full border-2 sm:border-4 flex flex-col items-center justify-center relative transition-all duration-300 shadow-md',
                        circleColorClass
                      )}
                    >
                      <span className="digit-val text-sm sm:text-lg font-bold text-white mb-[-2px]">
                        {i}
                      </span>
                      <span className="digit-pct text-[9px] sm:text-[11px] text-[#99adbe] font-medium font-mono">
                        {Number(freq || 0).toFixed(1)}%
                      </span>
                    </motion.div>
                  </div>
                );
              })}

              <div
                id="deriv-digit-cursor"
                className="absolute top-0 left-0 w-0 h-0 border-l-[6px] sm:border-l-[8px] border-l-transparent border-r-[6px] sm:border-r-[8px] border-r-transparent border-b-[8px] sm:border-b-[12px] border-b-[#ff444f] z-10 transition-transform duration-75 ease-out opacity-0 pointer-events-none"
                style={{ willChange: 'transform' }}
              />
            </div>

            <div className="border-t border-[#2d2f36] my-6" />

            {/* Exact Frequency Digit Bot Section */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a0b0d] p-4 rounded-2xl border border-[#2d2f36]/60">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-[0.15em] text-[#9ba1a6] flex items-center gap-2">
                    <Settings size={14} className="text-emerald-400" />
                    Exact Frequency Match Bot Control
                  </h4>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                    Executes digital contracts instantly when a digit&apos;s frequency matches your
                    specified target percentage.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border',
                      effectiveSessionProfit > 0
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : effectiveSessionProfit < 0
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                    )}
                  >
                    {isFrequencyBotTrading && (
                      <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                    )}
                    <span>Profit: ${effectiveSessionProfit.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111217] border border-[#2d2f36] rounded-xl text-[11px] font-bold font-mono">
                    <span className="text-emerald-400">W: {frequencyBotWins}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-rose-400">L: {frequencyBotLosses}</span>
                  </div>
                  {hasVirtualToken && frequencyBotVirtualMode && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-[11px] font-bold font-mono">
                      <span className="text-purple-300">VW: {frequencyBotVirtualWins}</span>
                      <span className="text-slate-600">/</span>
                      <span className="text-amber-300">VL: {frequencyBotVirtualLosses}</span>
                    </div>
                  )}
                </div>
              </div>

              {hasVirtualToken && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0b0d] px-4 py-3 rounded-2xl border border-purple-500/25">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isFrequencyBotTrading}
                      onClick={() => setFrequencyBotVirtualMode(!frequencyBotVirtualMode)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50',
                        frequencyBotVirtualMode
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-[#111217] text-slate-400 border-[#2d2f36]'
                      )}
                    >
                      Virtual Mode ($0.35 API): {frequencyBotVirtualMode ? 'ON' : 'OFF'}
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Trades connected virtual account ($0.35), then switches to Real immediately after virtual losses
                    </span>
                  </div>
                  {frequencyBotVirtualMode && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                        V-Losses Target:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        disabled={isFrequencyBotTrading}
                        value={frequencyBotVirtualLossesTarget}
                        onChange={(e) =>
                          setFrequencyBotVirtualLossesTarget(
                            Math.max(1, parseInt(e.target.value, 10) || 1)
                          )
                        }
                        className="w-16 bg-[#111217] border border-purple-500/40 text-white text-xs font-mono font-bold rounded-lg px-2 py-1 text-center outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4 items-end bg-[#0a0b0d] p-4 rounded-2xl border border-[#2d2f36]/60">
                {/* Stake */}
                <div className="space-y-1.5 col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                      Stake (USD)
                    </label>
                    <button
                      type="button"
                      disabled={isFrequencyBotTrading}
                      onClick={() =>
                        setFrequencyBotAutoStakeEnabled(!frequencyBotAutoStakeEnabled)
                      }
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer',
                        frequencyBotAutoStakeEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#111217] text-slate-500 border border-[#2d2f36] hover:text-slate-300'
                      )}
                    >
                      Auto {frequencyBotAutoStakeEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {frequencyBotAutoStakeEnabled ? (
                    <div className="flex items-center gap-1 bg-[#111217] border border-emerald-500/40 rounded-xl px-2.5 py-2">
                      <input
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.1"
                        disabled={isFrequencyBotTrading}
                        value={frequencyBotAutoStakePct}
                        onChange={(e) =>
                          setFrequencyBotAutoStakePct(
                            Math.max(0.1, parseFloat(e.target.value) || 0.1)
                          )
                        }
                        className="w-full bg-transparent text-white text-xs font-mono font-bold outline-none"
                      />
                      <span className="text-xs text-emerald-400 font-bold">%</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0.35"
                      step="0.01"
                      disabled={isFrequencyBotTrading}
                      value={frequencyBotStake}
                      onChange={(e) =>
                        setFrequencyBotStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))
                      }
                      className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                    />
                  )}
                </div>

                {/* Martingale */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                    Martingale (x)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    disabled={isFrequencyBotTrading}
                    value={frequencyBotMartingale}
                    onChange={(e) =>
                      setFrequencyBotMartingale(Math.max(1, parseFloat(e.target.value) || 1))
                    }
                    className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                  />
                </div>

                {/* Duration */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                    Duration (Ticks)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="1"
                    disabled={isFrequencyBotTrading}
                    value={frequencyBotDuration}
                    onChange={(e) =>
                      setFrequencyBotDuration(
                        Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                  />
                </div>

                {/* Contract Type */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                    Contract Type
                  </label>
                  <select
                    disabled={isFrequencyBotTrading}
                    value={frequencyBotContractType}
                    onChange={(e: any) => setFrequencyBotContractType(e.target.value)}
                    className="w-full bg-[#111217] border border-[#2d2f36]/80 text-white text-xs font-sans font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <option value="coldest">Coldest Ticker</option>
                    <option value="differ">Digit Differ</option>
                    <option value="over">Digit Over</option>
                    <option value="under">Digit Under</option>
                    <option value="even">Even</option>
                    <option value="odd">Odd</option>
                  </select>
                </div>

                {/* Circle Mode */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-[#29a79a] font-sans">
                    Circle Mode
                  </label>
                  <button
                    type="button"
                    disabled={isFrequencyBotTrading}
                    onClick={() =>
                      setFrequencyBotCircleModeEnabled(!frequencyBotCircleModeEnabled)
                    }
                    className={cn(
                      'w-full text-xs font-bold rounded-xl px-3 py-2.5 outline-none transition-all border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50',
                      frequencyBotCircleModeEnabled
                        ? 'bg-[#29a79a]/10 text-[#29a79a] border-[#29a79a]/30 hover:bg-[#29a79a]/15'
                        : 'bg-[#111217] text-[#9ba1a6] border-[#2d2f36] hover:bg-[#1a1c23]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        frequencyBotCircleModeEnabled ? 'bg-[#29a79a] animate-pulse' : 'bg-gray-600'
                      )}
                    />
                    {frequencyBotCircleModeEnabled ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {frequencyBotCircleModeEnabled && (
                  <>
                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                        Circle Option
                      </label>
                      <select
                        disabled={isFrequencyBotTrading}
                        value={frequencyBotCircleType}
                        onChange={(e: any) => setFrequencyBotCircleType(e.target.value)}
                        className="w-full bg-[#111217] border border-[#ff444f]/40 text-white text-xs font-sans font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <option value="green">Green Circle</option>
                        <option value="blue">Blue Circle</option>
                        <option value="orange">Orange Circle</option>
                        <option value="red">Red Circle</option>
                      </select>
                    </div>

                    {(frequencyBotContractType === 'over' ||
                      frequencyBotContractType === 'under') && (
                      <div className="space-y-1.5 col-span-1">
                        <label className="block text-[9px] font-black uppercase tracking-widest text-[#29a79a] font-sans">
                          Prediction Digit
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="9"
                          step="1"
                          disabled={isFrequencyBotTrading}
                          value={frequencyBotPredictionDigit}
                          onChange={(e) =>
                            setFrequencyBotPredictionDigit(
                              Math.max(0, Math.min(9, parseInt(e.target.value, 10) || 0))
                            )
                          }
                          className="w-full bg-[#111217] border border-[#29a79a]/40 text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#29a79a] transition-all disabled:opacity-50"
                        />
                      </div>
                    )}
                  </>
                )}

                {frequencyBotContractType !== 'even' && frequencyBotContractType !== 'odd' ? (
                  <>
                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                        Target Pct (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        disabled={isFrequencyBotTrading || frequencyBotCircleModeEnabled}
                        value={frequencyBotTargetPct}
                        onChange={(e) =>
                          setFrequencyBotTargetPct(
                            Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                          )
                        }
                        className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                      />
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                        Specific Digits
                      </label>
                      <button
                        type="button"
                        disabled={isFrequencyBotTrading || frequencyBotCircleModeEnabled}
                        onClick={() =>
                          setFrequencyBotDigitFilterEnabled(!frequencyBotDigitFilterEnabled)
                        }
                        className={cn(
                          'w-full text-xs font-bold rounded-xl px-3 py-2.5 outline-none transition-all border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50',
                          frequencyBotDigitFilterEnabled
                            ? 'bg-[#ff444f]/10 text-[#ff444f] border-[#ff444f]/30 hover:bg-[#ff444f]/15'
                            : 'bg-[#111217] text-[#9ba1a6] border-[#2d2f36] hover:bg-[#1a1c23]'
                        )}
                      >
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            frequencyBotDigitFilterEnabled
                              ? 'bg-[#ff444f] animate-pulse'
                              : 'bg-gray-600'
                          )}
                        />
                        {frequencyBotDigitFilterEnabled ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    {frequencyBotDigitFilterEnabled && (
                      <>
                        <div className="space-y-1.5 col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                            Trade Digits
                          </label>
                          <input
                            type="text"
                            disabled={isFrequencyBotTrading}
                            value={frequencyBotFilterDigits}
                            onChange={(e) =>
                              setFrequencyBotFilterDigits(e.target.value.replace(/[^0-9,]/g, ''))
                            }
                            placeholder="e.g. 0,1,2"
                            className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                            Compare Direction
                          </label>
                          <button
                            type="button"
                            disabled={isFrequencyBotTrading}
                            onClick={() =>
                              setFrequencyBotFilterCompareMode(
                                frequencyBotFilterCompareMode === 'higher' ? 'lower' : 'higher'
                              )
                            }
                            className={cn(
                              'w-full text-xs font-bold rounded-xl px-3 py-2.5 outline-none transition-all border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50',
                              frequencyBotFilterCompareMode === 'higher'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15'
                            )}
                          >
                            {frequencyBotFilterCompareMode === 'higher'
                              ? 'Higher (>=)'
                              : 'Lower (<=)'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                        Target Pct
                      </label>
                      <select
                        disabled={isFrequencyBotTrading || frequencyBotCircleModeEnabled}
                        value={frequencyBotEvenOddMode}
                        onChange={(e: any) => setFrequencyBotEvenOddMode(e.target.value)}
                        className="w-full bg-[#111217] border border-[#2d2f36]/80 text-white text-xs font-sans font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <option value="high_even">High Even%</option>
                        <option value="low_even">Low Even%</option>
                        <option value="low_odd">Low Odd%</option>
                        <option value="high_odd">High Odd%</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                        Benchmark %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        disabled={isFrequencyBotTrading || frequencyBotCircleModeEnabled}
                        value={frequencyBotBenchmarkPct}
                        onChange={(e) =>
                          setFrequencyBotBenchmarkPct(
                            Math.max(0, Math.min(100, parseFloat(e.target.value) || 10.3))
                          )
                        }
                        className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                      />
                    </div>
                  </>
                )}

                {/* Take Profit & Runs Limit */}
                <div className="space-y-1.5 col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                      {frequencyBotMaxRunsEnabled ? 'No. of Runs (Wins)' : 'Take Profit ($)'}
                    </label>
                    <button
                      type="button"
                      disabled={isFrequencyBotTrading}
                      onClick={() => setFrequencyBotMaxRunsEnabled(!frequencyBotMaxRunsEnabled)}
                      className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer',
                        frequencyBotMaxRunsEnabled
                          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          : 'bg-[#111217] text-slate-500 border border-[#2d2f36] hover:text-slate-300'
                      )}
                    >
                      Runs {frequencyBotMaxRunsEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {frequencyBotMaxRunsEnabled ? (
                    <div className="flex items-center gap-1 bg-[#111217] border border-indigo-500/40 rounded-xl px-2.5 py-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={isFrequencyBotTrading}
                        value={frequencyBotMaxRuns}
                        onChange={(e) =>
                          setFrequencyBotMaxRuns(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-full bg-transparent text-white text-xs font-mono font-bold outline-none"
                      />
                      <span className="text-[10px] text-indigo-400 font-bold shrink-0">Wins</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      disabled={isFrequencyBotTrading}
                      value={frequencyBotTp}
                      onChange={(e) =>
                        setFrequencyBotTp(Math.max(0.1, parseFloat(e.target.value) || 0.1))
                      }
                      className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                    />
                  )}
                </div>

                {/* Stop Loss */}
                <div className="space-y-1.5 col-span-1">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                    Stop Loss ($)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    disabled={isFrequencyBotTrading}
                    value={frequencyBotSl}
                    onChange={(e) =>
                      setFrequencyBotSl(Math.max(0.1, parseFloat(e.target.value) || 0.1))
                    }
                    className="w-full bg-[#111217] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                  />
                </div>

                {/* Market Switch Strategy */}
                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                    Market Switch Strategy
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#111217] p-1 rounded-xl border border-[#2d2f36] h-[38px] items-center">
                    {[
                      { id: 'off', label: 'Off' },
                      { id: 'loss', label: 'On Loss' },
                      { id: 'always', label: 'On Trade' },
                    ].map((opt) => {
                      const isActive = marketSwitchMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={isFrequencyBotTrading}
                          onClick={() => onSetMarketSwitchMode(opt.id as any)}
                          className={cn(
                            'py-1.5 px-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer select-none disabled:opacity-50',
                            isActive
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                              : 'text-slate-500 hover:text-[#9ba1a6]'
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Smart Recovery Header */}
                <div className="col-span-full border-t border-[#2d2f36]/40 pt-4 mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black uppercase tracking-widest text-rose-400">
                      Smart Recovery
                    </h4>
                    <p className="text-[10px] text-[#9ba1a6]">
                      Alternative criteria applied exclusively on recovery stakes (losses &gt; 0)
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-bold text-[#9ba1a6] uppercase tracking-widest">
                      Smart Recovery
                    </span>
                    <button
                      type="button"
                      disabled={isFrequencyBotTrading}
                      onClick={() =>
                        setFrequencyBotSmartRecoveryEnabled(!frequencyBotSmartRecoveryEnabled)
                      }
                      className={cn(
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50',
                        frequencyBotSmartRecoveryEnabled ? 'bg-rose-500' : 'bg-[#111217]'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          frequencyBotSmartRecoveryEnabled ? 'translate-x-5' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {frequencyBotSmartRecoveryEnabled && (
                  <div className="col-span-full grid grid-cols-2 sm:grid-cols-4 gap-4 items-end mt-2 p-4 bg-[#111217]/50 rounded-2xl border border-rose-500/20 shadow-inner">
                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                        Rec. Contract Type
                      </label>
                      <select
                        disabled={isFrequencyBotTrading}
                        value={frequencyBotRecoveryContractType}
                        onChange={(e: any) => setFrequencyBotRecoveryContractType(e.target.value)}
                        className="w-full bg-[#0a0b0d] border border-[#2d2f36]/80 text-white text-xs font-sans font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <option value="coldest">Coldest Ticker</option>
                        <option value="differ">Digit Differ</option>
                        <option value="over">Digit Over</option>
                        <option value="under">Digit Under</option>
                        <option value="even">Even</option>
                        <option value="odd">Odd</option>
                      </select>
                    </div>

                    {(frequencyBotRecoveryContractType === 'differ' ||
                      frequencyBotRecoveryContractType === 'over' ||
                      frequencyBotRecoveryContractType === 'under') &&
                      frequencyBotCircleModeEnabled && (
                        <div className="space-y-1.5 col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                            Rec. Circle Option
                          </label>
                          <select
                            disabled={isFrequencyBotTrading}
                            value={frequencyBotRecoveryCircleType}
                            onChange={(e: any) =>
                              setFrequencyBotRecoveryCircleType(e.target.value)
                            }
                            className="w-full bg-[#0a0b0d] border border-[#ff444f]/40 text-white text-xs font-sans font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <option value="green">Green Circle</option>
                            <option value="blue">Blue Circle</option>
                            <option value="orange">Orange Circle</option>
                            <option value="red">Red Circle</option>
                          </select>
                        </div>
                      )}

                    {frequencyBotCircleModeEnabled &&
                      (frequencyBotRecoveryContractType === 'over' ||
                        frequencyBotRecoveryContractType === 'under') && (
                        <div className="space-y-1.5 col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-[#29a79a] font-sans">
                            Rec. Prediction Digit
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="9"
                            step="1"
                            disabled={isFrequencyBotTrading}
                            value={frequencyBotRecoveryPredictionDigit}
                            onChange={(e) =>
                              setFrequencyBotRecoveryPredictionDigit(
                                Math.max(0, Math.min(9, parseInt(e.target.value, 10) || 0))
                              )
                            }
                            className="w-full bg-[#0a0b0d] border border-[#29a79a]/40 text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#29a79a] transition-all disabled:opacity-50"
                          />
                        </div>
                      )}

                    {frequencyBotRecoveryContractType !== 'even' &&
                    frequencyBotRecoveryContractType !== 'odd' ? (
                      <>
                        <div className="space-y-1.5 col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                            Rec. Target Pct (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            disabled={
                              isFrequencyBotTrading || frequencyBotCircleModeEnabled
                            }
                            value={frequencyBotRecoveryTargetPct}
                            onChange={(e) =>
                              setFrequencyBotRecoveryTargetPct(
                                Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                              )
                            }
                            className="w-full bg-[#0a0b0d] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                          />
                        </div>

                        {frequencyBotDigitFilterEnabled && (
                          <div className="space-y-1.5 col-span-1">
                            <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                              Rec. Trade Digits
                            </label>
                            <input
                              type="text"
                              disabled={isFrequencyBotTrading}
                              placeholder="e.g. 0,1,2"
                              value={frequencyBotRecoveryFilterDigits}
                              onChange={(e) =>
                                setFrequencyBotRecoveryFilterDigits(
                                  e.target.value.replace(/[^0-9,]/g, '')
                                )
                              }
                              className="w-full bg-[#0a0b0d] border border-[#2d2f36] text-white text-xs font-mono font-bold rounded-xl px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all disabled:opacity-50"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5 col-span-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-[#9ba1a6] font-sans">
                            Rec. Compare Direction
                          </label>
                          <button
                            type="button"
                            disabled={isFrequencyBotTrading}
                            onClick={() =>
                              setFrequencyBotRecoveryCompareMode(
                                frequencyBotRecoveryCompareMode === 'higher' ? 'lower' : 'higher'
                              )
                            }
                            className={cn(
                              'w-full text-xs font-bold rounded-xl px-3 py-2.5 outline-none transition-all border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50',
                              frequencyBotRecoveryCompareMode === 'higher'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15'
                            )}
                          >
                            {frequencyBotRecoveryCompareMode === 'higher'
                              ? 'Higher (>=)'
                              : 'Lower (<=)'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-3 text-[10px] text-[#9ba1a6] italic bg-[#0a0b0d] p-3 rounded-xl border border-[#2d2f36] flex items-center justify-center h-[38px]">
                        Even/Odd recovery matches use global Benchmark percentage and Even/Odd
                        modes.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {!isFrequencyBotTrading ? (
                  <button
                    type="button"
                    onClick={startFrequencyBot}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-xs font-black uppercase tracking-widest text-white rounded-xl shadow-md cursor-pointer"
                  >
                    <Play size={14} fill="currentColor" />
                    RUN
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopFrequencyBot}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all text-xs font-black uppercase tracking-widest text-white rounded-xl shadow-md animate-pulse cursor-pointer"
                  >
                    <Square size={14} fill="currentColor" />
                    STOP
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Price Action Monitor */}
          <div className="bg-[#111217] rounded-3xl border border-[#2d2f36] p-8 shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#9ba1a6] flex items-center gap-2">
                  <LineIcon size={18} className="text-rose-400" />
                  Market Momentum
                </h3>
                <p className="text-xs text-[#555]">Real-time tick flow visualization</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Active Feed
                </span>
              </div>
            </div>
            <MarketMomentumAreaChart data={priceHistoryData} />
          </div>
        </div>

        {/* Right Panel: Signals & Volatility Gauge */}
        <div className="space-y-8">
          {/* Live Recommendation Badge */}
          <div className="bg-[#111217] rounded-3xl border border-[#2d2f36] p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
              <Target size={120} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9ba1a6] mb-8 flex items-center gap-2">
              <Target size={16} /> Live AI Selection
            </h3>

            <div className="flex flex-col items-center justify-center text-center space-y-6">
              {scanBestMarket ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                        Market Recommended
                      </span>
                    </div>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tighter">
                      {scanBestMarket.name}
                    </h4>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[.2em]">
                      Conf: {Number(scanBestMarket.confidence || 0).toFixed(1)}%
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-[#555] uppercase tracking-widest mb-1">
                        Cold Digit
                      </p>
                      <p className="text-xl font-black text-indigo-400">{scanBestMarket.digit}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black text-[#555] uppercase tracking-widest mb-1">
                        Frequency
                      </p>
                      <p className="text-xl font-black text-white">
                        {Number(scanBestMarket.frequency || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {symbol !== scanBestMarket.symbol && marketSwitchMode === 'off' && (
                    <button
                      type="button"
                      onClick={() => onChangeSymbol(scanBestMarket.symbol)}
                      className="w-full py-3 bg-white hover:bg-white/90 text-black rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                    >
                      Switch To This Market
                    </button>
                  )}

                  {marketSwitchMode !== 'off' && (
                    <div className="flex items-center gap-2 py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-full justify-center">
                      <RefreshCw size={12} className="text-emerald-400 animate-spin" />
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                        {marketSwitchMode === 'loss'
                          ? 'Auto-Switch (On Loss)'
                          : 'Auto-Switch (On Trade)'}
                      </span>
                    </div>
                  )}

                  <div className="w-full pt-2">
                    {isAutoTrading ? (
                      <button
                        type="button"
                        onClick={onStopAutoTrade}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 animate-pulse cursor-pointer"
                      >
                        Stop AI Scanner Bot
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartAutoTrade(scanBestMarket)}
                        className="w-full py-3 bg-[#ff444f] hover:bg-[#ff444f]/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                      >
                        Start AI Scanner Bot
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-10 space-y-4">
                  <div className="w-12 h-12 bg-[#1a1c23] rounded-2xl flex items-center justify-center mx-auto mb-2 animate-pulse">
                    <Search size={20} className="text-[#555]" />
                  </div>
                  <p className="text-xs font-bold text-[#555] uppercase tracking-widest leading-relaxed">
                    Background neural scanner <br /> tracking best markets live.
                  </p>
                </div>
              )}

              <div className="space-y-2 w-full pt-4 border-t border-white/5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-[#9ba1a6]">
                  <span>Bot Switch Strategy</span>
                  <span
                    className={cn(
                      'text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                      marketSwitchMode === 'off'
                        ? 'bg-white/10 text-slate-400'
                        : marketSwitchMode === 'loss'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    )}
                  >
                    {marketSwitchMode === 'off'
                      ? 'Disabled'
                      : marketSwitchMode === 'loss'
                      ? 'On Loss'
                      : 'Every Trade'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-[#0a0b0d] p-1 rounded-xl border border-[#2d2f36] w-full">
                  {[
                    { id: 'off', label: 'Off' },
                    { id: 'loss', label: 'On Loss' },
                    { id: 'always', label: 'On Trade' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSetMarketSwitchMode(opt.id as any)}
                      className={cn(
                        'py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer select-none',
                        marketSwitchMode === opt.id
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                          : 'text-[#555] hover:text-[#9ba1a6]'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[8px] font-bold text-[#444] uppercase tracking-widest">
                  Last Scan: {lastScanTime ?? 'Not Scanned'}
                </p>
              </div>
            </div>
          </div>

          {/* Volatility Gauge */}
          <div className="bg-[#111217] rounded-3xl border border-[#2d2f36] p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Gauge size={120} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9ba1a6] mb-8 flex items-center gap-2">
              <Gauge size={16} /> Volatility Gauge
            </h3>

            <div className="flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-40 h-40">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="none" stroke="#1a1c23" strokeWidth="12" />
                  <motion.circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke={
                      analysis?.predictions.accumulator === 'STABLE' ? '#10b981' : '#f59e0b'
                    }
                    strokeWidth="12"
                    strokeDasharray="440"
                    initial={{ strokeDashoffset: 440 }}
                    animate={{
                      strokeDashoffset:
                        440 * (1 - Math.min(1, (analysis?.volatilityScore || 0) * 5000)),
                    }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={cn(
                      'text-2xl font-black uppercase tracking-tighter',
                      analysis?.predictions.accumulator === 'STABLE'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    )}
                  >
                    {analysis?.predictions.accumulator ?? 'Scanning'}
                  </span>
                  <span className="text-[10px] font-bold text-[#555] uppercase tracking-widest">
                    Market Feed
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-[#9ba1a6]">
                  Status:{' '}
                  <span className="text-white capitalize">
                    {analysis?.predictions.accumulator === 'STABLE'
                      ? 'Low Volatility'
                      : 'High Volatility'}
                  </span>
                </p>
                <p className="text-[10px] text-[#555] max-w-[180px]">
                  Accumulators/Stable: Ideal when price action is smooth and flat.
                </p>
              </div>
            </div>
          </div>

          {/* AI Intelligence Panel */}
          <div className="bg-gradient-to-br from-[#1a1c2e] to-[#111217] rounded-3xl border border-indigo-500/30 p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />

            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-6 flex items-center gap-2">
              <Zap size={16} className="text-indigo-400" /> AI Market Intelligence
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">
                  Market State
                </p>
                <p
                  className={cn(
                    'text-lg font-black tracking-tighter',
                    analysis?.aiSignals?.market_state === 'STABLE'
                      ? 'text-emerald-400'
                      : analysis?.aiSignals?.market_state === 'VOLATILE'
                      ? 'text-amber-400'
                      : 'text-rose-500'
                  )}
                >
                  {analysis?.aiSignals?.market_state ?? 'SCANNING'}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">
                  AI Confidence
                </p>
                <p className="text-lg font-black tracking-tighter text-white">
                  {analysis?.aiSignals ? `${(analysis.aiSignals.confidence * 100).toFixed(0)}%` : '0%'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-[#9ba1a6] uppercase">Trade Bias</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-black uppercase',
                    analysis?.aiSignals?.rise_fall === 'RISE'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : analysis?.aiSignals?.rise_fall === 'FALL'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-white/10 text-white'
                  )}
                >
                  {analysis?.aiSignals?.rise_fall ?? 'WAITING'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-[#9ba1a6] uppercase">Entry Pulse</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-black uppercase',
                    analysis?.aiSignals?.accumulator === 'ENTER'
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50'
                      : 'bg-white/10 text-[#555]'
                  )}
                >
                  {analysis?.aiSignals?.accumulator ?? 'WAIT'}
                </span>
              </div>
            </div>
          </div>

          {/* Signal Engine v5.1 */}
          <div className="bg-[#111217] rounded-3xl border border-[#2d2f36] p-8 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#9ba1a6] mb-6 flex items-center gap-2">
              <ShieldCheck size={16} /> Signal Engine v5.1
            </h3>

            <div className="space-y-4">
              <SignalRow
                label="Matches"
                signal={analysis?.predictions.matches.signal.toString() ?? '—'}
                hint="Bet on cold digit"
                confidence="High"
                onClick={() =>
                  onLoadSignalToTerminal({
                    symbol,
                    type: 'differ',
                    target: analysis?.predictions.matches.signal,
                  })
                }
              />
              <SignalRow
                label="Differs"
                signal={analysis?.predictions.differs.signal.toString() ?? '—'}
                hint="Avoid hot digit"
                confidence="High"
                onClick={() =>
                  onLoadSignalToTerminal({
                    symbol,
                    type: 'differ',
                    target: analysis?.predictions.differs.signal,
                  })
                }
              />
              <SignalRow
                label="Over/Under"
                signal={analysis?.predictions.overUnder ?? '—'}
                hint="Counter-trend play"
                confidence="Medium"
                onClick={() => {
                  const isOver = analysis?.predictions.overUnder?.includes('Over');
                  onLoadSignalToTerminal({
                    symbol,
                    type: isOver ? 'over' : 'under',
                    target: isOver ? 5 : 4,
                  });
                }}
              />
              <SignalRow
                label="Even/Odd"
                signal={analysis?.predictions.evenOdd ?? '—'}
                hint="Mean reversion bias"
                confidence="Medium"
              />
              <SignalRow
                label="Rise/Fall"
                signal={analysis?.predictions.riseFall ?? '—'}
                hint="SMA-500 Trend"
                confidence="High"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
