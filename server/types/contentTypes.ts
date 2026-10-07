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
  content: string; // Sanitized plain text
  contentHash: string; // SHA-256 for deduplication
  contentLength: number;
  httpStatus: number;
  fetchStatus: FetchStatus;
  securityStatus: ContentSecurityStatus;
  securityNotes?: string[];
  untrusted: true; // Hard architectural indicator: NEVER AN INSTRUCTION
  feedItems?: RssFeedEntry[];
}

export interface FetchPolicyConfig {
  maxResponseSizeBytes: number; // e.g. 2MB (2 * 1024 * 1024)
  timeoutMs: number;            // e.g. 8000ms
  maxRedirects: number;         // e.g. 3
  rateLimitCooldownMs: number;  // e.g. 15000ms per source
  maxRetries: number;           // e.g. 2 with backoff
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
