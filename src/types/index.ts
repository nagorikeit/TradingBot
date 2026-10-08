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

export type SignalTier = 'STRONG' | 'QUALIFIED' | 'WAIT';

export type SignalResult = 'WIN' | 'LOSS' | 'DRAW' | 'PENDING';

export interface EvaluatedRuleItem {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  valueText: string;
  failReason?: string;
}

export interface SignalSnapshot {
  signalId: string;
  symbol: string;
  timeframe: string;
  candleTimestamp: number;
  entryPrice: number;
  candle: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };
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
  ruleScore: number;
  scoreRatio: string;
  tier: SignalTier;
  direction: SignalDirection;
  triggeredRules: string[];
  allRulesEvaluated: EvaluatedRuleItem[];
  expiryTime: number;
  expiryCandles: number;
  strategyVersion: string;
  ruleVersion: string;
  marketDataSource: string;
  signalCreatedAt: number;
}

export interface Signal {
  id: string;
  symbol: string;
  timeframe: string;
  direction: SignalDirection;
  signalStrength: number; // Normalized score alignment (0-100)
  confidenceScore: number; // Score ratio percentage
  scoreRatio: string; // e.g. "5/5", "4/5", "3/5", "2/5"
  tier?: SignalTier; // 'STRONG' | 'QUALIFIED' | 'WAIT'
  entryPrice: number;
  signalTime: number; // candleTimestamp
  candleTimestamp?: number;
  expiryTime: number; // timestamp
  expiryCandles: number; // candles forward (default 1)
  indicators: IndicatorValues;
  reasons: string[];
  rulesEvaluated?: EvaluatedRuleItem[];
  strategyVersion?: string;
  ruleVersion?: string;
  marketDataSource?: string;
  snapshot?: SignalSnapshot;
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
  snapshot?: SignalSnapshot;
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

