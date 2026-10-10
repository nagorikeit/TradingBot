import React, { useEffect, useState } from 'react';
import {
  Monitor,
  Play,
  Pause,
  Square,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Eye,
  Sliders,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';

export const LiveScreenAnalyzer: React.FC = () => {
  const [streamState, setStreamState] = useState<LiveStreamState>(liveScreenService.getState());
  const [result, setResult] = useState<ScreenAnalysisFinalResult | null>(liveScreenService.getLatestResult());
  const [isBusy, setIsBusy] = useState<boolean>(liveScreenService.isBusy());
  const [intervalSec, setIntervalSec] = useState<number>(liveScreenService.getScanIntervalSeconds());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());

  useEffect(() => {
    const unsub = liveScreenService.subscribe(() => {
      setStreamState(liveScreenService.getState());
      setResult(liveScreenService.getLatestResult());
      setIsBusy(liveScreenService.isBusy());
      setIntervalSec(liveScreenService.getScanIntervalSeconds());
      setErrorMessage(liveScreenService.getErrorMessage());
    });
    return unsub;
  }, []);

  const handleConnect = async () => {
    await liveScreenService.connectScreen();
  };

  const handlePause = () => {
    liveScreenService.pause();
  };

  const handleResume = () => {
    liveScreenService.resume();
  };

  const handleDisconnect = () => {
    liveScreenService.disconnect();
  };

  const handleManualSnap = () => {
    liveScreenService.captureAndAnalyzeCurrentFrame();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Controller */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Live Screen Analysis</h2>
                <span
                  className={`px-2 py-0.5 text-xs font-mono font-medium rounded-full ${
                    streamState === 'STREAMING'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                      : streamState === 'PAUSED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : streamState === 'CONNECTING'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {streamState === 'STREAMING' && '● LIVE STREAMING'}
                  {streamState === 'PAUSED' && '⏸ PAUSED'}
                  {streamState === 'CONNECTING' && 'CONNECTING...'}
                  {streamState === 'IDLE' && 'DISCONNECTED'}
                  {streamState === 'DISCONNECTED' && 'DISCONNECTED'}
                  {streamState === 'ERROR' && 'ERROR'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Share your TradingView or broker chart window to inspect candles, indicators, and cross-verify with live market feeds.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {streamState === 'STREAMING' && (
              <>
                <button
                  onClick={handlePause}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleManualSnap}
                  disabled={isBusy}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isBusy ? 'animate-spin' : ''}`} />
                  <span>Inspect Now</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-xs font-medium text-red-200 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                  <span>Disconnect</span>
                </button>
              </>
            )}

            {streamState === 'PAUSED' && (
              <>
                <button
                  onClick={handleResume}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-xs font-medium text-red-200 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                  <span>Disconnect</span>
                </button>
              </>
            )}

            {(streamState === 'IDLE' || streamState === 'DISCONNECTED' || streamState === 'ERROR' || streamState === 'CONNECTING') && (
              <button
                onClick={handleConnect}
                disabled={streamState === 'CONNECTING'}
                className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Monitor className="w-4 h-4" />
                <span>{streamState === 'CONNECTING' ? 'Connecting...' : 'Connect Live Screen'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Refresh Interval Slider & Privacy Note */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Inspection Interval:</span>
            <input
              type="range"
              min="5"
              max="30"
              step="1"
              value={intervalSec}
              onChange={(e) => liveScreenService.setScanIntervalSeconds(Number(e.target.value))}
              className="w-24 accent-cyan-500 cursor-pointer"
            />
            <span className="font-mono font-semibold text-slate-200">{intervalSec}s</span>
          </div>

          <div className="flex items-center gap-2 text-emerald-400/90">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px]">
              Privacy Protected: Account balance and login credentials are automatically redacted.
            </span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start gap-2.5 text-xs text-red-200">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Notice:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* Main Analysis Display Grid */}
      {result ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Signal & Verification Verdict */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Synthesized Signal
              </span>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{new Date(result.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Big Direction Badge */}
            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-1 ${
                result.direction === 'UP'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : result.direction === 'DOWN'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              }`}
            >
              <div className="text-2xl font-black tracking-tight font-mono">
                {result.direction === 'UP' && '▲ UP / CALL'}
                {result.direction === 'DOWN' && '▼ DOWN / PUT'}
                {result.direction === 'WAIT' && '⏸ WAIT'}
              </div>
              <div className="text-xs font-medium opacity-90">{result.verdictTitle}</div>
              <div className="mt-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/60">
                Confidence: {result.confidence}%
              </div>
            </div>

            {/* Market Verification Status Box */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Market Verification:</span>
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    result.marketVerification.status === 'MATCHED'
                      ? 'text-emerald-400'
                      : result.marketVerification.status === 'PRICE_MISMATCH'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {result.marketVerification.status === 'MATCHED' && <CheckCircle2 className="w-3 h-3" />}
                  {result.marketVerification.status === 'PRICE_MISMATCH' && <XCircle className="w-3 h-3" />}
                  {result.marketVerification.status === 'UNSUPPORTED_BROKER_FEED' && <HelpCircle className="w-3 h-3" />}
                  {result.marketVerification.status}
                </span>
              </div>

              {result.marketVerification.livePrice && (
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Live Price:</span>
                  <span className="text-white">${result.marketVerification.livePrice}</span>
                </div>
              )}

              {result.marketVerification.screenPrice && (
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Screen Price:</span>
                  <span className="text-slate-300">${result.marketVerification.screenPrice}</span>
                </div>
              )}

              {result.marketVerification.priceDeltaPercent !== undefined && (
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">Price Deviation:</span>
                  <span
                    className={
                      result.marketVerification.priceDeltaPercent > 1.5
                        ? 'text-rose-400 font-bold'
                        : 'text-emerald-400'
                    }
                  >
                    {result.marketVerification.priceDeltaPercent}%
                  </span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                {result.marketVerification.notes}
              </p>
            </div>
          </div>

          {/* Column 2: Vision Technical Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Visual Technical Data
              </span>
              <span className="text-xs text-cyan-400 font-mono">
                {result.visionData.symbol || 'SYMBOL ?'} ({result.visionData.timeframe || 'TF ?'})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90">
                <span className="text-slate-500 block text-[10px] uppercase">Market Type</span>
                <span className="font-semibold text-slate-200">{result.visionData.marketType}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90">
                <span className="text-slate-500 block text-[10px] uppercase">Trend Structure</span>
                <span className="font-semibold text-slate-200">{result.visionData.chartStructure}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90">
                <span className="text-slate-500 block text-[10px] uppercase">Last Candle Bias</span>
                <span
                  className={`font-semibold ${
                    result.visionData.lastCandleDirection === 'BULLISH'
                      ? 'text-emerald-400'
                      : result.visionData.lastCandleDirection === 'BEARISH'
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {result.visionData.lastCandleDirection}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/90">
                <span className="text-slate-500 block text-[10px] uppercase">Candle Pattern</span>
                <span className="font-semibold text-slate-200">
                  {result.visionData.candlestickPattern || 'None'}
                </span>
              </div>
            </div>

            {/* Visible Indicators on Screen */}
            <div>
              <span className="text-xs font-medium text-slate-400 block mb-2">Visible Indicators:</span>
              {result.visionData.indicatorsIdentified.length > 0 ? (
                <div className="space-y-1.5">
                  {result.visionData.indicatorsIdentified.map((ind, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-300">{ind.name}</span>
                        <span className="text-slate-500 text-[11px] block">{ind.description}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          ind.bias === 'BULLISH'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : ind.bias === 'BEARISH'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {ind.bias}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No specific indicators visible in frame.</p>
              )}
            </div>
          </div>

          {/* Column 3: Reasoning & Safety Disclaimer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Analysis Reasoning
              </span>

              <ul className="space-y-2 text-xs text-slate-300">
                {result.reasoning.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-cyan-400 shrink-0 font-bold">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Safety & Execution Gate</span>
              </div>
              <p>{result.safetyDisclaimer}</p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-900/60 border border-slate-800 border-dashed rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
            <Eye className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Active Screen Stream</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click <strong>"Connect Live Screen"</strong> above and choose your TradingView, broker chart, or Binance tab to start continuous visual analysis.
          </p>
        </div>
      )}
    </div>
  );
};
