import React from 'react';
import { Activity, TrendingDown, TrendingUp, Target, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { OtivoSignal, OtivoSignalCard } from './AnalysisCharts';

export const NEURAL_MARKETS = [
  '1HZ10V',
  'R_10',
  '1HZ25V',
  'R_25',
  '1HZ50V',
  '1HZ75V',
  'R_50',
  '1HZ100V',
];

interface OtivoNeuralModalProps {
  showScanResults: boolean;
  onCloseScanResults: () => void;
  neuralMarketData: Record<string, { lastDigit: number; count: number }>;
  activeSections: string[];
  onToggleSection: (id: string) => void;
  otivoSignals: {
    over: OtivoSignal[];
    under: OtivoSignal[];
    differ: OtivoSignal[];
  };
  otivoLog: string[];
  onLoadSignal: (sig: OtivoSignal) => void;
  isScanning: boolean;
  scanProgress: number;
  isAutoTrading: boolean;
  onStopAutoTrade: () => void;
  autoSessionProfit: number;
  currentAutoStake: number;
  scannerSettings: {
    stake: number;
    martingale: number;
    martingaleAfter: number;
    tp: number;
    sl: number;
  };
  scanBestMarket: any;
  tpSlResult: { type: 'tp' | 'sl'; profit: number } | null;
  onCloseTpSlResult: () => void;
}

export const OtivoNeuralModal: React.FC<OtivoNeuralModalProps> = ({
  showScanResults,
  onCloseScanResults,
  neuralMarketData,
  activeSections,
  onToggleSection,
  otivoSignals,
  otivoLog,
  onLoadSignal,
  isScanning,
  scanProgress,
  isAutoTrading,
  onStopAutoTrade,
  autoSessionProfit,
  currentAutoStake,
  scannerSettings,
  scanBestMarket,
  tpSlResult,
  onCloseTpSlResult,
}) => {
  return (
    <>
      {/* Scanning Feedback Overlay */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="max-w-md w-full text-center space-y-8">
              <div className="relative flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  className="w-48 h-48 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
                  <span className="text-4xl font-black text-white">{scanProgress}%</span>
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">
                    AI Scanning
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Searching Markets...
                </h3>
                <p className="text-sm text-[#9ba1a6] font-medium">
                  Scrutinizing price action across all synthetic indices for the best entry point.
                </p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Scan Results Modal - OTIVO AI Edition */}
      <AnimatePresence>
        {showScanResults && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-[1400px] bg-[#0b0f1a] rounded-2xl sm:rounded-[2.5rem] border border-white/5 shadow-2xl p-4 sm:p-8 space-y-4 sm:space-y-8 max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <h3 className="text-xl sm:text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                    <span className="text-emerald-500 italic">OTIVO</span> SCANNER
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onCloseScanResults}
                  className="p-2 sm:p-3 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all active:scale-90 cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Neural Market Cards Bar */}
              <div className="flex overflow-x-auto sm:grid sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-3 shrink-0 pb-2 sm:pb-0 scrollbar-hide">
                {NEURAL_MARKETS.map((m) => {
                  const data = neuralMarketData[m];
                  return (
                    <div
                      key={m}
                      className={cn(
                        'bg-[#172035]/40 border border-white/5 rounded-xl p-2.5 sm:p-3 flex flex-col items-center transition-all shrink-0 sm:shrink min-w-[75px] sm:min-w-0',
                        data?.lastDigit !== undefined &&
                          (data.lastDigit > 5 ? 'border-t-emerald-500/50' : 'border-t-blue-500/50')
                      )}
                    >
                      <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 mb-1.5 sm:mb-2 uppercase">
                        {m}
                      </span>
                      <span className="text-lg sm:text-2xl font-black text-white font-mono leading-none">
                        {data?.lastDigit ?? '--'}
                      </span>
                      <div className="w-full mt-1.5 sm:mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, data?.count || 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Toggle Switches Bar */}
              <div className="flex items-center gap-4 shrink-0 overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex items-center gap-2">
                  {[
                    { id: 'over', label: 'Over 5+', bg: 'bg-emerald-500/10' },
                    { id: 'under', label: 'Under 4', bg: 'bg-blue-500/10' },
                    { id: 'differ', label: 'Differ', bg: 'bg-purple-500/10' },
                  ].map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => onToggleSection(sec.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 cursor-pointer',
                        activeSections.includes(sec.id)
                          ? `${sec.bg} border-white/20 text-white`
                          : 'bg-transparent border-white/5 text-slate-600'
                      )}
                    >
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          activeSections.includes(sec.id)
                            ? sec.id === 'over'
                              ? 'bg-emerald-500'
                              : sec.id === 'under'
                              ? 'bg-blue-500'
                              : 'bg-purple-500'
                            : 'bg-slate-700'
                        )}
                      />
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* OTIVO Dashboard Columns */}
              <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 overflow-y-auto lg:overflow-hidden min-h-0 custom-scrollbar">
                {/* OVER Patterns */}
                {activeSections.includes('over') && (
                  <div className="flex-1 bg-[#172035]/40 rounded-xl sm:rounded-3xl border border-white/5 p-4 sm:p-6 flex flex-col shrink-0 lg:shrink lg:min-w-0">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h4 className="text-emerald-400 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] flex items-center gap-2 truncate">
                        <TrendingUp size={16} /> OVER 5+ Patterns
                      </h4>
                      <span className="hidden sm:inline-block text-[9px] font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/10 uppercase tracking-tighter">
                        Strength &gt; 70%
                      </span>
                    </div>
                    <div className="lg:flex-1 lg:overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {otivoSignals.over.length > 0 ? (
                        otivoSignals.over.map((sig) => (
                          <OtivoSignalCard
                            key={sig.id}
                            signal={sig}
                            onClick={() => onLoadSignal(sig)}
                          />
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-center p-6 sm:p-10">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                            Listening for <br /> high-digit patterns...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* UNDER Patterns */}
                {activeSections.includes('under') && (
                  <div className="flex-1 bg-[#172035]/40 rounded-xl sm:rounded-3xl border border-white/5 p-4 sm:p-6 flex flex-col shrink-0 lg:shrink lg:min-w-0">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h4 className="text-blue-400 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] flex items-center gap-2 truncate">
                        <TrendingDown size={16} /> UNDER 4 Patterns
                      </h4>
                      <span className="hidden sm:inline-block text-[9px] font-mono bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/10 uppercase tracking-tighter">
                        Strength &gt; 70%
                      </span>
                    </div>
                    <div className="lg:flex-1 lg:overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {otivoSignals.under.length > 0 ? (
                        otivoSignals.under.map((sig) => (
                          <OtivoSignalCard
                            key={sig.id}
                            signal={sig}
                            onClick={() => onLoadSignal(sig)}
                          />
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-center p-6 sm:p-10">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                            Listening for <br /> low-digit patterns...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DIFFER Patterns */}
                {activeSections.includes('differ') && (
                  <div className="flex-1 bg-[#172035]/40 rounded-xl sm:rounded-3xl border border-white/5 p-4 sm:p-6 flex flex-col shrink-0 lg:shrink lg:min-w-0">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h4 className="text-purple-400 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] flex items-center gap-2 truncate">
                        <Target size={16} /> DIFFER Absences
                      </h4>
                      <span className="hidden sm:inline-block text-[9px] font-mono bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded border border-purple-500/10 uppercase tracking-tighter">
                        Zero Recurrence
                      </span>
                    </div>
                    <div className="lg:flex-1 lg:overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {otivoSignals.differ.length > 0 ? (
                        otivoSignals.differ.map((sig) => (
                          <OtivoSignalCard
                            key={sig.id}
                            signal={sig}
                            onClick={() => onLoadSignal(sig)}
                          />
                        ))
                      ) : (
                        <div className="h-full flex items-center justify-center text-center p-6 sm:p-10">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                            Identifying <br /> statistical gaps...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Discovery Log */}
                <div className="lg:w-80 shrink-0 bg-[#070b14] rounded-xl sm:rounded-3xl border border-emerald-500/20 p-4 sm:p-6 flex flex-col shadow-2xl min-h-[200px] lg:min-h-0 overflow-hidden">
                  <h4 className="text-slate-200 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] flex items-center gap-2 mb-4 sm:mb-6">
                    <Activity size={16} className="text-emerald-400" /> AI Discovery Log
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar font-mono text-[9px]">
                    {otivoLog.length > 0 ? (
                      otivoLog.map((log, i) => (
                        <div key={i} className="pb-1 border-b border-white/5 text-slate-400">
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-emerald-500/50 animate-pulse italic">
                        Initializing Neural Net...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="shrink-0 pt-6 border-t border-white/5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onCloseScanResults}
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl transition-all border border-white/10 active:scale-[0.98] cursor-pointer"
                >
                  CLOSE ENGINE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auto-Trading Dashboard Stats */}
      {isAutoTrading && (
        <div className="fixed bottom-10 right-10 z-[80]">
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            className="bg-[#111217] rounded-3xl border border-indigo-500/40 p-6 shadow-2xl backdrop-blur-xl w-72 space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Bot Active
                </span>
              </div>
              <button
                type="button"
                onClick={onStopAutoTrade}
                className="p-1.5 hover:bg-rose-500/10 text-[#555] hover:text-rose-500 rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">
                  Session Profit
                </span>
                <span
                  className={cn(
                    'text-lg font-black tracking-tight',
                    autoSessionProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  ${Number(autoSessionProfit || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">
                  Next Stake
                </span>
                <span className="text-white font-black">
                  ${Number(currentAutoStake || 0).toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-[#0a0b0d] h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        (Math.abs(autoSessionProfit) /
                          (autoSessionProfit >= 0 ? scannerSettings.tp : scannerSettings.sl)) *
                          100
                      )
                    )}%`,
                  }}
                  className={cn(
                    'h-full',
                    autoSessionProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                  )}
                />
              </div>
              <div className="flex justify-between text-[8px] font-black uppercase text-[#444] tracking-widest pt-1">
                <span>Start</span>
                <span>TP: ${scannerSettings.tp}</span>
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
              <p className="text-[8px] font-black text-[#555] uppercase tracking-widest">
                Target Market
              </p>
              <p className="text-xs font-bold text-white truncate">
                {scanBestMarket?.name || scanBestMarket?.symbol || 'Scanning'}
              </p>
              <p className="text-[9px] font-black text-indigo-400 uppercase">
                Digit: {scanBestMarket?.digit ?? '—'} (Differ)
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* TP/SL Conclusion Modal */}
      <AnimatePresence>
        {tpSlResult && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                'w-full max-w-sm p-8 rounded-[2.5rem] border text-center space-y-6 shadow-2xl relative overflow-hidden bg-[#0b0e14]',
                tpSlResult.type === 'tp'
                  ? 'border-emerald-500/30'
                  : 'border-rose-500/30'
              )}
            >
              <div
                className={cn(
                  'absolute -top-20 -right-20 w-40 h-40 blur-[80px] rounded-full opacity-20',
                  tpSlResult.type === 'tp' ? 'bg-emerald-400' : 'bg-rose-400'
                )}
              />

              <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center animate-bounce shadow-inner bg-white/5">
                {tpSlResult.type === 'tp' ? (
                  <TrendingUp size={40} className="text-emerald-400" />
                ) : (
                  <TrendingDown size={40} className="text-rose-400" />
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-black text-[#555] uppercase tracking-[0.4em]">
                  Session Finished
                </h3>
                <h2 className="text-3xl font-black text-white tracking-tighter">
                  {tpSlResult.type === 'tp' ? 'Target Profit Hit!' : 'Stop Loss Triggered'}
                </h2>
              </div>

              <div className="flex flex-col items-center justify-center space-y-1 py-4">
                <span className="text-[10px] font-black text-[#555] uppercase tracking-widest leading-none mb-1">
                  Total Profit
                </span>
                <span
                  className={cn(
                    'text-5xl font-black tracking-tighter',
                    tpSlResult.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  ${Number(tpSlResult.profit || 0).toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={onCloseTpSlResult}
                className={cn(
                  'w-full py-4 rounded-2xl font-black text-white transition-all shadow-xl active:scale-95 cursor-pointer',
                  tpSlResult.type === 'tp'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                )}
              >
                CLOSE REPORT
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
