import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Lock, 
  ChevronDown,
  Activity,
  DollarSign,
  Cpu,
  Play,
  Square,
  Check,
  Zap,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';
import { botEngine } from './lib/botEngine';
import { rootStore } from './stores/root-store';
import { cn } from './lib/utils';
import { MetaTrader5Icon } from './components/MetaTrader5Icon';

interface Position {
  id: string | number;
  sym: string;
  type: string;
  lot: string;
  pnl: number;
  takenOnMetaTrader?: boolean;
}

const LOT_TO_USD = 10;

const getAlternatedMarket = (currentSymbol: string): { symbol: string; direction: 'MULTUP' | 'MULTDOWN' } => {
  const sym = currentSymbol.toUpperCase();
  if (sym.startsWith('CRASH')) {
    const suffix = sym.replace('CRASH', '');
    const counterpart = `BOOM${suffix}`;
    const finalSymbol = SYMBOL_LABELS[counterpart] ? counterpart : 'BOOM1000';
    return { symbol: finalSymbol, direction: 'MULTDOWN' }; // sell on Boom (MULTDOWN)
  } else if (sym.startsWith('BOOM')) {
    const suffix = sym.replace('BOOM', '');
    const counterpart = `CRASH${suffix}`;
    const finalSymbol = SYMBOL_LABELS[counterpart] ? counterpart : 'CRASH1000';
    return { symbol: finalSymbol, direction: 'MULTUP' }; // buy on Crash (MULTUP)
  } else {
    return { symbol: 'CRASH1000', direction: 'MULTUP' };
  }
};

const MULTIPLIER_MAP: Record<string, number> = {
  'BOOM50': 4000, 
  'BOOM150': 2000, 
  'BOOM300': 100, 
  'BOOM500': 400, 
  'BOOM600': 400, 
  'BOOM900': 400, 
  'BOOM1000': 500,
  'CRASH50': 4000, 
  'CRASH150': 2000, 
  'CRASH300': 100, 
  'CRASH500': 400, 
  'CRASH600': 400, 
  'CRASH900': 400, 
  'CRASH1000': 500,
  '1HZ10V': 4000, 
  'R_10': 4000, 
  '1HZ25V': 1600, 
  'R_25': 1600, 
  '1HZ50V': 800, 
  'R_50': 800, 
  '1HZ100V': 400, 
  'R_100': 400,
  'frxXAUUSD': 200, 
  'frxEURUSD': 200, 
  'frxGBPUSD': 200, 
  'frxUSDJPY': 200
};

const SYMBOL_LABELS: Record<string, string> = {
  'BOOM50': 'Boom 50', 'BOOM150': 'Boom 150', 'BOOM300': 'Boom 300', 'BOOM500': 'Boom 500', 'BOOM600': 'Boom 600', 'BOOM900': 'Boom 900', 'BOOM1000': 'Boom 1000',
  'CRASH50': 'Crash 50', 'CRASH150': 'Crash 150', 'CRASH300': 'Crash 300', 'CRASH500': 'Crash 500', 'CRASH600': 'Crash 600', 'CRASH900': 'Crash 900', 'CRASH1000': 'Crash 1000',
  '1HZ10V': 'Volatility 10 (1s)', 'R_10': 'Volatility 10', '1HZ25V': 'Volatility 25 (1s)', 'R_25': 'Volatility 25', '1HZ50V': 'Volatility 50 (1s)', 'R_50': 'Volatility 50', '1HZ100V': 'Volatility 100 (1s)', 'R_100': 'Volatility 100',
  'frxXAUUSD': 'XAU/USD', 'frxEURUSD': 'EUR/USD', 'frxGBPUSD': 'GBP/USD', 'frxUSDJPY': 'USD/JPY'
};

const VOLATILITY_INDICES = [
  '1HZ10V', 'R_10', '1HZ25V', 'R_25', '1HZ50V', 'R_50', '1HZ100V', 'R_100'
];

