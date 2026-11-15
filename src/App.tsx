import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, FlaskConical } from 'lucide-react';
import { TopNav, NavTab } from './components/TopNav';
import { TokenModal } from './components/TokenModal';
import { TickChart } from './components/TickChart';
import { StrategyConfigPanel } from './components/StrategyConfigPanel';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { StrategiesView } from './components/StrategiesView';
import {
  AccountInfo,
  AppSnapshot,
  BotSettings,
  DEFAULT_SETTINGS,
  LogEntry,
  SavedStrategy,
  SessionStats,
  TickPoint,
  TradeRecord,
} from './types';

const INITIAL_SESSION: SessionStats = {
  status: 'idle',
  realTrades: 0,
  realWins: 0,
  realLosses: 0,
  virtualTrades: 0,
  virtualWins: 0,
  virtualLossesStreak: 0,
  vneed: 0,
  inRealPhase: true,
  totalProfit: 0,
  currentStake: 1,
  baseStake: 1,
  martingaleStep: 0,
  currentTicks: 1,
  activeTypeIndex: 0,
  activeType: null,
  currency: 'USD',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('terminal');
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [settings, setSettings] = useState<BotSettings>(DEFAULT_SETTINGS);

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [session, setSession] = useState<SessionStats>(INITIAL_SESSION);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [ticks, setTicks] = useState<TickPoint[]>([]);
  const [tickMarket, setTickMarket] = useState<string>(DEFAULT_SETTINGS.market);

  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const applySnapshot = (snap: AppSnapshot) => {
    setAccount(snap.account);
    setSession(snap.session);
    setTrades(snap.trades ?? []);
    setLogs(snap.logs ?? []);
    setStrategies(snap.strategies ?? []);
    setTicks(snap.ticks ?? []);
    if (snap.tickMarket) setTickMarket(snap.tickMarket);
  };

  useEffect(() => {
    fetch('/api/snapshot')
      .then((r) => (r.ok ? r.json() : null))
      .then((snap) => {
        if (snap) applySnapshot(snap);
      })
      .catch(() => {});

    const es = new EventSource('/api/events');

    es.addEventListener('snapshot', (e) => {
      try {
        applySnapshot(JSON.parse((e as MessageEvent).data));
      } catch {
        // ignore
      }
    });

    es.addEventListener('account', (e) => {
      try {
        setAccount(JSON.parse((e as MessageEvent).data));
      } catch {
        // ignore
      }
    });

    es.addEventListener('session', (e) => {
      try {
        setSession(JSON.parse((e as MessageEvent).data));
      } catch {
        // ignore
      }
    });

    es.addEventListener('trade', (e) => {
      try {
        const record: TradeRecord = JSON.parse((e as MessageEvent).data);
        setTrades((prev) => [record, ...prev].slice(0, 500));
      } catch {
        // ignore
      }
    });

    es.addEventListener('trades_reset', () => {
      setTrades([]);
    });

    es.addEventListener('log', (e) => {
      try {
        const entry: LogEntry = JSON.parse((e as MessageEvent).data);
        setLogs((prev) => [entry, ...prev].slice(0, 250));
      } catch {
        // ignore
      }
    });

    es.addEventListener('strategies', (e) => {
      try {
        setStrategies(JSON.parse((e as MessageEvent).data));
      } catch {
        // ignore
      }
    });

    es.addEventListener('ticks_reset', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setTickMarket(data.market);
        setTicks([]);
      } catch {
        // ignore
      }
    });

    es.addEventListener('ticks', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setTickMarket(data.market);
        setTicks(data.ticks ?? []);
      } catch {
        // ignore
      }
    });

    es.addEventListener('tick', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setTickMarket(data.market);
        setTicks((prev) => [...prev, data.tick].slice(-60));
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
  }, []);

  const handleRefreshBalance = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/account/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.account) {
        setAccount(data.account);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarketPreviewChange = async (market: string) => {
    setTickMarket(market);
    setTicks([]);
    await fetch('/api/market/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market }),
    }).catch(() => {});
  };

  const handleStartTrading = async () => {
    setActionError(null);
    try {
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not start trading session.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to start trading.');
    }
  };

  const handleStopTrading = async () => {
    setActionError(null);
    try {
      const res = await fetch('/api/session/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not stop session.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to stop trading.');
    }
  };

  const handleSaveStrategy = async (name: string) => {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save strategy.');
  };

  const handleUpdateStrategy = async (
    id: string,
    patch: { name?: string; settings?: Partial<BotSettings> }
  ) => {
    const res = await fetch(`/api/strategies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update strategy.');
  };

  const handleDeleteStrategy = async (id: string) => {
    await fetch(`/api/strategies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  };

  const handleLoadStrategy = (loaded: BotSettings) => {
    setSettings(loaded);
    handleMarketPreviewChange(loaded.market);
    setActiveTab('terminal');
  };

  const winRate =
    session.realTrades > 0
      ? Math.round((session.realWins / session.realTrades) * 100)
      : 0;

  const currency = account?.currency || session.currency || 'USD';

  const statusLabel = (() => {
    if (session.status === 'stopping') return 'Stopping';
    if (session.status === 'error') return 'Halted (Error)';
    if (session.status === 'idle') return 'Idle';
    if (!session.inRealPhase) {
      return `Virtual (${session.virtualLossesStreak}/${session.vneed}L)`;
    }
    return session.activeType ? `Real · ${session.activeType}` : 'Real Trading';
  })();

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        account={account}
        onOpenTokenModal={() => setTokenModalOpen(true)}
        onRefreshBalance={handleRefreshBalance}
        refreshing={refreshing}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 py-6">
        {activeTab === 'terminal' && (
          <div className="space-y-5">
            {/* Connection Callout Banner when no API token is connected */}
            {(!account || !account.connected) && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1F2937] bg-[#111827] px-5 py-4">
                <div className="space-y-0.5">
                  <h1 className="text-sm font-semibold text-white">
                    Insert your Deriv API token to start automated trading
                  </h1>
                  <p className="text-xs text-slate-400">
                    Your live account balance and Real vs. Demo status will be detected automatically and displayed in the top navigation bar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTokenModalOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Insert API Token</span>
                </button>
              </div>
            )}

            {/* Account Summary Banner when connected */}
            {account && account.connected && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1F2937] bg-[#111827] px-5 py-3">
                <div className="flex items-center gap-2.5 text-xs">
                  {account.isVirtual ? (
                    <FlaskConical className="h-4 w-4 text-amber-400" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  )}
                  <span className="font-medium text-slate-200">
                    Connected to{' '}
                    <span
                      className={
                        account.isVirtual
                          ? 'font-semibold text-amber-400'
                          : 'font-semibold text-emerald-400'
                      }
                    >
                      {account.accountType}
                    </span>{' '}
                    account ({account.loginId})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTokenModalOpen(true)}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300"
                >
                  Change or Disconnect Token
                </button>
              </div>
            )}

            {/* Main 2-Column Trading Terminal */}
            <div className="flex flex-col lg:flex-row items-start gap-5">
              <div className="w-full lg:w-[390px] xl:w-[410px] shrink-0">
                <StrategyConfigPanel
                  settings={settings}
                  onChange={setSettings}
                  onMarketPreviewChange={handleMarketPreviewChange}
                  session={session}
                  connected={Boolean(account?.connected)}
                  onOpenTokenModal={() => setTokenModalOpen(true)}
                  onStartTrading={handleStartTrading}
                  onStopTrading={handleStopTrading}
                  onSaveStrategy={handleSaveStrategy}
                  actionError={actionError}
                />
              </div>

              <div className="flex-1 min-w-0 w-full space-y-5">
                {/* 4-Column Session KPI Strip */}
                <section className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1F2937] rounded-xl border border-[#1F2937] bg-[#111827]">
                  <div className="p-4">
                    <span className="block text-xs text-slate-400">Session P/L</span>
                    <span
                      className={`mt-1 block font-mono text-xl font-semibold tabular-nums ${
                        session.totalProfit > 0
                          ? 'text-emerald-400'
                          : session.totalProfit < 0
                          ? 'text-red-400'
                          : 'text-white'
                      }`}
                    >
                      {session.totalProfit >= 0 ? '+' : ''}
                      {session.totalProfit.toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-400">{currency}</span>
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="block text-xs text-slate-400">Real Win / Loss</span>
                    <span className="mt-1 block font-mono text-xl font-semibold text-white tabular-nums">
                      {session.realWins}W · {session.realLosses}L{' '}
                      <span className="text-xs font-normal text-slate-400">
                        ({winRate}%)
                      </span>
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="block text-xs text-slate-400">Active Stake</span>
                    <span className="mt-1 block font-mono text-xl font-semibold text-white tabular-nums">
                      {(session.status === 'idle'
                        ? settings.stake
                        : session.currentStake
                      ).toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        {session.martingaleStep > 0
                          ? `${currency} · Step ${session.martingaleStep}`
                          : currency}
                      </span>
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="block text-xs text-slate-400">Bot Status</span>
                    <span
                      className={`mt-1 block text-base font-semibold truncate ${
                        session.status === 'running'
                          ? session.inRealPhase
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                          : session.status === 'error'
                          ? 'text-red-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </section>

                {/* Live Market Tick Feed */}
                <TickChart market={tickMarket} ticks={ticks} />

                {/* Recent Executions Table */}
                <TradeLedgerTable trades={trades} compact />

                {/* Session Activity Log */}
                <section className="rounded-xl border border-[#1F2937] bg-[#111827]">
                  <div className="border-b border-[#1F2937] px-5 py-3">
                    <h2 className="text-sm font-semibold text-white">Session Activity</h2>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#1F2937]/60 px-5 py-1">
                    {logs.length === 0 ? (
                      <p className="py-5 text-xs text-slate-500">
                        Session events, virtual triggers, martingale adjustments, and TP/SL alerts will appear here.
                      </p>
                    ) : (
                      logs.slice(0, 40).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-baseline gap-3 py-2 text-xs"
                        >
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          <span
                            className={
                              item.level === 'win'
                                ? 'text-emerald-400'
                                : item.level === 'loss' || item.level === 'error'
                                ? 'text-red-400'
                                : item.level === 'warn'
                                ? 'text-amber-400'
                                : 'text-slate-300'
                            }
                          >
                            {item.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'strategies' && (
          <StrategiesView
            strategies={strategies}
            onLoadStrategy={handleLoadStrategy}
            onUpdateStrategy={handleUpdateStrategy}
            onDeleteStrategy={handleDeleteStrategy}
            sessionRunning={
              session.status === 'running' || session.status === 'stopping'
            }
          />
        )}

        {activeTab === 'ledger' && <TradeLedgerTable trades={trades} />}
      </main>

      <TokenModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        account={account}
        onConnected={(acc) => setAccount(acc)}
        onDisconnected={() => setAccount(null)}
        onRefreshBalance={handleRefreshBalance}
        sessionRunning={
          session.status === 'running' || session.status === 'stopping'
        }
      />
    </div>
  );
}
