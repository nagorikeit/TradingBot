import React, { useState } from 'react';
import { ScannerSignal, MonitoredPairStatus, TimeframeKey } from '../types';
import { scannerService } from '../services/scannerService';
import { getAssetInfo } from '../data/marketDataProvider';
import { formatPrice, formatTime } from '../utils/formatters';
import {
  Radio,
  Power,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Filter,
  Trash2,
  Sliders,
  RefreshCw,
} from 'lucide-react';

interface ScannerViewProps {
  onSelectSymbolForTerminal: (symbol: string) => void;
  onNavigateToTerminal: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onSelectSymbolForTerminal,
  onNavigateToTerminal,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(() => scannerService.getIsRunning());
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isReconciling, setIsReconciling] = useState<boolean>(false);
  const [timeframe, setTimeframe] = useState<TimeframeKey>(() => scannerService.getTimeframe());
  const [signals, setSignals] = useState<ScannerSignal[]>(() => scannerService.getQualifiedSignals());
  const [pairsStatus, setPairsStatus] = useState<MonitoredPairStatus[]>(() => scannerService.getPairsStatus());
  const [scoreFilter, setScoreFilter] = useState<'ALL' | '5' | '4'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  React.useEffect(() => {
    const update = () => {
      setIsRunning(scannerService.getIsRunning());
      setTimeframe(scannerService.getTimeframe());
      setSignals(scannerService.getQualifiedSignals());
      setPairsStatus(scannerService.getPairsStatus());
    };

    update();
    const unsubscribe = scannerService.subscribe(update);

    // Auto-start scanning when entering Scanner tab if not already running
    if (!scannerService.getIsRunning()) {
      setIsStarting(true);
      scannerService.start().finally(() => setIsStarting(false));
    }

    return () => unsubscribe();
  }, []);

  const handleToggleScanner = async () => {
    if (isRunning) {
      scannerService.stop();
    } else {
      setIsStarting(true);
      try {
        await scannerService.start();
      } finally {
        setIsStarting(false);
      }
    }
  };

  const handleTimeframeChange = async (newTf: TimeframeKey) => {
    await scannerService.setTimeframe(newTf);
  };

  const handleSyncScan = async () => {
    setIsReconciling(true);
    try {
      await scannerService.reconcileAllWorkers();
    } finally {
      setIsReconciling(false);
    }
  };

  const handleOpenInTerminal = (symbol: string) => {
    onSelectSymbolForTerminal(symbol);
    onNavigateToTerminal();
  };

  const handleClearSignals = () => {
    scannerService.clearSignals();
  };

  // Filter signals
  const filteredSignals = signals.filter((sig) => {
    if (timeframeFilter === 'ACTIVE' && sig.timeframe !== timeframe) return false;
    if (scoreFilter === '5') return sig.score === 5;
    if (scoreFilter === '4') return sig.score === 4;
    return true;
  });

  // Sort signals: 5/5 first, then by signalTimestamp desc
  const sortedSignals = [...filteredSignals].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.signalTimestamp - a.signalTimestamp;
  });

  const connectedCount = pairsStatus.filter((p) => p.isConnected).length;
  const totalCount = pairsStatus.length;

  return (
    <div className="space-y-6">
      {/* 1. Control Panel Header */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              isRunning ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}>
              <Radio className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono">Multi-Asset Binance Scanner</h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                  isRunning
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isRunning ? 'MONITORING LIVE' : 'PAUSED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simultaneous candle-close evaluation of {totalCount} Binance crypto pairs for 4/5 and 5/5 rule alignment.
              </p>
            </div>
          </div>

          {/* Controls: ON/OFF and Timeframe */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Timeframe selector */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-0.5 text-xs font-mono">
              {(['1m', '5m', '15m'] as TimeframeKey[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => handleTimeframeChange(tf)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    timeframe === tf
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Quick Sync / Re-scan button */}
            <button
              onClick={handleSyncScan}
              disabled={!isRunning || isReconciling}
              title="Force immediate check of closed candles across all 10 pairs"
              className="px-3 py-1.5 text-xs font-mono font-semibold rounded-md transition-all flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isReconciling ? 'Scanning...' : 'Scan Now'}</span>
            </button>

            {/* Toggle Button */}
            <button
              onClick={handleToggleScanner}
              disabled={isStarting}
              className={`px-4 py-1.5 text-xs font-mono font-semibold rounded-md transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                isRunning
                  ? 'bg-rose-600/90 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isStarting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              <span>{isStarting ? 'Connecting...' : isRunning ? 'Stop Scanner' : 'Start Scanner'}</span>
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs font-mono">
          <div className="bg-slate-900/60 border border-slate-800/60 rounded p-2.5">
            <span className="text-slate-400 text-[11px] block">Monitored Pairs</span>
            <span className="text-white font-bold text-sm mt-0.5 block">{totalCount} Pairs</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded p-2.5">
            <span className="text-slate-400 text-[11px] block">WebSocket Streams</span>
            <span className="text-emerald-400 font-bold text-sm mt-0.5 block flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${connectedCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              {isRunning ? `${connectedCount}/${totalCount} Connected` : isStarting ? 'Connecting...' : 'Offline'}
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded p-2.5">
            <span className="text-slate-400 text-[11px] block">Qualified Signals</span>
            <span className="text-amber-400 font-bold text-sm mt-0.5 block">
              {signals.length} Discovered
            </span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded p-2.5">
            <span className="text-slate-400 text-[11px] block">Scan Criterion</span>
            <span className="text-slate-300 font-semibold text-xs mt-0.5 block truncate">
              Closed Candle · ≥ 4/5 Rules
            </span>
          </div>
        </div>
      </div>

      {/* 2. Qualified Signals Feed */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white font-mono">
              Live Confirmed Signals Feed ({sortedSignals.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              (Strong 5/5 & Qualified 4/5)
            </span>
          </div>

          {/* Filter & Clear Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Timeframe Filter */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
              <button
                onClick={() => setTimeframeFilter('ACTIVE')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  timeframeFilter === 'ACTIVE'
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {timeframe.toUpperCase()}
              </button>
              <button
                onClick={() => setTimeframeFilter('ALL')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  timeframeFilter === 'ALL'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All TF
              </button>
            </div>

            {/* Score Filter */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
              <button
                onClick={() => setScoreFilter('ALL')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  scoreFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setScoreFilter('5')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  scoreFilter === '5' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                5/5 STRONG
              </button>
              <button
                onClick={() => setScoreFilter('4')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  scoreFilter === '4' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                4/5 QUALIFIED
              </button>
            </div>

            {signals.length > 0 && (
              <button
                onClick={handleClearSignals}
                title="Clear signal records"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Signals List */}
        {sortedSignals.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800/80 rounded-lg p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Radio className={`w-6 h-6 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            </div>
            <h4 className="text-sm font-semibold text-white font-mono">
              {isRunning ? 'Scanner Monitoring Closed Candles' : 'Scanner is Currently Stopped'}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              {isRunning
                ? 'Listening to live Binance WebSocket streams. When any pair finishes a candle with 4/5 or 5/5 confirmed rule alignment, it will appear here immediately.'
                : 'Click "Start Scanner" above to connect 10 parallel Binance WebSocket streams.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sortedSignals.map((sig) => {
              const asset = getAssetInfo(sig.symbol);
              const isCall = sig.direction === 'CALL';
              const isStrong = sig.score === 5;

              return (
                <div
                  key={sig.id}
                  className={`bg-[#111827] border rounded-lg p-4 transition-all hover:border-slate-700 ${
                    isStrong
                      ? 'border-emerald-500/30 bg-emerald-950/5'
                      : 'border-amber-500/30 bg-amber-950/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Symbol & Direction Badge */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white font-mono">{sig.symbol}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {sig.timeframe.toUpperCase()}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                            isCall
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          }`}
                        >
                          {isCall ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span>{sig.direction}</span>
                        </span>
                      </div>

                      {/* Rule Score Badge */}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${
                            isStrong
                              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                              : 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                          }`}
                        >
                          Score: {sig.score}/5 Rules ({sig.tier === 'STRONG' ? 'STRONG' : 'QUALIFIED'})
                        </span>

                        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>Confirmed Close</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: Action Button */}
                    <button
                      onClick={() => handleOpenInTerminal(sig.symbol)}
                      className="px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors flex items-center gap-1"
                    >
                      <span>Analyze</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Price & Timing Details */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-500 block">Entry Price</span>
                      <span className="text-slate-200 font-semibold mt-0.5 block">
                        {formatPrice(sig.entryPrice, asset.pipDecimals)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Candle Time</span>
                      <span className="text-slate-300 mt-0.5 block">
                        {formatTime(sig.candleTimestamp)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Expiry Target</span>
                      <span className="text-slate-300 mt-0.5 block">
                        {formatTime(sig.expiryTime)}
                      </span>
                    </div>
                  </div>

                  {/* Reasons Chips */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sig.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Live Monitored Pairs Status Grid */}
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white font-mono">
              Monitored Binance Pairs ({pairsStatus.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Real-time Rule Alignment
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {pairsStatus.map((pair) => {
            const asset = getAssetInfo(pair.symbol);
            const isCall = pair.currentDirection === 'CALL';
            const isPut = pair.currentDirection === 'PUT';
            const isWait = pair.currentDirection === 'WAIT';

            return (
              <div
                key={pair.symbol}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs font-mono">{pair.symbol}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        pair.isConnected ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                      title={pair.isConnected ? 'Connected to WebSocket' : 'Disconnected'}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate">{pair.name}</span>

                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xs font-bold font-mono text-slate-200">
                      {formatPrice(pair.price, asset.pipDecimals)}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {pair.candleCount} bars
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      isCall
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isPut
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isWait ? `${pair.currentScore}/5 WAIT` : `${pair.currentScore}/5 ${pair.currentDirection}`}
                  </span>

                  <button
                    onClick={() => handleOpenInTerminal(pair.symbol)}
                    className="text-[11px] text-slate-400 hover:text-white transition-colors flex items-center gap-0.5 font-mono"
                  >
                    <span>View</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
