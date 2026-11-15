import React, { useMemo, useState } from 'react';
import {
  Play,
  Square,
  Download,
  SlidersHorizontal,
  ChevronsRight,
  ChevronsLeft,
  PackageOpen,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  BotSettings,
  ContractStage,
  LogEntry,
  MARKETS,
  SessionStats,
  TradeRecord,
} from '../types';
import { ContractIcon, MarketLogo } from './ContractIcons';

export type RunPanelTab = 'summary' | 'transactions' | 'journal';

interface RunPanelProps {
  open: boolean;
  onToggleOpen: () => void;
  session: SessionStats;
  settings: BotSettings;
  trades: TradeRecord[];
  logs: LogEntry[];
  currency: string;
  connected: boolean;
  onOpenTokenModal: () => void;
  onStartTrading: () => void;
  onStopTrading: () => void;
  onResetStats: () => Promise<void>;
}

const STAGE_LABEL: Record<ContractStage, string> = {
  NOT_RUNNING: 'Bot is not running',
  STARTING: 'Bot is starting...',
  PURCHASE_SENT: 'Buying contract...',
  CONTRACT_OPEN: 'Contract in progress',
  CONTRACT_CLOSED: 'Contract settled',
  IS_STOPPING: 'Stopping bot...',
};

function getStageProgress(stage: ContractStage): number {
  switch (stage) {
    case 'STARTING':
      return 1;
    case 'PURCHASE_SENT':
    case 'CONTRACT_OPEN':
      return 2;
    case 'CONTRACT_CLOSED':
      return 3;
    case 'IS_STOPPING':
      return 2;
    default:
      return 0;
  }
}

function formatGmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' GMT';
}

