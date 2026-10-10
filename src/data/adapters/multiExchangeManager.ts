import {
  ExchangeAdapter,
  ExchangeId,
  NormalizedCandle,
  NormalizedTicker,
} from '../../types/exchangeTypes';
import { TimeframeKey } from '../../types';
import { BinanceAdapter } from './binanceAdapter';
import { BybitAdapter } from './bybitAdapter';
import { OkxAdapter } from './okxAdapter';
import { KrakenAdapter } from './krakenAdapter';
import { CoinbaseAdapter } from './coinbaseAdapter';

export interface MultiExchangePriceSummary {
  symbol: string;
  timestamp: number;
  averagePrice: number;
  highestPrice: number;
  lowestPrice: number;
  maxSpreadPercent: number;
  quotes: NormalizedTicker[];
  reportingExchangesCount: number;
}

export class MultiExchangeManager {
  private static instance: MultiExchangeManager;
  private adapters: Map<ExchangeId, ExchangeAdapter> = new Map();

  private constructor() {
    this.registerAdapter(new BinanceAdapter());
    this.registerAdapter(new BybitAdapter());
    this.registerAdapter(new OkxAdapter());
    this.registerAdapter(new KrakenAdapter());
    this.registerAdapter(new CoinbaseAdapter());
  }

  public static getInstance(): MultiExchangeManager {
    if (!MultiExchangeManager.instance) {
      MultiExchangeManager.instance = new MultiExchangeManager();
    }
    return MultiExchangeManager.instance;
  }

  public registerAdapter(adapter: ExchangeAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(id: ExchangeId): ExchangeAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`[MultiExchangeManager] Exchange adapter '${id}' not found.`);
    }
    return adapter;
  }

  public getAllAdapters(): ExchangeAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getSupportedExchanges(): ExchangeId[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Fetches real-time prices across all 5 exchanges simultaneously.
   * Gracefully ignores exchanges where the pair is unsupported or offline.
   */
  public async fetchCrossExchangeSummary(symbol: string): Promise<MultiExchangePriceSummary> {
    const promises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        if (!adapter.isSymbolSupported(symbol)) return null;
        return await adapter.getLatestPrice(symbol);
      } catch {
        return null;
      }
    });

    const results = await Promise.all(promises);
    const validQuotes = results.filter((q): q is NormalizedTicker => q !== null && q.price > 0);

    if (validQuotes.length === 0) {
      throw new Error(`No live quotes available for ${symbol} across any of the 5 exchanges.`);
    }

    const prices = validQuotes.map((q) => q.price);
    const highest = Math.max(...prices);
    const lowest = Math.min(...prices);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const spreadPct = lowest > 0 ? ((highest - lowest) / lowest) * 100 : 0;

    return {
      symbol,
      timestamp: Date.now(),
      averagePrice: Number(avg.toFixed(4)),
      highestPrice: highest,
      lowestPrice: lowest,
      maxSpreadPercent: Number(spreadPct.toFixed(3)),
      quotes: validQuotes,
      reportingExchangesCount: validQuotes.length,
    };
  }

  /**
   * Unified single-exchange candle fetcher
   */
  public async getCandles(
    exchangeId: ExchangeId,
    symbol: string,
    timeframe: TimeframeKey,
    limit: number = 100
  ): Promise<NormalizedCandle[]> {
    const adapter = this.getAdapter(exchangeId);
    return adapter.getCandles(symbol, timeframe, limit);
  }
}

export const multiExchangeManager = MultiExchangeManager.getInstance();
