import React, { useEffect, useMemo, useState } from 'react';
import {
  Play,
  Square,
  Zap,
  Check,
  TrendingUp,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  BotSettings,
  DEFAULT_SETTINGS,
  MARKETS,
  SessionStats,
  TickPoint,
  TradeType,
  VALID_DIGITS,
} from '../types';
import { ContractIcon, MarketLogo } from '../components/ContractIcons';

interface AutoBotPageProps {
  multiTicks: Record<string, TickPoint[]>;
  session: SessionStats;
  connected: boolean;
  currency: string;
  onSubscribeMarkets: (symbols: string[]) => void;
  onStartWithSettings: (settings: BotSettings) => Promise<void>;
  onStopTrading: () => Promise<void>;
  onLoadToTerminal: (settings: BotSettings) => void;
}

type ScannerStrategy =
  | 'coldest_digit'
  | 'axa_pattern'
  | 'streak'
  | 'over_under_zone'
  | 'calm_noise';

interface AutoBotConfig {
  scannerStrategy: ScannerStrategy;
  contractType: TradeType;
  targetDigit: number;
  streakThreshold: number;
  stake: number;
  ticks: number;
  mart: boolean;
  mult: number;
  virtual: boolean;
  vneed: number;
  tp: number;
  sl: number;
  growth: number;
  atp: number;
  checkedMarkets: string[];
}

const STORAGE_KEY = 'otivo_autobot_config_v1';

const DEFAULT_AUTOBOT_CONFIG: AutoBotConfig = {
  scannerStrategy: 'axa_pattern',
  contractType: 'Differs',
  targetDigit: 4,
  streakThreshold: 3,
  stake: 1,
  ticks: 1,
  mart: false,
  mult: 2.1,
  virtual: false,
  vneed: 2,
  tp: 10,
  sl: 20,
  growth: 0.02,
  atp: 1,
  checkedMarkets: ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V', 'R_10', 'R_25', 'R_50', 'R_75', 'R_100'],
};

function loadConfig(): AutoBotConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_AUTOBOT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_AUTOBOT_CONFIG;
}

interface MarketSignalResult {
  symbol: string;
  label: string;
  latestQuote: number | null;
  latestDigit: number | null;
  recentDigits: number[];
  signalActive: boolean;
  signalSummary: string;
  suggestedType: TradeType;
  suggestedDigit: number;
  confidence: number;
}

