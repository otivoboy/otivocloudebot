import React, { useEffect, useRef, useState } from 'react';
import {
  Blocks,
  Play,
  Square,
  Download,
  Upload,
  ArrowRight,
  BookmarkPlus,
} from 'lucide-react';
import {
  ALL_TRADE_TYPES,
  BARRIER_TYPES,
  BotSettings,
  DEFAULT_SETTINGS,
  DIGIT_TYPES,
  MARKETS,
  SessionStats,
  TradeType,
  VALID_DIGITS,
} from '../types';
import { ContractIcon, MarketLogo } from '../components/ContractIcons';

interface BotBuilderPageProps {
  connected: boolean;
  hasVirtualToken: boolean;
  session: SessionStats;
  currency: string;
  onStartWithSettings: (settings: BotSettings) => Promise<void>;
  onStopTrading: () => Promise<void>;
  onLoadToTerminal: (settings: BotSettings) => void;
  onSaveStrategy: (name: string, settings: BotSettings) => Promise<void>;
}

const STORAGE_KEY = 'otivo_botbuilder_workspace_v1';

interface BuilderTemplate {
  id: string;
  name: string;
  summary: string;
  settings: BotSettings;
}

const TEMPLATES: BuilderTemplate[] = [
  {
    id: 'rise_fall',
    name: 'Rise / Fall Baseline',
    summary: '1-tick Rise/Fall strategy on Volatility 10 (1s) with Martingale off.',
    settings: {
      ...DEFAULT_SETTINGS,
      market: '1HZ10V',
      types: ['Rise'],
      ticks: 1,
      stake: 1,
      tp: 10,
      sl: 20,
    },
  },
  {
    id: 'differs_sniper',
    name: 'Digit Differs Sniper',
    summary: 'High win-rate Digit Differs on Vol 100 with virtual loss filter.',
    settings: {
      ...DEFAULT_SETTINGS,
      market: 'R_100',
      types: ['Differs'],
      digits: { Differs: 9 },
      ticks: 1,
      stake: 1,
      virtual: true,
      vneed: 1,
      mart: true,
      mult: 2.1,
    },
  },
  {
    id: 'hybrid_ou',
    name: 'Hybrid Over/Under Rotation',
    summary: 'Rotates between Over 1 and Under 8 automatically after a loss.',
    settings: {
      ...DEFAULT_SETTINGS,
      market: '1HZ25V',
      mode: 'hybrid',
      types: ['Over', 'Under'],
      digits: { Over: 1, Under: 8 },
      ticks: 1,
      stake: 1,
      mart: true,
      mult: 2.2,
    },
  },
  {
    id: 'higher_lower',
    name: 'Higher / Lower Barrier',
    summary: '5-tick offset barrier contract on Volatility 10 (1s).',
    settings: {
      ...DEFAULT_SETTINGS,
      market: '1HZ10V',
      types: ['Higher'],
      barriers: { Higher: '+0.35', Lower: '-0.35' },
      ticks: 5,
      stake: 1,
      tp: 5,
      sl: 10,
    },
  },
  {
    id: 'accumulator',
    name: 'Accumulator 2% Growth',
    summary: 'Automatic limit-order Take Profit Accumulator strategy.',
    settings: {
      ...DEFAULT_SETTINGS,
      market: '1HZ10V',
      types: ['Accumulator'],
      growth: 0.02,
      atp: 1.5,
      stake: 2,
      tp: 10,
      sl: 15,
    },
  },
];

function loadWorkspace(): { name: string; settings: BotSettings } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: String(parsed.name || 'Otivo Custom Strategy'),
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    }
  } catch {
    // ignore
  }
  return { name: 'Otivo Custom Strategy', settings: DEFAULT_SETTINGS };
}

