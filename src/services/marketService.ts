import { Candle, Signal, TimeframeKey } from '../types';
import {
  MarketDataProvider,
  MarketDataSourceMode,
  MockMarketDataProvider,
  getAssetInfo,
} from '../data/marketDataProvider';
import { BinanceMarketDataProvider } from '../data/binanceMarketDataProvider';
import { BybitMarketDataProvider } from '../data/bybitMarketDataProvider';
import { OkxMarketDataProvider } from '../data/okxMarketDataProvider';
import { KrakenMarketDataProvider } from '../data/krakenMarketDataProvider';
import { CoinbaseMarketDataProvider } from '../data/coinbaseMarketDataProvider';
import { generateSignal } from '../strategy/signalEngine';
import { evaluatePendingSignals } from '../strategy/signalEvaluator';

const STORAGE_KEY_SIGNALS = 'tradepulse_signal_history_v1';
const STORAGE_KEY_PROVIDER = 'tradepulse_provider_mode_v1';

export class MarketService {
  private static instance: MarketService;
  private currentSymbol: string = 'BTC/USDT';
  private currentTimeframe: TimeframeKey = '1m';
  private candles: Candle[] = [];
  private activeSignal: Signal | null = null;
  private signalHistory: Signal[] = [];
  private listeners: Set<() => void> = new Set();
  private isScanning: boolean = false;

  private providerMode: MarketDataSourceMode = 'BINANCE';
  private binanceProvider = new BinanceMarketDataProvider();
  private bybitProvider = new BybitMarketDataProvider();
  private okxProvider = new OkxMarketDataProvider();
  private krakenProvider = new KrakenMarketDataProvider();
  private coinbaseProvider = new CoinbaseMarketDataProvider();
  private mockProvider = new MockMarketDataProvider();
  private liveUnsubscribe: (() => void) | null = null;

