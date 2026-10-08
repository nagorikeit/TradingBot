import { Candle, Signal, IndicatorValues, TimeframeKey, EvaluatedRuleItem, SignalSnapshot, SignalTier } from '../types';
import { computeIndicators } from '../indicators';
import { getTimeframeMs, getAssetInfo } from '../data/marketDataProvider';

export interface EvaluationResult {
  direction: 'CALL' | 'PUT' | 'WAIT';
  score: number; // 0 to 5
  totalConditions: number;
  tier: SignalTier;
  reasons: string[];
  activeRules: EvaluatedRuleItem[];
  bullishScore: number;
  bearishScore: number;
  signalStrength: number; // Normalized rule alignment (score * 20)
  confidenceScore: number; // Percentage of rules satisfied
}

/**
 * Evaluates technical rules against market candles and returns rule-based score
 * Strict Tier Discipline:
 * 5/5 -> STRONG (CALL or PUT)
 * 4/5 -> QUALIFIED (CALL or PUT)
 * <= 3/5 -> WAIT / NO SIGNAL (Strictly rejected from execution)
 */
export function evaluateStrategyRules(
  candles: Candle[],
  indicators: IndicatorValues,
  assetDecimals: number = 5
): EvaluationResult {
  const lastIndex = candles.length - 1;
  const currentCandle = candles[lastIndex];
  const price = currentCandle.close;

  // Bullish Rules Evaluation (5 Rules)
  const bullishRules: EvaluatedRuleItem[] = [
    {
      id: 'bull_ema',
      name: 'EMA 9 > EMA 21 Trend',
      description: 'Short-term EMA (9) strictly above medium-term (21)',
      passed: indicators.ema9 > indicators.ema21,
      valueText: `EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) > EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
      failReason: `EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) is below EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
    },
    {
      id: 'bull_rsi',
      name: 'RSI Momentum > 50',
      description: 'RSI 14 above median 50 bullish momentum zone',
      passed: indicators.rsi > 50,
      valueText: `RSI 14 at ${indicators.rsi.toFixed(1)} (> 50 Bullish Zone)`,
      failReason: `RSI 14 at ${indicators.rsi.toFixed(1)} (<= 50, momentum is bearish or neutral)`,
    },
    {
      id: 'bull_macd',
      name: 'MACD Bullish Confirmation',
      description: 'MACD line > Signal or histogram positive',
      passed: indicators.macd.macd > indicators.macd.signal || indicators.macd.histogram > 0,
      valueText: `MACD Line: ${indicators.macd.macd.toFixed(assetDecimals)} vs Signal: ${indicators.macd.signal.toFixed(assetDecimals)} (Hist: ${indicators.macd.histogram.toFixed(assetDecimals)})`,
      failReason: `MACD line below signal and histogram <= 0`,
    },
    {
      id: 'bull_support',
      name: 'Price Above EMA 21 Support',
      description: 'Candle close situated above EMA 21 dynamic baseline',
      passed: price > indicators.ema21,
      valueText: `Price (${price.toFixed(assetDecimals)}) > EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
      failReason: `Price (${price.toFixed(assetDecimals)}) below EMA 21 baseline (${indicators.ema21.toFixed(assetDecimals)})`,
    },
    {
      id: 'bull_candle',
      name: 'Bullish Candle Confirmation',
      description: 'Triggering candle closes above open (Close > Open)',
      passed: currentCandle.close > currentCandle.open,
      valueText: `Close (${currentCandle.close.toFixed(assetDecimals)}) > Open (${currentCandle.open.toFixed(assetDecimals)})`,
      failReason: `Candle closed bearish or flat (Close: ${currentCandle.close.toFixed(assetDecimals)} <= Open: ${currentCandle.open.toFixed(assetDecimals)})`,
    },
  ];

  // Bearish Rules Evaluation (5 Rules)
  const bearishRules: EvaluatedRuleItem[] = [
    {
      id: 'bear_ema',
      name: 'EMA 9 < EMA 21 Trend',
      description: 'Short-term EMA (9) strictly below medium-term (21)',
      passed: indicators.ema9 < indicators.ema21,
      valueText: `EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) < EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
      failReason: `EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) is above EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
    },
    {
      id: 'bear_rsi',
      name: 'RSI Momentum < 50',
      description: 'RSI 14 below median 50 bearish momentum zone',
      passed: indicators.rsi < 50,
      valueText: `RSI 14 at ${indicators.rsi.toFixed(1)} (< 50 Bearish Zone)`,
      failReason: `RSI 14 at ${indicators.rsi.toFixed(1)} (>= 50, momentum is bullish or neutral)`,
    },
    {
      id: 'bear_macd',
      name: 'MACD Bearish Confirmation',
      description: 'MACD line < Signal or histogram negative',
      passed: indicators.macd.macd < indicators.macd.signal || indicators.macd.histogram < 0,
      valueText: `MACD Line: ${indicators.macd.macd.toFixed(assetDecimals)} vs Signal: ${indicators.macd.signal.toFixed(assetDecimals)} (Hist: ${indicators.macd.histogram.toFixed(assetDecimals)})`,
      failReason: `MACD line above signal and histogram >= 0`,
    },
    {
      id: 'bear_resistance',
      name: 'Price Below EMA 21 Resistance',
      description: 'Candle close situated below EMA 21 dynamic baseline',
      passed: price < indicators.ema21,
      valueText: `Price (${price.toFixed(assetDecimals)}) < EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
      failReason: `Price (${price.toFixed(assetDecimals)}) above EMA 21 baseline (${indicators.ema21.toFixed(assetDecimals)})`,
    },
    {
      id: 'bear_candle',
      name: 'Bearish Candle Confirmation',
      description: 'Triggering candle closes below open (Close < Open)',
      passed: currentCandle.close < currentCandle.open,
      valueText: `Close (${currentCandle.close.toFixed(assetDecimals)}) < Open (${currentCandle.open.toFixed(assetDecimals)})`,
      failReason: `Candle closed bullish or flat (Close: ${currentCandle.close.toFixed(assetDecimals)} >= Open: ${currentCandle.open.toFixed(assetDecimals)})`,
    },
  ];

  const bullishScore = bullishRules.filter((r) => r.passed).length;
  const bearishScore = bearishRules.filter((r) => r.passed).length;

  // Strict Tier Determination:
  // 5/5 -> STRONG (CALL or PUT)
  // 4/5 -> QUALIFIED (CALL or PUT)
  // <= 3/5 -> WAIT (NO SIGNAL)
  if (bullishScore >= 4 && bullishScore > bearishScore) {
    const tier: SignalTier = bullishScore === 5 ? 'STRONG' : 'QUALIFIED';
    const passedReasons = bullishRules.filter((r) => r.passed).map((r) => r.valueText);
    return {
      direction: 'CALL',
      score: bullishScore,
      totalConditions: 5,
      tier,
      reasons: passedReasons,
      activeRules: bullishRules,
      bullishScore,
      bearishScore,
      signalStrength: bullishScore * 20,
      confidenceScore: Math.round((bullishScore / 5) * 100),
    };
  } else if (bearishScore >= 4 && bearishScore > bullishScore) {
    const tier: SignalTier = bearishScore === 5 ? 'STRONG' : 'QUALIFIED';
    const passedReasons = bearishRules.filter((r) => r.passed).map((r) => r.valueText);
    return {
      direction: 'PUT',
      score: bearishScore,
      totalConditions: 5,
      tier,
      reasons: passedReasons,
      activeRules: bearishRules,
      bullishScore,
      bearishScore,
      signalStrength: bearishScore * 20,
      confidenceScore: Math.round((bearishScore / 5) * 100),
    };
  }

  // 3/5 or less, equilibrium, or inconclusive -> Strict WAIT discipline
  const dominantRules = bullishScore >= bearishScore ? bullishRules : bearishRules;
  const maxScore = Math.max(bullishScore, bearishScore);
  const failedRules = dominantRules.filter((r) => !r.passed);

  const waitReasons: string[] = [];
  if (bullishScore === bearishScore && bullishScore > 0) {
    waitReasons.push(`Market in equilibrium: Bullish score (${bullishScore}/5) equals Bearish score (${bearishScore}/5)`);
  } else {
    waitReasons.push(`Insufficient rule confirmation: Best alignment is only ${maxScore}/5 (Minimum 4/5 required for signal)`);
  }
  if (failedRules.length > 0) {
    waitReasons.push(`Unsatisfied conditions: ${failedRules.map((f) => f.name).join(', ')}`);
  }
  waitReasons.push(`Waiting for minimum 4/5 qualified alignment before generating signal`);

  return {
    direction: 'WAIT',
    score: maxScore,
    totalConditions: 5,
    tier: 'WAIT',
    reasons: waitReasons,
    activeRules: dominantRules,
    bullishScore,
    bearishScore,
    signalStrength: maxScore * 20,
    confidenceScore: Math.round((maxScore / 5) * 100),
  };
}