export const RunPanel: React.FC<RunPanelProps> = ({
  open,
  onToggleOpen,
  session,
  settings,
  trades,
  logs,
  currency,
  connected,
  onOpenTokenModal,
  onStartTrading,
  onStopTrading,
  onResetStats,
}) => {
  const [activeTab, setActiveTab] = useState<RunPanelTab>('summary');
  const [viewDetail, setViewDetail] = useState(false);
  const [journalFilter, setJournalFilter] = useState<'all' | 'info' | 'win' | 'loss' | 'error'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [statsInfoOpen, setStatsInfoOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isRunning = session.status === 'running' || session.status === 'stopping';
  const isStopping = session.status === 'stopping';
  const clearDisabled = isRunning || (trades.length === 0 && logs.length === 0 && session.realTrades === 0);
  const stageStep = getStageProgress(session.contractStage);

  const filteredLogs = useMemo(() => {
    if (journalFilter === 'all') return logs;
    if (journalFilter === 'error') {
      return logs.filter((l) => l.level === 'error' || l.level === 'warn');
    }
    return logs.filter((l) => l.level === journalFilter);
  }, [logs, journalFilter]);

  const activeMarketLabel =
    MARKETS.find((m) => m.symbol === settings.market)?.label ?? settings.market;

  const handleDownloadTransactions = () => {
    if (trades.length === 0) return;
    const headers = [
      'Seq',
      'Timestamp',
      'Phase',
      'Market',
      'Contract',
      'EntrySpot',
      'ExitSpot',
      'Stake',
      'Payout',
      'Profit',
      'Currency',
      'ContractIDs',
    ];
    const rows = trades.map((t) => [
      t.seq,
      t.timestamp,
      t.isVirtual ? 'VIRTUAL' : 'REAL',
      t.marketLabel,
      t.label,
      t.entrySpot ?? '',
      t.exitSpot ?? '',
      t.stake.toFixed(2),
      t.payout.toFixed(2),
      t.profit.toFixed(2),
      t.currency,
      t.contractIds.join(';'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otivo-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJournal = () => {
    if (filteredLogs.length === 0) return;
    const content = filteredLogs
      .map((l) => `[${formatGmtTimestamp(l.timestamp)}] [${l.level.toUpperCase()}] ${l.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `otivo-journal-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await onResetStats();
      setConfirmResetOpen(false);
    } finally {
      setResetting(false);
    }
  };

  if (!open) {
    return (
      <div className="shrink-0">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-2 rounded-xl border border-[#1F2937] bg-[#111827] px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:bg-[#161E2E]"
          title="Open Run Panel"
        >
          <ChevronsLeft className="h-4 w-4 text-emerald-400" />
          <span>Run Panel</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="w-full xl:w-[370px] shrink-0 rounded-xl border border-[#1F2937] bg-[#0F131A] flex flex-col overflow-hidden">
      {/* Top Run / Stop + Contract Stage Progress Bar */}
      <div className="border-b border-[#1F2937] bg-[#131820] p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          {!connected ? (
            <button
              type="button"
              disabled
              title="Connect API Token in the top navigation bar first"
              className="flex items-center gap-1.5 rounded-md bg-[#1F2937] px-4 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run</span>
            </button>
          ) : isRunning ? (
            <button
              type="button"
              onClick={onStopTrading}
              disabled={isStopping}
              className="flex items-center gap-1.5 rounded-md bg-[#ff444f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#e63a44] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>{isStopping ? 'Stopping' : 'Stop'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartTrading}
              className="flex items-center gap-1.5 rounded-md bg-[#00a79e] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#00948c] whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run</span>
            </button>
          )}

          {/* Stage Status & Progress Line */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {STAGE_LABEL[session.contractStage]}
              </span>
            </div>
            <div className="relative flex items-center justify-between">
              <div className="absolute left-1 right-1 top-1/2 h-[2px] -translate-y-1/2 bg-[#252C37]" />
              <div
                className="absolute left-1 top-1/2 h-[2px] -translate-y-1/2 bg-[#00a79e] transition-all duration-200"
                style={{
                  width:
                    stageStep === 0
                      ? '0%'
                      : stageStep === 1
                      ? '25%'
                      : stageStep === 2
                      ? '62%'
                      : '96%',
                }}
              />
              {[1, 2, 3].map((dot) => {
                const active = stageStep >= dot;
                return (
                  <span
                    key={dot}
                    className={`relative z-10 h-2.5 w-2.5 rounded-full border transition-colors ${
                      active
                        ? 'border-[#00a79e] bg-[#00a79e]'
                        : 'border-[#333C4A] bg-[#131820]'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            aria-label="Collapse Run Panel"
            title="Collapse Run Panel"
            className="rounded p-1 text-slate-400 hover:bg-[#1F2937] hover:text-white shrink-0"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Run Panel Tabs */}
      <div className="grid grid-cols-3 border-b border-[#1F2937] bg-[#131820]">
        {(['summary', 'transactions', 'journal'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative py-2.5 text-center text-xs font-medium capitalize transition-colors ${
                active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#ff444f]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-[300px] max-h-[430px] overflow-y-auto p-3.5">
        {activeTab === 'summary' && (
          <div className="space-y-3.5">
            <div className="rounded-lg border border-[#1F2937] bg-[#141923] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Active Market</span>
                <div className="flex items-center gap-2">
                  <MarketLogo symbol={settings.market} className="w-6 h-6" />
                  <span className="text-xs font-semibold text-white">{activeMarketLabel}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1F2937] pt-2.5">
                <span className="text-[11px] font-medium text-slate-400">Contract Type</span>
                <div className="flex items-center gap-2">
                  <ContractIcon
                    type={session.activeType ?? settings.types[0]}
                    className="w-5 h-5"
                  />
                  <span className="text-xs font-semibold text-white">
                    {session.activeType ?? settings.types.join(' > ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1F2937] pt-2.5 text-xs">
                <span className="text-slate-400">Execution Mode</span>
                <span className="font-mono font-medium text-slate-200">
                  {settings.exec === 'fast' ? 'FAST' : 'NORMAL'} ·{' '}
                  {settings.mode === 'hybrid' ? 'Hybrid' : 'Single'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-[#1F2937] pt-2.5 text-xs">
                <span className="text-slate-400">Stake / Martingale</span>
                <span className="font-mono font-medium text-white tabular-nums">
                  {(session.status === 'idle' ? settings.stake : session.currentStake).toFixed(2)}{' '}
                  {currency}
                  {settings.mart ? ` (x${settings.mult} · Step ${session.martingaleStep})` : ''}
                </span>
              </div>

              {settings.virtual && (
                <div className="flex items-center justify-between border-t border-[#1F2937] pt-2.5 text-xs">
                  <span className="text-slate-400">Virtual Filter</span>
                  <span className="font-mono font-medium text-amber-400 tabular-nums">
                    {session.virtualLossesStreak}/{settings.vneed} losses ·{' '}
                    {session.inRealPhase ? 'REAL ACTIVE' : 'VIRTUAL'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#1F2937] pt-2.5 text-xs">
                <span className="text-slate-400">Targets (TP / SL)</span>
                <span className="font-mono font-medium tabular-nums">
                  <span className="text-emerald-400">+{settings.tp}</span> /{' '}
                  <span className="text-red-400">-{settings.sl}</span> {currency}
                </span>
              </div>
            </div>

            {session.stoppedReason && session.status !== 'running' && (
              <div className="rounded-lg border border-[#1F2937] bg-[#141923] px-3 py-2 text-xs text-slate-300">
                Last stop: <span className="font-medium text-white">{session.stoppedReason}</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDownloadTransactions}
                disabled={trades.length === 0}
                className="flex items-center gap-1.5 rounded border border-[#2A313D] bg-[#181E29] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1F2633] disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => setViewDetail(!viewDetail)}
                className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewDetail
                    ? 'border-blue-500 bg-blue-600/15 text-white'
                    : 'border-[#2A313D] bg-[#181E29] text-slate-300 hover:bg-[#1F2633]'
                }`}
              >
                View Detail
              </button>
            </div>

            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <PackageOpen className="h-11 w-11 text-slate-600 mb-3" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-slate-200">
                  There are no transactions to display
                </p>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Here are the possible reasons:
                </p>
                <ul className="mt-1 text-[11px] text-slate-500">
                  <li>• {isRunning ? 'Waiting for first trade to settle' : 'The bot is not running'}</li>
                </ul>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-12 border-b border-[#1F2937] pb-2 text-[11px] font-medium text-slate-400">
                  <span className="col-span-5">Type</span>
                  <span className="col-span-4 text-right">Entry/Exit spot</span>
                  <span className="col-span-3 text-right">Buy &amp; P/L</span>
                </div>
                <div className="divide-y divide-[#1F2937]/70">
                  {trades.slice(0, 50).map((t) => (
                    <div key={t.id} className="py-2 text-xs">
                      <div className="grid grid-cols-12 items-center gap-1">
                        <div className="col-span-5 flex items-center gap-2 min-w-0">
                          <MarketLogo symbol={t.market} className="w-6 h-6" />
                          <ContractIcon type={t.contractType} className="w-5 h-5" />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white text-[11px]">
                              {t.label}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {t.isVirtual ? 'VIRTUAL' : `#${t.seq}`}
                            </div>
                          </div>
                        </div>

                        <div className="col-span-4 text-right font-mono text-[11px] text-slate-300 tabular-nums">
                          <div>{t.entrySpot !== undefined ? t.entrySpot : '—'}</div>
                          <div className="text-slate-500">
                            {t.exitSpot !== undefined ? t.exitSpot : '—'}
                          </div>
                        </div>

                        <div className="col-span-3 text-right font-mono text-[11px] tabular-nums">
                          <div className="text-slate-300">{t.stake.toFixed(2)}</div>
                          <div
                            className={`font-semibold ${
                              t.won ? 'text-[#00a79e]' : 'text-[#ff444f]'
                            }`}
                          >
                            {t.profit >= 0 ? '+' : ''}
                            {t.profit.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {viewDetail && (
                        <div className="mt-1.5 rounded bg-[#0B0F17] px-2.5 py-1.5 font-mono text-[10px] text-slate-400 flex flex-wrap justify-between gap-2">
                          <span>ID: {t.contractIds.join(', ')}</span>
                          <span>
                            {t.ticks}t · {formatGmtTimestamp(t.timestamp)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleDownloadJournal}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-1.5 rounded border border-[#2A313D] bg-[#181E29] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1F2633] disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#181E29]"
              >
                <span>Filters</span>
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] p-1">
                {(['all', 'info', 'win', 'loss', 'error'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setJournalFilter(f)}
                    className={`flex-1 rounded px-2 py-1 text-[11px] font-medium capitalize ${
                      journalFilter === f
                        ? 'bg-[#1F2937] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}

            <div className="divide-y divide-[#1F2937]/60">
              {filteredLogs.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  {connected
                    ? `You are using your ${currency} account.`
                    : 'Connect your Deriv API token to start logging journal events.'}
                </p>
              ) : (
                filteredLogs.slice(0, 80).map((entry) => (
                  <div key={entry.id} className="py-2.5 space-y-1">
                    <p
                      className={`text-xs leading-relaxed ${
                        entry.level === 'win'
                          ? 'text-[#00a79e]'
                          : entry.level === 'loss' || entry.level === 'error'
                          ? 'text-[#ff444f]'
                          : entry.level === 'warn'
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {entry.message}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500 tabular-nums">
                      {formatGmtTimestamp(entry.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom 6-Metric Statistics Grid & Reset Footer */}
      <div className="border-t border-[#1F2937] bg-[#131820] p-3.5 space-y-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setStatsInfoOpen(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 underline underline-offset-2 hover:text-white"
          >
            <HelpCircle className="h-3 w-3" />
            <span>What&apos;s this?</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-center">
          <div>
            <span className="block text-[11px] text-slate-400">Total stake</span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-white tabular-nums">
              {session.totalStake.toFixed(2)} {currency}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400">Total payout</span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-white tabular-nums">
              {session.totalPayout.toFixed(2)} {currency}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400">No. of runs</span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-white tabular-nums">
              {session.realTrades}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400">Contracts lost</span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-white tabular-nums">
              {session.realLosses}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400">Contracts won</span>
            <span className="mt-0.5 block font-mono text-xs font-semibold text-white tabular-nums">
              {session.realWins}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-slate-400">Total profit/loss</span>
            <span
              className={`mt-0.5 block font-mono text-xs font-semibold tabular-nums ${
                session.totalProfit > 0
                  ? 'text-[#00a79e]'
                  : session.totalProfit < 0
                  ? 'text-[#ff444f]'
                  : 'text-white'
              }`}
            >
              {session.totalProfit >= 0 ? '+' : ''}
              {session.totalProfit.toFixed(2)} {currency}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={clearDisabled}
          onClick={() => setConfirmResetOpen(true)}
          className="w-full rounded-md border border-[#2A313D] bg-[#181E29] py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-[#1F2633] disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      {/* Reset Confirmation Dialog */}
      {confirmResetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-[#1F2937] bg-[#111827] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Reset statistics?</h3>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              This will clear the current session counters, transaction history, and journal entries.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="rounded-lg border border-[#1F2937] px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-[#161E2E]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleConfirmReset}
                className="rounded-lg bg-[#ff444f] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#e63a44] disabled:opacity-50"
              >
                {resetting ? 'Clearing...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Explanation Modal */}
      {statsInfoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-[#1F2937] bg-[#111827] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Run Panel Statistics</h3>
              <button
                type="button"
                onClick={() => setStatsInfoOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="space-y-2 text-xs text-slate-300">
              <div>
                <dt className="font-semibold text-white">Total stake</dt>
                <dd className="text-slate-400">Total real capital staked across all contracts in this session.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Total payout</dt>
                <dd className="text-slate-400">Total gross payout returned from winning real contracts.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">No. of runs / Won / Lost</dt>
                <dd className="text-slate-400">Count of real contracts settled, broken down by winning and losing outcomes.</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">Total profit/loss</dt>
                <dd className="text-slate-400">Net session profit or loss (Total payout minus Total stake).</dd>
              </div>
            </dl>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setStatsInfoOpen(false)}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
