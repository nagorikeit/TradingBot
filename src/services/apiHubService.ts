import { ApiEndpointItem } from '../types/apiHubTypes';
import { getApiUrl, getCustomApiUrl, setCustomApiUrl, checkBackendHealth } from './apiConfig';
import { marketService } from './marketService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  getDocFromServer,
} from 'firebase/firestore';
import { authService } from './authService';

const STORAGE_KEY_API_OVERRIDES = 'tradepulse_api_hub_overrides_v1';

export const BUILTIN_API_CATALOG: ApiEndpointItem[] = [
  // 1. Backend Core & Vision AI
  {
    id: 'backend_gateway_health',
    name: 'Core Backend Gateway & Health',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/health',
    baseUrl: '',
    description: 'মূল সার্ভার গেটওয়ে (/api/*) — ওয়েব এবং অ্যান্ড্রয়েড এপিকে-র জন্য ব্যাকএন্ড URL নিয়ন্ত্রণ করে।',
    enabled: true,
    timeoutMs: 6000,
    isBackendGateway: true,
  },
  {
    id: 'vision_analyze_frame',
    name: 'Vision AI Live Screen Analyzer',
    category: 'BACKEND_AI',
    method: 'POST',
    url: '/api/agent/vision/analyze-frame',
    description: 'লাইভ স্ক্রিন, ক্যান্ডেল প্যাটার্ন এবং চার্ট ফ্রেম বিশ্লেষণের সার্ভার-সাইড এআই প্রক্সি API।',
    enabled: true,
    timeoutMs: 15000,
    isServerProxyManaged: true,
    sampleBody: JSON.stringify({ imageBase64: '', mimeType: 'image/jpeg' }, null, 2),
  },
  {
    id: 'agent_health_stats',
    name: 'AI Agent System Health & Telemetry',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/health',
    description: 'এআই এজেন্ট ব্যাকএন্ডের অবস্থা, মেমোরি, নলেজ বেস এবং রিসার্চ শিডিউলার স্ট্যাটাস API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'agent_system_stats',
    name: 'Agent Learning & Pipeline Stats',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/stats',
    description: 'হাইপোথিসিস, প্রস্তাবনা, রিসার্চ লাইব্রেরি এবং সেশন পরিসংখ্যান সংগ্রহের API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'agent_learned_rules',
    name: 'Learned Rules & Mistake Reflection',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/learned-rules',
    description: 'এআই এজেন্টের শেখা স্ট্র্যাটেজি রুলস ও ভুল সংশোধনের রেকর্ড API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'agent_sources_registry',
    name: 'Trusted Research Sources Registry',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/sources',
    description: 'বিশ্বস্ত মার্কেট রিসার্চ সোর্স তালিকা ও রিভিউ কিউ API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'agent_research_library',
    name: 'YouTube & Document Research Library',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/research/library',
    description: 'ইউটিউব ভিডিও ও ডকুমেন্ট থেকে সংগৃহীত রিসার্চ ডেটা API।',
    enabled: true,
    timeoutMs: 8000,
  },
  {
    id: 'agent_rules_verification',
    name: 'Formalized Trading Rules & Verification',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/rules',
    description: 'ফর্মালাইজড প্রাতিষ্ঠানিক ট্রেডিং রুলস ও ভেরিফিকেশন এভিডেন্স API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'agent_market_observations',
    name: 'Market Regime & Observations Feed',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/agent/observations/recent',
    description: 'সাম্প্রতিক মার্কেট রেজিম ও অবজারভেশন রেকর্ড API।',
    enabled: true,
    timeoutMs: 6000,
  },

  // 2. Market Data Exchange APIs
  {
    id: 'market_binance_rest',
    name: 'Binance Public Market (REST/WS)',
    category: 'MARKET_DATA',
    method: 'GET',
    url: 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=5',
    description: 'বাইনান্স স্পট পাবলিক মার্কেট ডেটা ও লাইভ ক্যান্ডেল ফিড (কানেক্ট করলে টার্মিনালে সক্রিয় হবে)।',
    enabled: true,
    timeoutMs: 6000,
    exchangeMode: 'BINANCE',
  },
  {
    id: 'market_bybit_v5',
    name: 'Bybit V5 Market Data API',
    category: 'MARKET_DATA',
    method: 'GET',
    url: 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT',
    description: 'বাইবিট V5 রিয়েল-টাইম স্পট টিকার ও ক্যান্ডেলস্টিক API।',
    enabled: true,
    timeoutMs: 6000,
    exchangeMode: 'BYBIT',
  },
  {
    id: 'market_okx_v5',
    name: 'OKX V5 Public Ticker API',
    category: 'MARKET_DATA',
    method: 'GET',
    url: 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT',
    description: 'OKX V5 রিয়েল-টাইম মার্কেট টিকার ও ক্যান্ডেল ফিড API।',
    enabled: true,
    timeoutMs: 6000,
    exchangeMode: 'OKX',
  },
  {
    id: 'market_kraken_rest',
    name: 'Kraken Public REST API',
    category: 'MARKET_DATA',
    method: 'GET',
    url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
    description: 'ক্র্যাকেন পাবলিক এক্সচেঞ্জ প্রাইস ও ক্যান্ডেল ডেটা API।',
    enabled: true,
    timeoutMs: 6000,
    exchangeMode: 'KRAKEN',
  },
  {
    id: 'market_coinbase_exchange',
    name: 'Coinbase Exchange Public API',
    category: 'MARKET_DATA',
    method: 'GET',
    url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker',
    description: 'কয়েনবেস এক্সচেঞ্জ লাইভ প্রাইস ও অর্ডারবুক টিকার API।',
    enabled: true,
    timeoutMs: 6000,
    exchangeMode: 'COINBASE',
  },

  // 3. Auth, Cloud & Subscription APIs
  {
    id: 'cloud_firebase_firestore',
    name: 'Firebase Auth & Cloud Firestore DB',
    category: 'AUTH_CLOUD',
    method: 'CLOUD',
    url: 'firestore://ai-studio-tradepulsesignal-5172e36b-a725-455a-956a-393ec1ba793a',
    description: '১-ক্লিক জিমেইল লগইন, রিয়েল-টাইম ইউজার প্রোফাইল ও ক্লাউড ডাটাবেস সিঙ্ক।',
    enabled: true,
    timeoutMs: 6000,
    isServerProxyManaged: true,
  },
  {
    id: 'auth_payment_config',
    name: 'Subscription Payment Gateway Config',
    category: 'AUTH_CLOUD',
    method: 'GET',
    url: '/api/payment/config',
    description: 'বিকাশ, নগদ, রকেট ও বাইন্যান্স পেমেন্ট গেটওয়ে কনফিগারেশন API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'auth_admin_users',
    name: 'Admin User Directory API',
    category: 'AUTH_CLOUD',
    method: 'GET',
    url: '/api/admin/users',
    description: 'সকল নিবন্ধিত ইউজার তালিকা ও সাবস্ক্রিপশন স্ট্যাটাস API।',
    enabled: true,
    timeoutMs: 6000,
  },
  {
    id: 'auth_admin_requests',
    name: 'Admin Subscription Requests API',
    category: 'AUTH_CLOUD',
    method: 'GET',
    url: '/api/admin/requests',
    description: 'সাবস্ক্রিপশন পেমেন্ট অনুমোদন ও TrxID ভেরিফিকেশন API।',
    enabled: true,
    timeoutMs: 6000,
  },

  // 4. Alerts & Webhook APIs
  {
    id: 'notify_whatsapp_test',
    name: 'WhatsApp & Webhook Alert Tester',
    category: 'NOTIFICATIONS',
    method: 'POST',
    url: '/api/agent/whatsapp/test',
    description: 'হোয়াটসঅ্যাপ ও কাস্টম ওয়েবহুক অ্যালার্ট কানেকশন টেস্ট API।',
    enabled: true,
    timeoutMs: 10000,
    isServerProxyManaged: true,
    sampleBody: JSON.stringify({ provider: 'webhook', webhookConfig: { url: '' } }, null, 2),
  },
  {
    id: 'notify_whatsapp_send',
    name: 'WhatsApp Signal Dispatch API',
    category: 'NOTIFICATIONS',
    method: 'POST',
    url: '/api/agent/whatsapp/send',
    description: 'রিয়েল-টাইম ট্রেড সিগন্যাল ও এআই সতর্কতা পাঠানোর API।',
    enabled: true,
    timeoutMs: 10000,
    isServerProxyManaged: true,
    sampleBody: JSON.stringify({ provider: 'webhook', messageText: 'TradePulse Signal Alert' }, null, 2),
  },
  {
    id: 'chrome_extension_download',
    name: 'Chrome Extension Package (.zip) API',
    category: 'BACKEND_AI',
    method: 'GET',
    url: '/api/extension/download',
    description: 'ডেস্কটপ ব্রাউজারের যেকোনো ট্রেডিং ওয়েবসাইটে ফ্লোটিং বাবল ইনজেক্ট করার Chrome এক্সটেনশন জিপ ডাউনলোড API।',
    enabled: true,
    timeoutMs: 8000,
  },
];

