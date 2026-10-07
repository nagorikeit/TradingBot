import crypto from 'crypto';
import zlib from 'zlib';
import {
  UnifiedResearchItem,
  DocumentExtractionStatus,
  ResearchSourceType,
} from '../types/researchContentTypes';
import { webContentFetcher } from './webContentFetcher';
import { contentSanitizer } from './contentSanitizer';
import { youtubeProcessorService } from './youtubeProcessorService';
import { sourceRegistryService } from './sourceRegistryService';

export class DocumentProcessorService {
  private static instance: DocumentProcessorService;
  private lastFetchTimestamps: Map<string, number> = new Map();
  private readonly rateLimitCooldownMs = 3000; // 3 seconds between fetches per source

  public static getInstance(): DocumentProcessorService {
    if (!DocumentProcessorService.instance) {
      DocumentProcessorService.instance = new DocumentProcessorService();
    }
    return DocumentProcessorService.instance;
  }

  /**
   * Fetches and extracts public research document or PDF with strict SSRF & size bounds
   */
  public async processDocumentUrl(
    sourceId: string,
    rawUrl: string,
    sourceName?: string
  ): Promise<{ ok: boolean; item?: UnifiedResearchItem; error?: string; acquisitionStatus?: 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'RATE_LIMITED' }> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { ok: false, error: 'Invalid URL: Document URL must be a non-empty string', acquisitionStatus: 'FAILED' };
    }

    let normalizedUrl = rawUrl.trim();
    try {
      normalizedUrl = sourceRegistryService.normalizeUrl(rawUrl);
    } catch (normErr: unknown) {
      return { ok: false, error: normErr instanceof Error ? normErr.message : 'Invalid URL format', acquisitionStatus: 'FAILED' };
    }

    // 1. Source Registry & Eligibility Verification (if registered sourceId provided)
    if (sourceId && sourceId !== 'src_document_custom') {
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
    const lastFetch = this.lastFetchTimestamps.get(sourceId || 'default_doc');
    if (lastFetch && Date.now() - lastFetch < this.rateLimitCooldownMs) {
      const waitSec = Math.ceil((this.rateLimitCooldownMs - (Date.now() - lastFetch)) / 1000);
      return { ok: false, error: `Rate limit cooldown active. Please wait ${waitSec}s before fetching again.`, acquisitionStatus: 'RATE_LIMITED' };
    }
    this.lastFetchTimestamps.set(sourceId || 'default_doc', Date.now());

    // 3. Validate URL security against SSRF
    const securityCheck = await webContentFetcher.validateUrlSecurity(rawUrl);
    if (!securityCheck.safe) {
      return { ok: false, error: `SSRF Security Blocked: ${securityCheck.reason}`, acquisitionStatus: 'BLOCKED' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s max

      const response = await fetch(rawUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf,text/html,text/plain,*/*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          ok: false,
          error: `Document fetch failed with HTTP ${response.status} (${response.statusText})`,
        };
      }

      const contentTypeHeader = (response.headers.get('content-type') || '').toLowerCase();
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Check max size: 5MB limit
      const maxSizeBytes = 5 * 1024 * 1024;
      if (buffer.length > maxSizeBytes) {
        return {
          ok: false,
          error: `Document exceeds maximum size threshold (File size: ${(buffer.length / (1024 * 1024)).toFixed(2)}MB, Max: 5MB)`,
        };
      }

      const isPdf =
        contentTypeHeader.includes('application/pdf') ||
        rawUrl.toLowerCase().endsWith('.pdf') ||
        buffer.subarray(0, 5).toString('ascii') === '%PDF-';

      const isHtml =
        contentTypeHeader.includes('text/html') ||
        buffer.subarray(0, 100).toString('utf-8').toLowerCase().includes('<html') ||
        buffer.subarray(0, 100).toString('utf-8').toLowerCase().includes('<!doctype');

      let extractedText = '';
      let title = sourceName || 'Research Document';
      let author = 'Research Author / Institution';
      let extractionStatus: DocumentExtractionStatus = 'SUCCESS';
      let pdfPageCount = 1;
      let targetSourceType: ResearchSourceType = 'RESEARCH';
      const firewallLogs: string[] = [
        `Document received: ${buffer.length} bytes`,
        `Content-Type: ${contentTypeHeader || 'unspecified'}`,
      ];

      if (isPdf) {
        targetSourceType = 'PDF';
        const pdfResult = this.extractTextFromPdfBuffer(buffer);
        extractedText = pdfResult.text;
        pdfPageCount = pdfResult.pageCount;
        extractionStatus = pdfResult.status;
        title = pdfResult.title || title;

        firewallLogs.push(`PDF detected: estimated ${pdfPageCount} pages`);
        firewallLogs.push(`PDF extraction status: ${extractionStatus}`);

        if (extractionStatus === 'OCR_REQUIRED') {
          firewallLogs.push('Notice: Document is image/scanned bitmap without text layer');
        }
      } else if (isHtml) {
        targetSourceType = 'RESEARCH';
        const htmlString = buffer.toString('utf-8');
        const sanitizedHtml = contentSanitizer.sanitizeRawContent(htmlString, contentTypeHeader, rawUrl);
        extractedText = sanitizedHtml.cleanedText;
        title = sanitizedHtml.title || title;
        extractionStatus = 'SUCCESS';
        firewallLogs.push('HTML research article parsed and sanitized');
      } else {
        // Plain text fallback
        targetSourceType = 'DOCUMENTATION';
        extractedText = buffer.toString('utf-8');
        extractionStatus = 'SUCCESS';
        firewallLogs.push('Plain text document ingested');
      }

      // 2. Pass text through Prompt Injection Firewall
      const sanitized = contentSanitizer.sanitizeRawContent(
        extractedText,
        'text/plain',
        rawUrl
      );
      firewallLogs.push(...sanitized.securityNotes);

      const now = Date.now();
      const contentId = `doc_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const contentHash = crypto.createHash('sha256').update(sanitized.cleanedText).digest('hex');

      // 3. Prepare Logical Chunks for Phase 2D (No embeddings, pure logical structure)
      const chunks = youtubeProcessorService.createLogicalChunks(
        contentId,
        sanitized.cleanedText,
        targetSourceType,
        rawUrl,
        title,
        author,
        new Date(now).toISOString()
      );

      const item: UnifiedResearchItem = {
        id: contentId,
        sourceId,
        sourceType: targetSourceType,
        url: rawUrl,
        normalizedUrl,
        canonicalUrl: rawUrl,
        title,
        authorOrChannel: author,
        publishedAt: new Date(now).toISOString(),
        fetchedAt: now,
        language: 'en',
        contentType: isPdf ? 'PDF_DOCUMENT' : isHtml ? 'RESEARCH_ARTICLE' : 'TEXT_DOCUMENT',
        acquisitionStatus: 'SUCCESS',
        transcriptStatus: 'NOT_APPLICABLE',
        extractionStatus,
        text: sanitized.cleanedText,
        textLength: sanitized.cleanedText.length,
        contentHash,
        securityStatus: sanitized.securityStatus,
        untrusted: true, // HARD ARCHITECTURAL INVARIANT
        metadata: {
          mimeType: contentTypeHeader,
          httpStatus: response.status,
          fileSizeBytes: buffer.length,
          pdfPageCount: isPdf ? pdfPageCount : undefined,
          isDuplicate: false,
        },
        chunks,
        firewallLog: firewallLogs,
      };

      return { ok: true, item, acquisitionStatus: 'SUCCESS' };
    } catch (err: unknown) {
      return {
        ok: false,
        error: `Document processing error: ${err instanceof Error ? err.message : 'Unknown network failure'}`,
        acquisitionStatus: 'FAILED',
      };
    }
  }

  /**
   * Safe native PDF text extractor (Handles uncompressed & FlateDecode zlib streams, text operators)
   */
  public extractTextFromPdfBuffer(buffer: Buffer): {
    text: string;
    pageCount: number;
    status: DocumentExtractionStatus;
    title?: string;
  } {
    const rawPdf = buffer.toString('binary');

    // Estimate page count via /Type /Page occurrences
    const pageMatches = rawPdf.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 1;

    // Extract Title from Info dictionary if present
    let title: string | undefined;
    const titleMatch = rawPdf.match(/\/Title\s*\(([^)]+)\)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Find all stream objects
    const textPieces: string[] = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(rawPdf)) !== null) {
      const streamContent = match[1];
      let decompressed = '';

      // Check if stream was compressed with FlateDecode
      const streamIndex = match.index;
      const precedingHeader = rawPdf.substring(Math.max(0, streamIndex - 200), streamIndex);

      if (precedingHeader.includes('/FlateDecode')) {
        try {
          const streamBuffer = Buffer.from(streamContent, 'binary');
          const unzipped = zlib.inflateSync(streamBuffer);
          decompressed = unzipped.toString('binary');
        } catch {
          // If inflation fails, continue with next stream
          continue;
        }
      } else {
        decompressed = streamContent;
      }

      // Check for text blocks (BT ... ET)
      if (decompressed.includes('BT') && decompressed.includes('ET')) {
        const extractedFromStream = this.extractTextFromDecompressedStream(decompressed);
        if (extractedFromStream) {
          textPieces.push(extractedFromStream);
        }
      }
    }

    const fullExtracted = textPieces.join('\n\n').trim();

    if (fullExtracted.length > 50) {
      return {
        text: fullExtracted,
        pageCount,
        status: pageCount > 50 ? 'PARTIAL' : 'SUCCESS',
        title,
      };
    }

    // If no text streams could be found or decoded (scanned bitmap / image-only PDF)
    return {
      text: `[OCR_REQUIRED: The PDF document appears to be scanned bitmaps or vector diagrams with no selectable text layer. Text extraction requires Optical Character Recognition (OCR).]`,
      pageCount,
      status: 'OCR_REQUIRED',
      title,
    };
  }

  /**
   * Parses PDF text operators (Tj, TJ, ', ") inside text streams
   */
  private extractTextFromDecompressedStream(stream: string): string {
    const lines: string[] = [];
    // Extract strings inside parentheses: (Text) Tj or [(T) (e) (x) (t)] TJ
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|')/g;
    let match: RegExpExecArray | null;

    while ((match = tjRegex.exec(stream)) !== null) {
      const cleaned = this.unescapePdfString(match[1]);
      if (cleaned) lines.push(cleaned);
    }

    // Handle array TJ operator: [(Text) 20 (More)] TJ
    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(stream)) !== null) {
      const arrayContent = match[1];
      const stringMatches = arrayContent.matchAll(/\(([^)]+)\)/g);
      const piece = Array.from(stringMatches)
        .map((m) => this.unescapePdfString(m[1]))
        .join('');
      if (piece) lines.push(piece);
    }

    return lines.join(' ').replace(/\s+/g, ' ').trim();
  }

  private unescapePdfString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .trim();
  }
}

export const documentProcessorService = DocumentProcessorService.getInstance();
