import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';
import { voiceAssistantService } from './voiceAssistantService';
import { whatsappAlertService } from './whatsappAlertService';
import {
  TradePulseNativeScreen,
  FloatingOverlayData,
  NativeCaptureFrameEvent,
} from '../plugins/TradePulseNativeScreen';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from './apiConfig';

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
  private expirySecondsLeft: number = 60; // 1-minute candle default countdown

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

  public getExpirySecondsLeft(): number {
    return this.expirySecondsLeft;
  }

  public shouldAutoOpenModal(): boolean {
    return this.autoOpenModal;
  }

  public clearAutoOpenModal(): void {
    this.autoOpenModal = false;
  }

  public isSignalStale(_ttlMs: number = 15000): boolean {
    // Live stream never marks signal as stopped or broken - stays active continuously
    return false;
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
    this.errorMessage = null;
    this.isSearchingForChart = true;
    this.notify();

    // 1. If running inside Capacitor Native Android runtime
    if (Capacitor.isNativePlatform()) {
      return await this.startNativeAndroidCapture();
    }

    // 2. Standard Web screen capture
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
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
        this.startCountdownTicker();
        this.notify();

        voiceAssistantService.announceSearchingForChart();

        this.captureAndAnalyzeCurrentFrame();
        this.resetIntervalTimer();

        // Show floating overlay simulator in web
        this.showFloatingOverlayHUD({
          direction: 'WAIT',
          confidence: 0,
          durationText: '01:00',
          verdictTitle: 'চার্ট খোঁজা হচ্ছে...',
          reasonText: 'কানেক্ট সফল হয়েছে। স্ক্রিনে ট্রেডিং চার্ট রাখা নিশ্চিত করুন...',
          latencyMs: 0,
        });

        return true;
      } catch (err: any) {
        console.warn('Web getDisplayMedia cancelled or failed:', err);
        // Fall back gracefully to active monitor mode so user is not stuck
        if (err.name === 'NotAllowedError') {
          this.state = 'DISCONNECTED';
          this.errorMessage = 'স্ক্রিন ক্যাপচারের অনুমতি বাতিল করা হয়েছে।';
          voiceAssistantService.announceNoScreenCapture();
          this.notify();
          return false;
        }
      }
    }

    // 3. Fallback for mobile browser / WebView / iframe without getDisplayMedia
    this.state = 'STREAMING';
    this.autoOpenModal = true;
    this.isSearchingForChart = true;
    this.errorMessage = null;
    this.startCountdownTicker();
    this.notify();

    voiceAssistantService.announceSearchingForChart();

    // Trigger initial simulated check or guide user to upload chart
    this.latestResult = {
      analysisId: `init_${Date.now()}`,
      timestamp: Date.now(),
      frameCapturedAt: Date.now(),
      direction: 'WAIT',
      confidence: 0,
      verdictTitle: 'আমি চার্ট খুঁজে পাইনি',
      suggestedExpiry: '01:00',
      reasoning: [
        'স্ক্রিনে ট্রেডিং চার্ট খোঁজা হচ্ছে...',
        'ট্রেডিং চার্ট স্ক্রিনে দৃশ্যমান থাকলে স্বয়ংক্রিয়ভাবে সনাক্ত হবে।',
      ],
      visionData: {
        marketType: 'UNKNOWN',
        lastCandleDirection: 'UNCERTAIN',
        indicatorsIdentified: [],
        chartStructure: 'UNCLEAR',
        visionSummary: 'চার্ট খোঁজা হচ্ছে...',
        confidenceScore: 0,
        isClearTradingChart: false,
        containsSensitivePrivateData: false,
      },
      marketVerification: {
        isVerified: false,
        status: 'SKIPPED',
        notes: 'চার্ট খোঁজা হচ্ছে...',
      },
      safetyDisclaimer: 'TradePulse Paper Analysis Tool',
    };
    this.notify();

    return true;
  }

  /**
   * Starts Native Android Background Screen Capture + Floating HUD
   */
  public async startNativeAndroidCapture(): Promise<boolean> {
    try {
      // 1. Check & Request Overlay Permission for Floating Bubble
      try {
        const perm = await TradePulseNativeScreen.checkPermissions();
        if (!perm.hasOverlayPermission) {
          await TradePulseNativeScreen.requestOverlayPermission();
        }
      } catch (permErr) {
        console.warn('Overlay permission check non-fatal error:', permErr);
      }

      // 2. Setup frame listener
      if (this.nativeListenerHandle) {
        this.nativeListenerHandle.remove();
        this.nativeListenerHandle = null;
      }

      this.nativeListenerHandle = await TradePulseNativeScreen.addListener(
        'onFrameCaptured',
        (frame: NativeCaptureFrameEvent) => {
          this.handleIncomingNativeFrame(frame);
        }
      );

      // 3. Start MediaProjection & Foreground Service with timeout guard
      const startCapturePromise = TradePulseNativeScreen.startScreenCapture({
        intervalSeconds: Math.round(this.scanIntervalMs / 1000),
        targetWidth: 720,
        quality: 0.75,
      });

      const timeoutPromise = new Promise<{ success: boolean; message?: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, message: 'অনুমতি ডায়ালগের জন্য সময় শেষ হয়েছে। আবার চেষ্টা করুন।' });
        }, 20000);
      });

      const result = await Promise.race([startCapturePromise, timeoutPromise]);

      if (result.success) {
        this.isNativeCaptureActive = true;
        this.state = 'STREAMING';
        this.autoOpenModal = true;
        this.isSearchingForChart = true;
        this.errorMessage = null;
        this.startCountdownTicker();
        this.notify();

        // Show floating HUD widget over other apps
        await this.showFloatingOverlayHUD({
          direction: 'WAIT',
          confidence: 0,
          durationText: '01:00',
          verdictTitle: 'চার্ট খোঁজা হচ্ছে...',
          reasonText: 'ট্রেডিং অ্যাপ খুলুন (Binomo, Quotex, MT4)। চার্ট শনাক্ত হলে সিগন্যাল আসবে।',
          latencyMs: 0,
        });

        voiceAssistantService.announceSearchingForChart();
        return true;
      } else {
        this.state = 'ERROR';
        this.errorMessage = result.message || 'স্ক্রিন ক্যাপচার শুরু করতে অনুমতি দিন';
        this.notify();
        return false;
      }
    } catch (err: any) {
      console.error('Native screen capture error:', err);
      this.state = 'ERROR';
      this.errorMessage = err.message || 'Android Screen Capture শুরু করতে ব্যর্থ হয়েছে';
      this.notify();
      return false;
    }
  }

  /**
   * Countdown ticker: decrements second-by-second for the active candle expiry
   * Never stops until disconnect()!
   */
  private startCountdownTicker(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    // Default candle countdown: 60s
    this.expirySecondsLeft = 60;

    this.countdownTimer = setInterval(() => {
      if (this.state !== 'STREAMING') return;

      this.expirySecondsLeft -= 1;
      if (this.expirySecondsLeft <= 0) {
        // Candle time ended - evaluate next candle!
        voiceAssistantService.announceCandleExpired();
        this.expirySecondsLeft = 60; // reset for next candle

        // Immediate snapshot trigger for next candle
        if (this.stream) {
          this.captureAndAnalyzeCurrentFrame();
        }
      }
      this.notify();
    }, 1000);
  }

  /**
   * Handles frame emitted by Native Android MediaProjection
   */
  private async handleIncomingNativeFrame(frame: NativeCaptureFrameEvent): Promise<void> {
    if (frame.sequenceId <= this.latestProcessedSequenceId || this.isProcessingFrame) {
      return;
    }

    this.latestProcessedSequenceId = frame.sequenceId;
    this.isProcessingFrame = true;
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout guard

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

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;

          this.processResult(result, latencyMs);
        }
      }
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn('Native frame analysis network failure:', err);
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  /**
   * Common result processor
   */
  private processResult(result: ScreenAnalysisFinalResult, latencyMs: number): void {
    if (!result.visionData?.isClearTradingChart) {
      // User requested: "না পেলে সে বলবে আমি চার্ট খোঁজে পাইনি"
      this.isChartFound = false;
      this.isSearchingForChart = true;
      result.verdictTitle = 'আমি চার্ট খুঁজে পাইনি';
      result.direction = 'WAIT';
      result.confidence = 0;
      result.reasoning = [
        'স্ক্রিনে কোনো ট্রেডিং ক্যান্ডেলস্টিক চার্ট পাওয়া যায়নি।',
        'অনুগ্রহ করে ট্রেডিং অ্যাপ (Binomo/Quotex/MT4) এর চার্ট স্ক্রিনে রাখুন।',
        'চার্ট খোঁজা অব্যাহত রয়েছে...',
      ];
      this.latestResult = result;
      this.errorMessage = null;

      this.updateFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: `${this.expirySecondsLeft}s`,
        verdictTitle: 'আমি চার্ট খুঁজে পাইনি',
        reasonText: 'চার্ট খুঁজছি... অনুগ্রহ করে ট্রেডিং চার্ট সামনে আনুন',
        latencyMs,
      });

      voiceAssistantService.announceNoChartFound();
    } else {
      // User requested: "যখন পাবে তখন সে এনালাইসিস করবে তার টেকনোলজি দিয়ে এনালাইসিস করে যা পাবে সে হিসেবে দিকনির্দেশনা দিবে"
      this.isChartFound = true;
      this.isSearchingForChart = false;
      this.latestResult = result;
      this.errorMessage = null;

      // Update Native Floating HUD
      const countdownStr = `${String(Math.floor(this.expirySecondsLeft / 60)).padStart(2, '0')}:${String(
        this.expirySecondsLeft % 60
      ).padStart(2, '0')}`;

      this.updateFloatingOverlayHUD({
        direction: result.direction,
        confidence: result.confidence,
        durationText: countdownStr,
        verdictTitle: result.verdictTitle,
        reasonText: result.reasoning[0] || 'চার্ট ভেরিফাইড',
        latencyMs,
        symbol: result.visionData?.symbol,
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
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  /**
   * Resumes automatic frame extraction
   */
  public resume(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'STREAMING';
    this.notify();
    this.captureAndAnalyzeCurrentFrame();
    this.resetIntervalTimer();
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

    if (this.isNativeCaptureActive) {
      try {
        await TradePulseNativeScreen.stopScreenCapture();
        await TradePulseNativeScreen.hideFloatingOverlay();
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
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout guard

    try {
      const canvas = this.canvasEl;
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameCapturedAt = Date.now();
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

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
          this.errorMessage = data?.error || 'Analysis service failed.';
        }
      } else {
        let errorMsg = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch {}
        this.errorMessage = errorMsg;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      console.warn('Frame capture & analysis failure:', err);
      // Non-fatal: keep running
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
    const timeout = setTimeout(() => controller.abort(), 8000);

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

          // Auto-start streaming mode with uploaded image so floating modal opens
          this.state = 'STREAMING';
          this.autoOpenModal = true;
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
