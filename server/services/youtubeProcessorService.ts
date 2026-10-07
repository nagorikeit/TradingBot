import crypto from 'crypto';
import {
  UnifiedResearchItem,
  ContentChunk,
  TranscriptStatus,
} from '../types/researchContentTypes';
import { webContentFetcher } from './webContentFetcher';
import { contentSanitizer } from './contentSanitizer';
import { sourceRegistryService } from './sourceRegistryService';

export class YouTubeProcessorService {
  private static instance: YouTubeProcessorService;
  private lastFetchTimestamps: Map<string, number> = new Map();
  private readonly rateLimitCooldownMs = 3000; // 3 seconds between fetches per source

  public static getInstance(): YouTubeProcessorService {
    if (!YouTubeProcessorService.instance) {
      YouTubeProcessorService.instance = new YouTubeProcessorService();
    }
    return YouTubeProcessorService.instance;
  }

  /**
   * Extracts clean 11-char YouTube Video ID from various URL patterns
   */
  public extractVideoId(url: string): string | null {
    if (!url) return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    return match ? match[1] : null;
  }

  /**
   * Fetches public YouTube metadata & transcript without bypassing bot protection or logins
   */
  public async processYouTubeUrl(
    sourceId: string,
    rawUrl: string
  ): Promise<{ ok: boolean; item?: UnifiedResearchItem; error?: string; acquisitionStatus?: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'RATE_LIMITED' }> {
    const videoId = this.extractVideoId(rawUrl);
    if (!videoId) {
      return { ok: false, error: 'Invalid YouTube URL: Could not extract 11-character Video ID', acquisitionStatus: 'FAILED' };
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const normalizedUrl = canonicalUrl;

    // 1. Source Registry & Eligibility Verification (if registered sourceId provided)
    if (sourceId && sourceId !== 'src_youtube_custom') {
      const source = sourceRegistryService.getSourceById(sourceId);
      if (!source) {
        return { ok: false, error: `Source "${sourceId}" not found in Source Registry`, acquisitionStatus: 'BLOCKED' };
      }
      if (source.status === 'BLOCKED' || source.status === 'ARCHIVED' || source.status === 'PAUSED') {
        return { ok: false, error: `Source access blocked: Source status is "${source.status}"`, acquisitionStatus: 'BLOCKED' };
      }
      if (source.status === 'DISCOVERED' || source.status === 'UNDER_REVIEW') {
        return { ok: false, error: `Source requires review: Status is "${source.status}". Must be TRUSTED or MONITORED to fetch.`, acquisitionStatus: 'BLOCKED' };
      }
    }

    // 2. Rate Limiting Check per source
    const lastFetch = this.lastFetchTimestamps.get(sourceId || 'default_yt');
    if (lastFetch && Date.now() - lastFetch < this.rateLimitCooldownMs) {
      const waitSec = Math.ceil((this.rateLimitCooldownMs - (Date.now() - lastFetch)) / 1000);
      return { ok: false, error: `Rate limit cooldown active. Please wait ${waitSec}s before fetching again.`, acquisitionStatus: 'RATE_LIMITED' };
    }
    this.lastFetchTimestamps.set(sourceId || 'default_yt', Date.now());

    // 3. Validate URL security against SSRF
    const securityCheck = await webContentFetcher.validateUrlSecurity(canonicalUrl);
    if (!securityCheck.safe) {
      return { ok: false, error: `SSRF Security Blocked: ${securityCheck.reason}`, acquisitionStatus: 'BLOCKED' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(canonicalUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: `YouTube HTTP error: ${response.status} ${response.statusText}`,
        };
      }

      const html = await response.text();

      // Extract basic public metadata from HTML headers / meta tags
      const titleMatch =
        html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? this.decodeEntities(titleMatch[1].replace(' - YouTube', '').trim()) : `YouTube Video ${videoId}`;

      const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const description = descMatch ? this.decodeEntities(descMatch[1].trim()) : '';

      const channelMatch =
        html.match(/<link\s+itemprop=["']name["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+property=["']og:video:actor["']\s+content=["']([^"']+)["']/i) ||
        html.match(/"ownerChannelName":"([^"]+)"/i);
      const channelName = channelMatch ? this.decodeEntities(channelMatch[1].trim()) : 'YouTube Channel';

      const dateMatch =
        html.match(/<meta\s+itemprop=["']datePublished["']\s+content=["']([^"']+)["']/i) ||
        html.match(/<meta\s+itemprop=["']uploadDate["']\s+content=["']([^"']+)["']/i);
      const publishedAt = dateMatch ? dateMatch[1] : new Date().toISOString();

      // Look for public captions in initial player response JSON
      let transcriptText = '';
      let transcriptStatus: TranscriptStatus = 'UNAVAILABLE';
      let language = 'en';

      const captionsBlockMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
      if (captionsBlockMatch) {
        try {
          const captionTracks = JSON.parse(captionsBlockMatch[1]);
          if (Array.isArray(captionTracks) && captionTracks.length > 0) {
            // Find english or first available track
            const track = captionTracks.find((t: { languageCode?: string }) => t.languageCode?.startsWith('en')) || captionTracks[0];
            language = track.languageCode || 'en';
            const baseUrl = track.baseUrl;

            if (baseUrl && typeof baseUrl === 'string') {
              // Validate baseUrl against SSRF
              const trackSec = await webContentFetcher.validateUrlSecurity(baseUrl);
              if (trackSec.safe) {
                const trackRes = await fetch(baseUrl, {
                  headers: { 'Accept': 'application/xml,text/xml,text/plain' },
                });
                if (trackRes.ok) {
                  const trackXml = await trackRes.text();
                  transcriptText = this.parseXmlTranscript(trackXml);
                  if (transcriptText.length > 50) {
                    transcriptStatus = 'AVAILABLE';
                  }
                }
              }
            }
          }
        } catch {
          // If JSON parse or fetch fails, fallback cleanly to UNAVAILABLE
          transcriptStatus = 'UNAVAILABLE';
        }
      }

      // If transcript was not available, provide description text with clear explicit indicator
      const textToSanitize = transcriptStatus === 'AVAILABLE' && transcriptText
        ? transcriptText
        : description
        ? `[TRANSCRIPT_UNAVAILABLE: Public transcript not provided by creator.]\n\nVideo Description:\n${description}`
        : `[TRANSCRIPT_UNAVAILABLE: No public captions or description available for this video.]`;

      // 2. Run through Content Sanitizer & Prompt Injection Firewall
      const sanitized = contentSanitizer.sanitizeRawContent(
        textToSanitize,
        'text/plain',
        canonicalUrl
      );

      const now = Date.now();
      const contentId = `yt_${now}_${videoId.substring(0, 6)}`;
      const contentHash = crypto.createHash('sha256').update(sanitized.cleanedText).digest('hex');

      // 3. Prepare Logical Chunks for Phase 2D (No embeddings, pure structure)
      const chunks = this.createLogicalChunks(
        contentId,
        sanitized.cleanedText,
        'YOUTUBE',
        canonicalUrl,
        title,
        channelName,
        publishedAt
      );

      const firewallLogs: string[] = [
        `YouTube URL parsed: ID "${videoId}"`,
        `Public metadata extracted: Channel "${channelName}"`,
        `Transcript status: ${transcriptStatus} (${language})`,
        ...sanitized.securityNotes,
      ];

      const item: UnifiedResearchItem = {
        id: contentId,
        sourceId,
        sourceType: 'YOUTUBE',
        url: rawUrl,
        normalizedUrl,
        canonicalUrl,
        title,
        authorOrChannel: channelName,
        publishedAt,
        fetchedAt: now,
        language,
        contentType: 'YOUTUBE_TRANSCRIPT',
        acquisitionStatus: 'SUCCESS',
        transcriptStatus,
        extractionStatus: 'NOT_APPLICABLE',
        text: sanitized.cleanedText,
        textLength: sanitized.cleanedText.length,
        contentHash,
        securityStatus: sanitized.securityStatus,
        untrusted: true, // HARD ARCHITECTURAL INVARIANT
        metadata: {
          videoId,
          descriptionSnippet: description.substring(0, 300),
          httpStatus: response.status,
          isDuplicate: false,
        },
        chunks,
        firewallLog: firewallLogs,
      };

      return { ok: true, item, acquisitionStatus: 'SUCCESS' };
    } catch (err: unknown) {
      return {
        ok: false,
        error: `YouTube fetch failed: ${err instanceof Error ? err.message : 'Unknown network failure'}`,
        acquisitionStatus: 'FAILED',
      };
    }
  }

  /**
   * Helper to parse XML subtitle segments into clean flowing sentences
   */
  private parseXmlTranscript(xml: string): string {
    const textMatches = xml.matchAll(/<text[^>]*>([^<]+)<\/text>/g);
    const sentences: string[] = [];
    for (const match of textMatches) {
      const decoded = this.decodeEntities(match[1]).trim();
      if (decoded) {
        sentences.push(decoded);
      }
    }
    return sentences.join(' ');
  }

  /**
   * Logical Chunking (Splits into 600 - 1200 char chunks along sentence/paragraph boundaries)
   */
  public createLogicalChunks(
    contentId: string,
    fullText: string,
    sourceType: 'YOUTUBE' | 'RESEARCH' | 'PDF' | 'DOCUMENTATION' | 'EDUCATIONAL' | 'NEWS' | 'OTHER',
    sourceUrl: string,
    title: string,
    authorOrChannel?: string,
    publishedAt?: string
  ): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    if (!fullText || fullText.trim().length === 0) return chunks;

    const targetChunkSize = 800;
    const paragraphs = fullText.split(/\n\s*\n|\n/);

    let currentBuffer = '';
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (currentBuffer.length + trimmed.length + 1 <= targetChunkSize) {
        currentBuffer = currentBuffer ? `${currentBuffer} ${trimmed}` : trimmed;
      } else {
        if (currentBuffer) {
          const chunkHash = crypto.createHash('sha256').update(currentBuffer).digest('hex');
          chunks.push({
            chunkId: `${contentId}_chunk_${chunkIndex}`,
            contentId,
            chunkIndex,
            totalChunks: 0, // updated after loop
            text: currentBuffer,
            charCount: currentBuffer.length,
            sourceType,
            sourceUrl,
            title,
            authorOrChannel,
            publishedAt,
            contentHash: chunkHash,
          });
          chunkIndex++;
        }
        currentBuffer = trimmed;
      }
    }

    if (currentBuffer) {
      const chunkHash = crypto.createHash('sha256').update(currentBuffer).digest('hex');
      chunks.push({
        chunkId: `${contentId}_chunk_${chunkIndex}`,
        contentId,
        chunkIndex,
        totalChunks: 0,
        text: currentBuffer,
        charCount: currentBuffer.length,
        sourceType,
        sourceUrl,
        title,
        authorOrChannel,
        publishedAt,
        contentHash: chunkHash,
      });
      chunkIndex++;
    }

    // Update totalChunks count on each chunk
    const total = chunks.length;
    chunks.forEach((c) => (c.totalChunks = total));

    return chunks;
  }

  private decodeEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x2F;/g, '/');
  }
}

export const youtubeProcessorService = YouTubeProcessorService.getInstance();
