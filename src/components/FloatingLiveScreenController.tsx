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
  Volume2,
  VolumeX,
  Radar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { voiceAssistantService } from '../services/voiceAssistantService';
import { pictureInPictureService } from '../services/pictureInPictureService';
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
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(voiceAssistantService.isVoiceEnabled());
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);
  const [expirySec, setExpirySec] = useState<number>(liveScreenService.getExpirySecondsLeft());
  const [isChartFound, setIsChartFound] = useState<boolean>(liveScreenService.isChartDetected());
  const [frameCount, setFrameCount] = useState<number>(liveScreenService.getFrameCount());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());
  const [isPipActive, setIsPipActive] = useState<boolean>(pictureInPictureService.isPipActive());

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
      setResult(liveScreenService.getLatestResult());
      setErrorMessage(liveScreenService.getErrorMessage());
      setExpirySec(liveScreenService.getExpirySecondsLeft());
      setIsChartFound(liveScreenService.isChartDetected());
      setFrameCount(liveScreenService.getFrameCount());

      // Requirement: No floating modal! When screenshare starts connecting or streaming,
      // it directly opens on the main display!
      if (state === 'STREAMING' || state === 'CONNECTING') {
        if (currentTab !== 'live-screen') {
          onNavigateToLiveScreen();
        }
      }
    });
    return unsub;
  }, [currentTab, onNavigateToLiveScreen]);

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

  // Subscribe to OS Picture-in-Picture Floating Mode
  useEffect(() => {
    pictureInPictureService.setActionCallbacks({
      onPause: () => liveScreenService.pause(),
      onResume: () => liveScreenService.resume(),
      onDisconnect: () => liveScreenService.disconnect(),
      onFocusDisplay: () => onNavigateToLiveScreen(),
    });

    const unsubPip = pictureInPictureService.subscribe((active) => {
      setIsPipActive(active);
    });
    return unsubPip;
  }, [onNavigateToLiveScreen]);

  const countdownMin = Math.floor(expirySec / 60);
  const countdownRemainderSec = expirySec % 60;
  const formattedCountdown = `${String(countdownMin).padStart(2, '0')}:${String(countdownRemainderSec).padStart(2, '0')}`;

  // Synchronize data to Picture-in-Picture window whenever state updates
  useEffect(() => {
    pictureInPictureService.updateData({
      direction: result?.direction || 'WAIT',
      confidence: result?.confidence || 0,
      symbol: result?.visionData?.symbol || 'OTC CHART',
      durationText: formattedCountdown,
      expirySec,
      isChartFound,
      isStreaming: streamState === 'STREAMING',
      isPaused: streamState === 'PAUSED',
      frameCount,
      verdictTitle: result?.verdictTitle,
      reasonText: result?.reasoning?.[0],
      errorReason: errorMessage || undefined,
    });
  }, [result, expirySec, isChartFound, streamState, frameCount, errorMessage, formattedCountdown]);

  const isStreaming = streamState === 'STREAMING';
  const isPaused = streamState === 'PAUSED';
  const isConnecting = streamState === 'CONNECTING';

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

  const handleToggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = voiceAssistantService.toggleVoice();
    setIsVoiceOn(next);
  };

  const handleCancelConnecting = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.cancelConnecting();
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    // If user dragged the bubble, don't trigger click action
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    // Directly open on the display screen!
    onNavigateToLiveScreen();
  };

  // Pointer drag event handlers so user can place the HUD bubble anywhere on screen
  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore clicks on inner interactive buttons
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

    const newX = Math.max(10, Math.min(window.innerWidth - 280, bubbleStartPos.current.x + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, bubbleStartPos.current.y + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  // Inline style for draggable positioning
  const style: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 60,
      }
    : {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 60,
      };

  // User Requirement: "আমার কথা হল একটি মাত্র বাবল থাকবে কানেক্ট হওয়ার পর সেটি সকল স্ক্রিনের উপর ভাসমান থাকবে এবং ফলাফল দেখাবে"
  // When OS Picture-in-Picture window is active, it IS the single bubble floating over all apps/screens.
  // We do NOT render a duplicate in-page bubble!
  if (isPipActive) {
    return null;
  }

  const hasChartSignal = isStreaming && isChartFound && result && result.visionData?.isClearTradingChart;

  return (
    <div
      ref={bubbleRef}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="select-none touch-none"
    >
      {/* Voice Assistant Speech Bubble (Compact Floating Pill) */}
      {voiceNotification && (
        <div className="mb-2 px-3 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-500/60 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs text-cyan-200 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-xs">
          <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
          <div className="truncate font-medium">{voiceNotification}</div>
        </div>
      )}

      {/* Error Bubble (If error occurs) */}
      {errorMessage && (
        <div className="mb-2 px-3 py-1.5 rounded-xl bg-red-950/90 border border-red-700/70 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs text-red-200 animate-in fade-in max-w-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <div className="truncate text-[11px]">{errorMessage}</div>
        </div>
      )}

      {/* THE UNIFIED FLOATING HUD BUBBLE */}
      <div
        onClick={handleBubbleClick}
        className={`group cursor-pointer flex items-center gap-3 px-3.5 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 hover:shadow-cyan-950/40 active:scale-[0.98] ${
          isConnecting
            ? 'bg-slate-900/95 border-cyan-500/70 text-slate-100 ring-2 ring-cyan-500/30'
            : hasChartSignal
            ? result.direction === 'UP'
              ? 'bg-slate-900/95 border-emerald-500/70 text-slate-100 ring-2 ring-emerald-500/40'
              : result.direction === 'DOWN'
              ? 'bg-slate-900/95 border-rose-500/70 text-slate-100 ring-2 ring-rose-500/40'
              : 'bg-slate-900/95 border-amber-500/70 text-slate-100 ring-2 ring-amber-500/30'
            : isStreaming
            ? 'bg-slate-900/95 border-amber-500/70 text-slate-100 ring-2 ring-amber-500/30'
            : isPaused
            ? 'bg-slate-900/95 border-amber-500/50 text-slate-200'
            : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-cyan-500/50'
        }`}
        title="ক্লিক করে সরাসরি ডিসপ্লে ওপেন করুন (ড্র্যাগ করে সরানো যাবে)"
      >
        {/* Status Radar / Pulsing Indicator */}
        <div className="relative flex items-center justify-center shrink-0">
          {isConnecting ? (
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          ) : hasChartSignal ? (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                result.direction === 'UP'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-400'
                  : result.direction === 'DOWN'
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-400'
                  : 'bg-amber-500/20 border-amber-500/60 text-amber-400'
              }`}
            >
              {result.direction === 'UP' && <TrendingUp className="w-4 h-4" />}
              {result.direction === 'DOWN' && <TrendingDown className="w-4 h-4" />}
              {result.direction === 'WAIT' && <Clock className="w-4 h-4" />}
            </div>
          ) : isStreaming ? (
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-400">
              <Radar className="w-4 h-4 animate-pulse" />
            </div>
          ) : isPaused ? (
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
              <Pause className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Monitor className="w-4 h-4" />
            </div>
          )}

          {/* Active Ping Dot */}
          {isStreaming && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  hasChartSignal ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  hasChartSignal ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
          )}
        </div>

        {/* Bubble Information Body */}
        <div className="flex flex-col text-left min-w-[130px]">
          {isConnecting ? (
            <div>
              <div className="text-xs font-bold text-cyan-300 font-mono">স্ক্রিন কানেক্ট হচ্ছে...</div>
              <div className="text-[10px] text-slate-400">ডিসপ্লে প্রস্তুত হচ্ছে</div>
            </div>
          ) : hasChartSignal ? (
            <div>
              <div className="flex items-center gap-2">
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
                  {result.direction === 'WAIT' && '⏸ পর্যবেক্ষণাধীন'}
                </span>
                {(result.direction === 'UP' || result.direction === 'DOWN') && expirySec > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-600/50 text-cyan-300 font-bold">
                    ⏱ {formattedCountdown}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-300 font-mono truncate">
                {result.direction !== 'WAIT'
                  ? `${result.visionData?.symbol || 'চার্ট'} • ${result.confidence}% কনফিডেন্স`
                  : `${result.visionData?.symbol || 'চার্ট'} • মোমেন্টামের অপেক্ষায়`}
              </div>
            </div>
          ) : isStreaming ? (
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>⏸ চার্ট খোঁজা হচ্ছে</span>
                <span className="text-[9px] font-mono bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-600/40 text-amber-200">
                  WAIT
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>ফ্রেম #{frameCount}</span>
                <span>•</span>
                <span className="text-cyan-400">ক্লিক করে ডিসপ্লে দেখুন</span>
              </div>
            </div>
          ) : isPaused ? (
            <div>
              <div className="text-xs font-bold text-amber-400">⏸ স্থগিত (PAUSED)</div>
              <div className="text-[10px] text-slate-400">চালু করতে Resume চাপুন</div>
            </div>
          ) : (
            <div>
              <div className="text-xs font-bold text-slate-200">Live AI HUD</div>
              <div className="text-[10px] text-slate-400">ক্লিক করে ডিসপ্লে খুলুন</div>
            </div>
          )}
        </div>

        {/* Quick Inline Action Buttons on the Bubble */}
        <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2 shrink-0">
          {/* Direct Open Display Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToLiveScreen();
            }}
            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="সরাসরি ডিসপ্লে খুলুন"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Voice Assistant Toggle */}
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

          {/* Pause / Resume Button */}
          {isStreaming && (
            <button
              type="button"
              onClick={handlePause}
              className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
              title="স্থগিত করুন (Pause)"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={handleResume}
              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 rounded-lg transition-colors"
              title="পুনরায় চালু করুন (Resume)"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {/* Disconnect or Cancel Button */}
          {isConnecting ? (
            <button
              type="button"
              onClick={handleCancelConnecting}
              className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded-lg transition-colors"
              title="কানেকশন বাতিল করুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (isStreaming || isPaused) ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors"
              title="ডিসকানেক্ট করুন"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
