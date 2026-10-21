/**
 * Picture-in-Picture (PiP) Floating HUD Service
 * 
 * Provides an Operating-System Level Floating Window that stays ALWAYS-ON-TOP
 * over other desktop and mobile applications (including Quotex, Binomo, PocketOption, MetaTrader).
 * 
 * Capabilities:
 * 1. Document Picture-in-Picture (Desktop Chrome / Edge / Chromium):
 *    Spawns an interactive native OS window that floats on top of all desktop windows.
 * 2. Canvas-Video Picture-in-Picture (Android Chrome / Safari / Standard browsers):
 *    Renders a live 60fps high-contrast dark-theme trading HUD on HTML5 Canvas
 *    and streams it via video.requestPictureInPicture() as an Android OS floating overlay widget!
 */

import { voiceAssistantService } from './voiceAssistantService';

export interface PipDataPayload {
  direction: 'UP' | 'DOWN' | 'WAIT';
  confidence: number;
  symbol: string;
  durationText: string;
  expirySec: number;
  isChartFound: boolean;
  isStreaming: boolean;
  isPaused: boolean;
  frameCount: number;
  verdictTitle?: string;
  reasonText?: string;
  errorReason?: string;
}

type PipListener = (isActive: boolean) => void;

class PictureInPictureService {
  private isPipActiveState: boolean = false;
  private pipMode: 'DOCUMENT' | 'VIDEO' | 'NONE' = 'NONE';
  private listeners: Set<PipListener> = new Set();

  // Document PiP references (Desktop)
  private docPipWindow: Window | null = null;

  // Video PiP references (Mobile Android & Fallback)
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private video: HTMLVideoElement | null = null;
  private animFrameId: number | null = null;

  // Current State Cache for rendering
  private currentData: PipDataPayload = {
    direction: 'WAIT',
    confidence: 0,
    symbol: 'CHART',
    durationText: '--:--',
    expirySec: 0,
    isChartFound: false,
    isStreaming: false,
    isPaused: false,
    frameCount: 0,
    verdictTitle: 'স্ক্রিন কানেক্ট হচ্ছে...',
    reasonText: 'চার্ট খোঁজা হচ্ছে',
    errorReason: '',
  };

  // Callback hooks for user actions in PiP window
  private onPauseCallback: (() => void) | null = null;
  private onResumeCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private onFocusDisplayCallback: (() => void) | null = null;

  constructor() {
    // Setup video element lazily
  }

