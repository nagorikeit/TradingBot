export interface ScreenVisionParsedData {
  // Universal Screen Recognition & OCR
  screenCategory?: 'TRADING_CHART' | 'DOCUMENT' | 'BROWSER' | 'CODE_IDE' | 'CHAT_MESSENGER' | 'VIDEO_STREAM' | 'DESKTOP' | 'SYSTEM_SETTINGS' | 'OTHER';
  detectedAppName?: string; // e.g. "Quotex", "TradingView", "Google Chrome", "VS Code", "YouTube", "Telegram", "Desktop"
  screenTitle?: string; // e.g. "EUR/USD 1M OTC - Quotex", "React Documentation", "Main.java - IntelliJ", "WhatsApp Web"
  extractedText?: string[]; // Legible text snippets, numbers, titles, or code read by AI
  isReadable?: boolean; // Can AI read legible text from this screen?
  screenSummaryBn?: string; // Bengali summary of what is on this screen
  screenSummaryEn?: string; // English summary
  customPromptAnswer?: string; // Answer if user queried the screen

  // Trading specific (when screenCategory === 'TRADING_CHART')
  symbol?: string; // e.g. "BTC/USDT", "ETHUSDT", "EUR/USD"
  timeframe?: string; // e.g. "1m", "5m", "15m", "1h", "4h", "1D"
  marketType: 'CRYPTO' | 'FOREX' | 'STOCKS' | 'COMMODITY' | 'UNKNOWN';
  lastVisiblePrice?: number;
  lastCandleDirection: 'BULLISH' | 'BEARISH' | 'DOJI' | 'UNCERTAIN';
  candlestickPattern?: string; // e.g. "Bullish Engulfing", "Pin Bar", "Hammer"
  indicatorsIdentified: {
    name: string;
    description: string;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }[];
  chartStructure: 'UPTREND' | 'DOWNTREND' | 'RANGING' | 'BREAKOUT' | 'CONSOLIDATION' | 'UNCLEAR';
  keyLevels?: {
    support?: number;
    resistance?: number;
  };
  predictedNextCandle?: 'CALL' | 'PUT' | 'WAIT';
  nextCandlePredictionReasonBn?: string;
  tradeQualityTier?: 'HIGH_PROBABILITY' | 'MODERATE' | 'HIGH_RISK_DOJI';
  priceActionSetup?: string;
  reversalProbabilityPercent?: number;
  visionSummary: string;
  confidenceScore: number; // 0.0 - 1.0
  isClearTradingChart: boolean;
  containsSensitivePrivateData: boolean; // Flag if user balance or account ID detected
}

export interface MarketVerificationResult {
  isVerified: boolean;
  status: 'MATCHED' | 'PRICE_MISMATCH' | 'UNSUPPORTED_BROKER_FEED' | 'BROKER_VISUAL_ACTION' | 'STALE_DATA' | 'SKIPPED';
  livePrice?: number;
  screenPrice?: number;
  priceDeltaPercent?: number;
  sourceUsed?: string;
  notes: string;
}

export interface ScreenAnalysisFinalResult {
  analysisId: string;
  timestamp: number;
  frameCapturedAt: number;
  direction: 'UP' | 'DOWN' | 'WAIT';
  confidence: number; // 0 - 100%
  verdictTitle: string;
  suggestedExpiry: string; // e.g. "1 - 2 Min", "5 Min"
  reasoning: string[];
  visionData: ScreenVisionParsedData;
  marketVerification: MarketVerificationResult;
  ruleEngineComparison?: {
    ruleScore?: number;
    ruleDirection?: string;
    concordance: 'AGREES' | 'CONFLICTS' | 'NO_RULE_DATA';
  };
  safetyDisclaimer: string;

  // Universal Screen Recognition & Switch Tracking
  screenStatus: 'CHART_DETECTED' | 'OTHER_SCREEN_READING' | 'UNCLEAR_SCREEN';
  screenTransition?: {
    previousScreen?: string;
    currentScreen: string;
    switchedAt: number;
  };
}

