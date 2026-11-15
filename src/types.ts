export type AuthMode = 'api_token' | 'pat';

export type ExecSpeed = 'normal' | 'fast';
export type TradingMode = 'single' | 'hybrid';

export type TradeType =
  | 'Differs'
  | 'Over'
  | 'Under'
  | 'Even'
  | 'Odd'
  | 'Rise'
  | 'Fall'
  | 'Higher'
  | 'Lower'
  | 'Accumulator'
  | 'Dual O5/U4'
  | 'Dual H/L';

export interface MarketInfo {
  label: string;
  symbol: string;
  decimals: number;
}

export const MARKETS: MarketInfo[] = [
  { label: 'Vol 10', symbol: 'R_10', decimals: 3 },
  { label: 'Vol 10 (1s)', symbol: '1HZ10V', decimals: 2 },
  { label: 'Vol 15 (1s)', symbol: '1HZ15V', decimals: 2 },
  { label: 'Vol 25', symbol: 'R_25', decimals: 3 },
  { label: 'Vol 25 (1s)', symbol: '1HZ25V', decimals: 2 },
  { label: 'Vol 50', symbol: 'R_50', decimals: 4 },
  { label: 'Vol 50 (1s)', symbol: '1HZ50V', decimals: 2 },
  { label: 'Vol 75', symbol: 'R_75', decimals: 4 },
  { label: 'Vol 75 (1s)', symbol: '1HZ75V', decimals: 2 },
  { label: 'Vol 90 (1s)', symbol: '1HZ90V', decimals: 2 },
  { label: 'Vol 100', symbol: 'R_100', decimals: 2 },
  { label: 'Vol 100 (1s)', symbol: '1HZ100V', decimals: 2 },
];

export const ALL_TRADE_TYPES: TradeType[] = [
  'Differs',
  'Over',
  'Under',
  'Even',
  'Odd',
  'Rise',
  'Fall',
  'Higher',
  'Lower',
  'Accumulator',
  'Dual O5/U4',
  'Dual H/L',
];

export const DIGIT_TYPES: TradeType[] = ['Differs', 'Over', 'Under'];
export const BARRIER_TYPES: TradeType[] = ['Higher', 'Lower'];
export const DUAL_TYPES: TradeType[] = ['Dual O5/U4', 'Dual H/L'];

export const VALID_DIGITS: Record<'Differs' | 'Over' | 'Under', number[]> = {
  Differs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  Over: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  Under: [1, 2, 3, 4, 5, 6, 7, 8, 9],
};

export interface BotSettings {
  market: string;
  exec: ExecSpeed;
  mode: TradingMode;
  types: TradeType[];
  digits: Partial<Record<'Differs' | 'Over' | 'Under', number | null>>;
  barriers: Partial<Record<'Higher' | 'Lower', string>>;
  growth: number; // 0.01 to 0.05
  atp: number; // Accumulator take profit >= 0.01
  stake: number;
  ticks: number; // 1-10 (or 5-10 for Higher/Lower, 0 for Accumulator-only)
  mart: boolean;
  mult: number;
  martTickStep: number; // 0 = disabled, 1-50
  martTicks: number; // alternate tick duration from martTickStep
  virtual: boolean;
  vneed: number; // 1-50 consecutive virtual losses before real trade
  cont: boolean; // continuous real trading until a real win
  tp: number;
  sl: number;
}

export interface SavedStrategy {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: BotSettings;
}

export interface AccountInfo {
  connected: boolean;
  authMode: AuthMode;
  loginId: string;
  accountType: 'REAL' | 'DEMO';
  isVirtual: boolean;
  balance: number;
  currency: string;
  fullname?: string;
  email?: string;
  scopes?: string[];
  appId: string;
  lastUpdated: string;
}

export interface TickPoint {
  epoch: number;
  quote: number;
  lastDigit: number;
}

export interface TradeRecord {
  id: string;
  seq: number;
  timestamp: string;
  isVirtual: boolean;
  market: string;
  marketLabel: string;
  contractType: TradeType;
  label: string;
  contractIds: string[];
  stake: number;
  currency: string;
  ticks: number;
  entrySpot?: number;
  exitSpot?: number;
  profit: number;
  won: boolean;
  legs?: number[];
  martingaleStep: number;
  sessionTotalAfter: number;
  balanceAfter?: number;
}

export interface SessionStats {
  status: 'idle' | 'running' | 'stopping' | 'error';
  startedAt?: string;
  stoppedReason?: string;
  errorMessage?: string;
  realTrades: number;
  realWins: number;
  realLosses: number;
  virtualTrades: number;
  virtualWins: number;
  virtualLossesStreak: number;
  vneed: number;
  inRealPhase: boolean;
  totalProfit: number;
  currentStake: number;
  baseStake: number;
  martingaleStep: number;
  currentTicks: number;
  activeTypeIndex: number;
  activeType: TradeType | null;
  currency: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'win' | 'loss' | 'warn' | 'error';
  message: string;
}

export interface AppSnapshot {
  account: AccountInfo | null;
  session: SessionStats;
  trades: TradeRecord[];
  logs: LogEntry[];
  strategies: SavedStrategy[];
  ticks: TickPoint[];
  tickMarket: string;
}

export const DEFAULT_SETTINGS: BotSettings = {
  market: 'R_100',
  exec: 'normal',
  mode: 'single',
  types: ['Over'],
  digits: { Over: 4 },
  barriers: { Higher: '+0.5', Lower: '-0.5' },
  growth: 0.02,
  atp: 1.0,
  stake: 1.0,
  ticks: 1,
  mart: false,
  mult: 2.1,
  martTickStep: 0,
  martTicks: 2,
  virtual: false,
  vneed: 2,
  cont: true,
  tp: 10,
  sl: 20,
};
