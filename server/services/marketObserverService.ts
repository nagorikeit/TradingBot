import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CandleData,
  IndicatorSnapshot,
  MarketObservation,
  MarketRegime,
  ObservationType,
  RegimeSummaryItem,
} from '../types/observationTypes';
import { memoryService } from './memoryService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, '../storage');
const OBSERVATIONS_FILE = path.join(STORAGE_DIR, 'market_observations_db.json');

// Observation Heuristics Notice:
// The thresholds below are heuristic baselines for market logging and regime tracking,
// NOT validated trading rules, NOT trading signals, and NOT trade execution criteria.
const HEURISTIC_THRESHOLDS = {
  VOLUME_ANOMALY_MULTIPLIER: 1.8,
  HIGH_VOLATILITY_ATR_RATIO: 1.6,
  LOW_VOLATILITY_ATR_RATIO: 0.6,
  LOW_VOLATILITY_BANDWIDTH: 0.012,
  HIGH_VOLATILITY_BANDWIDTH: 0.05,
  EMA_FLATNESS_TOLERANCE: 0.0015,
  WICK_REJECTION_RATIO: 2.0,
};

export class MarketObserverService {
  private static instance: MarketObserverService;
  private observations: Map<string, MarketObservation> = new Map();
  private maxStoredObservations: number = 2000;

  private constructor() {
    this.ensureStorageDir();
    this.loadFromStorage();
  }