/**
 * Main Signal Engine: Generates Signal object with immutable snapshot
 */
export function generateSignal(
  symbol: string,
  timeframe: TimeframeKey,
  candles: Candle[],
  expiryCandlesCount: number = 1,
  marketDataSource: string = 'Binance Spot'
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
  const signalId = `sig_${symbol.replace(/[\/\-_]/g, '')}_${signalTime}`;

  // IMMUTABLE SIGNAL SNAPSHOT:
  // Preserves exact market state, indicators, candle OHLCV, and rules evaluated at candle formation
  const snapshot: SignalSnapshot = {
    signalId,
    symbol,
    timeframe,
    candleTimestamp: lastCandle.timestamp,
    entryPrice: lastCandle.close,
    candle: {
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
      volume: lastCandle.volume,
    },
    ema9: indicators.ema9,
    ema21: indicators.ema21,
    rsi: indicators.rsi,
    macd: {
      macd: indicators.macd.macd,
      signal: indicators.macd.signal,
      histogram: indicators.macd.histogram,
    },
    bollingerBands: {
      upper: indicators.bollingerBands.upper,
      middle: indicators.bollingerBands.middle,
      lower: indicators.bollingerBands.lower,
    },
    atr: indicators.atr,
    ruleScore: evaluation.score,
    scoreRatio: `${evaluation.score}/${evaluation.totalConditions}`,
    tier: evaluation.tier,
    direction: evaluation.direction,
    triggeredRules: evaluation.reasons,
    allRulesEvaluated: evaluation.activeRules,
    expiryTime,
    expiryCandles: expiryCandlesCount,
    strategyVersion: 'v1.0.0',
    ruleVersion: 'v1.0.0',
    marketDataSource,
    signalCreatedAt: Date.now(),
  };

  return {
    id: signalId,
    symbol,
    timeframe,
    direction: evaluation.direction,
    signalStrength: evaluation.signalStrength,
    confidenceScore: evaluation.confidenceScore,
    scoreRatio: `${evaluation.score}/${evaluation.totalConditions}`,
    tier: evaluation.tier,
    entryPrice: lastCandle.close,
    signalTime,
    candleTimestamp: lastCandle.timestamp,
    expiryTime,
    expiryCandles: expiryCandlesCount,
    indicators,
    reasons: evaluation.reasons,
    rulesEvaluated: evaluation.activeRules,
    strategyVersion: 'v1.0.0',
    ruleVersion: 'v1.0.0',
    marketDataSource,
    snapshot,
    result: 'PENDING',
  };
}
