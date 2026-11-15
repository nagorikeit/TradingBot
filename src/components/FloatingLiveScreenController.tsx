import React, { useEffect, useState, useRef } from 'react';
import {
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
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(voiceAssistantService.isVoiceEnabled());
  const [expirySec, setExpirySec] = useState<number>(liveScreenService.getExpirySecondsLeft());
  const [isChartFound, setIsChartFound] = useState<boolean>(liveScreenService.isChartDetected());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(liveScreenService.isOverlayActive());
  const [scanStep, setScanStep] = useState<{ step: number; title: string; subtitle: string } | null>(
    liveScreenService.getCurrentScanStep()
  );

  // Dragging state for the floating bubble
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const bubbleStartPos = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = liveScreenService.subscribe(() => {
      const state = liveScreenService.getState();
      setStreamState(state);
      setIsOverlayActive(liveScreenService.isOverlayActive());
      setResult(liveScreenService.getLatestResult());
      setIsBusy(liveScreenService.isBusy());
      setErrorMessage(liveScreenService.getErrorMessage());
      setExpirySec(liveScreenService.getExpirySecondsLeft());
      setIsChartFound(liveScreenService.isChartDetected());
      setScanStep(liveScreenService.getCurrentScanStep());
      setIsVoiceOn(voiceAssistantService.isVoiceEnabled());
    });
    return unsub;
  }, []);

  const isStreaming = streamState === 'STREAMING';
  const isConnecting = streamState === 'CONNECTING';
  const isPaused = streamState === 'PAUSED';

  if (Capacitor.isNativePlatform()) {
    return null;
  }

  if (!isOverlayActive || (!isStreaming && !isConnecting && !isPaused)) {
    return null;
  }

  const handleToggleScan = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.triggerScanAndLock();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    liveScreenService.disconnect('স্ক্রিন শেয়ার বন্ধ হয়েছে।');
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

    const newX = Math.max(10, Math.min(window.innerWidth - 300, bubbleStartPos.current.x + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 90, bubbleStartPos.current.y + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const countdownMin = Math.floor(expirySec / 60);
  const countdownRemainderSec = expirySec % 60;
  const formattedCountdown = `${String(countdownMin).padStart(2, '0')}:${String(countdownRemainderSec).padStart(2, '0')}`;

  const style: React.CSSProperties = position
    ? { position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, zIndex: 9999 }
    : { position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 };

  const hasChartSignal = Boolean(
    result &&
      (result.direction === 'UP' || result.direction === 'DOWN' || result.visionData?.isClearTradingChart || isChartFound)
  );
  const isTradePulseAppScreen = Boolean(
    result &&
      (result.visionData?.detectedAppName?.includes('TradePulse') ||
        result.visionData?.symbol === 'TRADEPULSE_APP')
  );
  const isReadingOtherScreen = Boolean(
    isStreaming &&
      !hasChartSignal &&
      result &&
      (result.screenStatus === 'OTHER_SCREEN_READING' || result.visionData?.detectedAppName)
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
      <div
        onClick={handleBubbleClick}
        className={`group cursor-grab active:cursor-grabbing flex flex-col gap-2 p-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 min-w-[260px] max-w-[310px] ${
          isConnecting
            ? 'bg-slate-900/95 border-cyan-500/70 text-slate-100'
            : hasChartSignal && result
            ? result.direction === 'UP'
              ? 'bg-slate-900/95 border-emerald-500/80 text-slate-100'
              : result.direction === 'DOWN'
              ? 'bg-slate-900/95 border-rose-500/80 text-slate-100'
              : 'bg-slate-900/95 border-amber-500/70 text-slate-100'
            : 'bg-slate-900/95 border-cyan-500/50 text-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex items-center justify-center shrink-0">
              {isBusy || isConnecting ? (
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/60 flex items-center justify-center text-cyan-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                </div>
              ) : hasChartSignal && result ? (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                    result.direction === 'UP'
                      ? 'bg-emerald-500/25 border-emerald-500/80 text-emerald-400'
                      : result.direction === 'DOWN'
                      ? 'bg-rose-500/25 border-rose-500/80 text-rose-400'
                      : 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                  }`}
                >
                  {result.direction === 'UP' && <TrendingUp className="w-3.5 h-3.5" />}
                  {result.direction === 'DOWN' && <TrendingDown className="w-3.5 h-3.5" />}
                  {result.direction === 'WAIT' && <Clock className="w-3.5 h-3.5" />}
                </div>
              ) : isReadingOtherScreen ? (
                <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/60 flex items-center justify-center text-sky-300">
                  <Eye className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                  <Radar className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="flex flex-col text-left truncate">
              {isBusy || scanStep ? (
                <div>
                  <div className="text-xs font-bold text-cyan-300 font-mono flex items-center gap-1 truncate">
                    <Search className="w-3 h-3 animate-pulse shrink-0" />
                    <span>বিশ্লেষণ {scanStep?.step || 1}/৫</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        className={`h-1 rounded-full ${
                          (scanStep?.step || 1) >= s ? 'bg-cyan-400' : 'bg-slate-700/60'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ) : isConnecting ? (
                <div className="text-xs font-bold text-cyan-300 font-mono">কানেক্ট হচ্ছে...</div>
              ) : hasChartSignal && result ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-black font-mono ${
                        result.direction === 'UP'
                          ? 'text-emerald-400'
                          : result.direction === 'DOWN'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {result.direction === 'UP' && '▲ CALL'}
                      {result.direction === 'DOWN' && '▼ PUT'}
                      {result.direction === 'WAIT' && '⏸ WAIT'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-200 font-bold">
                      {result.confidence}%
                    </span>
                    {(result.direction === 'UP' || result.direction === 'DOWN') && expirySec > 0 && (
                      <span className="text-[10px] font-mono text-cyan-300 font-bold">
                        {formattedCountdown}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {result.visionData?.symbol || 'CHART'} · {result.profileLabelBn || 'Active'}
                  </div>
                </div>
              ) : isTradePulseAppScreen ? (
                <div className="text-xs font-bold text-amber-300 truncate">ব্রোকার চার্ট খুলুন</div>
              ) : isReadingOtherScreen ? (
                <div className="text-xs font-bold text-amber-300 truncate">চার্ট নেই (WAIT)</div>
              ) : (
                <div className="text-xs font-bold text-cyan-300">প্রস্তুত</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-1.5 rounded-lg transition-colors ${
                isVoiceOn ? 'text-emerald-400 hover:bg-emerald-950/60' : 'text-slate-500 hover:bg-slate-800'
              }`}
              title="ভয়েস"
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
              title="বড় করুন"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors"
              title="বন্ধ করুন"
            >
              <span className="text-xs font-bold leading-none">✕</span>
            </button>
          </div>
        </div>

        {!isBusy && !scanStep && hasChartSignal && result && (() => {
          const flow = result.signalFlow;
          const stepChecks = flow?.stepChecks;
          const pts =
            typeof flow?.confirmedPoints === 'number'
              ? flow.confirmedPoints
              : typeof result.visionData?.confirmedPoints === 'number'
              ? result.visionData.confirmedPoints
              : stepChecks
              ? stepChecks.filter((s) => s.passed).length
              : result.direction !== 'WAIT'
              ? 5
              : 2;
          const closedColor =
            result.visionData?.closedCandleColor ||
            (flow?.candleData?.closedCandle?.type === 'BULLISH'
              ? 'GREEN'
              : flow?.candleData?.closedCandle?.type === 'BEARISH'
              ? 'RED'
              : flow?.candleData?.closedCandle?.type === 'DOJI'
              ? 'DOJI'
              : 'UNCERTAIN');
          const closedLabel =
            closedColor === 'GREEN'
              ? 'ক্লোজ: সবুজ'
              : closedColor === 'RED'
              ? 'ক্লোজ: লাল'
              : closedColor === 'DOJI'
              ? 'ক্লোজ: ডোজি'
              : 'ক্লোজ: অস্পষ্ট';
          const stepBools =
            stepChecks && stepChecks.length === 5
              ? stepChecks.map((s) => s.passed)
              : [true, closedColor !== 'UNCERTAIN', flow?.multiTimeframe?.confluenceStatus === 'ALIGNED', Boolean(flow?.marketFilter?.passed), result.direction !== 'WAIT'];

          return (
            <div className="space-y-1.5 px-1">
              <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold font-mono">
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    pts >= 4
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : pts === 3
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                  }`}
                >
                  পয়েন্ট: {pts}/৫
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    closedColor === 'GREEN'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : closedColor === 'RED'
                      ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                      : 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                  }`}
                >
                  {closedLabel}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {['১', '২', '৩', '৪', '৫'].map((lbl, idx) => (
                  <div
                    key={lbl}
                    className={`text-center py-0.5 rounded text-[9px] font-bold border ${
                      stepBools[idx]
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/35 text-rose-300/80'
                    }`}
                  >
                    {lbl} {stepBools[idx] ? '✓' : '✕'}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {errorMessage && (
          <div className="px-2 py-1 rounded-lg bg-red-950/80 border border-red-700/50 flex items-center gap-1.5 text-[10px] text-red-200">
            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleToggleScan}
          disabled={isConnecting || isBusy}
          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 ${
            isBusy
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 cursor-wait'
              : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white'
          }`}
        >
          {isBusy || scanStep ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>ধাপ {scanStep?.step || 1}/৫</span>
            </>
          ) : (
            <>
              <Camera className="w-3.5 h-3.5" />
              <span>স্ক্যান</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
