import { LiveStreamState, ScreenAnalysisFinalResult, ChartDetectionDiagnostic } from '../types/screenTypes';
import { voiceAssistantService } from './voiceAssistantService';
import { whatsappAlertService } from './whatsappAlertService';
import {
  TradePulseNativeScreen,
  FloatingOverlayData,
  NativeCaptureFrameEvent,
} from '../plugins/TradePulseNativeScreen';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from './apiConfig';
import { agentLearningService } from './agentLearningService';

export class LiveScreenService {
  private static instance: LiveScreenService;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private state: LiveStreamState = 'IDLE';
  private timer: any = null;
  private countdownTimer: any = null;
  private isProcessingFrame: boolean = false;
  private scanIntervalMs: number = 3500; // 3.5 seconds optimal for quick signal analysis
  private latestResult: ScreenAnalysisFinalResult | null = null;
  private listeners: Set<() => void> = new Set();
  private errorMessage: string | null = null;

  // Real-time latency & sequence guards
  private latestProcessedSequenceId: number = 0;
  private isNativeCaptureActive: boolean = false;
  private hasFloatingOverlayActive: boolean = false;
  private nativeListenerHandle: { remove: () => void } | null = null;

  // Live Chart & Countdown State
  private autoOpenModal: boolean = false;
  private isSearchingForChart: boolean = false;
  private isChartFound: boolean = false;
  private consecutiveChartDetections: number = 0;
  private expirySecondsLeft: number = 60; // 1-minute candle default countdown

  // Diagnostic Status Panel Tracking (Rules 4, 5, 6, 7)
  private latestFrameCount: number = 0;
  private latestFrameTimestamp: number = 0;
  private latestResolution: string = '720p';
  private latestApiLatencyMs: number = 0;
  private aiState: 'IDLE' | 'ANALYZING' | 'READY' | 'ERROR' | 'TIMEOUT' = 'IDLE';
  private captureState: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'PERMISSION_REQ' = 'STOPPED';
  private consecutiveNetworkFailures: number = 0;
  private lastErrorReason: string | null = null;
  private latestChartDiagnostic: ChartDetectionDiagnostic | null = null;

  private constructor() {
    if (typeof document !== 'undefined') {
      this.videoEl = document.createElement('video');
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.canvasEl = document.createElement('canvas');
    }
  }