export const BotBuilderPage: React.FC<BotBuilderPageProps> = ({
  connected,
  hasVirtualToken,
  session,
  currency,
  onStartWithSettings,
  onStopTrading,
  onLoadToTerminal,
  onSaveStrategy,
}) => {
  const initial = loadWorkspace();
  const [strategyName, setStrategyName] = useState(initial.name);
  const [settings, setSettings] = useState<BotSettings>(initial.settings);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isRunning = session.status === 'running' || session.status === 'stopping';

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: strategyName, settings })
      );
    } catch {
      // ignore
    }
  }, [strategyName, settings]);

  const updateSettings = (patch: Partial<BotSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      const hasBarrier = next.types.some(
        (t) => BARRIER_TYPES.includes(t) || t === 'Dual H/L'
      );
      if (hasBarrier && next.ticks < 5) next.ticks = 5;
      if (next.types.includes('Accumulator') && next.stake < 1) next.stake = 1;
      return next;
    });
  };

  const primaryType = settings.types[0] || 'Over';

  const handleExportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ name: strategyName, settings }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'strategy'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (parsed.settings && typeof parsed.settings === 'object') {
          setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
          if (parsed.name) setStrategyName(String(parsed.name));
          setMessage('Strategy imported into workspace.');
          setError(null);
        } else {
          setError('Invalid strategy JSON file.');
        }
      } catch {
        setError('Could not parse strategy file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveToLibrary = async () => {
    setError(null);
    setMessage(null);
    try {
      await onSaveStrategy(strategyName.trim() || 'Builder Strategy', settings);
      setMessage('Saved to Saved Strategies.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save strategy.');
    }
  };

  const handleRunWorkspace = async () => {
    setError(null);
    setMessage(null);
    if (!connected) {
      setError('Connect your Deriv API token using the red button in the top bar first.');
      return;
    }
    try {
      await onStartWithSettings(settings);
    } catch (err: any) {
      setError(err?.message || 'Failed to run strategy.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <section className="rounded-xl border border-[#1F2937] bg-[#111827] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Blocks className="h-5 w-5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <input
              type="text"
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              maxLength={40}
              className="bg-transparent text-base font-semibold text-white focus:outline-none border-b border-transparent focus:border-blue-500"
            />
            <p className="text-xs text-slate-400">
              Visual 4-block automated strategy pipeline · Persisted automatically
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJson}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-700"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
          <button
            type="button"
            onClick={handleSaveToLibrary}
            className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs font-medium text-blue-400 hover:border-blue-500/50"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>
          <button
            type="button"
            onClick={() => onLoadToTerminal(settings)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs font-medium text-slate-200 hover:border-slate-700"
          >
            <span>Open in Terminal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          {isRunning ? (
            <button
              type="button"
              onClick={() => onStopTrading()}
              className="flex items-center gap-1.5 rounded-lg bg-[#ff444f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e63a44]"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!connected}
              onClick={handleRunWorkspace}
              className="flex items-center gap-1.5 rounded-lg bg-[#00a79e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#00948c] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Strategy</span>
            </button>
          )}
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-300">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Quick Strategy Templates */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quick Strategy Templates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              disabled={isRunning}
              onClick={() => {
                setStrategyName(tpl.name);
                const cloned = structuredClone(tpl.settings);
                if (!hasVirtualToken) cloned.virtual = false;
                setSettings(cloned);
                setMessage(`Loaded template "${tpl.name}".`);
              }}
              className="rounded-xl border border-[#1F2937] bg-[#111827] p-3.5 text-left hover:border-blue-500/60 transition-colors space-y-1.5 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <ContractIcon type={tpl.settings.types[0]} className="w-5 h-5" />
                <span className="text-xs font-semibold text-white truncate">
                  {tpl.name}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{tpl.summary}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 4-Block Strategy Workspace */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Block 1: Trade Parameters */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
          <div className="border-b border-[#1F2937] bg-[#161E2E] px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-blue-400">
              1. Trade Parameters
            </span>
            <MarketLogo symbol={settings.market} className="w-6 h-6" />
          </div>
          <div className="p-4 space-y-3.5">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Market Index</label>
              <select
                value={settings.market}
                disabled={isRunning}
                onChange={(e) => updateSettings({ market: e.target.value })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
              >
                {MARKETS.map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.label} ({m.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Contract Type
                </label>
                <select
                  value={primaryType}
                  disabled={isRunning}
                  onChange={(e) => {
                    const nextType = e.target.value as TradeType;
                    updateSettings({
                      types:
                        settings.mode === 'hybrid'
                          ? [nextType, settings.types[1] || 'Under']
                          : [nextType],
                    });
                  }}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  {ALL_TRADE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Stake ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.35"
                  disabled={isRunning}
                  value={settings.stake}
                  onChange={(e) => updateSettings({ stake: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Duration (Ticks)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  disabled={isRunning}
                  value={settings.ticks}
                  onChange={(e) => updateSettings({ ticks: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                />
              </div>

              {DIGIT_TYPES.includes(primaryType) && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Prediction Digit
                  </label>
                  <select
                    value={
                      settings.digits[primaryType as 'Differs' | 'Match' | 'Over' | 'Under'] ??
                      VALID_DIGITS[primaryType as 'Differs' | 'Match' | 'Over' | 'Under'][0]
                    }
                    disabled={isRunning}
                    onChange={(e) =>
                      updateSettings({
                        digits: {
                          ...settings.digits,
                          [primaryType]: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                  >
                    {VALID_DIGITS[primaryType as 'Differs' | 'Match' | 'Over' | 'Under'].map((d) => (
                      <option key={d} value={d}>
                        Digit {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Block 2: Purchase Conditions */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
          <div className="border-b border-[#1F2937] bg-[#161E2E] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">
              2. Purchase & Entry Conditions
            </span>
          </div>
          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              {(['normal', 'fast'] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  disabled={isRunning}
                  onClick={() => updateSettings({ exec: speed })}
                  className={`rounded-lg border py-2 text-xs font-medium capitalize ${
                    settings.exec === speed
                      ? 'border-emerald-500 bg-emerald-600/15 text-white'
                      : 'border-[#1F2937] bg-[#0B0F17] text-slate-400'
                  }`}
                >
                  {speed} Execution
                </button>
              ))}
            </div>

            {hasVirtualToken ? (
              <>
                <label className="flex items-center justify-between rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3.5 py-2.5 text-xs text-slate-200 cursor-pointer">
                  <span>Require Virtual Loss Filter before Real Buy</span>
                  <input
                    type="checkbox"
                    disabled={isRunning}
                    checked={settings.virtual}
                    onChange={(e) => updateSettings({ virtual: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>

                {settings.virtual && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Virtual Losses Needed
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        disabled={isRunning}
                        value={settings.vneed}
                        onChange={(e) => updateSettings({ vneed: Number(e.target.value) })}
                        className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300 pt-5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={settings.cont}
                        onChange={(e) => updateSettings({ cont: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span>Continuous on loss</span>
                    </label>
                  </div>
                )}
              </>
            ) : (
              <p className="rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3.5 py-2.5 text-[11px] text-slate-500">
                Standard real/demo entry active. Add a Virtual API/PAT token in Terminal Settings to unlock Virtual Loss Filtering.
              </p>
            )}
          </div>
        </div>

        {/* Block 3: Risk & Sell Conditions */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
          <div className="border-b border-[#1F2937] bg-[#161E2E] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-400">
              3. Risk & Target Conditions
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Take Profit ({currency})
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                disabled={isRunning}
                value={settings.tp}
                onChange={(e) => updateSettings({ tp: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-emerald-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Stop Loss ({currency})
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                disabled={isRunning}
                value={settings.sl}
                onChange={(e) => updateSettings({ sl: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-red-400"
              />
            </div>
            {settings.types.includes('Accumulator') && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Growth Rate</label>
                  <select
                    value={settings.growth}
                    disabled={isRunning}
                    onChange={(e) => updateSettings({ growth: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                  >
                    {[0.01, 0.02, 0.03, 0.04, 0.05].map((g) => (
                      <option key={g} value={g}>
                        {Math.round(g * 100)}%
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Accumulator TP ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    disabled={isRunning}
                    value={settings.atp}
                    onChange={(e) => updateSettings({ atp: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Block 4: Restart & Martingale Conditions */}
        <div className="rounded-xl border border-[#1F2937] bg-[#111827] overflow-hidden">
          <div className="border-b border-[#1F2937] bg-[#161E2E] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-purple-400">
              4. Restart & Martingale Logic
            </span>
          </div>
          <div className="p-4 space-y-3.5">
            <label className="flex items-center justify-between rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3.5 py-2.5 text-xs text-slate-200 cursor-pointer">
              <span>Enable Martingale Stake Scaling</span>
              <input
                type="checkbox"
                disabled={isRunning}
                checked={settings.mart}
                onChange={(e) => updateSettings({ mart: e.target.checked })}
                className="h-4 w-4 accent-purple-500"
              />
            </label>

            {settings.mart && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Multiplier Factor
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.1"
                    max="100"
                    disabled={isRunning}
                    value={settings.mult}
                    onChange={(e) => updateSettings({ mult: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Switch Ticks From Step
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    disabled={isRunning}
                    value={settings.martTickStep}
                    onChange={(e) =>
                      updateSettings({ martTickStep: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-[#1F2937] bg-[#0B0F17] px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
