(() => {
  if (window.__tradepulseBubbleInjected) return;
  window.__tradepulseBubbleInjected = true;

  const AUTO_TRADING_HOSTS = [
    'quotex', 'qxbroker', 'pocketoption', 'po.trade', 'olymptrade',
    'binomo', 'iqoption', 'expertoption', 'deriv', 'tradingview', 'binance'
  ];

  const host = window.location.hostname.toLowerCase();
  const isKnownTradingHost = AUTO_TRADING_HOSTS.some((h) => host.includes(h));

  let isVisible = isKnownTradingHost;
  let isCollapsed = false;
  let isScanning = false;
  let voiceEnabled = true;
  let currentStep = 0;

  // Create Shadow DOM host
  const rootHost = document.createElement('div');
  rootHost.id = 'tradepulse-ext-root';
  rootHost.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  document.documentElement.appendChild(rootHost);

  const shadow = rootHost.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .card {
      width: 290px;
      background: rgba(15, 23, 42, 0.96);
      border: 1px solid rgba(51, 65, 85, 0.9);
      border-radius: 16px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65);
      color: #f8fafc;
      padding: 12px;
      backdrop-filter: blur(12px);
      user-select: none;
      transition: border-color 0.25s ease;
    }
    .card.up { border-color: rgba(16, 185, 129, 0.85); box-shadow: 0 0 28px rgba(16, 185, 129, 0.25); }
    .card.down { border-color: rgba(244, 63, 94, 0.85); box-shadow: 0 0 28px rgba(244, 63, 94, 0.25); }
    .card.wait { border-color: rgba(245, 158, 11, 0.8); }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(51, 65, 85, 0.6);
      margin-bottom: 10px;
    }
    .header:active { cursor: grabbing; }
    .brand { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 13px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
    .controls { display: flex; gap: 4px; }
    .icon-btn {
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(71, 85, 105, 0.6);
      color: #cbd5e1;
      border-radius: 7px;
      padding: 3px 7px;
      font-size: 11px;
      cursor: pointer;
    }
    .icon-btn:hover { background: rgba(51, 65, 85, 0.9); color: #fff; }
    .signal-box {
      background: rgba(2, 6, 23, 0.75);
      border: 1px solid rgba(51, 65, 85, 0.6);
      border-radius: 12px;
      padding: 10px;
      margin-bottom: 10px;
      text-align: center;
    }
    .direction { font-size: 20px; font-weight: 800; letter-spacing: 0.4px; }
    .direction.up { color: #34d399; }
    .direction.down { color: #fb7185; }
    .direction.wait { color: #fbbf24; font-size: 15px; }
    .meta { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .reason { font-size: 11px; color: #cbd5e1; margin-top: 6px; line-height: 1.4; }
    .steps { display: flex; gap: 4px; margin: 8px 0; }
    .step { flex: 1; height: 4px; border-radius: 4px; background: rgba(51, 65, 85, 0.8); }
    .step.active { background: #22d3ee; }
    .scan-btn {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 11px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      color: #020617;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .scan-btn:disabled { opacity: 0.6; cursor: wait; }
    .orb {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #0891b2);
      color: #020617;
      font-weight: 800;
      font-size: 12px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      box-shadow: 0 10px 30px rgba(6, 182, 212, 0.45);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hidden { display: none !important; }
  `;

  const container = document.createElement('div');
  container.innerHTML = `
    <button id="tp-orb" class="orb hidden" title="TradePulse খুলুন">TP AI</button>
    <div id="tp-card" class="card">
      <div id="tp-drag" class="header">
        <div class="brand">
          <span class="dot"></span>
          <span>TradePulse AI</span>
        </div>
        <div class="controls">
          <button id="tp-voice" class="icon-btn" title="ভয়েস অন/অফ">🔊</button>
          <button id="tp-min" class="icon-btn" title="মিনিমাইজ">−</button>
          <button id="tp-close" class="icon-btn" title="লুকান">✕</button>
        </div>
      </div>

      <div class="signal-box">
        <div id="tp-dir" class="direction wait">স্ক্যান করতে প্রস্তুত</div>
        <div id="tp-meta" class="meta">চার্ট খুলে নিচে ক্লিক করুন</div>
        <div id="tp-steps" class="steps hidden">
          <div class="step" data-s="1"></div>
          <div class="step" data-s="2"></div>
          <div class="step" data-s="3"></div>
          <div class="step" data-s="4"></div>
          <div class="step" data-s="5"></div>
        </div>
        <div id="tp-reason" class="reason"></div>
      </div>

      <button id="tp-scan" class="scan-btn">⚡ ১-ক্লিক স্ক্যান (Scan)</button>
    </div>
  `;

  shadow.appendChild(styleEl);
  shadow.appendChild(container);

  const cardEl = shadow.getElementById('tp-card');
  const orbEl = shadow.getElementById('tp-orb');
  const dragEl = shadow.getElementById('tp-drag');
  const dirEl = shadow.getElementById('tp-dir');
  const metaEl = shadow.getElementById('tp-meta');
  const reasonEl = shadow.getElementById('tp-reason');
  const stepsEl = shadow.getElementById('tp-steps');
  const scanBtn = shadow.getElementById('tp-scan');
  const voiceBtn = shadow.getElementById('tp-voice');
  const minBtn = shadow.getElementById('tp-min');
  const closeBtn = shadow.getElementById('tp-close');

  function speakBn(text) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'bn-BD';
      utter.rate = 1.05;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore speech errors
    }
  }

  function applyVisibility() {
    if (!isVisible) {
      rootHost.classList.add('hidden');
      cardEl.classList.add('hidden');
      orbEl.classList.add('hidden');
      return;
    }
    rootHost.classList.remove('hidden');
    if (isCollapsed) {
      cardEl.classList.add('hidden');
      orbEl.classList.remove('hidden');
    } else {
      cardEl.classList.remove('hidden');
      orbEl.classList.add('hidden');
    }
  }

  // Load saved visibility override for this host
  chrome.storage.local.get(['tp_host_' + host, 'tp_pos'], (res) => {
    const savedVis = res['tp_host_' + host];
    if (typeof savedVis === 'boolean') {
      isVisible = savedVis;
    }
    if (res.tp_pos && typeof res.tp_pos.left === 'number' && typeof res.tp_pos.top === 'number') {
      rootHost.style.bottom = 'auto';
      rootHost.style.right = 'auto';
      rootHost.style.left = Math.min(window.innerWidth - 70, Math.max(8, res.tp_pos.left)) + 'px';
      rootHost.style.top = Math.min(window.innerHeight - 70, Math.max(8, res.tp_pos.top)) + 'px';
    }
    applyVisibility();
  });

  // Listen to messages from popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'TRADEPULSE_TOGGLE_VISIBILITY') {
      isVisible = Boolean(msg.visible);
      chrome.storage.local.set({ ['tp_host_' + host]: isVisible });
      applyVisibility();
      sendResponse({ ok: true, visible: isVisible });
    } else if (msg && msg.type === 'TRADEPULSE_TRIGGER_SCAN') {
      if (!isVisible) {
        isVisible = true;
        applyVisibility();
      }
      isCollapsed = false;
      applyVisibility();
      runScan();
      sendResponse({ ok: true });
    } else if (msg && msg.type === 'TRADEPULSE_GET_STATUS') {
      sendResponse({ visible: isVisible, host });
    }
  });

  // Dragging logic
  let dragging = false;
  let startX = 0, startY = 0, initLeft = 0, initTop = 0;

  function onPointerDown(e) {
    if (e.target.closest('button') && e.target !== orbEl) return;
    dragging = true;
    const rect = rootHost.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    initLeft = rect.left;
    initTop = rect.top;
    rootHost.style.bottom = 'auto';
    rootHost.style.right = 'auto';
    rootHost.style.left = initLeft + 'px';
    rootHost.style.top = initTop + 'px';
  }

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const nextLeft = Math.min(window.innerWidth - 65, Math.max(8, initLeft + dx));
    const nextTop = Math.min(window.innerHeight - 65, Math.max(8, initTop + dy));
    rootHost.style.left = nextLeft + 'px';
    rootHost.style.top = nextTop + 'px';
  });

  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    const rect = rootHost.getBoundingClientRect();
    chrome.storage.local.set({ tp_pos: { left: rect.left, top: rect.top } });
  });

  dragEl.addEventListener('pointerdown', onPointerDown);
  orbEl.addEventListener('pointerdown', onPointerDown);

  orbEl.addEventListener('click', () => {
    isCollapsed = false;
    applyVisibility();
  });

  minBtn.addEventListener('click', () => {
    isCollapsed = true;
    applyVisibility();
  });

  closeBtn.addEventListener('click', () => {
    isVisible = false;
    chrome.storage.local.set({ ['tp_host_' + host]: false });
    applyVisibility();
  });

  voiceBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceBtn.textContent = voiceEnabled ? '🔊' : '🔇';
  });

  async function runScan() {
    if (isScanning) return;
    isScanning = true;
    scanBtn.disabled = true;
    scanBtn.textContent = '⏳ বিশ্লেষণ চলছে...';
    stepsEl.classList.remove('hidden');
    cardEl.className = 'card';
    dirEl.className = 'direction wait';
    dirEl.textContent = '৫-ধাপ এনালাইসিস চলছে...';
    metaEl.textContent = 'চার্ট ক্যাপচার ও ক্যান্ডেল যাচাই করা হচ্ছে';
    reasonEl.textContent = '';

    currentStep = 1;
    const stepTimer = setInterval(() => {
      if (currentStep < 5) currentStep++;
      shadow.querySelectorAll('.step').forEach((el) => {
        const s = Number(el.getAttribute('data-s'));
        el.classList.toggle('active', s <= currentStep);
      });
    }, 550);

    chrome.runtime.sendMessage({ type: 'TRADEPULSE_SCAN_TAB' }, (res) => {
      clearInterval(stepTimer);
      isScanning = false;
      scanBtn.disabled = false;
      scanBtn.textContent = '⚡ ১-ক্লিক স্ক্যান (Scan)';
      stepsEl.classList.add('hidden');

      if (!res || !res.ok || !res.data) {
        dirEl.className = 'direction wait';
        dirEl.textContent = 'স্ক্যান ব্যর্থ';
        metaEl.textContent = res && res.error ? res.error : 'সার্ভারের সাথে সংযোগ হয়নি';
        return;
      }

      const data = res.data;
      const vision = data.visionData || data;
      const dir = (data.direction || vision.direction || 'WAIT').toUpperCase();
      const conf = Number(data.confidence || vision.confidence || 0);
      const symbol = vision.symbol || data.symbol || 'LIVE CHART';
      const reasoning = Array.isArray(data.reasoning) && data.reasoning.length > 0
        ? data.reasoning[0]
        : (data.verdictTitle || vision.summaryBn || '');

      if (dir === 'UP' || dir === 'CALL') {
        cardEl.className = 'card up';
        dirEl.className = 'direction up';
        dirEl.textContent = `▲ CALL (UP) · ${conf}%`;
        speakBn(`সিগন্যাল আপ, অর্থাৎ কল। কনফিডেন্স ${conf} শতাংশ।`);
      } else if (dir === 'DOWN' || dir === 'PUT') {
        cardEl.className = 'card down';
        dirEl.className = 'direction down';
        dirEl.textContent = `▼ PUT (DOWN) · ${conf}%`;
        speakBn(`সিগন্যাল ডাউন, অর্থাৎ পুট। কনফিডেন্স ${conf} শতাংশ।`);
      } else {
        cardEl.className = 'card wait';
        dirEl.className = 'direction wait';
        dirEl.textContent = '⏸ অপেক্ষা করুন (WAIT)';
        speakBn('এখন নিরাপদ এন্ট্রি নেই, অনুগ্রহ করে অপেক্ষা করুন।');
      }

      metaEl.textContent = `${symbol} · ${new Date().toLocaleTimeString()}`;
      reasonEl.textContent = reasoning.slice(0, 140);
    });
  }

  scanBtn.addEventListener('click', runScan);
})();
