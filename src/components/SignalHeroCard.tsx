import React, { useState, useEffect } from 'react';
import { Signal, Candle, EvaluatedRuleItem } from '../types';
import { getAssetInfo } from '../data/marketDataProvider';
import { formatPrice, formatTime, getPriceChangePip } from '../utils/formatters';
import {
  ArrowUpRight,
  ArrowDownRight,
  Pause,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Radio,
  Clock,
  ShieldCheck,
  Layers,
} from 'lucide-react';

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

  // IMMUTABLE SNAPSHOT DATA (Prevents historical signal repainting from live ticks):
  const snapshot = signal.snapshot;
  const entryPrice = snapshot ? snapshot.entryPrice : signal.entryPrice;
  const candleTime = snapshot ? snapshot.candleTimestamp : signal.signalTime;
  const targetExpiryTime = snapshot?.expiryTime ?? signal.expiryTime;

  // Real-time Expiry Countdown Engine (Absolute wall-clock based, 1s interval, leak-free cleanup)
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    return Math.max(0, targetExpiryTime - Date.now());
  });

  useEffect(() => {
    const updateCountdown = () => {
      const diff = Math.max(0, targetExpiryTime - Date.now());
      setRemainingMs(diff);
    };

    // Immediate calculation on mount or signal change
    updateCountdown();

    // If already expired, no timer needed
    if (targetExpiryTime <= Date.now()) {
      return;
    }

    const intervalId = window.setInterval(updateCountdown, 1000);

    // Sync immediately when browser tab becomes visible again
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        updateCountdown();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [signal.id, targetExpiryTime]);

  const isExpired = remainingMs <= 0;
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const countdownFormatted = isExpired
    ? 'EXPIRED'
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const indicators = snapshot
    ? {
        ema9: snapshot.ema9,
        ema21: snapshot.ema21,
        rsi: snapshot.rsi,
        macd: snapshot.macd,
        bollingerBands: snapshot.bollingerBands,
        atr: snapshot.atr,
      }
    : signal.indicators;

  // Live market price (Clearly distinguished from fixed signal snapshot)
  const currentPrice = latestCandle ? latestCandle.close : entryPrice;
  const pipInfo = getPriceChangePip(entryPrice, currentPrice, asset.pipDecimals);

  const isCall = signal.direction === 'CALL';
  const isPut = signal.direction === 'PUT';
  const isWait = signal.direction === 'WAIT';

  // Strict Tier definition: 5/5 = STRONG, 4/5 = QUALIFIED, <= 3/5 = WAIT
  const score = snapshot?.ruleScore ?? (signal.scoreRatio ? parseInt(signal.scoreRatio.split('/')[0], 10) : 0);
  const tier = signal.tier ?? (score === 5 ? 'STRONG' : score === 4 ? 'QUALIFIED' : 'WAIT');
  const scoreRatio = signal.scoreRatio || `${score}/5`;

  // Evaluated Rules (Pass / Fail Checklist)
  const rulesList: EvaluatedRuleItem[] =
    signal.rulesEvaluated ??
    snapshot?.allRulesEvaluated ??
    [];

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
            {snapshot && (
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                Snapshot Locked
              </span>
            )}
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
        {/* Signal Direction + Strategy Confirmation Tier Row */}
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
                    ? `Bullish alignment (${tier})`
                    : isPut
                    ? `Bearish alignment (${tier})`
                    : 'Awaiting minimum 4/5 qualified alignment'}
                </span>
              </div>
            </div>
          </div>

          {/* Rule Alignment & Tier Box (Strict: 5/5 STRONG, 4/5 QUALIFIED, <=3 WAIT) */}
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">
                Strategy Confirmation Tier
              </span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                  tier === 'STRONG'
                    ? 'bg-emerald-950/90 text-emerald-400 border-emerald-700'
                    : tier === 'QUALIFIED'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {scoreRatio} — {tier}
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tabular-nums">
                  {score} / 5
                </span>
                <span className="text-xs text-slate-400">rules satisfied</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {tier === 'STRONG'
                  ? 'Strong Edge (5/5)'
                  : tier === 'QUALIFIED'
                  ? 'Qualified Edge (4/5)'
                  : 'Wait / No Action'}
              </span>
            </div>

            {/* Rule alignment bar without misleading percentage win probability */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  tier === 'STRONG'
                    ? 'bg-emerald-500'
                    : tier === 'QUALIFIED'
                    ? 'bg-amber-400'
                    : 'bg-slate-600'
                }`}
                style={{ width: `${(score / 5) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              * Rule score represents indicator alignment count, not win probability.
            </span>
          </div>
        </div>

        {/* Pricing & Expiry Details Grid (Separating Entry Snapshot from Current Market Price) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-900/40 p-3.5 rounded-lg border border-slate-800/80">
          <div>
            <span className="text-slate-400 block text-[11px]">Entry Price (Snapshot)</span>
            <span className="text-white font-mono font-bold text-sm tabular-nums mt-0.5 block">
              {formatPrice(entryPrice, asset.pipDecimals)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Current Market Price</span>
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
            <span className="text-slate-400 block text-[11px]">Signal Timestamp</span>
            <span className="text-slate-300 font-mono text-xs mt-0.5 block">
              {formatTime(candleTime)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Expiry Countdown</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className={`w-3.5 h-3.5 ${isExpired ? 'text-rose-400' : 'text-cyan-400'}`} />
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded border tabular-nums ${
                  isExpired
                    ? 'text-rose-400 bg-rose-950/80 border-rose-800/80'
                    : 'text-cyan-300 bg-cyan-950/80 border-cyan-800/80'
                }`}
              >
                {countdownFormatted}
              </span>
              <span className="text-slate-400 font-mono text-[10px]">
                ({signal.expiryCandles} {signal.expiryCandles === 1 ? 'candle' : 'candles'} · {timeframe})
              </span>
            </div>
          </div>
        </div>

        {/* Technical Indicators Snapshot (Immutable) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
              Technical Indicators Snapshot (At Signal Candle)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Source: {snapshot?.marketDataSource ?? 'Binance Live'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[11px] font-mono">
            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">EMA 9</span>
              <span className="text-cyan-400 font-semibold tabular-nums">
                {formatPrice(indicators.ema9, asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">EMA 21</span>
              <span className="text-amber-400 font-semibold tabular-nums">
                {formatPrice(indicators.ema21, asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">RSI (14)</span>
              <span
                className={`font-semibold tabular-nums ${
                  indicators.rsi > 50 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {indicators.rsi.toFixed(1)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">MACD (12,26,9)</span>
              <span
                className={`font-semibold tabular-nums ${
                  indicators.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {indicators.macd.macd.toFixed(asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">BB Upper/Lower</span>
              <span className="text-purple-400 font-semibold tabular-nums text-[10px]">
                {formatPrice(indicators.bollingerBands.upper, asset.pipDecimals)}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded">
              <span className="text-slate-500 block text-[10px]">ATR (14)</span>
              <span className="text-slate-300 font-semibold tabular-nums">
                {formatPrice(indicators.atr, asset.pipDecimals)}
              </span>
            </div>
          </div>
        </div>

        {/* Strategy Rule Confirmation Checklist (BATCH 3: PASS / FAIL CLARITY) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
                Strategy Rule Confirmation Checklist (5 Rules Evaluated)
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Strategy {snapshot?.strategyVersion ?? 'v1.0.0'}
            </span>
          </div>

          {/* Pass/Fail Detailed List */}
          {rulesList.length > 0 ? (
            <div className="space-y-1.5">
              {rulesList.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded border text-xs transition-colors ${
                    rule.passed
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200'
                      : 'bg-rose-950/20 border-rose-800/40 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {rule.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white font-mono">{rule.name}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase border ${
                            rule.passed
                              ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700/60'
                              : 'bg-rose-900/60 text-rose-300 border-rose-700/60'
                          }`}
                        >
                          {rule.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono break-words">
                        {rule.passed ? rule.valueText : (rule.failReason || rule.valueText)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Fallback for legacy signals
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
          )}

          {/* Status Verdict Banner */}
          <div className="mt-2">
            {tier === 'STRONG' ? (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>STRONG CONFIRMATION (5/5):</strong> All 5 strategy conditions verified. Maximum alignment edge.
                </span>
              </div>
            ) : tier === 'QUALIFIED' ? (
              <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-amber-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>QUALIFIED CONFIRMATION (4/5):</strong> 4 rules passed with 1 non-fatal neutral condition. Execution eligible.
                </span>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-amber-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>SIGNAL REJECTED / WAIT ({score}/5):</strong> Minimum 4/5 qualified confirmation required. Conflicting or insufficient indicators prevent trade execution.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

