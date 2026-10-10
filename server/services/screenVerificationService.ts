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
   * Fetches latest price from multiple top exchanges (Binance, Bybit, OKX, Kraken, Coinbase)
   * Ensures high-availability cross-exchange verification for screen capture
   */
  private async fetchMultiExchangePrice(symbol: string): Promise<{ price: number; exchange: string } | null> {
    const cleaned = symbol.replace(/[\/\-_]/g, '').toUpperCase();

    // 1. Try Binance
    try {
      const endpoints = [
        `https://api.binance.com/api/v3/ticker/price?symbol=${cleaned}`,
        `https://data-api.binance.vision/api/v3/ticker/price?symbol=${cleaned}`,
      ];
      for (const url of endpoints) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.price) {
            return { price: parseFloat(data.price), exchange: 'Binance Live' };
          }
        }
      }
    } catch {
      // Continue to next exchange
    }

    // 2. Try Bybit Public Kline/Ticker
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${cleaned}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const item = data?.result?.list?.[0];
        if (item && item.lastPrice) {
          return { price: parseFloat(item.lastPrice), exchange: 'Bybit Live' };
        }
      }
    } catch {
      // Continue to next exchange
    }

    // 3. Try OKX Public Ticker
    try {
      const base = cleaned.replace(/USDT$/, '');
      const okxInstId = `${base}-USDT`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        const item = data?.data?.[0];
        if (item && item.last) {
          return { price: parseFloat(item.last), exchange: 'OKX Live' };
        }
      }
    } catch {
      // Continue to next exchange
    }

    // 4. Try Kraken Public Ticker
    try {
      let krakenPair = cleaned;
      if (cleaned === 'BTCUSDT') krakenPair = 'XBTUSDT';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.result) {
          const pairKey = Object.keys(data.result)[0];
          const ticker = data.result[pairKey];
          if (ticker && ticker.c && ticker.c[0]) {
            return { price: parseFloat(ticker.c[0]), exchange: 'Kraken Live' };
          }
        }
      }
    } catch {
      // Continue to next exchange
    }

    // 5. Try Coinbase Public Ticker
    try {
      const base = cleaned.replace(/USDT$/, '');
      const cbProduct = `${base}-USDT`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`https://api.exchange.coinbase.com/products/${cbProduct}/ticker`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.price) {
          return { price: parseFloat(data.price), exchange: 'Coinbase Live' };
        }
      }
    } catch {
      // Fallback exhausted
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
        isVerified: false, // Strict safety guard: unverified against live orderbook
        status: 'UNSUPPORTED_BROKER_FEED',
        screenPrice,
        notes: `Detected ${symbol} (${visionData.marketType}). Live tick verification is unavailable for non-crypto/external feeds. Directional UP/DOWN signals are held in WAIT for capital safety.`,
      };
    }

    if (!screenPrice || isNaN(screenPrice) || screenPrice <= 0) {
      return {
        isVerified: false,
        status: 'SKIPPED',
        notes: 'Price numbers on chart scale are not clearly identifiable.',
      };
    }

    const liveFeed = await this.fetchMultiExchangePrice(symbol);
    if (!liveFeed) {
      return {
        isVerified: false,
        status: 'STALE_DATA',
        screenPrice,
        notes: `Could not fetch live reference feed for ${symbol} from connected exchanges (Binance, Bybit, OKX, Kraken, Coinbase).`,
      };
    }

    const livePrice = liveFeed.price;
    const sourceUsed = liveFeed.exchange;

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
        sourceUsed,
        notes: `High price discrepancy (${deltaPercent.toFixed(2)}% > ${maxTolerancePercent}% tolerance). Screen price is $${screenPrice}, but live market price from ${sourceUsed} is $${livePrice}. Signal blocked.`,
      };
    }

    return {
      isVerified: true,
      status: 'MATCHED',
      livePrice,
      screenPrice,
      priceDeltaPercent: Number(deltaPercent.toFixed(2)),
      sourceUsed,
      notes: `Screen price ($${screenPrice}) matches live ${sourceUsed} ($${livePrice}) within ${deltaPercent.toFixed(2)}% tolerance.`,
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
    let confidence = 0;
    const assetName = visionData.symbol || 'ASSET';
    let verdictTitle = `WAIT / NEUTRAL (${assetName})`;

    // 3. Evaluate Cross-Verification Safety Gates
    if (marketVerification.status === 'PRICE_MISMATCH') {
      direction = 'WAIT';
      confidence = 10;
      verdictTitle = `WAIT / PRICE MISMATCH (${assetName})`;
      reasoning.push(
        `PRICE MISMATCH GUARD: Screen price ($${marketVerification.screenPrice}) deviates ${marketVerification.priceDeltaPercent}% from live market price ($${marketVerification.livePrice}). Chart may be stale or lagging.`
      );
    } else if (marketVerification.status === 'UNSUPPORTED_BROKER_FEED') {
      direction = 'WAIT';
      confidence = 20;
      verdictTitle = `WAIT / UNVERIFIED FEED (${assetName})`;
      reasoning.push(
        `UNVERIFIED FEED GUARD: ${assetName} (${visionData.marketType}) is an external broker feed without verified live orderbook ticker. Directional signals (UP/DOWN) are strictly held in WAIT to avoid OTC broker manipulation or visual pattern misinterpretation.`
      );
    } else if (marketVerification.status === 'STALE_DATA') {
      direction = 'WAIT';
      confidence = 10;
      verdictTitle = `WAIT / STALE FEED (${assetName})`;
      reasoning.push(
        `STALE FEED GUARD: Live reference price could not be retrieved from Binance. Directional signals are held in WAIT.`
      );
    } else if (!marketVerification.isVerified || marketVerification.status !== 'MATCHED') {
      direction = 'WAIT';
      confidence = 15;
      verdictTitle = `WAIT / UNVERIFIED MARKET (${assetName})`;
      reasoning.push(
        `UNVERIFIED MARKET GUARD: Live verification did not match trusted orderbook data (${marketVerification.notes || 'Verification pending'}). Directional signals held in WAIT.`
      );
    } else {
      // ONLY when marketVerification.isVerified === true && marketVerification.status === 'MATCHED'
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
        verdictTitle = `BUY / CALL (${assetName})`;
        reasoning.push(`Visual technical bias is Bullish (Score: +${score}) and verified by live market price.`);
      } else if (score <= -2) {
        direction = 'DOWN';
        confidence = Math.min(85, 55 + Math.abs(score) * 8);
        verdictTitle = `SELL / PUT (${assetName})`;
        reasoning.push(`Visual technical bias is Bearish (Score: ${score}) and verified by live market price.`);
      } else {
        direction = 'WAIT';
        confidence = 40;
        verdictTitle = `WAIT / CONSOLIDATION (${assetName})`;
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
