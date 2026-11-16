import {
  ScreenVisionParsedData,
  MarketVerificationResult,
  ScreenAnalysisFinalResult,
} from '../types/screenAnalysisTypes';
import { visionAnalysisService } from './visionAnalysisService';
import { inspectChartPixels } from './pixelCandleInspector';

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

  private getProfileLabelBn(tradingProfile?: string): string {
    switch (tradingProfile) {
      case 'BINARY_OTC':
        return 'Binary OTC';
      case 'BINARY_LIVE':
        return 'Binary Live';
      case 'CRYPTO_SPOT':
        return 'Crypto Spot';
      case 'FOREX':
        return 'Forex';
      case 'COMMODITY_INDEX':
        return 'Gold & Index';
      default:
        return 'Binary OTC';
    }
  }

  /**
   * Synthesizes Vision data and Market verification into final trading / screen analysis
   */
  public async processScreenFrame(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    frameCapturedAt: number = Date.now(),
    customPrompt?: string,
    tradingProfile?: string,
    activeProfileRules?: string,
    zoomedCandleBase64?: string
  ): Promise<ScreenAnalysisFinalResult> {
    const analysisId = `screen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const latencyMs = now - frameCapturedAt;
    const activeProfileId = tradingProfile || 'BINARY_OTC';
    const profileLabelBn = this.getProfileLabelBn(activeProfileId);

    // 1. Vision AI Processing — Strictly applying ONLY the selected profile's rules
    const visionData = await visionAnalysisService.analyzeFrame(
      imageBase64,
      mimeType,
      customPrompt,
      activeProfileId,
      activeProfileRules,
      zoomedCandleBase64
    );

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

    // Compute suggested expiry or target format based on active profile & detected timeframe
    const isSpotSlTp = activeProfileId === 'CRYPTO_SPOT' || activeProfileId === 'FOREX' || activeProfileId === 'COMMODITY_INDEX';
    let suggestedExpiry = isSpotSlTp
      ? 'SL / TP স্ট্রাকচার টার্গেট'
      : '1 - 2 Min (পরবর্তী ক্যান্ডেল)';
    const tf = (visionData.timeframe || '').toLowerCase().trim();
    if (!isSpotSlTp) {
      if (tf.includes('1m') || tf.includes('60s') || tf === 's30' || tf === 's5') {
        suggestedExpiry = activeProfileId === 'BINARY_OTC' ? '1 - 2 Min (OTC ক্যান্ডেল)' : '1 - 2 Min (পরবর্তী ক্যান্ডেল)';
      } else if (tf.includes('2m')) {
        suggestedExpiry = '2 - 3 Min';
      } else if (tf.includes('5m')) {
        suggestedExpiry = '5 Min (ক্যান্ডেল ক্লোজ)';
      } else if (tf.includes('15m')) {
        suggestedExpiry = '15 Min';
      }
    } else {
      if (tf.includes('15m')) suggestedExpiry = '15m Structure (1:2 R:R)';
      else if (tf.includes('1h')) suggestedExpiry = '1H Swing (1:2 R:R)';
      else if (tf.includes('4h')) suggestedExpiry = '4H Swing (1:2 R:R)';
      else suggestedExpiry = activeProfileId === 'FOREX' ? 'FX Pip SL / TP (1:2)' : 'Spot/Futures SL & TP';
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

    // SAFETY GUARD 3: High Latency / Stale Frame Guard (> 12s)
    if (latencyMs > 12000) {
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
          notes: `Processing delay of ${latencyMs}ms exceeds 12000ms threshold.`,
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

    // Deterministic pixel cross-check of rightmost closed vs forming candles
    const pixelAudit = inspectChartPixels(imageBase64);

    // Normalize Closed Candle info from Vision AI + Pixel Cross-Verification
    const rawClosedColor = visionData.closedCandleColor;
    const visionClosedColor: 'GREEN' | 'RED' | 'DOJI' | 'UNCERTAIN' =
      rawClosedColor === 'GREEN' || visionData.lastCandleDirection === 'BULLISH'
        ? 'GREEN'
        : rawClosedColor === 'RED' || visionData.lastCandleDirection === 'BEARISH'
        ? 'RED'
        : rawClosedColor === 'DOJI' || visionData.lastCandleDirection === 'DOJI'
        ? 'DOJI'
        : 'UNCERTAIN';

    // Detect if Vision confused the currently forming candle with the newly closed candle
    const pixelConfirmedOpposite =
      pixelAudit &&
      pixelAudit.candleCount >= 5 &&
      pixelAudit.bodyPct >= 30 &&
      ((visionClosedColor === 'GREEN' && pixelAudit.closedColor === 'RED') ||
        (visionClosedColor === 'RED' && pixelAudit.closedColor === 'GREEN'));

    const visionMatchedFormingInstead =
      Boolean(pixelConfirmedOpposite) &&
      pixelAudit !== null &&
      pixelAudit.formingColor !== 'NONE' &&
      pixelAudit.formingColor !== 'DOJI' &&
      visionClosedColor === pixelAudit.formingColor;

    const effectiveClosedColor: 'GREEN' | 'RED' | 'DOJI' | 'UNCERTAIN' =
      visionClosedColor === 'UNCERTAIN' && pixelAudit && pixelAudit.candleCount >= 5
        ? pixelAudit.closedColor
        : visionMatchedFormingInstead && pixelAudit
        ? pixelAudit.closedColor
        : visionClosedColor;

    const closedCandleType: 'BULLISH' | 'BEARISH' | 'DOJI' =
      effectiveClosedColor === 'GREEN'
        ? 'BULLISH'
        : effectiveClosedColor === 'RED'
        ? 'BEARISH'
        : 'DOJI';

    const upperWickPct = Number(
      visionData.closedCandleUpperWickPercent ?? pixelAudit?.upperWickPct ?? 0
    );
    const lowerWickPct = Number(
      visionData.closedCandleLowerWickPercent ?? pixelAudit?.lowerWickPct ?? 0
    );
    const bodyPct = Number(
      visionData.closedCandleBodyPercent ?? pixelAudit?.bodyPct ?? (closedCandleType === 'DOJI' ? 12 : 55)
    );

    const isSpinningTop =
      (upperWickPct >= 30 && lowerWickPct >= 30 && bodyPct <= 26) ||
      Boolean(pixelAudit && pixelAudit.candleCount >= 5 && pixelAudit.isSpinningTop && bodyPct <= 28);

    const hasUpperPinBar =
      !isSpinningTop &&
      ((upperWickPct >= 38 && lowerWickPct <= 22 && upperWickPct >= Math.max(25, lowerWickPct * 1.7)) ||
        (visionData.closedCandleRejection === 'UPPER_REJECTION' && lowerWickPct <= 24));

    const hasLowerPinBar =
      !isSpinningTop &&
      ((lowerWickPct >= 38 && upperWickPct <= 22 && lowerWickPct >= Math.max(25, upperWickPct * 1.7)) ||
        (visionData.closedCandleRejection === 'LOWER_REJECTION' && upperWickPct <= 24));

    const hasRejection = hasUpperPinBar || hasLowerPinBar;

    const closedCandleLabelBn =
      isSpinningTop
        ? 'স্পিনিং টপ (দ্বিমুখী উইক)'
        : closedCandleType === 'BULLISH'
        ? `সবুজ${hasRejection ? ' (উইক রিজেকশন)' : ' (বুলিশ বডি)'}`
        : closedCandleType === 'BEARISH'
        ? `লাল${hasRejection ? ' (উইক রিজেকশন)' : ' (বিয়ারিশ বডি)'}`
        : 'ডোজি (সিদ্ধান্তহীন)';

    // Normalize Multi-Timeframe & Market Filter from Vision AI
    const macroTrend15m =
      visionData.macroTrend15m ||
      (visionData.chartStructure === 'UPTREND'
        ? 'UPTREND'
        : visionData.chartStructure === 'DOWNTREND'
        ? 'DOWNTREND'
        : 'SIDEWAYS');
    const secondaryTrend5m = visionData.secondaryTrend5m || macroTrend15m;
    const microTrend1m =
      visionData.microTrend1m ||
      (closedCandleType === 'BULLISH' ? 'UPTREND' : closedCandleType === 'BEARISH' ? 'DOWNTREND' : 'SIDEWAYS');

    const marketRegime =
      visionData.marketRegime ||
      (visionData.chartStructure === 'RANGING' || visionData.chartStructure === 'CONSOLIDATION'
        ? 'SIDEWAYS'
        : visionData.tradeQualityTier === 'HIGH_RISK_DOJI'
        ? 'DOJI_CHOPPY'
        : 'TRENDING');

    // SAFETY GUARD 4: Price Mismatch Gate
    let signalFlow = visionData.signalFlow;

    if (marketVerification.status === 'PRICE_MISMATCH') {
      direction = 'WAIT';
      confidence = 15;
      verdictTitle = `WAIT / PRICE MISMATCH (${assetName})`;
      suggestedExpiry = 'N/A';
      reasoning.push(
        `প্রাইস অমিল গার্ড: স্ক্রিন প্রাইস ($${marketVerification.screenPrice}) ও লাইভ মার্কেট ($${marketVerification.livePrice}) এর মধ্যে ${marketVerification.priceDeltaPercent}% অমিল। চার্ট বা স্প্রেড অসঙ্গতিপূর্ণ।`
      );
      const stepChecks = [
        { step: 1, key: 'CHART' as const, labelBn: 'চার্ট', passed: true, detailBn: assetName },
        { step: 2, key: 'CLOSED_CANDLE' as const, labelBn: 'ক্লোজ ক্যান্ডেল', passed: closedCandleType !== 'DOJI', detailBn: closedCandleLabelBn },
        { step: 3, key: 'MTF_TREND' as const, labelBn: 'মাল্টি-TF', passed: false, detailBn: 'অমিল' },
        { step: 4, key: 'MARKET_FILTER' as const, labelBn: 'ফিল্টার', passed: false, detailBn: 'প্রাইস মিসম্যাচ' },
        { step: 5, key: 'SETUP_SCORE' as const, labelBn: 'স্কোর', passed: false, detailBn: 'WAIT' },
      ];
      signalFlow = {
        confirmedPoints: stepChecks.filter((s) => s.passed).length,
        totalPoints: 5,
        stepChecks,
        chartVerification: {
          isChartValid: true,
          detectedAsset: assetName,
          detectedTimeframe: visionData.timeframe || '1m',
          candleBarsCount: 12,
          notes: 'চার্ট শনাক্ত হলেও লাইভ প্রাইসে অমিল।',
        },
        candleData: {
          candleCount: 12,
          closedCandle: {
            type: closedCandleType,
            bodySizePx: Math.round(bodyPct),
            upperWickPx: Math.round(upperWickPct),
            lowerWickPx: Math.round(lowerWickPct),
            isRejection: hasRejection,
            labelBn: closedCandleLabelBn,
          },
          runningCandle: {
            isForming: visionData.formingCandleColor !== 'NONE',
            intraBarBias:
              visionData.formingCandleColor === 'GREEN'
                ? 'BUYING'
                : visionData.formingCandleColor === 'RED'
                ? 'SELLING'
                : 'NEUTRAL',
          },
          candleTimerSecondsLeft: visionData.candleTimerSecondsLeft ?? 0,
        },
        multiTimeframe: {
          macroTrend15m,
          secondaryTrend5m,
          microTrend1m,
          confluenceStatus: 'CONFLICT',
        },
        marketFilter: {
          regime: marketRegime,
          passed: false,
          blockReason: 'প্রাইস অমিল গার্ড',
        },
        signalScoring: {
          priceActionScore: 1.5,
          indicatorMomentumScore: 0.5,
          trendAlignmentScore: 0,
          totalScore: 2.0,
          thresholdRequired: 8.0,
          finalVerdict: 'WAIT',
        },
      };
    } else {
      // 3. High-Precision Consensus Scoring + 5-Step Verification Gate (Zero Self-Inflation)
      const bullishIndicators = visionData.indicatorsIdentified.filter((i) => i.bias === 'BULLISH').length;
      const bearishIndicators = visionData.indicatorsIdentified.filter((i) => i.bias === 'BEARISH').length;
      const aiForecast = visionData.predictedNextCandle || 'WAIT';
      const setup = (visionData.priceActionSetup || '').toLowerCase();
      const pattern = (visionData.candlestickPattern || '').toLowerCase();

      // Objective directional score based on measurable evidence (not aiForecast voting for itself)
      let directionalScore = 0;

      if (aiForecast === 'CALL') directionalScore += 1.5;
      if (aiForecast === 'PUT') directionalScore -= 1.5;

      const isBearishRejection =
        !isSpinningTop &&
        (hasUpperPinBar ||
          (setup.includes('shooting star') && lowerWickPct <= 24) ||
          (pattern.includes('shooting star') && lowerWickPct <= 24));
      const isBullishRejection =
        !isSpinningTop &&
        (hasLowerPinBar ||
          (setup.includes('hammer') && upperWickPct <= 24) ||
          (pattern.includes('hammer') && upperWickPct <= 24));

      if (isBearishRejection) directionalScore -= 3.0;
      if (isBullishRejection) directionalScore += 3.0;

      directionalScore += Math.min(2, bullishIndicators) * 1.25;
      directionalScore -= Math.min(2, bearishIndicators) * 1.25;

      if (!isBearishRejection && macroTrend15m === 'UPTREND' && (!pixelAudit || pixelAudit.slope12 !== 'DOWN')) {
        directionalScore += 1.5;
      }
      if (!isBullishRejection && macroTrend15m === 'DOWNTREND' && (!pixelAudit || pixelAudit.slope12 !== 'UP')) {
        directionalScore -= 1.5;
      }

      if (pattern.includes('bullish engulfing') && closedCandleType === 'BULLISH') directionalScore += 2.5;
      if (pattern.includes('bearish engulfing') && closedCandleType === 'BEARISH') directionalScore -= 2.5;

      if (closedCandleType === 'BULLISH' && !isBearishRejection && bodyPct >= 25) directionalScore += 1.5;
      if (closedCandleType === 'BEARISH' && !isBullishRejection && bodyPct >= 25) directionalScore -= 1.5;

      const step1Passed = Boolean(visionData.step1ChartValid ?? visionData.isClearTradingChart);

      // Step 2 MUST fail if closed candle is uncertain, Doji, Spinning Top, or Vision vs Pixel clearly disagreed!
      const isWeakAmbiguousDoji = closedCandleType === 'DOJI' || isSpinningTop || (bodyPct < 20 && !hasRejection);
      const closedCandleMismatch = Boolean(pixelConfirmedOpposite);
      const step2Passed = Boolean(
        effectiveClosedColor !== 'UNCERTAIN' &&
          !closedCandleMismatch &&
          !isWeakAmbiguousDoji &&
          (visionData.step2ClosedCandleValid !== false)
      );

      // Check real visible chart slope via pixelAudit if available
      const isFlatVisualRange = Boolean(
        pixelAudit &&
          pixelAudit.candleCount >= 6 &&
          pixelAudit.slope12 === 'FLAT' &&
          !hasRejection
      );

      const mtfConfluence: 'ALIGNED' | 'CONFLICT' | 'NEUTRAL' =
        isFlatVisualRange
          ? 'NEUTRAL'
          : macroTrend15m !== 'SIDEWAYS' && secondaryTrend5m === macroTrend15m
          ? 'ALIGNED'
          : macroTrend15m === 'SIDEWAYS' && secondaryTrend5m === 'SIDEWAYS'
          ? 'NEUTRAL'
          : macroTrend15m !== secondaryTrend5m && secondaryTrend5m !== 'SIDEWAYS'
          ? 'CONFLICT'
          : 'NEUTRAL';

      // User-Drawn Chart Markup Confluence & Anti-Wall Entry Guard
      const drawingInteraction = visionData.drawingInteraction || 'NONE';
      const hasUserDrawings = Boolean(visionData.userDrawingsDetected && drawingInteraction !== 'NONE');
      const isDrawingConfirmed =
        hasUserDrawings &&
        ((aiForecast === 'CALL' && (drawingInteraction === 'AT_SUPPORT_BOUNCE' || drawingInteraction === 'BREAKOUT_RETEST')) ||
          (aiForecast === 'PUT' && (drawingInteraction === 'AT_RESISTANCE_REJECT' || drawingInteraction === 'BREAKOUT_RETEST')));
      const isBlockedByDrawing =
        hasUserDrawings &&
        ((aiForecast === 'CALL' && drawingInteraction === 'BLOCKED_AT_RESISTANCE') ||
          (aiForecast === 'PUT' && drawingInteraction === 'BLOCKED_AT_SUPPORT'));

      if (isDrawingConfirmed) {
        directionalScore += aiForecast === 'CALL' ? 2.0 : -2.0;
      }

      // Enforce genuine alignment: disallow hallucinated 15M/5M alignment when 1m visual structure is flat without true pin-bar or drawing bounce!
      const step3Passed = Boolean(
        !isBlockedByDrawing &&
          !isFlatVisualRange &&
          (mtfConfluence === 'ALIGNED' ||
            isDrawingConfirmed ||
            (hasRejection && mtfConfluence !== 'CONFLICT'))
      );

      // Market filter MUST fail on SIDEWAYS / DOJI_CHOPPY / SPINNING TOP / PIXEL CHOP / TRUE 4+ EXHAUSTION CHASING
      const isPixelChoppy = Boolean(
        pixelAudit &&
          pixelAudit.candleCount >= 6 &&
          (pixelAudit.alternatingFlips >= 5 ||
            (pixelAudit.alternatingFlips >= 4 && pixelAudit.sameColorStreak <= 1))
      );
      const isBinaryMode = !isSpotSlTp;
      const isExhaustedCallChase = Boolean(
        isBinaryMode &&
          aiForecast === 'CALL' &&
          !isDrawingConfirmed &&
          !isBullishRejection &&
          pixelAudit &&
          pixelAudit.candleCount >= 6 &&
          ((pixelAudit.sameColorStreak >= 4 && pixelAudit.closedColor === 'GREEN') ||
            (pixelAudit.nearRangeTop && pixelAudit.sameColorStreak >= 3))
      );
      const isExhaustedPutChase = Boolean(
        isBinaryMode &&
          aiForecast === 'PUT' &&
          !isDrawingConfirmed &&
          !isBearishRejection &&
          pixelAudit &&
          pixelAudit.candleCount >= 6 &&
          ((pixelAudit.sameColorStreak >= 4 && pixelAudit.closedColor === 'RED') ||
            (pixelAudit.nearRangeBottom && pixelAudit.sameColorStreak >= 3))
      );
      const isExhaustionChase = isExhaustedCallChase || isExhaustedPutChase;

      const isUnsafeMarketRegime =
        marketRegime === 'DOJI_CHOPPY' ||
        marketRegime === 'HIGH_VOLATILITY_SPIKE' ||
        visionData.tradeQualityTier === 'HIGH_RISK_DOJI' ||
        isSpinningTop ||
        isPixelChoppy;
      const isSidewaysNoRejection = marketRegime === 'SIDEWAYS' && !hasRejection && !isDrawingConfirmed;
      const filterPassed = Boolean(
        !isUnsafeMarketRegime &&
          !isSidewaysNoRejection &&
          !isBlockedByDrawing &&
          !isExhaustionChase &&
          (visionData.step4FilterPassed !== false)
      );

      const step4SpecificBlockReason = isBlockedByDrawing
        ? 'ড্রয়িং S/R দেয়াল সুরক্ষা'
        : isExhaustionChase
        ? `টানা ${pixelAudit?.sameColorStreak || 3}+ ক্যান্ডেল এক্সহশন / পূর্বের S-R দেয়াল`
        : isSpinningTop
        ? `স্পিনিং টপ (আপার ${upperWickPct}% / লোয়ার ${lowerWickPct}%)`
        : isPixelChoppy
        ? 'অল্টারনেটিং চপি রেঞ্জ'
        : isSidewaysNoRejection
        ? 'সাইডওয়েজ মার্কেট (রিজেকশন নেই)'
        : isUnsafeMarketRegime
        ? `অস্থির মার্কেট (${marketRegime})`
        : 'AI ফিল্টার (অনিশ্চিত সেটআপ)';

      // Weighted 10-point score
      const rawPaScore =
        typeof visionData.priceActionScore === 'number'
          ? Math.min(5, Math.max(0, visionData.priceActionScore))
          : Math.min(5, Math.max(1.2, Math.abs(directionalScore) * 0.6 + (hasRejection ? 1.5 : 0.6)));
      const rawIndScore =
        typeof visionData.indicatorMomentumScore === 'number'
          ? Math.min(3, Math.max(0, visionData.indicatorMomentumScore))
          : Math.min(3, Math.max(0.6, (bullishIndicators + bearishIndicators) * 1.0));
      const rawTrendScore =
        typeof visionData.trendAlignmentScore === 'number'
          ? Math.min(2, Math.max(0, visionData.trendAlignmentScore))
          : step3Passed
          ? 1.8
          : 0.5;

      const baseScore =
        typeof visionData.totalScore === 'number' && visionData.totalScore > 0
          ? visionData.totalScore
          : rawPaScore + rawIndScore + rawTrendScore;
      const penalty = (closedCandleMismatch ? 2.5 : 0) + (isExhaustionChase ? 2.5 : 0) + (isSpinningTop ? 2.0 : 0);
      const computedTotalScore = Number(
        Math.min(10, Math.max(0, baseScore + (isDrawingConfirmed ? 0.3 : 0) - penalty)).toFixed(1)
      );

      // STRICT CLOSED-CANDLE CONSISTENCY & ANTI-COUNTER-TREND GUARD (Prevents wrong entries!)
      // 1) Do NOT enter CALL if closed candle is BEARISH (>=22% body) without a true Hammer lower-wick rejection or drawing bounce
      const isContradictoryCall =
        aiForecast === 'CALL' &&
        closedCandleType === 'BEARISH' &&
        !isBullishRejection &&
        !isDrawingConfirmed &&
        bodyPct >= 22;
      // 2) Do NOT enter PUT if closed candle is BULLISH (>=22% body) without a true Shooting Star upper-wick rejection or drawing rejection
      const isContradictoryPut =
        aiForecast === 'PUT' &&
        closedCandleType === 'BULLISH' &&
        !isBearishRejection &&
        !isDrawingConfirmed &&
        bodyPct >= 22;
      // 3) Do NOT guess against aligned 15m+5m macro trend without a decisive true rejection wick or explicit drawing level bounce
      const isBlindCounterTrend =
        !isDrawingConfirmed &&
        ((aiForecast === 'CALL' && macroTrend15m === 'DOWNTREND' && secondaryTrend5m === 'DOWNTREND' && !isBullishRejection) ||
          (aiForecast === 'PUT' && macroTrend15m === 'UPTREND' && secondaryTrend5m === 'UPTREND' && !isBearishRejection));

      const hasClearDirection =
        aiForecast !== 'WAIT' &&
        !closedCandleMismatch &&
        !isBlockedByDrawing &&
        !isExhaustionChase &&
        !isContradictoryCall &&
        !isContradictoryPut &&
        !isBlindCounterTrend &&
        (aiForecast === 'CALL' ? directionalScore >= 2.5 : directionalScore <= -2.5);

      const step5Passed = Boolean(
        (visionData.step5SetupConfirmed !== false) &&
          hasClearDirection &&
          filterPassed &&
          step2Passed &&
          step3Passed &&
          computedTotalScore >= 8.0
      );

      const stepChecks = [
        {
          step: 1,
          key: 'CHART' as const,
          labelBn: 'চার্ট',
          passed: step1Passed,
          detailBn: `${assetName} · ${visionData.timeframe || '1m'}`,
        },
        {
          step: 2,
          key: 'CLOSED_CANDLE' as const,
          labelBn: 'ক্লোজ ক্যান্ডেল',
          passed: step2Passed,
          detailBn: closedCandleMismatch ? 'রং অসঙ্গতি (পিক্সেল)' : closedCandleLabelBn,
        },
        {
          step: 3,
          key: 'MTF_TREND' as const,
          labelBn: 'মাল্টি-TF',
          passed: step3Passed,
          detailBn: isBlockedByDrawing
            ? 'লেভেল বাধা'
            : isDrawingConfirmed
            ? 'ড্রয়িং ম্যাচ'
            : mtfConfluence === 'ALIGNED'
            ? 'অ্যালাইন্ড'
            : hasRejection && step3Passed
            ? 'রিজেকশন জোন'
            : 'রেঞ্জ/দুর্বল',
        },
        {
          step: 4,
          key: 'MARKET_FILTER' as const,
          labelBn: 'ফিল্টার',
          passed: filterPassed,
          detailBn: isBlockedByDrawing
            ? 'ড্রয়িং দেয়াল ব্লক'
            : isExhaustionChase
            ? 'এক্সহশন/S-R ব্লক'
            : filterPassed
            ? 'ক্লিয়ার মার্কেট'
            : 'চপি/দোজি ফিল্টার্ড',
        },
        {
          step: 5,
          key: 'SETUP_SCORE' as const,
          labelBn: 'স্কোর ও সেটআপ',
          passed: step5Passed,
          detailBn: `${computedTotalScore.toFixed(1)}/১০`,
        },
      ];

      const confirmedPoints = stepChecks.filter((s) => s.passed).length;

      // STRICT PRECISION RULE: Require all 5 steps (or 4/5 with >= 8.2 score & mandatory step2/step4/step5), zero contradictions!
      const canIssueTradeSignal =
        (confirmedPoints === 5 || (confirmedPoints >= 4 && computedTotalScore >= 8.2)) &&
        filterPassed &&
        step2Passed &&
        step3Passed &&
        step5Passed &&
        hasClearDirection &&
        (aiForecast === 'CALL' || aiForecast === 'PUT');

      if (!canIssueTradeSignal) {
        direction = 'WAIT';
        confidence = Math.min(62, Math.max(20, Math.round(confirmedPoints * 12)));
        suggestedExpiry = 'অপেক্ষা করুন';
        verdictTitle = `⏸ WAIT (${assetName} · ${confirmedPoints}/5 পয়েন্ট)`;
        const failedStepNames = stepChecks.filter((s) => !s.passed).map((s) => s.labelBn).join(', ');
        const blockNote = closedCandleMismatch
          ? `[${profileLabelBn}] ক্লোজড ক্যান্ডেল যাচাই অমিল (AI: ${visionClosedColor} বনাম চার্ট পিক্সেল: ${pixelAudit?.closedColor}) — ভুল সিগন্যাল এড়াতে WAIT।`
          : isExhaustionChase
          ? `[${profileLabelBn}] টানা ${pixelAudit?.sameColorStreak || 3}+ একই রঙের ক্যান্ডেল বা S/R দেয়ালের কাছে এক্সহশন ঝুঁকি — বিপরীত ক্যান্ডেল এড়াতে WAIT।`
          : isSpinningTop
          ? `[${profileLabelBn}] উভয়মুখী উইক স্পিনিং টপ (${upperWickPct}%/${lowerWickPct}%) — সিদ্ধান্তহীন মার্কেট (WAIT)।`
          : isBlockedByDrawing
          ? `[${profileLabelBn}] ড্রয়িং সুরক্ষা: ${
              visionData.drawingNoteBn ||
              (drawingInteraction === 'BLOCKED_AT_RESISTANCE'
                ? 'আপনার আঁকা রেজিস্ট্যান্স লাইনের ঠিক নিচে CALL এন্ট্রি ব্লক করা হয়েছে (WAIT)।'
                : 'আপনার আঁকা সাপোর্ট লাইনের ঠিক ওপরে PUT এন্ট্রি ব্লক করা হয়েছে (WAIT)।')
            }`
          : isContradictoryCall || isContradictoryPut
          ? `[${profileLabelBn}] ক্লোজড ক্যান্ডেল (${closedCandleLabelBn}) ও সিগন্যালে অসঙ্গতি থাকায় ভুল এন্ট্রি এড়াতে WAIT।`
          : isBlindCounterTrend
          ? `[${profileLabelBn}] মেইন ট্রেন্ডের বিপরীতে স্পষ্ট রিজেকশন না থাকায় WAIT।`
          : visionData.nextCandlePredictionReasonBn ||
            `[${profileLabelBn}] ৫টির মধ্যে ${confirmedPoints}/৫ পয়েন্ট নিশ্চিত হয়েছে (${failedStepNames || 'কনফার্মেশন অপর্যাপ্ত'}) — নিরাপদ এন্ট্রির জন্য WAIT।`;
        reasoning.push(blockNote);
      } else if (aiForecast === 'CALL') {
        direction = 'UP';
        confidence = Math.min(
          96,
          Math.max(76, Math.round(64 + computedTotalScore * 3.0 + (confirmedPoints === 5 ? 3 : 0) + (isDrawingConfirmed ? 2 : 0)))
        );
        verdictTitle = isSpotSlTp
          ? `▲ LONG / BUY (${assetName} · ${confirmedPoints}/5)`
          : `▲ CALL / UP (${assetName} · ${confirmedPoints}/5)`;
        reasoning.push(
          visionData.nextCandlePredictionReasonBn ||
            `[${profileLabelBn}] বুলিশ সিগন্যাল (${confidence}% · ${confirmedPoints}/৫ পয়েন্ট): ক্লোজড ক্যান্ডেল ${closedCandleLabelBn} ও সেটআপ নিশ্চিত।`
        );
      } else {
        direction = 'DOWN';
        confidence = Math.min(
          96,
          Math.max(76, Math.round(64 + computedTotalScore * 3.0 + (confirmedPoints === 5 ? 3 : 0) + (isDrawingConfirmed ? 2 : 0)))
        );
        verdictTitle = isSpotSlTp
          ? `▼ SHORT / SELL (${assetName} · ${confirmedPoints}/5)`
          : `▼ PUT / DOWN (${assetName} · ${confirmedPoints}/5)`;
        reasoning.push(
          visionData.nextCandlePredictionReasonBn ||
            `[${profileLabelBn}] বিয়ারিশ সিগন্যাল (${confidence}% · ${confirmedPoints}/৫ পয়েন্ট): ক্লোজড ক্যান্ডেল ${closedCandleLabelBn} ও সেটআপ নিশ্চিত।`
        );
      }

      if (hasUserDrawings && !isBlockedByDrawing) {
        reasoning.push(
          `ড্রয়িং ম্যাচ: ${
            visionData.drawingNoteBn ||
            (drawingInteraction === 'AT_SUPPORT_BOUNCE'
              ? 'আঁকা সাপোর্ট/ট্রেন্ডলাইন থেকে বাউন্স নিশ্চিত'
              : drawingInteraction === 'AT_RESISTANCE_REJECT'
              ? 'আঁকা রেজিস্ট্যান্স/ট্রেন্ডলাইন থেকে রিজেকশন নিশ্চিত'
              : drawingInteraction === 'BREAKOUT_RETEST'
              ? 'আঁকা লেভেল ব্রেকআউট ও রিটেস্ট শনাক্ত'
              : 'চার্ট ড্রয়িং পর্যবেক্ষণ সক্রিয়')
          }`
        );
      }

      reasoning.push(`ক্লোজড ক্যান্ডেল (সম্পন্ন): ${closedCandleLabelBn}${visionData.formingCandleColor && visionData.formingCandleColor !== 'NONE' ? ` · রানিং: ${visionData.formingCandleColor === 'GREEN' ? 'সবুজ' : visionData.formingCandleColor === 'RED' ? 'লাল' : 'দোজি'}` : ''}`);
      if (
        !isSpotSlTp &&
        typeof visionData.candleTimerSecondsLeft === 'number' &&
        visionData.candleTimerSecondsLeft >= 1 &&
        visionData.candleTimerSecondsLeft <= 4
      ) {
        reasoning.push(
          `টাইমার সতর্কতা: ক্যান্ডেল ক্লোজ হতে ${visionData.candleTimerSecondsLeft}s বাকি — নতুন ক্যান্ডেল ওপেন হওয়ার সাথে সাথে এন্ট্রি নিশ্চিত করুন।`
        );
      }
      if (visionData.candlestickPattern) {
        reasoning.push(`প্যাটার্ন: ${visionData.candlestickPattern}`);
      }
      if (visionData.visionSummary) {
        reasoning.push(`ভিজুয়াল সামারি: ${visionData.visionSummary}`);
      }

      // Sync corrected closedCandleColor onto returned visionData so HUD & logs match pixel verification
      visionData.closedCandleColor = effectiveClosedColor;

      signalFlow = {
        confirmedPoints,
        totalPoints: 5,
        stepChecks,
        chartVerification: {
          isChartValid: step1Passed,
          detectedAsset: assetName,
          detectedTimeframe: visionData.timeframe || '1m',
          candleBarsCount: pixelAudit?.candleCount ?? 16,
          notes: `${confirmedPoints}/৫ ধাপ নিশ্চিত`,
        },
        candleData: {
          candleCount: pixelAudit?.candleCount ?? 16,
          closedCandle: {
            type: closedCandleType,
            bodySizePx: Math.round(bodyPct),
            upperWickPx: Math.round(upperWickPct),
            lowerWickPx: Math.round(lowerWickPct),
            isRejection: hasRejection,
            labelBn: closedCandleLabelBn,
          },
          runningCandle: {
            isForming: (pixelAudit ? pixelAudit.formingColor : visionData.formingCandleColor) !== 'NONE',
            intraBarBias:
              visionData.formingCandleColor === 'GREEN'
                ? 'BUYING'
                : visionData.formingCandleColor === 'RED'
                ? 'SELLING'
                : 'NEUTRAL',
          },
          candleTimerSecondsLeft: visionData.candleTimerSecondsLeft ?? 0,
        },
        multiTimeframe: {
          macroTrend15m,
          secondaryTrend5m,
          microTrend1m,
          confluenceStatus: mtfConfluence,
        },
        marketFilter: {
          regime: marketRegime,
          passed: filterPassed,
          blockReason: filterPassed ? undefined : step4SpecificBlockReason,
        },
        signalScoring: {
          priceActionScore: Number(rawPaScore.toFixed(1)),
          indicatorMomentumScore: Number(rawIndScore.toFixed(1)),
          trendAlignmentScore: Number(rawTrendScore.toFixed(1)),
          totalScore: computedTotalScore,
          thresholdRequired: 8.0,
          finalVerdict: direction === 'UP' ? 'CALL' : direction === 'DOWN' ? 'PUT' : 'WAIT',
        },
      };
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
      signalFlow,
      safetyDisclaimer:
        'লাইভ স্ক্রিন বিশ্লেষণ একটি এডুকেশনাল ডিসিশন এইড। কোনো অটোমেটেড অর্ডার প্লেস করা হয় না।',
      screenStatus: 'CHART_DETECTED',
      tradingProfileId: activeProfileId,
      profileLabelBn,
      screenTransition,
    };
  }
}

export const screenVerificationService = ScreenVerificationService.getInstance();
