import React, { useEffect, useState, useRef } from 'react';
import {
  Monitor,
  Play,
  Pause,
  Square,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  Sliders,
  Volume2,
  VolumeX,
  Server,
  Wifi,
  ExternalLink,
  Smartphone,
  Radar,
  MessageSquare,
  Send,
  History,
  Tv,
  Terminal,
  Download,
  Puzzle,
  PenLine,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { liveScreenService } from '../services/liveScreenService';
import { desktopPipService } from '../services/desktopPipService';
import { voiceAssistantService } from '../services/voiceAssistantService';
import { agentLearningService } from '../services/agentLearningService';
import { authService } from '../services/authService';
import { EffectiveScanQuotaStatus } from '../types/authTypes';
import {
  LiveStreamState,
  ScreenAnalysisFinalResult,
  ChartDetectionDiagnostic,
  ScreenTransitionRecord,
} from '../types/screenTypes';
import {
  getApiUrl,
  getCustomApiUrl,
  setCustomApiUrl,
  checkBackendHealth,
} from '../services/apiConfig';
import { WhatsAppAlertConfigPanel } from './WhatsAppAlertConfigPanel';
import { TRADING_PROFILE_LIST, TradingProfileId, ScreenProfileMode, getTradingProfile } from '../strategy/tradingProfiles';
import { tradingProfileService } from '../services/tradingProfileService';

export const LiveScreenAnalyzer: React.FC = () => {
  const isMobileApp = Capacitor.isNativePlatform();
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [streamState, setStreamState] = useState<LiveStreamState>(liveScreenService.getState());
  const [result, setResult] = useState<ScreenAnalysisFinalResult | null>(liveScreenService.getLatestResult());
  const [isBusy, setIsBusy] = useState<boolean>(liveScreenService.isBusy());
  const [intervalSec, setIntervalSec] = useState<number>(liveScreenService.getScanIntervalSeconds());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(voiceAssistantService.isVoiceEnabled());
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);

  const [expirySec, setExpirySec] = useState<number>(liveScreenService.getExpirySecondsLeft());
  const [isChartFound, setIsChartFound] = useState<boolean>(liveScreenService.isChartDetected());
  const [chartDiagnostic, setChartDiagnostic] = useState<ChartDetectionDiagnostic | null>(
    liveScreenService.getChartDiagnostic()
  );

  const [transitions, setTransitions] = useState<ScreenTransitionRecord[]>(liveScreenService.getScreenTransitions());
  const [activeScreenName, setActiveScreenName] = useState<string>(liveScreenService.getActiveScreenName());
  const [frameCount, setFrameCount] = useState<number>(liveScreenService.getFrameCount());
  const [lastDetectedAppName, setLastDetectedAppName] = useState<string>(liveScreenService.getLastDetectedAppName());
  const [isDesktopPipActive, setIsDesktopPipActive] = useState<boolean>(desktopPipService.isActive());
  const [desktopPipError, setDesktopPipError] = useState<{ message: string; reason?: string } | null>(null);
  const [scanQuota, setScanQuota] = useState<EffectiveScanQuotaStatus>(() => authService.getScanQuotaStatus());
  const [activeProfileId, setActiveProfileId] = useState<TradingProfileId>(() =>
    tradingProfileService.getActiveProfileId()
  );
  const [screenProfileMode, setScreenProfileMode] = useState<ScreenProfileMode>(() =>
    tradingProfileService.getScreenProfileMode()
  );

  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Screen Q&A Interactive Assistant
  const [questionInput, setQuestionInput] = useState<string>('');
  const [questionAnswer, setQuestionAnswer] = useState<string | null>(null);
  const [isAskingQuestion, setIsAskingQuestion] = useState<boolean>(false);

  // Backend Connection Health & Settings Modal State
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<{
    tested: boolean;
    ok: boolean;
    latencyMs: number;
    error?: string;
  }>({ tested: false, ok: false, latencyMs: 0 });
  const [isTestingServer, setIsTestingServer] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>(getCustomApiUrl());
  const [learningFeedbackMsg, setLearningFeedbackMsg] = useState<string | null>(null);
  const [showDrawingGuide, setShowDrawingGuide] = useState<boolean>(true);

  const handleFeedbackOutcome = (outcome: 'WIN' | 'LOSS') => {
    if (!result || result.direction === 'WAIT') return;
    const targetProfileId = (result.tradingProfileId as TradingProfileId) || activeProfileId;
    const symbol = result.visionData?.symbol || 'LIVE CHART';
    const direction: 'CALL' | 'PUT' = result.direction === 'UP' ? 'CALL' : 'PUT';
    const pattern = result.visionData?.candlestickPattern;
    const res = agentLearningService.recordOutcome(
      symbol,
      direction,
      outcome,
      pattern,
      undefined,
      targetProfileId,
      'USER_FEEDBACK'
    );
    if (outcome === 'WIN') {
      setLearningFeedbackMsg('ট্রেড সফল (WIN) হিসেবে প্রোফাইল লগে যুক্ত হয়েছে।');
    } else {
      setLearningFeedbackMsg(
        res.cohortAudit
          ? res.cohortAudit.summaryBn
          : 'ট্রেড লস (LOSS) প্রোফাইল লগে সংরক্ষিত হয়েছে — ১টি ক্যান্ডেলে মূল রুল বদলায় না (৭/৩০ দিনের কোহর্টে পর্যালোচিত হবে)।'
      );
    }
    setTimeout(() => setLearningFeedbackMsg(null), 6000);
  };

  const runHealthCheck = async () => {
    setIsTestingServer(true);
    const res = await checkBackendHealth(5000);
    setServerStatus({
      tested: true,
      ok: res.ok,
      latencyMs: res.latencyMs,
      error: res.error,
    });
    setIsTestingServer(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  useEffect(() => {
    const unsub = liveScreenService.subscribe(() => {
      setStreamState(liveScreenService.getState());
      setResult(liveScreenService.getLatestResult());
      setIsBusy(liveScreenService.isBusy());
      setIntervalSec(liveScreenService.getScanIntervalSeconds());
      setErrorMessage(liveScreenService.getErrorMessage());
      setExpirySec(liveScreenService.getExpirySecondsLeft());
      setIsChartFound(liveScreenService.isChartDetected());
      setChartDiagnostic(liveScreenService.getChartDiagnostic());
      setTransitions(liveScreenService.getScreenTransitions());
      setActiveScreenName(liveScreenService.getActiveScreenName());
      setFrameCount(liveScreenService.getFrameCount());
      setLastDetectedAppName(liveScreenService.getLastDetectedAppName());
    });
    const unsubPip = desktopPipService.subscribe((active) => {
      setIsDesktopPipActive(active);
      if (active) {
        setDesktopPipError(null);
      }
    });
    const unsubAuth = authService.subscribe(() => {
      setScanQuota(authService.getScanQuotaStatus());
    });
    const unsubPlans = authService.subscribePlans(() => {
      setScanQuota(authService.getScanQuotaStatus());
    });
    const unsubProfile = tradingProfileService.subscribe((id) => {
      setActiveProfileId(id);
      setScreenProfileMode(tradingProfileService.getScreenProfileMode());
    });
    return () => {
      unsub();
      unsubPip();
      unsubAuth();
      unsubPlans();
      unsubProfile();
    };
  }, []);

  useEffect(() => {
    const stream = liveScreenService.getStream();
    if (previewVideoRef.current && stream) {
      if (previewVideoRef.current.srcObject !== stream) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }
    }
  }, [streamState, isChartFound, frameCount]);

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

  const countdownMin = Math.floor(expirySec / 60);
  const countdownRemainderSec = expirySec % 60;
  const formattedCountdown = `${String(countdownMin).padStart(2, '0')}:${String(countdownRemainderSec).padStart(2, '0')}`;

  const handleConnect = async () => {
    const mode = tradingProfileService.getScreenProfileMode();
    setDesktopPipError(null);

    const connected = await liveScreenService.connectScreen(mode);
    if (connected && !isMobileApp && !desktopPipService.isActive()) {
      const pipRes = await desktopPipService.openInteractiveBubble();
      if (!pipRes.ok && pipRes.message) {
        setDesktopPipError({ message: pipRes.message, reason: pipRes.reason });
      }
    }
  };

  const handleToggleVoice = () => {
    const next = voiceAssistantService.toggleVoice();
    setIsVoiceOn(next);
  };

  const handlePause = () => {
    liveScreenService.pause();
  };

  const handleResume = () => {
    liveScreenService.resume();
  };

  const handleDisconnect = () => {
    setDesktopPipError(null);
    if (!isMobileApp) {
      desktopPipService.close();
    }
    liveScreenService.disconnect();
  };

  const handleOpenDesktopBubbleFallback = async () => {
    setDesktopPipError(null);
    const res = await desktopPipService.openInteractiveBubble();
    if (!res.ok && res.message) {
      setDesktopPipError({ message: res.message, reason: res.reason });
    }
  };

  const handleAskQuestion = async (customQ?: string) => {
    const q = customQ || questionInput;
    if (!q.trim()) return;
    setIsAskingQuestion(true);
    setQuestionAnswer(null);
    const ans = await liveScreenService.askQuestionAboutActiveScreen(q);
    setQuestionAnswer(ans);
    setIsAskingQuestion(false);
  };

  const isStreaming = streamState === 'STREAMING';
  const isPaused = streamState === 'PAUSED';
  const isConnecting = streamState === 'CONNECTING';

  const statusLabel = isStreaming
    ? 'লাইভ'
    : isPaused
    ? 'বিরতি'
    : isConnecting
    ? 'সংযুক্ত হচ্ছে...'
    : streamState === 'ERROR'
    ? 'ত্রুটি'
    : 'সংযুক্ত নয়';

  return (
    <div className="space-y-5">
      {/* 1. Top Controller & Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight whitespace-nowrap">
                লাইভ স্ক্রিন অ্যানালাইজার
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                <span
                  className={
                    isStreaming
                      ? 'text-emerald-400 font-semibold'
                      : isPaused
                      ? 'text-amber-400 font-semibold'
                      : isConnecting
                      ? 'text-cyan-400 font-semibold'
                      : 'text-slate-400'
                  }
                >
                  {statusLabel}
                </span>
                {isStreaming && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-cyan-300 font-medium truncate max-w-[180px]">
                      {activeScreenName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Single-Line Action Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-thin pb-1 lg:pb-0">
            {isStreaming && (
              <>
                <button
                  onClick={() => liveScreenService.triggerScanAndLock()}
                  disabled={isBusy}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    isBusy
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin text-cyan-300' : ''}`} />
                  <span>{isBusy ? 'বিশ্লেষণ হচ্ছে...' : result ? 'নতুন স্ক্যান' : 'স্ক্যান করুন'}</span>
                </button>
                <button
                  onClick={handlePause}
                  className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>বিরতি</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-2 text-xs font-medium text-rose-200 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>বন্ধ করুন</span>
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={handleResume}
                  className="px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>চালু করুন</span>
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-2 text-xs font-medium text-rose-200 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>বন্ধ করুন</span>
                </button>
              </>
            )}

            {(streamState === 'IDLE' || streamState === 'DISCONNECTED' || streamState === 'ERROR') && (
              <button
                onClick={handleConnect}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>স্ক্রিন শেয়ার</span>
              </button>
            )}

            {isConnecting && (
              <>
                <button
                  disabled
                  className="px-3.5 py-2 text-xs font-semibold text-cyan-200 bg-cyan-950/80 border border-cyan-500/40 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span>সংযুক্ত হচ্ছে...</span>
                </button>
                <button
                  onClick={() => liveScreenService.cancelConnecting()}
                  className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  রিসেট
                </button>
              </>
            )}

            <button
              onClick={handleToggleVoice}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isVoiceOn
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {isVoiceOn ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isVoiceOn ? 'ভয়েস অন' : 'ভয়েস অফ'}</span>
            </button>

            <button
              onClick={() => setShowWhatsAppModal(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => {
                setShowServerModal(true);
                runHealthCheck();
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                serverStatus.tested && serverStatus.ok
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {serverStatus.tested && serverStatus.ok ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Server className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>
                {serverStatus.tested && serverStatus.ok ? `সার্ভার (${serverStatus.latencyMs}ms)` : 'সার্ভার'}
              </span>
            </button>
          </div>
        </div>

        {/* Inline Alert Banner directly below Action Buttons */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-rose-200"
          >
            <div className="flex items-start sm:items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
              <span className="font-medium leading-relaxed">
                {errorMessage.includes('Failed to fetch')
                  ? 'সার্ভার সংযোগ বিচ্ছিন্ন (Failed to fetch)'
                  : errorMessage}
              </span>
            </div>
            {isInsideIframe && (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>নতুন ট্যাবে খুলুন</span>
              </a>
            )}
          </div>
        )}

        {/* Auto-bubble Fallback Notice ONLY if browser prevented immediate auto-open */}
        {!isMobileApp && desktopPipError && !isDesktopPipActive && (
          <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200">
            <span className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{desktopPipError.message}</span>
            </span>
            {desktopPipError.reason === 'IFRAME_BLOCKED' && isInsideIframe ? (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                <span>নতুন ট্যাব</span>
              </a>
            ) : desktopPipError.reason === 'GESTURE_EXPIRED' ? (
              <button
                type="button"
                onClick={handleOpenDesktopBubbleFallback}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>বাবল খুলুন</span>
              </button>
            ) : null}
          </div>
        )}

        {/* Interval, Active Trade Profile (post-click/active) & Live Quota Strip */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-400">
            <div className="flex items-center gap-2">
              <span>রুলস মোড:</span>
              <select
                value={screenProfileMode}
                onChange={(e) => {
                  const val = e.target.value as ScreenProfileMode;
                  tradingProfileService.setScreenProfileMode(val);
                  setScreenProfileMode(val);
                }}
                aria-label="চার্ট রুলস মোড"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-cyan-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="AUTO">অটো-ডিটেক্ট (AI স্বয়ংক্রিয়)</option>
                {TRADING_PROFILE_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.shortLabel} (ম্যানুয়াল)
                  </option>
                ))}
              </select>
            </div>
            <span className="hidden sm:inline text-slate-700" aria-hidden="true">|</span>

            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>স্ক্যান বিরতি:</span>
              <input
                type="range"
                min="3"
                max="20"
                step="1"
                value={intervalSec}
                onChange={(e) => liveScreenService.setScanIntervalSeconds(Number(e.target.value))}
                className="w-20 accent-cyan-500 cursor-pointer"
              />
              <span className="font-mono font-semibold text-slate-200 tabular-nums">{intervalSec}s</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-3">
            <span
              className={`font-medium tabular-nums ${
                scanQuota.mode === 'EXHAUSTED'
                  ? 'text-rose-300'
                  : scanQuota.mode === 'FREE_TRIAL'
                  ? 'text-cyan-300'
                  : 'text-emerald-300'
              }`}
            >
              {scanQuota.mode === 'ADMIN'
                ? `অ্যাডমিন আনলিমিটেড · মোট স্ক্যান: ${scanQuota.totalScansUsed}`
                : scanQuota.mode === 'FREE_TRIAL'
                ? `ফ্রি বাকি: ${scanQuota.freeRemaining}/${scanQuota.freeLimit} · মোট: ${scanQuota.totalScansUsed}`
                : scanQuota.mode === 'PAID'
                ? `ভিআইপি (${scanQuota.daysRemaining} দিন) · আজ: ${scanQuota.dailyUsed}/${
                    scanQuota.dailyLimit === 0 ? '∞' : scanQuota.dailyLimit
                  }`
                : 'স্ক্যান লিমিট শেষ'}
            </span>

            {scanQuota.mode !== 'ADMIN' && (
              <button
                type="button"
                onClick={() => authService.requestUpgradeModal(scanQuota.blockReasonBn)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0"
              >
                {scanQuota.mode === 'EXHAUSTED' ? 'প্ল্যান কিনুন' : 'আপগ্রেড'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 1.5 Chrome Extension Strip (Desktop Only) */}
      {!isMobileApp && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Puzzle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-white">Chrome এক্সটেনশন</span>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">· chrome://extensions</span>
          </div>
          <a
            href={getApiUrl('/api/extension/download')}
            download="TradePulse-Chrome-Extension.zip"
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ডাউনলোড (.zip)</span>
          </a>
        </div>
      )}

      {/* 1.6 User Chart Drawing Checklist Guide */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <button
          type="button"
          onClick={() => setShowDrawingGuide((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <PenLine className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-white leading-snug">
              সঠিক সিগনাল পাওয়ার জন্য নিম্নে বর্ণিত ড্রয়িংগুলো নিশ্চিত করুন
            </span>
          </div>
          {showDrawingGuide ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {showDrawingGuide && (
          <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-lg bg-slate-950 border border-sky-500/40 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sky-300">১. সাপোর্ট লাইন (Support)</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-sky-200 shrink-0">
                    <span className="w-3 h-3 rounded-sm bg-sky-400 border border-sky-200 inline-block" aria-hidden="true" />
                    আকাশী (Sky-Blue)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  নিচের সাপোর্ট ফ্লোরে <span className="text-sky-300 font-semibold">আকাশী</span> হরাইজন্টাল লাইন আঁকুন। এই লাইন দেখলেই এআই ভুল PUT ব্লক করবে এবং বাউন্সে CALL ধরবে।
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-orange-500/40 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-orange-300">২. রেজিস্ট্যান্স লাইন (Resistance)</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-orange-200 shrink-0">
                    <span className="w-3 h-3 rounded-sm bg-orange-400 border border-orange-200 inline-block" aria-hidden="true" />
                    কমলা (Orange)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  ওপরের রেজিস্ট্যান্স ছাদে <span className="text-orange-300 font-semibold">কমলা</span> হরাইজন্টাল লাইন আঁকুন। এই লাইনের নিচে ভুল CALL ব্লক হবে এবং রিজেকশনে PUT ধরবে।
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-yellow-500/40 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-yellow-300">৩. ট্রেন্ডলাইন (Trendline)</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-yellow-200 shrink-0">
                    <span className="w-3 h-3 rounded-sm bg-yellow-400 border border-yellow-200 inline-block" aria-hidden="true" />
                    হলুদ (Yellow)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  ২–৩টি সুইং হাই/লো যুক্ত করে <span className="text-yellow-300 font-semibold">হলুদ</span> ডায়াগনাল লাইন টানুন। ট্রেন্ডের দিক ও ব্রেকআউট-রিটেস্ট সহজে চিনতে সাহায্য করে।
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-purple-500/40 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-purple-300">৪. সাপ্লাই / ডিমান্ড জোন (Zone Box)</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-purple-200 shrink-0">
                    <span className="w-3 h-3 rounded-sm bg-purple-400 border border-purple-200 inline-block" aria-hidden="true" />
                    বেগুনি (Purple)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  শক্তিশালী উইক বা রিভার্সাল জোনে <span className="text-purple-300 font-semibold">বেগুনি</span> আয়তক্ষেত্র (বক্স) আঁকুন। জোন থেকে রিজেকশন পেলে কনফ্লুয়েন্স স্কোর বাড়ে।
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-600/70 space-y-1.5 md:col-span-2 lg:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100">৫. প্যারালাল চ্যানেল / ফিবোনাচি (ঐচ্ছিক)</span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-white shrink-0">
                    <span className="w-3 h-3 rounded-sm bg-white border border-slate-400 inline-block" aria-hidden="true" />
                    সাদা (White)
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  মার্কেট চ্যানেলে চললে <span className="text-white font-semibold">সাদা</span> Parallel Channel বা পুলব্যাক ধরতে ০.৫ / ০.৬১৮ Fibonacci ব্যবহার করুন।
                  <span className="text-amber-300 font-semibold"> সতর্কতা:</span> ক্যান্ডেলের লাল বা সবুজ রঙের মতো ড্রয়িং আঁকবেন না ও একসাথে সর্বোচ্চ ২–৪টি মূল লেভেল রাখুন।
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Voice Assistant Banner */}
      {voiceNotification && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center gap-3 text-xs text-cyan-200">
          <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-medium">“{voiceNotification}”</span>
        </div>
      )}

      {/* 3. MAIN DISPLAY: Active Trading Chart Analysis vs Live Viewport */}
      {isChartFound && result && result.visionData?.isClearTradingChart ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 px-4 py-2.5 rounded-xl text-xs text-emerald-300">
            <span className="font-semibold">অ্যাক্টিভ চার্ট বিশ্লেষণ</span>
            <span className="font-mono font-bold text-white">
              {result.visionData.symbol || 'ASSET'} · {result.visionData.timeframe || '1m'}
            </span>
          </div>

          {/* 5-Step Audit Card */}
          {result.signalFlow && (() => {
            const flow = result.signalFlow!;
            const stepChecks = flow.stepChecks;
            const s1 = stepChecks?.[0]?.passed ?? flow.chartVerification.isChartValid;
            const s2 =
              stepChecks?.[1]?.passed ??
              (result.visionData.closedCandleColor !== 'UNCERTAIN' &&
                result.visionData.lastCandleDirection !== 'UNCERTAIN');
            const s3 = stepChecks?.[2]?.passed ?? flow.multiTimeframe.confluenceStatus === 'ALIGNED';
            const s4 = stepChecks?.[3]?.passed ?? flow.marketFilter.passed;
            const s5 =
              stepChecks?.[4]?.passed ??
              (flow.signalScoring.finalVerdict === 'CALL' || flow.signalScoring.finalVerdict === 'PUT');
            const confirmedPts =
              typeof flow.confirmedPoints === 'number'
                ? flow.confirmedPoints
                : [s1, s2, s3, s4, s5].filter(Boolean).length;

            const closedType = flow.candleData.closedCandle.type;
            const closedLabel =
              flow.candleData.closedCandle.labelBn ||
              (closedType === 'BULLISH'
                ? 'সবুজ (বুলিশ)'
                : closedType === 'BEARISH'
                ? 'লাল (বিয়ারিশ)'
                : 'ডোজি (সিদ্ধান্তহীন)');

            return (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 text-xs">
                  <span className="font-bold text-white">৫-ধাপ সিগন্যাল অডিট</span>
                  <div className="flex items-center gap-2 font-mono font-bold tabular-nums">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[11px] ${
                        confirmedPts >= 4
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                          : confirmedPts === 3
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                          : 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                      }`}
                    >
                      নিশ্চিত পয়েন্ট: {confirmedPts}/৫
                    </span>
                    <span
                      className={
                        flow.signalScoring.totalScore >= 7.5 ? 'text-emerald-400' : 'text-amber-400'
                      }
                    >
                      স্কোর: {flow.signalScoring.totalScore.toFixed(1)}/১০
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                  <div className={`p-2.5 rounded-lg bg-slate-950 border space-y-1 ${s1 ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span>১. চার্ট</span>
                      <span className={s1 ? 'text-emerald-400' : 'text-rose-400'}>
                        {s1 ? '✓ নিশ্চিত' : '✕ অস্পষ্ট'}
                      </span>
                    </div>
                    <div className="text-white font-mono font-medium truncate">
                      {flow.chartVerification.detectedAsset || result.visionData.symbol}
                    </div>
                    <div className="text-[11px] text-cyan-300 font-medium truncate">
                      {result.profileLabelBn || getTradingProfile((result.tradingProfileId as TradingProfileId) || activeProfileId).labelBn} · {flow.chartVerification.detectedTimeframe} · {flow.chartVerification.candleBarsCount} ক্যান্ডেল
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg bg-slate-950 border space-y-1 ${s2 ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span>২. ক্লোজ ক্যান্ডেল</span>
                      <span className={s2 ? 'text-emerald-400' : 'text-rose-400'}>
                        {s2 ? '✓ নিশ্চিত' : '✕ অস্পষ্ট'}
                      </span>
                    </div>
                    <div className="text-white font-medium truncate">
                      {closedLabel}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      বডি {flow.candleData.closedCandle.bodySizePx}% · {flow.candleData.closedCandle.isRejection ? 'উইক রিজেকশন' : 'স্বাভাবিক'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg bg-slate-950 border space-y-1 ${s3 ? 'border-emerald-500/40' : 'border-amber-500/40'}`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span>৩. মাল্টি-TF (OHLC)</span>
                      <span className={s3 ? 'text-emerald-400' : 'text-amber-400'}>
                        {s3 ? '✓ অ্যালাইন্ড' : '✕ সতর্কতা'}
                      </span>
                    </div>
                    <div className="text-white font-mono text-[11px]">
                      15M:{flow.multiTimeframe.macroTrend15m === 'UPTREND' ? 'UP' : flow.multiTimeframe.macroTrend15m === 'DOWNTREND' ? 'DN' : 'RNG'} · 5M:{flow.multiTimeframe.secondaryTrend5m === 'UPTREND' ? 'UP' : flow.multiTimeframe.secondaryTrend5m === 'DOWNTREND' ? 'DN' : 'RNG'} · 3M:{(flow.multiTimeframe.momentum3m || flow.multiTimeframe.secondaryTrend5m) === 'UPTREND' ? 'UP' : (flow.multiTimeframe.momentum3m || flow.multiTimeframe.secondaryTrend5m) === 'DOWNTREND' ? 'DN' : 'RNG'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {flow.multiTimeframe.ohlcAggregationSummaryBn || `1M: ${flow.multiTimeframe.microTrend1m}`}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg bg-slate-950 border space-y-1 ${s4 ? 'border-emerald-500/40' : 'border-rose-500/40'}`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span>৪. ফিল্টার</span>
                      <span className={s4 ? 'text-emerald-400' : 'text-rose-400'}>
                        {s4 ? '✓ পাসড' : '✕ ফিল্টার্ড'}
                      </span>
                    </div>
                    <div className="text-white font-medium text-[11px]">
                      {flow.marketFilter.regime === 'TRENDING'
                        ? 'ট্রেন্ডিং'
                        : flow.marketFilter.regime === 'SIDEWAYS'
                        ? 'সাইডওয়েজ'
                        : 'ভোলাটাইল / ডোজি'}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {flow.marketFilter.blockReason || 'স্বাভাবিক মার্কেট'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg bg-slate-950 border space-y-1 ${s5 ? 'border-emerald-500/40' : 'border-amber-500/40'}`}>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span>৫. ভার্ডিক্ট</span>
                      <span className={s5 ? 'text-emerald-400' : 'text-amber-400'}>
                        {s5 ? '✓ নিশ্চিত' : '✕ অপেক্ষা'}
                      </span>
                    </div>
                    <div
                      className={`font-bold font-mono text-xs ${
                        flow.signalScoring.finalVerdict === 'CALL'
                          ? 'text-emerald-400'
                          : flow.signalScoring.finalVerdict === 'PUT'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {flow.signalScoring.finalVerdict === 'CALL'
                        ? '▲ CALL'
                        : flow.signalScoring.finalVerdict === 'PUT'
                        ? '▼ PUT'
                        : '⏸ WAIT'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      PA {flow.signalScoring.priceActionScore.toFixed(1)} · Ind {flow.signalScoring.indicatorMomentumScore.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Column 1: Signal Verdict */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">সিগন্যাল ফলাফল</span>
                <div className="flex items-center gap-1.5 text-slate-300 font-mono tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{formattedCountdown}</span>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-2 ${
                  result.direction === 'UP'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : result.direction === 'DOWN'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                }`}
              >
                <div className="text-2xl font-black tracking-tight font-mono">
                  {result.direction === 'UP' &&
                    (getTradingProfile((result.tradingProfileId as TradingProfileId) || activeProfileId).outputMode === 'SPOT_SL_TP'
                      ? '▲ LONG / BUY'
                      : '▲ CALL / UP (সবুজ)')}
                  {result.direction === 'DOWN' &&
                    (getTradingProfile((result.tradingProfileId as TradingProfileId) || activeProfileId).outputMode === 'SPOT_SL_TP'
                      ? '▼ SHORT / SELL'
                      : '▼ PUT / DOWN (লাল)')}
                  {result.direction === 'WAIT' && '⏸ WAIT (অপেক্ষা)'}
                </div>
                <div className="text-xs font-medium opacity-90 max-w-sm">
                  {result.visionData?.nextCandlePredictionReasonBn || result.verdictTitle}
                </div>
                <div className="text-[11px] font-mono text-cyan-300">
                  {result.profileLabelBn || getTradingProfile(activeProfileId).labelBn} · {result.suggestedExpiry}
                </div>
                <div className="text-xs text-slate-300 font-mono tabular-nums flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span>কনফিডেন্স: {result.confidence}%</span>
                  {result.visionData?.priceActionSetup && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{result.visionData.priceActionSetup}</span>
                    </>
                  )}
                  {result.visionData?.tradeQualityTier === 'HIGH_RISK_DOJI' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300">দোজি সতর্কতা</span>
                    </>
                  )}
                </div>

                {result.visionData?.userDrawingsDetected &&
                  result.visionData?.drawingInteraction &&
                  result.visionData.drawingInteraction !== 'NONE' && (
                    <div
                      className={`mt-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] leading-snug max-w-sm ${
                        result.visionData.drawingInteraction.startsWith('BLOCKED_')
                          ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                          : result.visionData.drawingInteraction === 'MID_RANGE'
                            ? 'bg-slate-900/70 border-slate-700 text-slate-300'
                            : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-200'
                      }`}
                    >
                      <span className="font-bold">
                        {result.visionData.drawingInteraction.startsWith('BLOCKED_')
                          ? 'ড্রয়িং সুরক্ষা (এন্ট্রি ব্লক): '
                          : result.visionData.drawingInteraction === 'MID_RANGE'
                            ? 'ড্রয়িং জোন (মাঝামাঝি): '
                            : 'ড্রয়িং ম্যাচ: '}
                      </span>
                      <span>
                        {result.visionData.drawingNoteBn ||
                          (result.visionData.userDrawingTypes?.length
                            ? result.visionData.userDrawingTypes.join(', ')
                            : 'চার্ট ড্রয়িং শনাক্ত হয়েছে')}
                      </span>
                    </div>
                  )}

                {result.direction !== 'WAIT' && (
                  <div className="mt-2 pt-2.5 border-t border-slate-700/50 w-full flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleFeedbackOutcome('WIN')}
                      className="px-3 py-1.5 text-xs bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 rounded-lg font-semibold transition-colors whitespace-nowrap"
                    >
                      সফল (Win)
                    </button>
                    <button
                      onClick={() => handleFeedbackOutcome('LOSS')}
                      className="px-3 py-1.5 text-xs bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 rounded-lg font-semibold transition-colors whitespace-nowrap"
                    >
                      ভুল (Loss)
                    </button>
                  </div>
                )}
              </div>

              {learningFeedbackMsg && (
                <div className="p-2.5 bg-cyan-950/60 border border-cyan-500/40 rounded-lg text-xs text-cyan-200 text-center">
                  {learningFeedbackMsg}
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">মার্কেট ভেরিফিকেশন</span>
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      result.marketVerification.status === 'MATCHED' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {result.marketVerification.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{result.marketVerification.notes}</p>
              </div>
            </div>

            {/* Column 2: Technical Data */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">টেকনিক্যাল তথ্য</span>
                <span className="text-cyan-400 font-mono">
                  {result.visionData.symbol || 'ASSET'} ({result.visionData.timeframe || 'TF'})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">মার্কেট</span>
                  <span className="font-semibold text-slate-200">{result.visionData.marketType}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">ট্রেন্ড</span>
                  <span className="font-semibold text-slate-200">{result.visionData.chartStructure}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">শেষ ক্যান্ডেল</span>
                  <span className="font-semibold text-emerald-400">{result.visionData.lastCandleDirection}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">প্যাটার্ন</span>
                  <span className="font-semibold text-slate-200">{result.visionData.candlestickPattern || 'None'}</span>
                </div>
              </div>

              {result.visionData.indicatorsIdentified.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-slate-400 font-medium">ইন্ডিকেটর</span>
                  <div className="text-slate-300 font-mono">
                    {result.visionData.indicatorsIdentified.map((ind) => `${ind.name}: ${ind.bias}`).join(' · ')}
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 leading-relaxed">
                {result.visionData.visionSummary}
              </div>
            </div>

            {/* Column 3: Reasoning Chain */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <span className="text-xs font-bold text-white block">সিদ্ধান্তের কারণ</span>

              <div className="space-y-2 text-xs">
                {result.reasoning.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-slate-500 font-mono shrink-0">{idx + 1}.</span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MODE B: Live Screen Preview & Waiting State */
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Radar className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">চার্ট অনুসন্ধান চলছে</h3>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums flex items-center gap-2">
              <span>স্ক্রিন: {lastDetectedAppName}</span>
              <span aria-hidden="true">·</span>
              <span>ফ্রেম #{frameCount}</span>
            </div>
          </div>

          {/* Self-Detection Warning */}
          {(lastDetectedAppName.toLowerCase().includes('tradepulse') ||
            lastDetectedAppName.includes('ট্রেডপাল্স') ||
            Boolean(chartDiagnostic?.failureReason?.includes('ট্রেডপাল্স'))) && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center gap-2.5 text-xs text-amber-200">
              <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
              <span>অ্যাপ মিনিমাইজ করে আপনার ব্রোকার (Quotex / Pocket Option) চার্ট ওপেন করুন।</span>
            </div>
          )}

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1.5 border-b border-slate-800">
              <span className="font-semibold text-cyan-300">লাইভ প্রিভিউ</span>
              <span className="font-mono text-slate-400 truncate max-w-[160px]">{lastDetectedAppName}</span>
            </div>

            <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
              {liveScreenService.getStream() ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Monitor className="w-8 h-8 text-slate-600" />
                  <span>স্ক্রিন শেয়ার প্রস্তুত</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Screen Transition History */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
            <History className="w-4 h-4 text-cyan-400" />
            <span>স্ক্রিন পরিবর্তন লগ</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-mono text-slate-400 tabular-nums">মোট: {transitions.length}</span>
            {transitions.length > 0 && (
              <button
                onClick={() => liveScreenService.clearScreenTransitions()}
                className="text-xs text-slate-400 hover:text-rose-300 underline whitespace-nowrap"
              >
                মুছুন
              </button>
            )}
          </div>
        </div>

        {transitions.length > 0 ? (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {transitions.map((t) => (
              <div
                key={t.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 font-medium text-slate-200">
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t.appName}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <span className="truncate max-w-xs">{t.summaryBn}</span>
                  <span className={`font-semibold whitespace-nowrap ${t.isChart ? 'text-emerald-400' : 'text-cyan-400'}`}>
                    {t.isChart ? 'চার্ট' : 'পঠিত'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-3">এখনো কোনো লগ নেই।</p>
        )}
      </div>

      {/* 5. Ask AI About Screen */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>স্ক্রিন সম্পর্কে প্রশ্ন করুন</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
          <button
            onClick={() => handleAskQuestion('এই স্ক্রিনে কী লেখা আছে?')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs transition-colors whitespace-nowrap shrink-0"
          >
            স্ক্রিনে কী আছে?
          </button>
          <button
            onClick={() => handleAskQuestion('কোন অ্যাপ্লিকেশন বা সাইট খোলা আছে?')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs transition-colors whitespace-nowrap shrink-0"
          >
            কোন অ্যাপ খোলা?
          </button>
          <button
            onClick={() => handleAskQuestion('স্ক্রিনে কোন এরর বা সতর্কতা মেসেজ আছে কি?')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs transition-colors whitespace-nowrap shrink-0"
          >
            কোনো সতর্কতা আছে কি?
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="প্রশ্ন লিখুন..."
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleAskQuestion()}
            disabled={isAskingQuestion || !questionInput.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            {isAskingQuestion ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>জিজ্ঞাসা করুন</span>
          </button>
        </div>

        {questionAnswer && (
          <div className="p-3 rounded-xl bg-cyan-950/35 border border-cyan-500/40 text-xs text-cyan-200 leading-relaxed">
            {questionAnswer}
          </div>
        )}
      </div>

      {/* 6. Backend Server Configuration Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>সার্ভার সেটিংস</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  className="text-slate-400 hover:text-white text-xs whitespace-nowrap"
                >
                  বন্ধ করুন
                </button>
              </div>

              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 block">Backend URL</label>
                <input
                  type="text"
                  placeholder="https://your-backend.run.app"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>ডিফল্ট: /api</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomUrlInput('');
                      setCustomApiUrl('');
                      runHealthCheck();
                    }}
                    className="text-cyan-400 hover:text-cyan-300 underline whitespace-nowrap"
                  >
                    ডিফল্ট রিসেট
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={runHealthCheck}
                  disabled={isTestingServer}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingServer ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>টেস্ট পিং</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomApiUrl(customUrlInput);
                    runHealthCheck();
                    setShowServerModal(false);
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  সেভ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Alert Configuration Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl p-5 sm:p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-white">হোয়াটসঅ্যাপ সিগন্যাল অ্যালার্ট</h3>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  বন্ধ করুন
                </button>
              </div>
              <WhatsAppAlertConfigPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
