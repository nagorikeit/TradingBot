/**
 * Phase 2E-A: Market Observation Engine Types
 * Pure type definitions for deterministic market observation and regime heuristics.
 *
 * NOTE: These observations and regime classifications are observation heuristics for
 * data logging and learning, NOT validated trading rules and NOT trade execution signals.
 */

export type MarketRegime =
  | 'TRENDING_BULLISH'
  | 'TRENDING_BEARISH'
  | 'RANGING_CONSOLIDATION'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'UNCERTAIN';

export type ObservationType =
  | 'REGIME_CLASSIFICATION'
  | 'BULLISH_REJECTION_WICK'
  | 'BEARISH_REJECTION_WICK'
  | 'BULLISH_ENGULFING'
  | 'BEARISH_ENGULFING'
  | 'VOLUME_ANOMALY'
  | 'POSSIBLE_BREAKOUT'
  | 'POSSIBLE_REJECTION'
  | 'VOLATILITY_STATE';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSnapshot {
  ema9: number;
  ema21: number;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  atr: number;
  volume: number;
  volumeSma20: number;
}

export interface MarketObservation {
  observationId: string;
  symbol: string;
  timeframe: string;
  candleTimestamp: number;
  observationType: ObservationType;
  observationText: string;
  isFact: boolean; // Strictly true ONLY for OHLCV, candle timestamp, indicators, derived math
  reasoning: string; // Heuristics and analytical deductions (never marked as fact)
  regime: MarketRegime;
  indicatorSnapshot: IndicatorSnapshot;
  source: string; // e.g. 'BINANCE_REST', 'BINANCE_WS', 'SCANNER_STREAM'
  createdAt: number;
}

export interface RegimeSummaryItem {
  symbol: string;
  timeframe: string;
  regime: MarketRegime;
  lastUpdated: number;
  latestPrice: number;
  indicators: {
    ema9: number;
    ema21: number;
    rsi: number;
    macdHistogram: number;
    atr: number;
    volumeRatio: number;
  };
  observationCount: number;
  dominantObservations: string[];
}
