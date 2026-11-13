import { liveScreenService } from './liveScreenService';
import { voiceAssistantService } from './voiceAssistantService';

interface DocumentPictureInPictureApi {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
}

class DesktopPipService {
  private pipWindow: Window | null = null;
  private unsubLive: (() => void) | null = null;
  private listeners: Set<(active: boolean) => void> = new Set();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  public isActive(): boolean {
    return Boolean(this.pipWindow && !this.pipWindow.closed);
  }

  public subscribe(fn: (active: boolean) => void): () => void {
    this.listeners.add(fn);
    fn(this.isActive());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const active = this.isActive();
    this.listeners.forEach((fn) => fn(active));
  }

  public close() {
    if (this.unsubLive) {
      this.unsubLive();
      this.unsubLive = null;
    }
    if (this.pipWindow && !this.pipWindow.closed) {
      try {
        this.pipWindow.close();
      } catch {
        // ignore
      }
    }
    this.pipWindow = null;
    this.notify();
  }

  public async openInteractiveBubble(): Promise<{
    ok: boolean;
    reason?: 'UNSUPPORTED' | 'IFRAME_BLOCKED' | 'ERROR';
    message?: string;
  }> {
    if (this.isActive()) {
      this.close();
      return { ok: true };
    }

    if (!this.isSupported()) {
      return {
        ok: false,
        reason: 'UNSUPPORTED',
        message:
          'আপনার বর্তমান ব্রাউজারে Document Picture-in-Picture সাপোর্ট নেই। অনুগ্রহ করে ডেস্কটপ Google Chrome (v116+) বা Microsoft Edge ব্যবহার করুন অথবা নিচে থাকা Chrome এক্সটেনশনটি ব্যবহার করুন।',
      };
    }

    try {
      const api = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureApi })
        .documentPictureInPicture;

      const pipWin = await api.requestWindow({
        width: 325,
        height: 360,
      });

      this.pipWindow = pipWin;
      this.buildPipDocument(pipWin);

      pipWin.addEventListener('pagehide', () => {
        if (this.unsubLive) {
          this.unsubLive();
          this.unsubLive = null;
        }
        this.pipWindow = null;
        this.notify();
      });

      if (this.unsubLive) this.unsubLive();
      this.unsubLive = liveScreenService.subscribe(() => {
        this.renderPipContent();
      });
      this.renderPipContent();
      this.notify();

      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isIframeIssue =
        window.self !== window.top ||
        msg.toLowerCase().includes('top-level') ||
        msg.toLowerCase().includes('disallowed') ||
        msg.toLowerCase().includes('gesture');

      if (isIframeIssue) {
        return {
          ok: false,
          reason: 'IFRAME_BLOCKED',
          message:
            'ব্রাউজার সিকিউরিটির কারণে প্রিভিউ ফ্রেমের ভেতর থেকে Always-on-Top বাবল খোলা যাচ্ছে না। "নতুন ট্যাবে অ্যাপ খুলুন" বাটনে ক্লিক করে সরাসরি ব্রাউজারে খুললে এটি ১০০% কাজ করবে।',
        };
      }

