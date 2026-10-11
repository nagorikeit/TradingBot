import { Signal } from '../types';
import { ScreenAnalysisFinalResult } from '../types/screenTypes';
import { getApiUrl } from './apiConfig';

export type WhatsAppProviderType = 'twilio' | 'custom_webhook' | 'callmebot';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // e.g. "whatsapp:+14155238886"
  toNumber: string;   // e.g. "whatsapp:+8801700000000"
}

export interface WebhookConfig {
  webhookUrl: string;
  httpMethod: 'POST' | 'GET';
  authToken: string;
  customHeaderName: string;
  customHeaderValue: string;
}

export interface CallMeBotConfig {
  phoneNumber: string; // e.g. "+8801700000000" or "8801700000000"
  apiKey: string;      // CallMeBot assigned API key
}

export interface WhatsAppAlertFilters {
  minConfidence: number;        // default: 75%
  allowedDirections: 'ALL' | 'CALL_ONLY' | 'PUT_ONLY';
  includeScreenAnalysis: boolean;
  includeTechnicalSignals: boolean;
  cooldownSeconds: number;       // default: 60 seconds
}

export interface WhatsAppConfig {
  enabled: boolean;
  provider: WhatsAppProviderType;
  twilio: TwilioConfig;
  webhook: WebhookConfig;
  callmebot: CallMeBotConfig;
  filters: WhatsAppAlertFilters;
}

export interface WhatsAppAlertLog {
  id: string;
  timestamp: number;
  type: 'TEST' | 'TECHNICAL_SIGNAL' | 'SCREEN_ANALYSIS';
  symbol: string;
  direction: string;
  price?: number | string;
  confidenceScore?: number;
  messageText: string;
  status: 'SENT' | 'FAILED';
  provider: string;
  error?: string;
}

const STORAGE_KEY_CONFIG = 'tradingbot_whatsapp_config_v1';
const STORAGE_KEY_LOGS = 'tradingbot_whatsapp_logs_v1';

