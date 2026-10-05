import React, { useState } from 'react';
import { BacktestConfig, BacktestResult, TimeframeKey } from '../types';
import { SUPPORTED_ASSETS, getAssetInfo, defaultMarketProvider } from '../data/marketDataProvider';
import { runBacktest } from '../backtest/backtestEngine';
import { formatPrice, formatTime } from '../utils/formatters';
import { Play, TrendingUp, CheckCircle, XCircle, Award, Flame, ShieldAlert, BarChart2 } from 'lucide-react';

export const BacktestView: React.FC = () => {
  const [symbol, setSymbol] = useState<string>('EUR/USD');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1m');
  const [candleCount, setCandleCount] = useState<number>(200);
  const [expiryCandles, setExpiryCandles] = useState<number>(1);
  const [minScoreThreshold, setMinScoreThreshold] = useState<number>(3); // 3 = Moderate, 4 = Strong, 5 = Very Strong
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    // Simulate slight processing delay for clean UX
    setTimeout(async () => {
      const candles = await defaultMarketProvider.getCandles(symbol, timeframe, candleCount);
      const backtestConfig: BacktestConfig = {
        symbol,
        timeframe,
        candleCount,
        expiryCandles,
        minScoreThreshold,
      };
      const res = runBacktest(candles, backtestConfig);
      setResult(res);
      setIsRunning(false);
    }, 400);
  };

  const asset = getAssetInfo(symbol);

  return (
    <div className="space-y-6">
      {/* Control Panel Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              Strategy Backtesting Simulation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate rule-based entry signals on historical candle series to evaluate statistical edge.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
            No Lookahead Bias
          </span>
        </div>

        {/* Configuration Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          {/* Symbol */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Asset Pair</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              {SUPPORTED_ASSETS.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} ({a.category})
                </option>
              ))}
            </select>
          </div>

          {/* Timeframe */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as TimeframeKey)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="1m">1 Minute (1M)</option>
              <option value="5m">5 Minutes (5M)</option>
              <option value="15m">15 Minutes (15M)</option>
            </select>
          </div>

          {/* Historical Candle Sample */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Sample Size</label>
            <select
              value={candleCount}
              onChange={(e) => setCandleCount(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value={100}>100 Candles</option>
              <option value={200}>200 Candles</option>
              <option value={300}>300 Candles</option>
            </select>
          </div>

          {/* Expiry Candles */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Expiry Horizon</label>
            <select
              value={expiryCandles}
              onChange={(e) => setExpiryCandles(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Candle (Quick)</option>
              <option value={2}>2 Candles</option>
              <option value={3}>3 Candles</option>
              <option value={5}>5 Candles</option>
            </select>
          </div>

          {/* Min Score Threshold */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Min Score Filter</label>
            <select
              value={minScoreThreshold}
              onChange={(e) => setMinScoreThreshold(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value={3}>Score ≥ 3/5 (Moderate)</option>
              <option value={4}>Score ≥ 4/5 (Strong)</option>
              <option value={5}>Score = 5/5 (Very Strong)</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4 flex items-center justify-end">
          <button
            onClick={handleRunBacktest}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 shadow"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Calculating Indicators...' : 'Run Historical Backtest'}</span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result ? (
        <div className="space-y-6">
          {/* Top Performance Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Win Rate */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">Win Rate</span>
              <span
                className={`text-2xl font-bold font-mono tabular-nums mt-1 block ${
                  result.winRate >= 60 ? 'text-emerald-400' : result.winRate >= 50 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {result.winRate}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                {result.wins}W - {result.losses}L - {result.draws}D
              </span>
            </div>

            {/* Total Signals */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">Total Signals</span>
              <span className="text-2xl font-bold font-mono text-white tabular-nums mt-1 block">
                {result.totalSignals}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Triggered alerts</span>
            </div>

            {/* Wins */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">Wins</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums mt-1 block">
                {result.wins}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Successful exits</span>
            </div>

            {/* Losses */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">Losses</span>
              <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums mt-1 block">
                {result.losses}
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Adverse moves</span>
            </div>

            {/* Max Consecutive Wins */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">Max Consec. Wins</span>
              <div className="flex items-center gap-1 mt-1">
                <Flame className="w-4 h-4 text-emerald-400" />
                <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                  {result.maxConsecutiveWins}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Longest win streak</span>
            </div>

            {/* Max Consecutive Losses */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg">
              <span className="text-slate-400 text-[11px] block">Max Consec. Losses</span>
              <div className="flex items-center gap-1 mt-1">
                <Flame className="w-4 h-4 text-rose-400" />
                <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                  {result.maxConsecutiveLosses}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Max drawdown streak</span>
            </div>

            {/* Avg Strength */}
            <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-lg col-span-2 sm:col-span-1">
              <span className="text-slate-400 text-[11px] block">Avg Signal Strength</span>
              <span className="text-2xl font-bold font-mono text-white tabular-nums mt-1 block">
                {result.averageSignalStrength}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">Rule alignment avg</span>
            </div>
          </div>

          {/* Equity / Cumulative Win Rate Progression Curve */}
          {result.equityCurve.length > 2 && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white font-mono">
                  Cumulative Win Rate Performance Curve
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Sample: {result.trades.length} trades
                </span>
              </div>

              <div className="w-full h-36 bg-[#090d16] rounded border border-slate-800/80 relative overflow-hidden p-2">
                <svg viewBox="0 0 800 120" preserveAspectRatio="none" className="w-full h-full">
                  {/* Baseline 50% line */}
                  <line x1="0" y1="60" x2="800" y2="60" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="790" y="56" fill="#475569" fontSize="9" textAnchor="end" fontFamily="monospace">
                    50% Breakeven
                  </text>

                  {/* Polyline */}
                  <polyline
                    points={result.equityCurve
                      .map((point, idx) => {
                        const x = (idx / (result.equityCurve.length - 1)) * 800;
                        // Y maps 0-100% to 110-10
                        const y = 110 - (point.winRate / 100) * 100;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Trade Log Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono">
                Backtest Execution Trade Log
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {result.trades.length} entries evaluated
              </span>
            </div>

            {result.trades.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No trades met the selected score threshold ({minScoreThreshold}/5) in this candle range. Try lowering the threshold to 3/5.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Direction</th>
                      <th className="py-2 px-3">Score</th>
                      <th className="py-2 px-3">Entry Price</th>
                      <th className="py-2 px-3">Exit Price</th>
                      <th className="py-2 px-3">Diff</th>
                      <th className="py-2 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {result.trades.map((t) => {
                      const diff = t.exitPrice - t.entryPrice;
                      const pips = (diff * (asset.pipDecimals === 5 ? 10000 : 100)).toFixed(1);

                      return (
                        <tr key={t.index} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3 text-slate-500">{t.index}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`font-bold ${
                                t.direction === 'CALL' ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-300">{t.score}/5</td>
                          <td className="py-2 px-3 text-slate-200">
                            {formatPrice(t.entryPrice, asset.pipDecimals)}
                          </td>
                          <td className="py-2 px-3 text-slate-200">
                            {formatPrice(t.exitPrice, asset.pipDecimals)}
                          </td>
                          <td
                            className={`py-2 px-3 ${
                              diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {diff >= 0 ? `+${pips}` : pips} pips
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                t.result === 'WIN'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                  : t.result === 'LOSS'
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {t.result}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#111827] border border-slate-800/80 rounded-lg p-10 text-center space-y-3">
          <BarChart2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">Backtest Simulation Ready</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Select your desired asset, timeframe, and scoring criteria above and click{' '}
            <strong className="text-emerald-400 font-semibold">"Run Historical Backtest"</strong> to inspect win rates,
            streaks, and execution trade logs.
          </p>
        </div>
      )}
    </div>
  );
};
