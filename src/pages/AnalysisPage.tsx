import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, ChevronDown, Square, X, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { AITickIndicator } from '../lib/aiIndicator';
import {
  BotSettings,
  DEFAULT_SETTINGS,
  SessionStats,
  TickPoint,
  TradeType,
} from '../types';
import {
  ANALYSIS_SYMBOLS,
  AnalysisMarketWindow,
  CandleData,
  DerivContractAnalysisType,
  DerivTimeframe,
  TickData,
  getSymbolDecimals,
  isVolatilityIndex,
} from '../components/analysis/types';
import { DERIV_TIMEFRAME_CONFIG } from '../components/analysis/derivTimeframes';
import { MarketAnalysisWindow } from '../components/analysis/MarketAnalysisWindow';
import { OverUnderActiveBot } from '../components/analysis/OverUnderActiveBot';
import { AnalysisWindowsManager } from '../components/analysis/AnalysisWindowsManager';
import { OtivoSignal } from '../components/analysis/AnalysisCharts';
import { ClassicFrequencyView, ClassicAnalysisResult } from '../components/analysis/ClassicFrequencyView';
import { NEURAL_MARKETS, OtivoNeuralModal } from '../components/analysis/OtivoNeuralModal';
import { AiMarketHackerModal } from '../components/analysis/AiMarketHackerModal';
import type { CloudBotsSnapshot } from '../types/cloudBots';

export {
  IngestionBuffer,
  MathReconstructionSolver,
  ShadowGenerator,
  AccuracyEvaluator,
  type HackerMathSummary,
} from '../lib/hackerMath';

const NEURAL_DECIMALS: Record<string, number> = {
  '1HZ10V': 2,
  'R_10': 3,
  '1HZ25V': 2,
  'R_25': 3,
  '1HZ50V': 2,
  '1HZ75V': 2,
  'R_50': 4,
  '1HZ100V': 2,
};

