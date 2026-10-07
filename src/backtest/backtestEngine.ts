import {
  Candle,
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  ScoreBreakdownStats,
  DirectionBreakdownStats,
  SymbolBreakdownStats,
  RuleCombinationStats,
  ConfidenceInterval,
  DatasetInfo,
} from '../types';
import { computeIndicators } from '../indicators';
import { evaluateStrategyRules } from '../strategy/signalEngine';
import { getAssetInfo, getTimeframeMs } from '../data/marketDataProvider';

export const DEFAULT_BACKTEST_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'DOGE/USDT',
  'ADA/USDT',
  'AVAX/USDT',
  'LINK/USDT',
  'TRX/USDT',
];

/**
 * Calculates Wilson Score 95% Confidence Interval for historical Win Rate
 * Standard formula for binomial proportions without external statistical dependencies
 */
export function calculateWilsonConfidenceInterval(
  wins: number,
  totalCompleted: number,
  z: number = 1.95996
): ConfidenceInterval {
  if (totalCompleted <= 0) {
    return { lower: 0, upper: 0, confidence: 95 };
  }

  const p = wins / totalCompleted;
  const z2 = z * z;
  const n = totalCompleted;

  const denominator = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  const lower = Math.max(0, Math.min(1, (center - margin) / denominator)) * 100;
  const upper = Math.max(0, Math.min(1, (center + margin) / denominator)) * 100;

  return {
    lower: Number(lower.toFixed(1)),
    upper: Number(upper.toFixed(1)),
    confidence: 95,
  };
}

/**
 * Runs historical validation on a single symbol's candle series
 * Strict Look-Ahead Guard:
 * - Candle i is closed. Indicators are computed only on slice(0, i + 1).
 * - Entry price is strictly candles[i].close.
 * - Future candles (i + expiryCandles) are ONLY accessed to determine outcome.
 * - Missing future candle at dataset boundary is marked UNRESOLVED (NEVER as LOSS).
 * - No artificial skipping: every single historical candle is evaluated sequentially (i++).
 */
export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  return runMultiAssetBacktest([{ symbol: config.symbol, candles }], config);
}

/**
 * Runs historical validation across multiple symbols simultaneously
 */
