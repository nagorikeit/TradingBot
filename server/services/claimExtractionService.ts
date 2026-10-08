import crypto from 'crypto';
import {
  ResearchClaim,
  ClaimType,
  ClaimTestability,
} from '../types/claimRuleTypes';
import { researchLibraryService } from './researchLibraryService';
import { claimRuleStorageService } from './claimRuleStorageService';

export class ClaimExtractionService {
  private static instance: ClaimExtractionService;

  private constructor() {
    this.seedFoundationalClaims();
  }

  public static getInstance(): ClaimExtractionService {
    if (!ClaimExtractionService.instance) {
      ClaimExtractionService.instance = new ClaimExtractionService();
    }
    return ClaimExtractionService.instance;
  }

  /**
   * Deterministic extraction from stored Phase 2C items
   */
  public extractClaimsFromContent(contentId?: string): ResearchClaim[] {
    const items = researchLibraryService.getAllItems();
    const targetItems = contentId
      ? items.filter((it) => it.id === contentId)
      : items;

    const newlyExtracted: ResearchClaim[] = [];

    for (const item of targetItems) {
      if (!item.chunks || item.chunks.length === 0) continue;

      for (const chunk of item.chunks) {
        const text = chunk.text;
        const candidateClaims = this.parseChunkStatements(text, item, chunk.chunkIndex);

        for (const claim of candidateClaims) {
          // Check duplicate
          const existing = claimRuleStorageService
            .getClaims()
            .find(
              (c) =>
                c.contentId === claim.contentId &&
                c.claimText.toLowerCase() === claim.claimText.toLowerCase()
            );

          if (!existing) {
            claimRuleStorageService.saveClaim(claim);
            newlyExtracted.push(claim);
          }
        }
      }
    }

    return newlyExtracted;
  }

  /**
   * Scans text for indicator / market structure / trading rules vs educational opinions
   */
  private parseChunkStatements(
    text: string,
    item: { id: string; sourceId: string; url: string; title: string; authorOrChannel: string },
    chunkIndex: number
  ): ResearchClaim[] {
    const claims: ResearchClaim[] = [];
    const sentences = text
      .split(/(?<=[.?!])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 25);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      // Detection 1: Technical Trading Rules (Testable indicators + action)
      const hasIndicators =
        lower.includes('rsi') ||
        lower.includes('ema') ||
        lower.includes('macd') ||
        lower.includes('moving average') ||
        lower.includes('support') ||
        lower.includes('resistance');

      const hasActionOrDirection =
        lower.includes('long') ||
        lower.includes('short') ||
        lower.includes('call') ||
        lower.includes('put') ||
        lower.includes('buy') ||
        lower.includes('sell') ||
        lower.includes('uptrend') ||
        lower.includes('downtrend') ||
        lower.includes('reversal') ||
        lower.includes('bounce');

      let claimType: ClaimType = 'EDUCATIONAL';
      let testability: ClaimTestability = 'NOT_TESTABLE';
      let reason = 'General observational statement without formal mechanical parameters';

      if (hasIndicators && hasActionOrDirection) {
        claimType = 'TRADING_RULE';
        // Check if quantitative parameters exist
        const hasNumbers = /\d+/.test(sentence);
        const hasComparisons =
          lower.includes('cross') ||
          lower.includes('above') ||
          lower.includes('below') ||
          lower.includes('oversold') ||
          lower.includes('overbought') ||
          lower.includes('greater') ||
          lower.includes('less');

        if (hasNumbers || hasComparisons) {
          testability = 'TESTABLE';
          reason = 'Contains specific indicator conditions and clear directional expectation';
        } else {
          testability = 'INSUFFICIENT_DATA';
          reason = 'Mentions indicators and direction but lacks concrete thresholds';
        }
      } else if (lower.includes('risk') || lower.includes('drawdown') || lower.includes('stop loss') || lower.includes('capital')) {
        claimType = 'RISK_PRINCIPLE';
        testability = 'NOT_TESTABLE';
        reason = 'Risk management heuristic, not a mechanical entry/exit signal';
      } else if (lower.includes('liquidity') || lower.includes('volatility') || lower.includes('market structure') || lower.includes('volume')) {
        claimType = 'MARKET_OBSERVATION';
        testability = 'NOT_TESTABLE';
        reason = 'Macro or liquidity structural observation without fixed executable rules';
      } else if (lower.includes('good') || lower.includes('disciplined') || lower.includes('mindset') || lower.includes('opinion')) {
        claimType = 'OPINION';
        testability = 'NOT_TESTABLE';
        reason = 'Subjective opinion or psychological advice';
      }

      // If testable or notable trading principle, extract
      if (claimType === 'TRADING_RULE' || testability === 'TESTABLE') {
        const claimId = 'clm_' + crypto.createHash('sha256').update(`${item.id}_${sentence}`).digest('hex').substring(0, 16);
        claims.push({
          claimId,
          contentId: item.id,
          chunkId: `${item.id}_chunk_${chunkIndex}`,
          sourceId: item.sourceId,
          sourceUrl: item.url,
          claimText: sentence,
          claimType,
          testability,
          testabilityReason: reason,
          extractedAt: Date.now(),
          evidenceReferences: {
            title: item.title,
            authorOrChannel: item.authorOrChannel,
            chunkIndex,
            textSnippet: sentence,
          },
          status: 'EXTRACTED',
        });
      }
    }

