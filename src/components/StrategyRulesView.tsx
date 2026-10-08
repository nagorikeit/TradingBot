import React from 'react';
import { Sliders, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Layers, ShieldCheck } from 'lucide-react';

export const StrategyRulesView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white font-mono">
            Strategy Engine & Indicator Rule Blueprint
          </h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          TradePulse uses a transparent, rule-based mathematical confirmation engine. Rather than relying on black-box predictions,
          it verifies indicator alignment across 5 distinct trend, momentum, and price confirmation filters.
        </p>
      </div>

      {/* Rules Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bullish (CALL) Rules */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-emerald-400 font-mono">
              CALL (Bullish) Confirmation Matrix (5 Rules)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-emerald-300">1. Trend Filter: EMA 9 &gt; EMA 21</span>
              <p className="text-slate-400">
                Short-term Exponential Moving Average (9) is strictly above medium-term (21), establishing dynamic bullish trend alignment.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-emerald-300">2. Momentum Filter: RSI (14) &gt; 50</span>
              <p className="text-slate-400">
                Relative Strength Index with Wilder's smoothing is above the median 50 mark, confirming upside buying momentum.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-emerald-300">3. MACD Convergence: MACD Line &gt; Signal</span>
              <p className="text-slate-400">
                Fast EMA 12 minus Slow EMA 26 is above the 9-period Signal line, with positive or expanding histogram.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-emerald-300">4. Dynamic Support: Price &gt; EMA 21</span>
              <p className="text-slate-400">
                Current candle close is situated above the 21-period baseline, confirming respect for structural support.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-emerald-300">5. Candle Confirmation: Close &gt; Open</span>
              <p className="text-slate-400">
                The triggering candle closes higher than its open, verifying active buyer domination at signal generation.
              </p>
            </div>
          </div>
        </div>

        {/* Bearish (PUT) Rules */}
        <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ArrowDownRight className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-rose-400 font-mono">
              PUT (Bearish) Confirmation Matrix (5 Rules)
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-rose-300">1. Trend Filter: EMA 9 &lt; EMA 21</span>
              <p className="text-slate-400">
                Short-term Exponential Moving Average (9) is strictly below medium-term (21), establishing dynamic bearish trend alignment.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-rose-300">2. Momentum Filter: RSI (14) &lt; 50</span>
              <p className="text-slate-400">
                Relative Strength Index is below the 50 median mark, confirming active seller momentum.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-rose-300">3. MACD Divergence: MACD Line &lt; Signal</span>
              <p className="text-slate-400">
                MACD line is below the 9-period Signal line, accompanied by a negative or expanding red histogram.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-rose-300">4. Dynamic Resistance: Price &lt; EMA 21</span>
              <p className="text-slate-400">
                Current candle close is below the 21-period baseline, confirming price rejection under resistance.
              </p>
            </div>

            <div className="p-3 bg-slate-900/80 rounded border border-slate-800 space-y-1">
              <span className="font-mono font-bold text-rose-300">5. Candle Confirmation: Close &lt; Open</span>
              <p className="text-slate-400">
                The triggering candle closes lower than its open, verifying seller control into the signal close.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring Tiers & No-Force WAIT Discipline */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Scoring Tiers & No-Force "WAIT" Discipline
        </h3>
        <p className="text-xs text-slate-400">
          Rule scores reflect mathematical condition alignment count, not guaranteed win probability.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-900 p-3.5 rounded border border-emerald-900/60 bg-emerald-950/10">
            <span className="font-mono font-bold text-emerald-400 block text-sm">5 / 5 — STRONG</span>
            <span className="text-slate-300 text-[11px] mt-1 block">
              All 5 indicators aligned in harmonious directional agreement. Highest confirmation standard; eligible for immediate execution.
            </span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded border border-amber-900/60 bg-amber-950/10">
            <span className="font-mono font-bold text-amber-300 block text-sm">4 / 5 — QUALIFIED</span>
            <span className="text-slate-300 text-[11px] mt-1 block">
              4 indicator rules satisfied with 1 non-fatal neutral condition. Meets quantitative qualification threshold for trade execution.
            </span>
          </div>

          <div className="bg-slate-900 p-3.5 rounded border border-slate-800 bg-slate-950/40">
            <span className="font-mono font-bold text-slate-400 block text-sm">≤ 3 / 5 — WAIT / NO SIGNAL</span>
            <span className="text-slate-400 text-[11px] mt-1 block">
              Below the 4/5 qualification minimum. Strictly rejected from scanner, pending trades, and trade history. The engine refuses to force entries.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
