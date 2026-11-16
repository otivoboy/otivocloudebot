import {
  calculateADX,
  calculateAIVolatilityProbability,
  calculateATR,
  calculateBollingerBands,
  calculateDonchian,
  calculateEMA,
  calculateKeltner,
  calculateRSI,
  calculateTickStats,
  computeAccuNoiseSignal,
  computeAccumulatorSignal,
} from './autobotSignals.ts';
import type { AccuNoiseSignal } from '../types/autobot.ts';

export interface AutoBotMarketConfig {
  symbol: string;
  name: string;
  shortName: string;
  decimals: number;
}

export const AUTOBOT_MARKET_CONFIGS: AutoBotMarketConfig[] = [
  { symbol: '1HZ10V', name: 'Vol 10 (1s) Index', shortName: '1HZ10V', decimals: 2 },
  { symbol: '1HZ15V', name: 'Vol 15 (1s) Index', shortName: '1HZ15V', decimals: 3 },
  { symbol: '1HZ25V', name: 'Vol 25 (1s) Index', shortName: '1HZ25V', decimals: 2 },
  { symbol: '1HZ30V', name: 'Vol 30 (1s) Index', shortName: '1HZ30V', decimals: 3 },
  { symbol: '1HZ50V', name: 'Vol 50 (1s) Index', shortName: '1HZ50V', decimals: 2 },
  { symbol: '1HZ75V', name: 'Vol 75 (1s) Index', shortName: '1HZ75V', decimals: 2 },
  { symbol: '1HZ90V', name: 'Vol 90 (1s) Index', shortName: '1HZ90V', decimals: 3 },
  { symbol: '1HZ100V', name: 'Vol 100 (1s) Index', shortName: '1HZ100V', decimals: 2 },
  { symbol: 'R_10', name: 'Vol 10 Index', shortName: 'R_10', decimals: 3 },
  { symbol: 'R_25', name: 'Vol 25 Index', shortName: 'R_25', decimals: 3 },
  { symbol: 'R_50', name: 'Vol 50 Index', shortName: 'R_50', decimals: 4 },
  { symbol: 'R_75', name: 'Vol 75 Index', shortName: 'R_75', decimals: 4 },
  { symbol: 'R_100', name: 'Vol 100 Index', shortName: 'R_100', decimals: 2 },
  { symbol: 'JD10', name: 'Jump 10 Index', shortName: 'JD10', decimals: 2 },
  { symbol: 'JD25', name: 'Jump 25 Index', shortName: 'JD25', decimals: 2 },
  { symbol: 'JD50', name: 'Jump 50 Index', shortName: 'JD50', decimals: 2 },
  { symbol: 'JD100', name: 'Jump 100 Index', shortName: 'JD100', decimals: 2 },
  { symbol: 'RDBULL', name: 'Bull Market Index', shortName: 'Bull Market', decimals: 4 },
  { symbol: 'RDBEAR', name: 'Bear Market Index', shortName: 'Bear Market', decimals: 4 },
];

export const ALL_AUTOBOT_SYMBOLS = AUTOBOT_MARKET_CONFIGS.map((m) => m.symbol);

export function formatTimeToAMPM(timeStr: string): { time12: string; ampm: string } {
  if (!timeStr) return { time12: '12:00:00', ampm: 'AM' };
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return { time12: timeStr, ampm: '' };

  let hours = parseInt(parts[0], 10);
  if (isNaN(hours)) hours = 0;
  const minutes = parts[1] || '00';
  const seconds = parts[2] !== undefined ? parts[2] : null;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;

  const hoursStr = String(hours12).padStart(2, '0');
  const time12 = seconds !== null ? `${hoursStr}:${minutes}:${seconds}` : `${hoursStr}:${minutes}`;
  return { time12, ampm };
}

export interface AXASignal {
  prediction: number;
  confidence: number;
  pattern: string;
  symbol: string;
}

export interface AXAMetrics {
  pattern: string;
  targetDigit: number;
  cluster: number[];
}

