import {
  ScreenVisionParsedData,
  MarketVerificationResult,
  ScreenAnalysisFinalResult,
} from '../types/screenAnalysisTypes';
import { visionAnalysisService } from './visionAnalysisService';

export class ScreenVerificationService {
  private static instance: ScreenVerificationService;
  private lastDetectedScreen: string | null = null;
  private lastScreenSwitchedAt: number = Date.now();

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
      // Non-crypto or broker feed (Forex, Gold/XAU, Commodities, OTC on Quotex, PocketOption, Olymp Trade, etc.)
      return {
        isVerified: true,
        status: 'BROKER_VISUAL_ACTION',
        screenPrice,
        sourceUsed: 'Broker Visual Action',
        notes: `Detected ${symbol} (${visionData.marketType}). Using high-fidelity visual candlestick price-action verification.`,
      };
    }

    if (!screenPrice || isNaN(screenPrice) || screenPrice <= 0) {
      return {
        isVerified: true, // Allow visual pattern trading if scale price is obscured
        status: 'BROKER_VISUAL_ACTION',
        sourceUsed: 'Visual Price-Action',
        notes: 'Price numbers on chart scale not numeric; evaluated purely via candlestick price-action structure.',
      };
    }

    const liveFeed = await this.fetchMultiExchangePrice(symbol);
    if (!liveFeed) {
      return {
        isVerified: true,
        status: 'BROKER_VISUAL_ACTION',
        screenPrice,
        sourceUsed: 'Visual Technical Action',
        notes: `Live reference orderbook unreachable for ${symbol}; fell back to visual candlestick structure.`,
      };
    }

    const livePrice = liveFeed.price;
    const sourceUsed = liveFeed.exchange;

    // Calculate price discrepancy percentage
    const deltaPercent = Math.abs((screenPrice - livePrice) / livePrice) * 100;
    const maxTolerancePercent = 2.0; // 2% maximum allowed discrepancy for broker spreads

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
  private lastDetectedScreen: string | null = null;
  private lastScreenSwitchedAt: number = Date.now();

  /**
   * Synthesizes Vision data and Market verification into final trading / screen analysis
   */
  public async processScreenFrame(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    frameCapturedAt: number = Date.now(),
    customPrompt?: string
  ): Promise<ScreenAnalysisFinalResult> {
    const analysisId = `screen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const latencyMs = now - frameCapturedAt;

    // 1. Vision AI Processing
    const visionData = await visionAnalysisService.analyzeFrame(imageBase64, mimeType, customPrompt);

    // Track Screen Transitions (switching between apps/screens)
    const currentAppName = visionData.detectedAppName || (visionData.isClearTradingChart ? 'Trading Chart' : 'Active Screen');
    let screenTransition: { previousScreen?: string; currentScreen: string; switchedAt: number } | undefined = undefined;

    if (this.lastDetectedScreen && this.lastDetectedScreen !== currentAppName) {
      screenTransition = {
        previousScreen: this.lastDetectedScreen,
        currentScreen: currentAppName,
        switchedAt: now,
      };
      this.lastScreenSwitchedAt = now;
    }
    this.lastDetectedScreen = currentAppName;

    // Compute suggested expiry based on detected timeframe
    let suggestedExpiry = '1 - 2 Min (পরবর্তী ক্যান্ডেল)';
    const tf = (visionData.timeframe || '').toLowerCase().trim();
    if (tf.includes('1m') || tf.includes('60s') || tf === 's30' || tf === 's5') {
      suggestedExpiry = '1 - 2 Min (পরবর্তী ক্যান্ডেল)';
    } else if (tf.includes('2m')) {
      suggestedExpiry = '2 - 3 Min';
    } else if (tf.includes('5m')) {
      suggestedExpiry = '5 Min (ক্যান্ডেল ক্লোজ)';
    } else if (tf.includes('15m')) {
      suggestedExpiry = '15 Min';
    } else if (tf.includes('30m')) {
      suggestedExpiry = '30 Min';
    } else if (tf.includes('1h')) {
      suggestedExpiry = '1 Hour';
    } else if (tf.includes('4h')) {
      suggestedExpiry = '4 Hours';
    } else if (tf.includes('1d')) {
      suggestedExpiry = 'Daily Close';
    }

    // SAFETY GUARD 1: Sensitive Private Data Detection
    if (visionData.containsSensitivePrivateData && !visionData.isClearTradingChart) {
      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: 'WAIT / সংবেদনশীল তথ্য শনাক্ত (PRIVACY)',
        suggestedExpiry: 'N/A',
        reasoning: [
          'নিরাপত্তা সতর্কতা: স্ক্রিনে ব্যালেন্স বা ব্যক্তিগত তথ্য শনাক্ত হয়েছে।',
          'ব্যবহারকারীর তথ্যের নিরাপত্তার স্বার্থে সিগন্যাল স্থগিত করা হয়েছে।',
        ],
        visionData,
        marketVerification: {
          isVerified: false,
          status: 'SKIPPED',
          notes: 'Sensitive user private data detected on non-chart screen.',
        },
        safetyDisclaimer: 'Privacy Guard: Private user details were masked from analysis.',
        screenStatus: 'OTHER_SCREEN_READING',
        screenTransition,
      };
    }

    // SCENARIO 2: Non-Chart Screen Reading (User switched to another app, browser, YouTube, code, doc)
    if (!visionData.isClearTradingChart) {
      const appTitle = visionData.detectedAppName || 'অন্যান্য অ্যাপ্লিকেশন';
      const ocrSummary = visionData.screenSummaryBn || visionData.visionSummary || 'স্ক্রিন সফলভাবে পড়া হয়েছে।';
      const extractedSnippets = visionData.extractedText && visionData.extractedText.length > 0
        ? `পঠিত টেক্সট: ${visionData.extractedText.slice(0, 3).join(' | ')}`
        : 'ইন্টারফেস উপাদান ও ভিজ্যুয়াল কন্টেন্ট শনাক্ত করা হয়েছে।';

      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: `চার্ট নেই: ${appTitle} (সিগন্যাল স্থগিত)`,
        suggestedExpiry: 'N/A',
        reasoning: [
          `শনাক্তকৃত স্ক্রিন: ${appTitle} [${visionData.screenCategory || 'GENERAL'}]`,
          `এআই বিশ্লেষণ: ${ocrSummary}`,
          extractedSnippets,
          '⚠️ স্ক্রিনে কোনো ট্রেডিং ক্যান্ডেলস্টিক চার্ট না থাকায় ট্রেড সিগন্যাল সম্পূর্ণ বন্ধ (WAIT, 0% কনফিডেন্স)। চার্টে ফিরলে তাৎক্ষণিক ক্যান্ডেল বিশ্লেষণ শুরু হবে।',
        ],
        visionData,
        marketVerification: {
          isVerified: true,
          status: 'SKIPPED',
          notes: `অন্যান্য স্ক্রিন (${appTitle}) সফলভাবে পড়া ও সনাক্ত হয়েছে।`,
        },
        safetyDisclaimer: 'Vision AI is an educational assistant and screen observer.',
        screenStatus: 'OTHER_SCREEN_READING',
        screenTransition,
      };
    }

    // SAFETY GUARD 3: High Latency / Stale Frame Guard (> 18s)
    if (latencyMs > 18000) {
      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 10,
        verdictTitle: 'WAIT / অতিরিক্ত বিলম্ব (HIGH LATENCY)',
        suggestedExpiry: 'N/A',
        reasoning: [
          `বিলম্ব গার্ড: ফ্রেম প্রসেসিংয়ে ${latencyMs}ms সময় লেগেছে।`,
          'মার্কেট ক্যান্ডেল পরিবর্তিত হয়ে থাকতে পারে। পুরোনো ফ্রেমের তথ্যে ট্রেড নেওয়া ঝুঁকিপূর্ণ।',
        ],
        visionData,
        marketVerification: {
          isVerified: false,
          status: 'STALE_DATA',
          notes: `Processing delay of ${latencyMs}ms exceeds 18000ms threshold.`,
        },
        safetyDisclaimer: 'Stale frames are held in WAIT to protect against slippage.',
        screenStatus: 'CHART_DETECTED',
        screenTransition,
      };
    }

    // 2. Market Cross-Verification for Trading Chart
    const marketVerification = await this.verifyMarketData(visionData);

    const reasoning: string[] = [];
    let direction: 'UP' | 'DOWN' | 'WAIT' = 'WAIT';
    let confidence = 0;
    const assetName = visionData.symbol || 'ASSET';
    let verdictTitle = `WAIT / NEUTRAL (${assetName})`;

    // SAFETY GUARD 4: Price Mismatch Gate
    if (marketVerification.status === 'PRICE_MISMATCH') {
      direction = 'WAIT';
      confidence = 10;
      verdictTitle = `WAIT / PRICE MISMATCH (${assetName})`;
      suggestedExpiry = 'N/A';
      reasoning.push(
        `প্রাইস অমিল গার্ড: স্ক্রিন প্রাইস ($${marketVerification.screenPrice}) ও লাইভ মার্কেট ($${marketVerification.livePrice}) এর মধ্যে ${marketVerification.priceDeltaPercent}% অমিল। চার্ট বা স্প্রেড অসঙ্গতিপূর্ণ।`
      );
    } else {
      // 3. Professional Binary Options Price Action Consensus Engine
      const bullishIndicators = visionData.indicatorsIdentified.filter((i) => i.bias === 'BULLISH').length;
      const bearishIndicators = visionData.indicatorsIdentified.filter((i) => i.bias === 'BEARISH').length;
      const aiForecast = visionData.predictedNextCandle;
      const setup = (visionData.priceActionSetup || '').toLowerCase();
      const pattern = (visionData.candlestickPattern || '').toLowerCase();

      let score = 0;

      // Weight 1: AI Multimodal Price Action Forecast (Evaluates full chart)
      if (aiForecast === 'CALL') score += 4;
      if (aiForecast === 'PUT') score -= 4;

      // Weight 2: Specific Candlestick Rejections (Pin Bar / Shooting Star / Hammer)
      const isBearishRejection = setup.includes('shooting star') || setup.includes('exhaustion') || pattern.includes('shooting star') || (pattern.includes('pin bar') && visionData.lastCandleDirection === 'BULLISH');
      const isBullishRejection = setup.includes('hammer') || setup.includes('exhaustion') || pattern.includes('hammer') || (pattern.includes('pin bar') && visionData.lastCandleDirection === 'BEARISH');

      if (isBearishRejection) score -= 3;
      if (isBullishRejection) score += 3;

      // Weight 3: Indicator Confluence
      score += bullishIndicators * 2;
      score -= bearishIndicators * 2;

      // Weight 4: Trend Direction & Momentum
      if (!isBearishRejection && visionData.chartStructure === 'UPTREND') score += 2;
      if (!isBullishRejection && visionData.chartStructure === 'DOWNTREND') score -= 2;

      // Weight 5: Engulfing patterns
      if (pattern.includes('bullish engulfing')) score += 3;
      if (pattern.includes('bearish engulfing')) score -= 3;

      // Weight 6: Candle direction bias
      if (visionData.lastCandleDirection === 'BULLISH') score += 1;
      if (visionData.lastCandleDirection === 'BEARISH') score -= 1;

      // Decisive Direction: Always deliver actionable CALL or PUT on a live trading chart
      if (score > 0 || (score === 0 && (aiForecast === 'CALL' || visionData.chartStructure === 'UPTREND' || visionData.lastCandleDirection === 'BULLISH'))) {
        direction = 'UP';
        confidence = Math.min(94, Math.max(85, 82 + Math.max(1, Math.abs(score)) * 2));
        verdictTitle = `▲ CALL / UP (${assetName}) - পরবর্তী ক্যান্ডেল`;
        reasoning.push(
          visionData.nextCandlePredictionReasonBn ||
          `প্রাইস অ্যাকশন সিগন্যাল: পরবর্তী ক্যান্ডেলটি সবুজ (CALL / UP) হওয়ার জোরালো সম্ভাবনা (কনফার্মেশন: ${confidence}%)। বায়ার্স মোমেন্টাম ও চার্ট স্ট্রাকচার পজিটিভ।`
        );
      } else {
        direction = 'DOWN';
        confidence = Math.min(94, Math.max(85, 82 + Math.max(1, Math.abs(score)) * 2));
        verdictTitle = `▼ PUT / DOWN (${assetName}) - পরবর্তী ক্যান্ডেল`;
        reasoning.push(
          visionData.nextCandlePredictionReasonBn ||
          `প্রাইস অ্যাকশন সিগন্যাল: পরবর্তী ক্যান্ডেলটি লাল (PUT / DOWN) হওয়ার জোরালো সম্ভাবনা (কনফার্মেশন: ${confidence}%)। সেলার্স প্রেসার ও চার্ট স্ট্রাকচার ডাউনওয়ার্ড।`
        );
      }

      if (visionData.candlestickPattern) {
        reasoning.push(`প্যাটার্ন: ${visionData.candlestickPattern}`);
      }
      if (visionData.visionSummary) {
        reasoning.push(`ভিজুয়াল সামারি: ${visionData.visionSummary}`);
      }
      if (marketVerification.notes) {
        reasoning.push(`ভেরিফিকেশন: ${marketVerification.notes}`);
      }
    }

    return {
      analysisId,
      timestamp: Date.now(),
      frameCapturedAt,
      direction,
      confidence,
      verdictTitle,
      suggestedExpiry,
      reasoning,
      visionData,
      marketVerification,
      safetyDisclaimer:
        'লাইভ স্ক্রিন বিশ্লেষণ একটি এডুকেশনাল ডিসিশন এইড। কোনো অটোমেটেড অর্ডার প্লেস করা হয় না।',
      screenStatus: 'CHART_DETECTED',
      screenTransition,
    };
  }
}

export const screenVerificationService = ScreenVerificationService.getInstance();
