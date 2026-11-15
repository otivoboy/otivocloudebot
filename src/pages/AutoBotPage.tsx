import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Info,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  Square,
  Square as SquareIcon,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  BotSettings,
  SessionStats,
  TickPoint,
} from '../types';
import {
  ALL_AUTOBOT_SYMBOLS,
  AUTOBOT_MARKET_CONFIGS,
  computeAccumulatorMetrics,
  computeAILearnerSignal,
  computeAXASignal,
  computeEDMSSignal,
  computeLADPrngSignal,
  computeOverUnderScannerSignal,
  evaluatePriceDigitsSignal,
} from '../lib/autobotEngines';
import {
  computeAccumulatorSignal,
  computeDiffersCalmNoiseSignal,
  computeDiffersSignal,
  computeMatchSignal,
  computeOverUnderSignal,
} from '../lib/autobotSignals';
import {
  AutoBotAlarm,
  AutoBotContractType,
  AutoBotSignalQueueItem,
  StreakMode,
} from '../types/autobot';
import { AutoBotAlarmScheduler } from '../components/autobot/AutoBotAlarmScheduler';
import { AutoBotMarketCard, AutoBotTickCardData } from '../components/autobot/AutoBotMarketCard';
import { AutoBotAnalysisSignalsPanel } from '../components/autobot/AutoBotAnalysisSignalsPanel';
import { cn } from '../lib/utils';

interface AutoBotPageProps {
  multiTicks: Record<string, TickPoint[]>;
  session: SessionStats;
  connected: boolean;
  currency: string;
  accountBalance: number;
  accountType: 'REAL' | 'DEMO';
  hasVirtualToken: boolean;
  onSubscribeMarkets: (symbols: string[]) => void;
  onStartWithSettings: (settings: BotSettings) => Promise<void>;
  onStopTrading: () => Promise<void>;
  onLoadToTerminal: (settings: BotSettings) => void;
}

