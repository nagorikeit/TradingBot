import { Candle, TimeframeKey, ScannerSignal, MonitoredPairStatus, IndicatorValues } from '../types';
import { BinanceMarketDataProvider } from '../data/binanceMarketDataProvider';
import { getAssetInfo, getTimeframeMs } from '../data/marketDataProvider';
import { computeIndicators } from '../indicators';
import { evaluateStrategyRules } from '../strategy/signalEngine';

export const DEFAULT_SCANNER_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'XRP/USDT',
  'DOGE/USDT',
  'ADA/USDT',
  'AVAX/USDT',
  'LINK/USDT',
  'TRX/USDT',
];

const STORAGE_KEY_SCANNER_SIGNALS = 'tradepulse_scanner_signals_v1';

interface SymbolWorker {
  symbol: string;
  candles: Candle[];
  provider: BinanceMarketDataProvider;
  unsubscribe: (() => void) | null;
  isConnected: boolean;
  lastUpdated: number;
  cachedStatus?: MonitoredPairStatus;
}

export class ScannerService {
  private static instance: ScannerService;

  private isRunning: boolean = false;
  private currentTimeframe: TimeframeKey = '1m';
  private monitoredSymbols: string[] = [...DEFAULT_SCANNER_SYMBOLS];
  private workers: Map<string, SymbolWorker> = new Map();
  private processedCandles: Set<string> = new Set();
  private qualifiedSignals: ScannerSignal[] = [];
  private listeners: Set<() => void> = new Set();
  private visibilityListenerAttached: boolean = false;
  private notifyTimeout: any = null;

  private constructor() {
    this.loadSignalsFromStorage();
    this.setupVisibilityListener();
  }

  public static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Throttled UI notification to prevent React render thrashing on high-frequency ticks
   */
  private notify(immediate: boolean = false): void {
    if (immediate) {
      if (this.notifyTimeout) {
        clearTimeout(this.notifyTimeout);
        this.notifyTimeout = null;
      }
      this.listeners.forEach((l) => l());
      return;
    }

    if (!this.notifyTimeout) {
      this.notifyTimeout = setTimeout(() => {
        this.notifyTimeout = null;
        this.listeners.forEach((l) => l());
      }, 200);
    }
  }