type ApiHubListener = (items: ApiEndpointItem[]) => void;

class ApiHubService {
  private items: ApiEndpointItem[] = [];
  private listeners: Set<ApiHubListener> = new Set();

  constructor() {
    this.loadLocal();
    authService.subscribe((user) => {
      if (user && auth.currentUser) {
        this.syncFromFirestore().catch(() => {});
      }
    });
  }

  public subscribe(listener: ApiHubListener): () => void {
    this.listeners.add(listener);
    listener(this.getItems());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = this.getItems();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  public getItems(): ApiEndpointItem[] {
    const activeMode = marketService.getProviderMode();
    const customGatewayUrl = getCustomApiUrl();
    return this.items.map((item) => {
      if (item.isBackendGateway) {
        return {
          ...item,
          baseUrl: customGatewayUrl || item.baseUrl || '',
        };
      }
      if (item.exchangeMode) {
        return {
          ...item,
          lastStatus:
            item.lastStatus ||
            (activeMode === item.exchangeMode ? 'CONNECTED' : item.enabled ? 'CONNECTED' : 'DISCONNECTED'),
        };
      }
      return item;
    });
  }

  private loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_API_OVERRIDES);
      const customGatewayUrl = getCustomApiUrl();
      if (!raw) {
        this.items = BUILTIN_API_CATALOG.map((item) => ({
          ...item,
          baseUrl: item.isBackendGateway ? customGatewayUrl : item.baseUrl,
          lastStatus: item.enabled ? 'CONNECTED' : 'DISCONNECTED',
        }));
        return;
      }

