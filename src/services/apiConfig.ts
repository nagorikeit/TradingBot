import { Capacitor } from '@capacitor/core';

const STORAGE_KEY_BACKEND_URL = 'tradepulse_backend_api_url';

// Default production cloud URL where the Express backend and Gemini Vision proxy are hosted
export const DEFAULT_HOSTED_BACKEND_URL =
  'https://ais-pre-2mn2ktc74egyugovwwvzoy-634716608323.asia-east1.run.app';

/**
 * Returns the base URL for API requests.
 * On Android APK (Capacitor), relative URLs ('/api/...') fail because there is no local server.
 * This resolves the proper cloud/remote server URL for Android APK while keeping relative URLs in web dev.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem(STORAGE_KEY_BACKEND_URL);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/+$/, '');
  }

  // If running inside Capacitor Native Android runtime
  if (Capacitor.isNativePlatform()) {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
    return DEFAULT_HOSTED_BACKEND_URL;
  }

  // On Web / Dev server, relative path works directly with Vite proxy or Express server
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

/**
 * Checks backend health and returns latency, reachable status, or failure cause
 */
export async function checkBackendHealth(timeoutMs: number = 6000): Promise<{
  ok: boolean;
  latencyMs: number;
  url: string;
  error?: string;
}> {
  const startTime = Date.now();
  const targetUrl = getApiUrl('/api/health');
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
    return { ok: false, latencyMs, url: targetUrl, error: `HTTP ${res.status}` };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      latencyMs,
      url: targetUrl,
      error: err.name === 'AbortError' ? 'Connection timeout' : (err.message || 'Network unreachable'),
    };
  }
}
