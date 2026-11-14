import { TradingProfileId } from '../strategy/tradingProfiles';

export type LearningCategory =
  | 'CANDLESTICK'
  | 'INDICATOR'
  | 'SUPPORT_RESISTANCE'
  | 'PRICE_ACTION'
  | 'OTC_TRAP';

export type RuleStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'REVISED';

export type ReviewWindowDays = 7 | 30;

export interface LearnedStrategyRule {
  ruleId: string;
  profileId: TradingProfileId;
  titleBn: string;
  category: LearningCategory;
  summaryBn: string;
  conditionsBn: string[];
  recommendedDirection: 'CALL' | 'PUT' | 'WAIT';
  confidenceWeight: number; // 0.65 to 0.96
  ruleWeightMultiplier: number; // 0.70 to 1.25 (evolves strictly on 7d/30d cohort review)
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
  profileId: TradingProfileId;
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
  ruleLockedDeferred?: boolean;
  marketConditionBn: string;
}

export interface SignalOutcomeRecord {
  id: string;
  profileId: TradingProfileId;
  symbol: string;
  direction: 'CALL' | 'PUT';
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  patternName?: string;
  matchedRuleId?: string;
  timestamp: number;
  source?: string;
  customNote?: string;
}

export interface ProfileReviewPolicy {
  profileId: TradingProfileId;
  reviewWindowDays: ReviewWindowDays; // 7 or 30 days
  minSignalsRequired: number; // 15 for 7d, 30 for 30d
  lastRuleUpdateAt: number;
  nextEligibleUpdateAt: number;
  signalsLoggedSinceUpdate: number;
  rulesLocked: boolean;
  lastCohortVerdictBn?: string;
}

export interface CohortAuditRecord {
  auditId: string;
  profileId: TradingProfileId;
  timestamp: number;
  windowDays: ReviewWindowDays;
  signalsEvaluated: number;
  winRate: number;
  rulesAdjustedCount: number;
  newCautionAddedCount: number;
  summaryBn: string;
}

export interface ProfileLearningSummary {
  profileId: TradingProfileId;
  policy: ProfileReviewPolicy;
  cohortSignalsCount: number;
  cohortWins: number;
  cohortLosses: number;
  cohortWinRate: number;
  daysRemaining: number;
  sampleProgressPercent: number;
  readyForAutoEvolution: boolean;
  latestAudits: CohortAuditRecord[];
}

export interface LearningHubStats {
  totalRules: number;
  activeRules: number;
  revisedRules: number;
  totalReflections: number;
  totalLoggedSignals: number;
  overallWinRate: number;
  lastLearningTimestamp: number;
}
