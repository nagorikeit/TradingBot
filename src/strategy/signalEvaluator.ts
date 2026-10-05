import { Candle, Signal, SignalResult } from '../types';

/**
 * Checks all pending signals and resolves them if expiry has passed
 */
export function evaluatePendingSignals(signals: Signal[], candles: Candle[]): { updatedSignals: Signal[]; resolvedCount: number } {
  if (!signals.length || !candles.length) {
    return { updatedSignals: signals, resolvedCount: 0 };
  }

  let resolvedCount = 0;
  const candleMap = new Map<number, Candle>();
  candles.forEach((c) => candleMap.set(c.timestamp, c));

  const updatedSignals = signals.map((sig) => {
    // If not pending or is a WAIT signal, no resolution needed
    if (sig.result !== 'PENDING' || sig.direction === 'WAIT') {
      return sig;
    }

    // Find if we have a candle at or past expiryTime
    const expiryCandle = candles.find((c) => c.timestamp >= sig.expiryTime);
    if (!expiryCandle) {
      return sig; // Still pending
    }

    const exitPrice = expiryCandle.close;
    let result: SignalResult = 'DRAW';

    if (sig.direction === 'CALL') {
      if (exitPrice > sig.entryPrice) {
        result = 'WIN';
      } else if (exitPrice < sig.entryPrice) {
        result = 'LOSS';
      } else {
        result = 'DRAW';
      }
    } else if (sig.direction === 'PUT') {
      if (exitPrice < sig.entryPrice) {
        result = 'WIN';
      } else if (exitPrice > sig.entryPrice) {
        result = 'LOSS';
      } else {
        result = 'DRAW';
      }
    }

    resolvedCount++;
    return {
      ...sig,
      result,
      exitPrice,
      evaluatedAt: Date.now(),
    };
  });

  return { updatedSignals, resolvedCount };
}

export interface SignalStatistics {
  total: number;
  resolved: number;
  pending: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0 to 100
}

export function computeSignalStatistics(signals: Signal[]): SignalStatistics {
  // Only evaluate actionable CALL/PUT signals
  const actionable = signals.filter((s) => s.direction === 'CALL' || s.direction === 'PUT');
  const wins = actionable.filter((s) => s.result === 'WIN').length;
  const losses = actionable.filter((s) => s.result === 'LOSS').length;
  const draws = actionable.filter((s) => s.result === 'DRAW').length;
  const pending = actionable.filter((s) => s.result === 'PENDING').length;
  const resolved = wins + losses + draws;

  const winRate = resolved > 0 ? Number(((wins / (wins + losses || 1)) * 100).toFixed(1)) : 0;

  return {
    total: actionable.length,
    resolved,
    pending,
    wins,
    losses,
    draws,
    winRate: wins + losses === 0 && draws > 0 ? 0 : winRate,
  };
}
