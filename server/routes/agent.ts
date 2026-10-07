import express from 'express';
import type { Request, Response } from 'express';
import { knowledgeService } from '../services/knowledgeService';
import { memoryService } from '../services/memoryService';
import { retrievalService } from '../services/retrievalService';
import {
  KnowledgeStatus,
  MemoryCategory,
  RetrievalQuery,
} from '../types/knowledgeTypes';

export const agentRouter = express.Router();

/**
 * GET /api/agent/health
 * Health check endpoint showing Phase 1 architecture status
 */
agentRouter.get('/health', (_req: Request, res: Response) => {
  const kStats = knowledgeService.getStats();
  const mStats = memoryService.getStats();

  res.json({
    ok: true,
    service: 'trading-agent-backend',
    phase: '1 (Knowledge & Agent Memory System)',
    timestamp: Date.now(),
    security: {
      clientSecretsExposed: false,
      aiTradingLogicActive: false,
      brokerConnected: false,
      immutabilityGuardsActive: true,
      credentialsStoredInKnowledgeBase: false,
    },
    knowledgeStats: kStats,
    memoryStats: mStats,
  });
});

/**
 * GET /api/agent/stats
 * Comprehensive Phase 1 system statistics
 */
agentRouter.get('/stats', (_req: Request, res: Response) => {
  const kStats = knowledgeService.getStats();
  const mStats = memoryService.getStats();
  const proposals = knowledgeService.getProposals();

  res.json({
    ok: true,
    phase: '1',
    knowledgeCount: kStats.total,
    knowledgeStatusBreakdown: kStats.byStatus,
    memoryCount: mStats.totalMemories,
    memoryCategoryBreakdown: mStats.byCategory,
    marketMemoryCount: mStats.totalMarketMemories,
    learningSessionCount: mStats.totalSessions,
    pendingProposalsCount: proposals.filter((p) => p.status === 'PENDING_APPROVAL').length,
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/**
 * GET /api/agent/knowledge
 * Retrieve knowledge list with optional filtering
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
 * Retrieve single knowledge item and its full version history
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
 * Ingest new knowledge item with content-hash deduplication
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
 * Update knowledge with immutable version snapshot
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
 * List agent memories with optional category filter
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
 * Add agent memory (strictly segregates observation fact vs AI reasoning)
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
 * List market pattern memories
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
 * Context-aware retrieval abstraction querying knowledge + memory
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
 * List daily learning session history
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
 * List human-in-the-loop proposals
 */
agentRouter.get('/proposals', (_req: Request, res: Response) => {
  try {
    const proposals = knowledgeService.getProposals();
    res.json({ ok: true, count: proposals.length, proposals });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
