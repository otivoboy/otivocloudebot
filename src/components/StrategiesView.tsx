import React, { useState } from 'react';
import { Play, Pencil, Trash2, Check, X } from 'lucide-react';
import { BotSettings, MARKETS, SavedStrategy } from '../types';
import { ContractIcon, MarketLogo } from './ContractIcons';

interface StrategiesViewProps {
  strategies: SavedStrategy[];
  onLoadStrategy: (settings: BotSettings) => void;
  onUpdateStrategy: (
    id: string,
    patch: { name?: string; settings?: Partial<BotSettings> }
  ) => Promise<void>;
  onDeleteStrategy: (id: string) => Promise<void>;
  sessionRunning: boolean;
}

export const StrategiesView: React.FC<StrategiesViewProps> = ({
  strategies,
  onLoadStrategy,
  onUpdateStrategy,
  onDeleteStrategy,
  sessionRunning,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStake, setEditStake] = useState(1);
  const [editTp, setEditTp] = useState(10);
  const [editSl, setEditSl] = useState(20);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const beginEdit = (s: SavedStrategy) => {
    setError(null);
    setEditingId(s.id);
    setEditName(s.name);
    setEditStake(s.settings.stake);
    setEditTp(s.settings.tp);
    setEditSl(s.settings.sl);
  };

  const saveEdit = async (s: SavedStrategy) => {
    setError(null);
    try {
      await onUpdateStrategy(s.id, {
        name: editName,
        settings: {
          ...s.settings,
          stake: editStake,
          tp: editTp,
          sl: editSl,
        },
      });
      setEditingId(null);
    } catch (err: any) {
      setError(err?.message || 'Could not update strategy.');
    }
  };

  const marketName = (sym: string) =>
    MARKETS.find((m) => m.symbol === sym)?.label ?? sym;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Saved Strategies</h1>
          <p className="text-xs text-slate-400">
            Load a saved configuration into the terminal or adjust Stake, Take Profit, and Stop Loss inline.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {strategies.length === 0 ? (
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] px-6 py-14 text-center">
          <p className="text-sm font-medium text-slate-200">No saved strategies</p>
          <p className="mt-1 text-xs text-slate-500">
            Configure your parameters in the Terminal panel and click Save Strategy to store presets for one-click execution.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strategies.map((s) => {
            const isEditing = editingId === s.id;
            const cfg = s.settings;

            return (
              <div
                key={s.id}
                className="rounded-xl border border-[#1F2937] bg-[#111827] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 text-sm font-semibold text-white focus:border-blue-500 focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-start gap-3">
                        <MarketLogo symbol={cfg.market} />
                        <div>
                          <h3 className="text-base font-semibold text-white">{s.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                            <span>{marketName(cfg.market)}</span>
                            <span>·</span>
                            <span>{cfg.exec === 'fast' ? 'Fast' : 'Normal'}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1.5">
                              {cfg.types.map((t, i) => (
                                <span key={`${t}-${i}`} className="inline-flex items-center gap-1 text-slate-200">
                                  <ContractIcon type={t} className="w-4 h-4" />
                                  <span>{t}</span>
                                  {i < cfg.types.length - 1 && <span className="text-slate-500">&gt;</span>}
                                </span>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Stake</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editStake}
                          onChange={(e) => setEditStake(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-2.5 py-1.5 font-mono text-xs text-white tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">TP</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editTp}
                          onChange={(e) => setEditTp(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-2.5 py-1.5 font-mono text-xs text-emerald-400 tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">SL</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editSl}
                          onChange={(e) => setEditSl(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-2.5 py-1.5 font-mono text-xs text-red-400 tabular-nums"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 border-t border-[#1F2937] pt-3 text-xs">
                      <div>
                        <span className="block text-slate-500">Stake / Ticks</span>
                        <span className="font-mono font-medium text-slate-200 tabular-nums">
                          {cfg.stake} · {cfg.ticks ? `${cfg.ticks}t` : 'ACCU'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Martingale / Virtual</span>
                        <span className="font-mono font-medium text-slate-200 tabular-nums">
                          {cfg.mart ? `x${cfg.mult}` : 'Off'} ·{' '}
                          {cfg.virtual ? `${cfg.vneed}L` : 'Off'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">TP / SL</span>
                        <span className="font-mono font-medium text-slate-200 tabular-nums">
                          <span className="text-emerald-400">+{cfg.tp}</span> /{' '}
                          <span className="text-red-400">-{cfg.sl}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[#1F2937] pt-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(s)}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Save Changes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 rounded-lg border border-[#1F2937] px-3 py-1.5 text-xs text-slate-300 hover:bg-[#161E2E]"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={sessionRunning}
                        onClick={() => onLoadStrategy(s.settings)}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Load into Terminal</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => beginEdit(s)}
                          className="flex items-center gap-1 rounded-lg border border-[#1F2937] px-2.5 py-1.5 text-xs text-slate-300 hover:bg-[#161E2E]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>

                        {confirmDeleteId === s.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteStrategy(s.id);
                                setConfirmDeleteId(null);
                              }}
                              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-[#1F2937] px-2 py-1.5 text-xs text-slate-400"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(s.id)}
                            aria-label={`Delete ${s.name}`}
                            className="rounded-lg border border-[#1F2937] p-1.5 text-slate-400 hover:border-red-900/50 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
