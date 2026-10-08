export type KnowledgeStatus = 
  | 'NEW'
  | 'REVIEW_REQUIRED'
  | 'HYPOTHESIS'
  | 'VALIDATED'
  | 'CONTRADICTED'
  | 'ARCHIVED';

export type KnowledgeSourceType =
  | 'BOOK'
  | 'RESEARCH_PAPER'
  | 'ARTICLE'
  | 'NEWS'
  | 'YOUTUBE_TRANSCRIPT'
  | 'MARKET_RESEARCH'
  | 'EDUCATIONAL'
  | 'OTHER';

export type EpistemicType =
  | 'FACT'
  | 'REASONING_HYPOTHESIS'
  | 'RULE_CLAIM'
  | 'EMPIRICAL_TEST';

export interface KnowledgeItem {
  id: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceName: string;
  sourceUrl?: string;
  publishedAt?: string;
  collectedAt: number;
  topic: string;
  market?: string;
  timeframe?: string;
  content: string;
  summary: string;
  tags: string[];
  evidence: string[];
  status: KnowledgeStatus;
  epistemicType: EpistemicType;
  contentHash: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  authoritativeRating?: number; // 0.0 - 1.0 (never 1.0 for unverified claims)
}

export interface KnowledgeVersion {
  versionId: string;
  knowledgeId: string;
  versionNumber: number;
  previousContent: string;
  newContent: string;
  changedAt: number;
  changeReason: string;
  evidence: string[];
  changedBy: string;
}

export type MemoryCategory =
  | 'DECISION'
  | 'TRADE'
  | 'MISTAKE'
  | 'SUCCESS_PATTERN'
  | 'IMPROVEMENT';

export interface AgentMemoryItem {
  id: string;
  category: MemoryCategory;
  timestamp: number;
  market: string;
  symbol?: string;
  timeframe: string;
  context: string;
  observation: string; // Strictly observed factual market state
  decision: string;    // Action/decision evaluated or proposed
  outcome?: string;    // Actual observed result
  evidence: string[];
  confidence: number;  // 0.0 - 1.0
  relatedKnowledgeIds: string[];
  isFact: boolean;     // Explicit flag distinguishing observed facts from AI speculation
  reasoning?: string;  // AI hypothesis or analytical deductions
}

export interface MarketMemoryItem {
  id: string;
  symbol: string;
  market: string;
  timeframe: string;
  setup: string;
  marketCondition: string; // e.g. TRENDING_BULLISH, HIGH_VOLATILITY, RANGE_BOUND
  candleContext: string;
  technicalContext: string;
  newsContext?: string;
  historicalOutcome: string;
  observationCount: number;
  winningCount: number;
  losingCount: number;
  drawCount: number;
  lastObserved: number;
  evidenceReferences: string[];
  // Phase 2E-B: Strict separation of Market Observation vs Trade Outcome
  memoryType?: 'TRADE_OUTCOME' | 'MARKET_OBSERVATION';
  tradeOutcome?: 'WIN' | 'LOSS' | 'DRAW' | null;
}

export type KnowledgeComparisonType = 'AGREEMENT' | 'CONTRADICTION_CANDIDATE' | 'NEW_OBSERVATION';

export interface KnowledgeComparisonItem {
  knowledgeId: string;
  knowledgeTitle: string;
  topic: string;
  observationId: string;
  symbol: string;
  timeframe: string;
  comparisonResult: KnowledgeComparisonType;
  explanation: string;
  evidenceReferences: string[];
}

export type MarketMemoryComparisonType = 'NEW' | 'REPEATED' | 'CONSISTENT' | 'DIFFERENT' | 'POSSIBLE_CONTRADICTION';

export interface MarketMemoryComparisonItem {
  memoryId?: string;
  observationId: string;
  symbol: string;
  timeframe: string;
  setup: string;
  comparisonResult: MarketMemoryComparisonType;
  priorObservationCount: number;
  explanation: string;
}

export interface ValidationEvidenceReference {
  validationId: string;
  ruleId: string;
  status: 'Evidence Available'; // Strictly Evidence Available, NOT 'VALIDATED'
  phase2dVerdict: string;
  sampleSize: number;
  wins: number;
  losses: number;
  draws: number;
  unresolved: number;
  inSampleWinRate: number;
  outOfSampleWinRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  oosRetentionRatio: number;
  evidenceStatus?: 'AVAILABLE' | 'INSUFFICIENT';
}

export interface LearningContradiction {
  topic: string;
  observation: string;
  contradictedPrinciple: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RepeatedMarketPattern {
  patternName: string;
  occurrences: number;
  symbols: string[];
  regime: string;
  description: string;
}

export interface LearningLesson {
  lesson: string;
  context: string;
  preventiveAction: string;
}

export interface PotentialHypothesis {
  hypothesisId: string;
  statement: string;
  rationale: string;
  evidenceIds: string[];
  targetSymbols?: string[];
  suggestedRegime?: string;
  createdAt: number;
}

export interface DailyLearningSession {
  sessionId: string;
  startTime: number;
  endTime: number;
  sourcesProcessed: number;
  newKnowledgeCount: number;
  updatedKnowledgeCount: number;
  contradictionsFound: number;
  importantMarketObservations: string[];
  summary: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  // Phase 2E-B structured learning additions:
  importantFindings?: string[];
  contradictions?: LearningContradiction[];
  repeatedPatterns?: RepeatedMarketPattern[];
  mistakesOrLessons?: LearningLesson[];
  hypothesesGenerated?: PotentialHypothesis[];
  knowledgeComparisons?: KnowledgeComparisonItem[];
  marketMemoryComparisons?: MarketMemoryComparisonItem[];
  validationEvidenceReferences?: ValidationEvidenceReference[];
  researchAcquisitionResults?: {
    attemptedCount: number;
    successCount: number;
    failedCount: number;
    sourcesProcessed: string[];
    failures: Array<{ sourceId: string; sourceName: string; error: string }>;
  };
  metrics?: {
    observationsAnalyzed: number;
    memoriesConsulted: number;
    knowledgeItemsConsulted: number;
    validationsConsulted: number;
    knowledgeComparisonsCount?: number;
    marketMemoryComparisonsCount?: number;
    freshClosedCandlesAnalyzed?: number;
  };
}

export interface RetrievalQuery {
  market?: string;
  symbol?: string;
  timeframe?: string;
  topic?: string;
  setup?: string;
  query?: string;
  currentMarketContext?: string;
  limit?: number;
  statusFilter?: KnowledgeStatus[];
}

export interface RetrievalResult {
  relevantKnowledge: KnowledgeItem[];
  relevantMemories: AgentMemoryItem[];
  relevantMarketMemories: MarketMemoryItem[];
  querySummary: string;
  totalMatches: number;
  timestamp: number;
}

export interface KnowledgeProposal {
  id: string;
  type: 'KNOWLEDGE_STATUS_CHANGE' | 'NEW_HYPOTHESIS' | 'STRATEGY_IMPROVEMENT_PROPOSAL';
  title: string;
  description: string;
  evidence: string[];
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  proposedBy: 'AI_AGENT' | 'SYSTEM';
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export interface AgentSystemStats {
  phase: string;
  knowledgeCount: number;
  knowledgeStatusBreakdown: Record<KnowledgeStatus, number>;
  memoryCount: number;
  memoryCategoryBreakdown: Record<MemoryCategory, number>;
  marketMemoryCount: number;
  learningSessionCount: number;
  pendingProposalsCount: number;
  uptimeSeconds: number;
}
