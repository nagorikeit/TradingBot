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

      // Auto-open floating modal upon connecting (as explicitly requested by user)
      if (liveScreenService.shouldAutoOpenModal() || (state === 'STREAMING' && !isOpen)) {
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

  // If user is already on the dedicated live-screen tab and modal is closed, keep out of way
  if (currentTab === 'live-screen' && !isOpen) {
    return null;
  }

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
                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/60">
                      {formattedCountdown}
                    </span>
                  </span>
                ) : (
                  <span className="text-amber-300 font-medium flex items-center gap-1">
                    <span>চার্ট খুঁজছি...</span>
                    <span className="text-[10px] text-slate-400">({formattedCountdown})</span>
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

      {/* 2. Expanded Floating Mini Modal / Control Panel (Auto-opens on Connect & Stays Active) */}
      {isOpen && (
        <div className="w-84 sm:w-96 rounded-2xl bg-[#0b101d]/98 border border-slate-700/80 shadow-2xl backdrop-blur-2xl p-4 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                  isStreaming
                    ? isChartFound
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 ring-2 ring-emerald-500/20'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-400 ring-2 ring-amber-500/20'
                    : isConnecting
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {isStreaming ? (
                  <Radar className={`w-4 h-4 ${isChartFound ? 'animate-spin' : 'animate-pulse'}`} style={{ animationDuration: '4s' }} />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white tracking-wide">Live AI Trading Assistant</h3>
                  <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60 font-mono">
                    HUD
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-[10px] font-mono font-semibold flex items-center gap-1 ${
                      isStreaming
                        ? isChartFound
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                        : isPaused
                        ? 'text-amber-400'
                        : isConnecting
                        ? 'text-cyan-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {isStreaming
                      ? isChartFound
                        ? '● চার্ট সক্রিয় (ACTIVE)'
                        : '● চার্ট খোঁজা হচ্ছে...'
                      : isPaused
                      ? '⏸ PAUSED'
                      : isConnecting
                      ? 'কানেক্ট হচ্ছে...'
                      : 'ডিসকানেক্টেড'}
                  </span>
                  {isStreaming && (
                    <span className="text-[10px] font-mono text-slate-400">
                      • {liveScreenService.isNativeActive() ? 'Android Native' : 'Screen Sync'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleVoice}
                className={`p-1.5 rounded-lg transition-colors ${
                  isVoiceOn
                    ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/50'
                    : 'text-slate-500 hover:text-slate-400 bg-slate-800/60'
                }`}
                title={isVoiceOn ? 'ভয়েস সহকারী বন্ধ করুন' : 'ভয়েস সহকারী চালু করুন'}
              >
                {isVoiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleOpenFullScreen}
                className="p-1.5 text-slate-400 hover:text-cyan-300 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
                title="Open Full Screen Analysis"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
                title="মিনিমাইজ করুন (ভাসমান থাকবে)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Voice Speech Live Notification Banner */}
          {voiceNotification && (
            <div className="mt-2.5 p-2 rounded-lg bg-cyan-950/50 border border-cyan-800/60 flex items-center gap-2 text-[11px] text-cyan-200 animate-in fade-in">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
              <div className="line-clamp-2 leading-tight">🗣️ {voiceNotification}</div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-red-950/50 border border-red-800/60 flex items-start gap-2 text-[11px] text-red-200">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <div className="line-clamp-2">{errorMessage}</div>
            </div>
          )}

          {/* Countdown & Status Body */}
          <div className="mt-3 space-y-2.5">
            {/* Active Expiry Countdown Header Bar (Always ticking and visible during stream) */}
            {isStreaming && (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-300 font-sans">
                    ক্যান্ডেল এক্সপায়ারি কাউন্টডাউন:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-1.5 transition-all duration-1000 rounded-full"
                      style={{ width: `${countdownPercent}%` }}
                    />
                  </div>
                  <span className="text-sm font-black font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/80">
                    {formattedCountdown}
                  </span>
                </div>
              </div>
            )}

            {/* Case 1: Streaming and Chart Found -> Display Guidance */}
            {isStreaming && isChartFound && result ? (
              <div
                className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                  result.direction === 'UP'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-950/40'
                    : result.direction === 'DOWN'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-200 shadow-lg shadow-rose-950/40'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-lg shadow-amber-950/40'
                }`}
              >
                {/* Symbol & Direction */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                    {result.visionData?.symbol || 'CHART ASSET'}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-cyan-300">
                    {result.confidence}% Confidence
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    {result.direction === 'UP' && (
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    )}
                    {result.direction === 'DOWN' && (
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400">
                        <TrendingDown className="w-5 h-5" />
                      </div>
                    )}
                    {result.direction === 'WAIT' && (
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
                        <Clock className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-base font-black tracking-tight font-mono">
                        {result.direction === 'UP' && '▲ CALL / UP ট্রেড'}
                        {result.direction === 'DOWN' && '▼ PUT / DOWN ট্রেড'}
                        {result.direction === 'WAIT' && '⏸ WAIT / অপেক্ষা'}
                      </div>
                      <div className="text-[10px] text-slate-300 font-sans">
                        দিকনির্দেশনা: {result.direction === 'UP' ? 'পরবর্তী ক্যান্ডেলে BUY' : result.direction === 'DOWN' ? 'পরবর্তী ক্যান্ডেলে SELL' : 'মার্কেট সাইডওয়ে'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Strategy Rationale */}
                <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <div className="font-semibold text-slate-200 text-[10px] mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>প্রযুক্তিগত বিশ্লেষণ যুক্তি:</span>
                  </div>
                  <div className="line-clamp-2">{result.reasoning[0] || 'ক্যান্ডেলস্টিক ও ইন্ডিকেটর কনফার্মেশন প্রাপ্ত হয়েছে।'}</div>
                </div>

                {/* Market Price & Status */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono">
                  <div className="flex items-center gap-1">
                    <span>মার্কেট:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      {result.marketVerification.status === 'MATCHED' ? 'ভেরিফাইড' : result.marketVerification.status}
                    </span>
                  </div>
                  {result.visionData?.lastVisiblePrice && (
                    <span>প্রাইস: ${result.visionData.lastVisiblePrice}</span>
                  )}
                </div>
              </div>
            ) : isStreaming && !isChartFound ? (
              /* Case 2: Streaming Active, But Chart Not Detected Yet -> "আমি চার্ট খুঁজে পাইনি" */
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Radar className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
                  <div>
                    <div className="text-xs font-bold text-amber-300">⚠️ আমি চার্ট খুঁজে পাইনি</div>
                    <div className="text-[10px] text-amber-200/80">চার্ট খোঁজা হচ্ছে... (Searching Screen)</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  অনুগ্রহ করে আপনার ট্রেডিং অ্যাপের (Binomo, Quotex, Pocket Option, MT4 বা TradingView) ক্যান্ডেলস্টিক চার্টটি স্ক্রিনে রাখুন। অ্যাপটি স্বয়ংক্রিয়ভাবে চার্ট শনাক্ত করে সিগন্যাল দিবে।
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    স্ক্যানার সক্রিয়
                  </span>
                  <span>কাউন্টডাউন: {formattedCountdown}</span>
                </div>
              </div>
            ) : isConnecting ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-800/60 text-center text-xs text-cyan-300 font-mono animate-pulse">
                স্ক্রিনের সাথে কানেক্ট হচ্ছে... অনুগ্রহ করে অনুমতি নিশ্চিত করুন
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                লাইভ স্ক্রিন বর্তমানে ডিসকানেক্টেড আছে। নিচে "Connect Screen" বাটনে চাপুন।
              </div>
            )}
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
