import { Candle, TimeframeKey, AssetInfo } from '../types';
import { MarketDataProvider, MockMarketDataProvider, getAssetInfo } from './marketDataProvider';

export class BinanceMarketDataProvider implements MarketDataProvider {
  public readonly name: string = 'Binance Live (WS)';
  private fallbackMock = new MockMarketDataProvider();
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private activeSymbol: string = '';
  private activeTimeframe: TimeframeKey = '1m';
  private isSubscribed: boolean = false;

  /**
   * Converts application symbols to Binance format (e.g. BTC/USDT -> BTCUSDT)
   */
  public toBinanceSymbol(symbol: string): string | null {
    const cleaned = symbol.replace(/[\/\-_]/g, '').toUpperCase();
    if (cleaned.endsWith('USDT') && cleaned.length >= 6) {
      return cleaned;
    }
    return null;
  }

  /**
   * Fetches historical klines via Binance public REST API
   */
  public async getCandles(symbol: string, timeframe: TimeframeKey, limit: number = 100): Promise<Candle[]> {
    const binanceSymbol = this.toBinanceSymbol(symbol);
    if (!binanceSymbol) {
      // Non-crypto pair (e.g. EUR/USD), fallback safely to mock provider
      return this.fallbackMock.getCandles(symbol, timeframe, limit);
    }

    const interval = timeframe; // '1m', '5m', '15m' match Binance interval format directly
    const endpoints = [
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`,
      `https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) continue;

        const rawData: any[] = await res.json();
        if (!Array.isArray(rawData) || rawData.length === 0) continue;

        const candles: Candle[] = rawData.map((item) => ({
          timestamp: Number(item[0]), // Kline start time ms
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
        }));

        return candles;
      } catch (err) {
        // Try fallback mirror or mock
        console.warn(`Binance REST klines fetch failed for ${url}:`, err);
      }
    }

    // Graceful fallback to mock if offline or restricted
    return this.fallbackMock.getCandles(symbol, timeframe, limit);
  }

  /**
   * Fetches current latest ticker price
   */
  public async getLatestPrice(symbol: string): Promise<number> {
    const binanceSymbol = this.toBinanceSymbol(symbol);
    if (!binanceSymbol) {
      return this.fallbackMock.getLatestPrice(symbol);
    }

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.price) {
          return parseFloat(data.price);
        }
      }
    } catch {
      // Fallback
    }

    return this.fallbackMock.getLatestPrice(symbol);
  }

  /**
   * Subscribes to Binance live kline WebSocket stream
   * Emits every tick update for current forming candle and emits isClosed=true upon official candle close
   */
  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: Candle, isClosed: boolean) => void
  ): () => void {
    const binanceSymbol = this.toBinanceSymbol(symbol);
    if (!binanceSymbol) {
      // Fallback to mock streaming for forex pairs
      return this.fallbackMock.subscribeLive(symbol, timeframe, onCandle);
    }

    this.activeSymbol = binanceSymbol;
    this.activeTimeframe = timeframe;
    this.isSubscribed = true;

    let retryCount = 0;
    const maxBackoffMs = 10000;

    const connectWebSocket = () => {
      if (!this.isSubscribed) return;

      const streamName = `${binanceSymbol.toLowerCase()}@kline_${timeframe}`;
      const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;

      try {
        if (this.ws) {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.close();
        }

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          retryCount = 0;
        };

        this.ws.onmessage = (event) => {
          if (!this.isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            if (data && data.e === 'kline' && data.k) {
              const k = data.k;
              const candle: Candle = {
                timestamp: Number(k.t), // Open time of the kline
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
              };
              const isClosed = Boolean(k.x); // Binance official candle-close confirmation
              onCandle(candle, isClosed);
            }
          } catch (e) {
            console.error('Failed to parse Binance WebSocket kline event', e);
          }
        };

        this.ws.onerror = () => {
          // Trigger onclose for orderly reconnect
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
          }
        };

        this.ws.onclose = () => {
          if (!this.isSubscribed) return;
          // Exponential backoff reconnect
          const delay = Math.min(2000 * Math.pow(1.5, retryCount), maxBackoffMs);
          retryCount++;
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.isSubscribed) {
              connectWebSocket();
            }
          }, delay);
        };
      } catch (err) {
        console.error('Error establishing Binance WebSocket:', err);
      }
    };

    connectWebSocket();

    // Return unsubscribe function
    return () => {
      this.isSubscribed = false;
      clearTimeout(this.reconnectTimer);
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
        this.ws = null;
      }
    };
  }
}