export function runMultiAssetBacktest(
  dataset: { symbol: string; candles: Candle[] }[],
  config: BacktestConfig
): BacktestResult {
  const minRequiredLookback = 30; // Stabilization window for 26-period EMA & MACD
  const allTrades: BacktestTrade[] = [];
  const processedCandleKeys = new Set<string>();

  let totalCandlesEvaluated = 0;
  let earliestTime = Number.MAX_SAFE_INTEGER;
  let latestTime = 0;
  const testedSymbols: string[] = [];

  // Evaluate each symbol independently
  for (const item of dataset) {
    const { symbol, candles } = item;
    if (!candles || candles.length < minRequiredLookback + 1) continue;

    testedSymbols.push(symbol);
    totalCandlesEvaluated += candles.length;
    const asset = getAssetInfo(symbol);
    const intervalMs = getTimeframeMs(config.timeframe);

    earliestTime = Math.min(earliestTime, candles[0].timestamp);
    latestTime = Math.max(latestTime, candles[candles.length - 1].timestamp);

    // Sequential evaluation of every historical candle (NO step skipping!)
    for (let i = minRequiredLookback; i < candles.length; i++) {
      // 1. Strict Look-Ahead Guard: ONLY candles up to index i are visible
      const historicalSlice = candles.slice(0, i + 1);
      const indicators = computeIndicators(historicalSlice);
      if (!indicators) continue;

      // 2. Existing Strategy Rule Evaluation (Unchanged)
      const evaluation = evaluateStrategyRules(historicalSlice, indicators, asset.pipDecimals);

      // 3. Strict Signal Eligibility: ONLY 4/5 (QUALIFIED) and 5/5 (STRONG)
      // Scores <= 3 are IGNORED/WAIT and never enter statistics
      if ((evaluation.direction === 'CALL' || evaluation.direction === 'PUT') && evaluation.score >= 4) {
        const entryCandle = candles[i];
        const candleTimestamp = entryCandle.timestamp;
        const dedupKey = `${symbol}_${config.timeframe}_${candleTimestamp}`;

        // Deduplication Guard: A candle can produce at most 1 signal
        if (processedCandleKeys.has(dedupKey)) continue;
        processedCandleKeys.add(dedupKey);

        const entryPrice = entryCandle.close;
        const expiryTime = candleTimestamp + config.expiryCandles * intervalMs;
        const exitIndex = i + config.expiryCandles;
        const tier = evaluation.score === 5 ? 'STRONG' : 'QUALIFIED';

        // 4. Outcome Determination
        if (exitIndex < candles.length) {
          const exitCandle = candles[exitIndex];
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

          allTrades.push({
            index: allTrades.length + 1,
            symbol,
            signalTime: candleTimestamp,
            direction: evaluation.direction,
            score: evaluation.score,
            tier,
            entryPrice,
            expiryTime,
            exitPrice,
            result,
            reasons: evaluation.reasons,
          });
        } else {
          // 5. Unresolved Guard: Insufficient future candles available in dataset
          // Must NEVER be classified as LOSS!
          allTrades.push({
            index: allTrades.length + 1,
            symbol,
            signalTime: candleTimestamp,
            direction: evaluation.direction,
            score: evaluation.score,
            tier,
            entryPrice,
            expiryTime,
            exitPrice: undefined,
            result: 'UNRESOLVED',
            reasons: evaluation.reasons,
          });
        }
      }
    }
  }

  // Sort all trades chronologically across all symbols
  allTrades.sort((a, b) => a.signalTime - b.signalTime);
  allTrades.forEach((t, idx) => {
    t.index = idx + 1;
  });

  // Calculate Overall Completed Statistics
  const wins = allTrades.filter((t) => t.result === 'WIN').length;
  const losses = allTrades.filter((t) => t.result === 'LOSS').length;
  const draws = allTrades.filter((t) => t.result === 'DRAW').length;
  const unresolved = allTrades.filter((t) => t.result === 'UNRESOLVED').length;
  const completedSignals = wins + losses + draws;
  const totalSignals = allTrades.length;

  // Win Rate Formula: Wins / (Wins + Losses + Draws) * 100
  const winRate = completedSignals > 0 ? Number(((wins / completedSignals) * 100).toFixed(1)) : 0;
  const confidenceInterval = calculateWilsonConfidenceInterval(wins, completedSignals);

  // Calculate Streaks from completed trades
  let currentWins = 0;
  let maxConsecutiveWins = 0;
  let currentLosses = 0;
  let maxConsecutiveLosses = 0;
  let cumulativeWins = 0;
  let cumulativeLosses = 0;
  const equityCurve: { time: number; winRate: number; cumulativeWins: number; cumulativeLosses: number }[] = [];

  for (const t of allTrades) {
    if (t.result === 'UNRESOLVED') continue;

    if (t.result === 'WIN') {
      currentWins++;
      currentLosses = 0;
      cumulativeWins++;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else if (t.result === 'LOSS') {
      currentLosses++;
      currentWins = 0;
      cumulativeLosses++;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    } else {
      // DRAW resets consecutive streaks
      currentWins = 0;
      currentLosses = 0;
    }

    const currentTotal = cumulativeWins + cumulativeLosses;
    const currentRate = currentTotal > 0 ? Number(((cumulativeWins / currentTotal) * 100).toFixed(1)) : 0;

    equityCurve.push({
      time: t.signalTime,
      winRate: currentRate,
      cumulativeWins,
      cumulativeLosses,
    });
  }

  // Score Breakdown (4/5 QUALIFIED vs 5/5 STRONG)
  const computeScoreStats = (targetScore: 4 | 5, tier: 'QUALIFIED' | 'STRONG'): ScoreBreakdownStats => {
    const list = allTrades.filter((t) => t.score === targetScore);
    const w = list.filter((t) => t.result === 'WIN').length;
    const l = list.filter((t) => t.result === 'LOSS').length;
    const d = list.filter((t) => t.result === 'DRAW').length;
    const u = list.filter((t) => t.result === 'UNRESOLVED').length;
    const comp = w + l + d;
    const wr = comp > 0 ? Number(((w / comp) * 100).toFixed(1)) : 0;
    return {
      score: targetScore,
      tier,
      totalSignals: list.length,
      completed: comp,
      wins: w,
      losses: l,
      draws: d,
      unresolved: u,
      winRate: wr,
    };
  };

  const scoreBreakdown = {
    qualified: computeScoreStats(4, 'QUALIFIED'),
    strong: computeScoreStats(5, 'STRONG'),
  };

  // Direction Breakdown (CALL vs PUT)
  const computeDirectionStats = (dir: 'CALL' | 'PUT'): DirectionBreakdownStats => {
    const list = allTrades.filter((t) => t.direction === dir);
    const w = list.filter((t) => t.result === 'WIN').length;
    const l = list.filter((t) => t.result === 'LOSS').length;
    const d = list.filter((t) => t.result === 'DRAW').length;
    const u = list.filter((t) => t.result === 'UNRESOLVED').length;
    const comp = w + l + d;
    const wr = comp > 0 ? Number(((w / comp) * 100).toFixed(1)) : 0;
    return {
      direction: dir,
      totalSignals: list.length,
      completed: comp,
      wins: w,
      losses: l,
      draws: d,
      unresolved: u,
      winRate: wr,
    };
  };

  const directionBreakdown = {
    call: computeDirectionStats('CALL'),
    put: computeDirectionStats('PUT'),
  };

  // Symbol Breakdown
  const symbolBreakdown: SymbolBreakdownStats[] = testedSymbols.map((sym) => {
    const list = allTrades.filter((t) => t.symbol === sym);
    const w = list.filter((t) => t.result === 'WIN').length;
    const l = list.filter((t) => t.result === 'LOSS').length;
    const d = list.filter((t) => t.result === 'DRAW').length;
    const u = list.filter((t) => t.result === 'UNRESOLVED').length;
    const comp = w + l + d;
    const wr = comp > 0 ? Number(((w / comp) * 100).toFixed(1)) : 0;
    return {
      symbol: sym,
      totalSignals: list.length,
      strongSignals: list.filter((t) => t.score === 5).length,
      qualifiedSignals: list.filter((t) => t.score === 4).length,
      completed: comp,
      wins: w,
      losses: l,
      draws: d,
      unresolved: u,
      winRate: wr,
      callCount: list.filter((t) => t.direction === 'CALL').length,
      putCount: list.filter((t) => t.direction === 'PUT').length,
    };
  });

  // Rule Combination Analysis
  const ruleComboMap = new Map<
    string,
    {
      descriptions: string[];
      direction: 'CALL' | 'PUT';
      count: number;
      wins: number;
      losses: number;
      draws: number;
    }
  >();

  for (const t of allTrades) {
    if (!t.reasons || t.reasons.length === 0) continue;
    // Clean rule titles by stripping specific price values in parentheses
    const ruleNames = t.reasons.map((r) => r.split(' (')[0].trim()).sort();
    const comboKey = `${t.direction}: ` + ruleNames.join(' • ');

    let entry = ruleComboMap.get(comboKey);
    if (!entry) {
      entry = {
        descriptions: ruleNames,
        direction: t.direction,
        count: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      };
      ruleComboMap.set(comboKey, entry);
    }

    entry.count++;
    if (t.result === 'WIN') entry.wins++;
    else if (t.result === 'LOSS') entry.losses++;
    else if (t.result === 'DRAW') entry.draws++;
  }

  const ruleCombinations: RuleCombinationStats[] = Array.from(ruleComboMap.entries())
    .map(([key, val]) => {
      const comp = val.wins + val.losses + val.draws;
      const wr = comp > 0 ? Number(((val.wins / comp) * 100).toFixed(1)) : 0;
      return {
        combinationKey: key,
        ruleDescriptions: val.descriptions,
        direction: val.direction,
        count: val.count,
        wins: val.wins,
        losses: val.losses,
        draws: val.draws,
        winRate: wr,
      };
    })
    .sort((a, b) => b.count - a.count);

  const datasetInfo: DatasetInfo = {
    source: 'Binance Public Market Data API',
    symbols: testedSymbols,
    timeframe: config.timeframe,
    startTime: earliestTime === Number.MAX_SAFE_INTEGER ? 0 : earliestTime,
    endTime: latestTime,
    totalCandles: totalCandlesEvaluated,
    totalSignals,
    completedSignals,
    unresolvedSignals: unresolved,
  };

  return {
    totalSignals,
    completedSignals,
    wins,
    losses,
    draws,
    unresolved,
    winRate,
    confidenceInterval,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    averageSignalStrength: 0,
    datasetInfo,
    scoreBreakdown,
    directionBreakdown,
    symbolBreakdown,
    ruleCombinations,
    trades: allTrades,
    equityCurve,
  };
}
