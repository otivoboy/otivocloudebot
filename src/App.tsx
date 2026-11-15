import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, FlaskConical } from 'lucide-react';
import { TopNav, NavTab } from './components/TopNav';
import { TokenModal } from './components/TokenModal';
import { TickChart } from './components/TickChart';
import { StrategyConfigPanel } from './components/StrategyConfigPanel';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { StrategiesView } from './components/StrategiesView';
import { RunPanel } from './components/RunPanel';
import { AutoBotPage } from './pages/AutoBotPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { BotBuilderPage } from './pages/BotBuilderPage';
import { MetaTraderPage, MtClosedTrade } from './pages/MetaTraderPage';
import { useDerivPublicTicks } from './lib/useDerivPublicTicks';
import {
  AccountInfo,
  AppSnapshot,
  BotSettings,
  DEFAULT_SETTINGS,
  LogEntry,
  OpenPosition,
  SavedStrategy,
  SessionStats,
  TickPoint,
  TradeRecord,
} from './types';

type TerminalSubTab = 'terminal' | 'strategies' | 'ledger';

const INITIAL_SESSION: SessionStats = {
  status: 'idle',
  contractStage: 'NOT_RUNNING',
  realTrades: 0,
  realWins: 0,
  realLosses: 0,
  virtualTrades: 0,
  virtualWins: 0,
  virtualLossesStreak: 0,
  vneed: 0,
  inRealPhase: true,
  totalStake: 0,
  totalPayout: 0,
  totalProfit: 0,
  currentStake: 1,
  baseStake: 1,
  martingaleStep: 0,
  currentTicks: 1,
  activeTypeIndex: 0,
  activeType: null,
  currency: 'USD',
};

const VALID_TABS: NavTab[] = ['terminal', 'autobot', 'analysis', 'builder', 'metatrader'];
const VALID_SUBTABS: TerminalSubTab[] = ['terminal', 'strategies', 'ledger'];

function readInitialTab(): NavTab {
  try {
    const raw = localStorage.getItem('otivo_active_tab') as NavTab | null;
    if (raw && VALID_TABS.includes(raw)) return raw;
  } catch {
    // ignore
  }
  return 'terminal';
}

function readInitialSubTab(): TerminalSubTab {
  try {
    const raw = localStorage.getItem('otivo_terminal_subtab') as TerminalSubTab | null;
    if (raw && VALID_SUBTABS.includes(raw)) return raw;
  } catch {
    // ignore
  }
  return 'terminal';
}

function readInitialRunPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem('otivo_run_panel_open');
    if (raw === 'false') return false;
  } catch {
    // ignore
  }
  return true;
}

function readInitialSettings(): { settings: BotSettings; hadLocal: boolean } {
  try {
    const raw = localStorage.getItem('otivo_bot_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { settings: { ...DEFAULT_SETTINGS, ...parsed }, hadLocal: true };
      }
    }
  } catch {
    // ignore
  }
  return { settings: DEFAULT_SETTINGS, hadLocal: false };
}

