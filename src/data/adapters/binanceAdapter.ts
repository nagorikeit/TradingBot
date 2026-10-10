import { TimeframeKey } from '../../types';
import {
  ExchangeAdapter,
  ExchangeCapabilities,
  ExchangeId,
  NormalizedCandle,
  NormalizedTicker,
} from '../../types/exchangeTypes';

export class BinanceAdapter implements ExchangeAdapter {
  public readonly id: ExchangeId = 'BINANCE';
  public readonly name: string = 'Binance Public (REST/WS)';
  public readonly capabilities: ExchangeCapabilities = {
    supportsPublicRest: true,
    supportsWebSocket: true,
    rateLimitPerMinute: 1200,
    notes: 'Official Binance Spot Public API with data-api.binance.vision mirror fallback.',
  };

  private lastCandleTimestamp: number = 0;

  public isSymbolSupported(symbol: string): boolean {
    return this.toExchangeSymbol(symbol) !== null;
  }

  public toExchangeSymbol(symbol: string): string | null {
    const cleaned = symbol.replace(/[\/\-_]/g, '').toUpperCase();
    if (cleaned.endsWith('USDT') && cleaned.length >= 6) {
      return cleaned;
    }
    return null;
  }

  public async getCandles(
    symbol: string,
    timeframe: TimeframeKey,
    limit: number = 100
  ): Promise<NormalizedCandle[]> {
    const binanceSymbol = this.toExchangeSymbol(symbol);
    if (!binanceSymbol) {
      throw new Error(`[Binance] Symbol ${symbol} is not a supported spot pair on Binance.`);
    }

    const interval = timeframe;
    const endpoints = [
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`,
      `https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`,
    ];

    let lastError: Error | null = null;
    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const rawData: any[] = await res.json();
        if (!Array.isArray(rawData) || rawData.length === 0) {
          throw new Error('Received empty candle array');
        }

        return rawData.map((item) => ({
          exchange: this.id,
          symbol,
          timeframe,
          timestamp: Number(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5]),
          isFinal: true,
        }));
      } catch (err: any) {
        lastError = err;
      }
    }

    throw new Error(`[Binance] Failed to fetch candles for ${symbol}: ${lastError?.message || 'Network error'}`);
  }

  public async getLatestPrice(symbol: string): Promise<NormalizedTicker> {
    const binanceSymbol = this.toExchangeSymbol(symbol);
    if (!binanceSymbol) {
      throw new Error(`[Binance] Symbol ${symbol} is not supported on Binance.`);
    }

    const endpoints = [
      `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      `https://data-api.binance.vision/api/v3/ticker/price?symbol=${binanceSymbol}`,
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const price = parseFloat(data.price);
          if (!isNaN(price) && price > 0) {
            return {
              exchange: this.id,
              symbol,
              price,
              timestamp: Date.now(),
              source: url.includes('binance.vision') ? 'Binance Vision Public Mirror' : 'Binance Spot API',
            };
          }
        }
      } catch {}
    }

    throw new Error(`[Binance] Failed to retrieve real-time price for ${symbol}.`);
  }

  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: NormalizedCandle, isFinal: boolean) => void,
    onError?: (err: Error) => void
  ): () => void {
    const binanceSymbol = this.toExchangeSymbol(symbol);
    if (!binanceSymbol) {
      onError?.(new Error(`[Binance] Cannot subscribe: ${symbol} is unsupported.`));
      return () => {};
    }

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      if (isDisposed) return;
      const streamName = `${binanceSymbol.toLowerCase()}@kline_${timeframe}`;
      const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.e === 'kline' && data?.k) {
              const k = data.k;
              const candle: NormalizedCandle = {
                exchange: this.id,
                symbol,
                timeframe,
                timestamp: Number(k.t),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                isFinal: Boolean(k.x),
              };
              this.lastCandleTimestamp = candle.timestamp;
              onCandle(candle, candle.isFinal);
            }
          } catch (e: any) {
            onError?.(e);
          }
        };

        ws.onerror = (e) => {
          onError?.(new Error('[Binance WS] Connection error'));
        };

        ws.onclose = () => {
          if (!isDisposed) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err: any) {
        onError?.(err);
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
        ws = null;
      }
    };
  }
}