export function computeAXASignal(
  history: number[],
  symbol: string
): { signal: AXASignal | null; metrics: AXAMetrics } {
  if (history.length < 3) {
    return {
      signal: null,
      metrics: {
        pattern: `Scanning (${history.length}/3 Ticks)...`,
        targetDigit: -1,
        cluster: [],
      },
    };
  }

  const d1 = history[history.length - 3];
  const d2 = history[history.length - 2];
  const d3 = history[history.length - 1];
  const isValidPattern = d1 === d3 && d1 !== d2;
  const patternStr = `${d1}-${d2}-${d3}`;

  const metrics: AXAMetrics = {
    pattern: patternStr,
    targetDigit: isValidPattern ? d2 : -1,
    cluster: [d1, d2, d3],
  };

  let signal: AXASignal | null = null;
  if (isValidPattern) {
    signal = {
      prediction: d2,
      confidence: 100,
      pattern: patternStr,
      symbol,
    };
  }

  return { signal, metrics };
}

export const evaluatePriceDigitsSignal = (
  price: number,
  decimals: number,
  inputStr: string
): { matched: boolean; target: string | null; priceStr: string } => {
  if (!price || price <= 0 || !inputStr) {
    return { matched: false, target: null, priceStr: price ? price.toFixed(decimals) : '0' };
  }

  const formattedPrice = price.toFixed(decimals);
  const rawPriceStr = price.toString();
  const dotIndex = formattedPrice.indexOf('.');
  const decimalPart = dotIndex !== -1 ? formattedPrice.slice(dotIndex + 1) : '';

  const targets = inputStr
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const target of targets) {
    if (!target) continue;
    const cleanTarget = target.startsWith('.') ? target.slice(1) : target;
    const dotTarget = target.startsWith('.') ? target : '.' + target;
    if (!cleanTarget) continue;

    const matches =
      formattedPrice.endsWith(dotTarget) ||
      rawPriceStr.endsWith(dotTarget) ||
      (decimalPart && decimalPart.endsWith(cleanTarget)) ||
      formattedPrice.endsWith(cleanTarget);

    if (matches) {
      return {
        matched: true,
        target: target.startsWith('.') ? target : '.' + target,
        priceStr: formattedPrice,
      };
    }
  }

  return { matched: false, target: null, priceStr: formattedPrice };
};

export interface OverUnderScannerSignal {
  type: 'digitover' | 'digitunder';
  barrier: number;
  prediction: number;
  label: string;
  currentDigit: number;
  freqs: number[];
  over1LossZone: number;
  under8LossZone: number;
  isOver1Cold: boolean;
  isUnder8Cold: boolean;
}

export function computeOverUnderScannerSignal(
  history: number[],
  samplePeriod = 100,
  coldThresholdMax = 22.0,
  _singleDigitMax = 12.0
): {
  signal: OverUnderScannerSignal | null;
  metrics: {
    freqs: number[];
    over1LossZone: number;
    under8LossZone: number;
    isOver1Cold: boolean;
    isUnder8Cold: boolean;
    sampleCount: number;
  };
} {
  const defaultMetrics = {
    freqs: new Array(10).fill(0),
    over1LossZone: 0,
    under8LossZone: 0,
    isOver1Cold: false,
    isUnder8Cold: false,
    sampleCount: history ? history.length : 0,
  };

  if (!history || history.length === 0) {
    return { signal: null, metrics: defaultMetrics };
  }

  const slice = history.slice(-samplePeriod);
  const len = slice.length;
  const counts = new Array(10).fill(0);
  slice.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });

  const freqs = counts.map((c) => (c / len) * 100);
  const over1LossZone = freqs[0] + freqs[1];
  const under8LossZone = freqs[8] + freqs[9];
  const currentDigit = history[history.length - 1];

  const isOver1Cold = over1LossZone <= coldThresholdMax || currentDigit === 0 || currentDigit === 1;
  const isUnder8Cold = under8LossZone <= coldThresholdMax || currentDigit === 8 || currentDigit === 9;

  let signal: OverUnderScannerSignal | null = null;

  if (
    isOver1Cold &&
    (currentDigit === 0 || currentDigit === 1 || over1LossZone <= coldThresholdMax * 0.8)
  ) {
    signal = {
      type: 'digitover',
      barrier: 1,
      prediction: 1,
      label: 'BUY OVER 1',
      currentDigit,
      freqs,
      over1LossZone,
      under8LossZone,
      isOver1Cold,
      isUnder8Cold,
    };
  } else if (
    isUnder8Cold &&
    (currentDigit === 8 || currentDigit === 9 || under8LossZone <= coldThresholdMax * 0.8)
  ) {
    signal = {
      type: 'digitunder',
      barrier: 8,
      prediction: 8,
      label: 'BUY UNDER 8',
      currentDigit,
      freqs,
      over1LossZone,
      under8LossZone,
      isOver1Cold,
      isUnder8Cold,
    };
  }

  return {
    signal,
    metrics: {
      freqs,
      over1LossZone,
      under8LossZone,
      isOver1Cold,
      isUnder8Cold,
      sampleCount: len,
    },
  };
}

