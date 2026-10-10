import {
  ScreenVisionParsedData,
  MarketVerificationResult,
  ScreenAnalysisFinalResult,
} from '../types/screenAnalysisTypes';
import { visionAnalysisService } from './visionAnalysisService';

export class ScreenVerificationService {
  private static instance: ScreenVerificationService;

  private constructor() {}

  public static getInstance(): ScreenVerificationService {
    if (!ScreenVerificationService.instance) {
      ScreenVerificationService.instance = new ScreenVerificationService();
    }
    return ScreenVerificationService.instance;
  }

  /**
   * Fetches latest price for crypto pairs from Binance Public API
   */
  private async fetchBinancePrice(symbol: string): Promise<number | null> {
    const cleaned = symbol.replace(/[\/\-_]/g, '').toUpperCase();
    if (!cleaned.endsWith('USDT') && !cleaned.endsWith('BUSD') && !cleaned.endsWith('BTC')) {
      return null;
    }

    const endpoints = [
      `https://api.binance.com/api/v3/ticker/price?symbol=${cleaned}`,
      `https://data-api.binance.vision/api/v3/ticker/price?symbol=${cleaned}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.price) {
            return parseFloat(data.price);
          }
        }
      } catch {
        // try next endpoint
      }
    }

    return null;
  }

  /**
   * Verifies Vision AI extracted price and symbol against live market feed
   */
  public async verifyMarketData(visionData: ScreenVisionParsedData): Promise<MarketVerificationResult> {
    const symbol = visionData.symbol?.trim().toUpperCase();
    const screenPrice = visionData.lastVisiblePrice;

    if (!symbol) {
      return {
        isVerified: false,
        status: 'SKIPPED',
        notes: 'Symbol could not be detected from chart image.',
      };
    }

    // Check if asset is a supported Binance Crypto symbol
    const isCrypto =
      visionData.marketType === 'CRYPTO' ||
      symbol.includes('USDT') ||
      symbol.includes('BTC') ||
      symbol.includes('ETH');

    if (!isCrypto) {
      // Non-crypto or external broker feed (Forex, stocks, etc.)
      return {
        isVerified: true, // Non-blocking warning
        status: 'UNSUPPORTED_BROKER_FEED',
        screenPrice,
        notes: `Detected ${symbol} (${visionData.marketType}). Live Binance verification is not applicable for non-crypto/external feeds. Technical pattern vision applied with caution.`,
      };
    }

    if (!screenPrice || isNaN(screenPrice) || screenPrice <= 0) {
      return {
        isVerified: false,
        status: 'SKIPPED',
        notes: 'Price numbers on chart scale are not clearly identifiable.',
      };
    }

    const livePrice = await this.fetchBinancePrice(symbol);
    if (!livePrice) {
      return {
        isVerified: false,
        status: 'STALE_DATA',
        screenPrice,
        notes: `Could not fetch live reference feed for ${symbol} from Binance.`,
      };
    }

    // Calculate price discrepancy percentage
    const deltaPercent = Math.abs((screenPrice - livePrice) / livePrice) * 100;
    const maxTolerancePercent = 1.5; // 1.5% maximum allowed discrepancy

    if (deltaPercent > maxTolerancePercent) {
      return {
        isVerified: false,
        status: 'PRICE_MISMATCH',
        livePrice,
        screenPrice,
        priceDeltaPercent: Number(deltaPercent.toFixed(2)),
        sourceUsed: 'Binance Live Public API',
        notes: `High price discrepancy (${deltaPercent.toFixed(2)}% > ${maxTolerancePercent}% tolerance). Screen price is $${screenPrice}, but live market price is $${livePrice}. Signal blocked.`,
      };
    }

    return {
      isVerified: true,
      status: 'MATCHED',
      livePrice,
      screenPrice,
      priceDeltaPercent: Number(deltaPercent.toFixed(2)),
      sourceUsed: 'Binance Live Public API',
      notes: `Screen price ($${screenPrice}) matches live Binance feed ($${livePrice}) within ${deltaPercent.toFixed(2)}% tolerance.`,
    };
  }

  /**
   * Synthesizes Vision data and Market verification into final trading signal
   */
  public async processScreenFrame(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    frameCapturedAt: number = Date.now()
  ): Promise<ScreenAnalysisFinalResult> {
    const analysisId = `screen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Vision AI Processing
    const visionData = await visionAnalysisService.analyzeFrame(imageBase64, mimeType);

    // If frame is illegible or not a trading chart
    if (!visionData.isClearTradingChart) {
      return {
        analysisId,
        timestamp: Date.now(),
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: 'NO CLEAR CHART DETECTED',
        reasoning: [
          'The shared screen or window does not appear to contain a clear candlestick trading chart.',
          'Please ensure the TradingView, Binance, or broker chart window is in focus.',
        ],
        visionData,
        marketVerification: {
          isVerified: false,
          status: 'SKIPPED',
          notes: 'No trading chart identified to verify.',
        },
        safetyDisclaimer: 'Vision AI is an educational assistance tool. No automated orders are placed.',
      };
    }

    // 2. Market Cross-Verification
    const marketVerification = await this.verifyMarketData(visionData);

    const reasoning: string[] = [];
    let direction: 'UP' | 'DOWN' | 'WAIT' = 'WAIT';
    let confidence = Math.round((visionData.confidenceScore || 0.5) * 80);

    // 3. Evaluate Cross-Verification Gate
    if (marketVerification.status === 'PRICE_MISMATCH') {
      direction = 'WAIT';
      confidence = 10;
      reasoning.push(
        `PRICE MISMATCH GUARD: Screen price ($${marketVerification.screenPrice}) deviates ${marketVerification.priceDeltaPercent}% from live market price ($${marketVerification.livePrice}). Chart may be stale or lagging.`
      );
    } else {
      // Analyze technical signals from Vision
      const bullishIndicators = visionData.indicatorsIdentified.filter((i) => i.bias === 'BULLISH').length;
      const bearishIndicators = visionData.indicatorsIdentified.filter((i) => i.bias === 'BEARISH').length;

      let score = 0;
      if (visionData.lastCandleDirection === 'BULLISH') score += 1;
      if (visionData.lastCandleDirection === 'BEARISH') score -= 1;
      if (visionData.chartStructure === 'UPTREND') score += 2;
      if (visionData.chartStructure === 'DOWNTREND') score -= 2;
      score += bullishIndicators;
      score -= bearishIndicators;

      if (score >= 2) {
        direction = 'UP';
        confidence = Math.min(85, 55 + score * 8);
        reasoning.push(`Visual technical bias is Bullish (Score: +${score}).`);
      } else if (score <= -2) {
        direction = 'DOWN';
        confidence = Math.min(85, 55 + Math.abs(score) * 8);
        reasoning.push(`Visual technical bias is Bearish (Score: ${score}).`);
      } else {
        direction = 'WAIT';
        confidence = 40;
        reasoning.push(`Technical indicators and candlestick structure show consolidation or conflicting bias.`);
      }

      if (visionData.candlestickPattern) {
        reasoning.push(`Identified Pattern: ${visionData.candlestickPattern}`);
      }
      if (visionData.visionSummary) {
        reasoning.push(`Vision Summary: ${visionData.visionSummary}`);
      }
      if (marketVerification.notes) {
        reasoning.push(`Market Verification: ${marketVerification.notes}`);
      }
    }

    if (visionData.containsSensitivePrivateData) {
      reasoning.push('Privacy Guard: Private user details were masked from analysis.');
    }

    const verdictTitle =
      direction === 'UP'
        ? `BUY / CALL (${visionData.symbol || 'ASSET'})`
        : direction === 'DOWN'
        ? `SELL / PUT (${visionData.symbol || 'ASSET'})`
        : `WAIT / NEUTRAL (${visionData.symbol || 'ASSET'})`;

    return {
      analysisId,
      timestamp: Date.now(),
      frameCapturedAt,
      direction,
      confidence,
      verdictTitle,
      reasoning,
      visionData,
      marketVerification,
      safetyDisclaimer:
        'Live Screen Analysis is an advisory aid. Always confirm with your risk management rules. No trade execution is performed.',
    };
  }
}

export const screenVerificationService = ScreenVerificationService.getInstance();
