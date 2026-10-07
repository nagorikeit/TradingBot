import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  RegisteredSource,
  SourceReviewItem,
  SourceType,
  SourceCategory,
  SourceStatus,
  AuthorityLevel,
  SourceRegistryStats,
} from '../types/sourceTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, '../storage');
const SOURCES_FILE = path.join(STORAGE_DIR, 'sources_db.json');
const REVIEWS_FILE = path.join(STORAGE_DIR, 'source_reviews.json');

export class SourceRegistryService {
  private static instance: SourceRegistryService;
  private sources: Map<string, RegisteredSource> = new Map();
  private reviewQueue: Map<string, SourceReviewItem> = new Map();

  private constructor() {
    this.ensureStorageDir();
    this.loadFromStorage();
    if (this.sources.size === 0) {
      this.seedInitialSources();
    }
  }

  public static getInstance(): SourceRegistryService {
    if (!SourceRegistryService.instance) {
      SourceRegistryService.instance = new SourceRegistryService();
    }
    return SourceRegistryService.instance;
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  private loadFromStorage(): void {
    try {
      if (fs.existsSync(SOURCES_FILE)) {
        const raw = fs.readFileSync(SOURCES_FILE, 'utf-8');
        const list: RegisteredSource[] = JSON.parse(raw);
        list.forEach((s) => this.sources.set(s.id, s));
      }
      if (fs.existsSync(REVIEWS_FILE)) {
        const raw = fs.readFileSync(REVIEWS_FILE, 'utf-8');
        const list: SourceReviewItem[] = JSON.parse(raw);
        list.forEach((r) => this.reviewQueue.set(r.sourceId, r));
      }
    } catch (err) {
      console.error('[SOURCE] Error loading source registry storage:', err);
    }
  }

  private saveToStorage(): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(SOURCES_FILE, JSON.stringify(Array.from(this.sources.values()), null, 2), 'utf-8');
      fs.writeFileSync(REVIEWS_FILE, JSON.stringify(Array.from(this.reviewQueue.values()), null, 2), 'utf-8');
    } catch (err) {
      console.error('[SOURCE] Error saving source registry storage:', err);
    }
  }

  /**
   * Validates and normalizes URLs. Rejects dangerous protocols.
   */
  public normalizeUrl(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('Invalid URL: URL must be a non-empty string');
    }

    const trimmed = rawUrl.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(`Invalid URL format: "${trimmed}"`);
    }

    // Protocol validation: Strictly permit http and https only
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error(`Forbidden URL protocol "${protocol}". Only http: and https: protocols are permitted.`);
    }

    // Disallow local/loopback and dangerous host patterns
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      throw new Error(`Forbidden URL host "${host}": Loopback and private addresses are restricted.`);
    }

    // Normalized clean URL (remove hash/fragments, strip redundant trailing slash)
    parsed.hash = '';
    let normalized = parsed.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  /**
   * Asserts no sensitive keys or credentials are in metadata
   */
  private assertNoSecrets(text?: string): void {
    if (!text) return;
    const sensitivePatterns = [
      /AIza[0-9A-Za-z-_]{35}/,
      /secret/i,
      /password/i,
      /api_key/i,
      /private_key/i,
      /bearer\s+[a-zA-Z0-9_\-\.]+/i,
    ];
    for (const pattern of sensitivePatterns) {
      if (pattern.test(text) && (text.includes('sk-') || text.includes('AIza') || text.includes('ghp_'))) {
        throw new Error('Security Violation: Potential secret or credential detected in source metadata');
      }
    }
  }

  /**
   * Register a new source with duplicate protection and validation
   */
  public registerSource(input: {
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
  }): { source: RegisteredSource; isDuplicate: boolean } {
    this.assertNoSecrets(input.name);
    this.assertNoSecrets(input.reviewNotes);
    this.assertNoSecrets(input.reviewReason);

    const normalizedUrl = this.normalizeUrl(input.url);

    // Duplicate URL detection
    for (const existing of this.sources.values()) {
      if (existing.normalizedUrl === normalizedUrl) {
        console.log(`[SOURCE] duplicate source rejected for URL: ${normalizedUrl}`);
        return { source: existing, isDuplicate: true };
      }
    }

    const now = Date.now();
    const id = `src_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const status = input.status || 'UNDER_REVIEW';

    const newSource: RegisteredSource = {
      id,
      name: input.name.trim(),
      url: input.url.trim(),
      normalizedUrl,
      sourceType: input.sourceType,
      categories: input.categories && input.categories.length > 0 ? input.categories : ['OTHER'],
      status,
      trustScore: typeof input.trustScore === 'number' ? Math.min(1.0, Math.max(0.0, input.trustScore)) : 0.5,
      authorityLevel: input.authorityLevel || 'UNVERIFIED',
      lastReviewedAt: status === 'TRUSTED' ? now : undefined,
      reviewNotes: input.reviewNotes?.trim(),
      reviewReason: input.reviewReason?.trim(),
      evidenceLinks: input.evidenceLinks || [],
      createdAt: now,
      updatedAt: now,
    };

    this.sources.set(id, newSource);

    // If source needs review, enqueue it
    if (status === 'UNDER_REVIEW' || status === 'DISCOVERED') {
      this.reviewQueue.set(id, {
        sourceId: id,
        name: newSource.name,
        url: newSource.url,
        reason: input.reviewReason || 'New source pending review and trust evaluation',
        discoveredAt: now,
        discoveredBy: 'SYSTEM',
        reviewStatus: 'PENDING',
        reviewNotes: input.reviewNotes,
        evidence: input.evidenceLinks,
      });
      console.log(`[SOURCE] source moved to review queue: ${newSource.name} (${id})`);
    }

    this.saveToStorage();
    console.log(`[SOURCE] source registered: ${newSource.name} [${newSource.status}]`);
    return { source: newSource, isDuplicate: false };
  }

  /**
   * Update existing source
   */
  public updateSource(
    id: string,
    updates: Partial<Omit<RegisteredSource, 'id' | 'createdAt' | 'normalizedUrl'>>
  ): RegisteredSource {
    const existing = this.sources.get(id);
    if (!existing) {
      throw new Error(`Source with ID "${id}" not found`);
    }

    this.assertNoSecrets(updates.name);
    this.assertNoSecrets(updates.reviewNotes);

    const now = Date.now();
    let normalizedUrl = existing.normalizedUrl;

    if (updates.url && updates.url !== existing.url) {
      normalizedUrl = this.normalizeUrl(updates.url);
      // Ensure new URL doesn't collide with another existing source
      for (const [otherId, other] of this.sources.entries()) {
        if (otherId !== id && other.normalizedUrl === normalizedUrl) {
          throw new Error(`URL collision: Another source already exists with URL "${normalizedUrl}"`);
        }
      }
    }

    const updatedSource: RegisteredSource = {
      ...existing,
      ...updates,
      normalizedUrl,
      trustScore: typeof updates.trustScore === 'number'
        ? Math.min(1.0, Math.max(0.0, updates.trustScore))
        : existing.trustScore,
      lastReviewedAt: updates.status === 'TRUSTED' ? now : existing.lastReviewedAt,
      updatedAt: now,
    };

    this.sources.set(id, updatedSource);

    // Sync review queue status
    const queueItem = this.reviewQueue.get(id);
    if (queueItem) {
      if (updates.status === 'TRUSTED') {
        queueItem.reviewStatus = 'APPROVED';
      } else if (updates.status === 'BLOCKED') {
        queueItem.reviewStatus = 'REJECTED';
      }
    }

    this.saveToStorage();
    console.log(`[SOURCE] source updated: ${updatedSource.name} [${updatedSource.status}]`);
    return updatedSource;
  }

  public getAllSources(filter?: {
    status?: SourceStatus;
    category?: SourceCategory;
    sourceType?: SourceType;
  }): RegisteredSource[] {
    let list = Array.from(this.sources.values());

    if (filter?.status) {
      list = list.filter((s) => s.status === filter.status);
    }
    if (filter?.category) {
      list = list.filter((s) => s.categories.includes(filter.category!));
    }
    if (filter?.sourceType) {
      list = list.filter((s) => s.sourceType === filter.sourceType);
    }

    return list.sort((a, b) => b.trustScore - a.trustScore || b.updatedAt - a.updatedAt);
  }

  public getSourceById(id: string): RegisteredSource | undefined {
    return this.sources.get(id);
  }

  public getReviewQueue(): SourceReviewItem[] {
    return Array.from(this.reviewQueue.values()).sort((a, b) => b.discoveredAt - a.discoveredAt);
  }

  public updateReviewItem(
    sourceId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ): SourceReviewItem {
    const item = this.reviewQueue.get(sourceId);
    if (!item) {
      throw new Error(`Review item for source "${sourceId}" not found`);
    }

    item.reviewStatus = decision;
    item.reviewNotes = notes;

    // Update parent source status
    const source = this.sources.get(sourceId);
    if (source) {
      source.status = decision === 'APPROVED' ? 'TRUSTED' : 'BLOCKED';
      source.lastReviewedAt = Date.now();
      if (notes) source.reviewNotes = notes;
      this.sources.set(sourceId, source);
    }

    this.saveToStorage();
    console.log(`[SOURCE] review decision: ${decision} for source ${sourceId}`);
    return item;
  }

  public getStats(): SourceRegistryStats {
    const byStatus: Record<SourceStatus, number> = {
      DISCOVERED: 0,
      UNDER_REVIEW: 0,
      TRUSTED: 0,
      MONITORED: 0,
      PAUSED: 0,
      BLOCKED: 0,
      ARCHIVED: 0,
    };

    const byType: Record<SourceType, number> = {
      WEBSITE: 0,
      RSS: 0,
      YOUTUBE: 0,
      RESEARCH: 0,
      BLOG: 0,
      NEWS: 0,
      COMMUNITY: 0,
      DOCUMENTATION: 0,
      OTHER: 0,
    };

    for (const source of this.sources.values()) {
      if (byStatus[source.status] !== undefined) {
        byStatus[source.status]++;
      }
      if (byType[source.sourceType] !== undefined) {
        byType[source.sourceType]++;
      }
    }

    const pendingReviewCount = Array.from(this.reviewQueue.values()).filter(
      (r) => r.reviewStatus === 'PENDING'
    ).length;

    return {
      totalSources: this.sources.size,
      byStatus,
      byType,
      pendingReviewCount,
    };
  }

  /**
   * Seeds initial legitimate, high-authority macroeconomic & trading research sources
   */
  private seedInitialSources(): void {
    const initialSources: Array<Parameters<SourceRegistryService['registerSource']>[0]> = [
      {
        name: 'Bank for International Settlements (BIS)',
        url: 'https://www.bis.org',
        sourceType: 'RESEARCH',
        categories: ['MACROECONOMICS', 'RESEARCH', 'CURRENCY'],
        status: 'TRUSTED',
        trustScore: 0.95,
        authorityLevel: 'TIER_1_OFFICIAL',
        reviewNotes: 'Global central bank research hub; authoritative data on foreign exchange, liquidity, and systemic risk.',
      },
      {
        name: 'Federal Reserve Economic Data (FRED)',
        url: 'https://fred.stlouisfed.org',
        sourceType: 'WEBSITE',
        categories: ['MACROECONOMICS', 'FUNDAMENTAL_ANALYSIS', 'CURRENCY'],
        status: 'TRUSTED',
        trustScore: 0.95,
        authorityLevel: 'TIER_1_OFFICIAL',
        reviewNotes: 'St. Louis Fed official macroeconomic data, inflation, yields, and interest rate statistics.',
      },
      {
        name: 'Investopedia Financial Education',
        url: 'https://www.investopedia.com',
        sourceType: 'WEBSITE',
        categories: ['EDUCATION', 'TRADING', 'TECHNICAL_ANALYSIS', 'RISK_MANAGEMENT'],
        status: 'TRUSTED',
        trustScore: 0.85,
        authorityLevel: 'TIER_2_ESTABLISHED',
        reviewNotes: 'Standardized reference for technical indicators, price action concepts, and risk metrics.',
      },
      {
        name: 'DailyFX Technical & Currency Analysis',
        url: 'https://www.dailyfx.com',
        sourceType: 'NEWS',
        categories: ['FOREX', 'CURRENCY', 'TECHNICAL_ANALYSIS', 'MARKET_NEWS'],
        status: 'MONITORED',
        trustScore: 0.80,
        authorityLevel: 'TIER_2_ESTABLISHED',
        reviewNotes: 'Established FX market research, support/resistance levels, and economic calendar analysis.',
      },
      {
        name: 'Financial Times Markets RSS Feed',
        url: 'https://www.ft.com/markets?format=rss',
        sourceType: 'RSS',
        categories: ['MARKET_NEWS', 'MACROECONOMICS'],
        status: 'UNDER_REVIEW',
        trustScore: 0.75,
        authorityLevel: 'TIER_2_ESTABLISHED',
        reviewNotes: 'Financial market commentary RSS; pending review for integration in daily news digest.',
        reviewReason: 'Submitted for Phase 2B RSS ingestion validation.',
      },
    ];

    initialSources.forEach((s) => this.registerSource(s));
  }
}

export const sourceRegistryService = SourceRegistryService.getInstance();
