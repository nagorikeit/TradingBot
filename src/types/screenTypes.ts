export interface ScreenVisionParsedData {
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
  visionSummary: string;
  confidenceScore: number;
  isClearTradingChart: boolean;
  containsSensitivePrivateData: boolean;
}

export interface MarketVerificationResult {
  isVerified: boolean;
  status: 'MATCHED' | 'PRICE_MISMATCH' | 'UNSUPPORTED_BROKER_FEED' | 'STALE_DATA' | 'SKIPPED';
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
  reasoning: string[];
  visionData: ScreenVisionParsedData;
  marketVerification: MarketVerificationResult;
  safetyDisclaimer: string;
}

export type LiveStreamState = 'IDLE' | 'CONNECTING' | 'STREAMING' | 'PAUSED' | 'DISCONNECTED' | 'ERROR';
