export interface ScreenVisionParsedData {
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
  visionSummary: string;
  confidenceScore: number; // 0.0 - 1.0
  isClearTradingChart: boolean;
  containsSensitivePrivateData: boolean; // Flag if user balance or account ID detected
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
  confidence: number; // 0 - 100%
  verdictTitle: string;
  reasoning: string[];
  visionData: ScreenVisionParsedData;
  marketVerification: MarketVerificationResult;
  ruleEngineComparison?: {
    ruleScore?: number;
    ruleDirection?: string;
    concordance: 'AGREES' | 'CONFLICTS' | 'NO_RULE_DATA';
  };
  safetyDisclaimer: string;
}
