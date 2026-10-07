import React from 'react';
import { SUPPORTED_ASSETS, getAssetInfo, MarketDataSourceMode } from '../data/marketDataProvider';
import { Candle, TimeframeKey } from '../types';
import { formatPrice } from '../utils/formatters';
import { TrendingUp, TrendingDown, Clock, Radio } from 'lucide-react';

interface AssetSelectorBarProps {
  selectedSymbol: string;
  selectedTimeframe: TimeframeKey;
  providerMode: MarketDataSourceMode;
  onSelectSymbol: (symbol: string) => void;
  onSelectTimeframe: (timeframe: TimeframeKey) => void;
  onSelectProvider: (mode: MarketDataSourceMode) => void;
  latestCandle: Candle | null;
  previousCandle: Candle | null;
}

export const AssetSelectorBar: React.FC<AssetSelectorBarProps> = ({
  selectedSymbol,
  selectedTimeframe,
  providerMode,
  onSelectSymbol,
  onSelectTimeframe,
  onSelectProvider,
  latestCandle,
  previousCandle,
}) => {
  const asset = getAssetInfo(selectedSymbol);

  const currentPrice = latestCandle ? latestCandle.close : asset.basePrice;
  const prevPrice = previousCandle ? previousCandle.close : currentPrice;
  const priceDiff = currentPrice - prevPrice;
  const isUp = priceDiff >= 0;

  return (
    <div className="bg-[#111827] border-b border-slate-800 px-3 sm:px-4 py-2 space-y-2">
      {/* Row 1: All 14 Asset Pairs (Strictly 1 single line, horizontally scrollable) */}
      <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-0 w-full overflow-x-auto whitespace-nowrap scrollbar-thin scroll-smooth flex-nowrap py-0.5">
        <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
          <span>Asset:</span>
        </span>
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-md p-1 shrink-0 flex-nowrap">
          {SUPPORTED_ASSETS.map((a) => (
            <button
              key={a.symbol}
              onClick={() => onSelectSymbol(a.symbol)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors shrink-0 whitespace-nowrap ${
                selectedSymbol === a.symbol
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {a.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: Timeframe + Binance/Mock Feed + Live Price & Stats (Strictly 1 single line, horizontally scrollable) */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 pt-1.5 border-t border-slate-800/70 overflow-x-auto whitespace-nowrap scrollbar-thin scroll-smooth flex-nowrap min-w-0 w-full text-xs">
        {/* Left Controls: Timeframe & Feed Mode */}
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          {/* Timeframe Select */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-slate-400 font-medium shrink-0">Time:</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-md p-0.5 shrink-0 flex-nowrap">
              {(['1m', '5m', '15m'] as TimeframeKey[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => onSelectTimeframe(tf)}
                  className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors shrink-0 ${
                    selectedTimeframe === tf
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Data Feed Mode Selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-slate-400 font-medium shrink-0">Feed:</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-md p-0.5 shrink-0 flex-nowrap">
              <button
                onClick={() => onSelectProvider('BINANCE')}
                title="Live Binance Public WebSocket & REST Klines"
                className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  providerMode === 'BINANCE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className={`w-3 h-3 ${providerMode === 'BINANCE' ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                <span>Binance Live</span>
              </button>
              <button
                onClick={() => onSelectProvider('MOCK')}
                title="Simulated high-fidelity test market"
                className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  providerMode === 'MOCK'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${providerMode === 'MOCK' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>Demo Mock</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Stats: Live Price, Spread, Candle & Status in the SAME unbroken line */}
        <div className="flex items-center gap-3 font-mono shrink-0 flex-nowrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider">Price</span>
            <span
              className={`text-sm font-bold tabular-nums transition-colors duration-200 ${
                isUp ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPrice(currentPrice, asset.pipDecimals)}
            </span>
            {isUp ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[11px] shrink-0">
            <span>Spread:</span>
            <span className="text-slate-200 tabular-nums">
              {(asset.spread * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1)} pips
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>O:</span>
            <span className="text-slate-300">
              {latestCandle ? formatPrice(latestCandle.open, asset.pipDecimals) : '--'}
            </span>
            <span className="text-emerald-400/80">
              H: {latestCandle ? formatPrice(latestCandle.high, asset.pipDecimals) : '--'}
            </span>
            <span className="text-rose-400/80">
              L: {latestCandle ? formatPrice(latestCandle.low, asset.pipDecimals) : '--'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] border-l border-slate-800 pl-2.5 shrink-0">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                providerMode === 'BINANCE' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className={providerMode === 'BINANCE' ? 'text-amber-300' : 'text-emerald-300'}>
              {providerMode === 'BINANCE' ? 'Binance WS Live' : 'Mock Sim Active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

