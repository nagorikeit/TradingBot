export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
}

export type ClaimType =
  | 'TRADING_RULE'
  | 'MARKET_OBSERVATION'
  | 'RISK_PRINCIPLE'
  | 'TECHNICAL_CONCEPT'
  | 'FUNDAMENTAL_CLAIM'
  | 'MACRO_CLAIM'
  | 'EDUCATIONAL'
  | 'OPINION'
  | 'UNTESTABLE';

export type ClaimTestability = 'TESTABLE' | 'NOT_TESTABLE' | 'INSUFFICIENT_DATA';

export type ClaimStatus = 'EXTRACTED' | 'FORMALIZED' | 'REJECTED' | 'CONTRADICTED';

export interface ResearchClaim {
  claimId: string;
  contentId: string;
  chunkId: string;
  sourceId: string;
  sourceUrl: string;
  claimText: string;
  claimType: ClaimType;
  testability: ClaimTestability;
  testabilityReason?: string;
  extractedAt: number;
  evidenceReferences: {
    title: string;
    authorOrChannel: string;
    chunkIndex: number;
    textSnippet: string;
  };
  status: ClaimStatus;
  ruleCandidateId?: string;
}

export type RuleDirection = 'CALL' | 'PUT';

export interface RuleCondition {
  indicator: 'RSI' | 'EMA' | 'MACD' | 'PRICE_ACTION' | 'CANDLE_COLOR';
  operator: '<' | '>' | '<=' | '>=' | '==' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';
  threshold?: number;
  compareTo?: 'EMA_SLOW' | 'EMA_FAST' | 'PRICE' | 'SIGNAL_LINE' | 'ZERO';
  description: string;
}

export type MarketRegimeType =
  | 'TRENDING'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'BULLISH'
  | 'BEARISH';

export type RuleLifecycleStatus =
  | 'NEW'
  | 'HYPOTHESIS'
  | 'BACKTESTED'
  | 'OOS_VALIDATED'
  | 'WALK_FORWARD_VALIDATED'
  | 'PAPER_VALIDATED'
  | 'TRUSTED_CANDIDATE'
  | 'CONDITIONALLY_VALIDATED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONTRADICTED'
  | 'ARCHIVED';

export interface RuleCandidate {
  ruleId: string;
  sourceClaimId: string;
  name: string;
  description: string;
  version: string;
  previousVersionId?: string;
  direction: RuleDirection;
  timeframe: '1m' | '5m' | '15m';
  expiryCandles: number;
  market: string; // e.g. 'CRYPTO_PAIRS' or 'BTC/USDT'
  conditions: RuleCondition[];
  targetRegimes?: MarketRegimeType[];
  parameters: Record<string, number | string>;
  status: RuleLifecycleStatus;
  createdAt: number;
  updatedAt: number;
  approvedByHuman?: boolean;
  approvalTimestamp?: number;
  approvalNotes?: string;
}

export interface MetricSet {
  totalTrades: number;
  wins: number;
  losses: number;
  draws: number;
  unresolved: number;
  winRate: number; // percentage
  profitFactor: number;
  expectancy: number; // in payout units
  maxDrawdown: number; // percentage
  averageWin: number;
  averageLoss: number;
  sampleSize: number;
  confidenceInterval: ConfidenceInterval;
  sharpeRatio?: number;
}

export interface WalkForwardWindowResult {
  windowIndex: number;
  trainRange: { start: string; end: string };
  testRange: { start: string; end: string };
  trainWinRate: number;
  testWinRate: number;
  tradesInTest: number;
  consistent: boolean;
}

export interface RegimePerformance {
  regime: MarketRegimeType;
  trades: number;
  wins: number;
  winRate: number;
}

export interface RulePostMortem {
  isFailure: boolean;
  failureReason?: string;
  weakestRegime?: MarketRegimeType;
  overfittingDetected: boolean;
  varianceWarning: boolean;
  smallSampleWarning: boolean;
  recommendedAdjustments: string[];
}

export interface RuleValidationRecord {
  validationId: string;
  ruleId: string;
  validatedAt: number;
  inSampleMetrics: MetricSet;
  outOfSampleMetrics: MetricSet;
  oosRetentionRatio: number; // OOS Win Rate / In-Sample Win Rate
  walkForwardResults: WalkForwardWindowResult[];
  walkForwardConsistencyScore: number; // 0 - 100%
  regimeBreakdown: RegimePerformance[];
  evidenceScore: number; // 0 - 100 composite score
  postMortem: RulePostMortem;
  verdict: RuleLifecycleStatus;
  statusNotes: string;
}

export interface RuleEvidenceChain {
  rule: RuleCandidate;
  claim: ResearchClaim;
  contentMetadata: {
    id: string;
    sourceType: string;
    title: string;
    authorOrChannel: string;
    url: string;
    fetchedAt: number;
    contentHash: string;
    untrusted: boolean;
  };
  chunkSnippet: string;
  validationRecord?: RuleValidationRecord;
  memoryLogIds: string[];
}

export interface RuleComparisonResult {
  relationship: 'DUPLICATE' | 'MINOR_VARIATION' | 'IMPROVEMENT_CANDIDATE' | 'CONTRADICTORY' | 'NEW_RULE';
  matchedRuleId?: string;
  matchedRuleName?: string;
  similarityScore: number; // 0 to 1
  rationale: string;
}