  public subscribe(listener: PipListener): () => void {
    this.listeners.add(listener);
    listener(this.isPipActiveState);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.isPipActiveState);
    }
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasDocPip = 'documentPictureInPicture' in window;
    const hasVideoPip = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
    return Boolean(hasDocPip || hasVideoPip);
  }

  public isPipActive(): boolean {
    return this.isPipActiveState;
  }

  public getPipMode(): 'DOCUMENT' | 'VIDEO' | 'NONE' {
    return this.pipMode;
  }

  public setActionCallbacks(callbacks: {
    onPause?: () => void;
    onResume?: () => void;
    onDisconnect?: () => void;
    onFocusDisplay?: () => void;
  }) {
    if (callbacks.onPause) this.onPauseCallback = callbacks.onPause;
    if (callbacks.onResume) this.onResumeCallback = callbacks.onResume;
    if (callbacks.onDisconnect) this.onDisconnectCallback = callbacks.onDisconnect;
    if (callbacks.onFocusDisplay) this.onFocusDisplayCallback = callbacks.onFocusDisplay;
  }

  /**
   * Request system-level floating PiP window over all apps
   */
  public async requestFloatingOverlay(initialData?: Partial<PipDataPayload>): Promise<boolean> {
    if (initialData) {
      this.currentData = { ...this.currentData, ...initialData };
    }

    if (this.isPipActiveState) {
      this.updateData(this.currentData);
      return true;
    }

    // Attempt 1: Document Picture-in-Picture (Available on Desktop Chrome 111+)
    if ('documentPictureInPicture' in window) {
      try {
        const docPip = (window as any).documentPictureInPicture;
        const pipWindow = await docPip.requestWindow({
          width: 360,
          height: 195,
        });

        this.docPipWindow = pipWindow;
        this.pipMode = 'DOCUMENT';
        this.isPipActiveState = true;
        this.renderDocumentPipContent();

        pipWindow.addEventListener('pagehide', () => {
          this.docPipWindow = null;
          this.isPipActiveState = false;
          this.pipMode = 'NONE';
          this.notify();
        });

        this.notify();
        return true;
      } catch (err) {
        console.warn('Document Picture-in-Picture failed, falling back to Video Canvas PiP:', err);
      }
    }

    // Attempt 2: Canvas Video Picture-in-Picture (Mobile Android, Chrome Mobile, Safari, etc.)
    return await this.startVideoPip();
  }

  /**
   * Starts Canvas-based Video Picture-in-Picture (Standard across Android phones and browsers)
   */
  private async startVideoPip(): Promise<boolean> {
    try {
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 540;
        this.canvas.height = 280;
        this.canvasCtx = this.canvas.getContext('2d');
      }

      if (!this.video) {
        this.video = document.createElement('video');
        this.video.muted = true;
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.video.style.position = 'fixed';
        this.video.style.opacity = '0';
        this.video.style.pointerEvents = 'none';
        this.video.style.width = '1px';
        this.video.style.height = '1px';
        document.body.appendChild(this.video);
      }

      // Initial frame render
      this.drawCanvasFrame();

      // Hook canvas stream to video
      if (!this.video.srcObject) {
        const stream = (this.canvas as any).captureStream ? (this.canvas as any).captureStream(30) : null;
        if (!stream) {
          throw new Error('Canvas captureStream is not supported in this environment');
        }
        this.video.srcObject = stream;
        await this.video.play().catch(() => {});
      }

      // Start continuous rendering loop
      this.startCanvasRenderLoop();

      // Request PiP window from OS
      await this.video.requestPictureInPicture();

      this.isPipActiveState = true;
      this.pipMode = 'VIDEO';

      this.video.addEventListener('leavepictureinpicture', () => {
        this.stopCanvasRenderLoop();
        this.isPipActiveState = false;
        this.pipMode = 'NONE';
        this.notify();
      }, { once: true });

      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Video Picture-in-Picture failed:', err);
      this.stopCanvasRenderLoop();
      this.isPipActiveState = false;
      this.pipMode = 'NONE';
      this.notify();
      return false;
    }
  }

  /**
   * Closes any active OS-level floating PiP window
   */
  public async closeFloatingOverlay(): Promise<void> {
    if (this.docPipWindow) {
      try {
        this.docPipWindow.close();
      } catch {}
      this.docPipWindow = null;
    }

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch {}
    }

    this.stopCanvasRenderLoop();
    this.isPipActiveState = false;
    this.pipMode = 'NONE';
    this.notify();
  }

  public async toggleFloatingOverlay(initialData?: Partial<PipDataPayload>): Promise<boolean> {
    if (this.isPipActiveState) {
      await this.closeFloatingOverlay();
      return false;
    } else {
      return await this.requestFloatingOverlay(initialData);
    }
  }

  /**
   * Update real-time HUD data across either Document PiP or Canvas Video PiP
   */
  public updateData(data: Partial<PipDataPayload>) {
    this.currentData = { ...this.currentData, ...data };

    if (!this.isPipActiveState) return;

    if (this.pipMode === 'DOCUMENT' && this.docPipWindow) {
      this.updateDocumentPipDOM();
    }
  }

  /* -------------------------------------------------------------
   * 1. DOCUMENT PICTURE-IN-PICTURE (DESKTOP INTERACTIVE HUD)
   * ------------------------------------------------------------- */
  private renderDocumentPipContent() {
    if (!this.docPipWindow) return;
    const doc = this.docPipWindow.document;

    doc.title = 'TradePulse Live AI HUD';
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.backgroundColor = '#0b0f19';
    doc.body.style.color = '#f1f5f9';
    doc.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    doc.body.style.userSelect = 'none';
    doc.body.style.overflow = 'hidden';

    doc.body.innerHTML = `
      <div id="pip-container" style="display:flex;flex-direction:column;height:100vh;padding:12px 14px;box-sizing:border-box;background:linear-gradient(145deg, #0d1322, #070a12);border:1px solid #1e293b;">
        <!-- Top bar: Logo & Controls -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div id="pip-status-dot" style="width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;"></div>
            <span style="font-size:11px;font-weight:700;letter-spacing:0.5px;color:#94a3b8;text-transform:uppercase;">TRADEPULSE AI HUD</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <button id="pip-voice-btn" style="background:#1e293b;border:1px solid #334155;color:#38bdf8;padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="ভয়েস অন/অফ">🔊</button>
            <button id="pip-pause-btn" style="background:#1e293b;border:1px solid #334155;color:#fbbf24;padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="পজ/চালু">⏸</button>
            <button id="pip-open-btn" style="background:#1e293b;border:1px solid #334155;color:#e2e8f0;padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="পূর্ণ স্ক্রিন দেখুন">⛶</button>
          </div>
        </div>

        <!-- Center: Glowing Signal Badge & Countdown -->
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.85);border-radius:12px;padding:10px 12px;border:1px solid #334155;margin-bottom:8px;" id="pip-signal-card">
          <div>
            <div id="pip-direction-text" style="font-size:17px;font-weight:900;letter-spacing:0.5px;color:#38bdf8;">
              স্ক্রিন কানেক্ট হচ্ছে...
            </div>
            <div id="pip-symbol-text" style="font-size:10px;color:#94a3b8;margin-top:2px;font-family:monospace;">
              OTC CHART • AI স্ক্যানিং
            </div>
          </div>
          <div id="pip-countdown-box" style="display:flex;flex-direction:column;align-items:flex-end;">
            <span style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:600;">ক্যান্ডেল সময়</span>
            <span id="pip-countdown-timer" style="font-size:18px;font-weight:900;font-family:monospace;color:#38bdf8;">--:--</span>
          </div>
        </div>

        <!-- Bottom: Dynamic reason & Status -->
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#94a3b8;border-top:1px solid #1e293b;padding-top:6px;">
          <span id="pip-status-msg" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px;">
            অন্য ব্রোকার স্ক্রিনে গেলেও এটি ভাসমান থাকবে
          </span>
          <span id="pip-conf-badge" style="background:#0369a1;color:#e0f2fe;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:monospace;">
            READY
          </span>
        </div>
      </div>
    `;

    // Hook up buttons in PiP window
    const voiceBtn = doc.getElementById('pip-voice-btn');
    if (voiceBtn) {
      voiceBtn.onclick = () => {
        const next = voiceAssistantService.toggleVoice();
        voiceBtn.textContent = next ? '🔊' : '🔇';
      };
    }

    const pauseBtn = doc.getElementById('pip-pause-btn');
    if (pauseBtn) {
      pauseBtn.onclick = () => {
        if (this.currentData.isPaused) {
          if (this.onResumeCallback) this.onResumeCallback();
          pauseBtn.textContent = '⏸';
        } else {
          if (this.onPauseCallback) this.onPauseCallback();
          pauseBtn.textContent = '▶';
        }
      };
    }

    const openBtn = doc.getElementById('pip-open-btn');
    if (openBtn) {
      openBtn.onclick = () => {
        window.focus();
        if (this.onFocusDisplayCallback) this.onFocusDisplayCallback();
      };
    }

    this.updateDocumentPipDOM();
  }

  private updateDocumentPipDOM() {
    if (!this.docPipWindow) return;
    const doc = this.docPipWindow.document;

    const dirText = doc.getElementById('pip-direction-text');
    const symbolText = doc.getElementById('pip-symbol-text');
    const countdownTimer = doc.getElementById('pip-countdown-timer');
    const statusMsg = doc.getElementById('pip-status-msg');
    const confBadge = doc.getElementById('pip-conf-badge');
    const signalCard = doc.getElementById('pip-signal-card');
    const statusDot = doc.getElementById('pip-status-dot');

    if (!dirText || !signalCard) return;

    const { direction, confidence, symbol, expirySec, isChartFound, isStreaming, isPaused, frameCount, errorReason } = this.currentData;

    const min = Math.floor(expirySec / 60);
    const sec = expirySec % 60;
    const timeFormatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    if (errorReason) {
      dirText.textContent = `⚠️ ত্রুটি: ${errorReason}`;
      dirText.style.color = '#f87171';
      signalCard.style.borderColor = '#991b1b';
      if (countdownTimer) countdownTimer.textContent = '--:--';
      if (statusMsg) statusMsg.textContent = 'চার্ট স্ক্রিন যাচাই করুন';
      if (confBadge) {
        confBadge.textContent = 'ERROR';
        confBadge.style.background = '#7f1d1d';
      }
      return;
    }

    if (isPaused) {
      dirText.textContent = '⏸ সাময়িক স্থগিত (PAUSED)';
      dirText.style.color = '#fbbf24';
      signalCard.style.borderColor = '#d97706';
      if (statusMsg) statusMsg.textContent = 'চালু করতে Resume বাটনে ক্লিক করুন';
      return;
    }

    if (!isChartFound || !isStreaming) {
      dirText.textContent = '⏳ চার্ট খোঁজা হচ্ছে... (WAIT)';
      dirText.style.color = '#fbbf24';
      signalCard.style.borderColor = '#b45309';
      if (countdownTimer) {
        countdownTimer.textContent = '--:--';
        countdownTimer.style.color = '#fbbf24';
      }
      if (symbolText) symbolText.textContent = `ফ্রেম #${frameCount} • ক্যান্ডেলস্টিক ডিটেকশন চালু`;
      if (statusMsg) statusMsg.textContent = 'ব্রোকার অ্যাপে পূর্ণ ক্যান্ডেলস্টিক চার্ট রাখুন';
      if (confBadge) {
        confBadge.textContent = 'SCANNING';
        confBadge.style.background = '#78350f';
      }
      if (statusDot) {
        statusDot.style.background = '#fbbf24';
        statusDot.style.boxShadow = '0 0 8px #fbbf24';
      }
      return;
    }

    // Chart is found and verified!
    if (direction === 'UP') {
      dirText.textContent = '▲ CALL / BUY UP';
      dirText.style.color = '#34d399';
      signalCard.style.borderColor = '#059669';
      signalCard.style.background = 'rgba(6, 78, 59, 0.4)';
      if (statusDot) {
        statusDot.style.background = '#10b981';
        statusDot.style.boxShadow = '0 0 10px #10b981';
      }
      if (confBadge) {
        confBadge.textContent = `${confidence}% কনফিডেন্স`;
        confBadge.style.background = '#065f46';
        confBadge.style.color = '#a7f3d0';
      }
    } else if (direction === 'DOWN') {
      dirText.textContent = '▼ PUT / SELL DOWN';
      dirText.style.color = '#fb7185';
      signalCard.style.borderColor = '#e11d48';
      signalCard.style.background = 'rgba(136, 19, 55, 0.4)';
      if (statusDot) {
        statusDot.style.background = '#f43f5e';
        statusDot.style.boxShadow = '0 0 10px #f43f5e';
      }
      if (confBadge) {
        confBadge.textContent = `${confidence}% কনফিডেন্স`;
        confBadge.style.background = '#881337';
        confBadge.style.color = '#fecdd3';
      }
    } else {
      dirText.textContent = '⏸ মোমেন্টাম পর্যবেক্ষণ (WAIT)';
      dirText.style.color = '#fbbf24';
      signalCard.style.borderColor = '#d97706';
      if (statusDot) {
        statusDot.style.background = '#f59e0b';
        statusDot.style.boxShadow = '0 0 8px #f59e0b';
      }
      if (confBadge) {
        confBadge.textContent = 'ANALYZING';
        confBadge.style.background = '#78350f';
        confBadge.style.color = '#fde68a';
      }
    }

    if (symbolText) {
      symbolText.textContent = `${symbol || 'OTC CHART'} • লাইভ বিশ্লেষণ`;
    }

    if (countdownTimer) {
      countdownTimer.textContent = expirySec > 0 ? timeFormatted : '00:00';
      countdownTimer.style.color = expirySec > 0 && expirySec <= 5 ? '#f43f5e' : '#38bdf8';
    }

    if (statusMsg) {
      statusMsg.textContent = this.currentData.verdictTitle || 'সব অ্যাপের উপরে ভাসমান রয়েছে';
    }
  }

  /* -------------------------------------------------------------
   * 2. CANVAS VIDEO PICTURE-IN-PICTURE (MOBILE ANDROID / UNIVERSAL)
   * ------------------------------------------------------------- */
  private startCanvasRenderLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const loop = () => {
      this.drawCanvasFrame();
      if (this.isPipActiveState && this.pipMode === 'VIDEO') {
        this.animFrameId = requestAnimationFrame(loop);
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopCanvasRenderLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Renders the rich HUD graphics onto HTML5 canvas for Android PiP
   */
  private drawCanvasFrame() {
    if (!this.canvas || !this.canvasCtx) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const { direction, confidence, symbol, expirySec, isChartFound, isStreaming, isPaused, frameCount, errorReason } = this.currentData;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#05070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid pattern
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 30; x < w; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 30; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Top Header
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 44);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(0, 0, w, 44);

    // Brand Label
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.fillText('⚡ TRADEPULSE LIVE AI HUD', 18, 28);

    // Frame counter & Mode badge
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`FRAME #${frameCount} • ALL-SCREEN OVERLAY`, w - 18, 28);
    ctx.textAlign = 'left';

    // Main Card
    const cardY = 56;
    const cardH = 160;
    const cardRadius = 16;

    let strokeColor = '#38bdf8';
    let cardBg = 'rgba(15, 23, 42, 0.9)';
    if (errorReason) {
      strokeColor = '#ef4444';
      cardBg = 'rgba(69, 10, 10, 0.6)';
    } else if (isPaused) {
      strokeColor = '#f59e0b';
    } else if (!isChartFound || !isStreaming) {
      strokeColor = '#f59e0b';
    } else if (direction === 'UP') {
      strokeColor = '#10b981';
      cardBg = 'rgba(6, 78, 59, 0.5)';
    } else if (direction === 'DOWN') {
      strokeColor = '#f43f5e';
      cardBg = 'rgba(136, 19, 55, 0.5)';
    }

    // Card background
    ctx.fillStyle = cardBg;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    this.roundRect(ctx, 16, cardY, w - 32, cardH, cardRadius, true, true);

    // Direction Banner / Signal
    if (errorReason) {
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.fillText('⚠️ চার্ট ত্রুটি', 36, 105);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText(errorReason.slice(0, 42), 36, 140);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText('ব্রোকার স্ক্রিনে ক্যান্ডেলস্টিক চার্ট ওপেন রাখুন', 36, 175);
    } else if (isPaused) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.fillText('⏸ সাময়িক স্থগিত (PAUSED)', 36, 110);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText('চালু করতে ট্রেডপালস অ্যাপে Resume করুন', 36, 150);
    } else if (!isChartFound || !isStreaming) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 24px -apple-system, sans-serif';
      ctx.fillText('⏳ চার্ট খোঁজা হচ্ছে... (WAIT)', 36, 105);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText('স্ক্রিনে চার্ট আসলে স্বয়ংক্রিয় সিগন্যাল আসবে', 36, 140);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '12px monospace';
      ctx.fillText('🚫 সেফগার্ড: চার্ট ছাড়া কোনো ভুল সিগন্যাল দেওয়া হবে না', 36, 175);
    } else {
      // Live UP or DOWN signal!
      if (direction === 'UP') {
        ctx.fillStyle = '#34d399';
        ctx.font = '900 32px -apple-system, monospace';
        ctx.fillText('▲ CALL / BUY', 36, 105);
      } else if (direction === 'DOWN') {
        ctx.fillStyle = '#fb7185';
        ctx.font = '900 32px -apple-system, monospace';
        ctx.fillText('▼ PUT / SELL', 36, 105);
      } else {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 26px -apple-system, sans-serif';
        ctx.fillText('⏸ পর্যবেক্ষণাধীন (WAIT)', 36, 105);
      }

      // Symbol & Confidence
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 15px -apple-system, monospace';
      ctx.fillText(`${symbol || 'OTC ASSET'} • ${confidence}% কনফিডেন্স`, 36, 142);

      // Countdown Timer on right side
      const min = Math.floor(expirySec / 60);
      const sec = expirySec % 60;
      const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText('টাইমার', w - 36, 92);

      ctx.fillStyle = expirySec > 0 && expirySec <= 5 ? '#f43f5e' : '#38bdf8';
      ctx.font = '900 36px monospace';
      ctx.fillText(expirySec > 0 ? timeStr : '00:00', w - 36, 135);

      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.fillText('লাইভ ট্রেডিং মোড', w - 36, 165);
      ctx.textAlign = 'left';
    }

    // Bottom Footer
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, h - 44, w, 44);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText('🔊 ভয়েস সহকারী সক্রিয় • Quotex/Binomo ব্রোকার অ্যাপের উপর সর্বদা ভাসমান', 18, h - 18);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

export const pictureInPictureService = new PictureInPictureService();