export default observer(function MetaTrader() {
  const isConnected = rootStore.client.isConnected;
  const globalBalance = rootStore.client.balance;

  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [contractCategory, setContractCategory] = useState<'multiplier' | 'rise_fall'>(
    () => (localStorage.getItem('mt5_contractCategory') as 'multiplier' | 'rise_fall') || 'multiplier'
  );
  const [selectedSymbol, setSelectedSymbol] = useState(() => localStorage.getItem('mt5_selectedSymbol') || 'BOOM50');
  const [lotSize, setLotSize] = useState(() => localStorage.getItem('mt5_lotSize') || '0.10');
  const [autoClose, setAutoClose] = useState(() => localStorage.getItem('mt5_autoClose') === 'true');
  const [tpValue, setTpValue] = useState(() => localStorage.getItem('mt5_tpValue') || '1.00');
  const [apiToken, setApiToken] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  
  // Strategy States
  const [currentStrategy, setCurrentStrategy] = useState<'manual' | 'hedging' | 'spike_detector'>(() => (localStorage.getItem('mt5_currentStrategy') as any) || 'manual');
  const [isHedgingRunning, setIsHedgingRunning] = useState(false);
  const [showStrategyList, setShowStrategyList] = useState(false);
  const [maxPositions, setMaxPositions] = useState(() => localStorage.getItem('mt5_maxPositions') || '1');
  const [isSpikeRunning, setIsSpikeRunning] = useState(false);
  
  // Martingale AutoClose states
  const [martingaleAutoClose, setMartingaleAutoClose] = useState(() => localStorage.getItem('mt5_martingaleAutoClose') === 'true');
  const [recoveryCount, setRecoveryCount] = useState<number>(0);
  const [accumulatedLoss, setAccumulatedLoss] = useState<number>(0);
  const [originalLotSize, setOriginalLotSize] = useState<string | null>(null);
  const [originalTpValue, setOriginalTpValue] = useState<string | null>(null);

  // Auto Trades states
  const [autoTrades, setAutoTrades] = useState(() => localStorage.getItem('mt5_autoTrades') === 'true');
  const [autoLock, setAutoLock] = useState(() => localStorage.getItem('mt5_autoLock') !== 'false');
  
  // UI Panels
  const [expandedPositionId, setExpandedPositionId] = useState<string | number | null>(null);
  const [controlsCollapsed, setControlsCollapsed] = useState(() => localStorage.getItem('mt5_controlsCollapsed') === 'true');

  // Sub-tab Navigation (Trade vs. History)
  const [activeSubTab, setActiveSubTab] = useState<'trade' | 'history'>(() => (localStorage.getItem('mt5_activeSubTab') as any) || 'trade');
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Date selection states matches the prompt requirements exactly
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'three_months' | 'custom'>(() => (localStorage.getItem('mt5_selectedPeriod') as any) || 'week');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(() => localStorage.getItem('mt5_customStartDate') || '');
  const [customEndDate, setCustomEndDate] = useState(() => localStorage.getItem('mt5_customEndDate') || '');
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Date filtering logic matching MT5 period intervals
  const getPeriodRanges = () => {
    const today = new Date();
    const formatForLabel = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${yr}.${mo}.${dy}`;
    };

    const todayStr = formatForLabel(today);

    // Last week label (7 days ago to today)
    const lastWeekDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    const lastWeekStr = `${formatForLabel(lastWeekDate)} - ${todayStr}`;

    // Last month label (start of last calendar month to today)
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStr = `${formatForLabel(lastMonthDate)} - ${todayStr}`;

    // Last 3 months label (start of 3 calendar months ago to today)
    const last3MonthsDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    const last3MonthsStr = `${formatForLabel(last3MonthsDate)} - ${todayStr}`;

    return {
      today: todayStr,
      week: lastWeekStr,
      month: lastMonthStr,
      threeMonths: last3MonthsStr,
      todayDate: today,
      lastWeekDate,
      lastMonthDate,
      last3MonthsDate
    };
  };

  const getFilteredHistory = () => {
    const today = new Date();
    
    return historyList.filter(item => {
      if (!item.time) return true;
      
      // Parse "YYYY.MM.DD" from item.time (e.g. "2026.05.23 15:10:05")
      const datePart = item.time.split(' ')[0];
      if (!datePart) return true;
      const parts = datePart.split('.');
      if (parts.length !== 3) return true;
      
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      const itemDate = new Date(year, month, day);
      const itemDateZero = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      
      if (selectedPeriod === 'today') {
        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return itemDateZero >= todayZero;
      } else if (selectedPeriod === 'week') {
        const weekZero = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
        return itemDateZero >= weekZero;
      } else if (selectedPeriod === 'month') {
        const monthZero = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return itemDateZero >= monthZero;
      } else if (selectedPeriod === 'three_months') {
        const threeMonthsZero = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        return itemDateZero >= threeMonthsZero;
      } else if (selectedPeriod === 'custom') {
        let pass = true;
        if (customStartDate) {
          const startParts = customStartDate.split('-'); // "YYYY-MM-DD"
          const startD = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
          pass = pass && (itemDateZero >= startD);
        }
        if (customEndDate) {
          const endParts = customEndDate.split('-'); // "YYYY-MM-DD"
          const endD = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
          pass = pass && (itemDateZero <= endD);
        }
        return pass;
      }
      return true;
    });
  };

  const filteredHistory = getFilteredHistory();

  const currentAccountId = botEngine.getAccountId() || rootStore.client.loginid || 'guest';

  // Format Helper for timestamps matching MT5 exactly
  const formatUnixTime = (seconds: number) => {
    const d = new Date(seconds * 1000);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const sc = String(d.getSeconds()).padStart(2, '0');
    return `${yr}.${mo}.${dy} ${hr}:${mi}:${sc}`;
  };

  // Historic Sync per account ID
  useEffect(() => {
    const key = `mt5_history_${currentAccountId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setHistoryList(JSON.parse(stored));
      } catch (e) {
        setHistoryList([]);
      }
    } else {
      setHistoryList([]);
    }
  }, [currentAccountId]);

  // Persistent append method for account ledger
  const saveToHistory = (item: any) => {
    const accId = botEngine.getAccountId() || rootStore.client.loginid || 'guest';
    const key = `mt5_history_${accId}`;
    let currentHistory: any[] = [];
    try {
      const stored = localStorage.getItem(key);
      currentHistory = stored ? JSON.parse(stored) : [];
    } catch (e) {}

    if (!currentHistory.some(x => String(x.id) === String(item.id))) {
      const updated = [item, ...currentHistory];
      localStorage.setItem(key, JSON.stringify(updated));
      setHistoryList(updated);
    }
  };

  // References to keep up-to-date states for WS callbacks without trigger loops
  const autoCloseRef = useRef(autoClose);
  const tpValueRef = useRef(tpValue);
  
  const currentStrategyRef = useRef(currentStrategy);
  const isHedgingRunningRef = useRef(isHedgingRunning);
  const hedgingContractIdsRef = useRef<string[]>([]);
  const isOpeningHedgesRef = useRef<boolean>(false);

  const isSpikeRunningRef = useRef(isSpikeRunning);
  const maxPositionsRef = useRef(maxPositions);
  const lastPriceRef = useRef<number | null>(null);
  const lastSpikeTimeRef = useRef<number>(0);

  // Martingale Refs
  const martingaleAutoCloseRef = useRef(martingaleAutoClose);
  const recoveryCountRef = useRef(recoveryCount);
  const accumulatedLossRef = useRef(accumulatedLoss);
  const originalLotSizeRef = useRef(originalLotSize);
  const originalTpValueRef = useRef(originalTpValue);
  const positionsRef = useRef(positions);

  // Auto Trades and Ref configurations
  const contractCategoryRef = useRef(contractCategory);
  const autoTradesRef = useRef(autoTrades);
  const selectedSymbolRef = useRef(selectedSymbol);
  const processedSoldContractsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    contractCategoryRef.current = contractCategory;
    localStorage.setItem('mt5_contractCategory', contractCategory);
    if (contractCategory === 'rise_fall' && !VOLATILITY_INDICES.includes(selectedSymbolRef.current)) {
      setSelectedSymbol('1HZ10V');
    }
  }, [contractCategory]);

  const isConnectedRef = useRef(isConnected);
  const lotSizeRef = useRef(lotSize);
  const autoLockRef = useRef(autoLock);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    lotSizeRef.current = lotSize;
  }, [lotSize]);

  const placeOrderRef = useRef<any>(null);
  const triggerSpikeTradeRef = useRef<any>(null);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    autoTradesRef.current = autoTrades;
    localStorage.setItem('mt5_autoTrades', String(autoTrades));
  }, [autoTrades]);

  useEffect(() => {
    autoLockRef.current = autoLock;
    localStorage.setItem('mt5_autoLock', String(autoLock));
  }, [autoLock]);

  const isLockedByAutoLock = () => {
    if (!autoLockRef.current) return false;

    // 1. Is there an active Bot running in Bot Builder or AutoBot?
    const isBotRunning = botEngine.isRunning || 
                         localStorage.getItem('botEngine_isRunning') === 'true' || 
                         localStorage.getItem('autobot_active_running') === 'true';
    if (isBotRunning) return true;

    // 2. Is this component unmounted or not on the active route?
    const isRouteActive = window.location.hash.includes('meta-trader');
    if (!isRouteActive) return true;

    // 3. Is the document invisible? (e.g., page backgrounded or in another tab)
    if (document.visibilityState !== 'visible') return true;

    return false;
  };

  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  useEffect(() => {
    martingaleAutoCloseRef.current = martingaleAutoClose;
    localStorage.setItem('mt5_martingaleAutoClose', String(martingaleAutoClose));
  }, [martingaleAutoClose]);

  useEffect(() => {
    recoveryCountRef.current = recoveryCount;
  }, [recoveryCount]);

  useEffect(() => {
    accumulatedLossRef.current = accumulatedLoss;
  }, [accumulatedLoss]);

  useEffect(() => {
    originalLotSizeRef.current = originalLotSize;
  }, [originalLotSize]);

  useEffect(() => {
    originalTpValueRef.current = originalTpValue;
  }, [originalTpValue]);

  useEffect(() => {
    currentStrategyRef.current = currentStrategy;
    // Reset pricing when strategy changes to avoid spike jumps from standard ticks
    lastPriceRef.current = null;
  }, [currentStrategy]);

  useEffect(() => {
    isSpikeRunningRef.current = isSpikeRunning;
  }, [isSpikeRunning]);

  useEffect(() => {
    maxPositionsRef.current = maxPositions;
  }, [maxPositions]);

  useEffect(() => {
    localStorage.setItem('mt5_maxPositions', maxPositions);
  }, [maxPositions]);

  useEffect(() => {
    isHedgingRunningRef.current = isHedgingRunning;
  }, [isHedgingRunning]);
  
  useEffect(() => {
    autoCloseRef.current = autoClose;
  }, [autoClose]);

  useEffect(() => {
    tpValueRef.current = tpValue;
  }, [tpValue]);

  // Persist all settings on change to localStorage
  useEffect(() => {
    localStorage.setItem('mt5_selectedSymbol', selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    localStorage.setItem('mt5_lotSize', lotSize);
  }, [lotSize]);

  useEffect(() => {
    localStorage.setItem('mt5_autoClose', String(autoClose));
  }, [autoClose]);

  useEffect(() => {
    localStorage.setItem('mt5_tpValue', tpValue);
  }, [tpValue]);

  useEffect(() => {
    localStorage.setItem('mt5_currentStrategy', currentStrategy);
  }, [currentStrategy]);

  useEffect(() => {
    localStorage.setItem('mt5_activeSubTab', activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    localStorage.setItem('mt5_selectedPeriod', selectedPeriod);
  }, [selectedPeriod]);

  useEffect(() => {
    localStorage.setItem('mt5_customStartDate', customStartDate);
  }, [customStartDate]);

  useEffect(() => {
    localStorage.setItem('mt5_customEndDate', customEndDate);
  }, [customEndDate]);

  useEffect(() => {
    localStorage.setItem('mt5_controlsCollapsed', String(controlsCollapsed));
  }, [controlsCollapsed]);

  // Sync Positions on connect
  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(() => {
        botEngine.send({ portfolio: 1 });
      }, 800);
      return () => clearTimeout(t);
    } else {
      setPositions({});
    }
  }, [isConnected]);

  // Handle incoming WS frames
  useEffect(() => {
    const handleRawMessage = (data: any) => {
      if (!data) return;

      const msgType = data.msg_type;

      // Handle tick updates for Crash/Boom Spike Detector
      if (msgType === 'tick' && data.tick) {
        const tick = data.tick;
        if (tick.symbol === selectedSymbol) {
          const price = parseFloat(tick.quote);
          const prevPrice = lastPriceRef.current;
          lastPriceRef.current = price;

          if (prevPrice !== null && currentStrategyRef.current === 'spike_detector' && isSpikeRunningRef.current) {
            const diff = price - prevPrice;
            const symUpper = selectedSymbol.toUpperCase();
            const isBoom = symUpper.startsWith('BOOM');
            const isCrash = symUpper.startsWith('CRASH');

            // Threshold selector
            const getSpikeThreshold = (symbol: string) => {
              const sym = symbol.toUpperCase();
              if (sym.includes('300')) return 3.5;
              if (sym.includes('1000')) return 3.0;
              if (sym.includes('500')) return 2.5;
              return 2.0; // default safe threshold
            };
            const threshold = getSpikeThreshold(selectedSymbol);

            const now = Date.now();
            if (now - lastSpikeTimeRef.current >= 4000) {
              if (isBoom && diff >= threshold) {
                lastSpikeTimeRef.current = now;
                triggerSpikeTradeRef.current('MULTDOWN');
              } else if (isCrash && diff <= -threshold) {
                lastSpikeTimeRef.current = now;
                triggerSpikeTradeRef.current('MULTUP');
              }
            }
          }
        }
      }

      // Initial active positions grab
      if (msgType === 'portfolio') {
        const contracts = data.portfolio?.contracts || [];
        setPositions(prev => {
          const next = { ...prev };
          contracts.forEach((c: any) => {
            const id = String(c.contract_id);
            // Subscribe for updates
            botEngine.send({ proposal_open_contract: 1, contract_id: c.contract_id, subscribe: 1 });
            
            if (!next[id]) {
              next[id] = {
                id,
                sym: c.symbol || '',
                type: c.contract_type || '',
                lot: (parseFloat(c.buy_price || '0') / LOT_TO_USD).toFixed(2),
                pnl: 0
              };
            }
          });
          return next;
        });
      }

      // Successful Purchase Receipt
      if (msgType === 'buy') {
        const buyDetails = data.buy;
        if (!buyDetails) return;
        const buyPrice = parseFloat(buyDetails.buy_price || '0');
        const id = String(buyDetails.contract_id);
        const reqProps = data.echo_req?.parameters || {};
        const symbolPurchased = reqProps.symbol || reqProps.underlying || selectedSymbol;
        const contractTypePurchased = reqProps.contract_type || 'MULTUP';

        // Add dynamically and subscribe
        setPositions(prev => {
          const next = {
            ...prev,
            [id]: {
              id,
              sym: symbolPurchased,
              type: contractTypePurchased,
              lot: (buyPrice / LOT_TO_USD).toFixed(2),
              pnl: 0,
              takenOnMetaTrader: true
            }
          };
          return next;
        });

        botEngine.send({ proposal_open_contract: 1, contract_id: buyDetails.contract_id, subscribe: 1 });
      }

      // Active Contract updates (PnL, sold state, etc.)
      if (msgType === 'proposal_open_contract' && data.proposal_open_contract) {
        const poc = data.proposal_open_contract;
        const id = String(poc.contract_id);
        const profit = parseFloat(poc.profit || '0');

        if (poc.is_sold) {
          // Double closing prevention cache
          if (processedSoldContractsRef.current.has(id)) {
            return;
          }
          if (processedSoldContractsRef.current.size > 2000) {
            processedSoldContractsRef.current.clear();
          }
          processedSoldContractsRef.current.add(id);

          // Extract or reconstruct the position that has been closed
          let currentPos = positionsRef.current[id];
          if (!currentPos) {
            const sym = poc.underlying_symbol || poc.underlying || selectedSymbolRef.current || 'CRASH1000';
            const type = poc.contract_type || (sym.toUpperCase().startsWith('BOOM') ? 'MULTDOWN' : 'MULTUP');
            const lot = (parseFloat(poc.buy_price || '0') / LOT_TO_USD).toFixed(2);
            currentPos = {
              id,
              sym,
              type,
              lot,
              pnl: profit,
              takenOnMetaTrader: true
            };
          }

          // Force takenOnMetaTrader to be true for our subscriptions to ensure it processes history, Martingale, and Auto Trades
          currentPos.takenOnMetaTrader = true;

          const entryPrice = poc.entry_tick_display_value || (poc.entry_tick ? String(poc.entry_tick) : '0.00');
          const exitPrice = poc.exit_tick_display_value || (poc.exit_tick ? String(poc.exit_tick) : '0.00');
          const closeTime = poc.exit_tick_time ? formatUnixTime(poc.exit_tick_time) : new Date().toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.');

          saveToHistory({
            id: currentPos.id,
            sym: currentPos.sym,
            type: currentPos.type,
            lot: currentPos.lot,
            entryPrice,
            exitPrice,
            pnl: profit,
            time: closeTime
          });

          // Evaluate Martingale Recovery
          let isMartingaleLossTriggered = false;
          if (martingaleAutoCloseRef.current) {
            if (profit < 0) {
              isMartingaleLossTriggered = true;
              // Loss taken!
              const lossAmt = Math.abs(profit);
              const prevCount = recoveryCountRef.current;
              const nextCount = prevCount + 1;
              const cumLoss = accumulatedLossRef.current + lossAmt;

              // Capture original parameters if first loss
              let baseLot = originalLotSizeRef.current;
              let baseTp = originalTpValueRef.current;
              if (prevCount === 0) {
                baseLot = lotSize;
                baseTp = tpValue;
                setOriginalLotSize(lotSize);
                setOriginalTpValue(tpValue);
                originalLotSizeRef.current = lotSize;
                originalTpValueRef.current = tpValue;
              }

              // Calculate new AutoClose Take Profit target to recover all loss + secure target profit
              const currentTpGoal = parseFloat(baseTp || tpValue) || 1.0;
              const recoveryTpNum = cumLoss + currentTpGoal;
              const recoveryTp = recoveryTpNum.toFixed(2);
              setTpValue(recoveryTp);

              // Calculate optimized next lot size to guarantee the target auto-close (recoveryTpNum)
              // is easily hit at a reasonable profit rate (~30% of position value)
              // Target Stake = recoveryTpNum / 0.30
              // Target Lot = Target Stake / LOT_TO_USD (where LOT_TO_USD is 10)
              const baseLotNum = parseFloat(baseLot || lotSize) || 0.10;
              const standardNextLot = baseLotNum * Math.pow(2.0, nextCount);
              const targetAchievableLot = recoveryTpNum / (0.30 * LOT_TO_USD);

              // Select the maximum between standard doubling and optimized easy-to-hit lot sizes
              const finalNextLotNum = Math.max(standardNextLot, targetAchievableLot);
              const nextLot = finalNextLotNum.toFixed(2);
              setLotSize(nextLot);
              if (!autoCloseRef.current) {
                setAutoClose(true); // Ensure auto-close limit is active during recovery
              }

              setRecoveryCount(nextCount);
              setAccumulatedLoss(cumLoss);

              // Alternating markets
              const alt = getAlternatedMarket(currentPos.sym);
              botEngine.notify('info', `[Martingale] Loss detected: -${lossAmt.toFixed(2)} USD (Total loss: -${cumLoss.toFixed(2)} USD). Switching to ${alt.symbol} with Lot ${nextLot} and AutoClose TP ${recoveryTp} USD.`);

              // Switch UI selected symbol
              setSelectedSymbol(alt.symbol);

              // Dispatch raw order placement immediately
              if (isLockedByAutoLock()) {
                botEngine.notify('warn', '[Martingale] Recovery order blocked: Auto-Lock is active.');
              } else {
                setTimeout(() => {
                  placeOrderRef.current(alt.direction, nextLot, alt.symbol);
                }, 800);
              }

            } else {
              // Profit/Win taken!
              if (recoveryCountRef.current > 0) {
                // Recovery successful!
                botEngine.notify('info', `[Martingale] Target profit secured (+${profit.toFixed(2)} USD)! All previous losses recovered. Switching back to normal lot (${originalLotSizeRef.current || '0.10'}) and normal AutoClose limit.`);
                
                // Restore original lot size
                if (originalLotSizeRef.current) {
                  setLotSize(originalLotSizeRef.current);
                }
                // Restore original Take Profit
                if (originalTpValueRef.current) {
                  setTpValue(originalTpValueRef.current);
                }
                
                setRecoveryCount(0);
                setAccumulatedLoss(0);
                setOriginalLotSize(null);
                setOriginalTpValue(null);
              }
            }
          }

          // Auto-Trades Trigger on successful closing of trade
          if (!isMartingaleLossTriggered && autoTradesRef.current) {
            if (isLockedByAutoLock()) {
              botEngine.notify('info', '[Auto Trades] Next trade blocked: Auto-Lock is active.');
            } else {
              const closedSymbol = currentPos.sym;
              const activeCountOfSymbol = Object.values(positionsRef.current).filter(p => p.sym.toUpperCase() === closedSymbol.toUpperCase() && String(p.id) !== id).length;
              if (activeCountOfSymbol === 0) {
                const targetDir = closedSymbol.toUpperCase().startsWith('BOOM') ? 'MULTDOWN' : 'MULTUP';
                botEngine.notify('info', `[Auto Trades] Contract finished. Placing next automatic trade on ${SYMBOL_LABELS[closedSymbol] || closedSymbol} (${targetDir === 'MULTUP' ? 'Buy' : 'Sell'})...`);
                setTimeout(() => {
                  placeOrderRef.current(targetDir, undefined, closedSymbol);
                }, 800);
              }
            }
          }

          setPositions(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          if (expandedPositionId === id) {
            setExpandedPositionId(null);
          }
        } else {
          setPositions(prev => {
            if (!prev[id]) {
              return {
                ...prev,
                [id]: {
                  id,
                  sym: poc.underlying_symbol || poc.underlying || '',
                  type: poc.contract_type || '',
                  lot: (parseFloat(poc.buy_price || '0') / LOT_TO_USD).toFixed(2),
                  pnl: profit
                }
              };
            }
            return {
              ...prev,
              [id]: {
                ...prev[id],
                pnl: profit
              }
            };
          });

          // Check clientside limit auto-close trigger
          if (autoCloseRef.current) {
            const tpThreshold = parseFloat(tpValueRef.current);
            if (!isNaN(tpThreshold) && profit >= tpThreshold) {
              botEngine.send({ sell: poc.contract_id, price: 0 });
            }
          }
        }
      }
    };

    botEngine.addRawMessageListener(handleRawMessage);
    return () => {
      botEngine.removeRawMessageListener(handleRawMessage);
    };
  }, [selectedSymbol, expandedPositionId]);

  // Active tick subscription for spike detector
  useEffect(() => {
    if (isConnected && currentStrategy === 'spike_detector') {
      botEngine.send({
        ticks_history: selectedSymbol,
        subscribe: 1,
        end: 'latest',
        style: 'ticks'
      });
    }
  }, [isConnected, currentStrategy, selectedSymbol]);

  // Auth gate legacy logic
  const handleAuthorize = async () => {
    if (!apiToken.trim()) return;
    setAuthError(null);
    setIsAuthorizing(true);
    try {
      await botEngine.establishConnection(apiToken, undefined, 'legacy');
      localStorage.setItem('deriv_connection_type', 'legacy');
      localStorage.setItem('deriv_legacy_token', apiToken);
      localStorage.setItem('deriv_active_account_type', 'real');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Verify token and retry.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Dispatch live trade orders
  const placeOrder = (direction: 'MULTUP' | 'MULTDOWN', overrideLot?: string, overrideSymbol?: string) => {
    if (!isConnectedRef.current) return;
    if (isLockedByAutoLock()) {
      botEngine.notify('warn', '[MetaTrader] Trade blocked: Auto-Lock is active.');
      return;
    }
    const targetSymbol = overrideSymbol || selectedSymbolRef.current;
    const finalLot = overrideLot || lotSizeRef.current;
    const stake = parseFloat(finalLot) * LOT_TO_USD;
    if (isNaN(stake) || stake <= 0) return;

    const symbolKey = botEngine.getSymbolKey();

    if (contractCategoryRef.current === 'rise_fall') {
      const contractType = direction === 'MULTUP' ? 'CALL' : 'PUT';
      botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: contractType,
          currency: 'USD',
          duration: 1,
          duration_unit: 'm',
          [symbolKey]: targetSymbol
        }
      });
    } else {
      const chosenMult = MULTIPLIER_MAP[targetSymbol] || 100;
      botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: direction,
          currency: 'USD',
          multiplier: chosenMult,
          [symbolKey]: targetSymbol
        }
      });
    }
  };

  // Trigger opening of hedge contract pairs
  const triggerHedgePair = () => {
    if (!isConnected || !isHedgingRunningRef.current) return;
    if (isLockedByAutoLock()) {
      isOpeningHedgesRef.current = false;
      return;
    }

    isOpeningHedgesRef.current = true;
    const stake = parseFloat(lotSize) * LOT_TO_USD;
    if (isNaN(stake) || stake <= 0) {
      isOpeningHedgesRef.current = false;
      return;
    }

    const symbolKey = botEngine.getSymbolKey();

    if (contractCategoryRef.current === 'rise_fall') {
      // Buy CALL
      botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: 'CALL',
          currency: 'USD',
          duration: 1,
          duration_unit: 'm',
          [symbolKey]: selectedSymbol
        }
      });

      // Buy PUT
      botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: 'PUT',
          currency: 'USD',
          duration: 1,
          duration_unit: 'm',
          [symbolKey]: selectedSymbol
        }
      });
    } else {
      const chosenMult = MULTIPLIER_MAP[selectedSymbol] || 100;

      // Buy MULTUP
      botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: 'MULTUP',
          currency: 'USD',
          multiplier: chosenMult,
          [symbolKey]: selectedSymbol
        }
      });

      // Buy MULTDOWN
      botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: 'MULTDOWN',
          currency: 'USD',
          multiplier: chosenMult,
          [symbolKey]: selectedSymbol
        }
      });
    }

    // Safety fallback: reset opening lock after 8 seconds if somehow got stuck
    setTimeout(() => {
      if (isHedgingRunningRef.current && isOpeningHedgesRef.current) {
        isOpeningHedgesRef.current = false;
      }
    }, 8000);
  };

  // Monitor positions for Auto-Hedging logic
  useEffect(() => {
    if (!isConnected || currentStrategy !== 'hedging' || !isHedgingRunning) {
      return;
    }

    const activeHedges = Object.values(positions).filter(
      p => p.sym === selectedSymbol && (
        p.type === 'MULTUP' || p.type === 'MULTDOWN' || p.type === 'CALL' || p.type === 'PUT'
      )
    );

    const activeHedgesCount = activeHedges.length;

    if (activeHedgesCount >= 2) {
      if (isOpeningHedgesRef.current) {
        isOpeningHedgesRef.current = false;
      }
    } else if (activeHedgesCount === 0 && !isOpeningHedgesRef.current) {
      // Trigger opening next cycle
      isOpeningHedgesRef.current = true;
      
      const t = setTimeout(() => {
        if (isHedgingRunningRef.current && currentStrategyRef.current === 'hedging') {
          triggerHedgePair();
        }
      }, 1200); // 1.2s delay to allow system settling
      
      return () => clearTimeout(t);
    }
  }, [positions, isConnected, currentStrategy, isHedgingRunning, selectedSymbol]);

  const startHedging = () => {
    setIsHedgingRunning(true);
    isHedgingRunningRef.current = true;
    isOpeningHedgesRef.current = false;
  };

  const stopHedging = () => {
    setIsHedgingRunning(false);
    isHedgingRunningRef.current = false;
    isOpeningHedgesRef.current = false;
  };

  const triggerSpikeTrade = (direction: 'MULTUP' | 'MULTDOWN') => {
    if (!isConnectedRef.current) return;
    if (isLockedByAutoLock()) {
      return;
    }
    const targetSymbol = selectedSymbolRef.current;
    const finalLot = lotSizeRef.current;
    const stake = parseFloat(finalLot) * LOT_TO_USD;
    if (isNaN(stake) || stake <= 0) return;

    const chosenMult = MULTIPLIER_MAP[targetSymbol] || 100;
    const symbolKey = botEngine.getSymbolKey();
    const countToPlace = Math.max(1, parseInt(maxPositionsRef.current) || 1);

    botEngine.notify('info', `[Spike Detector] Spike detected! Placing ${countToPlace} order(s) of ${direction} on ${SYMBOL_LABELS[targetSymbol] || targetSymbol}...`);

    for (let i = 0; i < countToPlace; i++) {
       botEngine.send({
        buy: 1,
        price: stake,
        parameters: {
          amount: stake,
          basis: 'stake',
          contract_type: direction,
          currency: 'USD',
          multiplier: chosenMult,
          [symbolKey]: targetSymbol
        }
      });
    }
  };

  // Synchronize dynamic function references on every render to completely prevent stale closures
  placeOrderRef.current = placeOrder;
  triggerSpikeTradeRef.current = triggerSpikeTrade;

  const startSpikeDetector = () => {
    setIsSpikeRunning(true);
    isSpikeRunningRef.current = true;
    lastPriceRef.current = null;
    
    if (isConnected) {
      botEngine.send({
        ticks_history: selectedSymbol,
        subscribe: 1,
        end: 'latest',
        style: 'ticks'
      });
    }
  };

  const stopSpikeDetector = () => {
    setIsSpikeRunning(false);
    isSpikeRunningRef.current = false;
  };

  const selectStrategy = (strat: 'manual' | 'hedging' | 'spike_detector') => {
    setCurrentStrategy(strat);
    setShowStrategyList(false);
    if (strat !== 'hedging') {
      stopHedging();
    }
    if (strat !== 'spike_detector') {
      stopSpikeDetector();
    }
  };

  // Close specific position
  const closePosition = (id: string | number) => {
    botEngine.send({ sell: id, price: 0 });
  };

  // Accounting summary
  const totalPnL = Object.values(positions).reduce((acc, p) => acc + p.pnl, 0);
  const totalMargin = Object.values(positions).reduce((acc, p) => acc + (parseFloat(p.lot) * LOT_TO_USD), 0);
  const activeEquity = globalBalance + totalPnL;
  const activeFreeMargin = globalBalance - totalMargin + totalPnL;
  const marginLevel = totalMargin > 0 ? (activeEquity / totalMargin) * 100 : 0;

  const formatValue = (val: number) => {
    const parts = val.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join('.');
  };

  const historyTotalProfit = filteredHistory.reduce((acc, item) => acc + item.pnl, 0);

  return (
    <div className="flex-1 flex flex-col justify-start bg-black text-white selection:bg-[#0a84ff]/30 h-full min-h-0 select-none font-sans relative">
      
      {activeSubTab === 'trade' ? (
        /* ==================== TRADE SUB-TAB ==================== */
        <div className="flex-1 flex flex-col justify-start min-h-0 overflow-hidden pb-13 bg-black">
          {/* 1. Header financial stats panel */}
          <div className="px-5 py-4 bg-black border-b border-[#2c2c2e] font-mono select-text">
            {/* Unified Header with Title, PnL if any, and Collapse Button */}
            <div className="flex justify-between items-start mb-4.5 font-sans">
              <div className="flex flex-col">
                <span className="text-[16px] font-extrabold text-[#8e8e93] uppercase tracking-wider">Trade</span>
                {Object.keys(positions).length > 0 && (
                  <span className={cn(
                    "text-[22px] font-black tracking-tight mt-1 transition-colors",
                    totalPnL > 0 ? "text-[#0a84ff]" : totalPnL < 0 ? "text-[#ff3b30]" : "text-zinc-100"
                  )}>
                    {totalPnL > 0 ? '+' : ''}{formatValue(totalPnL)} USD
                  </span>
                )}
              </div>

              {/* Action buttons including hide icon button */}
              <div className="flex items-center gap-2 mt-0.5">
                <button 
                  onClick={() => setControlsCollapsed(!controlsCollapsed)}
                  title={controlsCollapsed ? "Show Strategy Controls" : "Hide Strategy Controls"}
                  className="w-8 h-8 rounded border border-zinc-700/85 flex items-center justify-center bg-zinc-900/40 text-zinc-300 hover:text-white hover:bg-zinc-800 transition duration-150 active:scale-95 cursor-pointer"
                >
                  {controlsCollapsed ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>

                {/* Miniature Document/Order Creator Button */}
                <div className="w-8 h-8 rounded border border-zinc-700/80 flex items-center justify-center bg-zinc-900/40 text-[#8e8e93]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[16px] h-[16px]">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-baseline text-[14px] leading-relaxed">
              <span className="text-zinc-300">Balance:</span>
              <div className="flex-1 border-b border-dotted border-zinc-800 mx-2 ml-3.5 relative -top-[3px]" />
              <span className="text-zinc-100 font-bold min-w-[70px] text-right">
                {formatValue(globalBalance)}
              </span>
            </div>

            <div className="flex justify-between items-baseline text-[14px] leading-relaxed mt-1">
              <span className="text-zinc-300">Equity:</span>
              <div className="flex-1 border-b border-dotted border-zinc-800 mx-2 ml-3.5 relative -top-[3px]" />
              <span className={cn(
                "font-bold min-w-[70px] text-right",
                totalPnL > 0 ? "text-[#0a84ff]" : totalPnL < 0 ? "text-[#ff3b30]" : "text-zinc-100"
              )}>
                {formatValue(activeEquity)}
              </span>
            </div>

            <div className="flex justify-between items-baseline text-[14px] leading-relaxed mt-1">
              <span className="text-zinc-300">Margin:</span>
              <div className="flex-1 border-b border-dotted border-zinc-800 mx-2 ml-3.5 relative -top-[3px]" />
              <span className="text-zinc-100 font-bold min-w-[70px] text-right">
                {formatValue(totalMargin)}
              </span>
            </div>

            <div className="flex justify-between items-baseline text-[14px] leading-relaxed mt-1">
              <span className="text-zinc-300">Free margin:</span>
              <div className="flex-1 border-b border-dotted border-zinc-800 mx-2 ml-3.5 relative -top-[3px]" />
              <span className={cn(
                "font-bold min-w-[70px] text-right",
                activeFreeMargin >= 0 ? "text-zinc-100" : "text-[#ff3b30]"
              )}>
                {formatValue(activeFreeMargin)}
              </span>
            </div>

            {totalMargin > 0 && (
              <div className="flex justify-between items-baseline text-[14px] leading-relaxed mt-1">
                <span className="text-zinc-300">Margin Level (%):</span>
                <div className="flex-1 border-b border-dotted border-zinc-800 mx-2 ml-3.5 relative -top-[3px]" />
                <span className="text-zinc-100 font-bold min-w-[70px] text-right">
                  {formatValue(marginLevel)}
                </span>
              </div>
            )}
          </div>

          <AnimatePresence initial={false}>
            {!controlsCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden shrink-0"
              >
                {/* 2. Compact Control selector row */}
                <div className="bg-[#121212] p-3 px-4 border-b border-[#2c2c2e] grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Contract Type Selection */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-[#8e8e93] font-bold uppercase tracking-wider">Contract Type</label>
                    <div className="relative">
                      <select
                        value={contractCategory}
                        onChange={(e) => {
                          const newCat = e.target.value as 'multiplier' | 'rise_fall';
                          setContractCategory(newCat);
                          if (newCat === 'rise_fall' && !VOLATILITY_INDICES.includes(selectedSymbol)) {
                            setSelectedSymbol('1HZ10V');
                          }
                          if (isHedgingRunning) stopHedging();
                        }}
                        className="w-full bg-[#1c1c1e] text-white border border-[#2c2c2e] focus:outline-none p-2 rounded-[4px] text-[13px] font-semibold appearance-none pr-8 cursor-pointer"
                      >
                        <option value="multiplier">Multiplier</option>
                        <option value="rise_fall">Rise/Fall</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-3 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Market Selection */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-[#8e8e93] font-bold uppercase tracking-wider">Market Index / Pair</label>
                    <div className="relative">
                      <select 
                        value={selectedSymbol}
                        onChange={(e) => {
                          setSelectedSymbol(e.target.value);
                          if (isHedgingRunning) stopHedging();
                        }}
                        className="w-full bg-[#1c1c1e] text-white border border-[#2c2c2e] focus:outline-none p-2 rounded-[4px] text-[13px] font-semibold appearance-none pr-8 cursor-pointer"
                      >
                        {contractCategory === 'rise_fall' ? (
                          <optgroup label="Volatility Indices (Rise/Fall)">
                            <option value="1HZ10V">Volatility 10 (1s)</option>
                            <option value="R_10">Volatility 10</option>
                            <option value="1HZ25V">Volatility 25 (1s)</option>
                            <option value="R_25">Volatility 25</option>
                            <option value="1HZ50V">Volatility 50 (1s)</option>
                            <option value="R_50">Volatility 50</option>
                            <option value="1HZ100V">Volatility 100 (1s)</option>
                            <option value="R_100">Volatility 100</option>
                          </optgroup>
                        ) : (
                          <>
                            <optgroup label="Boom Indices">
                              <option value="BOOM50">Boom 50</option>
                              <option value="BOOM150">Boom 150</option>
                              <option value="BOOM300">Boom 300</option>
                              <option value="BOOM500">Boom 500</option>
                              <option value="BOOM600">Boom 600</option>
                              <option value="BOOM900">Boom 900</option>
                              <option value="BOOM1000">Boom 1000</option>
                            </optgroup>
                            <optgroup label="Crash Indices">
                              <option value="CRASH50">Crash 50</option>
                              <option value="CRASH150">Crash 150</option>
                              <option value="CRASH300">Crash 300</option>
                              <option value="CRASH500">Crash 500</option>
                              <option value="CRASH600">Crash 600</option>
                              <option value="CRASH900">Crash 900</option>
                              <option value="CRASH1000">Crash 1000</option>
                            </optgroup>
                            <optgroup label="Volatility Indices">
                              <option value="1HZ10V">Volatility 10 (1s)</option>
                              <option value="R_10">Volatility 10</option>
                              <option value="1HZ25V">Volatility 25 (1s)</option>
                              <option value="R_25">Volatility 25</option>
                              <option value="1HZ50V">Volatility 50 (1s)</option>
                              <option value="R_50">Volatility 50</option>
                              <option value="1HZ100V">Volatility 100 (1s)</option>
                              <option value="R_100">Volatility 100</option>
                            </optgroup>
                            <optgroup label="Forex & Gold">
                              <option value="frxXAUUSD">XAU/USD</option>
                              <option value="frxEURUSD">EUR/USD</option>
                              <option value="frxGBPUSD">GBP/USD</option>
                              <option value="frxUSDJPY">USD/JPY</option>
                            </optgroup>
                          </>
                        )}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-3 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Lot size selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-[#8e8e93] font-bold uppercase tracking-wider">
                      {contractCategory === 'rise_fall' ? 'Stake ($)' : 'Lot Size'}
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={lotSize}
                      onChange={(e) => {
                        setLotSize(e.target.value);
                        if (isHedgingRunning) stopHedging();
                      }}
                      className="w-full bg-[#1c1c1e] text-white border border-[#2c2c2e] focus:outline-none p-2 rounded-[4px] text-[13px] font-mono text-center font-semibold"
                    />
                  </div>
                </div>

                {/* Strategy Selector Row */}
                <div className="bg-[#121212] p-3 px-4 border-b border-[#2c2c2e] flex items-center justify-between relative">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-[#0a84ff]/10 border border-[#0a84ff]/25 flex items-center justify-center text-[#0a84ff] shrink-0">
                      <Cpu size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#8e8e93] font-black uppercase tracking-wider">TRADING MODE / STRATEGY</span>
                      <span className="text-[12px] font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                        {currentStrategy === 'manual' ? 'Manual Trading' : currentStrategy === 'hedging' ? 'Auto Hedging' : 'Spike Detector'}
                      </span>
                    </div>
                  </div>

                  {/* Strategy list trigger button */}
                  <button 
                    onClick={() => setShowStrategyList(!showStrategyList)}
                    className="bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-[#2c2c2e] text-zinc-300 font-extrabold text-[10px] px-3.5 py-2 rounded-[4px] flex items-center gap-1.5 uppercase tracking-widest transition active:scale-95"
                  >
                    <span>SELECT STRATEGY</span>
                    <ChevronDown size={12} className={cn("transition-transform duration-200", showStrategyList && "rotate-180")} />
                  </button>
                </div>

                {/* Collapsible Strategy List Panel */}
                <AnimatePresence initial={false}>
                  {showStrategyList && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className="bg-[#161618] border-b border-[#2c2c2e] overflow-hidden"
                    >
                      <div className="p-2 border-b border-[#222224] bg-[#0c0c0e]/60">
                        <span className="text-[8.5px] font-black uppercase text-[#8e8e93] tracking-wider block px-2.5 py-1">Available Strategies</span>
                      </div>
                      <div className="p-1 divide-y divide-zinc-900/60">
                        {/* Manual Strategy Button */}
                        <button 
                          onClick={() => {
                            selectStrategy('manual');
                            setShowStrategyList(false);
                          }}
                          className={cn(
                            "w-full text-left p-2.5 hover:bg-zinc-900/40 flex gap-3 items-start transition-colors rounded-md",
                            currentStrategy === 'manual' && "bg-[#1c1c1e]/45"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", currentStrategy === 'manual' ? "bg-[#0a84ff]" : "bg-transparent border border-zinc-700")} />
                          <div>
                            <div className="text-[11px] font-black text-white uppercase tracking-wider">Manual Trade</div>
                            <div className="text-[9.5px] text-zinc-500 leading-normal mt-0.5 font-medium">Place custom Buy/Sell contracts immediately whenever ready.</div>
                          </div>
                        </button>

                        {/* Auto Hedging Button */}
                        <button 
                          onClick={() => {
                            selectStrategy('hedging');
                            setShowStrategyList(false);
                          }}
                          className={cn(
                            "w-full text-left p-2.5 hover:bg-zinc-900/40 flex gap-3 items-start transition-colors rounded-md",
                            currentStrategy === 'hedging' && "bg-[#1c1c1e]/45"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", currentStrategy === 'hedging' ? "bg-[#32d74b]" : "bg-transparent border border-zinc-700")} />
                          <div>
                            <div className="text-[11px] font-black text-white uppercase tracking-wider">Auto Hedging</div>
                            <div className="text-[9.5px] text-zinc-500 leading-normal mt-0.5 font-medium">Bot enters exact Buy & Sell positions together. Once closed, automatically opens next.</div>
                          </div>
                        </button>

                        {/* Spike Detector Button */}
                        <button 
                          onClick={() => {
                            selectStrategy('spike_detector');
                            setShowStrategyList(false);
                          }}
                          className={cn(
                            "w-full text-left p-2.5 hover:bg-zinc-900/40 flex gap-3 items-start transition-colors rounded-md",
                            currentStrategy === 'spike_detector' && "bg-[#1c1c1e]/45"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", currentStrategy === 'spike_detector' ? "bg-[#ff9500]" : "bg-transparent border border-zinc-700")} />
                          <div>
                            <div className="text-[11px] font-black text-white uppercase tracking-wider">Spike Detector</div>
                            <div className="text-[9.5px] text-zinc-500 leading-normal mt-0.5 font-medium">Crash/Boom Spike Detector: place high-frequency multi-position counter trades on major surges.</div>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 3. Auto Close Switch Row */}
                <div className="bg-[#1c1c1e] p-2.5 px-4 border-b border-[#2c2c2e] flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={autoClose}
                        onChange={(e) => setAutoClose(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-[22px] bg-zinc-800 rounded-full peer peer-checked:bg-[#0a84ff] transition-all duration-200 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[18px]" />
                    </div>
                    <span className="text-[11px] font-black text-[#8e8e93] tracking-wide uppercase">AUTOCLOSE LIMIT</span>
                  </label>

                  {autoClose && (
                    <div className="w-[120px] flex items-center gap-1">
                      <DollarSign size={10} className="text-zinc-500 font-semibold shrink-0" />
                      <input 
                        type="number"
                        step="0.10"
                        min="0.10"
                        placeholder="TP $"
                        value={tpValue}
                        onChange={(e) => setTpValue(e.target.value)}
                        className="w-full bg-[#121212] border border-[#2c2c2e] text-white text-xs p-1 px-2 focus:outline-none rounded text-right font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* 3.5 Martingale AutoClose Switch Row */}
                <div className="bg-[#1c1c1e] p-2.5 px-4 border-b border-[#2c2c2e] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={martingaleAutoClose}
                          onChange={(e) => setMartingaleAutoClose(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-[22px] bg-zinc-800 rounded-full peer peer-checked:bg-[#ff9500] transition-all duration-200 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[18px]" />
                      </div>
                      <span className="text-[11px] font-black text-[#8e8e93] tracking-wide uppercase">MARTINGALE AUTOCLOSE</span>
                    </label>

                    {recoveryCount > 0 && (
                      <span className="text-[9.5px] font-mono text-[#ff9500] bg-amber-500/10 border border-[#ff9500]/30 px-2 py-0.5 rounded font-black animate-pulse">
                        RECOVERY LEVEL: {recoveryCount}
                      </span>
                    )}
                  </div>

                  {martingaleAutoClose && (
                    <div className="text-[9.5px] text-zinc-500 uppercase tracking-wider font-semibold leading-normal">
                      Auto-detects losses and flips crash/boom index matching buy on crash & sell on boom with scaled lot sizes.
                      {recoveryCount > 0 && (
                        <div className="mt-1 text-amber-500 font-mono text-[9px] flex gap-3">
                          <span>• ACCUMULATED LOSS: -{accumulatedLoss.toFixed(2)} USD</span>
                          <span>• ACTIVE LOT: {lotSize}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3.6 Auto Trades Switch Row */}
                <div className="bg-[#1c1c1e] p-2.5 px-4 border-b border-[#2c2c2e] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={autoTrades}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAutoTrades(checked);
                            if (checked && isConnected) {
                              const activeCountOfSymbol = Object.values(positionsRef.current).filter(p => p.sym === selectedSymbol).length;
                              if (activeCountOfSymbol === 0) {
                                const targetDir = selectedSymbol.toUpperCase().startsWith('BOOM') ? 'MULTDOWN' : 'MULTUP';
                                botEngine.notify('info', `[Auto Trades] Switch activated. Starting first trade on ${SYMBOL_LABELS[selectedSymbol] || selectedSymbol}...`);
                                setTimeout(() => {
                                  placeOrder(targetDir, undefined, selectedSymbol);
                                }, 300);
                              }
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-[22px] bg-zinc-800 rounded-full peer peer-checked:bg-[#0a84ff] transition-all duration-200 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[18px]" />
                      </div>
                      <span className="text-[11px] font-black text-[#8e8e93] tracking-wide uppercase">AUTO TRADES LOOP</span>
                    </label>
                  </div>
                  <div className="text-[9.5px] text-zinc-500 uppercase tracking-wider font-semibold leading-normal">
                    When enabled, immediately opens a new transaction each time an existing one closes (Buys on Crash index / Sells on Boom index).
                  </div>
                </div>

                {/* 3.7 MetaTrader Auto Lock Switch Row */}
                <div className="bg-[#1c1c1e] p-2.5 px-4 border-b border-[#2c2c2e] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={autoLock}
                          onChange={(e) => setAutoLock(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-[22px] bg-zinc-800 rounded-full peer peer-checked:bg-[#bf5af2] transition-all duration-200 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[18px]" />
                      </div>
                      <span className="text-[11px] font-black text-[#8e8e93] tracking-wide uppercase">AUTOBOT CO-TRADING PREVENTER</span>
                    </label>

                    {isLockedByAutoLock() && (
                      <span className="text-[9px] font-mono text-[#bf5af2] bg-[#bf5af2]/10 border border-[#bf5af2]/30 px-2 py-0.5 rounded font-black flex items-center gap-1 animate-pulse">
                        <Lock size={10} /> LOCKED
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] text-zinc-500 uppercase tracking-wider font-semibold leading-normal">
                    Prevents concurrent trading errors. Automatically locks MetaTrader execution if the user switches tabs, closes this page, or starts a Bot on the Bot Builder / AutoBot.
                  </div>
                </div>

                {/* 4. SELL / BUY Quick Execution / Strategy Console rows */}
                <div className="bg-black">
                  {currentStrategy === 'manual' ? (
                    <div className="p-3 flex flex-col gap-2.5 bg-black">
                      {isLockedByAutoLock() && (
                        <div className="bg-purple-950/25 border border-purple-500/35 rounded p-2 text-center text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 leading-none">
                          <Lock size={12} className="animate-pulse" /> Auto-Lock Protected: Positions Locked
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button 
                          onClick={() => placeOrder('MULTDOWN')}
                          disabled={!isConnected || isLockedByAutoLock()}
                          className="flex-1 bg-[#ff3b30] hover:bg-[#ff453a] active:scale-95 text-white font-bold text-[13px] py-2 rounded-md tracking-wide transition duration-150 uppercase disabled:opacity-30 text-center"
                        >
                          SELL
                        </button>

                        <button 
                          onClick={() => placeOrder('MULTUP')}
                          disabled={!isConnected || isLockedByAutoLock()}
                          className="flex-1 bg-[#0a84ff] hover:bg-[#008cf2] active:scale-95 text-white font-bold text-[13px] py-2 rounded-md tracking-wide transition duration-150 uppercase disabled:opacity-30 text-center"
                        >
                          BUY
                        </button>
                      </div>
                    </div>
                  ) : currentStrategy === 'hedging' ? (
                    /* Auto Hedging Control console */
                    <div className="p-3">
                      <div className="bg-[#121212] border border-[#2c2c2e] rounded-lg p-3 font-sans">
                        <div className="flex justify-between items-center mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className={cn(
                                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                isHedgingRunning ? "bg-[#32d74b]" : "bg-zinc-500"
                              )}></span>
                              <span className={cn(
                                "relative inline-flex rounded-full h-2 w-2",
                                isHedgingRunning ? "bg-[#32d74b]" : "bg-zinc-500"
                              )}></span>
                            </span>
                            <span className="text-[10px] font-black uppercase text-[#8e8e93] tracking-widest">HEDGER STATUS:</span>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              isHedgingRunning ? "text-[#32d74b]" : "text-zinc-500"
                            )}>
                              {isHedgingRunning ? "RUNNING LOOP" : "INACTIVE"}
                            </span>
                          </div>

                          {isHedgingRunning && (
                            <span className="text-[10px] font-mono text-zinc-400 bg-[#1c1c1e] p-1 px-2.5 rounded border border-[#2c2c2e]">
                              Cyc: {Object.values(positions).filter(p => p.sym === selectedSymbol && (p.type === 'MULTUP' || p.type === 'MULTDOWN')).length}/2 Active
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-zinc-500 leading-normal mb-3 font-semibold uppercase tracking-wide">
                          Auto Hedging places 2 exact opposing multiplier positions at <span className="text-zinc-300">{lotSize} Lot</span> on <span className="text-zinc-300">{SYMBOL_LABELS[selectedSymbol] || selectedSymbol}</span>. Once both contracts are closed, standard loops immediately trigger a fresh pair.
                        </p>

                        {isLockedByAutoLock() && (
                          <div className="mb-3 bg-purple-950/25 border border-purple-500/35 rounded p-2 text-center text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 leading-none">
                            <Lock size={12} className="animate-pulse" /> Auto-Lock Protected: Hedger Locked
                          </div>
                        )}

                        {!isHedgingRunning ? (
                          <button 
                            onClick={startHedging}
                            disabled={!isConnected || isLockedByAutoLock()}
                            className="w-full bg-[#32d74b] hover:bg-[#2bbf3f] active:scale-95 text-black font-bold text-[11px] py-2 rounded uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40"
                          >
                            <Play size={11} className="fill-black stroke-none" />
                            START AUTO HEDGER LOOP
                          </button>
                        ) : (
                          <button 
                            onClick={stopHedging}
                            className="w-full bg-[#ff3b30] hover:bg-rose-600 active:scale-95 text-white font-bold text-[11px] py-2 rounded uppercase tracking-wider transition flex items-center justify-center gap-2"
                          >
                            <Square size={9} className="fill-white stroke-none" />
                            STOP AUTO HEDGER LOOP
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Spike Detector Control console */
                    <div className="p-3">
                      <div className="bg-[#121212] border border-[#2c2c2e] rounded-lg p-3 font-sans">
                        <div className="flex justify-between items-center mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className={cn(
                                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                isSpikeRunning ? "bg-[#ff9500]" : "bg-zinc-500"
                              )}></span>
                              <span className={cn(
                                "relative inline-flex rounded-full h-2 w-2",
                                isSpikeRunning ? "bg-[#ff9500]" : "bg-zinc-500"
                              )}></span>
                            </span>
                            <span className="text-[10px] font-black uppercase text-[#8e8e93] tracking-widest">SPIKE STATUS:</span>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              isSpikeRunning ? "text-[#ff9500]" : "text-zinc-500"
                            )}>
                              {isSpikeRunning ? "ACTIVE SEARCHING" : "INACTIVE"}
                            </span>
                          </div>

                          {isSpikeRunning && (
                            <span className="text-[10px] font-mono text-zinc-400 bg-[#1c1c1e] p-1 px-2.5 rounded border border-[#2c2c2e] flex items-center gap-1.5 animate-pulse">
                              <Zap size={10} className="fill-amber-500 stroke-amber-500 animate-bounce" /> LISTENING...
                            </span>
                          )}
                        </div>

                        {!(selectedSymbol.toUpperCase().startsWith('BOOM') || selectedSymbol.toUpperCase().startsWith('CRASH')) && (
                          <div className="p-2.5 bg-rose-500/10 border border-rose-500/35 rounded text-rose-400 text-[10.5px] font-extrabold mb-3 uppercase tracking-wide">
                            ⚠️ Select a Boom or Crash symbol above to run the Spike Detector strategy!
                          </div>
                        )}

                        <p className="text-[10px] text-zinc-500 leading-normal mb-3 font-semibold uppercase tracking-wide">
                          Crash/Boom spike Detector: identifies sudden major surges on <span className="text-zinc-300">{SYMBOL_LABELS[selectedSymbol] || selectedSymbol}</span>. After detecting an explosive spike, it counter-trades with <span className="text-zinc-300">multiplier positions</span> to capture the recovery.
                          <br />
                          <span className="text-[#ff9500]/95 font-bold mt-1.5 block">
                            • Crash index drops (Spike DOWN) ➔ places MULTUP (Buy)<br />
                            • Boom index surges (Spike UP) ➔ places MULTDOWN (Sell)
                          </span>
                        </p>

                        <div className="mb-3.5 pt-2.5 border-t border-zinc-800 flex items-center justify-between gap-3">
                          <span className="text-[10.5px] font-black uppercase text-[#8e8e93] tracking-wider shrink-0 flex items-center gap-1.5 font-sans">
                            <Layers size={11} className="text-[#ff9500]" /> MAX POSITIONS INPUT:
                          </span>
                          <input 
                            type="number"
                            min="1"
                            max="10"
                            placeholder="Max"
                            value={maxPositions}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                              setMaxPositions(String(val));
                            }}
                            className="bg-[#1c1c1e] text-white border border-[#2c2c2e] focus:outline-none focus:border-[#ff9500] p-1 px-2.5 rounded text-[12px] font-mono font-bold w-[75px] text-center"
                          />
                        </div>

                        {isLockedByAutoLock() && (
                          <div className="mb-3 bg-purple-950/25 border border-purple-500/35 rounded p-2 text-center text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 leading-none">
                            <Lock size={12} className="animate-pulse" /> Auto-Lock Protected: Spike Detector Locked
                          </div>
                        )}

                        {!isSpikeRunning ? (
                          <button 
                            onClick={startSpikeDetector}
                            disabled={!isConnected || isLockedByAutoLock() || !(selectedSymbol.toUpperCase().startsWith('BOOM') || selectedSymbol.toUpperCase().startsWith('CRASH'))}
                            className="w-full bg-[#ff9500] hover:bg-[#e08200] active:scale-95 text-black font-bold text-[11px] py-2 rounded uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-40"
                          >
                            <Play size={11} className="fill-black stroke-none" />
                            START SPIKE DETECTOR
                          </button>
                        ) : (
                          <button 
                            onClick={stopSpikeDetector}
                            className="w-full bg-[#ff3b30] hover:bg-rose-600 active:scale-95 text-white font-bold text-[11px] py-2 rounded uppercase tracking-wider transition flex items-center justify-center gap-2"
                          >
                            <Square size={9} className="fill-white stroke-none" />
                            STOP SPIKE DETECTOR
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 4.5 Strategy Controls Hidden Strip indicator */}
          {controlsCollapsed && (
            <div 
              onClick={() => setControlsCollapsed(false)}
              className="bg-[#121212]/95 hover:bg-[#1c1c1e] p-2.5 px-5 flex justify-between items-center border-b border-[#2c2c2e] text-xs text-zinc-400 cursor-pointer transition select-none animate-[fadeIn_0.15s_ease-out] shrink-0"
            >
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-zinc-500">
                <Cpu size={11} className="text-[#0a84ff]" /> Strategy Controls Hidden
              </span>
              <span className="text-[10px] font-black uppercase text-[#0a84ff] tracking-widest flex items-center gap-1 select-none">
                Expand <Eye size={11} />
              </span>
            </div>
          )}

          {/* 5. Positions Gray bar Header */}
          <div className="bg-[#1c1c1e] p-2.5 px-5 flex justify-between items-center border-b border-[#2c2c2e] shrink-0">
            <span className="text-[11px] font-black uppercase text-[#8e8e93] tracking-wider">
              Open Positions
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              COUNT: {Object.keys(positions).length}
            </span>
          </div>

          {/* 6. Active Position List */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-black pb-12">
            {Object.keys(positions).length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center text-zinc-600 px-4">
                <MetaTrader5Icon size={32} className="mb-3 opacity-60" />
                <p className="text-[11px] uppercase tracking-wider font-extrabold text-[#8e8e93]">No Active Trades</p>
                <p className="text-[10px] text-zinc-600 max-w-[280px] mt-1 leading-relaxed">
                  Activate options contracts with the BUY and SELL execution panels above.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#2c2c2e] border-b border-[#2c2c2e]">
                {Object.values(positions).map((p) => {
                  const isBuy = p.type.toUpperCase().includes('UP') || p.type.toUpperCase() === 'CALL' || p.type.toUpperCase().includes('RISE');
                  const isExpanded = expandedPositionId === p.id;

                  return (
                    <div key={p.id} className="bg-black">
                      <div 
                        className="p-3.5 px-5 flex justify-between items-center cursor-pointer hover:bg-zinc-950/20 active:bg-zinc-950/10 transition-colors"
                        onClick={() => setExpandedPositionId(isExpanded ? null : p.id)}
                      >
                        <div>
                          <span className="text-[13.5px] font-extrabold text-white">
                            {SYMBOL_LABELS[p.sym] || p.sym}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                            <span className={cn(
                              "uppercase font-black",
                              isBuy ? "text-[#0a84ff]" : "text-[#ff3b30]"
                            )}>
                              {isBuy ? 'buy' : 'sell'}
                            </span>
                            <span className="text-[#8e8e93] font-mono">
                              {p.lot}
                            </span>
                          </div>
                        </div>

                        <span className={cn(
                          "text-[17px] font-extrabold font-mono tracking-tight",
                          p.pnl >= 0 ? "text-[#0a84ff]" : "text-[#ff3b30]"
                        )}>
                          {p.pnl.toFixed(2)}
                        </span>
                      </div>

                      {/* Expansion tray option to trigger contract exit sell */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden bg-[#1c1c1e] border-t border-dashed border-zinc-800"
                          >
                            <div className="p-3 px-5 flex justify-between items-center">
                              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                                ID: {p.id}
                              </span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closePosition(p.id);
                                }}
                                className="bg-[#3a3a3c] hover:bg-zinc-700 text-white px-5 py-2 rounded text-xs font-bold transition-all border border-[#2c2c2e]"
                              >
                                CLOSE
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== HISTORY SUB-TAB ==================== */
        <div className="flex-1 flex flex-col justify-start min-h-0 overflow-y-auto pb-14 bg-black relative">
          {/* Header top row corresponding to input_file_1.png */}
          <div className="bg-[#121212] border-b border-[#2c2c2e] p-3 px-5 flex justify-between items-center relative z-20">
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-white tracking-tight leading-none animate-[fadeIn_0.1s_ease-out]">History</span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide mt-1">All symbols</span>
            </div>

            {/* Calendar picker icon with relative anchor */}
            <div className="relative">
              <button 
                onClick={() => setShowPeriodDropdown(prev => !prev)}
                className="text-zinc-300 hover:text-[#0a84ff] hover:bg-[#1c1c1e] transition-all duration-250 active:scale-95 p-2 rounded-md border border-zinc-800/85 bg-zinc-900/40 shadow-sm flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[17px] h-[17px]">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </button>

              {/* Dropdown menu matching the MT5 look exactly */}
              {showPeriodDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowPeriodDropdown(false)}
                  />
                  <div className="absolute right-0 top-[42px] w-[270px] bg-[#1e1e20] border border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-zinc-850 font-sans">
                    {/* Today */}
                    <button 
                      onClick={() => {
                        setSelectedPeriod('today');
                        setShowPeriodDropdown(false);
                      }}
                      className="w-full text-left p-3 hover:bg-zinc-800/40 flex items-center gap-3 transition-colors text-white"
                    >
                      <div className="w-8 h-8 rounded-md bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-820">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
                          <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
                          <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
                          <circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
                          <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
                          <circle cx="17" cy="18" r="1" fill="currentColor" stroke="none" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold tracking-tight">Today</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{getPeriodRanges().today}</div>
                      </div>
                      {selectedPeriod === 'today' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="3" className="w-[18px] h-[18px] shrink-0 font-bold">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    {/* Last week */}
                    <button 
                      onClick={() => {
                        setSelectedPeriod('week');
                        setShowPeriodDropdown(false);
                      }}
                      className="w-full text-left p-3 hover:bg-zinc-800/40 flex items-center gap-3 transition-colors text-white"
                    >
                      <div className="w-8 h-8 rounded-md bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-820">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <line x1="7" y1="14" x2="17" y2="14" />
                          <line x1="7" y1="18" x2="13" y2="18" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold tracking-tight">Last week</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{getPeriodRanges().week}</div>
                      </div>
                      {selectedPeriod === 'week' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="3" className="w-[18px] h-[18px] shrink-0 font-bold">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    {/* Last month */}
                    <button 
                      onClick={() => {
                        setSelectedPeriod('month');
                        setShowPeriodDropdown(false);
                      }}
                      className="w-full text-left p-3 hover:bg-zinc-800/40 flex items-center gap-3 transition-colors text-white"
                    >
                      <div className="w-8 h-8 rounded-md bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-820">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold tracking-tight">Last month</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{getPeriodRanges().month}</div>
                      </div>
                      {selectedPeriod === 'month' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="3" className="w-[18px] h-[18px] shrink-0 font-bold">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    {/* Last 3 months */}
                    <button 
                      onClick={() => {
                        setSelectedPeriod('three_months');
                        setShowPeriodDropdown(false);
                      }}
                      className="w-full text-left p-3 hover:bg-zinc-800/40 flex items-center gap-3 transition-colors text-white"
                    >
                      <div className="w-8 h-8 rounded-md bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-820 relative">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <text x="12" y="19" fontSize="8" fontWeight="black" textAnchor="middle" fill="currentColor" stroke="none">3</text>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold tracking-tight">Last 3 months</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{getPeriodRanges().threeMonths}</div>
                      </div>
                      {selectedPeriod === 'three_months' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="3" className="w-[18px] h-[18px] shrink-0 font-bold">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    {/* Custom period */}
                    <button 
                      onClick={() => {
                        setShowCustomModal(true);
                        setShowPeriodDropdown(false);
                      }}
                      className="w-full text-left p-3 hover:bg-zinc-800/40 flex items-center gap-3 transition-colors text-white"
                    >
                      <div className="w-8 h-8 rounded-md bg-zinc-900/50 flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-820">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4.5 h-4.5">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <circle cx="12" cy="14" r="2.2" fill="currentColor" stroke="none" />
                          <path d="M8 20c0-1.8 1.8-2.8 4-2.8s4 1 4 2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-bold tracking-tight">Custom period</div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {selectedPeriod === 'custom' && (customStartDate || customEndDate) ? (
                            `${customStartDate ? customStartDate.replace(/-/g, '.') : '...'} - ${customEndDate ? customEndDate.replace(/-/g, '.') : '...'}`
                          ) : (
                            'Select custom range'
                          )}
                        </div>
                      </div>
                      {selectedPeriod === 'custom' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="3" className="w-[18px] h-[18px] shrink-0 font-bold">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dotted balance stats segment */}
          <div className="p-4 px-5 bg-black font-mono select-text border-b border-[#2d2c2e]">
            <div className="flex justify-between items-baseline text-[13.5px] leading-relaxed">
              <span className="text-zinc-300">Profit:</span>
              <div className="flex-1 border-b border-dotted border-zinc-900 mx-2 ml-3.5 relative -top-[3.5px]" />
              <span className={cn(
                "font-bold text-right",
                historyTotalProfit >= 0 ? "text-[#0a84ff]" : "text-[#ff3b30]"
              )}>
                {formatValue(historyTotalProfit)}
              </span>
            </div>

            <div className="flex justify-between items-baseline text-[13.5px] leading-relaxed mt-1.5">
              <span className="text-zinc-300">Balance:</span>
              <div className="flex-1 border-b border-dotted border-zinc-900 mx-2 ml-3.5 relative -top-[3.5px]" />
              <span className="text-[#0a84ff] font-bold text-right">
                {formatValue(historyTotalProfit)}
              </span>
            </div>
          </div>

          {/* Scrolling list panel */}
          <div className="flex-1 overflow-y-auto bg-black pb-4">
            {filteredHistory.length === 0 ? (
              <div className="py-24 text-center text-zinc-650 px-4">
                <p className="text-[11.5px] uppercase tracking-wider font-extrabold text-zinc-500">No Closed Trades</p>
                <p className="text-[10px] text-zinc-650 max-w-[240px] mx-auto mt-1 leading-normal">
                  No trades found in the selected period.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#1c1c1e] border-b border-[#1c1c1e]">
                {filteredHistory.map((item, index) => {
                  const isBuy = item.type.toUpperCase().includes('UP') || item.type.toUpperCase() === 'CALL' || item.type.toUpperCase().includes('RISE');
                  const isWin = item.pnl >= 0;
                  return (
                    <div key={item.id || index} className="p-3.5 px-5 hover:bg-zinc-950/20 transition-colors">
                      {/* Top line mapping */}
                      <div className="flex justify-between items-center">
                        <span className="text-[13.5px] font-bold text-white leading-tight">
                          {SYMBOL_LABELS[item.sym] || item.sym}, <span className={cn(
                            "text-[10.5px] font-extrabold lowercase",
                            isBuy ? "text-[#00c7e2]" : "text-[#ff3b30]"
                          )}>
                            {isBuy ? 'buy' : 'sell'} {item.lot}
                          </span>
                        </span>
                        <span className="text-[10.5px] font-mono text-[#8e8e93]">
                          {item.time}
                        </span>
                      </div>

                      {/* Bottom line mapping mirroring output style */}
                      <div className="flex justify-between items-end mt-1">
                        <span className="text-[11px] font-mono text-[#8e8e93]">
                          {item.entryPrice} &rarr; {item.exitPrice}
                        </span>
                        <span className={cn(
                          "text-[13.5px] font-bold font-mono tracking-tight",
                          isWin ? "text-[#00c7e2]" : "text-[#ff3b30]"
                        )}>
                          {isWin ? '+' : ''}{item.pnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Datepicker Modal overlay */}
          {showCustomModal && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] font-sans">
              <div className="w-full max-w-[320px] bg-[#1c1c1e] border border-zinc-800 rounded-xl p-5 shadow-2xl relative animate-[fadeIn_0.15s_ease-out]">
                <div className="mb-4">
                  <h3 className="text-[15.5px] font-bold text-white tracking-tight">Custom period</h3>
                  <p className="text-[11px] text-zinc-400 mt-1">Filter MetaTrader active journal by custom dates</p>
                </div>

                <div className="space-y-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-widest">From Date</label>
                    <input 
                      type="date" 
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#0a84ff] focus:outline-none p-2 rounded text-sm text-white font-mono [color-scheme:dark]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9.5px] font-bold text-zinc-400 uppercase tracking-widest">To Date</label>
                    <input 
                      type="date" 
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-[#121212] border border-zinc-800 focus:border-[#0a84ff] focus:outline-none p-2 rounded text-sm text-white font-mono [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex gap-3.5 mt-6 font-sans">
                  <button 
                    onClick={() => {
                      setShowCustomModal(false);
                    }}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-bold py-2.5 rounded transition duration-150 uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedPeriod('custom');
                      setShowCustomModal(false);
                    }}
                    className="flex-1 bg-[#0a84ff] hover:bg-[#008cf2] active:scale-95 text-white text-xs font-bold py-2.5 rounded transition duration-150 uppercase tracking-wider shadow"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Persistent Bottom Tab Switcher (Styled MT5 style) */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#121212] border-t border-[#2c2c2e] h-13 flex items-center justify-around z-10 shrink-0">
        <button 
          id="tab-trade-btn"
          onClick={() => setActiveSubTab('trade')}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors pb-1 border-r border-[#1c1c1e]",
            activeSubTab === 'trade' ? "text-[#0a84ff]" : "text-zinc-500 hover:text-zinc-400"
          )}
        >
          <Activity size={18} />
          <span className="text-[9.5px] font-bold mt-1 uppercase tracking-wider">Trade</span>
        </button>

        <button 
          id="tab-history-btn"
          onClick={() => setActiveSubTab('history')}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors pb-1",
            activeSubTab === 'history' ? "text-[#0a84ff]" : "text-zinc-500 hover:text-zinc-400"
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[18px] h-[18px]">
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <span className="text-[9.5px] font-bold mt-1 uppercase tracking-wider">History</span>
        </button>
      </div>

      {/* Login authorization gate overlay */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-[#121212] border border-[#2c2c2e] rounded-xl shadow-2xl p-5"
            >
              <div className="text-center mb-5">
                <div className="flex justify-center mb-3.5">
                  <MetaTrader5Icon size={42} />
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[#8e8e93]">META TRADER</h3>
                <p className="text-[10px] text-zinc-500 max-w-xs mx-auto mt-1 leading-normal">
                  Simulate high frequency contracts with multiplier derivatives. Connect live account to start session.
                </p>
              </div>

              <div className="mt-2 flex flex-col items-center justify-center py-5 gap-4 select-none">
                <div className="relative flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full border-3 border-zinc-800 border-t-3 border-t-[#32d74b] animate-spin"></div>
                  <div className="absolute w-6 h-6 rounded-full border border-zinc-900 border-b border-b-[#0a84ff] animate-[spin_1s_linear_infinite_reverse]"></div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[13px] font-extrabold tracking-widest text-[#32d74b] uppercase animate-pulse">
                    Connecting...
                  </span>
                  <span className="text-[8.5px] font-mono tracking-widest text-zinc-500 uppercase">
                    Establishing Live Stream
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
});
