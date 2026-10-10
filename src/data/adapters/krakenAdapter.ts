import { TimeframeKey } from '../../types';
import {
  ExchangeAdapter,
  ExchangeCapabilities,
  ExchangeId,
  NormalizedCandle,
  NormalizedTicker,
} from '../../types/exchangeTypes';

export class KrakenAdapter implements ExchangeAdapter {
  public readonly id: ExchangeId = 'KRAKEN';
  public readonly name: string = 'Kraken Public Market';
  public readonly capabilities: ExchangeCapabilities = {
    supportsPublicRest: true,
    supportsWebSocket: true,
    rateLimitPerMinute: 600,
    notes: 'Official Kraken Public Spot Market API.',
  };

  public isSymbolSupported(symbol: string): boolean {
    return this.toExchangeSymbol(symbol) !== null;
  }

  public toExchangeSymbol(symbol: string): string | null {
    const cleaned = symbol.replace(/[\/\-_]/g, '').toUpperCase();
    if (cleaned === 'BTCUSDT' || cleaned === 'BTCUSD') return 'XBTUSDT';
    if (cleaned === 'ETHUSDT' || cleaned === 'ETHUSD') return 'ETHUSDT';
    if (cleaned === 'SOLUSDT' || cleaned === 'SOLUSD') return 'SOLUSDT';
    if (cleaned === 'XRPUSDT' || cleaned === 'XRPUSD') return 'XRPUSDT';
    if (cleaned === 'ADAUSDT' || cleaned === 'ADAUSD') return 'ADAUSDT';
    if (cleaned.endsWith('USDT')) return cleaned;
    return null;
  }

  private toKrakenInterval(timeframe: TimeframeKey): number {
    switch (timeframe) {
      case '1m':
        return 1;
      case '5m':
        return 5;
      case '15m':
        return 15;
      default:
        return 1;
    }
  }

  public async getCandles(
    symbol: string,
    timeframe: TimeframeKey,
    limit: number = 100
  ): Promise<NormalizedCandle[]> {
    const krakenPair = this.toExchangeSymbol(symbol);
    if (!krakenPair) {
      throw new Error(`[Kraken] Symbol ${symbol} is not a supported pair on Kraken.`);
    }

    const interval = this.toKrakenInterval(timeframe);
    const url = `https://api.kraken.com/0/public/OHLC?pair=${krakenPair}&interval=${interval}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[Kraken] HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.error && json.error.length > 0) {
      throw new Error(`[Kraken] API error: ${json.error.join(', ')}`);
    }

    // Kraken returns { result: { [pairKey]: [...], last: number } }
    const resultObj = json.result;
    if (!resultObj) {
      throw new Error('[Kraken] Empty result from OHLC endpoint');
    }

    const pairKeys = Object.keys(resultObj).filter((k) => k !== 'last');
    const pairKey = pairKeys[0];
    if (!pairKey || !Array.isArray(resultObj[pairKey])) {
      throw new Error(`[Kraken] No OHLC array found for ${symbol}`);
    }

    const list: any[] = resultObj[pairKey];
    // list item: [time, open, high, low, close, vwap, volume, count]
    const candles: NormalizedCandle[] = list.slice(-limit).map((item) => ({
      exchange: this.id,
      symbol,
      timeframe,
      timestamp: Number(item[0]) * 1000, // Kraken gives unix seconds
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[6]),
      isFinal: true,
    }));

    return candles;
  }

  public async getLatestPrice(symbol: string): Promise<NormalizedTicker> {
    const krakenPair = this.toExchangeSymbol(symbol);
    if (!krakenPair) {
      throw new Error(`[Kraken] Symbol ${symbol} is not supported on Kraken.`);
    }

    const url = `https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`[Kraken] Ticker HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    const resultObj = json.result;
    if (!resultObj) {
      throw new Error(`[Kraken] No ticker result found for ${symbol}`);
    }

    const pairKey = Object.keys(resultObj)[0];
    const data = resultObj[pairKey];
    if (!data || !data.c || !data.c[0]) {
      throw new Error(`[Kraken] Invalid ticker structure for ${symbol}`);
    }

    const price = parseFloat(data.c[0]);
    return {
      exchange: this.id,
      symbol,
      price,
      timestamp: Date.now(),
      source: 'Kraken Public Spot API',
      bid: data.b ? parseFloat(data.b[0]) : undefined,
      ask: data.a ? parseFloat(data.a[0]) : undefined,
      volume24h: data.v ? parseFloat(data.v[1]) : undefined,
    };
  }

  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: NormalizedCandle, isFinal: boolean) => void,
    onError?: (err: Error) => void
  ): () => void {
    const krakenPair = this.toExchangeSymbol(symbol);
    if (!krakenPair) {
      onError?.(new Error(`[Kraken] Cannot subscribe: ${symbol} is unsupported.`));
      return () => {};
    }

    let isDisposed = false;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    const interval = this.toKrakenInterval(timeframe);

    const connect = () => {
      if (isDisposed) return;
      const wsUrl = 'wss://ws.kraken.com/v2';

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          const subMsg = {
            method: 'subscribe',
            params: {
              channel: 'ohlc',
              symbol: [krakenPair],
              interval,
            },
          };
          ws?.send(JSON.stringify(subMsg));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.channel === 'ohlc' && Array.isArray(data?.data)) {
              for (const k of data.data) {
                const candle: NormalizedCandle = {
                  exchange: this.id,
                  symbol,
                  timeframe,
                  timestamp: new Date(k.interval_begin).getTime(),
                  open: parseFloat(k.open),
                  high: parseFloat(k.high),
                  low: parseFloat(k.low),
                  close: parseFloat(k.close),
                  volume: parseFloat(k.volume),
                  isFinal: false,
                };
                onCandle(candle, false);
              }
            }
          } catch (e: any) {
            onError?.(e);
          }
        };

        ws.onerror = () => {
          onError?.(new Error('[Kraken WS] Connection error'));
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
