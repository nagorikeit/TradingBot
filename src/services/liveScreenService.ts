import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';
import { voiceAssistantService } from './voiceAssistantService';
import { whatsappAlertService } from './whatsappAlertService';
import {
  TradePulseNativeScreen,
  FloatingOverlayData,
  NativeCaptureFrameEvent,
} from '../plugins/TradePulseNativeScreen';
import { Capacitor } from '@capacitor/core';

export class LiveScreenService {
  private static instance: LiveScreenService;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private state: LiveStreamState = 'IDLE';
  private timer: any = null;
  private isProcessingFrame: boolean = false;
  private scanIntervalMs: number = 4000; // 4 seconds optimal for quick signal analysis
  private latestResult: ScreenAnalysisFinalResult | null = null;
  private listeners: Set<() => void> = new Set();
  private errorMessage: string | null = null;
  
  // Real-time latency & sequence guards
  private latestProcessedSequenceId: number = 0;
  private isNativeCaptureActive: boolean = false;
  private hasFloatingOverlayActive: boolean = false;
  private nativeListenerHandle: { remove: () => void } | null = null;

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

  public isSignalStale(ttlMs: number = 15000): boolean {
    if (!this.latestResult) return true;
    return Date.now() - this.latestResult.timestamp > ttlMs;
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
    if (this.state === 'STREAMING' || this.state === 'CONNECTING') return true;

    this.state = 'CONNECTING';
    this.errorMessage = null;
    this.notify();

    // 1. If running inside Capacitor Native Android runtime
    if (Capacitor.isNativePlatform()) {
      return await this.startNativeAndroidCapture();
    }

    // 2. Standard Web fallback (Desktop or Dev Preview)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      this.state = 'ERROR';
      this.errorMessage =
        'Screen Capture API (getDisplayMedia) is not supported in this mobile web browser or iframe. On Android, please use the APK build to capture other apps with Native Floating Window, or use the "Upload Chart Image" option.';
      voiceAssistantService.announceNoScreenCapture();
      this.notify();
      return false;
    }

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
      this.notify();

      voiceAssistantService.announceChartFoundAnalyzing();

      this.captureAndAnalyzeCurrentFrame();
      this.resetIntervalTimer();

