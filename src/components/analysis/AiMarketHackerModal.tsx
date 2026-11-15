import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Play, ShieldCheck, Square, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import {
  AccuracyEvaluator,
  HackerMathSummary,
  IngestionBuffer,
  MathReconstructionSolver,
  ShadowGenerator,
  ShadowPrediction,
} from '../../lib/hackerMath';
import { getSymbolDecimals } from './types';

interface AiMarketHackerModalProps {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  hasVirtualToken: boolean;
  onScanningChange: (scanning: boolean) => void;
  onNotifyError: (msg: string) => void;
}

const VOLATILITY_10_MARKETS = [
  '1HZ10V',
  'R_10',
  '1HZ25V',
  'R_25',
  '1HZ50V',
  'R_50',
  '1HZ75V',
  'R_75',
  '1HZ100V',
  'R_100',
];

export const AiMarketHackerModal: React.FC<AiMarketHackerModalProps> = ({
  open,
  onClose,
  connected,
  hasVirtualToken,
  onScanningChange,
  onNotifyError,
}) => {
  const [hackerScanning, setHackerScanning] = useState(false);
  const [hackerStake, setHackerStake] = useState(() =>
    parseFloat(localStorage.getItem('hacker_stake') || '0.50')
  );
  const [hackerMartingaleMultiplier, setHackerMartingaleMultiplier] = useState(() =>
    parseFloat(localStorage.getItem('hacker_martingale_mult') || '2.1')
  );
  const [hackerMartingaleAfterLosses, setHackerMartingaleAfterLosses] = useState(() =>
    parseInt(localStorage.getItem('hacker_martingale_after_losses') || '1', 10)
  );
  const [hackerDurationTicks, setHackerDurationTicks] = useState<number>(() => {
    const saved = localStorage.getItem('hacker_duration_ticks');
    return saved ? Math.max(1, Math.min(10, parseInt(saved, 10) || 1)) : 1;
  });
  const [hackerMaxTrades, setHackerMaxTrades] = useState(() =>
    parseInt(localStorage.getItem('hacker_max_trades') || '5', 10)
  );
  const [hackerVirtualMode, setHackerVirtualMode] = useState(
    () => hasVirtualToken && localStorage.getItem('hacker_virtual_mode') === 'true'
  );
  const [hackerVirtualLosses, setHackerVirtualLosses] = useState(() => {
    const val = parseInt(localStorage.getItem('hacker_virtual_losses') || '1', 10);
    return isNaN(val) || val < 1 ? 1 : val;
  });
  const [hackerAutoRestartWin, setHackerAutoRestartWin] = useState(
    () => hasVirtualToken && localStorage.getItem('hacker_auto_restart_win') === 'true'
  );
  const [hackerSameMarketRecovery, setHackerSameMarketRecovery] = useState(
    () => localStorage.getItem('hacker_same_market_recovery') === 'true'
  );
  const [hackerContinuousSameMarket, setHackerContinuousSameMarket] = useState(
    () => localStorage.getItem('hacker_continuous_same_market') === 'true'
  );
  const [hackerRecoveryContract, setHackerRecoveryContract] = useState<'DIGITOVER' | 'DIGITUNDER'>(
    () =>
      (localStorage.getItem('hacker_recovery_contract') as 'DIGITOVER' | 'DIGITUNDER') ||
      'DIGITOVER'
  );
  const [hackerVirtualStats, setHackerVirtualStats] = useState({ wins: 0, losses: 0 });
  const [hackerTradesCount, setHackerTradesCount] = useState(0);
  const [hackerWinsCount, setHackerWinsCount] = useState(0);
  const [hackerLossesCount, setHackerLossesCount] = useState(0);
  const [hackerSessionProfit, setHackerSessionProfit] = useState(0);
  const [hackerLogs, setHackerLogs] = useState<string[]>([]);
  const [hackerMarketDigits, setHackerMarketDigits] = useState<Record<string, number[]>>({});
  const [hackerMathSummaries, setHackerMathSummaries] = useState<
    Record<string, HackerMathSummary>
  >({});
  const [hackerSelectedMathSymbol, setHackerSelectedMathSymbol] = useState<string>('1HZ10V');

  const hackerMathEnginesRef = useRef<
    Record<
      string,
      {
        ingestion: IngestionBuffer;
        solver: MathReconstructionSolver;
        generator: ShadowGenerator;
        evaluator: AccuracyEvaluator;
        lastPred: ShadowPrediction | null;
      }
    >
  >({});
  const hackerSocketRef = useRef<WebSocket | null>(null);
  const hackerDigitsRef = useRef<Record<string, number[]>>({});
  const hackerIsExecutingRef = useRef(false);
  const hackerTradesCountRef = useRef(0);
  const hackerWinsCountRef = useRef(0);
  const hackerMaxTradesRef = useRef(5);
  const hackerStakeRef = useRef(0.5);
  const hackerCurrentStakeRef = useRef(0.5);
  const hackerMartingaleMultRef = useRef(2.1);
  const hackerMartingaleAfterLossesRef = useRef(1);
  const hackerDurationTicksRef = useRef(1);
  const hackerConsecutiveLossesRef = useRef(0);
  const hackerScanningRef = useRef(false);
  const hackerVirtualModeRef = useRef(false);
  const hackerVirtualLossesRef = useRef(1);
  const hackerAutoRestartWinRef = useRef(false);
  const hackerSameMarketRecoveryRef = useRef(false);
  const hackerContinuousSameMarketRef = useRef(false);
  const hackerLockedMarketRef = useRef<string | null>(null);
  const hasTriggeredRealTradeForLockedMarketRef = useRef(false);
  const hackerRecoveryContractRef = useRef<'DIGITOVER' | 'DIGITUNDER'>('DIGITOVER');
  const hackerConsecutiveVirtualLossesRef = useRef(0);

  const addHackerLog = (msg: string) => {
    setHackerLogs((prev) => [...prev, msg].slice(-100));
  };

  useEffect(() => {
    onScanningChange(hackerScanning);
  }, [hackerScanning, onScanningChange]);

  // Strict Virtual Token Gating
  useEffect(() => {
    if (!hasVirtualToken) {
      if (hackerVirtualMode) setHackerVirtualMode(false);
      if (hackerAutoRestartWin) setHackerAutoRestartWin(false);
      hackerVirtualModeRef.current = false;
      hackerAutoRestartWinRef.current = false;
    }
  }, [hasVirtualToken, hackerVirtualMode, hackerAutoRestartWin]);

  useEffect(() => {
    localStorage.setItem('hacker_stake', hackerStake.toString());
    hackerStakeRef.current = hackerStake;
    if (!hackerScanningRef.current) {
      hackerCurrentStakeRef.current = hackerStake;
    }
  }, [hackerStake]);

  useEffect(() => {
    localStorage.setItem('hacker_martingale_mult', hackerMartingaleMultiplier.toString());
    hackerMartingaleMultRef.current = hackerMartingaleMultiplier;
  }, [hackerMartingaleMultiplier]);

  useEffect(() => {
    localStorage.setItem(
      'hacker_martingale_after_losses',
      hackerMartingaleAfterLosses.toString()
    );
    hackerMartingaleAfterLossesRef.current = hackerMartingaleAfterLosses;
  }, [hackerMartingaleAfterLosses]);

  useEffect(() => {
    localStorage.setItem('hacker_duration_ticks', hackerDurationTicks.toString());
    hackerDurationTicksRef.current = hackerDurationTicks;
  }, [hackerDurationTicks]);

  useEffect(() => {
    localStorage.setItem('hacker_max_trades', hackerMaxTrades.toString());
    hackerMaxTradesRef.current = hackerMaxTrades;
  }, [hackerMaxTrades]);

  useEffect(() => {
    localStorage.setItem('hacker_virtual_mode', hackerVirtualMode.toString());
    hackerVirtualModeRef.current = Boolean(hasVirtualToken && hackerVirtualMode);
  }, [hackerVirtualMode, hasVirtualToken]);

  useEffect(() => {
    localStorage.setItem('hacker_virtual_losses', hackerVirtualLosses.toString());
    hackerVirtualLossesRef.current = hackerVirtualLosses;
  }, [hackerVirtualLosses]);

  useEffect(() => {
    localStorage.setItem('hacker_auto_restart_win', hackerAutoRestartWin.toString());
    hackerAutoRestartWinRef.current = Boolean(hasVirtualToken && hackerAutoRestartWin);
  }, [hackerAutoRestartWin, hasVirtualToken]);

  useEffect(() => {
    localStorage.setItem('hacker_same_market_recovery', hackerSameMarketRecovery.toString());
    hackerSameMarketRecoveryRef.current = hackerSameMarketRecovery;
  }, [hackerSameMarketRecovery]);

  useEffect(() => {
    localStorage.setItem('hacker_continuous_same_market', hackerContinuousSameMarket.toString());
    hackerContinuousSameMarketRef.current = hackerContinuousSameMarket;
  }, [hackerContinuousSameMarket]);

  useEffect(() => {
    localStorage.setItem('hacker_recovery_contract', hackerRecoveryContract);
    hackerRecoveryContractRef.current = hackerRecoveryContract;
  }, [hackerRecoveryContract]);

  const toggleHackerAutoRestartWin = (enable: boolean) => {
    if (!hasVirtualToken) return;
    setHackerAutoRestartWin(enable);
    hackerAutoRestartWinRef.current = enable;
    if (enable) {
      setHackerVirtualMode(true);
      hackerVirtualModeRef.current = true;
      setHackerVirtualLosses(1);
      hackerVirtualLossesRef.current = 1;
    }
  };

  const stopHackerScanner = (reasonArg?: string | React.MouseEvent) => {
    const reason = typeof reasonArg === 'string' ? reasonArg : 'stopped by user';
    setHackerScanning(false);
    hackerScanningRef.current = false;
    hackerIsExecutingRef.current = false;
    hackerConsecutiveVirtualLossesRef.current = 0;
    hackerLockedMarketRef.current = null;
    hasTriggeredRealTradeForLockedMarketRef.current = false;
    if (reason === 'stopped by user') {
      hackerConsecutiveLossesRef.current = 0;
      hackerCurrentStakeRef.current = hackerStakeRef.current;
    }
    if (hackerSocketRef.current) {
      hackerSocketRef.current.close();
      hackerSocketRef.current = null;
    }
    addHackerLog(`[SYS] Scanner ${reason}.`);
  };

  const executeTradeViaApi = async (params: {
    sym: string;
    contractType: 'DIGITUNDER' | 'DIGITOVER';
    barrier: number;
    stake: number;
    isVirtual: boolean;
  }): Promise<{ won: boolean; profit: number }> => {
    const durationTicks = Math.max(1, Math.min(10, hackerDurationTicksRef.current || 1));
    // Hardcoded $0.35 stake when executing on Virtual Mode API account
    const effectiveStake = params.isVirtual ? 0.35 : params.stake;
    const res = await fetch('/api/autobot/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: params.sym,
        contractType: params.contractType === 'DIGITUNDER' ? 'digitunder' : 'digitover',
        prediction: params.barrier,
        stake: effectiveStake,
        duration: durationTicks,
        isVirtual: params.isVirtual,
        strategyName: params.isVirtual
          ? `AI Hacker Virtual (${params.contractType} ${params.barrier})`
          : `AI Market Hacker (${params.contractType} ${params.barrier})`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Trade execution failed.');
    }
    return {
      won: Boolean(data.won),
      profit: Number(data.profit || 0),
    };
  };

  const handleRealTradeSequence = async (
    sym: string,
    contractType: 'DIGITUNDER' | 'DIGITOVER',
    barrier: number,
    stake: number
  ) => {
    try {
      const outcome = await executeTradeViaApi({
        sym,
        contractType,
        barrier,
        stake,
        isVirtual: false,
      });

      if (!hackerScanningRef.current) return;

      const profitVal = outcome.profit;
      setHackerSessionProfit((prev) => prev + profitVal);
      setHackerTradesCount((prev) => {
        const nextCount = prev + 1;
        hackerTradesCountRef.current = nextCount;
        return nextCount;
      });

      if (outcome.won) {
        hackerConsecutiveLossesRef.current = 0;
        hackerCurrentStakeRef.current = hackerStakeRef.current;

        const nextWins = hackerWinsCountRef.current + 1;
        hackerWinsCountRef.current = nextWins;
        setHackerWinsCount(nextWins);

        addHackerLog(
          `[RESULT] ${sym} ${contractType} ${barrier} -> WIN +$${profitVal.toFixed(
            2
          )} (Stake reset to $${hackerStakeRef.current.toFixed(2)})`
        );

        const targetWins = hackerMaxTradesRef.current;
        if (targetWins > 0 && nextWins >= targetWins) {
          addHackerLog(
            `[TARGET REACHED] Target of ${targetWins} winning run(s) achieved! (${nextWins}/${targetWins}) Auto-stopping scanner.`
          );
          stopHackerScanner('target reached');
          return;
        }
      } else {
        const newLosses = hackerConsecutiveLossesRef.current + 1;
        hackerConsecutiveLossesRef.current = newLosses;
        setHackerLossesCount((prev) => prev + 1);

        const afterLossesThreshold = hackerMartingaleAfterLossesRef.current || 1;
        const multiplier = hackerMartingaleMultRef.current;

        if (newLosses >= afterLossesThreshold && multiplier > 1) {
          const effectiveLossSteps = newLosses - afterLossesThreshold + 1;
          const nextStake = parseFloat(
            (hackerStakeRef.current * Math.pow(multiplier, effectiveLossSteps)).toFixed(2)
          );
          hackerCurrentStakeRef.current = nextStake;
          addHackerLog(
            `[RESULT] ${sym} ${contractType} ${barrier} -> LOSS -$${Math.abs(profitVal).toFixed(
              2
            )} | Loss #${newLosses}: Martingale (${multiplier}x, Level ${effectiveLossSteps}) -> Next Stake: $${nextStake.toFixed(
              2
            )}`
          );
        } else {
          hackerCurrentStakeRef.current = hackerStakeRef.current;
          addHackerLog(
            `[RESULT] ${sym} ${contractType} ${barrier} -> LOSS -$${Math.abs(profitVal).toFixed(
              2
            )} | Loss #${newLosses}/${afterLossesThreshold} -> Next Stake: $${hackerCurrentStakeRef.current.toFixed(
              2
            )}`
          );
        }

        if (
          (hackerContinuousSameMarketRef.current || hackerSameMarketRecoveryRef.current) &&
          hackerScanningRef.current
        ) {
          const recContract: 'DIGITOVER' | 'DIGITUNDER' = hackerSameMarketRecoveryRef.current
            ? hackerRecoveryContractRef.current === 'DIGITUNDER'
              ? 'DIGITUNDER'
              : 'DIGITOVER'
            : contractType;
          const recBarrier = recContract === 'DIGITUNDER' ? 8 : 1;
          hasTriggeredRealTradeForLockedMarketRef.current = true;
          if (hackerContinuousSameMarketRef.current) {
            hackerLockedMarketRef.current = sym;
          }
          addHackerLog(
            `[FAST MARTINGALE RECOVERY] Immediate recovery triggered on ${sym} -> Purchasing REAL ${recContract} ${recBarrier} @ $${hackerCurrentStakeRef.current.toFixed(
              2
            )}...`
          );
          if (hackerScanningRef.current) {
            void handleRealTradeSequence(
              sym,
              recContract,
              recBarrier,
              hackerCurrentStakeRef.current
            );
          }
          return;
        }
      }

      const postTradeDelay = hackerContinuousSameMarketRef.current ? 0 : 800;
      const finishPostTrade = () => {
        if (hackerScanningRef.current) {
          hackerIsExecutingRef.current = false;
          if (hackerContinuousSameMarketRef.current && hackerLockedMarketRef.current) {
            addHackerLog(
              `[CONTINUOUS SAME MARKET] Trade on ${hackerLockedMarketRef.current} completed. Scanner remaining locked on ${hackerLockedMarketRef.current}...`
            );
          } else {
            hackerLockedMarketRef.current = null;
            addHackerLog('[SCAN] Resuming multi-market scanning across all 10 markets...');
          }
        }
      };
      if (postTradeDelay === 0) {
        finishPostTrade();
      } else {
        setTimeout(finishPostTrade, postTradeDelay);
      }
    } catch (err: any) {
      addHackerLog(`[ERROR] Trade execution failed: ${err?.message || err}`);
      hackerIsExecutingRef.current = false;
    }
  };

  const handleVirtualThenRealSequence = async (params: {
    sym: string;
    virtualContractType: 'DIGITUNDER' | 'DIGITOVER';
    virtualBarrier: number;
    realContractType: 'DIGITUNDER' | 'DIGITOVER';
    realBarrier: number;
    targetVirtualLosses: number;
  }) => {
    try {
      while (hackerScanningRef.current) {
        const outcome = await executeTradeViaApi({
          sym: params.sym,
          contractType: params.virtualContractType,
          barrier: params.virtualBarrier,
          stake: 0.35,
          isVirtual: true,
        });

        if (!hackerScanningRef.current) return;

        if (outcome.won) {
          hackerConsecutiveVirtualLossesRef.current = 0;
          setHackerVirtualStats((prev) => ({ ...prev, wins: prev.wins + 1 }));
          addHackerLog(
            `[VIRTUAL WIN @ $0.35] ${params.sym} (${params.virtualContractType} ${params.virtualBarrier}) -> VIRTUAL WIN +$${outcome.profit.toFixed(
              2
            )} | Consecutive Virtual Losses reset to 0/${params.targetVirtualLosses}`
          );

          if (hackerAutoRestartWinRef.current) {
            addHackerLog(
              '[AUTO-RESTART ON VIRTUAL WIN] Opposite virtual trade was a WIN! Restarting scanner for a virtual LOSS...'
            );
            hackerIsExecutingRef.current = false;
            stopHackerScanner('auto-restart on virtual win');
            setTimeout(() => {
              startHackerScanner();
            }, 500);
            return;
          }
        } else {
          const nextLosses = hackerConsecutiveVirtualLossesRef.current + 1;
          hackerConsecutiveVirtualLossesRef.current = nextLosses;
          setHackerVirtualStats((prev) => ({ ...prev, losses: prev.losses + 1 }));
          addHackerLog(
            `[VIRTUAL LOSS] ${params.sym} (${params.virtualContractType} ${params.virtualBarrier}) -> VIRTUAL LOSS #${nextLosses}/${params.targetVirtualLosses}`
          );

          if (nextLosses >= params.targetVirtualLosses) {
            addHackerLog(
              `[VIRTUAL THRESHOLD MET] Reached ${params.targetVirtualLosses} virtual loss(es)! Placing REAL ${params.realContractType} ${params.realBarrier} on ${params.sym} @ $${hackerCurrentStakeRef.current.toFixed(
                2
              )}...`
            );
            hackerConsecutiveVirtualLossesRef.current = 0;
            hasTriggeredRealTradeForLockedMarketRef.current = true;
            await handleRealTradeSequence(
              params.sym,
              params.realContractType,
              params.realBarrier,
              hackerCurrentStakeRef.current
            );
            return;
          }
        }
      }
    } catch (err: any) {
      addHackerLog(`[ERROR] Virtual execution failed: ${err?.message || err}`);
      hackerIsExecutingRef.current = false;
    }
  };

  const startHackerScanner = () => {
    if (!connected) {
      onNotifyError('Connect your Deriv Real/Demo API token via Deriv API Connection first.');
      return;
    }

    setHackerScanning(true);
    hackerScanningRef.current = true;
    setHackerTradesCount(0);
    setHackerWinsCount(0);
    setHackerLossesCount(0);
    setHackerSessionProfit(0);
    setHackerVirtualStats({ wins: 0, losses: 0 });
    hackerTradesCountRef.current = 0;
    hackerWinsCountRef.current = 0;
    hackerMaxTradesRef.current = hackerMaxTrades;
    hackerStakeRef.current = hackerStake;
    if (hackerConsecutiveLossesRef.current === 0) {
      hackerCurrentStakeRef.current = hackerStake;
    }
    hackerMartingaleMultRef.current = hackerMartingaleMultiplier;
    hackerMartingaleAfterLossesRef.current = hackerMartingaleAfterLosses;
    hackerDurationTicksRef.current = hackerDurationTicks;
    hackerVirtualModeRef.current = Boolean(hasVirtualToken && hackerVirtualMode);
    hackerVirtualLossesRef.current = hackerVirtualLosses;
    hackerAutoRestartWinRef.current = Boolean(hasVirtualToken && hackerAutoRestartWin);
    hackerSameMarketRecoveryRef.current = hackerSameMarketRecovery;
    hackerContinuousSameMarketRef.current = hackerContinuousSameMarket;
    hackerRecoveryContractRef.current = hackerRecoveryContract;
    hackerIsExecutingRef.current = false;
    hackerConsecutiveVirtualLossesRef.current = 0;
    hackerLockedMarketRef.current = null;
    hasTriggeredRealTradeForLockedMarketRef.current = false;

    addHackerLog('[SYS] Authenticating at market matrix...');
    addHackerLog('[SYS] Synthetic stream linked (10 Volatility Markets)');
    addHackerLog('[SCAN] Initializing 100-tick historical buffer...');
    addHackerLog(
      `[SYS] Stake: $${hackerStake.toFixed(
        2
      )} | Duration: ${hackerDurationTicks} tick(s) | Target Wins (Runs): ${hackerMaxTrades} | Martingale: ${hackerMartingaleMultiplier}x after ${hackerMartingaleAfterLosses} loss(es)`
    );
    if (hasVirtualToken && hackerVirtualMode) {
      addHackerLog(
        `[VIRTUAL MANAGER] Virtual Switch: ENABLED (Opposite Direction - Target Virtual Losses: ${hackerVirtualLosses})`
      );
      if (hackerAutoRestartWin) {
        addHackerLog('[AUTO-RESTART MANAGER] Auto-Restart on Virtual Win: ACTIVE');
      }
    }
    if (hackerSameMarketRecovery) {
      addHackerLog(
        `[SAME MARKET RECOVERY] Active: Immediate recovery on loss market using ${
          hackerRecoveryContract === 'DIGITOVER' ? 'Over 1' : 'Under 8'
        }`
      );
    }
    if (hackerContinuousSameMarket) {
      addHackerLog(
        '[CONTINUOUS SAME MARKET] Active: Scanner locks onto signal market for continuous same-market trades.'
      );
    }
    addHackerLog('[OK] AI Market Hacker High-Precision 4-Layer Math Filter armed');

    if (hackerSocketRef.current) {
      hackerSocketRef.current.close();
    }

    const ws = new WebSocket(
      'wss://api.derivws.com/trading/v1/options/ws/public?app_id=34SRQBBtI5nwEFQqmc3se'
    );
    hackerSocketRef.current = ws;

    ws.onopen = () => {
      VOLATILITY_10_MARKETS.forEach((m) => {
        hackerDigitsRef.current[m] = [];
        ws.send(
          JSON.stringify({
            ticks_history: m,
            count: 100,
            end: 'latest',
            style: 'ticks',
          })
        );
        ws.send(JSON.stringify({ ticks: m, subscribe: 1 }));
      });
    };

    ws.onmessage = (event) => {
      if (!hackerScanningRef.current) return;
      const data = JSON.parse(event.data);

      if (data.msg_type === 'history' && data.echo_req?.ticks_history) {
        const sym = data.echo_req.ticks_history;
        const prices = data.history?.prices || [];
        const precision = getSymbolDecimals(sym);
        const digits = prices.map((p: number) => {
          const sPrice = p.toFixed(precision);
          return parseInt(sPrice[sPrice.length - 1], 10);
        });
        hackerDigitsRef.current[sym] = digits.slice(-100);
        setHackerMarketDigits((prev) => ({ ...prev, [sym]: hackerDigitsRef.current[sym] }));

        if (!hackerMathEnginesRef.current[sym]) {
          const ingestion = new IngestionBuffer(1000);
          const solver = new MathReconstructionSolver();
          const generator = new ShadowGenerator(solver);
          const evaluator = new AccuracyEvaluator();
          hackerMathEnginesRef.current[sym] = {
            ingestion,
            solver,
            generator,
            evaluator,
            lastPred: null,
          };
        }
        const engine = hackerMathEnginesRef.current[sym];
        digits.forEach((d: number) => engine.ingestion.push(d));
        engine.solver.fit(engine.ingestion.getAll());
        if (digits.length > 0) {
          engine.lastPred = engine.generator.predictNext(digits[digits.length - 1]);
        }
        const report = engine.evaluator.getReport();
        if (engine.lastPred) {
          setHackerMathSummaries((prev) => ({
            ...prev,
            [sym]: {
              symbol: sym,
              isDeterministic: engine.solver.isDeterministic,
              lcgParams: engine.solver.lcgParams,
              topPrediction: engine.lastPred!.topPrediction,
              confidence: engine.lastPred!.confidence,
              top3Predictions: engine.lastPred!.top3Predictions,
              probabilities: engine.lastPred!.probabilities,
              totalEvaluated: report.totalEvaluated,
              exactAccuracyPct: report.exactMatchAccuracyPct,
              top3AccuracyPct: report.top3MatchAccuracyPct,
              mae: report.meanAbsoluteError,
            },
          }));
        }
      }

      if (data.msg_type === 'tick' && data.tick) {
        const sym = data.tick.symbol;
        if (!VOLATILITY_10_MARKETS.includes(sym)) return;
        if (
          hackerContinuousSameMarketRef.current &&
          hackerLockedMarketRef.current &&
          sym !== hackerLockedMarketRef.current
        ) {
          return;
        }
        const quote = Number(data.tick.quote);
        const precision = getSymbolDecimals(sym);
        const digit = parseInt(quote.toFixed(precision).slice(-1), 10);

        if (!hackerDigitsRef.current[sym]) hackerDigitsRef.current[sym] = [];
        const history = [...hackerDigitsRef.current[sym], digit].slice(-100);
        hackerDigitsRef.current[sym] = history;
        setHackerMarketDigits((prev) => ({ ...prev, [sym]: history }));

        if (!hackerMathEnginesRef.current[sym]) {
          const ingestion = new IngestionBuffer(1000);
          const solver = new MathReconstructionSolver();
          const generator = new ShadowGenerator(solver);
          const evaluator = new AccuracyEvaluator();
          hackerMathEnginesRef.current[sym] = {
            ingestion,
            solver,
            generator,
            evaluator,
            lastPred: null,
          };
        }
        const mathEngine = hackerMathEnginesRef.current[sym];
        if (mathEngine.lastPred) {
          mathEngine.evaluator.evaluate(digit, mathEngine.lastPred);
        }
        mathEngine.ingestion.push(digit);
        mathEngine.solver.fit(mathEngine.ingestion.getAll());
        const nextPred = mathEngine.generator.predictNext(digit);
        mathEngine.lastPred = nextPred;

        const report = mathEngine.evaluator.getReport();
        setHackerMathSummaries((prev) => ({
          ...prev,
          [sym]: {
            symbol: sym,
            isDeterministic: mathEngine.solver.isDeterministic,
            lcgParams: mathEngine.solver.lcgParams,
            topPrediction: nextPred.topPrediction,
            confidence: nextPred.confidence,
            top3Predictions: nextPred.top3Predictions,
            probabilities: nextPred.probabilities,
            totalEvaluated: report.totalEvaluated,
            exactAccuracyPct: report.exactMatchAccuracyPct,
            top3AccuracyPct: report.top3MatchAccuracyPct,
            mae: report.meanAbsoluteError,
          },
        }));

        const last4 = history.slice(-4);
        const last3 = history.slice(-3);

        if (history.length >= 20 && !hackerIsExecutingRef.current) {
          const probs = nextPred ? nextPred.probabilities : Array(10).fill(0.1);
          const pWinOver1 = probs.slice(2, 10).reduce((sum, p) => sum + p, 0);
          const pWinUnder8 = probs.slice(0, 8).reduce((sum, p) => sum + p, 0);

          const layer1Over1Pass = pWinOver1 >= 0.8;
          const layer1Under8Pass = pWinUnder8 >= 0.8;

          const layer2Over1Pass =
            last3.every((d) => d >= 2) && (digit === 2 || digit === 3 || digit === 4);
          const layer2Under8Pass =
            last3.every((d) => d <= 7) && (digit === 7 || digit === 6 || digit === 5);

          const trapCountOver1 = last4.filter((d) => d === 0 || d === 1).length;
          const trapCountUnder8 = last4.filter((d) => d === 8 || d === 9).length;

          const layer3Over1Pass = trapCountOver1 === 0;
          const layer3Under8Pass = trapCountUnder8 === 0;

          const layer4Over1Pass =
            !nextPred || (nextPred.topPrediction !== 0 && nextPred.topPrediction !== 1);
          const layer4Under8Pass =
            !nextPred || (nextPred.topPrediction !== 8 && nextPred.topPrediction !== 9);

          const over1Condition =
            layer1Over1Pass && layer2Over1Pass && layer3Over1Pass && layer4Over1Pass;
          const under8Condition =
            layer1Under8Pass && layer2Under8Pass && layer3Under8Pass && layer4Under8Pass;

          if (under8Condition || over1Condition) {
            const signalType = over1Condition ? 'OVER 1' : 'UNDER 8';
            const realContractType: 'DIGITOVER' | 'DIGITUNDER' = over1Condition
              ? 'DIGITOVER'
              : 'DIGITUNDER';
            const realBarrier = over1Condition ? 1 : 8;
            const virtualContractType: 'DIGITOVER' | 'DIGITUNDER' = over1Condition
              ? 'DIGITUNDER'
              : 'DIGITOVER';
            const virtualBarrier = over1Condition ? 8 : 1;

            const winProbPct = over1Condition
              ? (pWinOver1 * 100).toFixed(1)
              : (pWinUnder8 * 100).toFixed(1);
            const predDigit = nextPred ? nextPred.topPrediction : 'N/A';
            const predConf = nextPred ? (nextPred.confidence * 100).toFixed(1) : 'N/A';

            hackerIsExecutingRef.current = true;
            if (hackerContinuousSameMarketRef.current && !hackerLockedMarketRef.current) {
              hackerLockedMarketRef.current = sym;
              addHackerLog(
                `[SAME MARKET LOCK] Signal confirmed on ${sym}. Locked for continuous same-market trades.`
              );
            }
            addHackerLog(
              `[SIGNAL CONFIRMED] ${sym} matched 4-Layer Math Filter -> ${signalType} (L1 P(Win): ${winProbPct}%, L2 Trig: ${digit}, L3 Trap: 0/4, L4 Pred: ${predDigit} @ ${predConf}%)`
            );

            if (
              hasVirtualToken &&
              hackerVirtualModeRef.current &&
              (!hackerContinuousSameMarketRef.current ||
                !hasTriggeredRealTradeForLockedMarketRef.current)
            ) {
              addHackerLog(
                `[VIRTUAL SWITCH ACTIVE] Executing Virtual ${virtualContractType} ${virtualBarrier} on ${sym} (Target: ${hackerVirtualLossesRef.current} virtual loss(es))...`
              );
              handleVirtualThenRealSequence({
                sym,
                virtualContractType,
                virtualBarrier,
                realContractType,
                realBarrier,
                targetVirtualLosses: hackerVirtualLossesRef.current,
              });
            } else {
              hasTriggeredRealTradeForLockedMarketRef.current = true;
              addHackerLog(
                `[EXECUTE REAL TRADE] Purchasing REAL ${realContractType} (Barrier ${realBarrier}) on ${sym} @ $${hackerCurrentStakeRef.current.toFixed(
                  2
                )}...`
              );
              handleRealTradeSequence(
                sym,
                realContractType,
                realBarrier,
                hackerCurrentStakeRef.current
              );
            }
          } else if (
            hackerContinuousSameMarketRef.current &&
            hackerLockedMarketRef.current === sym
          ) {
            const isOver = trapCountOver1 === 0 && pWinOver1 >= pWinUnder8;
            const isUnder = trapCountUnder8 === 0 && pWinUnder8 > pWinOver1;
            if (isOver || isUnder) {
              const realContractType: 'DIGITOVER' | 'DIGITUNDER' = isOver
                ? 'DIGITOVER'
                : 'DIGITUNDER';
              const realBarrier = isOver ? 1 : 8;
              const virtualContractType: 'DIGITOVER' | 'DIGITUNDER' = isOver
                ? 'DIGITUNDER'
                : 'DIGITOVER';
              const virtualBarrier = isOver ? 8 : 1;

              hackerIsExecutingRef.current = true;
              if (
                hasVirtualToken &&
                hackerVirtualModeRef.current &&
                !hasTriggeredRealTradeForLockedMarketRef.current
              ) {
                addHackerLog(
                  `[CONTINUOUS VIRTUAL SESSION] Taking Virtual ${virtualContractType} ${virtualBarrier} on ${sym}...`
                );
                handleVirtualThenRealSequence({
                  sym,
                  virtualContractType,
                  virtualBarrier,
                  realContractType,
                  realBarrier,
                  targetVirtualLosses: hackerVirtualLossesRef.current,
                });
              } else {
                hasTriggeredRealTradeForLockedMarketRef.current = true;
                addHackerLog(
                  `[CONTINUOUS REAL TRADE] Purchasing REAL ${realContractType} ${realBarrier} on locked market ${sym} @ $${hackerCurrentStakeRef.current.toFixed(
                    2
                  )}...`
                );
                handleRealTradeSequence(
                  sym,
                  realContractType,
                  realBarrier,
                  hackerCurrentStakeRef.current
                );
              }
            }
          }
        }
      }
    };

    ws.onerror = () => {
      addHackerLog('[ERROR] Scanner WebSocket error.');
    };
  };

  useEffect(() => {
    return () => {
      if (hackerSocketRef.current) {
        hackerSocketRef.current.close();
      }
    };
  }, []);

  const summary = useMemo(
    () => hackerMathSummaries[hackerSelectedMathSymbol],
    [hackerMathSummaries, hackerSelectedMathSymbol]
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xl overflow-hidden overscroll-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-4xl h-[88vh] max-h-[760px] bg-[#111217] rounded-3xl border border-violet-500/30 p-4 sm:p-8 flex flex-col shadow-2xl relative overflow-hidden overscroll-contain"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/30">
                  <Zap size={22} className="text-violet-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tight">AI MARKET HACKER</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    10 Volatilities Multi-Market Digit Scanner &amp; Execution Engine
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {/* Left Panel: Configuration & Stats */}
              <div className="space-y-4">
                <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-white/5 space-y-3">
                  <h3 className="text-xs font-black uppercase text-violet-400 tracking-widest">
                    Scanner Configuration
                  </h3>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Trade Stake ($)
                    </label>
                    <input
                      type="number"
                      min="0.35"
                      step="0.01"
                      value={hackerStake}
                      onChange={(e) => setHackerStake(parseFloat(e.target.value) || 0.5)}
                      disabled={hackerScanning}
                      className="w-full bg-[#161821] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      No. of Runs in Wins (Target Wins)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={hackerMaxTrades}
                      onChange={(e) => setHackerMaxTrades(parseInt(e.target.value, 10) || 1)}
                      disabled={hackerScanning}
                      className="w-full bg-[#161821] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        Duration (Ticks)
                      </label>
                      <span className="text-[10px] font-mono font-bold text-violet-400">
                        {hackerDurationTicks} {hackerDurationTicks === 1 ? 'tick' : 'ticks'}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      value={hackerDurationTicks}
                      onChange={(e) =>
                        setHackerDurationTicks(
                          Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1))
                        )
                      }
                      disabled={hackerScanning}
                      className="w-full bg-[#161821] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    />
                    <span className="text-[9px] text-slate-500 mt-1 block">
                      Contract duration in ticks (1 to 10 ticks)
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Martingale Multiplier
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={hackerMartingaleMultiplier}
                      onChange={(e) =>
                        setHackerMartingaleMultiplier(parseFloat(e.target.value) || 2.1)
                      }
                      disabled={hackerScanning}
                      className="w-full bg-[#161821] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Martingale After Losses
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={hackerMartingaleAfterLosses}
                      onChange={(e) =>
                        setHackerMartingaleAfterLosses(parseInt(e.target.value, 10) || 1)
                      }
                      disabled={hackerScanning}
                      className="w-full bg-[#161821] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Virtual Switch (Strictly gated by hasVirtualToken from Deriv API Connection) */}
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    {hasVirtualToken && (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-black uppercase text-violet-400 tracking-wider block">
                              Virtual Switch (Opposite Direction)
                            </label>
                            <span className="text-[9px] text-slate-400 font-medium block">
                              Execute opposite-direction virtual trades before real contract
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHackerVirtualMode(!hackerVirtualMode)}
                            disabled={hackerScanning}
                            className={cn(
                              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                              hackerVirtualMode ? 'bg-violet-600' : 'bg-slate-700',
                              hackerScanning && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <span
                              className={cn(
                                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                hackerVirtualMode ? 'translate-x-5' : 'translate-x-0'
                              )}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <div>
                            <label className="text-xs font-black uppercase text-amber-400 tracking-wider block">
                              Auto-Restart on Virtual Win
                            </label>
                            <span className="text-[9px] text-slate-400 font-medium block">
                              Forces Loss Target = 1 &amp; Virtual Switch = ON. Auto-restarts if
                              opposite virtual trade wins until virtual loss occurs.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleHackerAutoRestartWin(!hackerAutoRestartWin)}
                            disabled={hackerScanning}
                            className={cn(
                              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                              hackerAutoRestartWin ? 'bg-amber-500' : 'bg-slate-700',
                              hackerScanning && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <span
                              className={cn(
                                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                hackerAutoRestartWin ? 'translate-x-5' : 'translate-x-0'
                              )}
                            />
                          </button>
                        </div>

                        {hackerVirtualMode && (
                          <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20 space-y-1.5">
                            <label className="text-[10px] font-bold text-violet-300 uppercase tracking-widest block">
                              Virtual Losses Target
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={hackerVirtualLosses}
                              onChange={(e) =>
                                setHackerVirtualLosses(Math.max(1, parseInt(e.target.value, 10) || 1))
                              }
                              disabled={hackerScanning || hackerAutoRestartWin}
                              className="w-full bg-[#161821] border border-violet-500/30 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-violet-400 disabled:opacity-50"
                            />
                            <span className="text-[9px] text-violet-300/80 font-medium block">
                              Takes opposite virtual trades (e.g. Under 8 if AI finds Over 1). After{' '}
                              {hackerVirtualLosses} virtual loss(es), places the REAL contract.
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Same Market Direct Recovery Switch */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-black uppercase text-cyan-400 tracking-wider block">
                            Same Market Direct Recovery
                          </label>
                          <span className="text-[9px] text-slate-400 font-medium block">
                            On real loss, recover immediately on the same market.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHackerSameMarketRecovery(!hackerSameMarketRecovery)}
                          disabled={hackerScanning}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                            hackerSameMarketRecovery ? 'bg-cyan-500' : 'bg-slate-700',
                            hackerScanning && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              hackerSameMarketRecovery ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>

                      {hackerSameMarketRecovery && (
                        <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 space-y-2">
                          <label className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest block">
                            Recovery Contract Type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setHackerRecoveryContract('DIGITOVER')}
                              disabled={hackerScanning}
                              className={cn(
                                'py-1.5 px-3 rounded-lg text-xs font-black transition-all border flex items-center justify-center gap-1 cursor-pointer',
                                hackerRecoveryContract === 'DIGITOVER'
                                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                                  : 'bg-[#161821] text-slate-400 border-white/10 hover:border-white/20'
                              )}
                            >
                              OVER 1
                            </button>
                            <button
                              type="button"
                              onClick={() => setHackerRecoveryContract('DIGITUNDER')}
                              disabled={hackerScanning}
                              className={cn(
                                'py-1.5 px-3 rounded-lg text-xs font-black transition-all border flex items-center justify-center gap-1 cursor-pointer',
                                hackerRecoveryContract === 'DIGITUNDER'
                                  ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                                  : 'bg-[#161821] text-slate-400 border-white/10 hover:border-white/20'
                              )}
                            >
                              UNDER 8
                            </button>
                          </div>
                          <span className="text-[9px] text-cyan-300/80 font-medium block">
                            After a loss, immediately places a recovery trade on the same market
                            using {hackerRecoveryContract === 'DIGITOVER' ? 'Over 1' : 'Under 8'}{' '}
                            with martingale stake.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Continuous Same Market Trading Switch */}
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-black uppercase text-emerald-400 tracking-wider block flex items-center gap-1.5">
                            <Zap size={14} className="text-emerald-400" />
                            <span>Continuous Trading After Signal (Same Market)</span>
                          </label>
                          <span className="text-[9px] text-slate-400 font-medium block">
                            Lock onto signal market and trade continuously on the same market.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setHackerContinuousSameMarket(!hackerContinuousSameMarket)
                          }
                          disabled={hackerScanning}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                            hackerContinuousSameMarket ? 'bg-emerald-500' : 'bg-slate-700',
                            hackerScanning && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                              hackerContinuousSameMarket ? 'translate-x-5' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>

                      {hackerContinuousSameMarket && (
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[9px] text-emerald-300 font-medium">
                          <strong>Continuous Real Trading Active:</strong> Once the initial signal
                          triggers the first REAL trade, the bot stays locked on that market for
                          continuous execution with fast martingale recovery on loss.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Performance */}
                <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-white/5 space-y-3">
                  <h3 className="text-xs font-black uppercase text-violet-400 tracking-widest flex items-center justify-between flex-wrap gap-1">
                    <span>Session Performance</span>
                    {hasVirtualToken && hackerVirtualMode && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        VIRTUAL{' '}
                        {hackerAutoRestartWin
                          ? 'AUTO-RESTART ON WIN'
                          : `OPPOSITE (${hackerVirtualLosses} Loss Target)`}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white/5 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 block">REAL TRADES</span>
                      <span className="text-base font-black text-white tabular-nums">
                        {hackerTradesCount}
                      </span>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                      <span className="text-[9px] font-bold text-emerald-400 block">
                        WINS / GOAL
                      </span>
                      <span className="text-base font-black text-emerald-400 tabular-nums">
                        {hackerWinsCount}{' '}
                        <span className="text-xs font-normal text-emerald-400/70">
                          / {hackerMaxTrades}
                        </span>
                      </span>
                    </div>
                    <div className="p-2 bg-rose-500/10 rounded-xl">
                      <span className="text-[9px] font-bold text-rose-400 block">REAL LOSSES</span>
                      <span className="text-base font-black text-rose-400 tabular-nums">
                        {hackerLossesCount}
                      </span>
                    </div>
                  </div>

                  {hasVirtualToken && hackerVirtualMode && (
                    <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-white/5">
                      <div className="p-1.5 bg-violet-500/10 rounded-xl border border-violet-500/20">
                        <span className="text-[8px] font-black text-violet-400 block">
                          VIRTUAL WINS
                        </span>
                        <span className="text-xs font-black text-violet-300 tabular-nums">
                          {hackerVirtualStats.wins}
                        </span>
                      </div>
                      <div className="p-1.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <span className="text-[8px] font-black text-amber-400 block">
                          VIRTUAL LOSSES
                        </span>
                        <span className="text-xs font-black text-amber-300 tabular-nums">
                          {hackerVirtualStats.losses}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Real Profit/Loss:
                    </span>
                    <span
                      className={cn(
                        'text-lg font-black tabular-nums',
                        hackerSessionProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      ${hackerSessionProfit >= 0 ? '+' : ''}
                      {hackerSessionProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {!hackerScanning ? (
                    <button
                      type="button"
                      onClick={startHackerScanner}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-lg shadow-violet-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play size={18} fill="currentColor" />
                      START HACKER SCANNER
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopHackerScanner}
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-2xl shadow-lg shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 animate-pulse cursor-pointer"
                    >
                      <Square size={18} fill="currentColor" />
                      STOP HACKER SCANNER
                    </button>
                  )}
                </div>
              </div>

              {/* Center & Right Panel */}
              <div className="md:col-span-2 flex flex-col gap-4">
                {/* Strategy Architecture Blueprint */}
                <div className="bg-[#0a0b0d] p-3.5 sm:p-4 rounded-2xl border border-violet-500/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-violet-400" />
                      <h3 className="text-xs font-black uppercase text-violet-400 tracking-widest">
                        High-Precision 4-Layer Math Strategy Blueprint
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                      {hackerDurationTicks}-Tick Duration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                      <span className="text-[9px] font-black uppercase text-emerald-400 block tracking-wider">
                        Layer 1: Real Binary P(Win)
                      </span>
                      <p className="text-slate-300 font-medium leading-tight text-[10px]">
                        Over 1: Markov P(Win) &ge; 80.0%
                        <br />
                        Under 8: Markov P(Win) &ge; 80.0%
                      </p>
                    </div>
                    <div className="p-2 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                      <span className="text-[9px] font-black uppercase text-indigo-400 block tracking-wider">
                        Layer 2: 3-Tick Binary Confirm
                      </span>
                      <p className="text-slate-300 font-medium leading-tight text-[10px]">
                        Over 1: 3t No 0,1 (Trig 2/3/4)
                        <br />
                        Under 8: 3t No 8,9 (Trig 7/6/5)
                      </p>
                    </div>
                    <div className="p-2 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                      <span className="text-[9px] font-black uppercase text-amber-400 block tracking-wider">
                        Layer 3: Zero Trap Filter
                      </span>
                      <p className="text-slate-300 font-medium leading-tight text-[10px]">
                        Zero losing digits [0,1] or [8,9]
                        <br />
                        in last 4 ticks
                      </p>
                    </div>
                    <div className="p-2 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                      <span className="text-[9px] font-black uppercase text-cyan-400 block tracking-wider">
                        Layer 4: Math Shadow Engine
                      </span>
                      <p className="text-slate-300 font-medium leading-tight text-[10px]">
                        Shadow Pred safe
                        <br />
                        (No 0,1 / No 8,9)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Core Math Reconstruction & Markov Shadow Generator Engine */}
                <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-indigo-500/20 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-indigo-400" />
                      <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">
                        Math Reconstruction &amp; Markov Shadow Generator Engine
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap overflow-x-auto">
                      {VOLATILITY_10_MARKETS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setHackerSelectedMathSymbol(s)}
                          className={cn(
                            'px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer',
                            hackerSelectedMathSymbol === s
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white/5 text-slate-400 hover:bg-white/10'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const marketDigits = hackerMarketDigits[hackerSelectedMathSymbol] || [];
                    const lastD =
                      marketDigits.length > 0 ? marketDigits[marketDigits.length - 1] : null;

                    if (!summary) {
                      return (
                        <div className="p-4 text-center text-slate-500 text-xs italic bg-[#161821] rounded-xl border border-white/5">
                          Math reconstruction solver standby. Start scanner to ingest synthetic
                          digit stream for {hackerSelectedMathSymbol}...
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-2.5 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 block">
                              Solver State
                            </span>
                            {summary.isDeterministic ? (
                              <span className="text-xs font-black text-emerald-400 block font-mono">
                                Linear LCG Solved <br />
                                <span className="text-[9px] text-emerald-300 font-bold">
                                  (x+1 = ({summary.lcgParams?.[0]}x + {summary.lcgParams?.[1]}) %
                                  10)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-black text-indigo-300 block font-mono">
                                1st-Order Markov <br />
                                <span className="text-[9px] font-medium text-slate-400">
                                  Empirical Solver
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="p-2.5 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 block">
                              Shadow Prediction
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-black text-sm font-mono">
                                {summary.topPrediction}
                              </span>
                              <div className="text-[9px] font-mono">
                                <span className="text-indigo-400 font-bold block">
                                  {(summary.confidence * 100).toFixed(1)}% Conf
                                </span>
                                <span className="text-slate-400">
                                  Top 3: [{summary.top3Predictions.join(', ')}]
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 block">
                              Accuracy Evaluator
                            </span>
                            <div className="text-[9px] font-mono space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Exact Match:</span>
                                <span className="text-emerald-400 font-bold">
                                  {summary.exactAccuracyPct.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Top-3 Match:</span>
                                <span className="text-indigo-400 font-bold">
                                  {summary.top3AccuracyPct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-2.5 bg-[#161821] rounded-xl border border-white/5 space-y-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 block">
                              Evaluated &amp; MAE
                            </span>
                            <div className="text-[9px] font-mono space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Evaluations:</span>
                                <span className="text-white font-bold">
                                  {summary.totalEvaluated}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Mean Abs Error:</span>
                                <span className="text-amber-400 font-bold">
                                  {summary.mae.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {lastD !== null &&
                          summary.probabilities &&
                          summary.probabilities.length === 10 && (
                            <div className="p-2.5 bg-[#161821] rounded-xl border border-white/5 space-y-1.5">
                              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                                <span>
                                  Markov Transition Profile (Current Digit:{' '}
                                  <strong className="text-white font-black">{lastD}</strong>)
                                </span>
                                <span>Predicted Probabilities for Next Digit (0-9)</span>
                              </div>
                              <div className="grid grid-cols-10 gap-1 text-center">
                                {summary.probabilities.map((prob, d) => (
                                  <div key={d} className="flex flex-col items-center gap-1">
                                    <div className="w-full bg-white/5 h-12 rounded relative flex items-end overflow-hidden">
                                      <div
                                        className={cn(
                                          'w-full transition-all duration-300 rounded-t',
                                          d === summary.topPrediction
                                            ? 'bg-indigo-500'
                                            : summary.top3Predictions.includes(d)
                                            ? 'bg-indigo-500/40'
                                            : 'bg-slate-700/40'
                                        )}
                                        style={{ height: `${Math.max(5, prob * 100)}%` }}
                                      />
                                    </div>
                                    <span
                                      className={cn(
                                        'text-[9px] font-black font-mono',
                                        d === summary.topPrediction
                                          ? 'text-indigo-400 font-bold'
                                          : 'text-slate-400'
                                      )}
                                    >
                                      {d}
                                    </span>
                                    <span className="text-[7px] text-slate-500 font-mono">
                                      {(prob * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  })()}
                </div>

                {/* 10 Volatilities Live Matrix */}
                <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-violet-400 tracking-widest">
                      10 Volatilities Live Matrix (100t Window)
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 font-mono">
                      Target Loss Risk: &le; 20.0%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {VOLATILITY_10_MARKETS.map((sym) => {
                      const history = hackerMarketDigits[sym] || [];
                      const last100 = history.slice(-100);
                      const last5 = history.slice(-5);
                      const last4 = history.slice(-4);

                      const count0and1 = last100.filter((d) => d === 0 || d === 1).length;
                      const pct0and1 = last100.length > 0 ? (count0and1 / last100.length) * 100 : 0;

                      const count8and9 = last100.filter((d) => d === 8 || d === 9).length;
                      const pct8and9 = last100.length > 0 ? (count8and9 / last100.length) * 100 : 0;

                      const losingCount0and1 = last4.filter((d) => d === 0 || d === 1).length;
                      const losingCount8and9 = last4.filter((d) => d === 8 || d === 9).length;
                      const isClean = losingCount0and1 === 0 || losingCount8and9 === 0;

                      return (
                        <div
                          key={sym}
                          className="p-2 bg-[#161821] rounded-xl border border-white/5 text-center flex flex-col justify-between gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-tight text-white">
                              {sym}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] font-bold px-1 rounded',
                                isClean
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-400'
                              )}
                            >
                              {isClean ? 'Clean' : 'Barrier'}
                            </span>
                          </div>

                          <div className="flex justify-center gap-1 my-0.5">
                            {last5.length > 0 ? (
                              last5.map((d, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'w-5 h-5 rounded flex items-center justify-center text-[10px] font-black tabular-nums',
                                    d === 8 || d === 9 || d === 0 || d === 1
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : d === 2 || d === 7
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-white/5 text-slate-300'
                                  )}
                                >
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-600 italic">--</span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[8px] font-mono border-t border-white/5 pt-1">
                            <div
                              className={cn(
                                'p-0.5 rounded',
                                pct0and1 <= 20.0
                                  ? 'text-emerald-400 bg-emerald-500/10 font-bold'
                                  : 'text-slate-500'
                              )}
                            >
                              %0+1: {pct0and1.toFixed(1)}%
                            </div>
                            <div
                              className={cn(
                                'p-0.5 rounded',
                                pct8and9 <= 20.0
                                  ? 'text-emerald-400 bg-emerald-500/10 font-bold'
                                  : 'text-slate-500'
                              )}
                            >
                              %8+9: {pct8and9.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Terminal Log Output */}
                <div className="bg-[#0a0b0d] p-4 rounded-2xl border border-white/5 h-[180px] sm:h-[240px] shrink-0 flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                    <span className="text-xs font-black uppercase text-violet-400 tracking-widest">
                      Pattern Detection &amp; Execution Log
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {hackerScanning ? '● ACTIVE MONITORING' : '○ STANDBY'}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[11px] pr-2 custom-scrollbar">
                    {hackerLogs.length > 0 ? (
                      hackerLogs.map((log, index) => (
                        <div
                          key={index}
                          className={cn(
                            'py-0.5',
                            log.includes('[SIGNAL')
                              ? 'text-emerald-400 font-bold'
                              : log.includes('[RESULT]') && log.includes('WIN')
                              ? 'text-emerald-400'
                              : log.includes('[RESULT]') && log.includes('LOSS')
                              ? 'text-rose-400'
                              : log.includes('[ERROR]')
                              ? 'text-rose-400 font-bold'
                              : 'text-slate-400'
                          )}
                        >
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 italic">
                        Click &apos;Start Hacker Scanner&apos; to initiate 10-market neural
                        pattern recognition...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
