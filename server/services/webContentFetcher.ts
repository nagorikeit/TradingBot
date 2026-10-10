import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { getStorageDir } from './storageUtils';
import {
  FetchedContentItem,
  FetchPolicyConfig,
  FetchResult,
  FetchStatistics,
} from '../types/contentTypes';
import { sourceRegistryService } from './sourceRegistryService';
import { contentSanitizer } from './contentSanitizer';

const STORAGE_DIR = getStorageDir();
const CONTENT_FILE = path.join(STORAGE_DIR, 'fetched_content_db.json');

const DEFAULT_POLICY: FetchPolicyConfig = {
  maxResponseSizeBytes: 2 * 1024 * 1024, // 2MB
  timeoutMs: 8000,                       // 8 seconds
  maxRedirects: 3,
  rateLimitCooldownMs: 10000,            // 10s cooldown per source
  maxRetries: 2,
};

export class WebContentFetcher {
  private static instance: WebContentFetcher;
  private fetchedItems: Map<string, FetchedContentItem> = new Map();
  private lastFetchTimestamps: Map<string, number> = new Map();
  private stats: FetchStatistics = {
    totalFetches: 0,
    successCount: 0,
    failedCount: 0,
    rateLimitedCount: 0,
    blockedCount: 0,
    securityFlaggedCount: 0,
    storedContentCount: 0,
  };

  private constructor() {
    this.ensureStorageDir();
    this.loadFromStorage();
  }

