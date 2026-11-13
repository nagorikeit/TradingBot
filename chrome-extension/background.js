const DEFAULT_BACKEND_URL = 'https://ais-dev-2mn2ktc74egyugovwwvzoy-634716608323.asia-east1.run.app';

async function getBackendBaseUrl() {
  try {
    const data = await chrome.storage.local.get(['tradepulse_backend_url']);
    const url = data.tradepulse_backend_url;
    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      return url.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_BACKEND_URL;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'TRADEPULSE_SCAN_TAB') {
    return false;
  }

  (async () => {
    try {
      const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'jpeg',
        quality: 82,
      });

      if (!dataUrl || !dataUrl.includes(',')) {
        sendResponse({ ok: false, error: 'ট্যাবের স্ক্রিন ক্যাপচার করা যায়নি।' });
        return;
      }

      const imageBase64 = dataUrl.split(',')[1];
      const baseUrl = await getBackendBaseUrl();
      const apiUrl = `${baseUrl}/api/agent/vision/analyze-frame`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt: Date.now(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        sendResponse({
          ok: false,
          error: `সার্ভার ত্রুটি (HTTP ${response.status}): ${errText.slice(0, 120)}`,
        });
        return;
      }

      const json = await response.json();
      sendResponse({ ok: true, data: json.result || json });
    } catch (err) {
      const msg = err && err.name === 'AbortError'
        ? 'সার্ভার রেসপন্স টাইমআউট হয়েছে।'
        : (err && err.message ? err.message : 'অজানা নেটওয়ার্ক ত্রুটি');
      sendResponse({ ok: false, error: msg });
    }
  })();

  return true; // keep async channel open
});