  public static getInstance(): MarketObserverService {
    if (!MarketObserverService.instance) {
      MarketObserverService.instance = new MarketObserverService();
    }
    return MarketObserverService.instance;
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  private loadFromStorage(): void {
    try {
      if (fs.existsSync(OBSERVATIONS_FILE)) {
        const raw = fs.readFileSync(OBSERVATIONS_FILE, 'utf-8');
        const list: MarketObservation[] = JSON.parse(raw);
        for (const obs of list) {
          const key = this.getCompositeKey(
            obs.symbol,
            obs.timeframe,
            obs.candleTimestamp,
            obs.observationType
          );
          this.observations.set(key, obs);
        }
      }
    } catch (err) {
      console.error('[MarketObserverService] Error loading observations:', err);
    }
  }

  private saveToStorage(): void {
    try {
      this.ensureStorageDir();
      const list = Array.from(this.observations.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, this.maxStoredObservations);
      fs.writeFileSync(OBSERVATIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[MarketObserverService] Error saving observations:', err);
    }
  }

  /**
   * Deterministic composite key for deduplication
   * Minimum identity: symbol + timeframe + candleTimestamp + observationType
   */
  public getCompositeKey(
    symbol: string,
    timeframe: string,
    candleTimestamp: number,
    observationType: ObservationType
  ): string {
    return `${symbol.toUpperCase()}::${timeframe}::${candleTimestamp}::${observationType}`;
  }

  // =========================================================================
  // Pure Mathematical Indicator Functions
  // =========================================================================

  public calculateEMA(values: number[], period: number): number[] {
    if (!values || values.length === 0 || period <= 0) return [];
    const result: number[] = new Array(values.length).fill(NaN);
    if (values.length < period) {
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        sum += values[i];
        result[i] = sum / (i + 1);
      }
      return result;
    }

    let initialSum = 0;
    for (let i = 0; i < period; i++) initialSum += values[i];
    const initialSMA = initialSum / period;
    result[period - 1] = initialSMA;

    const multiplier = 2 / (period + 1);
    let prevEMA = initialSMA;
    for (let i = period; i < values.length; i++) {
      const curEMA = (values[i] - prevEMA) * multiplier + prevEMA;
      result[i] = curEMA;
      prevEMA = curEMA;
    }

    for (let i = 0; i < period - 1; i++) {
      result[i] = initialSMA;
    }
    return result;
  }

  public calculateRSI(closes: number[], period: number = 14): number[] {
    if (!closes || closes.length <= period) {
      return new Array(closes ? closes.length : 0).fill(50);
    }
    const result: number[] = new Array(closes.length).fill(50);
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    let gains = 0;
    let losses = 0;
    for (let i = 0; i < period; i++) {
      const chg = changes[i];
      if (chg > 0) gains += chg;
      else losses += Math.abs(chg);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    if (avgLoss === 0) {
      result[period] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[period] = 100 - 100 / (1 + rs);
    }

    for (let i = period; i < changes.length; i++) {
      const chg = changes[i];
      const gain = chg > 0 ? chg : 0;
      const loss = chg < 0 ? Math.abs(chg) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const candleIdx = i + 1;
      if (avgLoss === 0) {
        result[candleIdx] = 100;
      } else {
        const rs = avgGain / avgLoss;
        result[candleIdx] = 100 - 100 / (1 + rs);
      }
    }
    return result;
  }

  public calculateMACD(
    closes: number[],
    fast: number = 12,
    slow: number = 26,
    signal: number = 9
  ): { macd: number[]; signal: number[]; histogram: number[] } {
    const len = closes ? closes.length : 0;
    if (len === 0) return { macd: [], signal: [], histogram: [] };

    const fastEMA = this.calculateEMA(closes, fast);
    const slowEMA = this.calculateEMA(closes, slow);
    const macdLine: number[] = new Array(len).fill(0);

    for (let i = 0; i < len; i++) {
      const f = fastEMA[i];
      const s = slowEMA[i];
      macdLine[i] = !isNaN(f) && !isNaN(s) ? f - s : 0;
    }

    const signalLine = this.calculateEMA(macdLine, signal);
    const histogram: number[] = new Array(len).fill(0);
    for (let i = 0; i < len; i++) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
    return { macd: macdLine, signal: signalLine, histogram };
  }

  public calculateBollingerBands(
    closes: number[],
    period: number = 20,
    multiplier: number = 2
  ): { upper: number[]; middle: number[]; lower: number[]; bandwidth: number[] } {
    const len = closes ? closes.length : 0;
    const upper: number[] = new Array(len).fill(0);
    const middle: number[] = new Array(len).fill(0);
    const lower: number[] = new Array(len).fill(0);
    const bandwidth: number[] = new Array(len).fill(0);

    if (len === 0) return { upper, middle, lower, bandwidth };

    for (let i = 0; i < len; i++) {
      const start = Math.max(0, i - period + 1);
      const count = i - start + 1;
      let sum = 0;
      for (let j = start; j <= i; j++) sum += closes[j];
      const sma = sum / count;
      middle[i] = sma;

      let varianceSum = 0;
      for (let j = start; j <= i; j++) varianceSum += Math.pow(closes[j] - sma, 2);
      const stdDev = Math.sqrt(varianceSum / count);

      upper[i] = sma + multiplier * stdDev;
      lower[i] = sma - multiplier * stdDev;
      bandwidth[i] = sma > 0 ? (upper[i] - lower[i]) / sma : 0;
    }
    return { upper, middle, lower, bandwidth };
  }

  public calculateATR(candles: CandleData[], period: number = 14): number[] {
    const len = candles ? candles.length : 0;
    if (len === 0) return [];
    const tr: number[] = [];
    for (let i = 0; i < len; i++) {
      const cur = candles[i];
      if (i === 0) {
        tr.push(cur.high - cur.low);
      } else {
        const prev = candles[i - 1];
        const hMinusL = cur.high - cur.low;
        const hMinusPc = Math.abs(cur.high - prev.close);
        const lMinusPc = Math.abs(cur.low - prev.close);
        tr.push(Math.max(hMinusL, hMinusPc, lMinusPc));
      }
    }

    const result: number[] = new Array(len).fill(0);
    const firstWindow = Math.min(period, len);
    let trSum = 0;
    for (let i = 0; i < firstWindow; i++) trSum += tr[i];
    let prevATR = trSum / firstWindow;
    result[firstWindow - 1] = prevATR;

    for (let i = 0; i < firstWindow - 1; i++) result[i] = prevATR;

    for (let i = firstWindow; i < len; i++) {
      const curATR = (prevATR * (period - 1) + tr[i]) / period;
      result[i] = curATR;
      prevATR = curATR;
    }
    return result;
  }

  public calculateSMA(values: number[], period: number): number[] {
    const len = values ? values.length : 0;
    const result: number[] = new Array(len).fill(0);
    if (len === 0) return result;

    for (let i = 0; i < len; i++) {
      const start = Math.max(0, i - period + 1);
      const count = i - start + 1;
      let sum = 0;
      for (let j = start; j <= i; j++) sum += values[j];
      result[i] = sum / count;
    }
    return result;
  }

  // =========================================================================
  // Deterministic Regime Classification Heuristic
  // =========================================================================

  /**
   * Classifies market regime based on deterministic indicator math.
   * NOTE: This is an observation heuristic, NOT a trading signal and does NOT issue orders.
   */
  public classifyRegime(
    close: number,
    ema9: number,
    ema21: number,
    rsi: number,
    macdHist: number,
    atr: number,
    avgAtr: number,
    bandwidth: number
  ): MarketRegime {
    // 1. Extreme Volatility checks
    if (bandwidth > HEURISTIC_THRESHOLDS.HIGH_VOLATILITY_BANDWIDTH || (avgAtr > 0 && atr > HEURISTIC_THRESHOLDS.HIGH_VOLATILITY_ATR_RATIO * avgAtr)) {
      return 'HIGH_VOLATILITY';
    }
    if (bandwidth < HEURISTIC_THRESHOLDS.LOW_VOLATILITY_BANDWIDTH || (avgAtr > 0 && atr < HEURISTIC_THRESHOLDS.LOW_VOLATILITY_ATR_RATIO * avgAtr)) {
      return 'LOW_VOLATILITY';
    }

    // 2. Trend direction checks
    const isBullishTrend = close > ema9 && ema9 > ema21 && macdHist > 0 && rsi >= 48;
    if (isBullishTrend) {
      return 'TRENDING_BULLISH';
    }

    const isBearishTrend = close < ema9 && ema9 < ema21 && macdHist < 0 && rsi <= 52;
    if (isBearishTrend) {
      return 'TRENDING_BEARISH';
    }

    // 3. Consolidation / Range check
    const emaDiffRatio = close > 0 ? Math.abs(ema9 - ema21) / close : 0;
    if (emaDiffRatio < HEURISTIC_THRESHOLDS.EMA_FLATNESS_TOLERANCE && rsi >= 38 && rsi <= 62) {
      return 'RANGING_CONSOLIDATION';
    }

    return 'UNCERTAIN';
  }

  // =========================================================================
  // Core Candle Observation Engine
  // =========================================================================

  /**
   * Evaluates candles, computes mathematical indicators, and extracts deterministic observations.
   */
  public observeCandles(
    symbol: string,
    timeframe: string,
    candles: CandleData[],
    source: string = 'BINANCE_REST'
  ): MarketObservation[] {
    if (!candles || candles.length < 5) {
      return [];
    }

    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);
    const lastIdx = candles.length - 1;
    const curCandle = candles[lastIdx];
    const prevCandle = candles[lastIdx - 1];

    // Compute technical series
    const ema9Series = this.calculateEMA(closes, 9);
    const ema21Series = this.calculateEMA(closes, 21);
    const rsiSeries = this.calculateRSI(closes, 14);
    const macdSeries = this.calculateMACD(closes, 12, 26, 9);
    const bbSeries = this.calculateBollingerBands(closes, 20, 2);
    const atrSeries = this.calculateATR(candles, 14);
    const volSma20Series = this.calculateSMA(volumes, 20);

    const ema9 = ema9Series[lastIdx];
    const ema21 = ema21Series[lastIdx];
    const rsi = rsiSeries[lastIdx];
    const macd = {
      macd: macdSeries.macd[lastIdx],
      signal: macdSeries.signal[lastIdx],
      histogram: macdSeries.histogram[lastIdx],
    };
    const bollingerBands = {
      upper: bbSeries.upper[lastIdx],
      middle: bbSeries.middle[lastIdx],
      lower: bbSeries.lower[lastIdx],
      bandwidth: bbSeries.bandwidth[lastIdx],
    };
    const atr = atrSeries[lastIdx];
    const avgAtr = atrSeries.length >= 14 ? this.calculateSMA(atrSeries, 14)[lastIdx] : atr;
    const volume = curCandle.volume;
    const volumeSma20 = volSma20Series[lastIdx];

    const snapshot: IndicatorSnapshot = {
      ema9,
      ema21,
      rsi,
      macd,
      bollingerBands,
      atr,
      volume,
      volumeSma20,
    };

    const regime = this.classifyRegime(
      curCandle.close,
      ema9,
      ema21,
      rsi,
      macd.histogram,
      atr,
      avgAtr,
      bollingerBands.bandwidth
    );

    const generatedObservations: MarketObservation[] = [];
    const now = Date.now();

    // 1. Mandatory Baseline Observation: REGIME_CLASSIFICATION
    const regimeObsId = `obs_${curCandle.timestamp}_regime_${symbol.replace(/[\/\-_]/g, '')}`;
    const regimeObs: MarketObservation = {
      observationId: regimeObsId,
      symbol: symbol.toUpperCase(),
      timeframe,
      candleTimestamp: curCandle.timestamp,
      observationType: 'REGIME_CLASSIFICATION',
      observationText: `Factual: Regime assessed as ${regime} with Close=${curCandle.close.toFixed(2)}, EMA9=${ema9.toFixed(2)}, EMA21=${ema21.toFixed(2)}, RSI=${rsi.toFixed(2)}, MACD Hist=${macd.histogram.toFixed(4)}, ATR=${atr.toFixed(2)}.`,
      isFact: true,
      reasoning: `Observation heuristic: Regime state derived deterministically from indicator alignment (Close relative to EMA9/21, MACD histogram polarity, and ATR/Bollinger bandwidth).`,
      regime,
      indicatorSnapshot: snapshot,
      source,
      createdAt: now,
    };
    generatedObservations.push(this.recordObservation(regimeObs));

    // 2. Price Action Calculations
    const candleRange = curCandle.high - curCandle.low;
    const bodySize = Math.abs(curCandle.close - curCandle.open);
    const upperWick = curCandle.high - Math.max(curCandle.open, curCandle.close);
    const lowerWick = Math.min(curCandle.open, curCandle.close) - curCandle.low;

    // Price Action Heuristic: Bullish Rejection Wick
    if (candleRange > 0 && lowerWick >= HEURISTIC_THRESHOLDS.WICK_REJECTION_RATIO * Math.max(bodySize, 0.0001) && curCandle.close >= curCandle.low + 0.5 * candleRange) {
      const wickRatio = (lowerWick / candleRange) * 100;
      const obs: MarketObservation = {
        observationId: `obs_${curCandle.timestamp}_bull_wick_${symbol.replace(/[\/\-_]/g, '')}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTimestamp: curCandle.timestamp,
        observationType: 'BULLISH_REJECTION_WICK',
        observationText: `Factual: Candle formed lower rejection wick of ${lowerWick.toFixed(2)} (${wickRatio.toFixed(1)}% of candle range [${curCandle.low.toFixed(2)} - ${curCandle.high.toFixed(2)}]).`,
        isFact: true,
        reasoning: `Observation heuristic: Lower rejection wick documents price rejection at lower levels within candle duration.`,
        regime,
        indicatorSnapshot: snapshot,
        source,
        createdAt: now,
      };
      generatedObservations.push(this.recordObservation(obs));
    }

    // Price Action Heuristic: Bearish Rejection Wick
    if (candleRange > 0 && upperWick >= HEURISTIC_THRESHOLDS.WICK_REJECTION_RATIO * Math.max(bodySize, 0.0001) && curCandle.close <= curCandle.low + 0.5 * candleRange) {
      const wickRatio = (upperWick / candleRange) * 100;
      const obs: MarketObservation = {
        observationId: `obs_${curCandle.timestamp}_bear_wick_${symbol.replace(/[\/\-_]/g, '')}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTimestamp: curCandle.timestamp,
        observationType: 'BEARISH_REJECTION_WICK',
        observationText: `Factual: Candle formed upper rejection wick of ${upperWick.toFixed(2)} (${wickRatio.toFixed(1)}% of candle range [${curCandle.low.toFixed(2)} - ${curCandle.high.toFixed(2)}]).`,
        isFact: true,
        reasoning: `Observation heuristic: Upper rejection wick documents price rejection at higher levels within candle duration.`,
        regime,
        indicatorSnapshot: snapshot,
        source,
        createdAt: now,
      };
      generatedObservations.push(this.recordObservation(obs));
    }

    // Price Action Heuristic: Bullish Engulfing
    if (prevCandle && prevCandle.close < prevCandle.open && curCandle.close > curCandle.open) {
      if (curCandle.open <= prevCandle.close && curCandle.close >= prevCandle.open) {
        const obs: MarketObservation = {
          observationId: `obs_${curCandle.timestamp}_bull_engulf_${symbol.replace(/[\/\-_]/g, '')}`,
          symbol: symbol.toUpperCase(),
          timeframe,
          candleTimestamp: curCandle.timestamp,
          observationType: 'BULLISH_ENGULFING',
          observationText: `Factual: Bullish candle body [${curCandle.open.toFixed(2)} - ${curCandle.close.toFixed(2)}] completely engulfs preceding bearish body [${prevCandle.close.toFixed(2)} - ${prevCandle.open.toFixed(2)}].`,
          isFact: true,
          reasoning: `Observation heuristic: Engulfing pattern documents range expansion over prior period body.`,
          regime,
          indicatorSnapshot: snapshot,
          source,
          createdAt: now,
        };
        generatedObservations.push(this.recordObservation(obs));
      }
    }

    // Price Action Heuristic: Bearish Engulfing
    if (prevCandle && prevCandle.close > prevCandle.open && curCandle.close < curCandle.open) {
      if (curCandle.open >= prevCandle.close && curCandle.close <= prevCandle.open) {
        const obs: MarketObservation = {
          observationId: `obs_${curCandle.timestamp}_bear_engulf_${symbol.replace(/[\/\-_]/g, '')}`,
          symbol: symbol.toUpperCase(),
          timeframe,
          candleTimestamp: curCandle.timestamp,
          observationType: 'BEARISH_ENGULFING',
          observationText: `Factual: Bearish candle body [${curCandle.close.toFixed(2)} - ${curCandle.open.toFixed(2)}] completely engulfs preceding bullish body [${prevCandle.open.toFixed(2)} - ${prevCandle.close.toFixed(2)}].`,
          isFact: true,
          reasoning: `Observation heuristic: Engulfing pattern documents range expansion over prior period body.`,
          regime,
          indicatorSnapshot: snapshot,
          source,
          createdAt: now,
        };
        generatedObservations.push(this.recordObservation(obs));
      }
    }

    // Volume Anomaly Heuristic
    if (volumeSma20 > 0 && curCandle.volume >= HEURISTIC_THRESHOLDS.VOLUME_ANOMALY_MULTIPLIER * volumeSma20) {
      const volRatio = (curCandle.volume / volumeSma20).toFixed(2);
      const obs: MarketObservation = {
        observationId: `obs_${curCandle.timestamp}_vol_anomaly_${symbol.replace(/[\/\-_]/g, '')}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTimestamp: curCandle.timestamp,
        observationType: 'VOLUME_ANOMALY',
        observationText: `Factual: Candle volume ${curCandle.volume.toFixed(2)} is ${volRatio}x the 20-period volume SMA (${volumeSma20.toFixed(2)}).`,
        isFact: true,
        reasoning: `Observation heuristic: Volume expansion indicates abnormal trading participation relative to recent baseline.`,
        regime,
        indicatorSnapshot: snapshot,
        source,
        createdAt: now,
      };
      generatedObservations.push(this.recordObservation(obs));
    }

    // Breakout Heuristic
    if (curCandle.close > bollingerBands.upper || curCandle.close < bollingerBands.lower) {
      const direction = curCandle.close > bollingerBands.upper ? 'upper' : 'lower';
      const boundPrice = direction === 'upper' ? bollingerBands.upper : bollingerBands.lower;
      const obs: MarketObservation = {
        observationId: `obs_${curCandle.timestamp}_breakout_${symbol.replace(/[\/\-_]/g, '')}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTimestamp: curCandle.timestamp,
        observationType: 'POSSIBLE_BREAKOUT',
        observationText: `Factual: Candle close ${curCandle.close.toFixed(2)} crossed beyond Bollinger Band ${direction} boundary (${boundPrice.toFixed(2)}).`,
        isFact: true,
        reasoning: `Observation heuristic: Price closing outside Bollinger Band documents standard deviation expansion.`,
        regime,
        indicatorSnapshot: snapshot,
        source,
        createdAt: now,
      };
      generatedObservations.push(this.recordObservation(obs));
    }

    // Rejection Heuristic
    if ((curCandle.high > bollingerBands.upper && curCandle.close <= bollingerBands.upper) ||
        (curCandle.low < bollingerBands.lower && curCandle.close >= bollingerBands.lower)) {
      const boundary = curCandle.high > bollingerBands.upper ? 'upper' : 'lower';
      const obs: MarketObservation = {
        observationId: `obs_${curCandle.timestamp}_rejection_${symbol.replace(/[\/\-_]/g, '')}`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTimestamp: curCandle.timestamp,
        observationType: 'POSSIBLE_REJECTION',
        observationText: `Factual: Price pierced Bollinger Band ${boundary} boundary but closed back inside band range.`,
        isFact: true,
        reasoning: `Observation heuristic: Piercing boundary followed by close inside documents failure to sustain external price levels.`,
        regime,
        indicatorSnapshot: snapshot,
        source,
        createdAt: now,
      };
      generatedObservations.push(this.recordObservation(obs));
    }

    // Compatibility update with existing market memory DB if notable pattern observed
    this.syncWithMarketMemory(symbol, timeframe, regime, curCandle, generatedObservations);

    return generatedObservations;
  }

  /**
   * Records observation with strict deduplication by composite key:
   * symbol + timeframe + candleTimestamp + observationType
   */
  public recordObservation(observation: MarketObservation): MarketObservation {
    const key = this.getCompositeKey(
      observation.symbol,
      observation.timeframe,
      observation.candleTimestamp,
      observation.observationType
    );

    const existing = this.observations.get(key);
    if (existing) {
      return existing; // Exact deduplication match: return existing without mutating
    }

    this.observations.set(key, observation);
    this.saveToStorage();
    return observation;
  }

  /**
   * Compatibility bridge with existing market_memory_db.json
   */
  private syncWithMarketMemory(
    symbol: string,
    timeframe: string,
    regime: MarketRegime,
    candle: CandleData,
    observations: MarketObservation[]
  ): void {
    try {
      const patternObs = observations.find((o) => o.observationType !== 'REGIME_CLASSIFICATION');
      if (!patternObs) return;

      const setupName = patternObs.observationType.replace(/_/g, ' ');
      memoryService.recordMarketObservation({
        symbol: symbol.toUpperCase(),
        market: 'CRYPTO',
        timeframe,
        setup: setupName,
        marketCondition: regime,
        candleContext: `Candle at ${new Date(candle.timestamp).toISOString()}: O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} V=${candle.volume}`,
        technicalContext: `RSI=${patternObs.indicatorSnapshot.rsi.toFixed(1)}, MACD Hist=${patternObs.indicatorSnapshot.macd.histogram.toFixed(4)}, ATR=${patternObs.indicatorSnapshot.atr.toFixed(2)}`,
        outcome: 'DRAW', // Neutral observation outcome (not evaluated trade)
        evidenceReferences: [
          `Observation ID: ${patternObs.observationId}`,
          `Candle Timestamp: ${candle.timestamp}`,
          `Source: ${patternObs.source}`,
        ],
      });
    } catch (err) {
      // Non-fatal sync
      console.warn('[MarketObserverService] Non-fatal syncWithMarketMemory warning:', err);
    }
  }

  /**
   * Direct Binance REST fetcher reusing standard endpoints
   */
  public async fetchAndObserveBinance(
    symbol: string,
    timeframe: string = '1m',
    limit: number = 60
  ): Promise<MarketObservation[]> {
    const cleanSymbol = symbol.replace(/[\/\-_]/g, '').toUpperCase();
    const interval = timeframe;
    const endpoints = [
      `https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${Math.min(limit, 500)}`,
      `https://data-api.binance.vision/api/v3/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${Math.min(limit, 500)}`,
    ];

    let rawKlines: any[] | null = null;
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          rawKlines = await res.json();
          if (Array.isArray(rawKlines) && rawKlines.length > 0) break;
        }
      } catch (err) {
        // Try fallback mirror
      }
    }

    if (!rawKlines || !Array.isArray(rawKlines) || rawKlines.length === 0) {
      throw new Error(`Failed to fetch Binance klines for ${symbol} on ${timeframe}`);
    }

    const candles: CandleData[] = rawKlines.map((item) => ({
      timestamp: Number(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));

    return this.observeCandles(symbol, timeframe, candles, 'BINANCE_REST');
  }

  // =========================================================================
  // Query & Summary Endpoints
  // =========================================================================

  public getRecentObservations(
    limit: number = 50,
    filter?: {
      symbol?: string;
      timeframe?: string;
      regime?: MarketRegime;
      observationType?: ObservationType;
    }
  ): MarketObservation[] {
    let list = Array.from(this.observations.values());

    if (filter?.symbol) {
      const s = filter.symbol.toUpperCase();
      list = list.filter((o) => o.symbol === s);
    }
    if (filter?.timeframe) {
      list = list.filter((o) => o.timeframe === filter.timeframe);
    }
    if (filter?.regime) {
      list = list.filter((o) => o.regime === filter.regime);
    }
    if (filter?.observationType) {
      list = list.filter((o) => o.observationType === filter.observationType);
    }

    return list.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  public getRegimeSummary(): RegimeSummaryItem[] {
    const symbolMap: Map<string, MarketObservation[]> = new Map();

    for (const obs of this.observations.values()) {
      const key = `${obs.symbol}::${obs.timeframe}`;
      const group = symbolMap.get(key) || [];
      group.push(obs);
      symbolMap.set(key, group);
    }

    const summary: RegimeSummaryItem[] = [];
    for (const [key, obsList] of symbolMap.entries()) {
      const [symbol, timeframe] = key.split('::');
      obsList.sort((a, b) => b.candleTimestamp - a.candleTimestamp);
      const latest = obsList[0];

      const typeCounts: Record<string, number> = {};
      obsList.forEach((o) => {
        typeCounts[o.observationType] = (typeCounts[o.observationType] || 0) + 1;
      });

      const dominant = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => `${type} (${count})`);

      summary.push({
        symbol,
        timeframe,
        regime: latest.regime,
        lastUpdated: latest.candleTimestamp,
        latestPrice: latest.indicatorSnapshot.ema9, // Recent reference price
        indicators: {
          ema9: latest.indicatorSnapshot.ema9,
          ema21: latest.indicatorSnapshot.ema21,
          rsi: latest.indicatorSnapshot.rsi,
          macdHistogram: latest.indicatorSnapshot.macd.histogram,
          atr: latest.indicatorSnapshot.atr,
          volumeRatio:
            latest.indicatorSnapshot.volumeSma20 > 0
              ? latest.indicatorSnapshot.volume / latest.indicatorSnapshot.volumeSma20
              : 1,
        },
        observationCount: obsList.length,
        dominantObservations: dominant,
      });
    }

    return summary.sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  public getStats(): {
    totalObservations: number;
    trackedSymbols: number;
    byRegime: Record<MarketRegime, number>;
    byType: Record<ObservationType, number>;
  } {
    const byRegime: Record<MarketRegime, number> = {
      TRENDING_BULLISH: 0,
      TRENDING_BEARISH: 0,
      RANGING_CONSOLIDATION: 0,
      HIGH_VOLATILITY: 0,
      LOW_VOLATILITY: 0,
      UNCERTAIN: 0,
    };

    const byType: Record<ObservationType, number> = {
      REGIME_CLASSIFICATION: 0,
      BULLISH_REJECTION_WICK: 0,
      BEARISH_REJECTION_WICK: 0,
      BULLISH_ENGULFING: 0,
      BEARISH_ENGULFING: 0,
      VOLUME_ANOMALY: 0,
      POSSIBLE_BREAKOUT: 0,
      POSSIBLE_REJECTION: 0,
      VOLATILITY_STATE: 0,
    };

    const symbols = new Set<string>();
    for (const o of this.observations.values()) {
      symbols.add(o.symbol);
      if (byRegime[o.regime] !== undefined) byRegime[o.regime]++;
      if (byType[o.observationType] !== undefined) byType[o.observationType]++;
    }

    return {
      totalObservations: this.observations.size,
      trackedSymbols: symbols.size,
      byRegime,
      byType,
    };
  }
}

export const marketObserverService = MarketObserverService.getInstance();
