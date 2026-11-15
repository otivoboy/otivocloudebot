import type { AccuNoiseSignal, DiffersCalmNoiseMetrics, DiffersCalmNoiseSignal } from '../types/autobot';

export function calculateEMA(prices: number[], period: number): number[] {
  if (!prices || prices.length === 0) return [];
  const k = 2 / (Math.max(1, period) + 1);
  const emaArray: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    emaArray.push(prices[i] * k + emaArray[i - 1] * (1 - k));
  }
  return emaArray;
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (!prices || prices.length < 2) return 50;
  const effectivePeriod = Math.min(period, prices.length - 1);
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - effectivePeriod; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / effectivePeriod;
  const avgLoss = losses / effectivePeriod;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  mult: number = 2
): { upper: number; middle: number; lower: number; stdDev: number } {
  if (!prices || prices.length === 0) {
    return { upper: 0, middle: 0, lower: 0, stdDev: 0 };
  }
  const slice = prices.slice(-Math.min(period, prices.length));
  const middle = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / slice.length;
  const stdDev = Math.sqrt(variance);
  return {
    upper: middle + mult * stdDev,
    middle,
    lower: middle - mult * stdDev,
    stdDev,
  };
}

export function calculateATR(
  prices: number[],
  period: number = 14
): { current: number; average: number } {
  if (!prices || prices.length < 2) return { current: 0.001, average: 0.001 };
  const trs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    trs.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const slice = trs.slice(-Math.max(1, period));
  const current = slice.reduce((a, b) => a + b, 0) / slice.length;
  const avgSlice = trs.slice(-20);
  const average = avgSlice.reduce((a, b) => a + b, 0) / Math.max(1, avgSlice.length);
  return { current, average };
}

export function calculateADX(
  prices: number[],
  period: number = 14
): { adx: number; plusDI: number; minusDI: number } {
  if (!prices || prices.length < 4) return { adx: 20, plusDI: 25, minusDI: 25 };
  const slice = prices.slice(-Math.max(4, period + 1));
  let plusSum = 0;
  let minusSum = 0;
  let trSum = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    const absDiff = Math.abs(diff);
    trSum += absDiff;
    if (diff > 0) plusSum += diff;
    else minusSum -= diff;
  }
  if (trSum === 0) return { adx: 10, plusDI: 0, minusDI: 0 };
  const plusDI = (plusSum / trSum) * 100;
  const minusDI = (minusSum / trSum) * 100;
  const sumDI = plusDI + minusDI;
  const dx = sumDI > 0 ? (Math.abs(plusDI - minusDI) / sumDI) * 100 : 0;
  return {
    adx: dx,
    plusDI,
    minusDI,
  };
}

export function calculateTickStats(
  prices: number[],
  period: number = 20
): { speed: number; acceleration: number; stdDev: number; avgStdDev: number } {
  if (!prices || prices.length < 4) {
    return { speed: 0, acceleration: 0, stdDev: 0, avgStdDev: 0 };
  }
  const diffs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    diffs.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const recentDiffs = diffs.slice(-period);
  const speed = recentDiffs.reduce((a, b) => a + b, 0) / Math.max(1, recentDiffs.length);
  const lastDiff = diffs[diffs.length - 1] || 0;
  const prevDiff = diffs[diffs.length - 2] || 0;
  const acceleration = Math.abs(lastDiff - prevDiff);

  const mean = speed;
  const variance =
    recentDiffs.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, recentDiffs.length);
  const stdDev = Math.sqrt(variance);

  const fullMean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  const fullVariance =
    diffs.reduce((acc, v) => acc + Math.pow(v - fullMean, 2), 0) / Math.max(1, diffs.length);
  const avgStdDev = Math.sqrt(fullVariance);

  return { speed, acceleration, stdDev, avgStdDev };
}

export function calculateDonchian(
  prices: number[],
  period: number = 20
): { upper: number; lower: number; center: number } {
  if (!prices || prices.length === 0) return { upper: 0, lower: 0, center: 0 };
  const slice = prices.slice(-period);
  const upper = Math.max(...slice);
  const lower = Math.min(...slice);
  return { upper, lower, center: (upper + lower) / 2 };
}

export function calculateKeltner(
  prices: number[],
  period: number = 20
): { upper: number; lower: number; center: number } {
  if (!prices || prices.length === 0) return { upper: 0, lower: 0, center: 0 };
  const ema = calculateEMA(prices, period);
  const center = ema[ema.length - 1] || prices[prices.length - 1];
  const atr = calculateATR(prices, Math.min(14, period)).current;
  return {
    upper: center + 2 * atr,
    lower: center - 2 * atr,
    center,
  };
}

export function calculateAIVolatilityProbability(prices: number[]): number {
  if (!prices || prices.length < 10) return 50;
  const stats = calculateTickStats(prices, 20);
  const bb = calculateBollingerBands(prices, 20, 2);
  const ratio = stats.avgStdDev > 0 ? stats.stdDev / stats.avgStdDev : 1;
  const channelNorm = bb.middle > 0 ? (bb.upper - bb.lower) / bb.middle : 0.01;
  const calmFactor = Math.max(0, Math.min(1, 1.35 - ratio * 0.5 - channelNorm * 12));
  return Math.round(calmFactor * 100);
}

