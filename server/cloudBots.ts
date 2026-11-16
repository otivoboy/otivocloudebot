import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import type { AutoBotAlarm, AutoBotSignalQueueItem } from '../src/types/autobot.ts';
import type {
  AiHackerCloudConfig,
  AiHackerCloudState,
  AiScannerCloudConfig,
  AiScannerCloudState,
  AutoBotCloudConfig,
  AutoBotCloudState,
  CloudBotsSnapshot,
  CloudToastEvent,
  FrequencyCloudConfig,
  FrequencyCloudState,
  GridMasterCloudConfig,
  GridMasterCloudState,
} from '../src/types/cloudBots.ts';
import {
  ALL_AUTOBOT_SYMBOLS,
  AUTOBOT_MARKET_CONFIGS,
  computeAccumulatorMetrics,
  computeAXASignal,
  computeEDMSSignal,
  computeLADPrngSignal,
  computeOverUnderScannerSignal,
  evaluatePriceDigitsSignal,
} from '../src/lib/autobotEngines.ts';
import {
  computeAccumulatorSignal,
  computeDiffersCalmNoiseSignal,
  computeDiffersSignal,
  computeMatchSignal,
  computeOverUnderSignal,
} from '../src/lib/autobotSignals.ts';
import {
  AccuracyEvaluator,
  type HackerMathSummary,
  IngestionBuffer,
  MathReconstructionSolver,
  ShadowGenerator,
  type ShadowPrediction,
} from '../src/lib/hackerMath.ts';

const PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public?app_id=34SRQBBtI5nwEFQqmc3se';
const CLOUD_BOTS_FILE = path.resolve(process.cwd(), 'data', 'cloud_bots.json');

const VOLATILITY_10_MARKETS = [
  '1HZ10V',
  'R_10',
  '1HZ25V',
  'R_25',
  '1HZ50V',
  'R_50',
  '1HZ75V',
  'R_75',
  '1HZ100V',
  'R_100',
];

const EXTRA_DECIMALS: Record<string, number> = {
  '1HZ10V': 2,
  '1HZ15V': 3,
  '1HZ25V': 2,
  '1HZ30V': 3,
  '1HZ50V': 2,
  '1HZ75V': 2,
  '1HZ90V': 3,
  '1HZ100V': 2,
  R_10: 3,
  R_25: 3,
  R_50: 4,
  R_75: 4,
  R_100: 2,
  JD10: 2,
  JD25: 2,
  JD50: 2,
  JD100: 2,
  RDBULL: 4,
  RDBEAR: 4,
};

function getDecimals(symbol: string, pipSize?: number): number {
  const cfg = AUTOBOT_MARKET_CONFIGS.find((m) => m.symbol === symbol);
  if (cfg) return cfg.decimals;
  if (EXTRA_DECIMALS[symbol] !== undefined) return EXTRA_DECIMALS[symbol];
  if (pipSize && pipSize > 0) {
    return Math.max(0, Math.round(-Math.log10(pipSize)));
  }
  return 2;
}

