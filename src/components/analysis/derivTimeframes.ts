import { CandleData, DerivTimeframe, TimeframeSignal } from './types';

export const DERIV_TIMEFRAME_CONFIG: Record<
  DerivTimeframe,
  { label: string; granularity: number }
> = {
  '1t': { label: '1 Tick', granularity: 0 },
  '1m': { label: '1 Min', granularity: 60 },
  '3m': { label: '3 Min', granularity: 180 },
  '5m': { label: '5 Min', granularity: 300 },
  '15m': { label: '15 Min', granularity: 900 },
  '30m': { label: '30 Min', granularity: 1800 },
  '1h': { label: '1 Hour', granularity: 3600 },
  '5h': { label: '5 Hour', granularity: 18000 },
  '1d': { label: '1 Day', granularity: 86400 },
};

function computeEma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  const start = closes.length - period;
  for (let i = start; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return gains === 0 ? 50 : 95;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function evaluateTimeframeSignal(
  tf: DerivTimeframe,
  label: string,
  candles: CandleData[]
): TimeframeSignal {
  if (!candles || candles.length < 5) {
    return {
      tf,
      label,
      direction: 'NEUTRAL',
      strength: 50,
      rsi: 50,
      emaFast: 0,
      emaSlow: 0,
      lastClose: candles?.[candles.length - 1]?.close ?? 0,
    };
  }

  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1];
  const emaFast = computeEma(closes.slice(-30), 9);
  const emaSlow = computeEma(closes, 21);
  const rsi = computeRsi(closes, 14);

  const recent3Up =
    closes.length >= 4 &&
    closes[closes.length - 1] > closes[closes.length - 2] &&
    closes[closes.length - 2] >= closes[closes.length - 3];
  const recent3Down =
    closes.length >= 4 &&
    closes[closes.length - 1] < closes[closes.length - 2] &&
    closes[closes.length - 2] <= closes[closes.length - 3];

  let score = 0;
  if (emaFast > emaSlow) score += 1;
  else if (emaFast < emaSlow) score -= 1;

  if (lastClose > emaFast) score += 1;
  else if (lastClose < emaFast) score -= 1;

  if (rsi >= 55) score += 1;
  else if (rsi <= 45) score -= 1;

  if (recent3Up) score += 1;
  else if (recent3Down) score -= 1;

  const direction: 'RISE' | 'FALL' | 'NEUTRAL' =
    score >= 2 ? 'RISE' : score <= -2 ? 'FALL' : 'NEUTRAL';

  const strength = Math.min(96, Math.max(50, 52 + Math.abs(score) * 11));

  return {
    tf,
    label,
    direction,
    strength,
    rsi: Number(rsi.toFixed(1)),
    emaFast,
    emaSlow,
    lastClose,
  };
}
