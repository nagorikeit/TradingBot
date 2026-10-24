import { WebPlugin } from '@capacitor/core';
import type {
  TradePulseNativeScreenPlugin,
  FloatingOverlayData,
  NativeCaptureFrameEvent,
} from './TradePulseNativeScreen';

export class TradePulseNativeScreenWeb extends WebPlugin implements TradePulseNativeScreenPlugin {
  private captureIntervalId: any = null;
  private sequenceCounter: number = 0;
  private currentStream: MediaStream | null = null;
  private hiddenVideo: HTMLVideoElement | null = null;
  private hiddenCanvas: HTMLCanvasElement | null = null;

  async checkPermissions(): Promise<{
    hasOverlayPermission: boolean;
    hasNotificationPermission: boolean;
  }> {
    // In web browser preview, overlay is rendered within DOM
    return {
      hasOverlayPermission: true,
      hasNotificationPermission: true,
    };
  }

  async requestOverlayPermission(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async startScreenCapture(options?: {
    intervalSeconds?: number;
    targetWidth?: number;
    targetHeight?: number;
    quality?: number;
  }): Promise<{ success: boolean; message?: string }> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return {
        success: false,
        message: 'Browser does not support getDisplayMedia. Use Chrome/Edge desktop or native Android build.',
      };
    }

    try {
      this.currentStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'window' },
        audio: false,
      });

      this.hiddenVideo = document.createElement('video');
      this.hiddenVideo.autoplay = true;
      this.hiddenVideo.playsInline = true;
      this.hiddenVideo.muted = true;
      this.hiddenVideo.srcObject = this.currentStream;
      await this.hiddenVideo.play().catch(() => {});

      this.hiddenCanvas = document.createElement('canvas');
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Screen capture denied' };
    }
  }

  async captureSingleFrame(): Promise<{
    success: boolean;
    imageBase64?: string;
    timestamp?: number;
    sequenceId?: number;
    width?: number;
    height?: number;
  }> {
    if (!this.hiddenVideo || !this.hiddenCanvas || !this.currentStream) {
      return { success: false };
    }
    if (this.hiddenVideo.videoWidth === 0) {
      return { success: false };
    }

    try {
      const targetWidth = 1280;
      const scale = Math.min(1, targetWidth / this.hiddenVideo.videoWidth);
      this.hiddenCanvas.width = Math.round(this.hiddenVideo.videoWidth * scale);
      this.hiddenCanvas.height = Math.round(this.hiddenVideo.videoHeight * scale);

      const ctx = this.hiddenCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(this.hiddenVideo, 0, 0, this.hiddenCanvas.width, this.hiddenCanvas.height);
        const imageBase64 = this.hiddenCanvas.toDataURL('image/jpeg', 0.8);

        this.sequenceCounter += 1;
        const frameEvent: NativeCaptureFrameEvent = {
          imageBase64,
          timestamp: Date.now(),
          sequenceId: this.sequenceCounter,
          width: this.hiddenCanvas.width,
          height: this.hiddenCanvas.height,
        };

        this.notifyListeners('onFrameCaptured', frameEvent);
        return {
          success: true,
          imageBase64,
          timestamp: frameEvent.timestamp,
          sequenceId: frameEvent.sequenceId,
          width: frameEvent.width,
          height: frameEvent.height,
        };
      }
    } catch (e) {
      console.warn('captureSingleFrame error:', e);
    }
    return { success: false };
  }

  async stopScreenCapture(): Promise<{ success: boolean }> {
    if (this.captureIntervalId) {
      clearInterval(this.captureIntervalId);
      this.captureIntervalId = null;
    }
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((t) => t.stop());
      this.currentStream = null;
    }
    if (this.hiddenVideo) {
      this.hiddenVideo.srcObject = null;
      this.hiddenVideo = null;
    }
    return { success: true };
  }

  async showFloatingOverlay(data: FloatingOverlayData): Promise<{ success: boolean }> {
    console.log('[WebFallback] showFloatingOverlay:', data);
    return { success: true };
  }

  async updateFloatingOverlay(data: FloatingOverlayData): Promise<{ success: boolean }> {
    console.log('[WebFallback] updateFloatingOverlay:', data);
    return { success: true };
  }

  async hideFloatingOverlay(): Promise<{ success: boolean }> {
    console.log('[WebFallback] hideFloatingOverlay');
    return { success: true };
  }


  public async speak(options: { text: string }): Promise<{ success: boolean; message?: string }> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return { success: false, message: 'Web SpeechSynthesis not supported' };
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(options.text);
      utterance.lang = 'bn-BD';
      window.speechSynthesis.speak(utterance);
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Speech error' };
    }
  }

  public async stopSpeaking(): Promise<{ success: boolean }> {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return { success: true };
  }
}