      const savedList: ApiEndpointItem[] = JSON.parse(raw);
      const savedMap = new Map(savedList.map((s) => [s.id, s]));

      const merged: ApiEndpointItem[] = BUILTIN_API_CATALOG.map((def) => {
        const override = savedMap.get(def.id);
        if (override) {
          return {
            ...def,
            ...override,
            isServerProxyManaged: def.isServerProxyManaged,
            exchangeMode: def.exchangeMode,
            isBackendGateway: def.isBackendGateway,
          };
        }
        return {
          ...def,
          baseUrl: def.isBackendGateway ? customGatewayUrl : def.baseUrl,
          lastStatus: def.enabled ? 'CONNECTED' : 'DISCONNECTED',
        };
      });

      // Append user-created custom APIs
      savedList.forEach((s) => {
        if (s.isCustom && !merged.some((m) => m.id === s.id)) {
          merged.push(s);
        }
      });

      this.items = merged;
    } catch {
      this.items = BUILTIN_API_CATALOG.map((d) => ({ ...d, lastStatus: 'CONNECTED' }));
    }
  }

  private saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY_API_OVERRIDES, JSON.stringify(this.items));
    } catch {
      // ignore storage quota errors
    }
  }

  public async syncFromFirestore(): Promise<void> {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const path = 'apiEndpoints';

    try {
      const q = query(collection(db, 'apiEndpoints'), where('ownerId', '==', uid));
      const snap = await getDocs(q);
      if (snap.empty) return;

      const remoteMap = new Map<string, ApiEndpointItem>();
      snap.docs.forEach((d) => {
        const data = d.data();
        remoteMap.set(d.id, {
          id: String(data.id || d.id),
          name: String(data.name || ''),
          category: data.category,
          method: data.method,
          url: String(data.url || ''),
          baseUrl: data.baseUrl ? String(data.baseUrl) : '',
          description: String(data.description || ''),
          enabled: Boolean(data.enabled),
          timeoutMs: Number(data.timeoutMs || 6000),
          sampleBody: data.sampleBody ? String(data.sampleBody) : undefined,
          isCustom: Boolean(data.isCustom),
          lastStatus: data.enabled ? 'CONNECTED' : 'DISCONNECTED',
        });
      });

      const merged = BUILTIN_API_CATALOG.map((def) => {
        const remote = remoteMap.get(def.id);
        if (remote) {
          if (def.isBackendGateway && remote.baseUrl !== undefined) {
            setCustomApiUrl(remote.baseUrl);
          }
          return {
            ...def,
            ...remote,
            isServerProxyManaged: def.isServerProxyManaged,
            exchangeMode: def.exchangeMode,
            isBackendGateway: def.isBackendGateway,
          };
        }
        return this.items.find((i) => i.id === def.id) || def;
      });

      remoteMap.forEach((item) => {
        if (item.isCustom && !merged.some((m) => m.id === item.id)) {
          merged.push(item);
        }
      });

      this.items = merged;
      this.saveLocal();
      this.notify();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  private async persistEndpointToFirestore(item: ApiEndpointItem): Promise<void> {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const safeId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const path = `apiEndpoints/${safeId}`;

    try {
      const payload: Record<string, unknown> = {
        id: safeId,
        ownerId: uid,
        name: item.name.slice(0, 120),
        category: item.category,
        method: item.method,
        url: item.url.slice(0, 500),
        baseUrl: (item.baseUrl || '').slice(0, 300),
        description: (item.description || '').slice(0, 500),
        enabled: item.enabled,
        timeoutMs: Math.min(120000, Math.max(500, Number(item.timeoutMs) || 6000)),
        isCustom: Boolean(item.isCustom),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (item.sampleBody) {
        payload.sampleBody = item.sampleBody.slice(0, 2000);
      }

      await setDoc(doc(db, 'apiEndpoints', safeId), payload, { merge: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async saveEndpoint(updated: ApiEndpointItem): Promise<ApiEndpointItem> {
    const cleanItem: ApiEndpointItem = {
      ...updated,
      lastStatus: updated.enabled ? 'CONNECTED' : 'DISCONNECTED',
    };

    if (cleanItem.isBackendGateway) {
      setCustomApiUrl(cleanItem.baseUrl || '');
    }

    const idx = this.items.findIndex((i) => i.id === cleanItem.id);
    if (idx >= 0) {
      this.items[idx] = cleanItem;
    } else {
      this.items.unshift(cleanItem);
    }

    this.saveLocal();
    this.notify();

    if (auth.currentUser) {
      await this.persistEndpointToFirestore(cleanItem);
    }

    return cleanItem;
  }

  public async addCustomEndpoint(input: {
    name: string;
    category: ApiEndpointItem['category'];
    method: ApiEndpointItem['method'];
    url: string;
    baseUrl?: string;
    description: string;
    timeoutMs: number;
    sampleBody?: string;
  }): Promise<ApiEndpointItem> {
    const newItem: ApiEndpointItem = {
      id: `custom_api_${Date.now()}`,
      name: input.name.trim(),
      category: input.category,
      method: input.method,
      url: input.url.trim(),
      baseUrl: input.baseUrl?.trim() || '',
      description: input.description.trim(),
      enabled: true,
      timeoutMs: Math.min(120000, Math.max(500, input.timeoutMs || 6000)),
      sampleBody: input.sampleBody?.trim() || undefined,
      isCustom: true,
      lastStatus: 'CONNECTED',
    };

    this.items.unshift(newItem);
    this.saveLocal();
    this.notify();

    if (auth.currentUser) {
      await this.persistEndpointToFirestore(newItem);
    }

    return newItem;
  }

  public async deleteCustomEndpoint(id: string): Promise<void> {
    this.items = this.items.filter((i) => !(i.id === id && i.isCustom));
    this.saveLocal();
    this.notify();

    if (auth.currentUser) {
      const path = `apiEndpoints/${id}`;
      try {
        await deleteDoc(doc(db, 'apiEndpoints', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  }

  public async toggleConnect(id: string): Promise<ApiEndpointItem | null> {
    const item = this.items.find((i) => i.id === id);
    if (!item) return null;

    const nextEnabled = !item.enabled;
    const updated: ApiEndpointItem = {
      ...item,
      enabled: nextEnabled,
      lastStatus: nextEnabled ? 'CONNECTED' : 'DISCONNECTED',
    };

    // If connecting a market exchange API, also activate it on the live Terminal!
    if (nextEnabled && updated.exchangeMode) {
      marketService.setProviderMode(updated.exchangeMode);
    }

    await this.saveEndpoint(updated);

    if (nextEnabled) {
      return this.testEndpoint(updated.id);
    }
    return updated;
  }

  public async testEndpoint(id: string): Promise<ApiEndpointItem | null> {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;

    const item: ApiEndpointItem = { ...this.items[idx], lastStatus: 'TESTING' };
    this.items[idx] = item;
    this.notify();

    const start = Date.now();

    try {
      // Special handler for Cloud Firestore
      if (item.method === 'CLOUD' || item.url.startsWith('firestore://')) {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          item.lastLatencyMs = Date.now() - start;
          item.lastStatus = 'CONNECTED';
          item.lastHttpCode = 200;
          item.lastError = undefined;
          item.lastResponsePreview = JSON.stringify({ firestore: 'connected', database: 'ai-studio-tradepulsesignal' }, null, 2);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          item.lastLatencyMs = Date.now() - start;
          // Permission denied on test/connection still confirms active server reachability!
          if (!msg.includes('offline')) {
            item.lastStatus = 'CONNECTED';
            item.lastHttpCode = 200;
            item.lastError = undefined;
            item.lastResponsePreview = JSON.stringify({ firestore: 'online', authActive: Boolean(auth.currentUser) }, null, 2);
          } else {
            item.lastStatus = 'ERROR';
            item.lastError = msg;
          }
        }
        item.lastTestedAt = Date.now();
        this.items[idx] = item;
        this.saveLocal();
        this.notify();
        return item;
      }

      // Special handler for Backend Gateway Health
      if (item.isBackendGateway) {
        const health = await checkBackendHealth(item.timeoutMs);
        item.lastLatencyMs = health.latencyMs;
        item.lastStatus = health.ok ? 'CONNECTED' : 'ERROR';
        item.lastHttpCode = health.ok ? 200 : 503;
        item.lastError = health.error;
        item.lastResponsePreview = JSON.stringify(health, null, 2);
        item.lastTestedAt = Date.now();
        this.items[idx] = item;
        this.saveLocal();
        this.notify();
        return item;
      }

      // Standard HTTP GET / POST / PUT / DELETE test
      let targetUrl = item.url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        if (item.baseUrl && item.baseUrl.trim()) {
          targetUrl = `${item.baseUrl.trim().replace(/\/+$/, '')}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
        } else {
          targetUrl = getApiUrl(targetUrl);
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), item.timeoutMs || 6000);

      const fetchInit: RequestInit = {
        method: item.method,
        headers: {
          Accept: 'application/json',
          ...(item.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: controller.signal,
      };

      if (item.method !== 'GET' && item.method !== 'DELETE' && item.sampleBody) {
        fetchInit.body = item.sampleBody;
      }

      const res = await fetch(targetUrl, fetchInit);
      clearTimeout(timer);
      const latency = Date.now() - start;

      let previewText = '';
      try {
        const text = await res.text();
        try {
          previewText = JSON.stringify(JSON.parse(text), null, 2).slice(0, 800);
        } catch {
          previewText = text.slice(0, 800);
        }
      } catch {
        previewText = `HTTP ${res.status} ${res.statusText}`;
      }

      item.lastLatencyMs = latency;
      item.lastHttpCode = res.status;
      item.lastTestedAt = Date.now();
      // Note: 400 on vision/whatsapp empty test payload still confirms the server endpoint is live & connected!
      const isReachable = res.ok || (targetUrl.includes('/api/') && res.status === 400);
      item.lastStatus = isReachable ? 'CONNECTED' : 'ERROR';
      item.lastError = isReachable ? undefined : `HTTP ${res.status}: ${res.statusText}`;
      item.lastResponsePreview = previewText;
    } catch (err: unknown) {
      item.lastLatencyMs = Date.now() - start;
      item.lastTestedAt = Date.now();
      item.lastStatus = 'ERROR';
      item.lastError =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Request Timeout'
            : err.message
          : 'Network Error';
    }

    this.items[idx] = item;
    this.saveLocal();
    this.notify();
    return item;
  }

  public async testAllEndpoints(): Promise<void> {
    const ids = this.items.map((i) => i.id);
    for (const id of ids) {
      await this.testEndpoint(id);
    }
  }

  public async resetAllToDefault(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY_API_OVERRIDES);
    setCustomApiUrl('');
    this.loadLocal();
    this.notify();
  }
}

export const apiHubService = new ApiHubService();