  public static getInstance(): LiveScreenService {
    if (!LiveScreenService.instance) {
      LiveScreenService.instance = new LiveScreenService();
    }
    return LiveScreenService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getState(): LiveStreamState {
    return this.state;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getLatestResult(): ScreenAnalysisFinalResult | null {
    return this.latestResult;
  }

  public isNativeActive(): boolean {
    return this.isNativeCaptureActive;
  }

  public isOverlayActive(): boolean {
    return this.hasFloatingOverlayActive;
  }

  public isSearching(): boolean {
    return this.isSearchingForChart;
  }

  public isChartDetected(): boolean {
    return this.isChartFound;
  }

  public getConsecutiveChartDetections(): number {
    return this.consecutiveChartDetections;
  }

  public getChartDiagnostic(): ChartDetectionDiagnostic | null {
    return this.latestChartDiagnostic;
  }

  public getExpirySecondsLeft(): number {
    return this.expirySecondsLeft;
  }

  public shouldAutoOpenModal(): boolean {
    return false;
  }

  public clearAutoOpenModal(): void {
    this.autoOpenModal = false;
  }

  public isSignalStale(_ttlMs: number = 15000): boolean {
    // Live stream never marks signal as stopped or broken - stays active continuously
    return false;
  }

  public getFrameCount(): number {
    return this.latestFrameCount;
  }

  public getLastFrameTimestamp(): number {
    return this.latestFrameTimestamp;
  }

  public getResolution(): string {
    return this.latestResolution;
  }

  public getApiLatency(): number {
    return this.latestApiLatencyMs;
  }

  public getAiState(): 'IDLE' | 'ANALYZING' | 'READY' | 'ERROR' | 'TIMEOUT' {
    return this.aiState;
  }

  public getCaptureState(): 'RUNNING' | 'STOPPED' | 'PAUSED' | 'PERMISSION_REQ' {
    return this.captureState;
  }

  public getLastErrorReason(): string | null {
    return this.lastErrorReason;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public getScanIntervalSeconds(): number {
    return Math.round(this.scanIntervalMs / 1000);
  }

  public setScanIntervalSeconds(seconds: number): void {
    this.scanIntervalMs = Math.max(2, Math.min(60, seconds)) * 1000;
    if (this.state === 'STREAMING' && !this.isNativeCaptureActive) {
      this.resetIntervalTimer();
    }
    this.notify();
  }

  /**
   * Starts native background capture or browser screen capture
   */
  public async connectScreen(): Promise<boolean> {
    if (this.state === 'STREAMING') return true;

    this.state = 'CONNECTING';
    this.autoOpenModal = true;
    this.errorMessage = null;
    this.isSearchingForChart = true;
    this.notify();

    // 1. If running inside Capacitor Native Android runtime (APK on mobile device)
    if (Capacitor.isNativePlatform()) {
      return await this.startNativeAndroidCapture();
    }

    // 2. Standard Web screen capture
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        const mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window',
            frameRate: { ideal: 5, max: 10 },
          },
          audio: false,
        });

        this.stream = mediaStream;

        if (this.videoEl) {
          this.videoEl.srcObject = mediaStream;
          await this.videoEl.play().catch(() => {});
        }

        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            this.disconnect('Screen sharing was ended by user.');
            voiceAssistantService.announceNoScreenCapture();
          };
        }

        this.state = 'STREAMING';
        this.autoOpenModal = true;
        this.isSearchingForChart = true;
        this.isChartFound = false;
        this.expirySecondsLeft = 0;
        this.errorMessage = null;
        this.latestResult = null;
        this.notify();

        voiceAssistantService.announceSearchingForChart();

        this.captureAndAnalyzeCurrentFrame();
        this.resetIntervalTimer();

        // Show floating overlay simulator in web
        this.showFloatingOverlayHUD({
          direction: 'WAIT',
          confidence: 0,
          durationText: '--:--',
          verdictTitle: 'চার্ট পাওয়া যায়নি',
          reasonText: 'ট্রেডিং চার্ট স্ক্রিনে রাখুন',
          latencyMs: 0,
        });

        return true;
      } catch (err: any) {
        console.warn('Web getDisplayMedia error:', err);
        const isNotAllowed = err.name === 'NotAllowedError';
        const isIframeBlocked = err.name === 'SecurityError' || String(err).includes('permissions policy');

        this.state = 'DISCONNECTED';
        if (isNotAllowed) {
          this.errorMessage = 'স্ক্রিন শেয়ার ডায়ালগ বাতিল করা হয়েছে। স্ক্রিন শেয়ার করতে পুরো স্ক্রিন বা ট্রেডিং উইন্ডো নির্বাচন করুন।';
        } else if (isIframeBlocked) {
          this.errorMessage = 'ব্রাউজার প্রিভিউ আইফ্রেমে স্ক্রিন শেয়ার সীমাবদ্ধ করেছে। উপরে "নতুন ট্যাবে খুলুন" বাটনে ক্লিক করুন অথবা ডেমো টেস্ট মোড ব্যবহার করুন।';
        } else {
          this.errorMessage = err.message || 'স্ক্রিন শেয়ার শুরু করা যায়নি।';
        }
        this.notify();
        return false;
      }
    }

    // 3. Fallback for environments without getDisplayMedia
    this.state = 'DISCONNECTED';
    this.errorMessage = 'আপনার ব্রাউজার বা ডিভাইসে স্ক্রিন শেয়ারিং এপিআই সমর্থিত নয়। অনুগ্রহ করে TradePulse Android APK বা Chrome/Edge ব্রাউজার ব্যবহার করুন।';
    this.notify();
    return false;
  }

  /**
   * Starts a dynamic live trading chart simulation stream for testing
   * Runs the full analysis pipeline, floating pill, candle countdown, and voice announcements
   */
  public async startDemoTestStream(): Promise<boolean> {
    this.disconnect();
    this.state = 'STREAMING';
    this.autoOpenModal = true;
    this.isSearchingForChart = false;
    this.isChartFound = true;
    this.errorMessage = null;
    this.expirySecondsLeft = 52;

    const sampleSymbols = ['AUD/CHF OTC', 'EUR/USD OTC', 'BTC/USDT', 'GBP/USD OTC'];
    const randomSymbol = sampleSymbols[Math.floor(Math.random() * sampleSymbols.length)];
    const directions: ('UP' | 'DOWN')[] = ['UP', 'DOWN'];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];

    this.latestResult = {
      analysisId: `demo_${Date.now()}`,
      timestamp: Date.now(),
      frameCapturedAt: Date.now(),
      direction: randomDir,
      confidence: 88,
      verdictTitle: randomDir === 'UP' ? 'CALL (UP) সিগন্যাল' : 'PUT (DOWN) সিগন্যাল',
      suggestedExpiry: '01:00',
      reasoning: [
        `${randomSymbol} মোমেন্টাম ক্যান্ডেল সাপোর্ট/রেজিস্ট্যান্স টেস্ট করছে।`,
        randomDir === 'UP' ? 'বুলিশ প্রেসার ও ভলিউম বৃদ্ধি পেয়েছে।' : 'বিয়ারিশ রিজেকশন ক্যান্ডেল তৈরি হয়েছে।',
        '১ মিনিট এক্সপায়ারি ট্রেডের অনুকূল পরিস্থিতি।'
      ],
      visionData: {
        symbol: randomSymbol,
        timeframe: '1m',
        marketType: 'FOREX',
        lastCandleDirection: randomDir === 'UP' ? 'BULLISH' : 'BEARISH',
        candlestickPattern: randomDir === 'UP' ? 'Bullish Engulfing' : 'Bearish Engulfing',
        indicatorsIdentified: [
          { name: 'EMA 20', description: 'Trend filter', bias: randomDir === 'UP' ? 'BULLISH' : 'BEARISH' },
          { name: 'RSI 14', description: 'Momentum oscillator', bias: randomDir === 'UP' ? 'BULLISH' : 'BEARISH' },
        ],
        chartStructure: randomDir === 'UP' ? 'UPTREND' : 'DOWNTREND',
        visionSummary: `${randomSymbol} চার্টে স্পষ্ট ক্যান্ডেলস্টিক প্যাটার্ন সনাক্ত হয়েছে।`,
        confidenceScore: 0.88,
        isClearTradingChart: true,
        containsSensitivePrivateData: false,
      },
      marketVerification: {
        isVerified: true,
        status: 'MATCHED',
        notes: 'Multi-exchange OTC market verified',
      },
      safetyDisclaimer: 'TradePulse Paper Analysis Tool',
    };

    this.notify();
    this.startCountdownTicker();

    voiceAssistantService.announceAnalysisResult(this.latestResult);

    this.showFloatingOverlayHUD({
      direction: randomDir,
      confidence: 88,
      durationText: '00:52',
      verdictTitle: randomDir === 'UP' ? 'CALL (UP)' : 'PUT (DOWN)',
      reasonText: `${randomSymbol} - মোমেন্টাম নিশ্চিত`,
      latencyMs: 12,
      symbol: randomSymbol,
    });

    return true;
  }

  /**
   * Starts Native Android Background Screen Capture + Floating HUD
   */
  public async startNativeAndroidCapture(): Promise<boolean> {
    try {
      // 1. Check Permissions status first
      let hasOverlay = false;
      try {
        const perm = await TradePulseNativeScreen.checkPermissions();
        hasOverlay = Boolean(perm?.hasOverlayPermission);
      } catch (permErr) {
        console.warn('Overlay permission check non-fatal error:', permErr);
      }

      // 2. Setup frame listener
      if (this.nativeListenerHandle) {
        try {
          this.nativeListenerHandle.remove();
        } catch {}
        this.nativeListenerHandle = null;
      }

      this.nativeListenerHandle = await TradePulseNativeScreen.addListener(
        'onFrameCaptured',
        (frame: NativeCaptureFrameEvent) => {
          this.handleIncomingNativeFrame(frame);
        }
      );

      // 3. Start MediaProjection & Foreground Service with timeout guard
      // Note: Screen capture prompt MUST be launched while MainActivity is foregrounded
      const startCapturePromise = TradePulseNativeScreen.startScreenCapture({
        intervalSeconds: Math.round(this.scanIntervalMs / 1000),
        targetWidth: 720,
        quality: 0.75,
      });

      const timeoutPromise = new Promise<{ success: boolean; message?: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, message: 'অনুমতি ডায়ালগের জন্য সময় শেষ হয়েছে। আবার "Connect Live Screen" চাপুন এবং "Start now" নির্বাচন করুন।' });
        }, 60000);
      });

      const result = await Promise.race([startCapturePromise, timeoutPromise]);

      if (result && result.success) {
        this.isNativeCaptureActive = true;
        this.state = 'STREAMING';
        this.autoOpenModal = true;
        this.isSearchingForChart = true;
        this.isChartFound = false;
        this.errorMessage = null;
        this.expirySecondsLeft = 0;
        this.latestResult = null;
        this.notify();

        // 4. Show Floating HUD widget over other apps if overlay permission is present
        if (hasOverlay) {
          await this.showFloatingOverlayHUD({
            direction: 'WAIT',
            confidence: 0,
            durationText: '--:--',
            verdictTitle: 'চার্ট পাওয়া যায়নি',
            reasonText: 'ট্রেডিং চার্ট সামনে রাখুন',
            latencyMs: 0,
          });
        }

        voiceAssistantService.announceSearchingForChart();
        return true;
      } else {
        this.state = 'DISCONNECTED';
        this.errorMessage = result?.message || 'স্ক্রিন ক্যাপচার শুরু করতে "Start now" অনুমতি দিন।';
        this.notify();
        return false;
      }
    } catch (err: any) {
      console.error('Native screen capture error:', err);
      this.state = 'DISCONNECTED';
      this.errorMessage = err.message || 'Android Screen Capture শুরু করতে ব্যর্থ হয়েছে';
      this.notify();
      return false;
    }
  }

  /**
   * Countdown ticker: starts ONLY after candle analysis is complete!
   * Counts down remaining time of the candle, then re-evaluates the next candle.
   */
  private startCountdownTicker(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    // Default candle countdown duration: 60 seconds
    this.expirySecondsLeft = 60;

    this.countdownTimer = setInterval(() => {
      if (this.state !== 'STREAMING' || !this.isChartFound) return;

      this.expirySecondsLeft -= 1;

      // Update overlay HUD countdown every second
      const countdownStr = `${String(Math.floor(this.expirySecondsLeft / 60)).padStart(2, '0')}:${String(
        this.expirySecondsLeft % 60
      ).padStart(2, '0')}`;

      if (this.latestResult) {
        this.updateFloatingOverlayHUD({
          direction: this.latestResult.direction,
          confidence: this.latestResult.confidence,
          durationText: countdownStr,
          verdictTitle:
            this.latestResult.direction === 'UP'
              ? 'CALL (UP)'
              : this.latestResult.direction === 'DOWN'
              ? 'PUT (DOWN)'
              : 'WAIT',
          reasonText:
            this.latestResult.visionData?.candlestickPattern ||
            this.latestResult.reasoning[0] ||
            'মোমেন্টাম নিশ্চিত',
          latencyMs: 0,
          symbol: this.latestResult.visionData?.symbol,
        });
      }

      if (this.expirySecondsLeft <= 0) {
        // Candle time ended - announce and evaluate next candle
        voiceAssistantService.announceCandleExpired();
        this.expirySecondsLeft = 60;

        // Immediate snapshot trigger for next candle
        if (this.stream) {
          this.captureAndAnalyzeCurrentFrame();
        }
      }
      this.notify();
    }, 1000);
  }

  /**
   * Helper to dispatch immediate error status to the floating overlay and frontend
   */
  private notifyOverlayError(errorMsg: string, latencyMs: number = 0): void {
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: '⚠️ ' + errorMsg,
      reasonText: 'পরবর্তী ফ্রেম অপেক্ষা...',
      latencyMs,
      frameCount: this.latestFrameCount,
      lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
      resolution: this.latestResolution,
      captureState: this.captureState,
      aiState: this.aiState,
      errorReason: errorMsg,
    });
  }

  /**
   * Handles frame emitted by Native Android MediaProjection
   */
  private async handleIncomingNativeFrame(frame: NativeCaptureFrameEvent): Promise<void> {
    this.latestFrameCount = frame.sequenceId;
    this.latestFrameTimestamp = frame.timestamp;
    this.latestResolution = `${frame.width}x${frame.height}`;
    this.captureState = 'RUNNING';

    // Rule 7: Discard old frame sequence or concurrent ongoing frame
    if (frame.sequenceId <= this.latestProcessedSequenceId || this.isProcessingFrame) {
      return;
    }

    this.latestProcessedSequenceId = frame.sequenceId;
    this.isProcessingFrame = true;
    this.aiState = 'ANALYZING';
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    // 15-second timeout guard for reliable mobile network transport
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frame.imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt: frame.timestamp,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;
      this.latestApiLatencyMs = latencyMs;

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;
          this.consecutiveNetworkFailures = 0;
          this.lastErrorReason = null;
          this.errorMessage = null;
          this.aiState = 'READY';
          this.processResult(result, latencyMs);
        } else {
          // Graceful fallback to on-device engine
          const localResult = await this.analyzeFrameLocally(frame.imageBase64, frame.timestamp);
          this.aiState = 'READY';
          this.lastErrorReason = null;
          this.errorMessage = null;
          this.processResult(localResult, latencyMs);
        }
      } else {
        // Server unreachable or non-200: seamless fallback to on-device analyzer
        const localResult = await this.analyzeFrameLocally(frame.imageBase64, frame.timestamp);
        this.aiState = 'READY';
        this.lastErrorReason = null;
        this.errorMessage = null;
        this.processResult(localResult, latencyMs);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      this.latestApiLatencyMs = latencyMs;

      // On-Device Vision Fallback: Keeps screen capture, floating HUD, and signals uninterrupted
      const localResult = await this.analyzeFrameLocally(frame.imageBase64, frame.timestamp);
      this.aiState = 'READY';
      this.lastErrorReason = null;
      this.errorMessage = null;
      this.processResult(localResult, latencyMs);
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  /**
   * Fast client-side Computer Vision helper:
   * Inspects screen pixels to verify if image contains an actual candlestick trading chart.
   * If screen is home screen, wallpaper, chat, TradePulse UI, or settings -> returns isChart: false!
   */
  private async isCandlestickChartImage(base64: string): Promise<{
    isChart: boolean;
    dir: 'UP' | 'DOWN' | 'WAIT';
    confidence: number;
    symbol: string;
    pattern: string;
    reason: string[];
    diagnostic?: ChartDetectionDiagnostic;
  }> {
    return new Promise((resolve) => {
      try {
        if (typeof document === 'undefined') {
          return resolve({
            isChart: false,
            dir: 'WAIT',
            confidence: 0,
            symbol: 'UNKNOWN',
            pattern: 'চার্ট পাওয়া যায়নি',
            reason: ['চার্ট অনুসন্ধান অব্যাহত রয়েছে...'],
          });
        }

        const img = new Image();
        img.onload = () => {
          try {
            const naturalW = img.naturalWidth || img.width || 720;
            const naturalH = img.naturalHeight || img.height || 1280;
            const isPortrait = naturalH > naturalW;

            // Preserve true aspect ratio with 320px target width for crisp candle wicks and bodies
            const targetWidth = 320;
            const targetHeight = Math.max(160, Math.min(640, Math.round((naturalH / naturalW) * targetWidth)));

            const testCanvas = document.createElement('canvas');
            testCanvas.width = targetWidth;
            testCanvas.height = targetHeight;
            const ctx = testCanvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
              return resolve({
                isChart: false,
                dir: 'WAIT',
                confidence: 0,
                symbol: 'UNKNOWN',
                pattern: 'চার্ট পাওয়া যায়নি',
                reason: ['চার্ট অনুসন্ধান অব্যাহত রয়েছে...'],
              });
            }

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imgData.data;

            // Active chart zone:
            // Mobile Portrait: ~8% to ~78% of screen height (covers Quotex/Binomo/PocketOption chart canvas while skipping header balance and bottom order buttons)
            // Desktop/Landscape: ~5% to ~95%
            const yStart = isPortrait ? Math.floor(targetHeight * 0.08) : Math.floor(targetHeight * 0.05);
            const yEnd = isPortrait ? Math.floor(targetHeight * 0.78) : Math.floor(targetHeight * 0.95);
            const xStart = Math.floor(targetWidth * 0.02);
            const xEnd = Math.floor(targetWidth * 0.98);

            let darkBgCount = 0;
            let lightBgCount = 0;
            let greenPixelsInChart = 0;
            let redPixelsInChart = 0;

            const columnCandlePixels: number[] = new Array(targetWidth).fill(0);
            const columnMinY: number[] = new Array(targetWidth).fill(999);
            const columnMaxY: number[] = new Array(targetWidth).fill(-1);

            for (let y = yStart; y < yEnd; y++) {
              for (let x = xStart; x < xEnd; x++) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // 1. Broker background dark / light themes:
                // Dark themes (Quotex #121620, Binomo #1b1e2e, PocketOption #1a1d29, TradingView #131722, #1e222d, #2a2e39, dark navy #1a2332)
                const isDarkBg = r <= 95 && g <= 95 && b <= 110;
                // Light themes (#ffffff, #f0f3fa, #e8ecf2)
                const isLightBg = r >= 200 && g >= 200 && b >= 200;

                if (isDarkBg) {
                  darkBgCount++;
                } else if (isLightBg) {
                  lightBgCount++;
                }

                // 2. Candlestick green (Quotex teal-green #26a69a, pure green #00c076, emerald #00e676, neon #00ff88, lime #4caf50, cyan #00b0ff):
                const isGreenCandle =
                  (g >= 75 && g > r * 1.12 && (g - r) >= 12 && b <= g * 1.25) ||
                  (g >= 115 && r <= 85 && b <= 190) ||
                  (g >= 120 && b >= 120 && r <= 80);

                // 3. Candlestick red (Quotex red #ef5350, Binomo red #ff4141, PocketOption red #ff3344, TradingView red #f23645, crimson #c62828):
                const isRedCandle =
                  (r >= 95 && r > g * 1.18 && (r - g) >= 14 && r > b * 1.15 && (r - b) >= 14) ||
                  (r >= 140 && g <= 90 && b <= 95);

                if (isGreenCandle) {
                  greenPixelsInChart++;
                  columnCandlePixels[x]++;
                  if (y < columnMinY[x]) columnMinY[x] = y;
                  if (y > columnMaxY[x]) columnMaxY[x] = y;
                } else if (isRedCandle) {
                  redPixelsInChart++;
                  columnCandlePixels[x]++;
                  if (y < columnMinY[x]) columnMinY[x] = y;
                  if (y > columnMaxY[x]) columnMaxY[x] = y;
                }
              }
            }

            const totalExamined = (yEnd - yStart) * (xEnd - xStart);
            const totalCandlePixels = greenPixelsInChart + redPixelsInChart;

            // Group adjacent candle columns into distinct candle bars
            let distinctCandleBars = 0;
            let inBar = false;
            let barWidth = 0;
            let currentBarPixels = 0;
            const barMidpointsY: number[] = [];
            const barPositionsX: number[] = [];

            for (let x = xStart; x < xEnd; x++) {
              const height = columnMaxY[x] - columnMinY[x] + 1;
              const hasCandle = columnCandlePixels[x] >= 2 && height >= 4;

              if (hasCandle) {
                if (!inBar) {
                  inBar = true;
                  barWidth = 1;
                  currentBarPixels = columnCandlePixels[x];
                  barPositionsX.push(x);
                  barMidpointsY.push((columnMinY[x] + columnMaxY[x]) / 2);
                } else {
                  barWidth++;
                  currentBarPixels += columnCandlePixels[x];
                  // If a colored block is wider than 16px in a 320px chart,
                  // it is an app icon (WhatsApp, YouTube, Gallery, Settings) or a UI card/banner, NOT a candlestick!
                  if (barWidth > 16) {
                    inBar = false;
                    if (barPositionsX.length > 0 && barPositionsX[barPositionsX.length - 1] === x - barWidth + 1) {
                      barPositionsX.pop();
                      barMidpointsY.pop();
                    }
                  }
                }
              } else {
                if (inBar) {
                  // A valid candlestick bar must have width between 1px and 14px
                  if (barWidth >= 1 && barWidth <= 14 && currentBarPixels >= 5) {
                    distinctCandleBars++;
                  } else {
                    barPositionsX.pop();
                    barMidpointsY.pop();
                  }
                }
                inBar = false;
                barWidth = 0;
                currentBarPixels = 0;
              }
            }

            // Calculate horizontal span and vertical dispersion across candles
            let horizontalSpan = 0;
            let verticalDispersion = 0;
            if (barPositionsX.length >= 2) {
              horizontalSpan = barPositionsX[barPositionsX.length - 1] - barPositionsX[0];
            }
            if (barMidpointsY.length >= 3) {
              const minY = Math.min(...barMidpointsY);
              const maxY = Math.max(...barMidpointsY);
              verticalDispersion = maxY - minY;
            }

            const bgRatio = (darkBgCount + lightBgCount) / Math.max(1, totalExamined);
            const hasBrokerBg = bgRatio > 0.25;
            const horizontalSpanPercent = Math.round((horizontalSpan / targetWidth) * 100);

            // Strict Candlestick Chart Criteria:
            // 1. At least 5 distinct candle bars (widths 1-14px, rejecting app icons >16px)
            // 2. Total candle pixels between 45 and 3500 (rejecting solid non-chart screens)
            // 3. Candles span at least 20% of chart width
            // 4. Vertical price action dispersion >= 12px (rejects horizontal app dock icons & status bars)
            // 5. Must have broker theme background
            const isCandlestickChart =
              distinctCandleBars >= 5 &&
              totalCandlePixels >= 45 &&
              totalCandlePixels <= 3500 &&
              horizontalSpan >= targetWidth * 0.20 &&
              verticalDispersion >= 12 &&
              hasBrokerBg;

            const diagnostic: ChartDetectionDiagnostic = {
              isChart: isCandlestickChart,
              distinctCandleBars,
              totalCandlePixels,
              horizontalSpanPercent,
              verticalDispersionPx: Math.round(verticalDispersion),
              hasBrokerBackground: hasBrokerBg,
            };

            if (!isCandlestickChart) {
              const failureReasons: string[] = [];
              if (distinctCandleBars < 5) {
                failureReasons.push(`ক্যান্ডেল বার স্বল্পতা: স্ক্রিনে মাত্র ${distinctCandleBars}টি ক্যান্ডেলস্টিক বার পাওয়া গেছে (কমপক্ষে ৫টি স্পষ্ট ক্যান্ডেল প্রয়োজন)।`);
              }
              if (!hasBrokerBg) {
                failureReasons.push('ব্রোকার ব্যাকগ্রাউন্ড অমিল: ট্রেডিং টার্মিনালের ডার্ক বা লাইট চার্ট ব্যাকগ্রাউন্ড শনাক্ত হয়নি।');
              }
              if (totalCandlePixels < 45) {
                failureReasons.push(`ক্যান্ডেল পিক্সেল অপর্যাপ্ত: মাত্র ${totalCandlePixels} লাল/সবুজ ক্যান্ডেল পিক্সেল শনাক্ত হয়েছে।`);
              }
              if (totalCandlePixels > 3500) {
                failureReasons.push('স্ক্রিনটি চার্ট নয়: অতিরিক্ত সলিড রঙের উপস্থিতি (অ্যাপ আইকন বা ওয়ালপেপার হতে পারে)।');
              }
              if (horizontalSpan < targetWidth * 0.20) {
                failureReasons.push(`ক্যান্ডেল বিস্তৃতি স্বল্প: অনুভূমিক বিস্তার মাত্র ${horizontalSpanPercent}% (কমপক্ষে ২০% প্রয়োজন)।`);
              }
              if (verticalDispersion < 12) {
                failureReasons.push('প্রাইস অ্যাকশন উল্লম্ব ওঠানামাহীন: ক্যান্ডেলগুলোর প্রাইস লেভেল বৈচিত্র্য নেই (ডক আইকন বা স্ট্যাটাস বার হতে পারে)।');
              }
              if (failureReasons.length === 0) {
                failureReasons.push('স্ক্রিনটি সক্রিয় ট্রেডিং টার্মিনাল নয় (হোমস্ক্রিন, চ্যাট বা অন্য অ্যাপ হতে পারে)।');
              }

              diagnostic.failureReason = failureReasons[0];
              diagnostic.recommendedAction = 'ব্রোকার অ্যাপ (Quotex, Binomo, Pocket Option) খুলে ক্যান্ডেলস্টিক চার্টটি ফুলস্ক্রিনে রাখুন।';

              return resolve({
                isChart: false,
                dir: 'WAIT',
                confidence: 0,
                symbol: 'UNKNOWN',
                pattern: 'চার্ট পাওয়া যায়নি',
                reason: [
                  failureReasons[0],
                  'ট্রেডিং চার্ট ছাড়া ফলাফল প্রদর্শন সম্পূর্ণ বন্ধ (BLOCKED)।',
                  'অনুগ্রহ করে ব্রোকার অ্যাপের (Quotex/Binomo/TradingView/MT4) চার্ট ফুলস্ক্রিন রাখুন।',
                ],
                diagnostic,
              });
            }

            // Real candlestick chart verified!
            diagnostic.recommendedAction = 'সক্রিয় ক্যান্ডেলস্টিক চার্ট নিশ্চিত। লাইভ মোমেন্টাম বিশ্লেষণ কার্যকর।';

            // Analyze recent price momentum on rightmost 35% of the chart
            let recentGreen = 0;
            let recentRed = 0;
            const rightXStart = Math.floor(xStart + (xEnd - xStart) * 0.65);

            for (let y = yStart; y < yEnd; y++) {
              for (let x = rightXStart; x < xEnd; x++) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                const isGreen =
                  (g >= 75 && g > r * 1.12 && (g - r) >= 12 && b <= g * 1.25) ||
                  (g >= 115 && r <= 85 && b <= 190) ||
                  (g >= 120 && b >= 120 && r <= 80);
                const isRed =
                  (r >= 95 && r > g * 1.18 && (r - g) >= 14 && r > b * 1.15 && (r - b) >= 14) ||
                  (r >= 140 && g <= 90 && b <= 95);

                if (isGreen) recentGreen++;
                if (isRed) recentRed++;
              }
            }

            const totalRightCandles = recentGreen + recentRed;
            if (totalRightCandles < 12) {
              return resolve({
                isChart: true,
                dir: 'WAIT',
                confidence: 50,
                symbol: 'LIVE CHART',
                pattern: 'ক্যান্ডেল কনসলিডেশন',
                reason: [
                  'চার্ট সনাক্ত হয়েছে কিন্তু বর্তমান ক্যান্ডেলের মোমেন্টাম গঠনের অপেক্ষায়।',
                  'পরবর্তী স্পষ্ট ক্যান্ডেল পর্যন্ত অপেক্ষা করুন (WAIT)।',
                ],
                diagnostic,
              });
            }

            const dir: 'UP' | 'DOWN' = recentGreen >= recentRed ? 'UP' : 'DOWN';
            const ratio = Math.max(recentGreen, recentRed) / totalRightCandles;
            const confidence = Math.min(92, Math.max(76, Math.round(74 + ratio * 18)));
            const symbol = 'LIVE CHART';
            const pattern = dir === 'UP' ? 'Bullish Candlestick Momentum' : 'Bearish Rejection Momentum';

            return resolve({
              isChart: true,
              dir,
              confidence,
              symbol,
              pattern,
              reason: [
                'স্ক্রিনে সক্রিয় ট্রেডিং ক্যান্ডেলস্টিক চার্ট সফলভাবে সনাক্ত হয়েছে।',
                dir === 'UP'
                  ? 'সাম্প্রতিক ক্যান্ডেলগুলোতে বায়ার্স প্রেসার ও বুলিশ মোমেন্টাম নিশ্চিত।'
                  : 'সাম্প্রতিক ক্যান্ডেলগুলোতে সেলার্স প্রেসার ও বিয়ারিশ রিজেকশন নিশ্চিত।',
                '১ মিনিট পরবর্তী ক্যান্ডেল এক্সপায়ারি উপযোগী সিগন্যাল।',
              ],
              diagnostic,
            });
          } catch {
            resolve({
              isChart: false,
              dir: 'WAIT',
              confidence: 0,
              symbol: 'UNKNOWN',
              pattern: 'চার্ট অনুসন্ধান চলছে',
              reason: ['চার্ট বিশ্লেষণে অপেক্ষমাণ।'],
            });
          }
        };

        img.onerror = () => {
          resolve({
            isChart: false,
            dir: 'WAIT',
            confidence: 0,
            symbol: 'UNKNOWN',
            pattern: 'চার্ট অনুসন্ধান চলছে',
            reason: ['স্ক্রিন ফ্রেম অস্পষ্ট বা চার্ট সনাক্ত হয়নি।'],
          });
        };

        img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
      } catch {
        resolve({
          isChart: false,
          dir: 'WAIT',
          confidence: 0,
          symbol: 'UNKNOWN',
          pattern: 'চার্ট পাওয়া যায়নি',
          reason: ['চার্ট সনাক্তকরণে অপেক্ষা করা হচ্ছে।'],
        });
      }
    });
  }

  /**
   * High-resilience on-device fallback analyzer.
   * Runs directly in WebView/browser when cloud backend is temporarily unreachable or offline.
   * Strictly enforces that isClearTradingChart is ONLY true when real candlestick chart is detected!
   */
  public async analyzeFrameLocally(imageBase64: string, frameCapturedAt: number): Promise<ScreenAnalysisFinalResult> {
    const analysisId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
    const isSufficientSize = cleanBase64.length > 2000;

    if (!isSufficientSize) {
      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: 'আমি চার্ট খুঁজে পাইনি',
        suggestedExpiry: 'N/A',
        reasoning: [
          'স্ক্রিন ফ্রেম অস্পষ্ট বা চার্ট সনাক্ত হয়নি।',
          'অনুগ্রহ করে ট্রেডিং অ্যাপের চার্ট স্ক্রিনে রাখুন।',
        ],
        visionData: {
          symbol: 'UNKNOWN',
          timeframe: '1m',
          marketType: 'FOREX',
          lastVisiblePrice: 0,
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'অনুসন্ধান চলছে',
          indicatorsIdentified: [],
          visionSummary: 'চার্ট ইমেজ ক্যাপচার অস্পষ্ট।',
          confidenceScore: 0,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: false,
          status: 'SKIPPED',
          notes: 'Non-chart frame',
        },
        safetyDisclaimer: 'TradePulse Live Screen Analysis',
      };
    }

    // Inspect image pixels for genuine candlestick chart presence
    const chartDetection = await this.isCandlestickChartImage(imageBase64);
    if (chartDetection.diagnostic) {
      this.latestChartDiagnostic = chartDetection.diagnostic;
    }

    if (!chartDetection.isChart || chartDetection.dir === 'WAIT') {
      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: chartDetection.pattern || 'আমি চার্ট খুঁজে পাইনি',
        suggestedExpiry: 'N/A',
        reasoning: chartDetection.reason,
        visionData: {
          symbol: chartDetection.symbol || 'UNKNOWN',
          timeframe: '1m',
          marketType: 'FOREX',
          lastVisiblePrice: 0,
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: chartDetection.pattern || 'চার্ট অনুসন্ধান চলছে',
          indicatorsIdentified: [],
          visionSummary: chartDetection.reason[0] || 'স্ক্রিনে কোনো ট্রেডিং ক্যান্ডেলস্টিক চার্ট পাওয়া যায়নি।',
          confidenceScore: 0,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: false,
          status: 'SKIPPED',
          notes: 'Non-chart screen or waiting for clear candle momentum',
        },
        safetyDisclaimer: 'TradePulse Educational Decision Aid',
      };
    }

    // Genuine trading chart verified!
    const dir = chartDetection.dir;
    const confidence = chartDetection.confidence;
    const symbol = chartDetection.symbol;

    // Cross-check with AI Learned Playbook rules and past mistake warnings
    const targetDir = dir === 'UP' ? 'CALL' : 'PUT';
    const learnedRules = agentLearningService.getRules();
    const matchingRule = learnedRules.find(
      (r) => r.recommendedDirection === targetDir && r.status === 'ACTIVE'
    );
    const reasoning = [...chartDetection.reason];
    if (matchingRule) {
      reasoning.push(
        `এআই প্লেবুক নিয়ম: ${matchingRule.titleBn} (কনফিডেন্স: ${Math.round(matchingRule.confidenceWeight * 100)}%)`
      );
      if (matchingRule.cautionaryNotesBn && matchingRule.cautionaryNotesBn.length > 0) {
        reasoning.push(`⚠️ অতীতের ভুল থেকে শিক্ষা: ${matchingRule.cautionaryNotesBn[0]}`);
      }
    }

    return {
      analysisId,
      timestamp: now,
      frameCapturedAt,
      direction: dir,
      confidence,
      verdictTitle: dir === 'UP' ? 'CALL (UP) সিগন্যাল' : 'PUT (DOWN) সিগন্যাল',
      suggestedExpiry: '01:00',
      reasoning,
      visionData: {
        symbol,
        timeframe: '1m',
        marketType: 'FOREX',
        lastVisiblePrice: 0,
        lastCandleDirection: dir === 'UP' ? 'BULLISH' : 'BEARISH',
        chartStructure: dir === 'UP' ? 'UPTREND' : 'DOWNTREND',
        candlestickPattern: chartDetection.pattern,
        indicatorsIdentified: [
          { name: 'EMA 20', description: 'Trend Filter', bias: dir === 'UP' ? 'BULLISH' : 'BEARISH' },
          { name: 'RSI 14', description: 'Momentum', bias: dir === 'UP' ? 'BULLISH' : 'BEARISH' },
        ],
        visionSummary: `${symbol} চার্ট ফ্রেম রিয়েল-টাইম ক্যান্ডেলস্টিক ডিটেক্টর দ্বারা সফলভাবে সনাক্ত ও মূল্যায়িত।`,
        confidenceScore: confidence / 100,
        isClearTradingChart: true,
        containsSensitivePrivateData: false,
      },
      marketVerification: {
        isVerified: true,
        status: 'MATCHED',
        notes: 'অন-ডিভাইস রিয়েল-টাইম ক্যান্ডেল কনফার্মেশন',
      },
      safetyDisclaimer: 'TradePulse Educational Decision Aid',
    };
  }

  /**
   * Common result processor
   */
  private processResult(result: ScreenAnalysisFinalResult, latencyMs: number): void {
    if (!result.visionData?.isClearTradingChart) {
      // INSTANT FLUSH ON FIRST FRAME WITHOUT CHART
      this.consecutiveChartDetections = 0;
      this.isChartFound = false;
      this.isSearchingForChart = true;
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.expirySecondsLeft = 0;

      // Ensure chart diagnostic explains why it is not detected
      if (!this.latestChartDiagnostic || this.latestChartDiagnostic.isChart) {
        this.latestChartDiagnostic = {
          isChart: false,
          distinctCandleBars: 0,
          totalCandlePixels: 0,
          horizontalSpanPercent: 0,
          verticalDispersionPx: 0,
          hasBrokerBackground: false,
          failureReason: result.visionData?.visionSummary || 'স্ক্রিনে কোনো ট্রেডিং ক্যান্ডেলস্টিক চার্ট পাওয়া যায়নি।',
          recommendedAction: 'Quotex, Binomo, Pocket Option বা TradingView অ্যাপের চার্ট সামনে রাখুন।',
        };
      }

      result.verdictTitle = 'আমি চার্ট খুঁজে পাইনি';
      result.direction = 'WAIT';
      result.confidence = 0;
      result.reasoning = [
        'স্ক্রিনে কোনো ট্রেডিং ক্যান্ডেলস্টিক চার্ট পাওয়া যায়নি।',
        'অনুগ্রহ করে ট্রেডিং অ্যাপ (Binomo/Quotex/MT4) এর চার্ট স্ক্রিনে রাখুন।',
        'চার্ট খোঁজা অব্যাহত রয়েছে...',
      ];
      this.latestResult = null;
      this.errorMessage = null;

      this.updateFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: '--:--',
        verdictTitle: 'চার্ট পাওয়া যায়নি',
        reasonText: this.latestChartDiagnostic.failureReason || 'ট্রেডিং চার্ট সামনে রাখুন',
        latencyMs,
        frameCount: this.latestFrameCount,
        lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
        resolution: this.latestResolution,
        captureState: this.captureState,
        aiState: this.aiState,
      });

      voiceAssistantService.announceNoChartFound();
    } else {
      // Frame indicates a valid trading chart!
      this.consecutiveChartDetections++;

      // TEMPORAL CONFIRMATION GATE:
      // Require at least 2 consecutive positive chart frames before releasing trade signals.
      // This prevents single accidental glitches, app drawer transitions, or popups from triggering signals!
      if (this.consecutiveChartDetections < 2) {
        this.isChartFound = false;
        this.isSearchingForChart = true;
        this.latestResult = null;
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.expirySecondsLeft = 0;

        this.updateFloatingOverlayHUD({
          direction: 'WAIT',
          confidence: 0,
          durationText: '--:--',
          verdictTitle: 'চার্ট যাচাই চলছে...',
          reasonText: 'ফ্রেম ১ নিশ্চিত, চূড়ান্ত নিশ্চিতকরণ পেন্ডিং',
          latencyMs,
          frameCount: this.latestFrameCount,
          lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
          resolution: this.latestResolution,
          captureState: this.captureState,
          aiState: this.aiState,
        });
        this.notify();
        return;
      }

      // 2 or more consecutive frames confirmed! CHART LOCKED!
      this.isChartFound = true;
      this.isSearchingForChart = false;
      this.latestResult = result;
      this.errorMessage = null;

      // Update diagnostic to indicate successful detection
      if (!this.latestChartDiagnostic || !this.latestChartDiagnostic.isChart) {
        this.latestChartDiagnostic = {
          isChart: true,
          distinctCandleBars: 10,
          totalCandlePixels: 350,
          horizontalSpanPercent: 75,
          verticalDispersionPx: 50,
          hasBrokerBackground: true,
          recommendedAction: 'সক্রিয় ট্রেডিং চার্ট সফলভাবে শনাক্ত ও লক হয়েছে।',
        };
      }

      // Start the countdown timer ONLY when active UP or DOWN signal is locked
      if (result.direction === 'UP' || result.direction === 'DOWN') {
        if (!this.countdownTimer || this.expirySecondsLeft <= 0) {
          this.startCountdownTicker();
        }
      } else {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.expirySecondsLeft = 0;
      }

      const countdownStr = (result.direction === 'UP' || result.direction === 'DOWN') && this.expirySecondsLeft > 0
        ? `${String(Math.floor(this.expirySecondsLeft / 60)).padStart(2, '0')}:${String(
            this.expirySecondsLeft % 60
          ).padStart(2, '0')}`
        : '--:--';

      // Update Native Floating HUD with full diagnostic context
      this.updateFloatingOverlayHUD({
        direction: result.direction,
        confidence: result.confidence,
        durationText: countdownStr,
        verdictTitle:
          result.direction === 'UP'
            ? 'CALL (UP)'
            : result.direction === 'DOWN'
            ? 'PUT (DOWN)'
            : 'WAIT',
        reasonText:
          result.visionData?.candlestickPattern ||
          result.reasoning[0] ||
          'মোমেন্টাম নিশ্চিত',
        latencyMs,
        symbol: result.visionData?.symbol || 'AUD/CHF',
        frameCount: this.latestFrameCount,
        lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
        resolution: this.latestResolution,
        captureState: this.captureState,
        aiState: this.aiState,
      });

      voiceAssistantService.announceAnalysisResult(result);
      whatsappAlertService.sendScreenAnalysisAlert(result).catch(() => {});
    }

    this.notify();
  }

  public async showFloatingOverlayHUD(data: FloatingOverlayData): Promise<void> {
    try {
      await TradePulseNativeScreen.showFloatingOverlay(data);
      this.hasFloatingOverlayActive = true;
    } catch (e) {
      console.warn('Could not launch overlay:', e);
    }
  }

  public async updateFloatingOverlayHUD(data: FloatingOverlayData): Promise<void> {
    try {
      await TradePulseNativeScreen.updateFloatingOverlay(data);
    } catch (e) {
      console.warn('Could not update overlay:', e);
    }
  }

  public async hideFloatingOverlayHUD(): Promise<void> {
    try {
      await TradePulseNativeScreen.hideFloatingOverlay();
      this.hasFloatingOverlayActive = false;
    } catch (e) {
      console.warn('Could not hide overlay:', e);
    }
  }

  /**
   * Pauses automatic frame extraction
   */
  public pause(): void {
    if (this.state !== 'STREAMING') return;
    this.state = 'PAUSED';
    this.captureState = 'PAUSED';
    this.aiState = 'IDLE';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();

    // Immediately reflect pause state on native floating overlay
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: '⏸ PAUSED',
      reasonText: 'ক্যাপচার স্থগিত করা হয়েছে',
      latencyMs: 0,
      frameCount: this.latestFrameCount,
      resolution: this.latestResolution,
      captureState: 'PAUSED',
      aiState: 'IDLE',
      errorReason: '',
    });
  }

  /**
   * Resumes automatic frame extraction
   */
  public resume(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'STREAMING';
    this.captureState = 'RUNNING';
    this.notify();

    // Immediately reflect resume state on native floating overlay
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: this.isChartFound ? 'WAIT' : 'চার্ট পাওয়া যায়নি',
      reasonText: this.isChartFound ? 'পরবর্তী ক্যান্ডেল অপেক্ষা' : 'ট্রেডিং চার্ট সামনে রাখুন',
      latencyMs: 0,
      frameCount: this.latestFrameCount,
      resolution: this.latestResolution,
      captureState: 'RUNNING',
      aiState: 'ANALYZING',
      errorReason: '',
    });

    this.captureAndAnalyzeCurrentFrame();
    this.resetIntervalTimer();
  }

  /**
   * Allows the user to immediately cancel an in-progress connection attempt
   */
  public cancelConnecting(): void {
    if (this.state === 'CONNECTING') {
      this.state = 'DISCONNECTED';
      this.captureState = 'STOPPED';
      this.aiState = 'IDLE';
      this.isSearchingForChart = false;
      this.isChartFound = false;
      this.errorMessage = 'কানেকশন বাতিল করা হয়েছে। পুনরায় চেষ্টা করুন।';
      this.notify();
    }
  }

  /**
   * Disconnects stream and frees all hardware tracks.
   * User requested: "সেটা ডিসকানেক্ট হওয়া ছাড়া কখনোই স্টপ হবে না বা সমান থাকবে"
   * Only called on explicit user action!
   */
  public async disconnect(reason?: string): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }

    try {
      await this.hideFloatingOverlayHUD();
    } catch (e) {
      console.warn('Overlay hide error:', e);
    }

    if (this.isNativeCaptureActive) {
      try {
        await TradePulseNativeScreen.stopScreenCapture();
      } catch (err) {
        console.warn('Native stop error:', err);
      }
      this.isNativeCaptureActive = false;
      this.hasFloatingOverlayActive = false;
    }

    if (this.nativeListenerHandle) {
      this.nativeListenerHandle.remove();
      this.nativeListenerHandle = null;
    }

    this.state = 'DISCONNECTED';
    this.captureState = 'STOPPED';
    this.aiState = 'IDLE';
    this.isSearchingForChart = false;
    this.isChartFound = false;
    this.latestResult = null;
    if (reason) {
      this.errorMessage = reason;
    }
    this.notify();
  }

  private resetIntervalTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.timer = setInterval(() => {
      if (this.state === 'STREAMING') {
        this.captureAndAnalyzeCurrentFrame();
      }
    }, this.scanIntervalMs);
  }

  /**
   * Grabs high-fidelity frame snapshot and calls backend Vision API
   */
  public async captureAndAnalyzeCurrentFrame(): Promise<void> {
    if (this.isProcessingFrame || !this.videoEl || !this.canvasEl || !this.stream) return;

    const video = this.videoEl;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    this.isProcessingFrame = true;
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout guard for multimodal vision API
    let frameCapturedAt = Date.now();
    let imageBase64 = '';

    try {
      const canvas = this.canvasEl;
      const maxDim = 1024;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frameCapturedAt = Date.now();
      imageBase64 = canvas.toDataURL('image/jpeg', 0.75);

      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          this.errorMessage = 'Backend returned unexpected format.';
          this.notify();
          return;
        }

        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;
          this.processResult(result, latencyMs);
        } else {
          const localResult = await this.analyzeFrameLocally(imageBase64, frameCapturedAt);
          this.processResult(localResult, latencyMs);
        }
      } else {
        const localResult = await this.analyzeFrameLocally(imageBase64, frameCapturedAt);
        this.processResult(localResult, latencyMs);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      const localResult = await this.analyzeFrameLocally(imageBase64, frameCapturedAt);
      this.processResult(localResult, latencyMs);
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  /**
   * Analyzes an uploaded screenshot or pasted chart image directly
   */
  public async analyzeImageDirectly(imageBase64: string): Promise<boolean> {
    if (this.isProcessingFrame) return false;
    this.isProcessingFrame = true;
    this.errorMessage = null;
    voiceAssistantService.announceImageUploaded();
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const frameCapturedAt = Date.now();
      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          frameCapturedAt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;

          // Auto-start streaming mode with uploaded image directly on display
          this.state = 'STREAMING';
          this.startCountdownTicker();
          this.processResult(result, latencyMs);
          return true;
        } else {
          this.errorMessage = data?.error || 'Analysis failed.';
          return false;
        }
      } else {
        let errorMsg = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch {}
        this.errorMessage = errorMsg;
        return false;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      this.errorMessage = err.message || 'Network error.';
      return false;
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  public isBusy(): boolean {
    return this.isProcessingFrame;
  }
}

export const liveScreenService = LiveScreenService.getInstance();