      // Show floating overlay simulator in web
      this.showFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: '1-3 min',
        verdictTitle: 'INITIALIZING AI HUD',
        reasonText: 'Connected live chart stream. Extracting first frame...',
        latencyMs: 0,
      });

      return true;
    } catch (err: any) {
      console.warn('Screen connection cancelled or failed:', err);
      this.state = 'DISCONNECTED';
      this.errorMessage =
        err.name === 'NotAllowedError'
          ? 'Screen capture permission was denied by user.'
          : err.message || 'Failed to capture screen.';
      voiceAssistantService.announceNoScreenCapture();
      this.notify();
      return false;
    }
  }

  /**
   * Starts Native Android Background Screen Capture + Floating HUD
   */
  public async startNativeAndroidCapture(): Promise<boolean> {
    try {
      // 1. Check & Request Overlay Permission for Floating Bubble
      const perm = await TradePulseNativeScreen.checkPermissions();
      if (!perm.hasOverlayPermission) {
        await TradePulseNativeScreen.requestOverlayPermission();
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

      // 3. Start MediaProjection & Foreground Service
      const result = await TradePulseNativeScreen.startScreenCapture({
        intervalSeconds: Math.round(this.scanIntervalMs / 1000),
        targetWidth: 720,
        quality: 0.75,
      });

      if (result.success) {
        this.isNativeCaptureActive = true;
        this.state = 'STREAMING';
        this.errorMessage = null;
        this.notify();

        // Show floating HUD widget over all apps
        await this.showFloatingOverlayHUD({
          direction: 'WAIT',
          confidence: 0,
          durationText: '1-3 min',
          verdictTitle: 'TRADEPULSE LIVE HUD',
          reasonText: 'Foreground Service active. Switch to your trading app (Binomo, Quotex, MT4).',
          latencyMs: 0,
        });

        voiceAssistantService.announceChartFoundAnalyzing();
        return true;
      } else {
        this.state = 'ERROR';
        this.errorMessage = result.message || 'Native screen capture initialization rejected';
        this.notify();
        return false;
      }
    } catch (err: any) {
      console.error('Native screen capture error:', err);
      this.state = 'ERROR';
      this.errorMessage = err.message || 'Failed to launch Native Android Screen Capture Service';
      this.notify();
      return false;
    }
  }

  /**
   * Handles frame emitted by Native Android MediaProjection or Web fallback
   */
  private async handleIncomingNativeFrame(frame: NativeCaptureFrameEvent): Promise<void> {
    // Latency & Concurrency guard: ignore if a newer frame is already in flight
    if (frame.sequenceId <= this.latestProcessedSequenceId) {
      return;
    }

    if (this.isProcessingFrame) {
      return;
    }

    this.latestProcessedSequenceId = frame.sequenceId;
    this.isProcessingFrame = true;
    this.notify();

    const startTime = Date.now();

    try {
      const res = await fetch('/api/agent/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frame.imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt: frame.timestamp,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;

          // Guard: If total latency exceeds 3500ms, mark as WAIT to prevent expired execution
          if (latencyMs > 3500 && result.direction !== 'WAIT') {
            result.direction = 'WAIT';
            result.verdictTitle = 'WAIT / SIGNAL EXPIRED';
            result.reasoning.unshift(
              `LATENCY TIMEOUT GUARD: Frame analysis took ${latencyMs}ms (>3.5s). Signal held in WAIT to prevent stale trading.`
            );
          }

          this.latestResult = result;
          this.errorMessage = null;

          // Update Native Floating HUD
          await this.updateFloatingOverlayHUD({
            direction: result.direction,
            confidence: result.confidence,
            durationText: result.suggestedExpiry || '1 - 2 Min',
            verdictTitle: result.verdictTitle,
            reasonText: result.reasoning[0] || 'Chart verified',
            latencyMs,
            symbol: result.visionData?.symbol,
          });

          voiceAssistantService.announceAnalysisResult(result);
          whatsappAlertService.sendScreenAnalysisAlert(result).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('Native frame analysis network failure:', err);
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
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
   * Disconnects stream and frees all hardware tracks
   */
  public async disconnect(reason?: string): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
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

      const res = await fetch('/api/agent/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          this.errorMessage = 'Server returned HTML instead of JSON. Please verify backend API route.';
          this.notify();
          return;
        }

        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;

          // Latency guard check
          if (latencyMs > 3500 && result.direction !== 'WAIT') {
            result.direction = 'WAIT';
            result.verdictTitle = 'WAIT / SIGNAL EXPIRED';
            result.reasoning.unshift(
              `LATENCY TIMEOUT GUARD: Frame analysis took ${latencyMs}ms (>3.5s). Signal held in WAIT.`
            );
          }

          this.latestResult = result;
          this.errorMessage = null;

          // Update Floating HUD
          this.updateFloatingOverlayHUD({
            direction: result.direction,
            confidence: result.confidence,
            durationText: result.suggestedExpiry || '1 - 2 Min',
            verdictTitle: result.verdictTitle,
            reasonText: result.reasoning[0] || 'Chart verified',
            latencyMs,
            symbol: result.visionData?.symbol,
          });

          voiceAssistantService.announceAnalysisResult(result);
          whatsappAlertService.sendScreenAnalysisAlert(result).catch((err) => {
            console.warn('[LiveScreenService] WhatsApp alert dispatch error:', err);
          });
        } else {
          this.errorMessage = data?.error || 'Analysis service failed to return structured result.';
        }
      } else {
        let errorMsg = `Server error (${res.status} ${res.statusText})`;
        if (res.status === 413) {
          errorMsg = 'Screen frame payload too large (HTTP 413). Downscaling applied.';
        } else {
          try {
            const errData = await res.json();
            if (errData && errData.error) errorMsg = errData.error;
          } catch {}
        }
        console.warn('Frame analysis returned non-200:', errorMsg);
        this.errorMessage = errorMsg;
      }
    } catch (err: any) {
      console.error('Frame capture & analysis failure:', err);
      this.errorMessage = err.message || 'Network error communicating with Vision backend.';
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

    try {
      const frameCapturedAt = Date.now();
      const res = await fetch('/api/agent/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          frameCapturedAt,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          this.errorMessage = 'Server returned HTML instead of JSON. Please verify backend API route.';
          this.notify();
          return false;
        }

        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;

          this.latestResult = result;
          this.errorMessage = null;

          this.showFloatingOverlayHUD({
            direction: result.direction,
            confidence: result.confidence,
            durationText: '1-3 min',
            verdictTitle: result.verdictTitle,
            reasonText: result.reasoning[0] || 'Image uploaded',
            latencyMs,
            symbol: result.visionData?.symbol,
          });

          voiceAssistantService.announceAnalysisResult(result);
          return true;
        } else {
          this.errorMessage = data?.error || 'Analysis service failed to return structured result.';
          return false;
        }
      } else {
        let errorMsg = `Server error (${res.status} ${res.statusText})`;
        if (res.status === 413) {
          errorMsg = 'Image payload too large (HTTP 413). Please compress or use a smaller image.';
        } else {
          try {
            const errData = await res.json();
            if (errData && errData.error) errorMsg = errData.error;
          } catch {}
        }
        this.errorMessage = errorMsg;
        return false;
      }
    } catch (err: any) {
      this.errorMessage = err.message || 'Network error communicating with Vision backend.';
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
