import { Candle, AssetInfo, TimeframeKey } from '../types';

export const SUPPORTED_ASSETS: AssetInfo[] = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', category: 'FOREX', pipDecimals: 5, basePrice: 1.08450, spread: 0.00012 },
  { symbol: 'GBP/USD', name: 'British Pound / US Dollar', category: 'FOREX', pipDecimals: 5, basePrice: 1.27180, spread: 0.00015 },
  { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', category: 'FOREX', pipDecimals: 3, basePrice: 152.450, spread: 0.015 },
  { symbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', category: 'FOREX', pipDecimals: 5, basePrice: 0.65420, spread: 0.00014 },
  { symbol: 'BTC/USDT', name: 'Bitcoin / Tether', category: 'CRYPTO', pipDecimals: 2, basePrice: 67840.00, spread: 1.50 },
  { symbol: 'ETH/USDT', name: 'Ethereum / Tether', category: 'CRYPTO', pipDecimals: 2, basePrice: 3485.50, spread: 0.35 },
];

export function getAssetInfo(symbol: string): AssetInfo {
  return (
    SUPPORTED_ASSETS.find((a) => a.symbol === symbol) || {
      symbol,
      name: symbol,
      category: 'FOREX',
      pipDecimals: 5,
      basePrice: 1.10000,
      spread: 0.00015,
    }
  );
}

export function getTimeframeMs(timeframe: TimeframeKey): number {
  switch (timeframe) {
    case '1m':
      return 60 * 1000;
    case '5m':
      return 5 * 60 * 1000;
    case '15m':
      return 15 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

/**
 * Clean adapter interface for market data providers
 * Allows swapping mock data with Binance, AlphaVantage, or broker feeds seamlessly
 */
export interface MarketDataProvider {
  getCandles(symbol: string, timeframe: TimeframeKey, limit: number): Promise<Candle[]>;
  getLatestPrice(symbol: string): Promise<number>;
}

/**
 * Mock & Demo Market Data Provider
 * Produces high-fidelity realistic candlestick price action with trend cycles and volatility
 */
export class MockMarketDataProvider implements MarketDataProvider {
  private cache: Map<string, Candle[]> = new Map();

  private getCacheKey(symbol: string, timeframe: string): string {
    return `${symbol}-${timeframe}`;
  }

  public async getCandles(symbol: string, timeframe: TimeframeKey, limit: number = 100): Promise<Candle[]> {
    const key = this.getCacheKey(symbol, timeframe);
    let candles = this.cache.get(key);

    if (!candles || candles.length < limit) {
      candles = this.generateHistoricalCandles(symbol, timeframe, Math.max(limit, 120));
      this.cache.set(key, candles);
    }

    return candles.slice(-limit);
  }

  public async getLatestPrice(symbol: string): Promise<number> {
    const key = this.getCacheKey(symbol, '1m');
    const cached = this.cache.get(key);
    if (cached && cached.length > 0) {
      return cached[cached.length - 1].close;
    }
    const asset = getAssetInfo(symbol);
    return asset.basePrice;
  }

  /**
   * Generates realistic synthetic candle series
   */
  public generateHistoricalCandles(symbol: string, timeframe: TimeframeKey, count: number): Candle[] {
    const asset = getAssetInfo(symbol);
    const intervalMs = getTimeframeMs(timeframe);
    const now = Date.now();
    const startTime = now - count * intervalMs;

    const candles: Candle[] = [];
    let currentPrice = asset.basePrice;

    // Volatility scale factor based on asset type
    const volatilityPct = asset.category === 'CRYPTO' ? 0.0018 : 0.00035;
    let trend = (Math.random() - 0.5) * 0.0002;
    let trendDuration = Math.floor(Math.random() * 20) + 10;

    for (let i = 0; i < count; i++) {
      const candleTime = startTime + i * intervalMs;

      // Update trend cycles
      trendDuration--;
      if (trendDuration <= 0) {
        trend = (Math.random() - 0.49) * (volatilityPct * 0.8);
        trendDuration = Math.floor(Math.random() * 25) + 12;
      }

      const open = currentPrice;
      const stepChange = open * (trend + (Math.random() - 0.49) * volatilityPct);
      const close = Math.max(open * 0.5, open + stepChange);

      // Realistic wick physics
      const highWick = Math.random() * Math.abs(stepChange) * 1.3 + open * volatilityPct * 0.3;
      const lowWick = Math.random() * Math.abs(stepChange) * 1.3 + open * volatilityPct * 0.3;

      const high = Math.max(open, close) + highWick;
      const low = Math.min(open, close) - lowWick;

      // Realistic volume
      const baseVol = asset.category === 'CRYPTO' ? 45 : 1200;
      const volume = Math.floor(baseVol * (0.6 + Math.random() * 0.8 + Math.abs(close - open) / (open * volatilityPct)));

      const candle: Candle = {
        timestamp: candleTime,
        open: Number(open.toFixed(asset.pipDecimals)),
        high: Number(high.toFixed(asset.pipDecimals)),
        low: Number(low.toFixed(asset.pipDecimals)),
        close: Number(close.toFixed(asset.pipDecimals)),
        volume,
      };

      candles.push(candle);
      currentPrice = close;
    }

    return candles;
  }

  /**
   * Appends or updates the live current candle on tick
   */
  public simulateTick(symbol: string, timeframe: TimeframeKey): { candles: Candle[]; isNewCandle: boolean } {
    const key = this.getCacheKey(symbol, timeframe);
    let candles = this.cache.get(key);
    if (!candles || candles.length === 0) {
      candles = this.generateHistoricalCandles(symbol, timeframe, 100);
      this.cache.set(key, candles);
    }

    const asset = getAssetInfo(symbol);
    const intervalMs = getTimeframeMs(timeframe);
    const now = Date.now();
    const lastCandle = candles[candles.length - 1];

    const volatility = (asset.category === 'CRYPTO' ? 0.0004 : 0.00008) * asset.basePrice;
    const delta = (Math.random() - 0.485) * volatility;
    const newPrice = Number(Math.max(asset.basePrice * 0.2, lastCandle.close + delta).toFixed(asset.pipDecimals));

    let isNewCandle = false;

    // Check if current candle period has expired
    if (now - lastCandle.timestamp >= intervalMs) {
      // Create new candle
      const newCandle: Candle = {
        timestamp: lastCandle.timestamp + intervalMs,
        open: lastCandle.close,
        high: Math.max(lastCandle.close, newPrice),
        low: Math.min(lastCandle.close, newPrice),
        close: newPrice,
        volume: Math.floor(10 + Math.random() * 20),
      };
      candles.push(newCandle);
      // Keep reasonable buffer length (250)
      if (candles.length > 300) {
        candles.shift();
      }
      isNewCandle = true;
    } else {
      // Update existing candle
      lastCandle.close = newPrice;
      lastCandle.high = Number(Math.max(lastCandle.high, newPrice).toFixed(asset.pipDecimals));
      lastCandle.low = Number(Math.min(lastCandle.low, newPrice).toFixed(asset.pipDecimals));
      lastCandle.volume += Math.floor(1 + Math.random() * 4);
    }

    this.cache.set(key, candles);
    return { candles: [...candles], isNewCandle };
  }

  /**
   * Forces one candle advancement immediately for testing/demo
   */
  public advanceNextCandle(symbol: string, timeframe: TimeframeKey): Candle[] {
    const key = this.getCacheKey(symbol, timeframe);
    let candles = this.cache.get(key);
    if (!candles || candles.length === 0) {
      candles = this.generateHistoricalCandles(symbol, timeframe, 100);
    }

    const asset = getAssetInfo(symbol);
    const intervalMs = getTimeframeMs(timeframe);
    const lastCandle = candles[candles.length - 1];
    
    // Simulate natural next candle with random momentum
    const volatilityPct = asset.category === 'CRYPTO' ? 0.0016 : 0.00032;
    const pctChange = (Math.random() - 0.48) * volatilityPct;
    const open = lastCandle.close;
    const close = Number((open * (1 + pctChange)).toFixed(asset.pipDecimals));
    const wickHigh = open * volatilityPct * Math.random() * 0.8;
    const wickLow = open * volatilityPct * Math.random() * 0.8;
    const high = Number((Math.max(open, close) + wickHigh).toFixed(asset.pipDecimals));
    const low = Number((Math.min(open, close) - wickLow).toFixed(asset.pipDecimals));
    const volume = Math.floor(150 + Math.random() * 300);

    const nextCandle: Candle = {
      timestamp: lastCandle.timestamp + intervalMs,
      open,
      high,
      low,
      close,
      volume,
    };

    candles.push(nextCandle);
    if (candles.length > 300) {
      candles.shift();
    }
    this.cache.set(key, candles);
    return [...candles];
  }
}

export const defaultMarketProvider = new MockMarketDataProvider();
