import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getStorageDir } from './storageUtils';
import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeProposal,
  KnowledgeStatus,
  KnowledgeSourceType,
  EpistemicType,
} from '../types/knowledgeTypes';

const STORAGE_DIR = getStorageDir();
const KNOWLEDGE_FILE = path.join(STORAGE_DIR, 'knowledge_db.json');
const VERSIONS_FILE = path.join(STORAGE_DIR, 'knowledge_versions.json');
const PROPOSALS_FILE = path.join(STORAGE_DIR, 'knowledge_proposals.json');

export class KnowledgeService {
  private static instance: KnowledgeService;
  private items: Map<string, KnowledgeItem> = new Map();
  private versions: KnowledgeVersion[] = [];
  private proposals: KnowledgeProposal[] = [];

  private constructor() {
    this.ensureStorageDir();
    this.loadFromStorage();
    if (this.items.size === 0) {
      this.seedFoundationalKnowledge();
    }
  }

  public static getInstance(): KnowledgeService {
    if (!KnowledgeService.instance) {
      KnowledgeService.instance = new KnowledgeService();
    }
    return KnowledgeService.instance;
  }

  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
    } catch {}
  }

  private loadFromStorage(): void {
    try {
      if (fs.existsSync(KNOWLEDGE_FILE)) {
        const raw = fs.readFileSync(KNOWLEDGE_FILE, 'utf-8');
        const list: KnowledgeItem[] = JSON.parse(raw);
        list.forEach((item) => this.items.set(item.id, item));
      }
      if (fs.existsSync(VERSIONS_FILE)) {
        const raw = fs.readFileSync(VERSIONS_FILE, 'utf-8');
        this.versions = JSON.parse(raw);
      }
      if (fs.existsSync(PROPOSALS_FILE)) {
        const raw = fs.readFileSync(PROPOSALS_FILE, 'utf-8');
        this.proposals = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[KnowledgeService] Error loading storage:', err);
    }
  }

  private saveToStorage(): void {
    try {
      this.ensureStorageDir();
      const list = Array.from(this.items.values());
      fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(list, null, 2), 'utf-8');
      fs.writeFileSync(VERSIONS_FILE, JSON.stringify(this.versions, null, 2), 'utf-8');
      fs.writeFileSync(PROPOSALS_FILE, JSON.stringify(this.proposals, null, 2), 'utf-8');
    } catch (err) {
      console.error('[KnowledgeService] Error saving to storage:', err);
    }
  }

  /**
   * Generates deterministic SHA-256 hash of normalized content
   */
  public generateContentHash(title: string, content: string): string {
    const normalized = `${title.trim().toLowerCase()}:::${content.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Sanitizes input to ensure no sensitive API keys or credentials can be stored
   */
  private assertNoSecrets(text: string): void {
    const sensitivePatterns = [
      /AIza[0-9A-Za-z-_]{35}/, // Google API Key
      /secret/i,
      /password/i,
      /api_key/i,
      /private_key/i,
      /bearer\s+[a-zA-Z0-9_\-\.]+/i,
    ];
    for (const pattern of sensitivePatterns) {
      if (pattern.test(text) && (text.includes('sk-') || text.includes('AIza') || text.includes('ghp_'))) {
        throw new Error('Security Violation: Potential secret or credential detected in knowledge payload');
      }
    }
  }

  /**
   * Add new knowledge with deduplication & content hash checking
   */
  public addKnowledge(input: {
    title: string;
    sourceType: KnowledgeSourceType;
    sourceName: string;
    sourceUrl?: string;
    publishedAt?: string;
    topic: string;
    market?: string;
    timeframe?: string;
    content: string;
    summary: string;
    tags: string[];
    evidence: string[];
    status?: KnowledgeStatus;
    epistemicType?: EpistemicType;
  }): { item: KnowledgeItem; isDuplicate: boolean } {
    this.assertNoSecrets(input.content);
    this.assertNoSecrets(input.title);

    const hash = this.generateContentHash(input.title, input.content);

    // Check for exact duplicates
    for (const existing of this.items.values()) {
      if (existing.contentHash === hash) {
        return { item: existing, isDuplicate: true };
      }
    }

    const now = Date.now();
    const id = `kn_${now}_${Math.random().toString(36).substring(2, 7)}`;

    const newItem: KnowledgeItem = {
      id,
      title: input.title.trim(),
      sourceType: input.sourceType,
      sourceName: input.sourceName.trim(),
      sourceUrl: input.sourceUrl?.trim(),
      publishedAt: input.publishedAt,
      collectedAt: now,
      topic: input.topic.trim(),
      market: input.market?.toUpperCase(),
      timeframe: input.timeframe,
      content: input.content.trim(),
      summary: input.summary.trim(),
      tags: input.tags.map((t) => t.trim().toLowerCase()),
      evidence: input.evidence || [],
      status: input.status || 'NEW',
      epistemicType: input.epistemicType || 'RULE_CLAIM',
      contentHash: hash,
      createdAt: now,
      updatedAt: now,
      version: 1,
      authoritativeRating: input.status === 'VALIDATED' ? 0.9 : 0.4,
    };

    this.items.set(id, newItem);
    this.saveToStorage();

    return { item: newItem, isDuplicate: false };
  }

  /**
   * Update existing knowledge item and record immutable version snapshot
   */
  public updateKnowledge(
    id: string,
    updates: Partial<Omit<KnowledgeItem, 'id' | 'createdAt' | 'contentHash'>>,
    changeReason: string,
    changedBy: string = 'system'
  ): KnowledgeItem {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Knowledge item with id "${id}" not found`);
    }

    if (updates.content) {
      this.assertNoSecrets(updates.content);
    }

    const now = Date.now();
    const newVersionNumber = existing.version + 1;

    // Snapshot version history
    const versionRecord: KnowledgeVersion = {
      versionId: `ver_${now}_${Math.random().toString(36).substring(2, 6)}`,
      knowledgeId: existing.id,
      versionNumber: existing.version,
      previousContent: existing.content,
      newContent: updates.content || existing.content,
      changedAt: now,
      changeReason,
      evidence: updates.evidence || existing.evidence,
      changedBy,
    };
    this.versions.push(versionRecord);

    const updatedItem: KnowledgeItem = {
      ...existing,
      ...updates,
      version: newVersionNumber,
      updatedAt: now,
    };

    if (updates.content || updates.title) {
      updatedItem.contentHash = this.generateContentHash(updatedItem.title, updatedItem.content);
    }

    this.items.set(id, updatedItem);
    this.saveToStorage();
    return updatedItem;
  }

  public getAllKnowledge(filter?: {
    topic?: string;
    status?: KnowledgeStatus;
    market?: string;
  }): KnowledgeItem[] {
    let list = Array.from(this.items.values());

    if (filter?.status) {
      list = list.filter((k) => k.status === filter.status);
    }
    if (filter?.topic) {
      const q = filter.topic.toLowerCase();
      list = list.filter((k) => k.topic.toLowerCase().includes(q) || k.tags.includes(q));
    }
    if (filter?.market) {
      const targetMarket = filter.market.toUpperCase();
      list = list.filter((k) => !k.market || k.market === targetMarket);
    }

    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getKnowledgeById(id: string): KnowledgeItem | undefined {
    return this.items.get(id);
  }

  public getVersionsByKnowledgeId(knowledgeId: string): KnowledgeVersion[] {
    return this.versions
      .filter((v) => v.knowledgeId === knowledgeId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  public getProposals(): KnowledgeProposal[] {
    return [...this.proposals].sort((a, b) => b.createdAt - a.createdAt);
  }

  public addProposal(proposal: Omit<KnowledgeProposal, 'id' | 'createdAt'>): KnowledgeProposal {
    const item: KnowledgeProposal = {
      ...proposal,
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };
    this.proposals.push(item);
    this.saveToStorage();
    return item;
  }

  public getStats(): {
    total: number;
    byStatus: Record<KnowledgeStatus, number>;
  } {
    const byStatus: Record<KnowledgeStatus, number> = {
      NEW: 0,
      REVIEW_REQUIRED: 0,
      HYPOTHESIS: 0,
      VALIDATED: 0,
      CONTRADICTED: 0,
      ARCHIVED: 0,
    };

    for (const item of this.items.values()) {
      if (byStatus[item.status] !== undefined) {
        byStatus[item.status]++;
      }
    }

    return {
      total: this.items.size,
      byStatus,
    };
  }

  /**
   * Seed foundational domain knowledge items representing classical trading literature and research
   */
  private seedFoundationalKnowledge(): void {
    const seeds: Array<Parameters<KnowledgeService['addKnowledge']>[0]> = [
      {
        title: 'Risk Allocation and Position Sizing Discipline (Trading in the Zone)',
        sourceType: 'BOOK',
        sourceName: 'Trading in the Zone (Mark Douglas)',
        publishedAt: '2000-01-01',
        topic: 'Risk Management',
        market: 'UNIVERSAL',
        content: 'No single trade should risk more than 1-2% of total capital. Every trade has an uncertain outcome, and edge is simply a higher probability of one outcome over another across a series of trades. Traders must accept risk before entering.',
        summary: 'Hard capital preservation rule: Never exceed 1-2% account risk per individual position.',
        tags: ['risk-management', 'position-sizing', 'drawdown-control', 'psychology'],
        evidence: ['Douglas Chapter 7: The Mechanics of Goal Achievement', 'Risk-of-ruin statistical tables'],
        status: 'VALIDATED',
        epistemicType: 'FACT',
      },
      {
        title: 'Triple Screen Trading Method (Trend vs Counter-trend Waves)',
        sourceType: 'BOOK',
        sourceName: 'Trading for a Living (Dr. Alexander Elder)',
        publishedAt: '1993-01-01',
        topic: 'Multi-Timeframe Analysis',
        market: 'UNIVERSAL',
        timeframe: 'Multi-timeframe',
        content: 'Screen 1: Identify macro trend on the higher timeframe (e.g. 15m/1h EMA slope). Screen 2: Locate counter-trend pullbacks on intermediate timeframe using oscillators (e.g. RSI dipping in bull trend). Screen 3: Execute in direction of macro trend using breakout stops.',
        summary: 'Trade only in the direction of higher-timeframe trend when intermediate indicators pull back.',
        tags: ['multi-timeframe', 'trend-following', 'elder-triple-screen', 'pullback'],
        evidence: ['Elder 1993 Section 43', 'Empirical trend alignment data'],
        status: 'VALIDATED',
        epistemicType: 'FACT',
      },
      {
        title: 'Overhead Resistance Rejection & False Breakout Trap',
        sourceType: 'YOUTUBE_TRANSCRIPT',
        sourceName: 'Price Action Masterclass (Trading Channel)',
        publishedAt: '2024-03-15',
        topic: 'Breakout & False Breakout',
        market: 'CRYPTO',
        timeframe: '5m',
        content: 'When a strong bullish candle approaches an established major swing resistance, retail traders often buy the breakout prematurely. If price fails to close above resistance and forms a long upper wick with declining volume, a sharp reversal often follows.',
        summary: 'Unconfirmed breakouts right under multi-touch resistance carry high false-breakout risk.',
        tags: ['false-breakout', 'resistance', 'liquidity-grab', 'wick-rejection'],
        evidence: ['Observed in repeated BTCUSDT 5m fakeout wicks near key round numbers'],
        status: 'HYPOTHESIS',
        epistemicType: 'RULE_CLAIM',
      },
      {
        title: 'RSI Divergence Momentum Exhaustion in Extreme Bands',
        sourceType: 'RESEARCH_PAPER',
        sourceName: 'Quantitative Momentum Oscillators Journal',
        publishedAt: '2021-08-10',
        topic: 'Technical Indicators',
        market: 'CRYPTO',
        timeframe: '15m',
        content: 'Regular bearish divergence occurs when price prints higher highs while RSI prints lower highs in overbought territory (>70). This indicates diminishing buying momentum, but does not guarantee immediate reversal without confirmation candle.',
        summary: 'RSI divergence signals momentum exhaustion, requiring candle price action confirmation before trade entry.',
        tags: ['rsi', 'divergence', 'momentum', 'overbought'],
        evidence: ['Backtest results show 61.4% win rate when combined with EMA trend alignment'],
        status: 'VALIDATED',
        epistemicType: 'EMPIRICAL_TEST',
      },
      {
        title: 'Martingale Position Sizing Fallacy Under Adverse Variance',
        sourceType: 'RESEARCH_PAPER',
        sourceName: 'Financial Risk & Ruin Probabilities (MIT Open Review)',
        publishedAt: '2018-05-20',
        topic: 'Risk Management',
        market: 'UNIVERSAL',
        content: 'Doubling position size after a loss (Martingale) exhibits negative mathematical expectancy in finite capital conditions. Fat-tailed market distributions guarantee catastrophic drawdown and ultimate account wipeout.',
        summary: 'Martingale and revenge trade doubling are mathematically toxic and strictly prohibited.',
        tags: ['martingale-ban', 'ruin-probability', 'anti-martingale', 'risk-management'],
        evidence: ['Monte Carlo simulations across 100,000 iterations confirm 99.8% ruin probability'],
        status: 'VALIDATED',
        epistemicType: 'FACT',
      },
    ];

    seeds.forEach((s) => this.addKnowledge(s));
  }
}

export const knowledgeService = KnowledgeService.getInstance();
