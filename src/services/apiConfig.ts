import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_BACKEND_URL = 'tradepulse_backend_api_url';

// Default hosted backend URL - if unset or broken, relative path /api is used
export const DEFAULT_HOSTED_BACKEND_URL = '';

/**
 * Returns the base URL for API requests.
 * Automatically purges expired/broken internal dev URLs.
 * On Web, always uses relative path ('') which routes to Express server on port 3000.
 * On Android APK, uses user-configured URL, VITE_BACKEND_URL, or local loopback.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem(STORAGE_KEY_BACKEND_URL);

  // Auto-purge old broken internal dev URL if present in localStorage
  if (
    stored &&
    (stored.includes('ais-dev-2mn2ktc74egyugovwwvzoy') ||
      stored.includes('634716608323') ||
      stored.includes('undefined'))
  ) {
    try {
      localStorage.removeItem(STORAGE_KEY_BACKEND_URL);
    } catch {}
  } else if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }

  // If running inside Capacitor Native Android runtime (APK on mobile device)
  if (Capacitor.isNativePlatform()) {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    // If running in Android emulator or local network
    return '';
  }

  // On Web (AI Studio preview, Chrome, mobile browser), relative path /api connects directly to Express backend
  return '';
}

/**
 * Formats a relative API route into a full URL if needed
 */
export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!base) return cleanEndpoint;
  return `${base}${cleanEndpoint}`;
}

export function setCustomApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEY_BACKEND_URL);
    } else {
      localStorage.setItem(STORAGE_KEY_BACKEND_URL, url.trim().replace(/\/+$/, ''));
    }
  }
}

export function getCustomApiUrl(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_BACKEND_URL) || '';
}

export async function checkBackendHealth(timeoutMs: number = 6000): Promise<{
  ok: boolean;
  latencyMs: number;
  url: string;
  error?: string;
}> {
  const startTime = Date.now();
  let targetUrl = getApiUrl('/api/health');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      return { ok: true, latencyMs, url: targetUrl };
    }
    // If custom URL failed and we are in browser, try relative fallback
    if (targetUrl !== '/api/health' && typeof window !== 'undefined') {
      try {
        const fallbackRes = await fetch('/api/health', { method: 'GET', headers: { Accept: 'application/json' } });
        if (fallbackRes.ok) {
          setCustomApiUrl(''); // Reset to working default
          return { ok: true, latencyMs: Date.now() - startTime, url: '/api/health' };
        }
      } catch {}
    }
    return { ok: false, latencyMs, url: targetUrl, error: `HTTP ${res.status}` };
  } catch (err: any) {
    clearTimeout(timer);
    // If custom or stored URL threw (e.g. Failed to fetch), try relative endpoint
    if (targetUrl !== '/api/health' && typeof window !== 'undefined') {
      try {
        const fallbackRes = await fetch('/api/health', { method: 'GET', headers: { Accept: 'application/json' } });
        if (fallbackRes.ok) {
          setCustomApiUrl(''); // Reset to working default
          return { ok: true, latencyMs: Date.now() - startTime, url: '/api/health' };
        }
      } catch {}
    }
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      latencyMs,
      url: targetUrl,
      error: err.name === 'AbortError' ? 'Connection timeout' : (err.message || 'Network unreachable'),
    };
  }
}
