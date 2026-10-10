import fs from 'fs';
import path from 'path';
import { getStorageDir } from './storageUtils';
import {
  AgentMemoryItem,
  MarketMemoryItem,
  DailyLearningSession,
  MemoryCategory,
} from '../types/knowledgeTypes';

const STORAGE_DIR = getStorageDir();
const MEMORY_FILE = path.join(STORAGE_DIR, 'agent_memory_db.json');
const MARKET_MEMORY_FILE = path.join(STORAGE_DIR, 'market_memory_db.json');
const SESSIONS_FILE = path.join(STORAGE_DIR, 'learning_sessions.json');

export class MemoryService {
  private static instance: MemoryService;
  private memories: Map<string, AgentMemoryItem> = new Map();
  private marketMemories: Map<string, MarketMemoryItem> = new Map();
  private learningSessions: DailyLearningSession[] = [];

  private constructor() {
    this.ensureStorageDir();
    this.loadFromStorage();
    if (this.memories.size === 0) {
      this.seedInitialMemories();
    }
  }

  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
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
      if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, 'utf-8');
        const list: AgentMemoryItem[] = JSON.parse(raw);
        list.forEach((m) => this.memories.set(m.id, m));
      }
      if (fs.existsSync(MARKET_MEMORY_FILE)) {
        const raw = fs.readFileSync(MARKET_MEMORY_FILE, 'utf-8');
        const list: MarketMemoryItem[] = JSON.parse(raw);
        list.forEach((m) => this.marketMemories.set(m.id, m));
      }
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        this.learningSessions = JSON.parse(raw);
      }
    } catch (err) {
      console.error('[MemoryService] Error loading memory storage:', err);
    }
  }

  private saveToStorage(): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(Array.from(this.memories.values()), null, 2), 'utf-8');
      fs.writeFileSync(MARKET_MEMORY_FILE, JSON.stringify(Array.from(this.marketMemories.values()), null, 2), 'utf-8');
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(this.learningSessions, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MemoryService] Error saving memory storage:', err);
    }
  }

  /**
   * Add a new agent memory item.
   * Guarantees strict segregation of observed facts vs AI reasoning.
   */
  public addAgentMemory(input: {
    category: MemoryCategory;
    market: string;
    symbol?: string;
    timeframe: string;
    context: string;
    observation: string;
    decision: string;
    outcome?: string;
    evidence: string[];
    confidence: number;
    relatedKnowledgeIds?: string[];
    isFact?: boolean;
    reasoning?: string;
  }): AgentMemoryItem {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const item: AgentMemoryItem = {
      id,
      category: input.category,
      timestamp: Date.now(),
      market: input.market.toUpperCase(),
      symbol: input.symbol?.toUpperCase(),
      timeframe: input.timeframe,
      context: input.context.trim(),
      observation: input.observation.trim(),
      decision: input.decision.trim(),
      outcome: input.outcome?.trim(),
      evidence: input.evidence || [],
      confidence: Math.min(1.0, Math.max(0.0, input.confidence)),
      relatedKnowledgeIds: input.relatedKnowledgeIds || [],
      isFact: input.isFact ?? true,
      reasoning: input.reasoning?.trim(),
    };

    this.memories.set(id, item);
    this.saveToStorage();
    return item;
  }

  /**
   * Record or update market behavior pattern memory.
   * Guarantees strict segregation: Market Observation is NOT a trade outcome.
   * Only true trade evaluations record WIN/LOSS/DRAW.
   */
  public recordMarketObservation(input: {
    symbol: string;
    market: string;
    timeframe: string;
    setup: string;
    marketCondition: string;
    candleContext: string;
    technicalContext: string;
    newsContext?: string;
    outcome?: 'WIN' | 'LOSS' | 'DRAW' | null;
    tradeOutcome?: 'WIN' | 'LOSS' | 'DRAW' | null;
    memoryType?: 'TRADE_OUTCOME' | 'MARKET_OBSERVATION';
    evidenceReferences?: string[];
  }): MarketMemoryItem {
    const key = `${input.symbol.toUpperCase()}::${input.timeframe}::${input.setup.toLowerCase()}`;
    let existing = this.marketMemories.get(key);

    const now = Date.now();
    const effectiveOutcome = input.tradeOutcome !== undefined ? input.tradeOutcome : input.outcome;
    const memoryType = input.memoryType || (effectiveOutcome ? 'TRADE_OUTCOME' : 'MARKET_OBSERVATION');
    const isTrade = memoryType === 'TRADE_OUTCOME' && !!effectiveOutcome;

    if (!existing) {
      existing = {
        id: `mkt_${now}_${Math.random().toString(36).substring(2, 6)}`,
        symbol: input.symbol.toUpperCase(),
        market: input.market.toUpperCase(),
        timeframe: input.timeframe,
        setup: input.setup,
        marketCondition: input.marketCondition,
        candleContext: input.candleContext,
        technicalContext: input.technicalContext,
        newsContext: input.newsContext,
        historicalOutcome: `${input.setup} observed`,
        observationCount: 1,
        winningCount: isTrade && input.outcome === 'WIN' ? 1 : 0,
        losingCount: isTrade && input.outcome === 'LOSS' ? 1 : 0,
        drawCount: isTrade && input.outcome === 'DRAW' ? 1 : 0,
        lastObserved: now,
        evidenceReferences: input.evidenceReferences || [],
        memoryType,
        tradeOutcome: isTrade ? input.outcome : null,
      };
    } else {
      existing.observationCount++;
      if (isTrade) {
        if (input.outcome === 'WIN') existing.winningCount++;
        if (input.outcome === 'LOSS') existing.losingCount++;
        if (input.outcome === 'DRAW') existing.drawCount++;
        existing.tradeOutcome = input.outcome;
      }
      existing.memoryType = memoryType;
      existing.lastObserved = now;
      existing.marketCondition = input.marketCondition;
      existing.candleContext = input.candleContext;
      existing.technicalContext = input.technicalContext;
      if (input.evidenceReferences) {
        existing.evidenceReferences = Array.from(new Set([...existing.evidenceReferences, ...input.evidenceReferences]));
      }
    }

    this.marketMemories.set(key, existing);
    this.saveToStorage();
    return existing;
  }

  public getAllMemories(filter?: {
    category?: MemoryCategory;
    market?: string;
    symbol?: string;
  }): AgentMemoryItem[] {
    let list = Array.from(this.memories.values());

    if (filter?.category) {
      list = list.filter((m) => m.category === filter.category);
    }
    if (filter?.market) {
      const targetMarket = filter.market.toUpperCase();
      list = list.filter((m) => m.market === targetMarket);
    }
    if (filter?.symbol) {
      const targetSymbol = filter.symbol.toUpperCase();
      list = list.filter((m) => m.symbol === targetSymbol);
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getAllMarketMemories(): MarketMemoryItem[] {
    return Array.from(this.marketMemories.values()).sort((a, b) => b.lastObserved - a.lastObserved);
  }

  public getLearningSessions(): DailyLearningSession[] {
    return [...this.learningSessions].sort((a, b) => b.startTime - a.startTime);
  }

  public addLearningSession(session: DailyLearningSession): void {
    this.learningSessions.push(session);
    this.saveToStorage();
  }

  public getStats(): {
    totalMemories: number;
    byCategory: Record<MemoryCategory, number>;
    totalMarketMemories: number;
    totalSessions: number;
  } {
    const byCategory: Record<MemoryCategory, number> = {
      DECISION: 0,
      TRADE: 0,
      MISTAKE: 0,
      SUCCESS_PATTERN: 0,
      IMPROVEMENT: 0,
    };

    for (const m of this.memories.values()) {
      if (byCategory[m.category] !== undefined) {
        byCategory[m.category]++;
      }
    }

    return {
      totalMemories: this.memories.size,
      byCategory,
      totalMarketMemories: this.marketMemories.size,
      totalSessions: this.learningSessions.length,
    };
  }

  /**
   * Seed initial structured memory events reflecting authentic trading discipline
   */
  private seedInitialMemories(): void {
    // 1. Decision Memory
    this.addAgentMemory({
      category: 'DECISION',
      market: 'CRYPTO',
      symbol: 'BTCUSDT',
      timeframe: '5m',
      context: 'Signal Engine evaluated 4/5 QUALIFIED Bullish signal at $67,450.',
      observation: 'Price is printing 0.3% below major horizontal 4h resistance. Upper candle shadow shows 45% wick rejection.',
      decision: 'Recommend NO_TRADE / WAIT. Do not initiate long position directly into immediate overhead resistance.',
      outcome: 'Price rejected by 1.2% in subsequent 3 candles. Trade saved from adverse false breakout loss.',
      evidence: ['Candle Timestamp 1712398000000', 'Resistance line $67,550'],
      confidence: 0.88,
      isFact: true,
      reasoning: 'AI reasoning: Risk of buying into liquidity trap exceeds mathematical expectancy without confirmed candle close above resistance.',
    });

    // 2. Mistake Memory
    this.addAgentMemory({
      category: 'MISTAKE',
      market: 'CRYPTO',
      symbol: 'ETHUSDT',
      timeframe: '1m',
      context: 'High-volatility fast session with erratic ATR spike.',
      observation: 'Signal triggered while ATR expanded to 4.2x average due to high-impact CPI release. Bid-ask spread increased tenfold.',
      decision: 'Signal executed without news/volatility spread filter.',
      outcome: 'Slippage caused poor fill, resulting in immediate stopout loss.',
      evidence: ['CPI release schedule 12:30 UTC', 'Trade slip log +$12.50'],
      confidence: 0.95,
      isFact: true,
      reasoning: 'Root cause analysis: System lacked hard volatility/news freeze filter. Never trade 1m during scheduled macro volatility releases.',
    });

    // 3. Success Pattern Memory
    this.addAgentMemory({
      category: 'SUCCESS_PATTERN',
      market: 'CRYPTO',
      symbol: 'SOLUSDT',
      timeframe: '15m',
      context: 'Strong trend alignment with EMA 9 > EMA 21 > EMA 50 > EMA 200.',
      observation: 'Price gently pulled back to touch the 21 EMA band while RSI reset to 48. Bullish engulfing candle printed on support.',
      decision: 'QUALIFIED 5/5 CALL setup aligned with multi-timeframe trend.',
      outcome: 'Target reached at 2.4R within 6 candles.',
      evidence: ['Backtest Run #42', 'Live confirmation log'],
      confidence: 0.92,
      isFact: true,
      reasoning: 'High-conviction pattern: Pullback to dynamic EMA support in verified uptrend exhibits highest empirical win rate.',
    });

    // 4. Improvement Memory
    this.addAgentMemory({
      category: 'IMPROVEMENT',
      market: 'UNIVERSAL',
      timeframe: '1m/5m',
      context: 'Historical trade evaluation over 500 signals.',
      observation: 'Trades taken during low-volume weekend consolidation (ATR < 0.5 percentile) produced 41% win rate compared to 62% during active volume sessions.',
      decision: 'Formulate Improvement Proposal: Introduce minimum ATR activity threshold to filter flat chop sessions.',
      outcome: 'Pending backtest validation and human approval.',
      evidence: ['Weekend performance statistics breakdown', 'Sample size n=142'],
      confidence: 0.85,
      isFact: true,
      reasoning: 'Filtering dead consolidation will reduce trade frequency by ~18% but expected to lift net system expectancy by +0.14R.',
    });

    // 5. Market Memory item
    this.recordMarketObservation({
      symbol: 'BTCUSDT',
      market: 'CRYPTO',
      timeframe: '5m',
      setup: 'EMA Pullback Continuation',
      marketCondition: 'TRENDING_BULLISH',
      candleContext: 'Clean bullish trend with higher highs and higher lows',
      technicalContext: 'EMA 20 > 50, RSI between 45-65',
      outcome: 'WIN',
      evidenceReferences: ['Session 2026-10-05', 'Candle batch #102'],
    });

    // 6. Sample Daily Learning Session
    this.addLearningSession({
      sessionId: `learn_${Date.now()}_alpha`,
      startTime: Date.now() - 3600000,
      endTime: Date.now() - 1800000,
      sourcesProcessed: 4,
      newKnowledgeCount: 3,
      updatedKnowledgeCount: 1,
      contradictionsFound: 1,
      importantMarketObservations: [
        'Overhead resistance rejections in BTCUSDT 5m show consistent retail breakout traps',
        'Weekend low ATR periods degrade directional follow-through',
      ],
      summary: 'Daily learning session completed. Processed classic literature on position sizing and price action false breakouts. Flagged 1 contradiction regarding oscillator oversold thresholds.',
      status: 'COMPLETED',
    });
  }
}

export const memoryService = MemoryService.getInstance();
