import crypto from 'crypto';
import {
  ContentSecurityStatus,
  RssFeedEntry,
  FetchedContentType,
} from '../types/contentTypes';

export interface SanitizedContentResult {
  title: string;
  cleanedText: string;
  contentType: FetchedContentType;
  contentHash: string;
  securityStatus: ContentSecurityStatus;
  securityNotes: string[];
  canonicalUrl?: string;
  feedItems?: RssFeedEntry[];
}

export class ContentSanitizer {
  private static instance: ContentSanitizer;

  public static getInstance(): ContentSanitizer {
    if (!ContentSanitizer.instance) {
      ContentSanitizer.instance = new ContentSanitizer();
    }
    return ContentSanitizer.instance;
  }

  /**
   * Main entry point: Sanitizes and inspects external raw content.
   * Guarantees external text remains strictly UNTRUSTED DATA.
   */
  public sanitizeRawContent(
    rawText: string,
    mimeType: string,
    sourceUrl: string
  ): SanitizedContentResult {
    const isXmlOrRss =
      mimeType.includes('xml') ||
      mimeType.includes('rss') ||
      rawText.trim().startsWith('<?xml') ||
      rawText.includes('<rss') ||
      rawText.includes('<feed');

    if (isXmlOrRss) {
      return this.processRssXml(rawText, sourceUrl);
    }

    const isHtml =
      mimeType.includes('html') ||
      rawText.toLowerCase().includes('<!doctype html') ||
      rawText.toLowerCase().includes('<html');

    if (isHtml) {
      return this.processHtmlArticle(rawText, sourceUrl);
    }

    // Fallback: Plain text / JSON
    return this.processPlainText(rawText, sourceUrl);
  }