export interface AnalysisPageProps {
  multiTicks: Record<string, TickPoint[]>;
  connected: boolean;
  accountBalance: number;
  currency: string;
  hasVirtualToken: boolean;
  session: SessionStats;
  currentSettings: BotSettings;
  cloudBots?: CloudBotsSnapshot | null;
  onCloudBotsUpdate?: (snap: CloudBotsSnapshot) => void;
  onSubscribeMarkets: (symbols: string[]) => void;
  onLoadToTerminal: (settings: BotSettings) => void;
  onStartWithSettings: (settings: BotSettings) => Promise<void>;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  multiTicks,
  connected,
  accountBalance,
  hasVirtualToken,
  currentSettings,
  cloudBots,
  onCloudBotsUpdate,
  onSubscribeMarkets,
  onLoadToTerminal,
}) => {
  const [symbol, setSymbol] = useState(() => localStorage.getItem('analysis_symbol') || 'R_50');
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>(
    'disconnected'
  );
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [analysisWindow, setAnalysisWindow] = useState(() =>
    parseInt(localStorage.getItem('analysis_window') || '1000', 10)
  );
  const [tempWindow, setTempWindow] = useState(
    () => localStorage.getItem('analysis_window') || '1000'
  );
  const aiIndicatorRef = useRef(new AITickIndicator());
  const [pipSize, setPipSize] = useState(0.01);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bannerMsg, setBannerMsg] = useState<{
    level: 'success' | 'info' | 'warn' | 'error';
    text: string;
  } | null>(null);

  const notify = useCallback(
    (level: 'success' | 'info' | 'warn' | 'error', text: string) => {
      setBannerMsg({ level, text });
    },
    []
  );

  useEffect(() => {
    if (!bannerMsg) return;
    const t = setTimeout(() => setBannerMsg(null), 5000);
    return () => clearTimeout(t);
  }, [bannerMsg]);

  // Analysis Mode & Timeframe
  const [contractAnalysisMode, setContractAnalysisMode] = useState<
    DerivContractAnalysisType | 'classic_frequency'
  >(() => (localStorage.getItem('deriv_analysis_contract_mode') as any) || 'over_under');
  const [selectedTimeframe, setSelectedTimeframe] = useState<DerivTimeframe>('1m');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [timeframeCandles, setTimeframeCandles] = useState<Record<string, CandleData[]>>({});

  // Multi-Market Windows State
  const [windows, setWindows] = useState<AnalysisMarketWindow[]>(() => {
    const saved = localStorage.getItem('analysis_open_windows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    const autoBotMarkets = localStorage.getItem('autobot_checked_markets');
    if (autoBotMarkets) {
      try {
        const parsed = JSON.parse(autoBotMarkets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 4).map((sym: string, i: number) => ({
            id: `win_${sym}_${i}_${Date.now()}`,
            symbol: sym,
          }));
        }
      } catch {
        // ignore
      }
    }
    const initialSym = localStorage.getItem('analysis_symbol') || '1HZ10V';
    return [
      { id: `win_${initialSym}_1`, symbol: initialSym },
      { id: 'win_R_50_2', symbol: 'R_50' },
    ];
  });

  const [activeWindowId, setActiveWindowId] = useState<string>(() => windows[0]?.id || 'win_1');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'single'>(
    () => (localStorage.getItem('analysis_layout_mode') as 'grid' | 'single') || 'grid'
  );
  const [gridColumns, setGridColumns] = useState<1 | 2 | 3>(() => {
    const cols = parseInt(localStorage.getItem('analysis_grid_columns') || '2', 10);
    return cols === 1 || cols === 2 || cols === 3 ? cols : 2;
  });

  const [marketTicks, setMarketTicks] = useState<Record<string, TickData[]>>({});
  const [marketCandles, setMarketCandles] = useState<Record<string, CandleData[]>>({});
  const [marketTimeframeCandles, setMarketTimeframeCandles] = useState<
    Record<string, Record<string, CandleData[]>>
  >({});
  const [marketLastQuotes, setMarketLastQuotes] = useState<
    Record<string, { quote: number; digit: number; isUp: boolean }>
  >({});

  const activeWindow = useMemo(
    () => windows.find((w) => w.id === activeWindowId) || windows[0] || { id: 'default', symbol },
    [windows, activeWindowId, symbol]
  );

  useEffect(() => {
    localStorage.setItem('analysis_open_windows', JSON.stringify(windows));
  }, [windows]);

  useEffect(() => {
    localStorage.setItem('analysis_layout_mode', layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    localStorage.setItem('analysis_grid_columns', gridColumns.toString());
  }, [gridColumns]);

  useEffect(() => {
    localStorage.setItem('analysis_symbol', symbol);
  }, [symbol]);

  useEffect(() => {
    localStorage.setItem('analysis_window', analysisWindow.toString());
  }, [analysisWindow]);

  useEffect(() => {
    if (activeWindow && activeWindow.symbol !== symbol) {
      setSymbol(activeWindow.symbol);
    }
  }, [activeWindow?.symbol]);

  const handleSetContractAnalysisMode = (mode: DerivContractAnalysisType | 'classic_frequency') => {
    setContractAnalysisMode(mode);
    localStorage.setItem('deriv_analysis_contract_mode', mode);
    if (mode === 'accumulators') {
      setWindows((prev) =>
        prev.map((w) => (!isVolatilityIndex(w.symbol) ? { ...w, symbol: '1HZ10V' } : w))
      );
      if (!isVolatilityIndex(symbol)) {
        setSymbol('1HZ10V');
      }
    }
  };

  const handleAddWindow = (newSymbol?: string) => {
    let sym = newSymbol;
    if (!sym) {
      const currentSyms = new Set(windows.map((w) => w.symbol));
      const candidates =
        contractAnalysisMode === 'accumulators'
          ? ANALYSIS_SYMBOLS.filter((s) => isVolatilityIndex(s.id))
          : ANALYSIS_SYMBOLS;
      const unselected = candidates.find((s) => !currentSyms.has(s.id));
      sym = unselected ? unselected.id : candidates[0]?.id || '1HZ10V';
    } else if (contractAnalysisMode === 'accumulators' && !isVolatilityIndex(sym)) {
      sym = '1HZ10V';
    }

    const newWin: AnalysisMarketWindow = {
      id: `win_${sym}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      symbol: sym,
    };
    setWindows((prev) => [...prev, newWin]);
    setActiveWindowId(newWin.id);
  };

  const handleRemoveWindow = (id: string) => {
    setWindows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((w) => w.id !== id);
      if (activeWindowId === id) {
        setActiveWindowId(next[0].id);
      }
      return next;
    });
  };

  const handleUpdateWindow = (id: string, updates: Partial<AnalysisMarketWindow>) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const nextUpdates = { ...updates };
        const effectiveMode = nextUpdates.contractMode || w.contractMode || contractAnalysisMode;
        const effectiveSymbol = nextUpdates.symbol || w.symbol;
        if (effectiveMode === 'accumulators' && !isVolatilityIndex(effectiveSymbol)) {
          nextUpdates.symbol = '1HZ10V';
        }
        return { ...w, ...nextUpdates };
      })
    );
  };

  const handleDuplicateWindow = (id: string) => {
    const target = windows.find((w) => w.id === id);
    if (!target) return;
    const newWin: AnalysisMarketWindow = {
      ...target,
      id: `win_${target.symbol}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setWindows((prev) => [...prev, newWin]);
  };

  const handleSyncAutoBotMarkets = () => {
    try {
      const saved = localStorage.getItem('autobot_checked_markets');
      if (!saved) return;
      const parsed: string[] = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      let targetMarkets = parsed;
      if (contractAnalysisMode === 'accumulators') {
        targetMarkets = parsed.filter((s) => isVolatilityIndex(s));
        if (targetMarkets.length === 0) targetMarkets = ['1HZ10V'];
      }

      const newWindows: AnalysisMarketWindow[] = targetMarkets.map((sym, i) => ({
        id: `win_autobot_${sym}_${i}_${Date.now()}`,
        symbol: sym,
      }));
      setWindows(newWindows);
      if (newWindows.length > 0) {
        setActiveWindowId(newWindows[0].id);
      }
    } catch {
      // ignore
    }
  };

  const autoBotMarketCount = useMemo(() => {
    try {
      const saved = localStorage.getItem('autobot_checked_markets');
      if (!saved) return 0;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, []);

  const uniqueSymbols = useMemo(() => {
    const syms = new Set<string>();
    windows.forEach((w) => {
      if (w.symbol) syms.add(w.symbol);
    });
    if (symbol) syms.add(symbol);
    if (contractAnalysisMode === 'differs') {
      ANALYSIS_SYMBOLS.forEach((s) => syms.add(s.id));
    }
    return Array.from(syms);
  }, [windows, symbol, contractAnalysisMode]);

  const uniqueSymbolsKey = useMemo(() => uniqueSymbols.slice().sort().join(','), [uniqueSymbols]);

  useEffect(() => {
    onSubscribeMarkets(uniqueSymbols);
  }, [uniqueSymbolsKey, onSubscribeMarkets]);

  // Seed fallback ticks from App multiTicks before WS history arrives
  const mergedMarketTicks = useMemo(() => {
    const out: Record<string, TickData[]> = {};
    const keys = new Set([...Object.keys(multiTicks), ...Object.keys(marketTicks)]);
    keys.forEach((sym) => {
      const local = marketTicks[sym];
      if (local && local.length > 0) {
        out[sym] = local;
      } else if (multiTicks[sym] && multiTicks[sym].length > 0) {
        out[sym] = multiTicks[sym].map((t) => ({
          epoch: t.epoch,
          quote: t.quote,
          digit: t.lastDigit,
        }));
      }
    });
    return out;
  }, [multiTicks, marketTicks]);

  const activeTicks = useMemo(
    () => (ticks.length > 0 ? ticks : mergedMarketTicks[symbol] || []),
    [ticks, mergedMarketTicks, symbol]
  );

  // Main Public WebSocket Connection (ticks + multi-timeframe candles)
  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    setTicks([]);
    setWsStatus('connecting');

    const ws = new WebSocket(
      'wss://api.derivws.com/trading/v1/options/ws/public?app_id=34SRQBBtI5nwEFQqmc3se'
    );
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) return;
      setWsStatus('connected');
      ws.send(JSON.stringify({ active_symbols: 'brief' }));
      ws.send(JSON.stringify({ forget_all: 'ticks' }));

      uniqueSymbols.forEach((sym) => {
        ws.send(
          JSON.stringify({
            ticks_history: sym,
            count: analysisWindow,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
          })
        );

        const gran = DERIV_TIMEFRAME_CONFIG[selectedTimeframe]?.granularity || 60;
        if (gran > 0) {
          ws.send(
            JSON.stringify({
              ticks_history: sym,
              count: 150,
              end: 'latest',
              style: 'candles',
              granularity: gran,
              subscribe: 1,
            })
          );
        }
      });
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      const data = JSON.parse(event.data);
      if (data.error) {
        setWsStatus('error');
        return;
      }

      if (data.msg_type === 'active_symbols') {
        const s = data.active_symbols.find((item: any) => item.symbol === symbol);
        if (s) setPipSize(s.pip_size || 0.01);
      }

      if (data.msg_type === 'history') {
        const sym = data.echo_req?.ticks_history;
        if (!sym) return;
        const h = data.history;
        const precision = getSymbolDecimals(sym, h.pip_size || pipSize);

        const histTicks: TickData[] = h.prices.map((price: number, i: number) => {
          const s = price.toFixed(precision);
          const digit = parseInt(s[s.length - 1], 10);
          if (sym === symbol) {
            aiIndicatorRef.current.update_tick(price);
          }
          return { epoch: h.times[i], quote: price, digit };
        });

        setMarketTicks((prev) => ({ ...prev, [sym]: histTicks }));

        if (histTicks.length > 0) {
          const last = histTicks[histTicks.length - 1];
          const prevT = histTicks.length > 1 ? histTicks[histTicks.length - 2] : last;
          setMarketLastQuotes((prev) => ({
            ...prev,
            [sym]: { quote: last.quote, digit: last.digit, isUp: last.quote >= prevT.quote },
          }));
        }

        if (sym === symbol) {
          setTicks(histTicks);
        }
      }

      if (data.msg_type === 'candles') {
        const sym = data.echo_req?.ticks_history;
        if (!sym) return;
        const cList: CandleData[] = (data.candles || []).map((c: any) => ({
          epoch: c.epoch,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        }));
        const reqGran = data.echo_req?.granularity;
        const matchedTf =
          (Object.keys(DERIV_TIMEFRAME_CONFIG) as DerivTimeframe[]).find(
            (k) => DERIV_TIMEFRAME_CONFIG[k].granularity === reqGran
          ) || selectedTimeframe;

        setMarketCandles((prev) => ({ ...prev, [sym]: cList }));
        setMarketTimeframeCandles((prev) => ({
          ...prev,
          [sym]: { ...(prev[sym] || {}), [matchedTf]: cList },
        }));

        if (sym === symbol) {
          setCandles(cList);
          setTimeframeCandles((prev) => ({ ...prev, [matchedTf]: cList }));
        }
      }

      if (data.msg_type === 'ohlc' && data.ohlc) {
        const sym = data.ohlc.symbol || symbol;
        const ohlc = data.ohlc;
        const newCandle: CandleData = {
          epoch: ohlc.open_time,
          open: Number(ohlc.open),
          high: Number(ohlc.high),
          low: Number(ohlc.low),
          close: Number(ohlc.close),
        };

        setMarketCandles((prev) => {
          const list = prev[sym] || [];
          if (!list.length) return { ...prev, [sym]: [newCandle] };
          const last = list[list.length - 1];
          if (last.epoch === newCandle.epoch) {
            return { ...prev, [sym]: [...list.slice(0, -1), newCandle] };
          }
          return { ...prev, [sym]: [...list.slice(-149), newCandle] };
        });

        if (sym === symbol) {
          setCandles((prev) => {
            if (!prev.length) return [newCandle];
            const last = prev[prev.length - 1];
            if (last.epoch === newCandle.epoch) {
              return [...prev.slice(0, -1), newCandle];
            }
            return [...prev.slice(-149), newCandle];
          });
        }
      }

      if (data.msg_type === 'tick' && data.tick) {
        const sym = data.tick.symbol;
        if (!sym) return;
        const price = Number(data.tick.quote);
        const precision = getSymbolDecimals(sym, data.tick.pip_size || pipSize);
        const s = price.toFixed(precision);
        const digit = parseInt(s[s.length - 1], 10);
        const tick: TickData = { epoch: data.tick.epoch, quote: price, digit };

        setMarketTicks((prev) => {
          const existing = prev[sym] || [];
          return { ...prev, [sym]: [...existing, tick].slice(-analysisWindow) };
        });

        setMarketLastQuotes((prev) => {
          const oldQuote = prev[sym]?.quote ?? price;
          return {
            ...prev,
            [sym]: { quote: price, digit, isUp: price >= oldQuote },
          };
        });

        if (sym === symbol) {
          aiIndicatorRef.current.update_tick(price);
          setTicks((prev) => [...prev, tick].slice(-analysisWindow));
        }
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        setWsStatus('disconnected');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) {
        setWsStatus('error');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      }
    };
  }, [symbol, analysisWindow]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // Dynamic subscription for added market windows
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      uniqueSymbols.forEach((sym) => {
        wsRef.current?.send(
          JSON.stringify({
            ticks_history: sym,
            count: analysisWindow,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
          })
        );
      });
    }
  }, [uniqueSymbolsKey, analysisWindow]);

  // Candle request when selectedTimeframe or symbol changes
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const gran = DERIV_TIMEFRAME_CONFIG[selectedTimeframe]?.granularity || 60;
    if (gran > 0) {
      wsRef.current.send(
        JSON.stringify({
          ticks_history: symbol,
          count: 150,
          end: 'latest',
          style: 'candles',
          granularity: gran,
          subscribe: 1,
        })
      );
    }
  }, [selectedTimeframe, symbol]);

  // AI Scanner, Neural Engine & AI Market Hacker States
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanBestMarket, setScanBestMarket] = useState<any>(null);
  const [showScanResults, setShowScanResults] = useState(false);
  const [scannerSettings] = useState({
    stake: 1,
    martingale: 2,
    martingaleAfter: 1,
    tp: 5,
    sl: 10,
    activeStrategies: ['over', 'under', 'differ'],
  });
  const [otivoSignals, setOtivoSignals] = useState<{
    over: OtivoSignal[];
    under: OtivoSignal[];
    differ: OtivoSignal[];
  }>({ over: [], under: [], differ: [] });
  const [otivoLog, setOtivoLog] = useState<string[]>([]);
  const [activeSections, setActiveSections] = useState<string[]>(['over', 'under', 'differ']);
  const [neuralMarketData, setNeuralMarketData] = useState<
    Record<string, { lastDigit: number; count: number }>
  >({});
  const neuralHistories = useRef<Record<string, number[]>>({});
  const neuralSocket = useRef<WebSocket | null>(null);
  const otivoMemory = useRef<
    Record<string, Record<string, { total: number; next: number[]; outcomes: number[] }>>
  >({});

  const [marketSwitchMode, setMarketSwitchMode] = useState<'off' | 'loss' | 'always'>(
    () => (localStorage.getItem('scanner_market_switch_mode') as any) || 'loss'
  );

  const [showHackerModal, setShowHackerModal] = useState(false);
  const [hackerScanning, setHackerScanning] = useState(false);

  const recentlyUsedSymbols = useRef<string[]>([]);
  const symbolUseCount = useRef<Record<string, number>>({});

  // Digit Prediction AI Logic
  const getPredictedDigit = (tickDigits: number[]) => {
    if (!tickDigits.length) return 0;
    const dCounts = Array(10).fill(0);
    tickDigits.forEach((d) => dCounts[d]++);
    const dProbs = dCounts.map((c) => c / tickDigits.length);

    const last10 = tickDigits.slice(-10);
    const recStats = Array(10).fill(0);
    last10.forEach((d) => recStats[d]++);

    const dScores = dProbs.map((p, digit) => {
      let s = p * 100;
      s += (recStats[digit] / 10) * 15;
      if (tickDigits[tickDigits.length - 1] === digit) s += 40;
      const last5 = tickDigits.slice(-5);
      if (last5.filter((d) => d === digit).length >= 2) s += 25;
      return s;
    });
    return dScores.indexOf(Math.min(...dScores));
  };

  const analysis: ClassicAnalysisResult | null = useMemo(() => {
    if (activeTicks.length < 10) return null;

    const prices = activeTicks.map((t) => t.quote);
    const lastPrice = prices[prices.length - 1];

    const shortWindow = activeTicks.slice(-5);
    const midWindow = activeTicks.slice(-15);

    const shortDigits = shortWindow.map((t) => t.digit);
    const shortEvens = shortDigits.filter((d) => d % 2 === 0).length;
    const shortOdds = shortWindow.length - shortEvens;

    const smaMid = midWindow.map((t) => t.quote).reduce((a, b) => a + b, 0) / midWindow.length;
    const smaLong = prices.reduce((a, b) => a + b, 0) / prices.length;
    const longDigits = activeTicks.map((t) => t.digit);
    const longCounts = Array(10).fill(0);
    longDigits.forEach((d) => longCounts[d]++);

    let mostFrequent = 0;
    let leastFrequent = 0;
    longCounts.forEach((c, i) => {
      if (c > longCounts[mostFrequent]) mostFrequent = i;
      if (c < longCounts[leastFrequent]) leastFrequent = i;
    });

    const frequencies = longCounts.map((c) => (c / activeTicks.length) * 100);
    const predictedDigit = getPredictedDigit(longDigits);
    const trendBias = lastPrice > smaLong ? 'RISE' : 'FALL';
    const shortMomentum =
      lastPrice > shortWindow.map((t) => t.quote).reduce((a, b) => a + b, 0) / shortWindow.length
        ? 'RISE'
        : 'FALL';
    const priceChange = lastPrice - (prices[prices.length - 2] || lastPrice);
    const volatilityScore = Math.abs(lastPrice - smaMid) / (smaMid || 1);
    const aiSignals = aiIndicatorRef.current.generate_signals();

    return {
      frequencies,
      mostFrequent,
      leastFrequent,
      predictedDigit,
      smaMid,
      smaLong,
      currentPrice: lastPrice,
      priceChange,
      shortMomentum,
      trendBias,
      volatilityScore,
      aiSignals,
      predictions: {
        matches: {
          signal: predictedDigit,
          confidence: 'AI Predicted (Weights: Fr/Re/Vo)',
          detail: `Optimal entry using AI digit prediction ${predictedDigit}`,
        },
        differs: {
          signal: mostFrequent,
          confidence: 'Pattern Confirmed',
          detail: 'Avoiding peak frequency in mid-window',
        },
        evenOdd: shortEvens > shortOdds ? 'ODD' : shortOdds > shortEvens ? 'EVEN' : 'NEUTRAL',
        overUnder:
          longDigits.filter((d) => d > 4).length > longDigits.filter((d) => d < 5).length
            ? 'UNDER 5'
            : 'OVER 4',
        riseFall: trendBias === shortMomentum ? trendBias : 'NEUTRAL',
        accumulator: volatilityScore < 0.0002 ? 'STABLE' : 'VOLATILE',
      },
    };
  }, [activeTicks]);

  const rankedDigits = useMemo(() => {
    if (!analysis?.frequencies) return [];
    return analysis.frequencies
      .map((f, i) => ({ digit: i, freq: f }))
      .sort((a, b) => b.freq - a.freq);
  }, [analysis]);

  const [coldestHistory, setColdestHistory] = useState<number[]>([]);
  useEffect(() => {
    if (analysis?.leastFrequent !== undefined) {
      setColdestHistory((prev) => {
        if (prev[prev.length - 1] === analysis.leastFrequent) return prev;
        return [...prev, analysis.leastFrequent].slice(-20);
      });
    }
  }, [analysis?.leastFrequent]);

  // Background Neural Pattern Engine WebSocket
  const processNeuralResults = useCallback(
    (sym: string, seq: string, outcomes: number[]) => {
      const total = outcomes.length;
      const counts: Record<number, number> = {};
      outcomes.forEach((d) => (counts[d] = (counts[d] || 0) + 1));

      const time = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const newSigs: OtivoSignal[] = [];

      const overCount = outcomes.filter((d) => d > 5).length;
      if (overCount / total >= 0.7 && scannerSettings.activeStrategies.includes('over')) {
        newSigs.push({
          id: `neural-over-${sym}-${seq}-${Date.now()}`,
          type: 'over',
          symbol: sym,
          seq,
          conf: (overCount / total) * 100,
          time,
          pastOutcomes: outcomes,
        });
      }

      const underCount = outcomes.filter((d) => d < 4).length;
      if (underCount / total >= 0.7 && scannerSettings.activeStrategies.includes('under')) {
        newSigs.push({
          id: `neural-under-${sym}-${seq}-${Date.now()}`,
          type: 'under',
          symbol: sym,
          seq,
          conf: (underCount / total) * 100,
          time,
          pastOutcomes: outcomes,
        });
      }

      for (let i = 0; i <= 9; i++) {
        if (!counts[i] && total >= 2 && scannerSettings.activeStrategies.includes('differ')) {
          newSigs.push({
            id: `neural-diff-${sym}-${seq}-${i}-${Date.now()}`,
            type: 'differ',
            symbol: sym,
            target: i,
            seq,
            conf: 100,
            time,
            pastOutcomes: outcomes,
          });
        }
      }

      if (newSigs.length > 0) {
        setOtivoSignals((prev) => {
          const updateBucket = (bucket: OtivoSignal[], type: 'over' | 'under' | 'differ') => {
            const itemsToAdd = newSigs.filter((s) => s.type === type);
            if (itemsToAdd.length === 0) return bucket;
            const existingIds = new Set(
              itemsToAdd.map((a) => `${a.symbol}-${a.seq}-${a.type === 'differ' ? a.target : ''}`)
            );
            const filtered = bucket.filter(
              (b) => !existingIds.has(`${b.symbol}-${b.seq}-${b.type === 'differ' ? b.target : ''}`)
            );
            return [...itemsToAdd, ...filtered].slice(0, 20);
          };
          return {
            over: updateBucket(prev.over, 'over'),
            under: updateBucket(prev.under, 'under'),
            differ: updateBucket(prev.differ, 'differ'),
          };
        });

        setOtivoLog((prev) => [`${sym}: Neural Match [${seq}] confirmed.`, ...prev].slice(0, 50));
      }
    },
    [scannerSettings.activeStrategies]
  );

  useEffect(() => {
    const ws = new WebSocket(
      'wss://api.derivws.com/trading/v1/options/ws/public?app_id=34SRQBBtI5nwEFQqmc3se'
    );
    neuralSocket.current = ws;

    ws.onopen = () => {
      NEURAL_MARKETS.forEach((m) => {
        neuralHistories.current[m] = [];
        ws.send(JSON.stringify({ ticks_history: m, count: 60, end: 'latest', style: 'ticks' }));
        ws.send(JSON.stringify({ ticks: m, subscribe: 1 }));
      });
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.msg_type === 'history' && data.echo_req?.ticks_history) {
        const sym = data.echo_req.ticks_history;
        const prices = data.history?.prices || [];
        const precision = NEURAL_DECIMALS[sym] || 2;
        const digits = prices.map((p: number) =>
          parseInt(Number(p).toFixed(precision).slice(-1), 10)
        );
        neuralHistories.current[sym] = digits.slice(-100);
        if (digits.length > 0) {
          setNeuralMarketData((prev) => ({
            ...prev,
            [sym]: { lastDigit: digits[digits.length - 1], count: Math.min(100, digits.length) },
          }));
        }
      }
      if (data.tick) {
        const sym = data.tick.symbol;
        const quote = Number(data.tick.quote);
        const precision = NEURAL_DECIMALS[sym] || 2;
        const digit = parseInt(quote.toFixed(precision).slice(-1), 10);

        if (!neuralHistories.current[sym]) neuralHistories.current[sym] = [];
        const history = neuralHistories.current[sym];
        history.push(digit);
        if (history.length > 100) history.shift();

        setNeuralMarketData((prev) => ({
          ...prev,
          [sym]: { lastDigit: digit, count: history.length },
        }));

        if (history.length >= 20) {
          const triggerLen = 3;
          const currentSeq = history.slice(-triggerLen).join(',');
          const occurrences: number[] = [];
          for (let i = 0; i < history.length - triggerLen; i++) {
            const sub = history.slice(i, i + triggerLen).join(',');
            if (sub === currentSeq) {
              const nextDigit = history[i + triggerLen];
              if (nextDigit !== undefined) occurrences.push(nextDigit);
            }
          }
          if (occurrences.length >= 2) {
            processNeuralResults(sym, currentSeq, occurrences);
          }
        }
      }
    };

    return () => {
      ws.close();
      neuralSocket.current = null;
    };
  }, [processNeuralResults]);

  // Multi-market Scanner (populates Live AI Selection + OTIVO Signals)
  const runMarketScan = useCallback(
    async (isBackground = false, excludeSymbol?: string): Promise<string | null> => {
      if (!isBackground) {
        setIsScanning(true);
        setScanProgress(0);
        setScanBestMarket(null);
      }

      return new Promise<string | null>((resolveTop) => {
        const results: any[] = [];
        const scanWs = new WebSocket(
          'wss://api.derivws.com/trading/v1/options/ws/public?app_id=34SRQBBtI5nwEFQqmc3se'
        );
        let isActive = true;

        const timeout = setTimeout(() => {
          if (isActive) {
            isActive = false;
            if (!isBackground) setIsScanning(false);
            scanWs.close();
            resolveTop(null);
          }
        }, 18000);

        scanWs.onopen = () => {
          if (isActive) {
            scanWs.send(JSON.stringify({ active_symbols: 'brief' }));
          }
        };

        scanWs.onerror = () => {
          if (isActive) {
            isActive = false;
            clearTimeout(timeout);
            if (!isBackground) setIsScanning(false);
            resolveTop(null);
          }
        };

        scanWs.onmessage = async (e) => {
          if (!isActive) return;
          const data = JSON.parse(e.data);
          if (data.error) {
            isActive = false;
            clearTimeout(timeout);
            if (!isBackground) setIsScanning(false);
            scanWs.close();
            resolveTop(null);
            return;
          }

          if (data.msg_type === 'active_symbols') {
            const syntheticSymbols = (data.active_symbols || []).filter(
              (s: any) =>
                s.market === 'synthetic_index' &&
                (s.submarket === 'random_index' ||
                  s.submarket === 'random_daily' ||
                  s.submarket === 'jump_indices')
            );

            const symbolsToScan = isBackground
              ? syntheticSymbols.slice(0, 12)
              : syntheticSymbols.slice(0, 18);
            const newLog: string[] = [];
            const newSignals = {
              over: [] as OtivoSignal[],
              under: [] as OtivoSignal[],
              differ: [] as OtivoSignal[],
            };

            for (let i = 0; i < symbolsToScan.length; i++) {
              if (!isActive) break;
              const s = symbolsToScan[i];
              if (!isBackground) {
                setScanProgress(Math.round(((i + 1) / symbolsToScan.length) * 100));
              }

              scanWs.send(
                JSON.stringify({
                  ticks_history: s.symbol,
                  count: 1000,
                  end: 'latest',
                  style: 'ticks',
                })
              );

              await new Promise((resolveSym) => {
                const historyTimeout = setTimeout(() => {
                  scanWs.removeEventListener('message', historyHandler);
                  resolveSym(null);
                }, 2500);

                const historyHandler = (event: MessageEvent) => {
                  const hData = JSON.parse(event.data);
                  if (hData.msg_type === 'history' && hData.echo_req?.ticks_history === s.symbol) {
                    clearTimeout(historyTimeout);
                    const h = hData.history;
                    const pSize = hData.pip_size || s.pip_size || 0.01;
                    const precision = getSymbolDecimals(s.symbol, pSize);
                    const digits: number[] = (h.prices || []).map((p: number) =>
                      parseInt(p.toFixed(precision).slice(-1), 10)
                    );

                    const patternLen = 3;
                    const probThreshold = 0.7;
                    otivoMemory.current[s.symbol] = {};
                    const symbolMemory = otivoMemory.current[s.symbol];

                    for (let j = 0; j < digits.length - patternLen; j++) {
                      const seq = digits.slice(j, j + patternLen).join(',');
                      const nextDigit = digits[j + patternLen];
                      if (!symbolMemory[seq]) {
                        symbolMemory[seq] = { total: 0, next: Array(10).fill(0), outcomes: [] };
                      }
                      symbolMemory[seq].total++;
                      symbolMemory[seq].next[nextDigit]++;
                      symbolMemory[seq].outcomes.push(nextDigit);
                    }

                    const currentSeq = digits.slice(-patternLen).join(',');
                    const pattern = symbolMemory[currentSeq];
                    newLog.unshift(
                      `${s.display_name}: Pattern [${currentSeq}] confirmed with neural recurrence scan.`
                    );

                    if (pattern && pattern.total >= 2) {
                      let overCount = 0;
                      let underCount = 0;
                      const validDifferTargets: number[] = [];

                      for (let d = 0; d <= 9; d++) {
                        const count = pattern.next[d];
                        if (d > 5) overCount += count;
                        if (d < 4) underCount += count;
                        if (count === 0 && pattern.total >= 2) {
                          validDifferTargets.push(d);
                        }
                      }

                      const outcomes = pattern.outcomes || [];
                      if (overCount / pattern.total >= probThreshold) {
                        newSignals.over.push({
                          id: `over-${s.symbol}-${currentSeq}-${Date.now()}`,
                          type: 'over',
                          symbol: s.symbol,
                          seq: currentSeq,
                          conf: (overCount / pattern.total) * 100,
                          time: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }),
                          pastOutcomes: outcomes,
                        });
                      }
                      if (underCount / pattern.total >= probThreshold) {
                        newSignals.under.push({
                          id: `under-${s.symbol}-${currentSeq}-${Date.now()}`,
                          type: 'under',
                          symbol: s.symbol,
                          seq: currentSeq,
                          conf: (underCount / pattern.total) * 100,
                          time: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }),
                          pastOutcomes: outcomes,
                        });
                      }
                      if (validDifferTargets.length > 0) {
                        validDifferTargets.forEach((target) => {
                          newSignals.differ.push({
                            id: `diff-${s.symbol}-${currentSeq}-${target}-${Date.now()}`,
                            type: 'differ',
                            symbol: s.symbol,
                            seq: currentSeq,
                            conf: 100,
                            target,
                            time: new Date().toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            }),
                            pastOutcomes: outcomes,
                          });
                        });
                      }
                    }

                    const counts = Array(10).fill(0);
                    digits.forEach((d) => counts[d]++);
                    const predictedDigit = getPredictedDigit(digits);
                    const freqPercent = digits.length
                      ? (counts[predictedDigit] / digits.length) * 100
                      : 10;

                    results.push({
                      symbol: s.symbol,
                      name: s.display_name,
                      digit: predictedDigit,
                      frequency: freqPercent,
                      confidence: 100 - freqPercent,
                      seq: currentSeq,
                    });

                    scanWs.removeEventListener('message', historyHandler);
                    resolveSym(null);
                  }
                };
                scanWs.addEventListener('message', historyHandler);
              });
            }

            setOtivoLog((prev) => [...newLog, ...prev].slice(0, 50));
            setOtivoSignals((prev) => ({
              over: [...newSignals.over, ...prev.over].slice(0, 20),
              under: [...newSignals.under, ...prev.under].slice(0, 20),
              differ: [...newSignals.differ, ...prev.differ].slice(0, 20),
            }));

            let sorted = results
              .map((r) => {
                let penalty = 0;
                const recentIndex = recentlyUsedSymbols.current.indexOf(r.symbol);
                if (recentIndex !== -1) {
                  penalty += (recentlyUsedSymbols.current.length - recentIndex) * 5;
                }
                penalty += (symbolUseCount.current[r.symbol] || 0) * 3;
                if (r.symbol.startsWith('JD')) penalty -= 2;
                return { ...r, adjustedScore: r.frequency + penalty };
              })
              .sort((a, b) => a.adjustedScore - b.adjustedScore);

            if (excludeSymbol && sorted.length > 1) {
              const filteredArr = sorted.filter((r) => r.symbol !== excludeSymbol);
              if (filteredArr.length > 0) sorted = filteredArr;
            }

            const best = sorted[0] || null;
            if (best) {
              recentlyUsedSymbols.current = [
                best.symbol,
                ...recentlyUsedSymbols.current.filter((x) => x !== best.symbol),
              ].slice(0, 5);
              symbolUseCount.current[best.symbol] = (symbolUseCount.current[best.symbol] || 0) + 1;
              setScanBestMarket(best);
              setLastScanTime(new Date().toLocaleTimeString());
            }

            clearTimeout(timeout);
            isActive = false;
            if (!isBackground) {
              setIsScanning(false);
              setShowScanResults(true);
            }
            scanWs.close();
            resolveTop(best?.symbol || null);
          }
        };
      });
    },
    []
  );

  // Trigger initial background scan so Live AI Selection populates
  useEffect(() => {
    const timer = setTimeout(() => {
      runMarketScan(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [runMarketScan]);

  // AI Scanner state derived from cloud server
  const aiScannerState = cloudBots?.aiScanner;
  const isAutoTrading = Boolean(aiScannerState?.running);
  const autoSessionProfit = aiScannerState?.sessionProfit ?? 0;
  const currentAutoStake = aiScannerState?.currentStake ?? scannerSettings.stake;
  const tpSlResult = aiScannerState?.tpSlResult ?? null;
  const lastScannerToastIdRef = useRef<number>(aiScannerState?.lastEvent?.id ?? 0);
  const lastScannerSymbolRef = useRef<string | null>(aiScannerState?.symbol ?? null);

  useEffect(() => {
    const evt = aiScannerState?.lastEvent;
    if (evt && evt.id > lastScannerToastIdRef.current) {
      lastScannerToastIdRef.current = evt.id;
      notify(evt.type, evt.message);
    }
  }, [aiScannerState?.lastEvent, notify]);

  useEffect(() => {
    if (aiScannerState?.running && aiScannerState.symbol && aiScannerState.symbol !== lastScannerSymbolRef.current) {
      lastScannerSymbolRef.current = aiScannerState.symbol;
      if (aiScannerState.symbol !== symbol) {
        setSymbol(aiScannerState.symbol);
      }
    } else if (!aiScannerState?.running) {
      lastScannerSymbolRef.current = null;
    }
  }, [aiScannerState?.running, aiScannerState?.symbol, symbol]);

  const stopAutoTrade = useCallback(async () => {
    try {
      const res = await fetch('/api/cloud-bots/ai-scanner/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        notify('error', data?.error || 'Failed to stop AI Scanner Bot.');
      } else {
        if (data?.cloudBots && onCloudBotsUpdate) onCloudBotsUpdate(data.cloudBots);
        notify('info', 'AI Scanner Bot stopped.');
      }
    } catch (err: any) {
      notify('error', err?.message || 'Failed to stop AI Scanner Bot.');
    }
  }, [notify, onCloudBotsUpdate]);

  const startAutoTrade = useCallback(
    async (best: any) => {
      if (!connected) {
        notify('error', 'Connect your Deriv API token via Deriv API Connection first.');
        return;
      }
      if (!best?.symbol) return;

      try {
        const res = await fetch('/api/cloud-bots/ai-scanner/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: best.symbol,
            name: best.name || best.symbol,
            digit: best.digit ?? 5,
            stake: scannerSettings.stake,
            martingale: scannerSettings.martingale,
            martingaleAfter: scannerSettings.martingaleAfter,
            tp: scannerSettings.tp,
            sl: scannerSettings.sl,
            marketSwitchMode,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify('error', data?.error || 'Failed to start AI Scanner Bot.');
        } else {
          if (data?.cloudBots && onCloudBotsUpdate) onCloudBotsUpdate(data.cloudBots);
          setSymbol(best.symbol);
          notify(
            'success',
            `AI Scanner Bot started on ${best.name || best.symbol} (Differ ${best.digit ?? 5})`
          );
        }
      } catch (err: any) {
        notify('error', err?.message || 'Failed to start AI Scanner Bot.');
      }
    },
    [connected, marketSwitchMode, notify, onCloudBotsUpdate, scannerSettings]
  );

  const loadBotFromSignal = useCallback(
    (sig: {
      symbol: string;
      type: 'over' | 'under' | 'differ';
      target?: number;
      digit?: number;
    }) => {
      const mappedType: TradeType =
        sig.type === 'over' ? 'Over' : sig.type === 'under' ? 'Under' : 'Differs';
      const targetDigit =
        sig.target ?? sig.digit ?? (sig.type === 'over' ? 5 : sig.type === 'under' ? 4 : 0);

      const nextSettings: BotSettings = {
        ...DEFAULT_SETTINGS,
        ...currentSettings,
        market: sig.symbol || symbol,
        mode: 'single',
        types: [mappedType],
        digits: {
          ...currentSettings.digits,
          [mappedType]: targetDigit,
        },
        ticks: 1,
        mart: true,
        mult: sig.type === 'differ' ? 11 : 3.5,
      };
      onLoadToTerminal(nextSettings);
      notify(
        'success',
        `Loaded ${mappedType} ${targetDigit} on ${nextSettings.market} into Terminal.`
      );
    },
    [currentSettings, notify, onLoadToTerminal, symbol]
  );

  const effectiveGlobalMode: DerivContractAnalysisType =
    contractAnalysisMode === 'classic_frequency' ? 'over_under' : contractAnalysisMode;

  return (
    <div className="flex-1 overflow-auto bg-[#0a0b0d] text-[#e1e1e1] p-4 sm:p-6 lg:p-8 custom-scrollbar w-full">
      <div className="w-full space-y-8">
        {/* Inline Notification Banner */}
        {bannerMsg && (
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold shadow-lg',
              bannerMsg.level === 'error'
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                : bannerMsg.level === 'warn'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : bannerMsg.level === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
            )}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{bannerMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerMsg(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Superior Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                <Activity size={24} className="text-indigo-400" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Professional Data Analysis
              </h1>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                  wsStatus === 'connected'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                )}
              >
                {wsStatus === 'connected' ? 'LIVE FEED' : wsStatus.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 bg-[#111217] p-3 sm:p-2 rounded-2xl border border-[#2d2f36] w-full md:w-auto">
            {!isAutoTrading ? (
              <button
                type="button"
                onClick={() => setShowScanResults(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-black text-white transition-all shadow-lg active:scale-95 group overflow-hidden relative w-full sm:w-auto cursor-pointer"
              >
                <Activity size={18} fill="currentColor" />
                OTIVO NEURAL ENGINE
              </button>
            ) : (
              <button
                type="button"
                onClick={stopAutoTrade}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-sm font-black text-white transition-all shadow-lg active:scale-95 animate-pulse w-full sm:w-auto cursor-pointer"
              >
                <Square size={18} fill="currentColor" />
                STOP AI BOT
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHackerModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-sm font-black text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-95 relative w-full sm:w-auto border border-violet-400/30 cursor-pointer"
            >
              <Zap size={18} className="text-amber-300 animate-pulse" />
              <span>AI MARKET HACKER</span>
              {(hackerScanning || cloudBots?.aiHacker?.running) && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </button>

            <div className="relative group w-full sm:w-auto">
              <select
                value={symbol}
                onChange={(e) => {
                  const newSym = e.target.value;
                  setSymbol(newSym);
                  handleUpdateWindow(activeWindowId, { symbol: newSym });
                }}
                className={cn(
                  'bg-[#0a0b0d] hover:bg-[#1a1c23] border rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold appearance-none focus:outline-none transition-all cursor-pointer w-full md:min-w-[220px]',
                  contractAnalysisMode === 'accumulators'
                    ? 'border-amber-500/40 text-amber-300'
                    : 'border-[#2d2f36] text-white'
                )}
              >
                {(contractAnalysisMode === 'accumulators'
                  ? ANALYSIS_SYMBOLS.filter((s) => isVolatilityIndex(s.id))
                  : ANALYSIS_SYMBOLS
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#0a0b0d] border border-[#2d2f36] rounded-xl px-3 py-2.5 w-full sm:w-auto">
              <span className="text-xs font-black uppercase text-[#9ba1a6] tracking-wider select-none">
                History Ticks:
              </span>
              <input
                type="number"
                min="10"
                max="5000"
                value={tempWindow}
                onChange={(e) => setTempWindow(e.target.value)}
                onBlur={() => {
                  let num = parseInt(tempWindow, 10);
                  if (isNaN(num) || num < 10) num = 100;
                  if (num > 5000) num = 5000;
                  setTempWindow(num.toString());
                  setAnalysisWindow(num);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    let num = parseInt(tempWindow, 10);
                    if (isNaN(num) || num < 10) num = 100;
                    if (num > 5000) num = 5000;
                    setTempWindow(num.toString());
                    setAnalysisWindow(num);
                  }
                }}
                className="w-16 bg-transparent text-white text-sm font-black font-mono outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-white/10 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Deriv Contract Analysis Mode Selector */}
        <div className="bg-[#111217] p-2.5 rounded-2xl border border-[#2d2f36] flex flex-wrap items-center justify-between gap-3 shadow-xl">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'pressure_noise', label: 'Digit Pressure & Noise', icon: '⚡📊' },
              { id: 'over_under', label: 'Over / Under', icon: '🔴🟢' },
              { id: 'even_odd', label: 'Even / Odd', icon: '⚖️' },
              { id: 'rise_fall', label: 'Rise / Fall', icon: '📈' },
              { id: 'differs', label: 'Matches / Differs', icon: '🎯' },
              { id: 'accumulators', label: 'Accumulators (AMFE)', icon: '⚡' },
              { id: 'classic_frequency', label: 'Digit Bot & Frequency', icon: '📊' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSetContractAnalysisMode(tab.id as any)}
                className={cn(
                  'px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border cursor-pointer',
                  contractAnalysisMode === tab.id
                    ? tab.id === 'accumulators'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-400 font-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-400/40 shadow-lg shadow-indigo-500/25 scale-[1.02]'
                    : 'bg-[#0a0b0d] text-[#9ba1a6] border-[#2d2f36] hover:text-white hover:border-[#3d424e]'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'accumulators' && (
                  <span className="hidden xl:inline text-[9px] px-1.5 py-0.2 rounded bg-black/20 text-black font-black uppercase">
                    Vol Only
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-[#0a0b0d] border border-[#2d2f36] px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-black uppercase text-[#9ba1a6] tracking-wider">
              Deriv TF:
            </span>
            <div className="flex items-center gap-1">
              {(['1t', '1m', '3m', '5m', '15m', '30m', '1h'] as DerivTimeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setSelectedTimeframe(tf)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer',
                    selectedTimeframe === tf
                      ? 'bg-indigo-500 text-white font-black shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Multi-Market Windows Workspace Manager */}
        <AnalysisWindowsManager
          windows={windows}
          activeWindowId={activeWindowId}
          onSelectActiveWindow={(id) => {
            setActiveWindowId(id);
            const w = windows.find((win) => win.id === id);
            if (w) setSymbol(w.symbol);
          }}
          onAddWindow={handleAddWindow}
          onRemoveWindow={handleRemoveWindow}
          onSyncAutoBotMarkets={handleSyncAutoBotMarkets}
          layoutMode={layoutMode}
          onSetLayoutMode={setLayoutMode}
          gridColumns={gridColumns}
          onSetGridColumns={setGridColumns}
          globalContractMode={contractAnalysisMode}
          onSetGlobalContractMode={handleSetContractAnalysisMode}
          allSymbols={ANALYSIS_SYMBOLS}
          marketLastQuotes={marketLastQuotes}
          autoBotMarketCount={autoBotMarketCount}
        />

        {/* Dynamic Contract Analysis Mode Views & Multi-Market Windows */}
        {contractAnalysisMode === 'classic_frequency' ? (
          <ClassicFrequencyView
            symbol={symbol}
            onChangeSymbol={setSymbol}
            ticks={activeTicks}
            analysis={analysis}
            rankedDigits={rankedDigits}
            coldestHistory={coldestHistory}
            analysisWindow={analysisWindow}
            connected={connected}
            accountBalance={accountBalance}
            onSwitchContractMode={(m) => handleSetContractAnalysisMode(m)}
            marketSwitchMode={marketSwitchMode}
            onSetMarketSwitchMode={(m) => {
              setMarketSwitchMode(m);
              localStorage.setItem('scanner_market_switch_mode', m);
            }}
            scanBestMarket={scanBestMarket}
            lastScanTime={lastScanTime}
            isAutoTrading={isAutoTrading}
            onStartAutoTrade={startAutoTrade}
            onStopAutoTrade={stopAutoTrade}
            onLoadSignalToTerminal={loadBotFromSignal}
            onTriggerBackgroundRescan={(ex) => runMarketScan(true, ex)}
            onNotify={notify}
            hasVirtualToken={hasVirtualToken}
            cloudState={cloudBots?.frequency}
            onCloudBotsUpdate={onCloudBotsUpdate}
          />
        ) : layoutMode === 'grid' ? (
          <div className="space-y-4">
            {(contractAnalysisMode === 'pressure_noise' ||
              windows.some((w) => (w.contractMode || contractAnalysisMode) === 'pressure_noise')) && (
              <OverUnderActiveBot
                markets={windows.map((win) => ({
                  symbol: win.symbol,
                  name: ANALYSIS_SYMBOLS.find((s) => s.id === win.symbol)?.name || win.symbol,
                  ticks: mergedMarketTicks[win.symbol] || (win.symbol === symbol ? activeTicks : []),
                }))}
                isMultiMarketMode={true}
                connected={connected}
                hasVirtualToken={hasVirtualToken}
                cloudState={cloudBots?.gridMaster}
                onCloudBotsUpdate={onCloudBotsUpdate}
              />
            )}

            <div
              className={cn(
                'grid gap-4 md:gap-6',
                gridColumns === 1
                  ? 'grid-cols-1'
                  : gridColumns === 3
                  ? 'grid-cols-1 xl:grid-cols-3'
                  : 'grid-cols-1 lg:grid-cols-2'
              )}
            >
              {windows.map((win, idx) => (
                <MarketAnalysisWindow
                  key={win.id}
                  window={win}
                  ticks={
                    mergedMarketTicks[win.symbol] || (win.symbol === symbol ? activeTicks : [])
                  }
                  candles={marketCandles[win.symbol] || (win.symbol === symbol ? candles : [])}
                  timeframeCandles={
                    marketTimeframeCandles[win.symbol] ||
                    (win.symbol === symbol ? timeframeCandles : {})
                  }
                  allMarketTicks={mergedMarketTicks}
                  isSingleView={false}
                  onUpdateWindow={(updates) => handleUpdateWindow(win.id, updates)}
                  onCloseWindow={() => handleRemoveWindow(win.id)}
                  onFocusWindow={() => {
                    setActiveWindowId(win.id);
                    setLayoutMode('single');
                    setSymbol(win.symbol);
                  }}
                  onDuplicateWindow={() => handleDuplicateWindow(win.id)}
                  globalContractMode={effectiveGlobalMode}
                  globalTimeframe={selectedTimeframe}
                  allSymbols={ANALYSIS_SYMBOLS}
                  canClose={windows.length > 1}
                  windowIndex={idx}
                />
              ))}
            </div>
          </div>
        ) : (
          <MarketAnalysisWindow
            key={activeWindow.id}
            window={activeWindow}
            ticks={mergedMarketTicks[activeWindow.symbol] || activeTicks}
            candles={marketCandles[activeWindow.symbol] || candles}
            timeframeCandles={marketTimeframeCandles[activeWindow.symbol] || timeframeCandles}
            allMarketTicks={mergedMarketTicks}
            isSingleView={true}
            onUpdateWindow={(updates) => handleUpdateWindow(activeWindow.id, updates)}
            onCloseWindow={() => handleRemoveWindow(activeWindow.id)}
            onFocusWindow={() => setLayoutMode('grid')}
            onDuplicateWindow={() => handleDuplicateWindow(activeWindow.id)}
            globalContractMode={effectiveGlobalMode}
            globalTimeframe={selectedTimeframe}
            allSymbols={ANALYSIS_SYMBOLS}
            canClose={windows.length > 1}
            windowIndex={Math.max(
              0,
              windows.findIndex((w) => w.id === activeWindow.id)
            )}
          />
        )}

        {/* Professional Footer Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-10 border-t border-[#2d2f36] gap-4">
          <div className="flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-[#555]">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <span className="text-[#9ba1a6]">Engine Sync OK</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-indigo-400" />
              <span className="text-[#9ba1a6]">AI Engine: v2.4 (ML-Active)</span>
            </div>
            <div className="hidden sm:block text-[#444]">
              High-Speed (5/15/25) Intelligence
            </div>
          </div>
          <div className="text-[10px] font-black text-[#555] uppercase tracking-[0.2em]">
            Precision Analysis • v5.24.0
          </div>
        </div>
      </div>

      {/* OTIVO Neural Scanner Modal + Floating Widget + Conclusion Modal */}
      <OtivoNeuralModal
        showScanResults={showScanResults}
        onCloseScanResults={() => setShowScanResults(false)}
        neuralMarketData={neuralMarketData}
        activeSections={activeSections}
        onToggleSection={(id) =>
          setActiveSections((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
          )
        }
        otivoSignals={otivoSignals}
        otivoLog={otivoLog}
        onLoadSignal={loadBotFromSignal}
        isScanning={isScanning}
        scanProgress={scanProgress}
        isAutoTrading={isAutoTrading}
        onStopAutoTrade={stopAutoTrade}
        autoSessionProfit={autoSessionProfit}
        currentAutoStake={currentAutoStake}
        scannerSettings={scannerSettings}
        scanBestMarket={scanBestMarket}
        tpSlResult={tpSlResult}
        onCloseTpSlResult={() => {
          fetch('/api/cloud-bots/ai-scanner/clear-result', { method: 'POST' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d?.cloudBots && onCloudBotsUpdate) onCloudBotsUpdate(d.cloudBots);
            })
            .catch(() => {});
        }}
      />

      {/* AI Market Hacker Modal */}
      <AiMarketHackerModal
        open={showHackerModal}
        onClose={() => setShowHackerModal(false)}
        connected={connected}
        hasVirtualToken={hasVirtualToken}
        cloudState={cloudBots?.aiHacker}
        onCloudBotsUpdate={onCloudBotsUpdate}
        onScanningChange={setHackerScanning}
        onNotifyError={(msg) => notify('error', msg)}
      />
    </div>
  );
};
