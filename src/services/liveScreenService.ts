import { LiveStreamState, ScreenAnalysisFinalResult } from '../types/screenTypes';

export class LiveScreenService {
  private static instance: LiveScreenService;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private state: LiveStreamState = 'IDLE';
  private timer: any = null;
  private isProcessingFrame: boolean = false;
  private scanIntervalMs: number = 8000; // 8 seconds default
  private latestResult: ScreenAnalysisFinalResult | null = null;
  private listeners: Set<() => void> = new Set();
  private errorMessage: string | null = null;

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

  public getScanIntervalSeconds(): number {
    return Math.round(this.scanIntervalMs / 1000);
  }

  public setScanIntervalSeconds(seconds: number): void {
    this.scanIntervalMs = Math.max(4, Math.min(60, seconds)) * 1000;
    if (this.state === 'STREAMING') {
      this.resetIntervalTimer();
    }
    this.notify();
  }

  /**
   * Prompts user for Screen / Window share permission and connects live stream
   */
  public async connectScreen(): Promise<boolean> {
    if (this.state === 'STREAMING' || this.state === 'CONNECTING') return true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      this.state = 'ERROR';
      this.errorMessage =
        'Screen Capture API (getDisplayMedia) is not supported in this browser or environment.';
      this.notify();
      return false;
    }

    try {
      this.state = 'CONNECTING';
      this.errorMessage = null;
      this.notify();

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

      // Listen for browser "Stop Sharing" native bar event
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.disconnect('Screen sharing was ended by user.');
        };
      }

      this.state = 'STREAMING';
      this.notify();

      // Trigger immediate first frame inspection, then setup loop
      this.captureAndAnalyzeCurrentFrame();
      this.resetIntervalTimer();

      return true;
    } catch (err: any) {
      console.warn('Screen connection cancelled or failed:', err);
      this.state = 'DISCONNECTED';
      this.errorMessage = err.name === 'NotAllowedError'
        ? 'Screen capture permission was denied by user.'
        : err.message || 'Failed to capture screen.';
      this.notify();
      return false;
    }
  }

  /**
   * Pauses automatic frame extraction while keeping stream alive
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
  public disconnect(reason?: string): void {
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

    this.state = 'DISCONNECTED';
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

    try {
      const canvas = this.canvasEl;
      // Downscale to max 1280 width to optimize Gemini payload token count & transfer latency
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameCapturedAt = Date.now();
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

      // Call secure server proxy endpoint
      const res = await fetch('/api/agent/vision/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          this.latestResult = data.result;
          this.errorMessage = null;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn('Frame analysis returned non-200:', errData);
      }
    } catch (err: any) {
      console.error('Frame capture & analysis failure:', err);
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
