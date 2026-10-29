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
  symbol?: string;
  timeframe?: string;
  marketType: 'CRYPTO' | 'FOREX' | 'STOCKS' | 'COMMODITY' | 'UNKNOWN';
  lastVisiblePrice?: number;
  lastCandleDirection: 'BULLISH' | 'BEARISH' | 'DOJI' | 'UNCERTAIN';
  candlestickPattern?: string;
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
  confidenceScore: number;
  isClearTradingChart: boolean;
  containsSensitivePrivateData: boolean;
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
  confidence: number;
  verdictTitle: string;
  suggestedExpiry?: string;
  reasoning: string[];
  visionData: ScreenVisionParsedData;
  marketVerification: MarketVerificationResult;
  safetyDisclaimer: string;

  // Universal Screen Recognition & Switch Tracking
  screenStatus: 'CHART_DETECTED' | 'OTHER_SCREEN_READING' | 'UNCLEAR_SCREEN';
  screenTransition?: {
    previousScreen?: string;
    currentScreen: string;
    switchedAt: number;
  };
}

export type LiveStreamState = 'IDLE' | 'CONNECTING' | 'STREAMING' | 'PAUSED' | 'DISCONNECTED' | 'ERROR';

export interface ScreenTransitionRecord {
  id: string;
  timestamp: number;
  appName: string;
  category: string;
  title: string;
  summaryBn: string;
  extractedSnippet?: string;
  isChart: boolean;
  confidence: number;
}

export interface ChartDetectionDiagnostic {
  isChart: boolean;
  distinctCandleBars: number;
  totalCandlePixels: number;
  horizontalSpanPercent: number;
  verticalDispersionPx: number;
  hasBrokerBackground: boolean;
  hasCandleWicks?: boolean;
  verifiedWicksCount?: number;
  backgroundUniformityPercent?: number;
  failureReason?: string;
  recommendedAction?: string;
}



