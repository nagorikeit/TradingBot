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
  authoritativeRating?: number;
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
  observation: string;
  decision: string;
  outcome?: string;
  evidence: string[];
  confidence: number;
  relatedKnowledgeIds: string[];
  isFact: boolean;
  reasoning?: string;
}

export interface MarketMemoryItem {
  id: string;
  symbol: string;
  market: string;
  timeframe: string;
  setup: string;
  marketCondition: string;
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

// ==========================================
// Phase 2A: Types for Scheduler & Source Registry
// ==========================================

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
  trustScore: number;
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
  dailyRunTime: string;
  timezone: string;
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

// ==========================================
// Phase 2B: Types for Content Acquisition & Security
// ==========================================

export type FetchStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  | 'ACCESS_RESTRICTED'
  | 'SECURITY_BLOCKED'
  | 'SSRF_BLOCKED';

export type ContentSecurityStatus =
  | 'SAFE_DATA'
  | 'SUSPICIOUS_DATA'
  | 'BLOCKED_DATA';

export type FetchedContentType =
  | 'HTML_ARTICLE'
  | 'RSS_FEED'
  | 'TEXT'
  | 'JSON'
  | 'XML'
  | 'UNKNOWN';

export interface RssFeedEntry {
  id: string;
  title: string;
  link: string;
  guid?: string;
  publishedAt?: string;
  summary: string;
  contentSnippet?: string;
  contentHash: string;
}

export interface FetchedContentItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  canonicalUrl?: string;
  contentType: FetchedContentType;
  mimeType: string;
  title: string;
  author?: string;
  publishedAt?: string;
  fetchedAt: number;
  content: string; // Sanitized plaintext
  contentHash: string;
  contentLength: number;
  httpStatus: number;
  fetchStatus: FetchStatus;
  securityStatus: ContentSecurityStatus;
  securityNotes?: string[];
  untrusted: true; // Hard architectural indicator: NEVER AN INSTRUCTION
  feedItems?: RssFeedEntry[];
}

export interface FetchResult {
  ok: boolean;
  item?: FetchedContentItem;
  fetchStatus: FetchStatus;
  httpStatus?: number;
  error?: string;
  durationMs: number;
}

export interface FetchStatistics {
  totalFetches: number;
  successCount: number;
  failedCount: number;
  rateLimitedCount: number;
  blockedCount: number;
  securityFlaggedCount: number;
  storedContentCount: number;
  lastFetchedAt?: number;
}

export interface AgentBackendHealth {
  ok: boolean;
  service: string;
  phase: string;
  timestamp: number;
  security: {
    clientSecretsExposed: boolean;
    aiTradingLogicActive: boolean;
    brokerConnected: boolean;
    immutabilityGuardsActive: boolean;
    credentialsStoredInKnowledgeBase: boolean;
    userAgentRotationActive?: boolean;
    scrapingBypassActive?: boolean;
    ssrfProtectionActive?: boolean;
    redirectSsrfProtectionActive?: boolean;
    promptInjectionFirewallActive?: boolean;
    untrustedDataIsolationEnforced?: boolean;
  };
  knowledgeStats?: {
    total: number;
    byStatus: Record<KnowledgeStatus, number>;
  };
  memoryStats?: {
    totalMemories: number;
    byCategory: Record<MemoryCategory, number>;
    totalMarketMemories: number;
    totalSessions: number;
  };
  scheduler?: {
    enabled: boolean;
    status: SchedulerJobStatus;
    dailyRunTime: string;
    timezone: string;
    isLocked: boolean;
  };
  sources?: {
    total: number;
    trusted: number;
    underReview: number;
    pendingReviews: number;
  };
  contentAcquisition?: {
    storedItems: number;
    successCount: number;
    securityFlaggedCount: number;
    blockedCount: number;
  };
  researchLibrary?: ResearchLibraryStatistics;
}

