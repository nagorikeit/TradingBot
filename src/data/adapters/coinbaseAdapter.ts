import { TimeframeKey } from '../../types';
import {
  ExchangeAdapter,
  ExchangeCapabilities,
  ExchangeId,
  NormalizedCandle,
  NormalizedTicker,
} from '../../types/exchangeTypes';

export class CoinbaseAdapter implements ExchangeAdapter {
  public readonly id: ExchangeId = 'COINBASE';
  public readonly name: string = 'Coinbase Exchange Public';
  public readonly capabilities: ExchangeCapabilities = {
    supportsPublicRest: true,
    supportsWebSocket: true,
    rateLimitPerMinute: 600,
    notes: 'Official Coinbase Exchange Public API.',
  };

  public isSymbolSupported(symbol: string): boolean {
    return this.toExchangeSymbol(symbol) !== null;
  }

  public toExchangeSymbol(symbol: string): string | null {
    const cleaned = symbol.replace(/[\/]/g, '-').toUpperCase();
    if (cleaned === 'BTC-USDT' || cleaned === 'BTC-USD') return 'BTC-USD';
    if (cleaned === 'ETH-USDT' || cleaned === 'ETH-USD') return 'ETH-USD';
    if (cleaned === 'SOL-USDT' || cleaned === 'SOL-USD') return 'SOL-USD';
    if (cleaned === 'XRP-USDT' || cleaned === 'XRP-USD') return 'XRP-USD';
    if (cleaned === 'ADA-USDT' || cleaned === 'ADA-USD') return 'ADA-USD';
    if (cleaned.endsWith('-USDT') || cleaned.endsWith('-USD')) return cleaned;
    return null;
  }

  private toGranularitySeconds(timeframe: TimeframeKey): number {
    switch (timeframe) {
      case '1m':
        return 60;
      case '5m':
        return 300;
      case '15m':
        return 900;
      default:
        return 60;
    }
  }

  public async getCandles(
    symbol: string,
    timeframe: TimeframeKey,
    limit: number = 100
  ): Promise<NormalizedCandle[]> {
    const productId = this.toExchangeSymbol(symbol);
    if (!productId) {
      throw new Error(`[Coinbase] Symbol ${symbol} is not a supported product on Coinbase.`);
    }

    const granularity = this.toGranularitySeconds(timeframe);
    const url = `https://api.exchange.coinbase.com/products/${productId}/candles?granularity=${granularity}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TradePulse/1.0' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[Coinbase] HTTP ${res.status}: ${res.statusText}`);
    }

    const list: any[] = await res.json();
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`[Coinbase] Received empty candles for ${symbol}`);
    }

    // Coinbase candle array: [time, low, high, open, close, volume]
    // Descending order (newest first), sort chronologically ascending
    const sorted = [...list].sort((a, b) => Number(a[0]) - Number(b[0])).slice(-limit);

    return sorted.map((item) => ({
      exchange: this.id,
      symbol,
      timeframe,
      timestamp: Number(item[0]) * 1000,
      open: parseFloat(item[3]),
      high: parseFloat(item[2]),
      low: parseFloat(item[1]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      isFinal: true,
    }));
  }

  public async getLatestPrice(symbol: string): Promise<NormalizedTicker> {
    const productId = this.toExchangeSymbol(symbol);
    if (!productId) {
      throw new Error(`[Coinbase] Symbol ${symbol} is not supported on Coinbase.`);
    }

    const url = `https://api.exchange.coinbase.com/products/${productId}/ticker`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TradePulse/1.0' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[Coinbase] Ticker HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data || !data.price) {
      throw new Error(`[Coinbase] No ticker price for ${symbol}`);
    }

    const price = parseFloat(data.price);
    return {
      exchange: this.id,
      symbol,
      price,
      timestamp: data.time ? new Date(data.time).getTime() : Date.now(),
      source: 'Coinbase Exchange Public API',
      bid: data.bid ? parseFloat(data.bid) : undefined,
      ask: data.ask ? parseFloat(data.ask) : undefined,
      volume24h: data.volume ? parseFloat(data.volume) : undefined,
    };
  }

  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: NormalizedCandle, isFinal: boolean) => void,
    onError?: (err: Error) => void
  ): () => void {
    const productId = this.toExchangeSymbol(symbol);
    if (!productId) {
      onError?.(new Error(`[Coinbase] Cannot subscribe: ${symbol} is unsupported.`));
      return () => {};
    }

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      if (isDisposed) return;
      const wsUrl = 'wss://ws-feed.exchange.coinbase.com';

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          const subMsg = {
            type: 'subscribe',
            product_ids: [productId],
            channels: ['ticker'],
          };
          ws?.send(JSON.stringify(subMsg));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === 'ticker' && data?.price) {
              const price = parseFloat(data.price);
              const candle: NormalizedCandle = {
                exchange: this.id,
                symbol,
                timeframe,
                timestamp: data.time ? new Date(data.time).getTime() : Date.now(),
                open: price,
                high: price,
                low: price,
                close: price,
                volume: data.volume_24h ? parseFloat(data.volume_24h) : 1,
                isFinal: false,
              };
              onCandle(candle, false);
            }
          } catch (e: any) {
            onError?.(e);
          }
        };

        ws.onerror = () => {
          onError?.(new Error('[Coinbase WS] Connection error'));
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