export interface EDMSSignal {
  type: 'digitover' | 'digitunder';
  barrier: number;
  prediction: number;
  label: string;
  sOver: number;
  sUnder: number;
  ssOver: number;
  ssUnder: number;
  metrics: {
    V: number;
    P: number;
    M: number;
    VOL: number;
    T: number;
  };
}

export function computeEDMSSignal(
  prices: number[],
  history: number[]
): {
  signal: EDMSSignal | null;
  metrics: {
    V: number;
    P: number;
    M: number;
    VOL: number;
    T: number;
    sOver: number;
    sUnder: number;
    ssOver: number;
    ssUnder: number;
  };
} {
  const defaultMetrics = {
    V: 1.0,
    P: 0.5,
    M: 0.5,
    VOL: 1.0,
    T: 0,
    sOver: 0,
    sUnder: 0,
    ssOver: 0,
    ssUnder: 0,
  };

  if (!prices || prices.length < 5) {
    return { signal: null, metrics: defaultMetrics };
  }

  const C = prices[prices.length - 1];
  const atrData = calculateATR(prices, Math.min(14, prices.length - 1));
  const atrCurrent = atrData.current || 0.00001;
  const atrSMA20 = atrData.average || 0.00001;
  const V = atrSMA20 > 0 ? atrCurrent / atrSMA20 : 1.0;

  const bb = calculateBollingerBands(prices, Math.min(prices.length, 20), 2);
  const bbWidth = bb.upper - bb.lower;
  const P = bbWidth > 0 ? (C - bb.lower) / bbWidth : 0.5;

  const rsi14 = calculateRSI(prices, Math.min(14, prices.length - 1));
  const rsiHistory: number[] = [];
  const lookback = Math.min(10, prices.length - 5);
  for (let i = 0; i < lookback; i++) {
    const sliceLen = prices.length - i;
    if (sliceLen >= 5) {
      rsiHistory.push(calculateRSI(prices.slice(0, sliceLen), Math.min(14, sliceLen - 1)));
    }
  }
  const minRsi = rsiHistory.length > 0 ? Math.min(...rsiHistory) : rsi14;
  const maxRsi = rsiHistory.length > 0 ? Math.max(...rsiHistory) : rsi14;
  const stochRsi = maxRsi - minRsi > 0 ? ((rsi14 - minRsi) / (maxRsi - minRsi)) * 100 : 50;
  const M = stochRsi / 100;

  const volumes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    volumes.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const volCurrent = volumes.length > 0 ? volumes[volumes.length - 1] : 0.001;
  const volSlice20 = volumes.slice(-20);
  const volSMA20 =
    volSlice20.length > 0 ? volSlice20.reduce((a, b) => a + b, 0) / volSlice20.length : 0.001;
  const VOL = volSMA20 > 0 ? volCurrent / volSMA20 : 1.0;

  const ema5Arr = calculateEMA(prices, Math.min(prices.length, 5));
  const ema20Arr = calculateEMA(prices, Math.min(prices.length, 20));
  const ema5 = ema5Arr[ema5Arr.length - 1] || C;
  const ema20 = ema20Arr[ema20Arr.length - 1] || C;
  const T = atrCurrent > 0 ? (ema5 - ema20) / atrCurrent : 0;

  const Dlast = history && history.length > 0 ? history[history.length - 1] : -1;

  const condOverD = Dlast === 0 || Dlast === 1 || Dlast === 2 || Dlast === 3;
  const condOverP = P <= 0.5;
  const condOverM = M <= 0.55;
  const condOverVOL = VOL >= 0.7;
  const condOverV = V >= 0.7;
  const condOverT = T <= 0.6;

  const scoreOver =
    (condOverD ? 1 : 0) +
    (condOverP ? 1 : 0) +
    (condOverM ? 1 : 0) +
    (condOverVOL ? 1 : 0) +
    (condOverV ? 1 : 0) +
    (condOverT ? 1 : 0);
  const sOver = (condOverD && scoreOver >= 2) || (!condOverD && scoreOver >= 4) ? 1 : 0;

  const condUnderD = Dlast === 8 || Dlast === 9 || Dlast === 7 || Dlast === 6;
  const condUnderP = P >= 0.5;
  const condUnderM = M >= 0.45;
  const condUnderVOL = VOL >= 0.7;
  const condUnderV = V >= 0.7;
  const condUnderT = T >= -0.6;

  const scoreUnder =
    (condUnderD ? 1 : 0) +
    (condUnderP ? 1 : 0) +
    (condUnderM ? 1 : 0) +
    (condUnderVOL ? 1 : 0) +
    (condUnderV ? 1 : 0) +
    (condUnderT ? 1 : 0);
  const sUnder = (condUnderD && scoreUnder >= 2) || (!condUnderD && scoreUnder >= 4) ? 1 : 0;

  const ssOverRaw = (V - 0.8 + (0.4 - P) + (0.5 - M) + (VOL - 0.8) + (0.5 - T)) / 5;
  const ssUnderRaw = (V - 0.8 + (P - 0.6) + (M - 0.5) + (VOL - 0.8) + (T + 0.5)) / 5;

  const ssOver = Math.round(Math.max(0, ssOverRaw) * 1000) / 1000;
  const ssUnder = Math.round(Math.max(0, ssUnderRaw) * 1000) / 1000;

  const metrics = {
    V: Math.round(V * 100) / 100,
    P: Math.round(P * 1000) / 1000,
    M: Math.round(M * 1000) / 1000,
    VOL: Math.round(VOL * 100) / 100,
    T: Math.round(T * 10000) / 10000,
    sOver,
    sUnder,
    ssOver,
    ssUnder,
  };

  let signal: EDMSSignal | null = null;
  if (sOver === 1) {
    signal = {
      type: 'digitover',
      barrier: 1,
      prediction: 1,
      label: 'EDMS OVER 1 SIGNAL',
      sOver,
      sUnder,
      ssOver: metrics.ssOver,
      ssUnder: metrics.ssUnder,
      metrics: { V: metrics.V, P: metrics.P, M: metrics.M, VOL: metrics.VOL, T: metrics.T },
    };
  } else if (sUnder === 1) {
    signal = {
      type: 'digitunder',
      barrier: 8,
      prediction: 8,
      label: 'EDMS UNDER 8 SIGNAL',
      sOver,
      sUnder,
      ssOver: metrics.ssOver,
      ssUnder: metrics.ssUnder,
      metrics: { V: metrics.V, P: metrics.P, M: metrics.M, VOL: metrics.VOL, T: metrics.T },
    };
  }

  return { signal, metrics };
}

