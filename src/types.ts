export type AuthMode = 'api_token' | 'pat';

export type ExecSpeed = 'normal' | 'fast';
export type TradingMode = 'single' | 'hybrid';

export type TradeType =
  | 'Differs'
  | 'Match'
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
  { label: 'Vol 15 (1s)', symbol: '1HZ15V', decimals: 3 },
  { label: 'Vol 25', symbol: 'R_25', decimals: 3 },
  { label: 'Vol 25 (1s)', symbol: '1HZ25V', decimals: 2 },
  { label: 'Vol 30 (1s)', symbol: '1HZ30V', decimals: 3 },
  { label: 'Vol 50', symbol: 'R_50', decimals: 4 },
  { label: 'Vol 50 (1s)', symbol: '1HZ50V', decimals: 2 },
  { label: 'Vol 75', symbol: 'R_75', decimals: 4 },
  { label: 'Vol 75 (1s)', symbol: '1HZ75V', decimals: 2 },
  { label: 'Vol 90 (1s)', symbol: '1HZ90V', decimals: 3 },
  { label: 'Vol 100', symbol: 'R_100', decimals: 2 },
  { label: 'Vol 100 (1s)', symbol: '1HZ100V', decimals: 2 },
];

export const AUTOBOT_MARKETS: MarketInfo[] = [
  { label: 'Vol 10 (1s) Index', symbol: '1HZ10V', decimals: 2 },
  { label: 'Vol 15 (1s) Index', symbol: '1HZ15V', decimals: 3 },
  { label: 'Vol 25 (1s) Index', symbol: '1HZ25V', decimals: 2 },
  { label: 'Vol 30 (1s) Index', symbol: '1HZ30V', decimals: 3 },
  { label: 'Vol 50 (1s) Index', symbol: '1HZ50V', decimals: 2 },
  { label: 'Vol 75 (1s) Index', symbol: '1HZ75V', decimals: 2 },
  { label: 'Vol 90 (1s) Index', symbol: '1HZ90V', decimals: 3 },
  { label: 'Vol 100 (1s) Index', symbol: '1HZ100V', decimals: 2 },
  { label: 'Vol 10 Index', symbol: 'R_10', decimals: 3 },
  { label: 'Vol 25 Index', symbol: 'R_25', decimals: 3 },
  { label: 'Vol 50 Index', symbol: 'R_50', decimals: 4 },
  { label: 'Vol 75 Index', symbol: 'R_75', decimals: 4 },
  { label: 'Vol 100 Index', symbol: 'R_100', decimals: 2 },
  { label: 'Jump 10 Index', symbol: 'JD10', decimals: 2 },
  { label: 'Jump 25 Index', symbol: 'JD25', decimals: 2 },
  { label: 'Jump 50 Index', symbol: 'JD50', decimals: 2 },
  { label: 'Jump 100 Index', symbol: 'JD100', decimals: 2 },
  { label: 'Bull Market Index', symbol: 'RDBULL', decimals: 4 },
  { label: 'Bear Market Index', symbol: 'RDBEAR', decimals: 4 },
];

export const MT5_SYMBOLS: MarketInfo[] = [
  { label: 'Boom 50', symbol: 'BOOM50', decimals: 4 },
  { label: 'Boom 150', symbol: 'BOOM150', decimals: 4 },
  { label: 'Boom 300', symbol: 'BOOM300N', decimals: 4 },
  { label: 'Boom 500', symbol: 'BOOM500', decimals: 4 },
  { label: 'Boom 1000', symbol: 'BOOM1000', decimals: 4 },
  { label: 'Crash 50', symbol: 'CRASH50', decimals: 4 },
  { label: 'Crash 150', symbol: 'CRASH150', decimals: 4 },
  { label: 'Crash 300', symbol: 'CRASH300N', decimals: 4 },
  { label: 'Crash 500', symbol: 'CRASH500', decimals: 4 },
  { label: 'Crash 1000', symbol: 'CRASH1000', decimals: 4 },
  { label: 'Volatility 10 (1s)', symbol: '1HZ10V', decimals: 2 },
  { label: 'Volatility 10', symbol: 'R_10', decimals: 3 },
  { label: 'Volatility 25 (1s)', symbol: '1HZ25V', decimals: 2 },
  { label: 'Volatility 25', symbol: 'R_25', decimals: 3 },
  { label: 'Volatility 50 (1s)', symbol: '1HZ50V', decimals: 2 },
  { label: 'Volatility 50', symbol: 'R_50', decimals: 4 },
  { label: 'Volatility 100 (1s)', symbol: '1HZ100V', decimals: 2 },
  { label: 'Volatility 100', symbol: 'R_100', decimals: 2 },
];

export const ALL_TRADE_TYPES: TradeType[] = [
  'Differs',
  'Match',
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

export const DIGIT_TYPES: TradeType[] = ['Differs', 'Match', 'Over', 'Under'];
export const BARRIER_TYPES: TradeType[] = ['Higher', 'Lower'];
export const DUAL_TYPES: TradeType[] = ['Dual O5/U4', 'Dual H/L'];

export const VALID_DIGITS: Record<'Differs' | 'Match' | 'Over' | 'Under', number[]> = {
  Differs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  Match: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  Over: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  Under: [1, 2, 3, 4, 5, 6, 7, 8, 9],
};

export interface BotSettings {
  market: string;
  exec: ExecSpeed;
  mode: TradingMode;
  types: TradeType[];
  digits: Partial<Record<'Differs' | 'Match' | 'Over' | 'Under', number | null>>;
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

export interface VirtualAccountInfo {
  connected: boolean;
  authMode: AuthMode;
  accountId?: string;
  loginId: string;
  accountType: 'REAL' | 'DEMO';
  isVirtual: boolean;
  balance: number;
  currency: string;
  appId: string;
  lastUpdated: string;
}

export interface TickPoint {
  epoch: number;
  quote: number;
  lastDigit: number;
}

export type ContractStage =
  | 'NOT_RUNNING'
  | 'STARTING'
  | 'PURCHASE_SENT'
  | 'CONTRACT_OPEN'
  | 'CONTRACT_CLOSED'
  | 'IS_STOPPING';

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
  payout: number;
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
  contractStage: ContractStage;
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
  totalStake: number;
  totalPayout: number;
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

export interface ActiveTrade {
  id: string;
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
  currentSpot?: number;
  timestamp: string;
}

export interface OpenPosition {
  id: string;
  symbol: string;
  contractType: string;
  buyPrice: number;
  profit: number;
  currency: string;
  entrySpot?: number;
  currentSpot?: number;
  isSold?: boolean;
}

export interface AppSnapshot {
  account: AccountInfo | null;
  virtualAccount: VirtualAccountInfo | null;
  hasVirtualToken: boolean;
  session: SessionStats;
  activeTrade?: ActiveTrade | null;
  trades: TradeRecord[];
  logs: LogEntry[];
  strategies: SavedStrategy[];
  ticks: TickPoint[];
  tickMarket: string;
  settings?: BotSettings;
  multiTicks?: Record<string, TickPoint[]>;
  positions?: OpenPosition[];
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
