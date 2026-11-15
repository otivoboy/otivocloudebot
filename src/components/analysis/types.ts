export interface TickData {
  epoch: number;
  quote: number;
  digit: number;
}

export interface CandleData {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type DerivTimeframe =
  | '1t'
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '5h'
  | '1d';

export interface TimeframeSignal {
  tf: DerivTimeframe;
  label: string;
  direction: 'RISE' | 'FALL' | 'NEUTRAL';
  strength: number;
  rsi: number;
  emaFast: number;
  emaSlow: number;
  lastClose: number;
}

export type DerivContractAnalysisType =
  | 'pressure_noise'
  | 'over_under'
  | 'even_odd'
  | 'rise_fall'
  | 'differs'
  | 'accumulators';

export interface AnalysisMarketWindow {
  id: string;
  symbol: string;
  contractMode?: DerivContractAnalysisType;
}

export interface SymbolDefinition {
  id: string;
  name: string;
}

export const ANALYSIS_SYMBOLS: SymbolDefinition[] = [
  { id: '1HZ10V', name: 'Volatility 10 (1s) Index' },
  { id: '1HZ15V', name: 'Volatility 15 (1s) Index' },
  { id: 'R_10', name: 'Volatility 10 Index' },
  { id: '1HZ25V', name: 'Volatility 25 (1s) Index' },
  { id: '1HZ30V', name: 'Volatility 30 (1s) Index' },
  { id: 'R_25', name: 'Volatility 25 Index' },
  { id: '1HZ50V', name: 'Volatility 50 (1s) Index' },
  { id: 'R_50', name: 'Volatility 50 Index' },
  { id: '1HZ75V', name: 'Volatility 75 (1s) Index' },
  { id: 'R_75', name: 'Volatility 75 Index' },
  { id: '1HZ90V', name: 'Volatility 90 (1s) Index' },
  { id: '1HZ100V', name: 'Volatility 100 (1s) Index' },
  { id: 'R_100', name: 'Volatility 100 Index' },
  { id: 'BOOM500', name: 'Boom 500 Index' },
  { id: 'BOOM1000', name: 'Boom 1000 Index' },
  { id: 'CRASH500', name: 'Crash 500 Index' },
  { id: 'CRASH1000', name: 'Crash 1000 Index' },
  { id: 'JD10', name: 'Jump 10 Index' },
  { id: 'JD25', name: 'Jump 25 Index' },
  { id: 'JD50', name: 'Jump 50 Index' },
  { id: 'JD100', name: 'Jump 100 Index' },
  { id: 'RDBULL', name: 'Bull Market Index' },
  { id: 'RDBEAR', name: 'Bear Market Index' },
];

export const MARKET_DECIMALS: Record<string, number> = {
  '1HZ10V': 2,
  '1HZ15V': 3,
  '1HZ25V': 2,
  '1HZ30V': 3,
  '1HZ50V': 2,
  '1HZ75V': 2,
  '1HZ90V': 3,
  '1HZ100V': 2,
  'R_10': 3,
  'R_25': 3,
  'R_50': 4,
  'R_75': 4,
  'R_100': 2,
  'JD10': 2,
  'JD25': 2,
  'JD50': 2,
  'JD100': 2,
  'RDBULL': 4,
  'RDBEAR': 4,
  'BOOM500': 4,
  'BOOM1000': 4,
  'CRASH500': 4,
  'CRASH1000': 4,
};

export function getSymbolDecimals(sym: string, activePipSize?: number): number {
  if (MARKET_DECIMALS[sym] !== undefined) return MARKET_DECIMALS[sym];
  const size = activePipSize || 0.01;
  return Math.max(0, Math.ceil(-Math.log10(size)));
}

export function isVolatilityIndex(sym: string): boolean {
  return sym.startsWith('R_') || (sym.startsWith('1HZ') && sym.endsWith('V'));
}
