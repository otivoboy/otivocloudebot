export interface AISignalsSummary {
  market_state: string;
  confidence: number;
  rise_fall: 'CALL' | 'PUT' | 'HOLD';
  accumulator: 'ENTER' | 'WAIT';
  volatility_pct: number;
  rsi: number;
}

export class AITickIndicator {
  private prices: number[] = [];
  private readonly maxLen: number;

  constructor(maxLen = 300) {
    this.maxLen = maxLen;
  }

  update_tick(price: number): void {
    if (!Number.isFinite(price)) return;
    this.prices.push(price);
    if (this.prices.length > this.maxLen) {
      this.prices.shift();
    }
  }

  reset(): void {
    this.prices = [];
  }

  private ema(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const k = 2 / (period + 1);
    let val = data[0];
    for (let i = 1; i < data.length; i++) {
      val = data[i] * k + val * (1 - k);
    }
    return val;
  }

  private computeRsi(data: number[], period = 14): number {
    if (data.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    const start = data.length - period;
    for (let i = start; i < data.length; i++) {
      const diff = data[i] - data[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    if (losses === 0) return gains === 0 ? 50 : 95;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  generate_signals(): AISignalsSummary {
    if (this.prices.length < 15) {
      return {
        market_state: 'Warming Up',
        confidence: 0,
        rise_fall: 'HOLD',
        accumulator: 'WAIT',
        volatility_pct: 0,
        rsi: 50,
      };
    }

    const recent = this.prices.slice(-60);
    const last = recent[recent.length - 1];
    const emaFast = this.ema(recent.slice(-20), 7);
    const emaSlow = this.ema(recent, 21);
    const rsi = this.computeRsi(recent, 14);

    let sumAbsDiff = 0;
    const diffs: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      const d = Math.abs(recent[i] - recent[i - 1]);
      sumAbsDiff += d;
      diffs.push(d);
    }
    const avgStep = diffs.length > 0 ? sumAbsDiff / diffs.length : 0;
    const last5Step =
      diffs.length >= 5
        ? diffs.slice(-5).reduce((a, b) => a + b, 0) / 5
        : avgStep;
    const normVol = last > 0 ? (avgStep / last) * 10000 : 0;
    const spikeRatio = avgStep > 0 ? last5Step / avgStep : 1;

    const emaSpreadPct = emaSlow > 0 ? ((emaFast - emaSlow) / emaSlow) * 100 : 0;

    let rise_fall: 'CALL' | 'PUT' | 'HOLD' = 'HOLD';
    if (emaFast > emaSlow && rsi >= 54 && emaSpreadPct > 0.002) {
      rise_fall = 'CALL';
    } else if (emaFast < emaSlow && rsi <= 46 && emaSpreadPct < -0.002) {
      rise_fall = 'PUT';
    }

    const isLowChop = spikeRatio <= 1.15 && Math.abs(rsi - 50) <= 14;
    const accumulator: 'ENTER' | 'WAIT' = isLowChop ? 'ENTER' : 'WAIT';

    let market_state = 'Ranging / Balanced';
    if (spikeRatio > 1.45) {
      market_state = 'High Volatility Spike';
    } else if (rise_fall === 'CALL') {
      market_state = 'Bullish Expansion';
    } else if (rise_fall === 'PUT') {
      market_state = 'Bearish Expansion';
    } else if (isLowChop) {
      market_state = 'Calm Range (ACCU Ideal)';
    }

    const rawConf =
      rise_fall !== 'HOLD'
        ? Math.min(96, 55 + Math.abs(rsi - 50) * 1.1 + Math.min(20, Math.abs(emaSpreadPct) * 800))
        : isLowChop
        ? Math.min(92, 62 + (1.2 - spikeRatio) * 35)
        : 44;

    return {
      market_state,
      confidence: Math.round(rawConf),
      rise_fall,
      accumulator,
      volatility_pct: Number(normVol.toFixed(2)),
      rsi: Number(rsi.toFixed(1)),
    };
  }
}