interface ToastItem {
  id: number;
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

interface NeuralSignalChip {
  id: string;
  symbol: string;
  seq: string;
  conf: number;
  type: 'differ' | 'over' | 'under';
}

const VALID_STREAK_MODES: StreakMode[] = [
  'consecutive',
  'pattern',
  'types',
  'percentage',
  'axa',
  'circle_green',
  'circle_blue',
  'circle_orange',
  'circle_red',
  'circle_target_pct',
  'circle_over_under',
  'lad_prng',
  'differs_noise',
  'price_digits',
  'over_under',
  'analysis_tool',
  'consecutive_touch',
];

function readLsStreakMode(key: string, fallback: StreakMode): StreakMode {
  try {
    let saved = localStorage.getItem(key);
    if (saved === 'mpe' || saved === 'ne') saved = 'axa';
    if (saved && VALID_STREAK_MODES.includes(saved as StreakMode)) {
      return saved as StreakMode;
    }
  } catch {
    // ignore
  }
  return fallback;
}

function readLsContractType(key: string, fallback: AutoBotContractType): AutoBotContractType {
  try {
    const saved = localStorage.getItem(key);
    if (
      saved === 'digitdiff' ||
      saved === 'digitmatch' ||
      saved === 'accumulator' ||
      saved === 'over_under' ||
      saved === 'dual_ou' ||
      saved === 'digitover' ||
      saved === 'digitunder'
    ) {
      return saved;
    }
  } catch {
    // ignore
  }
  return fallback;
}

const ACCU_STRATEGY_LIST = [
  {
    id: 'accu_noise',
    name: 'Accu Noise (Choppiness & Calm Detector)',
    desc: 'Measures real-time tick noise score (0-100), Choppiness Index and spike risk. Automatically triggers BUY_ACCU when noise drops below calm threshold (<= 42) with calm streak.',
    indicators: 'Accu Noise Engine',
  },
  {
    id: 'trend_exhaustion',
    name: 'Trend Exhaustion',
    desc: 'EMA 20/50 flatten, RSI returns toward 50, candles get smaller. Avoid: strong momentum.',
    indicators: 'EMA 20, EMA 50, RSI 14',
  },
  {
    id: 'bb_squeeze',
    name: 'Bollinger Band Squeeze',
    desc: 'Narrow BB bands, price oscillates near middle band without breakout.',
    indicators: 'Bollinger Bands (20,2)',
  },
  {
    id: 'atr_volatility',
    name: 'ATR Low Volatility',
    desc: 'ATR below average and remaining flat/decreasing.',
    indicators: 'ATR (14)',
  },
  {
    id: 'adx_range',
    name: 'ADX Range Filter',
    desc: 'ADX under 25, sideways range / weak trend.',
    indicators: 'ADX (14)',
  },
  {
    id: 'tick_speed',
    name: 'Tick Variance',
    desc: 'Consistently low tick variance over chosen window.',
    indicators: 'Rolling Tick Std Dev',
  },
  {
    id: 'ma_flatness',
    name: 'Moving Average Flatness',
    desc: 'Horizontal EMAs, price crossing back and forth.',
    indicators: 'EMA 20, EMA 50',
  },
  {
    id: 'donchian_range',
    name: 'Donchian Channel Range',
    desc: 'Price stays near center of channel, avoiding upper/lower bounds.',
    indicators: 'Donchian Channels (20)',
  },
  {
    id: 'keltner_stability',
    name: 'Keltner Channel Stability',
    desc: 'Price tracks closely around center.',
    indicators: 'Keltner Channels (20, 1.5)',
  },
  {
    id: 'std_dev',
    name: 'Std Dev Filter',
    desc: 'Price standard deviation remains below historical average.',
    indicators: 'Price Std Dev',
  },
  {
    id: 'ai_volatility',
    name: 'AI Volatility Probability',
    desc: 'Low volatility pattern probability stays above 80%.',
    indicators: 'AI Volatility Engine',
  },
  {
    id: 'analysis_tool',
    name: 'Analysis Tool Live Signals',
    desc: 'Auto-trades ACCU when the Analysis Tool emits a BUY_ACCU signal for this market.',
    indicators: 'Analysis Engine',
  },
];

export const AutoBotPage: React.FC<AutoBotPageProps> = ({
  connected,
  currency,
  accountBalance,
  hasVirtualToken,
  onSubscribeMarkets,
}) => {
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // Core strategy config
  const [contractType, setContractTypeState] = useState<AutoBotContractType>(() =>
    readLsContractType('autobot_contract_type', 'digitdiff')
  );
  const [targetDigit, setTargetDigit] = useState(() =>
    parseInt(localStorage.getItem('autobot_target_digit') || '4', 10)
  );
  const [targetDigit2, setTargetDigit2] = useState(() =>
    parseInt(localStorage.getItem('autobot_target_digit2') || '3', 10)
  );
  const [streakThreshold, setStreakThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_streak_threshold') || '4', 10)
  );
  const [isLossStreakThresholdEnabled, setIsLossStreakThresholdEnabled] = useState(
    () => localStorage.getItem('autobot_loss_streak_threshold_enabled') === 'true'
  );
  const [lossStreakThreshold, setLossStreakThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_loss_streak_threshold') || '2', 10)
  );
  const [streakMode, setStreakMode] = useState<StreakMode>(() =>
    readLsStreakMode('autobot_streak_mode', 'consecutive')
  );

  // Sub-strategy configs
  const [priceDigitsInput, setPriceDigitsInput] = useState(
    () => localStorage.getItem('autobot_price_digits_input') || '.01, .1780, .392'
  );
  const [ouSamplePeriod, setOuSamplePeriod] = useState(() =>
    parseInt(localStorage.getItem('autobot_ou_sample_period') || '100', 10)
  );
  const [ouColdThresholdMax, setOuColdThresholdMax] = useState(() =>
    parseFloat(localStorage.getItem('autobot_ou_cold_threshold_max') || '12.0')
  );
  const [ouSingleDigitMax, setOuSingleDigitMax] = useState(() =>
    parseFloat(localStorage.getItem('autobot_ou_single_digit_max') || '6.0')
  );
  const [isEdmsEnabled, setIsEdmsEnabled] = useState(
    () => localStorage.getItem('autobot_is_edms_enabled') === 'true'
  );
  const [ouPatternSelection, setOuPatternSelection] = useState<'over1' | 'under8'>(() =>
    localStorage.getItem('autobot_ou_pattern_selection') === 'under8' ? 'under8' : 'over1'
  );
  const [analysisOppositeSignalEnabled, setAnalysisOppositeSignalEnabled] = useState(
    () => localStorage.getItem('autobot_analysis_opposite_signal') === 'true'
  );

  // Recovery Strategy (Post-Loss Part)
  const [isRecoveryStreakModeEnabled, setIsRecoveryStreakModeEnabled] = useState(
    () => localStorage.getItem('autobot_is_recovery_streak_mode_enabled') === 'true'
  );
  const [recoveryStreakMode, setRecoveryStreakMode] = useState<StreakMode>(() =>
    readLsStreakMode('autobot_recovery_streak_mode', 'consecutive')
  );
  const [recoveryContractType, setRecoveryContractType] = useState<AutoBotContractType>(() =>
    readLsContractType('autobot_recovery_contract_type', 'digitdiff')
  );
  const [recoveryTargetDigit, setRecoveryTargetDigit] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_target_digit') || '4', 10)
  );
  const [recoveryAccumulatorGrowthRate, setRecoveryAccumulatorGrowthRate] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_accumulator_growth_rate') || '2', 10)
  );
  const [recoveryAccumulatorTakeProfit, setRecoveryAccumulatorTakeProfit] = useState(() =>
    parseFloat(localStorage.getItem('autobot_recovery_accumulator_take_profit') || '10.0')
  );
  const [recoveryOuPatternSelection, setRecoveryOuPatternSelection] = useState<'over1' | 'under8'>(
    () =>
      localStorage.getItem('autobot_recovery_ou_pattern_selection') === 'under8' ? 'under8' : 'over1'
  );
  const [recoveryPriceDigitsInput, setRecoveryPriceDigitsInput] = useState(
    () => localStorage.getItem('autobot_recovery_price_digits_input') || '.01, .1780, .392'
  );
  const [recoveryCustomPattern, setRecoveryCustomPattern] = useState(
    () => localStorage.getItem('autobot_recovery_custom_pattern') || '686'
  );
  const [recoveryStreakThreshold, setRecoveryStreakThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_streak_threshold') || '4', 10)
  );
  const [recoveryIsLossStreakThresholdEnabled, setRecoveryIsLossStreakThresholdEnabled] = useState(
    () => localStorage.getItem('autobot_recovery_is_loss_streak_threshold_enabled') === 'true'
  );
  const [recoveryLossStreakThreshold, setRecoveryLossStreakThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_loss_streak_threshold') || '2', 10)
  );
  const [recoveryPercentageThreshold, setRecoveryPercentageThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_percentage_threshold') || '80', 10)
  );
  const [recoveryIsExactPercentage, setRecoveryIsExactPercentage] = useState(
    () => localStorage.getItem('autobot_recovery_is_exact_percentage') === 'true'
  );
  const [recoveryTypesTransitionMatrix, setRecoveryTypesTransitionMatrix] = useState(
    () => localStorage.getItem('autobot_recovery_types_transition_matrix') !== 'false'
  );
  const [recoveryTypesMirrorDigitReversal, setRecoveryTypesMirrorDigitReversal] = useState(
    () => localStorage.getItem('autobot_recovery_types_mirror_digit_reversal') !== 'false'
  );
  const [recoveryTypesTickCompression, setRecoveryTypesTickCompression] = useState(
    () => localStorage.getItem('autobot_recovery_types_tick_compression') !== 'false'
  );
  const [recoveryTypesHiddenCycleLength, setRecoveryTypesHiddenCycleLength] = useState(
    () => localStorage.getItem('autobot_recovery_types_hidden_cycle_length') !== 'false'
  );
  const [recoveryPatternSmartMode, setRecoveryPatternSmartMode] = useState(
    () => localStorage.getItem('autobot_recovery_pattern_smart_mode') === 'true'
  );
  const [recoveryPatternRotationalMode, setRecoveryPatternRotationalMode] = useState(
    () => localStorage.getItem('autobot_recovery_pattern_rotational_mode') === 'true'
  );
  const [recoveryPatternRecoveryMode, setRecoveryPatternRecoveryMode] = useState(
    () => localStorage.getItem('autobot_recovery_pattern_recovery_mode') !== 'false'
  );
  const [recoveryPatternSmartDigit, setRecoveryPatternSmartDigit] = useState<number | null>(() => {
    const val = localStorage.getItem('autobot_recovery_pattern_smart_digit');
    return val !== null ? parseInt(val, 10) : null;
  });
  const [recoveryAnalysisOppositeSignalEnabled, setRecoveryAnalysisOppositeSignalEnabled] =
    useState(() => localStorage.getItem('autobot_recovery_analysis_opposite_signal') === 'true');
  const [recoveryConsecTouchOpposingTicks, setRecoveryConsecTouchOpposingTicks] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_consec_touch_opposing_ticks') || '3', 10)
  );
  const [recoveryConsecTouchTargetDigits, setRecoveryConsecTouchTargetDigits] = useState(() =>
    parseInt(localStorage.getItem('autobot_recovery_consec_touch_target_digits') || '1', 10)
  );
  const [recoveryConsecTouchTouchType, setRecoveryConsecTouchTouchType] = useState<'target' | 'any'>(
    () =>
      localStorage.getItem('autobot_recovery_consec_touch_touch_type') === 'any' ? 'any' : 'target'
  );

  // Percentage & Circles
  const [percentageThreshold, setPercentageThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_percentage_threshold') || '80', 10)
  );
  const [isExactPercentage, setIsExactPercentage] = useState(
    () => localStorage.getItem('autobot_is_exact_percentage') === 'true'
  );
  const [isCirclesMode, setIsCirclesMode] = useState(
    () => localStorage.getItem('autobot_circles_mode') === 'true'
  );
  const [circlesTicksLimit, setCirclesTicksLimit] = useState(() =>
    parseInt(localStorage.getItem('autobot_circles_ticks_limit') || '1000', 10)
  );
  const [circleEntryModeEnabled, setCircleEntryModeEnabled] = useState(
    () => localStorage.getItem('autobot_circle_entry_mode_enabled') === 'true'
  );
  const [circleTargetPct, setCircleTargetPct] = useState(() =>
    parseFloat(localStorage.getItem('autobot_circle_target_pct') || '10.0')
  );
  const [circleCompareMode, setCircleCompareMode] = useState<'higher' | 'lower'>(() =>
    localStorage.getItem('autobot_circle_compare_mode') === 'lower' ? 'lower' : 'higher'
  );
  const [circleFilterDigits, setCircleFilterDigits] = useState(
    () => localStorage.getItem('autobot_circle_filter_digits') || 'all'
  );

  // Circle O/U Builder
  const [circleOuTargetType, setCircleOuTargetType] = useState<'over' | 'under'>(() =>
    localStorage.getItem('autobot_circle_ou_target_type') === 'under' ? 'under' : 'over'
  );
  const [circleOuDigit, setCircleOuDigit] = useState(() =>
    parseInt(localStorage.getItem('autobot_circle_ou_digit') || '1', 10)
  );
  const [circleOuMaxPct, setCircleOuMaxPct] = useState(() =>
    parseFloat(localStorage.getItem('autobot_circle_ou_max_pct') || '9.0')
  );
  const [circleOuLowDigits, setCircleOuLowDigits] = useState(
    () => localStorage.getItem('autobot_circle_ou_low_digits') || '0,1'
  );
  const [circleOuLowTouchMode, setCircleOuLowTouchMode] = useState<'consecutive' | 'one_by_one'>(
    () =>
      localStorage.getItem('autobot_circle_ou_low_touch_mode') === 'one_by_one'
        ? 'one_by_one'
        : 'consecutive'
  );
  const [circleOuOverTouchCount, setCircleOuOverTouchCount] = useState(() =>
    parseInt(localStorage.getItem('autobot_circle_ou_over_touch_count') || '2', 10)
  );
  const [circleOuFinalTouchMaxTicks, setCircleOuFinalTouchMaxTicks] = useState(() =>
    parseInt(localStorage.getItem('autobot_circle_ou_final_touch_max_ticks') || '3', 10)
  );

  // Consecutive & Touch
  const [consecTouchOpposingTicks, setConsecTouchOpposingTicks] = useState(() =>
    parseInt(localStorage.getItem('autobot_consec_touch_opposing_ticks') || '3', 10)
  );
  const [consecTouchTargetDigits, setConsecTouchTargetDigits] = useState(() =>
    parseInt(localStorage.getItem('autobot_consec_touch_target_digits') || '1', 10)
  );
  const [consecTouchTouchType, setConsecTouchTouchType] = useState<'target' | 'any'>(() =>
    localStorage.getItem('autobot_consec_touch_touch_type') === 'any' ? 'any' : 'target'
  );

  // Pattern Follower Differ (LAD PRNG)
  const [pmfPatternLen, setPmfPatternLen] = useState(() =>
    parseInt(localStorage.getItem('autobot_pmf_pattern_len') || '3', 10)
  );
  const [pmfMinOccurrences, setPmfMinOccurrences] = useState(() =>
    parseInt(localStorage.getItem('autobot_pmf_min_occurrences') || '3', 10)
  );
  const [pmfFollowerLen, setPmfFollowerLen] = useState(() =>
    parseInt(localStorage.getItem('autobot_pmf_follower_len') || '2', 10)
  );

  // Duration & Random Ticks
  const [tradeDuration, setTradeDuration] = useState(() =>
    Math.min(10, Math.max(1, parseInt(localStorage.getItem('autobot_trade_duration') || '2', 10)))
  );
  const [isRandomTicks, setIsRandomTicks] = useState(
    () => localStorage.getItem('autobot_random_ticks') === 'true'
  );

  // Accumulator
  const [accumulatorGrowthRate, setAccumulatorGrowthRate] = useState(() =>
    parseInt(localStorage.getItem('autobot_accumulator_growth_rate') || '2', 10)
  );
  const [accumulatorTakeProfit, setAccumulatorTakeProfit] = useState(() =>
    parseFloat(localStorage.getItem('autobot_accumulator_take_profit') || '10.0')
  );
  const [accuStrategies, setAccuStrategies] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {
      accu_noise: true,
      trend_exhaustion: true,
      bb_squeeze: true,
      atr_volatility: true,
      adx_range: true,
      tick_speed: true,
      ma_flatness: true,
      donchian_range: true,
      keltner_stability: true,
      std_dev: true,
      ai_volatility: true,
      analysis_tool: false,
    };
    try {
      const saved = localStorage.getItem('autobot_accumulator_strategies');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Differs Calm Noise
  const [differsNoiseMaxScore, setDiffersNoiseMaxScore] = useState(() =>
    parseInt(localStorage.getItem('autobot_differs_noise_max_score') || '35', 10)
  );
  const [differsNoiseMinCalmTicks, setDiffersNoiseMinCalmTicks] = useState(() =>
    parseInt(localStorage.getItem('autobot_differs_noise_min_calm_ticks') || '3', 10)
  );
  const [differsNoiseTargetMode, setDiffersNoiseTargetMode] = useState<'latest' | 'top_calm'>(() =>
    localStorage.getItem('autobot_differs_noise_target_mode') === 'top_calm' ? 'top_calm' : 'latest'
  );

  // Pattern & Types
  const [customPattern, setCustomPattern] = useState(
    () => localStorage.getItem('autobot_custom_pattern') || '686'
  );
  const [typesTransitionMatrix, setTypesTransitionMatrix] = useState(
    () => localStorage.getItem('autobot_types_transition_matrix') !== 'false'
  );
  const [typesMirrorDigitReversal, setTypesMirrorDigitReversal] = useState(
    () => localStorage.getItem('autobot_types_mirror_digit_reversal') !== 'false'
  );
  const [typesTickCompression, setTypesTickCompression] = useState(
    () => localStorage.getItem('autobot_types_tick_compression') !== 'false'
  );
  const [typesHiddenCycleLength, setTypesHiddenCycleLength] = useState(
    () => localStorage.getItem('autobot_types_hidden_cycle_length') !== 'false'
  );
  const [patternSmartMode, setPatternSmartMode] = useState(
    () => localStorage.getItem('autobot_pattern_smart_mode') === 'true'
  );
  const [patternSmartDigit, setPatternSmartDigit] = useState<number | null>(() => {
    const val = localStorage.getItem('autobot_pattern_smart_digit');
    return val !== null ? parseInt(val, 10) : null;
  });
  const [patternRotationalMode, setPatternRotationalMode] = useState(
    () => localStorage.getItem('autobot_pattern_rotational_mode') === 'true'
  );
  const [patternRecoveryMode, setPatternRecoveryMode] = useState(
    () => localStorage.getItem('autobot_pattern_recovery_mode') !== 'false'
  );

  // Market & Execution controls
  const [isContinuousTrading, setIsContinuousTrading] = useState(
    () => localStorage.getItem('autobot_continuous_trading') === 'true'
  );
  const [alternateMarketRecovery, setAlternateMarketRecovery] = useState(
    () => localStorage.getItem('autobot_alternate_market_recovery') !== 'false'
  );
  const [checkedMarkets, setCheckedMarkets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('autobot_checked_markets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const sym of ['1HZ15V', '1HZ30V', '1HZ90V']) {
            if (!parsed.includes(sym)) parsed.push(sym);
          }
          return parsed.filter((s: string) => ALL_AUTOBOT_SYMBOLS.includes(s));
        }
      }
    } catch {
      // ignore
    }
    return ALL_AUTOBOT_SYMBOLS;
  });
  const [stake, setStake] = useState(() =>
    parseFloat(localStorage.getItem('autobot_stake') || '1')
  );
  const [isAutoStakeEnabled, setIsAutoStakeEnabled] = useState(
    () => localStorage.getItem('autobot_auto_stake_enabled') === 'true'
  );
  const [martingale, setMartingale] = useState(() =>
    parseFloat(localStorage.getItem('autobot_martingale') || '2')
  );

  // Virtual Loss Filter (Strictly unlocked ONLY when hasVirtualToken is true)
  const [useVirtualLoss, setUseVirtualLoss] = useState(
    () => localStorage.getItem('autobot_use_virtual_loss') === 'true'
  );
  const [virtualAfterRealLoss, setVirtualAfterRealLoss] = useState(
    () => localStorage.getItem('autobot_virtual_after_real_loss') === 'true'
  );
  const [virtualLossThreshold, setVirtualLossThreshold] = useState(() =>
    parseInt(localStorage.getItem('autobot_virtual_loss_threshold') || '2', 10)
  );
  const [virtualWinsCount, setVirtualWinsCount] = useState(0);
  const [virtualLossesCount, setVirtualLossesCount] = useState(0);
  const [consecutiveVirtualLosses, setConsecutiveVirtualLosses] = useState(0);
  const [lockedVirtualMarket, setLockedVirtualMarket] = useState<string | null>(null);
  const [isCurrentTradeReal, setIsCurrentTradeReal] = useState(false);

  // Profit / Risk / Runs / Auto-Restart
  const [isRunsLimitEnabled, setIsRunsLimitEnabled] = useState(
    () => localStorage.getItem('autobot_is_runs_limit_enabled') === 'true'
  );
  const [runsLimit, setRunsLimit] = useState(() =>
    Math.min(10, Math.max(1, parseInt(localStorage.getItem('autobot_runs_limit') || '5', 10)))
  );
  const [takeProfit, setTakeProfit] = useState(() =>
    parseFloat(localStorage.getItem('autobot_take_profit') || '10')
  );
  const [stopLoss, setStopLoss] = useState(() =>
    parseFloat(localStorage.getItem('autobot_stop_loss') || '20')
  );
  const [runForever, setRunForever] = useState(
    () => localStorage.getItem('autobot_run_forever') === 'true'
  );
  const [autoRestartAfterTp, setAutoRestartAfterTp] = useState(
    () => localStorage.getItem('autobot_auto_restart_after_tp') === 'true'
  );
  const [autoRestartMaxTp, setAutoRestartMaxTp] = useState(() =>
    parseFloat(localStorage.getItem('autobot_auto_restart_max_tp') || '50')
  );

  // Alarms
  const [alarms, setAlarms] = useState<AutoBotAlarm[]>(() => {
    try {
      const saved = localStorage.getItem('autobot_alarms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAlarmSchedulerEnabled, setIsAlarmSchedulerEnabled] = useState(
    () => localStorage.getItem('autobot_alarm_scheduler_enabled') !== 'false'
  );
  const [newAlarmTime, setNewAlarmTime] = useState('09:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [currentTimeStr, setCurrentTimeStr] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  });

  // Live trading metrics & logs
  const [sessionProfit, setSessionProfit] = useState(0);
  const [cumulativeSessionProfit, setCumulativeSessionProfit] = useState(() =>
    parseFloat(sessionStorage.getItem('autobot_cumulativeSessionProfit') || '0')
  );
  const [winsCount, setWinsCount] = useState(0);
  const [lossesCount, setLossesCount] = useState(0);
  const [consecLosses, setConsecLosses] = useState(0);
  const [currentStake, setCurrentStake] = useState(stake);
  const [lostPatternsState, setLostPatternsState] = useState<string[]>([]);
  const [otivoLog, setOtivoLog] = useState<string[]>([]);
  const [neuralSignals, setNeuralSignals] = useState<NeuralSignalChip[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Live ticks state
  const [marketTicks, setMarketTicks] = useState<Record<string, AutoBotTickCardData>>({});

  // Effective virtual mode strictly gated on Virtual API / PAT Token presence
  const effectiveUseVirtualLoss = hasVirtualToken && useVirtualLoss;

  // Enforce virtual mode off if token is disconnected or absent
  useEffect(() => {
    if (!hasVirtualToken) {
      lockedVirtualMarketRef.current = null;
      setLockedVirtualMarket(null);
      setIsCurrentTradeReal(true);
    }
  }, [hasVirtualToken]);

  const notify = useCallback((type: ToastItem['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [{ id, type, message }, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Auto-stake calculation
  const autoStakeValue = useMemo(() => {
    const bal = accountBalance > 0 ? accountBalance : 100;
    const m = Math.max(1.1, martingale || 2);
    const val = (bal * 0.98) / (1 + m);
    return Math.max(0.35, Math.min(830, Math.round(val * 100) / 100));
  }, [accountBalance, martingale]);

  const effectiveBaseStake = isAutoStakeEnabled ? autoStakeValue : Math.max(0.35, stake);

  // Sync active settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('autobot_contract_type', contractType);
      localStorage.setItem('autobot_target_digit', String(targetDigit));
      localStorage.setItem('autobot_target_digit2', String(targetDigit2));
      localStorage.setItem('autobot_streak_threshold', String(streakThreshold));
      localStorage.setItem('autobot_loss_streak_threshold_enabled', String(isLossStreakThresholdEnabled));
      localStorage.setItem('autobot_loss_streak_threshold', String(lossStreakThreshold));
      localStorage.setItem('autobot_streak_mode', streakMode);
      localStorage.setItem('autobot_price_digits_input', priceDigitsInput);
      localStorage.setItem('autobot_ou_sample_period', String(ouSamplePeriod));
      localStorage.setItem('autobot_ou_cold_threshold_max', String(ouColdThresholdMax));
      localStorage.setItem('autobot_ou_single_digit_max', String(ouSingleDigitMax));
      localStorage.setItem('autobot_is_edms_enabled', String(isEdmsEnabled));
      localStorage.setItem('autobot_ou_pattern_selection', ouPatternSelection);
      localStorage.setItem('autobot_analysis_opposite_signal', String(analysisOppositeSignalEnabled));
      localStorage.setItem('autobot_is_recovery_streak_mode_enabled', String(isRecoveryStreakModeEnabled));
      localStorage.setItem('autobot_recovery_streak_mode', recoveryStreakMode);
      localStorage.setItem('autobot_recovery_contract_type', recoveryContractType);
      localStorage.setItem('autobot_recovery_target_digit', String(recoveryTargetDigit));
      localStorage.setItem('autobot_recovery_accumulator_growth_rate', String(recoveryAccumulatorGrowthRate));
      localStorage.setItem('autobot_recovery_accumulator_take_profit', String(recoveryAccumulatorTakeProfit));
      localStorage.setItem('autobot_recovery_ou_pattern_selection', recoveryOuPatternSelection);
      localStorage.setItem('autobot_recovery_price_digits_input', recoveryPriceDigitsInput);
      localStorage.setItem('autobot_recovery_custom_pattern', recoveryCustomPattern);
      localStorage.setItem('autobot_recovery_streak_threshold', String(recoveryStreakThreshold));
      localStorage.setItem('autobot_recovery_is_loss_streak_threshold_enabled', String(recoveryIsLossStreakThresholdEnabled));
      localStorage.setItem('autobot_recovery_loss_streak_threshold', String(recoveryLossStreakThreshold));
      localStorage.setItem('autobot_recovery_percentage_threshold', String(recoveryPercentageThreshold));
      localStorage.setItem('autobot_recovery_is_exact_percentage', String(recoveryIsExactPercentage));
      localStorage.setItem('autobot_recovery_types_transition_matrix', String(recoveryTypesTransitionMatrix));
      localStorage.setItem('autobot_recovery_types_mirror_digit_reversal', String(recoveryTypesMirrorDigitReversal));
      localStorage.setItem('autobot_recovery_types_tick_compression', String(recoveryTypesTickCompression));
      localStorage.setItem('autobot_recovery_types_hidden_cycle_length', String(recoveryTypesHiddenCycleLength));
      localStorage.setItem('autobot_recovery_pattern_smart_mode', String(recoveryPatternSmartMode));
      localStorage.setItem('autobot_recovery_pattern_rotational_mode', String(recoveryPatternRotationalMode));
      localStorage.setItem('autobot_recovery_pattern_recovery_mode', String(recoveryPatternRecoveryMode));
      localStorage.setItem('autobot_recovery_analysis_opposite_signal', String(recoveryAnalysisOppositeSignalEnabled));
      localStorage.setItem('autobot_recovery_consec_touch_opposing_ticks', String(recoveryConsecTouchOpposingTicks));
      localStorage.setItem('autobot_recovery_consec_touch_target_digits', String(recoveryConsecTouchTargetDigits));
      localStorage.setItem('autobot_recovery_consec_touch_touch_type', recoveryConsecTouchTouchType);
      localStorage.setItem('autobot_percentage_threshold', String(percentageThreshold));
      localStorage.setItem('autobot_is_exact_percentage', String(isExactPercentage));
      localStorage.setItem('autobot_circles_mode', String(isCirclesMode));
      localStorage.setItem('autobot_circles_ticks_limit', String(circlesTicksLimit));
      localStorage.setItem('autobot_circle_entry_mode_enabled', String(circleEntryModeEnabled));
      localStorage.setItem('autobot_circle_target_pct', String(circleTargetPct));
      localStorage.setItem('autobot_circle_compare_mode', circleCompareMode);
      localStorage.setItem('autobot_circle_filter_digits', circleFilterDigits);
      localStorage.setItem('autobot_circle_ou_target_type', circleOuTargetType);
      localStorage.setItem('autobot_circle_ou_digit', String(circleOuDigit));
      localStorage.setItem('autobot_circle_ou_max_pct', String(circleOuMaxPct));
      localStorage.setItem('autobot_circle_ou_low_digits', circleOuLowDigits);
      localStorage.setItem('autobot_circle_ou_low_touch_mode', circleOuLowTouchMode);
      localStorage.setItem('autobot_circle_ou_over_touch_count', String(circleOuOverTouchCount));
      localStorage.setItem('autobot_circle_ou_final_touch_max_ticks', String(circleOuFinalTouchMaxTicks));
      localStorage.setItem('autobot_consec_touch_opposing_ticks', String(consecTouchOpposingTicks));
      localStorage.setItem('autobot_consec_touch_target_digits', String(consecTouchTargetDigits));
      localStorage.setItem('autobot_consec_touch_touch_type', consecTouchTouchType);
      localStorage.setItem('autobot_pmf_pattern_len', String(pmfPatternLen));
      localStorage.setItem('autobot_pmf_min_occurrences', String(pmfMinOccurrences));
      localStorage.setItem('autobot_pmf_follower_len', String(pmfFollowerLen));
      localStorage.setItem('autobot_trade_duration', String(tradeDuration));
      localStorage.setItem('autobot_random_ticks', String(isRandomTicks));
      localStorage.setItem('autobot_differs_noise_max_score', String(differsNoiseMaxScore));
      localStorage.setItem('autobot_differs_noise_min_calm_ticks', String(differsNoiseMinCalmTicks));
      localStorage.setItem('autobot_differs_noise_target_mode', differsNoiseTargetMode);
      localStorage.setItem('autobot_custom_pattern', customPattern);
      localStorage.setItem('autobot_types_transition_matrix', String(typesTransitionMatrix));
      localStorage.setItem('autobot_types_mirror_digit_reversal', String(typesMirrorDigitReversal));
      localStorage.setItem('autobot_types_tick_compression', String(typesTickCompression));
      localStorage.setItem('autobot_types_hidden_cycle_length', String(typesHiddenCycleLength));
      localStorage.setItem('autobot_pattern_smart_mode', String(patternSmartMode));
      localStorage.setItem('autobot_pattern_rotational_mode', String(patternRotationalMode));
      localStorage.setItem('autobot_pattern_recovery_mode', String(patternRecoveryMode));
      localStorage.setItem('autobot_continuous_trading', String(isContinuousTrading));
      localStorage.setItem('autobot_alternate_market_recovery', String(alternateMarketRecovery));
      localStorage.setItem('autobot_checked_markets', JSON.stringify(checkedMarkets));
      localStorage.setItem('autobot_stake', String(stake));
      localStorage.setItem('autobot_auto_stake_enabled', String(isAutoStakeEnabled));
      localStorage.setItem('autobot_martingale', String(martingale));
      localStorage.setItem('autobot_use_virtual_loss', String(useVirtualLoss));
      localStorage.setItem('autobot_virtual_after_real_loss', String(virtualAfterRealLoss));
      localStorage.setItem('autobot_virtual_loss_threshold', String(virtualLossThreshold));
      localStorage.setItem('autobot_is_runs_limit_enabled', String(isRunsLimitEnabled));
      localStorage.setItem('autobot_runs_limit', String(runsLimit));
      localStorage.setItem('autobot_take_profit', String(takeProfit));
      localStorage.setItem('autobot_stop_loss', String(stopLoss));
      localStorage.setItem('autobot_run_forever', String(runForever));
      localStorage.setItem('autobot_auto_restart_after_tp', String(autoRestartAfterTp));
      localStorage.setItem('autobot_auto_restart_max_tp', String(autoRestartMaxTp));
      localStorage.setItem('autobot_alarms', JSON.stringify(alarms));
      localStorage.setItem('autobot_alarm_scheduler_enabled', String(isAlarmSchedulerEnabled));
    } catch {
      // ignore storage errors
    }
  });

  // Refs for real-time WS & execution loops (avoid stale closures)
  const tickHistories = useRef<Record<string, number[]>>({});
  const priceHistories = useRef<Record<string, number[]>>({});
  const marketTicksRef = useRef<Record<string, AutoBotTickCardData>>({});
  const lastStateUpdateRef = useRef(0);
  const stateUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTradeTimePerSymbol = useRef<Record<string, number>>({});
  const patternRotationalIdx = useRef<Record<string, number>>({});
  const circleOuMarketStatesRef = useRef<Record<string, {
    stage: 'WAITING_LOW_TOUCH' | 'COUNTING_OVER_TOUCH' | 'WAITING_FINAL_TOUCH';
    lowTouchedDigits: number[];
    consecutiveLowCount: number;
    overTouchCount: number;
    finalTouchTicksElapsed: number;
  }>>({});

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const signalQueueRef = useRef<AutoBotSignalQueueItem[]>([]);
  const tradeInFlightRef = useRef(false);

  const sessionProfitRef = useRef(sessionProfit);
  sessionProfitRef.current = sessionProfit;
  const cumulativeSessionProfitRef = useRef(cumulativeSessionProfit);
  cumulativeSessionProfitRef.current = cumulativeSessionProfit;
  const winsCountRef = useRef(winsCount);
  winsCountRef.current = winsCount;
  const lossesCountRef = useRef(lossesCount);
  lossesCountRef.current = lossesCount;
  const consecLossesRef = useRef(consecLosses);
  consecLossesRef.current = consecLosses;
  const consecVirtualLossesRef = useRef(consecutiveVirtualLosses);
  consecVirtualLossesRef.current = consecutiveVirtualLosses;
  const lockedVirtualMarketRef = useRef<string | null>(lockedVirtualMarket);
  lockedVirtualMarketRef.current = lockedVirtualMarket;
  const continuousLockedMarketRef = useRef<string | null>(null);
  const lastLostMarketRef = useRef<string | null>(null);
  const lastLossTimeRef = useRef<number>(0);
  const lostPatternsRef = useRef<string[]>(lostPatternsState);
  lostPatternsRef.current = lostPatternsState;
  const currentStakeRef = useRef<number>(effectiveBaseStake);

  useEffect(() => {
    if (!isRunning) {
      setCurrentStake(effectiveBaseStake);
      currentStakeRef.current = effectiveBaseStake;
    }
  }, [effectiveBaseStake, isRunning]);

  // Config refs
  const contractTypeRef = useRef(contractType);
  contractTypeRef.current = contractType;
  const targetDigitRef = useRef(targetDigit);
  targetDigitRef.current = targetDigit;
  const targetDigit2Ref = useRef(targetDigit2);
  targetDigit2Ref.current = targetDigit2;
  const streakThresholdRef = useRef(streakThreshold);
  streakThresholdRef.current = streakThreshold;
  const isLossStreakThresholdEnabledRef = useRef(isLossStreakThresholdEnabled);
  isLossStreakThresholdEnabledRef.current = isLossStreakThresholdEnabled;
  const lossStreakThresholdRef = useRef(lossStreakThreshold);
  lossStreakThresholdRef.current = lossStreakThreshold;
  const streakModeRef = useRef(streakMode);
  streakModeRef.current = streakMode;
  const priceDigitsInputRef = useRef(priceDigitsInput);
  priceDigitsInputRef.current = priceDigitsInput;
  const ouSamplePeriodRef = useRef(ouSamplePeriod);
  ouSamplePeriodRef.current = ouSamplePeriod;
  const ouColdThresholdMaxRef = useRef(ouColdThresholdMax);
  ouColdThresholdMaxRef.current = ouColdThresholdMax;
  const ouSingleDigitMaxRef = useRef(ouSingleDigitMax);
  ouSingleDigitMaxRef.current = ouSingleDigitMax;
  const isEdmsEnabledRef = useRef(isEdmsEnabled);
  isEdmsEnabledRef.current = isEdmsEnabled;
  const ouPatternSelectionRef = useRef(ouPatternSelection);
  ouPatternSelectionRef.current = ouPatternSelection;
  const analysisOppositeSignalEnabledRef = useRef(analysisOppositeSignalEnabled);
  analysisOppositeSignalEnabledRef.current = analysisOppositeSignalEnabled;

  // Recovery config refs
  const isRecoveryStreakModeEnabledRef = useRef(isRecoveryStreakModeEnabled);
  isRecoveryStreakModeEnabledRef.current = isRecoveryStreakModeEnabled;
  const recoveryStreakModeRef = useRef(recoveryStreakMode);
  recoveryStreakModeRef.current = recoveryStreakMode;
  const recoveryContractTypeRef = useRef(recoveryContractType);
  recoveryContractTypeRef.current = recoveryContractType;
  const recoveryTargetDigitRef = useRef(recoveryTargetDigit);
  recoveryTargetDigitRef.current = recoveryTargetDigit;
  const recoveryAccumulatorGrowthRateRef = useRef(recoveryAccumulatorGrowthRate);
  recoveryAccumulatorGrowthRateRef.current = recoveryAccumulatorGrowthRate;
  const recoveryAccumulatorTakeProfitRef = useRef(recoveryAccumulatorTakeProfit);
  recoveryAccumulatorTakeProfitRef.current = recoveryAccumulatorTakeProfit;
  const recoveryOuPatternSelectionRef = useRef(recoveryOuPatternSelection);
  recoveryOuPatternSelectionRef.current = recoveryOuPatternSelection;
  const recoveryPriceDigitsInputRef = useRef(recoveryPriceDigitsInput);
  recoveryPriceDigitsInputRef.current = recoveryPriceDigitsInput;
  const recoveryCustomPatternRef = useRef(recoveryCustomPattern);
  recoveryCustomPatternRef.current = recoveryCustomPattern;
  const recoveryStreakThresholdRef = useRef(recoveryStreakThreshold);
  recoveryStreakThresholdRef.current = recoveryStreakThreshold;
  const recoveryIsLossStreakThresholdEnabledRef = useRef(recoveryIsLossStreakThresholdEnabled);
  recoveryIsLossStreakThresholdEnabledRef.current = recoveryIsLossStreakThresholdEnabled;
  const recoveryLossStreakThresholdRef = useRef(recoveryLossStreakThreshold);
  recoveryLossStreakThresholdRef.current = recoveryLossStreakThreshold;
  const recoveryPercentageThresholdRef = useRef(recoveryPercentageThreshold);
  recoveryPercentageThresholdRef.current = recoveryPercentageThreshold;
  const recoveryIsExactPercentageRef = useRef(recoveryIsExactPercentage);
  recoveryIsExactPercentageRef.current = recoveryIsExactPercentage;
  const recoveryTypesTransitionMatrixRef = useRef(recoveryTypesTransitionMatrix);
  recoveryTypesTransitionMatrixRef.current = recoveryTypesTransitionMatrix;
  const recoveryTypesMirrorDigitReversalRef = useRef(recoveryTypesMirrorDigitReversal);
  recoveryTypesMirrorDigitReversalRef.current = recoveryTypesMirrorDigitReversal;
  const recoveryTypesTickCompressionRef = useRef(recoveryTypesTickCompression);
  recoveryTypesTickCompressionRef.current = recoveryTypesTickCompression;
  const recoveryTypesHiddenCycleLengthRef = useRef(recoveryTypesHiddenCycleLength);
  recoveryTypesHiddenCycleLengthRef.current = recoveryTypesHiddenCycleLength;
  const recoveryPatternSmartModeRef = useRef(recoveryPatternSmartMode);
  recoveryPatternSmartModeRef.current = recoveryPatternSmartMode;
  const recoveryPatternRotationalModeRef = useRef(recoveryPatternRotationalMode);
  recoveryPatternRotationalModeRef.current = recoveryPatternRotationalMode;
  const recoveryPatternRecoveryModeRef = useRef(recoveryPatternRecoveryMode);
  recoveryPatternRecoveryModeRef.current = recoveryPatternRecoveryMode;
  const recoveryPatternSmartDigitRef = useRef(recoveryPatternSmartDigit);
  recoveryPatternSmartDigitRef.current = recoveryPatternSmartDigit;
  const recoveryAnalysisOppositeSignalEnabledRef = useRef(recoveryAnalysisOppositeSignalEnabled);
  recoveryAnalysisOppositeSignalEnabledRef.current = recoveryAnalysisOppositeSignalEnabled;
  const recoveryConsecTouchOpposingTicksRef = useRef(recoveryConsecTouchOpposingTicks);
  recoveryConsecTouchOpposingTicksRef.current = recoveryConsecTouchOpposingTicks;
  const recoveryConsecTouchTargetDigitsRef = useRef(recoveryConsecTouchTargetDigits);
  recoveryConsecTouchTargetDigitsRef.current = recoveryConsecTouchTargetDigits;
  const recoveryConsecTouchTouchTypeRef = useRef(recoveryConsecTouchTouchType);
  recoveryConsecTouchTouchTypeRef.current = recoveryConsecTouchTouchType;

  // Additional refs
  const percentageThresholdRef = useRef(percentageThreshold);
  percentageThresholdRef.current = percentageThreshold;
  const isExactPercentageRef = useRef(isExactPercentage);
  isExactPercentageRef.current = isExactPercentage;
  const isCirclesModeRef = useRef(isCirclesMode);
  isCirclesModeRef.current = isCirclesMode;
  const circlesTicksLimitRef = useRef(circlesTicksLimit);
  circlesTicksLimitRef.current = circlesTicksLimit;
  const circleEntryModeEnabledRef = useRef(circleEntryModeEnabled);
  circleEntryModeEnabledRef.current = circleEntryModeEnabled;
  const circleTargetPctRef = useRef(circleTargetPct);
  circleTargetPctRef.current = circleTargetPct;
  const circleCompareModeRef = useRef(circleCompareMode);
  circleCompareModeRef.current = circleCompareMode;
  const circleFilterDigitsRef = useRef(circleFilterDigits);
  circleFilterDigitsRef.current = circleFilterDigits;
  const circleOuTargetTypeRef = useRef(circleOuTargetType);
  circleOuTargetTypeRef.current = circleOuTargetType;
  const circleOuDigitRef = useRef(circleOuDigit);
  circleOuDigitRef.current = circleOuDigit;
  const circleOuMaxPctRef = useRef(circleOuMaxPct);
  circleOuMaxPctRef.current = circleOuMaxPct;
  const circleOuLowDigitsRef = useRef(circleOuLowDigits);
  circleOuLowDigitsRef.current = circleOuLowDigits;
  const circleOuLowTouchModeRef = useRef(circleOuLowTouchMode);
  circleOuLowTouchModeRef.current = circleOuLowTouchMode;
  const circleOuOverTouchCountRef = useRef(circleOuOverTouchCount);
  circleOuOverTouchCountRef.current = circleOuOverTouchCount;
  const circleOuFinalTouchMaxTicksRef = useRef(circleOuFinalTouchMaxTicks);
  circleOuFinalTouchMaxTicksRef.current = circleOuFinalTouchMaxTicks;
  const consecTouchOpposingTicksRef = useRef(consecTouchOpposingTicks);
  consecTouchOpposingTicksRef.current = consecTouchOpposingTicks;
  const consecTouchTargetDigitsRef = useRef(consecTouchTargetDigits);
  consecTouchTargetDigitsRef.current = consecTouchTargetDigits;
  const consecTouchTouchTypeRef = useRef(consecTouchTouchType);
  consecTouchTouchTypeRef.current = consecTouchTouchType;
  const pmfPatternLenRef = useRef(pmfPatternLen);
  pmfPatternLenRef.current = pmfPatternLen;
  const pmfMinOccurrencesRef = useRef(pmfMinOccurrences);
  pmfMinOccurrencesRef.current = pmfMinOccurrences;
  const pmfFollowerLenRef = useRef(pmfFollowerLen);
  pmfFollowerLenRef.current = pmfFollowerLen;
  const tradeDurationRef = useRef(tradeDuration);
  tradeDurationRef.current = tradeDuration;
  const isRandomTicksRef = useRef(isRandomTicks);
  isRandomTicksRef.current = isRandomTicks;
  const accumulatorGrowthRateRef = useRef(accumulatorGrowthRate);
  accumulatorGrowthRateRef.current = accumulatorGrowthRate;
  const accumulatorTakeProfitRef = useRef(accumulatorTakeProfit);
  accumulatorTakeProfitRef.current = accumulatorTakeProfit;
  const accuStrategiesRef = useRef(accuStrategies);
  accuStrategiesRef.current = accuStrategies;
  const differsNoiseMaxScoreRef = useRef(differsNoiseMaxScore);
  differsNoiseMaxScoreRef.current = differsNoiseMaxScore;
  const differsNoiseMinCalmTicksRef = useRef(differsNoiseMinCalmTicks);
  differsNoiseMinCalmTicksRef.current = differsNoiseMinCalmTicks;
  const differsNoiseTargetModeRef = useRef(differsNoiseTargetMode);
  differsNoiseTargetModeRef.current = differsNoiseTargetMode;
  const customPatternRef = useRef(customPattern);
  customPatternRef.current = customPattern;
  const typesTransitionMatrixRef = useRef(typesTransitionMatrix);
  typesTransitionMatrixRef.current = typesTransitionMatrix;
  const typesMirrorDigitReversalRef = useRef(typesMirrorDigitReversal);
  typesMirrorDigitReversalRef.current = typesMirrorDigitReversal;
  const typesTickCompressionRef = useRef(typesTickCompression);
  typesTickCompressionRef.current = typesTickCompression;
  const typesHiddenCycleLengthRef = useRef(typesHiddenCycleLength);
  typesHiddenCycleLengthRef.current = typesHiddenCycleLength;
  const patternSmartModeRef = useRef(patternSmartMode);
  patternSmartModeRef.current = patternSmartMode;
  const patternSmartDigitRef = useRef(patternSmartDigit);
  patternSmartDigitRef.current = patternSmartDigit;
  const patternRotationalModeRef = useRef(patternRotationalMode);
  patternRotationalModeRef.current = patternRotationalMode;
  const patternRecoveryModeRef = useRef(patternRecoveryMode);
  patternRecoveryModeRef.current = patternRecoveryMode;
  const isContinuousTradingRef = useRef(isContinuousTrading);
  isContinuousTradingRef.current = isContinuousTrading;
  const alternateMarketRecoveryRef = useRef(alternateMarketRecovery);
  alternateMarketRecoveryRef.current = alternateMarketRecovery;
  const checkedMarketsRef = useRef(checkedMarkets);
  checkedMarketsRef.current = checkedMarkets;
  const effectiveBaseStakeRef = useRef(effectiveBaseStake);
  effectiveBaseStakeRef.current = effectiveBaseStake;
  const martingaleRef = useRef(martingale);
  martingaleRef.current = martingale;
  const effectiveUseVirtualLossRef = useRef(effectiveUseVirtualLoss);
  effectiveUseVirtualLossRef.current = effectiveUseVirtualLoss;
  const virtualAfterRealLossRef = useRef(virtualAfterRealLoss);
  virtualAfterRealLossRef.current = virtualAfterRealLoss;
  const virtualLossThresholdRef = useRef(virtualLossThreshold);
  virtualLossThresholdRef.current = virtualLossThreshold;
  const isRunsLimitEnabledRef = useRef(isRunsLimitEnabled);
  isRunsLimitEnabledRef.current = isRunsLimitEnabled;
  const runsLimitRef = useRef(runsLimit);
  runsLimitRef.current = runsLimit;
  const takeProfitRef = useRef(takeProfit);
  takeProfitRef.current = takeProfit;
  const stopLossRef = useRef(stopLoss);
  stopLossRef.current = stopLoss;
  const runForeverRef = useRef(runForever);
  runForeverRef.current = runForever;
  const autoRestartAfterTpRef = useRef(autoRestartAfterTp);
  autoRestartAfterTpRef.current = autoRestartAfterTp;
  const autoRestartMaxTpRef = useRef(autoRestartMaxTp);
  autoRestartMaxTpRef.current = autoRestartMaxTp;
  const isCurrentTradeRealRef = useRef(isCurrentTradeReal);
  isCurrentTradeRealRef.current = isCurrentTradeReal;
  const accountBalanceRef = useRef(accountBalance);
  accountBalanceRef.current = accountBalance;

  const visibleCheckedMarkets = useMemo(
    () => checkedMarkets.filter((m) => ALL_AUTOBOT_SYMBOLS.includes(m)),
    [checkedMarkets]
  );

  // Also tell App's multi-market stream about checked markets
  useEffect(() => {
    if (visibleCheckedMarkets.length > 0) {
      onSubscribeMarkets(visibleCheckedMarkets);
    }
  }, [visibleCheckedMarkets.join(',')]);

  const appendLog = useCallback((msg: string) => {
    const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
    setOtivoLog((prev) => [formatted, ...prev].slice(0, 60));
  }, []);

  // Pattern Learning Engine
  const runPatternLearning = useCallback(
    (excludePattern?: string, excludeDigit?: number) => {
      const symbols = checkedMarketsRef.current;
      if (symbols.length === 0) return null;

      const patternMap: Record<
        string,
        { pattern: string; appearingSymbols: Set<string>; digitCounts: number[]; totalCount: number }
      > = {};

      symbols.forEach((symbol) => {
        const history = tickHistories.current[symbol] || [];
        if (history.length < 10) return;
        for (let i = 0; i <= history.length - 4; i++) {
          const patternStr = history.slice(i, i + 3).join('');
          const nextDigit = history[i + 3];
          if (!patternMap[patternStr]) {
            patternMap[patternStr] = {
              pattern: patternStr,
              appearingSymbols: new Set<string>(),
              digitCounts: Array(10).fill(0),
              totalCount: 0,
            };
          }
          patternMap[patternStr].appearingSymbols.add(symbol);
          patternMap[patternStr].digitCounts[nextDigit]++;
          patternMap[patternStr].totalCount++;
        }
      });

      const candidates: Array<{ pattern: string; digit: number; score: number }> = [];
      Object.keys(patternMap).forEach((patternStr) => {
        const stats = patternMap[patternStr];
        if (stats.totalCount < 1) return;
        const marketsCount = stats.appearingSymbols.size;
        for (let d = 0; d <= 9; d++) {
          if (
            excludePattern &&
            excludeDigit !== undefined &&
            patternStr === excludePattern &&
            d === excludeDigit
          ) {
            continue;
          }
          const count = stats.digitCounts[d];
          const absenceRate = 1.0 - count / stats.totalCount;
          let score = stats.totalCount * absenceRate;
          if (count === 0) score += 15000;
          score += marketsCount > 3 ? 25000 + marketsCount * 2000 : marketsCount * 2000;
          if (patternStr.length === 3) score += 100;
          candidates.push({ pattern: patternStr, digit: d, score });
        }
      });

      if (candidates.length === 0) {
        return {
          pattern: customPatternRef.current || '686',
          digit: patternSmartDigitRef.current ?? 5,
        };
      }
      candidates.sort((a, b) => b.score - a.score);
      return { pattern: candidates[0].pattern, digit: candidates[0].digit };
    },
    []
  );

  const handleStartBot = useCallback(() => {
    if (!connected) {
      notify('error', 'Connect your Deriv Real or Demo API token first in Settings.');
      return;
    }
    if (checkedMarketsRef.current.length === 0) {
      notify('error', 'Select at least one market to monitor.');
      return;
    }
    signalQueueRef.current = [];
    continuousLockedMarketRef.current = null;
    lockedVirtualMarketRef.current = null;
    setLockedVirtualMarket(null);
    lastLostMarketRef.current = null;
    lastLossTimeRef.current = 0;

    if (!effectiveUseVirtualLossRef.current || virtualAfterRealLossRef.current) {
      isCurrentTradeRealRef.current = true;
      setIsCurrentTradeReal(true);
    } else {
      isCurrentTradeRealRef.current = false;
      setIsCurrentTradeReal(false);
    }

    currentStakeRef.current = effectiveBaseStakeRef.current;
    setCurrentStake(effectiveBaseStakeRef.current);
    setSessionProfit(0);
    sessionProfitRef.current = 0;
    setWinsCount(0);
    winsCountRef.current = 0;
    setLossesCount(0);
    lossesCountRef.current = 0;
    setConsecLosses(0);
    consecLossesRef.current = 0;
    setConsecutiveVirtualLosses(0);
    consecVirtualLossesRef.current = 0;
    setLostPatternsState([]);
    lostPatternsRef.current = [];

    if (patternSmartModeRef.current) {
      const learned = runPatternLearning();
      if (learned) {
        setCustomPattern(learned.pattern);
        customPatternRef.current = learned.pattern;
        setPatternSmartDigit(learned.digit);
        patternSmartDigitRef.current = learned.digit;
      }
    }

    isRunningRef.current = true;
    setIsRunning(true);
    appendLog(
      `AI Engine started (${contractTypeRef.current.toUpperCase()} · ${streakModeRef.current}${effectiveUseVirtualLossRef.current ? ' · Virtual Loss Filter ON' : ''})`
    );
    notify('success', 'AutoBot AI Engine started.');
  }, [appendLog, connected, notify, runPatternLearning]);

  const handleStopBot = useCallback(() => {
    isRunningRef.current = false;
    setIsRunning(false);
    signalQueueRef.current = [];
    continuousLockedMarketRef.current = null;
    lockedVirtualMarketRef.current = null;
    setLockedVirtualMarket(null);
    appendLog('AI Engine stopped by user.');
    notify('info', 'AutoBot stopped.');
  }, [appendLog, notify]);

  const handleResetAndClear = useCallback(() => {
    if (isRunningRef.current) return;
    signalQueueRef.current = [];
    continuousLockedMarketRef.current = null;
    lockedVirtualMarketRef.current = null;
    setLockedVirtualMarket(null);
    lastLostMarketRef.current = null;
    lastLossTimeRef.current = 0;
    setSessionProfit(0);
    sessionProfitRef.current = 0;
    setCumulativeSessionProfit(0);
    cumulativeSessionProfitRef.current = 0;
    sessionStorage.removeItem('autobot_cumulativeSessionProfit');
    setWinsCount(0);
    winsCountRef.current = 0;
    setLossesCount(0);
    lossesCountRef.current = 0;
    setConsecLosses(0);
    consecLossesRef.current = 0;
    setVirtualWinsCount(0);
    setVirtualLossesCount(0);
    setConsecutiveVirtualLosses(0);
    consecVirtualLossesRef.current = 0;
    setLostPatternsState([]);
    lostPatternsRef.current = [];
    setCurrentStake(effectiveBaseStakeRef.current);
    currentStakeRef.current = effectiveBaseStakeRef.current;
    setOtivoLog([]);
    setNeuralSignals([]);
    notify('info', 'AutoBot session counters and logs cleared.');
  }, [notify]);

  // 1-second real-time clock + alarm auto-start checker
  const alarmsRef = useRef(alarms);
  alarmsRef.current = alarms;
  const isAlarmSchedulerEnabledRef = useRef(isAlarmSchedulerEnabled);
  isAlarmSchedulerEnabledRef.current = isAlarmSchedulerEnabled;

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTimeStr(`${hh}:${mm}:${ss}`);

      if (!isAlarmSchedulerEnabledRef.current || isRunningRef.current) return;
      const hm = `${hh}:${mm}`;
      const todayKey = now.toISOString().slice(0, 10);
      const dayOfWeek = now.getDay();

      for (const alarm of alarmsRef.current) {
        if (!alarm.enabled) continue;
        if (alarm.time !== hm) continue;
        if (alarm.days && alarm.days.length > 0 && !alarm.days.includes(dayOfWeek)) continue;
        if (alarm.triggeredToday === todayKey) continue;

        setAlarms((prev) =>
          prev.map((a) => (a.id === alarm.id ? { ...a, triggeredToday: todayKey } : a))
        );
        appendLog(`Scheduled alarm triggered (${alarm.time}${alarm.label ? ` · ${alarm.label}` : ''})`);
        handleStartBot();
        break;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [appendLog, handleStartBot]);

  const handleAddAlarm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAlarmTime) return;
    const item: AutoBotAlarm = {
      id: `alarm_${Date.now()}`,
      time: newAlarmTime,
      label: newAlarmLabel.trim(),
      enabled: true,
      days: [...newAlarmDays],
    };
    setAlarms((prev) => [...prev, item]);
    setNewAlarmLabel('');
    notify('success', `Alarm scheduled for ${newAlarmTime}.`);
  };

  const handleToggleAlarm = (id: string) => {
    setAlarms((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  // Dedicated Deriv Public WebSocket for 1000-tick history + multi-market signal scanner
  const checkedMarketsKey = visibleCheckedMarkets.join(',');

  useEffect(() => {
    const marketsToSubscribe = checkedMarketsKey ? checkedMarketsKey.split(',') : [];
    if (marketsToSubscribe.length === 0) {
      setMarketTicks({});
      return;
    }

    let ws: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const wsUrl = 'wss://api.derivws.com/trading/v1/options/ws/public?app_id=34SRQBBtI5nwEFQqmc3se';
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (cancelled) {
          ws?.close();
          return;
        }
        marketsToSubscribe.forEach((symbol) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                ticks_history: symbol,
                adjust_start_time: 1,
                count: 1000,
                end: 'latest',
                start: 1,
                style: 'ticks',
                subscribe: 1,
              })
            );
          }
        });
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        let data: any;
        try {
          data = JSON.parse(evt.data);
        } catch {
          return;
        }

        if (data?.msg_type === 'history' && data?.history && data?.echo_req?.ticks_history) {
          const symbol: string = String(data.echo_req.ticks_history);
          const cfg = AUTOBOT_MARKET_CONFIGS.find((m) => m.symbol === symbol);
          const decimals = cfg?.decimals ?? 2;
          const prices: number[] = Array.isArray(data.history.prices)
            ? data.history.prices.map(Number).filter(Number.isFinite)
            : [];
          const digits = prices.map((p) => {
            const fixed = p.toFixed(decimals);
            return parseInt(fixed[fixed.length - 1], 10) || 0;
          });
          tickHistories.current[symbol] = digits.slice(-2000);
          priceHistories.current[symbol] = prices.slice(-200);
          const lastPrice = prices[prices.length - 1] || 0;
          const lastDigit = digits[digits.length - 1] || 0;
          marketTicksRef.current[symbol] = {
            price: lastPrice,
            lastDigit,
            digits: digits.slice(-5),
            streak: 0,
            coldDigit: computeDiffersSignal(digits, symbol).prediction,
          };
          setMarketTicks({ ...marketTicksRef.current });
          return;
        }

        if (data?.msg_type === 'tick' && data?.tick) {
          const symbol: string | undefined = data.tick.symbol;
          if (!symbol || !checkedMarketsRef.current.includes(symbol)) return;
          const cfg = AUTOBOT_MARKET_CONFIGS.find((m) => m.symbol === symbol);
          const decimals = cfg?.decimals ?? 2;
          const price = Number(data.tick.quote);
          if (!Number.isFinite(price)) return;
          const fixed = price.toFixed(decimals);
          const digit = parseInt(fixed[fixed.length - 1], 10);
          if (isNaN(digit)) return;

          const history = tickHistories.current[symbol] || [];
          history.push(digit);
          if (history.length > 2000) history.shift();
          tickHistories.current[symbol] = history;

          const rPrices = priceHistories.current[symbol] || [];
          rPrices.push(price);
          if (rPrices.length > 200) rPrices.shift();
          priceHistories.current[symbol] = rPrices;

          // Active Strategy or Post-Loss Smart Recovery Strategy
          const isRecActive =
            isRecoveryStreakModeEnabledRef.current && consecLossesRef.current > 0;
          const activeContractType = isRecActive
            ? recoveryContractTypeRef.current
            : contractTypeRef.current;
          const activeStreakMode = isRecActive
            ? recoveryStreakModeRef.current
            : streakModeRef.current;
          const activeTargetDigit = isRecActive
            ? recoveryTargetDigitRef.current
            : targetDigitRef.current;
          const activeTargetDigit2 = targetDigit2Ref.current;
          const activeOuPatternSelection = isRecActive
            ? recoveryOuPatternSelectionRef.current
            : ouPatternSelectionRef.current;
          const activeCustomPattern = isRecActive
            ? recoveryCustomPatternRef.current
            : customPatternRef.current;
          const activePatternSmartMode = isRecActive
            ? recoveryPatternSmartModeRef.current
            : patternSmartModeRef.current;
          const activePatternRotationalMode = isRecActive
            ? recoveryPatternRotationalModeRef.current
            : patternRotationalModeRef.current;
          const activePatternRecoveryMode = isRecActive
            ? recoveryPatternRecoveryModeRef.current
            : patternRecoveryModeRef.current;

          const useLossThresh = isRecActive
            ? recoveryIsLossStreakThresholdEnabledRef.current
            : isLossStreakThresholdEnabledRef.current;
          const activeStreakThreshold =
            consecLossesRef.current > 0 && useLossThresh
              ? isRecActive
                ? recoveryLossStreakThresholdRef.current
                : lossStreakThresholdRef.current
              : isRecActive
              ? recoveryStreakThresholdRef.current
              : streakThresholdRef.current;

          const activePctThresh = isRecActive
            ? recoveryPercentageThresholdRef.current
            : percentageThresholdRef.current;
          const activeIsExactPct = isRecActive
            ? recoveryIsExactPercentageRef.current
            : isExactPercentageRef.current;

          const coldDigit = computeDiffersSignal(history, symbol).prediction;

          // Pattern Matching
          let patternMatched = false;
          let bestDifferDigit: number | undefined = undefined;
          let matchedPatternKey: string | undefined = undefined;

          if (activeStreakMode === 'pattern') {
            const parsedSubPatterns = activeCustomPattern
              .split(',')
              .map((part) => {
                const trimmed = part.trim();
                if (trimmed.includes('=')) {
                  const eqIndex = trimmed.indexOf('=');
                  const seqStr = trimmed.slice(0, eqIndex).replace(/[^0-9]/g, '');
                  const digitStr = trimmed.slice(eqIndex + 1).replace(/[^0-9]/g, '');
                  const dVal = digitStr.length > 0 ? parseInt(digitStr, 10) : undefined;
                  return { sequence: seqStr, digit: dVal };
                }
                return { sequence: trimmed.replace(/[^0-9]/g, ''), digit: undefined };
              })
              .filter((p) => p.sequence.length > 0);

            let matchedDigitSpec: number | undefined = undefined;
            patternMatched = parsedSubPatterns.some((p) => {
              const patDigits = p.sequence.split('').map((c) => parseInt(c, 10));
              if (patDigits.length > 0 && history.length >= patDigits.length) {
                const lastSlice = history.slice(-patDigits.length);
                if (patDigits.every((val, idx) => lastSlice[idx] === val)) {
                  const pKey = p.digit !== undefined ? `${p.sequence}=${p.digit}` : p.sequence;
                  if (
                    activePatternRecoveryMode &&
                    consecLossesRef.current > 0 &&
                    lostPatternsRef.current.includes(pKey)
                  ) {
                    return false;
                  }
                  if (activePatternRotationalMode) {
                    const rotIdx = patternRotationalIdx.current[p.sequence] || 0;
                    matchedDigitSpec = patDigits[rotIdx % patDigits.length];
                  } else if (p.digit !== undefined) {
                    matchedDigitSpec = p.digit;
                  }
                  matchedPatternKey = pKey;
                  return true;
                }
              }
              return false;
            });

            if (patternMatched) {
              if (matchedDigitSpec !== undefined) {
                bestDifferDigit = matchedDigitSpec;
              } else if (activePatternSmartMode) {
                const smartD = isRecActive
                  ? recoveryPatternSmartDigitRef.current
                  : patternSmartDigitRef.current;
                if (smartD !== null) {
                  bestDifferDigit = smartD;
                } else {
                  bestDifferDigit = computeDiffersSignal(history.slice(-15), symbol).prediction;
                }
              } else {
                bestDifferDigit = activeTargetDigit !== -1 ? activeTargetDigit : digit;
              }
            }
          }

          // Consecutive Streak / Digit Matching
          let currentStreak = 0;
          const recentSubset = history.slice(-15);
          if (activeStreakMode === 'consecutive' && activeTargetDigit === -1) {
            const lastD = recentSubset[recentSubset.length - 1];
            for (let i = recentSubset.length - 1; i >= 0; i--) {
              if (recentSubset[i] === lastD) currentStreak++;
              else break;
            }
          } else {
            for (let i = recentSubset.length - 1; i >= 0; i--) {
              const d = recentSubset[i];
              let matches = false;
              if (activeStreakMode === 'consecutive') {
                matches =
                  activeContractType === 'dual_ou'
                    ? d > activeTargetDigit || d < activeTargetDigit2
                    : d === activeTargetDigit;
              } else {
                if (activeContractType === 'digitover') matches = d > activeTargetDigit;
                else if (activeContractType === 'digitunder') matches = d < activeTargetDigit;
                else if (activeContractType === 'digitdiff') matches = d !== activeTargetDigit;
                else if (activeContractType === 'digitmatch') matches = d === activeTargetDigit;
                else if (activeContractType === 'dual_ou')
                  matches = d > activeTargetDigit || d < activeTargetDigit2;
              }
              if (matches) currentStreak++;
              else break;
            }
          }

          // Types Mode evaluation
          let typesSignal: { prediction: number; reason: string; strategyName: string } | null =
            null;
          if (activeStreakMode === 'types') {
            const tMatrix = isRecActive
              ? recoveryTypesTransitionMatrixRef.current
              : typesTransitionMatrixRef.current;
            const tMirror = isRecActive
              ? recoveryTypesMirrorDigitReversalRef.current
              : typesMirrorDigitReversalRef.current;
            const tComp = isRecActive
              ? recoveryTypesTickCompressionRef.current
              : typesTickCompressionRef.current;
            const tCycle = isRecActive
              ? recoveryTypesHiddenCycleLengthRef.current
              : typesHiddenCycleLengthRef.current;

            let transSig: { prediction: number; reason: string } | null = null;
            if (tMatrix && history.length >= 15) {
              const lastD = history[history.length - 1];
              const tCounts: Record<number, number> = {};
              for (let i = 0; i < history.length - 1; i++) {
                if (history[i] === lastD) tCounts[history[i + 1]] = (tCounts[history[i + 1]] || 0) + 1;
              }
              let bestNext = -1;
              let maxC = 0;
              for (let d = 0; d <= 9; d++) {
                if ((tCounts[d] || 0) > maxC) {
                  maxC = tCounts[d];
                  bestNext = d;
                }
              }
              if (bestNext !== -1 && maxC >= 2) {
                transSig = {
                  prediction: bestNext,
                  reason: `Transition ${lastD}->${bestNext} (${maxC}x)`,
                };
              }
            }

            let mirrorSig: { prediction: number; reason: string } | null = null;
            if (tMirror && history.length >= 7) {
              const recent7 = history.slice(-7);
              const mCounts: Record<number, number> = {};
              recent7.forEach((d) => (mCounts[d] = (mCounts[d] || 0) + 1));
              let maxC = 0;
              let domD = -1;
              for (const k of Object.keys(mCounts)) {
                const dv = parseInt(k, 10);
                if (mCounts[dv] > maxC) {
                  maxC = mCounts[dv];
                  domD = dv;
                }
              }
              if (maxC >= 4 && domD !== -1) {
                mirrorSig = { prediction: domD, reason: `Mirror ${domD} (${maxC}/7)` };
              }
            }

            let compSig: { prediction: number; reason: string } | null = null;
            if (tComp && rPrices.length >= 6) {
              const compPrices = rPrices.slice(-6, -1);
              const compVol = Math.max(...compPrices) - Math.min(...compPrices);
              const thresh = decimals > 3 ? 0.005 : 0.08;
              if (compVol < thresh) {
                const lastChg = Math.abs(
                  rPrices[rPrices.length - 1] - rPrices[rPrices.length - 2]
                );
                if (lastChg > compVol * 1.5 && lastChg > (decimals > 3 ? 0.001 : 0.01)) {
                  compSig = { prediction: digit, reason: `Compression Breakout -> ${digit}` };
                }
              }
            }

            let cycleSig: { prediction: number; reason: string } | null = null;
            if (tCycle && history.length >= 10) {
              for (let L = 3; L <= 6; L++) {
                if (history.length >= L * 2) {
                  const suf = history.slice(-(L - 1));
                  const prev = history.slice(-(L - 1) - L, -L);
                  if (suf.every((v, idx) => v === prev[idx])) {
                    cycleSig = {
                      prediction: history[history.length - L],
                      reason: `Cycle L=${L}`,
                    };
                    break;
                  }
                }
              }
            }

            if (transSig)
              typesSignal = { ...transSig, strategyName: 'Digit Transition Matrix' };
            else if (cycleSig)
              typesSignal = { ...cycleSig, strategyName: 'Hidden Cycle Length' };
            else if (mirrorSig)
              typesSignal = { ...mirrorSig, strategyName: 'Mirror Digit Reversal' };
            else if (compSig)
              typesSignal = { ...compSig, strategyName: 'Tick Compression Breakout' };
          }

          // Percentage evaluation
          let currentPct = 0;
          if (activeStreakMode === 'percentage') {
            const recent25 = history.slice(-25);
            let mCount = 0;
            recent25.forEach((d) => {
              if (activeContractType === 'digitover' && d > activeTargetDigit) mCount++;
              else if (activeContractType === 'digitunder' && d < activeTargetDigit) mCount++;
              else if (
                activeContractType === 'dual_ou' &&
                (d > activeTargetDigit || d < activeTargetDigit2)
              )
                mCount++;
            });
            currentPct = recent25.length > 0 ? Math.round((mCount / recent25.length) * 100) : 0;
          }

          // Consecutive & Touch evaluation
          let consecTouchMatched = false;
          const activeOpposingReq = isRecActive
            ? recoveryConsecTouchOpposingTicksRef.current
            : consecTouchOpposingTicksRef.current;
          const activeTouchesReq = isRecActive
            ? recoveryConsecTouchTargetDigitsRef.current
            : consecTouchTargetDigitsRef.current;
          const activeTouchType = isRecActive
            ? recoveryConsecTouchTouchTypeRef.current
            : consecTouchTouchTypeRef.current;

          const isOverTarget =
            activeContractType === 'digitover' ||
            (activeContractType === 'over_under' && activeOuPatternSelection !== 'under8');
          const activeBarrier =
            activeContractType === 'over_under'
              ? activeOuPatternSelection === 'under8'
                ? 8
                : 1
              : isOverTarget
              ? activeTargetDigit >= 0 && activeTargetDigit <= 8
                ? activeTargetDigit
                : 1
              : activeTargetDigit >= 1 && activeTargetDigit <= 9
              ? activeTargetDigit
              : 8;

          const checkOpp = (d: number) => (isOverTarget ? d <= activeBarrier : d >= activeBarrier);
          const checkTouch = (d: number) =>
            activeTouchType === 'any' ? true : isOverTarget ? d > activeBarrier : d < activeBarrier;

          let curOppCount = 0;
          let curTouchCount = 0;
          let curStreakAchieved = false;
          const reqOpp = Math.max(1, activeOpposingReq);
          const reqT = Math.max(1, activeTouchesReq);

          if (history.length >= reqOpp) {
            let trailingTouches = 0;
            for (let i = history.length - 1; i >= 0 && trailingTouches < reqT; i--) {
              if (checkTouch(history[i])) trailingTouches++;
              else break;
            }
            let precedingOpp = 0;
            for (let i = history.length - 1 - trailingTouches; i >= 0; i--) {
              if (checkOpp(history[i])) precedingOpp++;
              else break;
            }
            if (precedingOpp >= reqOpp) {
              curStreakAchieved = true;
              curOppCount = precedingOpp;
              curTouchCount = trailingTouches;
              if (trailingTouches >= reqT && checkTouch(digit)) {
                consecTouchMatched = true;
              }
            } else {
              let trailingOpp = 0;
              for (let i = history.length - 1; i >= 0; i--) {
                if (checkOpp(history[i])) trailingOpp++;
                else break;
              }
              curOppCount = trailingOpp;
              curStreakAchieved = trailingOpp >= reqOpp;
            }
          }

          // Engine Signals
          const { signal: axaSignal, metrics: axaMetrics } = computeAXASignal(history, symbol);
          const { signal: ouScannerSig, metrics: ouScannerMetrics } =
            computeOverUnderScannerSignal(
              history,
              ouSamplePeriodRef.current,
              ouColdThresholdMaxRef.current,
              ouSingleDigitMaxRef.current
            );
          const { signal: edmsSig, metrics: edmsMetrics } = computeEDMSSignal(rPrices, history);
          const overUnderSignal = isEdmsEnabledRef.current ? edmsSig : ouScannerSig;
          const ladPrngSignal = computeLADPrngSignal(
            history,
            symbol,
            rPrices,
            pmfPatternLenRef.current,
            pmfMinOccurrencesRef.current,
            pmfFollowerLenRef.current
          );
          const { signal: differsCalmNoiseSignal, metrics: differsCalmNoiseMetrics } =
            computeDiffersCalmNoiseSignal(history, rPrices, symbol, {
              maxNoiseScore: differsNoiseMaxScoreRef.current,
              minCalmTicks: differsNoiseMinCalmTicksRef.current,
            });
          if (differsCalmNoiseSignal && differsNoiseTargetModeRef.current === 'top_calm') {
            const top = [...differsCalmNoiseMetrics.digitStats].sort(
              (a, b) => b.calmCount - a.calmCount
            )[0];
            if (top) {
              differsCalmNoiseSignal.prediction = top.digit;
              differsCalmNoiseSignal.calmDigit = top.digit;
            }
          }
          const activePriceInput = isRecActive
            ? recoveryPriceDigitsInputRef.current
            : priceDigitsInputRef.current;
          const priceDigitsSignal = evaluatePriceDigitsSignal(price, decimals, activePriceInput);
          const accumulatorMetrics = computeAccumulatorMetrics(rPrices, history, symbol);

          // Circles evaluation
          let circleTargetDigit: number | null = null;
          let circleTriggered = false;
          let circleStrategyLabel = '';
          let circleOuData: AutoBotTickCardData['circleOuData'] = undefined;

          if (isCirclesModeRef.current || activeStreakMode.startsWith('circle_')) {
            const slice = history.slice(-Math.max(10, circlesTicksLimitRef.current || 1000));
            const totalT = slice.length;
            const cCounts = new Array(10).fill(0);
            slice.forEach((d) => {
              if (d >= 0 && d <= 9) cCounts[d]++;
            });
            const cStats = Array.from({ length: 10 }, (_, d) => ({
              digit: d,
              pct: totalT > 0 ? (cCounts[d] / totalT) * 100 : 10,
            }));
            const ranked = [...cStats].sort((a, b) => b.pct - a.pct);

            if (activeStreakMode === 'circle_green') {
              circleTargetDigit = ranked[0].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle GREEN [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_blue') {
              circleTargetDigit = ranked[1]?.digit ?? ranked[0].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle BLUE [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_orange') {
              circleTargetDigit = ranked[8]?.digit ?? ranked[ranked.length - 1].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle ORANGE [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_red') {
              circleTargetDigit = ranked[ranked.length - 1].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle RED [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_target_pct') {
              const allowed =
                circleFilterDigitsRef.current.toLowerCase() === 'all'
                  ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
                  : circleFilterDigitsRef.current
                      .split(',')
                      .map((s) => parseInt(s.trim(), 10))
                      .filter((d) => !isNaN(d) && d >= 0 && d <= 9);
              for (let d = 0; d <= 9; d++) {
                if (!allowed.includes(d)) continue;
                const f = cStats[d].pct;
                const match =
                  circleCompareModeRef.current === 'higher'
                    ? f >= circleTargetPctRef.current
                    : f <= circleTargetPctRef.current;
                if (match) {
                  circleTargetDigit = d;
                  circleTriggered = true;
                  circleStrategyLabel = `Circle Pct [${d}] (${f.toFixed(1)}%)`;
                  break;
                }
              }
            } else if (activeStreakMode === 'circle_over_under') {
              const tType =
                activeContractType === 'digitover'
                  ? 'over'
                  : activeContractType === 'digitunder'
                  ? 'under'
                  : circleOuTargetTypeRef.current;
              const barrierD = circleOuDigitRef.current ?? (tType === 'over' ? 1 : 8);
              const maxP = circleOuMaxPctRef.current ?? 9.0;
              const lowArr = circleOuLowDigitsRef.current
                .split(/[,\s]+/)
                .map((s) => parseInt(s.trim(), 10))
                .filter((n) => !isNaN(n) && n >= 0 && n <= 9);
              const effectiveLow = lowArr.length > 0 ? lowArr : tType === 'over' ? [0, 1] : [8, 9];
              const lowSet = new Set(effectiveLow);
              const touchMode = circleOuLowTouchModeRef.current;
              const reqOver = circleOuOverTouchCountRef.current || 2;
              const maxFinal = circleOuFinalTouchMaxTicksRef.current || 3;

              let isFocused = totalT >= 10;
              if (isFocused) {
                for (let d = 0; d <= 9; d++) {
                  const pct = cStats[d].pct;
                  if (lowSet.has(d) && pct >= maxP) {
                    isFocused = false;
                    break;
                  }
                  if (!lowSet.has(d) && pct < maxP) {
                    isFocused = false;
                    break;
                  }
                }
              }

              let st = circleOuMarketStatesRef.current[symbol];
              if (!st) {
                st = {
                  stage: 'WAITING_LOW_TOUCH',
                  lowTouchedDigits: [],
                  consecutiveLowCount: 0,
                  overTouchCount: 0,
                  finalTouchTicksElapsed: 0,
                };
                circleOuMarketStatesRef.current[symbol] = st;
              }

              if (!isRunningRef.current || !isFocused) {
                st.stage = 'WAITING_LOW_TOUCH';
                st.lowTouchedDigits = [];
                st.consecutiveLowCount = 0;
                st.overTouchCount = 0;
                st.finalTouchTicksElapsed = 0;
              } else {
                const isLow = lowSet.has(digit);
                if (st.stage === 'WAITING_LOW_TOUCH') {
                  if (touchMode === 'consecutive') {
                    if (isLow) {
                      st.consecutiveLowCount++;
                      if (st.consecutiveLowCount >= 2) {
                        st.stage = 'COUNTING_OVER_TOUCH';
                        st.overTouchCount = 0;
                        st.consecutiveLowCount = 0;
                      }
                    } else {
                      st.consecutiveLowCount = 0;
                    }
                  } else if (isLow) {
                    if (!st.lowTouchedDigits.includes(digit)) st.lowTouchedDigits.push(digit);
                    if (effectiveLow.every((d) => st.lowTouchedDigits.includes(d))) {
                      st.stage = 'COUNTING_OVER_TOUCH';
                      st.overTouchCount = 0;
                      st.lowTouchedDigits = [];
                    }
                  }
                } else if (st.stage === 'COUNTING_OVER_TOUCH') {
                  if (!isLow) {
                    st.overTouchCount++;
                    if (st.overTouchCount >= reqOver) {
                      st.stage = 'WAITING_FINAL_TOUCH';
                      st.finalTouchTicksElapsed = 0;
                    }
                  } else {
                    st.stage = 'WAITING_LOW_TOUCH';
                    st.overTouchCount = 0;
                    st.consecutiveLowCount = 1;
                    st.lowTouchedDigits = [digit];
                  }
                } else if (st.stage === 'WAITING_FINAL_TOUCH') {
                  st.finalTouchTicksElapsed++;
                  if (isLow) {
                    circleTargetDigit = barrierD;
                    circleTriggered = true;
                    circleStrategyLabel = `Circle O/U [${tType.toUpperCase()} ${barrierD}]`;
                    st.stage = 'WAITING_LOW_TOUCH';
                    st.lowTouchedDigits = [];
                    st.consecutiveLowCount = 0;
                    st.overTouchCount = 0;
                    st.finalTouchTicksElapsed = 0;
                  } else if (st.finalTouchTicksElapsed >= maxFinal) {
                    st.stage = 'WAITING_LOW_TOUCH';
                    st.lowTouchedDigits = [];
                    st.consecutiveLowCount = 0;
                    st.overTouchCount = 0;
                    st.finalTouchTicksElapsed = 0;
                  }
                }
              }

              circleOuData = {
                isFocused,
                stage: st.stage,
                lowTouchedDigits: [...st.lowTouchedDigits],
                consecutiveLowCount: st.consecutiveLowCount,
                overTouchCount: st.overTouchCount,
                finalTouchTicksElapsed: st.finalTouchTicksElapsed,
                reqOverTouches: reqOver,
                maxFinalTicks: maxFinal,
                lowDigits: effectiveLow,
                maxPct: maxP,
                targetType: tType,
                barrierDigit: barrierD,
                triggered: circleTriggered,
                label: circleStrategyLabel,
              };
            }

            if (
              circleEntryModeEnabledRef.current &&
              circleTargetDigit !== null &&
              activeStreakMode !== 'circle_over_under'
            ) {
              circleTriggered = digit === circleTargetDigit;
            }
          }

          // Store tick data onto card ref
          const prevData = marketTicksRef.current[symbol];
          marketTicksRef.current[symbol] = {
            price,
            lastDigit: digit,
            digits: history.slice(-5),
            streak: currentStreak,
            prevPrice: prevData?.price,
            coldDigit,
            patternMatched,
            bestDifferDigit,
            matchedPatternKey,
            typesSignal,
            percentageValue: currentPct,
            axaSignal,
            axaMetrics,
            overUnderSignal,
            overUnderMetrics: ouScannerMetrics,
            edmsSignal: edmsSig,
            edmsMetrics,
            accumulatorMetrics,
            ladPrngSignal,
            differsCalmNoiseSignal,
            differsCalmNoiseMetrics,
            priceDigitsSignal,
            circleOuData,
            consecTouchData: {
              opposingCount: curOppCount,
              streakAchieved: curStreakAchieved,
              touchCount: curTouchCount,
              reqOpposing: reqOpp,
              reqTouches: reqT,
              isOverTarget,
              activeBarrier,
              touchType: activeTouchType,
            },
          };

          const nowMs = Date.now();
          if (nowMs - lastStateUpdateRef.current > 200) {
            setMarketTicks({ ...marketTicksRef.current });
            lastStateUpdateRef.current = nowMs;
            if (stateUpdateTimeoutRef.current) {
              clearTimeout(stateUpdateTimeoutRef.current);
              stateUpdateTimeoutRef.current = null;
            }
          } else if (!stateUpdateTimeoutRef.current) {
            stateUpdateTimeoutRef.current = setTimeout(() => {
              setMarketTicks({ ...marketTicksRef.current });
              lastStateUpdateRef.current = Date.now();
              stateUpdateTimeoutRef.current = null;
            }, 200);
          }

          // Discover neural signals for Scanner Panel
          if (axaSignal) {
            setNeuralSignals((prev) =>
              [
                {
                  id: `${symbol}_${Date.now()}`,
                  symbol,
                  seq: `AXA ${axaSignal.pattern}`,
                  conf: axaSignal.confidence,
                  type: 'differ' as const,
                },
                ...prev.filter((s) => s.symbol !== symbol),
              ].slice(0, 6)
            );
          } else if (history.length >= 50) {
            const { signal: aiSig } = computeAILearnerSignal(history);
            if (aiSig) {
              setNeuralSignals((prev) =>
                [
                  {
                    id: `${symbol}_${Date.now()}`,
                    symbol,
                    seq: aiSig.sequence,
                    conf: aiSig.confidence,
                    type: 'differ' as const,
                  },
                  ...prev.filter((s) => s.symbol !== symbol),
                ].slice(0, 6)
              );
            }
          }

          // Determine if triggered
          if (!isRunningRef.current) return;

          let isTriggered = false;
          if (activeContractType === 'accumulator') {
            if (activeStreakMode === 'analysis_tool') {
              const c = computeAccumulatorSignal(rPrices, history, symbol);
              isTriggered = c.isNeutral5050 || c.action === 'BUY_ACCU';
            } else if (accumulatorMetrics) {
              const enabled = Object.entries(accuStrategiesRef.current)
                .filter(([, v]) => v)
                .map(([k]) => k);
              isTriggered =
                enabled.length > 0 &&
                enabled.every((k) => Boolean(accumulatorMetrics.satisfied[k]));
            }
          } else if (activeStreakMode === 'analysis_tool') {
            if (activeContractType === 'digitdiff') {
              isTriggered = computeDiffersSignal(history, symbol).confidence >= 80;
            } else if (
              ['over_under', 'digitover', 'digitunder', 'dual_ou'].includes(activeContractType)
            ) {
              const ouObj = computeOverUnderSignal(
                history,
                symbol,
                activeTargetDigit !== -1 ? activeTargetDigit : 4,
                4
              );
              let dir = ouObj.direction;
              const opp = isRecActive
                ? recoveryAnalysisOppositeSignalEnabledRef.current
                : analysisOppositeSignalEnabledRef.current;
              if (opp) {
                if (dir === 'OVER') dir = 'UNDER';
                else if (dir === 'UNDER') dir = 'OVER';
              }
              if (activeContractType === 'digitover')
                isTriggered = dir === 'OVER' && ouObj.confidence >= 60;
              else if (activeContractType === 'digitunder')
                isTriggered = dir === 'UNDER' && ouObj.confidence >= 60;
              else isTriggered = (dir === 'OVER' || dir === 'UNDER') && ouObj.confidence >= 60;
            } else if (activeContractType === 'digitmatch') {
              isTriggered = computeMatchSignal(history).confidence >= 40;
            }
          } else if (activeStreakMode.startsWith('circle_')) {
            isTriggered = circleTriggered;
          } else if (activeStreakMode === 'pattern') {
            isTriggered = patternMatched;
          } else if (activeStreakMode === 'over_under') {
            isTriggered = overUnderSignal !== null;
          } else if (activeStreakMode === 'price_digits') {
            isTriggered = priceDigitsSignal.matched;
          } else if (activeStreakMode === 'axa') {
            isTriggered = axaSignal !== null;
          } else if (activeStreakMode === 'differs_noise') {
            isTriggered = differsCalmNoiseSignal !== null;
          } else if (activeStreakMode === 'lad_prng') {
            isTriggered = ladPrngSignal !== null;
          } else if (activeStreakMode === 'types') {
            isTriggered = typesSignal !== null;
          } else if (activeStreakMode === 'percentage') {
            isTriggered = activeIsExactPct
              ? currentPct === activePctThresh
              : currentPct >= activePctThresh;
          } else if (activeStreakMode === 'consecutive_touch') {
            isTriggered = consecTouchMatched;
          } else {
            isTriggered = currentStreak >= activeStreakThreshold;
          }

          // Market locking rules (Continuous & Virtual)
          const activeLocked =
            continuousLockedMarketRef.current ||
            (effectiveUseVirtualLossRef.current ? lockedVirtualMarketRef.current : null);
          if (activeLocked && activeLocked !== symbol) {
            isTriggered = false;
          }
          if (
            isContinuousTradingRef.current &&
            continuousLockedMarketRef.current === symbol
          ) {
            isTriggered = true;
          }

          const isVirtualThresholdMet = Boolean(
            effectiveUseVirtualLossRef.current &&
              (isCurrentTradeRealRef.current ||
                consecVirtualLossesRef.current >= virtualLossThresholdRef.current)
          );
          if (isVirtualThresholdMet && lockedVirtualMarketRef.current === symbol) {
            isTriggered = true;
          }

          if (!isTriggered) return;

          if (isContinuousTradingRef.current && !continuousLockedMarketRef.current) {
            continuousLockedMarketRef.current = symbol;
            appendLog(
              `${symbol}: Continuous trading locked until Take Profit is reached.`
            );
          }

          if (
            isRecoveryStreakModeEnabledRef.current &&
            lastLossTimeRef.current > 0 &&
            Date.now() - lastLossTimeRef.current < 5000
          ) {
            return;
          }

          if (
            alternateMarketRecoveryRef.current &&
            !activeLocked &&
            checkedMarketsRef.current.length > 1 &&
            lastLostMarketRef.current === symbol
          ) {
            return;
          }

          const lastTrade = lastTradeTimePerSymbol.current[symbol] || 0;
          if (!isVirtualThresholdMet && consecLossesRef.current === 0 && nowMs - lastTrade < 400) return;
          lastTradeTimePerSymbol.current[symbol] = nowMs;

          // Build signal payload
          let termContract: AutoBotSignalQueueItem['contractType'] =
            activeContractType === 'accumulator'
              ? 'ACCU'
              : activeContractType === 'digitover'
              ? 'DIGITOVER'
              : activeContractType === 'digitunder'
              ? 'DIGITUNDER'
              : activeContractType === 'digitmatch'
              ? 'DIGITMATCH'
              : activeContractType === 'dual_ou'
              ? 'DUAL_OU'
              : activeContractType === 'over_under'
              ? activeOuPatternSelection === 'under8'
                ? 'DIGITUNDER'
                : 'DIGITOVER'
              : 'DIGITDIFF';

          let prediction =
            activeContractType === 'digitover'
              ? activeTargetDigit >= 0 && activeTargetDigit <= 8
                ? activeTargetDigit
                : 2
              : activeContractType === 'digitunder'
              ? activeTargetDigit >= 1 && activeTargetDigit <= 9
                ? activeTargetDigit
                : 8
              : activeTargetDigit >= 0 && activeTargetDigit <= 9
              ? activeTargetDigit
              : coldDigit;

          let strategyName: string | null = activeStreakMode;

          if (activeContractType === 'over_under' && activeStreakMode === 'pattern') {
            termContract = activeOuPatternSelection === 'under8' ? 'DIGITUNDER' : 'DIGITOVER';
            prediction = termContract === 'DIGITUNDER' ? 8 : 1;
          } else if (activeStreakMode === 'analysis_tool') {
            strategyName = 'Analysis Signal Bridge';
            if (activeContractType === 'digitdiff') {
              termContract = 'DIGITDIFF';
              prediction = computeDiffersSignal(history, symbol).prediction;
            } else if (
              ['over_under', 'dual_ou', 'digitover', 'digitunder'].includes(activeContractType)
            ) {
              const ouObj = computeOverUnderSignal(history, symbol, 4, 4);
              let dir = ouObj.direction;
              const opp = isRecActive
                ? recoveryAnalysisOppositeSignalEnabledRef.current
                : analysisOppositeSignalEnabledRef.current;
              if (opp) {
                if (dir === 'OVER') dir = 'UNDER';
                else if (dir === 'UNDER') dir = 'OVER';
              }
              termContract = dir === 'UNDER' ? 'DIGITUNDER' : 'DIGITOVER';
              prediction =
                activeContractType === 'digitover'
                  ? activeTargetDigit >= 0 && activeTargetDigit <= 8
                    ? activeTargetDigit
                    : 1
                  : activeContractType === 'digitunder'
                  ? activeTargetDigit >= 1 && activeTargetDigit <= 9
                    ? activeTargetDigit
                    : 8
                  : termContract === 'DIGITUNDER'
                  ? 8
                  : 1;
            } else if (activeContractType === 'digitmatch') {
              termContract = 'DIGITMATCH';
              prediction = computeMatchSignal(history).prediction;
            }
          } else if (activeStreakMode === 'consecutive_touch') {
            termContract = isOverTarget ? 'DIGITOVER' : 'DIGITUNDER';
            prediction = activeBarrier;
            strategyName = 'Streak & Touch';
          } else if (activeStreakMode === 'circle_over_under') {
            const tType =
              activeContractType === 'digitover'
                ? 'over'
                : activeContractType === 'digitunder'
                ? 'under'
                : circleOuTargetTypeRef.current;
            termContract = tType === 'over' ? 'DIGITOVER' : 'DIGITUNDER';
            prediction = circleTargetDigit ?? circleOuDigitRef.current ?? (tType === 'over' ? 1 : 8);
            strategyName = circleStrategyLabel || 'Circle O/U';
          } else if (activeStreakMode === 'over_under' && overUnderSignal) {
            termContract = overUnderSignal.type === 'digitover' ? 'DIGITOVER' : 'DIGITUNDER';
            prediction = overUnderSignal.prediction;
            strategyName = isEdmsEnabledRef.current ? 'EDMS O1/U8' : 'O1/U8 Cold Zone';
          } else if (activeStreakMode.startsWith('circle_') && circleTargetDigit !== null) {
            prediction =
              activeContractType === 'digitover'
                ? Math.min(8, circleTargetDigit)
                : activeContractType === 'digitunder'
                ? Math.max(1, circleTargetDigit)
                : circleTargetDigit;
            strategyName = circleStrategyLabel;
          } else if (activeStreakMode === 'axa' && axaSignal) {
            prediction = axaSignal.prediction;
            strategyName = `AXA (${axaSignal.pattern})`;
          } else if (activeStreakMode === 'differs_noise' && differsCalmNoiseSignal) {
            prediction = differsCalmNoiseSignal.prediction;
            strategyName = 'Calm Digit Noise';
          } else if (activeStreakMode === 'lad_prng' && ladPrngSignal) {
            prediction = ladPrngSignal.prediction;
            strategyName = `Follower [${ladPrngSignal.patternStr}]`;
          } else if (activeStreakMode === 'pattern' && bestDifferDigit !== undefined) {
            prediction = bestDifferDigit;
            strategyName = `Pattern [${matchedPatternKey || activeCustomPattern}]`;
          } else if (activeStreakMode === 'types' && typesSignal) {
            prediction = typesSignal.prediction;
            strategyName = typesSignal.strategyName;
          } else if (activeStreakMode === 'price_digits' && priceDigitsSignal?.target) {
            const parsedLast = parseInt(priceDigitsSignal.target.slice(-1), 10);
            if (!isNaN(parsedLast) && activeTargetDigit === -1) {
              prediction = parsedLast;
            }
            strategyName = `Price Digits (${priceDigitsSignal.target})`;
          }

          if (signalQueueRef.current.length < 15) {
            signalQueueRef.current.push({
              symbol,
              type: activeContractType,
              contractType: termContract,
              prediction,
              prediction2: activeContractType === 'dual_ou' ? activeTargetDigit2 : undefined,
              amount: currentStakeRef.current,
              timestamp: nowMs,
              accuGrowthRate: isRecActive
                ? recoveryAccumulatorGrowthRateRef.current
                : accumulatorGrowthRateRef.current,
              accuTakeProfit: isRecActive
                ? recoveryAccumulatorTakeProfitRef.current
                : accumulatorTakeProfitRef.current,
              matchedPatternKey,
              strategyName,
            });
          }
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, 20000);
    };

    connect();

    return () => {
      cancelled = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (stateUpdateTimeoutRef.current) clearTimeout(stateUpdateTimeoutRef.current);
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [appendLog, checkedMarketsKey]);

  // Signal Queue Execution Consumer Loop (calls /api/autobot/trade on Real or Virtual connection)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isRunningRef.current || tradeInFlightRef.current) return;
      if (signalQueueRef.current.length === 0) return;

      const sig = signalQueueRef.current.shift();
      if (!sig) return;
      if (Date.now() - sig.timestamp > 15000) return;

      const activeLocked =
        continuousLockedMarketRef.current ||
        (effectiveUseVirtualLossRef.current ? lockedVirtualMarketRef.current : null);
      if (activeLocked && activeLocked !== sig.symbol) return;

      if (
        alternateMarketRecoveryRef.current &&
        !activeLocked &&
        checkedMarketsRef.current.length > 1 &&
        lastLostMarketRef.current === sig.symbol
      ) {
        return;
      }

      tradeInFlightRef.current = true;
      try {
        const useVirtual = effectiveUseVirtualLossRef.current;
        const shouldTradeReal = !useVirtual
          ? true
          : isCurrentTradeRealRef.current ||
            consecVirtualLossesRef.current >= virtualLossThresholdRef.current;

        const dur = isRandomTicksRef.current
          ? Math.floor(Math.random() * 10) + 1
          : Math.min(10, Math.max(1, tradeDurationRef.current));

        const contractMap: Record<
          AutoBotSignalQueueItem['contractType'],
          'digitdiff' | 'digitmatch' | 'digitover' | 'digitunder' | 'accumulator' | 'dual_ou'
        > = {
          DIGITDIFF: 'digitdiff',
          DIGITMATCH: 'digitmatch',
          DIGITOVER: 'digitover',
          DIGITUNDER: 'digitunder',
          ACCU: 'accumulator',
          DUAL_OU: 'dual_ou',
        };
        const apiContractType = contractMap[sig.contractType] || 'digitdiff';

        let realStakeUsed = Math.max(
          0.35,
          Number((currentStakeRef.current || effectiveBaseStakeRef.current || 1).toFixed(2))
        );
        if (apiContractType === 'accumulator' && realStakeUsed < 1) {
          realStakeUsed = 1;
        }
        if (
          isAutoStakeEnabled &&
          accountBalanceRef.current > 0 &&
          realStakeUsed > accountBalanceRef.current
        ) {
          realStakeUsed = effectiveBaseStakeRef.current;
          currentStakeRef.current = realStakeUsed;
          setCurrentStake(realStakeUsed);
        }

        // Virtual Mode hardcoded stakes: $1.00 USD for Accumulators, $0.35 USD for all other contract types
        const virtualStake = apiContractType === 'accumulator' ? 1.0 : 0.35;

        // Advance rotational pattern index if used
        if (patternRotationalModeRef.current && sig.matchedPatternKey) {
          const seq = sig.matchedPatternKey.split('=')[0];
          patternRotationalIdx.current[seq] =
            ((patternRotationalIdx.current[seq] || 0) + 1) % Math.max(1, seq.length);
        }

        const executeTradeCall = async (isVirtualExec: boolean, stakeAmount: number) => {
          const res = await fetch('/api/autobot/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbol: sig.symbol,
              contractType: apiContractType,
              prediction: sig.prediction,
              prediction2: sig.prediction2,
              stake: stakeAmount,
              duration: dur,
              growthRate: (sig.accuGrowthRate ?? 2) / 100,
              takeProfit: sig.accuTakeProfit ?? 10,
              isVirtual: isVirtualExec,
              strategyName: sig.strategyName || undefined,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data?.error || 'Trade execution rejected');
          }
          const isWin =
            typeof data?.won === 'boolean' ? data.won : data?.trade?.status === 'WON';
          const profit = Number(data?.profit ?? data?.trade?.profit ?? 0);
          return { isWin, profit };
        };

        let realOutcome: { isWin: boolean; profit: number } | null = null;

        if (!shouldTradeReal && useVirtual) {
          appendLog(
            `VIRTUAL ${sig.contractType} on ${sig.symbol} (Pred ${sig.prediction}, Stake $${virtualStake.toFixed(2)}, ${sig.strategyName || 'AutoBot'})`
          );
          const vRes = await executeTradeCall(true, virtualStake);

          if (vRes.isWin) {
            setVirtualWinsCount((w) => w + 1);
            consecVirtualLossesRef.current = 0;
            setConsecutiveVirtualLosses(0);
            lockedVirtualMarketRef.current = null;
            setLockedVirtualMarket(null);
            appendLog(`VIRTUAL WIN (+${vRes.profit.toFixed(2)}) on ${sig.symbol} · Reset streak`);
            return;
          }

          const nextVLosses = consecVirtualLossesRef.current + 1;
          setVirtualLossesCount((l) => l + 1);
          consecVirtualLossesRef.current = nextVLosses;
          setConsecutiveVirtualLosses(nextVLosses);

          if (nextVLosses < virtualLossThresholdRef.current) {
            appendLog(
              `VIRTUAL LOSS (${nextVLosses}/${virtualLossThresholdRef.current}) on ${sig.symbol}`
            );
            return;
          }

          // Threshold met -> Arm REAL and purchase IMMEDIATELY with ZERO lag
          lockedVirtualMarketRef.current = sig.symbol;
          setLockedVirtualMarket(sig.symbol);
          isCurrentTradeRealRef.current = true;
          setIsCurrentTradeReal(true);
          appendLog(
            `VIRTUAL LOSS threshold (${nextVLosses}/${virtualLossThresholdRef.current}) met on ${sig.symbol} → Switching to REAL immediately @ $${realStakeUsed.toFixed(2)}!`
          );

          if (!isRunningRef.current) return;
          realOutcome = await executeTradeCall(false, realStakeUsed);
        } else {
          appendLog(
            `REAL ${sig.contractType} on ${sig.symbol} (Pred ${sig.prediction}, Stake ${realStakeUsed.toFixed(2)}, ${sig.strategyName || 'AutoBot'})`
          );
          realOutcome = await executeTradeCall(false, realStakeUsed);
        }

        if (!realOutcome) return;
        const { isWin, profit } = realOutcome;

        // REAL trade bookkeeping
        const nextProfit = sessionProfitRef.current + profit;
        sessionProfitRef.current = nextProfit;
        setSessionProfit(nextProfit);

        const nextCumProfit = cumulativeSessionProfitRef.current + profit;
        cumulativeSessionProfitRef.current = nextCumProfit;
        setCumulativeSessionProfit(nextCumProfit);
        sessionStorage.setItem('autobot_cumulativeSessionProfit', nextCumProfit.toFixed(2));

        if (isWin) {
          const nextWins = winsCountRef.current + 1;
          winsCountRef.current = nextWins;
          setWinsCount(nextWins);
          consecLossesRef.current = 0;
          setConsecLosses(0);
          lastLostMarketRef.current = null;
          setLostPatternsState([]);
          lostPatternsRef.current = [];
          currentStakeRef.current = effectiveBaseStakeRef.current;
          setCurrentStake(effectiveBaseStakeRef.current);

          if (useVirtual) {
            consecVirtualLossesRef.current = 0;
            setConsecutiveVirtualLosses(0);
            lockedVirtualMarketRef.current = null;
            setLockedVirtualMarket(null);
            if (!virtualAfterRealLossRef.current) {
              isCurrentTradeRealRef.current = false;
              setIsCurrentTradeReal(false);
            }
          }

          appendLog(
            `WON +${profit.toFixed(2)} ${currency} on ${sig.symbol} (Session ${nextProfit.toFixed(2)})`
          );

          const hitRuns =
            !runForeverRef.current &&
            isRunsLimitEnabledRef.current &&
            nextWins >= runsLimitRef.current;
          const hitTp =
            !runForeverRef.current &&
            !isRunsLimitEnabledRef.current &&
            nextProfit >= takeProfitRef.current;

          if (hitRuns || hitTp) {
            continuousLockedMarketRef.current = null;
            lockedVirtualMarketRef.current = null;
            setLockedVirtualMarket(null);

            if (autoRestartAfterTpRef.current) {
              if (nextCumProfit >= autoRestartMaxTpRef.current) {
                isRunningRef.current = false;
                setIsRunning(false);
                setAutoRestartAfterTp(false);
                appendLog(
                  `Overall Auto-Start Take Profit $${autoRestartMaxTpRef.current.toFixed(2)} reached! Bot stopped.`
                );
                notify('success', `Overall Target +$${autoRestartMaxTpRef.current.toFixed(2)} hit!`);
              } else {
                sessionProfitRef.current = 0;
                setSessionProfit(0);
                winsCountRef.current = 0;
                setWinsCount(0);
                lossesCountRef.current = 0;
                setLossesCount(0);
                appendLog(
                  `Session TP hit (+${nextProfit.toFixed(2)}). Auto-reset & continuing toward $${autoRestartMaxTpRef.current.toFixed(2)}...`
                );
              }
            } else {
              isRunningRef.current = false;
              setIsRunning(false);
              notify(
                'success',
                hitRuns
                  ? `Target ${runsLimitRef.current} winning runs reached!`
                  : `Take Profit +${nextProfit.toFixed(2)} reached!`
              );
            }
          }
        } else {
          const nextLosses = lossesCountRef.current + 1;
          lossesCountRef.current = nextLosses;
          setLossesCount(nextLosses);
          consecLossesRef.current = consecLossesRef.current + 1;
          setConsecLosses(consecLossesRef.current);
          lastLostMarketRef.current = sig.symbol;
          lastLossTimeRef.current = Date.now();

          if (patternRecoveryModeRef.current && sig.matchedPatternKey) {
            const nextLost = [...new Set([...lostPatternsRef.current, sig.matchedPatternKey])];
            lostPatternsRef.current = nextLost;
            setLostPatternsState(nextLost);
          }

          if (patternSmartModeRef.current) {
            const relearned = runPatternLearning(
              sig.matchedPatternKey?.split('=')[0],
              sig.prediction
            );
            if (relearned) {
              setCustomPattern(relearned.pattern);
              customPatternRef.current = relearned.pattern;
              setPatternSmartDigit(relearned.digit);
              patternSmartDigitRef.current = relearned.digit;
            }
          }

          const mult = Number(martingaleRef.current) || 1;
          if (mult > 1) {
            const nextStake = Math.min(
              9130,
              Math.max(0.35, Math.round(realStakeUsed * mult * 100) / 100)
            );
            currentStakeRef.current = nextStake;
            setCurrentStake(nextStake);
          }

          if (useVirtual && virtualAfterRealLossRef.current) {
            consecVirtualLossesRef.current = 0;
            setConsecutiveVirtualLosses(0);
            isCurrentTradeRealRef.current = false;
            setIsCurrentTradeReal(false);
          }

          appendLog(
            `LOST ${profit.toFixed(2)} ${currency} on ${sig.symbol} · Next stake ${currentStakeRef.current.toFixed(2)}`
          );

          if (!runForeverRef.current && Math.abs(Math.min(0, nextProfit)) >= stopLossRef.current) {
            isRunningRef.current = false;
            setIsRunning(false);
            notify('error', `Stop Loss -${Math.abs(nextProfit).toFixed(2)} reached. Bot stopped.`);
          }
        }
      } catch (err: any) {
        appendLog(`Trade Error: ${err?.message || 'Execution failed'}`);
        notify('error', err?.message || 'AutoBot trade execution error.');
      } finally {
        tradeInFlightRef.current = false;
      }
    }, 20);

    return () => {
      clearInterval(interval);
    };
  }, [appendLog, currency, isAutoStakeEnabled, notify, runPatternLearning]);

  // Stop local execution cleanly on unmount
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
    };
  }, []);

  const handleContractTypeChange = (typeId: AutoBotContractType) => {
    setContractTypeState(typeId);
    signalQueueRef.current = [];
    continuousLockedMarketRef.current = null;
    if (typeId === 'digitover') {
      if (targetDigit < 0 || targetDigit > 8) setTargetDigit(2);
      if (['types', 'axa', 'differs_noise', 'lad_prng', 'over_under'].includes(streakMode)) {
        setStreakMode('consecutive');
      }
    } else if (typeId === 'digitunder') {
      if (targetDigit < 1 || targetDigit > 9) setTargetDigit(8);
      if (['types', 'axa', 'differs_noise', 'lad_prng', 'over_under'].includes(streakMode)) {
        setStreakMode('consecutive');
      }
    } else if (typeId === 'digitmatch') {
      if (targetDigit < 0 || targetDigit > 9) setTargetDigit(4);
      if (['types', 'axa', 'differs_noise', 'percentage', 'over_under'].includes(streakMode)) {
        setStreakMode('consecutive');
      }
    } else if (typeId === 'over_under') {
      if (!['consecutive_touch', 'pattern', 'over_under', 'analysis_tool', 'circle_over_under'].includes(streakMode)) {
        setStreakMode('over_under');
      }
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isRunning) setCheckedMarkets(ALL_AUTOBOT_SYMBOLS);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isRunning) setCheckedMarkets([]);
  };

  const toggleSelectMarket = (symbol: string) => {
    if (isRunning) return;
    setCheckedMarkets((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  const isOverActive =
    contractType === 'digitover' ||
    (contractType === 'over_under' && ouPatternSelection !== 'under8');
  const isUnderActive =
    contractType === 'digitunder' ||
    (contractType === 'over_under' && ouPatternSelection === 'under8');
  const activeOverDigit = targetDigit >= 0 && targetDigit <= 8 ? targetDigit : 2;
  const activeUnderDigit = targetDigit >= 1 && targetDigit <= 9 ? targetDigit : 8;
  const hasEqualsInPattern = customPattern.includes('=');

  const isDigitMatchingHelper = (
    digit: number,
    lastDigit?: number,
    _coldDigit?: number | null,
    index?: number,
    digits?: number[],
    symbol?: string
  ) => {
    if (streakMode === 'pattern') {
      if (!digits || index === undefined) return false;
      const subPatterns = customPattern
        .split(',')
        .map((p) => p.trim().split('=')[0].replace(/[^0-9]/g, ''))
        .filter(Boolean);
      for (const seq of subPatterns) {
        const patDigits = seq.split('').map((c) => parseInt(c, 10));
        if (digits.length >= patDigits.length) {
          const slice = digits.slice(-patDigits.length);
          if (
            patDigits.every((v, i) => slice[i] === v) &&
            index >= digits.length - patDigits.length
          ) {
            return true;
          }
        }
      }
      return false;
    }
    if (streakMode === 'axa' && symbol) {
      const td = marketTicks[symbol];
      return Boolean(td?.axaSignal && digit === td.axaSignal.prediction);
    }
    if (streakMode === 'types' && symbol) {
      const td = marketTicks[symbol];
      return Boolean(td?.typesSignal && digit === td.typesSignal.prediction);
    }
    if (targetDigit === -1) {
      return streakMode === 'consecutive' && lastDigit !== undefined && digit === lastDigit;
    }
    if (streakMode === 'percentage') {
      if (contractType === 'digitover') return digit > targetDigit;
      if (contractType === 'digitunder') return digit < targetDigit;
      if (contractType === 'dual_ou') return digit > targetDigit || digit < targetDigit2;
      return false;
    }
    if (streakMode === 'consecutive') return digit === targetDigit;
    if (contractType === 'digitover') return digit > targetDigit;
    if (contractType === 'digitunder') return digit < targetDigit;
    if (contractType === 'digitdiff') return digit !== targetDigit;
    if (contractType === 'digitmatch') return digit === targetDigit;
    if (contractType === 'dual_ou') return digit !== targetDigit;
    return false;
  };

  const activeSessionProfit =
    cumulativeSessionProfit !== 0 ? cumulativeSessionProfit : sessionProfit;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#0a0b0d] rounded-xl border border-[#1F2937] overflow-hidden select-none relative">
      {/* Inline Notification Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                'flex items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold shadow-2xl backdrop-blur-md',
                t.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                  : t.type === 'error'
                  ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                  : t.type === 'warn'
                  ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                  : 'bg-[#14171f]/95 border-slate-700 text-slate-200'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {t.type === 'success' ? (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                ) : t.type === 'error' ? (
                  <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                ) : (
                  <Info size={14} className="text-sky-400 shrink-0" />
                )}
                <span className="truncate">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* LEFT SIDEBAR CONTROL PANEL */}
      <aside className="w-full md:w-80 lg:w-[340px] bg-[#121315] border-b md:border-b-0 md:border-r border-[#222428] flex flex-col p-4 shrink-0 space-y-4 overflow-y-auto md:max-h-[calc(100vh-110px)]">
        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between border-b border-[#222428]/60 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#ff444f]" />
            <span className="font-black text-xs uppercase tracking-widest text-slate-200">
              AutoBot Settings
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            className="px-2.5 py-1.5 bg-[#1a1c20] hover:bg-[#25282f] border border-[#222428] rounded-lg text-slate-300 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5"
          >
            {isSettingsExpanded ? 'Hide Controls' : 'Show Controls'}
            <ChevronRight
              size={10}
              className={cn(
                'transition-transform duration-200',
                isSettingsExpanded && 'rotate-90'
              )}
            />
          </button>
        </div>

        <div className={cn('space-y-4 flex-col', !isSettingsExpanded ? 'hidden md:flex' : 'flex')}>
          {/* CONTRACT TYPE */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Contract Type
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'digitdiff', name: 'Differ' },
                  { id: 'digitmatch', name: 'Match' },
                  { id: 'accumulator', name: 'Accu' },
                  { id: 'digitover', name: 'Over' },
                  { id: 'digitunder', name: 'Under' },
                ] as const
              ).map((type) => {
                const isSelected =
                  contractType === type.id ||
                  (type.id === 'digitover' &&
                    contractType === 'over_under' &&
                    ouPatternSelection !== 'under8') ||
                  (type.id === 'digitunder' &&
                    contractType === 'over_under' &&
                    ouPatternSelection === 'under8');
                const isTypeDisabled = isRunning || (streakMode === 'types' && type.id !== 'digitdiff');
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleContractTypeChange(type.id)}
                    disabled={isTypeDisabled}
                    className={cn(
                      'py-2 px-1 text-[11px] font-black rounded-lg border transition-all text-center truncate cursor-pointer',
                      isSelected
                        ? 'bg-[#ff444f]/10 border-[#ff444f] text-white shadow-[0_0_15px_rgba(255,68,79,0.15)]'
                        : 'bg-[#0e0f11] border-transparent text-slate-400 hover:border-[#333] hover:text-white',
                      isTypeDisabled && 'opacity-55 cursor-not-allowed'
                    )}
                    title={type.name}
                  >
                    {type.name}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'over_under', name: 'Over / Under Scanner' },
                  { id: 'dual_ou', name: 'Dual O/U Barriers' },
                ] as const
              ).map((type) => {
                const isSelected = contractType === type.id;
                const isTypeDisabled = isRunning || streakMode === 'types';
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => handleContractTypeChange(type.id)}
                    disabled={isTypeDisabled}
                    className={cn(
                      'py-1.5 px-2 text-[10px] font-black rounded-lg border transition-all text-center truncate cursor-pointer',
                      isSelected
                        ? 'bg-[#00a79e]/15 border-[#00a79e] text-[#00a79e]'
                        : 'bg-[#0e0f11] border-[#222428] text-slate-400 hover:text-white',
                      isTypeDisabled && 'opacity-55 cursor-not-allowed'
                    )}
                  >
                    {type.name}
                  </button>
                );
              })}
            </div>

            {streakMode === 'types' && (
              <span className="block text-[8px] text-amber-500 font-medium leading-none mt-1">
                Disabled: Types mode supports Differ contract type only.
              </span>
            )}
          </div>

          {/* DURATION (TICKS) & RANDOM TICKS SWITCH */}
          {contractType !== 'accumulator' && (
            <div className="p-3 bg-[#0e0f11] border border-[#222428] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Duration (Ticks)
                  </span>
                  <span className="block text-[8.5px] text-slate-500 font-medium leading-none mt-0.5">
                    Active for Differ & O/U
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={tradeDuration}
                    disabled={isRunning || isRandomTicks}
                    onChange={(e) =>
                      setTradeDuration(
                        Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className={cn(
                      'w-14 bg-[#14161a] border border-[#222428] text-white font-mono font-bold text-xs rounded-lg px-2.5 py-1.5 text-center outline-none focus:border-[#ff444f]',
                      (isRunning || isRandomTicks) && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                  <span className="text-[11px] font-bold text-slate-400">Ticks</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Random Ticks Switch
                </span>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setIsRandomTicks(!isRandomTicks)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                    isRandomTicks ? 'bg-[#ff444f]' : 'bg-zinc-700',
                    isRunning && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      isRandomTicks ? 'translate-x-4' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TARGET DIGIT / BARRIER */}
          {contractType !== 'accumulator' &&
            (isOverActive ? (
              <div className="space-y-2.5 p-3 bg-[#0e0f11] border border-[#222428] rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#00a79e]">
                    OVER DIGIT BARRIER
                  </span>
                  <span className="text-[10px] font-black font-mono px-2.5 py-0.5 rounded bg-[#00a79e]/15 text-[#00a79e] border border-[#00a79e]/40">
                    Trading Over {activeOverDigit}
                  </span>
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setTargetDigit(d)}
                      className={cn(
                        'h-9 rounded-lg flex items-center justify-center font-black text-xs transition-all cursor-pointer',
                        activeOverDigit === d
                          ? 'bg-[#00a79e] text-white shadow-[0_0_12px_rgba(0,167,158,0.4)] border border-[#00a79e]'
                          : 'bg-[#14161a] text-slate-300 border border-[#222428] hover:text-white'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  Purchases <strong className="text-[#00a79e]">DIGIT OVER {activeOverDigit}</strong>{' '}
                  (Win if last digit &gt; {activeOverDigit}).
                </p>
              </div>
            ) : isUnderActive ? (
              <div className="space-y-2.5 p-3 bg-[#0e0f11] border border-[#222428] rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#ff444f]">
                    UNDER DIGIT BARRIER
                  </span>
                  <span className="text-[10px] font-black font-mono px-2.5 py-0.5 rounded bg-[#ff444f]/15 text-[#ff444f] border border-[#ff444f]/40">
                    Trading Under {activeUnderDigit}
                  </span>
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setTargetDigit(d)}
                      className={cn(
                        'h-9 rounded-lg flex items-center justify-center font-black text-xs transition-all cursor-pointer',
                        activeUnderDigit === d
                          ? 'bg-[#ff444f] text-white shadow-[0_0_12px_rgba(255,68,79,0.4)] border border-[#ff444f]'
                          : 'bg-[#14161a] text-slate-300 border border-[#222428] hover:text-white'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  Purchases <strong className="text-[#ff444f]">DIGIT UNDER {activeUnderDigit}</strong>{' '}
                  (Win if last digit &lt; {activeUnderDigit}).
                </p>
              </div>
            ) : contractType === 'dual_ou' ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Over Barrier
                  </label>
                  <select
                    value={targetDigit}
                    onChange={(e) => setTargetDigit(parseInt(e.target.value, 10))}
                    disabled={isRunning}
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f]"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        Over {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Under Barrier
                  </label>
                  <select
                    value={targetDigit2}
                    onChange={(e) => setTargetDigit2(parseInt(e.target.value, 10))}
                    disabled={isRunning}
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <option key={n} value={n}>
                        Under {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Target Digit
                </label>
                <select
                  value={targetDigit}
                  onChange={(e) => setTargetDigit(parseInt(e.target.value, 10))}
                  disabled={
                    isRunning ||
                    streakMode === 'types' ||
                    hasEqualsInPattern ||
                    (streakMode === 'pattern' && patternSmartMode) ||
                    (streakMode === 'analysis_tool' && contractType === 'digitdiff')
                  }
                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] disabled:opacity-55"
                >
                  <option value={-1}>All Digits (Differ Streak)</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>
                      Digit {n}
                    </option>
                  ))}
                </select>
              </div>
            ))}

          {/* ACCUMULATOR SETTINGS & 12 STRATEGIES */}
          {contractType === 'accumulator' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 bg-[#121316] border border-[#222428]/50 rounded-xl p-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Growth Rate (%)
                  </label>
                  <select
                    value={accumulatorGrowthRate}
                    disabled={isRunning}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAccumulatorGrowthRate(val);
                      localStorage.setItem('autobot_accumulator_growth_rate', val.toString());
                    }}
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f]"
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Take Profit ($)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    disabled={isRunning}
                    value={accumulatorTakeProfit}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setAccumulatorTakeProfit(val);
                      localStorage.setItem('autobot_accumulator_take_profit', val.toString());
                    }}
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Accumulator Strategies (All checked gates required)
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {ACCU_STRATEGY_LIST.map((strat) => (
                    <div
                      key={strat.id}
                      onClick={() => {
                        if (isRunning) return;
                        const updated = {
                          ...accuStrategies,
                          [strat.id]: !accuStrategies[strat.id],
                        };
                        setAccuStrategies(updated);
                        localStorage.setItem(
                          'autobot_accumulator_strategies',
                          JSON.stringify(updated)
                        );
                      }}
                      className={cn(
                        'p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5',
                        accuStrategies[strat.id]
                          ? 'bg-emerald-500/5 border-emerald-500/40'
                          : 'bg-[#0e0f11] border-[#222428] hover:border-[#333]',
                        isRunning && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={!!accuStrategies[strat.id]}
                        readOnly
                        className="mt-0.5 rounded border-[#333] accent-emerald-500 pointer-events-none"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'text-[11px] font-black uppercase tracking-wide',
                              accuStrategies[strat.id] ? 'text-emerald-400' : 'text-white'
                            )}
                          >
                            {strat.name}
                          </span>
                          <span className="text-[7.5px] font-mono bg-[#17181c] px-1.5 py-0.5 rounded border border-zinc-800 text-slate-400">
                            {strat.indicators}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-snug">{strat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STREAK MODE & CIRCLES STRATEGY */}
          {contractType !== 'accumulator' && (
            <div className="space-y-2">
              <div className="flex flex-col gap-1.5">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  {isCirclesMode ? 'Circles Strategy' : 'Streak Mode'}
                </label>

                {isCirclesMode ? (
                  <select
                    disabled={isRunning}
                    value={streakMode}
                    onChange={(e) => setStreakMode(e.target.value as StreakMode)}
                    className="w-full bg-[#0c0d0f] border border-[#222428] text-white text-[11px] font-black uppercase rounded-lg px-3 py-2 outline-none focus:border-[#00a79e]"
                  >
                    <option value="circle_green">Green (Most Appearing)</option>
                    <option value="circle_blue">Blue (2nd Most Appearing)</option>
                    <option value="circle_orange">Orange (2nd Least Appearing)</option>
                    <option value="circle_red">Red (Least Appearing)</option>
                    <option value="circle_target_pct">Target Pct (%)</option>
                    <option value="circle_over_under">Circle O/U Strategy</option>
                  </select>
                ) : (
                  <div className="flex flex-wrap items-center gap-1 bg-[#0b0c0d] border border-[#222428] rounded-lg p-1">
                    {contractType === 'over_under' ? (
                      <>
                        {(
                          [
                            { id: 'consecutive_touch', label: 'Streak & Touch', tone: 'teal' },
                            { id: 'pattern', label: 'Pattern', tone: 'red' },
                            { id: 'over_under', label: 'Over 1 / Under 8 Scanner', tone: 'teal' },
                            { id: 'analysis_tool', label: 'Analysis Signals', tone: 'purple' },
                          ] as const
                        ).map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            disabled={isRunning}
                            onClick={() => setStreakMode(btn.id)}
                            className={cn(
                              'px-2 py-1 text-[9px] font-black uppercase rounded transition-all cursor-pointer',
                              streakMode === btn.id
                                ? btn.tone === 'teal'
                                  ? 'bg-[#00a79e] text-black'
                                  : btn.tone === 'purple'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-[#ff444f] text-white'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setStreakMode('consecutive')}
                          className={cn(
                            'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                            streakMode === 'consecutive'
                              ? 'bg-[#ff444f] text-white'
                              : 'text-slate-400 hover:text-white'
                          )}
                        >
                          Consecutive
                        </button>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setStreakMode('pattern')}
                          className={cn(
                            'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                            streakMode === 'pattern'
                              ? 'bg-[#ff444f] text-white'
                              : 'text-slate-400 hover:text-white'
                          )}
                        >
                          Pattern
                        </button>
                        {!['dual_ou', 'digitover', 'digitunder'].includes(contractType) && (
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => setStreakMode('types')}
                            className={cn(
                              'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                              streakMode === 'types'
                                ? 'bg-[#ff444f] text-white'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            Types
                          </button>
                        )}
                        {contractType === 'digitdiff' && (
                          <>
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => setStreakMode('axa')}
                              className={cn(
                                'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                                streakMode === 'axa'
                                  ? 'bg-[#00a79e] text-black'
                                  : 'text-slate-400 hover:text-[#00a79e]'
                              )}
                            >
                              AXA MODULO
                            </button>
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => setStreakMode('differs_noise')}
                              className={cn(
                                'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                                streakMode === 'differs_noise'
                                  ? 'bg-emerald-400 text-black'
                                  : 'text-slate-400 hover:text-emerald-400'
                              )}
                            >
                              CALM DIGIT (NOISE)
                            </button>
                          </>
                        )}
                        {(contractType === 'digitdiff' || contractType === 'digitmatch') && (
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => setStreakMode('lad_prng')}
                            className={cn(
                              'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                              streakMode === 'lad_prng'
                                ? 'bg-[#38bdf8] text-black'
                                : 'text-slate-400 hover:text-[#38bdf8]'
                            )}
                          >
                            Pattern Follower
                          </button>
                        )}
                        {['dual_ou', 'digitover', 'digitunder'].includes(contractType) && (
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => setStreakMode('percentage')}
                            className={cn(
                              'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                              streakMode === 'percentage'
                                ? 'bg-[#ff444f] text-white'
                                : 'text-slate-400 hover:text-white'
                            )}
                          >
                            Percentage
                          </button>
                        )}
                        {(contractType === 'digitover' || contractType === 'digitunder') && (
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => setStreakMode('consecutive_touch')}
                            className={cn(
                              'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                              streakMode === 'consecutive_touch'
                                ? 'bg-[#00a79e] text-black'
                                : 'text-slate-400 hover:text-[#00a79e]'
                            )}
                          >
                            Streak & Touch
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setStreakMode('price_digits')}
                          className={cn(
                            'px-2 py-1 text-[9px] font-black uppercase rounded cursor-pointer',
                            streakMode === 'price_digits'
                              ? 'bg-[#00a79e] text-black'
                              : 'text-slate-400 hover:text-[#00a79e]'
                          )}
                        >
                          Price Digits
                        </button>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setStreakMode('analysis_tool')}
                          className={cn(
                            'px-2 py-1 text-[9px] font-black uppercase rounded flex items-center gap-1 cursor-pointer',
                            streakMode === 'analysis_tool'
                              ? 'bg-purple-600 text-white'
                              : 'text-purple-300 hover:text-white'
                          )}
                        >
                          <Radio size={9} />
                          Analysis Signals
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* SMART RECOVERY STRATEGY (POST-LOSS PART) */}
              {contractType !== 'over_under' && (
                <div className="bg-[#121316] border border-[#222428]/50 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Smart Recovery Strategy
                      </span>
                      <span className="block text-[8.5px] text-slate-500">
                        Switch to a fallback strategy after a real loss
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setIsRecoveryStreakModeEnabled(!isRecoveryStreakModeEnabled)}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                        isRecoveryStreakModeEnabled ? 'bg-[#ff444f]' : 'bg-[#222428]'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                          isRecoveryStreakModeEnabled ? 'translate-x-4' : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>

                  {isRecoveryStreakModeEnabled && (
                    <div className="space-y-2.5 pt-2 border-t border-[#222428]">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                            Recovery Contract
                          </label>
                          <select
                            disabled={isRunning}
                            value={recoveryContractType}
                            onChange={(e) =>
                              setRecoveryContractType(e.target.value as AutoBotContractType)
                            }
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none"
                          >
                            <option value="digitdiff">Differ</option>
                            <option value="digitmatch">Match</option>
                            <option value="accumulator">Accumulator</option>
                            <option value="digitover">Over</option>
                            <option value="digitunder">Under</option>
                            <option value="over_under">O/U Scanner</option>
                          </select>
                        </div>

                        {recoveryContractType === 'accumulator' ? (
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                              Rec. Growth (%)
                            </label>
                            <select
                              disabled={isRunning}
                              value={recoveryAccumulatorGrowthRate}
                              onChange={(e) =>
                                setRecoveryAccumulatorGrowthRate(parseInt(e.target.value, 10))
                              }
                              className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none"
                            >
                              {[1, 2, 3, 4, 5].map((r) => (
                                <option key={r} value={r}>
                                  {r}%
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                              Recovery Digit
                            </label>
                            <select
                              disabled={isRunning}
                              value={recoveryTargetDigit}
                              onChange={(e) =>
                                setRecoveryTargetDigit(parseInt(e.target.value, 10))
                              }
                              className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none"
                            >
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                                <option key={d} value={d}>
                                  Digit {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-400 mb-1">
                          Recovery Strategy Mode
                        </label>
                        <select
                          disabled={isRunning}
                          value={recoveryStreakMode}
                          onChange={(e) => setRecoveryStreakMode(e.target.value as StreakMode)}
                          className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-bold rounded-lg px-2.5 py-1.5 outline-none"
                        >
                          <option value="consecutive">Consecutive</option>
                          <option value="pattern">Pattern</option>
                          <option value="types">Types</option>
                          <option value="axa">AXA Modulo</option>
                          <option value="differs_noise">Calm Digit (Noise)</option>
                          <option value="lad_prng">Pattern Follower Differ</option>
                          <option value="percentage">Percentage</option>
                          <option value="consecutive_touch">Streak & Touch</option>
                          <option value="over_under">Over 1 / Under 8 Scanner</option>
                          <option value="price_digits">Price Digits</option>
                          <option value="analysis_tool">Analysis Signals</option>
                        </select>
                      </div>

                      {recoveryStreakMode === 'pattern' && (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            disabled={isRunning}
                            value={recoveryCustomPattern}
                            onChange={(e) =>
                              setRecoveryCustomPattern(e.target.value.replace(/[^0-9,=]/g, ''))
                            }
                            placeholder="Recovery patterns e.g. 686 or 23=2"
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 outline-none"
                          />
                          <div className="flex flex-wrap gap-2 text-[9px] text-slate-300">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={recoveryPatternSmartMode}
                                onChange={(e) => setRecoveryPatternSmartMode(e.target.checked)}
                              />
                              Smart Diff
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={recoveryPatternRotationalMode}
                                onChange={(e) =>
                                  setRecoveryPatternRotationalMode(e.target.checked)
                                }
                              />
                              Rotational
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={recoveryPatternRecoveryMode}
                                onChange={(e) => setRecoveryPatternRecoveryMode(e.target.checked)}
                              />
                              Safeguard
                            </label>
                          </div>
                        </div>
                      )}

                      {recoveryStreakMode === 'consecutive' && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400">Rec. Streak:</span>
                          <select
                            disabled={isRunning}
                            value={recoveryStreakThreshold}
                            onChange={(e) =>
                              setRecoveryStreakThreshold(parseInt(e.target.value, 10))
                            }
                            className="bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-bold rounded-lg px-2 py-1"
                          >
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <option key={n} value={n}>
                                {n} Exact
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {recoveryStreakMode === 'price_digits' && (
                        <input
                          type="text"
                          disabled={isRunning}
                          value={recoveryPriceDigitsInput}
                          onChange={(e) => setRecoveryPriceDigitsInput(e.target.value)}
                          placeholder=".01, .1780, .392"
                          className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded-lg px-2.5 py-1.5 outline-none"
                        />
                      )}

                      {recoveryStreakMode === 'percentage' && (
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-slate-400">Rec % Threshold:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={recoveryPercentageThreshold}
                            onChange={(e) =>
                              setRecoveryPercentageThreshold(
                                Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                              )
                            }
                            className="w-16 bg-[#0e0f11] border border-[#222428] text-white font-mono text-xs rounded px-2 py-1 text-center"
                          />
                        </div>
                      )}

                      {recoveryStreakMode === 'types' && (
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-300">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={recoveryTypesTransitionMatrix}
                              onChange={(e) => setRecoveryTypesTransitionMatrix(e.target.checked)}
                            />
                            Transition
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={recoveryTypesMirrorDigitReversal}
                              onChange={(e) =>
                                setRecoveryTypesMirrorDigitReversal(e.target.checked)
                              }
                            />
                            Mirror Reversal
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={recoveryTypesTickCompression}
                              onChange={(e) => setRecoveryTypesTickCompression(e.target.checked)}
                            />
                            Compression
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={recoveryTypesHiddenCycleLength}
                              onChange={(e) => setRecoveryTypesHiddenCycleLength(e.target.checked)}
                            />
                            Hidden Cycle
                          </label>
                        </div>
                      )}

                      {recoveryStreakMode === 'consecutive_touch' && (
                        <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                          <div>
                            <span className="text-slate-400 block">Opp Ticks</span>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={recoveryConsecTouchOpposingTicks}
                              onChange={(e) =>
                                setRecoveryConsecTouchOpposingTicks(
                                  Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1))
                                )
                              }
                              className="w-full bg-[#0e0f11] border border-[#222428] text-white font-mono rounded px-1.5 py-1"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block">Touches</span>
                            <input
                              type="number"
                              min={1}
                              max={3}
                              value={recoveryConsecTouchTargetDigits}
                              onChange={(e) =>
                                setRecoveryConsecTouchTargetDigits(
                                  Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1))
                                )
                              }
                              className="w-full bg-[#0e0f11] border border-[#222428] text-white font-mono rounded px-1.5 py-1"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block">Rule</span>
                            <select
                              value={recoveryConsecTouchTouchType}
                              onChange={(e) =>
                                setRecoveryConsecTouchTouchType(
                                  e.target.value as 'target' | 'any'
                                )
                              }
                              className="w-full bg-[#0e0f11] border border-[#222428] text-white rounded px-1 py-1"
                            >
                              <option value="target">Target</option>
                              <option value="any">Any</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {recoveryStreakMode === 'analysis_tool' && (
                        <label className="flex items-center justify-between text-[10px] text-slate-300 cursor-pointer">
                          <span>Opposite Signal Target</span>
                          <input
                            type="checkbox"
                            checked={recoveryAnalysisOppositeSignalEnabled}
                            onChange={(e) =>
                              setRecoveryAnalysisOppositeSignalEnabled(e.target.checked)
                            }
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MAIN MODE DETAILS & INPUTS */}
              {streakMode === 'pattern' && (
                <div className="space-y-2.5 p-3 bg-[#17181c] border border-[#222428] rounded-xl">
                  {contractType === 'over_under' && (
                    <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-[#222428]">
                      <button
                        type="button"
                        onClick={() => setOuPatternSelection('over1')}
                        className={cn(
                          'py-1.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer',
                          ouPatternSelection === 'over1'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                            : 'bg-[#0e0f11] border-[#222428] text-slate-400'
                        )}
                      >
                        Over 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setOuPatternSelection('under8')}
                        className={cn(
                          'py-1.5 rounded-lg text-[10px] font-black uppercase border cursor-pointer',
                          ouPatternSelection === 'under8'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                            : 'bg-[#0e0f11] border-[#222428] text-slate-400'
                        )}
                      >
                        Under 8
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">
                      Consecutive Patterns
                    </label>
                    <input
                      type="text"
                      disabled={isRunning}
                      value={customPattern}
                      onChange={(e) =>
                        setCustomPattern(e.target.value.replace(/[^0-9,=]/g, ''))
                      }
                      placeholder="e.g. 23=2,44=4 or 686"
                      maxLength={40}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f]"
                    />
                  </div>

                  {!['dual_ou', 'digitover', 'digitunder'].includes(contractType) && (
                    <div className="space-y-2 pt-1 text-[10px]">
                      <label className="flex items-center justify-between text-slate-200 font-bold cursor-pointer">
                        <span>Pattern Auto-Switch / Smart Diff</span>
                        <input
                          type="checkbox"
                          checked={patternSmartMode}
                          onChange={(e) => setPatternSmartMode(e.target.checked)}
                          className="accent-[#ff444f]"
                        />
                      </label>
                      {patternSmartMode && (
                        <div className="flex items-center justify-between bg-[#0e0f11] p-1.5 rounded border border-[#222428] font-mono text-[10px]">
                          <span className="text-emerald-400">Pattern: {customPattern}</span>
                          <span className="text-amber-400">
                            Differ: {patternSmartDigit ?? 'Auto'}
                          </span>
                        </div>
                      )}
                      <label className="flex items-center justify-between text-slate-200 font-bold cursor-pointer">
                        <span>Pattern Rotational / Circular</span>
                        <input
                          type="checkbox"
                          checked={patternRotationalMode}
                          onChange={(e) => setPatternRotationalMode(e.target.checked)}
                          className="accent-[#ff444f]"
                        />
                      </label>
                      <label className="flex items-center justify-between text-slate-200 font-bold cursor-pointer">
                        <span>Pattern Recovery Safeguard</span>
                        <input
                          type="checkbox"
                          checked={patternRecoveryMode}
                          onChange={(e) => setPatternRecoveryMode(e.target.checked)}
                          className="accent-[#ff444f]"
                        />
                      </label>
                    </div>
                  )}

                  {patternRecoveryMode && consecLosses > 0 && lostPatternsState.length > 0 && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[9.5px] text-amber-300">
                      Ignoring lost pattern(s): <strong>{lostPatternsState.join(', ')}</strong>
                    </div>
                  )}
                </div>
              )}

              {streakMode === 'consecutive' && (
                <div className="space-y-2.5 p-3 bg-[#17181c] border border-[#222428] rounded-xl">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Consecutive Threshold
                    </label>
                    <select
                      value={streakThreshold}
                      disabled={isRunning}
                      onChange={(e) => setStreakThreshold(parseInt(e.target.value, 10))}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <option key={num} value={num}>
                          {num} Consecutive Exact
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-2 border-t border-[#222428] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300 uppercase">
                        Post-Loss Threshold
                      </span>
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={isLossStreakThresholdEnabled}
                        onChange={(e) => setIsLossStreakThresholdEnabled(e.target.checked)}
                        className="accent-[#ff444f]"
                      />
                    </div>
                    {isLossStreakThresholdEnabled && (
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            disabled={isRunning}
                            onClick={() => setLossStreakThreshold(num)}
                            className={cn(
                              'py-1 text-[10px] font-mono font-bold rounded border cursor-pointer',
                              lossStreakThreshold === num
                                ? 'bg-[#ff444f] border-[#ff444f] text-white'
                                : 'bg-[#0e0f11] border-[#222428] text-slate-400'
                            )}
                          >
                            {num}T
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {streakMode === 'types' && (
                <div className="p-3 bg-[#17181c] border border-[#222428] rounded-xl space-y-2 text-[10px]">
                  <span className="block font-black text-rose-400 uppercase tracking-wider">
                    Types Mode Strategies
                  </span>
                  {[
                    {
                      label: 'Transition Matrix',
                      val: typesTransitionMatrix,
                      set: setTypesTransitionMatrix,
                    },
                    {
                      label: 'Mirror Digit Reversal',
                      val: typesMirrorDigitReversal,
                      set: setTypesMirrorDigitReversal,
                    },
                    {
                      label: 'Tick Compression Breakout',
                      val: typesTickCompression,
                      set: setTypesTickCompression,
                    },
                    {
                      label: 'Hidden Cycle Length',
                      val: typesHiddenCycleLength,
                      set: setTypesHiddenCycleLength,
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center justify-between text-slate-200 font-bold cursor-pointer py-0.5"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="accent-[#ff444f]"
                      />
                    </label>
                  ))}
                </div>
              )}

              {streakMode === 'axa' && (
                <div className="p-3 bg-[#17181c] border border-[#00a79e]/40 rounded-xl space-y-1.5">
                  <span className="block text-[10px] font-black text-[#00a79e] uppercase tracking-wider">
                    AXA Modulo Reset Strategy (A → X → A)
                  </span>
                  <p className="text-[9.5px] text-slate-400 leading-relaxed">
                    Detects localized state loops A → X → A (where A == A and A != X) over the last 3
                    ticks and executes DIGIT DIFF X immediately.
                  </p>
                </div>
              )}

              {streakMode === 'lad_prng' && (
                <div className="p-3 bg-[#17181c] border border-[#38bdf8]/40 rounded-xl space-y-2.5">
                  <span className="block text-[10px] font-black text-[#38bdf8] uppercase tracking-wider">
                    Pattern Follower Differ
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[8px] text-slate-400 uppercase block mb-0.5">
                        Pat Len
                      </span>
                      <select
                        disabled={isRunning}
                        value={pmfPatternLen}
                        onChange={(e) => setPmfPatternLen(parseInt(e.target.value, 10))}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-bold rounded px-1.5 py-1"
                      >
                        <option value={2}>2 Digits</option>
                        <option value={3}>3 Digits</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 uppercase block mb-0.5">
                        Min Occur
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        disabled={isRunning}
                        value={pmfMinOccurrences}
                        onChange={(e) =>
                          setPmfMinOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 uppercase block mb-0.5">
                        Follower
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        disabled={isRunning}
                        value={pmfFollowerLen}
                        onChange={(e) =>
                          setPmfFollowerLen(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {streakMode === 'differs_noise' && (
                <div className="p-3 bg-[#17181c] border border-emerald-500/30 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                      Calm Digit (Noise Indicator)
                    </span>
                    <span className="text-[9px] font-mono text-emerald-300">
                      Score ≤ {differsNoiseMaxScore}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Max Noise</span>
                      <input
                        type="number"
                        min={10}
                        max={70}
                        disabled={isRunning}
                        value={differsNoiseMaxScore}
                        onChange={(e) =>
                          setDiffersNoiseMaxScore(
                            Math.min(70, Math.max(10, parseInt(e.target.value, 10) || 35))
                          )
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Min Calm</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        disabled={isRunning}
                        value={differsNoiseMinCalmTicks}
                        onChange={(e) =>
                          setDiffersNoiseMinCalmTicks(
                            Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 3))
                          )
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Target Rule</span>
                      <select
                        disabled={isRunning}
                        value={differsNoiseTargetMode}
                        onChange={(e) =>
                          setDiffersNoiseTargetMode(e.target.value as 'latest' | 'top_calm')
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[10px] font-bold rounded px-1.5 py-1"
                      >
                        <option value="latest">Latest</option>
                        <option value="top_calm">Top Calm</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {streakMode === 'percentage' && (
                <div className="p-3 bg-[#17181c] border border-[#222428] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      Percentage Threshold (%)
                    </span>
                    <label className="flex items-center gap-1 text-[9px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={isExactPercentage}
                        onChange={(e) => setIsExactPercentage(e.target.checked)}
                        className="accent-[#ff444f]"
                      />
                      Exact Match
                    </label>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={isRunning}
                    value={percentageThreshold}
                    onChange={(e) =>
                      setPercentageThreshold(
                        Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0))
                      )
                    }
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none"
                  />
                </div>
              )}

              {streakMode === 'price_digits' && (
                <div className="p-3 bg-[#17181c] border border-[#222428] rounded-xl space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Target Price Digits / Endings
                  </label>
                  <input
                    type="text"
                    disabled={isRunning}
                    value={priceDigitsInput}
                    onChange={(e) => setPriceDigitsInput(e.target.value)}
                    placeholder=".01, .1780, .392"
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono rounded-lg px-3 py-2 outline-none"
                  />
                </div>
              )}

              {streakMode === 'over_under' && (
                <div className="p-3 bg-[#17181c] border border-[#00a79e]/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-[#00a79e] uppercase tracking-wider">
                      Over 1 / Under 8 Scanner
                    </span>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setIsEdmsEnabled(!isEdmsEnabled)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer',
                        isEdmsEnabled
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-[#0e0f11] border-[#222428] text-slate-400'
                      )}
                    >
                      {isEdmsEnabled ? 'EDMS ON' : 'COLD ZONE'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Sample</span>
                      <input
                        type="number"
                        min={20}
                        max={1000}
                        disabled={isRunning}
                        value={ouSamplePeriod}
                        onChange={(e) =>
                          setOuSamplePeriod(Math.max(20, parseInt(e.target.value, 10) || 100))
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Zone Max%</span>
                      <input
                        type="number"
                        step="0.5"
                        min={1}
                        max={40}
                        disabled={isRunning}
                        value={ouColdThresholdMax}
                        onChange={(e) =>
                          setOuColdThresholdMax(parseFloat(e.target.value) || 12)
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Single Max%</span>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        max={20}
                        disabled={isRunning}
                        value={ouSingleDigitMax}
                        onChange={(e) =>
                          setOuSingleDigitMax(parseFloat(e.target.value) || 6)
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {streakMode === 'consecutive_touch' && (
                <div className="p-3 bg-[#17181c] border border-[#00a79e]/40 rounded-xl space-y-2.5">
                  <span className="block text-[10px] font-black text-[#00a79e] uppercase">
                    Streak & Touch Configuration
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Opp Ticks</span>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        disabled={isRunning}
                        value={consecTouchOpposingTicks}
                        onChange={(e) =>
                          setConsecTouchOpposingTicks(
                            Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1))
                          )
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Touches</span>
                      <input
                        type="number"
                        min={1}
                        max={3}
                        disabled={isRunning}
                        value={consecTouchTargetDigits}
                        onChange={(e) =>
                          setConsecTouchTargetDigits(
                            Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1))
                          )
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block mb-0.5">Touch Rule</span>
                      <select
                        disabled={isRunning}
                        value={consecTouchTouchType}
                        onChange={(e) =>
                          setConsecTouchTouchType(e.target.value as 'target' | 'any')
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[10px] font-bold rounded px-1.5 py-1"
                      >
                        <option value="target">Target</option>
                        <option value="any">Any</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {streakMode === 'circle_target_pct' && (
                <div className="p-3 bg-[#17181c] border border-purple-500/35 rounded-xl space-y-2">
                  <span className="block text-[10px] font-black text-purple-300 uppercase">
                    Circle Target Percentage
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <span className="text-[8px] text-slate-400 block">Pct %</span>
                      <input
                        type="number"
                        step="0.5"
                        value={circleTargetPct}
                        onChange={(e) => setCircleTargetPct(parseFloat(e.target.value) || 10)}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block">Compare</span>
                      <select
                        value={circleCompareMode}
                        onChange={(e) =>
                          setCircleCompareMode(e.target.value as 'higher' | 'lower')
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[10px] rounded px-1.5 py-1"
                      >
                        <option value="higher">&ge; Higher</option>
                        <option value="lower">&le; Lower</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block">Digits</span>
                      <input
                        type="text"
                        value={circleFilterDigits}
                        onChange={(e) => setCircleFilterDigits(e.target.value)}
                        placeholder="all"
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[11px] font-mono rounded px-2 py-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {streakMode === 'circle_over_under' && (
                <div className="p-3 bg-[#17181c] border border-[#12d6c2]/40 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-[#12d6c2] uppercase">
                      Circle O/U Strategy Builder
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCircleOuTargetType('over');
                          setCircleOuDigit(1);
                          setCircleOuLowDigits('0,1');
                        }}
                        className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold cursor-pointer"
                      >
                        Over 1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCircleOuTargetType('under');
                          setCircleOuDigit(8);
                          setCircleOuLowDigits('8,9');
                        }}
                        className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[9px] font-bold cursor-pointer"
                      >
                        Under 8
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div>
                      <span className="text-slate-400 block">Low Digits</span>
                      <input
                        type="text"
                        value={circleOuLowDigits}
                        onChange={(e) => setCircleOuLowDigits(e.target.value)}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Max Low %</span>
                      <input
                        type="number"
                        step="0.5"
                        value={circleOuMaxPct}
                        onChange={(e) => setCircleOuMaxPct(parseFloat(e.target.value) || 9)}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Over Touches</span>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={circleOuOverTouchCount}
                        onChange={(e) =>
                          setCircleOuOverTouchCount(parseInt(e.target.value, 10) || 2)
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white font-mono rounded px-2 py-1"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block">Final Max Ticks</span>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={circleOuFinalTouchMaxTicks}
                        onChange={(e) =>
                          setCircleOuFinalTouchMaxTicks(parseInt(e.target.value, 10) || 3)
                        }
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white font-mono rounded px-2 py-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Low Touch Mode:</span>
                    <select
                      value={circleOuLowTouchMode}
                      onChange={(e) =>
                        setCircleOuLowTouchMode(
                          e.target.value as 'consecutive' | 'one_by_one'
                        )
                      }
                      className="bg-[#0e0f11] border border-[#222428] text-white rounded px-2 py-1"
                    >
                      <option value="consecutive">Consecutive</option>
                      <option value="one_by_one">One by One</option>
                    </select>
                  </div>
                </div>
              )}

              {streakMode === 'analysis_tool' && (
                <div className="p-3 bg-[#121316] border border-purple-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-300 uppercase flex items-center gap-1.5">
                      <Radio size={12} className="animate-pulse" />
                      Analysis Tool Live Bridge
                    </span>
                  </div>
                  {['over_under', 'dual_ou', 'digitover', 'digitunder'].includes(contractType) && (
                    <label className="flex items-center justify-between text-[10px] text-slate-300 cursor-pointer pt-1 border-t border-[#222428]">
                      <span>Opposite Signal Target</span>
                      <input
                        type="checkbox"
                        disabled={isRunning}
                        checked={analysisOppositeSignalEnabled}
                        onChange={(e) => setAnalysisOppositeSignalEnabled(e.target.checked)}
                        className="accent-purple-500"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MARKETS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Markets ({visibleCheckedMarkets.length})
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] font-bold text-[#ff444f] hover:underline cursor-pointer"
                >
                  Select all
                </button>
                <span className="text-[10px] text-slate-600">/</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#17181c] border border-[#222428] rounded-xl p-2.5">
              <div>
                <span className="block text-[10px] font-extrabold text-white uppercase">
                  Continues trading after a signal
                </span>
                <span className="block text-[8px] text-slate-500 leading-tight">
                  Lock onto triggered market until TP hits
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !isContinuousTrading;
                  setIsContinuousTrading(next);
                  if (next) setAlternateMarketRecovery(false);
                }}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  isContinuousTrading ? 'bg-[#ff444f]' : 'bg-[#222428]'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                    isContinuousTrading ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#17181c] border border-[#222428] rounded-xl p-2.5">
              <div>
                <span className="block text-[10px] font-extrabold text-white uppercase">
                  Alternate Market Recovery
                </span>
                <span className="block text-[8px] text-slate-500 leading-tight">
                  Wait for a different market to recover after a loss
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !alternateMarketRecovery;
                  setAlternateMarketRecovery(next);
                  if (next) setIsContinuousTrading(false);
                }}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  alternateMarketRecovery ? 'bg-[#ff444f]' : 'bg-[#222428]'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                    alternateMarketRecovery ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            <div className="bg-[#0e0f11] border border-[#222428] rounded-xl p-2.5 h-40 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
                {AUTOBOT_MARKET_CONFIGS.map((market) => {
                  const checked = visibleCheckedMarkets.includes(market.symbol);
                  return (
                    <div
                      key={market.symbol}
                      onClick={() => toggleSelectMarket(market.symbol)}
                      className={cn(
                        'flex items-center gap-1.5 text-[11px] font-bold cursor-pointer py-0.5 truncate',
                        isRunning ? 'opacity-50 cursor-not-allowed' : 'hover:text-white text-slate-400'
                      )}
                    >
                      {checked ? (
                        <CheckSquare size={13} className="text-[#ff444f] shrink-0" />
                      ) : (
                        <SquareIcon size={13} className="text-slate-600 shrink-0" />
                      )}
                      <span className="truncate">{market.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STAKE & AUTO STAKE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Stake ({currency})
              </label>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setIsAutoStakeEnabled(!isAutoStakeEnabled)}
                className={cn(
                  'flex items-center gap-1 py-0.5 px-1.5 rounded-md border text-[9px] font-black uppercase cursor-pointer',
                  isAutoStakeEnabled
                    ? 'bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]'
                    : 'bg-[#16191e] border-[#222428] text-slate-500'
                )}
              >
                <span>Auto Stake</span>
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              value={isAutoStakeEnabled ? autoStakeValue : stake || ''}
              disabled={isRunning || isAutoStakeEnabled}
              onChange={(e) => setStake(Math.max(0.35, parseFloat(e.target.value) || 0.35))}
              className={cn(
                'w-full bg-[#0e0f11] border text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none',
                isAutoStakeEnabled
                  ? 'border-[#ff444f]/30 text-[#ff444f] cursor-not-allowed'
                  : 'border-[#222428] text-white focus:border-[#ff444f]'
              )}
            />
          </div>

          {/* MARTINGALE */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Martingale x
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={martingale || ''}
              disabled={isRunning}
              onChange={(e) => setMartingale(Math.max(1, parseFloat(e.target.value) || 1))}
              className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f]"
            />
          </div>

          {/* VIRTUAL LOSS FILTER - STRICTLY HIDDEN WHEN !hasVirtualToken */}
          {hasVirtualToken && (
            <div className="bg-[#0b0c12] p-3 rounded-xl border border-[#22242f] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="flex items-center gap-1.5 font-bold text-slate-200">
                  <ShieldAlert size={12} className="text-purple-400" />
                  Virtual Loss Filter
                </span>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setUseVirtualLoss(!useVirtualLoss)}
                  className={cn(
                    'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors',
                    useVirtualLoss ? 'bg-purple-600' : 'bg-zinc-700'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition mt-0.5 ml-0.5',
                      useVirtualLoss ? 'translate-x-3' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              {useVirtualLoss && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono p-2 rounded-lg bg-[#141622] border border-[#232636]">
                    <span className="text-amber-300 font-bold">Only After Real Loss</span>
                    <input
                      type="checkbox"
                      disabled={isRunning}
                      checked={virtualAfterRealLoss}
                      onChange={(e) => setVirtualAfterRealLoss(e.target.checked)}
                      className="accent-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Virtual Losses Required:</span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      disabled={isRunning}
                      value={virtualLossThreshold}
                      onChange={(e) =>
                        setVirtualLossThreshold(
                          Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1))
                        )
                      }
                      className="w-14 bg-[#12141f] border border-[#232636] rounded px-2 py-1 text-xs font-mono text-purple-300 font-bold text-center"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
                    <div className="flex items-center justify-between bg-[#141622] px-2 py-1 rounded border border-emerald-500/25">
                      <span className="text-slate-400">V-Wins:</span>
                      <span className="font-bold text-emerald-400">{virtualWinsCount}</span>
                    </div>
                    <div className="flex items-center justify-between bg-[#141622] px-2 py-1 rounded border border-rose-500/25">
                      <span className="text-slate-400">V-Loss:</span>
                      <span className="font-bold text-rose-400">{virtualLossesCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] p-1.5 rounded border border-[#232636]">
                    <span className="text-slate-400">Loss Streak:</span>
                    <span className="font-bold text-purple-300">
                      {consecutiveVirtualLosses} / {virtualLossThreshold}
                    </span>
                  </div>

                  {lockedVirtualMarket && !isContinuousTrading && (
                    <div className="flex items-center justify-between text-[9px] font-mono bg-purple-950/40 p-1.5 rounded border border-purple-500/40 text-purple-300">
                      <span>Maintaining Market:</span>
                      <span className="font-bold text-amber-300">{lockedVirtualMarket}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] p-1.5 rounded border border-[#232636]">
                    <span className="text-slate-400">Next Trade Mode:</span>
                    <span
                      className={cn(
                        'font-bold uppercase',
                        isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold
                          ? 'text-amber-400'
                          : 'text-purple-400'
                      )}
                    >
                      {isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold
                        ? 'REAL FUNDS'
                        : 'VIRTUAL SIM'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAKE PROFIT / NO OF RUNS & STOP LOSS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                {isRunsLimitEnabled ? 'No. of Runs (Wins)' : 'Take Profit'}
              </label>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setIsRunsLimitEnabled(!isRunsLimitEnabled)}
                className={cn(
                  'py-0.5 px-1.5 rounded border text-[9px] font-black uppercase cursor-pointer',
                  isRunsLimitEnabled
                    ? 'bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]'
                    : 'bg-[#16191e] border-[#222428] text-slate-500'
                )}
              >
                No of Runs
              </button>
            </div>
            {isRunsLimitEnabled ? (
              <input
                type="number"
                min={1}
                max={10}
                value={runsLimit}
                disabled={isRunning || runForever}
                onChange={(e) =>
                  setRunsLimit(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))
                }
                className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none"
              />
            ) : (
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={takeProfit}
                disabled={isRunning || runForever}
                onChange={(e) => setTakeProfit(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full bg-[#0e0f11] border border-[#222428] text-emerald-400 text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Stop Loss
            </label>
            <input
              type="number"
              min="1"
              value={stopLoss}
              disabled={isRunning || runForever}
              onChange={(e) => setStopLoss(Math.max(1, parseFloat(e.target.value) || 1))}
              className="w-full bg-[#0e0f11] border border-[#222428] text-rose-400 text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none"
            />
          </div>

          {/* RUN FOREVER */}
          <div className="flex items-center justify-between p-2.5 bg-[#0c0d0f] border border-[#1a1b1e] rounded-lg">
            <div>
              <span className="block text-xs font-black text-white uppercase">Run Forever</span>
              <span className="block text-[8.5px] text-slate-500">Bypass TP/SL limits 24/7</span>
            </div>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setRunForever(!runForever)}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                runForever ? 'bg-[#ff444f]' : 'bg-[#222428]'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                  runForever ? 'translate-x-4' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          {/* AUTO RESET & START AFTER TAKE PROFIT */}
          <div
            className={cn(
              'p-3 rounded-xl border space-y-2.5 transition-all',
              autoRestartAfterTp
                ? 'border-emerald-500/40 bg-emerald-950/20'
                : 'bg-[#0c0d0f] border-[#1a1b1e]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    cumulativeSessionProfitRef.current = 0;
                    setCumulativeSessionProfit(0);
                    setSessionProfit(0);
                    sessionStorage.removeItem('autobot_cumulativeSessionProfit');
                  }}
                  title="Reset cumulative profit counter"
                  className="p-1.5 rounded-lg bg-[#141622] border border-[#292c3d] text-slate-300 hover:text-white cursor-pointer"
                >
                  <RotateCcw size={13} />
                </button>
                <span className="text-[11px] font-bold text-white truncate">
                  Auto Reset &amp; Start After TP
                </span>
              </div>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setAutoRestartAfterTp(!autoRestartAfterTp)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  autoRestartAfterTp ? 'bg-emerald-500' : 'bg-zinc-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                    autoRestartAfterTp ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#1f212f]">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Target size={11} className="text-emerald-400" />
                  Overall TP:
                </span>
                <span className="text-emerald-300 font-bold">
                  {activeSessionProfit >= 0 ? '+' : '-'}${Math.abs(activeSessionProfit).toFixed(2)}{' '}
                  / ${autoRestartMaxTp.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  disabled={isRunning}
                  value={autoRestartMaxTp}
                  onChange={(e) =>
                    setAutoRestartMaxTp(Math.max(1, parseFloat(e.target.value) || 50))
                  }
                  className="w-20 bg-[#12141f] border border-[#232638] rounded-lg px-2 py-1 text-xs font-mono text-emerald-300 font-bold"
                />
                {[20, 50, 100, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setAutoRestartMaxTp(preset)}
                    className={cn(
                      'flex-1 py-1 rounded border text-[9px] font-mono font-bold cursor-pointer',
                      autoRestartMaxTp === preset
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-[#141622] border-[#292c3d] text-slate-400'
                    )}
                  >
                    +${preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CIRCLES MODE SIDEBAR CARD */}
          <div className="p-3 bg-[#0c0d0f] border border-[#1a1b1e] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-black text-white uppercase">Circles Mode</span>
                <span className="block text-[8.5px] text-slate-500">
                  Show 0–9 circular digit frequencies
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !isCirclesMode;
                  setIsCirclesMode(next);
                  if (next && !streakMode.startsWith('circle_')) {
                    const isOu = ['over_under', 'digitover', 'digitunder', 'dual_ou'].includes(
                      contractType
                    );
                    setStreakMode(isOu ? 'circle_over_under' : 'circle_green');
                  } else if (!next && streakMode.startsWith('circle_')) {
                    setStreakMode('consecutive');
                  }
                }}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  isCirclesMode ? 'bg-[#00a79e]' : 'bg-[#222428]'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
                    isCirclesMode ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {isCirclesMode && (
              <div className="space-y-2 pt-2 border-t border-[#1d1f23]">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-bold uppercase">History Ticks</span>
                  <input
                    type="number"
                    min={10}
                    max={2000}
                    value={circlesTicksLimit}
                    onChange={(e) =>
                      setCirclesTicksLimit(parseInt(e.target.value, 10) || 1000)
                    }
                    className="w-20 bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded px-2 py-1 text-center"
                  />
                </div>
                <label className="flex items-center justify-between text-[10px] text-slate-300 cursor-pointer">
                  <span>Digit Touch Entry</span>
                  <input
                    type="checkbox"
                    checked={circleEntryModeEnabled}
                    onChange={(e) => setCircleEntryModeEnabled(e.target.checked)}
                    className="accent-[#00a79e]"
                  />
                </label>
              </div>
            )}
          </div>

          {/* SCHEDULED AUTO-START ALARMS */}
          <AutoBotAlarmScheduler
            alarms={alarms}
            isAlarmSchedulerEnabled={isAlarmSchedulerEnabled}
            setIsAlarmSchedulerEnabled={setIsAlarmSchedulerEnabled}
            newAlarmTime={newAlarmTime}
            setNewAlarmTime={setNewAlarmTime}
            newAlarmLabel={newAlarmLabel}
            setNewAlarmLabel={setNewAlarmLabel}
            newAlarmDays={newAlarmDays}
            setNewAlarmDays={setNewAlarmDays}
            currentTimeStr={currentTimeStr}
            handleAddAlarm={handleAddAlarm}
            handleToggleAlarm={handleToggleAlarm}
            handleDeleteAlarm={handleDeleteAlarm}
            notify={notify}
          />

          {/* RUN / STOP & RESET BUTTONS */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStopBot}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#ff444f] py-2.5 px-3 text-xs font-black uppercase text-white hover:bg-[#e63a44] cursor-pointer"
              >
                <Square size={13} className="fill-current" />
                Stop Engine
              </button>
            ) : (
              <button
                type="button"
                disabled={!connected}
                onClick={handleStartBot}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#00a79e] py-2.5 px-3 text-xs font-black uppercase text-white hover:bg-[#00948c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play size={13} className="fill-current" />
                Run AutoBot
              </button>
            )}

            <button
              type="button"
              disabled={isRunning}
              onClick={handleResetAndClear}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#222428] bg-[#0e0f11] py-2.5 px-3 text-xs font-bold text-slate-300 hover:text-white disabled:opacity-50 cursor-pointer"
            >
              <Trash2 size={13} />
              Reset Stats
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT DASHBOARD & LIVE MATRICES */}
      <div className="flex-1 min-w-0 p-4 space-y-4 overflow-y-auto md:max-h-[calc(100vh-110px)] custom-scrollbar">
        {/* Real-time Stats Header */}
        <div
          className={cn(
            'grid gap-3 bg-[#111214] border border-[#222428] p-4 rounded-2xl',
            hasVirtualToken ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'
          )}
        >
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
              Session Profit
            </span>
            <div
              className={cn(
                'text-lg md:text-xl font-black font-mono tabular-nums',
                sessionProfit > 0
                  ? 'text-[#00a79e]'
                  : sessionProfit < 0
                  ? 'text-rose-400'
                  : 'text-white'
              )}
            >
              {sessionProfit >= 0 ? '+' : ''}
              {sessionProfit.toFixed(2)} {currency}
            </div>
          </div>

          <div className="space-y-1 border-l border-[#222428] pl-4">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
              Real Wins / Losses
            </span>
            <div className="text-lg md:text-xl font-black font-mono text-white flex items-center gap-1.5">
              <span className="text-[#00a79e]">{winsCount}</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">{lossesCount}</span>
            </div>
          </div>

          {/* VIRTUAL STATS STRICTLY GATED ON hasVirtualToken */}
          {hasVirtualToken && (
            <div className="space-y-1 border-l border-[#222428] pl-4">
              <span className="text-[10px] uppercase font-black tracking-wider text-purple-400">
                Virtual Wins / Losses
              </span>
              <div className="text-lg md:text-xl font-black font-mono text-white flex flex-wrap items-center gap-1.5">
                <span className="text-emerald-400">{virtualWinsCount}</span>
                <span className="text-slate-600">/</span>
                <span className="text-rose-400">{virtualLossesCount}</span>
                {useVirtualLoss && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                    {consecutiveVirtualLosses}/{virtualLossThreshold}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1 border-l border-[#222428] pl-4">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
              Active Stake
            </span>
            <div className="text-lg md:text-xl font-black font-mono text-indigo-400 tabular-nums">
              {currentStake.toFixed(2)}
            </div>
          </div>

          <div className="space-y-1 border-l border-[#222428] pl-4 col-span-2 md:col-span-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
              Engine Status
            </span>
            <div
              className={cn(
                'text-xs font-black uppercase tracking-widest mt-1 flex flex-wrap items-center gap-1.5',
                isRunning ? 'text-[#00a79e]' : 'text-slate-500'
              )}
            >
              <span>{isRunning ? '● AI Engine Live' : '○ Standing By'}</span>
              {effectiveUseVirtualLoss && (
                <span
                  className={cn(
                    'text-[9px] font-mono px-1.5 py-0.5 rounded font-bold normal-case border',
                    isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  )}
                >
                  {isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold
                    ? 'Real Armed'
                    : `Virtual (${consecutiveVirtualLosses}/${virtualLossThreshold})`}
                </span>
              )}
              {isAlarmSchedulerEnabled && alarms.filter((a) => a.enabled).length > 0 && (
                <span className="text-[9px] font-mono bg-[#ff444f]/10 text-[#ff444f] border border-[#ff444f]/25 px-1.5 py-0.5 rounded font-bold normal-case">
                  {alarms.filter((a) => a.enabled).length} Alarms
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Markets Header & Quick Circles Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111214] border border-[#222428] px-4 py-3 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Active Market Matrices
            </span>
            <span className="text-[10px] bg-[#ff444f]/10 text-[#ff444f] border border-[#ff444f]/20 px-1.5 py-0.5 rounded-md font-bold">
              {visibleCheckedMarkets.length} Selected
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                Circles Mode
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !isCirclesMode;
                  setIsCirclesMode(next);
                  if (next && !streakMode.startsWith('circle_')) {
                    const isOu = ['over_under', 'digitover', 'digitunder', 'dual_ou'].includes(
                      contractType
                    );
                    setStreakMode(isOu ? 'circle_over_under' : 'circle_green');
                  } else if (!next && streakMode.startsWith('circle_')) {
                    setStreakMode('consecutive');
                  }
                }}
                className={cn(
                  'relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors',
                  isCirclesMode ? 'bg-[#00a79e]' : 'bg-[#222428]'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition',
                    isCirclesMode ? 'translate-x-3' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Analysis Signals Panel when analysis_tool is selected */}
        {streakMode === 'analysis_tool' && visibleCheckedMarkets[0] && (
          <AutoBotAnalysisSignalsPanel
            contractType={contractType}
            targetDigit={targetDigit}
            activeSymbol={visibleCheckedMarkets[0]}
            digits={tickHistories.current[visibleCheckedMarkets[0]] || []}
            quotes={priceHistories.current[visibleCheckedMarkets[0]] || []}
            streakMode={streakMode}
            onSetStreakMode={(m) => setStreakMode(m)}
            isRunning={isRunning}
          />
        )}

        {/* Checked Market Streak / Circles Grid */}
        <div
          className={cn(
            'grid gap-2.5 md:gap-3',
            isCirclesMode
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
          )}
        >
          {visibleCheckedMarkets.map((symbol) => {
            const config = AUTOBOT_MARKET_CONFIGS.find((m) => m.symbol === symbol);
            if (!config) return null;
            const data: AutoBotTickCardData = marketTicks[symbol] || {
              price: 0,
              lastDigit: 0,
              digits: [],
              streak: 0,
            };
            return (
              <AutoBotMarketCard
                key={symbol}
                symbol={symbol}
                config={config}
                data={data}
                tickHistories={tickHistories}
                priceHistories={priceHistories}
                effectiveIsCirclesMode={isCirclesMode}
                circlesTicksLimit={circlesTicksLimit}
                contractType={contractType}
                streakMode={streakMode}
                recoveryStreakMode={recoveryStreakMode}
                isRecoveryStreakModeEnabled={isRecoveryStreakModeEnabled}
                lossStreakThreshold={lossStreakThreshold}
                isLossStreakThresholdEnabled={isLossStreakThresholdEnabled}
                streakThreshold={streakThreshold}
                targetDigit={targetDigit}
                customPattern={customPattern}
                percentageThreshold={percentageThreshold}
                isExactPercentage={isExactPercentage}
                priceDigitsInput={priceDigitsInput}
                recoveryPriceDigitsInput={recoveryPriceDigitsInput}
                pmfPatternLen={pmfPatternLen}
                pmfMinOccurrences={pmfMinOccurrences}
                pmfFollowerLen={pmfFollowerLen}
                accuStrategies={accuStrategies}
                isDigitMatchingHelper={isDigitMatchingHelper}
                lockedVirtualMarket={effectiveUseVirtualLoss ? lockedVirtualMarket : null}
              />
            );
          })}
        </div>

        {/* Neural Signal Scanner Chips */}
        {neuralSignals.length > 0 && (
          <div className="bg-[#111214] border border-[#222428] rounded-xl p-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
              Neural Scanner:
            </span>
            {neuralSignals.map((sig) => (
              <span
                key={sig.id}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00a79e]/10 border border-[#00a79e]/30 text-[#00a79e]"
              >
                {sig.symbol} · {sig.seq} ({sig.conf}%)
              </span>
            ))}
          </div>
        )}

        {/* AI Discovery Log & Telemetry */}
        <div className="bg-[#111214] border border-[#222428] rounded-2xl p-4 flex flex-col space-y-2.5 min-h-[150px] max-h-[220px]">
          <h4 className="text-slate-200 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[#222428] pb-2">
            <Activity size={14} className="text-[#00a79e]" />
            AI Discovery Log &amp; Telemetry
          </h4>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar font-mono text-[10px] text-slate-400">
            {otivoLog.length > 0 ? (
              otivoLog.map((log, i) => (
                <div key={i} className="pb-1 border-b border-white/5">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-[#00a79e]/60 italic">
                Initializing multi-market neural pattern scanner array...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
