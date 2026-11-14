import { Candle, Signal, IndicatorValues, TimeframeKey, EvaluatedRuleItem, SignalSnapshot, SignalTier } from '../types';
import { computeIndicators } from '../indicators';
import { getTimeframeMs, getAssetInfo } from '../data/marketDataProvider';
import { TradingProfileId, getTradingProfile } from './tradingProfiles';
import { tradingProfileService } from '../services/tradingProfileService';
import { agentLearningService } from '../services/agentLearningService';

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
  profileId: TradingProfileId;
}

function getAverageVolume(candles: Candle[], lookback: number = 20): number {
  const slice = candles.slice(Math.max(0, candles.length - lookback));
  if (slice.length === 0) return 0;
  return slice.reduce((acc, c) => acc + (c.volume || 0), 0) / slice.length;
}

/**
 * Evaluates technical rules tailored to the selected trading platform profile
 * Strict Tier Discipline:
 * 5/5 -> STRONG (CALL or PUT)
 * 4/5 -> QUALIFIED (CALL or PUT)
 * <= 3/5 -> WAIT / NO SIGNAL
 */
export function evaluateStrategyRules(
  candles: Candle[],
  indicators: IndicatorValues,
  assetDecimals: number = 5,
  explicitProfileId?: TradingProfileId
): EvaluationResult {
  const profileId: TradingProfileId = explicitProfileId || tradingProfileService.getActiveProfileId();
  const lastIndex = candles.length - 1;
  const currentCandle = candles[lastIndex];
  const prevCandle = lastIndex > 0 ? candles[lastIndex - 1] : currentCandle;
  const price = currentCandle.close;

  const fullRange = Math.max(1e-9, currentCandle.high - currentCandle.low);
  const bodySize = Math.abs(currentCandle.close - currentCandle.open);
  const bodyRatio = bodySize / fullRange;
  const upperWick = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
  const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;
  const upperWickRatio = upperWick / fullRange;
  const lowerWickRatio = lowerWick / fullRange;

  const avgVol = getAverageVolume(candles, 20);
  const volRatio = avgVol > 0 ? currentCandle.volume / avgVol : 1;

  let bullishRules: EvaluatedRuleItem[];
  let bearishRules: EvaluatedRuleItem[];

  if (profileId === 'BINARY_OTC') {
    const prevMid = (prevCandle.open + prevCandle.close) / 2;
    bullishRules = [
      {
        id: 'otc_bull_bb',
        name: 'BB Lower / Value Zone',
        description: 'Price reacting from Bollinger middle/lower reversion area',
        passed: price <= indicators.bollingerBands.middle * 1.0015 || currentCandle.low <= indicators.bollingerBands.lower * 1.001,
        valueText: `Low/Close near BB Value (${indicators.bollingerBands.lower.toFixed(assetDecimals)})`,
        failReason: `Price stretched too far above BB middle (${indicators.bollingerBands.middle.toFixed(assetDecimals)})`,
      },
      {
        id: 'otc_bull_rsi',
        name: 'OTC RSI Rebound Zone',
        description: 'RSI recovering from <= 52 or oversold bounce <= 38',
        passed: indicators.rsi <= 52 || (indicators.rsi > 45 && currentCandle.close > currentCandle.open),
        valueText: `OTC RSI (${indicators.rsi.toFixed(1)}) supportive for rebound`,
        failReason: `RSI overextended high (${indicators.rsi.toFixed(1)}) for OTC CALL`,
      },
      {
        id: 'otc_bull_wick',
        name: 'Lower Wick / Rejection Defense',
        description: 'Buyers pushed price up from lows or engulfed prior candle',
        passed: lowerWickRatio >= 0.28 || currentCandle.close > prevCandle.high || currentCandle.close > currentCandle.open,
        valueText: `Lower Wick ${(lowerWickRatio * 100).toFixed(0)}% / Bullish Defense`,
        failReason: `Insufficient lower wick defense (${(lowerWickRatio * 100).toFixed(0)}%)`,
      },
      {
        id: 'otc_bull_body',
        name: 'Anti-Doji Body Filter',
        description: 'Candle body >= 22% with bullish close (Avoids OTC Doji chop)',
        passed: bodyRatio >= 0.22 && currentCandle.close > currentCandle.open,
        valueText: `Healthy Bull Body (${(bodyRatio * 100).toFixed(0)}% of range)`,
        failReason: `Weak or Doji body (${(bodyRatio * 100).toFixed(0)}% of range)`,
      },
      {
        id: 'otc_bull_mom',
        name: 'Short-Term Mean Momentum',
        description: 'Close breaks above previous candle midpoint',
        passed: currentCandle.close > prevMid,
        valueText: `Close (${price.toFixed(assetDecimals)}) > Prev Mid (${prevMid.toFixed(assetDecimals)})`,
        failReason: `Close failed to clear prior midpoint (${prevMid.toFixed(assetDecimals)})`,
      },
    ];

    bearishRules = [
      {
        id: 'otc_bear_bb',
        name: 'BB Upper / Rejection Zone',
        description: 'Price reacting from Bollinger upper/middle resistance area',
        passed: price >= indicators.bollingerBands.middle * 0.9985 || currentCandle.high >= indicators.bollingerBands.upper * 0.999,
        valueText: `High/Close near BB Resistance (${indicators.bollingerBands.upper.toFixed(assetDecimals)})`,
        failReason: `Price stretched too low below BB middle (${indicators.bollingerBands.middle.toFixed(assetDecimals)})`,
      },
      {
        id: 'otc_bear_rsi',
        name: 'OTC RSI Exhaustion Drop',
        description: 'RSI turning down from >= 48 or overbought rejection >= 62',
        passed: indicators.rsi >= 48 || (indicators.rsi < 55 && currentCandle.close < currentCandle.open),
        valueText: `OTC RSI (${indicators.rsi.toFixed(1)}) supportive for pullback`,
        failReason: `RSI overextended low (${indicators.rsi.toFixed(1)}) for OTC PUT`,
      },
      {
        id: 'otc_bear_wick',
        name: 'Upper Wick / Seller Rejection',
        description: 'Sellers rejected highs or engulfed prior candle',
        passed: upperWickRatio >= 0.28 || currentCandle.close < prevCandle.low || currentCandle.close < currentCandle.open,
        valueText: `Upper Wick ${(upperWickRatio * 100).toFixed(0)}% / Seller Rejection`,
        failReason: `Insufficient upper wick rejection (${(upperWickRatio * 100).toFixed(0)}%)`,
      },
      {
        id: 'otc_bear_body',
        name: 'Anti-Doji Body Filter',
        description: 'Candle body >= 22% with bearish close (Avoids OTC Doji chop)',
        passed: bodyRatio >= 0.22 && currentCandle.close < currentCandle.open,
        valueText: `Healthy Bear Body (${(bodyRatio * 100).toFixed(0)}% of range)`,
        failReason: `Weak or Doji body (${(bodyRatio * 100).toFixed(0)}% of range)`,
      },
      {
        id: 'otc_bear_mom',
        name: 'Short-Term Mean Momentum',
        description: 'Close breaks below previous candle midpoint',
        passed: currentCandle.close < prevMid,
        valueText: `Close (${price.toFixed(assetDecimals)}) < Prev Mid (${prevMid.toFixed(assetDecimals)})`,
        failReason: `Close failed to break prior midpoint (${prevMid.toFixed(assetDecimals)})`,
      },
    ];
  } else if (profileId === 'CRYPTO_SPOT') {
    bullishRules = [
      {
        id: 'cry_bull_ema',
        name: 'Crypto EMA 9 > EMA 21',
        description: 'Spot/Futures fast trend strictly bullish',
        passed: indicators.ema9 > indicators.ema21,
        valueText: `EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) > EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
        failReason: `EMA 9 below EMA 21`,
      },
      {
        id: 'cry_bull_vol',
        name: 'Volume Expansion Filter',
        description: 'Volume confirms real participation (>= 0.95x 20-bar avg)',
        passed: volRatio >= 0.95,
        valueText: `Volume ${volRatio.toFixed(2)}x Avg (Active Liquidity)`,
        failReason: `Low volume (${volRatio.toFixed(2)}x Avg < 0.95x)`,
      },
      {
        id: 'cry_bull_macd',
        name: 'MACD Trend Expansion',
        description: 'MACD line > Signal or histogram > 0',
        passed: indicators.macd.macd > indicators.macd.signal || indicators.macd.histogram > 0,
        valueText: `MACD Hist ${indicators.macd.histogram.toFixed(assetDecimals)} Bullish`,
        failReason: `MACD momentum bearish`,
      },
      {
        id: 'cry_bull_rsi',
        name: 'Healthy Trend RSI (48-75)',
        description: 'Strong momentum without extreme blow-off exhaustion',
        passed: indicators.rsi >= 48 && indicators.rsi <= 75,
        valueText: `RSI ${indicators.rsi.toFixed(1)} in Healthy Long Zone (48-75)`,
        failReason: `RSI ${indicators.rsi.toFixed(1)} outside healthy 48-75 zone`,
      },
      {
        id: 'cry_bull_close',
        name: 'Breakout Close Confirmation',
        description: 'Price closes above EMA 21 with bullish candle',
        passed: price > indicators.ema21 && currentCandle.close > currentCandle.open,
        valueText: `Bullish Breakout Close above EMA 21`,
        failReason: `Price failed bullish close above EMA 21`,
      },
    ];

    bearishRules = [
      {
        id: 'cry_bear_ema',
        name: 'Crypto EMA 9 < EMA 21',
        description: 'Spot/Futures fast trend strictly bearish',
        passed: indicators.ema9 < indicators.ema21,
        valueText: `EMA 9 (${indicators.ema9.toFixed(assetDecimals)}) < EMA 21 (${indicators.ema21.toFixed(assetDecimals)})`,
        failReason: `EMA 9 above EMA 21`,
      },
      {
        id: 'cry_bear_vol',
        name: 'Volume Expansion Filter',
        description: 'Selling volume confirms breakdown (>= 0.95x 20-bar avg)',
        passed: volRatio >= 0.95,
        valueText: `Sell Volume ${volRatio.toFixed(2)}x Avg`,
        failReason: `Low volume (${volRatio.toFixed(2)}x Avg < 0.95x)`,
      },
      {
        id: 'cry_bear_macd',
        name: 'MACD Bearish Expansion',
        description: 'MACD line < Signal or histogram < 0',
        passed: indicators.macd.macd < indicators.macd.signal || indicators.macd.histogram < 0,
        valueText: `MACD Hist ${indicators.macd.histogram.toFixed(assetDecimals)} Bearish`,
        failReason: `MACD momentum bullish`,
      },
      {
        id: 'cry_bear_rsi',
        name: 'Healthy Downtrend RSI (25-52)',
        description: 'Bearish momentum without oversold bounce trap',
        passed: indicators.rsi <= 52 && indicators.rsi >= 25,
        valueText: `RSI ${indicators.rsi.toFixed(1)} in Healthy Short Zone (25-52)`,
        failReason: `RSI ${indicators.rsi.toFixed(1)} outside 25-52 short zone`,
      },
      {
        id: 'cry_bear_close',
        name: 'Breakdown Close Confirmation',
        description: 'Price closes below EMA 21 with bearish candle',
        passed: price < indicators.ema21 && currentCandle.close < currentCandle.open,
        valueText: `Bearish Breakdown Close below EMA 21`,
        failReason: `Price failed bearish close below EMA 21`,
      },
    ];
  } else if (profileId === 'FOREX') {
    const atrPercent = price > 0 ? (indicators.atr / price) * 100 : 0;
    const isActiveSession = atrPercent >= 0.015;
    bullishRules = [
      {
        id: 'fx_bull_struct',
        name: 'FX Structure EMA 9 > EMA 21',
        description: 'Bullish currency structure above baseline',
        passed: indicators.ema9 > indicators.ema21 && price > indicators.bollingerBands.middle,
        valueText: `FX Bull Structure above EMA 21 & BB Mid`,
        failReason: `FX structure not bullishly aligned`,
      },
      {
        id: 'fx_bull_atr',
        name: 'Session ATR Spread Gate',
        description: 'Sufficient volatility to clear broker pip spread',
        passed: isActiveSession,
        valueText: `ATR Volatility OK (${indicators.atr.toFixed(assetDecimals)})`,
        failReason: `Low dead-session ATR volatility`,
      },
      {
        id: 'fx_bull_rsi',
        name: 'FX RSI Directional Bias',
        description: 'RSI between 51 and 72 (clean trend without exhaustion)',
        passed: indicators.rsi > 51 && indicators.rsi < 72,
        valueText: `FX RSI ${indicators.rsi.toFixed(1)} (51-72 Zone)`,
        failReason: `RSI ${indicators.rsi.toFixed(1)} outside 51-72`,
      },
      {
        id: 'fx_bull_macd',
        name: 'MACD Institutional Flow',
        description: 'MACD line > Signal or positive histogram',
        passed: indicators.macd.macd > indicators.macd.signal || indicators.macd.histogram > 0,
        valueText: `MACD Bullish Flow Confirmed`,
        failReason: `MACD below signal line`,
      },
      {
        id: 'fx_bull_candle',
        name: 'Bullish Price Action Close',
        description: 'Close > Open confirming active buyers',
        passed: currentCandle.close > currentCandle.open && price > indicators.ema21,
        valueText: `Bullish FX Candle Close above EMA 21`,
        failReason: `Candle did not close bullish above EMA 21`,
      },
    ];

    bearishRules = [
      {
        id: 'fx_bear_struct',
        name: 'FX Structure EMA 9 < EMA 21',
        description: 'Bearish currency structure below baseline',
        passed: indicators.ema9 < indicators.ema21 && price < indicators.bollingerBands.middle,
        valueText: `FX Bear Structure below EMA 21 & BB Mid`,
        failReason: `FX structure not bearishly aligned`,
      },
      {
        id: 'fx_bear_atr',
        name: 'Session ATR Spread Gate',
        description: 'Sufficient volatility to clear broker pip spread',
        passed: isActiveSession,
        valueText: `ATR Volatility OK (${indicators.atr.toFixed(assetDecimals)})`,
        failReason: `Low dead-session ATR volatility`,
      },
      {
        id: 'fx_bear_rsi',
        name: 'FX RSI Directional Bias',
        description: 'RSI between 28 and 49 (clean downtrend without exhaustion)',
        passed: indicators.rsi < 49 && indicators.rsi > 28,
        valueText: `FX RSI ${indicators.rsi.toFixed(1)} (28-49 Zone)`,
        failReason: `RSI ${indicators.rsi.toFixed(1)} outside 28-49`,
      },
      {
        id: 'fx_bear_macd',
        name: 'MACD Institutional Flow',
        description: 'MACD line < Signal or negative histogram',
        passed: indicators.macd.macd < indicators.macd.signal || indicators.macd.histogram < 0,
        valueText: `MACD Bearish Flow Confirmed`,
        failReason: `MACD above signal line`,
      },
      {
        id: 'fx_bear_candle',
        name: 'Bearish Price Action Close',
        description: 'Close < Open confirming active sellers',
        passed: currentCandle.close < currentCandle.open && price < indicators.ema21,
        valueText: `Bearish FX Candle Close below EMA 21`,
        failReason: `Candle did not close bearish below EMA 21`,
      },
    ];
  } else if (profileId === 'COMMODITY_INDEX') {
    const cleanBody = bodyRatio >= 0.35;
    bullishRules = [
      {
        id: 'cmd_bull_ema',
        name: 'Fast Momentum EMA Alignment',
        description: 'EMA 9 > EMA 21 & Close above both EMAs',
        passed: indicators.ema9 > indicators.ema21 && price > indicators.ema9,
        valueText: `Price (${price.toFixed(assetDecimals)}) driving above EMA 9 > 21`,
        failReason: `Price not leading above EMA 9 & 21`,
      },
      {
        id: 'cmd_bull_body',
        name: 'Momentum Thrust Body Filter',
        description: 'Solid candle body (>= 35% of range) avoids wick traps',
        passed: cleanBody && currentCandle.close > currentCandle.open,
        valueText: `Strong Momentum Body (${(bodyRatio * 100).toFixed(0)}%)`,
        failReason: `Weak or spiky wick-heavy candle (${(bodyRatio * 100).toFixed(0)}%)`,
      },
      {
        id: 'cmd_bull_rsi',
        name: 'RSI Thrust > 53',
        description: 'Aggressive upside impulse strength',
        passed: indicators.rsi > 53,
        valueText: `RSI Thrust ${indicators.rsi.toFixed(1)} (> 53)`,
        failReason: `RSI (${indicators.rsi.toFixed(1)}) below 53 thrust mark`,
      },
      {
        id: 'cmd_bull_macd',
        name: 'MACD Positive Acceleration',
        description: 'MACD > Signal and positive histogram',
        passed: indicators.macd.macd > indicators.macd.signal && indicators.macd.histogram > 0,
        valueText: `MACD Positive Acceleration Confirmed`,
        failReason: `MACD positive acceleration missing`,
      },
      {
        id: 'cmd_bull_bb',
        name: 'Bollinger Upper Expansion',
        description: 'Price above Bollinger midline pushing upside',
        passed: price > indicators.bollingerBands.middle,
        valueText: `Above BB Middle (${indicators.bollingerBands.middle.toFixed(assetDecimals)})`,
        failReason: `Below Bollinger midline`,
      },
    ];

    bearishRules = [
      {
        id: 'cmd_bear_ema',
        name: 'Fast Momentum EMA Alignment',
        description: 'EMA 9 < EMA 21 & Close below both EMAs',
        passed: indicators.ema9 < indicators.ema21 && price < indicators.ema9,
        valueText: `Price (${price.toFixed(assetDecimals)}) breaking below EMA 9 < 21`,
        failReason: `Price not breaking below EMA 9 & 21`,
      },
      {
        id: 'cmd_bear_body',
        name: 'Momentum Thrust Body Filter',
        description: 'Solid bearish body (>= 35% of range) avoids wick traps',
        passed: cleanBody && currentCandle.close < currentCandle.open,
        valueText: `Strong Bear Body (${(bodyRatio * 100).toFixed(0)}%)`,
        failReason: `Weak or spiky wick-heavy candle (${(bodyRatio * 100).toFixed(0)}%)`,
      },
      {
        id: 'cmd_bear_rsi',
        name: 'RSI Thrust < 47',
        description: 'Aggressive downside impulse strength',
        passed: indicators.rsi < 47,
        valueText: `RSI Thrust ${indicators.rsi.toFixed(1)} (< 47)`,
        failReason: `RSI (${indicators.rsi.toFixed(1)}) above 47 thrust mark`,
      },
      {
        id: 'cmd_bear_macd',
        name: 'MACD Negative Acceleration',
        description: 'MACD < Signal and negative histogram',
        passed: indicators.macd.macd < indicators.macd.signal && indicators.macd.histogram < 0,
        valueText: `MACD Negative Acceleration Confirmed`,
        failReason: `MACD negative acceleration missing`,
      },
      {
        id: 'cmd_bear_bb',
        name: 'Bollinger Lower Expansion',
        description: 'Price below Bollinger midline pushing downside',
        passed: price < indicators.bollingerBands.middle,
        valueText: `Below BB Middle (${indicators.bollingerBands.middle.toFixed(assetDecimals)})`,
        failReason: `Above Bollinger midline`,
      },
    ];
  } else {
    // BINARY_LIVE (Default classic real-market trend + momentum rules)
    bullishRules = [
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

    bearishRules = [
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
  }

  const bullishScore = bullishRules.filter((r) => r.passed).length;
  const bearishScore = bearishRules.filter((r) => r.passed).length;
  const profileLearnedRules = agentLearningService.getRulesByProfile(profileId);
  const avgMultiplier =
    profileLearnedRules.length > 0
      ? profileLearnedRules.reduce((acc, r) => acc + (r.ruleWeightMultiplier || 1), 0) /
        profileLearnedRules.length
      : 1;

  // Strict Tier Determination:
  // 5/5 -> STRONG (CALL or PUT)
  // 4/5 -> QUALIFIED (CALL or PUT)
  // <= 3/5 -> WAIT (NO SIGNAL)
  if (bullishScore >= 4 && bullishScore > bearishScore) {
    const tier: SignalTier = bullishScore === 5 ? 'STRONG' : 'QUALIFIED';
    const passedReasons = bullishRules.filter((r) => r.passed).map((r) => r.valueText);
    const dirRule = profileLearnedRules.find((r) => r.recommendedDirection === 'CALL' && r.status !== 'UNDER_REVIEW');
    if (dirRule) {
      passedReasons.push(
        `[${getTradingProfile(profileId).shortLabel} রুল] ${dirRule.titleBn} (ওয়েট: ${Math.round(
          dirRule.confidenceWeight * 100
        )}%)`
      );
    }
    const weightedStrength = Math.min(100, Math.max(60, Math.round(bullishScore * 20 * avgMultiplier)));
    return {
      direction: 'CALL',
      score: bullishScore,
      totalConditions: 5,
      tier,
      reasons: passedReasons,
      activeRules: bullishRules,
      bullishScore,
      bearishScore,
      signalStrength: weightedStrength,
      confidenceScore: Math.round((bullishScore / 5) * 100),
      profileId,
    };
  } else if (bearishScore >= 4 && bearishScore > bullishScore) {
    const tier: SignalTier = bearishScore === 5 ? 'STRONG' : 'QUALIFIED';
    const passedReasons = bearishRules.filter((r) => r.passed).map((r) => r.valueText);
    const dirRule = profileLearnedRules.find((r) => r.recommendedDirection === 'PUT' && r.status !== 'UNDER_REVIEW');
    if (dirRule) {
      passedReasons.push(
        `[${getTradingProfile(profileId).shortLabel} রুল] ${dirRule.titleBn} (ওয়েট: ${Math.round(
          dirRule.confidenceWeight * 100
        )}%)`
      );
    }
    const weightedStrength = Math.min(100, Math.max(60, Math.round(bearishScore * 20 * avgMultiplier)));
    return {
      direction: 'PUT',
      score: bearishScore,
      totalConditions: 5,
      tier,
      reasons: passedReasons,
      activeRules: bearishRules,
      bullishScore,
      bearishScore,
      signalStrength: weightedStrength,
      confidenceScore: Math.round((bearishScore / 5) * 100),
      profileId,
    };
  }

  // 3/5 or less, equilibrium, or inconclusive -> Strict WAIT discipline
  const dominantRules = bullishScore >= bearishScore ? bullishRules : bearishRules;
  const maxScore = Math.max(bullishScore, bearishScore);
  const failedRules = dominantRules.filter((r) => !r.passed);
  const profileMeta = getTradingProfile(profileId);

  const waitReasons: string[] = [];
  if (bullishScore === bearishScore && bullishScore > 0) {
    waitReasons.push(`[${profileMeta.shortLabel}] Equilibrium: Bullish (${bullishScore}/5) equals Bearish (${bearishScore}/5)`);
  } else {
    waitReasons.push(`[${profileMeta.shortLabel}] Insufficient alignment: ${maxScore}/5 (Minimum 4/5 required)`);
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
    profileId,
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
  marketDataSource: string = 'Binance Spot',
  explicitProfileId?: TradingProfileId
): Signal | null {
  if (!candles || candles.length < 25) return null;

  const indicators = computeIndicators(candles);
  if (!indicators) return null;

  const asset = getAssetInfo(symbol);
  const evaluation = evaluateStrategyRules(candles, indicators, asset.pipDecimals, explicitProfileId);
  const lastCandle = candles[candles.length - 1];

  const profileConfig = getTradingProfile(evaluation.profileId);
  const signalTime = lastCandle.timestamp;
  const intervalMs = getTimeframeMs(timeframe);
  const expiryTime = signalTime + intervalMs * expiryCandlesCount;
  const signalId = `sig_${symbol.replace(/[\/\-_]/g, '')}_${signalTime}`;

  // Calculate ATR-based Stop Loss & Take Profit when profile uses SPOT_SL_TP output
  let stopLossPrice: number | undefined;
  let takeProfitPrice: number | undefined;
  if (profileConfig.outputMode === 'SPOT_SL_TP' && indicators.atr > 0 && evaluation.direction !== 'WAIT') {
    const slDist = indicators.atr * 1.5;
    const tpDist = indicators.atr * 3.0;
    if (evaluation.direction === 'CALL') {
      stopLossPrice = Number((lastCandle.close - slDist).toFixed(asset.pipDecimals));
      takeProfitPrice = Number((lastCandle.close + tpDist).toFixed(asset.pipDecimals));
    } else {
      stopLossPrice = Number((lastCandle.close + slDist).toFixed(asset.pipDecimals));
      takeProfitPrice = Number((lastCandle.close - tpDist).toFixed(asset.pipDecimals));
    }
  }

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
    strategyVersion: `v2.0.0-${evaluation.profileId}`,
    ruleVersion: evaluation.profileId,
    marketDataSource,
    signalCreatedAt: Date.now(),
    tradingProfileId: evaluation.profileId,
    stopLossPrice,
    takeProfitPrice,
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
    strategyVersion: `v2.0.0-${evaluation.profileId}`,
    ruleVersion: evaluation.profileId,
    marketDataSource,
    tradingProfileId: evaluation.profileId,
    stopLossPrice,
    takeProfitPrice,
    snapshot,
    result: 'PENDING',
  };
}
