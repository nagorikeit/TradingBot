import express from 'express';
import type { Request, Response } from 'express';
import { knowledgeService } from '../services/knowledgeService';
import { memoryService } from '../services/memoryService';
import { retrievalService } from '../services/retrievalService';
import { researchSchedulerService } from '../services/researchSchedulerService';
import { sourceRegistryService } from '../services/sourceRegistryService';
import { webContentFetcher } from '../services/webContentFetcher';
import { youtubeProcessorService } from '../services/youtubeProcessorService';
import { documentProcessorService } from '../services/documentProcessorService';
import { researchLibraryService } from '../services/researchLibraryService';
import {
  KnowledgeStatus,
  MemoryCategory,
  RetrievalQuery,
} from '../types/knowledgeTypes';
import {
  SourceStatus,
  SourceCategory,
  SourceType,
} from '../types/sourceTypes';

export const agentRouter = express.Router();

/**
 * GET /api/agent/health
 * Health check endpoint showing Phase 2C architecture status
 */
agentRouter.get('/health', (_req: Request, res: Response) => {
  const kStats = knowledgeService.getStats();
  const mStats = memoryService.getStats();
  const schedulerStatus = researchSchedulerService.getStatus();
  const sourceStats = sourceRegistryService.getStats();
  const fetchStats = webContentFetcher.getStats();
  const libraryStats = researchLibraryService.getStatistics();

  res.json({
    ok: true,
    service: 'trading-agent-backend',
    phase: '2C (YouTube & Research Processing + Untrusted Library)',
    timestamp: Date.now(),
    security: {
      clientSecretsExposed: false,
      aiTradingLogicActive: false,
      brokerConnected: false,
      immutabilityGuardsActive: true,
      credentialsStoredInKnowledgeBase: false,
      userAgentRotationActive: false,
      scrapingBypassActive: false,
      ssrfProtectionActive: true,
      redirectSsrfProtectionActive: true,
      promptInjectionFirewallActive: true,
      untrustedDataIsolationEnforced: true,
    },
    knowledgeStats: kStats,
    memoryStats: mStats,
    scheduler: {
      enabled: schedulerStatus.config.enabled,
      status: schedulerStatus.config.lastStatus,
      dailyRunTime: schedulerStatus.config.dailyRunTime,
      timezone: schedulerStatus.config.timezone,
      isLocked: schedulerStatus.isLocked,
    },
    sources: {
      total: sourceStats.totalSources,
      trusted: sourceStats.byStatus.TRUSTED,
      underReview: sourceStats.byStatus.UNDER_REVIEW,
      pendingReviews: sourceStats.pendingReviewCount,
    },
    contentAcquisition: {
      storedItems: fetchStats.storedContentCount,
      successCount: fetchStats.successCount,
      securityFlaggedCount: fetchStats.securityFlaggedCount,
      blockedCount: fetchStats.blockedCount,
    },
    researchLibrary: libraryStats,
  });
});

/**
 * GET /api/agent/stats
 * Comprehensive Phase 2C system statistics
 */
