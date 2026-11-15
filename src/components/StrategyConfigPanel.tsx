import React, { useState } from 'react';
import {
  Play,
  Square,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  BookmarkPlus,
} from 'lucide-react';
import {
  ALL_TRADE_TYPES,
  BARRIER_TYPES,
  BotSettings,
  DIGIT_TYPES,
  DUAL_TYPES,
  MARKETS,
  SessionStats,
  TradeType,
  VALID_DIGITS,
} from '../types';

interface StrategyConfigPanelProps {
  settings: BotSettings;
  onChange: (next: BotSettings) => void;
  onMarketPreviewChange: (market: string) => void;
  session: SessionStats;
  connected: boolean;
  onOpenTokenModal: () => void;
  onStartTrading: () => void;
  onStopTrading: () => void;
  onSaveStrategy: (name: string) => Promise<void>;
  actionError: string | null;
}

export const StrategyConfigPanel: React.FC<StrategyConfigPanelProps> = ({
  settings,
  onChange,
  onMarketPreviewChange,
  session,
  connected,
  onOpenTokenModal,
  onStartTrading,
  onStopTrading,
  onSaveStrategy,
  actionError,
}) => {
  const [saveOpen, setSaveOpen] = useState(false);
  const [strategyName, setStrategyName] = useState('');
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hybridAddType, setHybridAddType] = useState<TradeType>('Under');

  const isRunning = session.status === 'running' || session.status === 'stopping';
  const hasAccumulator = settings.types.includes('Accumulator');
  const needsDuration = settings.types.some((t) => t !== 'Accumulator');
  const hasBarrierType = settings.types.some(
    (t) => BARRIER_TYPES.includes(t) || t === 'Dual H/L'
  );
  const minTicks = hasBarrierType ? 5 : 1;
  const minStake = hasAccumulator ? 1 : 0.01;
  const hasDual = settings.types.some((t) => DUAL_TYPES.includes(t));

  const selectedDigitTypes = Array.from(
    new Set(settings.types.filter((t) => DIGIT_TYPES.includes(t)))
  ) as ('Differs' | 'Over' | 'Under')[];

  const neededBarriers: ('Higher' | 'Lower')[] = [];
  if (settings.types.includes('Higher') || settings.types.includes('Dual H/L')) {
    neededBarriers.push('Higher');
  }
  if (settings.types.includes('Lower') || settings.types.includes('Dual H/L')) {
    neededBarriers.push('Lower');
  }

  const update = (patch: Partial<BotSettings>) => {
    const next = { ...settings, ...patch };
    // Auto-adjust minimum ticks if Higher/Lower or Dual H/L added
    const nextHasBarrier = next.types.some(
      (t) => BARRIER_TYPES.includes(t) || t === 'Dual H/L'
    );
    if (nextHasBarrier && next.ticks < 5) {
      next.ticks = 5;
    }
    if (next.types.includes('Accumulator') && next.stake < 1) {
      next.stake = 1;
    }
    onChange(next);
  };

  const handleSelectSingleType = (t: TradeType) => {
    update({ types: [t] });
  };

  const handleModeSwitch = (mode: 'single' | 'hybrid') => {
    if (mode === 'single') {
      update({ mode: 'single', types: [settings.types[0] || 'Over'] });
    } else {
      const base: TradeType[] =
        settings.types.length >= 2 ? settings.types : [settings.types[0] || 'Over', 'Under'];
      update({ mode: 'hybrid', types: base });
    }
  };

  const addHybridType = () => {
    update({ types: [...settings.types, hybridAddType] });
  };

  const removeHybridIndex = (idx: number) => {
    if (settings.types.length <= 2) return;
    update({ types: settings.types.filter((_, i) => i !== idx) });
  };

  const moveHybridIndex = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= settings.types.length) return;
    const copy = [...settings.types];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    update({ types: copy });
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErr(null);
    if (!strategyName.trim()) {
      setSaveErr('Enter a strategy name.');
      return;
    }
    setSaving(true);
    try {
      await onSaveStrategy(strategyName.trim());
      setStrategyName('');
      setSaveOpen(false);
    } catch (err: any) {
      setSaveErr(err?.message || 'Failed to save strategy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="rounded-xl border border-[#1F2937] bg-[#111827] flex flex-col">
      <div className="flex items-center justify-between border-b border-[#1F2937] px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Strategy Configuration</h2>
        <button
          type="button"
          onClick={() => setSaveOpen(!saveOpen)}
          disabled={isRunning}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-40 whitespace-nowrap"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <span>Save Strategy</span>
        </button>
      </div>

      {saveOpen && (
        <form
          onSubmit={handleSaveSubmit}
          className="border-b border-[#1F2937] bg-[#0B0F17] px-5 py-3.5 space-y-2.5"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              maxLength={40}
              placeholder="Strategy name (max 40 chars)"
              className="flex-1 rounded-lg border border-[#1F2937] bg-[#111827] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {saveErr && <p className="text-xs text-red-400">{saveErr}</p>}
        </form>
      )}

      <div className="p-5 space-y-5 flex-1">
        {/* Market & Execution */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div>
            <label htmlFor="market-select" className="block text-xs font-medium text-slate-400 mb-1.5">
              Volatility Market
            </label>
            <select
              id="market-select"
              value={settings.market}
              disabled={isRunning}
              onChange={(e) => {
                update({ market: e.target.value });
                onMarketPreviewChange(e.target.value);
              }}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-60"
            >
              {MARKETS.map((m) => (
                <option key={m.symbol} value={m.symbol}>
                  {m.label} ({m.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">
              Execution Speed
            </span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] p-1">
              {(['normal', 'fast'] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  disabled={isRunning}
                  onClick={() => update({ exec: speed })}
                  className={`rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
                    settings.exec === speed
                      ? 'bg-[#1F2937] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {settings.exec === 'fast'
                ? 'Opens next contract immediately after close with zero pause.'
                : 'One contract at a time with a 1s pause and balance sync.'}
            </p>
          </div>
        </div>

        <hr className="border-[#1F2937]" />

        {/* Trading Mode & Contract Types */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Trading Mode</span>
            <div className="flex gap-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] p-0.5">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => handleModeSwitch('single')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  settings.mode === 'single'
                    ? 'bg-[#1F2937] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single Type
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => handleModeSwitch('hybrid')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  settings.mode === 'hybrid'
                    ? 'bg-[#1F2937] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hybrid Rotation
              </button>
            </div>
          </div>

          {settings.mode === 'single' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_TRADE_TYPES.map((t) => {
                const active = settings.types[0] === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleSelectSingleType(t)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors whitespace-nowrap truncate ${
                      active
                        ? 'border-blue-500 bg-blue-600/15 text-white'
                        : 'border-[#1F2937] bg-[#0B0F17] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-500">
                Rotates to the next contract type after each real loss; stays on win.
              </p>
              <div className="space-y-1.5">
                {settings.types.map((t, idx) => (
                  <div
                    key={`${t}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">
                        {idx + 1}.
                      </span>
                      <span className="text-xs font-medium text-white">{t}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isRunning || idx === 0}
                        onClick={() => moveHybridIndex(idx, -1)}
                        aria-label="Move up"
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isRunning || idx === settings.types.length - 1}
                        onClick={() => moveHybridIndex(idx, 1)}
                        aria-label="Move down"
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isRunning || settings.types.length <= 2}
                        onClick={() => removeHybridIndex(idx)}
                        aria-label="Remove type"
                        className="p-1 text-slate-400 hover:text-red-400 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={hybridAddType}
                  disabled={isRunning}
                  onChange={(e) => setHybridAddType(e.target.value as TradeType)}
                  className="flex-1 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  {ALL_TRADE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={addHybridType}
                  className="flex items-center gap-1 rounded-lg border border-[#1F2937] bg-[#161E2E] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Contract Parameters */}
        {(selectedDigitTypes.length > 0 || neededBarriers.length > 0 || hasAccumulator) && (
          <div className="space-y-3 border-t border-[#1F2937] pt-4">
            {selectedDigitTypes.map((dt) => {
              const currentDigit = settings.digits[dt];
              return (
                <div key={dt}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      {dt} Prediction Digit
                    </span>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() =>
                        update({
                          digits: {
                            ...settings.digits,
                            [dt]: currentDigit === null ? VALID_DIGITS[dt][0] : null,
                          },
                        })
                      }
                      className={`text-[11px] font-medium ${
                        currentDigit === null ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {currentDigit === null ? 'Random each trade (active)' : 'Use random'}
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {VALID_DIGITS[dt].map((d) => {
                      const active = currentDigit === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={isRunning}
                          onClick={() =>
                            update({ digits: { ...settings.digits, [dt]: d } })
                          }
                          className={`rounded-md border py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors ${
                            active
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-[#1F2937] bg-[#0B0F17] text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {neededBarriers.map((bt) => (
              <div key={bt}>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {bt} Barrier Offset (signed, e.g. +0.5 or -0.5)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled={isRunning}
                    value={settings.barriers[bt] ?? (bt === 'Higher' ? '+0.5' : '-0.5')}
                    onChange={(e) =>
                      update({
                        barriers: { ...settings.barriers, [bt]: e.target.value },
                      })
                    }
                    className="w-28 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {(bt === 'Higher'
                      ? ['+0.1', '+0.5', '+1']
                      : ['-0.1', '-0.5', '-1']
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={isRunning}
                        onClick={() =>
                          update({
                            barriers: { ...settings.barriers, [bt]: preset },
                          })
                        }
                        className="rounded border border-[#1F2937] bg-[#0B0F17] px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-slate-700"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {hasAccumulator && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs font-medium text-slate-300 mb-1.5">
                    Growth Rate
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((pct) => {
                      const val = pct / 100;
                      const active = Math.round(settings.growth * 100) === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          disabled={isRunning}
                          onClick={() => update({ growth: val })}
                          className={`flex-1 rounded border py-1.5 font-mono text-xs font-medium ${
                            active
                              ? 'border-blue-500 bg-blue-600/20 text-white'
                              : 'border-[#1F2937] bg-[#0B0F17] text-slate-400'
                          }`}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label htmlFor="accu-tp" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Limit Order TP
                  </label>
                  <input
                    id="accu-tp"
                    type="number"
                    step="0.01"
                    min="0.01"
                    disabled={isRunning}
                    value={settings.atp}
                    onChange={(e) => update({ atp: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <hr className="border-[#1F2937]" />

        {/* Stake & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="stake-input" className="block text-xs font-medium text-slate-400 mb-1.5">
              Stake {hasDual ? '(per leg)' : ''}
            </label>
            <input
              id="stake-input"
              type="number"
              step="0.01"
              min={minStake}
              max={5000}
              disabled={isRunning}
              value={settings.stake}
              onChange={(e) => update({ stake: Number(e.target.value) })}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-sm text-white tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>

          {needsDuration ? (
            <div>
              <label htmlFor="ticks-input" className="block text-xs font-medium text-slate-400 mb-1.5">
                Duration ({minTicks}-10 ticks)
              </label>
              <input
                id="ticks-input"
                type="number"
                step="1"
                min={minTicks}
                max={10}
                disabled={isRunning}
                value={settings.ticks}
                onChange={(e) => update({ ticks: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-sm text-white tabular-nums focus:border-blue-500 focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-end pb-2 text-xs text-slate-500">
              Accumulator uses limit TP
            </div>
          )}
        </div>

        {/* Martingale */}
        <div className="space-y-3 border-t border-[#1F2937] pt-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs font-medium text-slate-200">Martingale Recovery</span>
            <input
              type="checkbox"
              disabled={isRunning}
              checked={settings.mart}
              onChange={(e) => update({ mart: e.target.checked })}
              className="h-4 w-4 rounded border-[#1F2937] bg-[#0B0F17] accent-blue-600"
            />
          </label>

          {settings.mart && (
            <div className="space-y-3 pl-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mult-input" className="block text-[11px] text-slate-400 mb-1">
                    Multiplier (1.1-100)
                  </label>
                  <input
                    id="mult-input"
                    type="number"
                    step="0.1"
                    min="1.1"
                    max="100"
                    disabled={isRunning}
                    value={settings.mult}
                    onChange={(e) => update({ mult: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {needsDuration && (
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pb-1.5">
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={settings.martTickStep > 0}
                        onChange={(e) =>
                          update({
                            martTickStep: e.target.checked ? 2 : 0,
                            martTicks:
                              settings.ticks === minTicks ? minTicks + 1 : minTicks,
                          })
                        }
                        className="h-3.5 w-3.5 accent-blue-600"
                      />
                      <span>Switch ticks on step</span>
                    </label>
                  </div>
                )}
              </div>

              {needsDuration && settings.martTickStep > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="mart-step" className="block text-[11px] text-slate-400 mb-1">
                      From Step (1-50)
                    </label>
                    <input
                      id="mart-step"
                      type="number"
                      min="1"
                      max="50"
                      disabled={isRunning}
                      value={settings.martTickStep}
                      onChange={(e) =>
                        update({ martTickStep: Math.max(1, Number(e.target.value)) })
                      }
                      className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="mart-ticks" className="block text-[11px] text-slate-400 mb-1">
                      New Ticks ({minTicks}-10)
                    </label>
                    <input
                      id="mart-ticks"
                      type="number"
                      min={minTicks}
                      max={10}
                      disabled={isRunning}
                      value={settings.martTicks}
                      onChange={(e) =>
                        update({ martTicks: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Virtual Mode */}
        <div className="space-y-3 border-t border-[#1F2937] pt-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-xs font-medium text-slate-200">Virtual Loss Filter</span>
            <input
              type="checkbox"
              disabled={isRunning}
              checked={settings.virtual}
              onChange={(e) => update({ virtual: e.target.checked })}
              className="h-4 w-4 rounded border-[#1F2937] bg-[#0B0F17] accent-blue-600"
            />
          </label>

          {settings.virtual && (
            <div className="space-y-2.5 pl-1">
              <div>
                <label htmlFor="vneed-input" className="block text-[11px] text-slate-400 mb-1">
                  Consecutive virtual losses before real trade (1-50)
                </label>
                <input
                  id="vneed-input"
                  type="number"
                  min="1"
                  max="50"
                  disabled={isRunning}
                  value={settings.vneed}
                  onChange={(e) => update({ vneed: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-1.5 font-mono text-xs text-white tabular-nums focus:border-blue-500 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isRunning}
                  checked={settings.cont}
                  onChange={(e) => update({ cont: e.target.checked })}
                  className="h-3.5 w-3.5 accent-blue-600"
                />
                <span>Continuous real trades on loss until win</span>
              </label>
            </div>
          )}
        </div>

        {/* Take Profit & Stop Loss */}
        <div className="grid grid-cols-2 gap-3 border-t border-[#1F2937] pt-4">
          <div>
            <label htmlFor="tp-input" className="block text-xs font-medium text-slate-400 mb-1.5">
              Take Profit
            </label>
            <input
              id="tp-input"
              type="number"
              step="0.01"
              min="0.01"
              disabled={isRunning}
              value={settings.tp}
              onChange={(e) => update({ tp: Number(e.target.value) })}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-sm text-emerald-400 tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sl-input" className="block text-xs font-medium text-slate-400 mb-1.5">
              Stop Loss
            </label>
            <input
              id="sl-input"
              type="number"
              step="0.01"
              min="0.01"
              disabled={isRunning}
              value={settings.sl}
              onChange={(e) => update({ sl: Number(e.target.value) })}
              className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-sm text-red-400 tabular-nums focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {actionError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {actionError}
          </div>
        )}
      </div>

      {/* Primary Action Footer */}
      <div className="border-t border-[#1F2937] p-5">
        {!connected ? (
          <button
            type="button"
            onClick={onOpenTokenModal}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            <span>Connect API Token to Trade</span>
          </button>
        ) : isRunning ? (
          <button
            type="button"
            onClick={onStopTrading}
            disabled={session.status === 'stopping'}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            <Square className="h-4 w-4 fill-current" />
            <span>
              {session.status === 'stopping'
                ? 'Stopping After Current Trade...'
                : 'Stop Trading Bot'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartTrading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Trading Bot</span>
          </button>
        )}
      </div>
    </aside>
  );
};
