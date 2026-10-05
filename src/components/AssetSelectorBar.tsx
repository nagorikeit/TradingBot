import React from 'react';
import { SUPPORTED_ASSETS, getAssetInfo } from '../data/marketDataProvider';
import { Candle, TimeframeKey } from '../types';
import { formatPrice } from '../utils/formatters';
import { TrendingUp, TrendingDown, Layers, Clock } from 'lucide-react';

interface AssetSelectorBarProps {
  selectedSymbol: string;
  selectedTimeframe: TimeframeKey;
  onSelectSymbol: (symbol: string) => void;
  onSelectTimeframe: (timeframe: TimeframeKey) => void;
  latestCandle: Candle | null;
  previousCandle: Candle | null;
}

export const AssetSelectorBar: React.FC<AssetSelectorBarProps> = ({
  selectedSymbol,
  selectedTimeframe,
  onSelectSymbol,
  onSelectTimeframe,
  latestCandle,
  previousCandle,
}) => {
  const asset = getAssetInfo(selectedSymbol);

  const currentPrice = latestCandle ? latestCandle.close : asset.basePrice;
  const prevPrice = previousCandle ? previousCandle.close : currentPrice;
  const priceDiff = currentPrice - prevPrice;
  const isUp = priceDiff >= 0;

  return (
    <div className="bg-[#111827] border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Asset select & Timeframes */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Symbol Select */}
          <div className="flex items-center gap-1.5">
            <label className="text-slate-400 font-medium hidden sm:inline">Asset:</label>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-md p-0.5">
              {SUPPORTED_ASSETS.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => onSelectSymbol(a.symbol)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                    selectedSymbol === a.symbol
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {a.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe Select */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 hidden sm:inline">·</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-md p-0.5">
              {(['1m', '5m', '15m'] as TimeframeKey[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => onSelectTimeframe(tf)}
                  className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors ${
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
        </div>

        {/* Right: Live Price and stats */}
        <div className="flex items-center gap-4 font-mono">
          <div className="flex items-center gap-2">
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

          <div className="hidden md:flex items-center gap-2 text-slate-400 text-[11px]">
            <span>Spread:</span>
            <span className="text-slate-200 tabular-nums">
              {(asset.spread * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1)} pips
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Candle:</span>
            <span className="text-slate-300">
              O: {latestCandle ? formatPrice(latestCandle.open, asset.pipDecimals) : '--'}
            </span>
            <span className="text-emerald-400/80">
              H: {latestCandle ? formatPrice(latestCandle.high, asset.pipDecimals) : '--'}
            </span>
            <span className="text-rose-400/80">
              L: {latestCandle ? formatPrice(latestCandle.low, asset.pipDecimals) : '--'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 border-l border-slate-800 pl-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-300">Market Open</span>
          </div>
        </div>
      </div>
    </div>
  );
};