function getPredictedDigit(tickDigits: number[]): number {
  if (!tickDigits.length) return 0;
  const dCounts = Array(10).fill(0);
  tickDigits.forEach((d) => dCounts[d]++);
  const dProbs = dCounts.map((c) => c / tickDigits.length);

  const last10 = tickDigits.slice(-10);
  const recStats = Array(10).fill(0);
  last10.forEach((d) => recStats[d]++);

  const dScores = dProbs.map((p, digit) => {
    let s = p * 100;
    s += (recStats[digit] / 10) * 15;
    if (tickDigits[tickDigits.length - 1] === digit) s += 40;
    const last5 = tickDigits.slice(-5);
    if (last5.filter((d) => d === digit).length >= 2) s += 25;
    return s;
  });
  return dScores.indexOf(Math.min(...dScores));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDefaultAutoBotConfig(): AutoBotCloudConfig {
  return {
    contractType: 'digitdiff',
    targetDigit: 4,
    targetDigit2: 3,
    streakThreshold: 4,
    isLossStreakThresholdEnabled: false,
    lossStreakThreshold: 2,
    streakMode: 'consecutive',
    priceDigitsInput: '.01, .1780, .392',
    ouSamplePeriod: 100,
    ouColdThresholdMax: 12.0,
    ouSingleDigitMax: 6.0,
    isEdmsEnabled: false,
    ouPatternSelection: 'over1',
    analysisOppositeSignalEnabled: false,
    isRecoveryStreakModeEnabled: false,
    recoveryStreakMode: 'consecutive',
    recoveryContractType: 'digitdiff',
    recoveryTargetDigit: 4,
    recoveryAccumulatorGrowthRate: 2,
    recoveryAccumulatorTakeProfit: 10.0,
    recoveryOuPatternSelection: 'over1',
    recoveryPriceDigitsInput: '.01, .1780, .392',
    recoveryCustomPattern: '686',
    recoveryStreakThreshold: 4,
    recoveryIsLossStreakThresholdEnabled: false,
    recoveryLossStreakThreshold: 2,
    recoveryPercentageThreshold: 80,
    recoveryIsExactPercentage: false,
    recoveryTypesTransitionMatrix: true,
    recoveryTypesMirrorDigitReversal: true,
    recoveryTypesTickCompression: true,
    recoveryTypesHiddenCycleLength: true,
    recoveryPatternSmartMode: false,
    recoveryPatternRotationalMode: false,
    recoveryPatternRecoveryMode: true,
    recoveryPatternSmartDigit: null,
    recoveryAnalysisOppositeSignalEnabled: false,
    recoveryConsecTouchOpposingTicks: 3,
    recoveryConsecTouchTargetDigits: 1,
    recoveryConsecTouchTouchType: 'target',
    percentageThreshold: 80,
    isExactPercentage: false,
    isCirclesMode: false,
    circlesTicksLimit: 1000,
    circleEntryModeEnabled: false,
    circleTargetPct: 10.0,
    circleCompareMode: 'higher',
    circleFilterDigits: 'all',
    circleOuTargetType: 'over',
    circleOuDigit: 1,
    circleOuMaxPct: 9.0,
    circleOuLowDigits: '0,1',
    circleOuLowTouchMode: 'consecutive',
    circleOuOverTouchCount: 2,
    circleOuFinalTouchMaxTicks: 3,
    consecTouchOpposingTicks: 3,
    consecTouchTargetDigits: 1,
    consecTouchTouchType: 'target',
    pmfPatternLen: 3,
    pmfMinOccurrences: 3,
    pmfFollowerLen: 2,
    tradeDuration: 2,
    isRandomTicks: false,
    accumulatorGrowthRate: 2,
    accumulatorTakeProfit: 10.0,
    accuStrategies: {
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
    },
    differsNoiseMaxScore: 35,
    differsNoiseMinCalmTicks: 3,
    differsNoiseTargetMode: 'latest',
    customPattern: '686',
    typesTransitionMatrix: true,
    typesMirrorDigitReversal: true,
    typesTickCompression: true,
    typesHiddenCycleLength: true,
    patternSmartMode: false,
    patternSmartDigit: null,
    patternRotationalMode: false,
    patternRecoveryMode: true,
    isContinuousTrading: false,
    alternateMarketRecovery: true,
    checkedMarkets: [...ALL_AUTOBOT_SYMBOLS],
    stake: 1,
    isAutoStakeEnabled: false,
    martingale: 2,
    useVirtualLoss: false,
    virtualAfterRealLoss: false,
    virtualLossThreshold: 2,
    isRunsLimitEnabled: false,
    runsLimit: 5,
    takeProfit: 10,
    stopLoss: 20,
    runForever: false,
    autoRestartAfterTp: false,
    autoRestartMaxTp: 50,
    alarms: [],
    isAlarmSchedulerEnabled: true,
  };
}

export interface CloudBotsHost {
  isAccountConnected: () => boolean;
  getAccountBalance: () => number;
  getAccountCurrency: () => string;
  hasVirtualToken: () => boolean;
  executeAutoBotTrade: (params: {
    symbol: string;
    contractType:
      | 'digitdiff'
      | 'digitmatch'
      | 'digitover'
      | 'digitunder'
      | 'digiteven'
      | 'digitodd'
      | 'accumulator'
      | 'dual_ou';
    prediction: number;
    prediction2?: number;
    stake: number;
    duration?: number;
    growthRate?: number;
    takeProfit?: number;
    isVirtual: boolean;
    strategyName?: string;
  }) => Promise<{ won: boolean; profit: number }>;
  emitCloudBots: (snapshot: CloudBotsSnapshot) => void;
  addLog: (level: 'info' | 'win' | 'loss' | 'warn' | 'error', message: string) => void;
  isFastExecution: () => boolean;
}

export class CloudBotsManager {
  private host: CloudBotsHost;
  private eventSeq = 1;

  // Shared server-side Deriv Public WebSocket for all running Cloud Bots
  private ws: WebSocket | null = null;
  private wsPingTimer: NodeJS.Timeout | null = null;
  private wsReconnectTimer: NodeJS.Timeout | null = null;
  private subscribedCounts = new Map<string, number>();
  private digitHistories = new Map<string, number[]>();
  private priceHistories = new Map<string, number[]>();
  private symbolPipSizes = new Map<string, number>();
  private latestTickMeta = new Map<string, { price: number; digit: number; decimals: number }>();

  // 1) AutoBot Cloud State
  private autoBotConfig: AutoBotCloudConfig = createDefaultAutoBotConfig();
  private autoBotState: AutoBotCloudState = {
    running: false,
    wins: 0,
    losses: 0,
    consecLosses: 0,
    virtualWins: 0,
    virtualLosses: 0,
    consecVirtualLosses: 0,
    sessionProfit: 0,
    cumulativeProfit: 0,
    currentStake: 1,
    isCurrentTradeReal: true,
    lockedVirtualMarket: null,
    continuousLockedMarket: null,
    lostPatterns: [],
    customPattern: '686',
    patternSmartDigit: null,
    autoRestartAfterTp: false,
    logs: [],
    alarms: [],
    lastEvent: null,
  };
  private autoBotQueue: AutoBotSignalQueueItem[] = [];
  private autoBotInFlight = false;
  private autoBotNextAllowedAt = 0;
  private autoBotLastTradeAt: Record<string, number> = {};
  private autoBotLastLostMarket: string | null = null;
  private autoBotLastLossTime = 0;
  private autoBotPatternRotationalIdx: Record<string, number> = {};
  private autoBotCircleOuStates: Record<
    string,
    {
      stage: 'WAITING_LOW_TOUCH' | 'COUNTING_OVER_TOUCH' | 'WAITING_FINAL_TOUCH';
      lowTouchedDigits: number[];
      consecutiveLowCount: number;
      overTouchCount: number;
      finalTouchTicksElapsed: number;
    }
  > = {};
  private autoBotLoopTimer: NodeJS.Timeout | null = null;
  private alarmTimer: NodeJS.Timeout | null = null;

  // 2) Grid Master (OverUnderActiveBot) Cloud State
  private gridConfig: GridMasterCloudConfig = {
    markets: ['1HZ10V', 'R_50'],
    strategyMode: 'over1_under8',
    stake: 1.0,
    martingale: 2.1,
    duration: 1,
    tp: 5.0,
    sl: 15.0,
    useVirtual: false,
    virtualLossTarget: 1,
  };
  private gridState: GridMasterCloudState = {
    running: false,
    wins: 0,
    losses: 0,
    virtualWins: 0,
    virtualLosses: 0,
    profit: 0,
    currentStake: 1.0,
    statusLog: 'Standby — monitors all open grid markets for Over/Under pressure signals.',
    errorMsg: null,
  };
  private gridInFlight = false;
  private gridLastTradeAt = 0;
  private gridVLossStreak = 0;
  private gridInRealPhase = true;

  // 3) Frequency Bot (ClassicFrequencyView) Cloud State
  private freqConfig: FrequencyCloudConfig = {
    symbol: 'R_50',
    analysisWindow: 1000,
    stake: 1,
    autoStakeEnabled: false,
    autoStakePct: 1.0,
    martingale: 2,
    targetPct: 10.0,
    contractType: 'differ',
    tp: 10,
    sl: 50,
    maxRunsEnabled: false,
    maxRuns: 10,
    duration: 1,
    evenOddMode: 'high_even',
    benchmarkPct: 10.3,
    digitFilterEnabled: false,
    filterDigits: '0',
    filterCompareMode: 'higher',
    smartRecoveryEnabled: false,
    circleModeEnabled: false,
    circleType: 'green',
    recoveryCircleType: 'green',
    predictionDigit: 5,
    recoveryPredictionDigit: 5,
    recoveryContractType: 'differ',
    recoveryTargetPct: 10.0,
    recoveryCompareMode: 'higher',
    recoveryFilterDigits: '0',
    virtualMode: false,
    virtualLossesTarget: 1,
    marketSwitchMode: 'loss',
  };
  private freqState: FrequencyCloudState = {
    running: false,
    symbol: 'R_50',
    wins: 0,
    losses: 0,
    virtualWins: 0,
    virtualLosses: 0,
    sessionProfit: 0,
    currentStake: 1,
    statusLog: 'Standby',
    errorMsg: null,
    lastEvent: null,
  };
  private freqInFlight = false;
  private freqConsecLosses = 0;
  private freqLastTradeAt = 0;
  private freqVLossStreak = 0;
  private freqInRealPhase = true;

  // 4) AI Scanner Bot (OTIVO Neural Auto-Trade) Cloud State
  private scannerConfig: AiScannerCloudConfig = {
    symbol: 'R_50',
    digit: 5,
    stake: 1,
    martingale: 2,
    martingaleAfter: 1,
    tp: 5,
    sl: 10,
    marketSwitchMode: 'loss',
  };
  private scannerState: AiScannerCloudState = {
    running: false,
    symbol: 'R_50',
    digit: 5,
    sessionProfit: 0,
    currentStake: 1,
    wins: 0,
    losses: 0,
    tpSlResult: null,
    errorMsg: null,
    lastEvent: null,
  };
  private scannerRunId = 0;
  private scannerRecentlyUsed: string[] = [];
  private scannerUseCount: Record<string, number> = {};

  // 5) AI Market Hacker Cloud State
  private hackerConfig: AiHackerCloudConfig = {
    stake: 0.5,
    martingaleMultiplier: 2.1,
    martingaleAfterLosses: 1,
    durationTicks: 1,
    maxTrades: 5,
    virtualMode: false,
    virtualLosses: 1,
    autoRestartWin: false,
    sameMarketRecovery: false,
    continuousSameMarket: false,
    recoveryContract: 'DIGITOVER',
  };
  private hackerState: AiHackerCloudState = {
    running: false,
    tradesCount: 0,
    winsCount: 0,
    lossesCount: 0,
    virtualStats: { wins: 0, losses: 0 },
    sessionProfit: 0,
    currentStake: 0.5,
    logs: [],
    mathSummaries: {},
    marketDigits: {},
    errorMsg: null,
  };
  private hackerMathEngines: Record<
    string,
    {
      ingestion: IngestionBuffer;
      solver: MathReconstructionSolver;
      generator: ShadowGenerator;
      evaluator: AccuracyEvaluator;
      lastPred: ShadowPrediction | null;
    }
  > = {};
  private hackerInFlight = false;
  private hackerConsecLosses = 0;
  private hackerConsecVirtualLosses = 0;
  private hackerLockedMarket: string | null = null;
  private hackerTriggeredRealForLocked = false;
  private hackerEmitTimer: NodeJS.Timeout | null = null;
  private hackerRunId = 0;

  constructor(host: CloudBotsHost) {
    this.host = host;
    this.loadPersistedConfigs();
    this.startAlarmScheduler();
  }

  private nextEvent(
    type: CloudToastEvent['type'],
    message: string
  ): CloudToastEvent {
    return {
      id: ++this.eventSeq,
      type,
      message,
    };
  }

  private emitSnapshot(): void {
    this.host.emitCloudBots(this.getSnapshot());
  }

  private scheduleHackerUiEmit(): void {
    if (this.hackerEmitTimer) return;
    this.hackerEmitTimer = setTimeout(() => {
      this.hackerEmitTimer = null;
      this.emitSnapshot();
    }, 350);
  }

  getSnapshot(): CloudBotsSnapshot {
    return {
      autobot: {
        ...this.autoBotState,
        logs: [...this.autoBotState.logs],
        lostPatterns: [...this.autoBotState.lostPatterns],
        alarms: [...this.autoBotConfig.alarms],
      },
      gridMaster: { ...this.gridState },
      frequency: { ...this.freqState },
      aiScanner: { ...this.scannerState },
      aiHacker: {
        ...this.hackerState,
        logs: [...this.hackerState.logs],
        mathSummaries: { ...this.hackerState.mathSummaries },
        marketDigits: { ...this.hackerState.marketDigits },
      },
    };
  }

  private loadPersistedConfigs(): void {
    try {
      if (!fs.existsSync(CLOUD_BOTS_FILE)) return;
      const raw = fs.readFileSync(CLOUD_BOTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed?.autoBotConfig) {
        this.autoBotConfig = {
          ...createDefaultAutoBotConfig(),
          ...parsed.autoBotConfig,
        };
        this.autoBotState.alarms = [...(this.autoBotConfig.alarms || [])];
        this.autoBotState.customPattern = this.autoBotConfig.customPattern;
        this.autoBotState.patternSmartDigit = this.autoBotConfig.patternSmartDigit;
        this.autoBotState.autoRestartAfterTp = this.autoBotConfig.autoRestartAfterTp;
      }
      if (typeof parsed?.cumulativeProfit === 'number') {
        this.autoBotState.cumulativeProfit = parsed.cumulativeProfit;
      }
      if (parsed?.gridConfig) {
        this.gridConfig = { ...this.gridConfig, ...parsed.gridConfig };
      }
      if (parsed?.freqConfig) {
        this.freqConfig = { ...this.freqConfig, ...parsed.freqConfig };
      }
      if (parsed?.scannerConfig) {
        this.scannerConfig = { ...this.scannerConfig, ...parsed.scannerConfig };
      }
      if (parsed?.hackerConfig) {
        this.hackerConfig = { ...this.hackerConfig, ...parsed.hackerConfig };
      }
    } catch {
      // ignore corrupted file
    }
  }

  private savePersistedConfigs(): void {
    try {
      const dir = path.dirname(CLOUD_BOTS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        CLOUD_BOTS_FILE,
        JSON.stringify(
          {
            autoBotConfig: this.autoBotConfig,
            cumulativeProfit: this.autoBotState.cumulativeProfit,
            gridConfig: this.gridConfig,
            freqConfig: this.freqConfig,
            scannerConfig: this.scannerConfig,
            hackerConfig: this.hackerConfig,
          },
          null,
          2
        )
      );
    } catch {
      // ignore
    }
  }

  // ---------- Server-side Deriv Public WebSocket for all active bots ----------
  private hasAnyActiveTickBot(): boolean {
    return (
      this.autoBotState.running ||
      this.gridState.running ||
      this.freqState.running ||
      this.hackerState.running
    );
  }

  private computeDesiredSubscriptions(): Map<string, number> {
    const desired = new Map<string, number>();
    const setMinCount = (sym: string, count: number) => {
      if (!sym) return;
      const prev = desired.get(sym) ?? 0;
      if (count > prev) desired.set(sym, count);
    };

    if (this.autoBotState.running) {
      for (const sym of this.autoBotConfig.checkedMarkets || []) {
        setMinCount(sym, Math.max(1000, this.autoBotConfig.circlesTicksLimit || 1000));
      }
    }
    if (this.gridState.running) {
      for (const sym of this.gridConfig.markets || []) {
        setMinCount(sym, 150);
      }
    }
    if (this.freqState.running) {
      setMinCount(
        this.freqState.symbol || this.freqConfig.symbol,
        Math.max(100, Math.min(5000, this.freqConfig.analysisWindow || 1000))
      );
    }
    if (this.hackerState.running) {
      for (const sym of VOLATILITY_10_MARKETS) {
        setMinCount(sym, 150);
      }
    }
    return desired;
  }

  private syncPublicWebSocket(): void {
    if (!this.hasAnyActiveTickBot()) {
      this.closePublicWebSocket();
      return;
    }

    const desired = this.computeDesiredSubscriptions();
    if (desired.size === 0) return;

    if (!this.ws || (this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== WebSocket.CONNECTING)) {
      this.openPublicWebSocket();
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      for (const [sym, count] of desired.entries()) {
        const currentCount = this.subscribedCounts.get(sym) ?? 0;
        const bufferedLen = this.digitHistories.get(sym)?.length ?? 0;
        if (currentCount === 0 || (count > currentCount && bufferedLen < count)) {
          this.subscribedCounts.set(sym, count);
          this.sendWs({
            ticks_history: sym,
            adjust_start_time: 1,
            count,
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
          });
        }
      }
    }
  }

  private sendWs(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        // ignore
      }
    }
  }

  private openPublicWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.wsPingTimer) {
      clearInterval(this.wsPingTimer);
      this.wsPingTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.subscribedCounts.clear();

    const ws = new WebSocket(PUBLIC_WS_URL);
    this.ws = ws;

    ws.on('open', () => {
      if (this.ws !== ws) return;
      this.syncPublicWebSocket();
      this.wsPingTimer = setInterval(() => {
        if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
          this.sendWs({ ping: 1 });
        }
      }, 20_000);
    });

    ws.on('message', (raw) => {
      if (this.ws !== ws) return;
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (data?.msg_type === 'history' && data?.history && data?.echo_req?.ticks_history) {
        const sym = String(data.echo_req.ticks_history);
        const pipSize = Number(data.pip_size) || this.symbolPipSizes.get(sym);
        if (pipSize) this.symbolPipSizes.set(sym, pipSize);
        const decimals = getDecimals(sym, pipSize);
        const prices: number[] = Array.isArray(data.history.prices)
          ? data.history.prices.map(Number).filter(Number.isFinite)
          : [];
        const digits = prices.map((p) => {
          const fixed = p.toFixed(decimals);
          return parseInt(fixed[fixed.length - 1], 10) || 0;
        });
        this.digitHistories.set(sym, digits.slice(-5000));
        this.priceHistories.set(sym, prices.slice(-5000));
        if (this.hackerState.running && VOLATILITY_10_MARKETS.includes(sym)) {
          this.onHackerHistory(sym, digits);
        }
        return;
      }

      if (data?.msg_type === 'tick' && data?.tick) {
        const sym = String(data.tick.symbol || '');
        if (!sym) return;
        const pipSize = Number(data.tick.pip_size) || this.symbolPipSizes.get(sym);
        if (pipSize) this.symbolPipSizes.set(sym, pipSize);
        const decimals = getDecimals(sym, pipSize);
        const price = Number(data.tick.quote);
        if (!Number.isFinite(price)) return;
        const fixed = price.toFixed(decimals);
        const digit = parseInt(fixed[fixed.length - 1], 10);
        if (isNaN(digit)) return;

        const dHist = this.digitHistories.get(sym) || [];
        dHist.push(digit);
        if (dHist.length > 5000) dHist.shift();
        this.digitHistories.set(sym, dHist);

        const pHist = this.priceHistories.get(sym) || [];
        pHist.push(price);
        if (pHist.length > 5000) pHist.shift();
        this.priceHistories.set(sym, pHist);
        this.latestTickMeta.set(sym, { price, digit, decimals });

        if (this.autoBotState.running) {
          this.onAutoBotTick(sym, price, digit, decimals, dHist, pHist);
        }
        if (this.gridState.running) {
          this.onGridMasterTick();
        }
        if (this.freqState.running && sym === this.freqState.symbol) {
          this.onFrequencyTick(sym, dHist, pHist);
        }
        if (this.hackerState.running && VOLATILITY_10_MARKETS.includes(sym)) {
          this.onHackerTick(sym, digit, dHist);
        }
      }
    });

    ws.on('close', () => {
      if (this.ws !== ws) return;
      if (this.wsPingTimer) {
        clearInterval(this.wsPingTimer);
        this.wsPingTimer = null;
      }
      if (this.hasAnyActiveTickBot() && !this.wsReconnectTimer) {
        this.wsReconnectTimer = setTimeout(() => {
          this.wsReconnectTimer = null;
          if (this.hasAnyActiveTickBot()) this.openPublicWebSocket();
        }, 2000);
      }
    });

    ws.on('error', () => {
      // handled by close event
    });
  }

  private closePublicWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.wsPingTimer) {
      clearInterval(this.wsPingTimer);
      this.wsPingTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.subscribedCounts.clear();
  }

  // ---------- Server-side Market Scanner (for Frequency & AI Scanner market switching) ----------
  private async scanBestSyntheticMarket(excludeSymbol?: string): Promise<{
    symbol: string;
    name: string;
    digit: number;
  } | null> {
    return new Promise((resolveTop) => {
      const scanWs = new WebSocket(PUBLIC_WS_URL);
      let active = true;
      const results: Array<{
        symbol: string;
        name: string;
        digit: number;
        frequency: number;
        adjustedScore: number;
      }> = [];

      const finish = (val: { symbol: string; name: string; digit: number } | null) => {
        if (!active) return;
        active = false;
        clearTimeout(timeout);
        try {
          scanWs.close();
        } catch {
          // ignore
        }
        resolveTop(val);
      };

      const timeout = setTimeout(() => finish(null), 18_000);

      scanWs.on('error', () => finish(null));
      scanWs.on('open', () => {
        if (active) scanWs.send(JSON.stringify({ active_symbols: 'brief' }));
      });

      scanWs.on('message', async (raw) => {
        if (!active) return;
        let data: any;
        try {
          data = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (data?.error) {
          finish(null);
          return;
        }
        if (data?.msg_type === 'active_symbols') {
          const syntheticSymbols = (data.active_symbols || []).filter(
            (s: any) =>
              s.market === 'synthetic_index' &&
              (s.submarket === 'random_index' ||
                s.submarket === 'random_daily' ||
                s.submarket === 'jump_indices')
          );
          const symbolsToScan = syntheticSymbols.slice(0, 12);

          for (const s of symbolsToScan) {
            if (!active) break;
            try {
              scanWs.send(
                JSON.stringify({
                  ticks_history: s.symbol,
                  count: 1000,
                  end: 'latest',
                  style: 'ticks',
                })
              );
            } catch {
              break;
            }

            await new Promise<void>((resolveSym) => {
              const symTimer = setTimeout(() => {
                scanWs.off('message', handler);
                resolveSym();
              }, 2500);

              const handler = (mRaw: WebSocket.RawData) => {
                let hData: any;
                try {
                  hData = JSON.parse(mRaw.toString());
                } catch {
                  return;
                }
                if (hData?.msg_type === 'history' && hData?.echo_req?.ticks_history === s.symbol) {
                  clearTimeout(symTimer);
                  scanWs.off('message', handler);
                  const prices: number[] = hData.history?.prices || [];
                  const pSize = Number(hData.pip_size) || Number(s.pip_size) || 0.01;
                  const precision = getDecimals(s.symbol, pSize);
                  const digits: number[] = prices.map((p: number) =>
                    parseInt(Number(p).toFixed(precision).slice(-1), 10)
                  );
                  const counts = Array(10).fill(0);
                  digits.forEach((d) => counts[d]++);
                  const predictedDigit = getPredictedDigit(digits);
                  const freqPercent = digits.length
                    ? (counts[predictedDigit] / digits.length) * 100
                    : 10;

                  let penalty = 0;
                  const recentIndex = this.scannerRecentlyUsed.indexOf(s.symbol);
                  if (recentIndex !== -1) {
                    penalty += (this.scannerRecentlyUsed.length - recentIndex) * 5;
                  }
                  penalty += (this.scannerUseCount[s.symbol] || 0) * 3;
                  if (String(s.symbol).startsWith('JD')) penalty -= 2;

                  results.push({
                    symbol: s.symbol,
                    name: s.display_name || s.symbol,
                    digit: predictedDigit,
                    frequency: freqPercent,
                    adjustedScore: freqPercent + penalty,
                  });
                  resolveSym();
                }
              };
              scanWs.on('message', handler);
            });
          }

          let sorted = [...results].sort((a, b) => a.adjustedScore - b.adjustedScore);
          if (excludeSymbol && sorted.length > 1) {
            const filtered = sorted.filter((r) => r.symbol !== excludeSymbol);
            if (filtered.length > 0) sorted = filtered;
          }
          const best = sorted[0] || null;
          if (best) {
            this.scannerRecentlyUsed = [
              best.symbol,
              ...this.scannerRecentlyUsed.filter((x) => x !== best.symbol),
            ].slice(0, 5);
            this.scannerUseCount[best.symbol] = (this.scannerUseCount[best.symbol] || 0) + 1;
            finish({ symbol: best.symbol, name: best.name, digit: best.digit });
          } else {
            finish(null);
          }
        }
      });
    });
  }

  // =========================================================================
  // 1) AUTOBOT CLOUD ENGINE + ALARM SCHEDULER
  // =========================================================================
  private computeAutoBotBaseStake(): number {
    const cfg = this.autoBotConfig;
    if (cfg.isAutoStakeEnabled) {
      const bal = this.host.getAccountBalance() > 0 ? this.host.getAccountBalance() : 100;
      const m = Math.max(1.1, cfg.martingale || 2);
      const val = (bal * 0.98) / (1 + m);
      return Math.max(0.35, Math.min(830, Math.round(val * 100) / 100));
    }
    return Math.max(0.35, Number(cfg.stake) || 1);
  }

  private appendAutoBotLog(msg: string): void {
    const formatted = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.autoBotState.logs = [formatted, ...this.autoBotState.logs].slice(0, 60);
  }

  private runAutoBotPatternLearning(excludePattern?: string, excludeDigit?: number) {
    const symbols = this.autoBotConfig.checkedMarkets || [];
    if (symbols.length === 0) return null;

    const patternMap: Record<
      string,
      { pattern: string; appearingSymbols: Set<string>; digitCounts: number[]; totalCount: number }
    > = {};

    symbols.forEach((symbol) => {
      const history = this.digitHistories.get(symbol) || [];
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
        pattern: this.autoBotConfig.customPattern || '686',
        digit: this.autoBotConfig.patternSmartDigit ?? 5,
      };
    }
    candidates.sort((a, b) => b.score - a.score);
    return { pattern: candidates[0].pattern, digit: candidates[0].digit };
  }

  updateAutoBotConfig(partial: Partial<AutoBotCloudConfig>): AutoBotCloudState {
    this.autoBotConfig = {
      ...this.autoBotConfig,
      ...partial,
      checkedMarkets: Array.isArray(partial.checkedMarkets)
        ? partial.checkedMarkets.filter((s) => ALL_AUTOBOT_SYMBOLS.includes(s))
        : this.autoBotConfig.checkedMarkets,
      alarms: Array.isArray(partial.alarms) ? partial.alarms : this.autoBotConfig.alarms,
    };
    this.autoBotState.alarms = [...this.autoBotConfig.alarms];
    this.autoBotState.autoRestartAfterTp = this.autoBotConfig.autoRestartAfterTp;
    if (!this.autoBotState.running) {
      this.autoBotState.currentStake = this.computeAutoBotBaseStake();
      this.autoBotState.customPattern = this.autoBotConfig.customPattern;
      this.autoBotState.patternSmartDigit = this.autoBotConfig.patternSmartDigit;
    }
    this.savePersistedConfigs();
    if (this.autoBotState.running) {
      this.syncPublicWebSocket();
    }
    this.emitSnapshot();
    return this.getSnapshot().autobot;
  }

  startAutoBot(configPatch?: Partial<AutoBotCloudConfig>): AutoBotCloudState {
    if (configPatch) {
      this.autoBotConfig = {
        ...this.autoBotConfig,
        ...configPatch,
        checkedMarkets: Array.isArray(configPatch.checkedMarkets)
          ? configPatch.checkedMarkets.filter((s) => ALL_AUTOBOT_SYMBOLS.includes(s))
          : this.autoBotConfig.checkedMarkets,
        alarms: Array.isArray(configPatch.alarms)
          ? configPatch.alarms
          : this.autoBotConfig.alarms,
      };
    }

    if (!this.host.isAccountConnected()) {
      throw new Error('Connect your Deriv Real or Demo API token first in Settings.');
    }
    if (!this.autoBotConfig.checkedMarkets || this.autoBotConfig.checkedMarkets.length === 0) {
      throw new Error('Select at least one market to monitor.');
    }

    this.autoBotQueue = [];
    this.autoBotNextAllowedAt = 0;
    this.autoBotState.continuousLockedMarket = null;
    this.autoBotState.lockedVirtualMarket = null;
    this.autoBotLastLostMarket = null;
    this.autoBotLastLossTime = 0;

    const effectiveUseVirtual =
      this.host.hasVirtualToken() && Boolean(this.autoBotConfig.useVirtualLoss);
    this.autoBotState.isCurrentTradeReal =
      !effectiveUseVirtual || Boolean(this.autoBotConfig.virtualAfterRealLoss);

    const baseStake = this.computeAutoBotBaseStake();
    this.autoBotState.currentStake = baseStake;
    this.autoBotState.sessionProfit = 0;
    this.autoBotState.wins = 0;
    this.autoBotState.losses = 0;
    this.autoBotState.consecLosses = 0;
    this.autoBotState.consecVirtualLosses = 0;
    this.autoBotState.lostPatterns = [];
    this.autoBotState.autoRestartAfterTp = this.autoBotConfig.autoRestartAfterTp;
    this.autoBotState.customPattern = this.autoBotConfig.customPattern;
    this.autoBotState.patternSmartDigit = this.autoBotConfig.patternSmartDigit;

    if (this.autoBotConfig.patternSmartMode) {
      const learned = this.runAutoBotPatternLearning();
      if (learned) {
        this.autoBotConfig.customPattern = learned.pattern;
        this.autoBotConfig.patternSmartDigit = learned.digit;
        this.autoBotState.customPattern = learned.pattern;
        this.autoBotState.patternSmartDigit = learned.digit;
      }
    }

    this.autoBotState.running = true;
    this.autoBotState.alarms = [...this.autoBotConfig.alarms];
    this.appendAutoBotLog(
      `AI Engine started (${this.autoBotConfig.contractType.toUpperCase()} · ${this.autoBotConfig.streakMode}${effectiveUseVirtual ? ' · Virtual Loss Filter ON' : ''})`
    );
    this.host.addLog(
      'info',
      `AutoBot AI Engine started on Cloud Server (${this.autoBotConfig.contractType.toUpperCase()} · ${this.autoBotConfig.streakMode}${effectiveUseVirtual ? ' · Virtual Loss Filter ON' : ''}).`
    );
    this.autoBotState.lastEvent = this.nextEvent(
      'success',
      'AutoBot AI Engine started on cloud server.'
    );
    this.savePersistedConfigs();
    this.syncPublicWebSocket();
    this.ensureAutoBotQueueLoop();
    this.emitSnapshot();
    return this.getSnapshot().autobot;
  }

  stopAutoBot(reason = 'AutoBot stopped.'): AutoBotCloudState {
    this.autoBotState.running = false;
    this.autoBotQueue = [];
    this.autoBotState.continuousLockedMarket = null;
    this.autoBotState.lockedVirtualMarket = null;
    if (this.autoBotLoopTimer) {
      clearInterval(this.autoBotLoopTimer);
      this.autoBotLoopTimer = null;
    }
    this.appendAutoBotLog('AI Engine stopped by user.');
    this.host.addLog('info', `AutoBot: ${reason}`);
    this.autoBotState.lastEvent = this.nextEvent('info', reason);
    this.syncPublicWebSocket();
    this.emitSnapshot();
    return this.getSnapshot().autobot;
  }

  resetAutoBot(): AutoBotCloudState {
    if (this.autoBotState.running) {
      return this.getSnapshot().autobot;
    }
    this.autoBotQueue = [];
    this.autoBotState.continuousLockedMarket = null;
    this.autoBotState.lockedVirtualMarket = null;
    this.autoBotLastLostMarket = null;
    this.autoBotLastLossTime = 0;
    this.autoBotState.sessionProfit = 0;
    this.autoBotState.cumulativeProfit = 0;
    this.autoBotState.wins = 0;
    this.autoBotState.losses = 0;
    this.autoBotState.consecLosses = 0;
    this.autoBotState.virtualWins = 0;
    this.autoBotState.virtualLosses = 0;
    this.autoBotState.consecVirtualLosses = 0;
    this.autoBotState.lostPatterns = [];
    this.autoBotState.currentStake = this.computeAutoBotBaseStake();
    this.autoBotState.logs = [];
    this.host.addLog('info', 'AutoBot session counters and logs cleared.');
    this.autoBotState.lastEvent = this.nextEvent(
      'info',
      'AutoBot session counters and logs cleared.'
    );
    this.savePersistedConfigs();
    this.emitSnapshot();
    return this.getSnapshot().autobot;
  }

  private startAlarmScheduler(): void {
    if (this.alarmTimer) clearInterval(this.alarmTimer);
    this.alarmTimer = setInterval(() => {
      if (!this.autoBotConfig.isAlarmSchedulerEnabled || this.autoBotState.running) return;
      if (!this.autoBotConfig.alarms || this.autoBotConfig.alarms.length === 0) return;

      const offsetMin =
        typeof this.autoBotConfig.timezoneOffsetMinutes === 'number'
          ? this.autoBotConfig.timezoneOffsetMinutes
          : 0;
      const nowUtc = new Date();
      const localMs = nowUtc.getTime() - offsetMin * 60_000;
      const localDate = new Date(localMs);
      const hh = String(localDate.getUTCHours()).padStart(2, '0');
      const mm = String(localDate.getUTCMinutes()).padStart(2, '0');
      const hm = `${hh}:${mm}`;
      const todayKey = localDate.toISOString().slice(0, 10);
      const dayOfWeek = localDate.getUTCDay();

      for (const alarm of this.autoBotConfig.alarms) {
        if (!alarm.enabled) continue;
        if (alarm.time !== hm) continue;
        if (alarm.days && alarm.days.length > 0 && !alarm.days.includes(dayOfWeek)) continue;
        if (alarm.triggeredToday === todayKey) continue;

        alarm.triggeredToday = todayKey;
        this.autoBotState.alarms = [...this.autoBotConfig.alarms];
        const alarmMsg = `Scheduled alarm triggered (${alarm.time}${alarm.label ? ` · ${alarm.label}` : ''})`;
        this.appendAutoBotLog(alarmMsg);
        this.host.addLog('info', `AutoBot: ${alarmMsg}`);
        try {
          this.startAutoBot();
        } catch (err: any) {
          const errMsg = err?.message || 'Scheduled alarm failed to start AutoBot.';
          this.appendAutoBotLog(`Alarm auto-start failed: ${errMsg}`);
          this.host.addLog('error', `AutoBot Alarm Error: ${errMsg}`);
          this.autoBotState.lastEvent = this.nextEvent(
            'error',
            errMsg
          );
          this.emitSnapshot();
        }
        break;
      }
    }, 1000);
  }

  private onAutoBotTick(
    symbol: string,
    price: number,
    digit: number,
    decimals: number,
    history: number[],
    rPrices: number[],
    isRetrigger = false
  ): void {
    const cfg = this.autoBotConfig;
    if (!cfg.checkedMarkets.includes(symbol)) return;
    if (!this.host.isFastExecution() && Date.now() < this.autoBotNextAllowedAt) return;

    const isRecActive = cfg.isRecoveryStreakModeEnabled && this.autoBotState.consecLosses > 0;
    const activeContractType = isRecActive ? cfg.recoveryContractType : cfg.contractType;
    const activeStreakMode = isRecActive ? cfg.recoveryStreakMode : cfg.streakMode;
    const activeTargetDigit = isRecActive ? cfg.recoveryTargetDigit : cfg.targetDigit;
    const activeTargetDigit2 = cfg.targetDigit2;
    const activeOuPatternSelection = isRecActive
      ? cfg.recoveryOuPatternSelection
      : cfg.ouPatternSelection;
    const activeCustomPattern = isRecActive ? cfg.recoveryCustomPattern : cfg.customPattern;
    const activePatternSmartMode = isRecActive
      ? cfg.recoveryPatternSmartMode
      : cfg.patternSmartMode;
    const activePatternRecoveryMode = isRecActive
      ? cfg.recoveryPatternRecoveryMode
      : cfg.patternRecoveryMode;

    const useLossThresh = isRecActive
      ? cfg.recoveryIsLossStreakThresholdEnabled
      : cfg.isLossStreakThresholdEnabled;
    const activeStreakThreshold =
      this.autoBotState.consecLosses > 0 && useLossThresh
        ? isRecActive
          ? cfg.recoveryLossStreakThreshold
          : cfg.lossStreakThreshold
        : isRecActive
        ? cfg.recoveryStreakThreshold
        : cfg.streakThreshold;

    const activePctThresh = isRecActive
      ? cfg.recoveryPercentageThreshold
      : cfg.percentageThreshold;
    const activeIsExactPct = isRecActive
      ? cfg.recoveryIsExactPercentage
      : cfg.isExactPercentage;

    const coldDigit = computeDiffersSignal(history, symbol).prediction;

    // Pattern matching
    let patternMatched = false;
    let bestDifferDigit: number | undefined;
    let matchedPatternKey: string | undefined;

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

      let matchedDigitSpec: number | undefined;
      patternMatched = parsedSubPatterns.some((p) => {
        const patDigits = p.sequence.split('').map((c) => parseInt(c, 10));
        if (patDigits.length > 0 && history.length >= patDigits.length) {
          const lastSlice = history.slice(-patDigits.length);
          if (patDigits.every((val, idx) => lastSlice[idx] === val)) {
            const pKey = p.digit !== undefined ? `${p.sequence}=${p.digit}` : p.sequence;
            if (
              activePatternRecoveryMode &&
              this.autoBotState.consecLosses > 0 &&
              this.autoBotState.lostPatterns.includes(pKey)
            ) {
              return false;
            }
            const rotMode = isRecActive
              ? cfg.recoveryPatternRotationalMode
              : cfg.patternRotationalMode;
            if (rotMode) {
              const rotIdx = this.autoBotPatternRotationalIdx[p.sequence] || 0;
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
          const smartD = isRecActive ? cfg.recoveryPatternSmartDigit : cfg.patternSmartDigit;
          bestDifferDigit =
            smartD !== null
              ? smartD
              : computeDiffersSignal(history.slice(-15), symbol).prediction;
        } else {
          bestDifferDigit = activeTargetDigit !== -1 ? activeTargetDigit : digit;
        }
      }
    }

    // Consecutive streak
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

    // Types mode
    let typesSignal: { prediction: number; reason: string; strategyName: string } | null = null;
    if (activeStreakMode === 'types') {
      const tMatrix = isRecActive
        ? cfg.recoveryTypesTransitionMatrix
        : cfg.typesTransitionMatrix;
      const tMirror = isRecActive
        ? cfg.recoveryTypesMirrorDigitReversal
        : cfg.typesMirrorDigitReversal;
      const tComp = isRecActive ? cfg.recoveryTypesTickCompression : cfg.typesTickCompression;
      const tCycle = isRecActive
        ? cfg.recoveryTypesHiddenCycleLength
        : cfg.typesHiddenCycleLength;

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
          transSig = { prediction: bestNext, reason: `Transition ${lastD}->${bestNext} (${maxC}x)` };
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
          const lastChg = Math.abs(rPrices[rPrices.length - 1] - rPrices[rPrices.length - 2]);
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
              cycleSig = { prediction: history[history.length - L], reason: `Cycle L=${L}` };
              break;
            }
          }
        }
      }

      if (transSig) typesSignal = { ...transSig, strategyName: 'Digit Transition Matrix' };
      else if (cycleSig) typesSignal = { ...cycleSig, strategyName: 'Hidden Cycle Length' };
      else if (mirrorSig) typesSignal = { ...mirrorSig, strategyName: 'Mirror Digit Reversal' };
      else if (compSig) typesSignal = { ...compSig, strategyName: 'Tick Compression Breakout' };
    }

    // Percentage
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

    // Consecutive & Touch
    let consecTouchMatched = false;
    const activeOpposingReq = isRecActive
      ? cfg.recoveryConsecTouchOpposingTicks
      : cfg.consecTouchOpposingTicks;
    const activeTouchesReq = isRecActive
      ? cfg.recoveryConsecTouchTargetDigits
      : cfg.consecTouchTargetDigits;
    const activeTouchType = isRecActive
      ? cfg.recoveryConsecTouchTouchType
      : cfg.consecTouchTouchType;

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
      if (precedingOpp >= reqOpp && trailingTouches >= reqT && checkTouch(digit)) {
        consecTouchMatched = true;
      }
    }

    // Engine Signals
    const { signal: axaSignal } = computeAXASignal(history, symbol);
    const { signal: ouScannerSig } = computeOverUnderScannerSignal(
      history,
      cfg.ouSamplePeriod,
      cfg.ouColdThresholdMax,
      cfg.ouSingleDigitMax
    );
    const { signal: edmsSig } = computeEDMSSignal(rPrices, history);
    const overUnderSignal = cfg.isEdmsEnabled ? edmsSig : ouScannerSig;
    const ladPrngSignal = computeLADPrngSignal(
      history,
      symbol,
      rPrices,
      cfg.pmfPatternLen,
      cfg.pmfMinOccurrences,
      cfg.pmfFollowerLen
    );
    const { signal: differsCalmNoiseSignal, metrics: differsCalmNoiseMetrics } =
      computeDiffersCalmNoiseSignal(history, rPrices, symbol, {
        maxNoiseScore: cfg.differsNoiseMaxScore,
        minCalmTicks: cfg.differsNoiseMinCalmTicks,
      });
    if (differsCalmNoiseSignal && cfg.differsNoiseTargetMode === 'top_calm') {
      const top = [...differsCalmNoiseMetrics.digitStats].sort(
        (a, b) => b.calmCount - a.calmCount
      )[0];
      if (top) {
        differsCalmNoiseSignal.prediction = top.digit;
        differsCalmNoiseSignal.calmDigit = top.digit;
      }
    }
    const activePriceInput = isRecActive ? cfg.recoveryPriceDigitsInput : cfg.priceDigitsInput;
    const priceDigitsSignal = evaluatePriceDigitsSignal(price, decimals, activePriceInput);
    const accumulatorMetrics = computeAccumulatorMetrics(rPrices, history, symbol);

    // Circles evaluation
    let circleTargetDigit: number | null = null;
    let circleTriggered = false;
    let circleStrategyLabel = '';

    if (cfg.isCirclesMode || activeStreakMode.startsWith('circle_')) {
      const slice = history.slice(-Math.max(10, cfg.circlesTicksLimit || 1000));
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
          cfg.circleFilterDigits.toLowerCase() === 'all'
            ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            : cfg.circleFilterDigits
                .split(',')
                .map((s) => parseInt(s.trim(), 10))
                .filter((d) => !isNaN(d) && d >= 0 && d <= 9);
        for (let d = 0; d <= 9; d++) {
          if (!allowed.includes(d)) continue;
          const f = cStats[d].pct;
          const match =
            cfg.circleCompareMode === 'higher'
              ? f >= cfg.circleTargetPct
              : f <= cfg.circleTargetPct;
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
            : cfg.circleOuTargetType;
        const barrierD = cfg.circleOuDigit ?? (tType === 'over' ? 1 : 8);
        const maxP = cfg.circleOuMaxPct ?? 9.0;
        const lowArr = cfg.circleOuLowDigits
          .split(/[,\s]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 0 && n <= 9);
        const effectiveLow = lowArr.length > 0 ? lowArr : tType === 'over' ? [0, 1] : [8, 9];
        const lowSet = new Set(effectiveLow);
        const touchMode = cfg.circleOuLowTouchMode;
        const reqOver = cfg.circleOuOverTouchCount || 2;
        const maxFinal = cfg.circleOuFinalTouchMaxTicks || 3;

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

        let st = this.autoBotCircleOuStates[symbol];
        if (!st) {
          st = {
            stage: 'WAITING_LOW_TOUCH',
            lowTouchedDigits: [],
            consecutiveLowCount: 0,
            overTouchCount: 0,
            finalTouchTicksElapsed: 0,
          };
          this.autoBotCircleOuStates[symbol] = st;
        }

        if (!isFocused) {
          st.stage = 'WAITING_LOW_TOUCH';
          st.lowTouchedDigits = [];
          st.consecutiveLowCount = 0;
          st.overTouchCount = 0;
          st.finalTouchTicksElapsed = 0;
        } else if (!isRetrigger) {
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
      }

      if (
        cfg.circleEntryModeEnabled &&
        circleTargetDigit !== null &&
        activeStreakMode !== 'circle_over_under'
      ) {
        circleTriggered = digit === circleTargetDigit;
      }
    }

    // Trigger decision
    let isTriggered = false;
    if (activeContractType === 'accumulator') {
      if (activeStreakMode === 'analysis_tool') {
        const c = computeAccumulatorSignal(rPrices, history, symbol);
        isTriggered = c.isNeutral5050 || c.action === 'BUY_ACCU';
      } else if (accumulatorMetrics) {
        const enabled = Object.entries(cfg.accuStrategies || {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        isTriggered =
          enabled.length > 0 && enabled.every((k) => Boolean(accumulatorMetrics.satisfied[k]));
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
          ? cfg.recoveryAnalysisOppositeSignalEnabled
          : cfg.analysisOppositeSignalEnabled;
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

    const effectiveUseVirtual = this.host.hasVirtualToken() && Boolean(cfg.useVirtualLoss);
    const activeLocked =
      this.autoBotState.continuousLockedMarket ||
      (effectiveUseVirtual ? this.autoBotState.lockedVirtualMarket : null);
    if (activeLocked && activeLocked !== symbol) {
      isTriggered = false;
    }
    if (cfg.isContinuousTrading && this.autoBotState.continuousLockedMarket === symbol) {
      isTriggered = true;
    }

    const isVirtualThresholdMet = Boolean(
      effectiveUseVirtual &&
        (this.autoBotState.isCurrentTradeReal ||
          this.autoBotState.consecVirtualLosses >= cfg.virtualLossThreshold)
    );
    if (isVirtualThresholdMet && this.autoBotState.lockedVirtualMarket === symbol) {
      isTriggered = true;
    }

    if (!isTriggered) return;

    if (cfg.isContinuousTrading && !this.autoBotState.continuousLockedMarket) {
      this.autoBotState.continuousLockedMarket = symbol;
      this.appendAutoBotLog(`${symbol}: Continuous trading locked until Take Profit is reached.`);
      this.emitSnapshot();
    }

    if (
      cfg.isRecoveryStreakModeEnabled &&
      this.autoBotLastLossTime > 0 &&
      Date.now() - this.autoBotLastLossTime < 5000
    ) {
      return;
    }

    if (
      cfg.alternateMarketRecovery &&
      !activeLocked &&
      cfg.checkedMarkets.length > 1 &&
      this.autoBotLastLostMarket === symbol
    ) {
      return;
    }

    const nowMs = Date.now();
    const lastTrade = this.autoBotLastTradeAt[symbol] || 0;
    const autoCooldownMs = this.host.isFastExecution() ? 0 : 400;
    if (!isVirtualThresholdMet && this.autoBotState.consecLosses === 0 && nowMs - lastTrade < autoCooldownMs) {
      return;
    }
    this.autoBotLastTradeAt[symbol] = nowMs;

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
          ? cfg.recoveryAnalysisOppositeSignalEnabled
          : cfg.analysisOppositeSignalEnabled;
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
          : cfg.circleOuTargetType;
      termContract = tType === 'over' ? 'DIGITOVER' : 'DIGITUNDER';
      prediction = circleTargetDigit ?? cfg.circleOuDigit ?? (tType === 'over' ? 1 : 8);
      strategyName = circleStrategyLabel || 'Circle O/U';
    } else if (activeStreakMode === 'over_under' && overUnderSignal) {
      termContract = overUnderSignal.type === 'digitover' ? 'DIGITOVER' : 'DIGITUNDER';
      prediction = overUnderSignal.prediction;
      strategyName = cfg.isEdmsEnabled ? 'EDMS O1/U8' : 'O1/U8 Cold Zone';
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

    if (this.autoBotQueue.length < 15) {
      this.autoBotQueue.push({
        symbol,
        type: activeContractType,
        contractType: termContract,
        prediction,
        prediction2: activeContractType === 'dual_ou' ? activeTargetDigit2 : undefined,
        amount: this.autoBotState.currentStake,
        timestamp: nowMs,
        accuGrowthRate: isRecActive
          ? cfg.recoveryAccumulatorGrowthRate
          : cfg.accumulatorGrowthRate,
        accuTakeProfit: isRecActive
          ? cfg.recoveryAccumulatorTakeProfit
          : cfg.accumulatorTakeProfit,
        matchedPatternKey,
        strategyName,
      });
      if (this.host.isFastExecution() && !this.autoBotInFlight) {
        queueMicrotask(() => {
          void this.consumeAutoBotQueue();
        });
      }
    }
  }

  private retriggerAutoBotFast(): void {
    if (!this.host.isFastExecution() || !this.autoBotState.running || this.autoBotInFlight) return;
    const cfg = this.autoBotConfig;
    const useVirtual = this.host.hasVirtualToken() && Boolean(cfg.useVirtualLoss);
    const activeLocked =
      this.autoBotState.continuousLockedMarket ||
      (useVirtual ? this.autoBotState.lockedVirtualMarket : null);
    const candidates = activeLocked ? [activeLocked] : cfg.checkedMarkets;
    for (const sym of candidates) {
      if (this.autoBotQueue.length > 0 || !this.autoBotState.running) break;
      const dHist = this.digitHistories.get(sym);
      const pHist = this.priceHistories.get(sym) || [];
      const meta = this.latestTickMeta.get(sym);
      if (dHist && dHist.length > 0 && meta) {
        this.onAutoBotTick(sym, meta.price, meta.digit, meta.decimals, dHist, pHist, true);
      }
    }
  }

  private ensureAutoBotQueueLoop(): void {
    if (this.autoBotLoopTimer) return;
    this.autoBotLoopTimer = setInterval(() => {
      void this.consumeAutoBotQueue();
    }, 25);
  }

  private async consumeAutoBotQueue(): Promise<void> {
    if (!this.autoBotState.running || this.autoBotInFlight) return;
    if (!this.host.isFastExecution() && Date.now() < this.autoBotNextAllowedAt) return;
    if (this.autoBotQueue.length === 0) return;

    const cfg = this.autoBotConfig;
    const useVirtual = this.host.hasVirtualToken() && Boolean(cfg.useVirtualLoss);
    const activeLocked =
      this.autoBotState.continuousLockedMarket ||
      (useVirtual ? this.autoBotState.lockedVirtualMarket : null);

    let sig: AutoBotSignalQueueItem | undefined;
    while (this.autoBotQueue.length > 0) {
      const cand = this.autoBotQueue.shift();
      if (!cand) continue;
      if (Date.now() - cand.timestamp > 15_000) continue;
      if (activeLocked && activeLocked !== cand.symbol) continue;
      if (
        cfg.alternateMarketRecovery &&
        !activeLocked &&
        cfg.checkedMarkets.length > 1 &&
        this.autoBotLastLostMarket === cand.symbol
      ) {
        continue;
      }
      sig = cand;
      break;
    }
    if (!sig) return;

    this.autoBotInFlight = true;
    try {
      const shouldTradeReal = !useVirtual
        ? true
        : this.autoBotState.isCurrentTradeReal ||
          this.autoBotState.consecVirtualLosses >= cfg.virtualLossThreshold;

      const dur = cfg.isRandomTicks
        ? Math.floor(Math.random() * 10) + 1
        : Math.min(10, Math.max(1, cfg.tradeDuration));

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

      const baseStake = this.computeAutoBotBaseStake();
      let realStakeUsed = Math.max(
        0.35,
        Number((this.autoBotState.currentStake || baseStake || 1).toFixed(2))
      );
      if (apiContractType === 'accumulator' && realStakeUsed < 1) {
        realStakeUsed = 1;
      }
      const bal = this.host.getAccountBalance();
      if (cfg.isAutoStakeEnabled && bal > 0 && realStakeUsed > bal) {
        realStakeUsed = baseStake;
        this.autoBotState.currentStake = realStakeUsed;
      }

      const virtualStake = apiContractType === 'accumulator' ? 1.0 : 0.35;

      if (cfg.patternRotationalMode && sig.matchedPatternKey) {
        const seq = sig.matchedPatternKey.split('=')[0];
        this.autoBotPatternRotationalIdx[seq] =
          ((this.autoBotPatternRotationalIdx[seq] || 0) + 1) % Math.max(1, seq.length);
      }

      const currency = this.host.getAccountCurrency();
      let realOutcome: { won: boolean; profit: number } | null = null;

      if (!shouldTradeReal && useVirtual) {
        this.appendAutoBotLog(
          `VIRTUAL ${sig.contractType} on ${sig.symbol} (Pred ${sig.prediction}, Stake $${virtualStake.toFixed(2)}, ${sig.strategyName || 'AutoBot'})`
        );
        this.emitSnapshot();

        const vRes = await this.host.executeAutoBotTrade({
          symbol: sig.symbol,
          contractType: apiContractType,
          prediction: sig.prediction,
          prediction2: sig.prediction2,
          stake: virtualStake,
          duration: dur,
          growthRate: (sig.accuGrowthRate ?? 2) / 100,
          takeProfit: sig.accuTakeProfit ?? 10,
          isVirtual: true,
          strategyName: sig.strategyName || undefined,
        });

        if (vRes.won) {
          this.autoBotState.virtualWins += 1;
          this.autoBotState.consecVirtualLosses = 0;
          this.autoBotState.lockedVirtualMarket = null;
          this.appendAutoBotLog(
            `VIRTUAL WIN (+${vRes.profit.toFixed(2)}) on ${sig.symbol} · Reset streak`
          );
          this.emitSnapshot();
          return;
        }

        const nextVLosses = this.autoBotState.consecVirtualLosses + 1;
        this.autoBotState.virtualLosses += 1;
        this.autoBotState.consecVirtualLosses = nextVLosses;

        if (nextVLosses < cfg.virtualLossThreshold) {
          this.appendAutoBotLog(
            `VIRTUAL LOSS (${nextVLosses}/${cfg.virtualLossThreshold}) on ${sig.symbol}`
          );
          this.emitSnapshot();
          return;
        }

        this.autoBotState.lockedVirtualMarket = sig.symbol;
        this.autoBotState.isCurrentTradeReal = true;
        this.appendAutoBotLog(
          `VIRTUAL LOSS threshold (${nextVLosses}/${cfg.virtualLossThreshold}) met on ${sig.symbol} → Switching to REAL immediately @ $${realStakeUsed.toFixed(2)}!`
        );
        this.emitSnapshot();

        if (!this.autoBotState.running) return;
        realOutcome = await this.host.executeAutoBotTrade({
          symbol: sig.symbol,
          contractType: apiContractType,
          prediction: sig.prediction,
          prediction2: sig.prediction2,
          stake: realStakeUsed,
          duration: dur,
          growthRate: (sig.accuGrowthRate ?? 2) / 100,
          takeProfit: sig.accuTakeProfit ?? 10,
          isVirtual: false,
          strategyName: sig.strategyName || undefined,
        });
      } else {
        this.appendAutoBotLog(
          `REAL ${sig.contractType} on ${sig.symbol} (Pred ${sig.prediction}, Stake ${realStakeUsed.toFixed(2)}, ${sig.strategyName || 'AutoBot'})`
        );
        this.emitSnapshot();

        realOutcome = await this.host.executeAutoBotTrade({
          symbol: sig.symbol,
          contractType: apiContractType,
          prediction: sig.prediction,
          prediction2: sig.prediction2,
          stake: realStakeUsed,
          duration: dur,
          growthRate: (sig.accuGrowthRate ?? 2) / 100,
          takeProfit: sig.accuTakeProfit ?? 10,
          isVirtual: false,
          strategyName: sig.strategyName || undefined,
        });
      }

      if (!realOutcome) return;
      const { won, profit } = realOutcome;

      const nextProfit = Number((this.autoBotState.sessionProfit + profit).toFixed(2));
      this.autoBotState.sessionProfit = nextProfit;

      const nextCumProfit = Number((this.autoBotState.cumulativeProfit + profit).toFixed(2));
      this.autoBotState.cumulativeProfit = nextCumProfit;

      if (won) {
        this.autoBotState.wins += 1;
        this.autoBotState.consecLosses = 0;
        this.autoBotLastLostMarket = null;
        this.autoBotState.lostPatterns = [];
        this.autoBotState.currentStake = this.computeAutoBotBaseStake();

        if (useVirtual) {
          this.autoBotState.consecVirtualLosses = 0;
          this.autoBotState.lockedVirtualMarket = null;
          if (!cfg.virtualAfterRealLoss) {
            this.autoBotState.isCurrentTradeReal = false;
          }
        }

        this.appendAutoBotLog(
          `WON +${profit.toFixed(2)} ${currency} on ${sig.symbol} (Session ${nextProfit.toFixed(2)})`
        );

        const hitRuns =
          !cfg.runForever && cfg.isRunsLimitEnabled && this.autoBotState.wins >= cfg.runsLimit;
        const hitTp =
          !cfg.runForever && !cfg.isRunsLimitEnabled && nextProfit >= cfg.takeProfit;

        if (hitRuns || hitTp) {
          this.autoBotState.continuousLockedMarket = null;
          this.autoBotState.lockedVirtualMarket = null;

          if (cfg.autoRestartAfterTp) {
            if (nextCumProfit >= cfg.autoRestartMaxTp) {
              this.autoBotState.running = false;
              cfg.autoRestartAfterTp = false;
              this.autoBotState.autoRestartAfterTp = false;
              if (this.autoBotLoopTimer) {
                clearInterval(this.autoBotLoopTimer);
                this.autoBotLoopTimer = null;
              }
              const overallTpMsg = `Overall Auto-Start Take Profit $${cfg.autoRestartMaxTp.toFixed(2)} reached! Bot stopped.`;
              this.appendAutoBotLog(overallTpMsg);
              this.host.addLog('win', `AutoBot: ${overallTpMsg}`);
              this.autoBotState.lastEvent = this.nextEvent(
                'success',
                `Overall Target +$${cfg.autoRestartMaxTp.toFixed(2)} hit!`
              );
              this.syncPublicWebSocket();
            } else {
              this.autoBotState.sessionProfit = 0;
              this.autoBotState.wins = 0;
              this.autoBotState.losses = 0;
              const sessionTpMsg = `Session TP hit (+${nextProfit.toFixed(2)}). Auto-reset & continuing toward $${cfg.autoRestartMaxTp.toFixed(2)}...`;
              this.appendAutoBotLog(sessionTpMsg);
              this.host.addLog('win', `AutoBot: ${sessionTpMsg}`);
            }
          } else {
            this.autoBotState.running = false;
            if (this.autoBotLoopTimer) {
              clearInterval(this.autoBotLoopTimer);
              this.autoBotLoopTimer = null;
            }
            const tpMsg = hitRuns
              ? `Target ${cfg.runsLimit} winning runs reached!`
              : `Take Profit +${nextProfit.toFixed(2)} reached!`;
            this.appendAutoBotLog(tpMsg);
            this.host.addLog('win', `AutoBot: ${tpMsg}`);
            this.autoBotState.lastEvent = this.nextEvent('success', tpMsg);
            this.syncPublicWebSocket();
          }
        }
      } else {
        this.autoBotState.losses += 1;
        this.autoBotState.consecLosses += 1;
        this.autoBotLastLostMarket = sig.symbol;
        this.autoBotLastLossTime = Date.now();

        if (cfg.patternRecoveryMode && sig.matchedPatternKey) {
          this.autoBotState.lostPatterns = Array.from(
            new Set([...this.autoBotState.lostPatterns, sig.matchedPatternKey])
          );
        }

        if (cfg.patternSmartMode) {
          const relearned = this.runAutoBotPatternLearning(
            sig.matchedPatternKey?.split('=')[0],
            sig.prediction
          );
          if (relearned) {
            cfg.customPattern = relearned.pattern;
            cfg.patternSmartDigit = relearned.digit;
            this.autoBotState.customPattern = relearned.pattern;
            this.autoBotState.patternSmartDigit = relearned.digit;
          }
        }

        const mult = Number(cfg.martingale) || 1;
        if (mult > 1) {
          this.autoBotState.currentStake = Math.min(
            9130,
            Math.max(0.35, Math.round(realStakeUsed * mult * 100) / 100)
          );
        }

        if (useVirtual && cfg.virtualAfterRealLoss) {
          this.autoBotState.consecVirtualLosses = 0;
          this.autoBotState.isCurrentTradeReal = false;
        }

        this.appendAutoBotLog(
          `LOST ${profit.toFixed(2)} ${currency} on ${sig.symbol} · Next stake ${this.autoBotState.currentStake.toFixed(2)}`
        );

        if (!cfg.runForever && Math.abs(Math.min(0, nextProfit)) >= cfg.stopLoss) {
          this.autoBotState.running = false;
          if (this.autoBotLoopTimer) {
            clearInterval(this.autoBotLoopTimer);
            this.autoBotLoopTimer = null;
          }
          const slMsg = `Stop Loss -${Math.abs(nextProfit).toFixed(2)} reached. Bot stopped.`;
          this.appendAutoBotLog(slMsg);
          this.host.addLog('error', `AutoBot: ${slMsg}`);
          this.autoBotState.lastEvent = this.nextEvent('error', slMsg);
          this.syncPublicWebSocket();
        }
      }

      if (!this.host.isFastExecution() || !this.autoBotState.running) {
        this.savePersistedConfigs();
      } else {
        setTimeout(() => this.savePersistedConfigs(), 0);
      }
      this.emitSnapshot();
    } catch (err: any) {
      const msg = err?.message || 'AutoBot trade execution error.';
      this.appendAutoBotLog(`Trade Error: ${msg}`);
      this.host.addLog('error', `AutoBot Error: ${msg}`);
      this.autoBotState.lastEvent = this.nextEvent('error', msg);
      if (msg.includes('Connect your Deriv') || msg.includes('token')) {
        this.autoBotState.running = false;
        this.syncPublicWebSocket();
      }
      this.emitSnapshot();
    } finally {
      this.autoBotInFlight = false;
      if (this.autoBotState.running) {
        if (this.host.isFastExecution()) {
          this.autoBotNextAllowedAt = 0;
          const now = Date.now();
          this.autoBotQueue = this.autoBotQueue.filter((item) => now - item.timestamp <= 15_000);
          if (this.autoBotQueue.length === 0) {
            this.retriggerAutoBotFast();
          }
          if (this.autoBotQueue.length > 0) {
            queueMicrotask(() => {
              void this.consumeAutoBotQueue();
            });
          }
        } else {
          this.autoBotNextAllowedAt = Date.now() + 1000;
          this.autoBotQueue = [];
        }
      }
    }
  }

  // =========================================================================
  // 2) GRID MASTER (OverUnderActiveBot) CLOUD ENGINE
  // =========================================================================
  startGridMaster(config: GridMasterCloudConfig): GridMasterCloudState {
    if (!this.host.isAccountConnected()) {
      throw new Error('Connect your Deriv API token via Deriv API Connection first.');
    }
    this.gridConfig = {
      ...config,
      markets: Array.isArray(config.markets) && config.markets.length > 0 ? config.markets : ['1HZ10V'],
    };
    const base = Math.max(0.35, Number(this.gridConfig.stake) || 1);
    const virtActive = Boolean(this.host.hasVirtualToken() && this.gridConfig.useVirtual);
    this.gridVLossStreak = 0;
    this.gridInRealPhase = !virtActive;
    this.gridInFlight = false;
    this.gridLastTradeAt = 0;
    this.gridState = {
      running: true,
      wins: 0,
      losses: 0,
      virtualWins: 0,
      virtualLosses: 0,
      profit: 0,
      currentStake: base,
      statusLog: `Monitoring ${this.gridConfig.markets.length} market(s) for high-pressure Over/Under signals...`,
      errorMsg: null,
    };
    this.savePersistedConfigs();
    this.syncPublicWebSocket();
    this.emitSnapshot();
    return this.getSnapshot().gridMaster;
  }

  stopGridMaster(): GridMasterCloudState {
    this.gridState.running = false;
    this.gridState.statusLog = 'Master Over/Under Bot stopped.';
    this.syncPublicWebSocket();
    this.emitSnapshot();
    return this.getSnapshot().gridMaster;
  }

  private onGridMasterTick(): void {
    if (!this.gridState.running || this.gridInFlight) return;
    const now = Date.now();
    const gridCooldownMs = this.host.isFastExecution() ? 0 : 1000;
    if (now - this.gridLastTradeAt < gridCooldownMs) return;

    for (const sym of this.gridConfig.markets) {
      const list = this.digitHistories.get(sym);
      if (!list || list.length < 25) continue;
      const recent = list.slice(-25);
      const over1Count = recent.filter((d) => d > 1).length;
      const under8Count = recent.filter((d) => d < 8).length;
      const over4Count = recent.filter((d) => d > 4).length;
      const under5Count = recent.filter((d) => d < 5).length;

      let chosen: {
        contractType: 'digitover' | 'digitunder';
        barrier: number;
        label: string;
      } | null = null;

      if (this.gridConfig.strategyMode === 'over1_under8') {
        const last3 = list.slice(-3);
        if (over1Count / recent.length >= 0.88 && last3.every((d) => d >= 2)) {
          chosen = { contractType: 'digitover', barrier: 1, label: 'OVER 1' };
        } else if (under8Count / recent.length >= 0.88 && last3.every((d) => d <= 7)) {
          chosen = { contractType: 'digitunder', barrier: 8, label: 'UNDER 8' };
        }
      } else {
        if (over4Count / recent.length >= 0.64) {
          chosen = { contractType: 'digitover', barrier: 4, label: 'OVER 4' };
        } else if (under5Count / recent.length >= 0.64) {
          chosen = { contractType: 'digitunder', barrier: 5, label: 'UNDER 5' };
        }
      }

      if (chosen) {
        this.gridInFlight = true;
        this.gridLastTradeAt = now;
        void this.executeGridMasterTrade(sym, chosen).finally(() => {
          this.gridInFlight = false;
          if (!this.host.isFastExecution()) {
            this.gridLastTradeAt = Date.now();
          } else if (this.gridState.running) {
            queueMicrotask(() => {
              this.onGridMasterTick();
            });
          }
        });
        break;
      }
    }
  }

  private async executeGridMasterTrade(
    sym: string,
    chosen: { contractType: 'digitover' | 'digitunder'; barrier: number; label: string }
  ): Promise<void> {
    try {
      const cfg = this.gridConfig;
      const execRealStake = Math.max(0.35, Number((this.gridState.currentStake || 1).toFixed(2)));
      const virtModeEnabled = Boolean(this.host.hasVirtualToken() && cfg.useVirtual);
      const isVirt = virtModeEnabled && !this.gridInRealPhase;
      const durTicks = Math.max(1, Math.min(10, cfg.duration || 1));

      let realRes: { won: boolean; profit: number } | null = null;

      if (isVirt) {
        this.gridState.statusLog = `Signal on ${sym}: ${chosen.label} (VIRTUAL API) @ $0.35...`;
        this.emitSnapshot();

        const vOutcome = await this.host.executeAutoBotTrade({
          symbol: sym,
          contractType: chosen.contractType,
          prediction: chosen.barrier,
          stake: 0.35,
          duration: durTicks,
          isVirtual: true,
          strategyName: `Grid Master ${chosen.label}`,
        });
        if (!this.gridState.running) return;

        if (vOutcome.won) {
          this.gridVLossStreak = 0;
          this.gridState.virtualWins += 1;
          this.gridState.statusLog = `${sym} ${chosen.label}: VIRTUAL WIN +$${vOutcome.profit.toFixed(2)} · Streak reset`;
          this.emitSnapshot();
          return;
        }

        const nextVStreak = this.gridVLossStreak + 1;
        this.gridVLossStreak = nextVStreak;
        this.gridState.virtualLosses += 1;

        if (cfg.virtualLossTarget <= 0 || nextVStreak < cfg.virtualLossTarget) {
          this.gridState.statusLog = `${sym} ${chosen.label}: VIRTUAL LOSS (${nextVStreak}${cfg.virtualLossTarget > 0 ? `/${cfg.virtualLossTarget}` : ''})`;
          this.emitSnapshot();
          return;
        }

        this.gridInRealPhase = true;
        this.gridState.statusLog = `${sym} V-Loss ${nextVStreak}/${cfg.virtualLossTarget} hit -> Switching to REAL immediately @ $${execRealStake.toFixed(2)}!`;
        this.emitSnapshot();

        realRes = await this.host.executeAutoBotTrade({
          symbol: sym,
          contractType: chosen.contractType,
          prediction: chosen.barrier,
          stake: execRealStake,
          duration: durTicks,
          isVirtual: false,
          strategyName: `Grid Master ${chosen.label}`,
        });
      } else {
        this.gridState.statusLog = `Signal on ${sym}: ${chosen.label} (REAL) @ $${execRealStake.toFixed(2)}...`;
        this.emitSnapshot();

        realRes = await this.host.executeAutoBotTrade({
          symbol: sym,
          contractType: chosen.contractType,
          prediction: chosen.barrier,
          stake: execRealStake,
          duration: durTicks,
          isVirtual: false,
          strategyName: `Grid Master ${chosen.label}`,
        });
      }

      if (!realRes || !this.gridState.running) return;

      const nextProfit = Number((this.gridState.profit + realRes.profit).toFixed(2));
      this.gridState.profit = nextProfit;

      if (realRes.won) {
        this.gridState.wins += 1;
        this.gridState.currentStake = Math.max(0.35, Number(cfg.stake) || 1);
        if (virtModeEnabled && cfg.virtualLossTarget > 0) {
          this.gridVLossStreak = 0;
          this.gridInRealPhase = false;
        }
        this.gridState.statusLog = `${sym} ${chosen.label}: REAL WIN +$${realRes.profit.toFixed(2)}`;
      } else {
        this.gridState.losses += 1;
        const nextStake = Math.max(
          0.35,
          Number((execRealStake * Math.max(1, Number(cfg.martingale) || 1)).toFixed(2))
        );
        this.gridState.currentStake = nextStake;
        this.gridState.statusLog = `${sym} ${chosen.label}: REAL LOSS -$${Math.abs(realRes.profit).toFixed(2)} -> Next $${nextStake.toFixed(2)}`;
      }

      if (nextProfit >= cfg.tp) {
        this.gridState.statusLog = `Take Profit reached (+$${nextProfit.toFixed(2)}). Bot stopped.`;
        this.gridState.running = false;
        this.syncPublicWebSocket();
      } else if (nextProfit <= -cfg.sl) {
        this.gridState.statusLog = `Stop Loss reached (-$${Math.abs(nextProfit).toFixed(2)}). Bot stopped.`;
        this.gridState.running = false;
        this.syncPublicWebSocket();
      }

      this.emitSnapshot();
    } catch (err: any) {
      this.gridState.errorMsg = err?.message || 'Execution error';
      this.gridState.running = false;
      this.syncPublicWebSocket();
      this.emitSnapshot();
    }
  }

  // =========================================================================
  // 3) FREQUENCY BOT (ClassicFrequencyView) CLOUD ENGINE
  // =========================================================================
  startFrequencyBot(config: FrequencyCloudConfig): FrequencyCloudState {
    if (!this.host.isAccountConnected()) {
      throw new Error('Connect your Deriv API token via Deriv API Connection first.');
    }
    if (this.scannerState.running) {
      this.stopAiScanner();
    }

    this.freqConfig = { ...config };
    let initialStake = Math.max(0.35, Number(config.stake) || 1);
    if (config.autoStakeEnabled) {
      const bal = this.host.getAccountBalance() > 0 ? this.host.getAccountBalance() : 100;
      initialStake = Math.max(
        0.35,
        parseFloat((bal * (config.autoStakePct / 100)).toFixed(2))
      );
    }

    this.freqInFlight = false;
    this.freqConsecLosses = 0;
    this.freqLastTradeAt = 0;
    this.freqVLossStreak = 0;
    const virtActive = Boolean(this.host.hasVirtualToken() && config.virtualMode);
    this.freqInRealPhase = !virtActive;

    this.freqState = {
      running: true,
      symbol: config.symbol,
      wins: 0,
      losses: 0,
      virtualWins: 0,
      virtualLosses: 0,
      sessionProfit: 0,
      currentStake: initialStake,
      statusLog: `Exact Frequency Match Bot started on ${config.symbol}.`,
      errorMsg: null,
      lastEvent: this.nextEvent('success', `Exact Frequency Match Bot started on ${config.symbol}.`),
    };
    this.savePersistedConfigs();
    this.syncPublicWebSocket();
    this.emitSnapshot();
    return this.getSnapshot().frequency;
  }

  stopFrequencyBot(): FrequencyCloudState {
    this.freqState.running = false;
    this.freqState.statusLog = 'Digit Frequency Bot stopped.';
    this.freqState.lastEvent = this.nextEvent('info', 'Digit Frequency Bot stopped.');
    this.syncPublicWebSocket();
    this.emitSnapshot();
    return this.getSnapshot().frequency;
  }

  private onFrequencyTick(sym: string, digitsAll: number[], _pricesAll: number[]): void {
    if (!this.freqState.running || this.freqInFlight) return;
    const cooldownMs = this.host.isFastExecution() ? 0 : this.freqConsecLosses > 0 ? 400 : 1000;
    if (Date.now() - this.freqLastTradeAt < cooldownMs) return;

    const cfg = this.freqConfig;
    const winLen = Math.max(10, Math.min(5000, cfg.analysisWindow || 1000));
    const digits = digitsAll.slice(-winLen);
    if (digits.length < 10) return;

    const counts = Array(10).fill(0);
    digits.forEach((d) => counts[d]++);
    let mostFrequent = 0;
    let leastFrequent = 0;
    counts.forEach((c, i) => {
      if (c > counts[mostFrequent]) mostFrequent = i;
      if (c < counts[leastFrequent]) leastFrequent = i;
    });
    const frequencies = counts.map((c) => (c / digits.length) * 100);
    const rankedDigits = frequencies
      .map((f, i) => ({ digit: i, freq: f }))
      .sort((a, b) => b.freq - a.freq);

    const isRecovery = cfg.smartRecoveryEnabled && this.freqConsecLosses > 0;
    const strategy = isRecovery ? cfg.recoveryContractType : cfg.contractType;

    let matchedDigit: number | null = null;
    let matchReason = '';

    if (cfg.circleModeEnabled) {
      const circleStyle = isRecovery ? cfg.recoveryCircleType : cfg.circleType;
      let targetDigit = leastFrequent;
      if (circleStyle === 'green') {
        targetDigit = mostFrequent;
      } else if (circleStyle === 'blue') {
        targetDigit = rankedDigits.length >= 2 ? rankedDigits[1].digit : mostFrequent;
      } else if (circleStyle === 'orange') {
        targetDigit = rankedDigits.length >= 10 ? rankedDigits[8].digit : leastFrequent;
      } else {
        targetDigit = leastFrequent;
      }
      const liveLastDigit = digits[digits.length - 1] ?? 0;
      if (liveLastDigit === targetDigit) {
        matchedDigit = targetDigit;
        matchReason = `Circle Mode (${circleStyle.toUpperCase()}): Digit ${targetDigit} touched`;
      }
    } else if (strategy === 'coldest') {
      matchedDigit = leastFrequent;
      matchReason = `Coldest Ticker: Digit ${matchedDigit} (${(frequencies[matchedDigit] || 0).toFixed(1)}%)`;
    } else if (strategy === 'even' || strategy === 'odd') {
      const evens = [0, 2, 4, 6, 8];
      const odds = [1, 3, 5, 7, 9];
      let ok = false;
      if (cfg.evenOddMode === 'high_even') {
        ok = evens.filter((d) => (frequencies[d] || 0) > cfg.benchmarkPct).length > 3;
      } else if (cfg.evenOddMode === 'low_even') {
        ok = evens.filter((d) => (frequencies[d] || 0) < cfg.benchmarkPct).length >= 3;
      } else if (cfg.evenOddMode === 'high_odd') {
        ok = odds.filter((d) => (frequencies[d] || 0) > cfg.benchmarkPct).length > 3;
      } else {
        ok = odds.filter((d) => (frequencies[d] || 0) < cfg.benchmarkPct).length >= 3;
      }
      if (ok) {
        matchedDigit = 0;
        matchReason = `Even/Odd (${cfg.evenOddMode}) matched benchmark ${cfg.benchmarkPct}%`;
      }
    } else {
      const isSpecific = cfg.digitFilterEnabled;
      const compareMode = isRecovery ? cfg.recoveryCompareMode : cfg.filterCompareMode;
      const targetPct = isRecovery ? cfg.recoveryTargetPct : cfg.targetPct;

      if (isSpecific) {
        const filterStr = isRecovery ? cfg.recoveryFilterDigits : cfg.filterDigits;
        const targetDigits = filterStr
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((v) => !isNaN(v) && v >= 0 && v <= 9);

        for (let d = 0; d <= 9; d++) {
          if (!targetDigits.includes(d)) continue;
          const freq = frequencies[d] || 0;
          const isMatch = compareMode === 'higher' ? freq >= targetPct : freq <= targetPct;
          if (isMatch) {
            matchedDigit = d;
            matchReason = `Digit ${d} (${freq.toFixed(1)}%)`;
            break;
          }
        }
      } else if (isRecovery) {
        for (let d = 0; d <= 9; d++) {
          const freq = frequencies[d] || 0;
          const isMatch = compareMode === 'higher' ? freq >= targetPct : freq <= targetPct;
          if (isMatch) {
            matchedDigit = d;
            matchReason = `Recovery Digit ${d} (${freq.toFixed(1)}%)`;
            break;
          }
        }
      } else {
        const targetPctStr = Number(cfg.targetPct).toFixed(1);
        for (let d = 0; d <= 9; d++) {
          const freq = frequencies[d] || 0;
          if (Number(freq).toFixed(1) === targetPctStr) {
            matchedDigit = d;
            matchReason = `Digit ${d} exact ${targetPctStr}%`;
            break;
          }
        }
      }
    }

    if (matchedDigit === null) return;

    this.freqInFlight = true;
    this.freqLastTradeAt = Date.now();

    const apiContractType:
      | 'digitdiff'
      | 'digitover'
      | 'digitunder'
      | 'digiteven'
      | 'digitodd' =
      strategy === 'over'
        ? 'digitover'
        : strategy === 'under'
        ? 'digitunder'
        : strategy === 'even'
        ? 'digiteven'
        : strategy === 'odd'
        ? 'digitodd'
        : 'digitdiff';

    let prediction = matchedDigit;
    if (strategy === 'over' || strategy === 'under') {
      prediction = cfg.circleModeEnabled
        ? isRecovery
          ? cfg.recoveryPredictionDigit
          : cfg.predictionDigit
        : cfg.predictionDigit;
    }

    void this.executeFrequencyTrade(sym, strategy, apiContractType, prediction, matchReason).finally(
      () => {
        this.freqInFlight = false;
        if (!this.host.isFastExecution()) {
          this.freqLastTradeAt = Date.now();
        } else if (this.freqState.running) {
          const targetSym = this.freqState.symbol || sym;
          const dAll = this.digitHistories.get(targetSym);
          const pAll = this.priceHistories.get(targetSym) || [];
          if (dAll && dAll.length > 0) {
            queueMicrotask(() => {
              this.onFrequencyTick(targetSym, dAll, pAll);
            });
          }
        }
      }
    );
  }

  private async executeFrequencyTrade(
    sym: string,
    strategy: string,
    apiContractType: 'digitdiff' | 'digitover' | 'digitunder' | 'digiteven' | 'digitodd',
    prediction: number,
    matchReason: string
  ): Promise<void> {
    try {
      const cfg = this.freqConfig;
      const execStake = this.freqState.currentStake;
      const virtModeEnabled = Boolean(this.host.hasVirtualToken() && cfg.virtualMode);
      const shouldTradeVirtual = virtModeEnabled && !this.freqInRealPhase;
      const durTicks = Math.max(1, Math.min(10, cfg.duration || 1));

      let realOutcome: { won: boolean; profit: number } | null = null;

      if (shouldTradeVirtual) {
        this.freqState.statusLog = `Frequency Match (${matchReason}): VIRTUAL ${apiContractType.toUpperCase()} @ $0.35`;
        this.freqState.lastEvent = this.nextEvent('info', this.freqState.statusLog);
        this.emitSnapshot();

        const vRes = await this.host.executeAutoBotTrade({
          symbol: sym,
          contractType: apiContractType,
          prediction,
          stake: 0.35,
          duration: durTicks,
          isVirtual: true,
          strategyName: `Frequency Bot Virtual (${strategy.toUpperCase()})`,
        });
        if (!this.freqState.running) return;

        if (vRes.won) {
          this.freqVLossStreak = 0;
          this.freqState.virtualWins += 1;
          this.freqState.statusLog = `Frequency Virtual WIN +$${vRes.profit.toFixed(2)} on ${sym}`;
          this.freqState.lastEvent = this.nextEvent('info', this.freqState.statusLog);
          this.emitSnapshot();
          return;
        }

        const nextVStreak = this.freqVLossStreak + 1;
        this.freqVLossStreak = nextVStreak;
        this.freqState.virtualLosses += 1;

        if (nextVStreak < cfg.virtualLossesTarget) {
          this.freqState.statusLog = `Frequency Virtual LOSS (${nextVStreak}/${cfg.virtualLossesTarget}) on ${sym}`;
          this.freqState.lastEvent = this.nextEvent('warn', this.freqState.statusLog);
          this.emitSnapshot();
          return;
        }

        this.freqInRealPhase = true;
        this.freqState.statusLog = `Virtual Loss Target (${nextVStreak}/${cfg.virtualLossesTarget}) hit -> Executing REAL ${apiContractType.toUpperCase()} immediately @ $${execStake.toFixed(2)}!`;
        this.freqState.lastEvent = this.nextEvent('info', this.freqState.statusLog);
        this.emitSnapshot();

        realOutcome = await this.host.executeAutoBotTrade({
          symbol: sym,
          contractType: apiContractType,
          prediction,
          stake: execStake,
          duration: durTicks,
          isVirtual: false,
          strategyName: `Frequency Bot (${strategy.toUpperCase()})`,
        });
      } else {
        this.freqState.statusLog = `Frequency Match (${matchReason}): Executing ${apiContractType.toUpperCase()} @ $${execStake.toFixed(2)}`;
        this.freqState.lastEvent = this.nextEvent('info', this.freqState.statusLog);
        this.emitSnapshot();

        realOutcome = await this.host.executeAutoBotTrade({
          symbol: sym,
          contractType: apiContractType,
          prediction,
          stake: execStake,
          duration: durTicks,
          isVirtual: false,
          strategyName: `Frequency Bot (${strategy.toUpperCase()})`,
        });
      }

      if (!realOutcome || !this.freqState.running) return;

      const { profit: pnl, won } = realOutcome;
      const nextProfit = Number((this.freqState.sessionProfit + pnl).toFixed(2));
      this.freqState.sessionProfit = nextProfit;

      if (won) {
        this.freqState.wins += 1;
        this.freqConsecLosses = 0;
        if (virtModeEnabled) {
          this.freqVLossStreak = 0;
          this.freqInRealPhase = false;
        }
        let baseStake = Math.max(0.35, Number(cfg.stake) || 1);
        if (cfg.autoStakeEnabled) {
          const bal = this.host.getAccountBalance() > 0 ? this.host.getAccountBalance() : 100;
          baseStake = Math.max(
            0.35,
            parseFloat((bal * (cfg.autoStakePct / 100)).toFixed(2))
          );
        }
        this.freqState.currentStake = baseStake;
        this.freqState.statusLog = `Frequency Bot WIN +$${pnl.toFixed(2)} on ${sym}`;
        this.freqState.lastEvent = this.nextEvent('success', this.freqState.statusLog);

        if (cfg.marketSwitchMode === 'always' && this.freqState.running) {
          const next = await this.scanBestSyntheticMarket(sym);
          if (next && this.freqState.running) {
            this.freqState.symbol = next.symbol;
            this.freqConfig.symbol = next.symbol;
            this.syncPublicWebSocket();
          }
        }
      } else {
        this.freqConsecLosses += 1;
        this.freqState.losses += 1;
        const nextStake = Number((execStake * Math.max(1, cfg.martingale)).toFixed(2));
        this.freqState.currentStake = nextStake;
        this.freqState.statusLog = `Frequency Bot LOSS -$${Math.abs(pnl).toFixed(2)} -> Next $${nextStake.toFixed(2)}`;
        this.freqState.lastEvent = this.nextEvent('warn', this.freqState.statusLog);

        if (
          (cfg.marketSwitchMode === 'loss' || cfg.marketSwitchMode === 'always') &&
          this.freqState.running
        ) {
          const next = await this.scanBestSyntheticMarket(sym);
          if (next && this.freqState.running) {
            this.freqState.symbol = next.symbol;
            this.freqConfig.symbol = next.symbol;
            this.syncPublicWebSocket();
          }
        }
      }

      if (cfg.maxRunsEnabled) {
        if (this.freqState.wins >= cfg.maxRuns && this.freqConsecLosses === 0) {
          this.freqState.statusLog = `Target winning runs reached (${this.freqState.wins}/${cfg.maxRuns}). Bot stopped.`;
          this.freqState.lastEvent = this.nextEvent('success', this.freqState.statusLog);
          this.freqState.running = false;
          this.syncPublicWebSocket();
        }
      } else if (nextProfit >= cfg.tp) {
        this.freqState.statusLog = `Take Profit reached: +$${nextProfit.toFixed(2)}. Bot stopped.`;
        this.freqState.lastEvent = this.nextEvent('success', this.freqState.statusLog);
        this.freqState.running = false;
        this.syncPublicWebSocket();
      } else if (nextProfit <= -cfg.sl) {
        this.freqState.statusLog = `Stop Loss reached: -$${Math.abs(nextProfit).toFixed(2)}. Bot stopped.`;
        this.freqState.lastEvent = this.nextEvent('error', this.freqState.statusLog);
        this.freqState.running = false;
        this.syncPublicWebSocket();
      }

      this.emitSnapshot();
    } catch (err: any) {
      this.freqState.errorMsg = err?.message || 'Frequency Bot execution error.';
      this.freqState.lastEvent = this.nextEvent('error', this.freqState.errorMsg!);
      this.freqState.running = false;
      this.syncPublicWebSocket();
      this.emitSnapshot();
    }
  }

  // =========================================================================
  // 4) AI SCANNER BOT (OTIVO Neural Auto-Trade) CLOUD ENGINE
  // =========================================================================
  startAiScanner(config: AiScannerCloudConfig): AiScannerCloudState {
    if (!this.host.isAccountConnected()) {
      throw new Error('Connect your Deriv API token via Deriv API Connection first.');
    }
    if (!config.symbol) {
      throw new Error('Market symbol is required.');
    }
    if (this.freqState.running) {
      this.stopFrequencyBot();
    }

    this.scannerConfig = { ...config };
    const runId = ++this.scannerRunId;
    const baseStake = Math.max(0.35, Number(config.stake) || 1);

    this.scannerState = {
      running: true,
      symbol: config.symbol,
      digit: config.digit ?? 5,
      sessionProfit: 0,
      currentStake: baseStake,
      wins: 0,
      losses: 0,
      tpSlResult: null,
      errorMsg: null,
      lastEvent: this.nextEvent(
        'success',
        `AI Scanner Bot started on ${config.name || config.symbol} (Differ ${config.digit ?? 5})`
      ),
    };
    this.savePersistedConfigs();
    this.emitSnapshot();

    void this.runAiScannerLoop(runId);
    return this.getSnapshot().aiScanner;
  }

  stopAiScanner(): AiScannerCloudState {
    this.scannerRunId++;
    this.scannerState.running = false;
    this.scannerState.lastEvent = this.nextEvent('info', 'AI Scanner Bot stopped.');
    this.emitSnapshot();
    return this.getSnapshot().aiScanner;
  }

  clearAiScannerTpSl(): AiScannerCloudState {
    this.scannerState.tpSlResult = null;
    this.emitSnapshot();
    return this.getSnapshot().aiScanner;
  }

  private async runAiScannerLoop(runId: number): Promise<void> {
    let stake = Math.max(0.35, Number(this.scannerConfig.stake) || 1);
    let totalProfit = 0;
    let lossStreak = 0;
    let targetSymbol = this.scannerConfig.symbol;
    let targetDigit = this.scannerConfig.digit ?? 5;

    while (this.scannerState.running && this.scannerRunId === runId) {
      try {
        const res = await this.host.executeAutoBotTrade({
          symbol: targetSymbol,
          contractType: 'digitdiff',
          prediction: targetDigit,
          stake,
          duration: 1,
          isVirtual: false,
          strategyName: `AI Scanner (${targetSymbol} Differ ${targetDigit})`,
        });

        if (!this.scannerState.running || this.scannerRunId !== runId) break;

        const pnl = Number(res.profit || 0);
        totalProfit = Number((totalProfit + pnl).toFixed(2));
        this.scannerState.sessionProfit = totalProfit;

        if (totalProfit >= this.scannerConfig.tp) {
          this.scannerState.tpSlResult = { type: 'tp', profit: totalProfit };
          this.scannerState.running = false;
          this.emitSnapshot();
          break;
        }
        if (totalProfit <= -this.scannerConfig.sl) {
          this.scannerState.tpSlResult = { type: 'sl', profit: totalProfit };
          this.scannerState.running = false;
          this.emitSnapshot();
          break;
        }

        if (res.won) {
          this.scannerState.wins += 1;
          lossStreak = 0;
          stake = Math.max(0.35, Number(this.scannerConfig.stake) || 1);
          this.scannerState.currentStake = stake;
          this.emitSnapshot();

          if (this.scannerConfig.marketSwitchMode === 'always') {
            const next = await this.scanBestSyntheticMarket(targetSymbol);
            if (next && this.scannerState.running && this.scannerRunId === runId) {
              targetSymbol = next.symbol;
              targetDigit = next.digit;
              this.scannerState.symbol = next.symbol;
              this.scannerState.digit = next.digit;
              this.emitSnapshot();
            }
          }
        } else {
          this.scannerState.losses += 1;
          lossStreak += 1;
          if (lossStreak >= this.scannerConfig.martingaleAfter) {
            stake = Number((stake * Math.max(1, this.scannerConfig.martingale)).toFixed(2));
            this.scannerState.currentStake = stake;
          }
          this.emitSnapshot();

          if (
            this.scannerConfig.marketSwitchMode === 'loss' ||
            this.scannerConfig.marketSwitchMode === 'always'
          ) {
            const next = await this.scanBestSyntheticMarket(targetSymbol);
            if (next && this.scannerState.running && this.scannerRunId === runId) {
              targetSymbol = next.symbol;
              targetDigit = next.digit;
              this.scannerState.symbol = next.symbol;
              this.scannerState.digit = next.digit;
              this.emitSnapshot();
            }
          }
        }

        if (!this.host.isFastExecution()) {
          await sleep(1000);
        }
      } catch (err: any) {
        this.scannerState.errorMsg = err?.message || 'AI Scanner Bot error';
        this.scannerState.lastEvent = this.nextEvent('error', this.scannerState.errorMsg!);
        this.scannerState.running = false;
        this.emitSnapshot();
        break;
      }
    }
  }

  // =========================================================================
  // 5) AI MARKET HACKER (4-Layer Math Filter) CLOUD ENGINE
  // =========================================================================
  private addHackerLog(msg: string): void {
    this.hackerState.logs = [...this.hackerState.logs, msg].slice(-100);
  }

  startAiHacker(config: AiHackerCloudConfig): AiHackerCloudState {
    if (!this.host.isAccountConnected()) {
      throw new Error('Connect your Deriv Real/Demo API token via Deriv API Connection first.');
    }

    const preserveMartingale = this.hackerConsecLosses > 0;
    this.hackerConfig = { ...config };
    const runId = ++this.hackerRunId;
    const baseStake = Math.max(0.35, Number(config.stake) || 0.5);

    this.hackerInFlight = false;
    this.hackerConsecVirtualLosses = 0;
    this.hackerLockedMarket = null;
    this.hackerTriggeredRealForLocked = false;
    if (!preserveMartingale) {
      this.hackerConsecLosses = 0;
    }
    const nextCurrentStake = preserveMartingale ? this.hackerState.currentStake : baseStake;

    this.hackerState = {
      running: true,
      tradesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      virtualStats: { wins: 0, losses: 0 },
      sessionProfit: 0,
      currentStake: nextCurrentStake,
      logs: [],
      mathSummaries: { ...this.hackerState.mathSummaries },
      marketDigits: { ...this.hackerState.marketDigits },
      errorMsg: null,
    };

    const virtEnabled = this.host.hasVirtualToken() && config.virtualMode;
    this.addHackerLog('[SYS] Authenticating at market matrix...');
    this.addHackerLog('[SYS] Synthetic stream linked (10 Volatility Markets)');
    this.addHackerLog('[SCAN] Initializing 100-tick historical buffer...');
    this.addHackerLog(
      `[SYS] Stake: $${baseStake.toFixed(2)} | Duration: ${config.durationTicks} tick(s) | Target Wins (Runs): ${config.maxTrades} | Martingale: ${config.martingaleMultiplier}x after ${config.martingaleAfterLosses} loss(es)`
    );
    if (virtEnabled) {
      this.addHackerLog(
        `[VIRTUAL MANAGER] Virtual Switch: ENABLED (Opposite Direction - Target Virtual Losses: ${config.virtualLosses})`
      );
      if (config.autoRestartWin) {
        this.addHackerLog('[AUTO-RESTART MANAGER] Auto-Restart on Virtual Win: ACTIVE');
      }
    }
    if (config.sameMarketRecovery) {
      this.addHackerLog(
        `[SAME MARKET RECOVERY] Active: Immediate recovery on loss market using ${config.recoveryContract === 'DIGITOVER' ? 'Over 1' : 'Under 8'}`
      );
    }
    if (config.continuousSameMarket) {
      this.addHackerLog(
        '[CONTINUOUS SAME MARKET] Active: Scanner locks onto signal market for continuous same-market trades.'
      );
    }
    this.addHackerLog('[OK] AI Market Hacker High-Precision 4-Layer Math Filter armed');

    this.savePersistedConfigs();
    this.syncPublicWebSocket();

    // Seed immediately if we already have cached digits
    for (const sym of VOLATILITY_10_MARKETS) {
      const existing = this.digitHistories.get(sym);
      if (existing && existing.length > 0 && runId === this.hackerRunId) {
        this.onHackerHistory(sym, existing.slice(-100));
      }
    }

    this.emitSnapshot();
    return this.getSnapshot().aiHacker;
  }

  stopAiHacker(reason = 'stopped by user'): AiHackerCloudState {
    this.hackerRunId++;
    this.hackerState.running = false;
    this.hackerInFlight = false;
    this.hackerConsecVirtualLosses = 0;
    this.hackerLockedMarket = null;
    this.hackerTriggeredRealForLocked = false;
    if (reason === 'stopped by user') {
      this.hackerConsecLosses = 0;
      this.hackerState.currentStake = Math.max(0.35, Number(this.hackerConfig.stake) || 0.5);
    }
    this.addHackerLog(`[SYS] Scanner ${reason}.`);
    this.syncPublicWebSocket();
    this.emitSnapshot();
    return this.getSnapshot().aiHacker;
  }

  private onHackerHistory(sym: string, digits: number[]): void {
    const slice = digits.slice(-100);
    this.hackerState.marketDigits[sym] = slice;

    if (!this.hackerMathEngines[sym]) {
      this.hackerMathEngines[sym] = {
        ingestion: new IngestionBuffer(1000),
        solver: new MathReconstructionSolver(),
        generator: new ShadowGenerator(new MathReconstructionSolver()),
        evaluator: new AccuracyEvaluator(),
        lastPred: null,
      };
      this.hackerMathEngines[sym].generator = new ShadowGenerator(
        this.hackerMathEngines[sym].solver
      );
    }
    const engine = this.hackerMathEngines[sym];
    slice.forEach((d) => engine.ingestion.push(d));
    engine.solver.fit(engine.ingestion.getAll());
    if (slice.length > 0) {
      engine.lastPred = engine.generator.predictNext(slice[slice.length - 1]);
    }
    const report = engine.evaluator.getReport();
    if (engine.lastPred) {
      this.hackerState.mathSummaries[sym] = {
        symbol: sym,
        isDeterministic: engine.solver.isDeterministic,
        lcgParams: engine.solver.lcgParams,
        topPrediction: engine.lastPred.topPrediction,
        confidence: engine.lastPred.confidence,
        top3Predictions: engine.lastPred.top3Predictions,
        probabilities: engine.lastPred.probabilities,
        totalEvaluated: report.totalEvaluated,
        exactAccuracyPct: report.exactMatchAccuracyPct,
        top3AccuracyPct: report.top3MatchAccuracyPct,
        mae: report.meanAbsoluteError,
      };
    }
    this.scheduleHackerUiEmit();
  }

  private onHackerTick(
    sym: string,
    digit: number,
    fullHistory: number[],
    isRetrigger = false
  ): void {
    if (!this.hackerState.running) return;
    const cfg = this.hackerConfig;
    if (cfg.continuousSameMarket && this.hackerLockedMarket && sym !== this.hackerLockedMarket) {
      return;
    }

    const history = fullHistory.slice(-100);
    this.hackerState.marketDigits[sym] = history;

    if (!this.hackerMathEngines[sym]) {
      const solver = new MathReconstructionSolver();
      this.hackerMathEngines[sym] = {
        ingestion: new IngestionBuffer(1000),
        solver,
        generator: new ShadowGenerator(solver),
        evaluator: new AccuracyEvaluator(),
        lastPred: null,
      };
    }
    const mathEngine = this.hackerMathEngines[sym];
    if (!isRetrigger) {
      if (mathEngine.lastPred) {
        mathEngine.evaluator.evaluate(digit, mathEngine.lastPred);
      }
      mathEngine.ingestion.push(digit);
      mathEngine.solver.fit(mathEngine.ingestion.getAll());
      mathEngine.lastPred = mathEngine.generator.predictNext(digit);
    } else if (!mathEngine.lastPred) {
      mathEngine.lastPred = mathEngine.generator.predictNext(digit);
    }
    const nextPred = mathEngine.lastPred;

    const report = mathEngine.evaluator.getReport();
    this.hackerState.mathSummaries[sym] = {
      symbol: sym,
      isDeterministic: mathEngine.solver.isDeterministic,
      lcgParams: mathEngine.solver.lcgParams,
      topPrediction: nextPred.topPrediction,
      confidence: nextPred.confidence,
      top3Predictions: nextPred.top3Predictions,
      probabilities: nextPred.probabilities,
      totalEvaluated: report.totalEvaluated,
      exactAccuracyPct: report.exactMatchAccuracyPct,
      top3AccuracyPct: report.top3MatchAccuracyPct,
      mae: report.meanAbsoluteError,
    };

    const last4 = history.slice(-4);
    const last3 = history.slice(-3);

    if (history.length >= 20 && !this.hackerInFlight) {
      const probs = nextPred ? nextPred.probabilities : Array(10).fill(0.1);
      const pWinOver1 = probs.slice(2, 10).reduce((sum, p) => sum + p, 0);
      const pWinUnder8 = probs.slice(0, 8).reduce((sum, p) => sum + p, 0);

      const layer1Over1Pass = pWinOver1 >= 0.8;
      const layer1Under8Pass = pWinUnder8 >= 0.8;

      const layer2Over1Pass =
        last3.every((d) => d >= 2) && (digit === 2 || digit === 3 || digit === 4);
      const layer2Under8Pass =
        last3.every((d) => d <= 7) && (digit === 7 || digit === 6 || digit === 5);

      const trapCountOver1 = last4.filter((d) => d === 0 || d === 1).length;
      const trapCountUnder8 = last4.filter((d) => d === 8 || d === 9).length;

      const layer3Over1Pass = trapCountOver1 === 0;
      const layer3Under8Pass = trapCountUnder8 === 0;

      const layer4Over1Pass =
        !nextPred || (nextPred.topPrediction !== 0 && nextPred.topPrediction !== 1);
      const layer4Under8Pass =
        !nextPred || (nextPred.topPrediction !== 8 && nextPred.topPrediction !== 9);

      const over1Condition =
        layer1Over1Pass && layer2Over1Pass && layer3Over1Pass && layer4Over1Pass;
      const under8Condition =
        layer1Under8Pass && layer2Under8Pass && layer3Under8Pass && layer4Under8Pass;

      const virtEnabled = this.host.hasVirtualToken() && cfg.virtualMode;
      const runId = this.hackerRunId;

      if (under8Condition || over1Condition) {
        const signalType = over1Condition ? 'OVER 1' : 'UNDER 8';
        const realContractType: 'DIGITOVER' | 'DIGITUNDER' = over1Condition
          ? 'DIGITOVER'
          : 'DIGITUNDER';
        const realBarrier = over1Condition ? 1 : 8;
        const virtualContractType: 'DIGITOVER' | 'DIGITUNDER' = over1Condition
          ? 'DIGITUNDER'
          : 'DIGITOVER';
        const virtualBarrier = over1Condition ? 8 : 1;

        const winProbPct = over1Condition
          ? (pWinOver1 * 100).toFixed(1)
          : (pWinUnder8 * 100).toFixed(1);
        const predDigit = nextPred ? nextPred.topPrediction : 'N/A';
        const predConf = nextPred ? (nextPred.confidence * 100).toFixed(1) : 'N/A';

        this.hackerInFlight = true;
        if (cfg.continuousSameMarket && !this.hackerLockedMarket) {
          this.hackerLockedMarket = sym;
          this.addHackerLog(
            `[SAME MARKET LOCK] Signal confirmed on ${sym}. Locked for continuous same-market trades.`
          );
        }
        this.addHackerLog(
          `[SIGNAL CONFIRMED] ${sym} matched 4-Layer Math Filter -> ${signalType} (L1 P(Win): ${winProbPct}%, L2 Trig: ${digit}, L3 Trap: 0/4, L4 Pred: ${predDigit} @ ${predConf}%)`
        );

        if (
          virtEnabled &&
          (!cfg.continuousSameMarket || !this.hackerTriggeredRealForLocked)
        ) {
          this.addHackerLog(
            `[VIRTUAL SWITCH ACTIVE] Executing Virtual ${virtualContractType} ${virtualBarrier} on ${sym} (Target: ${cfg.virtualLosses} virtual loss(es))...`
          );
          this.emitSnapshot();
          void this.handleHackerVirtualThenReal(runId, {
            sym,
            virtualContractType,
            virtualBarrier,
            realContractType,
            realBarrier,
            targetVirtualLosses: Math.max(1, cfg.virtualLosses || 1),
          });
        } else {
          this.hackerTriggeredRealForLocked = true;
          this.addHackerLog(
            `[EXECUTE REAL TRADE] Purchasing REAL ${realContractType} (Barrier ${realBarrier}) on ${sym} @ $${this.hackerState.currentStake.toFixed(2)}...`
          );
          this.emitSnapshot();
          void this.handleHackerRealTrade(
            runId,
            sym,
            realContractType,
            realBarrier,
            this.hackerState.currentStake
          );
        }
        return;
      } else if (cfg.continuousSameMarket && this.hackerLockedMarket === sym) {
        const isOver = trapCountOver1 === 0 && pWinOver1 >= pWinUnder8;
        const isUnder = trapCountUnder8 === 0 && pWinUnder8 > pWinOver1;
        if (isOver || isUnder) {
          const realContractType: 'DIGITOVER' | 'DIGITUNDER' = isOver
            ? 'DIGITOVER'
            : 'DIGITUNDER';
          const realBarrier = isOver ? 1 : 8;
          const virtualContractType: 'DIGITOVER' | 'DIGITUNDER' = isOver
            ? 'DIGITUNDER'
            : 'DIGITOVER';
          const virtualBarrier = isOver ? 8 : 1;

          this.hackerInFlight = true;
          if (virtEnabled && !this.hackerTriggeredRealForLocked) {
            this.addHackerLog(
              `[CONTINUOUS VIRTUAL SESSION] Taking Virtual ${virtualContractType} ${virtualBarrier} on ${sym}...`
            );
            this.emitSnapshot();
            void this.handleHackerVirtualThenReal(runId, {
              sym,
              virtualContractType,
              virtualBarrier,
              realContractType,
              realBarrier,
              targetVirtualLosses: Math.max(1, cfg.virtualLosses || 1),
            });
          } else {
            this.hackerTriggeredRealForLocked = true;
            this.addHackerLog(
              `[CONTINUOUS REAL TRADE] Purchasing REAL ${realContractType} ${realBarrier} on locked market ${sym} @ $${this.hackerState.currentStake.toFixed(2)}...`
            );
            this.emitSnapshot();
            void this.handleHackerRealTrade(
              runId,
              sym,
              realContractType,
              realBarrier,
              this.hackerState.currentStake
            );
          }
          return;
        }
      }
    }

    this.scheduleHackerUiEmit();
  }

  private async executeHackerTrade(
    sym: string,
    contractType: 'DIGITOVER' | 'DIGITUNDER',
    barrier: number,
    stake: number,
    isVirtual: boolean
  ): Promise<{ won: boolean; profit: number }> {
    const durationTicks = Math.max(1, Math.min(10, this.hackerConfig.durationTicks || 1));
    const effectiveStake = isVirtual ? 0.35 : stake;
    return this.host.executeAutoBotTrade({
      symbol: sym,
      contractType: contractType === 'DIGITUNDER' ? 'digitunder' : 'digitover',
      prediction: barrier,
      stake: effectiveStake,
      duration: durationTicks,
      isVirtual,
      strategyName: isVirtual
        ? `AI Hacker Virtual (${contractType} ${barrier})`
        : `AI Market Hacker (${contractType} ${barrier})`,
    });
  }

  private async handleHackerRealTrade(
    runId: number,
    sym: string,
    contractType: 'DIGITOVER' | 'DIGITUNDER',
    barrier: number,
    stake: number
  ): Promise<void> {
    try {
      const outcome = await this.executeHackerTrade(sym, contractType, barrier, stake, false);
      if (!this.hackerState.running || this.hackerRunId !== runId) return;

      const cfg = this.hackerConfig;
      const baseStake = Math.max(0.35, Number(cfg.stake) || 0.5);
      this.hackerState.sessionProfit = Number(
        (this.hackerState.sessionProfit + outcome.profit).toFixed(2)
      );
      this.hackerState.tradesCount += 1;

      if (outcome.won) {
        this.hackerConsecLosses = 0;
        this.hackerState.currentStake = baseStake;
        this.hackerState.winsCount += 1;

        this.addHackerLog(
          `[RESULT] ${sym} ${contractType} ${barrier} -> WIN +$${outcome.profit.toFixed(2)} (Stake reset to $${baseStake.toFixed(2)})`
        );

        const targetWins = cfg.maxTrades;
        if (targetWins > 0 && this.hackerState.winsCount >= targetWins) {
          this.addHackerLog(
            `[TARGET REACHED] Target of ${targetWins} winning run(s) achieved! (${this.hackerState.winsCount}/${targetWins}) Auto-stopping scanner.`
          );
          this.stopAiHacker('target reached');
          return;
        }
      } else {
        const newLosses = this.hackerConsecLosses + 1;
        this.hackerConsecLosses = newLosses;
        this.hackerState.lossesCount += 1;

        const afterLosses = cfg.martingaleAfterLosses || 1;
        const mult = cfg.martingaleMultiplier;
        if (newLosses >= afterLosses && mult > 1) {
          const steps = newLosses - afterLosses + 1;
          const nextStake = parseFloat((baseStake * Math.pow(mult, steps)).toFixed(2));
          this.hackerState.currentStake = nextStake;
          this.addHackerLog(
            `[RESULT] ${sym} ${contractType} ${barrier} -> LOSS -$${Math.abs(outcome.profit).toFixed(2)} | Loss #${newLosses}: Martingale (${mult}x, Level ${steps}) -> Next Stake: $${nextStake.toFixed(2)}`
          );
        } else {
          this.hackerState.currentStake = baseStake;
          this.addHackerLog(
            `[RESULT] ${sym} ${contractType} ${barrier} -> LOSS -$${Math.abs(outcome.profit).toFixed(2)} | Loss #${newLosses}/${afterLosses} -> Next Stake: $${baseStake.toFixed(2)}`
          );
        }

        if (
          (cfg.continuousSameMarket || cfg.sameMarketRecovery) &&
          this.hackerState.running &&
          this.hackerRunId === runId
        ) {
          const recContract: 'DIGITOVER' | 'DIGITUNDER' = cfg.sameMarketRecovery
            ? cfg.recoveryContract === 'DIGITUNDER'
              ? 'DIGITUNDER'
              : 'DIGITOVER'
            : contractType;
          const recBarrier = recContract === 'DIGITUNDER' ? 8 : 1;
          this.hackerTriggeredRealForLocked = true;
          if (cfg.continuousSameMarket) {
            this.hackerLockedMarket = sym;
          }
          this.addHackerLog(
            `[FAST MARTINGALE RECOVERY] Immediate recovery triggered on ${sym} -> Purchasing REAL ${recContract} ${recBarrier} @ $${this.hackerState.currentStake.toFixed(2)}...`
          );
          this.emitSnapshot();
          await this.handleHackerRealTrade(
            runId,
            sym,
            recContract,
            recBarrier,
            this.hackerState.currentStake
          );
          return;
        }
      }

      const postDelay = this.host.isFastExecution() ? 0 : cfg.continuousSameMarket ? 800 : 1000;
      if (postDelay > 0) {
        this.emitSnapshot();
        await sleep(postDelay);
      }
      if (this.hackerState.running && this.hackerRunId === runId) {
        this.hackerInFlight = false;
        if (cfg.continuousSameMarket && this.hackerLockedMarket) {
          this.addHackerLog(
            `[CONTINUOUS SAME MARKET] Trade on ${this.hackerLockedMarket} completed. Scanner remaining locked on ${this.hackerLockedMarket}...`
          );
        } else {
          this.hackerLockedMarket = null;
          this.addHackerLog('[SCAN] Resuming multi-market scanning across all 10 markets...');
        }
        this.emitSnapshot();
        if (this.host.isFastExecution()) {
          queueMicrotask(() => {
            if (!this.hackerState.running || this.hackerInFlight || this.hackerRunId !== runId) return;
            const targets =
              cfg.continuousSameMarket && this.hackerLockedMarket
                ? [this.hackerLockedMarket]
                : VOLATILITY_10_MARKETS;
            for (const targetSym of targets) {
              if (this.hackerInFlight || !this.hackerState.running) break;
              const dHist = this.digitHistories.get(targetSym);
              if (dHist && dHist.length >= 20) {
                this.onHackerTick(targetSym, dHist[dHist.length - 1], dHist, true);
              }
            }
          });
        }
      }
    } catch (err: any) {
      this.addHackerLog(`[ERROR] Trade execution failed: ${err?.message || err}`);
      this.hackerState.errorMsg = err?.message || 'Trade execution failed.';
      this.hackerInFlight = false;
      this.emitSnapshot();
    }
  }

  private async handleHackerVirtualThenReal(
    runId: number,
    params: {
      sym: string;
      virtualContractType: 'DIGITOVER' | 'DIGITUNDER';
      virtualBarrier: number;
      realContractType: 'DIGITOVER' | 'DIGITUNDER';
      realBarrier: number;
      targetVirtualLosses: number;
    }
  ): Promise<void> {
    try {
      while (this.hackerState.running && this.hackerRunId === runId) {
        const outcome = await this.executeHackerTrade(
          params.sym,
          params.virtualContractType,
          params.virtualBarrier,
          0.35,
          true
        );
        if (!this.hackerState.running || this.hackerRunId !== runId) return;

        if (outcome.won) {
          this.hackerConsecVirtualLosses = 0;
          this.hackerState.virtualStats.wins += 1;
          this.addHackerLog(
            `[VIRTUAL WIN @ $0.35] ${params.sym} (${params.virtualContractType} ${params.virtualBarrier}) -> VIRTUAL WIN +$${outcome.profit.toFixed(2)} | Consecutive Virtual Losses reset to 0/${params.targetVirtualLosses}`
          );

          if (this.host.hasVirtualToken() && this.hackerConfig.autoRestartWin) {
            this.addHackerLog(
              '[AUTO-RESTART ON VIRTUAL WIN] Opposite virtual trade was a WIN! Restarting scanner for a virtual LOSS...'
            );
            this.hackerInFlight = false;
            this.stopAiHacker('auto-restart on virtual win');
            if (!this.host.isFastExecution()) {
              await sleep(500);
            }
            this.startAiHacker(this.hackerConfig);
            return;
          }
          this.emitSnapshot();
        } else {
          const nextLosses = this.hackerConsecVirtualLosses + 1;
          this.hackerConsecVirtualLosses = nextLosses;
          this.hackerState.virtualStats.losses += 1;
          this.addHackerLog(
            `[VIRTUAL LOSS] ${params.sym} (${params.virtualContractType} ${params.virtualBarrier}) -> VIRTUAL LOSS #${nextLosses}/${params.targetVirtualLosses}`
          );

          if (nextLosses >= params.targetVirtualLosses) {
            this.addHackerLog(
              `[VIRTUAL THRESHOLD MET] Reached ${params.targetVirtualLosses} virtual loss(es)! Placing REAL ${params.realContractType} ${params.realBarrier} on ${params.sym} @ $${this.hackerState.currentStake.toFixed(2)}...`
            );
            this.hackerConsecVirtualLosses = 0;
            this.hackerTriggeredRealForLocked = true;
            this.emitSnapshot();
            await this.handleHackerRealTrade(
              runId,
              params.sym,
              params.realContractType,
              params.realBarrier,
              this.hackerState.currentStake
            );
            return;
          }
          this.emitSnapshot();
        }
      }
    } catch (err: any) {
      this.addHackerLog(`[ERROR] Virtual execution failed: ${err?.message || err}`);
      this.hackerState.errorMsg = err?.message || 'Virtual execution failed.';
      this.hackerInFlight = false;
      this.emitSnapshot();
    }
  }
}
