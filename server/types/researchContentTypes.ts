import { ContentSecurityStatus } from './contentTypes';

export type ResearchSourceType =
  | 'YOUTUBE'
  | 'RESEARCH'
  | 'PDF'
  | 'DOCUMENTATION'
  | 'EDUCATIONAL'
  | 'NEWS'
  | 'OTHER';

export type TranscriptStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'RESTRICTED'
  | 'FAILED'
  | 'NOT_APPLICABLE';

export type DocumentExtractionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'OCR_REQUIRED'
  | 'FAILED'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export type ContentAcquisitionStatus =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'BLOCKED'
  | 'RATE_LIMITED';

export interface ContentChunk {
  chunkId: string;
  contentId: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  charCount: number;
  sourceType: ResearchSourceType;
  sourceUrl: string;
  title: string;
  authorOrChannel?: string;
  publishedAt?: string;
  contentHash: string;
}

export interface UnifiedResearchItem {
  id: string;
  sourceId: string;
  sourceType: ResearchSourceType;
  url: string;
  normalizedUrl: string; // Canonical / normalized URL for deterministic deduplication
  canonicalUrl?: string;
  title: string;
  authorOrChannel: string;
  publishedAt?: string;
  fetchedAt: number;
  language?: string;
  contentType: string; // e.g. 'YOUTUBE_TRANSCRIPT', 'PDF_DOCUMENT', 'RESEARCH_ARTICLE'
  acquisitionStatus: ContentAcquisitionStatus; // Track acquisition state (SUCCESS, FAILED, BLOCKED, etc.)
  errorMessage?: string; // Stored error details if acquisition or extraction had issues
  transcriptStatus: TranscriptStatus;
  extractionStatus: DocumentExtractionStatus;
  text: string; // Sanitized plain text
  textLength: number;
  contentHash: string; // SHA-256 for deduplication
  securityStatus: ContentSecurityStatus;
  untrusted: true; // HARD ARCHITECTURAL INVARIANT: Always true, never an instruction
  metadata: {
    durationSeconds?: number;
    videoId?: string;
    descriptionSnippet?: string;
    pdfPageCount?: number;
    mimeType?: string;
    httpStatus?: number;
    fileSizeBytes?: number;
    isDuplicate?: boolean;
    tags?: string[];
  };
  chunks: ContentChunk[];
  firewallLog: string[];
}

export interface ResearchLibraryStatistics {
  totalItems: number;
  youtubeItemsCount: number;
  documentItemsCount: number;
  availableTranscriptsCount: number;
  ocrRequiredCount: number;
  totalChunksCount: number;
  securityFlaggedCount: number;
  lastAcquiredAt?: number;
}
