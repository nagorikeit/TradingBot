import { liveScreenService } from './liveScreenService';
import { voiceAssistantService } from './voiceAssistantService';
import { authService } from './authService';

interface DocumentPictureInPictureApi {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
  window?: Window | null;
}

class DesktopPipService {
  private pipWindow: Window | null = null;
  private unsubLive: (() => void) | null = null;
  private unsubAuth: (() => void) | null = null;
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
    if (this.unsubAuth) {
      this.unsubAuth();
      this.unsubAuth = null;
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
    reason?: 'UNSUPPORTED' | 'IFRAME_BLOCKED' | 'GESTURE_EXPIRED' | 'ERROR';
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
        message: 'কম্পিউটার বাবল Chrome বা Edge ব্রাউজারে চলে।',
      };
    }

    try {
      const api = (window as unknown as { documentPictureInPicture: DocumentPictureInPictureApi })
        .documentPictureInPicture;

      const pipWin = await api.requestWindow({
        width: 345,
        height: 415,
      });

      this.pipWindow = pipWin;
      this.buildPipDocument(pipWin);

      pipWin.addEventListener('pagehide', () => {
        if (this.unsubLive) {
          this.unsubLive();
          this.unsubLive = null;
        }
        if (this.unsubAuth) {
          this.unsubAuth();
          this.unsubAuth = null;
        }
        this.pipWindow = null;
        this.notify();
      });

      if (this.unsubLive) this.unsubLive();
      if (this.unsubAuth) this.unsubAuth();
      this.unsubLive = liveScreenService.subscribe(() => {
        if (liveScreenService.getState() === 'DISCONNECTED') {
          this.close();
          return;
        }
        this.renderPipContent();
      });
      this.unsubAuth = authService.subscribe(() => {
        this.renderPipContent();
      });
      this.renderPipContent();
      this.notify();

      return { ok: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();
      const isIframeIssue =
        window.self !== window.top || lower.includes('top-level') || lower.includes('disallowed');

      if (isIframeIssue) {
        return {
          ok: false,
          reason: 'IFRAME_BLOCKED',
          message: 'প্রিভিউ ফ্রেম থেকে বাবল ব্লক করা হয়েছে। সরাসরি ট্যাবে খুলুন।',
        };
      }

      if (lower.includes('gesture') || lower.includes('activation')) {
        return {
          ok: false,
          reason: 'GESTURE_EXPIRED',
          message: 'অটো-বাবল খোলার জন্য এক ক্লিক করুন।',
        };
      }

      return {
        ok: false,
        reason: 'ERROR',
        message: 'কম্পিউটার বাবল চালু করা যায়নি।',
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
      .audit-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 7px;
      }
      .pill {
        font-size: 10px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid #334155;
        background: #1e293b;
        color: #cbd5e1;
      }
      .pill.ok { border-color: rgba(16,185,129,0.65); background: rgba(16,185,129,0.18); color: #34d399; }
      .pill.warn { border-color: rgba(245,158,11,0.65); background: rgba(245,158,11,0.18); color: #fbbf24; }
      .pill.bad { border-color: rgba(244,63,94,0.65); background: rgba(244,63,94,0.18); color: #fb7185; }
      .reason {
        font-size: 11px;
        color: #e2e8f0;
        line-height: 1.4;
        max-height: 54px;
        overflow-y: auto;
      }
      .steps {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
        width: 100%;
        margin: 6px 0 8px;
      }
      .step {
        padding: 4px 2px;
        border-radius: 6px;
        background: #1e293b;
        border: 1px solid #334155;
        color: #94a3b8;
        font-size: 9px;
        font-weight: 700;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
      }
      .step.active { background: rgba(34, 211, 238, 0.25); border-color: #22d3ee; color: #67e8f9; }
      .step.passed { background: rgba(16, 185, 129, 0.22); border-color: rgba(16, 185, 129, 0.7); color: #34d399; }
      .step.failed { background: rgba(244, 63, 94, 0.14); border-color: rgba(244, 63, 94, 0.45); color: #fda4af; }
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
          <span>TradePulse</span>
        </div>
        <div class="top-actions">
          <button id="pip-voice" class="mini-btn" title="ভয়েস">🔊</button>
          <button id="pip-close" class="mini-btn" title="বন্ধ করুন">✕</button>
        </div>
      </div>

      <div id="pip-hero" class="hero">
        <div id="pip-dir" class="dir wait">প্রস্তুত</div>
        <div id="pip-meta" class="meta">অপেক্ষায়</div>
        <div id="pip-audit" class="audit-row" style="display:none;">
          <span id="pip-points" class="pill">নিশ্চিত: ০/৫</span>
          <span id="pip-candle" class="pill">ক্লোজ: --</span>
        </div>
        <div id="pip-steps" class="steps" style="display:none;">
          <div class="step" data-step="1">১.চার্ট</div>
          <div class="step" data-step="2">২.ক্লোজ</div>
          <div class="step" data-step="3">৩.TF</div>
          <div class="step" data-step="4">৪.ফিল্টার</div>
          <div class="step" data-step="5">৫.স্কোর</div>
        </div>
        <div id="pip-reason" class="reason"></div>
      </div>

      <button id="pip-scan" class="scan-btn">⚡ স্ক্যান</button>
    `;

    const scanBtn = doc.getElementById('pip-scan');
    const voiceBtn = doc.getElementById('pip-voice');
    const closeBtn = doc.getElementById('pip-close');

    scanBtn?.addEventListener('click', async () => {
      const quota = authService.getScanQuotaStatus();
      if (!quota.canScan) {
        authService.requestUpgradeModal(quota.blockReasonBn);
        this.renderPipContent();
        return;
      }
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
    const quota = authService.getScanQuotaStatus();

    const quotaBadge =
      quota.mode === 'ADMIN'
        ? 'ADMIN · ∞'
        : quota.mode === 'FREE_TRIAL'
        ? `ফ্রি বাকি: ${quota.freeRemaining}/${quota.freeLimit}`
        : quota.mode === 'PAID'
        ? quota.dailyLimit === 0
          ? `VIP (${quota.daysRemaining}d) · ∞`
          : `আজ বাকি: ${quota.dailyRemaining}/${quota.dailyLimit}`
        : '🔒 লিমিট শেষ';

    const dotEl = doc.getElementById('pip-dot');
    const heroEl = doc.getElementById('pip-hero');
    const dirEl = doc.getElementById('pip-dir');
    const metaEl = doc.getElementById('pip-meta');
    const auditEl = doc.getElementById('pip-audit');
    const pointsEl = doc.getElementById('pip-points');
    const candleEl = doc.getElementById('pip-candle');
    const stepsEl = doc.getElementById('pip-steps');
    const reasonEl = doc.getElementById('pip-reason');
    const scanBtn = doc.getElementById('pip-scan') as HTMLButtonElement | null;
    const voiceBtn = doc.getElementById('pip-voice');

    if (voiceBtn) voiceBtn.textContent = isVoiceOn ? '🔊' : '🔇';

    if (dotEl) {
      dotEl.className = isBusy ? 'dot busy' : state === 'STREAMING' ? 'dot' : 'dot off';
    }

    if (scanBtn) {
      if (!quota.canScan) {
        scanBtn.disabled = false;
        scanBtn.textContent = '🔒 আপগ্রেড করুন';
      } else if (state !== 'STREAMING' && state !== 'PAUSED') {
        scanBtn.disabled = false;
        scanBtn.textContent = 'স্ক্রিন কানেক্ট';
      } else if (isBusy || scanStep) {
        scanBtn.disabled = true;
        scanBtn.textContent = scanStep ? `⏳ ধাপ ${scanStep.step}/5` : '⏳ স্ক্যান...';
      } else {
        scanBtn.disabled = false;
        scanBtn.textContent = '⚡ স্ক্যান';
      }
    }

    const flow = result?.signalFlow;
    const stepChecks = flow?.stepChecks;
    const hasChartResult = Boolean(result && result.visionData?.isClearTradingChart);

    if (stepsEl) {
      if ((isBusy || scanStep) && scanStep) {
        stepsEl.style.display = 'grid';
        stepsEl.querySelectorAll('.step').forEach((el) => {
          const s = Number(el.getAttribute('data-step'));
          el.classList.remove('passed', 'failed');
          el.classList.toggle('active', s <= scanStep.step);
        });
      } else if (hasChartResult && stepChecks && stepChecks.length === 5) {
        stepsEl.style.display = 'grid';
        stepsEl.querySelectorAll('.step').forEach((el) => {
          const s = Number(el.getAttribute('data-step'));
          const item = stepChecks[s - 1];
          el.classList.remove('active');
          el.classList.toggle('passed', Boolean(item?.passed));
          el.classList.toggle('failed', !item?.passed);
        });
      } else {
        stepsEl.style.display = 'none';
      }
    }

    if (auditEl && pointsEl && candleEl) {
      if (!isBusy && !scanStep && hasChartResult && result) {
        const pts =
          typeof flow?.confirmedPoints === 'number'
            ? flow.confirmedPoints
            : typeof result.visionData?.confirmedPoints === 'number'
            ? result.visionData.confirmedPoints
            : stepChecks
            ? stepChecks.filter((s) => s.passed).length
            : result.direction !== 'WAIT'
            ? 5
            : 2;

        const closedColor =
          result.visionData?.closedCandleColor ||
          (flow?.candleData?.closedCandle?.type === 'BULLISH'
            ? 'GREEN'
            : flow?.candleData?.closedCandle?.type === 'BEARISH'
            ? 'RED'
            : flow?.candleData?.closedCandle?.type === 'DOJI'
            ? 'DOJI'
            : 'UNCERTAIN');

        const candleShort =
          closedColor === 'GREEN'
            ? 'ক্লোজ: সবুজ'
            : closedColor === 'RED'
            ? 'ক্লোজ: লাল'
            : closedColor === 'DOJI'
            ? 'ক্লোজ: ডোজি'
            : 'ক্লোজ: অস্পষ্ট';

        auditEl.style.display = 'flex';
        pointsEl.textContent = `পয়েন্ট: ${pts}/৫`;
        pointsEl.className = `pill ${pts >= 4 ? 'ok' : pts === 3 ? 'warn' : 'bad'}`;
        candleEl.textContent = candleShort;
        candleEl.className = `pill ${
          closedColor === 'GREEN' ? 'ok' : closedColor === 'RED' ? 'bad' : 'warn'
        }`;
      } else {
        auditEl.style.display = 'none';
      }
    }

    if (heroEl && dirEl && metaEl && reasonEl) {
      if (!quota.canScan) {
        heroEl.className = 'hero wait';
        dirEl.className = 'dir wait';
        dirEl.textContent = 'লিমিট শেষ';
        metaEl.textContent = quotaBadge;
        reasonEl.textContent = '';
        return;
      }

      if (state !== 'STREAMING' && state !== 'PAUSED') {
        heroEl.className = 'hero';
        dirEl.className = 'dir wait';
        dirEl.textContent = 'সংযুক্ত নয়';
        metaEl.textContent = quotaBadge;
        reasonEl.textContent = '';
        return;
      }

      if ((isBusy || scanStep) && scanStep) {
        heroEl.className = 'hero';
        dirEl.className = 'dir wait';
        dirEl.textContent = `ধাপ ${scanStep.step}/5`;
        metaEl.textContent = scanStep.title;
        reasonEl.textContent = '';
        return;
      }

      if (result) {
        const dir = result.direction;
        const conf = result.confidence || 0;
        const sym = result.visionData?.symbol || 'CHART';
        const countdown = expirySec > 0 ? ` · ${expirySec}s` : '';

        if (dir === 'UP') {
          heroEl.className = 'hero up';
          dirEl.className = 'dir up';
          dirEl.textContent = `▲ CALL · ${conf}%`;
        } else if (dir === 'DOWN') {
          heroEl.className = 'hero down';
          dirEl.className = 'dir down';
          dirEl.textContent = `▼ PUT · ${conf}%`;
        } else {
          heroEl.className = 'hero wait';
          dirEl.className = 'dir wait';
          dirEl.textContent = '⏸ WAIT';
        }

        metaEl.textContent = `${sym}${countdown}`;
        reasonEl.textContent = result.visionData?.candlestickPattern || result.reasoning?.[0] || '';
      } else {
        heroEl.className = 'hero';
        dirEl.className = 'dir wait';
        dirEl.textContent = 'প্রস্তুত';
        metaEl.textContent = quotaBadge;
        reasonEl.textContent = '';
      }
    }
  }
}

export const desktopPipService = new DesktopPipService();
