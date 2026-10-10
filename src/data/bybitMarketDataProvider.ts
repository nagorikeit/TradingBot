import { Candle, TimeframeKey } from '../types';
import { MarketDataProvider } from './marketDataProvider';
import { BybitAdapter } from './adapters/bybitAdapter';

export class BybitMarketDataProvider implements MarketDataProvider {
  public readonly name: string = 'Bybit Spot V5';
  private adapter = new BybitAdapter();

  public async getCandles(symbol: string, timeframe: TimeframeKey, limit: number = 100): Promise<Candle[]> {
    if (!this.adapter.isSymbolSupported(symbol)) {
      throw new Error(`[Bybit] ${symbol} is not a supported spot asset on Bybit.`);
    }
    return this.adapter.getCandles(symbol, timeframe, limit);
  }

  public async getLatestPrice(symbol: string): Promise<number> {
    const ticker = await this.adapter.getLatestPrice(symbol);
    return ticker.price;
  }

  public subscribeLive(
    symbol: string,
    timeframe: TimeframeKey,
    onCandle: (candle: Candle, isClosed: boolean) => void
  ): () => void {
    return this.adapter.subscribeLive(symbol, timeframe, (candle, isFinal) => {
      onCandle(candle, isFinal);
    });
  }
}
