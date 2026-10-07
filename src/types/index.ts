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

export type BacktestOutcome = 'WIN' | 'LOSS' | 'DRAW' | 'UNRESOLVED';

export interface BacktestConfig {
  symbol: string; // 'ALL' or specific symbol
  timeframe: TimeframeKey;
  candleCount: number;
  expiryCandles: number;
  minScoreThreshold: number; // 4 = QUALIFIED, 5 = STRONG
}

export interface BacktestTrade {
  index: number;
  symbol: string;
  signalTime: number;
  direction: 'CALL' | 'PUT';
  score: number; // 4 or 5
  tier: 'STRONG' | 'QUALIFIED';
  entryPrice: number;
  expiryTime: number;
  exitPrice?: number;
  result: BacktestOutcome;
  reasons: string[];
}

export interface ScoreBreakdownStats {
  score: 4 | 5;
  tier: 'QUALIFIED' | 'STRONG';
  totalSignals: number;
  completed: number;
  wins: number;
  losses: number;
  draws: number;
  unresolved: number;
  winRate: number;
}

export interface DirectionBreakdownStats {
  direction: 'CALL' | 'PUT';
  totalSignals: number;
  completed: number;
  wins: number;
  losses: number;
  draws: number;
  unresolved: number;
  winRate: number;
}

export interface SymbolBreakdownStats {
  symbol: string;
  totalSignals: number;
  strongSignals: number;
  qualifiedSignals: number;
  completed: number;
  wins: number;
  losses: number;
  draws: number;
  unresolved: number;
  winRate: number;
  callCount: number;
  putCount: number;
}

export interface RuleCombinationStats {
  combinationKey: string;
  ruleDescriptions: string[];
  direction: 'CALL' | 'PUT';
  count: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
}

export interface DatasetInfo {
  source: string;
  symbols: string[];
  timeframe: TimeframeKey;
  startTime: number;
  endTime: number;
  totalCandles: number;
  totalSignals: number;
  completedSignals: number;
  unresolvedSignals: number;
}

export interface BacktestResult {
  totalSignals: number;
  completedSignals: number;
  wins: number;
  losses: number;
  draws: number;
  unresolved: number;
  winRate: number; // Wins / (Wins + Losses + Draws) * 100
  confidenceInterval: ConfidenceInterval;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageSignalStrength: number;
  datasetInfo: DatasetInfo;
  scoreBreakdown: {
    qualified: ScoreBreakdownStats;
    strong: ScoreBreakdownStats;
  };
  directionBreakdown: {
    call: DirectionBreakdownStats;
    put: DirectionBreakdownStats;
  };
  symbolBreakdown: SymbolBreakdownStats[];
  ruleCombinations: RuleCombinationStats[];
  trades: BacktestTrade[];
  equityCurve: { time: number; winRate: number; cumulativeWins: number; cumulativeLosses: number }[];
}

export type ScannerSignalTier = 'STRONG' | 'QUALIFIED';

export interface ScannerSignal {
  id: string;
  symbol: string;
  timeframe: TimeframeKey;
  direction: 'CALL' | 'PUT';
  score: number; // 4 or 5
  maxScore: number; // 5
  tier: ScannerSignalTier;
  entryPrice: number;
  candleTimestamp: number;
  signalTimestamp: number;
  expiryTime: number;
  expiryCandles: number;
  indicators: IndicatorValues;
  reasons: string[];
  isConfirmed: boolean;
}

export interface MonitoredPairStatus {
  symbol: string;
  name: string;
  price: number;
  currentDirection: SignalDirection;
  currentScore: number;
  candleCount: number;
  isConnected: boolean;
  lastUpdated: number;
}

