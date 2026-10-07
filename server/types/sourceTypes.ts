export type SourceType =
  | 'WEBSITE'
  | 'RSS'
  | 'YOUTUBE'
  | 'RESEARCH'
  | 'BLOG'
  | 'NEWS'
  | 'COMMUNITY'
  | 'DOCUMENTATION'
  | 'OTHER';

export type SourceCategory =
  | 'FOREX'
  | 'CURRENCY'
  | 'MACROECONOMICS'
  | 'TRADING'
  | 'TECHNICAL_ANALYSIS'
  | 'FUNDAMENTAL_ANALYSIS'
  | 'RISK_MANAGEMENT'
  | 'MARKET_NEWS'
  | 'EDUCATION'
  | 'RESEARCH'
  | 'MARKET_STRUCTURE'
  | 'OTHER';

export type SourceStatus =
  | 'DISCOVERED'
  | 'UNDER_REVIEW'
  | 'TRUSTED'
  | 'MONITORED'
  | 'PAUSED'
  | 'BLOCKED'
  | 'ARCHIVED';

export type AuthorityLevel =
  | 'TIER_1_OFFICIAL'
  | 'TIER_2_ESTABLISHED'
  | 'TIER_3_COMMUNITY'
  | 'UNVERIFIED';

export interface RegisteredSource {
  id: string;
  name: string;
  url: string;
  normalizedUrl: string;
  sourceType: SourceType;
  categories: SourceCategory[];
  status: SourceStatus;
  trustScore: number; // 0.0 - 1.0 numerical trust indicator
  authorityLevel: AuthorityLevel;
  lastReviewedAt?: number;
  lastCheckedAt?: number;
  reviewNotes?: string;
  reviewReason?: string;
  evidenceLinks?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SourceReviewItem {
  sourceId: string;
  name: string;
  url: string;
  reason: string;
  discoveredAt: number;
  discoveredBy: 'AI_AGENT' | 'SYSTEM' | 'USER';
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_REVIEW';
  reviewNotes?: string;
  evidence?: string[];
}

export type SchedulerJobStatus =
  | 'IDLE'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export interface SchedulerConfig {
  enabled: boolean;
  dailyRunTime: string; // "HH:MM" 24h format (e.g. "02:00")
  timezone: string;     // IANA Timezone string (e.g. "Asia/Dhaka")
  lastRunAt?: number;
  nextRunAt?: number;
  lastStatus: SchedulerJobStatus;
  lastError?: string;
  lastExecutionDurationMs?: number;
}

export interface SchedulerStatusResponse {
  config: SchedulerConfig;
  isRunning: boolean;
  isLocked: boolean;
  lockAcquiredAt?: number;
  nextScheduledInMs?: number;
  uptimeSeconds: number;
}

export interface SourceRegistryStats {
  totalSources: number;
  byStatus: Record<SourceStatus, number>;
  byType: Record<SourceType, number>;
  pendingReviewCount: number;
}
