import type { AutoBotAlarm, AutoBotContractType, StreakMode } from './autobot';
import type { HackerMathSummary } from '../lib/hackerMath';

export interface CloudToastEvent {
  id: number;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

export interface AutoBotCloudConfig {
  contractType: AutoBotContractType;
  targetDigit: number;
  targetDigit2: number;
  streakThreshold: number;
  isLossStreakThresholdEnabled: boolean;
  lossStreakThreshold: number;
  streakMode: StreakMode;
  priceDigitsInput: string;
  ouSamplePeriod: number;
  ouColdThresholdMax: number;
  ouSingleDigitMax: number;
  isEdmsEnabled: boolean;
  ouPatternSelection: 'over1' | 'under8';
  analysisOppositeSignalEnabled: boolean;

  isRecoveryStreakModeEnabled: boolean;
  recoveryStreakMode: StreakMode;
  recoveryContractType: AutoBotContractType;
  recoveryTargetDigit: number;
  recoveryAccumulatorGrowthRate: number;
  recoveryAccumulatorTakeProfit: number;
  recoveryOuPatternSelection: 'over1' | 'under8';
  recoveryPriceDigitsInput: string;
  recoveryCustomPattern: string;
  recoveryStreakThreshold: number;
  recoveryIsLossStreakThresholdEnabled: boolean;
  recoveryLossStreakThreshold: number;
  recoveryPercentageThreshold: number;
  recoveryIsExactPercentage: boolean;
  recoveryTypesTransitionMatrix: boolean;
  recoveryTypesMirrorDigitReversal: boolean;
  recoveryTypesTickCompression: boolean;
  recoveryTypesHiddenCycleLength: boolean;
  recoveryPatternSmartMode: boolean;
  recoveryPatternRotationalMode: boolean;
  recoveryPatternRecoveryMode: boolean;
  recoveryPatternSmartDigit: number | null;
  recoveryAnalysisOppositeSignalEnabled: boolean;
  recoveryConsecTouchOpposingTicks: number;
  recoveryConsecTouchTargetDigits: number;
  recoveryConsecTouchTouchType: 'target' | 'any';

  percentageThreshold: number;
  isExactPercentage: boolean;
  isCirclesMode: boolean;
  circlesTicksLimit: number;
  circleEntryModeEnabled: boolean;
  circleTargetPct: number;
  circleCompareMode: 'higher' | 'lower';
  circleFilterDigits: string;

  circleOuTargetType: 'over' | 'under';
  circleOuDigit: number;
  circleOuMaxPct: number;
  circleOuLowDigits: string;
  circleOuLowTouchMode: 'consecutive' | 'one_by_one';
  circleOuOverTouchCount: number;
  circleOuFinalTouchMaxTicks: number;

  consecTouchOpposingTicks: number;
  consecTouchTargetDigits: number;
  consecTouchTouchType: 'target' | 'any';

  pmfPatternLen: number;
  pmfMinOccurrences: number;
  pmfFollowerLen: number;

  tradeDuration: number;
  isRandomTicks: boolean;

  accumulatorGrowthRate: number;
  accumulatorTakeProfit: number;
  accuStrategies: Record<string, boolean>;

  differsNoiseMaxScore: number;
  differsNoiseMinCalmTicks: number;
  differsNoiseTargetMode: 'latest' | 'top_calm';

  customPattern: string;
  typesTransitionMatrix: boolean;
  typesMirrorDigitReversal: boolean;
  typesTickCompression: boolean;
  typesHiddenCycleLength: boolean;
  patternSmartMode: boolean;
  patternSmartDigit: number | null;
  patternRotationalMode: boolean;
  patternRecoveryMode: boolean;

  isContinuousTrading: boolean;
  alternateMarketRecovery: boolean;
  checkedMarkets: string[];
  stake: number;
  isAutoStakeEnabled: boolean;
  martingale: number;

  useVirtualLoss: boolean;
  virtualAfterRealLoss: boolean;
  virtualLossThreshold: number;

  isRunsLimitEnabled: boolean;
  runsLimit: number;
  takeProfit: number;
  stopLoss: number;
  runForever: boolean;
  autoRestartAfterTp: boolean;
  autoRestartMaxTp: number;