export function computeAccuNoiseSignal(prices: number[], _symbol: string): AccuNoiseSignal {
  if (!prices || prices.length < 15) {
    return {
      signal: 'WAIT',
      reason: 'Insufficient tick history for noise analysis',
      metrics: { noiseScore: 50, choppiness: 50, variance: 0, calmStreak: 0 },
    };
  }
  const recent = prices.slice(-20);
  const diffs: number[] = [];
  let reversals = 0;
  for (let i = 1; i < recent.length; i++) {
    diffs.push(Math.abs(recent[i] - recent[i - 1]));
    if (i >= 2) {
      const prevDir = recent[i - 1] - recent[i - 2];
      const curDir = recent[i] - recent[i - 1];
      if ((prevDir > 0 && curDir < 0) || (prevDir < 0 && curDir > 0)) {
        reversals++;
      }
    }
  }
  const avgMove = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  const varMove =
    diffs.reduce((s, d) => s + Math.pow(d - avgMove, 2), 0) / Math.max(1, diffs.length);
  const stdMove = Math.sqrt(varMove);
  const spikeRatio = avgMove > 0 ? (diffs[diffs.length - 1] || 0) / avgMove : 1;
  const choppiness = Math.round((reversals / Math.max(1, recent.length - 2)) * 100);
  const noiseScore = Math.max(
    0,
    Math.min(100, Math.round(spikeRatio * 28 + (avgMove > 0 ? (stdMove / avgMove) * 20 : 10) - reversals * 1.5))
  );

  let calmStreak = 0;
  for (let i = diffs.length - 1; i >= 0; i--) {
    if (diffs[i] <= avgMove * 1.25) calmStreak++;
    else break;
  }

  const isBuy = noiseScore <= 42 && calmStreak >= 3;
  return {
    signal: isBuy ? 'BUY_ACCU' : 'WAIT',
    reason: isBuy
      ? `Calm variance detected (Noise ${noiseScore}/100, Calm Streak ${calmStreak})`
      : `Elevated tick variance (Noise ${noiseScore}/100)`,
    metrics: {
      noiseScore,
      choppiness,
      variance: Math.round(varMove * 10000) / 10000,
      calmStreak,
    },
  };
}

export function computeDiffersCalmNoiseSignal(
  history: number[],
  prices: number[],
  symbol: string,
  options?: { maxNoiseScore?: number; minCalmTicks?: number }
): {
  signal: DiffersCalmNoiseSignal | null;
  metrics: DiffersCalmNoiseMetrics;
} {
  const maxNoiseScore = options?.maxNoiseScore ?? 35;
  const minCalmTicks = options?.minCalmTicks ?? 3;

  const recentDigits = history.slice(-60);
  const counts = new Array(10).fill(0);
  recentDigits.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });

  const lastIdxMap = new Array(10).fill(-1);
  recentDigits.forEach((d, idx) => {
    if (d >= 0 && d <= 9) lastIdxMap[d] = idx;
  });

  const digitStats = Array.from({ length: 10 }, (_, d) => {
    const count = counts[d];
    const pct = recentDigits.length > 0 ? (count / recentDigits.length) * 100 : 10;
    const calmCount = lastIdxMap[d] === -1 ? recentDigits.length : recentDigits.length - 1 - lastIdxMap[d];
    return { digit: d, count, pct, calmCount };
  });

  if (history.length < 15 || prices.length < 10) {
    return {
      signal: null,
      metrics: { noiseScore: 50, calmness: 50, calmStreak: 0, digitStats },
    };
  }

  const recentPrices = prices.slice(-15);
  const diffs: number[] = [];
  for (let i = 1; i < recentPrices.length; i++) {
    diffs.push(Math.abs(recentPrices[i] - recentPrices[i - 1]));
  }
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
  let calmStreak = 0;
  for (let i = diffs.length - 1; i >= 0; i--) {
    if (diffs[i] <= avgDiff * 1.35) calmStreak++;
    else break;
  }

  // Check digit micro-repeats in last minCalmTicks ticks
  const tailDigits = history.slice(-Math.max(3, minCalmTicks + 1));
  let microRepeats = 0;
  for (let i = 1; i < tailDigits.length; i++) {
    if (tailDigits[i] === tailDigits[i - 1]) microRepeats++;
  }

  const lastDiff = diffs[diffs.length - 1] || 0;
  const relSpike = avgDiff > 0 ? lastDiff / avgDiff : 1;
  const noiseScore = Math.max(
    0,
    Math.min(100, Math.round(relSpike * 22 + microRepeats * 18 + (calmStreak < minCalmTicks ? 15 : 0)))
  );
  const calmness = Math.max(0, Math.min(100, 100 - noiseScore));

  // Pick coldest / calmest digit (or latest digit when target mode is 'latest')
  const latestDigit = history[history.length - 1];
  const sortedByCalm = [...digitStats].sort((a, b) => b.calmCount - a.calmCount || a.count - b.count);
  const topCalmDigit = sortedByCalm[0]?.digit ?? latestDigit;

  let signal: DiffersCalmNoiseSignal | null = null;
  if (noiseScore <= maxNoiseScore && calmStreak >= minCalmTicks && microRepeats === 0) {
    signal = {
      prediction: latestDigit,
      calmDigit: topCalmDigit,
      noiseScore,
      calmness,
      confirmationTicks: calmStreak,
      symbol,
      reason: `Noise ${noiseScore}/100 (≤${maxNoiseScore}) · Calm ${calmStreak} ticks · Differ ${latestDigit}`,
    };
  }

  return {
    signal,
    metrics: {
      noiseScore,
      calmness,
      calmStreak,
      digitStats,
    },
  };
}

