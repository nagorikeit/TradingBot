import { MarketDataSourceMode } from '../data/marketDataProvider';

export type ApiCategory =
  | 'MARKET_DATA'
  | 'BACKEND_AI'
  | 'AUTH_CLOUD'
  | 'NOTIFICATIONS'
  | 'CUSTOM';

export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'CLOUD';

export type ApiConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'TESTING';

export interface ApiEndpointItem {
  id: string;
  name: string;
  category: ApiCategory;
  method: ApiHttpMethod;
  url: string;
  baseUrl?: string;
  description: string;
  enabled: boolean;
  timeoutMs: number;
  sampleBody?: string;
  isCustom?: boolean;
  isServerProxyManaged?: boolean;
  exchangeMode?: MarketDataSourceMode;
  isBackendGateway?: boolean;
  lastLatencyMs?: number;
  lastStatus?: ApiConnectionStatus;
  lastTestedAt?: number;
  lastHttpCode?: number;
  lastError?: string;
  lastResponsePreview?: string;
}