  private loadSignalsFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCANNER_SIGNALS);
      if (saved) {
        this.qualifiedSignals = JSON.parse(saved);
        // Pre-populate processed candles set to prevent duplicates across refreshes
        this.qualifiedSignals.forEach((sig) => {
          this.processedCandles.add(`${sig.symbol}_${sig.timeframe}_${sig.candleTimestamp}`);
        });
      }
    } catch {
      this.qualifiedSignals = [];
    }
  }

  private saveSignalsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY_SCANNER_SIGNALS, JSON.stringify(this.qualifiedSignals.slice(0, 50)));
    } catch {
      // Ignore quota exceptions
    }
  }

  /**
   * Starts multi-asset background scanning
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.notify();

    // Initialize all workers
    const initPromises = this.monitoredSymbols.map((sym) => this.initWorker(sym));
    await Promise.allSettled(initPromises);
    this.notify();
  }

  /**
   * Stops scanner and cleans up all active WebSocket connections
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    // Clean up all individual socket subscriptions
    this.workers.forEach((worker) => {
      if (worker.unsubscribe) {
        worker.unsubscribe();
        worker.unsubscribe = null;
      }
      worker.isConnected = false;
    });

    this.notify();
  }

  /**
   * Sets scanner timeframe (cleans up old streams and reconnects)
   */
  public async setTimeframe(timeframe: TimeframeKey): Promise<void> {
    if (this.currentTimeframe === timeframe) return;
    this.currentTimeframe = timeframe;

    if (this.isRunning) {
      // Stop existing streams
      this.workers.forEach((w) => {
        if (w.unsubscribe) {
          w.unsubscribe();
          w.unsubscribe = null;
        }
      });

      // Re-seed and re-subscribe for the new timeframe
      const reinitPromises = this.monitoredSymbols.map((sym) => this.initWorker(sym));
      await Promise.allSettled(reinitPromises);
    }

    this.notify();
  }

  /**
   * Initializes or re-initializes a single symbol worker
   */
  private async initWorker(symbol: string): Promise<void> {
    let worker = this.workers.get(symbol);
    if (!worker) {
      worker = {
        symbol,
        candles: [],
        provider: new BinanceMarketDataProvider(),
        unsubscribe: null,
        isConnected: false,
        lastUpdated: Date.now(),
      };
      this.workers.set(symbol, worker);
    }

    // Clean up any existing socket for this worker
    if (worker.unsubscribe) {
      worker.unsubscribe();
      worker.unsubscribe = null;
    }

    // Step 1: Historical seed retrieval
    try {
      const candles = await worker.provider.getCandles(symbol, this.currentTimeframe, 60);
      worker.candles = candles;
      worker.isConnected = true;
      worker.lastUpdated = Date.now();

      // Immediate seed evaluation: Evaluate the most recently closed candle from historical seed
      if (worker.candles.length >= 26) {
        const closedCandlesSlice = worker.candles.slice(0, -1);
        this.evaluateClosedCandleForSignal(symbol, closedCandlesSlice);
      }
      this.updateWorkerStatus(worker);
    } catch (err) {
      console.warn(`Historical seed fetch failed for ${symbol}:`, err);
      worker.isConnected = false;
    }

    // Safeguard 2: Async race-condition guard - do not connect WebSocket if stopped during getCandles()
    if (!this.isRunning) return;

    // Step 2: Independent live WebSocket subscription
    try {
      worker.unsubscribe = worker.provider.subscribeLive(
        symbol,
        this.currentTimeframe,
        (candle: Candle, isClosed: boolean) => {
          this.handleWorkerCandle(symbol, candle, isClosed);
        }
      );
      worker.isConnected = true;
      this.updateWorkerStatus(worker);
    } catch (err) {
      console.error(`WebSocket subscription failed for ${symbol}:`, err);
      worker.isConnected = false;
    }
  }

  /**
   * Updates cached pair status for an individual worker to prevent whole-grid indicator recalculation
   */
  private updateWorkerStatus(worker: SymbolWorker): void {
    const asset = getAssetInfo(worker.symbol);
    const candles = worker.candles;
    const latest = candles.length > 0 ? candles[candles.length - 1] : null;

    let currentDirection: 'CALL' | 'PUT' | 'WAIT' = 'WAIT';
    let currentScore = 0;

    if (candles.length >= 25) {
      const indicators = computeIndicators(candles);
      if (indicators) {
        const evalRes = evaluateStrategyRules(candles, indicators, asset.pipDecimals);
        currentDirection = evalRes.direction;
        currentScore = evalRes.score;
      }
    }

    worker.cachedStatus = {
      symbol: worker.symbol,
      name: asset.name,
      price: latest ? latest.close : asset.basePrice,
      currentDirection,
      currentScore,
      candleCount: candles.length,
      isConnected: Boolean(worker.isConnected),
      lastUpdated: worker.lastUpdated,
    };
  }

  /**
   * Handles live candle ticks from an individual symbol's stream
   * Strict integrity: in-place forming updates, confirmed signal ONLY upon candle close
   */
  private handleWorkerCandle(symbol: string, candle: Candle, isClosed: boolean): void {
    // Safeguard 1: Stale callback guard - ignore in-flight events if scanner is stopped
    if (!this.isRunning) return;

    const worker = this.workers.get(symbol);
    if (!worker) return;

    worker.isConnected = true;
    worker.lastUpdated = Date.now();

    const candles = worker.candles;
    if (candles.length === 0) {
      candles.push(candle);
    } else {
      const last = candles[candles.length - 1];
      if (last.timestamp === candle.timestamp) {
        // In-place forming update
        last.open = candle.open;
        last.high = candle.high;
        last.low = candle.low;
        last.close = candle.close;
        last.volume = candle.volume;
      } else if (candle.timestamp > last.timestamp) {
        // New candle started
        candles.push(candle);
        if (candles.length > 250) {
          candles.shift();
        }
      }
    }

    // CRITICAL: Only evaluate confirmed scanner signals when Binance confirms candle close!
    if (isClosed) {
      this.evaluateClosedCandleForSignal(symbol, worker.candles);
    }

    this.updateWorkerStatus(worker);
    // Immediate notify on candle close, throttled on regular high-frequency forming ticks
    this.notify(isClosed);
  }

  /**
   * Evaluates closed candle series against existing strategy rules
   * 5/5 -> STRONG, 4/5 -> QUALIFIED, <= 3/5 -> IGNORED
   */
  private evaluateClosedCandleForSignal(symbol: string, candles: Candle[]): void {
    if (candles.length < 25) return;

    const indicators: IndicatorValues | null = computeIndicators(candles);
    if (!indicators) return;

    const asset = getAssetInfo(symbol);
    const evalResult = evaluateStrategyRules(candles, indicators, asset.pipDecimals);

    // Filter threshold: Must be CALL or PUT and score must be >= 4
    if ((evalResult.direction === 'CALL' || evalResult.direction === 'PUT') && evalResult.score >= 4) {
      const closedCandle = candles[candles.length - 1];
      const candleTimestamp = closedCandle.timestamp;
      const dedupKey = `${symbol}_${this.currentTimeframe}_${candleTimestamp}`;

      // Duplicate Prevention: A candle can produce at most one confirmed scanner signal
      if (!this.processedCandles.has(dedupKey)) {
        this.processedCandles.add(dedupKey);

        const intervalMs = getTimeframeMs(this.currentTimeframe);
        const expiryTime = candleTimestamp + intervalMs;
        const tier: 'STRONG' | 'QUALIFIED' = evalResult.score === 5 ? 'STRONG' : 'QUALIFIED';

        const newSignal: ScannerSignal = {
          id: `scan_${symbol.replace(/[\/\-_]/g, '')}_${candleTimestamp}`,
          symbol,
          timeframe: this.currentTimeframe,
          direction: evalResult.direction,
          score: evalResult.score,
          maxScore: 5,
          tier,
          entryPrice: closedCandle.close,
          candleTimestamp,
          signalTimestamp: Date.now(),
          expiryTime,
          expiryCandles: 1,
          indicators,
          reasons: evalResult.reasons,
          isConfirmed: true,
        };

        // Add to qualified signals (strongest and newest first)
        this.qualifiedSignals.unshift(newSignal);
        if (this.qualifiedSignals.length > 50) {
          this.qualifiedSignals.pop();
        }

        this.saveSignalsToStorage();
        this.notify(true);
      }
    }
  }

  /**
   * Returns monitored pairs status array from cached worker statuses (O(1) fast lookup)
   */
  public getPairsStatus(): MonitoredPairStatus[] {
    return this.monitoredSymbols.map((sym) => {
      const worker = this.workers.get(sym);
      if (worker && worker.cachedStatus) {
        return worker.cachedStatus;
      }

      const asset = getAssetInfo(sym);
      return {
        symbol: sym,
        name: asset.name,
        price: asset.basePrice,
        currentDirection: 'WAIT',
        currentScore: 0,
        candleCount: 0,
        isConnected: false,
        lastUpdated: 0,
      };
    });
  }

  /**
   * Adds a new symbol to monitor
   */
  public async addPair(symbol: string): Promise<void> {
    const formatted = symbol.toUpperCase().includes('/') ? symbol.toUpperCase() : `${symbol.slice(0, -4)}/${symbol.slice(-4)}`.toUpperCase();
    if (this.monitoredSymbols.includes(formatted)) return;

    this.monitoredSymbols.push(formatted);
    if (this.isRunning) {
      await this.initWorker(formatted);
    }
    this.notify();
  }

  /**
   * Removes a symbol from monitoring
   */
  public removePair(symbol: string): void {
    const idx = this.monitoredSymbols.indexOf(symbol);
    if (idx !== -1) {
      this.monitoredSymbols.splice(idx, 1);
      const worker = this.workers.get(symbol);
      if (worker && worker.unsubscribe) {
        worker.unsubscribe();
      }
      this.workers.delete(symbol);
      this.notify();
    }
  }

  public clearSignals(): void {
    this.qualifiedSignals = [];
    this.processedCandles.clear();
    this.saveSignalsToStorage();
    this.notify();
  }

  /**
   * Safeguard 3: Sets up visibilitychange listener once in singleton lifecycle
   */
  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined' && !this.visibilityListenerAttached) {
      this.visibilityListenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isRunning) {
          this.reconcileAllWorkers();
        }
      });
    }
  }

  /**
   * Safeguard 3: Reconciles missed candles across all active symbols upon tab visibility return
   * - No duplicate candles (timestamp map reconciliation)
   * - In-place update for identical timestamp
   * - Chronological append for new timestamp
   * - Closed candle evaluated only (forming candle excluded)
   * - Deduplication via processedCandles enforced
   * - Zero duplicate WebSockets created
   */
  public async reconcileAllWorkers(): Promise<void> {
    if (!this.isRunning) return;

    const reconcilePromises = this.monitoredSymbols.map(async (symbol) => {
      const worker = this.workers.get(symbol);
      if (!worker || !this.isRunning) return;

      try {
        const fresh = await worker.provider.getCandles(symbol, this.currentTimeframe, 30);
        if (!fresh || fresh.length === 0 || !this.isRunning) return;

        const existingMap = new Map<number, Candle>();
        worker.candles.forEach((c) => existingMap.set(c.timestamp, c));

        // Merge fresh candles from REST
        fresh.forEach((fc) => {
          existingMap.set(fc.timestamp, fc);
        });

        // Sort chronologically and limit buffer to 250
        const merged = Array.from(existingMap.values())
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-250);

        worker.candles = merged;
        worker.lastUpdated = Date.now();

        // Evaluate confirmed signals on confirmed closed candle series (excluding forming candle at end)
        if (merged.length >= 26) {
          const closedCandlesSlice = merged.slice(0, -1);
          this.evaluateClosedCandleForSignal(symbol, closedCandlesSlice);
        }
      } catch (err) {
        console.warn(`Reconcile failed for ${symbol}:`, err);
      }
    });

    await Promise.allSettled(reconcilePromises);
    if (this.isRunning) {
      this.notify();
    }
  }

  // Getters
  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getTimeframe(): TimeframeKey {
    return this.currentTimeframe;
  }

  public getMonitoredSymbols(): string[] {
    return [...this.monitoredSymbols];
  }

  public getQualifiedSignals(): ScannerSignal[] {
    return [...this.qualifiedSignals];
  }
}

export const scannerService = ScannerService.getInstance();
