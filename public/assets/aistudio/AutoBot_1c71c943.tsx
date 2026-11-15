import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { observer } from 'mobx-react-lite';
import { 
  Zap, Play, Square, Check, RefreshCw, AlertTriangle, 
  Search, ShieldAlert, CheckSquare, Square as SquareIcon,
  TrendingUp, TrendingDown, Target, Activity, BadgeAlert, Coins, ChevronRight,
  Clock, Bell, Plus, Trash2, Timer, Radio, RotateCcw
} from 'lucide-react';
import { cn, getActiveToken, getActiveAccountId } from './lib/utils';
import { botEngine } from './lib/botEngine';
import { rootStore } from './stores/root-store';
import { useCloudEngine } from './lib/useCloudEngine';
import { AutoBotAlarm } from './types/autobot';
import { AutoBotAlarmScheduler } from './components/autobot/AutoBotAlarmScheduler';
import { AutoBotMarketCard } from './components/autobot/AutoBotMarketCard';
import { AutoBotAnalysisSignalsPanel } from './components/autobot/AutoBotAnalysisSignalsPanel';
import { 
  getLatestAnalysisSignal, 
  computeDiffersSignal,
  getAllMarketDifferSignals, 
  computeOverUnderSignal, 
  computeAccumulatorSignal, 
  computeMatchSignal,
  computeAccuNoiseSignal
} from './lib/analysisSignalBridge';
import { computeDiffersCalmNoiseSignal } from './lib/autobotSignals';
import { DiffersCalmNoiseSignal, DiffersCalmNoiseMetrics } from './types/autobot';

// Interfaces matching structural elements of the system
interface OtivoSignal {
  id: string;
  type: 'over' | 'under' | 'differ';
  symbol: string;
  seq: string;
  conf: number;
  time: string;
  target?: number;
  pastOutcomes?: number[];
}

interface MarketConfig {
  symbol: string;
  name: string;
  shortName: string;
  decimals: number;
}

const MARKET_CONFIGS: MarketConfig[] = [
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
  { symbol: 'RDBEAR', name: 'Bear Market Index', shortName: 'Bear Market', decimals: 4 }
];

const ALL_SYMBOLS = MARKET_CONFIGS.map(m => m.symbol);

interface DigitAnalyticsItem {
  digit: number;
  count: number;
  percentage: number;
  zScore: number;
  misses: number;
  triggerCriticalExhaustion: boolean;
  triggerCriticalSaturation: boolean;
}

interface AILearnerSignal {
  prediction: number;
  probability: number;
  confidence: number;
  occurrences: number;
  sequence: string;
  counts: number[];
}

interface AIPatternData {
  sequence: string;
  occurrences: number;
  minDigit: number;
  minDigitProb: number;
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

export function computeAXASignal(history: number[], symbol: string): {
  signal: AXASignal | null;
  metrics: AXAMetrics;
} {
  if (history.length < 3) {
    const defaultMetrics: AXAMetrics = {
      pattern: `Scanning (${history.length}/3 Ticks)...`,
      targetDigit: -1,
      cluster: []
    };
    return { signal: null, metrics: defaultMetrics };
  }

  const d1 = history[history.length - 3];
  const d2 = history[history.length - 2];
  const d3 = history[history.length - 1];

  // Target Pattern: A -> X -> A
  // Constraint Rule: A must equal A, and A must not equal X (d1 === d3 && d1 !== d2)
  const isValidPattern = d1 === d3 && d1 !== d2;
  const patternStr = `${d1}-${d2}-${d3}`;

  const metrics: AXAMetrics = {
    pattern: patternStr,
    targetDigit: isValidPattern ? d2 : -1,
    cluster: [d1, d2, d3]
  };

  let signal: AXASignal | null = null;
  if (isValidPattern) {
    signal = {
      prediction: d2, // The intermediate digit X enters a deadzone, so we DIFFER it
      confidence: 100, // Instant automated alert for 100% mathematical deadzone
      pattern: patternStr,
      symbol
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
    .map(s => s.trim())
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
        priceStr: formattedPrice
      };
    }
  }

  return { matched: false, target: null, priceStr: formattedPrice };
};

export interface OverUnderScannerSignal {
  type: 'digitover' | 'digitunder';
  barrier: number; // 1 for digitover, 8 for digitunder
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
  singleDigitMax = 12.0
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
    sampleCount: history ? history.length : 0
  };

  if (!history || history.length === 0) {
    return { signal: null, metrics: defaultMetrics };
  }

  const slice = history.slice(-samplePeriod);
  const len = slice.length;
  const counts = new Array(10).fill(0);
  slice.forEach(d => {
    if (d >= 0 && d <= 9) counts[d]++;
  });

  const freqs = counts.map(c => (c / len) * 100);
  const over1LossZone = freqs[0] + freqs[1];
  const under8LossZone = freqs[8] + freqs[9];

  const currentDigit = history[history.length - 1];
  const isOver1Cold = (over1LossZone <= coldThresholdMax) || (currentDigit === 0 || currentDigit === 1);
  const isUnder8Cold = (under8LossZone <= coldThresholdMax) || (currentDigit === 8 || currentDigit === 9);

  let signal: OverUnderScannerSignal | null = null;

  if (isOver1Cold && (currentDigit === 0 || currentDigit === 1 || over1LossZone <= coldThresholdMax * 0.8)) {
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
      isUnder8Cold
    };
  } else if (isUnder8Cold && (currentDigit === 8 || currentDigit === 9 || under8LossZone <= coldThresholdMax * 0.8)) {
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
      isUnder8Cold
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
      sampleCount: len
    }
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

export function calculateEDMSPositionSize(accountRiskAmount: number, stopLossPips: number): number {
  if (stopLossPips <= 0) return 0;
  return (accountRiskAmount * 0.025) / stopLossPips;
}

export function checkEDMSRiskRewardRatio(takeProfit: number, stopLoss: number): boolean {
  if (stopLoss <= 0) return false;
  return (takeProfit / stopLoss) >= 1.5;
}

export function computeEDMSSignal(prices: number[], history: number[]): {
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
    ssUnder: 0
  };

  if (!prices || prices.length < 5) {
    return { signal: null, metrics: defaultMetrics };
  }

  const C = prices[prices.length - 1];

  // 1. Volatility Confirmation (V = ATR_14 / SMA_20(ATR_14))
  const atrData = prices.length >= 5 ? calculateATR(prices, Math.min(14, prices.length - 1)) : { current: 0.01, average: 0.01 };
  const atrCurrent = atrData.current || 0.00001;
  const atrSMA20 = atrData.average || 0.00001;
  const V = atrSMA20 > 0 ? atrCurrent / atrSMA20 : 1.0;

  // 2. Price Position (P = (C - BB_20,2_lower) / (BB_20,2_upper - BB_20,2_lower))
  const bb = prices.length >= 5 ? calculateBollingerBands(prices, Math.min(prices.length, 20), 2) : { upper: C * 1.01, lower: C * 0.99, middle: C };
  const bbWidth = bb.upper - bb.lower;
  const P = bbWidth > 0 ? (C - bb.lower) / bbWidth : 0.5;

  // 3. Momentum Oscillator (M = StochRSI)
  const rsi14 = prices.length >= 5 ? calculateRSI(prices, Math.min(14, prices.length - 1)) : 50;
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
  const stochRsi = (maxRsi - minRsi) > 0 ? ((rsi14 - minRsi) / (maxRsi - minRsi)) * 100 : 50;
  const M = stochRsi / 100;

  // 4. Volume Confirmation (VOL = VOL_current / SMA_20(VOL))
  const volumes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    volumes.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const volCurrent = volumes.length > 0 ? volumes[volumes.length - 1] : 0.001;
  const volSlice20 = volumes.slice(-20);
  const volSMA20 = volSlice20.length > 0 ? (volSlice20.reduce((a, b) => a + b, 0) / volSlice20.length) : 0.001;
  const VOL = volSMA20 > 0 ? volCurrent / volSMA20 : 1.0;

  // 5. Trend Strength T (Fast EMA 5 vs Slow EMA 20 normalized by ATR)
  const ema5Arr = calculateEMA(prices, Math.min(prices.length, 5));
  const ema20Arr = calculateEMA(prices, Math.min(prices.length, 20));
  const ema5 = ema5Arr[ema5Arr.length - 1] || C;
  const ema20 = ema20Arr[ema20Arr.length - 1] || C;
  const T = atrCurrent > 0 ? (ema5 - ema20) / atrCurrent : 0;

  // 6. Digit Confirmation Component (D_last)
  const Dlast = (history && history.length > 0) ? history[history.length - 1] : -1;

  // OVER 1 Setup Conditions
  const condOverD = Dlast === 0 || Dlast === 1 || Dlast === 2 || Dlast === 3;
  const condOverP = P <= 0.50;
  const condOverM = M <= 0.55;
  const condOverVOL = VOL >= 0.70;
  const condOverV = V >= 0.70;
  const condOverT = T <= 0.6;

  const scoreOver = (condOverD ? 1 : 0) + (condOverP ? 1 : 0) + (condOverM ? 1 : 0) + (condOverVOL ? 1 : 0) + (condOverV ? 1 : 0) + (condOverT ? 1 : 0);
  const sOver = (condOverD && scoreOver >= 2) || (!condOverD && scoreOver >= 4) ? 1 : 0;

  // UNDER 8 Setup Conditions
  const condUnderD = Dlast === 8 || Dlast === 9 || Dlast === 7 || Dlast === 6;
  const condUnderP = P >= 0.50;
  const condUnderM = M >= 0.45;
  const condUnderVOL = VOL >= 0.70;
  const condUnderV = V >= 0.70;
  const condUnderT = T >= -0.6;

  const scoreUnder = (condUnderD ? 1 : 0) + (condUnderP ? 1 : 0) + (condUnderM ? 1 : 0) + (condUnderVOL ? 1 : 0) + (condUnderV ? 1 : 0) + (condUnderT ? 1 : 0);
  const sUnder = (condUnderD && scoreUnder >= 2) || (!condUnderD && scoreUnder >= 4) ? 1 : 0;

  // Signal Strength Calculation
  const ssOverRaw = ((V - 0.80) + (0.40 - P) + (0.50 - M) + (VOL - 0.80) + (0.5 - T)) / 5;
  const ssUnderRaw = ((V - 0.80) + (P - 0.60) + (M - 0.50) + (VOL - 0.80) + (T + 0.5)) / 5;

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
    ssUnder
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
      metrics: { V: metrics.V, P: metrics.P, M: metrics.M, VOL: metrics.VOL, T: metrics.T }
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
      metrics: { V: metrics.V, P: metrics.P, M: metrics.M, VOL: metrics.VOL, T: metrics.T }
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
  prices: number[],
  patternLen: number = 3,
  minOccurrences: number = 3,
  followerWindow: number = 2
): LADPrngSignal | null {
  if (history.length < patternLen + followerWindow + 10) return null;

  // 1. Get current ending pattern of length patternLen
  const currentPattern = history.slice(-patternLen);
  const currentPatternStr = currentPattern.join('');

  // 2. Scan historical ticks before the current ending instance for pattern matches
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
      // Collect follower digits in the window
      for (let f = 0; f < followerWindow; f++) {
        const followerDigit = history[i + patternLen + f];
        if (followerDigit >= 0 && followerDigit <= 9) {
          followerDigitsSeen.add(followerDigit);
        }
      }
    }
  }

  // 3. Must meet or exceed minOccurrences
  if (occurrences < minOccurrences) {
    return null;
  }

  // 4. Find digits (0-9) that NEVER appeared in follower window across all occurrences
  const missingDigits: number[] = [];
  for (let d = 0; d <= 9; d++) {
    if (!followerDigitsSeen.has(d)) {
      missingDigits.push(d);
    }
  }

  if (missingDigits.length === 0) {
    return null;
  }

  // 5. Select best digit to predict DIFFER: sort by lowest frequency in recent 50 ticks
  const recent50 = history.slice(-50);
  missingDigits.sort((a, b) => {
    const countA = recent50.filter(x => x === a).length;
    const countB = recent50.filter(x => x === b).length;
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
    symbol
  };
}

function computeAILearnerSignal(history: number[]): {
  signal: AILearnerSignal | null;
  activePatterns: AIPatternData[];
} {
  const activePatterns: AIPatternData[] = [];
  let finalSignal: AILearnerSignal | null = null;
  
  if (history.length < 50) {
    return { signal: null, activePatterns: [] };
  }

  // We look back to find pattern sequences of lengths 3, 2, and 1 descending.
  const lengthsToTry = [3, 2, 1];
  
  // 1. Build and parse active suffixes for display & prediction
  for (const len of lengthsToTry) {
    if (history.length < len + 5) continue;
    const currentSeq = history.slice(-len);
    
    const counts = new Array(10).fill(0);
    let totalOccurrences = 0;
    
    // Scan standard historical database window (excluding the absolute end slice)
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
      
      // Keep track of patterns for visual display
      activePatterns.push({
        sequence: currentSeq.join(' → '),
        occurrences: totalOccurrences,
        minDigit,
        minDigitProb: Math.round(minDigitProb * 10) / 10
      });

      // Step 4: Generate Signal
      // Only signal when: pattern_occurrences >= 5, digit_probability < 10%, confidence > 80%
      const confidenceRange = 100 - minDigitProb;
      if (!finalSignal && totalOccurrences >= 5 && minDigitProb < 10 && confidenceRange > 80) {
        finalSignal = {
          prediction: minDigit,
          probability: Math.round(minDigitProb * 10) / 10,
          confidence: Math.round(confidenceRange),
          occurrences: totalOccurrences,
          sequence: currentSeq.join(' → '),
          counts
        };
      }
    }
  }

  return { signal: finalSignal, activePatterns };
}

function computeRngAnalytics(history: number[]): DigitAnalyticsItem[] {
  const N = history.length;
  const expectedCount = N * 0.10;
  const theoreticalStdDev = Math.sqrt(N * 0.10 * 0.90);

  const counts = new Array(10).fill(0);
  for (let i = 0; i < N; i++) {
    counts[history[i]]++;
  }

  const currentMisses = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    if (N > 0) {
      const lastIdx = history.lastIndexOf(d);
      currentMisses[d] = lastIdx === -1 ? N : (N - 1) - lastIdx;
    }
  }

  // Strict Limits (3.0 Sigma limits and 45 Ticks extreme miss streak limits)
  const STRICT_Z_LIMIT = 3.0;
  const CRITICAL_MISS_LIMIT = 45;

  return counts.map((count, d) => {
    const realPct = N > 0 ? (count / N) * 100 : 0;
    const zScore = theoreticalStdDev > 0 ? (count - expectedCount) / theoreticalStdDev : 0;
    const misses = currentMisses[d];

    const triggerCriticalExhaustion = zScore <= -STRICT_Z_LIMIT || misses >= CRITICAL_MISS_LIMIT;
    const triggerCriticalSaturation = zScore >= STRICT_Z_LIMIT;

    return {
      digit: d,
      count,
      percentage: Math.round(realPct * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,
      misses,
      triggerCriticalExhaustion,
      triggerCriticalSaturation
    };
  });
}

export default observer(function AutoBot() {
  const token = getActiveToken();
  const accId = getActiveAccountId();
  const connectionType = (localStorage.getItem('deriv_connection_type') || 'oauth') as 'oauth' | 'legacy';

  // Connect to backend Cloud Engine for 24/7 background scheduled alarms & trade execution
  const {
    cloudState,
    isConnected: isCloudConnected,
    addAlarm: addCloudAlarm,
    toggleAlarm: toggleCloudAlarm,
    deleteAlarm: deleteCloudAlarm,
    toggleScheduler: toggleCloudScheduler,
    updateSettings: updateCloudSettings,
    startEngine: startCloudEngine,
    stopEngine: stopCloudEngine,
    resetStats: resetCloudStats
  } = useCloudEngine();

  // Render-time read to make MobX track botEngine.isRunning reactively in our observer component
  const isEngineRunning = botEngine.isRunning;

  const isConnectedGlobal = rootStore.client.isConnected;
  const isConnectingGlobal = rootStore.client.isConnecting;

  // Persistent user state configurations saved in localStorage
  const [contractType, setContractTypeState] = useState(() => {
    const saved = localStorage.getItem('autobot_contract_type');
    if (saved === 'digitdiff' || saved === 'digitmatch' || saved === 'accumulator' || saved === 'over_under' || saved === 'dual_ou' || saved === 'digitover' || saved === 'digitunder') return saved;
    return 'digitdiff';
  });
  const [targetDigit, setTargetDigit] = useState(() => parseInt(localStorage.getItem('autobot_target_digit') || '4', 10));
  const [targetDigit2, setTargetDigit2] = useState(() => parseInt(localStorage.getItem('autobot_target_digit2') || '3', 10));
  const [streakThreshold, setStreakThreshold] = useState(() => parseInt(localStorage.getItem('autobot_streak_threshold') || '4', 10));
  const [isLossStreakThresholdEnabled, setIsLossStreakThresholdEnabled] = useState(() => localStorage.getItem('autobot_loss_streak_threshold_enabled') === 'true');
  const [lossStreakThreshold, setLossStreakThreshold] = useState(() => parseInt(localStorage.getItem('autobot_loss_streak_threshold') || '2', 10));
  const [streakMode, setStreakMode] = useState<'consecutive' | 'pattern' | 'types' | 'percentage' | 'axa' | 'circle_green' | 'circle_blue' | 'circle_orange' | 'circle_red' | 'circle_target_pct' | 'circle_over_under' | 'lad_prng' | 'differs_noise' | 'price_digits' | 'over_under' | 'analysis_tool' | 'consecutive_touch'>(
    () => {
      let saved = localStorage.getItem('autobot_streak_mode');
      if (saved === 'mpe' || saved === 'ne') {
        saved = 'axa';
        localStorage.setItem('autobot_streak_mode', 'axa');
      }
      if (
        saved === 'consecutive' || 
        saved === 'pattern' || 
        saved === 'types' || 
        saved === 'percentage' || 
        saved === 'axa' ||
        saved === 'circle_green' ||
        saved === 'circle_blue' ||
        saved === 'circle_orange' ||
        saved === 'circle_red' ||
        saved === 'circle_target_pct' ||
        saved === 'circle_over_under' ||
        saved === 'lad_prng' ||
        saved === 'differs_noise' ||
        saved === 'price_digits' ||
        saved === 'over_under' ||
        saved === 'analysis_tool' ||
        saved === 'consecutive_touch'
      ) return saved as any;
      return 'consecutive';
    }
  );
  const [priceDigitsInput, setPriceDigitsInput] = useState(() => localStorage.getItem('autobot_price_digits_input') || '.01, .1780, .392');
  const [ouSamplePeriod, setOuSamplePeriod] = useState(() => parseInt(localStorage.getItem('autobot_ou_sample_period') || '100', 10));
  const [analysisOppositeSignalEnabled, setAnalysisOppositeSignalEnabled] = useState(() => localStorage.getItem('autobot_analysis_opposite_signal') === 'true');
  const [recoveryAnalysisOppositeSignalEnabled, setRecoveryAnalysisOppositeSignalEnabled] = useState(() => localStorage.getItem('autobot_recovery_analysis_opposite_signal') === 'true');
  const [ouColdThresholdMax, setOuColdThresholdMax] = useState(() => parseFloat(localStorage.getItem('autobot_ou_cold_threshold_max') || '12.0'));
  const [ouSingleDigitMax, setOuSingleDigitMax] = useState(() => parseFloat(localStorage.getItem('autobot_ou_single_digit_max') || '6.0'));
  const [ouPatternSelection, setOuPatternSelection] = useState<'over1' | 'under8'>(() => {
    const saved = localStorage.getItem('autobot_ou_pattern_selection');
    if (saved === 'under8') return 'under8';
    return 'over1';
  });
  const [recoveryOuPatternSelection, setRecoveryOuPatternSelection] = useState<'over1' | 'under8'>(() => {
    const saved = localStorage.getItem('autobot_recovery_ou_pattern_selection');
    if (saved === 'under8') return 'under8';
    return 'over1';
  });

  const [isRecoveryStreakModeEnabled, setIsRecoveryStreakModeEnabled] = useState(() => localStorage.getItem('autobot_is_recovery_streak_mode_enabled') === 'true');
  const [recoveryStreakMode, setRecoveryStreakMode] = useState<'consecutive' | 'pattern' | 'types' | 'percentage' | 'axa' | 'circle_green' | 'circle_blue' | 'circle_orange' | 'circle_red' | 'circle_target_pct' | 'circle_over_under' | 'lad_prng' | 'differs_noise' | 'price_digits' | 'over_under' | 'analysis_tool' | 'consecutive_touch'>(
    () => {
      let saved = localStorage.getItem('autobot_recovery_streak_mode');
      if (saved === 'mpe' || saved === 'ne') {
        saved = 'axa';
        localStorage.setItem('autobot_recovery_streak_mode', 'axa');
      }
      if (
        saved === 'consecutive' || 
        saved === 'pattern' || 
        saved === 'types' || 
        saved === 'percentage' || 
        saved === 'axa' ||
        saved === 'circle_green' ||
        saved === 'circle_blue' ||
        saved === 'circle_orange' ||
        saved === 'circle_red' ||
        saved === 'circle_target_pct' ||
        saved === 'circle_over_under' ||
        saved === 'lad_prng' ||
        saved === 'differs_noise' ||
        saved === 'price_digits' ||
        saved === 'over_under' ||
        saved === 'analysis_tool' ||
        saved === 'consecutive_touch'
      ) return saved as any;
      return 'consecutive';
    }
  );
  const [recoveryContractType, setRecoveryContractType] = useState(() => localStorage.getItem('autobot_recovery_contract_type') || 'digitdiff');
  const [recoveryTargetDigit, setRecoveryTargetDigit] = useState(() => parseInt(localStorage.getItem('autobot_recovery_target_digit') || '4', 10));
  const [recoveryAccumulatorGrowthRate, setRecoveryAccumulatorGrowthRate] = useState<number>(() => parseInt(localStorage.getItem('autobot_recovery_accumulator_growth_rate') || '2', 10));
  const [recoveryAccumulatorTakeProfit, setRecoveryAccumulatorTakeProfit] = useState<number>(() => parseFloat(localStorage.getItem('autobot_recovery_accumulator_take_profit') || '10.0'));
  
  const [recoveryPriceDigitsInput, setRecoveryPriceDigitsInput] = useState(() => localStorage.getItem('autobot_recovery_price_digits_input') || '.01, .1780, .392');
  const [recoveryCustomPattern, setRecoveryCustomPattern] = useState(() => localStorage.getItem('autobot_recovery_custom_pattern') || '686');
  const [recoveryStreakThreshold, setRecoveryStreakThreshold] = useState(() => parseInt(localStorage.getItem('autobot_recovery_streak_threshold') || '4', 10));
  const [recoveryIsLossStreakThresholdEnabled, setRecoveryIsLossStreakThresholdEnabled] = useState(() => localStorage.getItem('autobot_recovery_is_loss_streak_threshold_enabled') === 'true');
  const [recoveryLossStreakThreshold, setRecoveryLossStreakThreshold] = useState(() => parseInt(localStorage.getItem('autobot_recovery_loss_streak_threshold') || '2', 10));
  const [recoveryPercentageThreshold, setRecoveryPercentageThreshold] = useState(() => parseInt(localStorage.getItem('autobot_recovery_percentage_threshold') || '80', 10));
  const [recoveryIsExactPercentage, setRecoveryIsExactPercentage] = useState(() => localStorage.getItem('autobot_recovery_is_exact_percentage') === 'true');
  const [recoveryTypesTransitionMatrix, setRecoveryTypesTransitionMatrix] = useState(() => localStorage.getItem('autobot_recovery_types_transition_matrix') !== 'false');
  const [recoveryTypesMirrorDigitReversal, setRecoveryTypesMirrorDigitReversal] = useState(() => localStorage.getItem('autobot_recovery_types_mirror_digit_reversal') !== 'false');
  const [recoveryTypesTickCompression, setRecoveryTypesTickCompression] = useState(() => localStorage.getItem('autobot_recovery_types_tick_compression') !== 'false');
  const [recoveryTypesHiddenCycleLength, setRecoveryTypesHiddenCycleLength] = useState(() => localStorage.getItem('autobot_recovery_types_hidden_cycle_length') !== 'false');
  const [recoveryPatternSmartMode, setRecoveryPatternSmartMode] = useState(() => localStorage.getItem('autobot_recovery_pattern_smart_mode') === 'true');
  const [recoveryPatternRotationalMode, setRecoveryPatternRotationalMode] = useState(() => localStorage.getItem('autobot_recovery_pattern_rotational_mode') === 'true');
  const [recoveryPatternRecoveryMode, setRecoveryPatternRecoveryMode] = useState(() => localStorage.getItem('autobot_recovery_pattern_recovery_mode') !== 'false');
  const [recoveryPatternSmartDigit, setRecoveryPatternSmartDigit] = useState<number | null>(() => {
    const val = localStorage.getItem('autobot_recovery_pattern_smart_digit');
    return val !== null ? parseInt(val, 10) : null;
  });

  const [percentageThreshold, setPercentageThreshold] = useState(() => {
    return parseInt(localStorage.getItem('autobot_percentage_threshold') || '80', 10);
  });
  const [isExactPercentage, setIsExactPercentage] = useState(() => localStorage.getItem('autobot_is_exact_percentage') === 'true');
  const [isCirclesMode, setIsCirclesMode] = useState(() => localStorage.getItem('autobot_circles_mode') === 'true');
  const [circlesTicksLimit, setCirclesTicksLimit] = useState(() => parseInt(localStorage.getItem('autobot_circles_ticks_limit') || '1000', 10));
  const [circleEntryModeEnabled, setCircleEntryModeEnabled] = useState(() => localStorage.getItem('autobot_circle_entry_mode_enabled') === 'true');

  const [circleOuTargetType, setCircleOuTargetType] = useState<'over' | 'under'>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_target_type');
    if (saved === 'under') return 'under';
    return 'over';
  });
  const [circleOuDigit, setCircleOuDigit] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_digit');
    return saved !== null ? parseInt(saved, 10) : 1;
  });
  const [circleOuMaxPct, setCircleOuMaxPct] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_max_pct');
    return saved !== null ? parseFloat(saved) : 9.0;
  });
  const [circleOuLowDigits, setCircleOuLowDigits] = useState<string>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_low_digits');
    return saved !== null ? saved : '0,1';
  });
  const [circleOuLowTouchMode, setCircleOuLowTouchMode] = useState<'consecutive' | 'one_by_one'>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_low_touch_mode');
    return (saved === 'one_by_one' || saved === 'consecutive') ? saved : 'consecutive';
  });
  const [circleOuOverTouchCount, setCircleOuOverTouchCount] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_over_touch_count');
    return saved !== null ? parseInt(saved, 10) : 2;
  });
  const [circleOuFinalTouchMaxTicks, setCircleOuFinalTouchMaxTicks] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_final_touch_max_ticks');
    return saved !== null ? parseInt(saved, 10) : 3;
  });
  const [circleOuOverColors, setCircleOuOverColors] = useState<('green' | 'blue' | 'orange' | 'red')[]>(() => {
    try {
      const saved = localStorage.getItem('autobot_circle_ou_over_colors');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ['green', 'blue'];
  });
  const [circleOuConsecutiveTicks, setCircleOuConsecutiveTicks] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_consecutive_ticks');
    return saved !== null ? parseInt(saved, 10) : 3;
  });
  const [circleOuColorMappingEnabled, setCircleOuColorMappingEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('autobot_circle_ou_color_mapping_enabled');
    return saved !== null ? saved === 'true' : false;
  });

  const [consecTouchOpposingTicks, setConsecTouchOpposingTicks] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_consec_touch_opposing_ticks');
    return saved !== null ? parseInt(saved, 10) : 3;
  });
  const [consecTouchTargetDigits, setConsecTouchTargetDigits] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_consec_touch_target_digits');
    return saved !== null ? parseInt(saved, 10) : 1;
  });
  const [consecTouchTouchType, setConsecTouchTouchType] = useState<'target' | 'any'>(() => {
    const saved = localStorage.getItem('autobot_consec_touch_touch_type');
    return (saved === 'any' || saved === 'target') ? saved : 'target';
  });
  const [recoveryConsecTouchOpposingTicks, setRecoveryConsecTouchOpposingTicks] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_recovery_consec_touch_opposing_ticks');
    return saved !== null ? parseInt(saved, 10) : 3;
  });
  const [recoveryConsecTouchTargetDigits, setRecoveryConsecTouchTargetDigits] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_recovery_consec_touch_target_digits');
    return saved !== null ? parseInt(saved, 10) : 1;
  });
  const [recoveryConsecTouchTouchType, setRecoveryConsecTouchTouchType] = useState<'target' | 'any'>(() => {
    const saved = localStorage.getItem('autobot_recovery_consec_touch_touch_type');
    return (saved === 'any' || saved === 'target') ? saved : 'target';
  });

  const [pmfPatternLen, setPmfPatternLen] = useState<number>(() => {
    return parseInt(localStorage.getItem('autobot_pmf_pattern_len') || '3', 10);
  });
  const [pmfMinOccurrences, setPmfMinOccurrences] = useState<number>(() => {
    return parseInt(localStorage.getItem('autobot_pmf_min_occurrences') || '3', 10);
  });
  const [pmfFollowerLen, setPmfFollowerLen] = useState<number>(() => {
    return parseInt(localStorage.getItem('autobot_pmf_follower_len') || '2', 10);
  });

  const [tradeDuration, setTradeDuration] = useState<number>(() => {
    return Math.min(10, Math.max(1, parseInt(localStorage.getItem('autobot_trade_duration') || '2', 10)));
  });
  const [isRandomTicks, setIsRandomTicks] = useState<boolean>(() => {
    return localStorage.getItem('autobot_random_ticks') === 'true';
  });

  const [accumulatorGrowthRate, setAccumulatorGrowthRate] = useState<number>(() => parseInt(localStorage.getItem('autobot_accumulator_growth_rate') || '2', 10));
  const [accumulatorTakeProfit, setAccumulatorTakeProfit] = useState<number>(() => parseFloat(localStorage.getItem('autobot_accumulator_take_profit') || '10.0'));
  const [accuStrategies, setAccuStrategies] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('autobot_accumulator_strategies');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
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
        ...parsed
      };
    } catch (e) {
      return {
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
        ai_volatility: true
      };
    }
  });

  // Differs Calm Noise Strategy configuration states
  const [differsNoiseMaxScore, setDiffersNoiseMaxScore] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_differs_noise_max_score');
    return saved !== null ? parseInt(saved, 10) : 35;
  });
  const [differsNoiseMinCalmTicks, setDiffersNoiseMinCalmTicks] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_differs_noise_min_calm_ticks');
    return saved !== null ? parseInt(saved, 10) : 3;
  });
  const [differsNoiseTargetMode, setDiffersNoiseTargetMode] = useState<'latest' | 'top_calm'>(() => {
    const saved = localStorage.getItem('autobot_differs_noise_target_mode');
    return (saved === 'top_calm' || saved === 'latest') ? saved : 'latest';
  });

  const differsNoiseMaxScoreRef = useRef(differsNoiseMaxScore);
  const differsNoiseMinCalmTicksRef = useRef(differsNoiseMinCalmTicks);
  const differsNoiseTargetModeRef = useRef(differsNoiseTargetMode);

  useEffect(() => {
    differsNoiseMaxScoreRef.current = differsNoiseMaxScore;
    try {
      localStorage.setItem('autobot_differs_noise_max_score', differsNoiseMaxScore.toString());
    } catch (e) {}
  }, [differsNoiseMaxScore]);

  useEffect(() => {
    differsNoiseMinCalmTicksRef.current = differsNoiseMinCalmTicks;
    try {
      localStorage.setItem('autobot_differs_noise_min_calm_ticks', differsNoiseMinCalmTicks.toString());
    } catch (e) {}
  }, [differsNoiseMinCalmTicks]);

  useEffect(() => {
    differsNoiseTargetModeRef.current = differsNoiseTargetMode;
    try {
      localStorage.setItem('autobot_differs_noise_target_mode', differsNoiseTargetMode);
    } catch (e) {}
  }, [differsNoiseTargetMode]);

  const [circleTargetPct, setCircleTargetPct] = useState(() => parseFloat(localStorage.getItem('autobot_circle_target_pct') || '10.0'));
  const [circleCompareMode, setCircleCompareMode] = useState<'higher' | 'lower'>(() => (localStorage.getItem('autobot_circle_compare_mode') || 'higher') as any);
  const [circleFilterDigits, setCircleFilterDigits] = useState(() => localStorage.getItem('autobot_circle_filter_digits') || 'all');
  const [customPattern, setCustomPattern] = useState(() => localStorage.getItem('autobot_custom_pattern') || '686');

  // AI L mode sub-configurations
  const [aiLUseLookahead, setAiLUseLookahead] = useState(() => localStorage.getItem('autobot_ai_l_use_lookahead') === 'true');
  const [aiLLookaheadThreshold, setAiLLookaheadThreshold] = useState(() => parseInt(localStorage.getItem('autobot_ai_l_lookahead_threshold') || '5', 10));

  // Types strategy mode sub-configurations
  const [typesTransitionMatrix, setTypesTransitionMatrix] = useState(() => localStorage.getItem('autobot_types_transition_matrix') !== 'false');
  const [typesMirrorDigitReversal, setTypesMirrorDigitReversal] = useState(() => localStorage.getItem('autobot_types_mirror_digit_reversal') !== 'false');
  const [typesTickCompression, setTypesTickCompression] = useState(() => localStorage.getItem('autobot_types_tick_compression') !== 'false');
  const [typesHiddenCycleLength, setTypesHiddenCycleLength] = useState(() => localStorage.getItem('autobot_types_hidden_cycle_length') !== 'false');
  const [patternSmartMode, setPatternSmartMode] = useState(() => localStorage.getItem('autobot_pattern_smart_mode') === 'true');
  const [patternSmartDigit, setPatternSmartDigit] = useState<number | null>(() => {
    const val = localStorage.getItem('autobot_pattern_smart_digit');
    return val !== null ? parseInt(val, 10) : null;
  });
  const [patternRotationalMode, setPatternRotationalMode] = useState(() => localStorage.getItem('autobot_pattern_rotational_mode') === 'true');
  const patternRotationalIdx = useRef<Record<string, number>>({});
  const [patternRecoveryMode, setPatternRecoveryMode] = useState(() => localStorage.getItem('autobot_pattern_recovery_mode') !== 'false');
  const [neCalibrationEnabled, setNeCalibrationEnabled] = useState(() => localStorage.getItem('autobot_ne_calibration_enabled') !== 'false');
  const [alternateMarketRecovery, setAlternateMarketRecovery] = useState(() => localStorage.getItem('autobot_alternate_market_recovery') !== 'false');
  const [checkedMarkets, setCheckedMarkets] = useState<string[]>(() => {
    const saved = localStorage.getItem('autobot_checked_markets');
    if (saved) {
      let parsed = JSON.parse(saved);
      // Ensure the new 1HZ 1s markets are added automatically for returning users
      const newMarkets = ['1HZ15V', '1HZ30V', '1HZ90V'];
      for (const m of newMarkets) {
        if (!parsed.includes(m)) {
          parsed.push(m);
        }
      }
      return parsed;
    }
    return ALL_SYMBOLS;
  });
  const [stake, setStake] = useState(() => parseFloat(localStorage.getItem('autobot_stake') || '1'));
  const [isAutoStakeEnabled, setIsAutoStakeEnabled] = useState(() => localStorage.getItem('autobot_auto_stake_enabled') === 'true');
  const [martingale, setMartingale] = useState(() => parseFloat(localStorage.getItem('autobot_martingale') || '2'));
  const [takeProfit, setTakeProfit] = useState(() => parseFloat(localStorage.getItem('autobot_tp') || '100'));
  const [isRunsLimitEnabled, setIsRunsLimitEnabled] = useState(() => localStorage.getItem('autobot_is_runs_mode') === 'true');
  const [runsLimit, setRunsLimit] = useState(() => {
    const saved = localStorage.getItem('autobot_runs_limit');
    return saved ? Math.min(10, Math.max(1, parseInt(saved, 10))) : 5;
  });
  const [stopLoss, setStopLoss] = useState(() => parseFloat(localStorage.getItem('autobot_sl') || '100'));
  const [runForever, setRunForever] = useState(() => localStorage.getItem('autobot_run_forever') === 'true');
  const [isContinuousTrading, setIsContinuousTrading] = useState(() => localStorage.getItem('autobot_continuous_trading') === 'true');

  useEffect(() => {
    try {
      localStorage.setItem('autobot_continuous_trading', String(isContinuousTrading));
      (window as any).AUTOBOT_CONTINUOUS_TRADING = isContinuousTrading;
      if (isContinuousTrading && alternateMarketRecovery) {
        setAlternateMarketRecovery(false);
      }
    } catch (err) {
      console.error('Failed to save autobot_continuous_trading:', err);
    }
  }, [isContinuousTrading]);

  const isContinuousTradingRef = useRef(isContinuousTrading);
  useEffect(() => {
    isContinuousTradingRef.current = isContinuousTrading;
    (window as any).AUTOBOT_CONTINUOUS_TRADING = isContinuousTrading;
  }, [isContinuousTrading]);

  const autoStakeValue = useMemo(() => {
    if (!isAutoStakeEnabled) return stake;
    const balance = rootStore.client.balance;
    const mFactor = Number(martingale) || 11.0;
    if (balance <= 0) return stake;
    // Apply a 2% safety cushion so that rounding or commission drops don't trigger Insufficient Balance
    let calculated = Math.max(0.35, Number(((balance * 0.98) / (1 + mFactor)).toFixed(2)));
    // For non-legacy accounts, the maximum normal base stake is 830, or if the account balance is past 9130
    if (connectionType !== 'legacy') {
      if (balance > 9130 || calculated > 830) {
        calculated = 830;
      }
    }
    return calculated;
  }, [isAutoStakeEnabled, rootStore.client.balance, martingale, stake, connectionType]);

  const hasEqualsInPattern = useMemo(() => {
    return streakMode === 'pattern' && customPattern.includes('=');
  }, [streakMode, customPattern]);

  // Mobile drawer responsiveness
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

  const displayedMarkets = useMemo(() => {
    if (contractType === 'accumulator') {
      const excluded = ['RDBULL', 'RDBEAR', 'JD10', 'JD25', 'JD50', 'JD75', 'JD100'];
      return MARKET_CONFIGS.filter(m => !excluded.includes(m.symbol));
    }
    return MARKET_CONFIGS;
  }, [connectionType, contractType]);

  const displayedSymbols = useMemo(() => displayedMarkets.map(m => m.symbol), [displayedMarkets]);

  const visibleCheckedMarkets = useMemo(() => {
    return checkedMarkets.filter(symbol => displayedSymbols.includes(symbol));
  }, [checkedMarkets, displayedSymbols]);

  // Live WebSocket Tick & Digit Engine
  const [marketTicks, setMarketTicks] = useState<Record<string, { 
    price: number; 
    lastDigit: number; 
    digits: number[]; 
    streak: number; 
    prevPrice?: number;
    coldDigit?: number | null;
    breakoutSignal?: { strategyName: string; targetDigit: number; reason: string } | null;
    patternMatched?: boolean;
    bestDifferDigit?: number;
    entropy?: number;
    relativeVelocity?: number;
    volatility?: number;
    compressionActive?: boolean;
    cycleLength?: number;
    mirrorActive?: boolean;
    typesSignal?: { prediction: number; reason: string; strategyName: string } | null;
    rngAnalytics?: DigitAnalyticsItem[];
    rngSignal?: { prediction: number; zScore: number; reason: string } | null;
    markovMatrix?: number[][];
    markovRowTotals?: number[];
    survivalSignals?: { id: string; c: number; survival: string }[];
    aiLearnerSignal?: AILearnerSignal | null;
    aiLearnerPatterns?: AIPatternData[];
    axaSignal?: AXASignal | null;
    axaMetrics?: AXAMetrics;
    accumulatorMetrics?: any;
    ladPrngSignal?: any;
    edmsSignal?: EDMSSignal | null;
    edmsMetrics?: any;
    differsCalmNoiseSignal?: DiffersCalmNoiseSignal | null;
    differsCalmNoiseMetrics?: DiffersCalmNoiseMetrics;
    consecTouchData?: {
      opposingCount: number;
      streakAchieved: boolean;
      touchCount: number;
      reqOpposing: number;
      reqTouches: number;
      isOverTarget: boolean;
      activeBarrier: number;
      touchType?: 'target' | 'any';
    };
  }>>({});
  const marketTicksRef = useRef<Record<string, any>>({});

  const [isEdmsEnabled, setIsEdmsEnabled] = useState(() => localStorage.getItem('autobot_is_edms_enabled') !== 'false');

  useEffect(() => {
    try {
      localStorage.setItem('autobot_is_edms_enabled', String(isEdmsEnabled));
    } catch (err) {
      console.error('Failed to save autobot_is_edms_enabled:', err);
    }
  }, [isEdmsEnabled]);

  const isEdmsEnabledRef = useRef(isEdmsEnabled);
  useEffect(() => {
    isEdmsEnabledRef.current = isEdmsEnabled;
  }, [isEdmsEnabled]);
  const lastStateUpdateRef = useRef<number>(0);
  const stateUpdateTimeoutRef = useRef<any>(null);
  const tickHistories = useRef<Record<string, number[]>>({});
  const priceHistories = useRef<Record<string, number[]>>({});
  const wsSubscription = useRef<WebSocket | null>(null);

  const aiLOnRefRef = useRef<Record<string, Record<string, {
    pattern: string;
    counts: number[];
    total: number;
  }>>>({});

  const strictLookaheadStates = useRef<Record<string, {
    systemState: "SCANNING" | "SIGNAL_LOCKED";
    activePattern: string | null;
    targetDifferDigit: number | null;
  }>>({});

  const prewarmAILookahead = (symbol: string, history: number[]) => {
    if (history.length < 8) return;
    const db: Record<string, { pattern: string; counts: number[]; total: number }> = {};
    for (let i = 0; i <= history.length - 8; i++) {
      const seq = history.slice(i, i + 3);
      const key = seq.join(",");
      const future = history.slice(i + 3, i + 8);
      
      if (!db[key]) {
        db[key] = {
          pattern: seq.join(" → "),
          counts: new Array(10).fill(0),
          total: 0
        };
      }
      
      db[key].total += 1;
      const appeared = new Set(future);
      for (const d of appeared) {
        if (d >= 0 && d <= 9) {
          db[key].counts[d] += 1;
        }
      }
    }
    aiLOnRefRef.current[symbol] = db;
  };

  const updateAILookaheadPattern = (symbol: string, history: number[]) => {
    const N = history.length;
    if (N < 8) return;
    
    if (!aiLOnRefRef.current[symbol]) {
      aiLOnRefRef.current[symbol] = {};
    }
    const db = aiLOnRefRef.current[symbol];
    
    const seq = history.slice(N - 8, N - 5);
    const key = seq.join(",");
    const future = history.slice(N - 5, N);
    
    if (!db[key]) {
      db[key] = {
        pattern: seq.join(" → "),
        counts: new Array(10).fill(0),
        total: 0
      };
    }
    
    db[key].total += 1;
    const appeared = new Set(future);
    for (const d of appeared) {
      if (d >= 0 && d <= 9) {
        db[key].counts[d] += 1;
      }
    }
  };

  const resetStrictAILookahead = (symbol: string) => {
    strictLookaheadStates.current[symbol] = {
      systemState: "SCANNING",
      activePattern: null,
      targetDifferDigit: null
    };
    setMarketTicks({ ...marketTicksRef.current });
  };

  const computeAILookaheadSignal = (
    symbol: string,
    history: number[],
    absenceThreshold: number
  ): {
    signal: { prediction: number; occurrences: number; losses: number; sequence: string; confidence: number; isLookahead?: boolean } | null;
    verifiedPatterns: { pattern: string; avoid_digit: number; occurrences: number; losses: number }[];
  } => {
    if (!strictLookaheadStates.current[symbol]) {
      strictLookaheadStates.current[symbol] = {
        systemState: "SCANNING",
        activePattern: null,
        targetDifferDigit: null
      };
    }
    const state = strictLookaheadStates.current[symbol];

    const activeVerified: { pattern: string; avoid_digit: number; occurrences: number; losses: number }[] = [];
    const occurrencesMap: Record<string, { total: number; target: number }> = {};

    // 1. Build verified patterns from the full history to display in the UI Pattern Matrix
    if (history.length >= 4) {
      for (let i = 3; i < history.length; i++) {
        const p1 = history[i - 2];
        const p2 = history[i - 1];
        const p3 = history[i];
        const patKey = `${p1} → ${p2} → ${p3}`;

        const histBuffer = history.slice(0, i - 2);
        if (histBuffer.length >= absenceThreshold) {
          const relevantCheck = histBuffer.slice(-absenceThreshold);
          const isAbsent = !relevantCheck.includes(p1);
          if (isAbsent) {
            if (!occurrencesMap[patKey]) {
              occurrencesMap[patKey] = { total: 0, target: p1 };
            }
            occurrencesMap[patKey].total += 1;
          }
        }
      }
      for (const [pattern, info] of Object.entries(occurrencesMap)) {
        activeVerified.push({
          pattern: pattern,
          avoid_digit: info.target,
          occurrences: info.total,
          losses: 0
        });
      }
    }

    // 2. State Machine Logic: Look for active lookahead triggers from rolling tick history (last 30 ticks)
    const recentTicks = history.slice(-30);
    const N = recentTicks.length;

    if (state.systemState === "SIGNAL_LOCKED") {
      if (state.activePattern && state.targetDifferDigit !== null) {
        return {
          signal: {
            prediction: state.targetDifferDigit,
            occurrences: absenceThreshold,
            losses: 0,
            sequence: state.activePattern,
            confidence: 100,
            isLookahead: true
          },
          verifiedPatterns: activeVerified
        };
      }
      return { signal: null, verifiedPatterns: activeVerified };
    }

    if (N < 4) {
      return { signal: null, verifiedPatterns: activeVerified };
    }

    const p1 = recentTicks[N - 3];
    const p2 = recentTicks[N - 2];
    const p3 = recentTicks[N - 1];
    const detectedPattern = `${p1} → ${p2} → ${p3}`;
    const potentialTarget = p1;

    const historicalSearchBuffer = recentTicks.slice(0, N - 3);
    if (historicalSearchBuffer.length < absenceThreshold) {
      return { signal: null, verifiedPatterns: activeVerified };
    }

    const relevantHistoryCheck = historicalSearchBuffer.slice(-absenceThreshold);
    const targetIsAbsent = !relevantHistoryCheck.includes(potentialTarget);

    if (targetIsAbsent) {
      state.systemState = "SIGNAL_LOCKED";
      state.activePattern = detectedPattern;
      state.targetDifferDigit = potentialTarget;

      return {
        signal: {
          prediction: potentialTarget,
          occurrences: absenceThreshold,
          losses: 0,
          sequence: detectedPattern,
          confidence: 100,
          isLookahead: true
        },
        verifiedPatterns: activeVerified
      };
    }

    return {
      signal: null,
      verifiedPatterns: activeVerified
    };
  };

  // States for stats updating in real time
  const [isRunning, setIsRunning] = useState(false);
  const [sessionProfit, setSessionProfit] = useState(0);
  const [tradesCount, setTradesCount] = useState(0);
  const [winsCount, setWinsCount] = useState(0);
  const [lossesCount, setLossesCount] = useState(0);
  const [currentStake, setCurrentStake] = useState(stake);

  // Auto Reset & Start After Take Profit (Overall Session Take Profit Limit)
  const [autoRestartAfterTp, setAutoRestartAfterTp] = useState<boolean>(() => {
    return localStorage.getItem('autobot_autoRestartAfterTp') === 'true';
  });
  const [autoRestartMaxTp, setAutoRestartMaxTp] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_autoRestartMaxTp');
    return saved !== null ? Math.max(1, parseFloat(saved) || 50.0) : 50.0;
  });
  const [cumulativeSessionProfit, setCumulativeSessionProfit] = useState<number>(() => {
    const saved = sessionStorage.getItem('autobot_cumulativeSessionProfit');
    return saved !== null ? parseFloat(saved) || 0 : 0;
  });

  const autoRestartAfterTpRef = useRef<boolean>(autoRestartAfterTp);
  autoRestartAfterTpRef.current = autoRestartAfterTp;

  const autoRestartMaxTpRef = useRef<number>(autoRestartMaxTp);
  autoRestartMaxTpRef.current = autoRestartMaxTp;

  const cumulativeSessionProfitRef = useRef<number>(cumulativeSessionProfit);
  cumulativeSessionProfitRef.current = cumulativeSessionProfit;

  useEffect(() => {
    localStorage.setItem('autobot_autoRestartAfterTp', autoRestartAfterTp ? 'true' : 'false');
    (window as any).AUTOBOT_AUTO_RESTART_AFTER_TP = autoRestartAfterTp;
  }, [autoRestartAfterTp]);

  useEffect(() => {
    localStorage.setItem('autobot_autoRestartMaxTp', autoRestartMaxTp.toString());
    (window as any).AUTOBOT_AUTO_RESTART_MAX_TP = autoRestartMaxTp;
  }, [autoRestartMaxTp]);

  const activeSessionProfit = Number((cumulativeSessionProfit + sessionProfit).toFixed(2));

  // Virtual Loss Settings State (Virtual Mode inside Real Trading)
  const [useVirtualLoss, setUseVirtualLoss] = useState<boolean>(() => {
    const saved = localStorage.getItem('autobot_use_virtual_loss');
    return saved !== null ? saved === 'true' : true;
  });
  const [virtualAfterRealLoss, setVirtualAfterRealLoss] = useState<boolean>(() => {
    const saved = localStorage.getItem('autobot_virtual_after_real_loss');
    return saved !== null ? saved === 'true' : false;
  });
  const [virtualLossThreshold, setVirtualLossThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('autobot_virtual_loss_threshold');
    return saved !== null ? Math.max(1, parseInt(saved, 10) || 2) : 2;
  });
  const [consecutiveVirtualLosses, setConsecutiveVirtualLosses] = useState<number>(0);
  const [isCurrentTradeReal, setIsCurrentTradeReal] = useState<boolean>(false);
  const [virtualWinsCount, setVirtualWinsCount] = useState<number>(0);
  const [virtualLossesCount, setVirtualLossesCount] = useState<number>(0);
  const [lockedVirtualMarket, setLockedVirtualMarket] = useState<string | null>(null);

  const useVirtualLossRef = useRef(useVirtualLoss);
  const virtualAfterRealLossRef = useRef(virtualAfterRealLoss);
  const virtualLossThresholdRef = useRef(virtualLossThreshold);
  const lockedVirtualMarketRef = useRef(lockedVirtualMarket);

  useEffect(() => {
    lockedVirtualMarketRef.current = lockedVirtualMarket;
    (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = lockedVirtualMarket;
  }, [lockedVirtualMarket]);

  useEffect(() => {
    useVirtualLossRef.current = useVirtualLoss;
    try {
      localStorage.setItem('autobot_use_virtual_loss', String(useVirtualLoss));
      (window as any).AUTOBOT_USE_VIRTUAL_LOSS = useVirtualLoss;
    } catch (e) {}
  }, [useVirtualLoss]);

  useEffect(() => {
    virtualAfterRealLossRef.current = virtualAfterRealLoss;
    try {
      localStorage.setItem('autobot_virtual_after_real_loss', String(virtualAfterRealLoss));
      (window as any).AUTOBOT_VIRTUAL_AFTER_REAL_LOSS = virtualAfterRealLoss;
    } catch (e) {}
  }, [virtualAfterRealLoss]);

  useEffect(() => {
    virtualLossThresholdRef.current = virtualLossThreshold;
    try {
      localStorage.setItem('autobot_virtual_loss_threshold', String(virtualLossThreshold));
      (window as any).AUTOBOT_VIRTUAL_LOSS_THRESHOLD = virtualLossThreshold;
    } catch (e) {}
  }, [virtualLossThreshold]);

  // States for Scheduled Alarms
  const [alarms, setAlarms] = useState<AutoBotAlarm[]>(() => {
    try {
      const saved = localStorage.getItem('autobot_scheduled_alarms');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAlarmSchedulerEnabled, setIsAlarmSchedulerEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autobot_alarm_scheduler_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [newAlarmTime, setNewAlarmTime] = useState<string>('09:00:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState<string>('');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Save alarms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('autobot_scheduled_alarms', JSON.stringify(alarms));
    } catch (err) {
      console.error('Failed to save autobot_scheduled_alarms:', err);
    }
  }, [alarms]);

  // Keep alarms synced with backend Cloud Engine
  useEffect(() => {
    if (cloudState?.alarms && cloudState.alarms.length > 0) {
      setAlarms(cloudState.alarms.map(a => ({
        id: a.id,
        time: a.time,
        label: a.label,
        enabled: a.enabled,
        triggeredToday: a.lastTriggeredDate
      })));
    }
  }, [cloudState?.alarms]);

  // Save alarm scheduler switch state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('autobot_alarm_scheduler_enabled', String(isAlarmSchedulerEnabled));
    } catch (err) {
      console.error('Failed to save autobot_alarm_scheduler_enabled:', err);
    }
  }, [isAlarmSchedulerEnabled]);

  // Cooldown timer to prevent multiple trades triggering on same streak index tick
  const lastTradeTimePerSymbol = useRef<Record<string, number>>({});

  // Pattern detection signals
  const [otivoSignals, setOtivoSignals] = useState<{ over: OtivoSignal[], under: OtivoSignal[], differ: OtivoSignal[] }>({
    over: [],
    under: [],
    differ: []
  });
  const [otivoLog, setOtivoLog] = useState<string[]>([]);
  const [selectedRngMarket, setSelectedRngMarket] = useState<string>('');

  // Auto-select first active checked market for RNG Dashboard
  useEffect(() => {
    (window as any).AUTOBOT_RESET_STRICT_LOOKAHEAD = (symbol: string) => {
      resetStrictAILookahead(symbol);
    };
    return () => {
      delete (window as any).AUTOBOT_RESET_STRICT_LOOKAHEAD;
    };
  }, []);

  useEffect(() => {
    if (visibleCheckedMarkets.length > 0) {
      if (!selectedRngMarket || !visibleCheckedMarkets.includes(selectedRngMarket)) {
        setSelectedRngMarket(visibleCheckedMarkets[0]);
      }
    } else {
      setSelectedRngMarket('');
    }
  }, [visibleCheckedMarkets, selectedRngMarket]);

  // Synchronize configurations inside localStorage
  useEffect(() => {
    localStorage.setItem('autobot_contract_type', contractType);
    if (contractType !== 'digitdiff' && (streakMode === 'types' || streakMode === 'axa')) {
      setStreakMode('consecutive');
    }
    if (!(contractType === 'dual_ou' || contractType === 'digitover' || contractType === 'digitunder') && streakMode === 'percentage') {
      setStreakMode('consecutive');
    }
    if (!(contractType === 'over_under' || contractType === 'digitover' || contractType === 'digitunder') && streakMode === 'consecutive_touch') {
      setStreakMode('consecutive');
    }
    if (contractType === 'over_under') {
      if (streakMode !== 'pattern' && streakMode !== 'over_under' && streakMode !== 'circle_over_under' && streakMode !== 'analysis_tool' && streakMode !== 'consecutive_touch' && !streakMode.startsWith('circle_')) {
        setStreakMode('over_under');
      }
      if (recoveryStreakMode !== 'pattern' && recoveryStreakMode !== 'over_under' && recoveryStreakMode !== 'circle_over_under' && recoveryStreakMode !== 'analysis_tool' && recoveryStreakMode !== 'consecutive_touch' && !recoveryStreakMode.startsWith('circle_')) {
        setRecoveryStreakMode('over_under');
      }
    } else {
      if (streakMode === 'over_under') {
        setStreakMode('consecutive');
      }
      if (recoveryStreakMode === 'over_under') {
        setRecoveryStreakMode('consecutive');
      }
    }
  }, [contractType, streakMode, recoveryStreakMode]);

  useEffect(() => {
    localStorage.setItem('autobot_accumulator_growth_rate', accumulatorGrowthRate.toString());
  }, [accumulatorGrowthRate]);

  useEffect(() => {
    localStorage.setItem('autobot_accumulator_take_profit', accumulatorTakeProfit.toString());
  }, [accumulatorTakeProfit]);

  useEffect(() => {
    localStorage.setItem('autobot_accumulator_strategies', JSON.stringify(accuStrategies));
  }, [accuStrategies]);

  useEffect(() => {
    localStorage.setItem('autobot_percentage_threshold', percentageThreshold.toString());
  }, [percentageThreshold]);

  useEffect(() => {
    localStorage.setItem('autobot_is_exact_percentage', isExactPercentage ? 'true' : 'false');
  }, [isExactPercentage]);

  useEffect(() => {
    localStorage.setItem('autobot_target_digit', targetDigit.toString());
    (window as any).AUTOBOT_TARGET_DIGIT = targetDigit;
  }, [targetDigit]);

  useEffect(() => {
    localStorage.setItem('autobot_trade_duration', tradeDuration.toString());
    (window as any).AUTOBOT_TRADE_DURATION = tradeDuration;
  }, [tradeDuration]);

  useEffect(() => {
    localStorage.setItem('autobot_random_ticks', isRandomTicks ? 'true' : 'false');
    (window as any).AUTOBOT_RANDOM_TICKS = isRandomTicks;
  }, [isRandomTicks]);

  useEffect(() => {
    localStorage.setItem('autobot_target_digit2', targetDigit2.toString());
  }, [targetDigit2]);

  useEffect(() => {
    localStorage.setItem('autobot_streak_threshold', streakThreshold.toString());
  }, [streakThreshold]);

  useEffect(() => {
    localStorage.setItem('autobot_loss_streak_threshold_enabled', isLossStreakThresholdEnabled ? 'true' : 'false');
  }, [isLossStreakThresholdEnabled]);

  useEffect(() => {
    localStorage.setItem('autobot_loss_streak_threshold', lossStreakThreshold.toString());
  }, [lossStreakThreshold]);

  useEffect(() => {
    localStorage.setItem('autobot_streak_mode', streakMode);
    (window as any).AUTOBOT_STREAK_MODE = streakMode;
    if (streakMode === 'types' || streakMode === 'axa') {
      setContractTypeState('digitdiff');
    }
  }, [streakMode]);

  useEffect(() => {
    localStorage.setItem('autobot_types_transition_matrix', typesTransitionMatrix.toString());
    (window as any).AUTOBOT_TYPES_TRANSITION_MATRIX = typesTransitionMatrix;
  }, [typesTransitionMatrix]);

  useEffect(() => {
    localStorage.setItem('autobot_types_mirror_digit_reversal', typesMirrorDigitReversal.toString());
    (window as any).AUTOBOT_TYPES_MIRROR_DIGIT_REVERSAL = typesMirrorDigitReversal;
  }, [typesMirrorDigitReversal]);

  useEffect(() => {
    localStorage.setItem('autobot_types_tick_compression', typesTickCompression.toString());
    (window as any).AUTOBOT_TYPES_TICK_COMPRESSION = typesTickCompression;
  }, [typesTickCompression]);

  useEffect(() => {
    localStorage.setItem('autobot_types_hidden_cycle_length', typesHiddenCycleLength.toString());
    (window as any).AUTOBOT_TYPES_HIDDEN_CYCLE_LENGTH = typesHiddenCycleLength;
  }, [typesHiddenCycleLength]);

  useEffect(() => {
    localStorage.setItem('autobot_checked_markets', JSON.stringify(checkedMarkets));
  }, [checkedMarkets]);

  useEffect(() => {
    localStorage.setItem('autobot_stake', stake.toString());
    if (!isRunning) {
      setCurrentStake(isAutoStakeEnabled ? autoStakeValue : stake);
    }
  }, [stake, isRunning, isAutoStakeEnabled, autoStakeValue]);

  useEffect(() => {
    localStorage.setItem('autobot_auto_stake_enabled', isAutoStakeEnabled ? 'true' : 'false');
  }, [isAutoStakeEnabled]);

  useEffect(() => {
    localStorage.setItem('autobot_active_running', isRunning ? 'true' : 'false');
  }, [isRunning]);

  useEffect(() => {
    localStorage.setItem('autobot_martingale', martingale.toString());
  }, [martingale]);

  useEffect(() => {
    localStorage.setItem('autobot_tp', takeProfit.toString());
  }, [takeProfit]);

  useEffect(() => {
    localStorage.setItem('autobot_is_runs_mode', isRunsLimitEnabled ? 'true' : 'false');
  }, [isRunsLimitEnabled]);

  useEffect(() => {
    localStorage.setItem('autobot_runs_limit', runsLimit.toString());
  }, [runsLimit]);

  useEffect(() => {
    localStorage.setItem('autobot_sl', stopLoss.toString());
  }, [stopLoss]);

  useEffect(() => {
    localStorage.setItem('autobot_run_forever', runForever.toString());
  }, [runForever]);

  useEffect(() => {
    localStorage.setItem('autobot_ai_l_use_lookahead', aiLUseLookahead ? 'true' : 'false');
  }, [aiLUseLookahead]);

  useEffect(() => {
    localStorage.setItem('autobot_ai_l_lookahead_threshold', aiLLookaheadThreshold.toString());
  }, [aiLLookaheadThreshold]);

  useEffect(() => {
    localStorage.setItem('autobot_custom_pattern', customPattern);
    (window as any).AUTOBOT_CUSTOM_PATTERN = customPattern;
  }, [customPattern]);

  useEffect(() => {
    localStorage.setItem('autobot_pattern_smart_mode', patternSmartMode.toString());
    (window as any).AUTOBOT_PATTERN_SMART_MODE = (contractType === 'dual_ou' || contractType === 'digitover' || contractType === 'digitunder') ? false : patternSmartMode;
  }, [patternSmartMode, contractType]);

  useEffect(() => {
    localStorage.setItem('autobot_pattern_rotational_mode', patternRotationalMode.toString());
    (window as any).AUTOBOT_PATTERN_ROTATIONAL_MODE = (contractType === 'dual_ou' || contractType === 'digitover' || contractType === 'digitunder') ? false : patternRotationalMode;
  }, [patternRotationalMode, contractType]);

  useEffect(() => {
    localStorage.setItem('autobot_pattern_recovery_mode', patternRecoveryMode.toString());
    (window as any).AUTOBOT_PATTERN_RECOVERY_MODE = patternRecoveryMode;
  }, [patternRecoveryMode]);

  useEffect(() => {
    localStorage.setItem('autobot_alternate_market_recovery', alternateMarketRecovery.toString());
    (window as any).AUTOBOT_ALTERNATE_MARKET_RECOVERY = alternateMarketRecovery;
  }, [alternateMarketRecovery]);

  useEffect(() => {
    const isHidden = streakMode !== 'pattern' || 
                    contractType === 'dual_ou' || 
                    contractType === 'digitover' || 
                    contractType === 'digitunder';
    if (isHidden && patternSmartMode) {
      setPatternSmartMode(false);
    }
    if (isHidden && patternRotationalMode) {
      setPatternRotationalMode(false);
    }
  }, [streakMode, contractType, patternSmartMode, patternRotationalMode]);

  useEffect(() => {
    patternSmartDigitRef.current = patternSmartDigit;
    if (patternSmartDigit !== null) {
      localStorage.setItem('autobot_pattern_smart_digit', patternSmartDigit.toString());
      (window as any).AUTOBOT_PATTERN_SMART_DIGIT = patternSmartDigit;
    } else {
      localStorage.removeItem('autobot_pattern_smart_digit');
      delete (window as any).AUTOBOT_PATTERN_SMART_DIGIT;
    }
  }, [patternSmartDigit]);

  // Synchronize runner state with actual botEngine state to prevent mismatches
  useEffect(() => {
    if (isEngineRunning !== isRunning) {
      setIsRunning(isEngineRunning);
      if (!isEngineRunning) {
        botEngine.getBotInterface().notify('info', 'Auto Bot stopped.');
      }
    }
  }, [isEngineRunning, isRunning]);

  // Synchronize settings with refs to avoid resetting the WebSocket on every configuration change
  const contractTypeRef = useRef(contractType);
  const targetDigitRef = useRef(targetDigit);
  const targetDigit2Ref = useRef(targetDigit2);
  const streakThresholdRef = useRef(streakThreshold);
  const isLossStreakThresholdEnabledRef = useRef(isLossStreakThresholdEnabled);
  const lossStreakThresholdRef = useRef(lossStreakThreshold);
  const streakModeRef = useRef(streakMode);
  const isRecoveryStreakModeEnabledRef = useRef(isRecoveryStreakModeEnabled);
  const recoveryStreakModeRef = useRef(recoveryStreakMode);
  const customPatternRef = useRef(customPattern);
  const recoveryCustomPatternRef = useRef(recoveryCustomPattern);
  const recoveryStreakThresholdRef = useRef(recoveryStreakThreshold);
  const recoveryIsLossStreakThresholdEnabledRef = useRef(recoveryIsLossStreakThresholdEnabled);
  const recoveryLossStreakThresholdRef = useRef(recoveryLossStreakThreshold);
  const recoveryPercentageThresholdRef = useRef(recoveryPercentageThreshold);
  const recoveryIsExactPercentageRef = useRef(recoveryIsExactPercentage);
  const recoveryTypesTransitionMatrixRef = useRef(recoveryTypesTransitionMatrix);
  const recoveryTypesMirrorDigitReversalRef = useRef(recoveryTypesMirrorDigitReversal);
  const recoveryTypesTickCompressionRef = useRef(recoveryTypesTickCompression);
  const recoveryTypesHiddenCycleLengthRef = useRef(recoveryTypesHiddenCycleLength);
  const recoveryPatternSmartModeRef = useRef(recoveryPatternSmartMode);
  const recoveryPatternRotationalModeRef = useRef(recoveryPatternRotationalMode);
  const recoveryPatternRecoveryModeRef = useRef(recoveryPatternRecoveryMode);
  const recoveryPatternSmartDigitRef = useRef(recoveryPatternSmartDigit);
  const patternSmartDigitRef = useRef(patternSmartDigit);
  const isRunningRef = useRef(isRunning);
  const isAlarmSchedulerEnabledRef = useRef(isAlarmSchedulerEnabled);
  useEffect(() => {
    isAlarmSchedulerEnabledRef.current = isAlarmSchedulerEnabled;
  }, [isAlarmSchedulerEnabled]);
  const checkedMarketsRef = useRef(visibleCheckedMarkets);
  const currentStakeRef = useRef(currentStake);
  const percentageThresholdRef = useRef(percentageThreshold);
  const isExactPercentageRef = useRef(isExactPercentage);

  const typesTransitionMatrixRef = useRef(typesTransitionMatrix);
  const typesMirrorDigitReversalRef = useRef(typesMirrorDigitReversal);
  const typesTickCompressionRef = useRef(typesTickCompression);
  const typesHiddenCycleLengthRef = useRef(typesHiddenCycleLength);

  const aiLUseLookaheadRef = useRef(aiLUseLookahead);
  const aiLLookaheadThresholdRef = useRef(aiLLookaheadThreshold);
  const patternSmartModeRef = useRef(patternSmartMode);
  const patternRotationalModeRef = useRef(patternRotationalMode);
  const patternRecoveryModeRef = useRef(patternRecoveryMode);
  const neCalibrationEnabledRef = useRef(neCalibrationEnabled);
  const alternateMarketRecoveryRef = useRef(alternateMarketRecovery);

  const ouPatternSelectionRef = useRef(ouPatternSelection);
  useEffect(() => {
    ouPatternSelectionRef.current = ouPatternSelection;
    localStorage.setItem('autobot_ou_pattern_selection', ouPatternSelection);
    (window as any).AUTOBOT_OU_PATTERN_SELECTION = ouPatternSelection;
  }, [ouPatternSelection]);

  const recoveryOuPatternSelectionRef = useRef(recoveryOuPatternSelection);
  useEffect(() => {
    recoveryOuPatternSelectionRef.current = recoveryOuPatternSelection;
    localStorage.setItem('autobot_recovery_ou_pattern_selection', recoveryOuPatternSelection);
    (window as any).AUTOBOT_RECOVERY_OU_PATTERN_SELECTION = recoveryOuPatternSelection;
  }, [recoveryOuPatternSelection]);

  const isCirclesModeRef = useRef(isCirclesMode);
  const circlesTicksLimitRef = useRef(circlesTicksLimit);
  const circleEntryModeEnabledRef = useRef(circleEntryModeEnabled);

  const circleTargetPctRef = useRef(circleTargetPct);
  const circleCompareModeRef = useRef(circleCompareMode);
  const circleFilterDigitsRef = useRef(circleFilterDigits);

  const circleOuTargetTypeRef = useRef(circleOuTargetType);
  useEffect(() => {
    circleOuTargetTypeRef.current = circleOuTargetType;
    localStorage.setItem('autobot_circle_ou_target_type', circleOuTargetType);
  }, [circleOuTargetType]);

  const circleOuDigitRef = useRef(circleOuDigit);
  useEffect(() => {
    circleOuDigitRef.current = circleOuDigit;
    localStorage.setItem('autobot_circle_ou_digit', circleOuDigit.toString());
  }, [circleOuDigit]);

  const circleOuMaxPctRef = useRef(circleOuMaxPct);
  useEffect(() => {
    circleOuMaxPctRef.current = circleOuMaxPct;
    localStorage.setItem('autobot_circle_ou_max_pct', circleOuMaxPct.toString());
  }, [circleOuMaxPct]);

  const circleOuLowDigitsRef = useRef(circleOuLowDigits);
  useEffect(() => {
    circleOuLowDigitsRef.current = circleOuLowDigits;
    localStorage.setItem('autobot_circle_ou_low_digits', circleOuLowDigits);
  }, [circleOuLowDigits]);

  const circleOuLowTouchModeRef = useRef(circleOuLowTouchMode);
  useEffect(() => {
    circleOuLowTouchModeRef.current = circleOuLowTouchMode;
    localStorage.setItem('autobot_circle_ou_low_touch_mode', circleOuLowTouchMode);
  }, [circleOuLowTouchMode]);

  const circleOuOverTouchCountRef = useRef(circleOuOverTouchCount);
  useEffect(() => {
    circleOuOverTouchCountRef.current = circleOuOverTouchCount;
    localStorage.setItem('autobot_circle_ou_over_touch_count', circleOuOverTouchCount.toString());
  }, [circleOuOverTouchCount]);

  const circleOuFinalTouchMaxTicksRef = useRef(circleOuFinalTouchMaxTicks);
  useEffect(() => {
    circleOuFinalTouchMaxTicksRef.current = circleOuFinalTouchMaxTicks;
    localStorage.setItem('autobot_circle_ou_final_touch_max_ticks', circleOuFinalTouchMaxTicks.toString());
  }, [circleOuFinalTouchMaxTicks]);

  const circleOuOverColorsRef = useRef(circleOuOverColors);
  useEffect(() => {
    circleOuOverColorsRef.current = circleOuOverColors;
    localStorage.setItem('autobot_circle_ou_over_colors', JSON.stringify(circleOuOverColors));
  }, [circleOuOverColors]);

  const circleOuConsecutiveTicksRef = useRef(circleOuConsecutiveTicks);
  useEffect(() => {
    circleOuConsecutiveTicksRef.current = circleOuConsecutiveTicks;
    localStorage.setItem('autobot_circle_ou_consecutive_ticks', circleOuConsecutiveTicks.toString());
  }, [circleOuConsecutiveTicks]);

  const circleOuColorMappingEnabledRef = useRef(circleOuColorMappingEnabled);
  useEffect(() => {
    circleOuColorMappingEnabledRef.current = circleOuColorMappingEnabled;
    localStorage.setItem('autobot_circle_ou_color_mapping_enabled', circleOuColorMappingEnabled.toString());
  }, [circleOuColorMappingEnabled]);

  const circleOuConsecutiveCountRef = useRef<Record<string, number>>({});
  const circleOuMarketStatesRef = useRef<Record<string, {
    stage: 'WAITING_LOW_TOUCH' | 'COUNTING_OVER_TOUCH' | 'WAITING_FINAL_TOUCH';
    lowTouchedDigits: number[];
    consecutiveLowCount: number;
    overTouchCount: number;
    finalTouchTicksElapsed: number;
    lastUpdated: number;
  }>>({});

  const consecTouchOpposingTicksRef = useRef(consecTouchOpposingTicks);
  const consecTouchTargetDigitsRef = useRef(consecTouchTargetDigits);
  const consecTouchTouchTypeRef = useRef(consecTouchTouchType);
  const recoveryConsecTouchOpposingTicksRef = useRef(recoveryConsecTouchOpposingTicks);
  const recoveryConsecTouchTargetDigitsRef = useRef(recoveryConsecTouchTargetDigits);
  const recoveryConsecTouchTouchTypeRef = useRef(recoveryConsecTouchTouchType);
  const consecTouchPerMarket = useRef<Record<string, { opposingCount: number; streakAchieved: boolean; touchCount: number }>>({});

  useEffect(() => {
    consecTouchOpposingTicksRef.current = consecTouchOpposingTicks;
    localStorage.setItem('autobot_consec_touch_opposing_ticks', consecTouchOpposingTicks.toString());
  }, [consecTouchOpposingTicks]);

  useEffect(() => {
    consecTouchTargetDigitsRef.current = consecTouchTargetDigits;
    localStorage.setItem('autobot_consec_touch_target_digits', consecTouchTargetDigits.toString());
  }, [consecTouchTargetDigits]);

  useEffect(() => {
    consecTouchTouchTypeRef.current = consecTouchTouchType;
    localStorage.setItem('autobot_consec_touch_touch_type', consecTouchTouchType);
  }, [consecTouchTouchType]);

  useEffect(() => {
    recoveryConsecTouchOpposingTicksRef.current = recoveryConsecTouchOpposingTicks;
    localStorage.setItem('autobot_recovery_consec_touch_opposing_ticks', recoveryConsecTouchOpposingTicks.toString());
  }, [recoveryConsecTouchOpposingTicks]);

  useEffect(() => {
    recoveryConsecTouchTargetDigitsRef.current = recoveryConsecTouchTargetDigits;
    localStorage.setItem('autobot_recovery_consec_touch_target_digits', recoveryConsecTouchTargetDigits.toString());
  }, [recoveryConsecTouchTargetDigits]);

  useEffect(() => {
    recoveryConsecTouchTouchTypeRef.current = recoveryConsecTouchTouchType;
    localStorage.setItem('autobot_recovery_consec_touch_touch_type', recoveryConsecTouchTouchType);
  }, [recoveryConsecTouchTouchType]);

  const pmfPatternLenRef = useRef(pmfPatternLen);
  const pmfMinOccurrencesRef = useRef(pmfMinOccurrences);
  const pmfFollowerLenRef = useRef(pmfFollowerLen);

  useEffect(() => {
    pmfPatternLenRef.current = pmfPatternLen;
    localStorage.setItem('autobot_pmf_pattern_len', pmfPatternLen.toString());
  }, [pmfPatternLen]);
  useEffect(() => {
    pmfMinOccurrencesRef.current = pmfMinOccurrences;
    localStorage.setItem('autobot_pmf_min_occurrences', pmfMinOccurrences.toString());
  }, [pmfMinOccurrences]);
  useEffect(() => {
    pmfFollowerLenRef.current = pmfFollowerLen;
    localStorage.setItem('autobot_pmf_follower_len', pmfFollowerLen.toString());
  }, [pmfFollowerLen]);

  const accuStrategiesRef = useRef(accuStrategies);
  const accumulatorGrowthRateRef = useRef(accumulatorGrowthRate);
  const accumulatorTakeProfitRef = useRef(accumulatorTakeProfit);

  useEffect(() => { accuStrategiesRef.current = accuStrategies; }, [accuStrategies]);
  useEffect(() => { accumulatorGrowthRateRef.current = accumulatorGrowthRate; }, [accumulatorGrowthRate]);
  useEffect(() => { accumulatorTakeProfitRef.current = accumulatorTakeProfit; }, [accumulatorTakeProfit]);

  useEffect(() => {
    contractTypeRef.current = contractType;
    (window as any).AUTOBOT_CONTRACT_TYPE = contractType;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
    (window as any).AUTOBOT_TARGET = null;
    (window as any).AUTOBOT_LAST_CONTRACT_TYPE = null;
    (window as any).AUTOBOT_LAST_PREDICTION = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = null;

    if (contractType === 'digitover') {
      if (targetDigitRef.current < 0 || targetDigitRef.current > 8) {
        setTargetDigit(2);
        targetDigitRef.current = 2;
        localStorage.setItem('autobot_target_digit', '2');
        (window as any).AUTOBOT_TARGET_DIGIT = 2;
      }
      if (['types', 'axa', 'differs_noise', 'lad_prng', 'over_under'].includes(streakModeRef.current)) {
        setStreakMode('consecutive');
        streakModeRef.current = 'consecutive';
        localStorage.setItem('autobot_streak_mode', 'consecutive');
        (window as any).AUTOBOT_STREAK_MODE = 'consecutive';
      }
    } else if (contractType === 'digitunder') {
      if (targetDigitRef.current < 1 || targetDigitRef.current > 9) {
        setTargetDigit(8);
        targetDigitRef.current = 8;
        localStorage.setItem('autobot_target_digit', '8');
        (window as any).AUTOBOT_TARGET_DIGIT = 8;
      }
      if (['types', 'axa', 'differs_noise', 'lad_prng', 'over_under'].includes(streakModeRef.current)) {
        setStreakMode('consecutive');
        streakModeRef.current = 'consecutive';
        localStorage.setItem('autobot_streak_mode', 'consecutive');
        (window as any).AUTOBOT_STREAK_MODE = 'consecutive';
      }
    } else if (contractType === 'digitmatch') {
      if (targetDigitRef.current < 0 || targetDigitRef.current > 9) {
        setTargetDigit(4);
        targetDigitRef.current = 4;
        localStorage.setItem('autobot_target_digit', '4');
        (window as any).AUTOBOT_TARGET_DIGIT = 4;
      }
      if (['types', 'axa', 'differs_noise', 'percentage', 'over_under'].includes(streakModeRef.current)) {
        setStreakMode('consecutive');
        streakModeRef.current = 'consecutive';
        localStorage.setItem('autobot_streak_mode', 'consecutive');
        (window as any).AUTOBOT_STREAK_MODE = 'consecutive';
      }
    }
  }, [contractType]);
  useEffect(() => {
    targetDigitRef.current = targetDigit;
    (window as any).AUTOBOT_TARGET_DIGIT = targetDigit;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = null;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
  }, [targetDigit]);
  useEffect(() => {
    targetDigit2Ref.current = targetDigit2;
    (window as any).AUTOBOT_TARGET_DIGIT2 = targetDigit2;
  }, [targetDigit2]);
  useEffect(() => { streakThresholdRef.current = streakThreshold; }, [streakThreshold]);
  useEffect(() => { isLossStreakThresholdEnabledRef.current = isLossStreakThresholdEnabled; }, [isLossStreakThresholdEnabled]);
  useEffect(() => { lossStreakThresholdRef.current = lossStreakThreshold; }, [lossStreakThreshold]);
  const priceDigitsInputRef = useRef(priceDigitsInput);
  const recoveryPriceDigitsInputRef = useRef(recoveryPriceDigitsInput);

  const ouSamplePeriodRef = useRef(ouSamplePeriod);
  const analysisOppositeSignalEnabledRef = useRef(analysisOppositeSignalEnabled);
  const recoveryAnalysisOppositeSignalEnabledRef = useRef(recoveryAnalysisOppositeSignalEnabled);
  const ouColdThresholdMaxRef = useRef(ouColdThresholdMax);
  const ouSingleDigitMaxRef = useRef(ouSingleDigitMax);

  useEffect(() => {
    analysisOppositeSignalEnabledRef.current = analysisOppositeSignalEnabled;
    localStorage.setItem('autobot_analysis_opposite_signal', analysisOppositeSignalEnabled.toString());
  }, [analysisOppositeSignalEnabled]);

  useEffect(() => {
    recoveryAnalysisOppositeSignalEnabledRef.current = recoveryAnalysisOppositeSignalEnabled;
    localStorage.setItem('autobot_recovery_analysis_opposite_signal', recoveryAnalysisOppositeSignalEnabled.toString());
  }, [recoveryAnalysisOppositeSignalEnabled]);

  useEffect(() => {
    ouSamplePeriodRef.current = ouSamplePeriod;
    localStorage.setItem('autobot_ou_sample_period', ouSamplePeriod.toString());
  }, [ouSamplePeriod]);

  useEffect(() => {
    ouColdThresholdMaxRef.current = ouColdThresholdMax;
    localStorage.setItem('autobot_ou_cold_threshold_max', ouColdThresholdMax.toString());
  }, [ouColdThresholdMax]);

  useEffect(() => {
    ouSingleDigitMaxRef.current = ouSingleDigitMax;
    localStorage.setItem('autobot_ou_single_digit_max', ouSingleDigitMax.toString());
  }, [ouSingleDigitMax]);

  useEffect(() => {
    priceDigitsInputRef.current = priceDigitsInput;
    localStorage.setItem('autobot_price_digits_input', priceDigitsInput);
    (window as any).AUTOBOT_PRICE_DIGITS_INPUT = priceDigitsInput;
  }, [priceDigitsInput]);

  useEffect(() => {
    recoveryPriceDigitsInputRef.current = recoveryPriceDigitsInput;
    localStorage.setItem('autobot_recovery_price_digits_input', recoveryPriceDigitsInput);
    (window as any).AUTOBOT_RECOVERY_PRICE_DIGITS_INPUT = recoveryPriceDigitsInput;
  }, [recoveryPriceDigitsInput]);

  useEffect(() => {
    streakModeRef.current = streakMode;
    localStorage.setItem('autobot_streak_mode', streakMode);
  }, [streakMode]);
  useEffect(() => {
    isRecoveryStreakModeEnabledRef.current = isRecoveryStreakModeEnabled;
    localStorage.setItem('autobot_is_recovery_streak_mode_enabled', isRecoveryStreakModeEnabled ? 'true' : 'false');
  }, [isRecoveryStreakModeEnabled]);
  useEffect(() => {
    recoveryStreakModeRef.current = recoveryStreakMode;
    localStorage.setItem('autobot_recovery_streak_mode', recoveryStreakMode);
  }, [recoveryStreakMode]);
  const recoveryContractTypeRef = useRef(recoveryContractType);
  useEffect(() => {
    recoveryContractTypeRef.current = recoveryContractType;
    localStorage.setItem('autobot_recovery_contract_type', recoveryContractType);
  }, [recoveryContractType]);
  const recoveryTargetDigitRef = useRef(recoveryTargetDigit);
  useEffect(() => {
    recoveryTargetDigitRef.current = recoveryTargetDigit;
    localStorage.setItem('autobot_recovery_target_digit', recoveryTargetDigit.toString());
  }, [recoveryTargetDigit]);
  const recoveryAccumulatorGrowthRateRef = useRef(recoveryAccumulatorGrowthRate);
  useEffect(() => {
    recoveryAccumulatorGrowthRateRef.current = recoveryAccumulatorGrowthRate;
    localStorage.setItem('autobot_recovery_accumulator_growth_rate', recoveryAccumulatorGrowthRate.toString());
  }, [recoveryAccumulatorGrowthRate]);
  const recoveryAccumulatorTakeProfitRef = useRef(recoveryAccumulatorTakeProfit);
  useEffect(() => {
    recoveryAccumulatorTakeProfitRef.current = recoveryAccumulatorTakeProfit;
    localStorage.setItem('autobot_recovery_accumulator_take_profit', recoveryAccumulatorTakeProfit.toString());
  }, [recoveryAccumulatorTakeProfit]);

  useEffect(() => { customPatternRef.current = customPattern; }, [customPattern]);
  useEffect(() => {
    recoveryCustomPatternRef.current = recoveryCustomPattern;
    localStorage.setItem('autobot_recovery_custom_pattern', recoveryCustomPattern);
  }, [recoveryCustomPattern]);
  useEffect(() => {
    recoveryStreakThresholdRef.current = recoveryStreakThreshold;
    localStorage.setItem('autobot_recovery_streak_threshold', recoveryStreakThreshold.toString());
  }, [recoveryStreakThreshold]);
  useEffect(() => {
    recoveryIsLossStreakThresholdEnabledRef.current = recoveryIsLossStreakThresholdEnabled;
    localStorage.setItem('autobot_recovery_is_loss_streak_threshold_enabled', recoveryIsLossStreakThresholdEnabled ? 'true' : 'false');
  }, [recoveryIsLossStreakThresholdEnabled]);
  useEffect(() => {
    recoveryLossStreakThresholdRef.current = recoveryLossStreakThreshold;
    localStorage.setItem('autobot_recovery_loss_streak_threshold', recoveryLossStreakThreshold.toString());
  }, [recoveryLossStreakThreshold]);
  useEffect(() => {
    recoveryPercentageThresholdRef.current = recoveryPercentageThreshold;
    localStorage.setItem('autobot_recovery_percentage_threshold', recoveryPercentageThreshold.toString());
  }, [recoveryPercentageThreshold]);
  useEffect(() => {
    recoveryIsExactPercentageRef.current = recoveryIsExactPercentage;
    localStorage.setItem('autobot_recovery_is_exact_percentage', recoveryIsExactPercentage ? 'true' : 'false');
  }, [recoveryIsExactPercentage]);
  useEffect(() => {
    recoveryTypesTransitionMatrixRef.current = recoveryTypesTransitionMatrix;
    localStorage.setItem('autobot_recovery_types_transition_matrix', recoveryTypesTransitionMatrix ? 'true' : 'false');
  }, [recoveryTypesTransitionMatrix]);
  useEffect(() => {
    recoveryTypesMirrorDigitReversalRef.current = recoveryTypesMirrorDigitReversal;
    localStorage.setItem('autobot_recovery_types_mirror_digit_reversal', recoveryTypesMirrorDigitReversal ? 'true' : 'false');
  }, [recoveryTypesMirrorDigitReversal]);
  useEffect(() => {
    recoveryTypesTickCompressionRef.current = recoveryTypesTickCompression;
    localStorage.setItem('autobot_recovery_types_tick_compression', recoveryTypesTickCompression ? 'true' : 'false');
  }, [recoveryTypesTickCompression]);
  useEffect(() => {
    recoveryTypesHiddenCycleLengthRef.current = recoveryTypesHiddenCycleLength;
    localStorage.setItem('autobot_recovery_types_hidden_cycle_length', recoveryTypesHiddenCycleLength ? 'true' : 'false');
  }, [recoveryTypesHiddenCycleLength]);
  useEffect(() => {
    recoveryPatternSmartModeRef.current = recoveryPatternSmartMode;
    localStorage.setItem('autobot_recovery_pattern_smart_mode', recoveryPatternSmartMode ? 'true' : 'false');
  }, [recoveryPatternSmartMode]);
  useEffect(() => {
    recoveryPatternRotationalModeRef.current = recoveryPatternRotationalMode;
    localStorage.setItem('autobot_recovery_pattern_rotational_mode', recoveryPatternRotationalMode ? 'true' : 'false');
  }, [recoveryPatternRotationalMode]);
  useEffect(() => {
    recoveryPatternRecoveryModeRef.current = recoveryPatternRecoveryMode;
    localStorage.setItem('autobot_recovery_pattern_recovery_mode', recoveryPatternRecoveryMode ? 'true' : 'false');
  }, [recoveryPatternRecoveryMode]);
  useEffect(() => {
    recoveryPatternSmartDigitRef.current = recoveryPatternSmartDigit;
    if (recoveryPatternSmartDigit !== null) {
      localStorage.setItem('autobot_recovery_pattern_smart_digit', recoveryPatternSmartDigit.toString());
    } else {
      localStorage.removeItem('autobot_recovery_pattern_smart_digit');
    }
  }, [recoveryPatternSmartDigit]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { checkedMarketsRef.current = visibleCheckedMarkets; }, [visibleCheckedMarkets]);
  useEffect(() => { currentStakeRef.current = currentStake; }, [currentStake]);
  useEffect(() => { percentageThresholdRef.current = percentageThreshold; }, [percentageThreshold]);
  useEffect(() => { isExactPercentageRef.current = isExactPercentage; }, [isExactPercentage]);

  useEffect(() => {
    circleTargetPctRef.current = circleTargetPct;
    localStorage.setItem('autobot_circle_target_pct', circleTargetPct.toString());
  }, [circleTargetPct]);

  useEffect(() => {
    circleCompareModeRef.current = circleCompareMode;
    localStorage.setItem('autobot_circle_compare_mode', circleCompareMode);
  }, [circleCompareMode]);

  useEffect(() => {
    circleFilterDigitsRef.current = circleFilterDigits;
    localStorage.setItem('autobot_circle_filter_digits', circleFilterDigits);
  }, [circleFilterDigits]);

  useEffect(() => { typesTransitionMatrixRef.current = typesTransitionMatrix; }, [typesTransitionMatrix]);
  useEffect(() => { typesMirrorDigitReversalRef.current = typesMirrorDigitReversal; }, [typesMirrorDigitReversal]);
  useEffect(() => { typesTickCompressionRef.current = typesTickCompression; }, [typesTickCompression]);
  useEffect(() => { typesHiddenCycleLengthRef.current = typesHiddenCycleLength; }, [typesHiddenCycleLength]);

  useEffect(() => { aiLUseLookaheadRef.current = aiLUseLookahead; }, [aiLUseLookahead]);
  useEffect(() => { aiLLookaheadThresholdRef.current = aiLLookaheadThreshold; }, [aiLLookaheadThreshold]);
  useEffect(() => { patternSmartModeRef.current = patternSmartMode; }, [patternSmartMode]);
  useEffect(() => { patternRotationalModeRef.current = patternRotationalMode; }, [patternRotationalMode]);
  useEffect(() => { patternRecoveryModeRef.current = patternRecoveryMode; }, [patternRecoveryMode]);
  useEffect(() => {
    neCalibrationEnabledRef.current = neCalibrationEnabled;
    localStorage.setItem('autobot_ne_calibration_enabled', neCalibrationEnabled ? 'true' : 'false');
  }, [neCalibrationEnabled]);
  useEffect(() => { alternateMarketRecoveryRef.current = alternateMarketRecovery; }, [alternateMarketRecovery]);

  useEffect(() => {
    isCirclesModeRef.current = isCirclesMode;
    localStorage.setItem('autobot_circles_mode', isCirclesMode ? 'true' : 'false');
  }, [isCirclesMode]);

  useEffect(() => {
    circlesTicksLimitRef.current = circlesTicksLimit;
    localStorage.setItem('autobot_circles_ticks_limit', circlesTicksLimit.toString());
  }, [circlesTicksLimit]);

  useEffect(() => {
    circleEntryModeEnabledRef.current = circleEntryModeEnabled;
    localStorage.setItem('autobot_circle_entry_mode_enabled', circleEntryModeEnabled ? 'true' : 'false');
  }, [circleEntryModeEnabled]);

  const checkedMarketsStr = JSON.stringify(visibleCheckedMarkets);

  const runPatternLearning = (excludePattern?: string, excludeDigit?: number) => {
    const symbols = JSON.parse(checkedMarketsStr) as string[];
    if (symbols.length === 0) return null;

    interface PatternStats {
      pattern: string;
      appearingSymbols: Set<string>;
      digitCounts: number[];
      totalCount: number;
    }

    const patternMap: Record<string, PatternStats> = {};

    symbols.forEach(symbol => {
      const history = tickHistories.current[symbol] || [];
      if (history.length < 10) return;

      // Only learn 3-digit patterns for more accurate auto-switching behavior
      [3].forEach(len => {
        for (let i = 0; i <= history.length - len - 1; i++) {
          const slice = history.slice(i, i + len);
          const patternStr = slice.join('');
          const nextDigit = history[i + len];

          if (!patternMap[patternStr]) {
            patternMap[patternStr] = {
              pattern: patternStr,
              appearingSymbols: new Set<string>(),
              digitCounts: Array(10).fill(0),
              totalCount: 0
            };
          }
          patternMap[patternStr].appearingSymbols.add(symbol);
          patternMap[patternStr].digitCounts[nextDigit]++;
          patternMap[patternStr].totalCount++;
        }
      });
    });

    interface PatternCandidate {
      pattern: string;
      digit: number;
      occurs: number;
      absenceRate: number;
      marketsCount: number;
      score: number;
    }

    const candidates: PatternCandidate[] = [];

    Object.keys(patternMap).forEach(patternStr => {
      const stats = patternMap[patternStr];
      const total = stats.totalCount;
      const marketsCount = stats.appearingSymbols.size;
      if (total < 1) return;

      for (let d = 0; d <= 9; d++) {
        if (excludePattern && excludeDigit !== undefined && patternStr === excludePattern && d === excludeDigit) {
          continue;
        }

        const count = stats.digitCounts[d];
        const freq = count / total;
        const absenceRate = 1.0 - freq;

        // Base score starts with total occurrences scaled by the absence rate
        let score = total * absenceRate;

        // Massive award if the digit count is exactly 0 (has never appeared following the pattern across these markets)
        if (count === 0) {
          score += 15000;
        }

        // Strongly check if the pattern appears on more than 3 markets or as high as possible
        if (marketsCount > 3) {
          score += 25000 + (marketsCount * 2000);
        } else {
          score += marketsCount * 2000;
        }

        // Slight length match bonus to prefer 3-digit patterns when score is otherwise similar
        if (patternStr.length === 3) {
          score += 100;
        }

        candidates.push({
          pattern: patternStr,
          digit: d,
          occurs: total,
          absenceRate,
          marketsCount,
          score
        });
      }
    });

    if (candidates.length === 0) {
      // Never again guess randomly! Return the existing valid custom pattern and predictor digit
      const savedPattern = localStorage.getItem('autobot_custom_pattern') || '686';
      const savedDigitStr = localStorage.getItem('autobot_pattern_smart_digit');
      const savedDigit = savedDigitStr !== null ? parseInt(savedDigitStr, 10) : 5;
      return { pattern: savedPattern, digit: savedDigit };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return { pattern: best.pattern, digit: best.digit };
  };

  useEffect(() => {
    (window as any).AUTOBOT_LEARN_PATTERN_AFTER_LOSS = (excludePattern?: string, excludeDigit?: number) => {
      const result = runPatternLearning(excludePattern, excludeDigit);
      if (result) {
        setCustomPattern(result.pattern);
        (window as any).AUTOBOT_CUSTOM_PATTERN = result.pattern;
        (window as any).AUTOBOT_PATTERN_SMART_DIGIT = result.digit;
        localStorage.setItem('autobot_custom_pattern', result.pattern);
        localStorage.setItem('autobot_pattern_smart_digit', result.digit.toString());
        setPatternSmartDigit(result.digit);
      }
      return result;
    };
    return () => {
      delete (window as any).AUTOBOT_LEARN_PATTERN_AFTER_LOSS;
    };
  }, [checkedMarketsStr]);

  const lastMessageTime = useRef<number>(Date.now());

  // Subscribe/Unsubscribe tick socket loop
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let watchInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCurrentEffect = true;
    let reconnectAttempts = 0;

    const marketsToSubscribe = JSON.parse(checkedMarketsStr) as string[];
    if (marketsToSubscribe.length === 0) {
      // Clear live ticks if nothing is selected
      setMarketTicks({});
      return;
    }

    const connect = () => {
      if (!isCurrentEffect) return;

      const wsUrl = 'wss://api.derivws.com/trading/v1/options/ws/public';
      
      console.log("[AutoBot WS] Connecting to", wsUrl);
      ws = new WebSocket(wsUrl);
      wsSubscription.current = ws;
      lastMessageTime.current = Date.now();

      ws.onopen = () => {
        if (!isCurrentEffect) {
          ws?.close();
          return;
        }
        console.log("[AutoBot WS] Connected successfully. Subscribing to markets:", marketsToSubscribe);
        reconnectAttempts = 0; // reset reconnect count on clean connect
        
        // Subscribes to checked markets with history
        marketsToSubscribe.forEach(symbol => {
          tickHistories.current[symbol] = tickHistories.current[symbol] || [];
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              ticks_history: symbol, 
              subscribe: 1,
              count: Math.max(1000, circlesTicksLimitRef.current),
              end: "latest",
              style: "ticks"
            }));
          }
        });

        // Trigger safe UI log
        setOtivoLog(prev => [`[${new Date().toLocaleTimeString()}] AI Engine connected to tick feeds.`, ...prev].slice(0, 50));
      };

      ws.onmessage = (event) => {
        if (!isCurrentEffect) return;
        lastMessageTime.current = Date.now();

        const data = JSON.parse(event.data);
        
        // Handle pong/ping responses quietly
        if (data.msg_type === 'ping' || data.ping) {
          return;
        }

        // Handle initial historical ticks response
        if (data.history && data.echo_req && data.echo_req.ticks_history) {
          const symbol = data.echo_req.ticks_history;
          const h = data.history;
          const config = MARKET_CONFIGS.find(m => m.symbol === symbol);
          const decimals = config ? config.decimals : 2;
          
          const digits = h.prices.map((p: number) => {
            return parseInt(p.toFixed(decimals).slice(-1), 10);
          });

          tickHistories.current[symbol] = digits;
          priceHistories.current[symbol] = h.prices;

          // Prewarm lookahead database
          prewarmAILookahead(symbol, digits);

          const lastPrice = h.prices[h.prices.length - 1];
          const lastDigit = digits[digits.length - 1];

          let currentPct = 0;
          let activeStreakMode = streakModeRef.current;
          if (isRecoveryStreakModeEnabledRef.current && ((window as any).AUTOBOT_CONSEC_LOSSES || 0) > 0) {
            activeStreakMode = recoveryStreakModeRef.current;
          }
          const _isRec = isRecoveryStreakModeEnabledRef.current && ((window as any).AUTOBOT_CONSEC_LOSSES || 0) > 0;
          const activeContractType = _isRec ? recoveryContractTypeRef.current : contractTypeRef.current;
          const activeTargetDigit = _isRec ? recoveryTargetDigitRef.current : targetDigitRef.current;
          const activeTargetDigit2 = targetDigit2Ref.current;
          
          if (activeStreakMode === 'percentage') {
            const recent25 = digits.slice(-25);
            let matchCount = 0;
            recent25.forEach(d => {
              let matches = false;
              if (activeContractType === 'digitover') {
                matches = d > activeTargetDigit;
              } else if (activeContractType === 'digitunder') {
                matches = d < activeTargetDigit;
              } else if (activeContractType === 'dual_ou') {
                matches = d > activeTargetDigit || d < activeTargetDigit2;
              }
              if (matches) matchCount++;
            });
            currentPct = Math.round((matchCount / Math.min(25, recent25.length)) * 100);
          }

          const initAnalytics = undefined;
          marketTicksRef.current[symbol] = {
            price: lastPrice,
            lastDigit: lastDigit,
            digits: digits.slice(-5),
            streak: 0,
            prevPrice: h.prices[h.prices.length - 2],
            percentageValue: currentPct,
            rngAnalytics: initAnalytics,
            rngSignal: null
          };

          setMarketTicks({ ...marketTicksRef.current });
          return;
        }

        if (data.tick) {
          const symbol = data.tick.symbol;
          const price = data.tick.quote;
          const config = MARKET_CONFIGS.find(m => m.symbol === symbol);
          const decimals = config ? config.decimals : 2;
          const digit = parseInt(price.toFixed(decimals).slice(-1), 10);

          // Update digit history
          if (!tickHistories.current[symbol]) tickHistories.current[symbol] = [];
          const history = tickHistories.current[symbol];
          history.push(digit);
          const maxTicksHistory = Math.max(1000, circlesTicksLimitRef.current);
          if (history.length > maxTicksHistory) history.shift();

          // Update price history
          if (!priceHistories.current[symbol]) priceHistories.current[symbol] = [];
          const rPrices = priceHistories.current[symbol];
          rPrices.push(price);
          if (rPrices.length > 300) rPrices.shift();

          // Calculate current streak
          let currentStreak = 0;
          let detectedDigit = digit;
          let coldDigit: number | null = null;
          const recentSubset = history.slice(-20);

          let patternMatched = false;
          let bestDifferDigit: number | undefined = undefined;
          let matchedPatternKey: string | undefined = undefined;

          const consecLosses = (window as any).AUTOBOT_CONSEC_LOSSES || 0;
          const isRecActive = isRecoveryStreakModeEnabledRef.current && consecLosses > 0;

          let activeStreakMode = streakModeRef.current;
          if (isRecActive) {
            activeStreakMode = recoveryStreakModeRef.current;
          }

          const activeCustomPattern = isRecActive 
            ? ((window as any).AUTOBOT_RECOVERY_CUSTOM_PATTERN || recoveryCustomPatternRef.current || '686') 
            : ((window as any).AUTOBOT_CUSTOM_PATTERN || customPatternRef.current || '686');

          const activeTargetDigit = isRecActive ? recoveryTargetDigitRef.current : targetDigitRef.current;
          const activeTargetDigit2 = targetDigit2Ref.current;
          const activeContractType = isRecActive ? recoveryContractTypeRef.current : contractTypeRef.current;

          let activeStreakThreshold = isRecActive ? recoveryStreakThresholdRef.current : streakThresholdRef.current;
          if (activeStreakMode === 'consecutive') {
            const isPostLossEnabled = isRecActive ? recoveryIsLossStreakThresholdEnabledRef.current : isLossStreakThresholdEnabledRef.current;
            if (isPostLossEnabled && consecLosses > 0) {
              activeStreakThreshold = isRecActive ? recoveryLossStreakThresholdRef.current : lossStreakThresholdRef.current;
            }
          }

          // Resolve types mode toggles dynamically
          const activeTypesTransitionMatrix = isRecActive ? recoveryTypesTransitionMatrixRef.current : typesTransitionMatrixRef.current;
          const activeTypesMirrorDigitReversal = isRecActive ? recoveryTypesMirrorDigitReversalRef.current : typesMirrorDigitReversalRef.current;
          const activeTypesTickCompression = isRecActive ? recoveryTypesTickCompressionRef.current : typesTickCompressionRef.current;
          const activeTypesHiddenCycleLength = isRecActive ? recoveryTypesHiddenCycleLengthRef.current : typesHiddenCycleLengthRef.current;

          // Resolve pattern mode toggles dynamically
          const activePatternSmartMode = isRecActive ? recoveryPatternSmartModeRef.current : patternSmartModeRef.current;
          const activePatternRotationalMode = isRecActive ? recoveryPatternRotationalModeRef.current : patternRotationalModeRef.current;
          const activePatternRecoveryMode = isRecActive ? recoveryPatternRecoveryModeRef.current : patternRecoveryModeRef.current;
          const activeOuPatternSelection = isRecActive ? recoveryOuPatternSelectionRef.current : ouPatternSelectionRef.current;

          // Compute analytical values for Mirror, Volatility, and Cycles
          let currentVolatility = 0;
          let compressionActive = false;
          let cycleDetectedValue = 0;
          let mirrorActiveValue = false;

          // 1. Calculate Tick Compression Breakthrough variables
          if (rPrices.length >= 5) {
            const recent5 = rPrices.slice(-5);
            const pMin = Math.min(...recent5);
            const pMax = Math.max(...recent5);
            currentVolatility = pMax - pMin;
            const compThreshold = config && config.decimals > 3 ? 0.005 : 0.08;
            if (currentVolatility < compThreshold) {
              compressionActive = true;
            }
          }

          // 2. Calculate Hidden Cycle Length variables
          if (history.length >= 10) {
            for (let L = 3; L <= 6; L++) {
              if (history.length >= L * 2) {
                const M = L - 1;
                const suffix = history.slice(-M);
                const prev = history.slice(-M - L, -L);
                if (suffix.every((v, i) => v === prev[i])) {
                  cycleDetectedValue = L;
                  break;
                }
              }
            }
          }

          // 3. Calculate Mirror Digit Reversal variables
          if (history.length >= 7) {
            const recent7 = history.slice(-7);
            const counts: Record<number, number> = {};
            recent7.forEach(d => counts[d] = (counts[d] || 0) + 1);
            let maxCount = 0;
            for (const k in counts) {
              const dVal = parseInt(k, 10);
              if (counts[dVal] > maxCount) {
                maxCount = counts[dVal];
              }
            }
            if (maxCount >= 4) {
              mirrorActiveValue = true;
            }
          }

          // Evaluate "Types Mode" option strategies dynamically
          let typesSignal: { prediction: number; reason: string; strategyName: string } | null = null;
          if (activeStreakMode === 'types') {
            // Evaluated child strategies:
            
            // 1. Digit Transition Matrix Strategy (Very Powerful)
            let transitionSig: { prediction: number; reason: string } | null = null;
            if (activeTypesTransitionMatrix && history.length >= 15) {
              const lastD = history[history.length - 1];
              const counts: Record<number, number> = {};
              for (let i = 0; i < history.length - 1; i++) {
                if (history[i] === lastD) {
                  const nextD = history[i + 1];
                  counts[nextD] = (counts[nextD] || 0) + 1;
                }
              }
              let bestNext = -1;
              let maxCount = 0;
              for (let d = 0; d <= 9; d++) {
                if ((counts[d] || 0) > maxCount) {
                  maxCount = counts[d];
                  bestNext = d;
                }
              }
              if (bestNext !== -1 && maxCount >= 2) {
                transitionSig = {
                  prediction: bestNext,
                  reason: `Transition Matrix: ${lastD} -> ${bestNext} (freq: ${maxCount})`
                };
              }
            }

            // 2. Mirror Digit Reversal Strategy
            let mirrorSig: { prediction: number; reason: string } | null = null;
            if (activeTypesMirrorDigitReversal && history.length >= 7) {
              const mirrorMap: Record<number, number> = {
                0: 9, 1: 8, 2: 7, 3: 6, 4: 5,
                9: 0, 8: 1, 7: 2, 6: 3, 5: 4
              };
              const recent7 = history.slice(-7);
              const counts: Record<number, number> = {};
              recent7.forEach(d => counts[d] = (counts[d] || 0) + 1);
              let maxCount = 0;
              let domDigit = -1;
              for (const k in counts) {
                const dVal = parseInt(k, 10);
                if (counts[dVal] > maxCount) {
                  maxCount = counts[dVal];
                  domDigit = dVal;
                }
              }
              // If we have a dominant highly repeated digit, momentum is building to its mirror pair partner
              if (maxCount >= 4 && domDigit !== -1) {
                const partner = mirrorMap[domDigit];
                mirrorSig = {
                  prediction: domDigit, // Avoid domDigit since reversal pressure is towards its partner
                  reason: `Mirror Reversal: ${domDigit} dominant (${maxCount}/7), reversal target ${partner}`
                };
              }
            }

            // 3. Tick Compression Breakout Strategy
            let compressionSig: { prediction: number; reason: string } | null = null;
            if (activeTypesTickCompression && rPrices.length >= 6) {
              // Check the 5 prices before the last price to see if they were compressed
              const compPrices = rPrices.slice(-6, -1);
              const compMin = Math.min(...compPrices);
              const compMax = Math.max(...compPrices);
              const compVol = compMax - compMin;
              const compThreshold = config && config.decimals > 3 ? 0.005 : 0.08;
              
              if (compVol < compThreshold) {
                const lastPrice = rPrices[rPrices.length - 1];
                const prevPriceVal = rPrices[rPrices.length - 2];
                const lastChange = Math.abs(lastPrice - prevPriceVal);
                
                // If breakout expands relative to the compressed range
                if (lastChange > compVol * 1.5 && lastChange > (config && config.decimals > 3 ? 0.001 : 0.01)) {
                  compressionSig = {
                    prediction: digit, // Current breakout digit is avoided
                    reason: `Compression Breakout: Vol ${compVol.toFixed(decimals)} expanded by ${lastChange.toFixed(decimals)} to digit ${digit}`
                  };
                }
              }
            }

            // 4. Hidden Cycle Length Strategy
            let cycleSig: { prediction: number; reason: string } | null = null;
            if (activeTypesHiddenCycleLength && history.length >= 10) {
              for (let L = 3; L <= 6; L++) {
                if (history.length >= L * 2) {
                  // Check partial cycle match first
                  const M = L - 1;
                  const suffixM = history.slice(-M);
                  const prevM = history.slice(-M - L, -L);
                  if (suffixM.every((v, i) => v === prevM[i])) {
                    const nextD = history[history.length - L];
                    cycleSig = {
                      prediction: nextD,
                      reason: `Hidden Cycle (L=${L}): [${suffixM.join(',')}] matches previous, next ${nextD}`
                    };
                    break;
                  }
                  // Check full cycle match
                  const suffixL = history.slice(-L);
                  const prevL = history.slice(-2 * L, -L);
                  if (suffixL.every((v, i) => v === prevL[i])) {
                    const nextD = suffixL[0];
                    cycleSig = {
                      prediction: nextD,
                      reason: `Hidden Cycle (L=${L} Full): [${suffixL.join(',')}] repeats, next ${nextD}`
                    };
                    break;
                  }
                }
              }
            }

            // Determine active signal prioritization:
            // Transition Matrix -> Hidden Cycle Length -> Mirror Digit Reversal -> Tick Compression Breakout
            if (transitionSig) {
              typesSignal = {
                prediction: transitionSig.prediction,
                reason: transitionSig.reason,
                strategyName: 'Digit Transition Matrix'
              };
            } else if (cycleSig) {
              typesSignal = {
                prediction: cycleSig.prediction,
                reason: cycleSig.reason,
                strategyName: 'Hidden Cycle Length'
              };
            } else if (mirrorSig) {
              typesSignal = {
                prediction: mirrorSig.prediction,
                reason: mirrorSig.reason,
                strategyName: 'Mirror Digit Reversal'
              };
            } else if (compressionSig) {
              typesSignal = {
                prediction: compressionSig.prediction,
                reason: compressionSig.reason,
                strategyName: 'Tick Compression Breakout'
              };
            }
          }

          if (activeStreakMode === 'pattern') {
            const parsedSubPatterns = activeCustomPattern
              .split(',')
              .map(part => {
                const trimmed = part.trim();
                if (trimmed.includes('=')) {
                  const eqIndex = trimmed.indexOf('=');
                  const seqStr = trimmed.slice(0, eqIndex).replace(/[^0-9]/g, '');
                  const digitStr = trimmed.slice(eqIndex + 1).replace(/[^0-9]/g, '');
                  const digit = digitStr.length > 0 ? parseInt(digitStr, 10) : undefined;
                  return { sequence: seqStr, digit };
                } else {
                  const seqStr = trimmed.replace(/[^0-9]/g, '');
                  return { sequence: seqStr, digit: undefined };
                }
              })
              .filter(p => p.sequence.length > 0);

            let matchedDigitSpecified: number | undefined = undefined;

            patternMatched = parsedSubPatterns.some(p => {
              const patternDigits = p.sequence.split('').map(char => parseInt(char, 10));
              if (patternDigits.length > 0 && history.length >= patternDigits.length) {
                const lastSlice = history.slice(-patternDigits.length);
                const isMatch = patternDigits.every((d, i) => lastSlice[i] === d);
                if (isMatch) {
                  const pKey = p.digit !== undefined ? `${p.sequence}=${p.digit}` : p.sequence;
                  const lostPatterns = (window as any).AUTOBOT_LOST_PATTERNS || [];
                  const consecLosses = (window as any).AUTOBOT_CONSEC_LOSSES || 0;
                  if (activePatternRecoveryMode && consecLosses > 0 && lostPatterns.includes(pKey)) {
                    return false;
                  }

                  if (activePatternRotationalMode) {
                    const rotIdx = patternRotationalIdx.current[p.sequence] || 0;
                    matchedDigitSpecified = patternDigits[rotIdx];
                  } else if (p.digit !== undefined) {
                    matchedDigitSpecified = p.digit;
                  }
                  matchedPatternKey = pKey;
                  return true;
                }
              }
              return false;
            });

            if (patternMatched) {
              if (matchedDigitSpecified !== undefined) {
                bestDifferDigit = matchedDigitSpecified;
              } else if (activePatternSmartMode) {
                const activePatternSmartDigit = isRecActive 
                  ? ((window as any).AUTOBOT_RECOVERY_PATTERN_SMART_DIGIT || recoveryPatternSmartDigitRef.current)
                  : ((window as any).AUTOBOT_PATTERN_SMART_DIGIT || patternSmartDigitRef.current);
                if (activePatternSmartDigit !== undefined && activePatternSmartDigit !== null) {
                  bestDifferDigit = activePatternSmartDigit;
                } else {
                  // Find coldest / least frequent digit in the last 15 ticks
                  const recentWindow = history.slice(-15);
                  const allDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
                  const counts: Record<number, number> = {};
                  allDigits.forEach(d => counts[d] = 0);
                  recentWindow.forEach(d => counts[d] = (counts[d] || 0) + 1);
                  
                  let minCount = Infinity;
                  let candidate = activeTargetDigit;
                  allDigits.forEach(d => {
                    if (counts[d] < minCount) {
                      minCount = counts[d];
                      candidate = d;
                    }
                  });
                  bestDifferDigit = candidate;
                }
              } else {
                bestDifferDigit = activeTargetDigit;
              }
            }
          } else if (activeTargetDigit === -1) {
            if (recentSubset.length > 0) {
              const lastD = recentSubset[recentSubset.length - 1];
              detectedDigit = lastD;
              for (let i = recentSubset.length - 1; i >= 0; i--) {
                if (recentSubset[i] === lastD) {
                  currentStreak++;
                } else {
                  break;
                }
              }
            }
          } else {
            for (let i = recentSubset.length - 1; i >= 0; i--) {
              const d = recentSubset[i];
              let matches = false;
              if (activeStreakMode === 'consecutive') {
                if (activeContractType === 'dual_ou') {
                  matches = d > activeTargetDigit || d < activeTargetDigit2;
                } else {
                  matches = d === activeTargetDigit;
                }
              } else if (activeStreakMode === 'consecutive_touch') {
                const isOver = activeContractType === 'digitover' || (activeContractType === 'over_under' && activeOuPatternSelection !== 'under8');
                const barrier = activeContractType === 'over_under' 
                  ? (activeOuPatternSelection === 'under8' ? 8 : 1) 
                  : (isOver ? ((activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 1) : ((activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8));
                // Opposing streak: for Over 1, digit <= 1 (i.e. 0 or 1); for Under 8, digit >= 8 (8 or 9)
                matches = isOver ? d <= barrier : d >= barrier;
              } else {
                if (activeContractType === 'digitover') {
                  matches = d > activeTargetDigit;
                } else if (activeContractType === 'digitunder') {
                  matches = d < activeTargetDigit;
                } else if (activeContractType === 'digitdiff') {
                  matches = d !== activeTargetDigit;
                } else if (activeContractType === 'digitmatch') {
                  matches = d === activeTargetDigit;
                } else if (activeContractType === 'dual_ou') {
                  matches = d > activeTargetDigit || d < activeTargetDigit2;
                }
              }

              if (matches) {
                currentStreak++;
              } else {
                break;
              }
            }
          }

          let currentPct = 0;
          if (activeStreakMode === 'percentage') {
            const recent25 = history.slice(-25);
            let matchCount = 0;
            recent25.forEach(d => {
              let matches = false;
              if (activeContractType === 'digitover') {
                matches = d > activeTargetDigit;
              } else if (activeContractType === 'digitunder') {
                matches = d < activeTargetDigit;
              } else if (activeContractType === 'dual_ou') {
                matches = d > activeTargetDigit || d < activeTargetDigit2;
              }
              if (matches) matchCount++;
            });
            currentPct = Math.round((matchCount / Math.min(25, recent25.length)) * 100);
          }

          // Compute RNG Indicator analytics (only if activeStreakMode === 'rng')
          const showRngDashboard = false;
          const rngAnalytics = undefined;

          let rngSignal: { prediction: number; zScore: number; reason: string } | null = null;
          let survivalSignals: Array<{ id: string; prob: number; survival: number; r: number; c: number }> = [];
          const markovMatrix: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(0));
          const markovRowTotals: number[] = new Array(10).fill(0);

          if (showRngDashboard && history.length >= 500) {
            // Build the live Markov Chain transition matrix from tick history
            for (let i = 1; i < history.length; i++) {
              const previous = history[i - 1];
              const current = history[i];
              if (previous >= 0 && previous <= 9 && current >= 0 && current <= 9) {
                markovMatrix[previous][current]++;
                markovRowTotals[previous]++;
              }
            }

            // Detect state transition frequencies hitting our strict >98% survival limit
            for (let r = 0; r < 10; r++) {
              if (markovRowTotals[r] === 0) continue;
              for (let c = 0; c < 10; c++) {
                const conditionalProb = markovMatrix[r][c] / markovRowTotals[r];
                const survivalRate = (1.0 - conditionalProb) * 100;

                if (survivalRate >= 98.0 && markovMatrix[r][c] > 0) {
                  survivalSignals.push({
                    id: `${r} → ${c}`,
                    prob: Math.round(conditionalProb * 1000) / 10,
                    survival: Math.round(survivalRate * 100) / 100,
                    r,
                    c
                  });
                }
              }
            }

            // If the current last state transitions to a target state c with survival probability >= 98%
            const lastD = history[history.length - 1];
            const activeMatches = survivalSignals.filter(sig => sig.r === lastD);
            if (activeMatches.length > 0) {
              activeMatches.sort((a, b) => b.survival - a.survival);
              const bestMatch = activeMatches[0];
              rngSignal = {
                prediction: bestMatch.c,
                zScore: bestMatch.survival, // Store survival Rate into legacy zScore variable to guarantee robust compilation
                reason: `Markov Chain Anomaly: Transition ${bestMatch.id} probability is ${bestMatch.prob}% (Survival Rate: ${bestMatch.survival}%)`
              };
            }
          }

          updateAILookaheadPattern(symbol, history);

          let aiLearnerSignal: any = null;
          let aiLearnerPatterns: any[] = [];

          if (aiLUseLookaheadRef.current) {
            const { signal: lookaheadSig, verifiedPatterns } = computeAILookaheadSignal(symbol, history, aiLLookaheadThresholdRef.current);
            if (lookaheadSig) {
              aiLearnerSignal = {
                prediction: lookaheadSig.prediction,
                probability: 0,
                confidence: lookaheadSig.confidence,
                occurrences: lookaheadSig.occurrences,
                sequence: lookaheadSig.sequence,
                isLookahead: true
              };
            }
            aiLearnerPatterns = verifiedPatterns;
          } else {
            const { signal, activePatterns } = computeAILearnerSignal(history);
            aiLearnerSignal = signal;
            aiLearnerPatterns = activePatterns;
          }

          const { signal: axaSignal, metrics: axaMetrics } = computeAXASignal(history, symbol);
          const { signal: overUnderScannerSignal, metrics: overUnderMetrics } = computeOverUnderScannerSignal(
            history,
            ouSamplePeriodRef.current,
            ouColdThresholdMaxRef.current,
            ouSingleDigitMaxRef.current
          );
          const symbolPrices = priceHistories.current[symbol] || [];
          const { signal: edmsSignal, metrics: edmsMetrics } = computeEDMSSignal(symbolPrices, history);
          const overUnderSignal = isEdmsEnabledRef.current ? edmsSignal : overUnderScannerSignal;

          const ladPrngSignal = computeLADPrngSignal(
            history,
            symbol,
            symbolPrices,
            pmfPatternLenRef.current,
            pmfMinOccurrencesRef.current,
            pmfFollowerLenRef.current
          );

          const { signal: differsCalmNoiseSignal, metrics: differsCalmNoiseMetrics } = computeDiffersCalmNoiseSignal(
            history,
            symbolPrices,
            symbol,
            {
              maxNoiseScore: differsNoiseMaxScoreRef.current,
              minCalmTicks: differsNoiseMinCalmTicksRef.current
            }
          );

          if (differsCalmNoiseSignal && differsNoiseTargetModeRef.current === 'top_calm') {
            let topDigit = differsCalmNoiseSignal.prediction;
            let maxCalm = -1;
            for (const s of differsCalmNoiseMetrics.digitStats) {
              if (s.calmCount > maxCalm) {
                maxCalm = s.calmCount;
                topDigit = s.digit;
              }
            }
            differsCalmNoiseSignal.prediction = topDigit;
            differsCalmNoiseSignal.calmDigit = topDigit;
          }

          const activePriceDigitsInput = isRecActive
            ? ((window as any).AUTOBOT_RECOVERY_PRICE_DIGITS_INPUT || recoveryPriceDigitsInputRef.current || '.01, .1780, .392')
            : ((window as any).AUTOBOT_PRICE_DIGITS_INPUT || priceDigitsInputRef.current || '.01, .1780, .392');

          const priceDigitsSignal = evaluatePriceDigitsSignal(price, decimals, activePriceDigitsInput);

          let accumulatorMetrics: any = null;
          if (symbolPrices.length >= 25) {
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

            // Trend Exhaustion
            if (symbolPrices.length >= 55) {
              const ema20Diff = Math.abs(ema20[ema20.length - 1] - ema20[ema20.length - 3]);
              const ema50Diff = Math.abs(ema50[ema50.length - 1] - ema50[ema50.length - 3]);
              const isEma20Flat = ema20Diff < (ema20[ema20.length - 1] * 0.0001);
              const isEma50Flat = ema50Diff < (ema50[ema50.length - 1] * 0.0001);
              const isRsiInRegion = rsiValue >= 45 && rsiValue <= 55;
              const recentChanges = symbolPrices.slice(-5).map((p, idx, arr) => idx > 0 ? Math.abs(p - arr[idx - 1]) : 0).slice(1);
              const avgRecentChange = recentChanges.reduce((a, b) => a + b, 0) / Math.max(1, recentChanges.length);
              const historicalChanges = symbolPrices.slice(-25).map((p, idx, arr) => idx > 0 ? Math.abs(p - arr[idx - 1]) : 0).slice(1);
              const avgHistoricalChange = historicalChanges.reduce((a, b) => a + b, 0) / Math.max(1, historicalChanges.length);
              const isCandlesSmaller = avgRecentChange < avgHistoricalChange;
              satisfied['trend_exhaustion'] = isEma20Flat && isEma50Flat && isRsiInRegion && isCandlesSmaller;
            } else {
              satisfied['trend_exhaustion'] = false;
            }

            // BB Squeeze
            const currentStdDev = bb.stdDev;
            const historicalStdDevs: number[] = [];
            for (let i = symbolPrices.length - 40; i <= symbolPrices.length - 20; i++) {
              if (i >= 20) {
                historicalStdDevs.push(calculateBollingerBands(symbolPrices.slice(0, i), 20, 2).stdDev);
              }
            }
            const avgHistStdDev = historicalStdDevs.reduce((a, b) => a + b, 0) / (historicalStdDevs.length || 1);
            const isNarrow = currentStdDev < avgHistStdDev * 0.95;
            const channelWidth = bb.upper - bb.lower;
            const isNearMiddle = channelWidth > 0 && Math.abs(symbolPrices[symbolPrices.length - 1] - bb.middle) < (channelWidth * 0.15);
            const last5 = symbolPrices.slice(-5);
            const noBreakout = last5.every(p => p >= bb.lower && p <= bb.upper);
            satisfied['bb_squeeze'] = isNarrow && isNearMiddle && noBreakout;

            // ATR Volatility
            const isLowerThanAvg = atrData.current < atrData.average;
            const prevAtr = calculateATR(symbolPrices.slice(0, -1), 14).current;
            const isFlatOrDecreasing = atrData.current <= prevAtr * 1.01;
            satisfied['atr_volatility'] = isLowerThanAvg && isFlatOrDecreasing;

            // ADX Range
            const isAdxLow = adxData.adx < 25;
            const isSideways = Math.abs(adxData.plusDI - adxData.minusDI) < 20;
            satisfied['adx_range'] = isAdxLow && isSideways;

            // Tick Speed
            const isSpeedLow = tickStats.speed < (tickStats.speed + tickStats.acceleration) * 0.6;
            const isVarianceLow = tickStats.stdDev < tickStats.avgStdDev;
            satisfied['tick_speed'] = isSpeedLow && isVarianceLow;

            // MA Flatness
            if (symbolPrices.length >= 55) {
              const currentEma20 = ema20[ema20.length - 1];
              const currentEma50 = ema50[ema50.length - 1];
              const separation = Math.abs(currentEma20 - currentEma50) / currentEma50;
              const isDistanceSmall = separation < 0.0005;
              const ema20Slope = Math.abs(ema20[ema20.length - 1] - ema20[ema20.length - 5]) / currentEma20;
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

            // Donchian Range
            const currentPrice = symbolPrices[symbolPrices.length - 1];
            const range = donchian.upper - donchian.lower;
            if (range === 0) {
              satisfied['donchian_range'] = true;
            } else {
              const isNotExtreme = (currentPrice > donchian.lower + range * 0.1) && (currentPrice < donchian.upper - range * 0.1);
              const isNearCenter = Math.abs(currentPrice - donchian.center) < (range * 0.3);
              satisfied['donchian_range'] = isNotExtreme && isNearCenter;
            }

            // Keltner Stability
            const distFromCenter = Math.abs(currentPrice - keltner.center);
            const channelHeight = keltner.upper - keltner.lower;
            if (channelHeight === 0) {
              satisfied['keltner_stability'] = true;
            } else {
              const isNearCenter = distFromCenter < (channelHeight * 0.2);
              satisfied['keltner_stability'] = isNearCenter;
            }

            // Std Dev
            satisfied['std_dev'] = tickStats.stdDev < tickStats.avgStdDev;

            // AI Volatility
            satisfied['ai_volatility'] = aiProb >= 80;

            // Accu Noise Strategy (choppiness & tick variance calm detector)
            const accuNoiseSignal = computeAccuNoiseSignal(symbolPrices, symbol);
            satisfied['accu_noise'] = accuNoiseSignal.signal === 'BUY_ACCU';

            accumulatorMetrics = {
              rsiValue,
              ema20: ema20[ema20.length - 1],
              ema50: ema50[ema50.length - 1],
              bb,
              atrData,
              adxData,
              tickStats,
              donchian,
              keltner,
              aiProb,
              accuNoise: accuNoiseSignal,
              satisfied
            };
          }

          // Evaluate Consecutive & Touch Strategy for this market tick
          let consecTouchMatched = false;
          const activeOpposingTicksReq = isRecActive 
            ? recoveryConsecTouchOpposingTicksRef.current 
            : consecTouchOpposingTicksRef.current;
          const activeTargetTouchesReq = isRecActive 
            ? recoveryConsecTouchTargetDigitsRef.current 
            : consecTouchTargetDigitsRef.current;
          const activeTouchType = isRecActive
            ? recoveryConsecTouchTouchTypeRef.current
            : consecTouchTouchTypeRef.current;

          const isOverTarget = activeContractType === 'digitover' || (activeContractType === 'over_under' && activeOuPatternSelection !== 'under8');
          // For Over 1 (activeContractType === 'over_under'), barrier is strictly 1
          // For Under 8 (activeContractType === 'over_under'), barrier is strictly 8
          const activeBarrier = activeContractType === 'over_under'
            ? (activeOuPatternSelection === 'under8' ? 8 : 1)
            : isOverTarget 
            ? ((activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 1)
            : ((activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8);

          // For Over 1: opposing is <= 1 (i.e. digit 0 or 1: 0,0 / 1,1 / 0,1 / 1,0); target touch is > 1
          // For Under 8: opposing is >= 8 (i.e. digit 8 or 9: 8,8 / 9,9 / 8,9 / 9,8); target touch is < 8
          const checkIsOpposing = (d: number) => isOverTarget ? d <= activeBarrier : d >= activeBarrier;
          const checkIsTargetTouch = (d: number) => {
            if (activeTouchType === 'any') return true;
            return isOverTarget ? d > activeBarrier : d < activeBarrier;
          };

          const reqTouches = Math.max(1, activeTargetTouchesReq);
          const reqOpposing = Math.max(1, activeOpposingTicksReq);

          let curOpposingCount = 0;
          let curTouchCount = 0;
          let curStreakAchieved = false;

          if (history.length >= reqOpposing) {
            // Check if current tick finishes the touch requirement after a consecutive opposing streak
            let trailingTouches = 0;
            for (let i = history.length - 1; i >= 0 && trailingTouches < reqTouches; i--) {
              if (checkIsTargetTouch(history[i])) {
                trailingTouches++;
              } else {
                break;
              }
            }

            // Immediately preceding those trailingTouches, count consecutive opposing digits
            let precedingOpposing = 0;
            for (let i = history.length - 1 - trailingTouches; i >= 0; i--) {
              if (checkIsOpposing(history[i])) {
                precedingOpposing++;
              } else {
                break;
              }
            }

            if (precedingOpposing >= reqOpposing) {
              curStreakAchieved = true;
              curOpposingCount = precedingOpposing;
              curTouchCount = trailingTouches;

              // Triggers if this tick is a touch digit and completes the touch count requirement
              if (trailingTouches >= reqTouches && checkIsTargetTouch(digit)) {
                consecTouchMatched = true;
              }
            } else {
              // Streak has not transitioned to touches yet; count trailing opposing digits ending at current tick
              let trailingOpposing = 0;
              for (let i = history.length - 1; i >= 0; i--) {
                if (checkIsOpposing(history[i])) {
                  trailingOpposing++;
                } else {
                  break;
                }
              }
              curOpposingCount = trailingOpposing;
              curStreakAchieved = trailingOpposing >= reqOpposing;
              curTouchCount = 0;
            }
          }

          if (!consecTouchPerMarket.current[symbol]) {
            consecTouchPerMarket.current[symbol] = { opposingCount: 0, streakAchieved: false, touchCount: 0 };
          }
          const ctState = consecTouchPerMarket.current[symbol];
          ctState.opposingCount = curOpposingCount;
          ctState.streakAchieved = curStreakAchieved;
          ctState.touchCount = curTouchCount;

          const oldTickData = marketTicksRef.current[symbol];
          marketTicksRef.current[symbol] = {
            price,
            lastDigit: digit,
            digits: history.slice(-5),
            streak: currentStreak,
            prevPrice: oldTickData ? oldTickData.price : undefined,
            coldDigit,
            patternMatched,
            bestDifferDigit,
            matchedPatternKey,
            volatility: currentVolatility,
            compressionActive,
            cycleLength: cycleDetectedValue,
            mirrorActive: mirrorActiveValue,
            typesSignal,
            percentageValue: currentPct,
            rngAnalytics,
            rngSignal,
            survivalSignals,
            markovMatrix,
            markovRowTotals,
            aiLearnerSignal,
            aiLearnerPatterns,
            axaSignal,
            axaMetrics,
            overUnderSignal,
            overUnderMetrics,
            edmsSignal,
            edmsMetrics,
            accumulatorMetrics,
            ladPrngSignal,
            differsCalmNoiseSignal,
            differsCalmNoiseMetrics,
            priceDigitsSignal,
            consecTouchData: {
              opposingCount: ctState.opposingCount,
              streakAchieved: ctState.streakAchieved,
              touchCount: ctState.touchCount,
              reqOpposing: activeOpposingTicksReq,
              reqTouches: activeTargetTouchesReq,
              isOverTarget,
              activeBarrier,
              touchType: activeTouchType
            }
          };

          const nowMs = Date.now();
          if (nowMs - lastStateUpdateRef.current > 200) {
            setMarketTicks({ ...marketTicksRef.current });
            lastStateUpdateRef.current = nowMs;
            if (stateUpdateTimeoutRef.current) {
              clearTimeout(stateUpdateTimeoutRef.current);
              stateUpdateTimeoutRef.current = null;
            }
          } else {
            if (!stateUpdateTimeoutRef.current) {
              stateUpdateTimeoutRef.current = setTimeout(() => {
                setMarketTicks({ ...marketTicksRef.current });
                lastStateUpdateRef.current = Date.now();
                stateUpdateTimeoutRef.current = null;
              }, 200);
            }
          }

          // Run Scanner pattern evaluations
          if (history.length >= 20) {
            detectNeuralPatterns(symbol, history);
          }

          // Circles Mode calculations if needed
          let circleTargetDigit: number | null = null;
          let circleTriggered = false;
          let circleStrategyLabel = "";

          if (isCirclesModeRef.current || activeStreakMode.startsWith('circle_')) {
            const fullHistory = tickHistories.current[symbol] || [];
            const circlesHistory = fullHistory.slice(-circlesTicksLimitRef.current);
            const totalDigitTicks = circlesHistory.length;

            const digitCounts = new Array(10).fill(0);
            circlesHistory.forEach(d => {
              if (d >= 0 && d <= 9) {
                digitCounts[d]++;
              }
            });

            const digitStats = Array.from({ length: 10 }, (_, digit) => {
              const count = digitCounts[digit];
              const percentage = totalDigitTicks > 0 ? (count / totalDigitTicks) * 100 : 10;
              return { digit, percentage, count };
            });

            // Sort descending to find ranks
            const rankedDigits = [...digitStats].sort((a, b) => b.percentage - a.percentage);

            if (activeStreakMode === 'circle_green') {
              circleTargetDigit = rankedDigits[0].digit;
              circleTriggered = true; // Trigger on tick
              circleStrategyLabel = `Circle GREEN [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_blue') {
              circleTargetDigit = rankedDigits.length >= 2 ? rankedDigits[1].digit : rankedDigits[0].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle BLUE [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_orange') {
              circleTargetDigit = rankedDigits.length >= 10 ? rankedDigits[8].digit : rankedDigits[rankedDigits.length - 1].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle ORANGE [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_red') {
              circleTargetDigit = rankedDigits[rankedDigits.length - 1].digit;
              circleTriggered = true;
              circleStrategyLabel = `Circle RED [${circleTargetDigit}]`;
            } else if (activeStreakMode === 'circle_target_pct') {
              // Compare mode & Target pct logic
              const compareMode = circleCompareModeRef.current;
              const targetPct = circleTargetPctRef.current;
              const filterDigitsStr = circleFilterDigitsRef.current || 'all';

              const allowedDigits = filterDigitsStr.toLowerCase() === 'all'
                ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
                : filterDigitsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(d => !isNaN(d) && d >= 0 && d <= 9);

              for (let d = 0; d <= 9; d++) {
                if (!allowedDigits.includes(d)) continue;
                const freq = digitStats[d].percentage;
                const isMatch = compareMode === 'higher' ? freq >= targetPct : freq <= targetPct;
                if (isMatch) {
                  circleTargetDigit = d;
                  circleTriggered = true;
                  circleStrategyLabel = `Circle Pct [${d}] (${freq.toFixed(1)}% ${compareMode === 'higher' ? '>=' : '<='} ${targetPct}%)`;
                  break;
                }
              }
            } else if (activeStreakMode === 'circle_over_under') {
              const targetType = activeContractType === 'digitover' ? 'over' : activeContractType === 'digitunder' ? 'under' : (circleOuTargetTypeRef.current || 'over');
              const barrierDigit = circleOuDigitRef.current !== undefined ? circleOuDigitRef.current : (targetType === 'over' ? 1 : 8);
              const maxPct = circleOuMaxPctRef.current !== undefined ? circleOuMaxPctRef.current : 9.0;
              const rawLowDigits = circleOuLowDigitsRef.current || (targetType === 'over' ? '0,1' : '8,9');
              const parsedLowDigits = rawLowDigits
                .split(/[,\s]+/)
                .map(s => parseInt(s.trim(), 10))
                .filter(n => !isNaN(n) && n >= 0 && n <= 9);
              const lowDigitsArr = parsedLowDigits.length > 0 ? parsedLowDigits : (targetType === 'over' ? [0, 1] : [8, 9]);
              const lowDigitsSet = new Set(lowDigitsArr);
              const lowTouchMode = circleOuLowTouchModeRef.current || 'consecutive';
              const requiredOverTouches = circleOuOverTouchCountRef.current || 3;
              const maxFinalTicks = circleOuFinalTouchMaxTicksRef.current || 3;

              let isMarketFocused = false;
              let mState = circleOuMarketStatesRef.current[symbol] || null;

              if (!isRunningRef.current) {
                circleOuConsecutiveCountRef.current[symbol] = 0;
                mState = {
                  stage: 'WAITING_LOW_TOUCH',
                  lowTouchedDigits: [],
                  consecutiveLowCount: 0,
                  overTouchCount: 0,
                  finalTouchTicksElapsed: 0,
                  lastUpdated: Date.now()
                };
                circleOuMarketStatesRef.current[symbol] = mState;
                (window as any).AUTOBOT_LOCKED_MARKET = null;
                circleTriggered = false;
              } else if ((window as any).AUTOBOT_TARGET || ((window as any).AUTOBOT_SIGNAL_QUEUE && (window as any).AUTOBOT_SIGNAL_QUEUE.length > 0)) {
                // A trade is currently active or queued - do not trigger additional trades
                circleTriggered = false;
              } else if (totalDigitTicks >= 10) {
                // 1. Check if ONLY the numbers in lowDigits have percentage frequency strictly below maxPct
                isMarketFocused = true;
                for (let d = 0; d <= 9; d++) {
                  const count = digitCounts[d] || 0;
                  const pct = (count / totalDigitTicks) * 100;
                  if (lowDigitsSet.has(d)) {
                    if (pct >= maxPct) {
                      isMarketFocused = false;
                      break;
                    }
                  } else {
                    if (pct < maxPct) {
                      isMarketFocused = false;
                      break;
                    }
                  }
                }

                if (!mState) {
                  mState = {
                    stage: 'WAITING_LOW_TOUCH',
                    lowTouchedDigits: [],
                    consecutiveLowCount: 0,
                    overTouchCount: 0,
                    finalTouchTicksElapsed: 0,
                    lastUpdated: Date.now()
                  };
                  circleOuMarketStatesRef.current[symbol] = mState;
                }

                if (!isMarketFocused) {
                  // Market does not meet the "only low digits below threshold" criteria
                  mState.stage = 'WAITING_LOW_TOUCH';
                  mState.lowTouchedDigits = [];
                  mState.consecutiveLowCount = 0;
                  mState.overTouchCount = 0;
                  mState.finalTouchTicksElapsed = 0;
                  circleTriggered = false;
                } else {
                  // Market IS FOCUSED! All and ONLY lowDigits are below maxPct!
                  const isLowDigit = lowDigitsSet.has(digit);
                  const isOverDigit = !isLowDigit;

                  if (mState.stage === 'WAITING_LOW_TOUCH') {
                    if (lowTouchMode === 'consecutive') {
                      if (isLowDigit) {
                        mState.consecutiveLowCount++;
                        const reqConsec = 2; // 2 consecutive ticks touching any of the low digits (e.g. 0 then 1, 1 then 0, 0 then 0, 1 then 1)
                        if (mState.consecutiveLowCount >= reqConsec) {
                          // Consecutive low digits touched! Move to counting over digits (2-9)
                          mState.stage = 'COUNTING_OVER_TOUCH';
                          mState.overTouchCount = 0;
                          mState.consecutiveLowCount = 0;
                        }
                      } else {
                        mState.consecutiveLowCount = 0;
                      }
                    } else {
                      // 'one_by_one' mode: each low digit must be touched at least once
                      if (isLowDigit) {
                        if (!mState.lowTouchedDigits.includes(digit)) {
                          mState.lowTouchedDigits.push(digit);
                        }
                        const allTouched = lowDigitsArr.every(d => mState.lowTouchedDigits.includes(d));
                        if (allTouched) {
                          mState.stage = 'COUNTING_OVER_TOUCH';
                          mState.overTouchCount = 0;
                          mState.lowTouchedDigits = [];
                        }
                      }
                    }
                  } else if (mState.stage === 'COUNTING_OVER_TOUCH') {
                    if (isOverDigit) {
                      mState.overTouchCount++;
                      if (mState.overTouchCount >= requiredOverTouches) {
                        // Over digits touched required number of times! Move to waiting for final touch
                        mState.stage = 'WAITING_FINAL_TOUCH';
                        mState.finalTouchTicksElapsed = 0;
                      }
                    } else if (isLowDigit) {
                      // Low digit touched before over digits finished -> restart to low touch
                      mState.stage = 'WAITING_LOW_TOUCH';
                      mState.overTouchCount = 0;
                      mState.consecutiveLowCount = 1;
                      mState.lowTouchedDigits = [digit];
                    }
                  } else if (mState.stage === 'WAITING_FINAL_TOUCH') {
                    mState.finalTouchTicksElapsed++;
                    if (isLowDigit) {
                      // Touched digit 1 or 0 the last time before 1, 2, or 3 ticks!
                      circleTargetDigit = barrierDigit;
                      circleTriggered = true;
                      circleStrategyLabel = `Circle O/U [${targetType.toUpperCase()} ${barrierDigit}] (Final Low Digit ${digit} at tick ${mState.finalTouchTicksElapsed}/${maxFinalTicks} on ${symbol})`;

                      // Reset state for next cycle
                      mState.stage = 'WAITING_LOW_TOUCH';
                      mState.lowTouchedDigits = [];
                      mState.consecutiveLowCount = 0;
                      mState.overTouchCount = 0;
                      mState.finalTouchTicksElapsed = 0;
                    } else if (mState.finalTouchTicksElapsed >= maxFinalTicks) {
                      // Past 1, 2, or 3 ticks without touching 1 or 0 -> reset and wait for another signal
                      mState.stage = 'WAITING_LOW_TOUCH';
                      mState.lowTouchedDigits = [];
                      mState.consecutiveLowCount = 0;
                      mState.overTouchCount = 0;
                      mState.finalTouchTicksElapsed = 0;
                      circleTriggered = false;
                    }
                  }
                }
              }

              // Synchronize live circleOuData onto marketTicksRef for real-time market card display
              if (marketTicksRef.current[symbol]) {
                (marketTicksRef.current[symbol] as any).circleOuData = {
                  isFocused: isMarketFocused,
                  stage: mState ? mState.stage : 'WAITING_LOW_TOUCH',
                  lowTouchedDigits: mState ? [...mState.lowTouchedDigits] : [],
                  consecutiveLowCount: mState ? mState.consecutiveLowCount : 0,
                  overTouchCount: mState ? mState.overTouchCount : 0,
                  finalTouchTicksElapsed: mState ? mState.finalTouchTicksElapsed : 0,
                  reqOverTouches: requiredOverTouches,
                  maxFinalTicks: maxFinalTicks,
                  lowDigits: lowDigitsArr,
                  maxPct: maxPct,
                  targetType,
                  barrierDigit,
                  triggered: circleTriggered,
                  label: circleStrategyLabel
                };
              }
            }

            if (circleEntryModeEnabledRef.current && circleTargetDigit !== null && activeStreakMode !== 'circle_over_under') {
              circleTriggered = (digit === circleTargetDigit);
            }
          }

          let isTriggered = false;

          if (activeContractType === 'accumulator') {
            if (activeStreakMode === 'analysis_tool') {
              const latestSig = getLatestAnalysisSignal('accumulator', symbol);
              if (latestSig?.accumulator && latestSig.symbol === symbol) {
                const is5050 = latestSig.accumulator.isNeutral5050 || 
                               (latestSig.accumulator.upPressure === 50 && latestSig.accumulator.downPressure === 50);
                isTriggered = is5050 || latestSig.accumulator.action === 'BUY_ACCU';
              } else {
                const computed = computeAccumulatorSignal(rPrices.length > 5 ? rPrices : history.map(d => d + 100), [], symbol);
                const is5050 = computed.isNeutral5050 || (computed.upPressure === 50 && computed.downPressure === 50);
                isTriggered = is5050 || computed.action === 'BUY_ACCU';
              }
            } else {
              const enabledStrategies = Object.entries(accuStrategiesRef.current).filter(([_, enabled]) => enabled);
              if (enabledStrategies.length > 0 && accumulatorMetrics) {
                let allSatisfied = true;
                for (const [stratId, _] of enabledStrategies) {
                  if (stratId === 'analysis_tool') {
                    const latestSig = getLatestAnalysisSignal('accumulator', symbol);
                    const isSigValid = (latestSig?.accumulator && latestSig.symbol === symbol)
                      ? (latestSig.accumulator.isNeutral5050 || (latestSig.accumulator.upPressure === 50 && latestSig.accumulator.downPressure === 50) || latestSig.accumulator.action === 'BUY_ACCU')
                      : (() => {
                          const c = computeAccumulatorSignal(rPrices.length > 5 ? rPrices : history.map(d => d + 100), [], symbol);
                          return c.isNeutral5050 || (c.upPressure === 50 && c.downPressure === 50) || c.action === 'BUY_ACCU';
                        })();
                    if (!isSigValid) {
                      allSatisfied = false;
                      break;
                    }
                  } else if (!accumulatorMetrics.satisfied[stratId]) {
                    allSatisfied = false;
                    break;
                  }
                }
                isTriggered = allSatisfied;
              }
            }
          } else if (activeStreakMode === 'analysis_tool') {
            if (activeContractType === 'digitdiff') {
              const latestSig = getLatestAnalysisSignal('differ', symbol);
              if (latestSig?.differ && latestSig.symbol === symbol) {
                isTriggered = (latestSig.differ.confidence || 0) >= 80;
              } else {
                const computed = (getAllMarketDifferSignals()[symbol] || computeDiffersSignal(history, symbol));
                isTriggered = computed.confidence >= 80;
              }
            } else if (
              activeContractType === 'over_under' || 
              activeContractType === 'digitover' || 
              activeContractType === 'digitunder' || 
              activeContractType === 'dual_ou'
            ) {
              const latestSig = getLatestAnalysisSignal('over_under', symbol);
              const ouData = (latestSig?.overUnder && latestSig.symbol === symbol)
                ? latestSig.overUnder
                : computeOverUnderSignal(history, symbol, activeTargetDigit !== -1 ? activeTargetDigit : 4, 4);

              const conf = ouData.confidence || ouData.netConfidence || 0;
              let dir = ouData.direction;

              const isOpposite = isRecActive ? recoveryAnalysisOppositeSignalEnabledRef.current : analysisOppositeSignalEnabledRef.current;
              if (isOpposite && ['over_under', 'dual_ou', 'digitover', 'digitunder'].includes(activeContractType)) {
                if (dir === 'OVER') dir = 'UNDER';
                else if (dir === 'UNDER') dir = 'OVER';
              }

              if (activeContractType === 'digitover') {
                isTriggered = dir === 'OVER' && conf >= 60;
              } else if (activeContractType === 'digitunder') {
                isTriggered = dir === 'UNDER' && conf >= 60;
              } else {
                // over_under or dual_ou: triggers on either OVER or UNDER with sufficient confidence
                isTriggered = (dir === 'OVER' || dir === 'UNDER') && conf >= 60;
              }
            } else if (activeContractType === 'digitmatch') {
              const latestSig = getLatestAnalysisSignal('match', symbol);
              if (latestSig?.match && latestSig.symbol === symbol) {
                isTriggered = (latestSig.match.confidence || 0) >= 40;
              } else {
                const computed = computeMatchSignal(history);
                isTriggered = computed.confidence >= 40;
              }
            } else {
              isTriggered = currentStreak >= activeStreakThreshold;
            }
          } else {
            isTriggered = (activeStreakMode.startsWith('circle_') || activeStreakMode === 'circle_over_under')
              ? circleTriggered
              : (activeStreakMode === 'pattern')
              ? patternMatched
              : (activeStreakMode === 'over_under')
              ? (overUnderSignal !== null)
              : activeStreakMode === 'price_digits'
              ? priceDigitsSignal.matched
              : activeStreakMode === 'axa'
              ? (axaSignal !== null)
              : activeStreakMode === 'differs_noise'
              ? (differsCalmNoiseSignal !== null)
              : activeStreakMode === 'lad_prng'
              ? (ladPrngSignal !== null)
              : activeStreakMode === 'types'
              ? (typesSignal !== null)
              : activeStreakMode === 'percentage'
              ? (isExactPercentageRef.current ? currentPct === (percentageThresholdRef.current || 80) : currentPct >= (percentageThresholdRef.current || 80))
              : activeStreakMode === 'consecutive_touch'
              ? consecTouchMatched
              : (currentStreak >= activeStreakThreshold);
          }

          // IF A MARKET IS LOCKED, ENSURE ONLY THE LOCKED MARKET CAN TRIGGER TRADES
          const activeLockedMarket = (window as any).AUTOBOT_LOCKED_MARKET || (window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET || (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET;
          if (activeLockedMarket && activeLockedMarket !== symbol) {
            isTriggered = false;
          }

          // IF CONTINUOUS TRADING IS ACTIVE AND THIS MARKET IS ALREADY THE LOCKED CONTINUOUS MARKET
          if (
            isContinuousTradingRef.current && 
            activeLockedMarket && 
            activeLockedMarket === symbol
          ) {
            isTriggered = true;
          }

          // IF VIRTUAL LOSS THRESHOLD MET, TRIGGER IMMEDIATELY ON THE LOCKED MARKET WITHOUT WAITING FOR OTHER SIGNALS
          const isVirtualThresholdMet = Boolean(
            (useVirtualLossRef.current || (window as any).AUTOBOT_USE_VIRTUAL_LOSS) &&
            ((window as any).AUTOBOT_IS_CURRENT_TRADE_REAL || (Number((window as any).AUTOBOT_CONSEC_VIRTUAL_LOSSES) || 0) >= (Number((window as any).AUTOBOT_VIRTUAL_LOSS_THRESHOLD) || 2))
          );
          if (
            isVirtualThresholdMet && 
            activeLockedMarket && 
            activeLockedMarket === symbol
          ) {
            isTriggered = true;
          }

          // AUTO BUY CHECK DURING ACTIVE SESSION
          if (
            isRunningRef.current && 
            checkedMarketsRef.current.includes(symbol) && 
            isTriggered
          ) {
            // Lock market for continuous trading if enabled and not locked yet
            if (isContinuousTradingRef.current && !(window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET) {
              (window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET = symbol;
              (window as any).AUTOBOT_LOCKED_MARKET = symbol;
              const logMsg = `[${new Date().toLocaleTimeString()}] ${symbol}: Continuous trading activated after signal. Rest of markets ignored & blocked until TP is hit.`;
              setOtivoLog(prev => [logMsg, ...prev].slice(0, 50));
            }
            const isRecoveryEnabled = isRecoveryStreakModeEnabledRef.current;
            const lastLossTime = (window as any).AUTOBOT_LAST_LOSS_TIME || 0;
            const timeSinceLoss = Date.now() - lastLossTime;

            if (isRecoveryEnabled && lastLossTime > 0 && timeSinceLoss < 5000) {
              return;
            }

            const lastLostMarket = (window as any).AUTOBOT_LAST_LOST_MARKET;
            const alternateRec = alternateMarketRecoveryRef.current;
            const checkedCount = checkedMarketsRef.current?.length || 1;
            if (alternateRec && !activeLockedMarket && checkedCount > 1 && lastLostMarket && symbol === lastLostMarket) {
              const nowMs = Date.now();
              const lastTradeMessageTime = lastTradeTimePerSymbol.current[symbol] || 0;
              if (nowMs - lastTradeMessageTime > 5000) {
                lastTradeTimePerSymbol.current[symbol] = nowMs;
                const logMsg = `[${new Date().toLocaleTimeString()}] ${symbol}: Signal ignored. Waiting for a different market to recover...`;
                setOtivoLog(prev => [logMsg, ...prev].slice(0, 50));
              }
              return;
            }

            const nowMs = Date.now();
            const lastTrade = lastTradeTimePerSymbol.current[symbol] || 0;
            
            // Cooldown check 800ms to allow next tick matching without duplicate same-tick triggers (bypassed if immediate virtual threshold is met)
            if (isVirtualThresholdMet || (nowMs - lastTrade > 800)) {
              lastTradeTimePerSymbol.current[symbol] = nowMs;
              
              let termType = activeContractType;
              let termContract = activeContractType === 'accumulator' ? 'ACCU' : activeContractType === 'digitover' ? 'DIGITOVER' : activeContractType === 'digitunder' ? 'DIGITUNDER' : activeContractType === 'digitmatch' ? 'DIGITMATCH' : activeContractType === 'dual_ou' ? 'DUAL_OU' : activeContractType === 'over_under' ? (activeOuPatternSelection === 'under8' ? 'DIGITUNDER' : 'DIGITOVER') : 'DIGITDIFF';
              let prediction = activeContractType === 'digitover'
                ? ((activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 2)
                : activeContractType === 'digitunder'
                ? ((activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8)
                : activeTargetDigit;

              if (activeContractType === 'over_under' && activeStreakMode === 'pattern') {
                if (activeOuPatternSelection === 'under8') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = 8;
                } else {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = 1;
                }
              } else if (activeStreakMode === 'analysis_tool') {
                if (activeContractType === 'digitdiff') {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  const latestSig = getLatestAnalysisSignal('differ', symbol);
                  const differObj = (latestSig?.differ && latestSig.symbol === symbol) 
                    ? latestSig.differ 
                    : (getAllMarketDifferSignals()[symbol] || computeDiffersSignal(history, symbol));
                  // Differs contract: Differ digit directly from live market ticks and analysis signal without barrier or target rule
                  prediction = (differObj && typeof differObj.prediction === 'number')
                    ? differObj.prediction 
                    : (history.length > 0 ? history[history.length - 1] : 0);
                } else if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 1;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8;
                } else if (
                  activeContractType === 'over_under' || 
                  activeContractType === 'dual_ou'
                ) {
                  const latestSig = getLatestAnalysisSignal('over_under', symbol);
                  const ouObj = (latestSig?.overUnder && latestSig.symbol === symbol)
                    ? latestSig.overUnder
                    : computeOverUnderSignal(history, symbol, activeTargetDigit !== -1 ? activeTargetDigit : 4, 4);
                  
                  let dir = ouObj?.direction || 'OVER';
                  const isOpposite = isRecActive ? recoveryAnalysisOppositeSignalEnabledRef.current : analysisOppositeSignalEnabledRef.current;
                  if (isOpposite) {
                    if (dir === 'OVER') dir = 'UNDER';
                    else if (dir === 'UNDER') dir = 'OVER';
                  }

                  if (dir === 'UNDER') {
                    termType = 'digitunder';
                    termContract = 'DIGITUNDER';
                  } else {
                    termType = 'digitover';
                    termContract = 'DIGITOVER';
                  }
                  prediction = termContract === 'DIGITOVER' ? 1 : 8;
                } else if (activeContractType === 'accumulator' || activeContractType === 'accu') {
                  termType = 'accumulator';
                  termContract = 'ACCU';
                } else if (activeContractType === 'digitmatch') {
                  termType = 'digitmatch';
                  termContract = 'DIGITMATCH';
                  const latestSig = getLatestAnalysisSignal('match', symbol);
                  const matchObj = (latestSig?.match && latestSig.symbol === symbol)
                    ? latestSig.match
                    : computeMatchSignal(history);
                  prediction = matchObj?.prediction ?? (activeTargetDigit !== -1 ? activeTargetDigit : 0);
                }
              } else if (activeStreakMode === 'consecutive_touch') {
                const isOver = activeContractType === 'digitover' || (activeContractType === 'over_under' && activeOuPatternSelection !== 'under8');
                termType = isOver ? 'digitover' : 'digitunder';
                termContract = isOver ? 'DIGITOVER' : 'DIGITUNDER';
                prediction = activeContractType === 'over_under'
                  ? (activeOuPatternSelection === 'under8' ? 8 : 1)
                  : isOver 
                  ? ((activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 1)
                  : ((activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8);
              } else if (activeStreakMode === 'circle_over_under') {
                const targetType = activeContractType === 'digitover' ? 'over' : activeContractType === 'digitunder' ? 'under' : (circleOuTargetTypeRef.current || 'over');
                termType = targetType === 'over' ? 'digitover' : 'digitunder';
                termContract = targetType === 'over' ? 'DIGITOVER' : 'DIGITUNDER';
                prediction = (circleTargetDigit !== null && circleTargetDigit !== undefined)
                  ? circleTargetDigit
                  : (circleOuDigitRef.current !== undefined ? circleOuDigitRef.current : (targetType === 'over' ? 1 : 8));
              } else if (activeStreakMode === 'over_under' && overUnderSignal) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : overUnderSignal.prediction;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : overUnderSignal.prediction;
                } else {
                  termType = overUnderSignal.type === 'digitover' ? 'digitover' : 'digitunder';
                  termContract = overUnderSignal.type === 'digitover' ? 'DIGITOVER' : 'DIGITUNDER';
                  prediction = overUnderSignal.prediction;
                }
              } else if (activeStreakMode.startsWith('circle_') && circleTargetDigit !== null) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : Math.min(8, circleTargetDigit);
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : Math.max(1, circleTargetDigit);
                } else {
                  prediction = circleTargetDigit;
                }
              } else if (activeStreakMode === 'price_digits' && priceDigitsSignal.matched) {
                if (priceDigitsSignal.target) {
                  const lastChar = priceDigitsSignal.target.slice(-1);
                  const parsedLast = parseInt(lastChar, 10);
                  if (!isNaN(parsedLast) && activeTargetDigit === -1) {
                    prediction = parsedLast;
                  }
                }
              } else if (activeStreakMode === 'axa' && axaSignal) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 2;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8;
                } else if (activeContractType === 'digitmatch') {
                  termType = 'digitmatch';
                  termContract = 'DIGITMATCH';
                  prediction = axaSignal.prediction;
                } else {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  prediction = axaSignal.prediction;
                }
              } else if (activeStreakMode === 'differs_noise' && differsCalmNoiseSignal) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 2;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8;
                } else if (activeContractType === 'digitmatch') {
                  termType = 'digitmatch';
                  termContract = 'DIGITMATCH';
                  prediction = differsCalmNoiseSignal.prediction;
                } else {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  prediction = differsCalmNoiseSignal.prediction;
                }
              } else if (activeStreakMode === 'lad_prng' && ladPrngSignal) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 2;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8;
                } else if (activeContractType === 'digitmatch') {
                  termType = 'digitmatch';
                  termContract = 'DIGITMATCH';
                  prediction = ladPrngSignal.prediction;
                } else {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  prediction = ladPrngSignal.prediction;
                }
              } else if (activeStreakMode === 'pattern' && bestDifferDigit !== undefined) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8)
                    ? activeTargetDigit
                    : ((bestDifferDigit >= 0 && bestDifferDigit <= 8) ? bestDifferDigit : 2);
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9)
                    ? activeTargetDigit
                    : ((bestDifferDigit >= 1 && bestDifferDigit <= 9) ? bestDifferDigit : 8);
                } else if (activeContractType === 'digitmatch') {
                  termType = 'digitmatch';
                  termContract = 'DIGITMATCH';
                  prediction = (bestDifferDigit >= 0 && bestDifferDigit <= 9) ? bestDifferDigit : 0;
                } else if (activeContractType === 'dual_ou') {
                  termType = 'dual_ou';
                  termContract = 'DUAL_OU';
                } else {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  prediction = bestDifferDigit;
                }
              } else if (activeStreakMode === 'types' && typesSignal) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 2;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8;
                } else {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  prediction = typesSignal.prediction;
                }
              } else if (activeTargetDigit === -1) {
                if (activeContractType === 'digitover') {
                  termType = 'digitover';
                  termContract = 'DIGITOVER';
                  prediction = 2;
                } else if (activeContractType === 'digitunder') {
                  termType = 'digitunder';
                  termContract = 'DIGITUNDER';
                  prediction = 8;
                } else if (activeContractType === 'digitmatch') {
                  termType = 'digitmatch';
                  termContract = 'DIGITMATCH';
                  prediction = detectedDigit;
                } else {
                  termType = 'digitdiff';
                  termContract = 'DIGITDIFF';
                  prediction = detectedDigit;
                }
              }

              // Handle contract type and locked prediction digit during continuous trading or after a loss
              const isOuContract = activeContractType === 'over_under' || 
                                   activeContractType === 'dual_ou' || 
                                   activeContractType === 'digitover' || 
                                   activeContractType === 'digitunder' || 
                                   termContract === 'DIGITOVER' || 
                                   termContract === 'DIGITUNDER' || 
                                   termContract === 'DUAL_OU';

              const isAccuContract = activeContractType === 'accumulator' ||
                                     activeContractType === 'accu' ||
                                     activeContractType === 'ACCU' ||
                                     termContract === 'ACCU';

              if (isAccuContract) {
                termContract = 'ACCU';
                termType = 'accumulator';
                if ((window as any).AUTOBOT_CONSEC_LOSSES > 0 && (window as any).AUTOBOT_LAST_CONTRACT_TYPE) {
                  termContract = (window as any).AUTOBOT_LAST_CONTRACT_TYPE;
                  termType = 'accumulator';
                } else if (isContinuousTradingRef.current || (window as any).AUTOBOT_CONTINUOUS_TRADING) {
                  if ((window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE) {
                    termContract = (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE;
                    termType = 'accumulator';
                  } else {
                    (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE = 'ACCU';
                  }
                }
              } else if (isOuContract) {
                if (activeContractType === 'digitover') {
                  termContract = 'DIGITOVER';
                  termType = 'digitover';
                  if (prediction === undefined || prediction === null || prediction < 0 || prediction > 8) {
                    prediction = (activeTargetDigit >= 0 && activeTargetDigit <= 8) ? activeTargetDigit : 2;
                  }
                } else if (activeContractType === 'digitunder') {
                  termContract = 'DIGITUNDER';
                  termType = 'digitunder';
                  if (prediction === undefined || prediction === null || prediction < 1 || prediction > 9) {
                    prediction = (activeTargetDigit >= 1 && activeTargetDigit <= 9) ? activeTargetDigit : 8;
                  }
                } else if ((window as any).AUTOBOT_CONSEC_LOSSES > 0 && (window as any).AUTOBOT_LAST_CONTRACT_TYPE) {
                  termContract = (window as any).AUTOBOT_LAST_CONTRACT_TYPE;
                  termType = termContract === 'DIGITOVER' ? 'digitover' : 'digitunder';
                  if ((window as any).AUTOBOT_LAST_PREDICTION !== undefined && (window as any).AUTOBOT_LAST_PREDICTION !== null) {
                    prediction = (window as any).AUTOBOT_LAST_PREDICTION;
                  }
                } else if (isContinuousTradingRef.current || (window as any).AUTOBOT_CONTINUOUS_TRADING) {
                  // Keep Over/Under contract type intact during continuous trading
                  if ((window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE) {
                    termContract = (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE;
                    termType = termContract === 'DIGITOVER' ? 'digitover' : 'digitunder';
                  } else {
                    (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE = termContract;
                  }

                  if ((window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION !== undefined && (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION !== null) {
                    prediction = (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION;
                  } else {
                    if (prediction === undefined || prediction === null || prediction === -1) {
                      prediction = termContract === 'DIGITUNDER' ? 8 : (termContract === 'DIGITOVER' ? 1 : activeTargetDigit !== -1 ? activeTargetDigit : 1);
                    }
                    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = prediction;
                  }
                }
              } else if (isContinuousTradingRef.current || (window as any).AUTOBOT_CONTINUOUS_TRADING || isVirtualThresholdMet) {
                termType = activeContractType === 'digitmatch' ? 'digitmatch' : 'digitdiff';
                termContract = activeContractType === 'digitmatch' ? 'DIGITMATCH' : 'DIGITDIFF';
                if ((window as any).AUTOBOT_LAST_PREDICTION !== undefined && (window as any).AUTOBOT_LAST_PREDICTION !== null) {
                  prediction = (window as any).AUTOBOT_LAST_PREDICTION;
                  (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = prediction;
                } else if (activeStreakMode === 'analysis_tool') {
                  const latestSig = getLatestAnalysisSignal('differ', symbol);
                  const differObj = (latestSig?.differ && latestSig.symbol === symbol) 
                    ? latestSig.differ 
                    : (getAllMarketDifferSignals()[symbol] || computeDiffersSignal(history, symbol));
                  prediction = (differObj && typeof differObj.prediction === 'number') 
                    ? differObj.prediction 
                    : (history.length > 0 ? history[history.length - 1] : 0);
                  (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = prediction;
                } else if (activeStreakMode === 'differs_noise') {
                  if (differsCalmNoiseSignal) {
                    prediction = differsCalmNoiseSignal.prediction;
                    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = prediction;
                  } else if ((window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION !== undefined && (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION !== null) {
                    prediction = (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION;
                  } else {
                    prediction = activeTargetDigit !== -1 ? activeTargetDigit : detectedDigit;
                    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = prediction;
                  }
                } else if (bestDifferDigit !== undefined && bestDifferDigit !== null) {
                  prediction = bestDifferDigit;
                  (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = bestDifferDigit;
                } else if ((window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION !== undefined && (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION !== null) {
                  prediction = (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION;
                } else {
                  if (prediction === undefined || prediction === null) {
                    prediction = activeTargetDigit !== -1 ? activeTargetDigit : detectedDigit;
                  }
                  (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = prediction;
                }
              }

              let targetAmt = Number((window as any).AUTOBOT_CURRENT_STAKE);
              if (isNaN(targetAmt) || targetAmt <= 0) {
                targetAmt = Number(currentStakeRef.current) || Number(stake) || 1.0;
              }

              // Initialize queue if needed
              if (!(window as any).AUTOBOT_SIGNAL_QUEUE) {
                (window as any).AUTOBOT_SIGNAL_QUEUE = [];
              }

              const queue = (window as any).AUTOBOT_SIGNAL_QUEUE;

              // Prevent queuing duplicate signals for the same symbol
              const hasDuplicate = queue.some((s: any) => s.symbol === symbol);
              if (!hasDuplicate) {
                if (activeStreakMode === 'pattern' && patternRotationalModeRef.current && matchedPatternKey) {
                  const cleanedSeq = matchedPatternKey.split('=')[0].replace(/[^0-9]/g, '');
                  const patternDigits = cleanedSeq.split('').map(char => parseInt(char, 10));
                  if (patternDigits.length > 0) {
                    const currentIdx = patternRotationalIdx.current[cleanedSeq] || 0;
                    const nextIdx = (currentIdx + 1) % patternDigits.length;
                    patternRotationalIdx.current[cleanedSeq] = nextIdx;
                  }
                }

                if (activeStreakMode === 'differs_noise' && differsCalmNoiseSignal) {
                  setOtivoLog(prev => [...prev.slice(-49), `🎯 [CALM NOISE SIGNAL] ${symbol}: Noise ${differsCalmNoiseSignal.noiseScore}/100, Calm ${differsCalmNoiseSignal.calmness}%, Stability ${differsCalmNoiseSignal.confirmationTicks} ticks → Target DIFFER ${differsCalmNoiseSignal.prediction}`]);
                }

                queue.push({
                   symbol,
                   type: termType,
                   contractType: termContract,
                   prediction,
                   prediction2: targetDigit2Ref.current,
                   amount: targetAmt,
                   timestamp: Date.now(),
                   accuGrowthRate: isRecActive ? recoveryAccumulatorGrowthRateRef.current / 100 : accumulatorGrowthRateRef.current / 100,
                   accuTakeProfit: isRecActive ? recoveryAccumulatorTakeProfitRef.current : accumulatorTakeProfitRef.current,
                   barrier: (termContract === 'DIGITOVER' || termContract === 'DIGITUNDER')
                     ? (prediction !== undefined && prediction !== null && prediction !== -1 ? prediction : (termContract === 'DIGITOVER' ? 2 : 8))
                     : undefined,
                   matchedPatternKey: activeStreakMode === 'pattern' ? matchedPatternKey : undefined,
                   strategyName: activeStreakMode === 'analysis_tool'
                     ? (termContract === 'DIGITDIFF' 
                         ? `Analysis Tool DIGITDIFF [Differ: ${prediction}] (Direct Market Signal)`
                         : `Analysis Tool ${termContract}${isOuContract ? ` [Barrier: ${prediction}]` : ` [Target: ${prediction}]`}`)
                     : activeStreakMode === 'over_under' 
                     ? (isEdmsEnabledRef.current ? `EDMS ${overUnderSignal?.type === 'digitover' ? 'OVER 1' : 'UNDER 8'} (SS: ${(overUnderSignal as any)?.ssOver || (overUnderSignal as any)?.ssUnder || 0})` : 'Cold Zone Scanner')
                     : activeStreakMode.startsWith('circle_') ? circleStrategyLabel : (activeStreakMode === 'differs_noise' && differsCalmNoiseSignal ? `CALM NOISE DIFFER [${differsCalmNoiseSignal.prediction}] (Noise: ${differsCalmNoiseSignal.noiseScore}, Calm: ${differsCalmNoiseSignal.calmness}%)` : (activeStreakMode === 'axa' && axaSignal ? `AXA MODULO RESET [${axaSignal.prediction}] (Pat: ${axaSignal.pattern})` : (activeStreakMode === 'lad_prng' && ladPrngSignal ? `PATTERN FOLLOWER DIFFER [${ladPrngSignal.prediction}] (Pat: ${ladPrngSignal.patternStr})` : (activeStreakMode === 'pattern' && patternRotationalModeRef.current ? `ROT [${prediction}]` : (typesSignal ? typesSignal.strategyName : null)))))
                });

                if (activeStreakMode === 'circle_over_under') {
                  circleOuConsecutiveCountRef.current[symbol] = 0;
                  if (circleOuMarketStatesRef.current[symbol]) {
                    circleOuMarketStatesRef.current[symbol] = {
                      stage: 'WAITING_LOW_TOUCH',
                      lowTouchedDigits: [],
                      consecutiveLowCount: 0,
                      overTouchCount: 0,
                      finalTouchTicksElapsed: 0,
                      lastUpdated: Date.now()
                    };
                  }
                }
              }
            }
          }
        }
      };

      ws.onerror = (err) => {
        console.error("[AutoBot WS] Error encountered:", err);
      };

      ws.onclose = () => {
        console.log("[AutoBot WS] Connection closed.");
        // Stop ping & watch loops for this dead instance
        if (pingInterval) clearInterval(pingInterval);
        if (watchInterval) clearInterval(watchInterval);

        if (isCurrentEffect) {
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            // Exponential backoff to not flood on connection drop
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 12000);
            console.log(`[AutoBot WS] Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts})`);
            connect();
          }, Math.min(1000 * Math.pow(1.5, reconnectAttempts), 12000));
        }
      };

      // Set up periodic ping to prevent Deriv idle timeouts
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, 12000);

      // Set up watch loop to check for stalled state
      watchInterval = setInterval(() => {
        const inactiveDuration = Date.now() - lastMessageTime.current;
        if (inactiveDuration > 15000) { // 15 seconds of complete silence = connection stalled
          console.warn(`[AutoBot WS] Connection watch timeout (${inactiveDuration}ms). Recycling socket...`);
          setOtivoLog(prev => [`[${new Date().toLocaleTimeString()}] AI Engine tick feed stalled. Resetting connection...`, ...prev].slice(0, 50));
          ws?.close(); // This will trigger onclose() which handles reconnecting
        }
      }, 5000);
    };

    // Delay connection slightly on load or market changes to allow debouncing
    const debounceTimeout = setTimeout(() => {
      connect();
    }, 400);

    return () => {
      isCurrentEffect = false;
      clearTimeout(debounceTimeout);
      if (ws) {
        ws.close();
      }
      if (pingInterval) clearInterval(pingInterval);
      if (watchInterval) clearInterval(watchInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsSubscription.current = null;
    };
  }, [checkedMarketsStr]);

  const handleResetStatsAndRestart = (triggerMsg: string, profitGained: number = 0) => {
    const gained = Math.max(0, profitGained);
    const updatedCumulative = Number((cumulativeSessionProfitRef.current + gained).toFixed(2));
    cumulativeSessionProfitRef.current = updatedCumulative;
    setCumulativeSessionProfit(updatedCumulative);
    sessionStorage.setItem('autobot_cumulativeSessionProfit', updatedCumulative.toString());

    // Check if Auto Start's own Take Profit limit has been reached!
    if (autoRestartMaxTpRef.current > 0 && updatedCumulative >= autoRestartMaxTpRef.current) {
      setAutoRestartAfterTp(false);
      setIsRunning(false);
      (window as any).AUTOBOT_TARGET = null;
      (window as any).AUTOBOT_ACTIVE = false;
      (window as any).AUTOBOT_LAST_LOST_MARKET = null;
      (window as any).AUTOBOT_LOCKED_MARKET = null;
      (window as any).AUTOBOT_SIGNAL_QUEUE = [];
      botEngine.stop();

      setSessionProfit(0);
      setTradesCount(0);
      setWinsCount(0);
      setLossesCount(0);
      setCurrentStake(stake);
      (window as any).AUTOBOT_PROFIT = 0;
      (window as any).AUTOBOT_WINS = 0;
      (window as any).AUTOBOT_CURRENT_STAKE = stake;
      (window as any).AUTOBOT_CONSEC_LOSSES = 0;
      (window as any).AUTOBOT_AUTO_RESTART_AFTER_TP = false;

      botEngine.getBotInterface().notify(
        'success',
        `🎉 AUTO-START TAKE PROFIT GOAL REACHED (+$${updatedCumulative.toFixed(2)} / $${autoRestartMaxTpRef.current.toFixed(2)} USD)! Auto Start switch turned OFF & Bot stopped.`
      );
      return;
    }

    // Auto-reset stats and keep bot running
    setSessionProfit(0);
    setTradesCount(0);
    setWinsCount(0);
    setLossesCount(0);
    setCurrentStake(stake);
    (window as any).AUTOBOT_PROFIT = 0;
    (window as any).AUTOBOT_WINS = 0;
    (window as any).AUTOBOT_CURRENT_STAKE = stake;
    (window as any).AUTOBOT_CONSEC_LOSSES = 0;
    (window as any).AUTOBOT_LAST_LOST_MARKET = null;
    (window as any).AUTOBOT_LOCKED_MARKET = null;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
    (window as any).AUTOBOT_CUMULATIVE_SESSION_PROFIT = updatedCumulative;

    botEngine.resetStats();

    botEngine.getBotInterface().notify(
      'success',
      `${triggerMsg} 🔄 Auto-Reset triggered (Cumulative Profit: +$${updatedCumulative.toFixed(2)} / $${autoRestartMaxTpRef.current.toFixed(2)} USD). AutoBot continuing trading!`
    );
  };

  // Listener for trading engine callbacks
  useEffect(() => {
    const handleResult = (e: any) => {
      const { 
        result, 
        profit, 
        sessionProfit: nextSessionProfit, 
        wins: currentWins, 
        lastSymbol,
        isVirtual,
        consecutiveVirtualLosses: nextVirtualLosses,
        virtualWins: nextVirtualWins,
        virtualLosses: nextVirtualLossesCount
      } = e.detail;
      circleOuConsecutiveCountRef.current = {};
      circleOuMarketStatesRef.current = {};
      if (!isContinuousTradingRef.current && (!isVirtual || result)) {
        (window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET = null;
        (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = null;
        (window as any).AUTOBOT_LOCKED_MARKET = null;
        (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
        setLockedVirtualMarket(null);
      }
      (window as any).AUTOBOT_SIGNAL_QUEUE = [];

      if (isVirtual) {
        // Handling VIRTUAL trade outcome
        const updatedStreak = typeof nextVirtualLosses === 'number'
          ? nextVirtualLosses
          : (result ? 0 : consecutiveVirtualLosses + 1);
        setConsecutiveVirtualLosses(updatedStreak);
        if (typeof nextVirtualWins === 'number') {
          setVirtualWinsCount(nextVirtualWins);
        } else if (result) {
          setVirtualWinsCount(prev => prev + 1);
        }
        if (typeof nextVirtualLossesCount === 'number') {
          setVirtualLossesCount(nextVirtualLossesCount);
        } else if (!result) {
          setVirtualLossesCount(prev => prev + 1);
        }
        if (result) {
          setIsCurrentTradeReal(Boolean((window as any).AUTOBOT_CONTINUOUS_TRADING && (window as any).AUTOBOT_CONTINUOUS_REAL_UNLOCKED));
          if (!isContinuousTradingRef.current) {
            (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
            (window as any).AUTOBOT_LOCKED_MARKET = null;
            setLockedVirtualMarket(null);
          }
        } else {
          const unlockedReal = useVirtualLossRef.current ? updatedStreak >= virtualLossThresholdRef.current : true;
          if (unlockedReal && (isContinuousTradingRef.current || (window as any).AUTOBOT_CONTINUOUS_TRADING)) {
            (window as any).AUTOBOT_CONTINUOUS_REAL_UNLOCKED = true;
          }
          setIsCurrentTradeReal(unlockedReal);

          // Maintain on the same market after virtual loss when not continuous
          if (!isContinuousTradingRef.current && useVirtualLossRef.current && lastSymbol) {
            (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = lastSymbol;
            (window as any).AUTOBOT_LOCKED_MARKET = lastSymbol;
            setLockedVirtualMarket(lastSymbol);
          }
        }

        const outcomeText = result ? 'WIN' : 'LOSS';
        const wVal = typeof nextVirtualWins === 'number' ? nextVirtualWins : (virtualWinsCount + (result ? 1 : 0));
        const lVal = typeof nextVirtualLossesCount === 'number' ? nextVirtualLossesCount : (virtualLossesCount + (!result ? 1 : 0));
        const statusNote = result 
          ? `Streak reset to 0. Waiting for next signal across markets.`
          : (updatedStreak >= virtualLossThresholdRef.current 
              ? `Threshold met (${updatedStreak}/${virtualLossThresholdRef.current})! Maintaining on ${lastSymbol} for REAL trade.` 
              : `Maintaining on ${lastSymbol} to test next trade...`);
        const logMsg = `[${new Date().toLocaleTimeString()}] 🧪 [VIRTUAL] ${lastSymbol}: Simulated Trade (${outcomeText}). Virtual W/L: ${wVal}/${lVal} | Streak: ${updatedStreak}/${virtualLossThresholdRef.current} — ${statusNote}`;
        setOtivoLog(prev => [logMsg, ...prev].slice(0, 50));
        return;
      }

      // Handling REAL trade outcome
      setTradesCount(prev => prev + 1);
      if (result) {
        setWinsCount(prev => prev + 1);
      } else {
        setLossesCount(prev => prev + 1);
      }
      setSessionProfit(nextSessionProfit);

      // In Continuous Trading mode, stay in Real Mode after the first trade entry; otherwise update mode based on virtual loss settings
      const isContMode = isContinuousTradingRef.current || Boolean((window as any).AUTOBOT_CONTINUOUS_TRADING);
      if (isContMode) {
        (window as any).AUTOBOT_CONTINUOUS_REAL_UNLOCKED = true;
        setIsCurrentTradeReal(true);
      } else {
        setConsecutiveVirtualLosses(0);
        if (useVirtualLossRef.current) {
          if (virtualAfterRealLossRef.current) {
            // Virtual only after real loss: stay real on win, switch to virtual on loss
            setIsCurrentTradeReal(result);
          } else {
            setIsCurrentTradeReal(false);
          }
        } else {
          setIsCurrentTradeReal(true);
        }
        (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
        (window as any).AUTOBOT_LOCKED_MARKET = null;
        setLockedVirtualMarket(null);
      }
      
      const newStakeValue = (window as any).AUTOBOT_CURRENT_STAKE || stake;
      setCurrentStake(newStakeValue);

      if ((window as any).AUTOBOT_PATTERN_SMART_MODE) {
        setCustomPattern((window as any).AUTOBOT_CUSTOM_PATTERN || '686');
      }

      // Log the execution
      const outcomeText = result ? 'WIN' : 'LOSS';
      const logMsg = `[${new Date().toLocaleTimeString()}] ${lastSymbol}: Trade Finished (${outcomeText}). Profit: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)}`;
      setOtivoLog(prev => [logMsg, ...prev].slice(0, 50));

      // Check if Overall Auto Start Session TP limit has been reached on this trade
      const sessionProfitWithTrade = Number((cumulativeSessionProfitRef.current + nextSessionProfit).toFixed(2));
      if (autoRestartAfterTpRef.current && autoRestartMaxTpRef.current > 0 && sessionProfitWithTrade >= autoRestartMaxTpRef.current) {
        setAutoRestartAfterTp(false);
        setIsRunning(false);
        setCumulativeSessionProfit(sessionProfitWithTrade);
        cumulativeSessionProfitRef.current = sessionProfitWithTrade;
        sessionStorage.setItem('autobot_cumulativeSessionProfit', sessionProfitWithTrade.toString());
        setSessionProfit(0);
        (window as any).AUTOBOT_TARGET = null;
        (window as any).AUTOBOT_ACTIVE = false;
        (window as any).AUTOBOT_LAST_LOST_MARKET = null;
        (window as any).AUTOBOT_LOCKED_MARKET = null;
        (window as any).AUTOBOT_SIGNAL_QUEUE = [];
        botEngine.stop();
        botEngine.getBotInterface().notify(
          'success',
          `🎉 AUTO-START TAKE PROFIT GOAL REACHED (+$${sessionProfitWithTrade.toFixed(2)} / $${autoRestartMaxTpRef.current.toFixed(2)} USD)! Auto Start switch turned OFF & Bot stopped.`
        );
        return;
      }

      // Auto-stop if trigger targets are met
      const activeSl = isAutoStakeEnabled ? Math.max(stopLoss, rootStore.client.balance + 10) : stopLoss;
      const nextWinsCount = currentWins !== undefined ? currentWins : (winsCount + (result ? 1 : 0));

      let shouldStop = false;
      let stopType: 'tp' | 'sl' | 'runs' = 'tp';

      if (!runForever) {
        if (isRunsLimitEnabled) {
          if (nextWinsCount >= runsLimit && result) {
            shouldStop = true;
            stopType = 'runs';
          } else if (nextSessionProfit <= -activeSl) {
            shouldStop = true;
            stopType = 'sl';
          }
        } else {
          if (nextSessionProfit >= takeProfit) {
            shouldStop = true;
            stopType = 'tp';
          } else if (nextSessionProfit <= -activeSl) {
            shouldStop = true;
            stopType = 'sl';
          }
        }
      }

      if (shouldStop) {
        if (stopType !== 'sl' && autoRestartAfterTpRef.current) {
          let triggerMsg = '';
          if (stopType === 'runs') {
            triggerMsg = `🎯 Target wins limit (${runsLimit}) met!`;
          } else {
            triggerMsg = `🎉 Take profit target (+${takeProfit} USD) reached!`;
          }
          handleResetStatsAndRestart(triggerMsg, nextSessionProfit);
          return;
        }

        setIsRunning(false);
        (window as any).AUTOBOT_TARGET = null;
        (window as any).AUTOBOT_ACTIVE = false;
        (window as any).AUTOBOT_LAST_LOST_MARKET = null;
        (window as any).AUTOBOT_LOCKED_MARKET = null;
        (window as any).AUTOBOT_SIGNAL_QUEUE = [];
        botEngine.stop();
        
        let stopMsg = '';
        if (stopType === 'runs') {
          stopMsg = `Auto Bot Strategy: Target wins limit (${runsLimit}) met successfully.`;
        } else if (stopType === 'tp') {
          stopMsg = 'Auto Bot Strategy: Take Profit targets reached.';
        } else {
          stopMsg = 'Auto Bot Strategy: Stop Loss boundaries met.';
        }
        
        botEngine.getBotInterface().notify(stopType === 'sl' ? 'error' : 'success', stopMsg);
      }
    };

    window.addEventListener('autobot_trade_result', handleResult);
    return () => window.removeEventListener('autobot_trade_result', handleResult);
  }, [stake, takeProfit, stopLoss, isAutoStakeEnabled, isRunsLimitEnabled, runsLimit, runForever, winsCount, autoRestartAfterTp, autoRestartMaxTp, cumulativeSessionProfit]);

  // Pattern detection logic
  const detectNeuralPatterns = (symbol: string, history: number[]) => {
    const triggerLen = 3;
    if (history.length < triggerLen) return;
    
    // Direct numerical comparison of the last 3 digits
    const d1 = history[history.length - 3];
    const d2 = history[history.length - 2];
    const d3 = history[history.length - 1];
    
    let occurrences: number[] = [];
    for (let i = 0; i < history.length - triggerLen; i++) {
      if (history[i] === d1 && history[i + 1] === d2 && history[i + 2] === d3) {
        const nextDigit = history[i + triggerLen];
        if (nextDigit !== undefined) {
          occurrences.push(nextDigit);
        }
      }
    }

    if (occurrences.length >= 2) {
      const currentSeq = `${d1},${d2},${d3}`;
      processNeuralResults(symbol, currentSeq, occurrences);
    }
  };

  const processNeuralResults = (symbol: string, seq: string, outcomes: number[]) => {
    const total = outcomes.length;
    const counts: Record<number, number> = {};
    outcomes.forEach(d => counts[d] = (counts[d] || 0) + 1);

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newSigs: OtivoSignal[] = [];

    // Over 5
    const overCount = outcomes.filter(d => d > 5).length;
    if (overCount / total >= 0.7) {
      newSigs.push({
        id: `neural-over-${symbol}-${seq}-${Date.now()}`,
        type: 'over',
        symbol,
        seq,
        conf: (overCount / total) * 100,
        time,
        pastOutcomes: outcomes
      });
    }

    // Under 4
    const underCount = outcomes.filter(d => d < 4).length;
    if (underCount / total >= 0.7) {
      newSigs.push({
        id: `neural-under-${symbol}-${seq}-${Date.now()}`,
        type: 'under',
        symbol,
        seq,
        conf: (underCount / total) * 100,
        time,
        pastOutcomes: outcomes
      });
    }

    // Differ
    for (let i = 0; i <= 9; i++) {
      if (!counts[i] && total >= 2) {
        newSigs.push({
          id: `neural-diff-${symbol}-${seq}-${i}-${Date.now()}`,
          type: 'differ',
          symbol,
          target: i,
          seq,
          conf: 100,
          time,
          pastOutcomes: outcomes
        });
      }
    }

    if (newSigs.length > 0) {
      setOtivoSignals(prev => {
        const updateBucket = (bucket: OtivoSignal[], type: 'over' | 'under' | 'differ') => {
          const itemsToAdd = newSigs.filter(s => s.type === type);
          if (itemsToAdd.length === 0) return bucket;
          
          const existingIds = new Set(itemsToAdd.map(a => `${a.symbol}-${a.seq}-${a.type === 'differ' ? a.target : ''}`));
          const filtered = bucket.filter(b => !existingIds.has(`${b.symbol}-${b.seq}-${b.type === 'differ' ? b.target : ''}`));
          
          return [...itemsToAdd, ...filtered].slice(0, 15);
        };

        return {
          over: updateBucket(prev.over, 'over'),
          under: updateBucket(prev.under, 'under'),
          differ: updateBucket(prev.differ, 'differ')
        };
      });

      setOtivoLog(prev => [`[${time}] ${symbol}: Neural Match Pattern [${seq}] discovered.`, ...prev].slice(0, 50));
    }
  };

  // Start the bot
  const startBot = () => {
    if (!token) {
      botEngine.getBotInterface().notify('error', 'Token error: Please log in to your Deriv account.');
      return;
    }

    if (checkedMarkets.length === 0) {
      botEngine.getBotInterface().notify('warn', 'Market Selection: Please choose at least one index to run.');
      return;
    }

    const numMartingale = Number(martingale) || 2.0;

    // Resolve base stake
    const rawBalance = rootStore.client.balance;
    let resolvedStake = isAutoStakeEnabled && rawBalance > 0 
      ? Math.max(0.35, Number(((rawBalance * 0.98) / (1 + numMartingale)).toFixed(2))) 
      : (Number(stake) || 1.0);

    // Apply 830 / 9130 caps for new accounts
    if (connectionType !== 'legacy') {
      if (isAutoStakeEnabled) {
        if (rawBalance > 9130 || resolvedStake > 830) {
          resolvedStake = 830;
        }
      }
    }
    const numStake = resolvedStake;

    // Reset session metrics
    const startInReal = !useVirtualLoss || virtualAfterRealLoss;
    setSessionProfit(0);
    setTradesCount(0);
    setWinsCount(0);
    setLossesCount(0);
    setCurrentStake(resolvedStake);
    setConsecutiveVirtualLosses(0);
    setVirtualWinsCount(0);
    setVirtualLossesCount(0);
    setIsCurrentTradeReal(startInReal);

    // Reset standard bot engine stats for the new session
    botEngine.resetStats();
    // Clear engine-level takeProfit and stopLoss settings to prevent premature stops from previous sessions
    botEngine.tradeParams.options.takeProfit = 0;
    botEngine.tradeParams.options.stopLoss = 0;
    botEngine.tradeParams.options.amount = numStake;
    botEngine.tradeParams.accumulator.amount = numStake;
    botEngine.tradeParams.multiplier.amount = numStake;

    // Synchronize window fields
    const slValue = isAutoStakeEnabled ? Math.max(stopLoss, rawBalance + 10) : stopLoss;
    (window as any).AUTOBOT_TARGET = null;
    (window as any).AUTOBOT_LOCKED_MARKET = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET = null;
    (window as any).AUTOBOT_CONTINUOUS_REAL_UNLOCKED = false;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = null;
    (window as any).AUTOBOT_LAST_CONTRACT_TYPE = null;
    (window as any).AUTOBOT_LAST_PREDICTION = null;
    (window as any).AUTOBOT_CONTRACT_TYPE = contractType;
    (window as any).AUTOBOT_CONTINUOUS_TRADING = isContinuousTrading;
    (window as any).AUTOBOT_CHECKED_MARKETS_COUNT = checkedMarkets.length;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
    circleOuConsecutiveCountRef.current = {};
    circleOuMarketStatesRef.current = {};
    (window as any).AUTOBOT_ACTIVE = true;
    (window as any).AUTOBOT_STAKE = numStake;
    (window as any).AUTOBOT_AUTO_STAKE_ENABLED = isAutoStakeEnabled;
    (window as any).AUTOBOT_MARTINGALE = numMartingale;
    (window as any).AUTOBOT_TP = Number(takeProfit) || 100.0;
    (window as any).AUTOBOT_SL = Number(slValue) || 100.0;
    (window as any).AUTOBOT_RUN_FOREVER = runForever;
    (window as any).AUTOBOT_IS_RUNS_MODE = isRunsLimitEnabled;
    (window as any).AUTOBOT_RUNS_LIMIT = Number(runsLimit) || 5;
    (window as any).AUTOBOT_WINS = 0;
    (window as any).AUTOBOT_PROFIT = 0;
    (window as any).AUTOBOT_CONSEC_LOSSES = 0;
    (window as any).AUTOBOT_LAST_LOSS_TIME = 0;
    (window as any).AUTOBOT_LAST_LOST_MARKET = null;
    (window as any).AUTOBOT_LOST_PATTERNS = [];
    (window as any).AUTOBOT_LAST_PATTERN_KEY = null;
    (window as any).AUTOBOT_CURRENT_STAKE = numStake;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
    (window as any).AUTOBOT_PATTERN_SMART_MODE = (contractType === 'dual_ou' || contractType === 'digitover' || contractType === 'digitunder') ? false : patternSmartMode;
    (window as any).AUTOBOT_PATTERN_ROTATIONAL_MODE = (contractType === 'dual_ou' || contractType === 'digitover' || contractType === 'digitunder') ? false : patternRotationalMode;
    (window as any).AUTOBOT_STREAK_MODE = streakMode;
    (window as any).AUTOBOT_IS_RECOVERY_STREAK_MODE_ENABLED = isRecoveryStreakModeEnabled;
    (window as any).AUTOBOT_RECOVERY_STREAK_MODE = recoveryStreakMode;
    (window as any).AUTOBOT_CONNECTION_TYPE = connectionType;
    (window as any).AUTOBOT_PATTERN_RECOVERY_MODE = patternRecoveryMode;
    (window as any).AUTOBOT_ALTERNATE_MARKET_RECOVERY = alternateMarketRecovery;
    (window as any).AUTOBOT_TRADE_DURATION = tradeDuration;
    (window as any).AUTOBOT_RANDOM_TICKS = isRandomTicks;
    (window as any).AUTOBOT_TARGET_DIGIT = targetDigit;
    (window as any).AUTOBOT_USE_VIRTUAL_LOSS = useVirtualLoss;
    (window as any).AUTOBOT_VIRTUAL_AFTER_REAL_LOSS = virtualAfterRealLoss;
    (window as any).AUTOBOT_VIRTUAL_LOSS_THRESHOLD = Math.max(1, Number(virtualLossThreshold) || 2);
    (window as any).AUTOBOT_CONSEC_VIRTUAL_LOSSES = 0;
    (window as any).AUTOBOT_VIRTUAL_WINS = 0;
    (window as any).AUTOBOT_VIRTUAL_LOSSES = 0;
    (window as any).AUTOBOT_IS_CURRENT_TRADE_REAL = startInReal;
    (window as any).AUTOBOT_AUTO_RESTART_AFTER_TP = autoRestartAfterTp;
    (window as any).AUTOBOT_AUTO_RESTART_MAX_TP = Number(autoRestartMaxTp) || 50.0;
    (window as any).AUTOBOT_CUMULATIVE_SESSION_PROFIT = cumulativeSessionProfitRef.current;

    let activePattern = customPattern;
    if (streakMode === 'pattern' && patternSmartMode && contractType !== 'dual_ou' && contractType !== 'digitover' && contractType !== 'digitunder') {
      const learned = runPatternLearning();
      if (learned) {
        activePattern = learned.pattern;
        setCustomPattern(learned.pattern);
        (window as any).AUTOBOT_PATTERN_SMART_DIGIT = learned.digit;
        setPatternSmartDigit(learned.digit);
        localStorage.setItem('autobot_custom_pattern', learned.pattern);
        localStorage.setItem('autobot_pattern_smart_digit', learned.digit.toString());
      }
    }
    (window as any).AUTOBOT_CUSTOM_PATTERN = activePattern;

    // Build standard runner script Safe-Guarded against non-inputs or NaNs
    const scriptCode = `
      window.INITIALIZATION = async function() {
        window.AUTOBOT_ACCUMULATOR_GROWTH_RATE = ${accumulatorGrowthRate / 100};
        window.AUTOBOT_ACCUMULATOR_TAKE_PROFIT = ${accumulatorTakeProfit};
        window.AUTOBOT_TRADE_DURATION = ${tradeDuration};
        window.AUTOBOT_RANDOM_TICKS = ${isRandomTicks};
        window.AUTOBOT_TARGET_DIGIT = ${targetDigit};
        window.AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
        window.AUTOBOT_LOCKED_MARKET = null;
        if (window.AUTOBOT_USE_VIRTUAL_LOSS) {
          var vLossReq = Math.max(1, Number(window.AUTOBOT_VIRTUAL_LOSS_THRESHOLD) || 2);
          if (window.AUTOBOT_CONTINUOUS_TRADING) {
            Bot.setVirtualTradeConfig(vLossReq, 999999, 0);
          } else {
            Bot.setVirtualTradeConfig(vLossReq, 1, vLossReq);
          }
        }
        Bot.notify('success', 'Auto Bot initialized safely. Watching selected ticks.');
      };

      window.TRADE_OPTIONS = async function() {
        while (window.AUTOBOT_ACTIVE && !window.AUTOBOT_TARGET) {
          if (!window.AUTOBOT_SIGNAL_QUEUE) {
            window.AUTOBOT_SIGNAL_QUEUE = [];
          }

          // Filter out stale signals (older than 15 seconds) AND signals from the last lost market (for multi-market recovery)
          const now = Date.now();
          const lastLostMarket = window.AUTOBOT_LAST_LOST_MARKET;
          const checkedCount = window.AUTOBOT_CHECKED_MARKETS_COUNT || 1;
          const alternateRec = window.AUTOBOT_ALTERNATE_MARKET_RECOVERY !== false && checkedCount > 1;
          const vLockedMarket = window.AUTOBOT_VIRTUAL_LOCKED_MARKET || window.AUTOBOT_LOCKED_MARKET;
          window.AUTOBOT_SIGNAL_QUEUE = window.AUTOBOT_SIGNAL_QUEUE.filter(function(sig) {
            const isStale = (now - sig.timestamp) >= 15000;
            const isLastLost = alternateRec && !vLockedMarket && lastLostMarket && sig.symbol === lastLostMarket;
            const isBlockedByLock = vLockedMarket ? sig.symbol !== vLockedMarket : false;
            return !isStale && !isLastLost && !isBlockedByLock;
          });

          if (window.AUTOBOT_SIGNAL_QUEUE.length > 0) {
            // Shift out the first/oldest signal and clear queue so no trailing signals execute automatically
            const nextSignal = window.AUTOBOT_SIGNAL_QUEUE.shift();
            window.AUTOBOT_SIGNAL_QUEUE = [];
            window.AUTOBOT_TARGET = nextSignal;
            break;
          }

          await Bot.sleep(0.05);
        }
        if (!window.AUTOBOT_ACTIVE) return;

        if (window.AUTOBOT_AUTO_STAKE_ENABLED && window.AUTOBOT_CONSEC_LOSSES === 0) {
          var currentBalance = Bot.getBalance('NUM');
          if (currentBalance > 0) {
            var mFactor = Number(window.AUTOBOT_MARTINGALE) || 11;
            // Apply a 2% safety cushion so that rounding or commission drops don't trigger Insufficient Balance
            var calculatedBaseStake = Number(((currentBalance * 0.98) / (1 + mFactor)).toFixed(2));
            if (calculatedBaseStake < 0.35) calculatedBaseStake = 0.35;

            // Apply caps for new accounts
            if (window.AUTOBOT_CONNECTION_TYPE !== 'legacy') {
              if (currentBalance > 9130 || calculatedBaseStake > 830) {
                calculatedBaseStake = 830;
              }
            }

            window.AUTOBOT_STAKE = calculatedBaseStake;
            window.AUTOBOT_CURRENT_STAKE = calculatedBaseStake;
          }
        }

        // Force convert and sanitize stake to always keep in sync with inputs
        let amountToUse = Number(window.AUTOBOT_CURRENT_STAKE);
        if (isNaN(amountToUse) || amountToUse <= 0) {
          amountToUse = Number(window.AUTOBOT_STAKE) || 1.0;
          window.AUTOBOT_CURRENT_STAKE = amountToUse;
        }

        if (window.AUTOBOT_CONNECTION_TYPE !== 'legacy') {
          if (amountToUse > 9130) {
            amountToUse = 9130;
            window.AUTOBOT_CURRENT_STAKE = 9130;
          }
        }

        if (window.AUTOBOT_AUTO_STAKE_ENABLED) {
          var currentBalance = Bot.getBalance('NUM');
          if (currentBalance > 0 && amountToUse > currentBalance) {
            Bot.notify('warn', 'Martingale recovery stake ($' + amountToUse.toFixed(2) + ') exceeds available balance ($' + currentBalance.toFixed(2) + '). Restarting from base stake.');
            var baseStake = Number(window.AUTOBOT_STAKE);
            if (isNaN(baseStake) || baseStake <= 0) {
              var mFactor = Number(window.AUTOBOT_MARTINGALE) || 11;
              baseStake = Number(((currentBalance * 0.98) / (1 + mFactor)).toFixed(2));
              if (baseStake < 0.35) baseStake = 0.35;
              if (window.AUTOBOT_CONNECTION_TYPE !== 'legacy') {
                if (currentBalance > 9130 || baseStake > 830) {
                  baseStake = 830;
                }
              }
            }
            amountToUse = baseStake;
            window.AUTOBOT_STAKE = baseStake;
            window.AUTOBOT_CURRENT_STAKE = baseStake;
            window.AUTOBOT_CONSEC_LOSSES = 0;
          }
        }

        const target = window.AUTOBOT_TARGET;
        var activeCfgType = (window.AUTOBOT_CONSEC_LOSSES > 0 && window.AUTOBOT_IS_RECOVERY_STREAK_MODE_ENABLED)
          ? null
          : window.AUTOBOT_CONTRACT_TYPE;
        if (activeCfgType === 'digitover') {
          target.type = 'digitover';
          target.contractType = 'DIGITOVER';
          if (target.prediction === undefined || target.prediction === null) {
            var liveOverDigit = Number(window.AUTOBOT_TARGET_DIGIT);
            if (!isNaN(liveOverDigit) && liveOverDigit >= 0 && liveOverDigit <= 8) {
              target.prediction = liveOverDigit;
              target.barrier = liveOverDigit;
            } else {
              target.prediction = 2;
              target.barrier = 2;
            }
          }
        } else if (activeCfgType === 'digitunder') {
          target.type = 'digitunder';
          target.contractType = 'DIGITUNDER';
          if (target.prediction === undefined || target.prediction === null) {
            var liveUnderDigit = Number(window.AUTOBOT_TARGET_DIGIT);
            if (!isNaN(liveUnderDigit) && liveUnderDigit >= 1 && liveUnderDigit <= 9) {
              target.prediction = liveUnderDigit;
              target.barrier = liveUnderDigit;
            } else {
              target.prediction = 8;
              target.barrier = 8;
            }
          }
        } else if (activeCfgType === 'digitmatch') {
          target.type = 'digitmatch';
          target.contractType = 'DIGITMATCH';
          if (target.prediction === undefined || target.prediction === null) {
            var liveMatchDigit = Number(window.AUTOBOT_TARGET_DIGIT);
            if (!isNaN(liveMatchDigit) && liveMatchDigit >= 0 && liveMatchDigit <= 9) {
              target.prediction = liveMatchDigit;
            }
          }
        } else if (activeCfgType === 'accumulator') {
          target.type = 'accumulator';
          target.contractType = 'ACCU';
        } else if (activeCfgType === 'digitdiff' || target.contractType === 'DIGITDIFF' || target.type === 'digitdiff') {
          target.type = 'digitdiff';
          target.contractType = 'DIGITDIFF';
          if (target.prediction === undefined || target.prediction === null) {
            var diffDigit = Number(window.AUTOBOT_TARGET_DIGIT);
            target.prediction = (!isNaN(diffDigit) && diffDigit >= 0 && diffDigit <= 9)
              ? diffDigit
              : (window.AUTOBOT_LAST_PREDICTION !== undefined && window.AUTOBOT_LAST_PREDICTION !== null ? window.AUTOBOT_LAST_PREDICTION : 0);
          }
        }

        Bot.switchMarket(target.symbol);
        var effDuration = window.AUTOBOT_RANDOM_TICKS 
          ? (Math.floor(Math.random() * 10) + 1)
          : Math.min(10, Math.max(1, Number(window.AUTOBOT_TRADE_DURATION) || 1));

        if (target.contractType === 'ACCU') {
          Bot.setTradeTypeCategory('accumulator');
          Bot.setTradeType('accumulator');
          Bot.setContractType('ACCU');
          Bot.setAccumulatorParams({
            amount: amountToUse,
            growthRate: target.accuGrowthRate !== undefined ? target.accuGrowthRate : (Number(window.AUTOBOT_ACCUMULATOR_GROWTH_RATE) || 0.02),
            takeProfit: target.accuTakeProfit !== undefined ? target.accuTakeProfit : (Number(window.AUTOBOT_ACCUMULATOR_TAKE_PROFIT) || 10)
          });
          Bot.setTradeOptions({
            amount: amountToUse
          });
        } else if (target.type === 'dual_ou') {
          Bot.setTradeTypeCategory('digits');
          Bot.setTradeType('over_under');
          Bot.setContractType('OVER_UNDER');
          Bot.setTradeOptions({
            durationType: 't',
            duration: effDuration,
            amount: amountToUse,
            prediction: target.prediction,
            prediction2: target.prediction2
          });
        } else if (target.contractType === 'DIGITOVER' || target.type === 'digitover') {
          Bot.setTradeTypeCategory('digits');
          Bot.setTradeType('over_under');
          Bot.setContractType('DIGITOVER');
          var overPred = target.prediction !== undefined ? target.prediction : (target.barrier !== undefined ? target.barrier : (window.AUTOBOT_TARGET_DIGIT !== undefined ? window.AUTOBOT_TARGET_DIGIT : 1));
          Bot.setPrediction(overPred);
          Bot.setTradeOptions({
            durationType: 't',
            duration: effDuration,
            amount: amountToUse,
            prediction: overPred
          });
        } else if (target.contractType === 'DIGITUNDER' || target.type === 'digitunder') {
          Bot.setTradeTypeCategory('digits');
          Bot.setTradeType('over_under');
          Bot.setContractType('DIGITUNDER');
          var underPred = target.prediction !== undefined ? target.prediction : (target.barrier !== undefined ? target.barrier : (window.AUTOBOT_TARGET_DIGIT !== undefined ? window.AUTOBOT_TARGET_DIGIT : 8));
          Bot.setPrediction(underPred);
          Bot.setTradeOptions({
            durationType: 't',
            duration: effDuration,
            amount: amountToUse,
            prediction: underPred
          });
        } else {
          Bot.setTradeTypeCategory('digits');
          Bot.setTradeType(target.type);
          Bot.setContractType(target.contractType);
          Bot.setTradeOptions({
            durationType: 't',
            duration: effDuration,
            amount: amountToUse,
            prediction: target.prediction
          });
        }
      };

      window.BEFORE_PURCHASE = async function() {
        if (!window.AUTOBOT_TARGET) return;
        const target = window.AUTOBOT_TARGET;
        window.AUTOBOT_LAST_SYMBOL = target.symbol; // Guard the active lastSymbol
        window.AUTOBOT_LAST_STRATEGY = null;
        window.AUTOBOT_LAST_PATTERN_KEY = target.matchedPatternKey || null;

        // Determine if this specific trade should use Real money
        var vThreshold = Math.max(1, Number(window.AUTOBOT_VIRTUAL_LOSS_THRESHOLD) || 2);
        var vConsec = Number(window.AUTOBOT_CONSEC_VIRTUAL_LOSSES) || 0;
        var isContRealUnlocked = Boolean(window.AUTOBOT_CONTINUOUS_TRADING && window.AUTOBOT_CONTINUOUS_REAL_UNLOCKED);
        var isVirtualAfterRealLoss = Boolean(window.AUTOBOT_VIRTUAL_AFTER_REAL_LOSS);
        var shouldTradeReal = true;
        if (window.AUTOBOT_USE_VIRTUAL_LOSS) {
          if (isContRealUnlocked) {
            shouldTradeReal = true;
          } else if (isVirtualAfterRealLoss) {
            // When Virtual After Real Loss is active: trade real unless in virtual mode filtering after a real loss
            shouldTradeReal = Boolean(window.AUTOBOT_IS_CURRENT_TRADE_REAL) || vConsec >= vThreshold;
          } else {
            shouldTradeReal = (Bot.getVirtualMode() === 'real' || vConsec >= vThreshold);
          }
        }
        if (shouldTradeReal) {
          if (window.AUTOBOT_CONTINUOUS_TRADING) {
            window.AUTOBOT_CONTINUOUS_REAL_UNLOCKED = true;
            Bot.setVirtualTradeConfig(0, 999999, 0);
          } else {
            Bot.setVirtualTradeConfig(0, 1, 0);
          }
        } else {
          Bot.setVirtualTradeConfig(vThreshold, 1, vThreshold);
        }
        window.AUTOBOT_IS_CURRENT_TRADE_REAL = shouldTradeReal;

        var selectedContractType = target.contractType || target.type;
        var selectedPrediction = target.prediction !== undefined ? target.prediction : target.barrier;
        if ((selectedContractType === 'DIGITDIFF' || selectedContractType === 'digitdiff') && (selectedPrediction === undefined || selectedPrediction === null)) {
          var diffDigit = Number(window.AUTOBOT_TARGET_DIGIT);
          selectedPrediction = (!isNaN(diffDigit) && diffDigit >= 0 && diffDigit <= 9)
            ? diffDigit
            : (window.AUTOBOT_LAST_PREDICTION !== undefined && window.AUTOBOT_LAST_PREDICTION !== null ? window.AUTOBOT_LAST_PREDICTION : 0);
        }
        var contractDisplay = (selectedContractType === 'DIGITOVER' || selectedContractType === 'digitover')
          ? ('DIGITOVER ' + (selectedPrediction !== undefined ? selectedPrediction : 2))
          : (selectedContractType === 'DIGITUNDER' || selectedContractType === 'digitunder')
          ? ('DIGITUNDER ' + (selectedPrediction !== undefined ? selectedPrediction : 8))
          : (selectedContractType === 'DIGITMATCH' || selectedContractType === 'digitmatch')
          ? ('DIGITMATCH ' + (selectedPrediction !== undefined ? selectedPrediction : 0))
          : (selectedContractType === 'ACCU' || selectedContractType === 'accumulator' || selectedContractType === 'accu')
          ? 'ACCU'
          : ('DIGITDIFF ' + (selectedPrediction !== undefined ? selectedPrediction : 0));

        let stratNameInfo = '';
        if (window.AUTOBOT_CONSEC_LOSSES > 0 && shouldTradeReal) {
          stratNameInfo = ' (MARTINGALE RECOVERY AFTER LOSS)';
        }
        if (shouldTradeReal) {
          console.log('🔥 Virtual loss threshold hit! Executing REAL trade (' + contractDisplay + ')...');
          Bot.notify('info', '🔥 Auto Bot REAL Trade [' + contractDisplay + ']: streak reached on ' + target.symbol + stratNameInfo + '. Purchasing...');
        } else {
          console.log('🧪 Running Virtual Trade [' + contractDisplay + '] (' + vConsec + '/' + vThreshold + ' losses)');
          Bot.notify('info', '🧪 Auto Bot Virtual Trade [' + contractDisplay + '] (' + vConsec + '/' + vThreshold + ' losses): simulating on ' + target.symbol + '...');
        }

        window.AUTOBOT_LAST_CONTRACT_TYPE = selectedContractType;
        window.AUTOBOT_LAST_PREDICTION = selectedPrediction;

        var purchaseResult = false;
        if (selectedContractType === 'dual_ou') {
          purchaseResult = await Bot.purchaseDual('DIGITOVER', 'DIGITUNDER');
        } else if (selectedContractType === 'DIGITOVER' || selectedContractType === 'digitover') {
          var overPred = selectedPrediction !== undefined ? selectedPrediction : 1;
          purchaseResult = Bot.purchase('DIGITOVER', overPred);
        } else if (selectedContractType === 'DIGITUNDER' || selectedContractType === 'digitunder') {
          var underPred = selectedPrediction !== undefined ? selectedPrediction : 8;
          purchaseResult = Bot.purchase('DIGITUNDER', underPred);
        } else if (selectedContractType === 'ACCU' || selectedContractType === 'accumulator' || selectedContractType === 'accu') {
          purchaseResult = Bot.purchase('ACCU');
        } else {
          purchaseResult = Bot.purchase(selectedContractType, selectedPrediction);
        }

        // Only clear target if purchase actually initiated, so signal isn't lost if engine is momentarily busy
        if (purchaseResult !== false) {
          window.AUTOBOT_TARGET = null; // Clear immediately to allow fresh signals next turn
          if (typeof window.AUTOBOT_RESET_STRICT_LOOKAHEAD === 'function') {
            window.AUTOBOT_RESET_STRICT_LOOKAHEAD(target.symbol);
          }
        }
      };

      window.AFTER_PURCHASE = async function() {
        var result = false;
        var profit = 0;
        var contractId = '';
        var isVirtualTrade = false;
        try {
          result = Bot.checkResult('win');
          profit = Bot.readDetail('profit') || 0;
          contractId = String(Bot.readDetail('contract_id') || '');
          isVirtualTrade = !window.AUTOBOT_IS_CURRENT_TRADE_REAL || contractId.indexOf('vt_') === 0;

          window.AUTOBOT_SIGNAL_QUEUE = [];
          if (window.AUTOBOT_CONTINUOUS_TRADING && window.AUTOBOT_CONTINUOUS_LOCKED_MARKET) {
            window.AUTOBOT_LOCKED_MARKET = window.AUTOBOT_CONTINUOUS_LOCKED_MARKET;
          } else if (window.AUTOBOT_USE_VIRTUAL_LOSS && !window.AUTOBOT_CONTINUOUS_TRADING && isVirtualTrade && !result) {
            window.AUTOBOT_VIRTUAL_LOCKED_MARKET = window.AUTOBOT_LAST_SYMBOL;
            window.AUTOBOT_LOCKED_MARKET = window.AUTOBOT_LAST_SYMBOL;
          } else {
            window.AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
            window.AUTOBOT_LOCKED_MARKET = null;
          }

          if (isVirtualTrade) {
            // Handling VIRTUAL trade outcome
            var vThreshold = Math.max(1, Number(window.AUTOBOT_VIRTUAL_LOSS_THRESHOLD) || 2);
            if (result) {
              // Virtual win resets the loss streak counter back to 0
              window.AUTOBOT_CONSEC_VIRTUAL_LOSSES = 0;
              window.AUTOBOT_VIRTUAL_WINS = (window.AUTOBOT_VIRTUAL_WINS || 0) + 1;
              if (!window.AUTOBOT_CONTINUOUS_TRADING) {
                window.AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
                window.AUTOBOT_LOCKED_MARKET = null;
              }
              Bot.notify('info', '🧪 Virtual Trade WON (+' + profit.toFixed(2) + '). Virtual W/L: ' + window.AUTOBOT_VIRTUAL_WINS + '/' + (window.AUTOBOT_VIRTUAL_LOSSES || 0) + ' | Streak reset to 0/' + vThreshold + '. Resuming scan across markets.');
            } else {
              // Increment consecutive virtual losses
              window.AUTOBOT_CONSEC_VIRTUAL_LOSSES = (window.AUTOBOT_CONSEC_VIRTUAL_LOSSES || 0) + 1;
              window.AUTOBOT_VIRTUAL_LOSSES = (window.AUTOBOT_VIRTUAL_LOSSES || 0) + 1;
              if (!window.AUTOBOT_CONTINUOUS_TRADING) {
                window.AUTOBOT_VIRTUAL_LOCKED_MARKET = window.AUTOBOT_LAST_SYMBOL;
                window.AUTOBOT_LOCKED_MARKET = window.AUTOBOT_LAST_SYMBOL;
              }

              if (window.AUTOBOT_CONSEC_VIRTUAL_LOSSES >= vThreshold) {
                window.AUTOBOT_IS_CURRENT_TRADE_REAL = true;
                if (window.AUTOBOT_CONTINUOUS_TRADING) {
                  window.AUTOBOT_CONTINUOUS_REAL_UNLOCKED = true;
                  Bot.setVirtualTradeConfig(0, 999999, 0);
                  Bot.notify('info', '🔥 Initial Virtual Mode completed (' + window.AUTOBOT_CONSEC_VIRTUAL_LOSSES + '/' + vThreshold + '). Switching to continuous REAL trading...');
                } else {
                  Bot.setVirtualTradeConfig(0, 1, 0);
                  Bot.notify('info', '🔥 Virtual loss threshold met (' + window.AUTOBOT_CONSEC_VIRTUAL_LOSSES + '/' + vThreshold + ') on ' + window.AUTOBOT_LAST_SYMBOL + '! Executing REAL trade immediately without delay...');
                }

                // Immediately arm the real target for instant execution without waiting for next signal or cooldown
                var nextRealStake = Number(window.AUTOBOT_CURRENT_STAKE);
                if (isNaN(nextRealStake) || nextRealStake <= 0) {
                  nextRealStake = Number(window.AUTOBOT_STAKE) || 1.0;
                }
                var lastType = window.AUTOBOT_LAST_CONTRACT_TYPE || (window.AUTOBOT_CONTRACT_TYPE === 'digitmatch' ? 'DIGITMATCH' : (window.AUTOBOT_CONTRACT_TYPE === 'digitover' ? 'DIGITOVER' : (window.AUTOBOT_CONTRACT_TYPE === 'digitunder' ? 'DIGITUNDER' : 'DIGITDIFF')));
                var diffFallbackDigit = Number(window.AUTOBOT_TARGET_DIGIT);
                var lastPred = window.AUTOBOT_LAST_PREDICTION !== undefined && window.AUTOBOT_LAST_PREDICTION !== null
                  ? window.AUTOBOT_LAST_PREDICTION
                  : (!isNaN(diffFallbackDigit) && diffFallbackDigit >= 0 && diffFallbackDigit <= 9 ? diffFallbackDigit : 0);

                window.AUTOBOT_TARGET = {
                  symbol: window.AUTOBOT_LAST_SYMBOL,
                  type: (lastType === 'DIGITMATCH' || lastType === 'digitmatch') ? 'digitmatch' : (lastType === 'DIGITDIFF' || lastType === 'digitdiff') ? 'digitdiff' : String(lastType).toLowerCase(),
                  contractType: lastType,
                  prediction: lastPred,
                  amount: nextRealStake,
                  timestamp: Date.now(),
                  strategyName: '🔥 Immediate Real Execution after Virtual Loss Threshold'
                };
              } else {
                Bot.notify('warn', '🧪 Virtual Trade LOST (' + profit.toFixed(2) + ') on ' + window.AUTOBOT_LAST_SYMBOL + '. Virtual W/L: ' + (window.AUTOBOT_VIRTUAL_WINS || 0) + '/' + window.AUTOBOT_VIRTUAL_LOSSES + ' | Streak: ' + window.AUTOBOT_CONSEC_VIRTUAL_LOSSES + '/' + vThreshold + '. Maintaining on ' + window.AUTOBOT_LAST_SYMBOL + ' to check next trade...');
              }
            }

            window.dispatchEvent(new CustomEvent('autobot_trade_result', {
              detail: {
                result,
                profit,
                contractId,
                sessionProfit: window.AUTOBOT_PROFIT,
                wins: window.AUTOBOT_WINS || 0,
                lastSymbol: window.AUTOBOT_LAST_SYMBOL || '',
                isVirtual: true,
                consecutiveVirtualLosses: window.AUTOBOT_CONSEC_VIRTUAL_LOSSES,
                virtualWins: window.AUTOBOT_VIRTUAL_WINS || 0,
                virtualLosses: window.AUTOBOT_VIRTUAL_LOSSES || 0,
                lockedVirtualMarket: window.AUTOBOT_VIRTUAL_LOCKED_MARKET || null
              }
            }));
          } else {
            // Handling REAL trade outcome
            window.AUTOBOT_PROFIT += profit;

            if (window.AUTOBOT_CONTINUOUS_TRADING) {
              // In Continuous Trading after a signal, Virtual Mode is only used on the first trade entry;
              // keep trading continuously on Real for all subsequent trades.
              window.AUTOBOT_CONTINUOUS_REAL_UNLOCKED = true;
              window.AUTOBOT_IS_CURRENT_TRADE_REAL = true;
              if (window.AUTOBOT_USE_VIRTUAL_LOSS) {
                Bot.setVirtualTradeConfig(0, 999999, 0);
              }
            } else {
              // Reset virtual loss counter after real trade completes and unlock market
              window.AUTOBOT_CONSEC_VIRTUAL_LOSSES = 0;
              window.AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
              window.AUTOBOT_LOCKED_MARKET = null;
              if (window.AUTOBOT_USE_VIRTUAL_LOSS) {
                var vLossReq = Math.max(1, Number(window.AUTOBOT_VIRTUAL_LOSS_THRESHOLD) || 2);
                if (window.AUTOBOT_VIRTUAL_AFTER_REAL_LOSS) {
                  if (result) {
                    // Won real trade: stay in Real Mode
                    window.AUTOBOT_IS_CURRENT_TRADE_REAL = true;
                    Bot.setVirtualTradeConfig(0, 999999, 0);
                  } else {
                    // Lost real trade: switch to Virtual Mode to filter out loss streak
                    window.AUTOBOT_IS_CURRENT_TRADE_REAL = false;
                    Bot.setVirtualTradeConfig(vLossReq, 1, vLossReq);
                    Bot.notify('warn', '🔥 Real trade LOST. Switching to Virtual Mode to filter out loss streak (' + vLossReq + ' virtual losses required before next real trade)...');
                  }
                } else {
                  window.AUTOBOT_IS_CURRENT_TRADE_REAL = false;
                  Bot.setVirtualTradeConfig(vLossReq, 1, vLossReq);
                }
              } else {
                window.AUTOBOT_IS_CURRENT_TRADE_REAL = true;
              }
            }

            if (result) {
              Bot.notify('success', 'Auto Bot outcome: WON (+' + profit.toFixed(2) + ')');
              window.AUTOBOT_WINS = (window.AUTOBOT_WINS || 0) + 1;
              window.AUTOBOT_CONSEC_LOSSES = 0;
              window.AUTOBOT_LAST_LOSS_TIME = 0;
              window.AUTOBOT_LAST_LOST_MARKET = null;
              window.AUTOBOT_LOST_PATTERNS = [];
              window.AUTOBOT_LAST_CONTRACT_TYPE = null;
              window.AUTOBOT_LAST_PREDICTION = null;
              window.AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE = null;
              window.AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = null;
              
              let baseStake = Number(window.AUTOBOT_STAKE);
              if (isNaN(baseStake) || baseStake <= 0) baseStake = 1.0;
              window.AUTOBOT_CURRENT_STAKE = baseStake;
            } else {
              Bot.notify('warn', 'Auto Bot outcome: LOST (' + profit.toFixed(2) + ')');
              window.AUTOBOT_CONSEC_LOSSES += 1;
              window.AUTOBOT_LAST_LOST_MARKET = window.AUTOBOT_LAST_SYMBOL || null;
              window.AUTOBOT_LAST_LOSS_TIME = Date.now();

              if (window.AUTOBOT_STREAK_MODE === 'pattern') {
                const lostKey = window.AUTOBOT_LAST_PATTERN_KEY;
                if (lostKey) {
                  if (!window.AUTOBOT_LOST_PATTERNS) {
                    window.AUTOBOT_LOST_PATTERNS = [];
                  }
                  if (!window.AUTOBOT_LOST_PATTERNS.includes(lostKey)) {
                    window.AUTOBOT_LOST_PATTERNS.push(lostKey);
                  }
                }
              }
              
              let currentStake = Number(window.AUTOBOT_CURRENT_STAKE);
              let mFactor = Number(window.AUTOBOT_MARTINGALE);
              if (isNaN(currentStake) || currentStake <= 0) currentStake = Number(window.AUTOBOT_STAKE) || 1.0;
              if (isNaN(mFactor) || mFactor < 1) mFactor = 2.0;
              
              let nextStake = Number((currentStake * mFactor).toFixed(2));
              if (window.AUTOBOT_CONNECTION_TYPE !== 'legacy') {
                if (nextStake > 9130) {
                  Bot.notify('warn', 'Martingale recovery stake reached the maximum ceiling of $9130. Capping stake.');
                  nextStake = 9130;
                }
              }
              window.AUTOBOT_CURRENT_STAKE = nextStake;

              if (window.AUTOBOT_PATTERN_SMART_MODE && window.AUTOBOT_STREAK_MODE === 'pattern') {
                var originalPattern = window.AUTOBOT_CUSTOM_PATTERN || '686';
                var originalDigit = window.AUTOBOT_PATTERN_SMART_DIGIT !== undefined ? window.AUTOBOT_PATTERN_SMART_DIGIT : -1;
                if (typeof window.AUTOBOT_LEARN_PATTERN_AFTER_LOSS === 'function') {
                  var res = window.AUTOBOT_LEARN_PATTERN_AFTER_LOSS(originalPattern, originalDigit);
                  if (res) {
                    window.AUTOBOT_CUSTOM_PATTERN = res.pattern;
                    window.AUTOBOT_PATTERN_SMART_DIGIT = res.digit;
                    Bot.notify('info', 'Pattern Learned: Smart pattern changed to [' + res.pattern + '] with prediction digit [' + res.digit + ']');
                  }
                }
              }

              if (window.AUTOBOT_IS_RECOVERY_STREAK_MODE_ENABLED) {
                Bot.notify('info', 'Smart Recovery Strategy is enabled. Waiting 5 seconds before allowing recovery streak mode contracts...');
                await Bot.sleep(5);
              }
            }

            window.dispatchEvent(new CustomEvent('autobot_trade_result', { 
              detail: { 
                result, 
                profit, 
                contractId, 
                sessionProfit: window.AUTOBOT_PROFIT,
                wins: window.AUTOBOT_WINS || 0,
                lastSymbol: window.AUTOBOT_LAST_SYMBOL || '',
                isVirtual: false,
                consecutiveVirtualLosses: 0
              } 
            }));
          }
        } catch (error) {
          Bot.notify('error', 'Error inside AFTER_PURCHASE handler: ' + error.message);
        }

        var isPreArmedImmediateReal = Boolean(
          window.AUTOBOT_TARGET && 
          window.AUTOBOT_IS_CURRENT_TRADE_REAL && 
          window.AUTOBOT_USE_VIRTUAL_LOSS && 
          (Number(window.AUTOBOT_CONSEC_VIRTUAL_LOSSES) >= (Math.max(1, Number(window.AUTOBOT_VIRTUAL_LOSS_THRESHOLD) || 2)))
        );
        if (!isPreArmedImmediateReal) {
          window.AUTOBOT_TARGET = null;
        }

        const runForever = window.AUTOBOT_RUN_FOREVER;
        const isRunsMode = window.AUTOBOT_IS_RUNS_MODE;
        const runsLimitTarget = window.AUTOBOT_RUNS_LIMIT || 5;
        const currentWins = window.AUTOBOT_WINS || 0;

        const autoRestartAfterTp = window.AUTOBOT_AUTO_RESTART_AFTER_TP;
        const autoRestartMaxTp = window.AUTOBOT_AUTO_RESTART_MAX_TP || 0;

        let shouldStop = false;
        let stopReason = '';
        let isTpStop = false;
        if (!isVirtualTrade && !runForever) {
          if (isRunsMode) {
            if (currentWins >= runsLimitTarget && result) {
              shouldStop = true;
              isTpStop = true;
              stopReason = 'Auto Bot session completed: Target wins (' + runsLimitTarget + ') met successfully on a winning trade.';
            } else if (window.AUTOBOT_PROFIT <= -window.AUTOBOT_SL) {
              shouldStop = true;
              stopReason = 'Auto Bot session completed: Stop loss triggered.';
            }
          } else {
            if (window.AUTOBOT_PROFIT >= window.AUTOBOT_TP) {
              shouldStop = true;
              isTpStop = true;
              stopReason = 'Auto Bot session completed: Take profit met.';
            } else if (window.AUTOBOT_PROFIT <= -window.AUTOBOT_SL) {
              shouldStop = true;
              stopReason = 'Auto Bot session completed: Stop loss triggered.';
            }
          }
        }

        if (shouldStop) {
          if (isTpStop && autoRestartAfterTp) {
            const currentCum = Number(((window.AUTOBOT_CUMULATIVE_SESSION_PROFIT || 0) + Math.max(0, window.AUTOBOT_PROFIT)).toFixed(2));
            window.AUTOBOT_CUMULATIVE_SESSION_PROFIT = currentCum;
            if (autoRestartMaxTp > 0 && currentCum >= autoRestartMaxTp) {
              Bot.notify('success', '🎉 AUTO-START TAKE PROFIT GOAL REACHED (+$' + currentCum.toFixed(2) + ' / $' + autoRestartMaxTp.toFixed(2) + ' USD)! Auto Start switch turned OFF & Bot stopped.');
              window.AUTOBOT_ACTIVE = false;
              window.AUTOBOT_AUTO_RESTART_AFTER_TP = false;
              Bot.stop();
            } else {
              window.AUTOBOT_PROFIT = 0;
              window.AUTOBOT_WINS = 0;
              window.AUTOBOT_CURRENT_STAKE = window.AUTOBOT_STAKE;
              window.AUTOBOT_CONSEC_LOSSES = 0;
              window.AUTOBOT_LAST_LOST_MARKET = null;
              window.AUTOBOT_LOCKED_MARKET = null;
              Bot.notify('success', stopReason + ' 🔄 Auto-Resetting session stats (Cumulative Profit: +$' + currentCum.toFixed(2) + ' / $' + autoRestartMaxTp.toFixed(2) + ' USD) & continuing...');
              await Bot.sleep(0.5);
              await Bot.tradeAgain();
            }
          } else {
            Bot.notify(isTpStop ? 'success' : 'error', stopReason);
            window.AUTOBOT_ACTIVE = false;
            window.AUTOBOT_CONTINUOUS_LOCKED_MARKET = null;
            window.AUTOBOT_CONTINUOUS_REAL_UNLOCKED = false;
            window.AUTOBOT_LOCKED_MARKET = null;
            window.AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
            Bot.stop();
          }
        } else if (!window.AUTOBOT_ACTIVE) {
          Bot.stop();
        } else {
          if (isPreArmedImmediateReal) {
            await Bot.sleep(0.01);
          } else {
            await Bot.sleep(0.1);
          }
          await Bot.tradeAgain();
        }
      };
    `;

    botEngine.start(token, scriptCode, 'autobot', 'Auto Bot', accId || undefined, connectionType);
    setIsRunning(true);
    botEngine.getBotInterface().notify('success', 'Auto Bot Started. Listening to market tick matrices.');
  };

  const stopBot = () => {
    (window as any).AUTOBOT_TARGET = null;
    (window as any).AUTOBOT_ACTIVE = false;
    (window as any).AUTOBOT_LAST_LOST_MARKET = null;
    (window as any).AUTOBOT_LOCKED_MARKET = null;
    (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET = null;
    (window as any).AUTOBOT_CONTINUOUS_REAL_UNLOCKED = false;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
    setLockedVirtualMarket(null);
    botEngine.stop();
    setIsRunning(false);
  };

  const resetBot = () => {
    if (isRunning) {
      (window as any).AUTOBOT_TARGET = null;
      (window as any).AUTOBOT_ACTIVE = false;
      (window as any).AUTOBOT_LOCKED_MARKET = null;
      (window as any).AUTOBOT_VIRTUAL_LOCKED_MARKET = null;
      (window as any).AUTOBOT_CONTINUOUS_LOCKED_MARKET = null;
      (window as any).AUTOBOT_CONTINUOUS_REAL_UNLOCKED = false;
      setLockedVirtualMarket(null);
      botEngine.stop();
      setIsRunning(false);
    }
    
    // Reset stats
    const resetInReal = !useVirtualLoss || virtualAfterRealLoss;
    setSessionProfit(0);
    setCumulativeSessionProfit(0);
    cumulativeSessionProfitRef.current = 0;
    sessionStorage.removeItem('autobot_cumulativeSessionProfit');
    (window as any).AUTOBOT_CUMULATIVE_SESSION_PROFIT = 0;
    setTradesCount(0);
    setWinsCount(0);
    setLossesCount(0);
    setCurrentStake(stake);
    setConsecutiveVirtualLosses(0);
    setVirtualWinsCount(0);
    setVirtualLossesCount(0);
    setIsCurrentTradeReal(resetInReal);
    setLockedVirtualMarket(null);
    
    // Clear logs & signals
    setOtivoLog([]);
    setOtivoSignals({
      over: [],
      under: [],
      differ: []
    });

    // Reset memory histories
    tickHistories.current = {};
    lastTradeTimePerSymbol.current = {};
    aiLOnRefRef.current = {};
    strictLookaheadStates.current = {};
    setMarketTicks({});

    // Clear globals
    (window as any).AUTOBOT_TARGET = null;
    (window as any).AUTOBOT_ACTIVE = false;
    (window as any).AUTOBOT_PROFIT = 0;
    (window as any).AUTOBOT_CONSEC_LOSSES = 0;
    (window as any).AUTOBOT_CONSEC_VIRTUAL_LOSSES = 0;
    (window as any).AUTOBOT_VIRTUAL_WINS = 0;
    (window as any).AUTOBOT_VIRTUAL_LOSSES = 0;
    (window as any).AUTOBOT_VIRTUAL_AFTER_REAL_LOSS = virtualAfterRealLoss;
    (window as any).AUTOBOT_IS_CURRENT_TRADE_REAL = resetInReal;
    (window as any).AUTOBOT_LAST_LOST_MARKET = null;
    (window as any).AUTOBOT_LOST_PATTERNS = [];
    (window as any).AUTOBOT_LAST_PATTERN_KEY = null;
    (window as any).AUTOBOT_CURRENT_STAKE = stake;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];

    botEngine.getBotInterface().notify('info', 'Auto Bot stats and history cleared successfully.');
  };

  const startBotRef = useRef(startBot);
  useEffect(() => {
    startBotRef.current = startBot;
  }, [startBot]);

  // Real-Time Alarm Scheduler Clock & Trigger Engine
  useEffect(() => {
    const alarmTimer = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const timeHHMM = `${hours}:${minutes}`;
      const timeHHMMSS = `${hours}:${minutes}:${seconds}`;
      const dateTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      setCurrentTimeStr(timeHHMMSS);

      setAlarms(prevAlarms => {
        if (!isAlarmSchedulerEnabledRef.current) return prevAlarms;

        let hasTriggeredAny = false;
        const currentDay = now.getDay();
        const updated = prevAlarms.map(alarm => {
          if (!alarm.enabled) return alarm;

          // Check if alarm days include today (defaults to all days if not specified)
          const activeDays = (Array.isArray(alarm.days) && alarm.days.length > 0) ? alarm.days : [0, 1, 2, 3, 4, 5, 6];
          if (!activeDays.includes(currentDay)) return alarm;

          // Check if time matches alarm setting (supports HH:mm or HH:mm:ss)
          const matchesTime = alarm.time === timeHHMM || alarm.time === timeHHMMSS;
          const triggerKey = `${dateTodayStr} ${alarm.time}`;

          if (matchesTime && alarm.triggeredToday !== triggerKey) {
            hasTriggeredAny = true;
            const alarmTitle = alarm.label ? `${alarm.label} (${alarm.time})` : `Scheduled Alarm ${alarm.time}`;

            if (!isRunningRef.current && !(window as any).AUTOBOT_ACTIVE) {
              botEngine.getBotInterface().notify('info', `⏰ Alarm Triggered: ${alarmTitle}! Starting Auto Bot automatically...`);
              setTimeout(() => {
                if (startBotRef.current) {
                  startBotRef.current();
                }
              }, 100);
            } else {
              botEngine.getBotInterface().notify('info', `⏰ Alarm Reached: ${alarmTitle} - Auto Bot is currently running.`);
            }

            return {
              ...alarm,
              triggeredToday: triggerKey
            };
          }
          return alarm;
        });

        return hasTriggeredAny ? updated : prevAlarms;
      });
    }, 1000);

    return () => clearInterval(alarmTimer);
  }, []);

  const handleAddAlarm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAlarmTime) {
      botEngine.getBotInterface().notify('warn', 'Please enter a valid alarm time.');
      return;
    }

    let formattedTime = newAlarmTime.trim();
    if (formattedTime.length === 5) {
      formattedTime = `${formattedTime}:00`;
    }

    const alarmId = `alarm-${Date.now()}`;
    const labelStr = newAlarmLabel.trim() || `Alarm ${formattedTime}`;
    const newAlarmItem: AutoBotAlarm = {
      id: alarmId,
      time: formattedTime,
      label: labelStr,
      enabled: true,
      days: newAlarmDays.length > 0 ? newAlarmDays : [0, 1, 2, 3, 4, 5, 6]
    };

    setAlarms(prev => [...prev, newAlarmItem]);
    addCloudAlarm(formattedTime, labelStr);
    setNewAlarmLabel('');
    botEngine.getBotInterface().notify('success', `⏰ Scheduled Alarm added for ${formattedTime} (${labelStr}) to Cloud Engine`);
  };

  const handleToggleAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => {
      if (a.id === id) {
        const nextState = !a.enabled;
        botEngine.getBotInterface().notify('info', `Alarm [${a.time}] turned ${nextState ? 'ON' : 'OFF'}`);
        return { ...a, enabled: nextState };
      }
      return a;
    }));
    toggleCloudAlarm(id);
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
    deleteCloudAlarm(id);
    botEngine.getBotInterface().notify('info', 'Alarm schedule removed from Cloud Engine.');
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    setCheckedMarkets(displayedSymbols);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    setCheckedMarkets([]);
  };

  const toggleSelectMarket = (symbol: string) => {
    setCheckedMarkets(prev => 
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
  };

  const isDigitMatchingHelper = (digit: number, lastDigit?: number, coldDigit?: number | null, index?: number, digits?: number[], symbol?: string) => {
    if (streakMode === 'pattern') {
      if (!digits || index === undefined) return false;
      const subPatterns = customPattern
        .split(',')
        .map(part => {
          const trimmed = part.trim();
          if (trimmed.includes('=')) {
            const eqIndex = trimmed.indexOf('=');
            const seqStr = trimmed.slice(0, eqIndex).replace(/[^0-9]/g, '');
            const digitStr = trimmed.slice(eqIndex + 1).replace(/[^0-9]/g, '');
            const digitVal = digitStr.length > 0 ? parseInt(digitStr, 10) : undefined;
            return { sequence: seqStr, digit: digitVal };
          }
          return { sequence: trimmed.replace(/[^0-9]/g, ''), digit: undefined };
        })
        .filter(part => part.sequence.length > 0);

      const lostPatterns = (window as any).AUTOBOT_LOST_PATTERNS || [];
      const consecLosses = (window as any).AUTOBOT_CONSEC_LOSSES || 0;

      for (const p of subPatterns) {
        const patternDigits = p.sequence.split('').map(char => parseInt(char, 10));
        if (patternDigits.length === 0) continue;
        if (digits.length >= patternDigits.length) {
          const lastSlice = digits.slice(-patternDigits.length);
          const matchesOverall = patternDigits.every((d, i) => lastSlice[i] === d);
          if (matchesOverall) {
            const pKey = p.digit !== undefined ? `${p.sequence}=${p.digit}` : p.sequence;
            const isRecActive = (window as any).AUTOBOT_PATTERN_RECOVERY_MODE !== false;
            if (isRecActive && consecLosses > 0 && lostPatterns.includes(pKey)) {
              continue;
            }
            if (index >= (digits.length - patternDigits.length)) {
              return true;
            }
          }
        }
      }
      return false;
    }
    if (streakMode === 'axa' && symbol) {
      const tickData = marketTicks[symbol] as any;
      if (tickData && tickData.axaSignal) {
        return digit === tickData.axaSignal.prediction;
      }
      return false;
    }
    if (streakMode === 'types' && symbol) {
      const tickData = marketTicks[symbol];
      if (tickData && tickData.typesSignal) {
        return digit === tickData.typesSignal.prediction;
      }
      return false;
    }
    if (targetDigit === -1) {
      if (streakMode === 'consecutive') {
        return lastDigit !== undefined && digit === lastDigit;
      }
      return false;
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

  const isOverActive = contractType === 'digitover' || (contractType === 'over_under' && ouPatternSelection !== 'under8');
  const isUnderActive = contractType === 'digitunder' || (contractType === 'over_under' && ouPatternSelection === 'under8');
  const activeOverDigit = (targetDigit >= 0 && targetDigit <= 8) ? targetDigit : 2;
  const activeUnderDigit = (targetDigit >= 1 && targetDigit <= 9) ? targetDigit : 8;

  const handleContractTypeChange = (typeId: string) => {
    setContractTypeState(typeId);
    contractTypeRef.current = typeId;
    localStorage.setItem('autobot_contract_type', typeId);
    (window as any).AUTOBOT_CONTRACT_TYPE = typeId;
    (window as any).AUTOBOT_SIGNAL_QUEUE = [];
    (window as any).AUTOBOT_TARGET = null;
    (window as any).AUTOBOT_LAST_CONTRACT_TYPE = null;
    (window as any).AUTOBOT_LAST_PREDICTION = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_CONTRACT_TYPE = null;
    (window as any).AUTOBOT_CONTINUOUS_LOCKED_PREDICTION = null;

    if (typeId === 'digitover') {
      if (targetDigit < 0 || targetDigit > 8) {
        setTargetDigit(2);
        targetDigitRef.current = 2;
        localStorage.setItem('autobot_target_digit', '2');
        (window as any).AUTOBOT_TARGET_DIGIT = 2;
      }
      if (['types', 'axa', 'differs_noise', 'lad_prng', 'over_under'].includes(streakMode)) {
        setStreakMode('consecutive');
        streakModeRef.current = 'consecutive';
        localStorage.setItem('autobot_streak_mode', 'consecutive');
        (window as any).AUTOBOT_STREAK_MODE = 'consecutive';
      }
    } else if (typeId === 'digitunder') {
      if (targetDigit < 1 || targetDigit > 9) {
        setTargetDigit(8);
        targetDigitRef.current = 8;
        localStorage.setItem('autobot_target_digit', '8');
        (window as any).AUTOBOT_TARGET_DIGIT = 8;
      }
      if (['types', 'axa', 'differs_noise', 'lad_prng', 'over_under'].includes(streakMode)) {
        setStreakMode('consecutive');
        streakModeRef.current = 'consecutive';
        localStorage.setItem('autobot_streak_mode', 'consecutive');
        (window as any).AUTOBOT_STREAK_MODE = 'consecutive';
      }
    } else if (typeId === 'digitmatch') {
      if (targetDigit < 0 || targetDigit > 9) {
        setTargetDigit(4);
        targetDigitRef.current = 4;
        localStorage.setItem('autobot_target_digit', '4');
        (window as any).AUTOBOT_TARGET_DIGIT = 4;
      }
      if (['types', 'axa', 'differs_noise', 'percentage', 'over_under'].includes(streakMode)) {
        setStreakMode('consecutive');
        streakModeRef.current = 'consecutive';
        localStorage.setItem('autobot_streak_mode', 'consecutive');
        (window as any).AUTOBOT_STREAK_MODE = 'consecutive';
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#0a0b0d] overflow-y-auto md:overflow-hidden select-none custom-scrollbar">
      
      {/* Left Sidebar Control Panel */}
      <div className="w-full md:w-80 bg-[#121315] border-b md:border-b-0 md:border-r border-[#222428] flex flex-col p-4 shrink-0 space-y-4 md:space-y-5 overflow-visible md:overflow-y-auto md:h-full custom-scrollbar">
        
        {/* Mobile controls toggle header */}
        <div className="flex md:hidden items-center justify-between border-b border-[#222428]/60 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#ff444f]" />
            <span className="font-black text-xs uppercase tracking-widest text-slate-200">Bot Settings</span>
          </div>
          <button
            onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
            className="px-2.5 py-1.5 bg-[#1a1c20] hover:bg-[#25282f] border border-[#222428] rounded-lg text-slate-300 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5"
          >
            {isSettingsExpanded ? 'Hide Controls' : 'Show Controls'}
            <ChevronRight size={10} className={cn("transition-transform duration-200", isSettingsExpanded && "rotate-90")} />
          </button>
        </div>

        {/* Configurations Wrapper (Collapsible on mobile) */}
        <div className={cn(
          "space-y-4 md:space-y-5 flex flex-col md:flex min-h-0 md:flex-1",
          !isSettingsExpanded ? "hidden md:flex" : "flex"
        )}>
          
          {/* CONTRACT TYPE */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Contract Type
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'digitdiff', name: 'Differ' },
                { id: 'digitmatch', name: 'Match' },
                { id: 'accumulator', name: 'Accu' },
                { id: 'digitover', name: 'Over' },
                { id: 'digitunder', name: 'Under' }
              ].map(type => {
                const isSelected = contractType === type.id || 
                  (type.id === 'digitover' && contractType === 'over_under' && ouPatternSelection !== 'under8') ||
                  (type.id === 'digitunder' && contractType === 'over_under' && ouPatternSelection === 'under8');
                const isTypeDisabled = streakMode === 'types' && type.id !== 'digitdiff';
                return (
                  <button
                    key={type.id}
                    onClick={() => handleContractTypeChange(type.id)}
                    disabled={isTypeDisabled}
                    className={cn(
                      "py-2 px-1 text-[11px] font-black rounded-lg border transition-all text-center truncate",
                      isSelected 
                        ? "bg-[#ff444f]/10 border-[#ff444f] text-white shadow-[0_0_15px_rgba(255,68,79,0.15)]" 
                        : "bg-[#0e0f11] border-transparent text-slate-400 hover:border-[#333] hover:text-white",
                      isTypeDisabled && "opacity-55 cursor-not-allowed"
                    )}
                    title={type.name}
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
                  <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-sans">
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
                    onChange={(e) => {
                      const val = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1));
                      setTradeDuration(val);
                    }}
                    className={cn(
                      "w-14 bg-[#14161a] border border-[#222428] text-white font-mono font-bold text-xs rounded-lg px-2.5 py-1.5 text-center outline-none focus:border-[#ff444f]",
                      (isRunning || isRandomTicks) && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <span className="text-[11px] font-bold text-slate-400">Ticks</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-sans">
                  Random Ticks Switch
                </span>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setIsRandomTicks(!isRandomTicks)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isRandomTicks ? "bg-[#ff444f]" : "bg-zinc-700",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isRandomTicks ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TARGET DIGIT / BARRIER */}
          {contractType !== 'accumulator' && (
            isOverActive ? (
              <div className="space-y-2.5 p-3 bg-[#0e0f11] border border-[#222428] rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#00a79e]">
                    OVER DIGIT BARRIER
                  </span>
                  <span className="text-[10px] font-black font-mono px-2.5 py-0.5 rounded bg-[#00a79e]/15 text-[#00a79e] border border-[#00a79e]/40">
                    Trading Over {activeOverDigit}
                  </span>
                </div>

                <div className="grid grid-cols-9 gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(d => {
                    const isSelected = activeOverDigit === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setTargetDigit(d);
                          targetDigitRef.current = d;
                          localStorage.setItem('autobot_target_digit', d.toString());
                          (window as any).AUTOBOT_TARGET_DIGIT = d;
                          (window as any).AUTOBOT_SIGNAL_QUEUE = [];
                        }}
                        className={cn(
                          "h-10 sm:h-11 rounded-lg flex items-center justify-center font-black text-sm transition-all select-none",
                          isSelected
                            ? "bg-[#00a79e] text-white shadow-[0_0_12px_rgba(0,167,158,0.4)] border border-[#00a79e]"
                            : "bg-[#14161a] text-slate-300 border border-[#222428] hover:border-[#333] hover:text-white"
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Bot will purchase{' '}
                  <strong className="text-[#00a79e] font-black">DIGIT OVER {activeOverDigit}</strong>
                  {' '}contracts (Win if last digit &gt; {activeOverDigit}).
                </p>
              </div>
            ) : isUnderActive ? (
              <div className="space-y-2.5 p-3 bg-[#0e0f11] border border-[#222428] rounded-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#ff444f]">
                    UNDER DIGIT BARRIER
                  </span>
                  <span className="text-[10px] font-black font-mono px-2.5 py-0.5 rounded bg-[#ff444f]/15 text-[#ff444f] border border-[#ff444f]/40">
                    Trading Under {activeUnderDigit}
                  </span>
                </div>

                <div className="grid grid-cols-9 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                    const isSelected = activeUnderDigit === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setTargetDigit(d);
                          targetDigitRef.current = d;
                          localStorage.setItem('autobot_target_digit', d.toString());
                          (window as any).AUTOBOT_TARGET_DIGIT = d;
                          (window as any).AUTOBOT_SIGNAL_QUEUE = [];
                        }}
                        className={cn(
                          "h-10 sm:h-11 rounded-lg flex items-center justify-center font-black text-sm transition-all select-none",
                          isSelected
                            ? "bg-[#ff444f] text-white shadow-[0_0_12px_rgba(255,68,79,0.4)] border border-[#ff444f]"
                            : "bg-[#14161a] text-slate-300 border border-[#222428] hover:border-[#333] hover:text-white"
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-400 font-medium">
                  Bot will purchase{' '}
                  <strong className="text-[#ff444f] font-black">DIGIT UNDER {activeUnderDigit}</strong>
                  {' '}contracts (Win if last digit &lt; {activeUnderDigit}).
                </p>
              </div>
            ) : contractType === 'dual_ou' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Over Barrier
                    </label>
                    <select
                      value={targetDigit}
                      onChange={(e) => setTargetDigit(parseInt(e.target.value, 10))}
                      disabled={isRunning || (streakMode === 'pattern' && patternSmartMode)}
                      className={cn(
                        "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all",
                        (isRunning || (streakMode === 'pattern' && patternSmartMode)) && "opacity-55 cursor-not-allowed"
                      )}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <option key={num} value={num}>Over {num}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Under Barrier
                    </label>
                    <select
                      value={targetDigit2}
                      onChange={(e) => setTargetDigit2(parseInt(e.target.value, 10))}
                      disabled={isRunning || (streakMode === 'pattern' && patternSmartMode)}
                      className={cn(
                        "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all",
                        (isRunning || (streakMode === 'pattern' && patternSmartMode)) && "opacity-55 cursor-not-allowed"
                      )}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <option key={num} value={num}>Under {num}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {streakMode === 'pattern' && patternSmartMode && (
                  <span className="block text-[8px] text-amber-500 font-medium leading-none mt-1">
                    Disabled: Pattern Auto-Switch predicts digits automatically.
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Digit
                </label>
                <select
                  value={targetDigit}
                  onChange={(e) => setTargetDigit(parseInt(e.target.value, 10))}
                  disabled={isRunning || streakMode === 'types' || hasEqualsInPattern || (streakMode === 'pattern' && patternSmartMode) || (streakMode === 'analysis_tool' && contractType === 'digitdiff')}
                  className={cn(
                    "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all",
                    (isRunning || streakMode === 'types' || hasEqualsInPattern || (streakMode === 'pattern' && patternSmartMode) || (streakMode === 'analysis_tool' && contractType === 'digitdiff')) && "opacity-55 cursor-not-allowed"
                  )}
                >
                  <option value="-1">All Digits (Differ Streak)</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <option key={num} value={num}>Digit {num}</option>
                  ))}
                </select>
                {streakMode === 'types' && (
                  <span className="block text-[8px] text-amber-500 font-medium leading-none mt-1">Disabled: Types mode selects digits dynamically.</span>
                )}
                {streakMode === 'analysis_tool' && contractType === 'digitdiff' && (
                  <span className="block text-[8px] text-purple-400 font-medium leading-none mt-1">
                    Disabled: Differs directly from live market & signal (no barrier or target rule applied).
                  </span>
                )}

                {streakMode === 'pattern' && patternSmartMode && (
                  <span className="block text-[8px] text-amber-500 font-medium leading-none mt-1">Disabled: Pattern Auto-Switch predicts digits automatically.</span>
                )}
                {streakMode === 'pattern' && !patternSmartMode && hasEqualsInPattern && (
                  <span className="block text-[8px] text-amber-500 font-medium leading-none mt-1">Disabled: Digits specified dynamically (e.g. 23=2) inside pattern input.</span>
                )}
              </div>
            )
          )}

        {/* ACCUMULATOR SETTINGS AND STRATEGIES SECTION */}
        {contractType === 'accumulator' && (
          <div className="space-y-4 animate-slide-up">
            {/* ACCUMULATOR SETTINGS */}
            <div className="grid grid-cols-2 gap-3 bg-[#121316] border border-[#222428]/50 rounded-xl p-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-sans">
                  Growth Rate (%)
                </label>
                <select
                  value={accumulatorGrowthRate}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setAccumulatorGrowthRate(val);
                    localStorage.setItem('autobot_accumulator_growth_rate', val.toString());
                  }}
                  disabled={isRunning}
                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] transition-all disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map(rate => (
                    <option key={rate} value={rate}>{rate}%</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-sans">
                  Take Profit ($)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={accumulatorTakeProfit}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setAccumulatorTakeProfit(val);
                    localStorage.setItem('autobot_accumulator_take_profit', val.toString());
                  }}
                  disabled={isRunning}
                  placeholder="e.g. 10.0"
                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] transition-all disabled:opacity-55 disabled:cursor-not-allowed font-mono"
                />
              </div>
            </div>

            {/* ACCUMULATOR STRATEGIES */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-sans">
                Accumulator Strategies (Work all when selected)
              </label>
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {[
                  { id: 'accu_noise', name: 'Accu Noise (Choppiness & Calm Detector)', desc: 'Measures real-time tick noise score (0-100), Choppiness Index and spike risk. Automatically triggers BUY_ACCU when noise drops below calm threshold (<= 30) for 5 consecutive ticks.', indicators: 'Accu Noise Engine (Score <= 30)' },
                  { id: 'trend_exhaustion', name: 'Trend Exhaustion', desc: 'EMA 20/50 flatten, RSI returns toward 50, candles get smaller. Avoid: strong momentum.', indicators: 'EMA 20, EMA 50, RSI 14' },
                  { id: 'bb_squeeze', name: 'Bollinger Band Squeeze', desc: 'Narrow BB bands, price oscillates near middle band without breakout. Avoid: bands expanding rapidly.', indicators: 'Bollinger Bands (20,2)' },
                  { id: 'atr_volatility', name: 'ATR Low Volatility', desc: 'ATR below average and remaining flat/decreasing. Avoid: ATR rising sharply.', indicators: 'ATR (14)' },
                  { id: 'adx_range', name: 'ADX Range Filter', desc: 'ADX under 25, sideways range / weak trend. Avoid: ADX rising above 25.', indicators: 'ADX (14)' },
                  { id: 'tick_speed', name: 'Tick Variance', desc: 'Consistently low tick variance over chosen window. Avoid: large tick jumps.', indicators: 'Rolling Tick Std Dev' },
                  { id: 'ma_flatness', name: 'Moving Average Flatness', desc: 'Horizontal EMAs, price crossing back and forth. Avoid: steep EMAs / spacing increases.', indicators: 'EMA 20, EMA 50' },
                  { id: 'donchian_range', name: 'Donchian Channel Range', desc: 'Price stays near center of channel, avoiding upper/lower bounds. Avoid: breakout.', indicators: 'Donchian Channels (20)' },
                  { id: 'keltner_stability', name: 'Keltner Channel Stability', desc: 'Price tracks closely around center. Avoid: touch outer bands.', indicators: 'Keltner Channels (20, 1.5)' },
                  { id: 'std_dev', name: 'Std Dev Filter', desc: 'Price standard deviation remains below historical average. Avoid: std dev spikes.', indicators: 'Price Std Dev' },
                  { id: 'ai_volatility', name: 'AI Volatility Probability', desc: 'Low volatility pattern probability stays above 80%. Avoid: drops below 80%.', indicators: 'AI Volatility Engine' },
                  { id: 'analysis_tool', name: 'Analysis Tool Live Signals', desc: 'Auto-trades ACCU when the Analysis Tool emits a BUY_ACCU signal for this market.', indicators: 'Analysis Engine' }
                ].map(strat => (
                  <div 
                    key={strat.id} 
                    onClick={() => {
                      if (isRunning) return;
                      const updated = {
                        ...accuStrategies,
                        [strat.id]: !accuStrategies[strat.id]
                      };
                      setAccuStrategies(updated);
                      localStorage.setItem('autobot_accumulator_strategies', JSON.stringify(updated));
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5",
                      accuStrategies[strat.id]
                        ? "bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60"
                        : "bg-[#0e0f11] border-[#222428] hover:border-[#333] hover:bg-[#121316]/50",
                      isRunning && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={!!accuStrategies[strat.id]}
                      disabled={isRunning}
                      onChange={() => {}} // Handled by outer div onClick
                      className="mt-0.5 rounded border-[#333] text-emerald-500 focus:ring-emerald-500 bg-[#0e0f11] pointer-events-none"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "text-xs font-black uppercase tracking-wide",
                          accuStrategies[strat.id] ? "text-emerald-400" : "text-white"
                        )}>
                          {strat.name}
                        </span>
                        <span className="text-[7px] font-mono bg-[#17181c] px-1.5 py-0.5 rounded border border-zinc-800 text-slate-400">
                          {strat.indicators}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal">
                        {strat.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STREAK SELECTOR AND INNER STRATEGIES (CONSECUTIVE, PATTERN, TYPES, MPE, PERCENTAGE) */}
        {contractType !== 'accumulator' && (
          <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              {isCirclesMode ? "Circles Strategy" : "Streak Mode"}
            </label>
            <div className={cn(
              isCirclesMode ? "w-full sm:w-auto" : "flex flex-wrap items-center gap-1 bg-[#0b0c0d] border border-[#222428] rounded-lg p-0.5 animate-fade-in"
            )}>
              {contractType === 'over_under' ? (
                <>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('consecutive_touch')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                      streakMode === 'consecutive_touch' 
                        ? "bg-[#00a79e] text-black font-black shadow-[0_0_10px_rgba(0,167,158,0.3)]" 
                        : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                    )}
                  >
                    Streak & Touch
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('pattern')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                      streakMode === 'pattern' 
                        ? "bg-[#ff444f] text-white" 
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Pattern
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('over_under')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                      streakMode === 'over_under' 
                        ? "bg-[#00a79e] text-black font-black shadow-[0_0_10px_rgba(0,167,158,0.3)]" 
                        : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                    )}
                  >
                    Over 1 / Under 8 Scanner
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('analysis_tool')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all flex items-center gap-1",
                      streakMode === 'analysis_tool' 
                        ? "bg-purple-600 text-white font-black shadow-[0_0_10px_rgba(147,51,234,0.4)]" 
                        : "text-purple-300 hover:text-white hover:bg-purple-600/20"
                    )}
                  >
                    <Radio size={10} className={streakMode === 'analysis_tool' ? "animate-pulse" : ""} />
                    Analysis Signals
                  </button>

                  {isCirclesMode && (
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setStreakMode('circle_over_under')}
                      className={cn(
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'circle_over_under' 
                          ? "bg-[#12d6c2] text-black font-black shadow-[0_0_10px_rgba(18,214,194,0.3)]" 
                          : "text-slate-400 hover:text-[#12d6c2] hover:bg-[#12d6c2]/10"
                      )}
                    >
                      Circle O/U Strategy
                    </button>
                  )}
                </>
              ) : isCirclesMode ? (
                <select
                  disabled={isRunning}
                  value={streakMode}
                  onChange={(e) => setStreakMode(e.target.value as any)}
                  className="w-full sm:w-[220px] bg-[#0c0d0f] border border-[#222428] text-white text-[11px] font-black uppercase rounded-lg px-3 py-2 outline-none focus:border-[#00a79e] transition-all cursor-pointer shadow-md"
                >
                  <option value="circle_green" className="bg-[#0c0d0f] text-[#12d6c2] font-black">🟢 Green (Most Appearing)</option>
                  <option value="circle_blue" className="bg-[#0c0d0f] text-[#1888f2] font-black">🔵 Blue (2nd Most Appearing)</option>
                  <option value="circle_orange" className="bg-[#0c0d0f] text-[#f59e0b] font-black">🟠 Orange (2nd Least Appearing)</option>
                  <option value="circle_red" className="bg-[#0c0d0f] text-[#ff444f] font-black">🔴 Red (Least Appearing)</option>
                  <option value="circle_target_pct" className="bg-[#0c0d0f] text-[#8b5cf6] font-black">🎯 Target Pct (%)</option>
                  <option value="circle_over_under" className="bg-[#0c0d0f] text-[#12d6c2] font-black">⭕ Circle O/U Strategy</option>
                </select>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('consecutive')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                      streakMode === 'consecutive' 
                        ? "bg-[#ff444f] text-white" 
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Consecutive
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('pattern')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                      streakMode === 'pattern' 
                        ? "bg-[#ff444f] text-white" 
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    Pattern
                  </button>
                  {contractType !== 'dual_ou' && contractType !== 'digitover' && contractType !== 'digitunder' && (
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setStreakMode('types')}
                      className={cn(
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'types' 
                          ? "bg-[#ff444f] text-white" 
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      Types
                    </button>
                  )}

                  {contractType === 'digitdiff' && (
                    <button
                      type="button"
                      id="axa-selector-button"
                      disabled={isRunning}
                      onClick={() => setStreakMode('axa')}
                      className={cn(
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'axa' 
                          ? "bg-[#00a79e] text-black font-black" 
                          : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                      )}
                    >
                      AXA MODULO
                    </button>
                  )}

                  {contractType === 'digitdiff' && (
                    <button
                      type="button"
                      id="differs-noise-selector-button"
                      disabled={isRunning}
                      onClick={() => setStreakMode('differs_noise')}
                      className={cn(
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'differs_noise' 
                          ? "bg-emerald-400 text-black font-black shadow-lg shadow-emerald-500/20" 
                          : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10"
                      )}
                    >
                      CALM DIGIT (NOISE)
                    </button>
                  )}

                  {(contractType === 'digitdiff' || contractType === 'digitmatch') && (
                    <button
                      type="button"
                      id="lad-prng-selector-button"
                      disabled={isRunning}
                      onClick={() => setStreakMode('lad_prng')}
                      className={cn(
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'lad_prng' 
                          ? "bg-[#38bdf8] text-black font-black" 
                          : "text-slate-400 hover:text-[#38bdf8] hover:bg-[#38bdf8]/10"
                      )}
                    >
                      Pattern Follower Differ
                    </button>
                  )}

                  {(contractType === 'dual_ou' || contractType === 'digitover' || contractType === 'digitunder') && (
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setStreakMode('percentage')}
                      className={cn(
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'percentage' 
                          ? "bg-[#ff444f] text-white" 
                          : "text-slate-400 hover:text-white"
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
                        "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                        streakMode === 'consecutive_touch' 
                          ? "bg-[#00a79e] text-black font-black shadow-[0_0_10px_rgba(0,167,158,0.3)]" 
                          : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
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
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                      streakMode === 'price_digits' 
                        ? "bg-[#00a79e] text-black font-black" 
                        : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                    )}
                  >
                    Price Digits
                  </button>

                  <button
                    type="button"
                    id="analysis-signals-general-button"
                    disabled={isRunning}
                    onClick={() => setStreakMode('analysis_tool')}
                    className={cn(
                      "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all flex items-center gap-1",
                      streakMode === 'analysis_tool' 
                        ? "bg-purple-600 text-white font-black shadow-[0_0_10px_rgba(147,51,234,0.4)]" 
                        : "text-purple-300 hover:text-white hover:bg-purple-600/20"
                    )}
                  >
                    <Radio size={10} className={streakMode === 'analysis_tool' ? "animate-pulse" : ""} />
                    Analysis Signals
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Smart Recovery Toggle & Dropdown */}
          {contractType !== 'over_under' && (
            <div className="bg-[#121316] border border-[#222428]/40 rounded-xl p-3.5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="block text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 animate-pulse" />
                  Smart Recovery Strategy (Post-Loss Part)
                </span>
                <span className="block text-[8px] sm:text-[9px] text-slate-500">
                  Switch to a different strategy specifically after a loss to recover safely
                </span>
              </div>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setIsRecoveryStreakModeEnabled(!isRecoveryStreakModeEnabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isRecoveryStreakModeEnabled ? "bg-[#ff444f]" : "bg-[#222428]",
                  isRunning && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isRecoveryStreakModeEnabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {isRecoveryStreakModeEnabled && (
              <div className="space-y-2.5 pt-1.5 border-t border-[#222428]/40 animate-fade-in animate-slide-up">
                {/* Recovery Contract Type */}
                <div className="space-y-1 pb-1">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-amber-500">
                    Recovery Contract Type
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: 'digitdiff', name: 'Differ' },
                      { id: 'digitmatch', name: 'Match' },
                      { id: 'accumulator', name: 'Accu' },
                      { id: 'digitover', name: 'Over' },
                      { id: 'digitunder', name: 'Under' }
                    ].map(type => {
                      const isSelected = recoveryContractType === type.id || 
                        (type.id === 'digitover' && recoveryContractType === 'over_under' && recoveryOuPatternSelection !== 'under8') ||
                        (type.id === 'digitunder' && recoveryContractType === 'over_under' && recoveryOuPatternSelection === 'under8');
                      const isTypeDisabled = isRunning || (recoveryStreakMode === 'types' && type.id !== 'digitdiff');
                      return (
                        <button
                          key={type.id}
                          onClick={() => {
                            setRecoveryContractType(type.id);
                          }}
                          disabled={isTypeDisabled}
                          className={cn(
                            "py-1.5 px-1 text-[8.5px] font-black rounded border transition-all text-center truncate",
                            isSelected
                              ? "bg-[#ff444f]/10 border-[#ff444f] text-white shadow-[0_0_10px_rgba(255,68,79,0.15)]"
                              : "bg-[#0b0c0d] border-[#222428] text-slate-400 hover:border-[#444] hover:text-white",
                            isTypeDisabled && "opacity-55 cursor-not-allowed"
                          )}
                        >
                          {type.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Digit / Growth Rate parameters */}
                {recoveryContractType === 'accumulator' && (
                  <div className="grid grid-cols-2 gap-2 pb-1">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Growth Rate (%)</label>
                      <select
                        value={recoveryAccumulatorGrowthRate}
                        onChange={(e) => setRecoveryAccumulatorGrowthRate(Number(e.target.value))}
                        disabled={isRunning}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#00a79e]"
                      >
                        <option value={1}>1%</option>
                        <option value={2}>2%</option>
                        <option value={3}>3%</option>
                        <option value={4}>4%</option>
                        <option value={5}>5%</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Take Profit</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={recoveryAccumulatorTakeProfit}
                        onChange={(e) => setRecoveryAccumulatorTakeProfit(parseFloat(e.target.value) || 0)}
                        disabled={isRunning}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#00a79e]"
                      />
                    </div>
                  </div>
                )}
                
                {['digitdiff', 'digitmatch', 'digitover', 'digitunder'].includes(recoveryContractType) && (
                  <div className="space-y-1 pb-1">
                    <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400">Target Digit / Barrier</label>
                    <div className="grid grid-cols-10 gap-0.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={isRunning || 
                            (recoveryContractType === 'digitover' && num === 9) ||
                            (recoveryContractType === 'digitunder' && num === 0)
                          }
                          onClick={() => setRecoveryTargetDigit(num)}
                          className={cn(
                            "py-1 text-[9px] font-mono font-bold rounded border transition-all text-center cursor-pointer",
                            recoveryTargetDigit === num
                              ? "bg-[#ff444f]/20 border-[#ff444f] text-white font-black"
                              : "bg-[#0b0c0d] border-[#222428] text-slate-400",
                            (isRunning || (recoveryContractType === 'digitover' && num === 9) || (recoveryContractType === 'digitunder' && num === 0)) && "opacity-30 cursor-not-allowed"
                          )}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-amber-500">
                  Recovery Streak Mode (Active After Loss)
                </label>
                <div className="flex flex-wrap items-center gap-1 bg-[#0b0c0d] border border-[#222428] rounded-lg p-0.5">
                  {recoveryContractType === 'over_under' ? (
                    <>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('consecutive_touch')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'consecutive_touch' 
                            ? "bg-[#00a79e] text-black font-black" 
                            : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                        )}
                      >
                        Streak & Touch
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('pattern')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'pattern' 
                            ? "bg-[#ff444f] text-white" 
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Pattern
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('over_under')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'over_under' 
                            ? "bg-amber-500 text-black font-black" 
                            : "text-slate-400 hover:text-amber-500 hover:bg-amber-500/10"
                        )}
                      >
                        Over 1 / Under 8 Scanner
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('analysis_tool')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all flex items-center gap-1",
                          recoveryStreakMode === 'analysis_tool' 
                            ? "bg-purple-600 text-white font-black" 
                            : "text-purple-300 hover:text-white hover:bg-purple-600/20"
                        )}
                      >
                        <Radio size={10} />
                        Analysis Signals
                      </button>
                      {isCirclesMode && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('circle_over_under')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'circle_over_under' 
                              ? "bg-[#12d6c2] text-black font-black" 
                              : "text-slate-400 hover:text-[#12d6c2] hover:bg-[#12d6c2]/10"
                          )}
                        >
                          Circle O/U Strategy
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('consecutive')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'consecutive' 
                            ? "bg-[#ff444f] text-white" 
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Consecutive
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('pattern')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'pattern' 
                            ? "bg-[#ff444f] text-white" 
                            : "text-slate-400 hover:text-white"
                        )}
                      >
                        Pattern
                      </button>
                      {contractType !== 'dual_ou' && contractType !== 'digitover' && contractType !== 'digitunder' && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('types')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'types' 
                              ? "bg-[#ff444f] text-white" 
                              : "text-slate-400 hover:text-white"
                          )}
                        >
                          Types
                        </button>
                      )}

                      {recoveryContractType === 'digitdiff' && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('axa')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'axa' 
                              ? "bg-[#00a79e] text-black font-black" 
                              : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                          )}
                        >
                          AXA MODULO
                        </button>
                      )}

                      {recoveryContractType === 'digitdiff' && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('differs_noise')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'differs_noise' 
                              ? "bg-emerald-400 text-black font-black shadow-lg shadow-emerald-500/20" 
                              : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10"
                          )}
                        >
                          CALM DIGIT (NOISE)
                        </button>
                      )}

                      {(recoveryContractType === 'digitdiff' || recoveryContractType === 'digitmatch') && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('lad_prng')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'lad_prng' 
                              ? "bg-[#38bdf8] text-black font-black" 
                              : "text-slate-400 hover:text-[#38bdf8] hover:bg-[#38bdf8]/10"
                          )}
                        >
                          Pattern Follower Differ
                        </button>
                      )}

                      {(recoveryContractType === 'dual_ou' || recoveryContractType === 'digitover' || recoveryContractType === 'digitunder') && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('percentage')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'percentage' 
                              ? "bg-[#ff444f] text-white" 
                              : "text-slate-400 hover:text-white"
                          )}
                        >
                          Percentage
                        </button>
                      )}

                      {(recoveryContractType === 'digitover' || recoveryContractType === 'digitunder') && (
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setRecoveryStreakMode('consecutive_touch')}
                          className={cn(
                            "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                            recoveryStreakMode === 'consecutive_touch' 
                              ? "bg-[#00a79e] text-black font-black" 
                              : "text-slate-400 hover:text-[#00a79e] hover:bg-[#00a79e]/10"
                          )}
                        >
                          Streak & Touch
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('price_digits')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'price_digits' 
                            ? "bg-amber-500 text-black font-black" 
                            : "text-slate-400 hover:text-amber-500 hover:bg-amber-500/10"
                        )}
                      >
                        Price Digits
                      </button>

                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('analysis_tool')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all flex items-center gap-1",
                          recoveryStreakMode === 'analysis_tool' 
                            ? "bg-purple-600 text-white font-black" 
                            : "text-purple-300 hover:text-white hover:bg-purple-600/20"
                        )}
                      >
                        <Radio size={10} />
                        Analysis Signals
                      </button>
                    </>
                  )}

                  {isCirclesMode && (
                    <>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('circle_green')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'circle_green' 
                            ? "bg-[#12d6c2] text-black font-black" 
                            : "text-slate-400 hover:text-[#12d6c2] hover:bg-[#12d6c2]/10"
                        )}
                      >
                        🟢 Green
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('circle_blue')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'circle_blue' 
                            ? "bg-[#1888f2] text-white font-black" 
                            : "text-slate-400 hover:text-[#1888f2] hover:bg-[#1888f2]/10"
                        )}
                      >
                        🔵 Blue
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('circle_orange')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'circle_orange' 
                            ? "bg-[#f59e0b] text-black font-black" 
                            : "text-slate-400 hover:text-[#f59e0b] hover:bg-[#f59e0b]/10"
                        )}
                      >
                        🟠 Orange
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('circle_red')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'circle_red' 
                            ? "bg-[#ff444f] text-white font-black" 
                            : "text-slate-400 hover:text-[#ff444f] hover:bg-[#ff444f]/10"
                        )}
                      >
                        🔴 Red
                      </button>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setRecoveryStreakMode('circle_target_pct')}
                        className={cn(
                          "px-2 py-1 text-[8px] sm:text-[9px] font-black uppercase rounded transition-all",
                          recoveryStreakMode === 'circle_target_pct' 
                            ? "bg-[#8b5cf6] text-white font-black" 
                            : "text-slate-400 hover:text-[#8b5cf6] hover:bg-[#8b5cf6]/10"
                        )}
                      >
                        🎯 Circle %
                      </button>
                    </>
                  )}
                </div>
                <p className="text-[8px] sm:text-[9px] text-zinc-400 leading-normal pb-1">
                  During loss sequences (when Consecutive Losses &gt; 0), the bot will dynamically bypass your main strategy and evaluate trades using <span className="font-bold text-amber-400 uppercase">{recoveryStreakMode.replace(/_/g, ' ')}</span>.
                </p>

                {/* Dynamic Recovery Strategy Configuration Panels */}
                <div className="border-t border-[#ff444f]/10 pt-3 mt-1.5 space-y-3.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#ff444f] bg-[#ff444f]/10 border border-[#ff444f]/25 px-1.5 py-0.5 rounded leading-none">
                      Recovery Strategy Settings
                    </span>
                  </div>

                  {/* Recovery Pattern panel */}
                  {recoveryStreakMode === 'pattern' && contractType !== 'dual_ou' && contractType !== 'digitover' && contractType !== 'digitunder' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428] rounded-xl space-y-3 animate-fade-in animate-slide-up">
                      {recoveryContractType === 'over_under' && (
                        <div className="p-2.5 bg-[#121316] border border-amber-500/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-amber-500">
                              Recovery O/U Pattern Contract
                            </label>
                            <span className="text-[9px] font-bold text-slate-400 font-mono">
                              {recoveryOuPatternSelection === 'under8' ? 'UNDER 8' : 'OVER 1'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => setRecoveryOuPatternSelection('over1')}
                              className={cn(
                                "py-1.5 px-2 text-[10px] font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                                recoveryOuPatternSelection === 'over1'
                                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                  : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                                isRunning && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              Over 1
                            </button>
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => setRecoveryOuPatternSelection('under8')}
                              className={cn(
                                "py-1.5 px-2 text-[10px] font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                                recoveryOuPatternSelection === 'under8'
                                  ? "bg-rose-500/20 border-rose-500 text-rose-400"
                                  : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                                isRunning && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              Under 8
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Auto-Switch */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="block text-xs font-black text-white uppercase tracking-wider">Pattern Auto-Switch / Smart Diff</span>
                          <span className="block text-[8px] sm:text-[9px] text-slate-500">Smart auto-typing optimized differ digits</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecoveryPatternSmartMode(!recoveryPatternSmartMode)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            recoveryPatternSmartMode ? "bg-[#ff444f]" : "bg-[#222428]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              recoveryPatternSmartMode ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>

                      {recoveryPatternSmartMode && (
                        <div className="mt-2.5 p-2 bg-[#050607] border border-[#222428]/60 rounded-lg flex items-center justify-between text-[10px] font-semibold text-zinc-300">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded leading-none">
                              Active Learned Pattern
                            </span>
                            <span className="font-mono text-white text-xs bg-[#17181c] px-1.5 py-0.5 rounded border border-zinc-800">
                              {recoveryCustomPattern}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded leading-none">
                              Digit to Differ
                            </span>
                            <span className="font-mono text-amber-400 text-xs bg-[#17181c] px-2 py-0.5 rounded border border-zinc-800">
                              {recoveryPatternSmartDigit !== null ? recoveryPatternSmartDigit : 'N/A'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-[#222428]/40 my-1" />

                      {/* Pattern Rotational Mode Switch */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="block text-xs font-black text-white uppercase tracking-wider">Pattern Rotational / Circular Mode</span>
                          <span className="block text-[8px] sm:text-[9px] text-slate-500">Cycle through digits consecutively</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecoveryPatternRotationalMode(!recoveryPatternRotationalMode)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            recoveryPatternRotationalMode ? "bg-[#ff444f]" : "bg-[#222428]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              recoveryPatternRotationalMode ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>

                      <div className="border-t border-[#222428]/40 my-1" />

                      {/* Pattern Recovery Mode Switch */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="block text-xs font-black text-white uppercase tracking-wider">Pattern Recovery Mode / Safeguard</span>
                          <span className="block text-[8px] sm:text-[9px] text-slate-500">Skip patterns causing losses inside recovery</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecoveryPatternRecoveryMode(!recoveryPatternRecoveryMode)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            recoveryPatternRecoveryMode ? "bg-[#ff444f]" : "bg-[#222428]"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              recoveryPatternRecoveryMode ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recovery Pattern inputs */}
                  {recoveryStreakMode === 'pattern' && (
                    <div className="space-y-1 animate-slide-up">
                      <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 pb-0.5">Recovery Consecutive Patterns</label>
                      <input
                        type="text"
                        disabled={isRunning}
                        value={recoveryCustomPattern}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/[^0-9,=]/g, '');
                          setRecoveryCustomPattern(cleaned);
                        }}
                        placeholder="Enter patterns, e.g. 23=2,44=4"
                        maxLength={40}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all"
                      />
                    </div>
                  )}

                  {/* Recovery Consecutive Settings */}
                  {recoveryStreakMode === 'consecutive' && (
                    <div className="space-y-3.5 animate-slide-up">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 pb-0.5 font-sans">Recovery Consecutive Threshold</label>
                        <select
                          value={recoveryStreakThreshold}
                          onChange={(e) => setRecoveryStreakThreshold(parseInt(e.target.value, 10))}
                          disabled={isRunning}
                          className={cn(
                            "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <option key={num} value={num}>
                              {num} Consecutive Exact
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Loss Streak Threshold Trigger Switch for Recovery */}
                      <div className="bg-[#0c0d0e] border border-[#222428]/40 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 font-sans">
                              Recovery Post-Loss Threshold
                            </label>
                            <span className="block text-[8px] text-slate-500 font-medium font-sans">
                              Use a different consecutive count after a loss inside recovery
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => !isRunning && setRecoveryIsLossStreakThresholdEnabled(!recoveryIsLossStreakThresholdEnabled)} 
                            className={cn(
                              "flex items-center gap-1 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors border",
                              recoveryIsLossStreakThresholdEnabled 
                                ? "bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]" 
                                : "bg-[#16191e] border-[#222428] text-slate-500 hover:text-slate-300",
                              isRunning && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span className="text-[9px] font-black tracking-wider uppercase">Active</span>
                            <div className={cn(
                              "w-5 h-3 rounded-full relative transition-[background-color] flex items-center p-[1px]",
                              recoveryIsLossStreakThresholdEnabled ? "bg-[#ff444f]" : "bg-slate-700"
                            )}>
                              <div className={cn(
                                "pointer-events-none w-2.5 h-2.5 bg-white rounded-full transition-transform transform",
                                recoveryIsLossStreakThresholdEnabled ? "translate-x-2" : "translate-x-0"
                              )} />
                            </div>
                          </button>
                        </div>

                        {recoveryIsLossStreakThresholdEnabled && (
                          <div className="space-y-1.5 pt-2 border-t border-[#222428]/50 animate-slide-up">
                            <label className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 font-sans">
                              Post-Loss Threshold (1-4 Ticks)
                            </label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[1, 2, 3, 4].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  disabled={isRunning}
                                  onClick={() => setRecoveryLossStreakThreshold(num)}
                                  className={cn(
                                    "py-1.5 text-xs font-mono font-bold rounded-lg border transition-all",
                                    recoveryLossStreakThreshold === num
                                      ? "bg-[#ff444f] border-[#ff444f] text-white"
                                      : "bg-[#0c0d0f] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                                    isRunning && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {num} {num === 1 ? 'Tick' : 'Ticks'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recovery Types Settings */}
                  {recoveryStreakMode === 'types' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428] rounded-xl space-y-3.5 animate-fade-in animate-slide-up">
                      <span className="block text-[10px] font-black text-rose-400 uppercase tracking-[0.12em]">Recovery Types Strategies</span>
                      
                      {/* Digit Transition Matrix Strategy */}
                      <div className="space-y-1.5 pb-2 border-b border-[#222428]/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white uppercase tracking-wider">Transition Matrix</span>
                          <button
                            type="button"
                            onClick={() => setRecoveryTypesTransitionMatrix(!recoveryTypesTransitionMatrix)}
                            className={cn(
                              "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                              recoveryTypesTransitionMatrix ? "bg-[#ff444f]" : "bg-[#222428]"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                                recoveryTypesTransitionMatrix ? "translate-x-3.5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Mirror Digit Reversal Strategy */}
                      <div className="space-y-1.5 pb-2 border-b border-[#222428]/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white uppercase tracking-wider">Mirror Digit Reversal</span>
                          <button
                            type="button"
                            onClick={() => setRecoveryTypesMirrorDigitReversal(!recoveryTypesMirrorDigitReversal)}
                            className={cn(
                              "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                              recoveryTypesMirrorDigitReversal ? "bg-[#ff444f]" : "bg-[#222428]"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                                recoveryTypesMirrorDigitReversal ? "translate-x-3.5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Tick Compression Breakout Strategy */}
                      <div className="space-y-1.5 pb-2 border-b border-[#222428]/50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white uppercase tracking-wider">Tick Compression Breakout</span>
                          <button
                            type="button"
                            onClick={() => setRecoveryTypesTickCompression(!recoveryTypesTickCompression)}
                            className={cn(
                              "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                              recoveryTypesTickCompression ? "bg-[#ff444f]" : "bg-[#222428]"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                                recoveryTypesTickCompression ? "translate-x-3.5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Hidden Cycle Length Strategy */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white uppercase tracking-wider">Hidden Cycle Length</span>
                          <button
                            type="button"
                            onClick={() => setRecoveryTypesHiddenCycleLength(!recoveryTypesHiddenCycleLength)}
                            className={cn(
                              "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                              recoveryTypesHiddenCycleLength ? "bg-[#ff444f]" : "bg-[#222428]"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                                recoveryTypesHiddenCycleLength ? "translate-x-3.5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recovery Percentage Settings */}
                  {recoveryStreakMode === 'percentage' && (
                    <div className="space-y-1 animate-slide-up">
                      <div className="flex items-center justify-between">
                        <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 pb-0.5 font-sans">Recovery Percentage Threshold (%)</label>
                        <button
                          type="button"
                          onClick={() => !isRunning && setRecoveryIsExactPercentage(!recoveryIsExactPercentage)} 
                          className={cn(
                            "flex items-center gap-1 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors border",
                            recoveryIsExactPercentage 
                              ? "bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]" 
                              : "bg-[#16191e] border-[#222428] text-slate-500 hover:text-slate-300",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span className="text-[9px] font-black tracking-wider uppercase">Exact Match</span>
                          <div className={cn(
                            "w-5 h-3 rounded-full relative transition-colors flex items-center p-[1px]",
                            recoveryIsExactPercentage ? "bg-[#ff444f]" : "bg-slate-700"
                          )}>
                            <div className={cn(
                              "pointer-events-none w-2.5 h-2.5 bg-white rounded-full transition-transform transform",
                              recoveryIsExactPercentage ? "translate-x-2" : "translate-x-0"
                            )} />
                          </div>
                        </button>
                      </div>
                      <input
                        type="number"
                        disabled={isRunning}
                        value={recoveryPercentageThreshold}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                          setRecoveryPercentageThreshold(val);
                        }}
                        min={0}
                        max={100}
                        placeholder="e.g. 80"
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all"
                      />
                    </div>
                  )}

                  {/* Recovery Price Digits Settings */}
                  {recoveryStreakMode === 'price_digits' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428] rounded-xl space-y-2.5 animate-slide-up">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-amber-500 pb-0.5 font-sans">
                          Recovery Price Digits / Points
                        </label>
                        <input
                          type="text"
                          disabled={isRunning}
                          value={recoveryPriceDigitsInput}
                          onChange={(e) => setRecoveryPriceDigitsInput(e.target.value)}
                          placeholder="e.g. .01, .1780, .392"
                          className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2.5 outline-none focus:border-amber-500 transition-all"
                        />
                        <span className="block text-[8px] text-slate-500 font-medium font-sans">
                          Target price points used during post-loss recovery mode.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Recovery AXA info card */}
                  {recoveryStreakMode === 'axa' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-1.5 text-[8.5px] text-slate-400 animate-slide-up">
                      <span className="block text-[10px] font-black text-[#00a79e] uppercase tracking-wider">Recovery AXA Modulo Reset</span>
                      <p>Predicts localized state loops T-2, T-1, T0 on post-loss sequences and ignores the structurally blocked digit X at T+1.</p>
                    </div>
                  )}

                  {/* Recovery Pattern Missing Follower info card */}
                  {recoveryStreakMode === 'lad_prng' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-2 text-[8.5px] text-slate-400 animate-slide-up">
                      <span className="block text-[10px] font-black text-[#38bdf8] uppercase tracking-wider font-mono">Recovery Pattern Follower Differ</span>
                      <p>
                        Scans recurring <strong className="text-white">{pmfPatternLen}-digit patterns</strong> that appeared ≥ <strong className="text-white">{pmfMinOccurrences} times</strong>. Triggers DIGITDIFF on digits that never appeared in the <strong className="text-white">{pmfFollowerLen}-digit follower window</strong>.
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-[#222428]/60">
                        <div className="space-y-1">
                          <label className="block text-[7.5px] font-black uppercase tracking-[0.1em] text-slate-400">Pattern Len</label>
                          <select
                            value={pmfPatternLen}
                            onChange={(e) => setPmfPatternLen(parseInt(e.target.value, 10))}
                            disabled={isRunning}
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[10px] font-bold rounded px-1.5 py-1 outline-none focus:border-[#38bdf8]"
                          >
                            <option value={2}>2 Digits</option>
                            <option value={3}>3 Digits</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[7.5px] font-black uppercase tracking-[0.1em] text-slate-400">Min Occur</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={pmfMinOccurrences}
                            onChange={(e) => setPmfMinOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            disabled={isRunning}
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[10px] font-mono font-bold rounded px-1.5 py-1 outline-none focus:border-[#38bdf8]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[7.5px] font-black uppercase tracking-[0.1em] text-slate-400">Follower Win</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={pmfFollowerLen}
                            onChange={(e) => setPmfFollowerLen(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            disabled={isRunning}
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-[10px] font-mono font-bold rounded px-1.5 py-1 outline-none focus:border-[#38bdf8]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recovery Circles Green */}
                  {recoveryStreakMode === 'circle_green' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-2 text-[8.5px] text-slate-400 animate-slide-up">
                      <span className="block text-[10px] font-black text-[#12d6c2] uppercase tracking-wider">Recovery Circles Green Strategy</span>
                      <p>During recovery, automatically identifies and trades the <strong className="text-white">most frequent</strong> (highest percentage) digit in the tick history as the predicted target.</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                          <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recovery Circles Blue */}
                  {recoveryStreakMode === 'circle_blue' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-2 text-[8.5px] text-slate-400 animate-slide-up">
                      <span className="block text-[10px] font-black text-[#1888f2] uppercase tracking-wider">Recovery Circles Blue Strategy</span>
                      <p>During recovery, automatically identifies and trades the <strong className="text-white">2nd most frequent</strong> digit in the tick history as the predicted target.</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                          <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recovery Circles Orange */}
                  {recoveryStreakMode === 'circle_orange' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-2 text-[8.5px] text-slate-400 animate-slide-up">
                      <span className="block text-[10px] font-black text-[#f59e0b] uppercase tracking-wider">Recovery Circles Orange Strategy</span>
                      <p>During recovery, automatically identifies and trades the <strong className="text-white">2nd least frequent</strong> digit in the tick history as the predicted target.</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                          <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recovery Circles Red */}
                  {recoveryStreakMode === 'circle_red' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-2 text-[8.5px] text-slate-400 animate-slide-up">
                      <span className="block text-[10px] font-black text-[#ff444f] uppercase tracking-wider">Recovery Circles Red Strategy</span>
                      <p>During recovery, automatically identifies and trades the <strong className="text-white">least frequent</strong> (lowest percentage) digit in the tick history as the predicted target. Excellent for ultra-safe Differ purchases.</p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                          <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recovery Circles Target Pct */}
                  {recoveryStreakMode === 'circle_target_pct' && (
                    <div className="p-3 bg-[#0c0d0e] border border-[#222428]/60 rounded-xl space-y-3 animate-slide-up">
                      <div>
                        <span className="block text-[10px] font-black text-[#8b5cf6] uppercase tracking-wider">Recovery Circles Target Pct (%) Strategy</span>
                        <p className="text-[8.5px] text-slate-400">Triggers recovery trades on digits whose statistical frequency matches custom percentage comparison criteria.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Comparison</label>
                          <select
                            value={circleCompareMode}
                            onChange={(e) => setCircleCompareMode(e.target.value as any)}
                            disabled={isRunning}
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-2.5 py-2 outline-none focus:border-[#ff444f] transition-all"
                          >
                            <option value="higher">Higher than or Equal (&gt;=)</option>
                            <option value="lower">Lower than or Equal (&lt;=)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Target Pct (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={circleTargetPct}
                            onChange={(e) => setCircleTargetPct(parseFloat(e.target.value) || 10)}
                            disabled={isRunning}
                            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-2 outline-none focus:border-[#ff444f] transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Filter Allowed Digits</label>
                        <input
                          type="text"
                          value={circleFilterDigits}
                          onChange={(e) => setCircleFilterDigits(e.target.value)}
                          disabled={isRunning}
                          placeholder="e.g. all or 0,1,8,9"
                          className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-2 outline-none focus:border-[#ff444f] transition-all"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                        <div>
                          <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                          <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recovery Analysis Tool Signals */}
                  {recoveryStreakMode === 'analysis_tool' && (
                    <div className="p-3 bg-[#0c0d0e] border border-purple-500/40 rounded-xl space-y-2 text-[8.5px] text-slate-300 animate-slide-up">
                      <div className="flex items-center gap-1.5 text-purple-400 font-black uppercase tracking-wider text-[10px]">
                        <Radio size={12} className="animate-pulse" />
                        <span>Analysis Signals Recovery</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed">
                        {contractType === 'digitdiff'
                          ? "After a loss, recovery trades execute Differs contracts directly from live market feed and Differ Analysis engine calculations, without barrier or target digit rules."
                          : (recoveryAnalysisOppositeSignalEnabled ? "After a loss, recovery trades will execute using live signals from the Analysis Tool in OPPOSITE MODE. The signal's inverse directional bias will be applied." : "After a loss, recovery trades will execute automatically using live signals received from the Analysis Tool. For Over/Under contracts, the signal's directional bias will trade on your chosen digit barrier.")
                        }
                      </p>
                      {(['over_under', 'dual_ou', 'digitover', 'digitunder'].includes(contractType)) && (
                        <div className="pt-2 border-t border-[#222428]/60 mt-2 flex items-center justify-between">
                          <div>
                            <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-300">
                              Opposite Signal Target
                            </span>
                            <span className="block text-[7px] text-slate-500 leading-tight">
                              When ON, inverses the recovery trade (buys OVER on UNDER signal).
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => setRecoveryAnalysisOppositeSignalEnabled(!recoveryAnalysisOppositeSignalEnabled)}
                            className={cn(
                              "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
                              recoveryAnalysisOppositeSignalEnabled ? "bg-purple-500" : "bg-slate-700"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                recoveryAnalysisOppositeSignalEnabled ? "translate-x-1.5" : "-translate-x-1.5"
                              )}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recovery Streak & Touch Strategy */}
                  {recoveryStreakMode === 'consecutive_touch' && (
                    <div className="p-3 bg-[#0c0d0e] border border-amber-500/40 rounded-xl space-y-3 animate-slide-up">
                      <div className="flex items-center justify-between border-b border-[#222428]/60 pb-1.5">
                        <span className="block text-[10px] font-black text-amber-500 uppercase tracking-wider">
                          Recovery Streak & Touch Strategy
                        </span>
                        <span className="text-[8px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded">
                          ACTIVE AFTER LOSS
                        </span>
                      </div>

                      {(() => {
                        const isOver = isOverActive || (contractType === 'over_under' && ouPatternSelection !== 'under8');
                        const barrierVal = isOver ? (isOverActive ? activeOverDigit : 1) : (isUnderActive ? activeUnderDigit : 8);
                        const opposingLabel = isOver ? `Consecutive Under ${barrierVal}` : `Consecutive Over ${barrierVal}`;
                        const touchLabel = recoveryConsecTouchTouchType === 'any' ? "Any Digits to Touch" : (isOver ? `Over ${barrierVal} to Touch` : `Under ${barrierVal} to Touch`);

                        return (
                          <div className="space-y-2">
                            {/* Touch Filter Toggle */}
                            <div className="grid grid-cols-2 gap-1.5 bg-[#0e0f11] p-1 rounded-lg border border-[#222428]">
                              <button
                                type="button"
                                disabled={isRunning}
                                onClick={() => {
                                  setRecoveryConsecTouchTouchType('target');
                                  recoveryConsecTouchTouchTypeRef.current = 'target';
                                  localStorage.setItem('autobot_recovery_consec_touch_touch_type', 'target');
                                }}
                                className={cn(
                                  "py-1 text-[9px] font-black uppercase rounded transition-all text-center cursor-pointer",
                                  recoveryConsecTouchTouchType === 'target'
                                    ? "bg-amber-500 text-black font-black"
                                    : "text-slate-400 hover:text-white"
                                )}
                              >
                                {isOver ? `Over ${barrierVal}` : `Under ${barrierVal}`}
                              </button>
                              <button
                                type="button"
                                disabled={isRunning}
                                onClick={() => {
                                  setRecoveryConsecTouchTouchType('any');
                                  recoveryConsecTouchTouchTypeRef.current = 'any';
                                  localStorage.setItem('autobot_recovery_consec_touch_touch_type', 'any');
                                }}
                                className={cn(
                                  "py-1 text-[9px] font-black uppercase rounded transition-all text-center cursor-pointer",
                                  recoveryConsecTouchTouchType === 'any'
                                    ? "bg-amber-500 text-black font-black"
                                    : "text-slate-400 hover:text-white"
                                )}
                              >
                                Any Digit (0–9)
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                                  {opposingLabel}
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={recoveryConsecTouchOpposingTicks}
                                  disabled={isRunning}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    setRecoveryConsecTouchOpposingTicks(val);
                                    recoveryConsecTouchOpposingTicksRef.current = val;
                                    localStorage.setItem('autobot_recovery_consec_touch_opposing_ticks', val.toString());
                                  }}
                                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 transition-all"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                                  {touchLabel}
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={recoveryConsecTouchTargetDigits}
                                  disabled={isRunning}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                    setRecoveryConsecTouchTargetDigits(val);
                                    recoveryConsecTouchTargetDigitsRef.current = val;
                                    localStorage.setItem('autobot_recovery_consec_touch_target_digits', val.toString());
                                  }}
                                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 transition-all"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
          
          {/* Pattern Smart Mode Control - Only displayed on the Pattern strategy and when not dual_ou or Over/Under */}
          {streakMode === 'pattern' && contractType !== 'dual_ou' && contractType !== 'digitover' && contractType !== 'digitunder' && (
            <div className="p-3 bg-[#17181c] border border-[#222428] rounded-xl space-y-3 animate-fade-in animate-slide-up">
              {/* Auto-Switch */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-white uppercase tracking-wider">Pattern Auto-Switch / Smart Diff</span>
                  <span className="block text-[8px] sm:text-[9px] text-slate-500">
                    Smart auto-typing & stats-optimized differ digits
                  </span>
                </div>
                <button
                  type="button"
                  id="pattern-smart-switch"
                  onClick={() => {
                    const newVal = !patternSmartMode;
                    setPatternSmartMode(newVal);
                    (window as any).AUTOBOT_PATTERN_SMART_MODE = newVal;
                    
                    // Instantly update the bot execution context if running
                    if (isRunning) {
                      botEngine.getBotInterface().notify('info', `Pattern Auto-Switch turned ${newVal ? 'ON' : 'OFF'} live.`);
                    }
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    patternSmartMode ? "bg-[#ff444f]" : "bg-[#222428]"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      patternSmartMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                {patternSmartMode 
                  ? "Uses advanced pattern learning. Scans all active market pattern structures in real-time. On loss, learns a perfect pattern and its safest 1-selected digit (highly absent). Otherwise maintains the perfect pattern & digit."
                  : "Uses static pattern matching and prediction digit without self-optimizing adjustments."}
              </p>

              {patternSmartMode && (
                <div className="mt-2.5 p-2 bg-[#0e0f11] border border-[#222428] rounded-lg flex items-center justify-between text-[10px] font-semibold text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 px-1 py-0.5 rounded leading-none">
                      Active Learned Pattern
                    </span>
                    <span className="font-mono text-white text-xs bg-[#17181c] px-1.5 py-0.5 rounded border border-zinc-800">
                      {customPattern}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 px-1 py-0.5 rounded leading-none">
                      Digit to Differ
                    </span>
                    <span className="font-mono text-amber-400 text-xs bg-[#17181c] px-2 py-0.5 rounded border border-zinc-800">
                      {patternSmartDigit !== null ? patternSmartDigit : 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-[#222428]/40 my-1" />

              {/* Pattern Rotational Mode Switch */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-white uppercase tracking-wider">Pattern Rotational / Circular Mode</span>
                  <span className="block text-[8px] sm:text-[9px] text-slate-500">
                    Cycle/rotate through the pattern's digits to differ them consecutively
                  </span>
                </div>
                <button
                  type="button"
                  id="pattern-rotational-switch"
                  onClick={() => {
                    const newVal = !patternRotationalMode;
                    setPatternRotationalMode(newVal);
                    (window as any).AUTOBOT_PATTERN_ROTATIONAL_MODE = newVal;
                    
                    // Instantly update the bot execution context if running
                    if (isRunning) {
                      botEngine.getBotInterface().notify('info', `Pattern Rotational Mode turned ${newVal ? 'ON' : 'OFF'} live.`);
                    }
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    patternRotationalMode ? "bg-[#ff444f]" : "bg-[#222428]"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      patternRotationalMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                {patternRotationalMode 
                  ? "Uses the numbers in the pattern signal also to be differed. Each time the pattern appears (e.g. 123), it cycles through the digits in sequence (first match: differ 1, second match: differ 2, third match: differ 3, and so on)."
                  : "Uses static selector or Auto-Switch to determine the differ digit."}
              </p>

              {patternRotationalMode && (
                <div className="mt-2.5 p-2 bg-[#0e0f11] border border-[#222428] rounded-lg space-y-1.5 text-[10px] font-semibold text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-[#00a79e] font-bold uppercase tracking-wider bg-[#00a79e]/10 border border-[#00a79e]/25 px-1 py-0.5 rounded leading-none">
                      Active Rotation Pattern
                    </span>
                    <span className="font-mono text-white text-xs bg-[#17181c] px-1.5 py-0.5 rounded border border-zinc-800">
                      {customPattern}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                      Current Rotation Queues per Pattern
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
                      {customPattern.split(',').map((part, i) => {
                        const seq = part.trim().split('=')[0].replace(/[^0-9]/g, '');
                        if (!seq) return null;
                        const currentIdx = patternRotationalIdx.current[seq] || 0;
                        const digitsArray = seq.split('');
                        const nextDigitToDiffer = digitsArray[currentIdx];
                        return (
                          <div key={i} className="bg-[#17181c] p-1.5 rounded border border-zinc-800/80 flex flex-col gap-0.5">
                            <div className="text-slate-500 font-bold text-[8px] uppercase">Pattern: <span className="text-white">{seq}</span></div>
                            <div className="text-amber-400 text-xs flex justify-between items-center">
                              <span>Next Differ:</span>
                              <span className="bg-amber-400/10 px-1 py-0.5 text-amber-300 rounded font-bold border border-amber-400/20">{nextDigitToDiffer !== undefined ? nextDigitToDiffer : 'N/A'}</span>
                            </div>
                            <div className="text-[7px] text-slate-500 truncate">
                              Cycle: {digitsArray.map((d, index) => (
                                <span key={index} className={cn(index === currentIdx ? "text-amber-400 font-bold underline" : "")}>
                                  {d}{index < digitsArray.length - 1 ? " → " : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-[#222428]/40 my-1" />

              {/* Pattern Recovery Mode Switch */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-white uppercase tracking-wider">Pattern Recovery Mode / Safeguard</span>
                  <span className="block text-[8px] sm:text-[9px] text-slate-500">
                    Skip/ignore patterns that caused losses inside recovery sequences
                  </span>
                </div>
                <button
                  type="button"
                  id="pattern-recovery-switch"
                  onClick={() => {
                    const newVal = !patternRecoveryMode;
                    setPatternRecoveryMode(newVal);
                    (window as any).AUTOBOT_PATTERN_RECOVERY_MODE = newVal;
                    
                    // Instantly update the bot execution context if running
                    if (isRunning) {
                      botEngine.getBotInterface().notify('info', `Pattern Recovery Mode turned ${newVal ? 'ON' : 'OFF'} live.`);
                    }
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    patternRecoveryMode ? "bg-[#ff444f]" : "bg-[#222428]"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      patternRecoveryMode ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal">
                {patternRecoveryMode 
                  ? "Highly Recommended. Automatically skips trading any patterns that hit a loss in the current session until the session is recovered."
                  : "Deactivates ignore buffer. Continues to trade all specified patterns even on consecutive session losses."}
              </p>
            </div>
          )}

          {/* Types mode configuration settings and toggles */}
          {streakMode === 'types' && (
            <div className="p-3 bg-[#17181c] border border-[#222428] rounded-xl space-y-3.5 animate-fade-in animate-slide-up">
              <span className="block text-[10px] font-black text-rose-400 uppercase tracking-[0.12em]">Types Mode Strategies</span>
              
              {/* Digit Transition Matrix Strategy */}
              <div className="space-y-1.5 pb-2 border-b border-[#222428]/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Transition Matrix</span>
                  <button
                    type="button"
                    onClick={() => setTypesTransitionMatrix(!typesTransitionMatrix)}
                    className={cn(
                      "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                      typesTransitionMatrix ? "bg-[#ff444f]" : "bg-[#222428]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                        typesTransitionMatrix ? "translate-x-3.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Predicts the next digit based on sequential behavior & transition matrix algorithms.
                </p>
              </div>

              {/* Mirror Digit Reversal Strategy */}
              <div className="space-y-1.5 pb-2 border-b border-[#222428]/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Mirror Digit Reversal</span>
                  <button
                    type="button"
                    onClick={() => setTypesMirrorDigitReversal(!typesMirrorDigitReversal)}
                    className={cn(
                      "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                      typesMirrorDigitReversal ? "bg-[#ff444f]" : "bg-[#222428]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                        typesMirrorDigitReversal ? "translate-x-3.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Tracks mirror pairing cycles (e.g. 0↔9, 1↔8) to trade DIGITDIFF against repeating dominant sides.
                </p>
              </div>

              {/* Tick Compression Breakout Strategy */}
              <div className="space-y-1.5 pb-2 border-b border-[#222428]/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Tick Compression Breakout</span>
                  <button
                    type="button"
                    onClick={() => setTypesTickCompression(!typesTickCompression)}
                    className={cn(
                      "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                      typesTickCompression ? "bg-[#ff444f]" : "bg-[#222428]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                        typesTickCompression ? "translate-x-3.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Detects micro price compression (below 0.08 / 0.005) and trades breakouts from expansion instability.
                </p>
              </div>

              {/* Hidden Cycle Length Strategy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase tracking-wider">Hidden Cycle Length</span>
                  <button
                    type="button"
                    onClick={() => setTypesHiddenCycleLength(!typesHiddenCycleLength)}
                    className={cn(
                      "relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-250 ease-in-out focus:outline-none",
                      typesHiddenCycleLength ? "bg-[#ff444f]" : "bg-[#222428]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-250 ease-in-out",
                        typesHiddenCycleLength ? "translate-x-3.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Scans recent sequences to detect repeating cycle pattern lengths of 3 to 6 digits to predict next digit.
                </p>
              </div>
            </div>
          )}

          {/* AXA mode configuration settings and explanation */}
          {streakMode === 'axa' && (
            <div className="p-3.5 bg-[#17181c] border border-[#222428] rounded-xl space-y-3 animate-fade-in animate-slide-up">
              <span className="block text-[10px] font-black text-[#00a79e] uppercase tracking-[0.12em]">AXA Modulo Reset Strategy</span>
              
              <div className="space-y-2">
                <div className="text-xs font-black text-white uppercase tracking-wider">PRNG CONGRUENT MODULO RESET ($A-X-A$)</div>
                <p className="text-[8.5px] text-slate-400 leading-relaxed">
                  Predicts localized state loops inside synthetic asset registers. When a loop completes via sequence <span className="text-amber-400 font-semibold font-mono">A → X → A</span>, the algorithm is structurally blocked from returning to configuration <span className="text-[#00a79e] font-semibold font-mono">X</span> on the immediate next tick (<span className="text-slate-400 font-mono">T+1</span>).
                </p>
                <div className="p-2.5 bg-[#0e0f11] rounded-lg border border-[#222428] space-y-1.5 text-[8px] font-mono text-slate-500">
                  <div className="flex justify-between border-b border-[#222428]/40 pb-1">
                    <span className="text-slate-400 font-bold">Target Sequence:</span>
                    <span className="text-[#00a79e] font-bold">A → X → A</span>
                  </div>
                  <div className="flex justify-between border-b border-[#222428]/40 pb-1">
                    <span className="text-slate-400 font-bold">Constraint Rule:</span>
                    <span className="text-slate-300">A == A and A != X</span>
                  </div>
                  <div className="flex justify-between border-b border-[#222428]/40 pb-1">
                    <span className="text-slate-400 font-bold">Evaluation Ticks:</span>
                    <span className="text-slate-300">Last 3 ticks (T-2, T-1, T0)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#00a79e] font-bold">Signal Target:</span>
                    <span className="text-white font-bold bg-[#00a79e]/10 border border-[#00a79e]/20 px-1 rounded">DIFFER X (T+1)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pattern Missing Follower mode configuration settings */}
          {streakMode === 'lad_prng' && (
            <div className="p-3.5 bg-[#17181c] border border-[#222428] rounded-xl space-y-3 animate-fade-in animate-slide-up">
              <span className="block text-[10px] font-black text-[#38bdf8] uppercase tracking-[0.12em]">Pattern Follower Differ Strategy</span>
              
              <div className="space-y-2.5">
                <p className="text-[8.5px] text-slate-400 leading-relaxed font-sans">
                  Studies live tick digits to detect recurring 2-digit or 3-digit patterns that have appeared at least N times. Inspects the subsequent follower digits following each historical pattern instance. If any digit NEVER appeared in those follower windows, the bot purchases a <strong className="text-white">DIGITDIFF</strong> contract on that missing digit when the pattern repeats!
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#222428]/60">
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Pattern Length</label>
                    <select
                      value={pmfPatternLen}
                      onChange={(e) => setPmfPatternLen(parseInt(e.target.value, 10))}
                      disabled={isRunning}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#38bdf8] transition-all"
                    >
                      <option value={2}>2 Digits</option>
                      <option value={3}>3 Digits</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Min Occurrences</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={pmfMinOccurrences}
                      onChange={(e) => setPmfMinOccurrences(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      disabled={isRunning}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[#38bdf8] transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Follower Window</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={pmfFollowerLen}
                      onChange={(e) => setPmfFollowerLen(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      disabled={isRunning}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[#38bdf8] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Differs Calm Noise Strategy configuration settings */}
          {streakMode === 'differs_noise' && (
            <div className="p-3.5 bg-[#17181c] border border-emerald-500/30 rounded-xl space-y-3 animate-fade-in animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] font-black text-emerald-400 uppercase tracking-[0.12em] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Calm Digit (Noise Indicator) Differ Strategy
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                  Score ≤ {differsNoiseMaxScore}
                </span>
              </div>
              
              <div className="space-y-2.5">
                <p className="text-[8.5px] text-slate-400 leading-relaxed font-sans">
                  Monitors real-time market noise score (0-100) and digit distribution (0-9). When the market enters a <strong className="text-emerald-300 font-bold">CALM</strong> noise state, the indicator reads which digit appeared during the calm phase and immediately signals the bot to purchase a <strong className="text-white">DIGITDIFF</strong> contract on that digit.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-[#222428]/60">
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Max Noise (Calm Cutoff)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="10"
                        max="70"
                        value={differsNoiseMaxScore}
                        onChange={(e) => setDiffersNoiseMaxScore(Math.min(70, Math.max(10, parseInt(e.target.value, 10) || 35)))}
                        disabled={isRunning}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 transition-all"
                      />
                    </div>
                    <span className="text-[7.5px] text-slate-500 block">Lower = strictly calm only</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Min Calm Ticks</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={differsNoiseMinCalmTicks}
                      onChange={(e) => setDiffersNoiseMinCalmTicks(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 3)))}
                      disabled={isRunning}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-400 transition-all"
                    />
                    <span className="text-[7.5px] text-slate-500 block">Consecutive ticks required</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Target Digit Rule</label>
                    <select
                      value={differsNoiseTargetMode}
                      onChange={(e) => setDiffersNoiseTargetMode(e.target.value as any)}
                      disabled={isRunning}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-emerald-400 transition-all"
                    >
                      <option value="latest">Latest Calm Digit</option>
                      <option value="top_calm">Most Frequent Calm Digit</option>
                    </select>
                    <span className="text-[7.5px] text-slate-500 block">Digit to differ against</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* MODE DETAILS & INPUTS */}
        {contractType !== 'accumulator' && (
          <div className="space-y-2">
          {streakMode === 'pattern' && (
            <div className="space-y-3 animate-slide-up">
              {contractType === 'over_under' && (
                <div className="p-3 bg-[#121316] border border-[#00a79e]/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#00a79e]">
                      O/U Pattern Target Contract
                    </label>
                    <span className="text-[9px] font-bold text-slate-400 font-mono">
                      {ouPatternSelection === 'under8' ? 'UNDER 8' : 'OVER 1'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setOuPatternSelection('over1')}
                      className={cn(
                        "py-2 px-3 text-xs font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                        ouPatternSelection === 'over1'
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Over 1
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setOuPatternSelection('under8')}
                      className={cn(
                        "py-2 px-3 text-xs font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                        ouPatternSelection === 'under8'
                          ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.25)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Under 8
                    </button>
                  </div>
                  <span className="block text-[8px] text-slate-400 font-medium leading-relaxed">
                    When pattern signal matches on O/U contract type, the bot will immediately purchase <strong className="text-white">{ouPatternSelection === 'under8' ? 'DIGIT UNDER 8' : 'DIGIT OVER 1'}</strong>.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 pb-0.5">Consecutive Patterns</label>
              <input
                type="text"
                disabled={isRunning}
                value={customPattern}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9,=]/g, '');
                  setCustomPattern(cleaned);
                }}
                placeholder="Enter patterns, e.g. 23=2,44=4 or 89,70"
                maxLength={40}
                className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all"
              />
              <span className="block text-[8px] text-slate-500 font-medium">Purchases immediately when any of the comma-separated consecutive digit patterns appears. Use = to specify a dynamic differ digit (e.g. 23=2 will differ digit 2, disabling the static digit selector).</span>
              {patternRecoveryMode && typeof window !== 'undefined' && ((window as any).AUTOBOT_CONSEC_LOSSES || 0) > 0 && ((window as any).AUTOBOT_LOST_PATTERNS || []).length > 0 && (
                <div className="mt-2 flex flex-col gap-1 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 font-sans text-[9px] font-semibold leading-relaxed">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="font-bold uppercase tracking-wider text-amber-500 text-[10px]">Recovery Mode Active</span>
                  </div>
                  <div>
                    Ignoring lost pattern(s): <span className="font-mono bg-black/40 px-1 py-0.5 rounded text-white font-bold">{((window as any).AUTOBOT_LOST_PATTERNS || []).join(', ')}</span>
                  </div>
                  <div className="text-slate-400 text-[8px] leading-tight font-medium">
                    Only other specified patterns are allowed to trade. Ignored patterns will reset after successful recovery.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {streakMode === 'consecutive' && (
            <div className="space-y-3 animate-slide-up">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 pb-0.5 font-sans">Consecutive Threshold</label>
                <select
                  value={streakThreshold}
                  onChange={(e) => setStreakThreshold(parseInt(e.target.value, 10))}
                  disabled={isRunning}
                  className={cn(
                    "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <option key={num} value={num}>
                      {num} Consecutive Exact
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Loss Streak Threshold Trigger Switch */}
              <div className="bg-[#121316] border border-[#222428]/40 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 font-sans">
                      Post-Loss Threshold
                    </label>
                    <span className="block text-[8px] text-slate-500 font-medium font-sans">
                      Use a different consecutive count after a loss
                    </span>
                  </div>
                  <div 
                    onClick={() => !isRunning && setIsLossStreakThresholdEnabled(!isLossStreakThresholdEnabled)} 
                    className={cn(
                      "flex items-center gap-1 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors border",
                      isLossStreakThresholdEnabled 
                        ? "bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]" 
                        : "bg-[#16191e] border-[#222428] text-slate-500 hover:text-slate-300",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-[9px] font-black tracking-wider uppercase">Active</span>
                    <div className={cn(
                      "w-5 h-3 rounded-full relative transition-[background-color] flex items-center p-[1px]",
                      isLossStreakThresholdEnabled ? "bg-[#ff444f]" : "bg-slate-705 bg-slate-700"
                    )}>
                      <div className={cn(
                        "w-2.5 h-2.5 bg-white rounded-full transition-transform transform",
                        isLossStreakThresholdEnabled ? "translate-x-2" : "translate-x-0"
                      )} />
                    </div>
                  </div>
                </div>

                {isLossStreakThresholdEnabled && (
                  <div className="space-y-1.5 pt-2 border-t border-[#222428]/50 animate-slide-up">
                    <label className="block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 font-sans">
                      Recovery Threshold (1-4 Ticks)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={isRunning}
                          onClick={() => setLossStreakThreshold(num)}
                          className={cn(
                            "py-1.5 text-xs font-mono font-bold rounded-lg border transition-all",
                            lossStreakThreshold === num
                              ? "bg-[#ff444f] border-[#ff444f] text-white"
                              : "bg-[#0c0d0f] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                            isRunning && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {num} {num === 1 ? 'Tick' : 'Ticks'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {streakMode === 'percentage' && (
            <div className="space-y-1 animate-slide-up">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 pb-0.5 font-sans">Percentage Threshold (%)</label>
                <div 
                  onClick={() => !isRunning && setIsExactPercentage(!isExactPercentage)} 
                  className={cn(
                    "flex items-center gap-1 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors border",
                    isExactPercentage 
                      ? "bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]" 
                      : "bg-[#16191e] border-[#222428] text-slate-500 hover:text-slate-300",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                  title="When exact match is ON, purchases only when matching percentage equals this setting (e.g. exactly 90%)."
                >
                  <span className="text-[9px] font-black tracking-wider uppercase">Exact Match</span>
                  <div className={cn(
                    "w-5 h-3 rounded-full relative transition-colors flex items-center p-[1px]",
                    isExactPercentage ? "bg-[#ff444f]" : "bg-slate-700"
                  )}>
                    <div className={cn(
                      "w-2.5 h-2.5 bg-white rounded-full transition-transform transform",
                      isExactPercentage ? "translate-x-2" : "translate-x-0"
                    )} />
                  </div>
                </div>
              </div>
              <input
                type="number"
                disabled={isRunning}
                value={percentageThreshold}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                  setPercentageThreshold(val);
                }}
                min={0}
                max={100}
                placeholder="e.g. 80"
                className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#ff444f] transition-all"
              />
              <span className="block text-[8px] text-slate-500 font-medium font-sans">
                {isExactPercentage 
                  ? "Purchases ONLY when the calculated matching percentage is exactly equal to this setting (e.g. exactly 90% and nothing else)." 
                  : "Purchases when the calculated matching percentage is equal to or greater than this setting."}
              </span>
            </div>
          )}

          {streakMode === 'price_digits' && (
            <div className="p-3.5 bg-[#121316] border border-[#222428] rounded-xl space-y-3 animate-slide-up">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-[#00a79e] font-sans flex items-center justify-between">
                  <span>Target Price Digits / Points</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">Signal Pattern</span>
                </label>
                <input
                  type="text"
                  disabled={isRunning}
                  value={priceDigitsInput}
                  onChange={(e) => setPriceDigitsInput(e.target.value)}
                  placeholder="e.g. .01, .1780, .392"
                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2.5 outline-none focus:border-[#00a79e] transition-all"
                />
                <span className="block text-[8px] text-slate-500 font-medium font-sans leading-relaxed">
                  Enter 2, 3, or 4 trailing digit points (e.g. <code className="text-[#00a79e] bg-black/40 px-1 rounded">.01</code>, <code className="text-[#00a79e] bg-black/40 px-1 rounded">.1780</code>, <code className="text-[#00a79e] bg-black/40 px-1 rounded">.392</code>) separated by commas. Triggers a market signal whenever the live tick price ends with any of these points.
                </span>
              </div>

              {/* Active signal points tag chips preview */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#222428]/50">
                <span className="text-[9px] font-bold uppercase text-slate-400">Target Signals:</span>
                {priceDigitsInput
                  .split(/[\s,]+/)
                  .map(s => s.trim())
                  .filter(Boolean)
                  .map((p, idx) => (
                    <span key={idx} className="px-2 py-0.5 text-[9px] font-mono font-black bg-[#00a79e]/15 text-[#00a79e] border border-[#00a79e]/30 rounded-md">
                      {p.startsWith('.') ? p : `.${p}`}
                    </span>
                  ))}
                {priceDigitsInput.split(/[\s,]+/).filter(Boolean).length === 0 && (
                  <span className="text-[9px] text-rose-400 font-bold">No signal points entered</span>
                )}
              </div>
            </div>
          )}

          {(streakMode === 'over_under' || (isRecoveryStreakModeEnabled && recoveryStreakMode === 'over_under')) && (
            <div className="p-3.5 bg-[#121316] border border-[#222428] rounded-xl space-y-3 animate-slide-up">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-black text-[#00a79e] uppercase tracking-[0.12em] font-sans">
                    Over 1 / Under 8 Strategy
                  </span>
                  <span className="block text-[8px] text-slate-400 font-medium font-sans">
                    {isEdmsEnabled ? "Extreme Digit Momentum Strategy (EDMS)" : "Cold Zone Frequency Scanner"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[8px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider",
                    isEdmsEnabled 
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30 font-black animate-pulse" 
                      : "bg-[#00a79e]/15 text-[#00a79e] border-[#00a79e]/30"
                  )}>
                    {isEdmsEnabled ? "EDMS ACTIVE" : "SCANNER ACTIVE"}
                  </span>
                </div>
              </div>

              {/* EDMS Strategy Master Toggle Switch */}
              <div className="flex items-center justify-between bg-[#0e0f11] border border-[#222428] rounded-lg p-2.5">
                <div className="space-y-0.5 pr-2">
                  <span className="block text-[10px] font-extrabold text-white uppercase tracking-wider">
                    Extreme Digit Momentum Strategy (EDMS)
                  </span>
                  <span className="block text-[8px] text-slate-400 leading-tight">
                    {isEdmsEnabled
                      ? "EDMS is ON. Standard Cold Zone Scanner Strategy is OFF."
                      : "Turn ON to activate EDMS and deactivate standard Cold Zone Scanner."}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    const nextVal = !isEdmsEnabled;
                    setIsEdmsEnabled(nextVal);
                    botEngine.getBotInterface().notify(
                      'info', 
                      `Extreme Digit Momentum Strategy (EDMS) ${nextVal ? 'ACTIVATED (Scanner OFF)' : 'DEACTIVATED (Scanner ON)'}`
                    );
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isEdmsEnabled ? "bg-amber-500" : "bg-[#222428]",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                  title={isEdmsEnabled ? "Disable EDMS Strategy" : "Enable EDMS Strategy"}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isEdmsEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* IF EDMS IS ON: Show EDMS Core Formula Components & Live Metrics */}
              {isEdmsEnabled ? (
                <div className="space-y-2.5 pt-2 border-t border-[#222428]/60">
                  <div className="text-[9px] text-slate-300 leading-relaxed font-sans space-y-1">
                    <p className="font-bold text-amber-400 uppercase tracking-wider text-[8.5px]">
                      EDMS Core Formula Conditions:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[8px] font-mono text-slate-400 bg-[#090a0c] p-2 rounded border border-[#222428]">
                      <div>• <strong className="text-white">Volatility (V):</strong> ATR₁₄ / SMA₂₀(ATR₁₄) &ge; 0.80</div>
                      <div>• <strong className="text-white">Volume (VOL):</strong> VOL / SMA₂₀(VOL) &ge; 0.80</div>
                      <div>• <strong className="text-white">Over 1 Pos (P):</strong> BB %B &le; 0.40</div>
                      <div>• <strong className="text-white">Under 8 Pos (P):</strong> BB %B &ge; 0.60</div>
                      <div>• <strong className="text-white">Over 1 Mom (M):</strong> StochRSI₁₄ &le; 0.50</div>
                      <div>• <strong className="text-white">Under 8 Mom (M):</strong> StochRSI₁₄ &ge; 0.50</div>
                      <div>• <strong className="text-white">Over 1 Trend (T):</strong> (EMA₅ - EMA₂₀) / ATR &le; 0.50</div>
                      <div>• <strong className="text-white">Under 8 Trend (T):</strong> (EMA₅ - EMA₂₀) / ATR &ge; -0.50</div>
                    </div>
                  </div>

                  {/* Live EDMS Component Values */}
                  {(() => {
                    const sampleMarket = selectedRngMarket || visibleCheckedMarkets[0] || '1HZ10V';
                    const sampleData = marketTicks[sampleMarket];
                    const edmsM = sampleData?.edmsMetrics;

                    return (
                      <div className="bg-[#090a0c] border border-[#222428] rounded-lg p-2 space-y-1.5 font-mono text-[8.5px]">
                        <div className="flex items-center justify-between text-[#00a79e] font-bold text-[8px] uppercase tracking-wider pb-1 border-b border-white/5">
                          <span>EDMS Live Indicators ({sampleMarket})</span>
                          <span>{sampleData?.price ? sampleData.price.toFixed(MARKET_CONFIGS.find(m => m.symbol === sampleMarket)?.decimals || 2) : '---'}</span>
                        </div>

                        <div className="grid grid-cols-5 gap-1 text-center">
                          <div className={cn("p-1 rounded border", edmsM?.V > 1.25 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" : "bg-black/30 border-white/5 text-slate-400")}>
                            <div className="text-[7px] text-slate-500 uppercase">Vol (V)</div>
                            <div>{edmsM?.V !== undefined ? edmsM.V.toFixed(2) : '--'}</div>
                          </div>
                          <div className={cn("p-1 rounded border", (edmsM?.P < -0.15 || edmsM?.P > 0.85) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" : "bg-black/30 border-white/5 text-slate-400")}>
                            <div className="text-[7px] text-slate-500 uppercase">Pos (P)</div>
                            <div>{edmsM?.P !== undefined ? edmsM.P.toFixed(2) : '--'}</div>
                          </div>
                          <div className={cn("p-1 rounded border", (edmsM?.M < 0.25 || edmsM?.M > 0.75) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" : "bg-black/30 border-white/5 text-slate-400")}>
                            <div className="text-[7px] text-slate-500 uppercase">Mom (M)</div>
                            <div>{edmsM?.M !== undefined ? edmsM.M.toFixed(2) : '--'}</div>
                          </div>
                          <div className={cn("p-1 rounded border", edmsM?.VOL > 1.5 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" : "bg-black/30 border-white/5 text-slate-400")}>
                            <div className="text-[7px] text-slate-500 uppercase">Volu (VOL)</div>
                            <div>{edmsM?.VOL !== undefined ? edmsM.VOL.toFixed(2) : '--'}</div>
                          </div>
                          <div className={cn("p-1 rounded border", (edmsM?.T < -0.02 || edmsM?.T > 0.02) ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold" : "bg-black/30 border-white/5 text-slate-400")}>
                            <div className="text-[7px] text-slate-500 uppercase">Trnd (T)</div>
                            <div>{edmsM?.T !== undefined ? edmsM.T.toFixed(3) : '--'}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[8px]">
                          <div>
                            Signal S(Over/Under):{" "}
                            <span className={edmsM?.sOver === 1 ? "text-emerald-400 font-black" : "text-slate-500"}>Over={edmsM?.sOver || 0}</span>
                            {" | "}
                            <span className={edmsM?.sUnder === 1 ? "text-emerald-400 font-black" : "text-slate-500"}>Under={edmsM?.sUnder || 0}</span>
                          </div>
                          <div className="text-amber-400 font-bold">
                            SS(Over): {edmsM?.ssOver || 0} | SS(Under): {edmsM?.ssUnder || 0}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* IF EDMS IS OFF: Show Standard Cold Zone Scanner Controls */
                <div className="space-y-2 pt-2 border-t border-[#222428]/60">
                  <p className="text-[8.5px] text-slate-400 leading-relaxed font-sans">
                    Scans tick digit frequency stream ($N={ouSamplePeriod}$) to detect cold zones. Triggers directly on cold zone entries:
                    <br />
                    • <strong className="text-white">Over 1 Entry:</strong> Triggered when loss freq $F(0)+F(1) \le {ouColdThresholdMax}\%$, $F(0), F(1) \le {ouSingleDigitMax}\%$, on tick digit 0 or 1.
                    <br />
                    • <strong className="text-white">Under 8 Entry:</strong> Triggered when loss freq $F(8)+F(9) \le {ouColdThresholdMax}\%$, $F(8), F(9) \le {ouSingleDigitMax}\%$, on tick digit 8 or 9.
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Ticks ($N$)</label>
                      <input
                        type="number"
                        min="20"
                        max="500"
                        disabled={isRunning}
                        value={ouSamplePeriod}
                        onChange={(e) => setOuSamplePeriod(Math.max(10, parseInt(e.target.value, 10) || 100))}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Max Combined %</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="50"
                        disabled={isRunning}
                        value={ouColdThresholdMax}
                        onChange={(e) => setOuColdThresholdMax(Math.max(1, parseFloat(e.target.value) || 12.0))}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Max Single %</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="25"
                        disabled={isRunning}
                        value={ouSingleDigitMax}
                        onChange={(e) => setOuSingleDigitMax(Math.max(0.5, parseFloat(e.target.value) || 6.0))}
                        className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {streakMode === 'circle_green' && (
            <div className="p-3 bg-[#121316] border border-[#222428] rounded-xl space-y-2 animate-slide-up">
              <span className="block text-xs font-black text-[#12d6c2] uppercase tracking-wider">Circles Green Strategy</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Automatically identifies and trades the **most frequent** (highest percentage) digit in the last N ticks as the predicted target digit. Fits perfectly with Differ or other contract modes.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                  <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {streakMode === 'circle_blue' && (
            <div className="p-3 bg-[#121316] border border-[#222428] rounded-xl space-y-2 animate-slide-up">
              <span className="block text-xs font-black text-[#1888f2] uppercase tracking-wider">Circles Blue Strategy</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Automatically identifies and trades the **2nd most frequent** digit in the last N ticks as the predicted target digit.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                  <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {streakMode === 'circle_orange' && (
            <div className="p-3 bg-[#121316] border border-[#222428] rounded-xl space-y-2 animate-slide-up">
              <span className="block text-xs font-black text-[#f59e0b] uppercase tracking-wider">Circles Orange Strategy</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Automatically identifies and trades the **2nd least frequent** digit in the last N ticks as the predicted target digit.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                  <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {streakMode === 'circle_red' && (
            <div className="p-3 bg-[#121316] border border-[#222428] rounded-xl space-y-2 animate-slide-up">
              <span className="block text-xs font-black text-[#ff444f] uppercase tracking-wider">Circles Red Strategy</span>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Automatically identifies and trades the **least frequent** (lowest percentage) digit in the last N ticks as the predicted target digit. Excellent for ultra-safe Differ purchases.
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                  <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {streakMode === 'circle_target_pct' && (
            <div className="p-3 bg-[#121316] border border-[#222428] rounded-xl space-y-3.5 animate-slide-up">
              <div>
                <span className="block text-xs font-black text-purple-400 uppercase tracking-wider">Circles Target Pct (%) Strategy</span>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Triggers trading on digits whose statistical frequency matches your custom percentage comparison criteria.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Comparison</label>
                  <select
                    value={circleCompareMode}
                    onChange={(e) => setCircleCompareMode(e.target.value as any)}
                    disabled={isRunning}
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-bold rounded-lg px-2.5 py-2 outline-none focus:border-[#ff444f] transition-all"
                  >
                    <option value="higher">Higher than or Equal (&gt;=)</option>
                    <option value="lower">Lower than or Equal (&lt;=)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Target Pct (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={circleTargetPct}
                    onChange={(e) => setCircleTargetPct(parseFloat(e.target.value) || 10)}
                    disabled={isRunning}
                    className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-2 outline-none focus:border-[#ff444f] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">Filter Allowed Digits</label>
                <input
                  type="text"
                  value={circleFilterDigits}
                  onChange={(e) => setCircleFilterDigits(e.target.value)}
                  disabled={isRunning}
                  placeholder="e.g. all or 0,1,8,9"
                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-2 outline-none focus:border-[#ff444f] transition-all"
                />
                <span className="block text-[8px] text-slate-500 leading-tight">
                  Enter "all" to check any matching digit, or comma-separated digits to only trigger on specific ones.
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#222428]/60">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-300">Digit Touch Entry</span>
                  <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade execution</span>
                </div>
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]",
                    isRunning && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {streakMode === 'circle_over_under' && (
            <div className="p-3.5 bg-[#121316] border border-[#00a79e]/40 rounded-xl space-y-4 animate-slide-up">
              <div className="flex items-center justify-between border-b border-[#222428]/60 pb-2.5">
                <div>
                  <span className="block text-xs font-black text-[#00a79e] uppercase tracking-wider flex items-center gap-1.5">
                    ⭕ Circle O/U Strategy — Low % Scanner & Touch Trigger
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                    Focuses strictly on markets where <strong>ONLY</strong> your selected numbers are below the percentage threshold, then executes the 3-step touch sequence.
                  </p>
                </div>
                <span className="text-[10px] font-mono font-black text-[#00a79e] bg-[#00a79e]/15 border border-[#00a79e]/40 px-2.5 py-1 rounded-md shrink-0 shadow-[0_0_10px_rgba(0,167,158,0.2)]">
                  {circleOuTargetType.toUpperCase()} {circleOuDigit}
                </span>
              </div>

              {/* Quick Strategy Presets */}
              <div className="space-y-1">
                <label className="block text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setCircleOuTargetType('over');
                      setCircleOuDigit(1);
                      setCircleOuMaxPct(9.0);
                      setCircleOuLowDigits('0,1');
                      setCircleOuLowTouchMode('consecutive');
                      setCircleOuOverTouchCount(2);
                      setCircleOuFinalTouchMaxTicks(3);
                    }}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between",
                      circleOuTargetType === 'over' && circleOuDigit === 1 && circleOuLowDigits === '0,1'
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-emerald-400">🔥 Over 1 Preset</span>
                      <span className="text-[7.5px] font-mono bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded font-bold">0,1 &lt; 9.0%</span>
                    </div>
                    <span className="text-[8px] text-slate-400 mt-0.5">Focus [0,1] &lt; 9% ➔ Touch 0,1 ➔ 2-9 Touch ➔ Final 0/1</span>
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => {
                      setCircleOuTargetType('under');
                      setCircleOuDigit(8);
                      setCircleOuMaxPct(9.0);
                      setCircleOuLowDigits('8,9');
                      setCircleOuLowTouchMode('consecutive');
                      setCircleOuOverTouchCount(2);
                      setCircleOuFinalTouchMaxTicks(3);
                    }}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between",
                      circleOuTargetType === 'under' && circleOuDigit === 8 && circleOuLowDigits === '8,9'
                        ? "bg-rose-500/15 border-rose-500 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                        : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-rose-400">🔥 Under 8 Preset</span>
                      <span className="text-[7.5px] font-mono bg-rose-500/20 text-rose-300 px-1 py-0.5 rounded font-bold">8,9 &lt; 9.0%</span>
                    </div>
                    <span className="text-[8px] text-slate-400 mt-0.5">Focus [8,9] &lt; 9% ➔ Touch 8,9 ➔ 0-7 Touch ➔ Final 8/9</span>
                  </button>
                </div>
              </div>

              {/* Target Contract Direction & Barrier Digit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#222428]/60">
                <div className="space-y-1">
                  <label className="block text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-300">
                    Target Contract Direction
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setCircleOuTargetType('over')}
                      className={cn(
                        "py-1.5 px-2 text-[10px] font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                        circleOuTargetType === 'over'
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Over {circleOuDigit}
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setCircleOuTargetType('under')}
                      className={cn(
                        "py-1.5 px-2 text-[10px] font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                        circleOuTargetType === 'under'
                          ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Under {circleOuDigit}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-300">
                      Barrier Digit (0 - 9)
                    </label>
                    <span className="text-[9px] font-mono font-bold text-amber-400">
                      Selected: {circleOuDigit}
                    </span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setCircleOuDigit(d)}
                        className={cn(
                          "py-1 text-[10px] font-mono font-bold rounded-md border transition-all text-center cursor-pointer",
                          circleOuDigit === d
                            ? "bg-[#00a79e] border-[#00a79e] text-black font-black"
                            : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                          isRunning && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* INPUT 1: Percentage Input (eg over 1 9.0% below) */}
              <div className="space-y-1.5 pt-2 border-t border-[#222428]/60">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-200">
                    1. Low Percentage Threshold (% Below)
                  </label>
                  <span className="text-[9px] font-mono font-bold text-amber-400">
                    &lt; {circleOuMaxPct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[8px] text-slate-400 leading-tight">
                  The bot will focus <strong>ONLY</strong> on markets where the low numbers below are strictly below this percentage (e.g. &lt; {circleOuMaxPct.toFixed(1)}%). All other digits must be ≥ {circleOuMaxPct.toFixed(1)}%.
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step={0.1}
                      min={1.0}
                      max={25.0}
                      value={circleOuMaxPct}
                      disabled={isRunning}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) setCircleOuMaxPct(val);
                      }}
                      className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[7.0, 8.0, 8.5, 9.0, 9.5, 10.0].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        disabled={isRunning}
                        onClick={() => setCircleOuMaxPct(pct)}
                        className={cn(
                          "px-2 py-1 text-[8px] font-mono font-bold rounded border transition-all cursor-pointer",
                          circleOuMaxPct === pct
                            ? "bg-[#00a79e] border-[#00a79e] text-black font-black"
                            : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:text-white"
                        )}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* INPUT 2: Low-Percentage Digits (eg 0,1) */}
              <div className="space-y-1.5 pt-2 border-t border-[#222428]/60">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-200">
                    2. Low Percentage Digits (The Only Numbers Below {circleOuMaxPct.toFixed(1)}%)
                  </label>
                  <span className="text-[9px] font-mono font-bold text-amber-400">
                    [{circleOuLowDigits}]
                  </span>
                </div>
                <p className="text-[8px] text-slate-400 leading-tight">
                  Specify the digits that are the only ones permitted to be below {circleOuMaxPct.toFixed(1)}% (e.g. <strong className="text-white">0,1</strong> for Over 1, or <strong className="text-white">8,9</strong> for Under 8). Click numbers below to toggle.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={circleOuLowDigits}
                    disabled={isRunning}
                    onChange={(e) => setCircleOuLowDigits(e.target.value)}
                    placeholder="e.g. 0,1"
                    className="w-32 bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                  />
                  <div className="flex items-center gap-1 flex-wrap flex-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                      const list = circleOuLowDigits.split(/[,\s]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
                      const isSelected = list.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            if (isRunning) return;
                            let next: number[];
                            if (isSelected) {
                              next = list.filter(item => item !== d);
                              if (next.length === 0) next = [d];
                            } else {
                              next = [...list, d].sort((a, b) => a - b);
                            }
                            setCircleOuLowDigits(next.join(','));
                          }}
                          className={cn(
                            "w-6 h-6 text-[10px] font-mono font-black rounded border transition-all text-center flex items-center justify-center cursor-pointer",
                            isSelected
                              ? "bg-amber-500 border-amber-500 text-black shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                              : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-500 hover:text-white"
                          )}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* INPUT 3: Low Digits Touch Mode (consecutive 0 and 1 or 1 by 1) */}
              <div className="space-y-1.5 pt-2 border-t border-[#222428]/60">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-200">
                    3. Low Digits Touch Mode (Step 1 Touch)
                  </label>
                  <span className="text-[9px] font-mono font-bold text-amber-400 uppercase">
                    {circleOuLowTouchMode === 'consecutive' ? 'Consecutive' : '1 by 1'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setCircleOuLowTouchMode('consecutive')}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between",
                      circleOuLowTouchMode === 'consecutive'
                        ? "bg-[#00a79e]/15 border-[#00a79e] text-[#00a79e] shadow-[0_0_10px_rgba(0,167,158,0.2)]"
                        : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-[10px] font-black">⚡ Consecutive</span>
                    <span className="text-[8px] text-slate-400 mt-0.5 leading-tight">
                      Low digits [{circleOuLowDigits}] must touch back-to-back in consecutive ticks
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => setCircleOuLowTouchMode('one_by_one')}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between",
                      circleOuLowTouchMode === 'one_by_one'
                        ? "bg-[#00a79e]/15 border-[#00a79e] text-[#00a79e] shadow-[0_0_10px_rgba(0,167,158,0.2)]"
                        : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                      isRunning && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="text-[10px] font-black">🎯 1 by 1 (Individual)</span>
                    <span className="text-[8px] text-slate-400 mt-0.5 leading-tight">
                      Each digit in [{circleOuLowDigits}] must be touched at least once in any order
                    </span>
                  </button>
                </div>
              </div>

              {/* INPUT 4: Over Digits (2-9) Touch Count */}
              <div className="space-y-1.5 pt-2 border-t border-[#222428]/60">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-200">
                    4. {circleOuTargetType === 'over' ? 'Over Digits (2–9)' : 'Under Digits (0–7)'} Touch Count (Step 2)
                  </label>
                  <span className="text-[9px] font-mono font-bold text-amber-400">
                    Touch {circleOuOverTouchCount} {circleOuOverTouchCount === 1 ? 'Time' : 'Times'}
                  </span>
                </div>
                <p className="text-[8px] text-slate-400 leading-tight">
                  After the low digits are touched, how many times must the opposing/over digits touch before advancing to the final confirmation window.
                </p>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setCircleOuOverTouchCount(num)}
                      className={cn(
                        "flex-1 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all text-center cursor-pointer",
                        circleOuOverTouchCount === num
                          ? "bg-[#00a79e] border-[#00a79e] text-black font-black"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
              </div>

              {/* INPUT 5: Final confirmation touch window (Wait for 1 or 0 before 1, 2, or 3 ticks) */}
              <div className="space-y-1.5 pt-2 border-t border-[#222428]/60">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-200">
                    5. Final Touch Confirmation Window (Step 3)
                  </label>
                  <span className="text-[9px] font-mono font-bold text-emerald-400">
                    Within {circleOuFinalTouchMaxTicks} {circleOuFinalTouchMaxTicks === 1 ? 'Tick' : 'Ticks'}
                  </span>
                </div>
                <p className="text-[8px] text-slate-400 leading-tight">
                  After over digits touch, the bot waits for digit <strong className="text-white">{circleOuLowDigits}</strong> to touch the last time <strong>before {circleOuFinalTouchMaxTicks} ticks</strong>. If touched, it triggers BUY immediately! If it passes without touching, the bot waits for another signal.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={isRunning}
                      onClick={() => setCircleOuFinalTouchMaxTicks(t)}
                      className={cn(
                        "py-2 text-xs font-mono font-bold rounded-lg border transition-all text-center cursor-pointer flex flex-col items-center justify-center",
                        circleOuFinalTouchMaxTicks === t
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-black shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span>{t} {t === 1 ? 'Tick' : 'Ticks'}</span>
                      <span className="text-[7.5px] text-slate-400">
                        {t === 1 ? 'Immediate next tick' : `Wait max ${t} ticks`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution Roadmap Card */}
              <div className="p-3 bg-[#0a0b0d] border border-[#00a79e]/30 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#00a79e] font-black text-[9.5px] uppercase tracking-wider">
                  <Activity size={12} className="animate-pulse" />
                  <span>Execution Sequence Roadmap</span>
                </div>
                <div className="text-[8.5px] text-slate-300 font-mono space-y-1 leading-relaxed">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">FOCUS:</span>
                    <span>Markets where ONLY [{circleOuLowDigits}] are &lt; {circleOuMaxPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sky-400 font-bold">STEP 1:</span>
                    <span>Touch digits [{circleOuLowDigits}] ({circleOuLowTouchMode === 'consecutive' ? 'Consecutive' : '1-by-1'})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 font-bold">STEP 2:</span>
                    <span>Touch {circleOuTargetType === 'over' ? 'digits 2-9' : 'opposing digits'} {circleOuOverTouchCount} times</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">STEP 3:</span>
                    <span>Touch [{circleOuLowDigits}] the last time within {circleOuFinalTouchMaxTicks} ticks ➔ <strong className="text-white bg-[#00a79e]/30 px-1 py-0.2 rounded">BUY {circleOuTargetType.toUpperCase()} {circleOuDigit}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Streak & Touch Strategy for Over / Under */}
          {streakMode === 'consecutive_touch' && (
            <div className="p-3.5 bg-[#121316] border border-[#00a79e]/40 rounded-xl space-y-3.5 animate-slide-up">
              <div className="flex items-center justify-between border-b border-[#222428]/60 pb-2">
                <div>
                  <span className="block text-xs font-black text-[#00a79e] uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#00a79e]" />
                    Streak & Touch Strategy
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                    Wait for consecutive opposing digits, then count how many target digits to touch before trade execution.
                  </p>
                </div>
                <span className="text-[9px] font-mono font-bold text-[#00a79e] bg-[#00a79e]/10 border border-[#00a79e]/30 px-2 py-0.5 rounded shrink-0">
                  {isOverActive ? `OVER ${activeOverDigit}` : isUnderActive ? `UNDER ${activeUnderDigit}` : contractType === 'over_under' ? (ouPatternSelection === 'under8' ? 'UNDER 8' : 'OVER 1') : 'OVER / UNDER'}
                </span>
              </div>

              {/* Target selection if over_under */}
              {contractType === 'over_under' && (
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">
                    Target Contract
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setOuPatternSelection('over1')}
                      className={cn(
                        "py-1.5 px-2 text-[10px] font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                        ouPatternSelection !== 'under8'
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Over 1
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setOuPatternSelection('under8')}
                      className={cn(
                        "py-1.5 px-2 text-[10px] font-black uppercase rounded-lg border transition-all text-center cursor-pointer",
                        ouPatternSelection === 'under8'
                          ? "bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                          : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                        isRunning && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Under 8
                    </button>
                  </div>
                </div>
              )}

              {/* Consecutive Opposing Input & Touch Input */}
              {(() => {
                const isOver = isOverActive || (contractType === 'over_under' && ouPatternSelection !== 'under8');
                const barrierVal = contractType === 'over_under'
                  ? (ouPatternSelection === 'under8' ? 8 : 1)
                  : isOver
                  ? activeOverDigit
                  : activeUnderDigit;
                const opposingLabel = isOver ? `Consecutive Under ${barrierVal}` : `Consecutive Over ${barrierVal}`;
                const touchLabel = isOver ? `Over ${barrierVal} Digits to Touch` : `Under ${barrierVal} Digits to Touch`;

                return (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">
                          {opposingLabel}
                        </label>
                        <span className="text-[9px] font-mono font-bold text-amber-400">
                          Wait for {consecTouchOpposingTicks} {isOver ? `Under ${barrierVal} (≤ ${barrierVal})` : `Over ${barrierVal} (≥ ${barrierVal})`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={consecTouchOpposingTicks}
                          disabled={isRunning}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setConsecTouchOpposingTicks(val);
                            consecTouchOpposingTicksRef.current = val;
                            localStorage.setItem('autobot_consec_touch_opposing_ticks', val.toString());
                          }}
                          className="w-20 bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                        />
                        <div className="grid grid-cols-5 gap-1 flex-1">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              disabled={isRunning}
                              onClick={() => {
                                setConsecTouchOpposingTicks(num);
                                consecTouchOpposingTicksRef.current = num;
                                localStorage.setItem('autobot_consec_touch_opposing_ticks', num.toString());
                              }}
                              className={cn(
                                "py-1 text-[10px] font-mono font-bold rounded-md border transition-all text-center cursor-pointer",
                                consecTouchOpposingTicks === num
                                  ? "bg-[#00a79e] border-[#00a79e] text-black font-black"
                                  : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                                isRunning && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-500 leading-tight">
                        How many consecutive digits {isOver ? `≤ ${barrierVal} (under ${barrierVal}, e.g. ${barrierVal === 1 ? '0 or 1: 0,0, 1,1, 0,1, 1,0' : `0..${barrierVal}`})` : `≥ ${barrierVal} (over ${barrierVal}, e.g. ${barrierVal === 8 ? '8 or 9: 8,8, 9,9, 8,9, 9,8' : `${barrierVal}..9`})`} must occur first.
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#222428]/60">
                      <div className="flex items-center justify-between">
                        <label className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#00a79e]">
                          {consecTouchTouchType === 'any' ? "Any Digits to Touch" : touchLabel} (After Streak)
                        </label>
                        <span className="text-[9px] font-mono font-bold text-[#00a79e]">
                          {consecTouchTouchType === 'any'
                            ? `Touch ${consecTouchTargetDigits} Any Digit (0–9)`
                            : `Touch ${consecTouchTargetDigits} ${isOver ? `Over ${barrierVal} (> ${barrierVal})` : `Under ${barrierVal} (< ${barrierVal})`}`}
                        </span>
                      </div>

                      {/* Touch Filter Toggle: Target Direction vs Any Digit */}
                      <div className="grid grid-cols-2 gap-1.5 bg-[#0e0f11] p-1 rounded-lg border border-[#222428]">
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            setConsecTouchTouchType('target');
                            consecTouchTouchTypeRef.current = 'target';
                            localStorage.setItem('autobot_consec_touch_touch_type', 'target');
                          }}
                          className={cn(
                            "py-1.5 text-[9.5px] font-black uppercase rounded-md transition-all text-center cursor-pointer",
                            consecTouchTouchType === 'target'
                              ? "bg-[#00a79e] text-black font-black shadow-[0_0_8px_rgba(0,167,158,0.3)]"
                              : "text-slate-400 hover:text-white"
                          )}
                        >
                          {isOver ? `Over ${barrierVal} Digits` : `Under ${barrierVal} Digits`}
                        </button>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            setConsecTouchTouchType('any');
                            consecTouchTouchTypeRef.current = 'any';
                            localStorage.setItem('autobot_consec_touch_touch_type', 'any');
                          }}
                          className={cn(
                            "py-1.5 text-[9.5px] font-black uppercase rounded-md transition-all text-center cursor-pointer",
                            consecTouchTouchType === 'any'
                              ? "bg-[#00a79e] text-black font-black shadow-[0_0_8px_rgba(0,167,158,0.3)]"
                              : "text-slate-400 hover:text-white"
                          )}
                        >
                          Any Digit (0–9)
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={consecTouchTargetDigits}
                          disabled={isRunning}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setConsecTouchTargetDigits(val);
                            consecTouchTargetDigitsRef.current = val;
                            localStorage.setItem('autobot_consec_touch_target_digits', val.toString());
                          }}
                          className="w-20 bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                        />
                        <div className="grid grid-cols-5 gap-1 flex-1">
                          {[1, 2, 3, 4, 5].map((num) => (
                            <button
                              key={num}
                              type="button"
                              disabled={isRunning}
                              onClick={() => {
                                setConsecTouchTargetDigits(num);
                                consecTouchTargetDigitsRef.current = num;
                                localStorage.setItem('autobot_consec_touch_target_digits', num.toString());
                              }}
                              className={cn(
                                "py-1 text-[10px] font-mono font-bold rounded-md border transition-all text-center cursor-pointer",
                                consecTouchTargetDigits === num
                                  ? "bg-[#00a79e] border-[#00a79e] text-black font-black"
                                  : "bg-[#0e0f11] border-[#222428] text-slate-400 hover:border-slate-600 hover:text-white",
                                isRunning && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[8px] text-slate-500 leading-tight">
                        {consecTouchTouchType === 'any'
                          ? `After consecutive condition is met, execute the trade once any ${consecTouchTargetDigits} digit(s) (0–9) appear.`
                          : `After consecutive condition is met, wait until ${consecTouchTargetDigits} digit(s) ${isOver ? `> ${barrierVal} (over ${barrierVal})` : `< ${barrierVal} (under ${barrierVal})`} appear before trade executes.`}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {streakMode === 'analysis_tool' && (
            <div className="p-3.5 bg-[#121316] border border-purple-500/40 rounded-xl space-y-3 animate-slide-up">
              <div className="flex items-center justify-between border-b border-[#222428]/60 pb-2">
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-purple-400" />
                    Analysis Tool Live Signal Integration
                  </span>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    Trades are triggered directly by real-time analysis calculations from the Analysis page.
                  </p>
                </div>
                <span className="text-[9px] font-mono font-bold text-purple-300 bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 rounded">
                  {contractType === 'digitdiff' ? 'DIFFERS SIGNAL' : (contractType === 'over_under' || contractType === 'digitover' || contractType === 'digitunder' || contractType === 'dual_ou') ? 'OVER / UNDER SIGNAL' : contractType === 'accumulator' ? 'ACCUMULATOR SIGNAL' : 'MATCH SIGNAL'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px]">
                <div className="p-2.5 bg-[#0e0f11] border border-[#222428] rounded-lg space-y-1">
                  <span className="block font-bold text-slate-300 uppercase tracking-wider text-[8px]">
                    Contract Behavior
                  </span>
                  <p className="text-slate-400 leading-relaxed">
                    {contractType === 'digitdiff' && "Receives the highest-probability Differ digit directly from live market ticks and Differ Analysis engine calculations, entering immediately."}
                    {(contractType === 'over_under' || contractType === 'digitover' || contractType === 'digitunder' || contractType === 'dual_ou') && "Executes BUY OVER 1 or BUY UNDER 8 according to the live signal given by the Over/Under analysis engine (leveraging Deriv's ~90% win-rate edge)."}
                    {contractType === 'accumulator' && "Listens for low-volatility, high-sustainability market phases to safely accumulate ticks."}
                    {contractType === 'digitmatch' && "Targets the hottest repeating digit identified by the digit frequency matrix."}
                  </p>
                </div>

                {contractType === 'digitdiff' ? (
                  <div className="p-2.5 bg-[#0e0f11] border border-purple-500/30 rounded-lg space-y-1">
                    <span className="block font-bold text-purple-400 uppercase tracking-wider text-[8px] flex items-center gap-1">
                      <Zap size={10} className="text-purple-400" />
                      Direct Market & Signal Rule
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      Barrier & target rules are not used during Differs contracts. The bot differs the digit directly from live market feed and real-time Differ Analysis engine signals.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#0e0f11] border border-[#222428] rounded-lg space-y-1">
                    <span className="block font-bold text-slate-300 uppercase tracking-wider text-[8px]">
                      Barrier & Target Rule
                    </span>
                    <p className="text-slate-400 leading-relaxed">
                      {(contractType === 'over_under' || contractType === 'dual_ou')
                        ? (analysisOppositeSignalEnabled ? "Signals automatically set the target barrier (OPPOSITE MODE): buys OVER 1 on UNDER signal, or buys UNDER 8 on OVER signal." : "Signals automatically set the target barrier: buys OVER 1 on OVER signal, or buys UNDER 8 on UNDER signal.")
                        : contractType === 'digitover'
                        ? "Executes BUY OVER 1 upon confirmation of live Over analysis signal."
                        : contractType === 'digitunder'
                        ? "Executes BUY UNDER 8 upon confirmation of live Under analysis signal."
                        : `Selected target digit: ${targetDigit !== -1 ? targetDigit : 'Automatic via signal'}`
                      }
                    </p>
                    {(['over_under', 'dual_ou', 'digitover', 'digitunder'].includes(contractType)) && (
                      <div className="pt-2 border-t border-[#222428]/60 mt-2 flex items-center justify-between">
                        <div>
                          <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-300">
                            Opposite Signal Target
                          </span>
                          <span className="block text-[7.5px] text-slate-500 leading-tight">
                            When ON, inverses the trade (e.g. buys OVER 1 on UNDER signal).
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => setAnalysisOppositeSignalEnabled(!analysisOppositeSignalEnabled)}
                          className={cn(
                            "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
                            analysisOppositeSignalEnabled ? "bg-purple-500" : "bg-slate-700"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              analysisOppositeSignalEnabled ? "translate-x-1.5" : "-translate-x-1.5"
                            )}
                          />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        )}

        {/* MARKETS */}
        <div className="space-y-2 shrink-0 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Markets
            </label>
            <div className="flex gap-2">
              <button 
                onClick={handleSelectAll} 
                className="text-[10px] font-bold text-[#ff444f] hover:underline"
              >
                Select all
              </button>
              <span className="text-[10px] text-slate-600">/</span>
              <button 
                onClick={handleClearAll} 
                className="text-[10px] font-bold text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Continuous Trading After Signal Switch */}
          <div className="flex items-center justify-between bg-[#17181c] border border-[#222428] rounded-xl p-2.5 space-y-0 text-slate-300">
            <div className="space-y-0.5">
              <span className="block text-[10px] font-extrabold text-white uppercase tracking-wide">
                Continues trading after a signal
              </span>
              <span className="block text-[8px] text-slate-500 leading-tight">
                Continuously trade the triggered market until TP is hit (rest of markets will be ignored & blocked)
              </span>
            </div>
            <button
              type="button"
              id="continuous-trading-switch"
              onClick={() => {
                const newVal = !isContinuousTrading;
                setIsContinuousTrading(newVal);
                (window as any).AUTOBOT_CONTINUOUS_TRADING = newVal;
                if (newVal) {
                  setAlternateMarketRecovery(false);
                  localStorage.setItem('autobot_alternate_market_recovery', 'false');
                  (window as any).AUTOBOT_ALTERNATE_MARKET_RECOVERY = false;
                }
                if (isRunning) {
                  botEngine.getBotInterface().notify('info', `Continues trading after a signal turned ${newVal ? 'ON' : 'OFF'} live.`);
                }
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isContinuousTrading ? "bg-[#ff444f]" : "bg-[#222428]"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  isContinuousTrading ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Alternate Market Recovery Switch */}
          <div className="flex items-center justify-between bg-[#17181c] border border-[#222428] rounded-xl p-2.5 space-y-0 text-slate-300">
            <div className="space-y-0.5">
              <span className="block text-[10px] font-extrabold text-white uppercase tracking-wide">Alternate Market Recovery</span>
              <span className="block text-[8px] text-slate-500 leading-tight">
                Wait for a different market to recover after a loss
              </span>
            </div>
            <button
              type="button"
              id="alternate-market-recovery-switch"
              onClick={() => {
                const newVal = !alternateMarketRecovery;
                setAlternateMarketRecovery(newVal);
                localStorage.setItem('autobot_alternate_market_recovery', String(newVal));
                (window as any).AUTOBOT_ALTERNATE_MARKET_RECOVERY = newVal;
                if (newVal) {
                  setIsContinuousTrading(false);
                  localStorage.setItem('autobot_continuous_trading', 'false');
                  (window as any).AUTOBOT_CONTINUOUS_TRADING = false;
                }
                if (isRunning) {
                  botEngine.getBotInterface().notify('info', `Alternate Market Recovery turned ${newVal ? 'ON' : 'OFF'} live.`);
                }
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                alternateMarketRecovery ? "bg-[#ff444f]" : "bg-[#222428]"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  alternateMarketRecovery ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
          
          <div className="bg-[#0e0f11] border border-[#222428] rounded-xl p-3 h-[180px] overflow-y-auto custom-scrollbar shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-1 gap-x-2.5 gap-y-2">
              {displayedMarkets.map(market => (
                <div 
                  key={market.symbol}
                  onClick={() => !isRunning && toggleSelectMarket(market.symbol)}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] sm:text-xs font-bold cursor-pointer transition-colors py-0.5 px-0.5 truncate",
                    isRunning ? "opacity-50 cursor-not-allowed" : "hover:text-white text-slate-400"
                  )}
                  title={market.name}
                >
                  {visibleCheckedMarkets.includes(market.symbol) ? (
                    <CheckSquare size={13} className="text-[#ff444f] shrink-0" />
                  ) : (
                    <SquareIcon size={13} className="text-slate-600 shrink-0" />
                  )}
                  <span className="truncate">{market.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STAKE */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Stake ({rootStore.client.currency || 'USD'})
            </label>
            <div 
              onClick={() => !isRunning && setIsAutoStakeEnabled(!isAutoStakeEnabled)} 
              className={cn(
                "flex items-center gap-1 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors border",
                isAutoStakeEnabled 
                  ? "bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]" 
                  : "bg-[#16191e] border-[#222428] text-slate-500 hover:text-slate-300",
                isRunning && "opacity-50 cursor-not-allowed"
              )}
              title="Toggle Auto Stake based on exact account balance and Martingale ratio"
            >
              <span className="text-[9px] font-black tracking-wider uppercase">Auto Stake</span>
              <div className={cn(
                "w-5 h-3 rounded-full relative transition-colors flex items-center p-[1px]",
                isAutoStakeEnabled ? "bg-[#ff444f]" : "bg-slate-700"
              )}>
                <div className={cn(
                  "w-2.5 h-2.5 bg-white rounded-full transition-transform transform",
                  isAutoStakeEnabled ? "translate-x-2" : "translate-x-0"
                )} />
              </div>
            </div>
          </div>
          <input
            type="number"
            value={isAutoStakeEnabled ? autoStakeValue : (stake || '')}
            onChange={(e) => {
              if (!isAutoStakeEnabled) {
                setStake(Math.max(0.1, parseFloat(e.target.value) || 0));
              }
            }}
            disabled={isRunning || isAutoStakeEnabled}
            className={cn(
              "w-full bg-[#0e0f11] border text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none transition-all",
              isAutoStakeEnabled 
                ? "border-[#ff444f]/30 text-[#ff444f] cursor-not-allowed bg-[#ff444f]/5" 
                : "border-[#222428] text-white focus:border-[#ff444f]"
            )}
          />
        </div>

        {/* MARTINGALE */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Martingale x
          </label>
          <input
            type="number"
            value={martingale || ''}
            onChange={(e) => setMartingale(Math.max(1, parseFloat(e.target.value) || 0))}
            disabled={isRunning}
            className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] transition-all"
          />
        </div>

        {/* Virtual Loss Strategy Control */}
        <div className="bg-[#0b0c12] p-3 rounded-xl border border-[#22242f] space-y-1.5 focus-within:border-indigo-500/60 transition-all">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 font-bold text-slate-200">
              <ShieldAlert size={12} className="text-purple-400" />
              Virtual Loss Filter
            </span>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setUseVirtualLoss(!useVirtualLoss)}
              className={cn(
                "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
                useVirtualLoss ? "bg-purple-600" : "bg-zinc-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-0.5 ml-0.5",
                  useVirtualLoss ? "translate-x-3" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {useVirtualLoss && (
            <div className="space-y-2 pt-1">
              {/* Virtual Only After Real Loss Toggle */}
              <div className={cn(
                "p-2 rounded-lg border transition-all space-y-1",
                virtualAfterRealLoss ? "bg-amber-950/20 border-amber-500/40" : "bg-[#141622] border-[#232636]"
              )}>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <RotateCcw size={11} className="text-amber-400" />
                    Only After Real Loss
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border",
                      virtualAfterRealLoss ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {virtualAfterRealLoss ? "ON" : "OFF"}
                    </span>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setVirtualAfterRealLoss(!virtualAfterRealLoss)}
                      className={cn(
                        "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
                        virtualAfterRealLoss ? "bg-amber-500" : "bg-zinc-700"
                      )}
                      title="When ON: Starts in Real Mode. Switches to Virtual Mode only after a real loss occurs to filter out consecutive losses."
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out mt-0.5 ml-0.5",
                          virtualAfterRealLoss ? "translate-x-3" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>
                <p className="text-[8.5px] text-slate-400 font-sans leading-tight">
                  {virtualAfterRealLoss
                    ? "Bot trades in Real funds directly. When a real loss occurs, it switches to Virtual to filter out losses."
                    : "Bot always starts in Virtual Mode and requires virtual losses before every real trade."}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">Virtual Losses Required:</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  disabled={isRunning}
                  value={virtualLossThreshold}
                  onChange={(e) => setVirtualLossThreshold(Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 bg-[#12141f] border border-[#232636] rounded-lg px-2 py-1 text-xs font-mono text-purple-300 font-bold text-center focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] px-2 py-1.5 rounded-lg border border-emerald-500/25">
                  <span className="text-slate-400">Virtual Wins:</span>
                  <span className="font-bold text-emerald-400 text-[11px]">{virtualWinsCount}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] px-2 py-1.5 rounded-lg border border-rose-500/25">
                  <span className="text-slate-400">Virtual Losses:</span>
                  <span className="font-bold text-rose-400 text-[11px]">{virtualLossesCount}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] p-1.5 rounded-lg border border-[#232636]">
                <span className="text-slate-400">Virtual Wins / Losses:</span>
                <span className="font-bold">
                  <span className="text-emerald-400">{virtualWinsCount} W</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-rose-400">{virtualLossesCount} L</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] p-1.5 rounded-lg border border-[#232636]">
                <span className="text-slate-400">Current Loss Streak:</span>
                <span className="font-bold text-purple-400">
                  {consecutiveVirtualLosses} / {virtualLossThreshold}
                </span>
              </div>

              {lockedVirtualMarket && !isContinuousTrading && (
                <div className="flex items-center justify-between text-[9px] font-mono bg-purple-950/40 p-1.5 rounded-lg border border-purple-500/40 text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping inline-block" />
                    Maintaining Market:
                  </span>
                  <span className="font-bold text-amber-300 font-mono">
                    {lockedVirtualMarket}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] font-mono bg-[#141622] p-1.5 rounded-lg border border-[#232636]">
                <span className="text-slate-400">Next Trade Mode:</span>
                <span className={cn(
                  "font-bold uppercase",
                  (isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold) ? "text-amber-400" : "text-purple-400"
                )}>
                  {(isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold)
                    ? (isContinuousTrading ? "🔥 REAL (CONTINUOUS)" : (virtualAfterRealLoss && !isRunning ? "🔥 REAL (DIRECT)" : "🔥 REAL FUNDS"))
                    : "🧪 VIRTUAL SIM"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* TAKE PROFIT */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              {isRunsLimitEnabled ? 'No. of Runs (Wins)' : 'Take Profit'}
            </label>
            <div 
              onClick={() => !isRunning && setIsRunsLimitEnabled(!isRunsLimitEnabled)} 
              className={cn(
                "flex items-center gap-1 cursor-pointer select-none py-0.5 px-1.5 rounded-md transition-colors border",
                isRunsLimitEnabled 
                  ? "bg-[#ff444f]/10 border-[#ff444f]/30 text-[#ff444f]" 
                  : "bg-[#16191e] border-[#222428] text-slate-500 hover:text-slate-300",
                isRunning && "opacity-50 cursor-not-allowed"
              )}
              title="Stop bot after completing a specific number of winning trades"
            >
              <span className="text-[9px] font-black tracking-wider uppercase">No of Runs</span>
              <div className={cn(
                "w-5 h-3 rounded-full relative transition-colors flex items-center p-[1px]",
                isRunsLimitEnabled ? "bg-[#ff444f]" : "bg-slate-700"
              )}>
                <div className={cn(
                  "w-2.5 h-2.5 bg-white rounded-full transition-transform transform",
                  isRunsLimitEnabled ? "translate-x-2" : "translate-x-0"
                )} />
              </div>
            </div>
          </div>
          {isRunsLimitEnabled ? (
            <input
              type="number"
              min="1"
              max="10"
              step="1"
              value={runsLimit || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setRunsLimit(0);
                } else {
                  const parsed = parseInt(val, 10);
                  if (isNaN(parsed)) {
                    setRunsLimit(1);
                  } else {
                    const constrained = Math.min(10, Math.max(1, parsed));
                    setRunsLimit(constrained);
                  }
                }
              }}
              onBlur={() => {
                setRunsLimit(prev => Math.min(10, Math.max(1, prev || 5)));
              }}
              disabled={isRunning || runForever}
              className={cn(
                "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] transition-all",
                (isRunning || runForever) && "opacity-50 cursor-not-allowed"
              )}
            />
          ) : (
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={takeProfit || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setTakeProfit(0);
                } else {
                  setTakeProfit(parseFloat(val) || 0);
                }
              }}
              onBlur={() => {
                setTakeProfit(prev => Math.max(0.01, prev));
              }}
              disabled={isRunning || runForever}
              className={cn(
                "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] transition-all",
                (isRunning || runForever) && "opacity-50 cursor-not-allowed"
              )}
            />
          )}
        </div>

        {/* STOP LOSS */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
            Stop Loss
          </label>
          <input
            type="number"
            value={stopLoss || ''}
            onChange={(e) => setStopLoss(Math.max(1, parseFloat(e.target.value) || 0))}
            disabled={isRunning || runForever}
            className={cn(
              "w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none focus:border-[#ff444f] transition-all",
              (isRunning || runForever) && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>

        {/* RUN FOREVER */}
        <div className="flex items-center justify-between p-3 bg-[#0c0d0f] border border-[#1a1b1e] rounded-lg">
          <div className="space-y-0.5">
            <span className="block text-xs font-black text-white uppercase tracking-wider">Run Forever</span>
            <span className="block text-[9px] text-slate-500">Run 24/7 (bypass profit limits)</span>
          </div>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => setRunForever(!runForever)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              runForever ? "bg-[#ff444f]" : "bg-[#222428]",
              isRunning && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                runForever ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* AUTO RESET & START AFTER TAKE PROFIT */}
        <div className={cn(
          "p-3.5 rounded-xl border flex flex-col gap-3 transition-all",
          autoRestartAfterTp ? "border-emerald-500/40 bg-emerald-950/20 shadow-lg shadow-emerald-500/5" : "bg-[#0c0d0f] border-[#1a1b1e]"
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => {
                  if (!isRunning && activeSessionProfit !== 0) {
                    cumulativeSessionProfitRef.current = 0;
                    setCumulativeSessionProfit(0);
                    setSessionProfit(0);
                    sessionStorage.removeItem('autobot_cumulativeSessionProfit');
                    botEngine.getBotInterface().notify('info', 'Auto Start session profit counter reset to $0.00.');
                  }
                }}
                className={cn(
                  "w-8.5 h-8.5 rounded-lg flex items-center justify-center border shrink-0 transition-all",
                  autoRestartAfterTp ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-[#141622] border-[#292c3d] text-slate-400",
                  !isRunning && activeSessionProfit !== 0 ? "cursor-pointer hover:border-emerald-400 hover:text-white" : ""
                )}
                title={!isRunning && activeSessionProfit !== 0 ? "Click to reset session profit counter" : undefined}
              >
                <RotateCcw size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-white">Auto Reset & Start After Take Profit</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase",
                    autoRestartAfterTp ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-slate-800 text-slate-400"
                  )}>
                    {autoRestartAfterTp ? 'ENABLED' : 'OFF'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  When Take Profit is hit, automatically click reset (<RotateCcw size={10} className="inline text-slate-300" />) & auto-restart until the Auto Start Overall Take Profit Limit is reached
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setAutoRestartAfterTp(!autoRestartAfterTp)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50",
                autoRestartAfterTp ? "bg-emerald-500" : "bg-zinc-700"
              )}
              title="Auto reset stats and auto start bot when Take Profit is hit"
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5",
                  autoRestartAfterTp ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* Dedicated Auto Start Take Profit Input */}
          <div className="pt-2 border-t border-[#1f212f] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                <Target size={13} className="text-emerald-400" />
                <span>Auto Start Overall Take Profit Limit ($ USD):</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[10px] font-mono font-semibold",
                  activeSessionProfit > 0 ? "text-emerald-300" :
                  activeSessionProfit < 0 ? "text-rose-400" :
                  "text-slate-300"
                )}>
                  Current Session: {activeSessionProfit >= 0 ? `+$${activeSessionProfit.toFixed(2)}` : `-$${Math.abs(activeSessionProfit).toFixed(2)}`} / ${autoRestartMaxTp.toFixed(2)} USD
                </span>
                {activeSessionProfit !== 0 && !isRunning && (
                  <button
                    type="button"
                    onClick={() => {
                      cumulativeSessionProfitRef.current = 0;
                      setCumulativeSessionProfit(0);
                      setSessionProfit(0);
                      sessionStorage.removeItem('autobot_cumulativeSessionProfit');
                    }}
                    title="Reset current session profit to $0.00"
                    className="text-[9px] font-mono text-slate-500 hover:text-slate-300 underline cursor-pointer transition-colors"
                  >
                    (Reset)
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono font-bold">$</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  disabled={isRunning}
                  value={autoRestartMaxTp}
                  onChange={(e) => setAutoRestartMaxTp(Math.max(1, parseFloat(e.target.value) || 50.0))}
                  className="w-full pl-6 pr-3 py-1.5 bg-[#12141f] border border-[#232638] rounded-lg text-xs font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500/60 disabled:opacity-50"
                  placeholder="50.00"
                />
              </div>

              <div className="flex items-center gap-1">
                {[20, 50, 100, 200].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setAutoRestartMaxTp(preset)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all disabled:opacity-50 cursor-pointer",
                      autoRestartMaxTp === preset
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold"
                        : "bg-[#141622] border-[#292c3d] text-slate-400 hover:text-white"
                    )}
                  >
                    +${preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>When total session profit hits +${autoRestartMaxTp.toFixed(2)} USD, the Auto Start switch turns OFF automatically and the bot stops.</span>
            </div>
          </div>
        </div>

        {/* CIRCLES MODE CONFIG */}
        <div className="p-3 bg-[#0c0d0f] border border-[#1a1b1e] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="block text-xs font-black text-white uppercase tracking-wider">Circles Mode</span>
              <span className="block text-[9px] text-slate-500">Show small circular digit stats</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextVal = !isCirclesMode;
                setIsCirclesMode(nextVal);
                if (nextVal) {
                  if (!streakMode.startsWith('circle_')) {
                    const isOu = contractType === 'over_under' || contractType === 'digitover' || contractType === 'digitunder' || contractType === 'dual_ou';
                    setStreakMode(isOu ? 'circle_over_under' : 'circle_green');
                  }
                } else {
                  if (streakMode.startsWith('circle_')) {
                    setStreakMode('consecutive');
                  }
                }
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isCirclesMode ? "bg-[#00a79e]" : "bg-[#222428]"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  isCirclesMode ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
          
          {isCirclesMode && (
            <div className="space-y-3.5 pt-1 border-t border-[#1d1f23] animate-fade-in">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                  History Ticks Window
                </label>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  value={circlesTicksLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCirclesTicksLimit(isNaN(val) ? 1000 : val);
                  }}
                  className="w-full bg-[#0e0f11] border border-[#222428] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-[#00a79e] transition-all"
                  placeholder="Default: 1000"
                />
                <span className="block text-[8px] text-slate-500 leading-tight">
                  Percentage based on last N ticks. Max 2000.
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#1d1f23]/50">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Digit Touch Entry</span>
                  <span className="block text-[8px] text-slate-500 leading-tight">Wait until the actual digit touches the selected circle before trade</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      circleEntryModeEnabled ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* REAL-TIME SCHEDULED ALARMS CARD */}
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
          notify={(type, msg) => botEngine.getBotInterface().notify(type as any, msg)}
        />

        {/* START / STOP BUTTON */}
        <div className="pt-2 space-y-2">
          {isRunning ? (
            <button
              onClick={stopBot}
              className="w-full py-3.5 bg-[#ff444f] hover:bg-[#e03d46] text-white rounded-xl text-sm uppercase tracking-wider font-extrabold shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Square size={16} fill="currentColor" />
              Stop
            </button>
          ) : (
            <button
              onClick={startBot}
              disabled={isConnectingGlobal}
              className={cn(
                "w-full py-3.5 bg-[#00a79e] hover:bg-[#00968f] text-white rounded-xl text-sm uppercase tracking-wider font-extrabold shadow-lg shadow-[#00a79e]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                isConnectingGlobal && "opacity-50 cursor-not-allowed"
              )}
            >
              <Play size={16} fill="currentColor" />
              Run
            </button>
          )}

          <button
            onClick={resetBot}
            className="w-full py-2.5 bg-[#0e0f11] hover:bg-[#1a1c20] text-slate-400 hover:text-white border border-[#222428] hover:border-slate-500 rounded-xl text-xs uppercase tracking-wider font-black transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} />
            Reset & Clear
          </button>
        </div>
        
        </div>
      </div>

      {/* Main Grid View to list Ticks, Streak Cards, and Scanner Panels */}
      <div className="flex-1 flex flex-col min-h-0 overflow-visible md:overflow-y-auto md:h-full p-4 md:p-6 space-y-6 custom-scrollbar bg-[#08090a]">
        
        {/* Real-time Bot Stats Header */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-[#111214] border border-[#222428] p-4 rounded-2xl shrink-0">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Session Profit</span>
            <div className={cn(
              "text-lg md:text-xl font-black font-mono",
              sessionProfit > 0 ? "text-[#00a79e]" : sessionProfit < 0 ? "text-rose-400" : "text-white"
            )}>
              {sessionProfit >= 0 ? '+' : ''}{sessionProfit.toFixed(2)} {rootStore.client.currency || 'USD'}
            </div>
          </div>
          <div className="space-y-1 border-l border-[#222428] pl-4">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Real Wins / Losses</span>
            <div className="text-lg md:text-xl font-black font-mono text-white flex items-center gap-1.5">
              <span className="text-[#00a79e]">{winsCount}</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">{lossesCount}</span>
            </div>
          </div>
          <div className="space-y-1 border-l border-[#222428] pl-4">
            <span className="text-[10px] uppercase font-black tracking-wider text-purple-400 flex items-center gap-1">
              Virtual Wins / Losses
            </span>
            <div className="text-lg md:text-xl font-black font-mono text-white flex items-center gap-1.5">
              <span className="text-emerald-400">{virtualWinsCount}</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">{virtualLossesCount}</span>
              {useVirtualLoss && (
                <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                  Streak: {consecutiveVirtualLosses}/{virtualLossThreshold}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1 border-l border-[#222428] pl-4">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Active Stake</span>
            <div className="text-lg md:text-xl font-black font-mono text-indigo-400">
              {currentStake.toFixed(2)}
            </div>
          </div>
          <div className="space-y-1 border-l border-[#222428] pl-4 col-span-2 md:col-span-1">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Engine Status</span>
            <div className={cn(
              "text-xs md:text-sm font-black uppercase tracking-widest mt-1 flex flex-wrap items-center gap-2",
              isRunning ? "text-[#00a79e] animate-pulse" : "text-slate-500"
            )}>
              <span>{isRunning ? "● AI Engine Live" : "○ Standing By"}</span>
              {useVirtualLoss && (
                <span className={cn(
                  "text-[9px] font-mono px-1.5 py-0.5 rounded font-bold normal-case tracking-normal border",
                  (isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold)
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-purple-500/15 text-purple-300 border-purple-500/30"
                )}>
                  {(isCurrentTradeReal || consecutiveVirtualLosses >= virtualLossThreshold)
                    ? (virtualAfterRealLoss && consecutiveVirtualLosses === 0 && lossesCount === 0 ? "🔥 Real (Direct)" : "🔥 Real Armed")
                    : `🧪 Virtual (${consecutiveVirtualLosses}/${virtualLossThreshold})`}
                </span>
              )}
              {isAlarmSchedulerEnabled && alarms.filter(a => a.enabled).length > 0 && (
                <span className="text-[9px] font-mono bg-[#ff444f]/10 text-[#ff444f] border border-[#ff444f]/25 px-1.5 py-0.5 rounded font-bold normal-case tracking-normal">
                  ⏰ {alarms.filter(a => a.enabled).length} Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Markets Header & Circles Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111214] border border-[#222428] px-4 py-3 rounded-xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">Active Market Matrices</span>
            <span className="text-[10px] bg-[#ff444f]/10 text-[#ff444f] border border-[#ff444f]/20 px-1.5 py-0.5 rounded-md font-bold">
              {visibleCheckedMarkets.length} Selected
            </span>
          </div>

          <div className="flex items-center gap-4 self-end sm:self-auto">
            {/* Circles Mode Switch */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Circles Mode</span>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !isCirclesMode;
                  setIsCirclesMode(nextVal);
                  if (nextVal) {
                    if (!streakMode.startsWith('circle_')) {
                      const isOu = contractType === 'over_under' || contractType === 'digitover' || contractType === 'digitunder' || contractType === 'dual_ou';
                      setStreakMode(isOu ? 'circle_over_under' : 'circle_green');
                    }
                  } else {
                    if (streakMode.startsWith('circle_')) {
                      setStreakMode('consecutive');
                    }
                  }
                }}
                className={cn(
                  "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isCirclesMode ? "bg-[#00a79e]" : "bg-[#222428]"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isCirclesMode ? "translate-x-3" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Percentage History Ticks Input */}
            {isCirclesMode && (
              <>
                <div className="flex items-center gap-2 border-l border-[#222428] pl-4 animate-fade-in">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">History Ticks</span>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    value={circlesTicksLimit}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setCirclesTicksLimit(isNaN(val) ? 1000 : val);
                    }}
                    className="w-16 bg-[#0e0f11] border border-[#222428] text-white text-[10px] font-mono font-bold rounded-md px-2 py-1 outline-none focus:border-[#00a79e] transition-all text-center"
                  />
                </div>

                <div className="flex items-center gap-2 border-l border-[#222428] pl-4 animate-fade-in">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Digit Touch</span>
                  <button
                    type="button"
                    onClick={() => setCircleEntryModeEnabled(!circleEntryModeEnabled)}
                    className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      circleEntryModeEnabled ? "bg-[#00a79e]" : "bg-[#222428]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        circleEntryModeEnabled ? "translate-x-3" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Analysis Tool Signal Bridge Live Panel - Hidden per user request */}
        {/* <AutoBotAnalysisSignalsPanel
          contractType={contractType}
          targetDigit={targetDigit}
          activeSymbol={selectedRngMarket || visibleCheckedMarkets[0] || '1HZ10V'}
          digits={marketTicks[selectedRngMarket || visibleCheckedMarkets[0] || '1HZ10V']?.digits || []}
          quotes={priceHistories[selectedRngMarket || visibleCheckedMarkets[0] || '1HZ10V'] || []}
          streakMode={streakMode}
          onSetStreakMode={(mode) => setStreakMode(mode as any)}
          isRunning={isRunning}
        /> */}

        {/* Checked Market Streak Cards Grid */}
        <div className={cn(
          "grid gap-2.5 md:gap-3 shrink-0",
          isCirclesMode
            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        )}>
          {visibleCheckedMarkets.map(symbol => {
            const config = MARKET_CONFIGS.find(m => m.symbol === symbol)!;
            const data = marketTicks[symbol] || { price: 0, lastDigit: 0, digits: [], streak: 0 };
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
                lockedVirtualMarket={lockedVirtualMarket}
              />
            );
          })}
        </div>
           
        {/* Logs discovery ledger panel */}
        <div className="bg-[#111214] border border-[#222428] rounded-2xl p-4 flex flex-col space-y-3 min-h-[160px] max-h-[220px] shrink-0">
          <h4 className="text-slate-200 font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 border-b border-[#222428] pb-2">
            <Activity size={15} className="text-[#00a79e]" /> AI DISCOVERY LOG & TELEMETRY
          </h4>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar font-mono text-[10px] text-slate-400">
            {otivoLog.length > 0 ? (
              otivoLog.map((log, i) => (
                <div key={i} className="pb-1 border-b border-white/5">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-[#00a79e]/50 italic animate-pulse">Initializing neural pattern scanner array...</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
});

// --- Accumulator Technical Indicators Helpers ---
function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  if (prices.length < period) return new Array(prices.length).fill(prices[prices.length - 1]);
  const ema: number[] = [];
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let currentEma = sum / period;
  ema.push(currentEma);
  for (let i = period; i < prices.length; i++) {
    currentEma = (prices[i] - currentEma) * k + currentEma;
    ema.push(currentEma);
  }
  const padding = new Array(prices.length - ema.length).fill(prices[0] || 0);
  return padding.concat(ema);
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[prices.length - 1 - period + i] - prices[prices.length - 1 - period + i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2) {
  if (prices.length === 0) return { middle: 0, upper: 0, lower: 0, stdDev: 0 };
  if (prices.length < period) {
    const val = prices[prices.length - 1] || 0;
    return { middle: val, upper: val, lower: val, stdDev: 0 };
  }
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    middle,
    upper: middle + multiplier * stdDev,
    lower: middle - multiplier * stdDev,
    stdDev
  };
}

function calculateATR(prices: number[], period: number = 14): { current: number, average: number } {
  if (prices.length < period + 1) return { current: 0, average: 0 };
  const trs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    trs.push(Math.abs(prices[i] - prices[i - 1]));
  }
  const current = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  const average = trs.slice(-period * 2).reduce((a, b) => a + b, 0) / Math.max(1, trs.slice(-period * 2).length);
  return { current, average };
}

function calculateADX(prices: number[], period: number = 14): { adx: number, plusDI: number, minusDI: number } {
  if (prices.length < period + 2) return { adx: 15, plusDI: 20, minusDI: 20 };
  let trSum = 0;
  let plusDMSum = 0;
  let minusDMSum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const tr = Math.abs(prices[i] - prices[i-1]);
    const diff = prices[i] - prices[i-1];
    const plusDM = diff > 0 ? diff : 0;
    const minusDM = diff < 0 ? -diff : 0;
    trSum += tr;
    plusDMSum += plusDM;
    minusDMSum += minusDM;
  }
  if (trSum === 0) trSum = 0.00001;
  const plusDI = (plusDMSum / trSum) * 100;
  const minusDI = (minusDMSum / trSum) * 100;
  const diDiff = Math.abs(plusDI - minusDI);
  const diSum = plusDI + minusDI === 0 ? 0.00001 : plusDI + minusDI;
  const dx = (diDiff / diSum) * 100;
  return { adx: dx, plusDI, minusDI };
}

function calculateTickStats(prices: number[], windowSize: number = 20) {
  if (prices.length === 0) return { speed: 0, acceleration: 0, stdDev: 0, avgStdDev: 0 };
  const size = Math.min(windowSize, prices.length);
  const slice = prices.slice(-size);
  const mean = slice.reduce((a, b) => a + b, 0) / size;
  const stdDev = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / size);
  
  const longerSize = Math.min(windowSize * 3, prices.length);
  const longerSlice = prices.slice(-longerSize);
  let sumStd = 0;
  let countStd = 0;
  for (let i = size; i <= longerSlice.length; i += 5) {
    const sub = longerSlice.slice(i - size, i);
    if (sub.length === size) {
      const m = sub.reduce((a, b) => a + b, 0) / size;
      const s = Math.sqrt(sub.reduce((a, b) => a + Math.pow(b - m, 2), 0) / size);
      sumStd += s;
      countStd++;
    }
  }
  const avgStdDev = countStd > 0 ? sumStd / countStd : stdDev;

  const diffs: number[] = [];
  for (let i = prices.length - size; i < prices.length; i++) {
    diffs.push(Math.abs(prices[i] - (prices[i-1] || prices[i])));
  }
  const speed = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;

  const accels: number[] = [];
  for (let i = 1; i < diffs.length; i++) {
    accels.push(Math.abs(diffs[i] - diffs[i-1]));
  }
  const acceleration = accels.length > 0 ? accels.reduce((a, b) => a + b, 0) / accels.length : 0;

  return { speed, acceleration, stdDev, avgStdDev };
}

function calculateDonchian(prices: number[], period: number = 20) {
  if (prices.length === 0) return { upper: 0, lower: 0, center: 0 };
  const size = Math.min(period, prices.length);
  const slice = prices.slice(-size);
  const upper = Math.max(...slice);
  const lower = Math.min(...slice);
  const center = (upper + lower) / 2;
  return { upper, lower, center };
}

function calculateKeltner(prices: number[], period: number = 20) {
  const ema = calculateEMA(prices, period);
  const currentEma = ema[ema.length - 1] || 0;
  const atrData = calculateATR(prices, period);
  const bandMultiplier = 1.5;
  return {
    center: currentEma,
    upper: currentEma + bandMultiplier * atrData.current,
    lower: currentEma - bandMultiplier * atrData.current,
    width: atrData.current * 2
  };
}

function calculateAIVolatilityProbability(prices: number[]): number {
  if (prices.length < 20) return 90;
  const recent = prices.slice(-15);
  const older = prices.slice(-50);
  const recMean = recent.reduce((a, b) => a + b, 0) / 15;
  const oldMean = older.reduce((a, b) => a + b, 0) / Math.max(1, older.length);
  const recStd = Math.sqrt(recent.reduce((a, b) => a + Math.pow(b - recMean, 2), 0) / 15);
  const oldStd = Math.sqrt(older.reduce((a, b) => a + Math.pow(b - oldMean, 2), 0) / Math.max(1, older.length));
  if (oldStd === 0) return 95;
  const ratio = recStd / oldStd;
  if (ratio < 0.8) return 92;
  if (ratio < 1.2) return 85;
  return Math.max(30, Math.min(75, 100 - (ratio * 20)));
}
