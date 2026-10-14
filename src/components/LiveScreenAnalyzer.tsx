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
  Volume2,
  VolumeX,
  Server,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';
import { liveScreenService } from '../services/liveScreenService';
import { voiceAssistantService } from '../services/voiceAssistantService';
import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';
import {
  getApiBaseUrl,
  getCustomApiUrl,
  setCustomApiUrl,
  checkBackendHealth,
  DEFAULT_HOSTED_BACKEND_URL,
} from '../services/apiConfig';

export const LiveScreenAnalyzer: React.FC = () => {
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

  const signalAgeSec = result ? Math.max(0, Math.floor((now - result.timestamp) / 1000)) : 0;
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

            {/* Voice Assistant Toggle Button */}
            <button
              onClick={handleToggleVoice}
              className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors shadow-sm ${
                isVoiceOn
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={isVoiceOn ? 'ভয়েস সহকারী চালু আছে (ক্লিক করে বন্ধ করুন)' : 'ভয়েস সহকারী বন্ধ আছে (ক্লিক করে চালু করুন)'}
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
              title="অন্য যেকোনো ট্রেডিং অ্যাপের (Binomo, Quotex, MT4) ওপর ভাসমান উইন্ডো দেখানো বা লুকানো"
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
                  : serverStatus.tested && !serverStatus.ok
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/40'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="ব্যাকএন্ড সার্ভার কানেকশন ও API সেটিংস"
            >
              {serverStatus.tested && serverStatus.ok ? (
                <Wifi className="w-4 h-4 text-emerald-400" />
              ) : serverStatus.tested && !serverStatus.ok ? (
                <WifiOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Server className="w-4 h-4 text-cyan-400" />
              )}
              <span>
                {serverStatus.tested && serverStatus.ok
                  ? `সার্ভার সক্রিয় (${serverStatus.latencyMs}ms)`
                  : serverStatus.tested && !serverStatus.ok
                  ? 'সার্ভার অফলাইন'
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
                  : errorMessage.includes('MediaProjection')
                  ? '⚠️ স্ক্রিন ক্যাপচার পারমিশন এরর'
                  : `Notice: ${errorMessage}`}
              </div>
              <div className="mt-1 text-slate-300 text-[11px] leading-relaxed">
                {errorMessage.includes('Failed to fetch') && (
                  <span>
                    মোবাইল ইন্টারনেট বা ক্লাউড সার্ভারের সংযোগ পাওয়া যাচ্ছে না। নিচের <b>সার্ভার কনফিগারেশন</b> বাটনে ক্লিক করে সঠিক Backend URL দিন অথবা ইন্টারনেট সংযোগ চেক করুন।
                  </span>
                )}
                {errorMessage.includes('MediaProjection') && (
                  <span>
                    অ্যান্ড্রয়েড 14/15-এর Foreground Service পারমিশন সংশোধন করা হয়েছে। নতুন বিল্ডের APK ডাউনলোড করে আপডেট করুন।
                  </span>
                )}
                {errorMessage.includes('getDisplayMedia') && (
                  <span>
                    মোবাইল ব্রাউজারে স্ক্রিন শেয়ারের জন্য TradePulse Android APK ব্যবহার করুন অথবা ব্রাউজারের পারমিশন চালু করুন।
                  </span>
                )}
              </div>
            </div>
          </div>
          {errorMessage.includes('Failed to fetch') && (
            <button
              onClick={() => {
                setShowServerModal(true);
                runHealthCheck();
              }}
              className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800/80 border border-red-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap self-start sm:self-center"
            >
              ⚙️ সার্ভার কনফিগার করুন
            </button>
          )}
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
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>কাউন্টডাউন: <strong className="text-cyan-300 font-mono">{isChartFound ? formattedCountdown : '--:--'}</strong></span>
              </div>
            </div>

            {/* Big Direction Badge */}
            <div
              className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 ${
                !isChartFound
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                  : result.direction === 'UP'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : result.direction === 'DOWN'
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
              }`}
            >
              <div className="text-2xl font-black tracking-tight font-mono">
                {!isChartFound ? (
                  <span className="text-amber-300">⚠️ চার্ট স্ক্যান হচ্ছে...</span>
                ) : (
                  <>
                    {result.direction === 'UP' && '▲ CALL / UP ট্রেড'}
                    {result.direction === 'DOWN' && '▼ PUT / DOWN ট্রেড'}
                    {result.direction === 'WAIT' && '⏸ WAIT / অপেক্ষা'}
                  </>
                )}
              </div>
              <div className="text-xs font-medium opacity-90">
                {!isChartFound ? 'ট্রেডিং চার্ট সামনে রাখুন। শনাক্ত হলে সিগন্যাল শুরু হবে।' : result.verdictTitle}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/60">
                  কনফিডেন্স: {result.confidence}%
                </span>
                {isChartFound && (
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-600/50 text-cyan-300">
                    ⏱️ এক্সপায়ারি: {formattedCountdown}
                  </span>
                )}
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

      {/* Server Settings Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Backend Server Settings</h3>
                  <p className="text-[11px] text-slate-400">AI Vision & Trading Engine Connectivity</p>
                </div>
              </div>
              <button
                onClick={() => setShowServerModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Connection Status Card */}
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              serverStatus.tested && serverStatus.ok
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : serverStatus.tested && !serverStatus.ok
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
            }`}>
              {serverStatus.tested && serverStatus.ok ? (
                <Wifi className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : serverStatus.tested && !serverStatus.ok ? (
                <WifiOff className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="flex-1 text-xs space-y-1">
                <div className="font-semibold flex items-center justify-between">
                  <span>{serverStatus.tested ? (serverStatus.ok ? 'সার্ভার সক্রিয় ও সংযুক্ত' : 'সার্ভার অফলাইন / সংযোগ ব্যর্থ') : 'যাচাই করা হচ্ছে...'}</span>
                  {serverStatus.tested && serverStatus.ok && (
                    <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                      {serverStatus.latencyMs} ms
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  {serverStatus.tested && serverStatus.ok
                    ? 'AI Vision API এবং ট্রেডিং এনালাইজার সঠিকভাবে রেসপন্স করছে।'
                    : serverStatus.error
                    ? `কারণ: ${serverStatus.error}`
                    : 'সার্ভার স্টেটাস রিফ্রেশ করুন।'}
                </div>
              </div>
            </div>

            {/* Custom Backend URL Input */}
            <div className="space-y-2">
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
                <span>ডিফল্ট: Cloud Run Hosted Proxy</span>
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

            {/* Action Buttons */}
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
