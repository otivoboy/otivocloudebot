import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { TradeRecord } from '../types';

interface TradeLedgerTableProps {
  trades: TradeRecord[];
  compact?: boolean;
}

export const TradeLedgerTable: React.FC<TradeLedgerTableProps> = ({
  trades,
  compact = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'real' | 'virtual'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trades.filter((t) => {
      if (filter === 'real' && t.isVirtual) return false;
      if (filter === 'virtual' && !t.isVirtual) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.marketLabel.toLowerCase().includes(q) ||
        t.contractIds.some((id) => id.toLowerCase().includes(q))
      );
    });
  }, [trades, filter, query]);

  const displayed = compact ? filtered.slice(0, 12) : filtered;

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = [
      'Seq',
      'Timestamp',
      'Mode',
      'Market',
      'Contract',
      'Ticks',
      'Stake',
      'Currency',
      'EntrySpot',
      'ExitSpot',
      'Outcome',
      'Profit',
      'SessionPL',
      'ContractIDs',
    ];
    const rows = filtered.map((t) => [
      t.seq,
      t.timestamp,
      t.isVirtual ? 'VIRTUAL' : 'REAL',
      t.marketLabel,
      t.label,
      t.ticks,
      t.stake,
      t.currency,
      t.entrySpot ?? '',
      t.exitSpot ?? '',
      t.won ? 'WIN' : 'LOSS',
      t.profit.toFixed(2),
      t.sessionTotalAfter.toFixed(2),
      t.contractIds.join(';'),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `derivbot-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-xl border border-[#1F2937] bg-[#111827]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2937] px-5 py-3.5">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-white">
            {compact ? 'Recent Executions' : 'Full Trade Ledger'}
          </h2>
          <div className="flex items-center gap-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] p-0.5">
            {(['all', 'real', 'virtual'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter(mode)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                  filter === mode
                    ? 'bg-[#1F2937] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter contract or ID..."
              className="w-44 sm:w-52 rounded-lg border border-[#1F2937] bg-[#0B0F17] py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-300">No trades recorded yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Connect your Deriv API token and start a trading session to inspect live contract executions here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#1F2937] text-[11px] font-medium text-slate-400">
                <th className="py-2.5 pl-5 pr-3 whitespace-nowrap">#</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Time</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Phase</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Market</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Contract</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Stake</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Spot (In / Out)</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Result</th>
                <th className="py-2.5 pl-3 pr-5 text-right whitespace-nowrap">Session P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]/70 text-xs">
              {displayed.map((t) => (
                <tr
                  key={t.id}
                  className="h-[38px] transition-colors hover:bg-[#161E2E]/60"
                >
                  <td className="py-2 pl-5 pr-3 font-mono text-slate-500 tabular-nums">
                    {t.seq}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                    {new Date(t.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        t.isVirtual ? 'text-amber-400' : 'text-blue-400'
                      }`}
                    >
                      {t.isVirtual ? 'VIRTUAL' : 'REAL'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                    {t.marketLabel}
                  </td>
                  <td className="px-3 py-2 font-medium text-white whitespace-nowrap">
                    {t.label}
                    {t.martingaleStep > 0 && (
                      <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                        M{t.martingaleStep}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                    {t.stake.toFixed(2)} {t.currency}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400 tabular-nums whitespace-nowrap">
                    {t.entrySpot !== undefined && t.exitSpot !== undefined
                      ? `${t.entrySpot} → ${t.exitSpot}`
                      : '—'}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                      t.won ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {t.won ? 'WIN' : 'LOSS'} {t.profit >= 0 ? '+' : ''}
                    {t.profit.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 pl-3 pr-5 text-right font-mono font-medium tabular-nums whitespace-nowrap ${
                      t.sessionTotalAfter > 0
                        ? 'text-emerald-400'
                        : t.sessionTotalAfter < 0
                        ? 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {t.isVirtual
                      ? '—'
                      : `${t.sessionTotalAfter >= 0 ? '+' : ''}${t.sessionTotalAfter.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
