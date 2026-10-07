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
  uptimeSeconds: number;
}

/**
 * Phase 1: Client API callers
 */
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

export async function fetchMarketMemories(): Promise<{ ok: boolean; count: number; marketMemories: MarketMemoryItem[] }> {
  const response = await fetch('/api/agent/memory/market');
  if (!response.ok) {
    throw new Error(`Market memories fetch failed: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchLearningSessions(): Promise<{ ok: boolean; count: number; sessions: DailyLearningSession[] }> {
  const response = await fetch('/api/agent/learning/sessions');
  if (!response.ok) {
    throw new Error(`Learning sessions fetch failed: ${response.statusText}`);
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
