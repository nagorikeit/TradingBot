import { Candle, BacktestConfig, BacktestResult, BacktestTrade } from '../types';
import { computeIndicators } from '../indicators';
import { evaluateStrategyRules } from '../strategy/signalEngine';
import { getAssetInfo, getTimeframeMs } from '../data/marketDataProvider';

export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  const asset = getAssetInfo(config.symbol);
  const minRequiredLookback = 30; // To allow 26-period EMA & MACD to stabilize
  const trades: BacktestTrade[] = [];

  const startIndex = minRequiredLookback;
  const endIndex = candles.length - config.expiryCandles;

  let currentConsecutiveWins = 0;
  let maxConsecutiveWins = 0;
  let currentConsecutiveLosses = 0;
  let maxConsecutiveLosses = 0;

  let totalStrengthSum = 0;
  let cumulativeWins = 0;
  let cumulativeLosses = 0;

  const equityCurve: { time: number; winRate: number; cumulativeWins: number; cumulativeLosses: number }[] = [];

  // Iterate candle-by-candle with lookahead guard
  for (let i = startIndex; i < endIndex; i++) {
    const historicalSlice = candles.slice(0, i + 1);
    const indicators = computeIndicators(historicalSlice);
    if (!indicators) continue;

    const evaluation = evaluateStrategyRules(historicalSlice, indicators, asset.pipDecimals);

    // Only take trade if direction is actionable (CALL or PUT) and meets minimum score threshold
    if ((evaluation.direction === 'CALL' || evaluation.direction === 'PUT') && evaluation.score >= config.minScoreThreshold) {
      const entryCandle = candles[i];
      const exitCandle = candles[i + config.expiryCandles];

      const entryPrice = entryCandle.close;
      const exitPrice = exitCandle.close;

      let result: 'WIN' | 'LOSS' | 'DRAW' = 'DRAW';

      if (evaluation.direction === 'CALL') {
        if (exitPrice > entryPrice) {
          result = 'WIN';
        } else if (exitPrice < entryPrice) {
          result = 'LOSS';
        } else {
          result = 'DRAW';
        }
      } else if (evaluation.direction === 'PUT') {
        if (exitPrice < entryPrice) {
          result = 'WIN';
        } else if (exitPrice > entryPrice) {
          result = 'LOSS';
        } else {
          result = 'DRAW';
        }
      }

      // Track streaks
      if (result === 'WIN') {
        cumulativeWins++;
        currentConsecutiveWins++;
        currentConsecutiveLosses = 0;
        if (currentConsecutiveWins > maxConsecutiveWins) {
          maxConsecutiveWins = currentConsecutiveWins;
        }
      } else if (result === 'LOSS') {
        cumulativeLosses++;
        currentConsecutiveLosses++;
        currentConsecutiveWins = 0;
        if (currentConsecutiveLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentConsecutiveLosses;
        }
      }

      totalStrengthSum += evaluation.signalStrength;

      const currentWinRate =
        cumulativeWins + cumulativeLosses > 0
          ? Number(((cumulativeWins / (cumulativeWins + cumulativeLosses)) * 100).toFixed(1))
          : 0;

      equityCurve.push({
        time: exitCandle.timestamp,
        winRate: currentWinRate,
        cumulativeWins,
        cumulativeLosses,
      });

      trades.push({
        index: trades.length + 1,
        signalTime: entryCandle.timestamp,
        direction: evaluation.direction,
        entryPrice,
        expiryTime: exitCandle.timestamp,
        exitPrice,
        result,
        score: evaluation.score,
        reasons: evaluation.reasons,
      });

      // Avoid overlapping duplicate triggers on the exact same run if wanted, or step forward
      // Advance by 1 or expiryCandles to prevent duplicate trades in identical window
      i += Math.max(1, Math.floor(config.expiryCandles / 2));
    }
  }

  const wins = trades.filter((t) => t.result === 'WIN').length;
  const losses = trades.filter((t) => t.result === 'LOSS').length;
  const draws = trades.filter((t) => t.result === 'DRAW').length;
  const resolved = wins + losses;
  const winRate = resolved > 0 ? Number(((wins / resolved) * 100).toFixed(1)) : 0;
  const averageSignalStrength = trades.length > 0 ? Math.round(totalStrengthSum / trades.length) : 0;

  return {
    totalSignals: trades.length,
    wins,
    losses,
    draws,
    winRate,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    averageSignalStrength,
    trades,
    equityCurve,
  };
}
