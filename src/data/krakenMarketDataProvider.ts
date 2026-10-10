import { Candle, TimeframeKey } from '../types';
import { MarketDataProvider } from './marketDataProvider';
import { KrakenAdapter } from './adapters/krakenAdapter';

export class KrakenMarketDataProvider implements MarketDataProvider {
  public readonly name: string = 'Kraken Spot';
  private adapter = new KrakenAdapter();

  public async getCandles(symbol: string, timeframe: TimeframeKey, limit: number = 100): Promise<Candle[]> {
    if (!this.adapter.isSymbolSupported(symbol)) {
      throw new Error(`[Kraken] ${symbol} is not a supported spot asset on Kraken.`);
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