export default function App() {
  const initialSettingsState = useRef(readInitialSettings());
  const [activeTab, setActiveTab] = useState<NavTab>(readInitialTab);
  const [terminalSubTab, setTerminalSubTab] = useState<TerminalSubTab>(readInitialSubTab);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [runPanelOpen, setRunPanelOpen] = useState<boolean>(readInitialRunPanelOpen);
  const [settings, setSettings] = useState<BotSettings>(initialSettingsState.current.settings);

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [session, setSession] = useState<SessionStats>(INITIAL_SESSION);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [ticks, setTicks] = useState<TickPoint[]>([]);
  const [tickMarket, setTickMarket] = useState<string>(initialSettingsState.current.settings.market);
  const [multiTicks, setMultiTicks] = useState<Record<string, TickPoint[]>>({});
  const [watchedMultiSymbols, setWatchedMultiSymbols] = useState<string[]>([]);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [lastClosedMtTrade, setLastClosedMtTrade] = useState<MtClosedTrade | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const autoReconnectAttemptedRef = useRef(false);

  const clientPublicTicks = useDerivPublicTicks(
    watchedMultiSymbols,
    activeTab !== 'terminal' && watchedMultiSymbols.length > 0
  );

  const mergedMultiTicks = useMemo(() => {
    const merged: Record<string, TickPoint[]> = { ...multiTicks };
    for (const [sym, pts] of Object.entries(clientPublicTicks)) {
      const serverPts = merged[sym] ?? [];
      if (pts.length >= serverPts.length) {
        merged[sym] = pts;
      } else if (pts.length > 0) {
        const lastClient = pts[pts.length - 1];
        const lastServer = serverPts[serverPts.length - 1];
        if (!lastServer || lastClient.epoch > lastServer.epoch) {
          merged[sym] = [...serverPts, lastClient].slice(-200);
        }
      }
    }
    return merged;
  }, [multiTicks, clientPublicTicks]);

  // Persist layout & active tabs
  useEffect(() => {
    try {
      localStorage.setItem('otivo_active_tab', activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('otivo_terminal_subtab', terminalSubTab);
    } catch {
      // ignore
    }
  }, [terminalSubTab]);

  useEffect(() => {
    try {
      localStorage.setItem('otivo_run_panel_open', String(runPanelOpen));
    } catch {
      // ignore
    }
  }, [runPanelOpen]);

  // Persist bot settings in localStorage and sync to server
  const handleSettingsChange = (next: BotSettings) => {
    setSettings(next);
    try {
      localStorage.setItem('otivo_bot_settings', JSON.stringify(next));
    } catch {
      // ignore
    }
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: next }),
    }).catch(() => {});
  };

  const tryAutoReconnect = () => {
    if (autoReconnectAttemptedRef.current) return;
    autoReconnectAttemptedRef.current = true;
    try {
      const raw = localStorage.getItem('otivo_saved_connection');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved.token === 'string' && saved.token.trim()) {
        fetch('/api/account/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saved),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.account) setAccount(data.account);
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const applySnapshot = (snap: AppSnapshot) => {
    setAccount(snap.account);
    if (!snap.account?.connected) {
      tryAutoReconnect();
    }
    setSession(snap.session);
    setTrades(snap.trades ?? []);
    setLogs(snap.logs ?? []);
    setStrategies(snap.strategies ?? []);
    setTicks(snap.ticks ?? []);
    if (snap.tickMarket) setTickMarket(snap.tickMarket);
    if (snap.multiTicks) setMultiTicks(snap.multiTicks);
    if (snap.positions) setPositions(snap.positions);

    // Only adopt server settings if client had no local saved settings yet
    if (!initialSettingsState.current.hadLocal && snap.settings) {
      setSettings(snap.settings);
      try {
        localStorage.setItem('otivo_bot_settings', JSON.stringify(snap.settings));
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    // If client had local settings, ensure server preview & settings stay synced
    if (initialSettingsState.current.hadLocal) {
      const localSettings = initialSettingsState.current.settings;
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: localSettings }),
      }).catch(() => {});
      fetch('/api/market/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market: localSettings.market }),
      }).catch(() => {});
    }

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

    es.addEventListener('logs_reset', (e) => {
      try {
        setLogs(JSON.parse((e as MessageEvent).data));
      } catch {
        setLogs([]);
      }
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

    es.addEventListener('multi_ticks', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setMultiTicks((prev) => ({ ...prev, [data.symbol]: data.ticks ?? [] }));
      } catch {
        // ignore
      }
    });

    es.addEventListener('multi_tick', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setMultiTicks((prev) => {
          const existing = prev[data.symbol] ?? [];
          return { ...prev, [data.symbol]: [...existing, data.tick].slice(-200) };
        });
      } catch {
        // ignore
      }
    });

    es.addEventListener('positions', (e) => {
      try {
        setPositions(JSON.parse((e as MessageEvent).data));
      } catch {
        // ignore
      }
    });

    es.addEventListener('mt_closed', (e) => {
      try {
        setLastClosedMtTrade(JSON.parse((e as MessageEvent).data));
      } catch {
        // ignore
      }
    });

    return () => {
      es.close();
    };
  }, []);

  const handleRefreshBalance = async () => {
    const res = await fetch('/api/account/refresh', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.account) {
      setAccount(data.account);
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

  const handleSubscribeMultiMarkets = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setWatchedMultiSymbols((prev) =>
      Array.from(new Set([...prev, ...symbols])).slice(-20)
    );
    await fetch('/api/markets/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
    }).catch(() => {});
  };

  const startWithSettings = async (overrideSettings: BotSettings) => {
    setActionError(null);
    handleSettingsChange(overrideSettings);
    setRunPanelOpen(true);
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: overrideSettings }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Could not start trading session.');
    }
  };

  const handleStartTrading = async () => {
    try {
      await startWithSettings(settings);
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

  const handleResetStats = async () => {
    const res = await fetch('/api/session/reset', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not reset stats.');
  };

  const handleSaveStrategy = async (name: string, customSettings?: BotSettings) => {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings: customSettings ?? settings }),
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
    handleSettingsChange(loaded);
    handleMarketPreviewChange(loaded.market);
    setActiveTab('terminal');
    setTerminalSubTab('terminal');
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
      />

      <main className="w-full flex-1 px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 md:pb-8">
        {activeTab === 'terminal' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Terminal Sub-Tabs: Trading Terminal | Saved Strategies | Trade Ledger */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-lg border border-[#1F2937] bg-[#111827] p-1">
                {(
                  [
                    { id: 'terminal', label: 'Trading Terminal' },
                    { id: 'strategies', label: `Strategies (${strategies.length})` },
                    { id: 'ledger', label: `Ledger (${trades.length})` },
                  ] as const
                ).map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setTerminalSubTab(sub.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      terminalSubTab === sub.id
                        ? 'bg-[#1F2937] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {account && account.connected && (
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  {account.isVirtual ? (
                    <FlaskConical className="h-4 w-4 text-[#f59e0b]" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-[#00a79e]" />
                  )}
                  <span>
                    <strong className={account.isVirtual ? 'text-[#f59e0b]' : 'text-[#00a79e]'}>
                      {account.isVirtual ? 'Demo account' : 'Real account'}
                    </strong>{' '}
                    ({account.loginId})
                  </span>
                </div>
              )}
            </div>

            {terminalSubTab === 'terminal' && (
              <>
                {(!account || !account.connected) && (
                  <div className="rounded-xl border border-[#1F2937] bg-[#111827] px-4 py-3 text-xs text-slate-300">
                    Use the red <strong className="text-[#ff444f]">Connect API Token</strong> button in the top navigation bar to authorize your Real or Demo Deriv account.
                  </div>
                )}

                {/* Main 3-Pane Trading Terminal: Strategy Config | Live Market + Ledger | Run Panel */}
                <div className="flex flex-col lg:flex-row items-start gap-5">
                  <div className="w-full lg:w-[340px] xl:w-[360px] shrink-0">
                    <StrategyConfigPanel
                      settings={settings}
                      onChange={handleSettingsChange}
                      onMarketPreviewChange={handleMarketPreviewChange}
                      session={session}
                      connected={Boolean(account?.connected)}
                      onOpenTokenModal={() => setTokenModalOpen(true)}
                      onStartTrading={handleStartTrading}
                      onStopTrading={handleStopTrading}
                      onSaveStrategy={(name) => handleSaveStrategy(name)}
                      actionError={actionError}
                    />
                  </div>

                  <div className="flex-1 min-w-0 w-full space-y-5">
                    <section className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1F2937] rounded-xl border border-[#1F2937] bg-[#111827]">
                      <div className="p-3.5 sm:p-4">
                        <span className="block text-xs text-slate-400">Session P/L</span>
                        <span
                          className={`mt-1 block font-mono text-lg sm:text-xl font-semibold tabular-nums ${
                            session.totalProfit > 0
                              ? 'text-[#00a79e]'
                              : session.totalProfit < 0
                              ? 'text-[#ff444f]'
                              : 'text-white'
                          }`}
                        >
                          {session.totalProfit >= 0 ? '+' : ''}
                          {session.totalProfit.toFixed(2)}{' '}
                          <span className="text-xs font-normal text-slate-400">{currency}</span>
                        </span>
                      </div>

                      <div className="p-3.5 sm:p-4">
                        <span className="block text-xs text-slate-400">Real Win / Loss</span>
                        <span className="mt-1 block font-mono text-lg sm:text-xl font-semibold text-white tabular-nums">
                          {session.realWins}W · {session.realLosses}L{' '}
                          <span className="text-xs font-normal text-slate-400">
                            ({winRate}%)
                          </span>
                        </span>
                      </div>

                      <div className="p-3.5 sm:p-4">
                        <span className="block text-xs text-slate-400">Active Stake</span>
                        <span className="mt-1 block font-mono text-lg sm:text-xl font-semibold text-white tabular-nums">
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

                      <div className="p-3.5 sm:p-4">
                        <span className="block text-xs text-slate-400">Bot Status</span>
                        <span
                          className={`mt-1 block text-sm sm:text-base font-semibold truncate ${
                            session.status === 'running'
                              ? session.inRealPhase
                                ? 'text-[#00a79e]'
                                : 'text-[#f59e0b]'
                              : session.status === 'error'
                              ? 'text-[#ff444f]'
                              : 'text-slate-200'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </section>

                    <TickChart market={tickMarket} ticks={ticks} />

                    <TradeLedgerTable trades={trades} compact />
                  </div>

                  {/* Right-Side Collapsible Run Panel */}
                  <RunPanel
                    open={runPanelOpen}
                    onToggleOpen={() => setRunPanelOpen(!runPanelOpen)}
                    session={session}
                    settings={settings}
                    trades={trades}
                    logs={logs}
                    currency={currency}
                    connected={Boolean(account?.connected)}
                    onOpenTokenModal={() => setTokenModalOpen(true)}
                    onStartTrading={handleStartTrading}
                    onStopTrading={handleStopTrading}
                    onResetStats={handleResetStats}
                  />
                </div>
              </>
            )}

            {terminalSubTab === 'strategies' && (
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

            {terminalSubTab === 'ledger' && <TradeLedgerTable trades={trades} />}
          </div>
        )}

        {activeTab === 'autobot' && (
          <AutoBotPage
            multiTicks={mergedMultiTicks}
            session={session}
            connected={Boolean(account?.connected)}
            currency={currency}
            onSubscribeMarkets={handleSubscribeMultiMarkets}
            onStartWithSettings={async (s) => {
              await startWithSettings(s);
              setActiveTab('terminal');
              setTerminalSubTab('terminal');
            }}
            onStopTrading={handleStopTrading}
            onLoadToTerminal={handleLoadStrategy}
          />
        )}

        {activeTab === 'analysis' && (
          <AnalysisPage
            multiTicks={mergedMultiTicks}
            connected={Boolean(account?.connected)}
            session={session}
            currentSettings={settings}
            onSubscribeMarkets={handleSubscribeMultiMarkets}
            onLoadToTerminal={handleLoadStrategy}
            onStartWithSettings={async (s) => {
              await startWithSettings(s);
              setActiveTab('terminal');
              setTerminalSubTab('terminal');
            }}
          />
        )}

        {activeTab === 'builder' && (
          <BotBuilderPage
            connected={Boolean(account?.connected)}
            session={session}
            currency={currency}
            onStartWithSettings={async (s) => {
              await startWithSettings(s);
              setActiveTab('terminal');
              setTerminalSubTab('terminal');
            }}
            onStopTrading={handleStopTrading}
            onLoadToTerminal={handleLoadStrategy}
            onSaveStrategy={handleSaveStrategy}
          />
        )}

        {activeTab === 'metatrader' && (
          <MetaTraderPage
            account={account}
            positions={positions}
            multiTicks={mergedMultiTicks}
            lastClosedTrade={lastClosedMtTrade}
            onSubscribeMarkets={handleSubscribeMultiMarkets}
          />
        )}
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
