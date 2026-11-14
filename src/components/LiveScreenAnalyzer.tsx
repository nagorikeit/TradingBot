import React, { useEffect, useState, useRef } from 'react';
import {
  Monitor,
  Play,
  Pause,
  Square,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  Sliders,
  Volume2,
  VolumeX,
  Server,
  Wifi,
  ExternalLink,
  Smartphone,
  Radar,
  FileText,
  Code,
  MessageSquare,
  Video,
  Send,
  History,
  Tv,
  Terminal,
  Download,
  Puzzle,
} from 'lucide-react';
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

export const LiveScreenAnalyzer: React.FC = () => {
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
  const [isPiPActive, setIsPiPActive] = useState<boolean>(liveScreenService.isPictureInPictureActive());
  const [isDesktopPipActive, setIsDesktopPipActive] = useState<boolean>(desktopPipService.isActive());
  const [desktopPipError, setDesktopPipError] = useState<string | null>(null);
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(liveScreenService.isOverlayActive());
  const [activeTestScreen, setActiveTestScreen] = useState<string | null>(null);
  const [scanQuota, setScanQuota] = useState<EffectiveScanQuotaStatus>(() => authService.getScanQuotaStatus());

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

  const handleFeedbackOutcome = (outcome: 'WIN' | 'LOSS') => {
    if (!result || result.direction === 'WAIT') return;
    const symbol = result.visionData?.symbol || 'LIVE CHART';
    const direction: 'CALL' | 'PUT' = result.direction === 'UP' ? 'CALL' : 'PUT';
    const pattern = result.visionData?.candlestickPattern;
    agentLearningService.recordOutcome(symbol, direction, outcome, pattern);
    if (outcome === 'WIN') {
      setLearningFeedbackMsg('ট্রেড সফল (WIN) হিসেবে সংরক্ষিত হয়েছে।');
    } else {
      setLearningFeedbackMsg('ট্রেড লস (LOSS) হিসেবে রেকর্ড ও বিশ্লেষণ করা হয়েছে।');
    }
    setTimeout(() => setLearningFeedbackMsg(null), 5000);
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
      setIsPiPActive(liveScreenService.isPictureInPictureActive());
      setIsOverlayActive(liveScreenService.isOverlayActive());
    });
    const unsubPip = desktopPipService.subscribe((active) => {
      setIsDesktopPipActive(active);
    });
    const unsubAuth = authService.subscribe(() => {
      setScanQuota(authService.getScanQuotaStatus());
    });
    const unsubPlans = authService.subscribePlans(() => {
      setScanQuota(authService.getScanQuotaStatus());
    });
    return () => {
      unsub();
      unsubPip();
      unsubAuth();
      unsubPlans();
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
    await liveScreenService.connectScreen();
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
    liveScreenService.disconnect();
    setActiveTestScreen(null);
  };

  const handleTogglePiP = async () => {
    const active = await liveScreenService.togglePictureInPicture();
    setIsPiPActive(active);
  };

  const handleToggleDesktopPip = async () => {
    setDesktopPipError(null);
    const res = await desktopPipService.openInteractiveBubble();
    if (!res.ok && res.message) {
      setDesktopPipError(res.message);
    }
  };

  const handleScreenSwitchTest = async (
    type: 'QUOTEX_CHART' | 'CHROME_DOC' | 'VS_CODE' | 'WHATSAPP' | 'YOUTUBE'
  ) => {
    setActiveTestScreen(type);
    await liveScreenService.testScreenSwitch(type);
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
              <>
                <button
                  onClick={handleConnect}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>স্ক্রিন শেয়ার</span>
                </button>

                {isInsideIframe && (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open(window.location.href, '_blank');
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>নতুন ট্যাব</span>
                  </button>
                )}
              </>
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
              onClick={handleTogglePiP}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isPiPActive
                  ? 'bg-purple-950/50 border-purple-500/50 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-purple-400" />
              <span>PiP উইন্ডো</span>
            </button>

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
              onClick={() => {
                if (isOverlayActive) {
                  liveScreenService.hideFloatingOverlayHUD();
                } else {
                  liveScreenService.showFloatingOverlayHUD({
                    direction: result?.direction || 'WAIT',
                    confidence: result?.confidence || 0,
                    durationText: '1-3 min',
                    verdictTitle: result?.verdictTitle || 'TRADEPULSE HUD',
                    reasonText: result?.reasoning[0] || 'Floating HUD active over trading app.',
                    latencyMs: 120,
                  });
                }
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isOverlayActive
                  ? 'border-cyan-500 bg-cyan-950/70 text-cyan-200'
                  : 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isOverlayActive ? 'HUD অন' : 'ফ্লোটিং HUD'}</span>
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

        {/* Interval & Live Quota Strip */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>স্ক্যান বিরতি:</span>
            <input
              type="range"
              min="3"
              max="20"
              step="1"
              value={intervalSec}
              onChange={(e) => liveScreenService.setScanIntervalSeconds(Number(e.target.value))}
              className="w-24 accent-cyan-500 cursor-pointer"
            />
            <span className="font-mono font-semibold text-slate-200 tabular-nums">{intervalSec}s</span>
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

      {/* 1.5 Desktop Floating Bubble & Chrome Extension */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white">ডেস্কটপ ফ্লোটিং বাবল</h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Method 1: Always-on-Top Browser Bubble */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Always-on-Top বাবল (PiP)</span>
                </span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">তাৎক্ষণিক</span>
              </div>
              <p className="text-xs text-slate-400">
                অন্য ট্যাবে বা ব্রোকার সাইটে গেলেও ভাসমান উইন্ডো থেকে ১-ক্লিকে স্ক্যান ও সিগন্যাল দেখা যাবে।
              </p>
            </div>

            {desktopPipError && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>{desktopPipError}</span>
                {isInsideIframe && (
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>নতুন ট্যাব</span>
                  </a>
                )}
              </div>
            )}

            <button
              onClick={handleToggleDesktopPip}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                isDesktopPipActive
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-cyan-600/20 hover:bg-cyan-600/35 text-cyan-200 border border-cyan-500/40'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>{isDesktopPipActive ? 'পিসি বাবল চালু আছে (বন্ধ করুন)' : 'পিসি বাবল চালু করুন'}</span>
            </button>
          </div>

          {/* Method 2: Chrome Extension */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Puzzle className="w-3.5 h-3.5" />
                  <span>Chrome এক্সটেনশন</span>
                </span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">অটো ইনজেক্ট</span>
              </div>
              <p className="text-xs text-slate-400">
                ডাউনলোড ও আনজিপ করে <code className="text-cyan-300">chrome://extensions</code> (Developer mode → Load unpacked)-এ যুক্ত করুন।
              </p>
            </div>

            <a
              href={getApiUrl('/api/extension/download')}
              download="TradePulse-Chrome-Extension.zip"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>এক্সটেনশন ডাউনলোড (.zip)</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Quick Test Strip */}
      <div className="px-4 py-3 rounded-xl bg-slate-900/95 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-xs font-bold text-white whitespace-nowrap shrink-0">কুইক টেস্ট</span>

        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0">
          <button
            onClick={() => handleScreenSwitchTest('QUOTEX_CHART')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTestScreen === 'QUOTEX_CHART'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
                : 'bg-slate-950 border-slate-800 hover:border-emerald-500/50 text-slate-300'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>Quotex চার্ট</span>
          </button>

          <button
            onClick={() => handleScreenSwitchTest('CHROME_DOC')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTestScreen === 'CHROME_DOC'
                ? 'bg-blue-950/60 border-blue-500 text-blue-200'
                : 'bg-slate-950 border-slate-800 hover:border-blue-500/50 text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Chrome পেজ</span>
          </button>

          <button
            onClick={() => handleScreenSwitchTest('VS_CODE')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTestScreen === 'VS_CODE'
                ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                : 'bg-slate-950 border-slate-800 hover:border-purple-500/50 text-slate-300'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-purple-400" />
            <span>VS Code</span>
          </button>

          <button
            onClick={() => handleScreenSwitchTest('WHATSAPP')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTestScreen === 'WHATSAPP'
                ? 'bg-teal-950/60 border-teal-500 text-teal-200'
                : 'bg-slate-950 border-slate-800 hover:border-teal-500/50 text-slate-300'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => handleScreenSwitchTest('YOUTUBE')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTestScreen === 'YOUTUBE'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                : 'bg-slate-950 border-slate-800 hover:border-rose-500/50 text-slate-300'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-rose-400" />
            <span>YouTube</span>
          </button>
        </div>
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
          {result.signalFlow && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <span className="font-bold text-white">৫-ধাপ সিগন্যাল অডিট</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    result.signalFlow.signalScoring.totalScore >= 7.5 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  স্কোর: {result.signalFlow.signalScoring.totalScore.toFixed(1)}/১০
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>১. চার্ট</span>
                    <span className="text-emerald-400">নিশ্চিত</span>
                  </div>
                  <div className="text-white font-mono font-medium truncate">
                    {result.signalFlow.chartVerification.detectedAsset || result.visionData.symbol}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {result.signalFlow.chartVerification.detectedTimeframe} · {result.signalFlow.chartVerification.candleBarsCount} ক্যান্ডেল
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>২. ক্যান্ডেল</span>
                    <span className="text-cyan-400">OHLC</span>
                  </div>
                  <div className="text-white font-medium">
                    {result.signalFlow.candleData.closedCandle.type === 'BULLISH' ? 'বুলিশ (সবুজ)' : 'বিয়ারিশ (লাল)'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {result.signalFlow.candleData.closedCandle.isRejection ? 'উইক রিজেকশন' : 'সলিড বডি'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>৩. মাল্টি-TF</span>
                    <span
                      className={
                        result.signalFlow.multiTimeframe.confluenceStatus === 'ALIGNED'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {result.signalFlow.multiTimeframe.confluenceStatus === 'ALIGNED' ? 'অ্যালাইন্ড' : 'সতর্কতা'}
                    </span>
                  </div>
                  <div className="text-white font-mono text-[11px]">
                    15M:{result.signalFlow.multiTimeframe.macroTrend15m === 'UPTREND' ? 'UP' : result.signalFlow.multiTimeframe.macroTrend15m === 'DOWNTREND' ? 'DN' : 'RNG'} · 5M:{result.signalFlow.multiTimeframe.secondaryTrend5m === 'UPTREND' ? 'UP' : result.signalFlow.multiTimeframe.secondaryTrend5m === 'DOWNTREND' ? 'DN' : 'RNG'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    1M: {result.signalFlow.multiTimeframe.microTrend1m}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>৪. ফিল্টার</span>
                    <span className={result.signalFlow.marketFilter.passed ? 'text-emerald-400' : 'text-rose-400'}>
                      {result.signalFlow.marketFilter.passed ? 'পাসড' : 'ফিল্টার্ড'}
                    </span>
                  </div>
                  <div className="text-white font-medium text-[11px]">
                    {result.signalFlow.marketFilter.regime === 'TRENDING'
                      ? 'ট্রেন্ডিং'
                      : result.signalFlow.marketFilter.regime === 'SIDEWAYS'
                      ? 'সাইডওয়েজ'
                      : 'ভোলাটাইল'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {result.signalFlow.marketFilter.blockReason || 'স্বাভাবিক মার্কেট'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                    <span>৫. ভার্ডিক্ট</span>
                    <span className="text-amber-400 font-mono tabular-nums">
                      {result.signalFlow.signalScoring.totalScore.toFixed(1)}/১০
                    </span>
                  </div>
                  <div
                    className={`font-bold font-mono text-xs ${
                      result.signalFlow.signalScoring.finalVerdict === 'CALL'
                        ? 'text-emerald-400'
                        : result.signalFlow.signalScoring.finalVerdict === 'PUT'
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {result.signalFlow.signalScoring.finalVerdict === 'CALL'
                      ? '▲ CALL'
                      : result.signalFlow.signalScoring.finalVerdict === 'PUT'
                      ? '▼ PUT'
                      : '⏸ WAIT'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    PA {result.signalFlow.signalScoring.priceActionScore.toFixed(1)} · Ind {result.signalFlow.signalScoring.indicatorMomentumScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  {result.direction === 'UP' && '▲ CALL / UP (সবুজ)'}
                  {result.direction === 'DOWN' && '▼ PUT / DOWN (লাল)'}
                  {result.direction === 'WAIT' && '⏸ WAIT (অপেক্ষা)'}
                </div>
                <div className="text-xs font-medium opacity-90 max-w-sm">
                  {result.visionData?.nextCandlePredictionReasonBn || result.verdictTitle}
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
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>অ্যাপ মিনিমাইজ করে আপনার ব্রোকার (Quotex / Pocket Option) চার্ট ওপেন করুন।</span>
              </div>
              <button
                onClick={() => {
                  if (!liveScreenService.isOverlayActive()) {
                    liveScreenService.showFloatingOverlayHUD({
                      direction: 'WAIT',
                      confidence: 0,
                      durationText: 'অপেক্ষা',
                      verdictTitle: 'চার্ট অনুসন্ধান চলছে',
                      reasonText: 'ট্রেডপাল্স মিনিমাইজ করে ব্রোকার ওপেন করুন',
                      latencyMs: 50,
                    });
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                ফ্লোটিং HUD অন করুন
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
            {/* Live Video Feed */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1.5 border-b border-slate-800">
                <span className="font-semibold text-cyan-300">লাইভ স্ক্রিন প্রিভিউ</span>
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
                    <span>উপরের &quot;স্ক্রিন শেয়ার&quot; বাটনে ক্লিক করে ব্রোকার স্ক্রিন সংযুক্ত করুন।</span>
                  </div>
                )}
              </div>
            </div>

            {/* Concise Usage Guide */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs text-slate-300">
              <div className="font-bold text-white text-sm">ব্যবহার নির্দেশিকা</div>
              <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside">
                <li>উপর থেকে স্ক্রিন শেয়ার চালু করে সম্পূর্ণ স্ক্রিন বা ব্রোকার ট্যাব সিলেক্ট করুন।</li>
                <li>ব্রোকারে ক্যান্ডেলস্টিক চার্ট ওপেন রেখে &quot;স্ক্যান করুন&quot; অথবা পিসি বাবলে ক্লিক করুন।</li>
                <li>চার্ট দৃশ্যমান থাকলেই লাইভ CALL / PUT সিগন্যাল ও টাইমার দেখা যাবে।</li>
              </ol>
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