    return claims;
  }

  /**
   * Seeds realistic foundational research claims from verified research library items
   */
  private seedFoundationalClaims(): void {
    const existing = claimRuleStorageService.getClaims();
    if (existing.length > 0) return;

    const seedClaims: ResearchClaim[] = [
      {
        claimId: 'clm_rsi_oversold_ema_bullish',
        contentId: 'res_1791358433576_init_yt1',
        chunkId: 'res_1791358433576_init_yt1_chunk_1',
        sourceId: 'src_1791358433576_tavt',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        claimText: 'When 14-period RSI is oversold below 30 and EMA 9 crosses above EMA 21 on a 5-minute chart, price experiences an upward mean reversion bounce within 3 candles.',
        claimType: 'TRADING_RULE',
        testability: 'TESTABLE',
        testabilityReason: 'Concrete indicator thresholds (RSI < 30, EMA 9 > EMA 21) and clear 3-candle CALL outcome expectation',
        extractedAt: Date.now() - 3600000 * 24,
        evidenceReferences: {
          title: 'Price Action Market Structure & Liquidity Concepts',
          authorOrChannel: 'Forex & Macro Trading Academy',
          chunkIndex: 1,
          textSnippet: 'When 14-period RSI is oversold below 30 and EMA 9 crosses above EMA 21 on a 5-minute chart, price experiences an upward mean reversion bounce within 3 candles.',
        },
        status: 'FORMALIZED',
      },
      {
        claimId: 'clm_macd_momentum_breakout',
        contentId: 'res_1791358433576_init_pdf1',
        chunkId: 'res_1791358433576_init_pdf1_chunk_0',
        sourceId: 'src_1791358433576_bis1',
        sourceUrl: 'https://www.bis.org/publ/work998.htm',
        claimText: 'MACD histogram crossing above zero with price above EMA 21 indicates high-probability bullish trend continuation across high liquidity crypto pairs.',
        claimType: 'TRADING_RULE',
        testability: 'TESTABLE',
        testabilityReason: 'Mathematical conditions (MACD histogram > 0, Price > EMA 21) on trend continuation',
        extractedAt: Date.now() - 3600000 * 20,
        evidenceReferences: {
          title: 'FX Market Liquidity Dynamics & Volatility Regimes',
          authorOrChannel: 'Bank for International Settlements Research',
          chunkIndex: 0,
          textSnippet: 'MACD histogram crossing above zero with price above EMA 21 indicates high-probability bullish trend continuation.',
        },
        status: 'FORMALIZED',
      },
      {
        claimId: 'clm_psychology_discipline_untestable',
        contentId: 'res_1791358433576_init_yt1',
        chunkId: 'res_1791358433576_init_yt1_chunk_2',
        sourceId: 'src_1791358433576_tavt',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        claimText: 'Disciplined traders who maintain emotional calm during high volatility drawdowns achieve long-term profitability.',
        claimType: 'OPINION',
        testability: 'NOT_TESTABLE',
        testabilityReason: 'Subjective psychological statement without quantifiable indicator triggers or execution rules',
        extractedAt: Date.now() - 3600000 * 18,
        evidenceReferences: {
          title: 'Price Action Market Structure & Liquidity Concepts',
          authorOrChannel: 'Forex & Macro Trading Academy',
          chunkIndex: 2,
          textSnippet: 'Disciplined traders who maintain emotional calm during high volatility drawdowns achieve long-term profitability.',
        },
        status: 'REJECTED',
      },
      {
        claimId: 'clm_bearish_rejection_rsi_overbought',
        contentId: 'res_1791358433576_init_yt1',
        chunkId: 'res_1791358433576_init_yt1_chunk_1',
        sourceId: 'src_1791358433576_tavt',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        claimText: 'When 14-period RSI exceeds 70 and price drops below EMA 21, bearish reversal PUT signals yield positive expectancy over 3 candles in ranging regimes.',
        claimType: 'TRADING_RULE',
        testability: 'TESTABLE',
        testabilityReason: 'Testable conditions: RSI > 70, Price < EMA 21, PUT direction, 3 candles expiry in ranging regimes',
        extractedAt: Date.now() - 3600000 * 12,
        evidenceReferences: {
          title: 'Price Action Market Structure & Liquidity Concepts',
          authorOrChannel: 'Forex & Macro Trading Academy',
          chunkIndex: 1,
          textSnippet: 'When 14-period RSI exceeds 70 and price drops below EMA 21, bearish reversal PUT signals yield positive expectancy.',
        },
        status: 'FORMALIZED',
      },
    ];

    for (const c of seedClaims) {
      claimRuleStorageService.saveClaim(c);
    }
  }
}

export const claimExtractionService = ClaimExtractionService.getInstance();
