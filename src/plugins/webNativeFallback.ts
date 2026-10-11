import { WebPlugin } from '@capacitor/core';
import type {
  TradePulseNativeScreenPlugin,
  FloatingOverlayData,
  NativeCaptureFrameEvent,
} from './TradePulseNativeScreen';

export class TradePulseNativeScreenWeb extends WebPlugin implements TradePulseNativeScreenPlugin {
  private overlayElement: HTMLDivElement | null = null;
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

      const intervalMs = (options?.intervalSeconds || 5) * 1000;
      const targetWidth = options?.targetWidth || 1280;
      const quality = options?.quality || 0.8;

      if (this.captureIntervalId) clearInterval(this.captureIntervalId);

      this.captureIntervalId = setInterval(() => {
        if (!this.hiddenVideo || !this.hiddenCanvas || !this.currentStream) return;
        if (this.hiddenVideo.videoWidth === 0) return;

        const scale = Math.min(1, targetWidth / this.hiddenVideo.videoWidth);
        this.hiddenCanvas.width = Math.round(this.hiddenVideo.videoWidth * scale);
        this.hiddenCanvas.height = Math.round(this.hiddenVideo.videoHeight * scale);

        const ctx = this.hiddenCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.hiddenVideo, 0, 0, this.hiddenCanvas.width, this.hiddenCanvas.height);
          const imageBase64 = this.hiddenCanvas.toDataURL('image/jpeg', quality);

          this.sequenceCounter += 1;
          const frameEvent: NativeCaptureFrameEvent = {
            imageBase64,
            timestamp: Date.now(),
            sequenceId: this.sequenceCounter,
            width: this.hiddenCanvas.width,
            height: this.hiddenCanvas.height,
          };

          this.notifyListeners('onFrameCaptured', frameEvent);
        }
      }, intervalMs);

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Screen capture denied' };
    }
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
    this.renderWebFloatingHUD(data);
    return { success: true };
  }

  async updateFloatingOverlay(data: FloatingOverlayData): Promise<{ success: boolean }> {
    this.renderWebFloatingHUD(data);
    return { success: true };
  }

  async hideFloatingOverlay(): Promise<{ success: boolean }> {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
    return { success: true };
  }

  private renderWebFloatingHUD(data: FloatingOverlayData) {
    if (!this.overlayElement) {
      this.overlayElement = document.createElement('div');
      this.overlayElement.id = 'tradepulse-floating-overlay-badge';
      this.overlayElement.style.position = 'fixed';
      this.overlayElement.style.top = '70px';
      this.overlayElement.style.right = '20px';
      this.overlayElement.style.zIndex = '99999';
      this.overlayElement.style.cursor = 'grab';
      this.overlayElement.style.userSelect = 'none';
      document.body.appendChild(this.overlayElement);

      // Simple drag handler
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let elemX = 0;
      let elemY = 0;

      this.overlayElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = this.overlayElement!.getBoundingClientRect();
        elemX = rect.left;
        elemY = rect.top;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging || !this.overlayElement) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        this.overlayElement.style.left = `${elemX + dx}px`;
        this.overlayElement.style.top = `${elemY + dy}px`;
        this.overlayElement.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    const badgeColor =
      data.direction === 'UP'
        ? '#10b981'
        : data.direction === 'DOWN'
        ? '#ef4444'
        : '#f59e0b';

    const bgGradient =
      data.direction === 'UP'
        ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(4, 47, 46, 0.95))'
        : data.direction === 'DOWN'
        ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(88, 28, 28, 0.95))'
        : 'linear-gradient(135deg, rgba(120, 53, 15, 0.95), rgba(69, 26, 3, 0.95))';

    this.overlayElement.innerHTML = `
      <div style="background: ${bgGradient}; border: 1.5px solid ${badgeColor}; border-radius: 12px; padding: 10px 14px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.6); backdrop-filter: blur(8px); min-width: 200px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 14px; font-weight: 800; color: ${badgeColor}; letter-spacing: 0.5px;">${data.direction}</span>
            <span style="font-size: 11px; background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px; color: #e2e8f0;">${data.confidence}% Conf</span>
          </div>
          <span style="font-size: 10px; color: #94a3b8; font-family: monospace;">${data.latencyMs}ms</span>
        </div>
        <div style="font-size: 12px; font-weight: 600; color: #f8fafc; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">
          ${data.verdictTitle || 'Analyzing...'}
        </div>
        <div style="font-size: 11px; color: #cbd5e1; line-height: 1.3; max-width: 190px;">
          ⏱ <b>Expiry:</b> ${data.durationText || '1-3 min'}<br/>
          💡 <span style="opacity: 0.9;">${data.reasonText ? data.reasonText.substring(0, 75) + '...' : 'Evaluating chart pattern'}</span>
        </div>
      </div>
    `;
  }
}
