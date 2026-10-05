import { Candle, Signal, TimeframeKey, AssetInfo } from '../types';
import { defaultMarketProvider, getAssetInfo } from '../data/marketDataProvider';
import { generateSignal } from '../strategy/signalEngine';
import { evaluatePendingSignals } from '../strategy/signalEvaluator';

const STORAGE_KEY_SIGNALS = 'tradepulse_signal_history_v1';

export class MarketService {
  private static instance: MarketService;
  private currentSymbol: string = 'EUR/USD';
  private currentTimeframe: TimeframeKey = '1m';
  private candles: Candle[] = [];
  private activeSignal: Signal | null = null;
  private signalHistory: Signal[] = [];
  private listeners: Set<() => void> = new Set();
  private tickInterval: number | null = null;
  private isScanning: boolean = false;

  private constructor() {
    this.candles = defaultMarketProvider.generateHistoricalCandles(this.currentSymbol, this.currentTimeframe, 100);
    this.loadHistoryFromStorage();
    this.evaluateSignals();
  }

  public static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private loadHistoryFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIGNALS);
      if (saved) {
        this.signalHistory = JSON.parse(saved);
      } else {
        this.seedInitialHistory();
      }
    } catch {
      this.seedInitialHistory();
    }
  }

  private saveHistoryToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_SIGNALS, JSON.stringify(this.signalHistory.slice(-100)));
    } catch {
      // Ignore storage quota errors
    }
  }

  private seedInitialHistory(): void {
    // Generate a few realistic seed historical signals for initial presentation
    const asset = getAssetInfo('EUR/USD');
    const now = Date.now();
    const seeds: Signal[] = [
      {
        id: 'seed_1',
        symbol: 'EUR/USD',
        timeframe: '1m',
        direction: 'CALL',
        signalStrength: 84,
        confidenceScore: 80,
        scoreRatio: '4/5',
        entryPrice: 1.08412,
        exitPrice: 1.08434,
        signalTime: now - 12 * 60 * 1000,
        expiryTime: now - 11 * 60 * 1000,
        expiryCandles: 1,
        result: 'WIN',
        indicators: {
          ema9: 1.08410,
          ema21: 1.08395,
          rsi: 58.4,
          macd: { macd: 0.00012, signal: 0.00008, histogram: 0.00004 },
          bollingerBands: { upper: 1.08440, middle: 1.08405, lower: 1.08370 },
          atr: 0.00018,
        },
        reasons: ['EMA 9 > EMA 21 (Bullish Trend)', 'RSI 14 at 58.4 (> 50 Bullish)', 'Price above EMA 21 Support'],
      },
      {
        id: 'seed_2',
        symbol: 'GBP/USD',
        timeframe: '1m',
        direction: 'PUT',
        signalStrength: 92,
        confidenceScore: 100,
        scoreRatio: '5/5',
        entryPrice: 1.27245,
        exitPrice: 1.27218,
        signalTime: now - 8 * 60 * 1000,
        expiryTime: now - 7 * 60 * 1000,
        expiryCandles: 1,
        result: 'WIN',
        indicators: {
          ema9: 1.27240,
          ema21: 1.27265,
          rsi: 42.1,
          macd: { macd: -0.00015, signal: -0.00009, histogram: -0.00006 },
          bollingerBands: { upper: 1.27290, middle: 1.27250, lower: 1.27210 },
          atr: 0.00022,
        },
        reasons: ['EMA 9 < EMA 21 (Bearish Trend)', 'RSI 14 at 42.1 (< 50 Bearish)', 'MACD Bearish crossover'],
      },
      {
        id: 'seed_3',
        symbol: 'EUR/USD',
        timeframe: '1m',
        direction: 'PUT',
        signalStrength: 75,
        confidenceScore: 80,
        scoreRatio: '4/5',
        entryPrice: 1.08420,
        exitPrice: 1.08426,
        signalTime: now - 4 * 60 * 1000,
        expiryTime: now - 3 * 60 * 1000,
        expiryCandles: 1,
        result: 'LOSS',
        indicators: {
          ema9: 1.08418,
          ema21: 1.08430,
          rsi: 48.0,
          macd: { macd: -0.00004, signal: -0.00002, histogram: -0.00002 },
          bollingerBands: { upper: 1.08450, middle: 1.08425, lower: 1.08400 },
          atr: 0.00016,
        },
        reasons: ['EMA 9 < EMA 21', 'RSI 14 at 48.0', 'Bearish Candle Confirmation'],
      },
    ];
    this.signalHistory = seeds;
    this.saveHistoryToStorage();
  }

  public async init(symbol: string = 'EUR/USD', timeframe: TimeframeKey = '1m'): Promise<void> {
    this.currentSymbol = symbol;
    this.currentTimeframe = timeframe;
    this.candles = await defaultMarketProvider.getCandles(symbol, timeframe, 100);
    this.evaluateSignals();
    this.startLiveFeed();
    this.notify();
  }

  public async setSymbol(symbol: string): Promise<void> {
    if (this.currentSymbol === symbol) return;
    this.currentSymbol = symbol;
    this.candles = await defaultMarketProvider.getCandles(symbol, this.currentTimeframe, 100);
    this.evaluateSignals();
    this.notify();
  }

  public async setTimeframe(timeframe: TimeframeKey): Promise<void> {
    if (this.currentTimeframe === timeframe) return;
    this.currentTimeframe = timeframe;
    this.candles = await defaultMarketProvider.getCandles(this.currentSymbol, timeframe, 100);
    this.evaluateSignals();
    this.notify();
  }

  public startLiveFeed(): void {
    if (this.tickInterval) return;

    this.tickInterval = window.setInterval(() => {
      this.isScanning = true;
      const { candles, isNewCandle } = defaultMarketProvider.simulateTick(this.currentSymbol, this.currentTimeframe);
      this.candles = candles;

      // Check pending signals against latest price
      const evalResult = evaluatePendingSignals(this.signalHistory, candles);
      if (evalResult.resolvedCount > 0) {
        this.signalHistory = evalResult.updatedSignals;
        this.saveHistoryToStorage();
      }

      if (isNewCandle) {
        this.evaluateSignals();
      } else {
        // Soft indicator scan on current candle
        const sig = generateSignal(this.currentSymbol, this.currentTimeframe, this.candles);
        if (sig) {
          this.activeSignal = sig;
        }
      }

      setTimeout(() => {
        this.isScanning = false;
        this.notify();
      }, 350);

      this.notify();
    }, 1500);
  }

  public stopLiveFeed(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  public triggerManualScan(): void {
    this.isScanning = true;
    this.notify();
    setTimeout(() => {
      this.evaluateSignals();
      this.isScanning = false;
      this.notify();
    }, 600);
  }

  public advanceCandle(): void {
    this.candles = defaultMarketProvider.advanceNextCandle(this.currentSymbol, this.currentTimeframe);
    const evalResult = evaluatePendingSignals(this.signalHistory, this.candles);
    if (evalResult.resolvedCount > 0) {
      this.signalHistory = evalResult.updatedSignals;
      this.saveHistoryToStorage();
    }
    this.evaluateSignals();
    this.notify();
  }

  private evaluateSignals(): void {
    if (this.candles.length < 25) return;

    const signal = generateSignal(this.currentSymbol, this.currentTimeframe, this.candles);
    if (!signal) return;

    this.activeSignal = signal;

    // If signal is actionable CALL or PUT, save to signal history if not duplicate of last signal
    if (signal.direction === 'CALL' || signal.direction === 'PUT') {
      const lastHistory = this.signalHistory[0];
      const isDuplicate =
        lastHistory &&
        lastHistory.symbol === signal.symbol &&
        lastHistory.timeframe === signal.timeframe &&
        Math.abs(lastHistory.signalTime - signal.signalTime) < 30000;

      if (!isDuplicate) {
        this.signalHistory.unshift(signal);
        // Limit history to 100 items
        if (this.signalHistory.length > 100) {
          this.signalHistory.pop();
        }
        this.saveHistoryToStorage();
      }
    }
  }

  public clearHistory(): void {
    this.signalHistory = [];
    this.saveHistoryToStorage();
    this.notify();
  }

  // Getters
  public getSymbol(): string {
    return this.currentSymbol;
  }

  public getTimeframe(): TimeframeKey {
    return this.currentTimeframe;
  }

  public getCandles(): Candle[] {
    return this.candles;
  }

  public getActiveSignal(): Signal | null {
    return this.activeSignal;
  }

  public getSignalHistory(): Signal[] {
    return this.signalHistory;
  }

  public getIsScanning(): boolean {
    return this.isScanning;
  }
}

export const marketService = MarketService.getInstance();
