import { knowledgeService } from './knowledgeService';
import { memoryService } from './memoryService';
import {
  RetrievalQuery,
  RetrievalResult,
  KnowledgeItem,
  AgentMemoryItem,
  MarketMemoryItem,
} from '../types/knowledgeTypes';

export class RetrievalService {
  private static instance: RetrievalService;

  public static getInstance(): RetrievalService {
    if (!RetrievalService.instance) {
      RetrievalService.instance = new RetrievalService();
    }
    return RetrievalService.instance;
  }

  /**
   * Unified context-aware retrieval combining Knowledge Base and Agent Memory.
   * This abstraction is vector-database ready and provides deterministic multi-attribute matching.
   */
  public query(query: RetrievalQuery): RetrievalResult {
    const limit = query.limit || 5;
    const searchTerms = this.tokenizeSearchText(
      `${query.query || ''} ${query.topic || ''} ${query.setup || ''} ${query.currentMarketContext || ''}`
    );

    // 1. Retrieve & Score Knowledge Items
    const allKnowledge = knowledgeService.getAllKnowledge();
    const scoredKnowledge: Array<{ item: KnowledgeItem; score: number }> = [];

    for (const item of allKnowledge) {
      if (query.statusFilter && !query.statusFilter.includes(item.status)) {
        continue;
      }
      if (query.market && item.market && item.market !== 'UNIVERSAL' && item.market !== query.market.toUpperCase()) {
        continue;
      }

      let score = 0;
      const itemText = `${item.title} ${item.topic} ${item.summary} ${item.tags.join(' ')} ${item.content}`.toLowerCase();

      // Keyword match scoring
      for (const term of searchTerms) {
        if (itemText.includes(term)) {
          score += 2;
        }
      }

      // Exact topic match bonus
      if (query.topic && item.topic.toLowerCase().includes(query.topic.toLowerCase())) {
        score += 5;
      }

      // Validated status bonus
      if (item.status === 'VALIDATED') {
        score += 3;
      }

      if (score > 0 || searchTerms.length === 0) {
        scoredKnowledge.push({ item, score });
      }
    }

    scoredKnowledge.sort((a, b) => b.score - a.score);
    const relevantKnowledge = scoredKnowledge.slice(0, limit).map((s) => s.item);

    // 2. Retrieve & Score Agent Memories
    const allMemories = memoryService.getAllMemories();
    const scoredMemories: Array<{ item: AgentMemoryItem; score: number }> = [];

    for (const mem of allMemories) {
      if (query.symbol && mem.symbol && mem.symbol !== query.symbol.toUpperCase()) {
        continue;
      }
      if (query.market && mem.market !== 'UNIVERSAL' && mem.market !== query.market.toUpperCase()) {
        continue;
      }

      let score = 0;
      const memText = `${mem.context} ${mem.observation} ${mem.decision} ${mem.reasoning || ''}`.toLowerCase();

      for (const term of searchTerms) {
        if (memText.includes(term)) {
          score += 2;
        }
      }

      if (query.symbol && mem.symbol === query.symbol.toUpperCase()) {
        score += 4;
      }

      if (score > 0 || searchTerms.length === 0) {
        scoredMemories.push({ item: mem, score });
      }
    }

    scoredMemories.sort((a, b) => b.score - a.score);
    const relevantMemories = scoredMemories.slice(0, limit).map((s) => s.item);

    // 3. Retrieve Matching Market Memories
    const allMarketMemories = memoryService.getAllMarketMemories();
    const relevantMarketMemories: MarketMemoryItem[] = allMarketMemories
      .filter((mkt) => {
        if (query.symbol && mkt.symbol !== query.symbol.toUpperCase()) return false;
        if (query.timeframe && mkt.timeframe !== query.timeframe) return false;
        return true;
      })
      .slice(0, limit);

    const totalMatches = relevantKnowledge.length + relevantMemories.length + relevantMarketMemories.length;

    const querySummary = `Retrieved ${relevantKnowledge.length} knowledge items, ${relevantMemories.length} memories, and ${relevantMarketMemories.length} market patterns for criteria: [${query.symbol || 'ANY'}, ${query.timeframe || 'ANY'}, "${query.query || query.topic || 'all'}"]`;

    return {
      relevantKnowledge,
      relevantMemories,
      relevantMarketMemories,
      querySummary,
      totalMatches,
      timestamp: Date.now(),
    };
  }

  private tokenizeSearchText(text: string): string[] {
    const stopWords = new Set(['the', 'and', 'or', 'in', 'at', 'to', 'for', 'a', 'an', 'is', 'of', 'on', 'with']);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }
}

export const retrievalService = RetrievalService.getInstance();
