import React from 'react';
import { Signal, Candle } from '../types';
import { getAssetInfo } from '../data/marketDataProvider';
import { formatPrice, formatTime, getPriceChangePip } from '../utils/formatters';
import { ArrowUpRight, ArrowDownRight, Pause, CheckCircle2, AlertCircle, Radio, Clock, ShieldCheck, Zap } from 'lucide-react';

interface SignalHeroCardProps {
  signal: Signal | null;
  latestCandle: Candle | null;
  isScanning: boolean;
  timeframe: string;
}

export const SignalHeroCard: React.FC<SignalHeroCardProps> = ({
  signal,
  latestCandle,
  isScanning,
  timeframe,
}) => {
  if (!signal) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center min-h-[320px] text-center">
        <Radio className="w-8 h-8 text-emerald-400 animate-pulse mb-3" />
        <h3 className="text-sm font-semibold text-white">INITIALIZING SCANNER</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Loading market candle series and calculating technical indicators...
        </p>
      </div>
    );
  }

  const asset = getAssetInfo(signal.symbol);
  const currentPrice = latestCandle ? latestCandle.close : signal.entryPrice;
  const pipInfo = getPriceChangePip(signal.entryPrice, currentPrice, asset.pipDecimals);

  const isCall = signal.direction === 'CALL';
  const isPut = signal.direction === 'PUT';
  const isWait = signal.direction === 'WAIT';

  // Expiry calculation
  const now = Date.now();
  const msRemaining = Math.max(0, signal.expiryTime - now);
  const secondsRemaining = Math.ceil(msRemaining / 1000);
  const expiryExpired = secondsRemaining <= 0;

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden shadow-lg relative">
      {/* Top Banner: Asset, Timeframe, Scanning indicator */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Trading Signal Analysis
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-lg font-bold text-white font-mono">{signal.symbol}</span>
            <span className="text-xs text-slate-400 font-mono">·</span>
            <span className="text-xs font-semibold text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              {timeframe.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Scanning indicator */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-full">
          <div className="relative flex items-center justify-center">
            <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            {isScanning && (
              <span className="absolute w-4 h-4 rounded-full bg-amber-400/40 animate-ping" />
            )}
          </div>
          <span className={`text-[11px] font-mono font-medium ${isScanning ? 'text-amber-400' : 'text-slate-300'}`}>
            {isScanning ? 'SCANNING...' : 'LIVE ACTIVE'}
          </span>
        </div>
      </div>

      {/* Main Signal Display */}
      <div className="p-4 sm:p-6 space-y-5">
        {/* Signal Direction + Strength Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          {/* Signal Direction Box */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              isCall
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400'
                : isPut
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-400'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
            }`}
          >
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">
              Signal Action
            </span>
            <div className="flex items-center gap-2 mt-1">
              {isCall && <ArrowUpRight className="w-8 h-8 text-emerald-400 stroke-[2.5]" />}
              {isPut && <ArrowDownRight className="w-8 h-8 text-rose-400 stroke-[2.5]" />}
              {isWait && <Pause className="w-7 h-7 text-amber-400" />}

              <div className="flex flex-col">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight">
                  {isCall ? 'CALL ↑' : isPut ? 'PUT ↓' : 'WAIT ⏸'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {isCall
                    ? 'Bullish rule alignment confirmed'
                    : isPut
                    ? 'Bearish rule alignment confirmed'
                    : 'Awaiting indicator alignment'}
                </span>
              </div>
            </div>
          </div>

          {/* Strength & Score Box */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">
                Strategy Confirmation
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                Score {signal.scoreRatio}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                  {signal.signalStrength}%
                </span>
                <span className="text-xs text-slate-400">strength</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {signal.confidenceScore >= 80 ? 'Very Strong' : signal.confidenceScore >= 60 ? 'Strong' : 'Moderate'}
              </span>
            </div>

            {/* Strength progress bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  isCall ? 'bg-emerald-500' : isPut ? 'bg-rose-500' : 'bg-slate-600'
                }`}
                style={{ width: `${signal.signalStrength}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pricing & Expiry Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80">
          <div>
            <span className="text-slate-400 block text-[11px]">Entry Price</span>
            <span className="text-white font-mono font-bold text-sm tabular-nums mt-0.5 block">
              {formatPrice(signal.entryPrice, asset.pipDecimals)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Current Price</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-white font-mono font-bold text-sm tabular-nums">
                {formatPrice(currentPrice, asset.pipDecimals)}
              </span>
              <span
                className={`text-[10px] font-mono font-medium ${
                  pipInfo.isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({pipInfo.pipText})
              </span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Signal Time</span>
            <span className="text-slate-300 font-mono text-xs mt-0.5 block">
              {formatTime(signal.signalTime)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Expiry</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-200 font-mono text-xs">
                {signal.expiryCandles} {signal.expiryCandles === 1 ? 'candle' : 'candles'} ({timeframe})
              </span>
            </div>
          </div>
        </div>

        {/* Indicator Values Snapshot */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
            Technical Indicators Snapshot
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px] font-mono">
            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">EMA 9</span>
              <span className="text-cyan-400 font-semibold tabular-nums">
                {formatPrice(signal.indicators.ema9, asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">EMA 21</span>
              <span className="text-amber-400 font-semibold tabular-nums">
                {formatPrice(signal.indicators.ema21, asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">RSI (14)</span>
              <span
                className={`font-semibold tabular-nums ${
                  signal.indicators.rsi > 50 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {signal.indicators.rsi.toFixed(1)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">MACD (12,26,9)</span>
              <span
                className={`font-semibold tabular-nums ${
                  signal.indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {signal.indicators.macd.macd.toFixed(asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">BB Upper/Lower</span>
              <span className="text-purple-400 font-semibold tabular-nums text-[10px]">
                {formatPrice(signal.indicators.bollingerBands.upper, asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">ATR (14)</span>
              <span className="text-slate-300 font-semibold tabular-nums">
                {formatPrice(signal.indicators.atr, asset.pipDecimals)}
              </span>
            </div>
          </div>
        </div>

        {/* Reasons List */}
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              Strategy Rule Confirmation Checklist
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Rule engine v1.0
            </span>
          </div>

          <div className="space-y-1.5">
            {signal.reasons.map((reason, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs bg-slate-900/50 border border-slate-800/60 p-2 rounded text-slate-300"
              >
                {isWait ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