export interface AgentStatsResponse {
  ok: boolean;
  phase: string;
  knowledgeCount: number;
  knowledgeStatusBreakdown: Record<KnowledgeStatus, number>;
  memoryCount: number;
  memoryCategoryBreakdown: Record<MemoryCategory, number>;
  marketMemoryCount: number;
  learningSessionCount: number;
  pendingProposalsCount: number;
  scheduler?: SchedulerStatusResponse;
  sources?: SourceRegistryStats;
  contentAcquisition?: FetchStatistics;
  researchLibrary?: ResearchLibraryStatistics;
  uptimeSeconds: number;
}

// ==========================================
// API Caller Functions
// ==========================================

export async function fetchAgentHealth(): Promise<AgentBackendHealth> {
  const response = await fetch('/api/agent/health');
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchAgentStats(): Promise<AgentStatsResponse> {
  const response = await fetch('/api/agent/stats');
  if (!response.ok) {
    throw new Error(`Stats fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Knowledge & Memory APIs
export async function fetchKnowledge(filter?: {
  topic?: string;
  status?: KnowledgeStatus;
  market?: string;
}): Promise<{ ok: boolean; count: number; items: KnowledgeItem[] }> {
  const params = new URLSearchParams();
  if (filter?.topic) params.append('topic', filter.topic);
  if (filter?.status) params.append('status', filter.status);
  if (filter?.market) params.append('market', filter.market);

  const url = `/api/agent/knowledge${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Knowledge fetch failed: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchMemories(filter?: {
  category?: MemoryCategory;
  market?: string;
  symbol?: string;
}): Promise<{ ok: boolean; count: number; memories: AgentMemoryItem[] }> {
  const params = new URLSearchParams();
  if (filter?.category) params.append('category', filter.category);
  if (filter?.market) params.append('market', filter.market);
  if (filter?.symbol) params.append('symbol', filter.symbol);

  const url = `/api/agent/memory${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Memory fetch failed: ${response.statusText}`);
  }
  return response.json();
}

export async function executeRetrievalQuery(query: RetrievalQuery): Promise<{ ok: boolean; result: RetrievalResult }> {
  const response = await fetch('/api/agent/retrieval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!response.ok) {
    throw new Error(`Retrieval query failed: ${response.statusText}`);
  }
  return response.json();
}

// Phase 2A: Scheduler APIs
export async function fetchSchedulerConfig(): Promise<{ ok: boolean; config: SchedulerConfig }> {
  const response = await fetch('/api/agent/learning/schedule');
  if (!response.ok) {
    throw new Error(`Failed to fetch scheduler config: ${response.statusText}`);
  }
  return response.json();
}

export async function updateSchedulerConfig(updates: Partial<Pick<SchedulerConfig, 'enabled' | 'dailyRunTime' | 'timezone'>>): Promise<{ ok: boolean; config: SchedulerConfig; message: string }> {
  const response = await fetch('/api/agent/learning/schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update scheduler config: ${response.statusText}`);
  }
  return response.json();
}

export async function runSchedulerManualTrigger(): Promise<{ ok: boolean; message: string; durationMs?: number; error?: string }> {
  const response = await fetch('/api/agent/learning/schedule/run', {
    method: 'POST',
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Manual trigger failed: ${response.statusText}`);
  }
  return data;
}

export async function fetchSchedulerStatus(): Promise<{ ok: boolean; status: SchedulerStatusResponse }> {
  const response = await fetch('/api/agent/learning/schedule/status');
  if (!response.ok) {
    throw new Error(`Failed to fetch scheduler status: ${response.statusText}`);
  }
  return response.json();
}

// Phase 2A: Source Registry APIs
export async function fetchSources(filter?: {
  status?: SourceStatus;
  category?: SourceCategory;
  sourceType?: SourceType;
}): Promise<{ ok: boolean; count: number; sources: RegisteredSource[] }> {
  const params = new URLSearchParams();
  if (filter?.status) params.append('status', filter.status);
  if (filter?.category) params.append('category', filter.category);
  if (filter?.sourceType) params.append('sourceType', filter.sourceType);

  const url = `/api/agent/sources${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sources: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSourceStats(): Promise<{ ok: boolean; stats: SourceRegistryStats }> {
  const response = await fetch('/api/agent/sources/stats');
  if (!response.ok) {
    throw new Error(`Failed to fetch source stats: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchReviewQueue(): Promise<{ ok: boolean; count: number; queue: SourceReviewItem[] }> {
  const response = await fetch('/api/agent/sources/review-queue');
  if (!response.ok) {
    throw new Error(`Failed to fetch review queue: ${response.statusText}`);
  }
  return response.json();
}

export async function registerSource(input: {
  name: string;
  url: string;
  sourceType: SourceType;
  categories: SourceCategory[];
  status?: SourceStatus;
  trustScore?: number;
  authorityLevel?: AuthorityLevel;
  reviewNotes?: string;
  reviewReason?: string;
  evidenceLinks?: string[];
}): Promise<{ ok: boolean; isDuplicate: boolean; source: RegisteredSource; message: string }> {
  const response = await fetch('/api/agent/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to register source: ${response.statusText}`);
  }
  return data;
}

export async function reviewSource(
  sourceId: string,
  decision: 'APPROVED' | 'REJECTED',
  notes?: string
): Promise<{ ok: boolean; reviewItem: SourceReviewItem; message: string }> {
  const response = await fetch(`/api/agent/sources/${sourceId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, notes }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to review source: ${response.statusText}`);
  }
  return data;
}

// ==========================================
// Phase 2B: Web Content Acquisition APIs
// ==========================================

export async function fetchSourceContent(
  sourceId: string,
  overridePolicy?: { timeoutMs?: number; maxResponseSizeBytes?: number }
): Promise<FetchResult> {
  const response = await fetch('/api/agent/research/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, overridePolicy }),
  });
  const data = await response.json();
  if (!response.ok && !data.fetchStatus) {
    throw new Error(data.error || `Content fetch failed: ${response.statusText}`);
  }
  return data;
}

export async function fetchStoredContent(filter?: {
  sourceId?: string;
  securityStatus?: string;
  contentType?: string;
}): Promise<{ ok: boolean; count: number; items: FetchedContentItem[] }> {
  const params = new URLSearchParams();
  if (filter?.sourceId) params.append('sourceId', filter.sourceId);
  if (filter?.securityStatus) params.append('securityStatus', filter.securityStatus);
  if (filter?.contentType) params.append('contentType', filter.contentType);

  const url = `/api/agent/research/content${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch stored content: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchStoredContentById(id: string): Promise<{ ok: boolean; item: FetchedContentItem }> {
  const response = await fetch(`/api/agent/research/content/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch content item "${id}": ${response.statusText}`);
  }
  return response.json();
}

export async function fetchContentAcquisitionStats(): Promise<{ ok: boolean; stats: FetchStatistics }> {
  const response = await fetch('/api/agent/research/fetch-status');
  if (!response.ok) {
    throw new Error(`Failed to fetch content acquisition stats: ${response.statusText}`);
  }
  return response.json();
}

// ==========================================
// Phase 2C: YouTube & Research Document Types & APIs
// ==========================================

export type ResearchSourceType =
  | 'YOUTUBE'
  | 'RESEARCH'
  | 'PDF'
  | 'DOCUMENTATION'
  | 'EDUCATIONAL'
  | 'NEWS'
  | 'OTHER';

export type TranscriptStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'RESTRICTED'
  | 'FAILED'
  | 'NOT_APPLICABLE';

export type DocumentExtractionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'OCR_REQUIRED'
  | 'FAILED'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export type ContentAcquisitionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'BLOCKED'
  | 'RATE_LIMITED';

export interface ContentChunk {
  chunkId: string;
  contentId: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  charCount: number;
  sourceType: ResearchSourceType;
  sourceUrl: string;
  title: string;
  authorOrChannel?: string;
  publishedAt?: string;
  contentHash: string;
}

export interface UnifiedResearchItem {
  id: string;
  sourceId: string;
  sourceType: ResearchSourceType;
  url: string;
  normalizedUrl: string;
  canonicalUrl?: string;
  title: string;
  authorOrChannel: string;
  publishedAt?: string;
  fetchedAt: number;
  language?: string;
  contentType: string;
  acquisitionStatus: ContentAcquisitionStatus;
  errorMessage?: string;
  transcriptStatus: TranscriptStatus;
  extractionStatus: DocumentExtractionStatus;
  text: string;
  textLength: number;
  contentHash: string;
  securityStatus: ContentSecurityStatus;
  untrusted: true;
  metadata: {
    durationSeconds?: number;
    videoId?: string;
    descriptionSnippet?: string;
    pdfPageCount?: number;
    mimeType?: string;
    httpStatus?: number;
    fileSizeBytes?: number;
    isDuplicate?: boolean;
    tags?: string[];
  };
  chunks: ContentChunk[];
  firewallLog: string[];
}

export interface ResearchLibraryStatistics {
  totalItems: number;
  youtubeItemsCount: number;
  documentItemsCount: number;
  availableTranscriptsCount: number;
  ocrRequiredCount: number;
  totalChunksCount: number;
  securityFlaggedCount: number;
  lastAcquiredAt?: number;
}

export async function fetchYouTubeContent(
  url: string,
  sourceId?: string
): Promise<{ ok: boolean; isDuplicate: boolean; item: UnifiedResearchItem; chunksCount: number; message: string }> {
  const response = await fetch('/api/agent/research/youtube/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, sourceId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `YouTube fetch failed: ${response.statusText}`);
  }
  return data;
}

export async function fetchDocumentContent(
  url: string,
  sourceId?: string,
  sourceName?: string
): Promise<{ ok: boolean; isDuplicate: boolean; item: UnifiedResearchItem; chunksCount: number; message: string }> {
  const response = await fetch('/api/agent/research/document/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, sourceId, sourceName }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Document fetch failed: ${response.statusText}`);
  }
  return data;
}

export async function fetchResearchLibrary(filter?: {
  sourceType?: string;
  securityStatus?: string;
  transcriptStatus?: string;
  extractionStatus?: string;
}): Promise<{ ok: boolean; count: number; items: UnifiedResearchItem[] }> {
  const params = new URLSearchParams();
  if (filter?.sourceType) params.append('sourceType', filter.sourceType);
  if (filter?.securityStatus) params.append('securityStatus', filter.securityStatus);
  if (filter?.transcriptStatus) params.append('transcriptStatus', filter.transcriptStatus);
  if (filter?.extractionStatus) params.append('extractionStatus', filter.extractionStatus);

  const url = `/api/agent/research/library${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch research library: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchResearchItemById(id: string): Promise<{ ok: boolean; item: UnifiedResearchItem }> {
  const response = await fetch(`/api/agent/research/library/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch research item "${id}": ${response.statusText}`);
  }
  return response.json();
}

export async function fetchResearchChunks(
  contentId: string
): Promise<{ ok: boolean; count: number; contentId: string; chunks: ContentChunk[] }> {
  const response = await fetch(`/api/agent/research/chunks/${contentId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch chunks for "${contentId}": ${response.statusText}`);
  }
  return response.json();
}

export async function fetchResearchLibraryStats(): Promise<{ ok: boolean; stats: ResearchLibraryStatistics }> {
  const response = await fetch('/api/agent/research/acquisition-status');
  if (!response.ok) {
    throw new Error(`Failed to fetch research library stats: ${response.statusText}`);
  }
  return response.json();
}

// =========================================================================
// Phase 2D: Research Claim Extraction + Rule Discovery + Verification Engine
// =========================================================================

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
  market: string;
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
  winRate: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  averageWin: number;
  averageLoss: number;
  sampleSize: number;
  confidenceInterval: { lower: number; upper: number; confidence: number };
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
  oosRetentionRatio: number;
  walkForwardResults: WalkForwardWindowResult[];
  walkForwardConsistencyScore: number;
  regimeBreakdown: RegimePerformance[];
  evidenceScore: number;
  postMortem: RulePostMortem;
  verdict: RuleLifecycleStatus;
  statusNotes: string;
}

export interface RuleComparisonResult {
  relationship: 'DUPLICATE' | 'MINOR_VARIATION' | 'IMPROVEMENT_CANDIDATE' | 'CONTRADICTORY' | 'NEW_RULE';
  matchedRuleId?: string;
  matchedRuleName?: string;
  similarityScore: number;
  rationale: string;
}

export interface RuleEvidenceChain {
  rule: RuleCandidate;
  claim: ResearchClaim;
  validation?: RuleValidationRecord;
  source?: {
    id: string;
    sourceType: string;
    title: string;
    authorOrChannel: string;
    url: string;
    fetchedAt: number;
    contentHash: string;
    untrusted: boolean;
  };
}

export async function extractResearchClaims(
  contentId?: string
): Promise<{ ok: boolean; extractedCount: number; extractedClaims: ResearchClaim[]; totalClaims: number }> {
  const res = await fetch('/api/agent/claims/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentId }),
  });
  if (!res.ok) throw new Error(`Extract claims failed: ${res.statusText}`);
  return res.json();
}

export async function fetchResearchClaims(): Promise<{ ok: boolean; count: number; claims: ResearchClaim[] }> {
  const res = await fetch('/api/agent/claims');
  if (!res.ok) throw new Error(`Fetch claims failed: ${res.statusText}`);
  return res.json();
}

export async function formalizeClaimToRule(
  claimId: string
): Promise<{ ok: boolean; rule?: RuleCandidate; comparison?: RuleComparisonResult; message: string }> {
  const res = await fetch('/api/agent/rules/formalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Formalization failed');
  return data;
}

export async function fetchRuleCandidates(): Promise<{ ok: boolean; count: number; rules: RuleCandidate[] }> {
  const res = await fetch('/api/agent/rules');
  if (!res.ok) throw new Error(`Fetch rules failed: ${res.statusText}`);
  return res.json();
}

export async function verifyRuleCandidate(
  ruleId: string
): Promise<{ ok: boolean; record: RuleValidationRecord; message: string }> {
  const res = await fetch(`/api/agent/rules/${ruleId}/verify`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Verification failed');
  return data;
}

export async function fetchRuleEvidenceChain(
  ruleId: string
): Promise<{ ok: boolean; evidenceChain: RuleEvidenceChain }> {
  const res = await fetch(`/api/agent/rules/${ruleId}/evidence`);
  if (!res.ok) throw new Error(`Fetch evidence chain failed: ${res.statusText}`);
  return res.json();
}

export async function approveRuleHumanGate(
  ruleId: string,
  notes?: string
): Promise<{ ok: boolean; rule: RuleCandidate; message: string }> {
  const res = await fetch(`/api/agent/rules/${ruleId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Approval failed');
  return data;
}

export async function fetchPhase2DVerificationStatus(): Promise<{
  ok: boolean;
  phase: string;
  stats: {
    totalClaims: number;
    testableClaims: number;
    notTestableClaims: number;
    insufficientDataClaims: number;
    totalRules: number;
    trustedCandidates: number;
    approvedRules: number;
    rejectedRules: number;
  };
  trustedCandidates: RuleCandidate[];
  approvedRules: RuleCandidate[];
  rejectedRules: RuleCandidate[];
}> {
  const res = await fetch('/api/agent/learning/verification-status');
  if (!res.ok) throw new Error(`Fetch verification status failed: ${res.statusText}`);
  return res.json();
}


