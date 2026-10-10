import { TimeframeKey } from '../../types';
import {
  ExchangeAdapter,
  ExchangeCapabilities,
  ExchangeId,
  NormalizedCandle,
  NormalizedTicker,
} from '../../types/exchangeTypes';

export class BybitAdapter implements ExchangeAdapter {
  public readonly id: ExchangeId = 'BYBIT';
  public readonly name: string = 'Bybit Spot V5 Public';
  public readonly capabilities: ExchangeCapabilities = {
    supportsPublicRest: true,
    supportsWebSocket: true,
    rateLimitPerMinute: 600,
    notes: 'Official Bybit V5 Public Spot Market API.',
  };

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

  private toBybitInterval(timeframe: TimeframeKey): string {
    switch (timeframe) {
      case '1m':
        return '1';
      case '5m':
        return '5';
      case '15m':
        return '15';
      default:
        return '1';
    }
  }

  public async getCandles(
    symbol: string,
    timeframe: TimeframeKey,
    limit: number = 100
  ): Promise<NormalizedCandle[]> {
    const bybitSymbol = this.toExchangeSymbol(symbol);
    if (!bybitSymbol) {
      throw new Error(`[Bybit] Symbol ${symbol} is not a supported spot pair on Bybit.`);
    }

    const interval = this.toBybitInterval(timeframe);
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${bybitSymbol}&interval=${interval}&limit=${Math.min(limit, 200)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[Bybit] HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.retCode !== 0 || !json.result?.list) {
      throw new Error(`[Bybit] API error (${json.retCode}): ${json.retMsg || 'Unknown error'}`);
    }

    const list: string[][] = json.result.list;
    // Bybit returns newest first, so sort chronologically ascending
    const sorted = [...list].sort((a, b) => Number(a[0]) - Number(b[0]));

    return sorted.map((item) => ({
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
  }

  public async getLatestPrice(symbol: string): Promise<NormalizedTicker> {
    const bybitSymbol = this.toExchangeSymbol(symbol);
    if (!bybitSymbol) {
      throw new Error(`[Bybit] Symbol ${symbol} is not supported on Bybit.`);
    }

    const url = `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${bybitSymbol}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[Bybit] Ticker HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const ticker = json.result?.list?.[0];
    if (!ticker || !ticker.lastPrice) {
      throw new Error(`[Bybit] No ticker data found for ${symbol}.`);
    }

    const price = parseFloat(ticker.lastPrice);
    return {
      exchange: this.id,
      symbol,
      price,
      timestamp: Date.now(),
      source: 'Bybit Spot V5 API',
      bid: ticker.bid1Price ? parseFloat(ticker.bid1Price) : undefined,
      ask: ticker.ask1Price ? parseFloat(ticker.ask1Price) : undefined,
      volume24h: ticker.volume24h ? parseFloat(ticker.volume24h) : undefined,
    };
  }

  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: NormalizedCandle, isFinal: boolean) => void,
    onError?: (err: Error) => void
  ): () => void {
    const bybitSymbol = this.toExchangeSymbol(symbol);
    if (!bybitSymbol) {
      onError?.(new Error(`[Bybit] Cannot subscribe: ${symbol} is unsupported.`));
      return () => {};
    }

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let pingInterval: any = null;
    let reconnectTimeout: any = null;
    const interval = this.toBybitInterval(timeframe);

    const connect = () => {
      if (isDisposed) return;
      const wsUrl = 'wss://stream.bybit.com/v5/public/spot';

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Subscribe to kline topic
          const subMsg = {
            op: 'subscribe',
            args: [`kline.${interval}.${bybitSymbol}`],
          };
          ws?.send(JSON.stringify(subMsg));

          // Bybit requires ping every 20s
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ op: 'ping' }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.topic?.startsWith('kline') && Array.isArray(data?.data)) {
              for (const k of data.data) {
                const candle: NormalizedCandle = {
                  exchange: this.id,
                  symbol,
                  timeframe,
                  timestamp: Number(k.start),
                  open: parseFloat(k.open),
                  high: parseFloat(k.high),
                  low: parseFloat(k.low),
                  close: parseFloat(k.close),
                  volume: parseFloat(k.volume),
                  isFinal: Boolean(k.confirm),
                };
                onCandle(candle, candle.isFinal);
              }
            }
          } catch (e: any) {
            onError?.(e);
          }
        };

        ws.onerror = () => {
          onError?.(new Error('[Bybit WS] Connection error'));
        };

        ws.onclose = () => {
          clearInterval(pingInterval);
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
      clearInterval(pingInterval);
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
