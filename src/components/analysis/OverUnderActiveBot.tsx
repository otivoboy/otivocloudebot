import React, { useEffect, useState } from 'react';
import { Play, Square, Zap, ShieldCheck, Activity } from 'lucide-react';
import { TickData } from './types';
import { cn } from '../../lib/utils';
import type { CloudBotsSnapshot, GridMasterCloudState } from '../../types/cloudBots';

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
  cloudState?: GridMasterCloudState;
  onCloudBotsUpdate?: (snap: CloudBotsSnapshot) => void;
}

export const OverUnderActiveBot: React.FC<OverUnderActiveBotProps> = ({
  markets,
  isMultiMarketMode = false,
  connected = false,
  hasVirtualToken = false,
  cloudState,
  onCloudBotsUpdate,
}) => {
  const [stake, setStake] = useState<number>(1.0);
  const [martingale, setMartingale] = useState<number>(2.1);
  const [duration, setDuration] = useState<number>(1);
  const [tp, setTp] = useState<number>(5.0);
  const [sl, setSl] = useState<number>(15.0);
  const [strategyMode, setStrategyMode] = useState<'over1_under8' | 'over4_under5'>('over1_under8');
  const [useVirtual, setUseVirtual] = useState<boolean>(false);
  const [virtualLossTarget, setVirtualLossTarget] = useState<number>(1);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const running = Boolean(cloudState?.running);
  const wins = cloudState?.wins ?? 0;
  const losses = cloudState?.losses ?? 0;
  const virtualWins = cloudState?.virtualWins ?? 0;
  const virtualLosses = cloudState?.virtualLosses ?? 0;
  const profit = cloudState?.profit ?? 0;
  const currentStake = cloudState?.currentStake ?? stake;
  const statusLog =
    cloudState?.statusLog ??
    'Standby — monitors all open grid markets for Over/Under pressure signals.';
  const errorMsg = localError || cloudState?.errorMsg || null;

  useEffect(() => {
    if (!hasVirtualToken && useVirtual) {
      setUseVirtual(false);
    }
  }, [hasVirtualToken, useVirtual]);

  const stopBot = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/cloud-bots/grid-master/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setLocalError(data?.error || 'Failed to stop Master Bot.');
      } else if (data?.cloudBots && onCloudBotsUpdate) {
        onCloudBotsUpdate(data.cloudBots);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to stop Master Bot.');
    } finally {
      setBusy(false);
    }
  };

  const startBot = async () => {
    setLocalError(null);
    if (!connected) {
      setLocalError('Connect your Deriv API token via Deriv API Connection first.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/cloud-bots/grid-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markets: markets.map((m) => m.symbol),
          strategyMode,
          stake: Math.max(0.35, Number(stake) || 1),
          martingale: Math.max(1, Number(martingale) || 1),
          duration: Math.max(1, Math.min(10, Number(duration) || 1)),
          tp: Math.max(0.5, Number(tp) || 5),
          sl: Math.max(1, Number(sl) || 15),
          useVirtual: Boolean(hasVirtualToken && useVirtual),
          virtualLossTarget: Math.max(0, Math.min(10, Number(virtualLossTarget) || 0)),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocalError(data?.error || 'Failed to start Master Bot.');
      } else if (data?.cloudBots && onCloudBotsUpdate) {
        onCloudBotsUpdate(data.cloudBots);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to start Master Bot.');
    } finally {
      setBusy(false);
    }
  };

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
