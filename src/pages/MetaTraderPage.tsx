import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Play,
  Square,
  X,
  Calendar,
} from 'lucide-react';
import {
  AccountInfo,
  MT5_SYMBOLS,
  OpenPosition,
  TickPoint,
} from '../types';

export interface MtClosedTrade {
  id: string;
  symbol: string;
  contractType: string;
  buyPrice: number;
  profit: number;
  entrySpot?: string | number;
  exitSpot?: string | number;
  timestamp: string;
}

interface MetaTraderPageProps {
  account: AccountInfo | null;
  positions: OpenPosition[];
  multiTicks: Record<string, TickPoint[]>;
  lastClosedTrade: MtClosedTrade | null;
  onSubscribeMarkets: (symbols: string[]) => void;
}

const LOT_TO_USD = 10;

const MULTIPLIER_MAP: Record<string, number> = {
  BOOM50: 4000,
  BOOM150: 2000,
  BOOM300N: 100,
  BOOM500: 400,
  BOOM1000: 500,
  CRASH50: 4000,
  CRASH150: 2000,
  CRASH300N: 100,
  CRASH500: 400,
  CRASH1000: 500,
  '1HZ10V': 4000,
  R_10: 4000,
  '1HZ25V': 1600,
  R_25: 1600,
  '1HZ50V': 800,
  R_50: 800,
  '1HZ100V': 400,
  R_100: 400,
};

function getAlternatedMarket(sym: string): { symbol: string; direction: 'MULTUP' | 'MULTDOWN' } {
  const upper = sym.toUpperCase();
  if (upper.startsWith('CRASH')) {
    const counterpart = `BOOM${upper.replace('CRASH', '')}`;
    const valid = MT5_SYMBOLS.some((s) => s.symbol === counterpart);
    return { symbol: valid ? counterpart : 'BOOM1000', direction: 'MULTDOWN' };
  }
  if (upper.startsWith('BOOM')) {
    const counterpart = `CRASH${upper.replace('BOOM', '')}`;
    const valid = MT5_SYMBOLS.some((s) => s.symbol === counterpart);
    return { symbol: valid ? counterpart : 'CRASH1000', direction: 'MULTUP' };
  }
  return { symbol: 'CRASH1000', direction: 'MULTUP' };
}