agentRouter.get('/stats', (_req: Request, res: Response) => {
  const kStats = knowledgeService.getStats();
  const mStats = memoryService.getStats();
  const proposals = knowledgeService.getProposals();
  const schedulerStatus = researchSchedulerService.getStatus();
  const sourceStats = sourceRegistryService.getStats();
  const fetchStats = webContentFetcher.getStats();
  const libraryStats = researchLibraryService.getStatistics();

  res.json({
    ok: true,
    phase: '2C',
    knowledgeCount: kStats.total,
    knowledgeStatusBreakdown: kStats.byStatus,
    memoryCount: mStats.totalMemories,
    memoryCategoryBreakdown: mStats.byCategory,
    marketMemoryCount: mStats.totalMarketMemories,
    learningSessionCount: mStats.totalSessions,
    pendingProposalsCount: proposals.filter((p) => p.status === 'PENDING_APPROVAL').length,
    scheduler: schedulerStatus,
    sources: sourceStats,
    contentAcquisition: fetchStats,
    researchLibrary: libraryStats,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// ==========================================
// Phase 2A: Autonomous Research Scheduler APIs
// ==========================================

/**
 * GET /api/agent/learning/schedule
 * Get current scheduler configuration
 */
agentRouter.get('/learning/schedule', (_req: Request, res: Response) => {
  try {
    const config = researchSchedulerService.getConfig();
    res.json({ ok: true, config });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * PUT /api/agent/learning/schedule
 * Update scheduler configuration (enabled, dailyRunTime, timezone)
 */
agentRouter.put('/learning/schedule', (req: Request, res: Response) => {
  try {
    const { enabled, dailyRunTime, timezone } = req.body;
    const updated = researchSchedulerService.updateConfig({
      enabled,
      dailyRunTime,
      timezone,
    });
    res.json({ ok: true, config: updated, message: 'Scheduler configuration updated successfully.' });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Invalid configuration' });
  }
});

/**
 * POST /api/agent/learning/schedule/run
 * Manual trigger for research scheduler with single-run mutex lock protection
 */
agentRouter.post('/learning/schedule/run', async (_req: Request, res: Response) => {
  try {
    const result = await researchSchedulerService.executeRun('MANUAL');
    if (!result.ok) {
      res.status(result.error === 'MUTEX_LOCKED' ? 409 : 500).json(result);
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Execution error' });
  }
});

/**
 * GET /api/agent/learning/schedule/status
 * Get real-time scheduler state and lock information
 */
agentRouter.get('/learning/schedule/status', (_req: Request, res: Response) => {
  try {
    const status = researchSchedulerService.getStatus();
    res.json({ ok: true, status });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// Phase 2A: Trusted Source Registry APIs
// ==========================================

/**
 * GET /api/agent/sources
 * List registered sources with optional filtering
 */
agentRouter.get('/sources', (req: Request, res: Response) => {
  try {
    const status = req.query.status as SourceStatus | undefined;
    const category = req.query.category as SourceCategory | undefined;
    const sourceType = req.query.sourceType as SourceType | undefined;

    const sources = sourceRegistryService.getAllSources({ status, category, sourceType });
    res.json({ ok: true, count: sources.length, sources });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/sources/stats
 * Get breakdown of sources by status and type
 */
agentRouter.get('/sources/stats', (_req: Request, res: Response) => {
  try {
    const stats = sourceRegistryService.getStats();
    res.json({ ok: true, stats });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/sources/review-queue
 * Get list of sources in review queue
 */
agentRouter.get('/sources/review-queue', (_req: Request, res: Response) => {
  try {
    const queue = sourceRegistryService.getReviewQueue();
    res.json({ ok: true, count: queue.length, queue });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/sources/:id
 * Retrieve single source by ID
 */
agentRouter.get('/sources/:id', (req: Request, res: Response) => {
  try {
    const source = sourceRegistryService.getSourceById(req.params.id);
    if (!source) {
      res.status(404).json({ ok: false, error: `Source "${req.params.id}" not found` });
      return;
    }
    res.json({ ok: true, source });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/agent/sources
 * Register new source with URL validation & duplicate detection
 */
agentRouter.post('/sources', (req: Request, res: Response) => {
  try {
    const { name, url, sourceType, categories, status, trustScore, authorityLevel, reviewNotes, reviewReason, evidenceLinks } = req.body;

    if (!name || !url || !sourceType) {
      res.status(400).json({ ok: false, error: 'Missing required fields: name, url, sourceType' });
      return;
    }

    const result = sourceRegistryService.registerSource({
      name,
      url,
      sourceType,
      categories: Array.isArray(categories) ? categories : [],
      status,
      trustScore,
      authorityLevel,
      reviewNotes,
      reviewReason,
      evidenceLinks: Array.isArray(evidenceLinks) ? evidenceLinks : [],
    });

    res.status(result.isDuplicate ? 200 : 201).json({
      ok: true,
      isDuplicate: result.isDuplicate,
      source: result.source,
      message: result.isDuplicate ? 'Duplicate source URL detected. Existing source returned.' : 'Source registered successfully.',
    });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error registering source' });
  }
});

/**
 * PUT /api/agent/sources/:id
 * Update source details (trustScore, status, reviewNotes)
 */
agentRouter.put('/sources/:id', (req: Request, res: Response) => {
  try {
    const updated = sourceRegistryService.updateSource(req.params.id, req.body || {});
    res.json({ ok: true, source: updated });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error updating source' });
  }
});

/**
 * POST /api/agent/sources/:id/review
 * Human / System decision on review item (APPROVED -> TRUSTED, REJECTED -> BLOCKED)
 */
agentRouter.post('/sources/:id/review', (req: Request, res: Response) => {
  try {
    const { decision, notes } = req.body;
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      res.status(400).json({ ok: false, error: 'decision must be either "APPROVED" or "REJECTED"' });
      return;
    }
    const result = sourceRegistryService.updateReviewItem(req.params.id, decision, notes);
    res.json({ ok: true, reviewItem: result, message: `Review decision "${decision}" applied to source.` });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error applying review decision' });
  }
});

// ==========================================
// Phase 2B: Web Content Acquisition & Security Firewall APIs
// ==========================================

/**
 * POST /api/agent/research/fetch
 * Fetch content from an eligible source in registry with full SSRF and security controls
 */
agentRouter.post('/research/fetch', async (req: Request, res: Response) => {
  try {
    const { sourceId, overridePolicy } = req.body;
    if (!sourceId) {
      res.status(400).json({ ok: false, error: 'Missing sourceId in request body' });
      return;
    }

    const result = await webContentFetcher.fetchSourceContent(sourceId, overridePolicy);
    if (!result.ok) {
      const statusCode =
        result.fetchStatus === 'RATE_LIMITED'
          ? 429
          : result.fetchStatus === 'SSRF_BLOCKED'
          ? 403
          : result.fetchStatus === 'BLOCKED'
          ? 403
          : 400;
      res.status(statusCode).json(result);
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Fetch execution error' });
  }
});

/**
 * GET /api/agent/research/content
 * Retrieve list of fetched untrusted contents with optional filters
 */
agentRouter.get('/research/content', (req: Request, res: Response) => {
  try {
    const sourceId = req.query.sourceId as string | undefined;
    const securityStatus = req.query.securityStatus as string | undefined;
    const contentType = req.query.contentType as string | undefined;

    const items = webContentFetcher.getAllFetchedContent({ sourceId, securityStatus, contentType });
    res.json({ ok: true, count: items.length, items });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/research/content/:id
 * Retrieve single fetched content item by ID
 */
agentRouter.get('/research/content/:id', (req: Request, res: Response) => {
  try {
    const item = webContentFetcher.getContentById(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: `Content item "${req.params.id}" not found` });
      return;
    }
    res.json({ ok: true, item });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/research/fetch-status
 * Get statistics of fetches and security firewall counts
 */
agentRouter.get('/research/fetch-status', (_req: Request, res: Response) => {
  try {
    const stats = webContentFetcher.getStats();
    res.json({ ok: true, stats });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// Phase 2C: YouTube & Research Document APIs
// ==========================================

/**
 * POST /api/agent/research/youtube/fetch
 * Fetches public YouTube video metadata & captions/transcript with firewall sanitization
 */
agentRouter.post('/research/youtube/fetch', async (req: Request, res: Response) => {
  try {
    const { sourceId, url } = req.body;
    if (!url) {
      res.status(400).json({ ok: false, error: 'Missing "url" parameter in request body' });
      return;
    }

    const effectiveSourceId = sourceId || 'src_youtube_custom';
    const result = await youtubeProcessorService.processYouTubeUrl(effectiveSourceId, url);

    if (!result.ok || !result.item) {
      const failedStatus: 'FAILED' | 'BLOCKED' | 'RATE_LIMITED' =
        result.acquisitionStatus === 'BLOCKED' || result.acquisitionStatus === 'RATE_LIMITED'
          ? result.acquisitionStatus
          : 'FAILED';
      // Record failure/blocked entry in persistent storage for audit compliance
      researchLibraryService.recordFailedAcquisition({
        sourceId: effectiveSourceId,
        sourceType: 'YOUTUBE',
        url,
        error: result.error || 'YouTube acquisition failed',
        acquisitionStatus: failedStatus,
      });

      const httpCode = failedStatus === 'RATE_LIMITED' ? 429 : failedStatus === 'BLOCKED' ? 403 : 400;
      res.status(httpCode).json({
        ok: false,
        error: result.error || 'YouTube acquisition failed',
        acquisitionStatus: failedStatus,
      });
      return;
    }

    const saveResult = researchLibraryService.addItem(result.item);

    res.status(saveResult.isDuplicate ? 200 : 201).json({
      ok: true,
      isDuplicate: saveResult.isDuplicate,
      item: saveResult.item,
      chunksCount: saveResult.item.chunks.length,
      message: saveResult.message,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'YouTube fetch error' });
  }
});

/**
 * GET /api/agent/research/youtube/:id
 * Retrieve specific YouTube research record by ID
 */
agentRouter.get('/research/youtube/:id', (req: Request, res: Response) => {
  try {
    const item = researchLibraryService.getItemById(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: `YouTube research item "${req.params.id}" not found` });
      return;
    }
    res.json({ ok: true, item });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/agent/research/document/fetch
 * Ingests public research paper, HTML article, or PDF document with SSRF and size safeguards
 */
agentRouter.post('/research/document/fetch', async (req: Request, res: Response) => {
  try {
    const { sourceId, url, sourceName } = req.body;
    if (!url) {
      res.status(400).json({ ok: false, error: 'Missing "url" parameter in request body' });
      return;
    }

    const effectiveSourceId = sourceId || 'src_document_custom';
    const result = await documentProcessorService.processDocumentUrl(effectiveSourceId, url, sourceName);

    if (!result.ok || !result.item) {
      const failedStatus: 'FAILED' | 'BLOCKED' | 'RATE_LIMITED' =
        result.acquisitionStatus === 'BLOCKED' || result.acquisitionStatus === 'RATE_LIMITED'
          ? result.acquisitionStatus
          : 'FAILED';
      // Record failure/blocked entry in persistent storage for audit compliance
      researchLibraryService.recordFailedAcquisition({
        sourceId: effectiveSourceId,
        sourceType: url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'RESEARCH',
        url,
        error: result.error || 'Document processing failed',
        acquisitionStatus: failedStatus,
      });

      const httpCode = failedStatus === 'RATE_LIMITED' ? 429 : failedStatus === 'BLOCKED' ? 403 : 400;
      res.status(httpCode).json({
        ok: false,
        error: result.error || 'Document processing failed',
        acquisitionStatus: failedStatus,
      });
      return;
    }

    const saveResult = researchLibraryService.addItem(result.item);

    res.status(saveResult.isDuplicate ? 200 : 201).json({
      ok: true,
      isDuplicate: saveResult.isDuplicate,
      item: saveResult.item,
      chunksCount: saveResult.item.chunks.length,
      message: saveResult.message,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Document acquisition error' });
  }
});

/**
 * GET /api/agent/research/document/:id
 * Retrieve specific document record by ID
 */
agentRouter.get('/research/document/:id', (req: Request, res: Response) => {
  try {
    const item = researchLibraryService.getItemById(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: `Document item "${req.params.id}" not found` });
      return;
    }
    res.json({ ok: true, item });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/research/library
 * Query all processed research items with optional filtering
 */
agentRouter.get('/research/library', (req: Request, res: Response) => {
  try {
    const sourceType = req.query.sourceType as string | undefined;
    const securityStatus = req.query.securityStatus as string | undefined;
    const transcriptStatus = req.query.transcriptStatus as string | undefined;
    const extractionStatus = req.query.extractionStatus as string | undefined;

    const items = researchLibraryService.getAllItems({
      sourceType,
      securityStatus,
      transcriptStatus,
      extractionStatus,
    });

    res.json({ ok: true, count: items.length, items });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/research/library/:id
 * Retrieve single research item with its full chunks
 */
agentRouter.get('/research/library/:id', (req: Request, res: Response) => {
  try {
    const item = researchLibraryService.getItemById(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: `Research item "${req.params.id}" not found` });
      return;
    }
    res.json({ ok: true, item });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/research/chunks/:contentId
 * Retrieve prepared logical chunks for a research item (prepared for Phase 2D)
 */
agentRouter.get('/research/chunks/:contentId', (req: Request, res: Response) => {
  try {
    const chunks = researchLibraryService.getChunksByContentId(req.params.contentId);
    res.json({ ok: true, count: chunks.length, contentId: req.params.contentId, chunks });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/research/acquisition-status
 * Get acquisition and preparation statistics across YouTube and research documents
 */
agentRouter.get('/research/acquisition-status', (_req: Request, res: Response) => {
  try {
    const stats = researchLibraryService.getStatistics();
    res.json({ ok: true, stats });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// Phase 1: Existing Knowledge & Memory APIs
// ==========================================

/**
 * GET /api/agent/knowledge
 */
agentRouter.get('/knowledge', (req: Request, res: Response) => {
  try {
    const topic = req.query.topic as string | undefined;
    const status = req.query.status as KnowledgeStatus | undefined;
    const market = req.query.market as string | undefined;

    const items = knowledgeService.getAllKnowledge({ topic, status, market });
    res.json({ ok: true, count: items.length, items });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/knowledge/:id
 */
agentRouter.get('/knowledge/:id', (req: Request, res: Response) => {
  try {
    const item = knowledgeService.getKnowledgeById(req.params.id);
    if (!item) {
      res.status(404).json({ ok: false, error: 'Knowledge item not found' });
      return;
    }
    const versions = knowledgeService.getVersionsByKnowledgeId(item.id);
    res.json({ ok: true, item, versions });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/agent/knowledge
 */
agentRouter.post('/knowledge', (req: Request, res: Response) => {
  try {
    const { title, sourceType, sourceName, sourceUrl, publishedAt, topic, market, timeframe, content, summary, tags, evidence, status, epistemicType } = req.body;

    if (!title || !content || !sourceType || !sourceName || !topic) {
      res.status(400).json({ ok: false, error: 'Missing required fields: title, content, sourceType, sourceName, topic' });
      return;
    }

    const result = knowledgeService.addKnowledge({
      title,
      sourceType,
      sourceName,
      sourceUrl,
      publishedAt,
      topic,
      market,
      timeframe,
      content,
      summary: summary || title,
      tags: Array.isArray(tags) ? tags : [],
      evidence: Array.isArray(evidence) ? evidence : [],
      status,
      epistemicType,
    });

    res.status(result.isDuplicate ? 200 : 201).json({
      ok: true,
      isDuplicate: result.isDuplicate,
      item: result.item,
      message: result.isDuplicate ? 'Duplicate content hash detected. Existing item returned.' : 'New knowledge item recorded successfully.',
    });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error adding knowledge' });
  }
});

/**
 * PUT /api/agent/knowledge/:id
 */
agentRouter.put('/knowledge/:id', (req: Request, res: Response) => {
  try {
    const { updates, changeReason, changedBy } = req.body;
    if (!changeReason) {
      res.status(400).json({ ok: false, error: 'Missing changeReason: All knowledge updates must document reason and evidence' });
      return;
    }

    const updated = knowledgeService.updateKnowledge(req.params.id, updates || {}, changeReason, changedBy || 'system');
    res.json({ ok: true, item: updated });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error updating knowledge' });
  }
});

/**
 * GET /api/agent/memory
 */
agentRouter.get('/memory', (req: Request, res: Response) => {
  try {
    const category = req.query.category as MemoryCategory | undefined;
    const market = req.query.market as string | undefined;
    const symbol = req.query.symbol as string | undefined;

    const memories = memoryService.getAllMemories({ category, market, symbol });
    res.json({ ok: true, count: memories.length, memories });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/agent/memory
 */
agentRouter.post('/memory', (req: Request, res: Response) => {
  try {
    const { category, market, symbol, timeframe, context, observation, decision, outcome, evidence, confidence, relatedKnowledgeIds, isFact, reasoning } = req.body;

    if (!category || !market || !timeframe || !observation || !decision) {
      res.status(400).json({ ok: false, error: 'Missing required fields: category, market, timeframe, observation, decision' });
      return;
    }

    const memory = memoryService.addAgentMemory({
      category,
      market,
      symbol,
      timeframe,
      context: context || '',
      observation,
      decision,
      outcome,
      evidence: Array.isArray(evidence) ? evidence : [],
      confidence: typeof confidence === 'number' ? confidence : 0.8,
      relatedKnowledgeIds: Array.isArray(relatedKnowledgeIds) ? relatedKnowledgeIds : [],
      isFact: isFact !== false,
      reasoning,
    });

    res.status(201).json({ ok: true, memory });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error adding memory' });
  }
});

/**
 * GET /api/agent/memory/market
 */
agentRouter.get('/memory/market', (_req: Request, res: Response) => {
  try {
    const marketMemories = memoryService.getAllMarketMemories();
    res.json({ ok: true, count: marketMemories.length, marketMemories });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/agent/retrieval
 */
agentRouter.post('/retrieval', (req: Request, res: Response) => {
  try {
    const query = req.body as RetrievalQuery;
    const result = retrievalService.query(query || {});
    res.json({ ok: true, result });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Retrieval error' });
  }
});

/**
 * GET /api/agent/learning/sessions
 */
agentRouter.get('/learning/sessions', (_req: Request, res: Response) => {
  try {
    const sessions = memoryService.getLearningSessions();
    res.json({ ok: true, count: sessions.length, sessions });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/agent/proposals
 */
agentRouter.get('/proposals', (_req: Request, res: Response) => {
  try {
    const proposals = knowledgeService.getProposals();
    res.json({ ok: true, count: proposals.length, proposals });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
