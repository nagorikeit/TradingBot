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
  Sliders,
  Volume2,
  VolumeX,
  Server,
  Wifi,
  WifiOff,
  ExternalLink,
  Sparkles,
  Smartphone,
  Radar,
  FileText,
  Code,
  MessageSquare,
  Video,
  Send,
  History,
  Tv,
  ArrowRight,
  BookOpen,
  Terminal,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { voiceAssistantService } from '../services/voiceAssistantService';
import { agentLearningService } from '../services/agentLearningService';
import {
  LiveStreamState,
  ScreenAnalysisFinalResult,
  ChartDetectionDiagnostic,
  ScreenTransitionRecord,
} from '../types/screenTypes';
import {
  getCustomApiUrl,
  setCustomApiUrl,
  checkBackendHealth,
} from '../services/apiConfig';

export const LiveScreenAnalyzer: React.FC = () => {
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
  const [streamState, setStreamState] = useState<LiveStreamState>(liveScreenService.getState());
  const [result, setResult] = useState<ScreenAnalysisFinalResult | null>(liveScreenService.getLatestResult());
  const [isBusy, setIsBusy] = useState<boolean>(liveScreenService.isBusy());
  const [intervalSec, setIntervalSec] = useState<number>(liveScreenService.getScanIntervalSeconds());
  const [errorMessage, setErrorMessage] = useState<string | null>(liveScreenService.getErrorMessage());
  const [now, setNow] = useState<number>(Date.now());
  const [isVoiceOn, setIsVoiceOn] = useState<boolean>(voiceAssistantService.isVoiceEnabled());
  const [voiceNotification, setVoiceNotification] = useState<string | null>(null);

  const [expirySec, setExpirySec] = useState<number>(liveScreenService.getExpirySecondsLeft());
  const [isChartFound, setIsChartFound] = useState<boolean>(liveScreenService.isChartDetected());
  const [chartDiagnostic, setChartDiagnostic] = useState<ChartDetectionDiagnostic | null>(
    liveScreenService.getChartDiagnostic()
  );

  // Screen Switch Transitions & History
  const [transitions, setTransitions] = useState<ScreenTransitionRecord[]>(liveScreenService.getScreenTransitions());
  const [isOtherScreenActive, setIsOtherScreenActive] = useState<boolean>(liveScreenService.isOtherScreenDetected());
  const [activeScreenName, setActiveScreenName] = useState<string>(liveScreenService.getActiveScreenName());
  const [isPiPActive, setIsPiPActive] = useState<boolean>(liveScreenService.isPictureInPictureActive());
  const [activeTestScreen, setActiveTestScreen] = useState<string | null>(null);

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
      setLearningFeedbackMsg('✅ ট্রেডটি সফল (WIN)! এআই এই কৌশলে কনফিডেন্স বাড়িয়েছে।');
    } else {
      setLearningFeedbackMsg('⚠️ ট্রেডটিতে ভুল (LOSS) হয়েছে! এআই কারণ বিশ্লেষণ করে নলেজ প্লেবুক আপডেট করেছে।');
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
      setIsOtherScreenActive(liveScreenService.isOtherScreenDetected());
      setActiveScreenName(liveScreenService.getActiveScreenName());
      setIsPiPActive(liveScreenService.isPictureInPictureActive());
    });
    return unsub;
  }, []);

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

  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
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

  const handleManualSnap = () => {
    liveScreenService.captureAndAnalyzeCurrentFrame();
  };

  const handleTogglePiP = async () => {
    const active = await liveScreenService.togglePictureInPicture();
    setIsPiPActive(active);
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

  return (
    <div className="space-y-6">
      {/* 1. Top Controller & Connection Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Live Screen Analysis & Universal OCR</h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-mono font-medium rounded-full ${
                    isStreaming
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                      : isPaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : isConnecting
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isStreaming && '● LIVE STREAMING'}
                  {isPaused && '⏸ PAUSED'}
                  {isConnecting && 'CONNECTING...'}
                  {(streamState === 'IDLE' || streamState === 'DISCONNECTED') && 'DISCONNECTED'}
                  {streamState === 'ERROR' && 'ERROR'}
                </span>

                {isStreaming && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono rounded-full bg-cyan-950/80 border border-cyan-600/50 text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>সক্রিয় স্ক্রিন: <strong>{activeScreenName}</strong></span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                স্ক্রিন শেয়ার সংযুক্ত করার পর যেকোনো অ্যাপ বা স্ক্রিনে যান (Quotex, Pocket Option, YouTube, ব্রাউজার, কোড এডিটর)—এআই তাৎক্ষণিক শনাক্ত ও রিড করবে।
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isStreaming && (
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

            {isPaused && (
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

            {(streamState === 'IDLE' || streamState === 'DISCONNECTED' || streamState === 'ERROR') && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 active:scale-95 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                  title="লাইভ স্ক্রিন শেয়ারিং ও যেকোনো স্ক্রিন সনাক্তকরণ ইঞ্জিন চালু করুন"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Connect Live Screen</span>
                </button>

                {isInsideIframe && (
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open(window.location.href, '_blank');
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                    title="নতুন ব্রাউজার উইন্ডো/ট্যাবে খুললে ব্রাউজার কোনো বাধা ছাড়াই সম্পূর্ণ ডিসপ্লে শেয়ার অনুমতি দেয়"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>নতুন ট্যাবে খুলুন</span>
                  </button>
                )}
              </div>
            )}

            {isConnecting && (
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="px-3.5 py-2 text-xs font-semibold text-cyan-200 bg-cyan-950/80 border border-cyan-500/40 rounded-lg flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>Connecting...</span>
                </button>
                <button
                  onClick={() => liveScreenService.cancelConnecting()}
                  className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                >
                  রিসেট
                </button>
              </div>
            )}

            {/* Picture-in-Picture (PiP) Window Button */}
            <button
              onClick={handleTogglePiP}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors shadow-sm ${
                isPiPActive
                  ? 'bg-purple-950/50 border-purple-500/50 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="অন্যান্য অ্যাপ্লিকেশন চালানোর সময়ও স্ক্রিনের একপাশে ভাসমান PiP প্রিভিউ দেখতে ক্লিক করুন"
            >
              <Tv className="w-4 h-4 text-purple-400" />
              <span>{isPiPActive ? 'PiP উইন্ডো সক্রিয়' : 'PiP উইন্ডো'}</span>
            </button>

            {/* Voice Assistant Toggle Button */}
            <button
              onClick={handleToggleVoice}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors shadow-sm ${
                isVoiceOn
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={isVoiceOn ? 'ভয়েস সহকারী চালু আছে' : 'ভয়েস সহকারী বন্ধ আছে'}
            >
              {isVoiceOn ? <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span>{isVoiceOn ? 'ভয়েস অন' : 'ভয়েস অফ'}</span>
            </button>

            {/* Floating HUD Widget Toggle */}
            <button
              onClick={() => {
                if (liveScreenService.isOverlayActive()) {
                  liveScreenService.hideFloatingOverlayHUD();
                } else {
                  liveScreenService.showFloatingOverlayHUD({
                    direction: result?.direction || 'WAIT',
                    confidence: result?.confidence || 0,
                    durationText: '1-3 min',
                    verdictTitle: result?.verdictTitle || 'TRADEPULSE HUD',
                    reasonText: result?.reasoning[0] || 'Floating HUD active over other trading apps.',
                    latencyMs: 120,
                  });
                }
              }}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 flex items-center gap-1.5 transition-colors shadow-sm"
              title="অন্য যেকোনো ট্রেডিং অ্যাপের ওপর ভাসমান উইন্ডো দেখানো বা লুকানো"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>ফ্লোটিং HUD</span>
            </button>

            {/* Backend Server Settings Button */}
            <button
              onClick={() => {
                setShowServerModal(true);
                runHealthCheck();
              }}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors shadow-sm ${
                serverStatus.tested && serverStatus.ok
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {serverStatus.tested && serverStatus.ok ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : (
                <Server className="w-4 h-4 text-cyan-400" />
              )}
              <span>
                {serverStatus.tested && serverStatus.ok
                  ? `সার্ভার সক্রিয় (${serverStatus.latencyMs}ms)`
                  : 'সার্ভার চেক'}
              </span>
            </button>
          </div>
        </div>

        {/* Refresh Interval Slider & Privacy Note */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Inspection Interval:</span>
            <input
              type="range"
              min="3"
              max="20"
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
              Privacy Protected: Account balance and login credentials are automatically shielded.
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Screen Switch Verification Test Bench (ব্যবহারকারীর টেস্টের জন্য) */}
      <div className="p-4 rounded-xl bg-slate-900/95 border border-cyan-500/30 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>স্ক্রিন সুইচ ও এআই রিডিং টেস্ট বেঞ্চ (Screen Switch & OCR Test Matrix)</span>
          </div>
          <span className="text-xs text-cyan-300 font-normal">
            ১-ক্লিকে যেকোনো স্ক্রিন স্যুইচ করে এআই রিডিং ও বাংলা ভয়েস পরীক্ষা করুন 👇
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Test 1: Quotex Chart */}
          <button
            onClick={() => handleScreenSwitchTest('QUOTEX_CHART')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all active:scale-95 ${
              activeTestScreen === 'QUOTEX_CHART'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-md ring-1 ring-emerald-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-emerald-500/50 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                ট্রেডিং চার্ট
              </span>
              <Monitor className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">Quotex AUD/CAD</div>
              <div className="text-[10px] text-slate-400 mt-0.5">ক্যান্ডেল রিডিং ও CALL সিগন্যাল</div>
            </div>
          </button>

          {/* Test 2: Chrome Document */}
          <button
            onClick={() => handleScreenSwitchTest('CHROME_DOC')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all active:scale-95 ${
              activeTestScreen === 'CHROME_DOC'
                ? 'bg-blue-950/60 border-blue-500 text-blue-200 shadow-md ring-1 ring-blue-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-blue-500/50 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40">
                ব্রাউজার পেজ
              </span>
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">Google Chrome</div>
              <div className="text-[10px] text-slate-400 mt-0.5">ফাইন্যান্স গাইড টেক্সট OCR</div>
            </div>
          </button>

          {/* Test 3: VS Code IDE */}
          <button
            onClick={() => handleScreenSwitchTest('VS_CODE')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all active:scale-95 ${
              activeTestScreen === 'VS_CODE'
                ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md ring-1 ring-purple-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-purple-500/50 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40">
                কোড এডিটর
              </span>
              <Code className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">VS Code IDE</div>
              <div className="text-[10px] text-slate-400 mt-0.5">টাইপস্ক্রিপ্ট কোড সিনট্যাক্স রিড</div>
            </div>
          </button>

          {/* Test 4: WhatsApp Web */}
          <button
            onClick={() => handleScreenSwitchTest('WHATSAPP')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all active:scale-95 ${
              activeTestScreen === 'WHATSAPP'
                ? 'bg-teal-950/60 border-teal-500 text-teal-200 shadow-md ring-1 ring-teal-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-teal-500/50 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-500/40">
                মেসেঞ্জার
              </span>
              <MessageSquare className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">WhatsApp Web</div>
              <div className="text-[10px] text-slate-400 mt-0.5">চ্যাট বার্তা ও প্রাইভেসি প্রটেকশন</div>
            </div>
          </button>

          {/* Test 5: YouTube Video */}
          <button
            onClick={() => handleScreenSwitchTest('YOUTUBE')}
            className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all active:scale-95 ${
              activeTestScreen === 'YOUTUBE'
                ? 'bg-rose-950/60 border-rose-500 text-rose-200 shadow-md ring-1 ring-rose-500/50'
                : 'bg-slate-950/70 border-slate-800 hover:border-rose-500/50 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-500/40">
                ভিডিও প্লেয়ার
              </span>
              <Video className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="font-bold text-white text-xs">YouTube Player</div>
              <div className="text-[10px] text-slate-400 mt-0.5">ভিডিও শিরোনাম ও মেটাডাটা</div>
            </div>
          </button>
        </div>
      </div>

      {/* Voice Assistant Speech Subtitle Banner */}
      {voiceNotification && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-center gap-3 text-xs text-cyan-200 shadow-md animate-in fade-in duration-150">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
            <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div className="flex-1 font-medium leading-relaxed">
            <span className="font-semibold text-cyan-300 mr-1.5">🗣️ ভয়েস সহকারী:</span>
            “{voiceNotification}”
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-300">
                {errorMessage.includes('Failed to fetch')
                  ? '⚠️ সার্ভার সংযোগ বিচ্ছিন্ন (Failed to fetch)'
                  : `Notice: ${errorMessage}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN DISPLAY: Switches dynamically between Trading Chart Analysis and Other Screen Reading */}
      {isChartFound && result && result.visionData?.isClearTradingChart ? (
        /* MODE A: Active Trading Chart Analysis View */
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/40 px-4 py-2.5 rounded-xl text-xs text-emerald-300">
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ট্রেডিং চার্ট সক্রিয়: এআই ক্যান্ডেলস্টিক ও টেকনিক্যাল মোমেন্টাম বিশ্লেষণ করছে</span>
            </div>
            <span className="font-mono text-[11px] bg-slate-900 px-2.5 py-0.5 rounded border border-emerald-500/40">
              {result.visionData.symbol || 'ASSET'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Signal & Verification Verdict */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Synthesized Signal
                </span>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>কাউন্টডাউন: <strong className="text-cyan-300 font-mono">{formattedCountdown}</strong></span>
                </div>
              </div>

              {/* Big Direction Badge */}
              <div
                className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 ${
                  result.direction === 'UP'
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : result.direction === 'DOWN'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                }`}
              >
                <div className="text-2xl font-black tracking-tight font-mono">
                  {result.direction === 'UP' && '▲ CALL / UP ট্রেড'}
                  {result.direction === 'DOWN' && '▼ PUT / DOWN ট্রেড'}
                  {result.direction === 'WAIT' && '⏸ পর্যবেক্ষণাধীন (WAIT)'}
                </div>
                <div className="text-xs font-medium opacity-90">
                  {result.verdictTitle}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/60">
                    কনফিডেন্স: {result.confidence}%
                  </span>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-600/50 text-cyan-300">
                    ⏱️ এক্সপায়ারি: {formattedCountdown}
                  </span>
                </div>

                {/* 1-Click AI Self-Learning Outcome Feedback */}
                {result.direction !== 'WAIT' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-slate-300 font-medium">
                      ট্রেড ফলাফল দিয়ে এআই-কে শিক্ষা দিন:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFeedbackOutcome('WIN')}
                        className="px-2.5 py-1 text-[11px] bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 rounded font-semibold transition-all active:scale-95"
                      >
                        + লাভ (Win)
                      </button>
                      <button
                        onClick={() => handleFeedbackOutcome('LOSS')}
                        className="px-2.5 py-1 text-[11px] bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 rounded font-semibold transition-all active:scale-95"
                      >
                        - ভুল/লস (Loss)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {learningFeedbackMsg && (
                <div className="p-2.5 bg-cyan-950/70 border border-cyan-500/50 rounded-lg text-xs text-cyan-200 text-center animate-fadeIn">
                  {learningFeedbackMsg}
                </div>
              )}

              {/* Market Verification Status Box */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Market Verification:</span>
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      result.marketVerification.status === 'MATCHED'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {result.marketVerification.status}
                  </span>
                </div>
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
                  <span className="font-semibold text-emerald-400">
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

              {/* Indicators Identified */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 font-medium">সনাক্তকৃত ইন্ডিকেটর:</span>
                <div className="flex flex-wrap gap-1.5">
                  {result.visionData.indicatorsIdentified.map((ind, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono"
                    >
                      {ind.name}: {ind.bias}
                    </span>
                  ))}
                </div>
              </div>

              {/* Visual Summary */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-cyan-300 mr-1">এআই ভিশন সামারি:</span>
                {result.visionData.visionSummary}
              </div>
            </div>

            {/* Column 3: Reasoning Steps & Safe Execution Notice */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Analysis Reasoning Chain
              </span>

              <div className="space-y-2 text-xs">
                {result.reasoning.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-[11px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 inline mr-1.5" />
                <span>{result.safetyDisclaimer}</span>
              </div>
            </div>
          </div>
        </div>
      ) : result && (!isChartFound || result.screenStatus === 'OTHER_SCREEN_READING') ? (
        /* MODE B: Other Screen Recognition & Universal OCR Reading View */
        <div className="bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-md animate-in fade-in duration-200">
          {/* Header Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-lg">
                {result.visionData?.screenCategory === 'DOCUMENT' ? (
                  <FileText className="w-6 h-6 text-blue-400" />
                ) : result.visionData?.screenCategory === 'CODE_IDE' ? (
                  <Code className="w-6 h-6 text-purple-400" />
                ) : result.visionData?.screenCategory === 'CHAT_MESSENGER' ? (
                  <MessageSquare className="w-6 h-6 text-teal-400" />
                ) : result.visionData?.screenCategory === 'VIDEO_STREAM' ? (
                  <Video className="w-6 h-6 text-rose-400" />
                ) : (
                  <Monitor className="w-6 h-6 text-cyan-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {result.visionData?.detectedAppName || 'অন্যান্য অ্যাপ্লিকেশন স্ক্রিন'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    {result.visionData?.screenCategory || 'GENERAL_SCREEN'}
                  </span>
                </div>
                <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>স্ক্রিন শনাক্ত ও টেক্সট সফলভাবে পড়া হয়েছে (Readability: {result.confidence}%)</span>
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>ট্রেড সিগন্যাল স্থগিত (WAIT)</span>
              </span>
            </div>
          </div>

          {/* Bengali Visual Summary Banner */}
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1 text-slate-200 text-xs leading-relaxed">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>এআই স্ক্রিন সারসংক্ষেপ:</span>
            </div>
            <p className="text-sm font-medium text-slate-100 pl-5">
              {result.visionData?.screenSummaryBn || result.visionData?.visionSummary || 'স্ক্রিন ফ্রেম পর্যবেক্ষণ করা হয়েছে।'}
            </p>
          </div>

          {/* Live Extracted OCR Text Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800/80 pb-2">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <BookOpen className="w-4 h-4" />
                <span>পঠিত প্রধান টেক্সট ও ইন্টারফেস উপাদান (Extracted Text from Screen):</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {result.visionData?.extractedText?.length || 0} টি উপাদান পঠিত
              </span>
            </div>

            {result.visionData?.extractedText && result.visionData.extractedText.length > 0 ? (
              <div className="space-y-2">
                {result.visionData.extractedText.map((snippet, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono flex items-start gap-2"
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span className="break-all">{snippet}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                স্ক্রিন ইমেজ প্রসেস করা হয়েছে কিন্তু কোনো নির্দিষ্ট টেক্সট ব্লক পাওয়া যায়নি।
              </p>
            )}
          </div>

          {/* Safe Trading Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>নিরাপদ ট্রেডিং গ্যারান্টি:</strong> ব্যবহারকারী যখনই অন্য যেকোনো অ্যাপ্লিকেশন বা ব্রাউজার পেজে যান, এআই নিশ্চিত করে যে কোনো ভুল বা মিথ্যা ট্রেড সিগন্যাল তৈরি না হয়। আবার ট্রেডিং চার্ট (Quotex/Binomo/TradingView)-এ ফিরে আসলে তাৎক্ষণিক ক্যান্ডেলস্টিক এনালাইসিস চালু হবে।
            </div>
          </div>
        </div>
      ) : (
        /* MODE C: Searching / Initial State View */
        <div className="bg-slate-900/90 border-2 border-dashed border-amber-500/40 rounded-2xl p-8 sm:p-12 text-center space-y-6 shadow-2xl backdrop-blur-md">
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-amber-500/20 animate-pulse" />
            <div className="w-16 h-16 rounded-full bg-slate-950 border-2 border-amber-500/60 flex items-center justify-center text-amber-400 shadow-lg">
              <Radar className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>স্ক্রিন শেয়ার সংযুক্ত • লাইভ ফ্রেম স্ক্যান চলছে</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              যেকোনো অ্যাপ্লিকেশন বা ব্রাউজার স্ক্রিনে যান
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              স্ক্রিন পরিবর্তন করলেই এআই স্বয়ংক্রিয়ভাবে অ্যাপ ও টেক্সট ডিটেক্ট করবে। অথবা উপরের <strong>টেস্ট বেঞ্চের যেকোনো বোতামে ক্লিক করে</strong> তাৎক্ষণিক ফলাফল পরীক্ষা করুন।
            </p>
          </div>
        </div>
      )}

      {/* 4. Real-Time Screen Transition Audit Log (স্ক্রিন সুইচ ট্র্যাকার ও হিস্ট্রি) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <History className="w-4 h-4 text-cyan-400" />
            <span>স্ক্রিন সুইচ ট্র্যাকার ও হিস্ট্রি লগ (Screen Transition Audit Log)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              মোট সুইচ রেকর্ড: <strong className="text-cyan-300">{transitions.length}</strong>
            </span>
            {transitions.length > 0 && (
              <button
                onClick={() => liveScreenService.clearScreenTransitions()}
                className="text-[11px] text-slate-400 hover:text-rose-300 underline"
              >
                মুছে ফেলুন
              </button>
            )}
          </div>
        </div>

        {transitions.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {transitions.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {new Date(t.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <span>{t.appName}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {t.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span className="truncate max-w-xs">{t.summaryBn}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-semibold ${
                      t.isChart
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                    }`}
                  >
                    {t.isChart ? 'চার্ট সিগন্যাল' : 'পঠিত'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4 italic">
            এখনো কোনো স্ক্রিন সুইচ লগ হয়নি। উপরের টেস্ট বেঞ্চে ক্লিক করুন অথবা ব্রাউজারের অন্য উইন্ডোতে যান।
          </p>
        )}
      </div>

      {/* 5. Interactive "Ask AI About Current Screen" (স্ক্রিন থেকে তথ্য জানুন) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>স্ক্রিন সম্পর্কিত যেকোনো প্রশ্ন জিজ্ঞাসা করুন (Ask AI About Screen)</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">Multimodal Vision Inspection</span>
        </div>

        {/* Quick Question Chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => handleAskQuestion('এই স্ক্রিনে কী লেখা আছে?')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-colors"
          >
            "এই স্ক্রিনে কী লেখা আছে?"
          </button>
          <button
            onClick={() => handleAskQuestion('কোন অ্যাপ্লিকেশন বা সাইট খোলা আছে?')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-colors"
          >
            "কোন অ্যাপ্লিকেশন খোলা আছে?"
          </button>
          <button
            onClick={() => handleAskQuestion('স্ক্রিনে কোন এরর বা সতর্কতা মেসেজ আছে কি?')}
            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-colors"
          >
            "কোন সতর্কতা মেসেজ আছে কি?"
          </button>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="আপনার প্রশ্ন লিখুন (যেমন: স্ক্রিনের ব্যালেন্স বা প্রধান টেক্সট কী?)..."
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            onClick={() => handleAskQuestion()}
            disabled={isAskingQuestion || !questionInput.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
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
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200 leading-relaxed animate-in fade-in">
            <span className="font-bold text-cyan-300 block mb-1">🤖 এআই উত্তর:</span>
            {questionAnswer}
          </div>
        )}
      </div>

      {/* 6. Backend Server Configuration Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>সার্ভার কানেকশন সেটিংস</span>
              </div>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ বন্ধ করুন
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Backend Server URL
              </label>
              <input
                type="text"
                placeholder="https://your-backend.run.app অথবা http://192.168.1.X:3000"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>ডিফল্ট: ফুলস্ট্যাক ওয়েব প্রক্সি (/api)</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomUrlInput('');
                    setCustomApiUrl('');
                    runHealthCheck();
                  }}
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  ডিফল্ট এ ফিরিয়ে আনুন
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={runHealthCheck}
                disabled={isTestingServer}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingServer ? 'animate-spin text-cyan-400' : ''}`} />
                <span>টেস্ট পিং (Ping)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomApiUrl(customUrlInput);
                  runHealthCheck();
                  setShowServerModal(false);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                সেভ করুন (Save)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
