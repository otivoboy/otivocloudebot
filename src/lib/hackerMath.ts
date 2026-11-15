export class IngestionBuffer {
  private buffer: number[] = [];
  private capacity: number;

  constructor(capacity = 1000) {
    this.capacity = capacity;
  }

  push(digit: number) {
    if (digit >= 0 && digit <= 9) {
      this.buffer.push(digit);
      if (this.buffer.length > this.capacity) {
        this.buffer.shift();
      }
    }
  }

  getWindow(length: number): number[] | null {
    if (this.buffer.length < length) return null;
    return this.buffer.slice(-length);
  }

  getAll(): number[] {
    return [...this.buffer];
  }
}

export class MathReconstructionSolver {
  transitionMatrix: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  isDeterministic = false;
  lcgParams: [number, number] | null = null;

  fit(data: number[]) {
    if (data.length < 10) return;

    const matrix: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const nextVal = data[i + 1];
      if (current >= 0 && current <= 9 && nextVal >= 0 && nextVal <= 9) {
        matrix[current][nextVal]++;
      }
    }

    for (let r = 0; r < 10; r++) {
      const rowSum = matrix[r].reduce((a, b) => a + b, 0);
      const denominator = rowSum === 0 ? 1 : rowSum;
      for (let c = 0; c < 10; c++) {
        this.transitionMatrix[r][c] = matrix[r][c] / denominator;
      }
    }

    this.solveLinearModulo(data);
  }

  private solveLinearModulo(data: number[]) {
    if (data.length < 4) return;
    const testLen = Math.min(data.length, 30);
    const recent = data.slice(-testLen);

    for (let a = 0; a < 10; a++) {
      for (let c = 0; c < 10; c++) {
        let match = true;
        for (let i = 0; i < recent.length - 1; i++) {
          if ((a * recent[i] + c) % 10 !== recent[i + 1]) {
            match = false;
            break;
          }
        }
        if (match) {
          this.isDeterministic = true;
          this.lcgParams = [a, c];
          return;
        }
      }
    }
    this.isDeterministic = false;
    this.lcgParams = null;
  }
}

export interface ShadowPrediction {
  topPrediction: number;
  confidence: number;
  probabilities: number[];
  top3Predictions: number[];
  isDeterministic: boolean;
  lcgParams: [number, number] | null;
}

export class ShadowGenerator {
  private solver: MathReconstructionSolver;

  constructor(solver: MathReconstructionSolver) {
    this.solver = solver;
  }

  predictNext(currentDigit: number): ShadowPrediction {
    if (this.solver.isDeterministic && this.solver.lcgParams) {
      const [a, c] = this.solver.lcgParams;
      const predictedExact = (a * currentDigit + c) % 10;
      const probs = Array(10).fill(0);
      probs[predictedExact] = 1.0;
      return {
        topPrediction: predictedExact,
        confidence: 1.0,
        probabilities: probs,
        top3Predictions: [predictedExact],
        isDeterministic: true,
        lcgParams: this.solver.lcgParams,
      };
    }

    const validCurrent = currentDigit >= 0 && currentDigit <= 9 ? currentDigit : 0;
    const probabilities = [...this.solver.transitionMatrix[validCurrent]];
    let topDigit = 0;
    let maxProb = -1;
    for (let d = 0; d < 10; d++) {
      if (probabilities[d] > maxProb) {
        maxProb = probabilities[d];
        topDigit = d;
      }
    }

    const indexedProbs = probabilities.map((p, idx) => ({ p, idx }));
    indexedProbs.sort((a, b) => b.p - a.p);
    const top3Predictions = indexedProbs.slice(0, 3).map((item) => item.idx);

    return {
      topPrediction: topDigit,
      confidence: maxProb,
      probabilities,
      top3Predictions,
      isDeterministic: false,
      lcgParams: null,
    };
  }
}

export interface EvaluationReport {
  totalEvaluated: number;
  exactMatchAccuracyPct: number;
  top3MatchAccuracyPct: number;
  meanAbsoluteError: number;
}

export class AccuracyEvaluator {
  totalEvaluations = 0;
  exactHits = 0;
  top3Hits = 0;
  absoluteErrors: number[] = [];

  evaluate(actualDigit: number, predictionData: ShadowPrediction) {
    this.totalEvaluations++;
    const predictedDigit = predictionData.topPrediction;

    if (actualDigit === predictedDigit) {
      this.exactHits++;
    }
    if (predictionData.top3Predictions.includes(actualDigit)) {
      this.top3Hits++;
    }

    this.absoluteErrors.push(Math.abs(actualDigit - predictedDigit));
    if (this.absoluteErrors.length > 500) {
      this.absoluteErrors.shift();
    }
  }

  getReport(): EvaluationReport {
    if (this.totalEvaluations === 0) {
      return {
        totalEvaluated: 0,
        exactMatchAccuracyPct: 0,
        top3MatchAccuracyPct: 0,
        meanAbsoluteError: 0,
      };
    }

    const sumErr = this.absoluteErrors.reduce((a, b) => a + b, 0);
    return {
      totalEvaluated: this.totalEvaluations,
      exactMatchAccuracyPct: (this.exactHits / this.totalEvaluations) * 100,
      top3MatchAccuracyPct: (this.top3Hits / this.totalEvaluations) * 100,
      meanAbsoluteError: sumErr / this.absoluteErrors.length,
    };
  }
}

export interface HackerMathSummary {
  symbol: string;
  isDeterministic: boolean;
  lcgParams: [number, number] | null;
  topPrediction: number;
  confidence: number;
  top3Predictions: number[];
  probabilities: number[];
  totalEvaluated: number;
  exactAccuracyPct: number;
  top3AccuracyPct: number;
  mae: number;
}
