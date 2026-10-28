import React, { useEffect, useState, useRef } from 'react';
import {
  Square,
  Maximize2,
  RefreshCw,
  Clock,
  Volume2,
  VolumeX,
  Radar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Eye,
  Camera,
  Search,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { voiceAssistantService } from '../services/voiceAssistantService';
import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';
import { Capacitor } from '@capacitor/core';

interface FloatingLiveScreenControllerProps {
  currentTab: string;
  onNavigateToLiveScreen: () => void;
}

export const FloatingLiveScreenController: React.FC<FloatingLiveScreenControllerProps> = ({
  onNavigateToLiveScreen,
}) => {
  const [streamState, setStreamState] = useState<LiveStreamState>(liveScreenService.getState());
  const [result, setResult] = useState<ScreenAnalysisFinalResult | null>(liveScreenService.getLatestResult());
  const [isBusy, setIsBusy] = useState<boolean>(liveScreenService.isBusy());
  const [isScanning, setIsScanning] = useState<boolean>(liveScreenService.isScanning());
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(voiceAssistantService.isVoiceEnabled());
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);
  const [expirySec, setExpirySec] = useState<number>(liveScreenService.getExpirySecondsLeft());
  const [isChartFound, setIsChartFound] = useState<boolean>(liveScreenService.isChartDetected());
  const [frameCount, setFrameCount] = useState<number>(liveScreenService.getFrameCount());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(liveScreenService.isOverlayActive());

  // Dragging state for the floating bubble
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const bubbleStartPos = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Subscribe to liveScreenService updates
  useEffect(() => {
    const unsub = liveScreenService.subscribe(() => {
      const state = liveScreenService.getState();
      setStreamState(state);
      setIsOverlayActive(liveScreenService.isOverlayActive());
      setResult(liveScreenService.getLatestResult());
      setIsBusy(liveScreenService.isBusy());
      setIsScanning(liveScreenService.isScanning());
      setErrorMessage(liveScreenService.getErrorMessage());
      setExpirySec(liveScreenService.getExpirySecondsLeft());
      setIsChartFound(liveScreenService.isChartDetected());
      setFrameCount(liveScreenService.getFrameCount());
    });
    return unsub;
  }, []);

  // Subscribe to voice assistant announcements
  useEffect(() => {
    const unsubVoice = voiceAssistantService.subscribe((text) => {
      setVoiceNotification(text);
      setIsVoiceOn(voiceAssistantService.isVoiceEnabled());
      const timer = setTimeout(() => {
        setVoiceNotification((prev) => (prev === text ? null : prev));
      }, 5000);
      return () => clearTimeout(timer);
    });
    return unsubVoice;
  }, []);

  const isStreaming = streamState === 'STREAMING';
  const isConnecting = streamState === 'CONNECTING';
  const isPaused = streamState === 'PAUSED';

  // 1. On Android native runtime, the Android OS WindowManager system overlay is already active
  // and floating above all apps. Never render a duplicate HTML bubble in the WebView!
  if (Capacitor.isNativePlatform()) {
    return null;
  }

  // 2. Do NOT show floating HUD bubble automatically on connect!
  // ONLY show when user explicitly clicks the "Floating HUD" button (isOverlayActive)
  if (!isOverlayActive || (!isStreaming && !isConnecting && !isPaused)) {
    return null;
  }

  // Single button: triggers scan and locks result without continuous background loops
  const handleToggleScan = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.triggerScanAndLock();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.hideFloatingOverlayHUD();
  };

  const handleToggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = voiceAssistantService.toggleVoice();
    setIsVoiceOn(next);
  };

  const handleBubbleClick = () => {
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    onNavigateToLiveScreen();
  };

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      bubbleStartPos.current = { x: rect.left, y: rect.top };
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const newX = Math.max(10, Math.min(window.innerWidth - 320, bubbleStartPos.current.x + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 90, bubbleStartPos.current.y + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const countdownMin = Math.floor(expirySec / 60);
  const countdownRemainderSec = expirySec % 60;
  const formattedCountdown = `${String(countdownMin).padStart(2, '0')}:${String(countdownRemainderSec).padStart(2, '0')}`;

  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }
    : {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
      };

  const hasChartSignal = Boolean(
    result &&
    (result.direction === 'UP' || result.direction === 'DOWN' || result.visionData?.isClearTradingChart || isChartFound)
  );
  const isTradePulseAppScreen = Boolean(
    result &&
    (result.verdictTitle?.includes('ট্রেডপাল্স') ||
     result.visionData?.detectedAppName?.includes('TradePulse') ||
     result.visionData?.symbol === 'TRADEPULSE_APP' ||
     result.reasoning?.[0]?.includes('ট্রেডপাল্স'))
  );
  const isReadingOtherScreen = Boolean(
    isStreaming &&
    !hasChartSignal &&
    result &&
    (result.screenStatus === 'OTHER_SCREEN_READING' || (result.visionData?.detectedAppName && result.visionData?.detectedAppName !== 'Unknown'))
  );

  return (
    <div
      ref={bubbleRef}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="select-none touch-none animate-in fade-in zoom-in-95 duration-200"
    >
      {/* THE ONLY UNIFIED FLOATING HUD BUBBLE */}
      <div
        onClick={handleBubbleClick}
        className={`group cursor-grab active:cursor-grabbing flex flex-col gap-2 p-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 min-w-[280px] max-w-[340px] ${
          isConnecting
            ? 'bg-slate-900/95 border-cyan-500/70 text-slate-100 ring-2 ring-cyan-500/30'
            : hasChartSignal && result
            ? result.direction === 'UP'
              ? 'bg-slate-900/95 border-emerald-500/80 text-slate-100 ring-2 ring-emerald-500/40 shadow-emerald-950/40'
              : result.direction === 'DOWN'
              ? 'bg-slate-900/95 border-rose-500/80 text-slate-100 ring-2 ring-rose-500/40 shadow-rose-950/40'
              : 'bg-slate-900/95 border-amber-500/70 text-slate-100 ring-2 ring-amber-500/30'
            : isTradePulseAppScreen
            ? 'bg-slate-900/95 border-amber-500/70 text-slate-100 ring-2 ring-amber-500/30'
            : isReadingOtherScreen
            ? 'bg-slate-900/95 border-sky-500/70 text-slate-100 ring-2 ring-sky-500/30'
            : isStreaming
            ? 'bg-slate-900/95 border-cyan-500/60 text-slate-100 ring-2 ring-cyan-500/20'
            : 'bg-slate-900/95 border-slate-700 text-slate-300'
        }`}
        title="ড্র্যাগ করে স্ক্রিনের যেকোনো স্থানে রাখুন"
      >
        {/* Top Info Bar: Status, Signal & Real-Time Data */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Status Radar / Signal Icon */}
            <div className="relative flex items-center justify-center shrink-0">
              {isBusy ? (
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/60 flex items-center justify-center text-cyan-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : isConnecting ? (
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : hasChartSignal && result ? (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                    result.direction === 'UP'
                      ? 'bg-emerald-500/25 border-emerald-500/80 text-emerald-400'
                      : result.direction === 'DOWN'
                      ? 'bg-rose-500/25 border-rose-500/80 text-rose-400'
                      : 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                  }`}
                >
                  {result.direction === 'UP' && <TrendingUp className="w-4 h-4" />}
                  {result.direction === 'DOWN' && <TrendingDown className="w-4 h-4" />}
                  {result.direction === 'WAIT' && <Clock className="w-4 h-4" />}
                </div>
              ) : isTradePulseAppScreen ? (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              ) : isReadingOtherScreen ? (
                <div className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-500/60 flex items-center justify-center text-sky-300">
                  <Eye className="w-4 h-4 animate-pulse" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                  <Radar className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Signal & Verdict Details */}
            <div className="flex flex-col text-left truncate">
              {isBusy ? (
                <div>
                  <div className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                    <span>স্ক্রিন স্ক্যান হচ্ছে...</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">রিয়েল-টাইম ক্যান্ডেল বিশ্লেষণ চলছে</div>
                </div>
              ) : isConnecting ? (
                <div>
                  <div className="text-xs font-bold text-cyan-300 font-mono">স্ক্রিন কানেক্ট হচ্ছে...</div>
                  <div className="text-[10px] text-slate-400">প্রস্তুত হচ্ছে...</div>
                </div>
              ) : hasChartSignal && result ? (
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-black font-mono tracking-tight ${
                        result.direction === 'UP'
                          ? 'text-emerald-400'
                          : result.direction === 'DOWN'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {result.direction === 'UP' && '▲ CALL / UP'}
                      {result.direction === 'DOWN' && '▼ PUT / DOWN'}
                      {result.direction === 'WAIT' && '⏸ WAIT'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">
                      {result.confidence}%
                    </span>
                    {(result.direction === 'UP' || result.direction === 'DOWN') && expirySec > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-950/80 border border-cyan-600/50 text-cyan-300 font-bold animate-pulse">
                        ⏱ {formattedCountdown}
                      </span>
                    )}
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-600/40 font-bold">
                      🔒 লকড
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono truncate">
                    {result.visionData?.symbol || 'LIVE CHART'} • {result.visionData?.candlestickPattern || 'মোমেন্টাম নিশ্চিত'}
                  </div>
                </div>
              ) : isTradePulseAppScreen ? (
                <div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1 truncate">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">⏸ ট্রেডপাল্স অ্যাপে আছেন (WAIT)</span>
                  </div>
                  <div className="text-[10px] text-cyan-300 font-mono truncate">
                    Quotex বা ব্রোকার অ্যাপ ওপেন করুন
                  </div>
                </div>
              ) : isReadingOtherScreen ? (
                <div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1 truncate">
                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">
                      {result?.verdictTitle || '⏸ চার্ট মেলেনি (WAIT)'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono truncate">
                    {result?.reasoning?.[0] || 'ক্যান্ডেল স্পষ্ট রাখুন বা ব্রোকার চার্টে যান'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                    <span>⚡ প্রস্তুত (Ready)</span>
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    স্ক্রিন সক্রিয় • স্ক্যান বাটনে ট্যাপ করুন
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Utility Icons (Voice & Maximize) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-1.5 rounded-lg transition-colors ${
                isVoiceOn
                  ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title={isVoiceOn ? 'ভয়েস সহকারী বন্ধ করুন' : 'ভয়েস সহকারী চালু করুন'}
            >
              {isVoiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToLiveScreen();
              }}
              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
              title="সম্পূর্ণ ডিসপ্লে স্ক্রিন খুলুন"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors"
              title="স্ক্রিন শেয়ার ডিসকানেক্ট ও বাবল বন্ধ করুন"
            >
              <span className="text-xs font-bold leading-none">✕</span>
            </button>
          </div>
        </div>

        {/* Inline Voice Guidance Bar (Inside the single unified bubble) */}
        {voiceNotification && (
          <div className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center gap-1.5 text-[11px] text-cyan-200 animate-in fade-in">
            <Volume2 className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
            <span className="truncate">{voiceNotification}</span>
          </div>
        )}

        {/* Inline Error Bar (Inside the single unified bubble) */}
        {errorMessage && (
          <div className="px-2.5 py-1 rounded-lg bg-red-950/80 border border-red-700/50 flex items-center gap-1.5 text-[11px] text-red-200 animate-in fade-in">
            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        {/* BOTTOM ACTION: SINGLE [🔍 স্ক্যান] BUTTON ONLY (NO STOP SYSTEM, AUTO-STOP & LOCK) */}
        <div className="pt-1 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleToggleScan}
            disabled={isConnecting || isBusy}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-xs tracking-wide shadow-md transition-all active:scale-95 ${
              isBusy
                ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 cursor-wait'
                : result
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/50 shadow-cyan-950/50'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/50 shadow-emerald-950/50'
            }`}
            title="এক ক্লিকে স্ক্রিন স্ক্যান ও দিক নির্দেশনা লক করুন"
          >
            {isBusy ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>বিশ্লেষণ হচ্ছে...</span>
              </>
            ) : result ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-cyan-200" />
                <span>🔍 স্ক্যান (নতুন বিশ্লেষণ)</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-emerald-100" />
                <span>🔍 স্ক্যান</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
