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

    const hasError = Boolean(data.errorReason || data.aiState === 'ERROR' || data.aiState === 'TIMEOUT');
    const isScanning = !hasError && data.direction === 'WAIT' && (data.confidence <= 0 || data.durationText === '--:--');

    const badgeColor = hasError
      ? '#ef4444'
      : data.direction === 'UP'
      ? '#10b981'
      : data.direction === 'DOWN'
      ? '#ef4444'
      : '#f59e0b';

    const bgGradient = hasError
      ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(15, 23, 42, 0.95))'
      : data.direction === 'UP'
      ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.95), rgba(15, 23, 42, 0.95))'
      : data.direction === 'DOWN'
      ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.95), rgba(15, 23, 42, 0.95))'
      : 'linear-gradient(135deg, rgba(120, 53, 15, 0.95), rgba(15, 23, 42, 0.95))';

    const symbolText = data.symbol || 'AUD/CHF';
    const frameStr = data.frameCount ? `#${data.frameCount}` : '#1';
    const latencyStr = data.latencyMs ? `${data.latencyMs}ms` : '0ms';
    const resStr = data.resolution || '720p';

    if (hasError) {
      this.overlayElement.innerHTML = `
        <div style="background: ${bgGradient}; border: 2px solid ${badgeColor}; border-radius: 18px; padding: 10px 16px; box-shadow: 0 14px 35px rgba(0,0,0,0.7); backdrop-filter: blur(14px); min-width: 240px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 12px; font-weight: 900; color: #fca5a5; letter-spacing: 0.3px;">⚠️ ${data.errorReason || 'সংযোগ ত্রুটি'}</span>
            <span style="font-size: 10px; font-weight: 700; background: rgba(0,0,0,0.5); padding: 1px 6px; border-radius: 8px; color: #f87171; font-family: monospace;">Frame ${frameStr}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px; margin-top: 4px;">
            <span>⏱ ল্যাটেন্সি: ${latencyStr}</span>
            <span>State: WAIT</span>
          </div>
        </div>
      `;
    } else if (isScanning) {
      this.overlayElement.innerHTML = `
        <div style="background: ${bgGradient}; border: 2px solid ${badgeColor}; border-radius: 18px; padding: 8px 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.65); backdrop-filter: blur(12px); min-width: 220px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${badgeColor}; box-shadow: 0 0 8px ${badgeColor}; animation: pulse 1.5s infinite;"></span>
              <span style="font-size: 12px; font-weight: 700; color: #fef08a;">চার্ট স্ক্যান হচ্ছে...</span>
            </div>
            <span style="font-size: 10px; font-family: monospace; color: #94a3b8; background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 8px;">${frameStr}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3px;">
            <span>${resStr}</span>
            <span>AI: ${data.aiState || 'ANALYZING'}</span>
          </div>
        </div>
      `;
    } else {
      const dirText = data.direction === 'UP' ? '▲ CALL (UP)' : data.direction === 'DOWN' ? '▼ PUT (DOWN)' : '● WAIT';
      const shortReason = data.reasonText && data.reasonText.length > 28
        ? data.reasonText.substring(0, 26) + '..'
        : data.reasonText || 'মোমেন্টাম নিশ্চিত';

      this.overlayElement.innerHTML = `
        <div style="background: ${bgGradient}; border: 2px solid ${badgeColor}; border-radius: 20px; padding: 10px 16px; box-shadow: 0 14px 35px rgba(0,0,0,0.7); backdrop-filter: blur(14px); min-width: 240px; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px;">
            <span style="font-size: 13px; font-weight: 900; color: ${badgeColor}; letter-spacing: 0.4px;">${dirText}</span>
            <span style="font-size: 11px; font-weight: 700; background: rgba(0,0,0,0.5); padding: 1px 7px; border-radius: 10px; color: #38bdf8; font-family: monospace;">⏱ ${data.durationText || '01:00'}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #cbd5e1; margin-bottom: 4px;">
            <span><b>${symbolText}</b> • ${shortReason}</span>
            <span style="font-size: 10px; color: #94a3b8; margin-left: 6px;">${data.confidence}%</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3px;">
            <span>Frame ${frameStr} (${resStr})</span>
            <span>⚡ ${latencyStr}</span>
          </div>
        </div>
      `;
    }
  }
}