function analyzeMarket(
  symbol: string,
  label: string,
  pts: TickPoint[],
  cfg: AutoBotConfig
): MarketSignalResult {
  const digits = pts.map((p) => p.lastDigit);
  const recentDigits = digits.slice(-10);
  const latest = pts.length > 0 ? pts[pts.length - 1] : null;
  const latestDigit = latest ? latest.lastDigit : null;
  const latestQuote = latest ? latest.quote : null;

  if (digits.length < 10) {
    return {
      symbol,
      label,
      latestQuote,
      latestDigit,
      recentDigits,
      signalActive: false,
      signalSummary: `Buffering (${digits.length}/10 ticks)`,
      suggestedType: cfg.contractType,
      suggestedDigit: cfg.targetDigit,
      confidence: 0,
    };
  }

  // Frequency counts over last 100 ticks
  const windowDigits = digits.slice(-100);
  const counts = Array(10).fill(0);
  for (const d of windowDigits) counts[d]++;
  const freqs = counts.map((c) => (c / windowDigits.length) * 100);

  let coldestDigit = 0;
  let minPct = Infinity;
  for (let d = 0; d <= 9; d++) {
    if (freqs[d] < minPct) {
      minPct = freqs[d];
      coldestDigit = d;
    }
  }

  // AXA Pattern check: d[n-3] === d[n-1] && d[n-3] !== d[n-2]
  const n = digits.length;
  const d1 = digits[n - 3];
  const d2 = digits[n - 2];
  const d3 = digits[n - 1];
  const isAxa = d1 === d3 && d1 !== d2;

  // Consecutive streak check (even/odd or same digit)
  let sameParityStreak = 1;
  const lastParity = d3 % 2;
  for (let i = n - 2; i >= 0; i--) {
    if (digits[i] % 2 === lastParity) sameParityStreak++;
    else break;
  }

  // Over/Under low/high zone coldness
  const lowZonePct = freqs[0] + freqs[1];
  const highZonePct = freqs[8] + freqs[9];

  // Calm noise: no immediate repeat in last 5 ticks
  const last5 = digits.slice(-5);
  let repeats = 0;
  for (let i = 1; i < last5.length; i++) {
    if (last5[i] === last5[i - 1]) repeats++;
  }

  if (cfg.scannerStrategy === 'axa_pattern') {
    return {
      symbol,
      label,
      latestQuote,
      latestDigit,
      recentDigits,
      signalActive: isAxa,
      signalSummary: isAxa
        ? `AXA ${d1}-${d2}-${d3} · Differ ${d2}`
        : `Pattern ${d1}-${d2}-${d3} (Scanning)`,
      suggestedType: 'Differs',
      suggestedDigit: isAxa ? d2 : coldestDigit,
      confidence: isAxa ? 92 : 45,
    };
  }

  if (cfg.scannerStrategy === 'coldest_digit') {
    const strong = minPct <= 7.5;
    return {
      symbol,
      label,
      latestQuote,
      latestDigit,
      recentDigits,
      signalActive: strong,
      signalSummary: `Coldest D${coldestDigit} (${minPct.toFixed(1)}%)`,
      suggestedType: 'Differs',
      suggestedDigit: coldestDigit,
      confidence: Math.min(96, Math.round((12 - minPct) * 10)),
    };
  }

  if (cfg.scannerStrategy === 'streak') {
    const active = sameParityStreak >= cfg.streakThreshold;
    const parityLabel = lastParity === 0 ? 'EVEN' : 'ODD';
    return {
      symbol,
      label,
      latestQuote,
      latestDigit,
      recentDigits,
      signalActive: active,
      signalSummary: `${sameParityStreak}x ${parityLabel} streak`,
      suggestedType: lastParity === 0 ? 'Odd' : 'Even',
      suggestedDigit: cfg.targetDigit,
      confidence: active ? Math.min(95, 55 + sameParityStreak * 8) : 40,
    };
  }

  if (cfg.scannerStrategy === 'over_under_zone') {
    const overSignal = lowZonePct <= 17 && (d3 === 0 || d3 === 1);
    const underSignal = highZonePct <= 17 && (d3 === 8 || d3 === 9);
    const active = overSignal || underSignal;
    return {
      symbol,
      label,
      latestQuote,
      latestDigit,
      recentDigits,
      signalActive: active,
      signalSummary: overSignal
        ? `Low zone ${lowZonePct.toFixed(1)}% · Over 1`
        : underSignal
        ? `High zone ${highZonePct.toFixed(1)}% · Under 8`
        : `0-1: ${lowZonePct.toFixed(0)}% · 8-9: ${highZonePct.toFixed(0)}%`,
      suggestedType: underSignal ? 'Under' : 'Over',
      suggestedDigit: underSignal ? 8 : 1,
      confidence: active ? 88 : 48,
    };
  }

  // Calm noise
  const calmActive = repeats === 0 && minPct <= 9.0;
  return {
    symbol,
    label,
    latestQuote,
    latestDigit,
    recentDigits,
    signalActive: calmActive,
    signalSummary: calmActive
      ? `Calm variance · Differ ${coldestDigit}`
      : `Noise repeats=${repeats} · D${coldestDigit} (${minPct.toFixed(1)}%)`,
    suggestedType: 'Differs',
    suggestedDigit: coldestDigit,
    confidence: calmActive ? 86 : 44,
  };
}

const AUTOBOT_TYPES: TradeType[] = [
  'Differs',
  'Over',
  'Under',
  'Even',
  'Odd',
  'Rise',
  'Fall',
  'Accumulator',
];

