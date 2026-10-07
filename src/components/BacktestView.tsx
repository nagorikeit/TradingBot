import React, { useState } from 'react';
import { BacktestConfig, BacktestResult, TimeframeKey, BacktestTrade } from '../types';
import { getAssetInfo } from '../data/marketDataProvider';
import { BinanceMarketDataProvider } from '../data/binanceMarketDataProvider';
import { DEFAULT_BACKTEST_SYMBOLS, runMultiAssetBacktest } from '../backtest/backtestEngine';
import { formatPrice, formatTime } from '../utils/formatters';
import {
  Play,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Award,
  Flame,
  ShieldAlert,
  BarChart2,
  AlertTriangle,
  Info,
  Layers,
  Clock,
  Database,
  ArrowRight,
  Filter,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

export const BacktestView: React.FC = () => {
  const [selectedAssetMode, setSelectedAssetMode] = useState<'ALL' | 'SINGLE'>('ALL');
  const [singleSymbol, setSingleSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1m');
  const [candleCount, setCandleCount] = useState<number>(500);
  const [expiryCandles, setExpiryCandles] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SYMBOLS' | 'RULES' | 'TRADES'>('OVERVIEW');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'UNRESOLVED'>('ALL');

  const binanceProvider = React.useMemo(() => new BinanceMarketDataProvider(), []);

  const handleRunBacktest = async () => {
    setIsRunning(true);
    setLoadingProgress('Initializing data query...');

    try {
      const symbolsToTest = selectedAssetMode === 'ALL' ? DEFAULT_BACKTEST_SYMBOLS : [singleSymbol];
      const dataset: { symbol: string; candles: any[] }[] = [];

      for (let idx = 0; idx < symbolsToTest.length; idx++) {
        const sym = symbolsToTest[idx];
        setLoadingProgress(`Fetching ${sym} historical klines (${idx + 1}/${symbolsToTest.length})...`);
        try {
          const candles = await binanceProvider.getCandles(sym, timeframe, candleCount);
          if (candles && candles.length >= 31) {
            dataset.push({ symbol: sym, candles });
          }
        } catch (err) {
          console.warn(`Failed to fetch backtest candles for ${sym}:`, err);
        }
      }

      setLoadingProgress('Evaluating technical rules across candle series without look-ahead bias...');

      // Yield event loop slightly to render progress on mobile
      await new Promise((resolve) => setTimeout(resolve, 50));

      const backtestConfig: BacktestConfig = {
        symbol: selectedAssetMode === 'ALL' ? 'ALL' : singleSymbol,
        timeframe,
        candleCount,
        expiryCandles,
        minScoreThreshold: 4, // Strict eligibility: 4/5 (QUALIFIED) and 5/5 (STRONG) only
      };

      const res = runMultiAssetBacktest(dataset, backtestConfig);
      setResult(res);
    } catch (err) {
      console.error('Backtest run error:', err);
    } finally {
      setIsRunning(false);
      setLoadingProgress('');
    }
  };

  const isSmallSample = result ? result.completedSignals < 30 : false;

  const filteredTrades = result
    ? result.trades.filter((t) => {
        if (tradeFilter === 'ALL') return true;
        return t.result === tradeFilter;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* 1. Configuration Panel */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              Historical Strategy Validation (Backtesting)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Empirical historical measurement of the existing 5-rule technical strategy on real Binance OHLCV candle series.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded shrink-0">
            ✓ Zero Look-Ahead Bias Enforced
          </span>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono">
          {/* Target Mode */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Asset Scope</label>
            <div className="flex rounded border border-slate-700/80 bg-slate-900 p-0.5">
              <button
                type="button"
                onClick={() => setSelectedAssetMode('ALL')}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  selectedAssetMode === 'ALL'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                10 Pairs
              </button>
              <button
                type="button"
                onClick={() => setSelectedAssetMode('SINGLE')}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  selectedAssetMode === 'SINGLE'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Single
              </button>
            </div>
          </div>

          {/* Specific Symbol (if SINGLE mode) */}
          {selectedAssetMode === 'SINGLE' && (
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Symbol</label>
              <select
                value={singleSymbol}
                onChange={(e) => setSingleSymbol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
              >
                {DEFAULT_BACKTEST_SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          {/* Candle History Range */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Historical Sample</label>
            <select
              value={candleCount}
              onChange={(e) => setCandleCount(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value={100}>100 Candles / Pair</option>
              <option value={300}>300 Candles / Pair</option>
              <option value={500}>500 Candles / Pair (Standard)</option>
              <option value={1000}>1,000 Candles / Pair (Deep)</option>
            </select>
          </div>

          {/* Expiry Candles */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Expiry Duration</label>
            <select
              value={expiryCandles}
              onChange={(e) => setExpiryCandles(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Candle (Next Close)</option>
              <option value={2}>2 Candles Forward</option>
              <option value={3}>3 Candles Forward</option>
            </select>
          </div>

          {/* Run Button */}
          <div className="sm:col-span-2 lg:col-span-1 flex items-end">
            <button
              onClick={handleRunBacktest}
              disabled={isRunning}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono font-bold py-1.5 px-4 rounded transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run Validation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading status bar */}
        {isRunning && (
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs font-mono text-amber-400 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>{loadingProgress}</span>
          </div>
        )}
      </div>

      {/* 2. Results Area */}
      {result && (
        <div className="space-y-6">
          {/* Disclaimer & Sample Size Alert */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Historical Validation:</strong> Past performance measured on historical candle closes does not guarantee future market returns.
              </span>
            </div>

            {isSmallSample && (
              <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 rounded shrink-0">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Small Sample (N={result.completedSignals}) · Preliminary Result</span>
              </div>
            )}
          </div>

          {/* Dataset Provenance Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                Dataset Provenance & Boundary
              </span>
              <span className="text-slate-400">
                {result.datasetInfo.symbols.length} Assets · {timeframe.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-slate-400">
              <div>
                <span className="text-slate-500 text-[10px] block">Data Source</span>
                <span className="text-slate-200 font-semibold mt-0.5 block truncate">
                  {result.datasetInfo.source}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Historical Period</span>
                <span className="text-slate-200 font-semibold mt-0.5 block truncate">
                  {formatTime(result.datasetInfo.startTime)} → {formatTime(result.datasetInfo.endTime)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Total Candles Evaluated</span>
                <span className="text-slate-200 font-semibold mt-0.5 block">
                  {result.datasetInfo.totalCandles.toLocaleString()} Bars
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Qualified Signals</span>
                <span className="text-slate-200 font-semibold mt-0.5 block">
                  {result.totalSignals} (≥ 4/5 Rules)
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Completed vs Unresolved</span>
                <span className="text-slate-200 font-semibold mt-0.5 block">
                  {result.completedSignals} completed / {result.unresolved} boundary
                </span>
              </div>
            </div>
          </div>

          {/* Top Metric Cards: Overall Performance */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {/* Win Rate */}
            <div className="col-span-2 bg-[#111827] border border-emerald-500/30 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <span className="text-slate-400 text-xs font-mono block">Historical Win Rate</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    {result.winRate}%
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({result.wins}/{result.completedSignals})
                  </span>
                </div>
              </div>
              <div className="mt-2 text-[11px] font-mono text-slate-400">
                <span>95% Wilson CI: </span>
                <span className="text-slate-200 font-semibold">
                  [{result.confidenceInterval.lower}% - {result.confidenceInterval.upper}%]
                </span>
                <span className="text-[10px] text-slate-500 block">(Statistical Estimate)</span>
              </div>
            </div>

            {/* Wins */}
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[11px] font-mono block">Wins</span>
              <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                {result.wins}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {result.completedSignals > 0 ? ((result.wins / result.completedSignals) * 100).toFixed(1) : 0}% of resolved
              </span>
            </div>

            {/* Losses */}
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[11px] font-mono block">Losses</span>
              <span className="text-xl font-bold text-rose-400 font-mono mt-1 block">
                {result.losses}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {result.completedSignals > 0 ? ((result.losses / result.completedSignals) * 100).toFixed(1) : 0}% of resolved
              </span>
            </div>

            {/* Draws */}
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[11px] font-mono block">Draws</span>
              <span className="text-xl font-bold text-slate-300 font-mono mt-1 block">
                {result.draws}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {result.completedSignals > 0 ? ((result.draws / result.completedSignals) * 100).toFixed(1) : 0}% of resolved
              </span>
            </div>

            {/* Unresolved */}
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3">
              <span className="text-slate-400 text-[11px] font-mono block">Unresolved</span>
              <span className="text-xl font-bold text-amber-400 font-mono mt-1 block">
                {result.unresolved}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Dataset boundary (not loss)
              </span>
            </div>
          </div>

          {/* Streaks & Consistency Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300">Max Consecutive Wins:</span>
              </div>
              <span className="text-sm font-bold text-emerald-400">
                {result.maxConsecutiveWins} in a row
              </span>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-slate-300">Max Consecutive Losses:</span>
              </div>
              <span className="text-sm font-bold text-rose-400">
                {result.maxConsecutiveLosses} in a row
              </span>
            </div>
          </div>

          {/* Core Score Comparison: 5/5 STRONG vs 4/5 QUALIFIED */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 sm:p-5">
            <h3 className="text-sm font-bold text-white font-mono mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Score Tier Performance Comparison (Empirical Measurement)
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">
              Core research question: Does a 5/5 confirmed rule score historically outperform a 4/5 score?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              {/* 5/5 STRONG Card */}
              <div className="bg-slate-900 border border-emerald-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-sm">
                    Score: 5/5 (STRONG)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
                    {result.scoreBreakdown.strong.winRate}% Win Rate
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Signals</span>
                    <span className="font-bold text-white block mt-0.5">
                      {result.scoreBreakdown.strong.totalSignals}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Wins</span>
                    <span className="font-bold text-emerald-400 block mt-0.5">
                      {result.scoreBreakdown.strong.wins}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Losses</span>
                    <span className="font-bold text-rose-400 block mt-0.5">
                      {result.scoreBreakdown.strong.losses}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Draws</span>
                    <span className="font-bold text-slate-300 block mt-0.5">
                      {result.scoreBreakdown.strong.draws}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4/5 QUALIFIED Card */}
              <div className="bg-slate-900 border border-amber-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 text-sm">
                    Score: 4/5 (QUALIFIED)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                    {result.scoreBreakdown.qualified.winRate}% Win Rate
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Signals</span>
                    <span className="font-bold text-white block mt-0.5">
                      {result.scoreBreakdown.qualified.totalSignals}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Wins</span>
                    <span className="font-bold text-emerald-400 block mt-0.5">
                      {result.scoreBreakdown.qualified.wins}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Losses</span>
                    <span className="font-bold text-rose-400 block mt-0.5">
                      {result.scoreBreakdown.qualified.losses}
                    </span>
                  </div>
                  <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Draws</span>
                    <span className="font-bold text-slate-300 block mt-0.5">
                      {result.scoreBreakdown.qualified.draws}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Directional Analysis (CALL vs PUT) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  CALL (Bullish Signals)
                </span>
                <span className="font-bold text-white">
                  {result.directionBreakdown.call.winRate}% Win Rate ({result.directionBreakdown.call.wins}/{result.directionBreakdown.call.completed})
                </span>
              </div>
              <div className="mt-2 text-slate-400 text-[11px]">
                Total: {result.directionBreakdown.call.totalSignals} · Wins: {result.directionBreakdown.call.wins} · Losses: {result.directionBreakdown.call.losses} · Draws: {result.directionBreakdown.call.draws}
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" />
                  PUT (Bearish Signals)
                </span>
                <span className="font-bold text-white">
                  {result.directionBreakdown.put.winRate}% Win Rate ({result.directionBreakdown.put.wins}/{result.directionBreakdown.put.completed})
                </span>
              </div>
              <div className="mt-2 text-slate-400 text-[11px]">
                Total: {result.directionBreakdown.put.totalSignals} · Wins: {result.directionBreakdown.put.wins} · Losses: {result.directionBreakdown.put.losses} · Draws: {result.directionBreakdown.put.draws}
              </div>
            </div>
          </div>

          {/* Tab Navigation for Detailed Breakdowns */}
          <div className="border-b border-slate-800 flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === 'OVERVIEW'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Equity Trend
            </button>
            <button
              onClick={() => setActiveTab('SYMBOLS')}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === 'SYMBOLS'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              By Symbol ({result.symbolBreakdown.length})
            </button>
            <button
              onClick={() => setActiveTab('RULES')}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === 'RULES'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Rule Combinations ({result.ruleCombinations.length})
            </button>
            <button
              onClick={() => setActiveTab('TRADES')}
              className={`px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === 'TRADES'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Trade History Log ({result.trades.length})
            </button>
          </div>

          {/* Tab 1: Equity Curve Trend */}
          {activeTab === 'OVERVIEW' && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
              <h4 className="text-xs font-bold text-white font-mono mb-2">
                Cumulative Outcome Progression
              </h4>
              <p className="text-[11px] text-slate-400 font-mono mb-4">
                Chronological cumulative trajectory of wins and losses across all qualified signals.
              </p>

              {result.equityCurve.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-mono">
                  No completed historical trades in this sample.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Signal #1</span>
                    <span>Cumulative Total: {result.completedSignals} Trades</span>
                    <span>Signal #{result.completedSignals}</span>
                  </div>
                  {/* Visual progression bar */}
                  <div className="w-full h-3 bg-slate-900 rounded overflow-hidden flex border border-slate-800">
                    <div
                      style={{ width: `${result.winRate}%` }}
                      className="bg-emerald-500 h-full transition-all duration-300"
                      title={`Wins: ${result.wins}`}
                    />
                    <div
                      style={{
                        width: `${result.completedSignals > 0 ? (result.losses / result.completedSignals) * 100 : 0}%`,
                      }}
                      className="bg-rose-500 h-full transition-all duration-300"
                      title={`Losses: ${result.losses}`}
                    />
                    <div
                      style={{
                        width: `${result.completedSignals > 0 ? (result.draws / result.completedSignals) * 100 : 0}%`,
                      }}
                      className="bg-slate-600 h-full transition-all duration-300"
                      title={`Draws: ${result.draws}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="text-emerald-400">■ Wins: {result.wins}</span>
                    <span className="text-rose-400">■ Losses: {result.losses}</span>
                    <span className="text-slate-400">■ Draws: {result.draws}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Symbol Breakdown Table */}
          {activeTab === 'SYMBOLS' && (
            <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3">Asset Pair</th>
                    <th className="p-3">Total Signals</th>
                    <th className="p-3">5/5 Strong</th>
                    <th className="p-3">4/5 Qualified</th>
                    <th className="p-3">Wins</th>
                    <th className="p-3">Losses</th>
                    <th className="p-3">Draws</th>
                    <th className="p-3">Unresolved</th>
                    <th className="p-3">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {result.symbolBreakdown.map((s) => (
                    <tr key={s.symbol} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-white">{s.symbol}</td>
                      <td className="p-3 text-slate-300">{s.totalSignals}</td>
                      <td className="p-3 text-emerald-400">{s.strongSignals}</td>
                      <td className="p-3 text-amber-400">{s.qualifiedSignals}</td>
                      <td className="p-3 text-emerald-400 font-semibold">{s.wins}</td>
                      <td className="p-3 text-rose-400 font-semibold">{s.losses}</td>
                      <td className="p-3 text-slate-400">{s.draws}</td>
                      <td className="p-3 text-amber-400/80">{s.unresolved}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            s.winRate >= 55
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : s.winRate >= 45
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                              : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                          }`}
                        >
                          {s.completed > 0 ? `${s.winRate}%` : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Rule Combinations */}
          {activeTab === 'RULES' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="text-slate-400 text-xs">
                Empirical occurrences of specific rule alignments and their historical resolution:
              </div>
              {result.ruleCombinations.length === 0 ? (
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-6 text-center text-slate-500">
                  No rule combinations recorded.
                </div>
              ) : (
                result.ruleCombinations.map((combo, idx) => (
                  <div
                    key={idx}
                    className="bg-[#111827] border border-slate-800 rounded-lg p-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            combo.direction === 'CALL'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {combo.direction}
                        </span>
                        <span className="text-slate-300 font-semibold">
                          Occurred {combo.count} times
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">
                          W: <span className="text-emerald-400">{combo.wins}</span> · L:{' '}
                          <span className="text-rose-400">{combo.losses}</span> · D:{' '}
                          <span className="text-slate-300">{combo.draws}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white font-bold">
                          {combo.winRate}% Win Rate
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {combo.ruleDescriptions.map((desc, i) => (
                        <span
                          key={i}
                          className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded"
                        >
                          {desc}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Trade History Log */}
          {activeTab === 'TRADES' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">
                  Showing {filteredTrades.length} of {result.trades.length} historical signals:
                </span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
                  {(['ALL', 'WIN', 'LOSS', 'UNRESOLVED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTradeFilter(filter)}
                      className={`px-2 py-0.5 rounded transition-colors ${
                        tradeFilter === filter
                          ? 'bg-slate-800 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Asset</th>
                      <th className="p-3">Signal Time</th>
                      <th className="p-3">Direction</th>
                      <th className="p-3">Score</th>
                      <th className="p-3">Entry Price</th>
                      <th className="p-3">Exit Price</th>
                      <th className="p-3">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredTrades.map((t) => {
                      const asset = getAssetInfo(t.symbol);
                      return (
                        <tr key={t.index} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-slate-500">{t.index}</td>
                          <td className="p-3 font-bold text-white">{t.symbol}</td>
                          <td className="p-3 text-slate-300">{formatTime(t.signalTime)}</td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                t.direction === 'CALL'
                                  ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/60'
                                  : 'text-rose-400 bg-rose-950/60 border border-rose-800/60'
                              }`}
                            >
                              {t.direction}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                t.score === 5
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {t.score}/5 {t.tier}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200">
                            {formatPrice(t.entryPrice, asset.pipDecimals)}
                          </td>
                          <td className="p-3 text-slate-200">
                            {t.exitPrice !== undefined
                              ? formatPrice(t.exitPrice, asset.pipDecimals)
                              : 'Pending (Boundary)'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                t.result === 'WIN'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : t.result === 'LOSS'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  : t.result === 'DRAW'
                                  ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
