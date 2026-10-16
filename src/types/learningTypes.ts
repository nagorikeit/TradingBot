export type LearningCategory =
  | 'CANDLESTICK'
  | 'INDICATOR'
  | 'SUPPORT_RESISTANCE'
  | 'PRICE_ACTION'
  | 'OTC_TRAP';

export type RuleStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'REVISED';

export interface LearnedStrategyRule {
  ruleId: string;
  titleBn: string;
  category: LearningCategory;
  summaryBn: string;
  conditionsBn: string[];
  recommendedDirection: 'CALL' | 'PUT' | 'WAIT';
  confidenceWeight: number; // 0.0 to 1.0 (e.g., 0.88)
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number; // calculated percentage
  cautionaryNotesBn: string[];
  lastMistakeReflectionBn?: string;
  createdAt: number;
  lastUpdated: number;
  status: RuleStatus;
  learnedFromFailureCount: number;
}

export interface TradeMistakeReflection {
  reflectionId: string;
  timestamp: number;
  symbol: string;
  direction: 'CALL' | 'PUT';
  suggestedExpiry: string;
  expectedPatternBn: string;
  actualOutcome: 'LOSS';
  failureReasonBn: string;
  correctiveActionBn: string;
  adjustedRuleId?: string;
  confidencePenaltyPercent: number;
  marketConditionBn: string;
}

export interface LearningHubStats {
  totalRules: number;
  activeRules: number;
  revisedRules: number;
  totalReflections: number;
  overallWinRate: number;
  lastLearningTimestamp: number;
}