export const AutoBotPage: React.FC<AutoBotPageProps> = ({
  multiTicks,
  session,
  connected,
  currency,
  onSubscribeMarkets,
  onStartWithSettings,
  onStopTrading,
  onLoadToTerminal,
}) => {
  const [config, setConfig] = useState<AutoBotConfig>(loadConfig);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const isRunning = session.status === 'running' || session.status === 'stopping';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  useEffect(() => {
    if (config.checkedMarkets.length > 0) {
      onSubscribeMarkets(config.checkedMarkets);
    }
  }, [config.checkedMarkets.join(',')]);

  const updateConfig = (patch: Partial<AutoBotConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const toggleMarket = (sym: string) => {
    setConfig((prev) => {
      const exists = prev.checkedMarkets.includes(sym);
      if (exists && prev.checkedMarkets.length <= 1) return prev;
      return {
        ...prev,
        checkedMarkets: exists
          ? prev.checkedMarkets.filter((m) => m !== sym)
          : [...prev.checkedMarkets, sym],
      };
    });
  };

  const marketSignals = useMemo(() => {
    return MARKETS.filter((m) => config.checkedMarkets.includes(m.symbol))
      .map((m) => analyzeMarket(m.symbol, m.label, multiTicks[m.symbol] || [], config))
      .sort((a, b) => Number(b.signalActive) - Number(a.signalActive) || b.confidence - a.confidence);
  }, [multiTicks, config]);

  const bestSignal = marketSignals[0];

  const buildBotSettings = (marketSym: string, overrideType?: TradeType, overrideDigit?: number): BotSettings => {
    const chosenType = overrideType ?? config.contractType;
    const digit = overrideDigit ?? config.targetDigit;
    const digits: BotSettings['digits'] = { ...DEFAULT_SETTINGS.digits };
    if (chosenType === 'Differs' || chosenType === 'Over' || chosenType === 'Under') {
      const validPool = VALID_DIGITS[chosenType];
      digits[chosenType] = validPool.includes(digit) ? digit : validPool[0];
    }
    return {
      ...DEFAULT_SETTINGS,
      market: marketSym,
      exec: 'normal',
      mode: 'single',
      types: [chosenType],
      digits,
      growth: config.growth,
      atp: config.atp,
      stake: chosenType === 'Accumulator' ? Math.max(1, config.stake) : config.stake,
      ticks: config.ticks,
      mart: config.mart,
      mult: config.mult,
      virtual: config.virtual,
      vneed: config.vneed,
      tp: config.tp,
      sl: config.sl,
    };
  };

  const handleStartAutoBot = async (targetMarket?: string, t?: TradeType, d?: number) => {
    setError(null);
    if (!connected) {
      setError('Connect your Deriv API token using the red button in the top bar first.');
      return;
    }
    setStarting(true);
    try {
      const sym = targetMarket ?? bestSignal?.symbol ?? config.checkedMarkets[0] ?? 'R_100';
      await onStartWithSettings(buildBotSettings(sym, t, d));
    } catch (err: any) {
      setError(err?.message || 'Could not start AutoBot.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Strip */}
      <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#ff444f]" />
            <h1 className="text-base font-semibold text-white">
              Multi-Market AutoBot Matrix
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Scans {config.checkedMarkets.length} live synthetic indices simultaneously for AXA deadzones, digit coldness, parity streaks, and Over/Under imbalances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {bestSignal && (
            <button
              type="button"
              onClick={() =>
                onLoadToTerminal(
                  buildBotSettings(
                    bestSignal.symbol,
                    bestSignal.suggestedType,
                    bestSignal.suggestedDigit
                  )
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-700"
            >
              <span>Load Best ({bestSignal.label})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {isRunning ? (
            <button
              type="button"
              onClick={() => onStopTrading()}
              className="flex items-center gap-2 rounded-lg bg-[#ff444f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e63a44]"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop AutoBot</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!connected || starting}
              onClick={() =>
                handleStartAutoBot(
                  bestSignal?.symbol,
                  bestSignal?.suggestedType,
                  bestSignal?.suggestedDigit
                )
              }
              className="flex items-center gap-2 rounded-lg bg-[#00a79e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00948c] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{starting ? 'Starting...' : 'Auto-Trade Best Signal'}</span>
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: AutoBot Configuration */}
        <section className="xl:col-span-4 2xl:col-span-3 rounded-xl border border-[#1F2937] bg-[#111827] p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1F2937] pb-3">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Scanner & Execution Rules</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Scanner Engine Mode
            </label>
            <select
              value={config.scannerStrategy}
              disabled={isRunning}
              onChange={(e) =>
                updateConfig({ scannerStrategy: e.target.value as ScannerStrategy })
              }
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="axa_pattern">AXA Pattern Deadzone (Differs)</option>
              <option value="coldest_digit">Coldest Digit Frequency (Differs)</option>
              <option value="streak">Parity Streak Reversal (Even/Odd)</option>
              <option value="over_under_zone">Over 1 / Under 8 Cold Zone</option>
              <option value="calm_noise">Calm Noise Variance</option>
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">
              Fallback Contract Type
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-1.5">
              {AUTOBOT_TYPES.map((t) => {
                const active = config.contractType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isRunning}
                    onClick={() => updateConfig({ contractType: t })}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600/15 text-white'
                        : 'border-[#1F2937] bg-[#0B0F17] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ContractIcon type={t} className="w-4 h-4" />
                    <span className="truncate">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Stake ({currency})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.35"
                disabled={isRunning}
                value={config.stake}
                onChange={(e) => updateConfig({ stake: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Duration (Ticks)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                disabled={isRunning}
                value={config.ticks}
                onChange={(e) => updateConfig({ ticks: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Take Profit ({currency})
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                disabled={isRunning}
                value={config.tp}
                onChange={(e) => updateConfig({ tp: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-emerald-400 tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Stop Loss ({currency})
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                disabled={isRunning}
                value={config.sl}
                onChange={(e) => updateConfig({ sl: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-red-400 tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5 border-t border-[#1F2937] pt-3">
            <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>Martingale Recovery (x{config.mult})</span>
              <input
                type="checkbox"
                disabled={isRunning}
                checked={config.mart}
                onChange={(e) => updateConfig({ mart: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            {config.mart && (
              <input
                type="number"
                step="0.1"
                min="1.1"
                max="50"
                disabled={isRunning}
                value={config.mult}
                onChange={(e) => updateConfig({ mult: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white"
              />
            )}

            <label className="flex items-center justify-between text-xs text-slate-200 cursor-pointer">
              <span>Virtual Loss Filter ({config.vneed}L)</span>
              <input
                type="checkbox"
                disabled={isRunning}
                checked={config.virtual}
                onChange={(e) => updateConfig({ virtual: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </div>

          {/* Monitored Markets Checklist */}
          <div className="border-t border-[#1F2937] pt-3 space-y-2">
            <span className="block text-xs font-medium text-slate-400">
              Monitored Markets ({config.checkedMarkets.length})
            </span>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {MARKETS.map((m) => {
                const checked = config.checkedMarkets.includes(m.symbol);
                return (
                  <button
                    key={m.symbol}
                    type="button"
                    onClick={() => toggleMarket(m.symbol)}
                    className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                      checked
                        ? 'border-blue-500/60 bg-blue-600/10 text-white'
                        : 'border-[#1F2937] bg-[#0B0F17] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span className="truncate">{m.label}</span>
                    {checked && <Check className="h-3 w-3 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Live Market Matrix */}
        <section className="xl:col-span-8 2xl:col-span-9 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 content-start">
          {marketSignals.map((item) => (
            <div
              key={item.symbol}
              className={`rounded-xl border p-4 transition-colors space-y-3 ${
                item.signalActive
                  ? 'border-[#00a79e]/70 bg-[#111827]'
                  : 'border-[#1F2937] bg-[#111827]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MarketLogo symbol={item.symbol} className="w-8 h-8" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {item.label}
                    </h3>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {item.latestQuote !== null ? item.latestQuote : 'Connecting...'}
                    </span>
                  </div>
                </div>

                <span
                  className={`font-mono text-xs font-semibold px-2 py-1 rounded ${
                    item.signalActive
                      ? 'bg-[#00a79e]/15 text-[#00a79e]'
                      : 'bg-[#0B0F17] text-slate-400'
                  }`}
                >
                  {item.signalActive ? `SIGNAL ${item.confidence}%` : 'SCANNING'}
                </span>
              </div>

              {/* Last 10 Digits Strip */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {item.recentDigits.length === 0 ? (
                  <span className="text-[11px] text-slate-500">Waiting for live ticks...</span>
                ) : (
                  item.recentDigits.map((d, idx) => {
                    const isLast = idx === item.recentDigits.length - 1;
                    return (
                      <span
                        key={idx}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold tabular-nums ${
                          isLast
                            ? 'bg-[#ff444f] text-white'
                            : d % 2 === 0
                            ? 'bg-[#0B0F17] text-[#00a79e] border border-[#1F2937]'
                            : 'bg-[#0B0F17] text-slate-300 border border-[#1F2937]'
                        }`}
                      >
                        {d}
                      </span>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-[#1F2937] pt-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 min-w-0">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{item.signalSummary}</span>
                </div>

                <button
                  type="button"
                  disabled={!connected || isRunning}
                  onClick={() =>
                    handleStartAutoBot(
                      item.symbol,
                      item.suggestedType,
                      item.suggestedDigit
                    )
                  }
                  className="rounded-lg bg-blue-600/20 border border-blue-500/40 px-2.5 py-1.5 text-[11px] font-semibold text-blue-300 hover:bg-blue-600 hover:text-white disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
                >
                  Trade {item.suggestedType}
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