  public static getInstance(): WebContentFetcher {
    if (!WebContentFetcher.instance) {
      WebContentFetcher.instance = new WebContentFetcher();
    }
    return WebContentFetcher.instance;
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
      if (fs.existsSync(CONTENT_FILE)) {
        const raw = fs.readFileSync(CONTENT_FILE, 'utf-8');
        const list: FetchedContentItem[] = JSON.parse(raw);
        list.forEach((item) => {
          this.fetchedItems.set(item.id, item);
          if (item.securityStatus === 'SUSPICIOUS_DATA' || item.securityStatus === 'BLOCKED_DATA') {
            this.stats.securityFlaggedCount++;
          }
          if (item.fetchStatus === 'SUCCESS') {
            this.stats.successCount++;
          }
        });
        this.stats.storedContentCount = this.fetchedItems.size;
        this.stats.totalFetches = list.length;
      }
    } catch (err) {
      console.error('[FETCH] Error loading stored content:', err);
    }
  }

  private saveToStorage(): void {
    try {
      this.ensureStorageDir();
      // Cap maximum stored items at 200 (rotate oldest)
      let list = Array.from(this.fetchedItems.values());
      if (list.length > 200) {
        list.sort((a, b) => b.fetchedAt - a.fetchedAt);
        list = list.slice(0, 200);
        this.fetchedItems.clear();
        list.forEach((i) => this.fetchedItems.set(i.id, i));
      }
      fs.writeFileSync(CONTENT_FILE, JSON.stringify(list, null, 2), 'utf-8');
      this.stats.storedContentCount = this.fetchedItems.size;
    } catch (err) {
      console.error('[FETCH] Error saving stored content:', err);
    }
  }

  /**
   * SSRF Protection: Checks if IP is loopback, private, link-local, or restricted
   */
  public isPrivateOrRestrictedIp(ip: string): boolean {
    if (!ip) return true;

    // Normalize IPv4-mapped IPv6 e.g. ::ffff:192.168.1.1
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    const ipv4Parts = ip.split('.').map(Number);
    if (ipv4Parts.length === 4 && ipv4Parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
      const [a, b] = ipv4Parts;
      if (a === 127) return true;                         // 127.0.0.0/8 (Loopback)
      if (a === 10) return true;                          // 10.0.0.0/8 (Private)
      if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12 (Private)
      if (a === 192 && b === 168) return true;            // 192.168.0.0/16 (Private)
      if (a === 169 && b === 254) return true;            // 169.254.0.0/16 (Link-local / Cloud metadata)
      if (a === 0) return true;                           // 0.0.0.0/8
      if (a === 100 && b >= 64 && b <= 127) return true;  // 100.64.0.0/10 (Carrier-grade NAT)
      if (a >= 224) return true;                          // 224.0.0.0/4 (Multicast / Reserved)
      return false;
    }

    const normalizedIpv6 = ip.toLowerCase();
    if (normalizedIpv6 === '::1' || normalizedIpv6 === '::') return true;
    if (normalizedIpv6.startsWith('fc') || normalizedIpv6.startsWith('fd')) return true; // fc00::/7 (ULA)
    if (
      normalizedIpv6.startsWith('fe8') ||
      normalizedIpv6.startsWith('fe9') ||
      normalizedIpv6.startsWith('fea') ||
      normalizedIpv6.startsWith('feb')
    ) {
      return true; // fe80::/10 (Link-local)
    }
    if (normalizedIpv6.startsWith('ff')) return true; // Multicast
    return false;
  }

  /**
   * SSRF Protection: Validates URL protocol, hostname and performs DNS resolution check.
   */
  public async validateUrlSecurity(rawUrl: string): Promise<{ safe: boolean; reason?: string; resolvedIp?: string }> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { safe: false, reason: 'Malformed URL' };
    }

    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return { safe: false, reason: `Dangerous or unsupported protocol: "${protocol}"` };
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return { safe: false, reason: `Direct loopback or local host prohibited: "${host}"` };
    }

    // Direct IP format check in hostname
    if (this.isPrivateOrRestrictedIp(host)) {
      return { safe: false, reason: `Direct private IP host prohibited: "${host}"` };
    }

    // Perform DNS lookup to check resolved IP
    try {
      const records = await dns.promises.lookup(host, { all: true });
      for (const record of records) {
        if (this.isPrivateOrRestrictedIp(record.address)) {
          return {
            safe: false,
            reason: `Host "${host}" resolves to private/restricted IP "${record.address}" (SSRF blocked)`,
            resolvedIp: record.address,
          };
        }
      }
      return { safe: true, resolvedIp: records[0]?.address };
    } catch (err: unknown) {
      return { safe: false, reason: `DNS resolution failed: ${err instanceof Error ? err.message : 'Unknown DNS error'}` };
    }
  }

  /**
   * Fetch public content for a registered source with complete security & SSRF defense
   */
  public async fetchSourceContent(
    sourceId: string,
    overridePolicy?: Partial<FetchPolicyConfig>
  ): Promise<FetchResult> {
    const startTime = Date.now();
    const policy = { ...DEFAULT_POLICY, ...overridePolicy };
    this.stats.totalFetches++;

    // 1. Source Registry & Eligibility Verification
    const source = sourceRegistryService.getSourceById(sourceId);
    if (!source) {
      this.stats.failedCount++;
      return {
        ok: false,
        fetchStatus: 'FAILED',
        error: `Source "${sourceId}" not found in Source Registry`,
        durationMs: Date.now() - startTime,
      };
    }

    // Check status eligibility
    if (source.status === 'BLOCKED' || source.status === 'ARCHIVED' || source.status === 'PAUSED') {
      this.stats.blockedCount++;
      console.log(`[FETCH] source blocked: ${source.name} is ${source.status}`);
      return {
        ok: false,
        fetchStatus: 'BLOCKED',
        error: `Source access blocked: Source status is "${source.status}"`,
        durationMs: Date.now() - startTime,
      };
    }

    if (source.status === 'DISCOVERED' || source.status === 'UNDER_REVIEW') {
      this.stats.blockedCount++;
      console.log(`[FETCH] source pending review: ${source.name} must be approved before fetch`);
      return {
        ok: false,
        fetchStatus: 'BLOCKED',
        error: `Source requires review: Status is "${source.status}". Must be TRUSTED or MONITORED to fetch.`,
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Source-Level Rate Limiting & Cooldown Check
    const lastFetch = this.lastFetchTimestamps.get(sourceId);
    if (lastFetch && Date.now() - lastFetch < policy.rateLimitCooldownMs) {
      const waitRemainingMs = policy.rateLimitCooldownMs - (Date.now() - lastFetch);
      this.stats.rateLimitedCount++;
      console.log(`[FETCH] rate limit applied: ${source.name} cooldown active for ${Math.ceil(waitRemainingMs / 1000)}s`);
      return {
        ok: false,
        fetchStatus: 'RATE_LIMITED',
        error: `Rate limit cooldown active. Please wait ${Math.ceil(waitRemainingMs / 1000)} seconds.`,
        durationMs: Date.now() - startTime,
      };
    }

    // 3. SSRF and Protocol Security Validation
    console.log(`[FETCH] source started: ${source.name} (${source.url})`);
    const secCheck = await this.validateUrlSecurity(source.url);
    if (!secCheck.safe) {
      this.stats.blockedCount++;
      console.log(`[FETCH] SSRF protection blocked request: ${secCheck.reason}`);
      return {
        ok: false,
        fetchStatus: 'SSRF_BLOCKED',
        error: `Security blocked: ${secCheck.reason}`,
        durationMs: Date.now() - startTime,
      };
    }

    // 4. Controlled Fetch with Retry, Redirect Tracking, and Timeout
    let currentUrl = source.url;
    let redirectCount = 0;
    let attempt = 0;
    let response: Response | null = null;
    let responseText = '';
    let lastError: string | undefined;

    while (attempt <= policy.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), policy.timeoutMs);

        // Honest, standard HTTP Client identity (NO user-agent rotation, NO fake headers)
        const res = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'TradePulse-Research-Agent/1.0 (+https://tradepulse.internal/bot)',
            Accept: 'text/html,application/xhtml+xml,application/xml,text/xml,application/rss+xml,application/json,text/plain;q=0.9,*/*;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
          },
          signal: controller.signal,
          redirect: 'manual', // Manual redirect control to validate SSRF on EVERY redirect hop!
        });

        clearTimeout(timeoutId);

        // Handle Redirects with Redirect SSRF Protection
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          redirectCount++;
          if (redirectCount > policy.maxRedirects) {
            throw new Error(`Exceeded maximum redirect limit (${policy.maxRedirects})`);
          }

          const location = res.headers.get('location');
          if (!location) {
            throw new Error(`Redirect HTTP ${res.status} returned without Location header`);
          }

          // Resolve relative redirect against current URL
          const nextUrl = new URL(location, currentUrl).toString();

          // CRITICAL: Re-validate SSRF on the redirect target before following!
          const redirectSecCheck = await this.validateUrlSecurity(nextUrl);
          if (!redirectSecCheck.safe) {
            console.log(`[FETCH] SSRF protection blocked redirect target: ${redirectSecCheck.reason}`);
            this.stats.blockedCount++;
            return {
              ok: false,
              fetchStatus: 'SSRF_BLOCKED',
              error: `SSRF blocked on redirect hop: ${redirectSecCheck.reason}`,
              durationMs: Date.now() - startTime,
            };
          }

          currentUrl = nextUrl;
          continue; // Follow redirect
        }

        response = res;
        break; // Successful connection
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error';
        lastError = msg;
        if (msg.includes('abort')) {
          this.stats.failedCount++;
          console.log(`[FETCH] source timeout: ${source.name} after ${policy.timeoutMs}ms`);
          return {
            ok: false,
            fetchStatus: 'TIMEOUT',
            error: `Request timed out after ${policy.timeoutMs}ms`,
            durationMs: Date.now() - startTime,
          };
        }

        // Retry with backoff if attempts remaining
        if (attempt <= policy.maxRetries) {
          const backoffMs = attempt * 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    if (!response) {
      this.stats.failedCount++;
      return {
        ok: false,
        fetchStatus: 'FAILED',
        error: lastError || 'Failed to connect after retries',
        durationMs: Date.now() - startTime,
      };
    }

    // 5. Response Status and Size Verification
    if (response.status === 401 || response.status === 403) {
      this.stats.failedCount++;
      console.log(`[FETCH] access restricted for ${source.name}: HTTP ${response.status}`);
      return {
        ok: false,
        fetchStatus: 'ACCESS_RESTRICTED',
        httpStatus: response.status,
        error: `HTTP ${response.status}: Source access is restricted or requires authentication`,
        durationMs: Date.now() - startTime,
      };
    }

    if (response.status === 429) {
      this.stats.rateLimitedCount++;
      console.log(`[FETCH] source rate limited by remote server: HTTP 429`);
      return {
        ok: false,
        fetchStatus: 'RATE_LIMITED',
        httpStatus: response.status,
        error: 'Remote server returned HTTP 429 Too Many Requests',
        durationMs: Date.now() - startTime,
      };
    }

    if (!response.ok) {
      this.stats.failedCount++;
      return {
        ok: false,
        fetchStatus: 'FAILED',
        httpStatus: response.status,
        error: `Remote server returned HTTP ${response.status} ${response.statusText}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Content-Type validation
    const contentTypeHeader = (response.headers.get('content-type') || 'text/plain').toLowerCase();
    const isSupportedType =
      contentTypeHeader.includes('html') ||
      contentTypeHeader.includes('xml') ||
      contentTypeHeader.includes('rss') ||
      contentTypeHeader.includes('json') ||
      contentTypeHeader.includes('text');

    if (!isSupportedType) {
      this.stats.failedCount++;
      console.log(`[FETCH] unsupported content type: ${contentTypeHeader}`);
      return {
        ok: false,
        fetchStatus: 'UNSUPPORTED',
        httpStatus: response.status,
        error: `Unsupported MIME type: "${contentTypeHeader}". Only text, html, xml, rss and json are supported.`,
        durationMs: Date.now() - startTime,
      };
    }

    // Response size limit
    const contentLengthHeader = response.headers.get('content-length');
    if (contentLengthHeader && parseInt(contentLengthHeader, 10) > policy.maxResponseSizeBytes) {
      this.stats.failedCount++;
      console.log(`[FETCH] oversized response rejected: ${contentLengthHeader} bytes`);
      return {
        ok: false,
        fetchStatus: 'FAILED',
        httpStatus: response.status,
        error: `Response size exceeds limit of ${policy.maxResponseSizeBytes} bytes`,
        durationMs: Date.now() - startTime,
      };
    }

    // Read response text
    responseText = await response.text();
    if (responseText.length > policy.maxResponseSizeBytes) {
      this.stats.failedCount++;
      return {
        ok: false,
        fetchStatus: 'FAILED',
        httpStatus: response.status,
        error: `Response body length (${responseText.length} chars) exceeded max limit`,
        durationMs: Date.now() - startTime,
      };
    }

    // 6. Security Sanitization & Threat Isolation
    const sanitized = contentSanitizer.sanitizeRawContent(responseText, contentTypeHeader, currentUrl);

    if (sanitized.securityStatus === 'SUSPICIOUS_DATA') {
      this.stats.securityFlaggedCount++;
      console.log(`[SECURITY] suspicious content flagged for ${source.name}: ${sanitized.securityNotes.join('; ')}`);
    } else {
      console.log(`[SECURITY] untrusted content isolated safely for ${source.name} [SAFE_DATA]`);
    }

    const now = Date.now();
    this.lastFetchTimestamps.set(sourceId, now);

    // 7. Store Result in Fetched Content DB (with strict untrusted: true marker)
    const itemId = `cnt_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const contentItem: FetchedContentItem = {
      id: itemId,
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: currentUrl,
      canonicalUrl: sanitized.canonicalUrl,
      contentType: sanitized.contentType,
      mimeType: contentTypeHeader,
      title: sanitized.title,
      publishedAt: new Date(now).toISOString(),
      fetchedAt: now,
      content: sanitized.cleanedText,
      contentHash: sanitized.contentHash,
      contentLength: sanitized.cleanedText.length,
      httpStatus: response.status,
      fetchStatus: 'SUCCESS',
      securityStatus: sanitized.securityStatus,
      securityNotes: sanitized.securityNotes,
      untrusted: true, // Hard architectural indicator: NEVER AN INSTRUCTION
      feedItems: sanitized.feedItems,
    };

    // Deduplication check: if identical hash already exists from same source, update timestamp
    let existingItem: FetchedContentItem | undefined;
    for (const item of this.fetchedItems.values()) {
      if (item.sourceId === source.id && item.contentHash === contentItem.contentHash) {
        existingItem = item;
        break;
      }
    }

    if (existingItem) {
      existingItem.fetchedAt = now;
      existingItem.httpStatus = response.status;
      this.fetchedItems.set(existingItem.id, existingItem);
    } else {
      this.fetchedItems.set(itemId, contentItem);
    }

    this.saveToStorage();

    // Update source lastCheckedAt in Source Registry
    sourceRegistryService.updateSource(source.id, { lastCheckedAt: now });

    this.stats.successCount++;
    this.stats.lastFetchedAt = now;

    console.log(`[FETCH] source success: ${source.name} (${contentItem.contentLength} chars clean text)`);

    return {
      ok: true,
      item: existingItem || contentItem,
      fetchStatus: 'SUCCESS',
      httpStatus: response.status,
      durationMs: Date.now() - startTime,
    };
  }

  public getAllFetchedContent(filter?: {
    sourceId?: string;
    securityStatus?: string;
    contentType?: string;
  }): FetchedContentItem[] {
    let list = Array.from(this.fetchedItems.values());

    if (filter?.sourceId) {
      list = list.filter((c) => c.sourceId === filter.sourceId);
    }
    if (filter?.securityStatus) {
      list = list.filter((c) => c.securityStatus === filter.securityStatus);
    }
    if (filter?.contentType) {
      list = list.filter((c) => c.contentType === filter.contentType);
    }

    return list.sort((a, b) => b.fetchedAt - a.fetchedAt);
  }

  public getContentById(id: string): FetchedContentItem | undefined {
    return this.fetchedItems.get(id);
  }

  public getStats(): FetchStatistics {
    return {
      ...this.stats,
      storedContentCount: this.fetchedItems.size,
    };
  }
}

export const webContentFetcher = WebContentFetcher.getInstance();
