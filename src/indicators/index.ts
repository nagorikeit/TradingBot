/**
 * Technical Indicators Engine
 * Mathematical implementation of EMA, RSI, MACD, Bollinger Bands, and ATR
 */

import { Candle, IndicatorValues } from '../types';

/**
 * Calculates Exponential Moving Average (EMA) for a series of numbers
 * @param values Array of numerical prices
 * @param period Lookback window (e.g. 9, 21)
 * @returns Array of EMA values matching the length of values (NaN padded for initial period)
 */
export function calculateEMA(values: number[], period: number): number[] {
  if (!values || values.length === 0 || period <= 0) return [];
  const result: number[] = new Array(values.length).fill(NaN);
  
  if (values.length < period) {
    // If not enough data, calculate running average
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      result[i] = sum / (i + 1);
    }
    return result;
  }

  // Initial SMA for the first period
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += values[i];
  }
  const initialSMA = initialSum / period;
  result[period - 1] = initialSMA;

  const multiplier = 2 / (period + 1);
  let previousEMA = initialSMA;

  for (let i = period; i < values.length; i++) {
    const currentEMA = (values[i] - previousEMA) * multiplier + previousEMA;
    result[i] = currentEMA;
    previousEMA = currentEMA;
  }

  // Backfill NaN with initial SMA for cleaner visualization
  for (let i = 0; i < period - 1; i++) {
    result[i] = initialSMA;
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's smoothing
 * @param closes Array of close prices
 * @param period Lookback period (standard: 14)
 * @returns Array of RSI values between 0 and 100
 */
export function calculateRSI(closes: number[], period: number = 14): number[] {
  if (!closes || closes.length <= period) {
    return new Array(closes ? closes.length : 0).fill(50);
  }

  const result: number[] = new Array(closes.length).fill(50);
  const changes: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  // First period simple average
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    result[period] = 100 - (100 / (1 + rs));
  }

  // Wilder's smoothing for subsequent periods
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const candleIdx = i + 1;
    if (avgLoss === 0) {
      result[candleIdx] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[candleIdx] = 100 - (100 / (1 + rs));
    }
  }

  return result;
}

/**
 * Calculates MACD (Moving Average Convergence Divergence)
 * Standard: Fast 12, Slow 26, Signal 9
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const length = closes ? closes.length : 0;
  if (length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }

  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: number[] = new Array(length).fill(0);
  for (let i = 0; i < length; i++) {
    const fast = fastEMA[i];
    const slow = slowEMA[i];
    if (!isNaN(fast) && !isNaN(slow)) {
      macdLine[i] = fast - slow;
    } else {
      macdLine[i] = 0;
    }
  }

  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram: number[] = new Array(length).fill(0);

  for (let i = 0; i < length; i++) {
    histogram[i] = macdLine[i] - signalLine[i];
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (SMA 20, StdDev 2)
 */
export function calculateBollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const length = closes ? closes.length : 0;
  const upper: number[] = new Array(length).fill(0);
  const middle: number[] = new Array(length).fill(0);
  const lower: number[] = new Array(length).fill(0);

  if (length === 0) return { upper, middle, lower };

  for (let i = 0; i < length; i++) {
    const windowStart = Math.max(0, i - period + 1);
    const windowSize = i - windowStart + 1;
    let sum = 0;

    for (let j = windowStart; j <= i; j++) {
      sum += closes[j];
    }
    const sma = sum / windowSize;
    middle[i] = sma;

    let varianceSum = 0;
    for (let j = windowStart; j <= i; j++) {
      varianceSum += Math.pow(closes[j] - sma, 2);
    }
    const stdDev = Math.sqrt(varianceSum / windowSize);

    upper[i] = sma + multiplier * stdDev;
    lower[i] = sma - multiplier * stdDev;
  }

  return { upper, middle, lower };
}

/**
 * Calculates Average True Range (ATR)
 * Standard: 14 period
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const length = candles ? candles.length : 0;
  if (length === 0) return [];
  const result: number[] = new Array(length).fill(0);

  const tr: number[] = [];
  for (let i = 0; i < length; i++) {
    const cur = candles[i];
    if (i === 0) {
      tr.push(cur.high - cur.low);
    } else {
      const prev = candles[i - 1];
      const hMinusL = cur.high - cur.low;
      const hMinusPc = Math.abs(cur.high - prev.close);
      const lMinusPc = Math.abs(cur.low - prev.close);
      tr.push(Math.max(hMinusL, hMinusPc, lMinusPc));
    }
  }

  // Initial SMA of TR
  let trSum = 0;
  const firstWindow = Math.min(period, length);
  for (let i = 0; i < firstWindow; i++) {
    trSum += tr[i];
  }
  let prevATR = trSum / firstWindow;
  result[firstWindow - 1] = prevATR;

  for (let i = 0; i < firstWindow - 1; i++) {
    result[i] = prevATR;
  }

  for (let i = firstWindow; i < length; i++) {
    const currentATR = (prevATR * (period - 1) + tr[i]) / period;
    result[i] = currentATR;
    prevATR = currentATR;
  }

  return result;
}

/**
 * Computes the full current indicator snapshot from a candle array
 */
export function computeIndicators(candles: Candle[]): IndicatorValues | null {
  if (!candles || candles.length < 5) return null;

  const closes = candles.map((c) => c.close);
  const lastIndex = candles.length - 1;

  const ema9Series = calculateEMA(closes, 9);
  const ema21Series = calculateEMA(closes, 21);
  const rsiSeries = calculateRSI(closes, 14);
  const macdSeries = calculateMACD(closes, 12, 26, 9);
  const bbSeries = calculateBollingerBands(closes, 20, 2);
  const atrSeries = calculateATR(candles, 14);

  return {
    ema9: ema9Series[lastIndex],
    ema21: ema21Series[lastIndex],
    rsi: rsiSeries[lastIndex],
    macd: {
      macd: macdSeries.macd[lastIndex],
      signal: macdSeries.signal[lastIndex],
      histogram: macdSeries.histogram[lastIndex],
    },
    bollingerBands: {
      upper: bbSeries.upper[lastIndex],
      middle: bbSeries.middle[lastIndex],
      lower: bbSeries.lower[lastIndex],
    },
    atr: atrSeries[lastIndex],
  };
}