// ---------- Analysis Signal Computations (Used by Analysis Tool Mode in AutoBot) ----------
export interface ComputedDifferSignal {
  prediction: number;
  confidence: number;
  pct: number;
  symbol: string;
}

export function computeDiffersSignal(history: number[], symbol: string): ComputedDifferSignal {
  const window = history.slice(-100);
  if (window.length === 0) return { prediction: 0, confidence: 0, pct: 10, symbol };
  const counts = new Array(10).fill(0);
  window.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });
  let coldest = 0;
  let minPct = Infinity;
  for (let d = 0; d <= 9; d++) {
    const pct = (counts[d] / window.length) * 100;
    if (pct < minPct) {
      minPct = pct;
      coldest = d;
    }
  }
  const conf = Math.max(50, Math.min(98, Math.round(100 - minPct * 2.5)));
  return { prediction: coldest, confidence: conf, pct: minPct, symbol };
}

export function computeOverUnderSignal(
  history: number[],
  _symbol: string,
  barrierOver: number = 4,
  barrierUnder: number = 4
): {
  direction: 'OVER' | 'UNDER' | 'NEUTRAL';
  confidence: number;
  netConfidence: number;
  overPct: number;
  underPct: number;
} {
  const window = history.slice(-100);
  if (window.length < 10) {
    return { direction: 'NEUTRAL', confidence: 0, netConfidence: 0, overPct: 50, underPct: 50 };
  }
  const overCount = window.filter((d) => d > barrierOver).length;
  const underCount = window.filter((d) => d < barrierUnder).length;
  const overPct = (overCount / window.length) * 100;
  const underPct = (underCount / window.length) * 100;
  if (overPct >= 58) {
    return {
      direction: 'OVER',
      confidence: Math.round(overPct),
      netConfidence: Math.round(overPct),
      overPct,
      underPct,
    };
  }
  if (underPct >= 58) {
    return {
      direction: 'UNDER',
      confidence: Math.round(underPct),
      netConfidence: Math.round(underPct),
      overPct,
      underPct,
    };
  }
  return {
    direction: overPct >= underPct ? 'OVER' : 'UNDER',
    confidence: Math.round(Math.max(overPct, underPct)),
    netConfidence: Math.round(Math.max(overPct, underPct)),
    overPct,
    underPct,
  };
}

export function computeAccumulatorSignal(
  prices: number[],
  _digits: number[],
  symbol: string
): {
  action: 'BUY_ACCU' | 'WAIT';
  upPressure: number;
  downPressure: number;
  isNeutral5050: boolean;
  confidence: number;
} {
  if (!prices || prices.length < 10) {
    return { action: 'WAIT', upPressure: 50, downPressure: 50, isNeutral5050: false, confidence: 0 };
  }
  const recent = prices.slice(-15);
  let ups = 0;
  let downs = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] > recent[i - 1]) ups++;
    else if (recent[i] < recent[i - 1]) downs++;
  }
  const total = Math.max(1, ups + downs);
  const upPressure = Math.round((ups / total) * 100);
  const downPressure = 100 - upPressure;
  const isNeutral5050 = Math.abs(upPressure - 50) <= 8;
  const noise = computeAccuNoiseSignal(prices, symbol);
  return {
    action: noise.signal === 'BUY_ACCU' || isNeutral5050 ? 'BUY_ACCU' : 'WAIT',
    upPressure,
    downPressure,
    isNeutral5050,
    confidence: isNeutral5050 ? 85 : noise.signal === 'BUY_ACCU' ? 80 : 40,
  };
}

export function computeMatchSignal(history: number[]): { prediction: number; confidence: number } {
  const window = history.slice(-100);
  if (window.length === 0) return { prediction: 0, confidence: 0 };
  const counts = new Array(10).fill(0);
  window.forEach((d) => {
    if (d >= 0 && d <= 9) counts[d]++;
  });
  let hottest = 0;
  let maxPct = -1;
  for (let d = 0; d <= 9; d++) {
    const pct = (counts[d] / window.length) * 100;
    if (pct > maxPct) {
      maxPct = pct;
      hottest = d;
    }
  }
  return {
    prediction: hottest,
    confidence: Math.min(95, Math.round(maxPct * 3.2)),
  };
}