      return {
        ok: false,
        reason: 'ERROR',
        message: 'পিসি ফ্লোটিং বাবল চালু করতে সমস্যা হয়েছে: ' + msg,
      };
    }
  }

  private buildPipDocument(win: Window) {
    const doc = win.document;
    doc.title = 'TradePulse AI — Always-on-Top Bubble';

    const style = doc.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #0b0f19;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 12px;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        user-select: none;
      }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
        border-bottom: 1px solid #1e293b;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 7px;
        font-weight: 800;
        font-size: 13px;
      }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #10b981;
      }
      .dot.busy { background: #22d3ee; animation: pulse 1s infinite; }
      .dot.off { background: #64748b; }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      .top-actions { display: flex; gap: 6px; }
      .mini-btn {
        background: #1e293b;
        border: 1px solid #334155;
        color: #cbd5e1;
        border-radius: 7px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }
      .mini-btn:hover { background: #334155; color: #fff; }
      .hero {
        flex: 1;
        margin: 10px 0;
        padding: 12px;
        border-radius: 14px;
        background: #0f172a;
        border: 1px solid #1e293b;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
      }
      .hero.up { border-color: rgba(16, 185, 129, 0.7); background: rgba(6, 78, 59, 0.25); }
      .hero.down { border-color: rgba(244, 63, 94, 0.7); background: rgba(136, 19, 55, 0.25); }
      .hero.wait { border-color: rgba(245, 158, 11, 0.55); }
      .dir {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: 0.4px;
        margin-bottom: 4px;
      }
      .dir.up { color: #34d399; }
      .dir.down { color: #fb7185; }
      .dir.wait { color: #fbbf24; font-size: 16px; }
      .meta {
        font-size: 11px;
        color: #94a3b8;
        font-family: monospace;
        margin-bottom: 6px;
      }
      .reason {
        font-size: 11px;
        color: #e2e8f0;
        line-height: 1.45;
        max-height: 68px;
        overflow-y: auto;
      }
      .steps {
        display: flex;
        gap: 4px;
        width: 100%;
        margin: 8px 0 4px;
      }
      .step {
        flex: 1;
        height: 4px;
        border-radius: 4px;
        background: #1e293b;
      }
      .step.active { background: #22d3ee; }
      .scan-btn {
        width: 100%;
        padding: 11px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #10b981, #06b6d4);
        color: #020617;
        font-weight: 800;
        font-size: 13px;
        cursor: pointer;
        box-shadow: 0 6px 20px rgba(6, 182, 212, 0.3);
      }
      .scan-btn:hover { filter: brightness(1.06); }
      .scan-btn:disabled { opacity: 0.6; cursor: wait; }
    `;
    doc.head.appendChild(style);

    doc.body.innerHTML = `
      <div class="top">
        <div class="brand">
          <span id="pip-dot" class="dot"></span>
          <span>TradePulse পিসি বাবল</span>
        </div>
        <div class="top-actions">
          <button id="pip-voice" class="mini-btn" title="ভয়েস">🔊</button>
          <button id="pip-close" class="mini-btn" title="বন্ধ করুন">✕</button>
        </div>
      </div>

      <div id="pip-hero" class="hero">
        <div id="pip-dir" class="dir wait">প্রস্তুত</div>
        <div id="pip-meta" class="meta">অন্য ট্যাবে গিয়ে স্ক্যান করুন</div>
        <div id="pip-steps" class="steps" style="display:none;">
          <div class="step" data-step="1"></div>
          <div class="step" data-step="2"></div>
          <div class="step" data-step="3"></div>
          <div class="step" data-step="4"></div>
          <div class="step" data-step="5"></div>
        </div>
        <div id="pip-reason" class="reason"></div>
      </div>

      <button id="pip-scan" class="scan-btn">⚡ ১-ক্লিক স্ক্যান (Scan)</button>
    `;

    const scanBtn = doc.getElementById('pip-scan');
    const voiceBtn = doc.getElementById('pip-voice');
    const closeBtn = doc.getElementById('pip-close');

    scanBtn?.addEventListener('click', async () => {
      const state = liveScreenService.getState();
      if (state !== 'STREAMING' && state !== 'PAUSED') {
        await liveScreenService.connectScreen();
      } else {
        liveScreenService.triggerScanAndLock();
      }
    });

    voiceBtn?.addEventListener('click', () => {
      voiceAssistantService.toggleVoice();
      this.renderPipContent();
    });

    closeBtn?.addEventListener('click', () => {
      this.close();
    });
  }

  private renderPipContent() {
    if (!this.pipWindow || this.pipWindow.closed) return;
    const doc = this.pipWindow.document;

    const state = liveScreenService.getState();
    const isBusy = liveScreenService.isBusy();
    const result = liveScreenService.getLatestResult();
    const scanStep = liveScreenService.getCurrentScanStep();
    const expirySec = liveScreenService.getExpirySecondsLeft();
    const isVoiceOn = voiceAssistantService.isVoiceEnabled();

    const dotEl = doc.getElementById('pip-dot');
    const heroEl = doc.getElementById('pip-hero');
    const dirEl = doc.getElementById('pip-dir');
    const metaEl = doc.getElementById('pip-meta');
    const stepsEl = doc.getElementById('pip-steps');
    const reasonEl = doc.getElementById('pip-reason');
    const scanBtn = doc.getElementById('pip-scan') as HTMLButtonElement | null;
    const voiceBtn = doc.getElementById('pip-voice');

    if (voiceBtn) voiceBtn.textContent = isVoiceOn ? '🔊' : '🔇';

    if (dotEl) {
      dotEl.className = isBusy ? 'dot busy' : state === 'STREAMING' ? 'dot' : 'dot off';
    }

    if (scanBtn) {
      if (state !== 'STREAMING' && state !== 'PAUSED') {
        scanBtn.disabled = false;
        scanBtn.textContent = '🖥️ স্ক্রিন কানেক্ট করুন';
      } else if (isBusy) {
        scanBtn.disabled = true;
        scanBtn.textContent = scanStep ? `⏳ ধাপ ${scanStep.step}/5: ${scanStep.title}` : '⏳ স্ক্যান চলছে...';
      } else {
        scanBtn.disabled = false;
        scanBtn.textContent = '⚡ ১-ক্লিক স্ক্যান (Scan Now)';
      }
    }

    if (stepsEl) {
      if (isBusy && scanStep) {
        stepsEl.style.display = 'flex';
        stepsEl.querySelectorAll('.step').forEach((el) => {
          const s = Number(el.getAttribute('data-step'));
          el.classList.toggle('active', s <= scanStep.step);
        });
      } else {
        stepsEl.style.display = 'none';
      }
    }

    if (heroEl && dirEl && metaEl && reasonEl) {
      if (state !== 'STREAMING' && state !== 'PAUSED') {
        heroEl.className = 'hero';
        dirEl.className = 'dir wait';
        dirEl.textContent = 'স্ক্রিন সংযুক্ত নয়';
        metaEl.textContent = 'নিচের বাটনে ক্লিক করে ট্রেডিং ট্যাব সিলেক্ট করুন';
        reasonEl.textContent = 'একবার সংযোগ করলে অন্য যেকোনো ট্রেডিং ওয়েবসাইটের উপরেও এই বাবল ভেসে থাকবে।';
        return;
      }

      if (isBusy && scanStep) {
        heroEl.className = 'hero';
        dirEl.className = 'dir wait';
        dirEl.textContent = `বিশ্লেষণ: ধাপ ${scanStep.step}/5`;
        metaEl.textContent = scanStep.title;
        reasonEl.textContent = scanStep.subtitle;
        return;
      }

      if (result) {
        const dir = result.direction;
        const conf = result.confidence || 0;
        const sym = result.visionData?.symbol || 'LIVE CHART';
        const countdown = expirySec > 0 ? ` · ${expirySec}s` : '';

        if (dir === 'UP') {
          heroEl.className = 'hero up';
          dirEl.className = 'dir up';
          dirEl.textContent = `▲ CALL (UP) · ${conf}%`;
        } else if (dir === 'DOWN') {
          heroEl.className = 'hero down';
          dirEl.className = 'dir down';
          dirEl.textContent = `▼ PUT (DOWN) · ${conf}%`;
        } else {
          heroEl.className = 'hero wait';
          dirEl.className = 'dir wait';
          dirEl.textContent = '⏸ অপেক্ষা করুন (WAIT)';
        }

        metaEl.textContent = `${sym}${countdown}`;
        reasonEl.textContent = result.reasoning?.[0] || result.verdictTitle || '';
      } else {
        heroEl.className = 'hero';
        dirEl.className = 'dir wait';
        dirEl.textContent = 'স্ক্যান করতে প্রস্তুত';
        metaEl.textContent = 'ট্রেডিং ওয়েবসাইটে গিয়ে নিচের বাটনে ক্লিক করুন';
        reasonEl.textContent = '';
      }
    }
  }
}

export const desktopPipService = new DesktopPipService();