  /**
   * Cleans HTML and extracts title, canonical URL, and readable article text
   */
  private processHtmlArticle(html: string, sourceUrl: string): SanitizedContentResult {
    // 1. Extract title
    let title = '';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = this.decodeHtmlEntities(titleMatch[1]).trim();
    } else {
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitleMatch) {
        title = this.decodeHtmlEntities(ogTitleMatch[1]).trim();
      }
    }

    // 2. Extract canonical URL if present
    let canonicalUrl: string | undefined;
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonicalMatch) {
      canonicalUrl = canonicalMatch[1].trim();
    }

    // 3. Remove executable scripts, styles, iframes, and noisy layout blocks
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ');

    // 4. Convert structural breaks to spaces or newlines
    cleaned = cleaned
      .replace(/<(br|p|div|h[1-6]|li|tr)[^>]*>/gi, '\n')
      .replace(/<\/?[^>]+(>|$)/g, ' '); // Strip remaining tags

    // 5. Decode HTML entities and collapse whitespace
    cleaned = this.decodeHtmlEntities(cleaned);
    cleaned = cleaned
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n');

    if (!title) {
      title = cleaned.split('\n')[0]?.slice(0, 100) || `Article from ${new URL(sourceUrl).hostname}`;
    }

    // 6. Inspect for prompt injection and threats
    const { securityStatus, securityNotes } = this.analyzeThreats(cleaned);
    const contentHash = this.computeHash(title, cleaned);

    return {
      title,
      cleanedText: cleaned,
      contentType: 'HTML_ARTICLE',
      contentHash,
      securityStatus,
      securityNotes,
      canonicalUrl,
    };
  }

  /**
   * Parses RSS / Atom XML feeds into structured items and consolidated plain text
   */
  private processRssXml(xml: string, sourceUrl: string): SanitizedContentResult {
    let channelTitle = '';
    const channelTitleMatch = xml.match(/<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
    if (channelTitleMatch) {
      channelTitle = this.decodeHtmlEntities(channelTitleMatch[1]).trim();
    }

    const feedItems: RssFeedEntry[] = [];
    const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && feedItems.length < 50) {
      const itemBlock = match[1];

      // Extract title
      const tMatch = itemBlock.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const itemTitle = tMatch ? this.decodeHtmlEntities(this.stripTags(tMatch[1])).trim() : 'Untitled Entry';

      // Extract link
      let itemLink = '';
      const linkHrefMatch = itemBlock.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (linkHrefMatch) {
        itemLink = linkHrefMatch[1].trim();
      } else {
        const linkTagMatch = itemBlock.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        if (linkTagMatch) {
          itemLink = linkTagMatch[1].trim();
        }
      }

      // Extract guid / id
      const guidMatch = itemBlock.match(/<(?:guid|id)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:guid|id)>/i);
      const guid = guidMatch ? guidMatch[1].trim() : itemLink;

      // Extract pubDate
      const pubMatch = itemBlock.match(/<(?:pubDate|published|updated)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:pubDate|published|updated)>/i);
      const publishedAt = pubMatch ? pubMatch[1].trim() : undefined;

      // Extract description / summary
      const descMatch = itemBlock.match(/<(?:description|summary|content|content:encoded)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content|content:encoded)>/i);
      const rawSummary = descMatch ? descMatch[1] : '';
      const cleanSummary = this.decodeHtmlEntities(this.stripTags(rawSummary)).replace(/\s+/g, ' ').trim();

      const itemHash = this.computeHash(itemTitle, cleanSummary || itemLink);

      feedItems.push({
        id: `rss_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: itemTitle,
        link: itemLink,
        guid,
        publishedAt,
        summary: cleanSummary,
        contentSnippet: cleanSummary.slice(0, 300),
        contentHash: itemHash,
      });
    }

    const title = channelTitle || `RSS Feed from ${new URL(sourceUrl).hostname}`;
    const consolidatedText = feedItems
      .map((item, idx) => `[${idx + 1}] ${item.title}\nDate: ${item.publishedAt || 'N/A'}\nLink: ${item.link}\nSummary: ${item.summary}`)
      .join('\n\n');

    const { securityStatus, securityNotes } = this.analyzeThreats(consolidatedText);
    const contentHash = this.computeHash(title, consolidatedText);

    return {
      title,
      cleanedText: consolidatedText,
      contentType: 'RSS_FEED',
      contentHash,
      securityStatus,
      securityNotes,
      feedItems,
    };
  }

  /**
   * Process raw plain text
   */
  private processPlainText(raw: string, sourceUrl: string): SanitizedContentResult {
    const cleaned = raw.replace(/[ \t]+/g, ' ').trim();
    const title = cleaned.split('\n')[0]?.slice(0, 80) || `Content from ${new URL(sourceUrl).hostname}`;
    const { securityStatus, securityNotes } = this.analyzeThreats(cleaned);
    const contentHash = this.computeHash(title, cleaned);

    return {
      title,
      cleanedText: cleaned,
      contentType: 'TEXT',
      contentHash,
      securityStatus,
      securityNotes,
    };
  }

  /**
   * Inspects external content for prompt injection and command execution attempts.
   * Flags suspicious content while preserving data-only integrity.
   */
  public analyzeThreats(text: string): {
    securityStatus: ContentSecurityStatus;
    securityNotes: string[];
  } {
    const notes: string[] = [];

    const suspiciousPatterns: Array<{ regex: RegExp; reason: string }> = [
      {
        regex: /ignore\s+(all\s+|previous\s+|prior\s+)?instructions/i,
        reason: 'Detected instruction override attempt: "ignore instructions"',
      },
      {
        regex: /you\s+are\s+now\s+(an?|my)\s+/i,
        reason: 'Detected persona hijacking attempt: "you are now ..."',
      },
      {
        regex: /system\s+prompt/i,
        reason: 'Detected reference to system prompt architecture',
      },
      {
        regex: /reveal\s+(your\s+|the\s+)?(api[ _-]?key|secret|password|token|private[ _-]?key)/i,
        reason: 'Detected credential exfiltration prompt pattern',
      },
      {
        regex: /execute\s+(this\s+|the\s+following\s+)?(command|order|trade|code)/i,
        reason: 'Detected autonomous command execution prompt',
      },
      {
        regex: /change\s+(your\s+|the\s+)?(strategy|trading\s+rule|risk\s+limit)/i,
        reason: 'Detected unauthorized strategy mutation prompt',
      },
      {
        regex: /transfer\s+(funds|money|balance|crypto|usdt)/i,
        reason: 'Detected unauthorized financial transfer prompt',
      },
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.regex.test(text)) {
        notes.push(pattern.reason);
      }
    }

    const securityStatus: ContentSecurityStatus = notes.length > 0 ? 'SUSPICIOUS_DATA' : 'SAFE_DATA';

    return { securityStatus, securityNotes: notes };
  }

  /**
   * Strips all XML / HTML tags
   */
  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, ' ');
  }

  /**
   * Decodes common HTML entities
   */
  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&#(\d+);/g, (_m, num) => String.fromCharCode(parseInt(num, 10)));
  }

  /**
   * Compute deterministic SHA-256 hash of title and text
   */
  public computeHash(title: string, content: string): string {
    const normalized = `${title.trim().toLowerCase()}:::${content.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
}

export const contentSanitizer = ContentSanitizer.getInstance();
