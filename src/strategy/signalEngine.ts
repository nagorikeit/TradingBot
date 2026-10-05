import { Candle, Signal, IndicatorValues, TimeframeKey } from '../types';
import { computeIndicators } from '../indicators';
import { getTimeframeMs, getAssetInfo } from '../data/marketDataProvider';

export interface EvaluationResult {
  direction: 'CALL' | 'PUT' | 'WAIT';
  score: number; // 0 to 5
  totalConditions: number;
  reasons: string[];
  signalStrength: number; // 0 to 100%
  confidenceScore: number; // 0 to 100%
}

/**
 * Evaluates technical rules against market candles and returns rule-based score
 */
export function evaluateStrategyRules(
  candles: Candle[],
  indicators: IndicatorValues,
  assetDecimals: number = 5
): EvaluationResult {
  const lastIndex = candles.length - 1;
  const currentCandle = candles[lastIndex];
  const price = currentCandle.close;

  const bullishReasons: string[] = [];
  let bullishScore = 0;

  // Bullish Rule 1: EMA 9 > EMA 21
  if (indicators.ema9 > indicators.ema21) {
    bullishScore++;
    bullishReasons.push(`EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) > EMA 21 (${indicators.ema21.toFixed(assetDecimals)}) - Bullish Trend`);
  }

  // Bullish Rule 2: RSI > 50 (momentum)
  if (indicators.rsi > 50) {
    bullishScore++;
    bullishReasons.push(`RSI 14 at ${indicators.rsi.toFixed(1)} (> 50 Bullish Momentum Zone)`);
  }

  // Bullish Rule 3: MACD Bullish (MACD line > Signal line and histogram positive)
  if (indicators.macd.macd > indicators.macd.signal || indicators.macd.histogram > 0) {
    bullishScore++;
    bullishReasons.push(`MACD Bullish (Line: ${indicators.macd.macd.toFixed(assetDecimals)} > Signal: ${indicators.macd.signal.toFixed(assetDecimals)})`);
  }

  // Bullish Rule 4: Price above EMA 21
  if (price > indicators.ema21) {
    bullishScore++;
    bullishReasons.push(`Price (${price.toFixed(assetDecimals)}) above EMA 21 Support (${indicators.ema21.toFixed(assetDecimals)})`);
  }

  // Bullish Rule 5: Bullish Candle Confirmation (close > open)
  if (currentCandle.close > currentCandle.open) {
    bullishScore++;
    bullishReasons.push(`Bullish Candle Confirmation (Close: ${currentCandle.close.toFixed(assetDecimals)} > Open: ${currentCandle.open.toFixed(assetDecimals)})`);
  }

  const bearishReasons: string[] = [];
  let bearishScore = 0;

  // Bearish Rule 1: EMA 9 < EMA 21
  if (indicators.ema9 < indicators.ema21) {
    bearishScore++;
    bearishReasons.push(`EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) < EMA 21 (${indicators.ema21.toFixed(assetDecimals)}) - Bearish Trend`);
  }

  // Bearish Rule 2: RSI < 50
  if (indicators.rsi < 50) {
    bearishScore++;
    bearishReasons.push(`RSI 14 at ${indicators.rsi.toFixed(1)} (< 50 Bearish Momentum Zone)`);
  }

  // Bearish Rule 3: MACD Bearish
  if (indicators.macd.macd < indicators.macd.signal || indicators.macd.histogram < 0) {
    bearishScore++;
    bearishReasons.push(`MACD Bearish (Line: ${indicators.macd.macd.toFixed(assetDecimals)} < Signal: ${indicators.macd.signal.toFixed(assetDecimals)})`);
  }

  // Bearish Rule 4: Price below EMA 21
  if (price < indicators.ema21) {
    bearishScore++;
    bearishReasons.push(`Price (${price.toFixed(assetDecimals)}) below EMA 21 Resistance (${indicators.ema21.toFixed(assetDecimals)})`);
  }

  // Bearish Rule 5: Bearish Candle Confirmation (close < open)
  if (currentCandle.close < currentCandle.open) {
    bearishScore++;
    bearishReasons.push(`Bearish Candle Confirmation (Close: ${currentCandle.close.toFixed(assetDecimals)} < Open: ${currentCandle.open.toFixed(assetDecimals)})`);
  }

  // Determine direction based on scores
  // Thresholds:
  // 5/5: Very Strong (88-96%)
  // 4/5: Strong (72-84%)
  // 3/5: Moderate (58-68%)
  // Under 3: NO SIGNAL (WAIT)
  if (bullishScore >= 3 && bullishScore > bearishScore) {
    const strengthMap: Record<number, number> = { 3: 65, 4: 80, 5: 94 };
    return {
      direction: 'CALL',
      score: bullishScore,
      totalConditions: 5,
      reasons: bullishReasons,
      signalStrength: strengthMap[bullishScore] || 60,
      confidenceScore: Math.round((bullishScore / 5) * 100),
    };
  } else if (bearishScore >= 3 && bearishScore > bullishScore) {
    const strengthMap: Record<number, number> = { 3: 65, 4: 80, 5: 94 };
    return {
      direction: 'PUT',
      score: bearishScore,
      totalConditions: 5,
      reasons: bearishReasons,
      signalStrength: strengthMap[bearishScore] || 60,
      confidenceScore: Math.round((bearishScore / 5) * 100),
    };
  }

  // Insufficient confirmation -> WAIT
  const waitReasons: string[] = [];
  if (bullishScore === bearishScore && bullishScore > 0) {
    waitReasons.push(`Market in equilibrium: Bullish score (${bullishScore}/5) equals Bearish score (${bearishScore}/5)`);
  } else if (Math.max(bullishScore, bearishScore) < 3) {
    waitReasons.push(`Insufficient rule confirmation: Best alignment is only ${Math.max(bullishScore, bearishScore)}/5 (Minimum 3/5 required)`);
  }
  waitReasons.push(`Waiting for clear indicator alignment (RSI, EMA crossover, MACD confirmation)`);

  const maxScore = Math.max(bullishScore, bearishScore);
  return {
    direction: 'WAIT',
    score: maxScore,
    totalConditions: 5,
    reasons: waitReasons,
    signalStrength: Math.round((maxScore / 5) * 40),
    confidenceScore: Math.round((maxScore / 5) * 40),
  };
}

/**
 * Main Signal Engine: Generates Signal object from candle stream
 */
export function generateSignal(
  symbol: string,
  timeframe: TimeframeKey,
  candles: Candle[],
  expiryCandlesCount: number = 1
): Signal | null {
  if (!candles || candles.length < 25) return null;

  const indicators = computeIndicators(candles);
  if (!indicators) return null;

  const asset = getAssetInfo(symbol);
  const evaluation = evaluateStrategyRules(candles, indicators, asset.pipDecimals);
  const lastCandle = candles[candles.length - 1];

  const signalTime = lastCandle.timestamp;
  const intervalMs = getTimeframeMs(timeframe);
  const expiryTime = signalTime + intervalMs * expiryCandlesCount;

  return {
    id: `sig_${symbol}_${signalTime}`,
    symbol,
    timeframe,
    direction: evaluation.direction,
    signalStrength: evaluation.signalStrength,
    confidenceScore: evaluation.confidenceScore,
    scoreRatio: `${evaluation.score}/${evaluation.totalConditions}`,
    entryPrice: lastCandle.close,
    signalTime,
    expiryTime,
    expiryCandles: expiryCandlesCount,
    indicators,
    reasons: evaluation.reasons,
    result: 'PENDING',
  };
}
