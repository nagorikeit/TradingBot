const DEFAULT_URL = 'https://ais-dev-2mn2ktc74egyugovwwvzoy-634716608323.asia-east1.run.app';

const toggleBtn = document.getElementById('toggleBtn');
const scanNowBtn = document.getElementById('scanNowBtn');
const serverInput = document.getElementById('serverUrl');
const saveUrlBtn = document.getElementById('saveUrlBtn');
const statusMsg = document.getElementById('statusMsg');

chrome.storage.local.get(['tradepulse_backend_url'], (res) => {
  serverInput.value = res.tradepulse_backend_url || DEFAULT_URL;
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

toggleBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TRADEPULSE_GET_STATUS' }, (res) => {
    const nextVisible = res ? !res.visible : true;
    chrome.tabs.sendMessage(tab.id, { type: 'TRADEPULSE_TOGGLE_VISIBILITY', visible: nextVisible }, () => {
      statusMsg.textContent = nextVisible ? '✅ বাবল চালু হয়েছে' : '⏸ বাবল লুকানো হয়েছে';
    });
  });
});

scanNowBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TRADEPULSE_TRIGGER_SCAN' }, () => {
    statusMsg.textContent = '⚡ স্ক্যান শুরু হয়েছে...';
    window.close();
  });
});

saveUrlBtn.addEventListener('click', () => {
  const url = serverInput.value.trim().replace(/\/+$/, '');
  chrome.storage.local.set({ tradepulse_backend_url: url || DEFAULT_URL }, () => {
    statusMsg.textContent = '✅ সার্ভার URL সংরক্ষিত হয়েছে';
  });
});
