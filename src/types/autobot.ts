export type AutoBotContractType =
  | 'digitdiff'
  | 'digitmatch'
  | 'digitover'
  | 'digitunder'
  | 'dual_ou'
  | 'over_under'
  | 'accumulator';

export type StreakMode =
  | 'consecutive'
  | 'pattern'
  | 'types'
  | 'percentage'
  | 'axa'
  | 'circle_green'
  | 'circle_blue'
  | 'circle_orange'
  | 'circle_red'
  | 'circle_target_pct'
  | 'circle_over_under'
  | 'lad_prng'
  | 'differs_noise'
  | 'price_digits'
  | 'over_under'
  | 'analysis_tool'
  | 'consecutive_touch';

export interface AutoBotAlarm {
  id: string;
  time: string;
  label: string;
  enabled: boolean;
  days?: number[];
  triggeredToday?: string;
}

export interface DiffersCalmNoiseDigitStat {
  digit: number;
  count: number;
  pct: number;
  calmCount: number;
}

export interface DiffersCalmNoiseSignal {
  prediction: number;
  calmDigit: number;
  noiseScore: number;
  calmness: number;
  confirmationTicks: number;
  symbol: string;
  reason: string;
}

export interface DiffersCalmNoiseMetrics {
  noiseScore: number;
  calmness: number;
  calmStreak: number;
  digitStats: DiffersCalmNoiseDigitStat[];
}

export interface AccuNoiseMetrics {
  noiseScore: number;
  choppiness: number;
  variance: number;
  calmStreak: number;
}

export interface AccuNoiseSignal {
  signal: 'BUY_ACCU' | 'WAIT';
  reason: string;
  metrics: AccuNoiseMetrics;
}

export interface CircleOuMarketData {
  isFocused: boolean;
  stage: 'WAITING_LOW_TOUCH' | 'COUNTING_OVER_TOUCH' | 'WAITING_FINAL_TOUCH';
  lowTouchedDigits: number[];
  consecutiveLowCount: number;
  overTouchCount: number;
  finalTouchTicksElapsed: number;
  reqOverTouches: number;
  maxFinalTicks: number;
  lowDigits: number[];
  maxPct: number;
  targetType: 'over' | 'under';
  barrierDigit: number;
  triggered: boolean;
  label: string;
}

export interface AutoBotSignalQueueItem {
  symbol: string;
  type: string;
  contractType: 'DIGITDIFF' | 'DIGITMATCH' | 'DIGITOVER' | 'DIGITUNDER' | 'DUAL_OU' | 'ACCU';
  prediction: number;
  prediction2?: number;
  amount: number;
  timestamp: number;
  accuGrowthRate?: number;
  accuTakeProfit?: number;
  barrier?: number;
  matchedPatternKey?: string;
  strategyName?: string | null;
}
