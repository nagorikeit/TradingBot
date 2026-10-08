import React, { useState } from 'react';
import { Signal, SignalResult } from '../types';
import { getAssetInfo } from '../data/marketDataProvider';
import { formatPrice, formatTime, formatDate } from '../utils/formatters';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, Clock, Trash2, ChevronDown, ChevronUp, Filter, Info } from 'lucide-react';

interface SignalHistoryTableProps {
  signals: Signal[];
  onClearHistory: () => void;
}

export const SignalHistoryTable: React.FC<SignalHistoryTableProps> = ({
  signals,
  onClearHistory,
}) => {
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredSignals = signals.filter((s) => {
    if (s.direction === 'WAIT') return false; // History focuses on actionable CALL/PUT signals
    if (filterResult === 'ALL') return true;
    return s.result === filterResult;
  });

  const getResultBadge = (result?: SignalResult) => {
    switch (result) {
      case 'WIN':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> WIN
          </span>
        );
      case 'LOSS':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-rose-400 bg-rose-950/80 border border-rose-800/80 px-2 py-0.5 rounded">
            <XCircle className="w-3 h-3 text-rose-400" /> LOSS
          </span>
        );
      case 'DRAW':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
            DRAW
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden shadow">
      {/* Header and filters */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white font-mono">Signal History & Verification</span>
          <span className="text-xs text-slate-500 font-mono">({filteredSignals.length} entries)</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter segment */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-xs">
            {['ALL', 'WIN', 'LOSS', 'PENDING'].map((res) => (
              <button
                key={res}
                onClick={() => setFilterResult(res)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                  filterResult === res
                    ? 'bg-slate-800 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {res}
              </button>
            ))}
          </div>

          {/* Clear history */}
          {signals.length > 0 && (
            <button
              onClick={onClearHistory}
              title="Clear all saved history"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredSignals.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs">
          No signals match the selected filter. As new market candles form, signals and their verified outcomes will appear here.
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {filteredSignals.map((sig) => {
            const asset = getAssetInfo(sig.symbol);
            const isCall = sig.direction === 'CALL';
            const isExpanded = expandedId === sig.id;

            return (
              <div key={sig.id} className="hover:bg-slate-900/40 transition-colors">
                {/* Row Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sig.id)}
                  className="px-4 py-3 cursor-pointer flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  {/* Left: Direction & Symbol */}
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                        isCall
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                      }`}
                    >
                      {isCall ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {sig.direction}
                    </span>

                    <div>
                      <span className="font-mono font-bold text-white text-xs">{sig.symbol}</span>
                      <span className="text-slate-500 text-[11px] block">{sig.timeframe}</span>
                    </div>
                  </div>

                  {/* Entry & Exit Prices */}
                  <div className="font-mono text-xs">
                    <span className="text-slate-500 text-[10px] block">ENTRY → EXIT</span>
                    <span className="text-slate-200 tabular-nums font-semibold">
                      {formatPrice(sig.entryPrice, asset.pipDecimals)}
                    </span>
                    <span className="text-slate-500 mx-1.5">→</span>
                    <span className="text-white tabular-nums font-semibold">
                      {sig.exitPrice ? formatPrice(sig.exitPrice, asset.pipDecimals) : '...'}
                    </span>
                  </div>

                  {/* Rule Alignment Tier */}
                  <div className="font-mono text-xs hidden sm:block">
                    <span className="text-slate-500 text-[10px] block">RULE TIER</span>
                    <span className="text-slate-200 font-semibold tabular-nums">
                      {sig.scoreRatio} — {sig.tier ?? (sig.scoreRatio?.startsWith('5') ? 'STRONG' : 'QUALIFIED')}
                    </span>
                  </div>

                  {/* Timestamps */}
                  <div className="font-mono text-xs hidden md:block">
                    <span className="text-slate-500 text-[10px] block">TIME (ENTRY / EXPIRY)</span>
                    <span className="text-slate-400">
                      {formatTime(sig.snapshot?.candleTimestamp ?? sig.signalTime)} / {formatTime(sig.expiryTime)}
                    </span>
                  </div>

                  {/* Outcome Badge & Expand Icon */}
                  <div className="flex items-center gap-2">
                    {getResultBadge(sig.result)}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800/80 space-y-3 text-xs">
                    {/* Snapshot Metadata Banner */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-semibold">IMMUTABLE SIGNAL SNAPSHOT</span>
                        <span>·</span>
                        <span>Source: {sig.snapshot?.marketDataSource ?? 'Live Market'}</span>
                        <span>·</span>
                        <span>Strategy: {sig.snapshot?.strategyVersion ?? 'v1.0.0'}</span>
                      </div>
                      <span className="text-slate-500">
                        Candle: {formatTime(sig.snapshot?.candleTimestamp ?? sig.signalTime)}
                      </span>
                    </div>

                    {/* Indicator values at entry */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Technical Indicators at Entry (Snapshot):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 font-mono text-[11px]">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">EMA 9</span>
                          <span className="text-cyan-400 font-semibold">
                            {formatPrice(sig.snapshot?.ema9 ?? sig.indicators.ema9, asset.pipDecimals)}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">EMA 21</span>
                          <span className="text-amber-400 font-semibold">
                            {formatPrice(sig.snapshot?.ema21 ?? sig.indicators.ema21, asset.pipDecimals)}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">RSI (14)</span>
                          <span className="text-slate-200 font-semibold">
                            {(sig.snapshot?.rsi ?? sig.indicators.rsi).toFixed(1)}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">MACD Line</span>
                          <span className="text-slate-200 font-semibold">
                            {(sig.snapshot?.macd.macd ?? sig.indicators.macd.macd).toFixed(asset.pipDecimals)}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">MACD Signal</span>
                          <span className="text-slate-200 font-semibold">
                            {(sig.snapshot?.macd.signal ?? sig.indicators.macd.signal).toFixed(asset.pipDecimals)}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">ATR Volatility</span>
                          <span className="text-slate-200 font-semibold">
                            {formatPrice(sig.snapshot?.atr ?? sig.indicators.atr, asset.pipDecimals)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rule checklist */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Triggered Rule Confirmations ({sig.scoreRatio} — {sig.tier ?? 'QUALIFIED'}):
                      </span>
                      <ul className="space-y-1 text-slate-300">
                        {sig.reasons.map((r, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Resolution explanation */}
                    {sig.result && sig.result !== 'PENDING' && (
                      <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                        <span>Outcome Evaluation: </span>
                        <strong className="text-white">
                          {sig.direction === 'CALL'
                            ? sig.exitPrice! > sig.entryPrice
                              ? `Call Won (+${((sig.exitPrice! - sig.entryPrice) * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1)} pips above entry)`
                              : `Call Lost (${((sig.exitPrice! - sig.entryPrice) * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1)} pips below entry)`
                            : sig.exitPrice! < sig.entryPrice
                            ? `Put Won (+${((sig.entryPrice - sig.exitPrice!) * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1)} pips below entry)`
                            : `Put Lost (${((sig.entryPrice - sig.exitPrice!) * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1)} pips above entry)`}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