export class WhatsAppAlertService {
  private static instance: WhatsAppAlertService;
  private config: WhatsAppConfig;
  private logs: WhatsAppAlertLog[] = [];
  private lastAlertTimestamp: number = 0;
  private lastAlertKey: string = '';
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.config = this.loadConfig();
    this.logs = this.loadLogs();
  }

  public static getInstance(): WhatsAppAlertService {
    if (!WhatsAppAlertService.instance) {
      WhatsAppAlertService.instance = new WhatsAppAlertService();
    }
    return WhatsAppAlertService.instance;
  }

  private getDefaultConfig(): WhatsAppConfig {
    return {
      enabled: false,
      provider: 'callmebot',
      twilio: {
        accountSid: '',
        authToken: '',
        fromNumber: 'whatsapp:+14155238886',
        toNumber: '',
      },
      webhook: {
        webhookUrl: '',
        httpMethod: 'POST',
        authToken: '',
        customHeaderName: '',
        customHeaderValue: '',
      },
      callmebot: {
        phoneNumber: '',
        apiKey: '',
      },
      filters: {
        minConfidence: 75,
        allowedDirections: 'ALL',
        includeScreenAnalysis: true,
        includeTechnicalSignals: true,
        cooldownSeconds: 60,
      },
    };
  }

  private loadConfig(): WhatsAppConfig {
    if (typeof window === 'undefined') return this.getDefaultConfig();
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...this.getDefaultConfig(),
          ...parsed,
          filters: { ...this.getDefaultConfig().filters, ...(parsed.filters || {}) },
          twilio: { ...this.getDefaultConfig().twilio, ...(parsed.twilio || {}) },
          webhook: { ...this.getDefaultConfig().webhook, ...(parsed.webhook || {}) },
          callmebot: { ...this.getDefaultConfig().callmebot, ...(parsed.callmebot || {}) },
        };
      }
    } catch (e) {
      console.warn('Failed to load WhatsApp config from localStorage:', e);
    }
    return this.getDefaultConfig();
  }

  private loadLogs(): WhatsAppAlertLog[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LOGS);
      if (stored) {
        return JSON.parse(stored).slice(0, 30);
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private saveLogs(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(this.logs.slice(0, 30)));
    } catch {
      // Ignore
    }
  }

  public getConfig(): WhatsAppConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<WhatsAppConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      filters: { ...this.config.filters, ...(newConfig.filters || {}) },
      twilio: { ...this.config.twilio, ...(newConfig.twilio || {}) },
      webhook: { ...this.config.webhook, ...(newConfig.webhook || {}) },
      callmebot: { ...this.config.callmebot, ...(newConfig.callmebot || {}) },
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
      } catch (e) {
        console.warn('Failed to save WhatsApp config:', e);
      }
    }
    this.notify();
  }

  public getLogs(): WhatsAppAlertLog[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.saveLogs();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Helper to format Technical Signals into WhatsApp Markdown
   */
  public formatSignalMessage(signal: Signal): string {
    const isCall = signal.direction === 'CALL';
    const dirEmoji = isCall ? '📈 🟢 *CALL (BUY)*' : '📉 🔴 *PUT (SELL)*';
    const timeStr = new Date(signal.signalTime || Date.now()).toLocaleTimeString();
    const reasonsStr = signal.reasons && signal.reasons.length > 0
      ? signal.reasons.map((r) => `  • ${r}`).join('\n')
      : '  • Strategy conditions satisfied';

    return [
      `🤖 *TradePulse AI Agent — Trade Alert*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🎯 *Asset:* ${signal.symbol} (${signal.timeframe})`,
      `📊 *Direction:* ${dirEmoji}`,
      `💰 *Entry Price:* ${signal.entryPrice}`,
      `⭐ *Pattern Score:* ${signal.confidenceScore}% (${signal.scoreRatio || 'Confirmed'})`,
      `⏰ *Time:* ${timeStr}`,
      `📡 *Data Source:* ${signal.marketDataSource || 'Live Market Feed'}`,
      ``,
      `🔍 *Technical Triggers:*`,
      reasonsStr,
      ``,
      `⚠️ *Risk Disclaimer:* Educational research & paper analysis only. Always verify your own risk management.`,
    ].join('\n');
  }

  /**
   * Helper to format Screen Analysis results into WhatsApp Markdown
   */
  public formatScreenAnalysisMessage(result: ScreenAnalysisFinalResult): string {
    const isUp = result.direction === 'UP';
    const isDown = result.direction === 'DOWN';
    const dirEmoji = isUp
      ? '📈 🟢 *CALL / UP BIAS*'
      : isDown
      ? '📉 🔴 *PUT / DOWN BIAS*'
      : '⏸️ 🟡 *WAIT / UNCERTAIN*';

    const timeStr = new Date(result.timestamp).toLocaleTimeString();
    const symbolStr = result.visionData.symbol || 'Chart Screen';
    const tfStr = result.visionData.timeframe || 'Visible TF';
    const priceStr = result.marketVerification.livePrice
      ? `${result.marketVerification.livePrice} (Verified Feed)`
      : result.visionData.lastVisiblePrice
      ? `${result.visionData.lastVisiblePrice} (Vision OCR)`
      : 'N/A';

    const reasonsList = result.reasoning && result.reasoning.length > 0
      ? result.reasoning.map((r) => `  • ${r}`).join('\n')
      : '  • Chart pattern alignment';

    return [
      `🤖 *TradePulse AI Screen Analyzer Alert*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🖥️ *Source:* Live Screen Share / Window`,
      `🎯 *Asset:* ${symbolStr} (${tfStr})`,
      `📊 *Action:* ${dirEmoji}`,
      `💰 *Price:* ${priceStr}`,
      `⭐ *Confidence:* ${result.confidence}%`,
      `🔍 *Pattern:* ${result.visionData.candlestickPattern || 'Identified setup'}`,
      `⏰ *Time:* ${timeStr}`,
      ``,
      `📋 *AI Verdict:* ${result.verdictTitle}`,
      `🔬 *Observations:*`,
      reasonsList,
      ``,
      `⚠️ *Disclaimer:* Educational chart vision analysis. Zero direct broker execution.`,
    ].join('\n');
  }

  /**
   * Sends a test alert through the configured provider
   */
  public async sendTestAlert(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch(getApiUrl('/api/agent/whatsapp/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: this.config.provider,
          twilioConfig: this.config.twilio,
          webhookConfig: this.config.webhook,
          callmebotConfig: this.config.callmebot,
        }),
      });

      const data = await res.json();
      const isOk = !!data.ok;

      this.addLog({
        id: `test_${Date.now()}`,
        timestamp: Date.now(),
        type: 'TEST',
        symbol: 'TEST-PING',
        direction: 'PING',
        messageText: 'Test WhatsApp connection ping',
        status: isOk ? 'SENT' : 'FAILED',
        provider: this.config.provider,
        error: isOk ? undefined : data.error || 'Connection failed',
      });

      return {
        ok: isOk,
        message: isOk
          ? `Test message sent successfully via ${this.config.provider.toUpperCase()}!`
          : `Failed to send test message: ${data.error || 'Server error'}`,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      this.addLog({
        id: `test_${Date.now()}`,
        timestamp: Date.now(),
        type: 'TEST',
        symbol: 'TEST-PING',
        direction: 'PING',
        messageText: 'Test WhatsApp connection ping',
        status: 'FAILED',
        provider: this.config.provider,
        error: errorMsg,
      });
      return { ok: false, message: `Dispatch failed: ${errorMsg}` };
    }
  }

  /**
   * Sends real-time technical trade signal alert
   */
  public async sendTradeSignalAlert(signal: Signal): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (!this.config.filters.includeTechnicalSignals) return false;

    // Check direction filter
    if (signal.direction === 'WAIT') return false;
    if (this.config.filters.allowedDirections === 'CALL_ONLY' && signal.direction !== 'CALL') return false;
    if (this.config.filters.allowedDirections === 'PUT_ONLY' && signal.direction !== 'PUT') return false;

    // Check confidence threshold
    if ((signal.confidenceScore || 0) < this.config.filters.minConfidence) return false;

    // Anti-spam cooldown check
    const now = Date.now();
    const alertKey = `${signal.symbol}_${signal.direction}`;
    const cooldownMs = (this.config.filters.cooldownSeconds || 60) * 1000;
    if (now - this.lastAlertTimestamp < cooldownMs && this.lastAlertKey === alertKey) {
      console.log('[WhatsAppAlertService] Throttled duplicate signal:', alertKey);
      return false;
    }

    const messageText = this.formatSignalMessage(signal);

    try {
      const res = await fetch(getApiUrl('/api/agent/whatsapp/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: this.config.provider,
          twilioConfig: this.config.twilio,
          webhookConfig: this.config.webhook,
          callmebotConfig: this.config.callmebot,
          messageText,
          signalData: {
            symbol: signal.symbol,
            direction: signal.direction,
            price: signal.entryPrice,
            confidenceScore: signal.confidenceScore,
            timeframe: signal.timeframe,
            reasons: signal.reasons,
            source: signal.marketDataSource || 'Technical Strategy',
            timestamp: signal.signalTime,
          },
        }),
      });

      const data = await res.json();
      const isOk = !!data.ok;

      this.lastAlertTimestamp = now;
      this.lastAlertKey = alertKey;

      this.addLog({
        id: `sig_${now}`,
        timestamp: now,
        type: 'TECHNICAL_SIGNAL',
        symbol: signal.symbol,
        direction: signal.direction,
        price: signal.entryPrice,
        confidenceScore: signal.confidenceScore,
        messageText,
        status: isOk ? 'SENT' : 'FAILED',
        provider: this.config.provider,
        error: isOk ? undefined : data.error,
      });

      return isOk;
    } catch (err: unknown) {
      console.error('[WhatsAppAlertService] Signal dispatch error:', err);
      this.addLog({
        id: `sig_${now}`,
        timestamp: now,
        type: 'TECHNICAL_SIGNAL',
        symbol: signal.symbol,
        direction: signal.direction,
        price: signal.entryPrice,
        confidenceScore: signal.confidenceScore,
        messageText,
        status: 'FAILED',
        provider: this.config.provider,
        error: err instanceof Error ? err.message : 'Network failure',
      });
      return false;
    }
  }

  /**
   * Sends real-time screen analysis alert
   */
  public async sendScreenAnalysisAlert(result: ScreenAnalysisFinalResult): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (!this.config.filters.includeScreenAnalysis) return false;

    // Check direction
    if (result.direction === 'WAIT') return false;
    if (this.config.filters.allowedDirections === 'CALL_ONLY' && result.direction !== 'UP') return false;
    if (this.config.filters.allowedDirections === 'PUT_ONLY' && result.direction !== 'DOWN') return false;

    // Check confidence threshold
    if ((result.confidence || 0) < this.config.filters.minConfidence) return false;

    // Anti-spam cooldown check
    const now = Date.now();
    const symbol = result.visionData.symbol || 'SCREEN';
    const alertKey = `SCREEN_${symbol}_${result.direction}`;
    const cooldownMs = (this.config.filters.cooldownSeconds || 60) * 1000;
    if (now - this.lastAlertTimestamp < cooldownMs && this.lastAlertKey === alertKey) {
      return false;
    }

    const messageText = this.formatScreenAnalysisMessage(result);

    try {
      const res = await fetch(getApiUrl('/api/agent/whatsapp/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: this.config.provider,
          twilioConfig: this.config.twilio,
          webhookConfig: this.config.webhook,
          callmebotConfig: this.config.callmebot,
          messageText,
          signalData: {
            symbol: result.visionData.symbol,
            direction: result.direction,
            price: result.marketVerification.livePrice || result.visionData.lastVisiblePrice,
            confidenceScore: result.confidence,
            timeframe: result.visionData.timeframe,
            reasons: result.reasoning,
            source: 'Screen Vision Analysis',
            timestamp: result.timestamp,
          },
        }),
      });

      const data = await res.json();
      const isOk = !!data.ok;

      this.lastAlertTimestamp = now;
      this.lastAlertKey = alertKey;

      this.addLog({
        id: `screen_${now}`,
        timestamp: now,
        type: 'SCREEN_ANALYSIS',
        symbol,
        direction: result.direction,
        price: result.marketVerification.livePrice || result.visionData.lastVisiblePrice,
        confidenceScore: result.confidence,
        messageText,
        status: isOk ? 'SENT' : 'FAILED',
        provider: this.config.provider,
        error: isOk ? undefined : data.error,
      });

      return isOk;
    } catch (err: unknown) {
      console.error('[WhatsAppAlertService] Screen dispatch error:', err);
      this.addLog({
        id: `screen_${now}`,
        timestamp: now,
        type: 'SCREEN_ANALYSIS',
        symbol,
        direction: result.direction,
        price: result.marketVerification.livePrice || result.visionData.lastVisiblePrice,
        confidenceScore: result.confidence,
        messageText,
        status: 'FAILED',
        provider: this.config.provider,
        error: err instanceof Error ? err.message : 'Network failure',
      });
      return false;
    }
  }

  private addLog(log: WhatsAppAlertLog): void {
    this.logs.unshift(log);
    if (this.logs.length > 30) {
      this.logs.pop();
    }
    this.saveLogs();
    this.notify();
  }
}

export const whatsappAlertService = WhatsAppAlertService.getInstance();
