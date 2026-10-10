import { Candle, TimeframeKey } from './index';

export type ExchangeId = 'BINANCE' | 'BYBIT' | 'OKX' | 'KRAKEN' | 'COINBASE';

export interface NormalizedCandle extends Candle {
  exchange: ExchangeId;
  symbol: string;
  timeframe: TimeframeKey;
  isFinal: boolean;
}

export interface NormalizedTicker {
  exchange: ExchangeId;
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
  bid?: number;
  ask?: number;
  volume24h?: number;
}

export interface ExchangeCapabilities {
  supportsPublicRest: boolean;
  supportsWebSocket: boolean;
  rateLimitPerMinute: number;
  notes: string;
}

export interface ExchangeAdapter {
  readonly id: ExchangeId;
  readonly name: string;
  readonly capabilities: ExchangeCapabilities;

  /**
   * Returns true if symbol can be mapped to this exchange
   */
  isSymbolSupported(symbol: string): boolean;

  /**
   * Maps internal standard symbol (e.g. BTC/USDT) to exchange-native symbol
   */
  toExchangeSymbol(symbol: string): string | null;

  /**
   * Fetches historical normalized candles via public REST API
   */
  getCandles(
    symbol: string,
    timeframe: TimeframeKey,
    limit?: number
  ): Promise<NormalizedCandle[]>;

  /**
   * Fetches current real-time ticker price
   */
  getLatestPrice(symbol: string): Promise<NormalizedTicker>;

  /**
   * Connects to live public WebSocket stream
   */
  subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: NormalizedCandle, isFinal: boolean) => void,
    onError?: (err: Error) => void
  ): () => void;
}