export interface LADPrngSignal {
  prediction: number;
  patternStr: string;
  occurrences: number;
  missingDigits: number[];
  followerWindow: number;
  reason: string;
  symbol: string;
}

export function computeLADPrngSignal(
  history: number[],
  symbol: string,
  _prices: number[],
  patternLen: number = 3,
  minOccurrences: number = 3,
  followerWindow: number = 2
): LADPrngSignal | null {
  if (history.length < patternLen + followerWindow + 10) return null;

  const currentPattern = history.slice(-patternLen);
  const followerDigitsSeen = new Set<number>();
  let occurrences = 0;

  const maxScanIdx = history.length - patternLen - followerWindow;
  for (let i = 0; i <= maxScanIdx; i++) {
    let match = true;
    for (let j = 0; j < patternLen; j++) {
      if (history[i + j] !== currentPattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      occurrences++;
      for (let f = 0; f < followerWindow; f++) {
        const followerDigit = history[i + patternLen + f];
        if (followerDigit >= 0 && followerDigit <= 9) {
          followerDigitsSeen.add(followerDigit);
        }
      }
    }
  }

  if (occurrences < minOccurrences) return null;

  const missingDigits: number[] = [];
  for (let d = 0; d <= 9; d++) {
    if (!followerDigitsSeen.has(d)) missingDigits.push(d);
  }
  if (missingDigits.length === 0) return null;

  const recent50 = history.slice(-50);
  missingDigits.sort((a, b) => {
    const countA = recent50.filter((x) => x === a).length;
    const countB = recent50.filter((x) => x === b).length;
    if (countA !== countB) return countA - countB;
    return a - b;
  });

  const prediction = missingDigits[0];
  const patternFormatted = currentPattern.join('-');

  return {
    prediction,
    patternStr: patternFormatted,
    occurrences,
    missingDigits,
    followerWindow,
    reason: `Pattern [${patternFormatted}] appeared ${occurrences} times. Digit ${prediction} NEVER appeared in the ${followerWindow}-digit follower window.`,
    symbol,
  };
}

export interface AILearnerSignal {
  prediction: number;
  probability: number;
  confidence: number;
  occurrences: number;
  sequence: string;
  counts: number[];
}

export interface AIPatternData {
  sequence: string;
  occurrences: number;
  minDigit: number;
  minDigitProb: number;
}

export function computeAILearnerSignal(history: number[]): {
  signal: AILearnerSignal | null;
  activePatterns: AIPatternData[];
} {
  const activePatterns: AIPatternData[] = [];
  let finalSignal: AILearnerSignal | null = null;
  if (history.length < 50) return { signal: null, activePatterns: [] };

  for (const len of [3, 2, 1]) {
    if (history.length < len + 5) continue;
    const currentSeq = history.slice(-len);
    const counts = new Array(10).fill(0);
    let totalOccurrences = 0;

    for (let i = 0; i <= history.length - len - 1; i++) {
      let match = true;
      for (let j = 0; j < len; j++) {
        if (history[i + j] !== currentSeq[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        const nextD = history[i + len];
        if (nextD >= 0 && nextD <= 9) {
          counts[nextD]++;
          totalOccurrences++;
        }
      }
    }

    if (totalOccurrences > 0) {
      let minDigit = 0;
      let minCount = Infinity;
      for (let d = 0; d <= 9; d++) {
        if (counts[d] < minCount) {
          minCount = counts[d];
          minDigit = d;
        }
      }
      const minDigitProb = (minCount / totalOccurrences) * 100;
      activePatterns.push({
        sequence: currentSeq.join(' -> '),
        occurrences: totalOccurrences,
        minDigit,
        minDigitProb: Math.round(minDigitProb * 10) / 10,
      });

      const confidenceRange = 100 - minDigitProb;
      if (!finalSignal && totalOccurrences >= 5 && minDigitProb < 10 && confidenceRange > 80) {
        finalSignal = {
          prediction: minDigit,
          probability: Math.round(minDigitProb * 10) / 10,
          confidence: Math.round(confidenceRange),
          occurrences: totalOccurrences,
          sequence: currentSeq.join(' -> '),
          counts,
        };
      }
    }
  }

  return { signal: finalSignal, activePatterns };
}

export interface AccumulatorMetricsSummary {
  rsiValue: number;
  ema20: number;
  ema50: number;
  aiProb: number;
  accuNoise: AccuNoiseSignal;
  satisfied: Record<string, boolean>;
}

export function computeAccumulatorMetrics(
  symbolPrices: number[],
  history: number[],
  symbol: string
): AccumulatorMetricsSummary | null {
  if (symbolPrices.length < 25) return null;

  const rsiValue = calculateRSI(symbolPrices, 14);
  const ema20 = calculateEMA(symbolPrices, 20);
  const ema50 = calculateEMA(symbolPrices, 50);
  const bb = calculateBollingerBands(symbolPrices, 20, 2);
  const atrData = calculateATR(symbolPrices, 14);
  const adxData = calculateADX(symbolPrices, 14);
  const tickStats = calculateTickStats(symbolPrices, 20);
  const donchian = calculateDonchian(symbolPrices, 20);
  const keltner = calculateKeltner(symbolPrices, 20);
  const aiProb = calculateAIVolatilityProbability(symbolPrices);

  const satisfied: Record<string, boolean> = {};

  if (symbolPrices.length >= 55) {
    const ema20Diff = Math.abs(ema20[ema20.length - 1] - ema20[ema20.length - 3]);
    const ema50Diff = Math.abs(ema50[ema50.length - 1] - ema50[ema50.length - 3]);
    const isEma20Flat = ema20Diff < ema20[ema20.length - 1] * 0.0001;
    const isEma50Flat = ema50Diff < ema50[ema50.length - 1] * 0.0001;
    const isRsiInRegion = rsiValue >= 45 && rsiValue <= 55;
    const recentChanges = symbolPrices
      .slice(-5)
      .map((p, idx, arr) => (idx > 0 ? Math.abs(p - arr[idx - 1]) : 0))
      .slice(1);
    const avgRecentChange =
      recentChanges.reduce((a, b) => a + b, 0) / Math.max(1, recentChanges.length);
    const historicalChanges = symbolPrices
      .slice(-25)
      .map((p, idx, arr) => (idx > 0 ? Math.abs(p - arr[idx - 1]) : 0))
      .slice(1);
    const avgHistoricalChange =
      historicalChanges.reduce((a, b) => a + b, 0) / Math.max(1, historicalChanges.length);
    satisfied['trend_exhaustion'] =
      isEma20Flat && isEma50Flat && isRsiInRegion && avgRecentChange < avgHistoricalChange;
  } else {
    satisfied['trend_exhaustion'] = false;
  }

  const historicalStdDevs: number[] = [];
  for (let i = symbolPrices.length - 40; i <= symbolPrices.length - 20; i++) {
    if (i >= 20) {
      historicalStdDevs.push(calculateBollingerBands(symbolPrices.slice(0, i), 20, 2).stdDev);
    }
  }
  const avgHistStdDev =
    historicalStdDevs.reduce((a, b) => a + b, 0) / (historicalStdDevs.length || 1);
  const isNarrow = bb.stdDev < avgHistStdDev * 0.95;
  const channelWidth = bb.upper - bb.lower;
  const isNearMiddle =
    channelWidth > 0 &&
    Math.abs(symbolPrices[symbolPrices.length - 1] - bb.middle) < channelWidth * 0.15;
  const noBreakout = symbolPrices.slice(-5).every((p) => p >= bb.lower && p <= bb.upper);
  satisfied['bb_squeeze'] = isNarrow && isNearMiddle && noBreakout;

  const prevAtr = calculateATR(symbolPrices.slice(0, -1), 14).current;
  satisfied['atr_volatility'] =
    atrData.current < atrData.average && atrData.current <= prevAtr * 1.01;

  satisfied['adx_range'] =
    adxData.adx < 25 && Math.abs(adxData.plusDI - adxData.minusDI) < 20;

  satisfied['tick_speed'] =
    tickStats.speed < (tickStats.speed + tickStats.acceleration) * 0.6 &&
    tickStats.stdDev < tickStats.avgStdDev;

  if (symbolPrices.length >= 55) {
    const currentEma20 = ema20[ema20.length - 1];
    const currentEma50 = ema50[ema50.length - 1];
    const separation = Math.abs(currentEma20 - currentEma50) / Math.max(1e-9, currentEma50);
    const isDistanceSmall = separation < 0.0005;
    const ema20Slope =
      Math.abs(ema20[ema20.length - 1] - ema20[ema20.length - 5]) /
      Math.max(1e-9, currentEma20);
    const isHorizontal = ema20Slope < 0.0002;
    const last10 = symbolPrices.slice(-10);
    let crossings = 0;
    for (let i = 1; i < last10.length; i++) {
      const p1 = last10[i - 1];
      const p2 = last10[i];
      if ((p1 > currentEma20 && p2 < currentEma20) || (p1 < currentEma20 && p2 > currentEma20)) {
        crossings++;
      }
    }
    satisfied['ma_flatness'] = isDistanceSmall && isHorizontal && crossings >= 1;
  } else {
    satisfied['ma_flatness'] = false;
  }

  const currentPrice = symbolPrices[symbolPrices.length - 1];
  const range = donchian.upper - donchian.lower;
  if (range === 0) {
    satisfied['donchian_range'] = true;
  } else {
    const isNotExtreme =
      currentPrice > donchian.lower + range * 0.1 && currentPrice < donchian.upper - range * 0.1;
    const isNearCenter = Math.abs(currentPrice - donchian.center) < range * 0.3;
    satisfied['donchian_range'] = isNotExtreme && isNearCenter;
  }

  const distFromCenter = Math.abs(currentPrice - keltner.center);
  const channelHeight = keltner.upper - keltner.lower;
  satisfied['keltner_stability'] =
    channelHeight === 0 ? true : distFromCenter < channelHeight * 0.2;

  satisfied['std_dev'] = tickStats.stdDev < tickStats.avgStdDev;
  satisfied['ai_volatility'] = aiProb >= 80;

  const accuNoiseSignal = computeAccuNoiseSignal(symbolPrices, symbol);
  satisfied['accu_noise'] = accuNoiseSignal.signal === 'BUY_ACCU';

  const toolAccu = computeAccumulatorSignal(symbolPrices, history, symbol);
  satisfied['analysis_tool'] = toolAccu.isNeutral5050 || toolAccu.action === 'BUY_ACCU';

  return {
    rsiValue,
    ema20: ema20[ema20.length - 1],
    ema50: ema50[ema50.length - 1],
    aiProb,
    accuNoise: accuNoiseSignal,
    satisfied,
  };
}
