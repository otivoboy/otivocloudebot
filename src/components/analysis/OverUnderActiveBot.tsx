import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Zap, ShieldCheck, Activity } from 'lucide-react';
import { TickData } from './types';
import { cn } from '../../lib/utils';

interface MarketStream {
  symbol: string;
  name: string;
  ticks: TickData[];
}

interface OverUnderActiveBotProps {
  markets: MarketStream[];
  isMultiMarketMode?: boolean;
  connected?: boolean;
  hasVirtualToken?: boolean;
}

export const OverUnderActiveBot: React.FC<OverUnderActiveBotProps> = ({
  markets,
  isMultiMarketMode = false,
  connected = false,
  hasVirtualToken = false,
}) => {
  const [running, setRunning] = useState(false);
  const [stake, setStake] = useState<number>(1.0);
  const [martingale, setMartingale] = useState<number>(2.1);
  const [duration, setDuration] = useState<number>(1);
  const [tp, setTp] = useState<number>(5.0);
  const [sl, setSl] = useState<number>(15.0);
  const [strategyMode, setStrategyMode] = useState<'over1_under8' | 'over4_under5'>('over1_under8');
  const [useVirtual, setUseVirtual] = useState<boolean>(false);
  const [virtualLossTarget, setVirtualLossTarget] = useState<number>(1);
  const [virtualWins, setVirtualWins] = useState(0);
  const [virtualLosses, setVirtualLosses] = useState(0);

  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [profit, setProfit] = useState(0);
  const [currentStake, setCurrentStake] = useState(1.0);
  const [statusLog, setStatusLog] = useState<string>('Standby — monitors all open grid markets for Over/Under pressure signals.');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runningRef = useRef(false);
  const executingRef = useRef(false);
  const currentStakeRef = useRef(1.0);
  const profitRef = useRef(0);
  const lastTradeAtRef = useRef(0);
  const vLossStreakRef = useRef(0);
  const inRealPhaseRef = useRef(true);

  useEffect(() => {
    if (!hasVirtualToken && useVirtual) {
      setUseVirtual(false);
      inRealPhaseRef.current = true;
    }
  }, [hasVirtualToken, useVirtual]);

  const stopBot = () => {
    runningRef.current = false;
    setRunning(false);
    setStatusLog('Master Over/Under Bot stopped.');
  };

  const startBot = () => {
    setErrorMsg(null);
    if (!connected) {
      setErrorMsg('Connect your Deriv API token via Deriv API Connection first.');
      return;
    }
    setWins(0);
    setLosses(0);
    setVirtualWins(0);
    setVirtualLosses(0);
    setProfit(0);
    profitRef.current = 0;
    vLossStreakRef.current = 0;
    const virtActive = Boolean(hasVirtualToken && useVirtual);
    inRealPhaseRef.current = !virtActive;
    const base = Math.max(0.35, Number(stake) || 1);
    setCurrentStake(base);
    currentStakeRef.current = base;
    runningRef.current = true;
    executingRef.current = false;
    lastTradeAtRef.current = 0;
    setRunning(true);
    setStatusLog(`Monitoring ${markets.length} market(s) for high-pressure Over/Under signals...`);
  };

  useEffect(() => {
    if (!running || executingRef.current) return;
    const now = Date.now();
    if (now - lastTradeAtRef.current < 400) return;

    // Scan open grid markets for strongest signal
    for (const m of markets) {
      const list = m.ticks;
      if (!list || list.length < 25) continue;
      const recent = list.slice(-25);
      const over1Count = recent.filter((t) => t.digit > 1).length;
      const under8Count = recent.filter((t) => t.digit < 8).length;
      const over4Count = recent.filter((t) => t.digit > 4).length;
      const under5Count = recent.filter((t) => t.digit < 5).length;

      let chosen: { contractType: 'digitover' | 'digitunder'; barrier: number; label: string } | null = null;

      if (strategyMode === 'over1_under8') {
        const last3 = list.slice(-3);
        if (over1Count / recent.length >= 0.88 && last3.every((t) => t.digit >= 2)) {
          chosen = { contractType: 'digitover', barrier: 1, label: 'OVER 1' };
        } else if (under8Count / recent.length >= 0.88 && last3.every((t) => t.digit <= 7)) {
          chosen = { contractType: 'digitunder', barrier: 8, label: 'UNDER 8' };
        }
      } else {
        if (over4Count / recent.length >= 0.64) {
          chosen = { contractType: 'digitover', barrier: 4, label: 'OVER 4' };
        } else if (under5Count / recent.length >= 0.64) {
          chosen = { contractType: 'digitunder', barrier: 5, label: 'UNDER 5' };
        }
      }

      if (chosen) {
        executingRef.current = true;
        lastTradeAtRef.current = now;
        const execRealStake = Math.max(0.35, Number((currentStakeRef.current || 1).toFixed(2)));
        const virtModeEnabled = Boolean(hasVirtualToken && useVirtual);
        const isVirt = virtModeEnabled && !inRealPhaseRef.current;
        const durTicks = Math.max(1, Math.min(10, duration));

        const callTradeApi = async (virtualTrade: boolean, tradeStake: number) => {
          const res = await fetch('/api/autobot/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: m.symbol,
              contractType: chosen!.contractType,
              prediction: chosen!.barrier,
              stake: virtualTrade ? 0.35 : tradeStake,
              duration: durTicks,
              isVirtual: virtualTrade,
              strategyName: `Grid Master ${chosen!.label}`,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Trade execution failed.');
          return {
            won: Boolean(data.won),
            pnl: Number(data.profit || 0),
          };
        };

        const runExecution = async () => {
          let realRes: { won: boolean; pnl: number } | null = null;

          if (isVirt) {
            setStatusLog(
              `Signal on ${m.symbol}: ${chosen!.label} (VIRTUAL API) @ $0.35...`
            );
            const vOutcome = await callTradeApi(true, 0.35);
            if (!runningRef.current) return;

            if (vOutcome.won) {
              vLossStreakRef.current = 0;
              setVirtualWins((vw) => vw + 1);
              setStatusLog(`${m.symbol} ${chosen!.label}: VIRTUAL WIN +$${vOutcome.pnl.toFixed(2)} · Streak reset`);
              return;
            }

            const nextVStreak = vLossStreakRef.current + 1;
            vLossStreakRef.current = nextVStreak;
            setVirtualLosses((vl) => vl + 1);

            if (virtualLossTarget <= 0 || nextVStreak < virtualLossTarget) {
              setStatusLog(
                `${m.symbol} ${chosen!.label}: VIRTUAL LOSS (${nextVStreak}${virtualLossTarget > 0 ? `/${virtualLossTarget}` : ''})`
              );
              return;
            }

            // Virtual loss target hit -> Switch to REAL IMMEDIATELY with ZERO lag
            inRealPhaseRef.current = true;
            setStatusLog(
              `${m.symbol} V-Loss ${nextVStreak}/${virtualLossTarget} hit -> Switching to REAL immediately @ $${execRealStake.toFixed(2)}!`
            );
            realRes = await callTradeApi(false, execRealStake);
          } else {
            setStatusLog(
              `Signal on ${m.symbol}: ${chosen!.label} (REAL) @ $${execRealStake.toFixed(2)}...`
            );
            realRes = await callTradeApi(false, execRealStake);
          }

          if (!realRes || !runningRef.current) return;
          const { won, pnl } = realRes;
          const nextProfit = profitRef.current + pnl;
          profitRef.current = nextProfit;
          setProfit(nextProfit);

          if (won) {
            setWins((w) => w + 1);
            const resetBase = Math.max(0.35, Number(stake) || 1);
            currentStakeRef.current = resetBase;
            setCurrentStake(resetBase);
            if (virtModeEnabled && virtualLossTarget > 0) {
              vLossStreakRef.current = 0;
              inRealPhaseRef.current = false;
            }
            setStatusLog(`${m.symbol} ${chosen!.label}: REAL WIN +$${pnl.toFixed(2)}`);
          } else {
            setLosses((l) => l + 1);
            const nextStake = Math.max(
              0.35,
              Number((execRealStake * Math.max(1, Number(martingale) || 1)).toFixed(2))
            );
            currentStakeRef.current = nextStake;
            setCurrentStake(nextStake);
            setStatusLog(`${m.symbol} ${chosen!.label}: REAL LOSS -$${Math.abs(pnl).toFixed(2)} -> Next $${nextStake.toFixed(2)}`);
          }

          if (nextProfit >= tp) {
            setStatusLog(`Take Profit reached (+$${nextProfit.toFixed(2)}). Bot stopped.`);
            runningRef.current = false;
            setRunning(false);
          } else if (nextProfit <= -sl) {
            setStatusLog(`Stop Loss reached (-$${Math.abs(nextProfit).toFixed(2)}). Bot stopped.`);
            runningRef.current = false;
            setRunning(false);
          }
        };

        runExecution()
          .catch((err) => {
            setErrorMsg(err?.message || 'Execution error');
            runningRef.current = false;
            setRunning(false);
          })
          .finally(() => {
            executingRef.current = false;
          });
        break;
      }
    }
  }, [markets, running, strategyMode, duration, stake, martingale, tp, sl, hasVirtualToken, useVirtual, virtualLossTarget]);

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-[#111217] p-4 shadow-xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
            <Zap size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span>Master Over/Under Grid Bot</span>
              {isMultiMarketMode && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {markets.length} Markets
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">{statusLog}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-[#0a0b0d] border border-[#2d2f36] text-[11px] font-mono font-bold">
            <span className="text-emerald-400">W:{wins}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span className="text-rose-400">L:{losses}</span>
            {hasVirtualToken && useVirtual && (
              <>
                <span className="text-slate-600 mx-1.5">|</span>
                <span className="text-purple-300">V:{virtualWins}W/{virtualLosses}L</span>
              </>
            )}
            <span className="text-slate-600 mx-2">|</span>
            <span className={profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
            </span>
          </div>

          {!running ? (
            <button
              type="button"
              onClick={startBot}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              Start Master Bot
            </button>
          ) : (
            <button
              type="button"
              onClick={stopBot}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer animate-pulse"
            >
              <Square size={13} fill="currentColor" />
              Stop Bot
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end pt-1">
        <div>
          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Signal Preset
          </label>
          <select
            disabled={running}
            value={strategyMode}
            onChange={(e) => setStrategyMode(e.target.value as any)}
            className="w-full rounded-lg border border-[#2d2f36] bg-[#0a0b0d] px-2.5 py-1.5 text-xs font-bold text-white"
          >
            <option value="over1_under8">Over 1 / Under 8</option>
            <option value="over4_under5">Over 4 / Under 5</option>
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Stake (${currentStake.toFixed(2)})
          </label>
          <input
            type="number"
            min="0.35"
            step="0.1"
            disabled={running}
            value={stake}
            onChange={(e) => setStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
            className="w-full rounded-lg border border-[#2d2f36] bg-[#0a0b0d] px-2.5 py-1.5 text-xs font-mono font-bold text-white"
          />
        </div>

        <div>
          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Martingale (x)
          </label>
          <input
            type="number"
            min="1"
            step="0.1"
            disabled={running}
            value={martingale}
            onChange={(e) => setMartingale(Math.max(1, parseFloat(e.target.value) || 1))}
            className="w-full rounded-lg border border-[#2d2f36] bg-[#0a0b0d] px-2.5 py-1.5 text-xs font-mono font-bold text-white"
          />
        </div>

        <div>
          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Ticks (1-10)
          </label>
          <input
            type="number"
            min="1"
            max="10"
            disabled={running}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
            className="w-full rounded-lg border border-[#2d2f36] bg-[#0a0b0d] px-2.5 py-1.5 text-xs font-mono font-bold text-white"
          />
        </div>

        <div>
          <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
            TP / SL ($)
          </label>
          <div className="flex gap-1">
            <input
              type="number"
              min="0.5"
              step="0.5"
              disabled={running}
              value={tp}
              onChange={(e) => setTp(Math.max(0.5, parseFloat(e.target.value) || 1))}
              className="w-1/2 rounded-lg border border-[#2d2f36] bg-[#0a0b0d] px-2 py-1.5 text-xs font-mono font-bold text-emerald-400"
              title="Take Profit"
            />
            <input
              type="number"
              min="1"
              step="1"
              disabled={running}
              value={sl}
              onChange={(e) => setSl(Math.max(1, parseFloat(e.target.value) || 5))}
              className="w-1/2 rounded-lg border border-[#2d2f36] bg-[#0a0b0d] px-2 py-1.5 text-xs font-mono font-bold text-rose-400"
              title="Stop Loss"
            />
          </div>
        </div>

        {hasVirtualToken ? (
          <div>
            <label className="block text-[9px] font-black uppercase tracking-wider text-purple-400 mb-1">
              Virtual ($0.35) / Target
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={running}
                onClick={() => setUseVirtual(!useVirtual)}
                className={cn(
                  'flex-1 rounded-lg border px-2 py-1.5 text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer',
                  useVirtual
                    ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                )}
              >
                {useVirtual ? <Activity size={12} /> : <ShieldCheck size={12} />}
                {useVirtual ? 'Virt' : 'Real'}
              </button>
              {useVirtual && (
                <input
                  type="number"
                  min="0"
                  max="10"
                  disabled={running}
                  value={virtualLossTarget}
                  onChange={(e) => setVirtualLossTarget(Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0)))}
                  title="Virtual losses before switching to Real (0 = Virtual Only)"
                  className="w-11 rounded-lg border border-purple-500/40 bg-[#0a0b0d] px-1.5 py-1.5 text-xs font-mono font-bold text-purple-300 text-center"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="text-[10px] font-mono text-slate-500 pb-2">
            Direct Deriv Execution
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-300">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