  alarms: AutoBotAlarm[];
  isAlarmSchedulerEnabled: boolean;
  timezoneOffsetMinutes?: number;
}

export interface AutoBotCloudState {
  running: boolean;
  wins: number;
  losses: number;
  consecLosses: number;
  virtualWins: number;
  virtualLosses: number;
  consecVirtualLosses: number;
  sessionProfit: number;
  cumulativeProfit: number;
  currentStake: number;
  isCurrentTradeReal: boolean;
  lockedVirtualMarket: string | null;
  continuousLockedMarket: string | null;
  lostPatterns: string[];
  customPattern: string;
  patternSmartDigit: number | null;
  autoRestartAfterTp: boolean;
  logs: string[];
  alarms: AutoBotAlarm[];
  lastEvent: CloudToastEvent | null;
}

export interface GridMasterCloudConfig {
  markets: string[];
  strategyMode: 'over1_under8' | 'over4_under5';
  stake: number;
  martingale: number;
  duration: number;
  tp: number;
  sl: number;
  useVirtual: boolean;
  virtualLossTarget: number;
}

export interface GridMasterCloudState {
  running: boolean;
  wins: number;
  losses: number;
  virtualWins: number;
  virtualLosses: number;
  profit: number;
  currentStake: number;
  statusLog: string;
  errorMsg: string | null;
}

export interface FrequencyCloudConfig {
  symbol: string;
  analysisWindow: number;
  stake: number;
  autoStakeEnabled: boolean;
  autoStakePct: number;
  martingale: number;
  targetPct: number;
  contractType: 'coldest' | 'differ' | 'over' | 'under' | 'even' | 'odd';
  tp: number;
  sl: number;
  maxRunsEnabled: boolean;
  maxRuns: number;
  duration: number;
  evenOddMode: 'high_even' | 'low_even' | 'low_odd' | 'high_odd';
  benchmarkPct: number;
  digitFilterEnabled: boolean;
  filterDigits: string;
  filterCompareMode: 'higher' | 'lower';
  smartRecoveryEnabled: boolean;
  circleModeEnabled: boolean;
  circleType: 'green' | 'red' | 'blue' | 'orange';
  recoveryCircleType: 'green' | 'red' | 'blue' | 'orange';
  predictionDigit: number;
  recoveryPredictionDigit: number;
  recoveryContractType: 'coldest' | 'differ' | 'over' | 'under' | 'even' | 'odd';
  recoveryTargetPct: number;
  recoveryCompareMode: 'higher' | 'lower';
  recoveryFilterDigits: string;
  virtualMode: boolean;
  virtualLossesTarget: number;
  marketSwitchMode: 'off' | 'loss' | 'always';
}

export interface FrequencyCloudState {
  running: boolean;
  symbol: string;
  wins: number;
  losses: number;
  virtualWins: number;
  virtualLosses: number;
  sessionProfit: number;
  currentStake: number;
  statusLog: string;
  errorMsg: string | null;
  lastEvent: CloudToastEvent | null;
}

export interface AiScannerCloudConfig {
  symbol: string;
  name?: string;
  digit: number;
  stake: number;
  martingale: number;
  martingaleAfter: number;
  tp: number;
  sl: number;
  marketSwitchMode: 'off' | 'loss' | 'always';
}

export interface AiScannerCloudState {
  running: boolean;
  symbol: string;
  digit: number;
  sessionProfit: number;
  currentStake: number;
  wins: number;
  losses: number;
  tpSlResult: { type: 'tp' | 'sl'; profit: number } | null;
  errorMsg: string | null;
  lastEvent: CloudToastEvent | null;
}

export interface AiHackerCloudConfig {
  stake: number;
  martingaleMultiplier: number;
  martingaleAfterLosses: number;
  durationTicks: number;
  maxTrades: number;
  virtualMode: boolean;
  virtualLosses: number;
  autoRestartWin: boolean;
  sameMarketRecovery: boolean;
  continuousSameMarket: boolean;
  recoveryContract: 'DIGITOVER' | 'DIGITUNDER';
}

export interface AiHackerCloudState {
  running: boolean;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  virtualStats: { wins: number; losses: number };
  sessionProfit: number;
  currentStake: number;
  logs: string[];
  mathSummaries: Record<string, HackerMathSummary>;
  marketDigits: Record<string, number[]>;
  errorMsg: string | null;
}

export interface CloudBotsSnapshot {
  autobot: AutoBotCloudState;
  gridMaster: GridMasterCloudState;
  frequency: FrequencyCloudState;
  aiScanner: AiScannerCloudState;
  aiHacker: AiHackerCloudState;
}
