import { TimeframeKey } from '../../types';
import {
  ExchangeAdapter,
  ExchangeCapabilities,
  ExchangeId,
  NormalizedCandle,
  NormalizedTicker,
} from '../../types/exchangeTypes';

export class OkxAdapter implements ExchangeAdapter {
  public readonly id: ExchangeId = 'OKX';
  public readonly name: string = 'OKX V5 Public Market';
  public readonly capabilities: ExchangeCapabilities = {
    supportsPublicRest: true,
    supportsWebSocket: true,
    rateLimitPerMinute: 600,
    notes: 'Official OKX V5 Public Spot Market API.',
  };

  public isSymbolSupported(symbol: string): boolean {
    return this.toExchangeSymbol(symbol) !== null;
  }

  public toExchangeSymbol(symbol: string): string | null {
    // Standard format for OKX Spot: BTC-USDT, ETH-USDT
    const cleaned = symbol.replace(/[\/]/g, '-').toUpperCase();
    if (cleaned.endsWith('-USDT')) {
      return cleaned;
    }
    return null;
  }

  public async getCandles(
    symbol: string,
    timeframe: TimeframeKey,
    limit: number = 100
  ): Promise<NormalizedCandle[]> {
    const instId = this.toExchangeSymbol(symbol);
    if (!instId) {
      throw new Error(`[OKX] Symbol ${symbol} is not a supported spot pair on OKX.`);
    }

    const bar = timeframe; // '1m', '5m', '15m' are valid OKX bar formats
    const url = `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${Math.min(limit, 100)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[OKX] HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.code !== '0' || !Array.isArray(json.data)) {
      throw new Error(`[OKX] API error (${json.code}): ${json.msg || 'Unknown error'}`);
    }

    // OKX returns newest first, so sort chronologically ascending
    const sorted = [...json.data].sort((a, b) => Number(a[0]) - Number(b[0]));

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
      isFinal: item[8] === '1',
    }));
  }

  public async getLatestPrice(symbol: string): Promise<NormalizedTicker> {
    const instId = this.toExchangeSymbol(symbol);
    if (!instId) {
      throw new Error(`[OKX] Symbol ${symbol} is not supported on OKX.`);
    }

    const url = `https://www.okx.com/api/v5/market/ticker?instId=${instId}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[OKX] Ticker HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const ticker = json.data?.[0];
    if (!ticker || !ticker.last) {
      throw new Error(`[OKX] No ticker data found for ${symbol}.`);
    }

    const price = parseFloat(ticker.last);
    return {
      exchange: this.id,
      symbol,
      price,
      timestamp: Number(ticker.ts) || Date.now(),
      source: 'OKX V5 Public Spot API',
      bid: ticker.bidPx ? parseFloat(ticker.bidPx) : undefined,
      ask: ticker.askPx ? parseFloat(ticker.askPx) : undefined,
      volume24h: ticker.vol24h ? parseFloat(ticker.vol24h) : undefined,
    };
  }

  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: NormalizedCandle, isFinal: boolean) => void,
    onError?: (err: Error) => void
  ): () => void {
    const instId = this.toExchangeSymbol(symbol);
    if (!instId) {
      onError?.(new Error(`[OKX] Cannot subscribe: ${symbol} is unsupported.`));
      return () => {};
    }

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let pingInterval: any = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      if (isDisposed) return;
      const wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          const channel = `candle${timeframe}`;
          const subMsg = {
            op: 'subscribe',
            args: [{ channel, instId }],
          };
          ws?.send(JSON.stringify(subMsg));

          // OKX ping every 25s
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            if (event.data === 'pong') return;
            const data = JSON.parse(event.data);
            if (data?.data && Array.isArray(data.data)) {
              for (const item of data.data) {
                const candle: NormalizedCandle = {
                  exchange: this.id,
                  symbol,
                  timeframe,
                  timestamp: Number(item[0]),
                  open: parseFloat(item[1]),
                  high: parseFloat(item[2]),
                  low: parseFloat(item[3]),
                  close: parseFloat(item[4]),
                  volume: parseFloat(item[5]),
                  isFinal: item[8] === '1',
                };
                onCandle(candle, candle.isFinal);
              }
            }
          } catch (e: any) {
            onError?.(e);
          }
        };

        ws.onerror = () => {
          onError?.(new Error('[OKX WS] Connection error'));
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