export const MetaTraderPage: React.FC<MetaTraderPageProps> = ({
  account,
  positions,
  multiTicks,
  lastClosedTrade,
  onSubscribeMarkets,
}) => {
  const connected = Boolean(account?.connected);
  const balance = account?.balance ?? 0;
  const currency = account?.currency ?? 'USD';
  const accountKey = account?.loginId || 'guest';

  const [subTab, setSubTab] = useState<'trade' | 'history'>(
    () => (localStorage.getItem('otivo_mt5_subtab') as 'trade' | 'history') || 'trade'
  );
  const [category, setCategory] = useState<'multiplier' | 'rise_fall'>(
    () => (localStorage.getItem('otivo_mt5_category') as 'multiplier' | 'rise_fall') || 'multiplier'
  );
  const [symbol, setSymbol] = useState<string>(
    () => localStorage.getItem('otivo_mt5_symbol') || 'BOOM50'
  );
  const [lotSize, setLotSize] = useState<string>(
    () => localStorage.getItem('otivo_mt5_lot') || '0.10'
  );
  const [autoClose, setAutoClose] = useState<boolean>(
    () => localStorage.getItem('otivo_mt5_autoclose') === 'true'
  );
  const [tpValue, setTpValue] = useState<string>(
    () => localStorage.getItem('otivo_mt5_tp') || '1.00'
  );
  const [martingaleAutoClose, setMartingaleAutoClose] = useState<boolean>(
    () => localStorage.getItem('otivo_mt5_mart_autoclose') === 'true'
  );
  const [autoTrades, setAutoTrades] = useState<boolean>(
    () => localStorage.getItem('otivo_mt5_autotrades') === 'true'
  );
  const [strategy, setStrategy] = useState<'manual' | 'hedging' | 'spike_detector'>(
    () => (localStorage.getItem('otivo_mt5_strategy') as any) || 'manual'
  );
  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(
    () => localStorage.getItem('otivo_mt5_collapsed') === 'true'
  );
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>(
    () => (localStorage.getItem('otivo_mt5_period') as any) || 'week'
  );

  const [isHedgingRunning, setIsHedgingRunning] = useState(false);
  const [isSpikeRunning, setIsSpikeRunning] = useState(false);
  const [history, setHistory] = useState<MtClosedTrade[]>(() => {
    try {
      const saved = localStorage.getItem(`otivo_mt5_history_${accountKey}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [orderBusy, setOrderBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const closingIdsRef = useRef<Set<string>>(new Set());
  const handledClosedIdsRef = useRef<Set<string>>(new Set());
  const recoveryRef = useRef<{ count: number; loss: number; origLot: string; origTp: string }>({
    count: 0,
    loss: 0,
    origLot: lotSize,
    origTp: tpValue,
  });
  const lastPriceRef = useRef<number | null>(null);
  const lastSpikeAtRef = useRef<number>(0);

  // Persist all settings
  useEffect(() => {
    localStorage.setItem('otivo_mt5_subtab', subTab);
  }, [subTab]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_category', category);
  }, [category]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_symbol', symbol);
  }, [symbol]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_lot', lotSize);
  }, [lotSize]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_autoclose', String(autoClose));
  }, [autoClose]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_tp', tpValue);
  }, [tpValue]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_mart_autoclose', String(martingaleAutoClose));
  }, [martingaleAutoClose]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_autotrades', String(autoTrades));
  }, [autoTrades]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_strategy', strategy);
  }, [strategy]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_collapsed', String(controlsCollapsed));
  }, [controlsCollapsed]);
  useEffect(() => {
    localStorage.setItem('otivo_mt5_period', period);
  }, [period]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`otivo_mt5_history_${accountKey}`);
      setHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setHistory([]);
    }
  }, [accountKey]);

  useEffect(() => {
    onSubscribeMarkets([symbol]);
  }, [symbol]);

  useEffect(() => {
    if (connected) {
      fetch('/api/mt/portfolio').catch(() => {});
    }
  }, [connected]);

  const placeOrder = async (
    direction: 'MULTUP' | 'MULTDOWN',
    overrideLot?: string,
    overrideSym?: string
  ) => {
    setError(null);
    if (!connected) {
      setError('Connect your Deriv API token using the red button in the top bar first.');
      return;
    }
    const targetSymbol = overrideSym || symbol;
    const lotNum = parseFloat(overrideLot || lotSize);
    const stake = Number((lotNum * LOT_TO_USD).toFixed(2));
    if (!Number.isFinite(stake) || stake <= 0) {
      setError('Invalid lot size.');
      return;
    }

    const contractType =
      category === 'rise_fall'
        ? direction === 'MULTUP'
          ? 'CALL'
          : 'PUT'
        : direction;

    setOrderBusy(true);
    try {
      const res = await fetch('/api/mt/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: targetSymbol,
          contractType,
          stake,
          multiplier: MULTIPLIER_MAP[targetSymbol] || 100,
          duration: 1,
          durationUnit: 'm',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order rejected');
    } catch (err: any) {
      setError(err?.message || 'Failed to place order.');
    } finally {
      setOrderBusy(false);
    }
  };

  const closePosition = async (id: string) => {
    if (closingIdsRef.current.has(id)) return;
    closingIdsRef.current.add(id);
    try {
      await fetch('/api/mt/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: id }),
      });
    } finally {
      setTimeout(() => closingIdsRef.current.delete(id), 3000);
    }
  };

  // AutoClose TP check on open positions
  useEffect(() => {
    if (!autoClose || positions.length === 0) return;
    const tpNum = parseFloat(tpValue);
    if (!Number.isFinite(tpNum) || tpNum <= 0) return;

    for (const pos of positions) {
      if (pos.profit >= tpNum && !closingIdsRef.current.has(pos.id)) {
        closePosition(pos.id);
      }
    }
  }, [positions, autoClose, tpValue]);

  // Handle closed positions -> History, Martingale Recovery, & AutoTrades
  useEffect(() => {
    if (!lastClosedTrade || handledClosedIdsRef.current.has(lastClosedTrade.id)) return;
    handledClosedIdsRef.current.add(lastClosedTrade.id);

    setHistory((prev) => {
      const next = [lastClosedTrade, ...prev.filter((x) => x.id !== lastClosedTrade.id)].slice(0, 300);
      try {
        localStorage.setItem(`otivo_mt5_history_${accountKey}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    let triggeredRecovery = false;
    if (martingaleAutoClose) {
      if (lastClosedTrade.profit < 0) {
        triggeredRecovery = true;
        if (recoveryRef.current.count === 0) {
          recoveryRef.current.origLot = lotSize;
          recoveryRef.current.origTp = tpValue;
        }
        recoveryRef.current.count += 1;
        recoveryRef.current.loss += Math.abs(lastClosedTrade.profit);
        const baseTp = parseFloat(recoveryRef.current.origTp) || 1;
        const nextTp = (recoveryRef.current.loss + baseTp).toFixed(2);
        const baseLot = parseFloat(recoveryRef.current.origLot) || 0.1;
        const nextLot = Math.max(
          baseLot * Math.pow(2, recoveryRef.current.count),
          (recoveryRef.current.loss + baseTp) / (0.3 * LOT_TO_USD)
        ).toFixed(2);

        const alt = getAlternatedMarket(lastClosedTrade.symbol);
        setLotSize(nextLot);
        setTpValue(nextTp);
        setAutoClose(true);
        setSymbol(alt.symbol);
        setNotice(`Martingale recovery on ${alt.symbol} · Lot ${nextLot} · TP ${nextTp}`);
        setTimeout(() => {
          placeOrder(alt.direction, nextLot, alt.symbol);
        }, 700);
      } else if (recoveryRef.current.count > 0) {
        setLotSize(recoveryRef.current.origLot);
        setTpValue(recoveryRef.current.origTp);
        recoveryRef.current.count = 0;
        recoveryRef.current.loss = 0;
        setNotice(`Martingale recovery succeeded (+${lastClosedTrade.profit.toFixed(2)} ${currency}). Lot restored.`);
      }
    }

    if (!triggeredRecovery && autoTrades) {
      const sym = lastClosedTrade.symbol || symbol;
      const dir: 'MULTUP' | 'MULTDOWN' = sym.toUpperCase().startsWith('BOOM')
        ? 'MULTDOWN'
        : 'MULTUP';
      setTimeout(() => {
        placeOrder(dir, undefined, sym);
      }, 800);
    }
  }, [lastClosedTrade]);

  // Auto Hedging loop
  useEffect(() => {
    if (!connected || strategy !== 'hedging' || !isHedgingRunning) return;
    const onSymbol = positions.filter((p) => p.symbol === symbol);
    if (onSymbol.length === 0) {
      const timer = setTimeout(async () => {
        await placeOrder('MULTUP');
        await placeOrder('MULTDOWN');
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [positions, connected, strategy, isHedgingRunning, symbol]);

  // Spike Detector loop
  useEffect(() => {
    if (!connected || strategy !== 'spike_detector' || !isSpikeRunning) {
      lastPriceRef.current = null;
      return;
    }
    const pts = multiTicks[symbol] || [];
    if (pts.length === 0) return;
    const price = pts[pts.length - 1].quote;
    const prev = lastPriceRef.current;
    lastPriceRef.current = price;
    if (prev === null) return;

    const diff = price - prev;
    const upper = symbol.toUpperCase();
    const threshold = upper.includes('300') ? 3.5 : upper.includes('1000') ? 3.0 : 2.0;
    const now = Date.now();
    if (now - lastSpikeAtRef.current >= 4000) {
      if (upper.startsWith('BOOM') && diff >= threshold) {
        lastSpikeAtRef.current = now;
        placeOrder('MULTDOWN');
      } else if (upper.startsWith('CRASH') && diff <= -threshold) {
        lastSpikeAtRef.current = now;
        placeOrder('MULTUP');
      }
    }
  }, [multiTicks, connected, strategy, isSpikeRunning, symbol]);

  const totalPnL = positions.reduce((acc, p) => acc + p.profit, 0);
  const totalMargin = positions.reduce((acc, p) => acc + p.buyPrice, 0);
  const equity = balance + totalPnL;
  const freeMargin = balance - totalMargin + totalPnL;
  const marginLevel = totalMargin > 0 ? (equity / totalMargin) * 100 : 0;

  const symbolList =
    category === 'rise_fall'
      ? MT5_SYMBOLS.filter((s) => !s.symbol.startsWith('BOOM') && !s.symbol.startsWith('CRASH'))
      : MT5_SYMBOLS;

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    return history.filter((item) => {
      const ts = new Date(item.timestamp).getTime();
      if (Number.isNaN(ts)) return true;
      if (period === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return ts >= d.getTime();
      }
      if (period === 'week') return ts >= now - 7 * 86_400_000;
      if (period === 'month') return ts >= now - 30 * 86_400_000;
      return true;
    });
  }, [history, period]);

  const historyTotal = filteredHistory.reduce((acc, h) => acc + h.profit, 0);

  return (
    <div className="space-y-4">
      {/* Sub-navigation: Trade vs History */}
      <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('trade')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'trade'
                ? 'bg-blue-600 text-white'
                : 'bg-[#111827] border border-[#1F2937] text-slate-400 hover:text-white'
            }`}
          >
            Trade Terminal ({positions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-[#111827] border border-[#1F2937] text-slate-400 hover:text-white'
            }`}
          >
            History ({filteredHistory.length})
          </button>
        </div>

        {subTab === 'trade' && (
          <button
            type="button"
            onClick={() => setControlsCollapsed(!controlsCollapsed)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-1.5 text-xs text-slate-300 hover:text-white"
          >
            {controlsCollapsed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>{controlsCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-blue-900/50 bg-blue-950/30 px-4 py-2.5 text-xs text-blue-300">
          {notice}
        </div>
      )}

      {subTab === 'trade' ? (
        <div className="space-y-4">
          {/* MT5 Account Metrics Strip */}
          <section className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#1F2937] rounded-xl border border-[#1F2937] bg-[#111827]">
            <div className="p-3.5">
              <span className="block text-[11px] text-slate-400">Balance</span>
              <span className="mt-1 block font-mono text-sm sm:text-base font-bold text-white tabular-nums">
                {balance.toFixed(2)} {currency}
              </span>
            </div>
            <div className="p-3.5">
              <span className="block text-[11px] text-slate-400">Equity</span>
              <span
                className={`mt-1 block font-mono text-sm sm:text-base font-bold tabular-nums ${
                  totalPnL > 0 ? 'text-blue-400' : totalPnL < 0 ? 'text-red-400' : 'text-white'
                }`}
              >
                {equity.toFixed(2)} {currency}
              </span>
            </div>
            <div className="p-3.5">
              <span className="block text-[11px] text-slate-400">Margin</span>
              <span className="mt-1 block font-mono text-sm sm:text-base font-bold text-white tabular-nums">
                {totalMargin.toFixed(2)}
              </span>
            </div>
            <div className="p-3.5">
              <span className="block text-[11px] text-slate-400">Free Margin</span>
              <span className="mt-1 block font-mono text-sm sm:text-base font-bold text-white tabular-nums">
                {freeMargin.toFixed(2)}
              </span>
            </div>
            <div className="p-3.5 col-span-2 sm:col-span-1">
              <span className="block text-[11px] text-slate-400">Margin Level</span>
              <span className="mt-1 block font-mono text-sm sm:text-base font-bold text-white tabular-nums">
                {totalMargin > 0 ? `${marginLevel.toFixed(1)}%` : '—'}
              </span>
            </div>
          </section>

          {!controlsCollapsed && (
            <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Contract Type</label>
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] p-1">
                    {(['multiplier', 'rise_fall'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategory(cat);
                          if (cat === 'rise_fall' && (symbol.startsWith('BOOM') || symbol.startsWith('CRASH'))) {
                            setSymbol('1HZ10V');
                          }
                        }}
                        className={`rounded py-1.5 text-xs font-medium ${
                          category === cat ? 'bg-[#1F2937] text-white' : 'text-slate-400'
                        }`}
                      >
                        {cat === 'multiplier' ? 'Multiplier' : 'Rise / Fall'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Market Symbol</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    {symbolList.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.label} ({s.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Lot Size (Stake {(parseFloat(lotSize || '0') * LOT_TO_USD).toFixed(2)} {currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Automation Mode</label>
                  <select
                    value={strategy}
                    onChange={(e) => {
                      const next = e.target.value as 'manual' | 'hedging' | 'spike_detector';
                      setStrategy(next);
                      setIsHedgingRunning(false);
                      setIsSpikeRunning(false);
                    }}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="manual">Manual Execution</option>
                    <option value="hedging">Auto Hedging (Buy + Sell)</option>
                    <option value="spike_detector">Boom/Crash Spike Detector</option>
                  </select>
                </div>
              </div>

              {/* Risk Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#1F2937] pt-3">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoClose}
                      onChange={(e) => setAutoClose(e.target.checked)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span>AutoClose TP</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={tpValue}
                    onChange={(e) => setTpValue(e.target.value)}
                    className="w-20 rounded border border-[#1F2937] bg-[#111827] px-2 py-1 font-mono text-xs text-emerald-400 text-right"
                  />
                </div>

                <label className="flex items-center justify-between rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-slate-200 cursor-pointer">
                  <span>Martingale AutoClose</span>
                  <input
                    type="checkbox"
                    checked={martingaleAutoClose}
                    onChange={(e) => setMartingaleAutoClose(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-slate-200 cursor-pointer">
                  <span>Continuous Auto Trades</span>
                  <input
                    type="checkbox"
                    checked={autoTrades}
                    onChange={(e) => setAutoTrades(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                </label>
              </div>

              {/* SELL / BUY or Strategy Execution Buttons */}
              {strategy === 'manual' ? (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!connected || orderBusy}
                    onClick={() => placeOrder('MULTDOWN')}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#ff444f] py-3 text-sm font-bold text-white hover:bg-[#e63a44] disabled:opacity-50"
                  >
                    <TrendingDown className="h-4 w-4" />
                    <span>SELL BY MARKET</span>
                  </button>
                  <button
                    type="button"
                    disabled={!connected || orderBusy}
                    onClick={() => placeOrder('MULTUP')}
                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>BUY BY MARKET</span>
                  </button>
                </div>
              ) : strategy === 'hedging' ? (
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => setIsHedgingRunning(!isHedgingRunning)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white ${
                    isHedgingRunning ? 'bg-[#ff444f]' : 'bg-[#00a79e]'
                  } disabled:opacity-50`}
                >
                  {isHedgingRunning ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  <span>{isHedgingRunning ? 'Stop Auto Hedging' : 'Start Auto Hedging'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => setIsSpikeRunning(!isSpikeRunning)}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white ${
                    isSpikeRunning ? 'bg-[#ff444f]' : 'bg-[#00a79e]'
                  } disabled:opacity-50`}
                >
                  {isSpikeRunning ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  <span>{isSpikeRunning ? 'Stop Spike Detector' : 'Start Spike Detector'}</span>
                </button>
              )}
            </section>
          )}

          {/* Open Positions */}
          <section className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
            <div className="border-b border-[#1F2937] px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Open Positions</h2>
              <span
                className={`font-mono text-xs font-bold tabular-nums ${
                  totalPnL > 0 ? 'text-blue-400' : totalPnL < 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {totalPnL >= 0 ? '+' : ''}
                {totalPnL.toFixed(2)} {currency}
              </span>
            </div>

            {positions.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-500">
                No open MT5 positions. Place an order above to start monitoring live profit.
              </p>
            ) : (
              <div className="divide-y divide-[#1F2937]">
                {positions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {pos.symbol}{' '}
                        <span className="font-mono text-[11px] text-blue-400">
                          {pos.contractType}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                        Lot {(pos.buyPrice / LOT_TO_USD).toFixed(2)} · Stake {pos.buyPrice.toFixed(2)} {pos.currency}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          pos.profit >= 0 ? 'text-blue-400' : 'text-red-400'
                        }`}
                      >
                        {pos.profit >= 0 ? '+' : ''}
                        {pos.profit.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => closePosition(pos.id)}
                        className="flex items-center gap-1 rounded-md border border-red-900/50 bg-red-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-900/50"
                      >
                        <X className="h-3 w-3" />
                        <span>Close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* ==================== HISTORY SUB-TAB ==================== */
        <section className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
          <div className="border-b border-[#1F2937] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Net Closed P/L:</span>
              <strong
                className={`font-mono tabular-nums ${
                  historyTotal >= 0 ? 'text-blue-400' : 'text-red-400'
                }`}
              >
                {historyTotal >= 0 ? '+' : ''}
                {historyTotal.toFixed(2)} {currency}
              </strong>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'Last Week' },
                  { id: 'month', label: 'Last Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    period === p.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0B0F17] text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <p className="py-12 text-center text-xs text-slate-500">
              No closed MetaTrader orders for the selected period.
            </p>
          ) : (
            <div className="divide-y divide-[#1F2937]">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {item.symbol}{' '}
                      <span className="font-mono text-[11px] text-slate-400">
                        {item.contractType} · {(item.buyPrice / LOT_TO_USD).toFixed(2)} lot
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${
                      item.profit >= 0 ? 'text-blue-400' : 'text-red-400'
                    }`}
                  >
                    {item.profit >= 0 ? '+' : ''}
                    {item.profit.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
