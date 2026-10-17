import React, { useEffect, useState, useRef } from 'react';
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
  Volume2,
  VolumeX,
  Radar,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { voiceAssistantService } from '../services/voiceAssistantService';
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
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(voiceAssistantService.isVoiceEnabled());
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);
  const [expirySec, setExpirySec] = useState<number>(liveScreenService.getExpirySecondsLeft());
  const [isChartFound, setIsChartFound] = useState<boolean>(liveScreenService.isChartDetected());

  // Diagnostic Status Panel Tracking (Rules 4, 5, 6, 7)
  const [frameCount, setFrameCount] = useState<number>(liveScreenService.getFrameCount());
  const [lastFrameTime, setLastFrameTime] = useState<number>(liveScreenService.getLastFrameTimestamp());
  const [resolution, setResolution] = useState<string>(liveScreenService.getResolution());
  const [apiLatency, setApiLatency] = useState<number>(liveScreenService.getApiLatency());
  const [aiState, setAiState] = useState<string>(liveScreenService.getAiState());
  const [captureState, setCaptureState] = useState<string>(liveScreenService.getCaptureState());
  const [lastErrorReason, setLastErrorReason] = useState<string | null>(liveScreenService.getLastErrorReason());

  // Subscribe to singleton liveScreenService updates
  useEffect(() => {
    const unsub = liveScreenService.subscribe(() => {
      const state = liveScreenService.getState();
      setStreamState(state);
      setResult(liveScreenService.getLatestResult());
      setIsBusy(liveScreenService.isBusy());
      setErrorMessage(liveScreenService.getErrorMessage());
      setExpirySec(liveScreenService.getExpirySecondsLeft());
      setIsChartFound(liveScreenService.isChartDetected());

      setFrameCount(liveScreenService.getFrameCount());
      setLastFrameTime(liveScreenService.getLastFrameTimestamp());
      setResolution(liveScreenService.getResolution());
      setApiLatency(liveScreenService.getApiLatency());
      setAiState(liveScreenService.getAiState());
      setCaptureState(liveScreenService.getCaptureState());
      setLastErrorReason(liveScreenService.getLastErrorReason());

      // Auto-open floating modal upon connecting (as explicitly requested by user)
      if (liveScreenService.shouldAutoOpenModal() || ((state === 'STREAMING' || state === 'CONNECTING') && !isOpen)) {
        setIsOpen(true);
        liveScreenService.clearAutoOpenModal();
      }
    });
    return unsub;
  }, [isOpen]);

  // Subscribe to voice assistant announcements
  useEffect(() => {
    const unsubVoice = voiceAssistantService.subscribe((text) => {
      setVoiceNotification(text);
      setIsVoiceOn(voiceAssistantService.isVoiceEnabled());
      const timer = setTimeout(() => {
        setVoiceNotification((prev) => (prev === text ? null : prev));
      }, 6000);
      return () => clearTimeout(timer);
    });
    return unsubVoice;
  }, []);

  const isStreaming = streamState === 'STREAMING';
  const isPaused = streamState === 'PAUSED';
  const isConnecting = streamState === 'CONNECTING';
  const isActive = isStreaming || isPaused || isConnecting;

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
    setIsOpen(false);
  };

  const handleManualSnap = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.captureAndAnalyzeCurrentFrame();
  };

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await liveScreenService.connectScreen();
  };

  const handleToggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = voiceAssistantService.toggleVoice();
    setIsVoiceOn(next);
  };

  const handleOpenFullScreen = () => {
    onNavigateToLiveScreen();
  };

  const countdownMin = Math.floor(expirySec / 60);
  const countdownRemainderSec = expirySec % 60;
  const formattedCountdown = `${String(countdownMin).padStart(2, '0')}:${String(countdownRemainderSec).padStart(2, '0')}`;
  const countdownPercent = Math.max(0, Math.min(100, Math.round((expirySec / 60) * 100)));

  return (
    <div className="fixed bottom-5 right-5 z-50 select-none">
      {/* 1. Collapsed Floating Pill/Button (Always floating and visible) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl border backdrop-blur-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
            isStreaming
              ? isChartFound
                ? 'bg-slate-900/95 border-emerald-500/70 text-slate-100 ring-2 ring-emerald-500/40 shadow-emerald-950/50'
                : 'bg-slate-900/95 border-amber-500/70 text-slate-100 ring-2 ring-amber-500/30 shadow-amber-950/50'
              : isPaused
              ? 'bg-slate-900/95 border-amber-500/60 text-slate-100 ring-2 ring-amber-500/20'
              : isConnecting
              ? 'bg-slate-900/95 border-cyan-500/70 text-slate-100 ring-2 ring-cyan-500/40 animate-pulse'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-cyan-500/50 shadow-xl'
          }`}
          title="Live AI Floating HUD (ক্লিক করে খুলুন)"
        >
          <div className="relative flex items-center justify-center">
            {isStreaming ? (
              isChartFound ? (
                <Radar className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
              ) : (
                <Radar className="w-5 h-5 text-amber-400 animate-pulse" />
              )
            ) : isConnecting ? (
              <Monitor className="w-5 h-5 text-cyan-400 animate-pulse" />
            ) : (
              <Monitor className="w-5 h-5 text-slate-400" />
            )}

            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>

          <div className="flex flex-col text-left">
            <span className="text-xs font-bold tracking-wide font-mono">
              {isStreaming ? (
                isChartFound && result ? (
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`font-black ${
                        result.direction === 'UP'
                          ? 'text-emerald-400'
                          : result.direction === 'DOWN'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {result.direction === 'UP' ? '▲ CALL / UP' : result.direction === 'DOWN' ? '▼ PUT / DOWN' : '⏸ WAIT'}
                    </span>
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-700/60">
                      ⏱ {formattedCountdown}
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                    <span>⏸ চার্ট পাওয়া যায়নি</span>
                  </span>
                )
              ) : isPaused ? (
                <span className="text-amber-400 font-medium">⏸ PAUSED</span>
              ) : isConnecting ? (
                <span className="text-cyan-400 font-medium">কানেক্ট হচ্ছে...</span>
              ) : (
                <span className="text-slate-300">Live AI HUD</span>
              )}
            </span>
          </div>
        </button>
      )}

      {/* 2. Expanded Floating Mini Modal / Control Panel (Smart Rounded System) */}
      {isOpen && (
        <div className="w-80 sm:w-92 rounded-3xl bg-[#090e1a]/95 border border-slate-700/80 shadow-2xl backdrop-blur-2xl p-4 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                  isStreaming
                    ? isChartFound
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : isConnecting
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {isStreaming ? (
                  <Radar className={`w-3.5 h-3.5 ${isChartFound ? 'animate-spin' : 'animate-pulse'}`} style={{ animationDuration: '4s' }} />
                ) : (
                  <Monitor className="w-3.5 h-3.5" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide">
                  {isStreaming ? (isChartFound ? 'TradePulse AI' : 'চার্ট স্ক্যানিং') : 'Live AI Assistant'}
                </h3>
                <span
                  className={`text-[10px] font-mono flex items-center gap-1 ${
                    isStreaming
                      ? isChartFound
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {isStreaming
                    ? isChartFound
                      ? '● সিগন্যাল সক্রিয়'
                      : '● চার্ট খোঁজা হচ্ছে'
                    : isConnecting
                    ? 'কানেক্ট হচ্ছে...'
                    : 'ডিসকানেক্টেড'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleVoice}
                className={`p-1.5 rounded-full transition-colors ${
                  isVoiceOn
                    ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/50 border border-emerald-800/60'
                    : 'text-slate-500 hover:text-slate-400 bg-slate-800/60'
                }`}
                title={isVoiceOn ? 'ভয়েস সহকারী বন্ধ করুন' : 'ভয়েস সহকারী চালু করুন'}
              >
                {isVoiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleOpenFullScreen}
                className="p-1.5 text-slate-400 hover:text-cyan-300 bg-slate-800/60 rounded-full transition-colors"
                title="ফুল স্ক্রিন ড্যাশবোর্ড"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-full transition-colors"
                title="মিনিমাইজ করুন"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Voice Notification (Compact pill) */}
          {voiceNotification && (
            <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center gap-2 text-[10px] text-cyan-200">
              <Volume2 className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
              <div className="truncate">🗣️ {voiceNotification}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-2 p-2 rounded-xl bg-red-950/50 border border-red-800/60 flex items-center gap-2 text-[11px] text-red-200">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div className="truncate">{errorMessage}</div>
            </div>
          )}

          {/* Countdown & Status Body */}
          <div className="mt-2.5 space-y-2">
            {/* Active Candle Countdown: ONLY visible AFTER chart is detected and analyzed! */}
            {isStreaming && isChartFound && result && result.visionData?.isClearTradingChart && (
              <div className="px-3 py-2 rounded-2xl bg-slate-950/90 border border-cyan-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-slate-300">
                    ক্যান্ডেল ভ্যালিডিটি:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-14 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-1.5 transition-all duration-1000 rounded-full"
                      style={{ width: `${countdownPercent}%` }}
                    />
                  </div>
                  <span className="text-xs font-black font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-700/60">
                    ⏱ {formattedCountdown}
                  </span>
                </div>
              </div>
            )}

            {/* Case 1: Chart Analyzed -> Smart, Sleek Direction Pill */}
            {isStreaming && isChartFound && result && result.visionData?.isClearTradingChart ? (
              <div
                className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all ${
                  result.direction === 'UP'
                    ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200'
                    : result.direction === 'DOWN'
                    ? 'bg-rose-950/30 border-rose-500/60 text-rose-200'
                    : 'bg-amber-950/30 border-amber-500/60 text-amber-200'
                }`}
              >
                {/* Symbol & Direction Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {result.direction === 'UP' ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    ) : result.direction === 'DOWN' ? (
                      <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
                        <Clock className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-black font-mono">
                        {result.direction === 'UP' && '▲ CALL (UP)'}
                        {result.direction === 'DOWN' && '▼ PUT (DOWN)'}
                        {result.direction === 'WAIT' && '⏸ WAIT'}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        {result.direction === 'UP' ? 'পরবর্তী ক্যান্ডেলে BUY' : result.direction === 'DOWN' ? 'পরবর্তী ক্যান্ডেলে SELL' : 'অপেক্ষা করুন'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-white font-mono bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-700">
                      {result.visionData?.symbol || 'AUD/CHF'}
                    </div>
                    <div className="text-[10px] text-cyan-300 font-semibold mt-0.5">
                      {result.confidence}% কনফিডেন্স
                    </div>
                  </div>
                </div>

                {/* Short Pattern Summary */}
                <div className="text-[10px] text-slate-300 bg-slate-950/50 px-2.5 py-1.5 rounded-xl border border-slate-800/70 truncate">
                  💡 {result.visionData?.candlestickPattern || result.reasoning[0] || 'মোমেন্টাম নিশ্চিত'}
                </div>
              </div>
            ) : isStreaming && (!isChartFound || !result || !result.visionData?.isClearTradingChart) ? (
              /* Case 2: Streaming, Chart not found (WAIT state) */
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/40 text-amber-200 flex flex-col items-center text-center gap-2 animate-in fade-in">
                <Radar className="w-6 h-6 text-amber-400" />
                <div>
                  <div className="text-xs font-bold text-amber-300">⏸ চার্ট পাওয়া যায়নি (State: WAIT)</div>
                  <div className="text-[10px] text-slate-300 mt-1 max-w-[240px]">
                    ট্রেডিং চার্ট (Binomo/Quotex/TradingView) স্ক্রিনে দৃশ্যমান রাখুন। চার্ট পেলেই স্বয়ংক্রিয় এনালাইসিস শুরু হবে।
                  </div>
                </div>
              </div>
            ) : isConnecting ? (
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-cyan-800/60 text-center text-xs text-cyan-300 font-mono space-y-2">
                <div className="animate-pulse flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>স্ক্রিনের সাথে কানেক্ট হচ্ছে...</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    liveScreenService.cancelConnecting();
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  বাতিল করুন (Cancel)
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                লাইভ স্ক্রিন বর্তমানে ডিসকানেক্টেড।
              </div>
            )}

            {/* Real-Time Diagnostic Status Panel (Rules 4, 5, 6, 7) */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Screen Capture:</span>
                <span
                  className={
                    captureState === 'RUNNING' || isStreaming
                      ? 'text-emerald-400 font-bold'
                      : captureState === 'PAUSED'
                      ? 'text-amber-400 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {captureState === 'RUNNING' || isStreaming
                    ? '● চলছে (Active)'
                    : captureState === 'PAUSED'
                    ? '⏸ স্থগিত (Paused)'
                    : '○ বন্ধ (Stopped)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Latest Frame:</span>
                <span className="text-cyan-300 font-semibold">
                  {frameCount > 0
                    ? `#${frameCount} • ${lastFrameTime ? new Date(lastFrameTime).toLocaleTimeString() : '--'} (${resolution})`
                    : 'অপেক্ষমাণ...'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Image Status:</span>
                <span className={frameCount > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                  {frameCount > 0 ? '✓ ছবি পাওয়া গেছে' : 'ছবি পাওয়া যায়নি'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Chart Detection:</span>
                <span
                  className={
                    isChartFound
                      ? 'text-emerald-400 font-bold'
                      : isStreaming
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }
                >
                  {isChartFound
                    ? '✓ চার্ট পাওয়া গেছে'
                    : isStreaming
                    ? '● শনাক্ত হচ্ছে...'
                    : 'শনাক্ত করা যায়নি'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">AI Analysis:</span>
                <span
                  className={
                    aiState === 'READY'
                      ? 'text-emerald-400 font-bold'
                      : aiState === 'ANALYZING'
                      ? 'text-amber-400 animate-pulse'
                      : aiState === 'ERROR' || aiState === 'TIMEOUT'
                      ? 'text-rose-400 font-bold'
                      : 'text-slate-400'
                  }
                >
                  {aiState === 'ANALYZING'
                    ? `বিশ্লেষণ চলছে... (${apiLatency > 0 ? apiLatency + 'ms' : ''})`
                    : aiState === 'READY'
                    ? `সম্পন্ন (${apiLatency}ms)`
                    : aiState === 'TIMEOUT'
                    ? 'টাইমআউট'
                    : aiState === 'ERROR'
                    ? 'ব্যর্থ'
                    : 'অপেক্ষমাণ'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5 mt-1">
                <span className="text-slate-400">Result:</span>
                <span
                  className={
                    isChartFound && result?.direction === 'UP'
                      ? 'text-emerald-400 font-black'
                      : isChartFound && result?.direction === 'DOWN'
                      ? 'text-rose-400 font-black'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {isChartFound && result
                    ? result.direction === 'UP'
                      ? '▲ BUY / CALL'
                      : result.direction === 'DOWN'
                      ? '▼ SELL / PUT'
                      : '⏸ WAIT'
                    : '⏸ WAIT'}
                </span>
              </div>

              {(errorMessage || lastErrorReason) && (
                <div className="flex items-start gap-1.5 text-rose-300 bg-rose-950/70 p-2 rounded-xl border border-rose-800/60 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-[10px] leading-tight break-all">
                    <span className="font-bold">ত্রুটি: </span>
                    {errorMessage || lastErrorReason}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            {isStreaming && (
              <>
                <button
                  onClick={handlePause}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleManualSnap}
                  disabled={isBusy}
                  className="py-2 px-3 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  title="তাত্ক্ষণিক পুনরায় স্ক্যান করুন"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isBusy ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="py-2 px-3.5 text-xs font-bold text-red-200 bg-red-950/70 hover:bg-red-900/80 border border-red-800/80 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  title="ডিসকানেক্ট করুন"
                >
                  <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={handleResume}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Resume</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="py-2 px-3.5 text-xs font-bold text-red-200 bg-red-950/70 hover:bg-red-900/80 border border-red-800/80 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Square className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {!isStreaming && !isPaused && (
              <div className="w-full">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full py-2.5 px-3 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all disabled:opacity-50 active:scale-95"
                >
                  <Monitor className="w-4 h-4" />
                  <span>{isConnecting ? 'কানেক্ট হচ্ছে...' : 'Connect Screen'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center gap-1 text-emerald-400/80">
              <ShieldCheck className="w-3 h-3" />
              <span>ডিসকানেক্ট না করা পর্যন্ত ভাসমান থাকবে</span>
            </div>
            <button
              onClick={handleOpenFullScreen}
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>ফুল ভিউ</span>
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