  private constructor() {
    // Read persisted provider mode preference if available
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY_PROVIDER) as MarketDataSourceMode | null;
      if (
        savedMode &&
        ['BINANCE', 'BYBIT', 'OKX', 'KRAKEN', 'COINBASE', 'MOCK'].includes(savedMode)
      ) {
        this.providerMode = savedMode;
      }
    } catch {
      this.providerMode = 'BINANCE';
    }

    this.loadHistoryFromStorage();
    this.setupVisibilityListener();
    // Initialize initial seed
    this.init(this.currentSymbol, this.currentTimeframe);
  }

  public static getInstance(): MarketService {
    if (!MarketService.instance) {
      MarketService.instance = new MarketService();
    }
    return MarketService.instance;
  }

  public getActiveProvider(): MarketDataProvider {
    switch (this.providerMode) {
      case 'BINANCE':
        return this.binanceProvider;
      case 'BYBIT':
        return this.bybitProvider;
      case 'OKX':
        return this.okxProvider;
      case 'KRAKEN':
        return this.krakenProvider;
      case 'COINBASE':
        return this.coinbaseProvider;
      case 'MOCK':
      default:
        return this.mockProvider;
    }
  }

  public getProviderMode(): MarketDataSourceMode {
    return this.providerMode;
  }

  public async setProviderMode(mode: MarketDataSourceMode): Promise<void> {
    if (this.providerMode === mode) return;
    this.providerMode = mode;
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDER, mode);
    } catch {
      // Ignore
    }

    await this.init(this.currentSymbol, this.currentTimeframe);
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
    const now = Date.now();
    const seeds: Signal[] = [
      {
        id: 'seed_1',
        symbol: 'BTC/USDT',
        timeframe: '1m',
        direction: 'CALL',
        signalStrength: 84,
        confidenceScore: 80,
        scoreRatio: '4/5',
        entryPrice: 67840.50,
        exitPrice: 67895.00,
        signalTime: now - 12 * 60 * 1000,
        expiryTime: now - 11 * 60 * 1000,
        expiryCandles: 1,
        result: 'WIN',
        indicators: {
          ema9: 67845.00,
          ema21: 67810.00,
          rsi: 58.4,
          macd: { macd: 12.5, signal: 8.2, histogram: 4.3 },
          bollingerBands: { upper: 67920, middle: 67830, lower: 67740 },
          atr: 45.2,
        },
        reasons: ['EMA 9 > EMA 21 (Bullish Trend)', 'RSI 14 at 58.4 (> 50 Bullish)', 'Price above EMA 21 Support'],
      },
      {
        id: 'seed_2',
        symbol: 'ETH/USDT',
        timeframe: '1m',
        direction: 'PUT',
        signalStrength: 92,
        confidenceScore: 100,
        scoreRatio: '5/5',
        entryPrice: 3485.50,
        exitPrice: 3479.20,
        signalTime: now - 8 * 60 * 1000,
        expiryTime: now - 7 * 60 * 1000,
        expiryCandles: 1,
        result: 'WIN',
        indicators: {
          ema9: 3482.00,
          ema21: 3489.00,
          rsi: 42.1,
          macd: { macd: -3.2, signal: -1.8, histogram: -1.4 },
          bollingerBands: { upper: 3495, middle: 3485, lower: 3475 },
          atr: 6.8,
        },
        reasons: ['EMA 9 < EMA 21 (Bearish Trend)', 'RSI 14 at 42.1 (< 50 Bearish)', 'MACD Bearish crossover'],
      },
    ];
    this.signalHistory = seeds;
    this.saveHistoryToStorage();
  }

  public async init(symbol: string = this.currentSymbol, timeframe: TimeframeKey = this.currentTimeframe): Promise<void> {
    this.currentSymbol = symbol;
    this.currentTimeframe = timeframe;
    this.stopLiveFeed();

    // Historical seed retrieval
    const provider = this.getActiveProvider();
    try {
      this.candles = await provider.getCandles(symbol, timeframe, 100);
    } catch (err) {
      console.error('Failed to get candles from provider:', err);
      this.candles = this.mockProvider.generateHistoricalCandles(symbol, timeframe, 100);
    }

    this.evaluateFormingSignal();
    this.startLiveFeed();
    this.notify();
  }

  public async setSymbol(symbol: string): Promise<void> {
    if (this.currentSymbol === symbol) return;
    this.currentSymbol = symbol;
    this.stopLiveFeed();

    const provider = this.getActiveProvider();
    try {
      this.candles = await provider.getCandles(symbol, this.currentTimeframe, 100);
    } catch {
      this.candles = this.mockProvider.generateHistoricalCandles(symbol, this.currentTimeframe, 100);
    }

    this.evaluateFormingSignal();
    this.startLiveFeed();
    this.notify();
  }

  public async setTimeframe(timeframe: TimeframeKey): Promise<void> {
    if (this.currentTimeframe === timeframe) return;
    this.currentTimeframe = timeframe;
    this.stopLiveFeed();

    const provider = this.getActiveProvider();
    try {
      this.candles = await provider.getCandles(this.currentSymbol, timeframe, 100);
    } catch {
      this.candles = this.mockProvider.generateHistoricalCandles(this.currentSymbol, timeframe, 100);
    }

    this.evaluateFormingSignal();
    this.startLiveFeed();
    this.notify();
  }

  /**
   * Starts live subscription via common MarketDataProvider interface
   */
  public startLiveFeed(): void {
    if (this.liveUnsubscribe) {
      this.liveUnsubscribe();
      this.liveUnsubscribe = null;
    }

    const provider = this.getActiveProvider();
    this.liveUnsubscribe = provider.subscribeLive(
      this.currentSymbol,
      this.currentTimeframe,
      (candle: Candle, isClosed: boolean) => {
        this.handleLiveCandleUpdate(candle, isClosed);
      }
    );
  }

  public stopLiveFeed(): void {
    if (this.liveUnsubscribe) {
      this.liveUnsubscribe();
      this.liveUnsubscribe = null;
    }
  }

  /**
   * Reconciles incoming candle updates with strict integrity and repainting guards
   */
  private handleLiveCandleUpdate(candle: Candle, isClosed: boolean): void {
    if (!candle) return;

    if (this.candles.length === 0) {
      this.candles.push(candle);
    } else {
      const lastCandle = this.candles[this.candles.length - 1];

      if (lastCandle.timestamp === candle.timestamp) {
        // Update existing candle in-place without duplicating
        lastCandle.open = candle.open;
        lastCandle.high = candle.high;
        lastCandle.low = candle.low;
        lastCandle.close = candle.close;
        lastCandle.volume = candle.volume;
      } else if (candle.timestamp > lastCandle.timestamp) {
        // Official new candle started
        this.candles.push(candle);
        if (this.candles.length > 300) {
          this.candles.shift();
        }
      }
    }

    // SIGNAL TIMING & REPAINTING PREVENTION:
    if (isClosed) {
      // 1. Resolve any pending signals whose expiry has passed
      const evalResult = evaluatePendingSignals(this.signalHistory, this.candles);
      if (evalResult.resolvedCount > 0) {
        this.signalHistory = evalResult.updatedSignals;
        this.saveHistoryToStorage();
      }

      // 2. Generate OFFICIAL CONFIRMED SIGNAL only from closed candle
      this.evaluateConfirmedSignal();
    } else {
      // 3. Forming update: update live indicator changes and visual preview without recording to history
      this.evaluateFormingSignal();
    }

    this.notify();
  }

  /**
   * Live preview on forming candle (does NOT enter history)
   */
  private evaluateFormingSignal(): void {
    if (this.candles.length < 25) return;
    const signal = generateSignal(this.currentSymbol, this.currentTimeframe, this.candles);
    if (signal) {
      this.activeSignal = signal;
    }
  }

  /**
   * Official evaluation on candle close (enters history if CALL/PUT)
   */
  private evaluateConfirmedSignal(): void {
    if (this.candles.length < 25) return;

    const signal = generateSignal(this.currentSymbol, this.currentTimeframe, this.candles);
    if (!signal) return;

    this.activeSignal = signal;

    if (signal.direction === 'CALL' || signal.direction === 'PUT') {
      const lastHistory = this.signalHistory[0];
      const isDuplicate =
        lastHistory &&
        lastHistory.symbol === signal.symbol &&
        lastHistory.timeframe === signal.timeframe &&
        Math.abs(lastHistory.signalTime - signal.signalTime) < 30000;

      if (!isDuplicate) {
        this.signalHistory.unshift(signal);
        if (this.signalHistory.length > 100) {
          this.signalHistory.pop();
        }
        this.saveHistoryToStorage();
      }
    }
  }

  /**
   * Reconciles candles when tab becomes visible after background throttle
   */
  public async reconcileCandles(): Promise<void> {
    try {
      const fresh = await this.getActiveProvider().getCandles(this.currentSymbol, this.currentTimeframe, 50);
      if (fresh && fresh.length > 0) {
        const map = new Map<number, Candle>();
        this.candles.forEach((c) => map.set(c.timestamp, c));
        fresh.forEach((c) => map.set(c.timestamp, c));

        this.candles = Array.from(map.values())
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-300);

        this.evaluateFormingSignal();
        this.notify();
      }
    } catch (err) {
      console.warn('Reconcile failed:', err);
    }
  }

  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.reconcileCandles();
        }
      });
    }
  }

  public triggerManualScan(): void {
    this.isScanning = true;
    this.notify();
    setTimeout(() => {
      this.evaluateFormingSignal();
      this.isScanning = false;
      this.notify();
    }, 400);
  }

  /**
   * Safe forward candle advancement (for testing / demo mode)
   */
  public advanceCandle(): void {
    if (this.providerMode === 'MOCK') {
      this.candles = this.mockProvider.advanceNextCandle(this.currentSymbol, this.currentTimeframe);
      const evalResult = evaluatePendingSignals(this.signalHistory, this.candles);
      if (evalResult.resolvedCount > 0) {
        this.signalHistory = evalResult.updatedSignals;
        this.saveHistoryToStorage();
      }
      this.evaluateConfirmedSignal();
      this.notify();
    } else {
      // In Binance live mode, trigger instant sync/scan
      this.reconcileCandles();
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
