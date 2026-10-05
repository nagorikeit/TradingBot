export interface Candle {
  timestamp: number; // Unix epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
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
  };
  atr: number;
}

export type SignalDirection = 'CALL' | 'PUT' | 'WAIT';

export type SignalStrengthTier = 'Very Strong' | 'Strong' | 'Moderate' | 'None';

export type SignalResult = 'WIN' | 'LOSS' | 'DRAW' | 'PENDING';

export interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: SignalDirection;
  signalStrength: number; // e.g. 84 (%)
  confidenceScore: number; // e.g. 5/5 = 100, 4/5 = 80, 3/5 = 60
  scoreRatio: string; // e.g. "5/5", "4/5", "3/5", "2/5"
  entryPrice: number;
  signalTime: number; // timestamp
  expiryTime: number; // timestamp
  expiryCandles: number; // candles forward (default 1)
  indicators: IndicatorValues;
  reasons: string[];
  result?: SignalResult;
  exitPrice?: number;
  evaluatedAt?: number;
}

export interface AssetInfo {
  symbol: string;
  name: string;
  category: 'FOREX' | 'CRYPTO';
  pipDecimals: number;
  basePrice: number;
  spread: number;
}

export type TimeframeKey = '1m' | '5m' | '15m';

export interface BacktestConfig {
  symbol: string;
  timeframe: TimeframeKey;
  candleCount: number;
  expiryCandles: number;
  minScoreThreshold: number; // 3 = Moderate, 4 = Strong, 5 = Very Strong
}

export interface BacktestTrade {
  index: number;
  signalTime: number;
  direction: 'CALL' | 'PUT';
  entryPrice: number;
  expiryTime: number;
  exitPrice: number;
  result: 'WIN' | 'LOSS' | 'DRAW';
  score: number;
  reasons: string[];
}

export interface BacktestResult {
  totalSignals: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // percentage e.g. 62.5
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageSignalStrength: number;
  trades: BacktestTrade[];
  equityCurve: { time: number; winRate: number; cumulativeWins: number; cumulativeLosses: number }[];
}
