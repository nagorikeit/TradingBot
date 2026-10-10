import React, { useEffect, useState } from 'react';
import {
  Monitor,
  Play,
  Pause,
  Square,
  Maximize2,
  RefreshCw,
  X,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Upload,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';

interface FloatingLiveScreenControllerProps {
  currentTab: string;
  onNavigateToLiveScreen: () => void;
}

export const FloatingLiveScreenController: React.FC<FloatingLiveScreenControllerProps> = ({
  currentTab,
  onNavigateToLiveScreen,
}) => {
  const [streamState, setStreamState] = useState<LiveStreamState>(liveScreenService.getState());
  const [result, setResult] = useState<ScreenAnalysisFinalResult | null>(liveScreenService.getLatestResult());
  const [isBusy, setIsBusy] = useState<boolean>(liveScreenService.isBusy());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());

  // Subscribe to singleton liveScreenService updates
  useEffect(() => {
    const unsub = liveScreenService.subscribe(() => {
      setStreamState(liveScreenService.getState());
      setResult(liveScreenService.getLatestResult());
      setIsBusy(liveScreenService.isBusy());
      setErrorMessage(liveScreenService.getErrorMessage());
    });
    return unsub;
  }, []);

  // Strict 1-second ticker to enforce 15s TTL for active signals
  useEffect(() => {
    const ticker = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  const isStreaming = streamState === 'STREAMING';
  const isPaused = streamState === 'PAUSED';
  const isConnecting = streamState === 'CONNECTING';
  const isActive = isStreaming || isPaused || isConnecting;

  // Signal TTL check (15 seconds max)
  const isStale = !result || now - result.timestamp > 15000;
  const signalAgeSec = result ? Math.max(0, Math.floor((now - result.timestamp) / 1000)) : 0;

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.pause();
  };

  const handleResume = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.resume();
  };

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.disconnect();
  };

  const handleManualSnap = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.captureAndAnalyzeCurrentFrame();
  };

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      if (base64) {
        await liveScreenService.analyzeImageDirectly(base64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await liveScreenService.connectScreen();
  };

  const handleOpenFullScreen = () => {
    setIsOpen(false);
    onNavigateToLiveScreen();
  };

  // If user is already on the dedicated live-screen tab, keep floating widget unobtrusive or minimized
  if (currentTab === 'live-screen' && !isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* 1. Collapsed Floating Pill/Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-full shadow-2xl border backdrop-blur-md transition-all duration-200 transform hover:scale-105 ${
            isStreaming
              ? 'bg-slate-900/95 border-emerald-500/60 text-slate-100 ring-2 ring-emerald-500/30'
              : isPaused
              ? 'bg-slate-900/95 border-amber-500/60 text-slate-100 ring-2 ring-amber-500/20'
              : isConnecting
              ? 'bg-slate-900/95 border-cyan-500/60 text-slate-100 ring-2 ring-cyan-500/20'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-cyan-500/50'
          }`}
          title="Click to open Live Screen Controller"
        >
          <div className="relative flex items-center justify-center">
            <Monitor className={`w-4 h-4 ${isStreaming ? 'text-emerald-400' : isPaused ? 'text-amber-400' : 'text-cyan-400'}`} />
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <span className="text-xs font-semibold tracking-wide font-mono">
            {isStreaming ? (
              result && !isStale ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className={`font-bold ${
                      result.direction === 'UP'
                        ? 'text-emerald-400'
                        : result.direction === 'DOWN'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {result.direction === 'UP' ? '▲ UP' : result.direction === 'DOWN' ? '▼ DOWN' : '⏸ WAIT'}
                  </span>
                  <span className="text-[10px] text-slate-400">({result.confidence}%)</span>
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">LIVE STREAMING</span>
              )
            ) : isPaused ? (
              <span className="text-amber-400 font-medium">PAUSED</span>
            ) : isConnecting ? (
              <span className="text-cyan-400 font-medium animate-pulse">CONNECTING...</span>
            ) : (
              <span className="text-slate-400">Live Screen</span>
            )}
          </span>
        </button>
      )}

      {/* 2. Expanded Floating Mini Modal / Control Panel */}
      {isOpen && (
        <div className="w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-xl p-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide">Live Screen Controller</h3>
                <span
                  className={`text-[10px] font-mono font-medium ${
                    isStreaming
                      ? 'text-emerald-400'
                      : isPaused
                      ? 'text-amber-400'
                      : isConnecting
                      ? 'text-cyan-400'
                      : 'text-slate-400'
                  }`}
                >
                  {isStreaming ? '● STREAMING (ACTIVE)' : isPaused ? '⏸ PAUSED' : isConnecting ? 'CONNECTING...' : 'DISCONNECTED'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOpenFullScreen}
                className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-md transition-colors"
                title="Open Full Screen Analysis"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
                title="Minimize Controller"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-950/50 border border-red-800/60 flex items-start gap-2 text-[11px] text-red-200">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div className="line-clamp-2">{errorMessage}</div>
            </div>
          )}

          {/* Current Signal Status */}
          <div className="mt-3 space-y-2">
            {isActive && result ? (
              <div
                className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-colors ${
                  isStale
                    ? 'bg-slate-950/80 border-slate-800 text-slate-400'
                    : result.direction === 'UP'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : result.direction === 'DOWN'
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-slate-300">
                    {result.visionData?.symbol || 'CHART ASSET'}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{signalAgeSec}s ago</span>
                    {isStale && <span className="text-amber-400 font-bold ml-1">(STALE)</span>}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-lg font-black font-mono tracking-tight">
                    {isStale ? (
                      <span className="text-slate-400">⏸ SIGNAL EXPIRED</span>
                    ) : (
                      <>
                        {result.direction === 'UP' && '▲ UP / CALL'}
                        {result.direction === 'DOWN' && '▼ DOWN / PUT'}
                        {result.direction === 'WAIT' && '⏸ WAIT'}
                      </>
                    )}
                  </div>
                  <div className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
                    {result.confidence}%
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                  <div className="flex items-center gap-1">
                    <span>Market:</span>
                    <span
                      className={`font-semibold flex items-center gap-0.5 ${
                        result.marketVerification.status === 'MATCHED'
                          ? 'text-emerald-400'
                          : result.marketVerification.status === 'PRICE_MISMATCH'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {result.marketVerification.status === 'MATCHED' && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {result.marketVerification.status === 'PRICE_MISMATCH' && <XCircle className="w-2.5 h-2.5" />}
                      {result.marketVerification.status === 'UNSUPPORTED_BROKER_FEED' && <HelpCircle className="w-2.5 h-2.5" />}
                      {result.marketVerification.status}
                    </span>
                  </div>
                  {result.marketVerification.livePrice && (
                    <span>${result.marketVerification.livePrice}</span>
                  )}
                </div>
              </div>
            ) : isActive ? (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 font-mono">
                Capturing initial screen frame...
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                Live stream is currently disconnected.
              </div>
            )}
          </div>

          {/* Action Button Bar */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            {isStreaming && (
              <>
                <button
                  onClick={handlePause}
                  className="flex-1 py-1.5 px-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3 h-3 text-amber-400" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleManualSnap}
                  disabled={isBusy}
                  className="py-1.5 px-2.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Inspect Current Frame Now"
                >
                  <RefreshCw className={`w-3 h-3 text-cyan-400 ${isBusy ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="py-1.5 px-2.5 text-xs font-medium text-red-200 bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Square className="w-3 h-3 text-red-400 fill-red-400" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={handleResume}
                  className="flex-1 py-1.5 px-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Resume</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="py-1.5 px-2.5 text-xs font-medium text-red-200 bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Square className="w-3 h-3 text-red-400 fill-red-400" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {(!isStreaming && !isPaused) && (
              <div className="w-full flex items-center gap-2">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Connecting...' : 'Connect Screen'}</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                  className="py-2 px-3 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  title="Upload a chart image (Mobile friendly)"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Upload</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Full Screen View Link */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/80">
              <ShieldCheck className="w-3 h-3" />
              <span>Privacy Redacted</span>
            </div>
            <button
              onClick={handleOpenFullScreen}
              className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>Open Full View</span>
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
