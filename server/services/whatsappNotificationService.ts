export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
}

export interface WebhookConfig {
  webhookUrl: string;
  httpMethod?: 'POST' | 'GET';
  authToken?: string;
  customHeaderName?: string;
  customHeaderValue?: string;
}

export interface CallMeBotConfig {
  phoneNumber: string;
  apiKey: string;
}

export interface WhatsAppNotificationPayload {
  provider: 'twilio' | 'custom_webhook' | 'callmebot';
  twilioConfig?: TwilioConfig;
  webhookConfig?: WebhookConfig;
  callmebotConfig?: CallMeBotConfig;
  messageText: string;
  signalData?: {
    symbol?: string;
    direction?: string;
    price?: number | string;
    confidenceScore?: number;
    timeframe?: string;
    reasons?: string[];
    source?: string;
    timestamp?: number;
  };
}

export interface WhatsAppSendResult {
  ok: boolean;
  provider: string;
  messageId?: string;
  statusText: string;
  error?: string;
  timestamp: number;
}

export class WhatsAppNotificationService {
  private static instance: WhatsAppNotificationService;

  public static getInstance(): WhatsAppNotificationService {
    if (!WhatsAppNotificationService.instance) {
      WhatsAppNotificationService.instance = new WhatsAppNotificationService();
    }
    return WhatsAppNotificationService.instance;
  }

  /**
   * Main dispatch router handling Twilio, Webhook, and CallMeBot
   */
  public async sendAlert(payload: WhatsAppNotificationPayload): Promise<WhatsAppSendResult> {
    const timestamp = Date.now();

    try {
      if (payload.provider === 'twilio') {
        return await this.sendViaTwilio(payload, timestamp);
      } else if (payload.provider === 'custom_webhook') {
        return await this.sendViaWebhook(payload, timestamp);
      } else if (payload.provider === 'callmebot') {
        return await this.sendViaCallMeBot(payload, timestamp);
      } else {
        return {
          ok: false,
          provider: 'unknown',
          statusText: 'Unsupported provider',
          error: `Provider '${payload.provider}' is not supported`,
          timestamp,
        };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown notification dispatch error';
      return {
        ok: false,
        provider: payload.provider,
        statusText: 'Internal Error',
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Twilio WhatsApp REST API
   * POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
   */
  private async sendViaTwilio(
    payload: WhatsAppNotificationPayload,
    timestamp: number
  ): Promise<WhatsAppSendResult> {
    const twilio = payload.twilioConfig;
    if (!twilio || !twilio.accountSid || !twilio.authToken || !twilio.fromNumber || !twilio.toNumber) {
      return {
        ok: false,
        provider: 'twilio',
        statusText: 'Invalid Configuration',
        error: 'Missing required Twilio fields: accountSid, authToken, fromNumber, or toNumber',
        timestamp,
      };
    }

    // Format numbers to ensure whatsapp: prefix
    const from = twilio.fromNumber.trim().startsWith('whatsapp:')
      ? twilio.fromNumber.trim()
      : `whatsapp:${twilio.fromNumber.trim()}`;
    const to = twilio.toNumber.trim().startsWith('whatsapp:')
      ? twilio.toNumber.trim()
      : `whatsapp:${twilio.toNumber.trim()}`;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilio.accountSid.trim())}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', from);
    formData.append('To', to);
    formData.append('Body', payload.messageText);

    const basicAuth = Buffer.from(
      `${twilio.accountSid.trim()}:${twilio.authToken.trim()}`
    ).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { raw: responseText };
    }

    if (!res.ok) {
      const errorMsg =
        (typeof parsed.message === 'string' && parsed.message) ||
        (typeof parsed.error_message === 'string' && parsed.error_message) ||
        `Twilio API error HTTP ${res.status}`;
      return {
        ok: false,
        provider: 'twilio',
        statusText: `Twilio ${res.status}`,
        error: errorMsg,
        timestamp,
      };
    }

    return {
      ok: true,
      provider: 'twilio',
      messageId: typeof parsed.sid === 'string' ? parsed.sid : undefined,
      statusText: (typeof parsed.status === 'string' && parsed.status) || 'sent',
      timestamp,
    };
  }

  /**
   * Custom Webhook / REST Gateway dispatch
   */
  private async sendViaWebhook(
    payload: WhatsAppNotificationPayload,
    timestamp: number
  ): Promise<WhatsAppSendResult> {
    const webhook = payload.webhookConfig;
    if (!webhook || !webhook.webhookUrl) {
      return {
        ok: false,
        provider: 'custom_webhook',
        statusText: 'Invalid Configuration',
        error: 'Missing required webhookUrl',
        timestamp,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TradePulse-WhatsApp-Notifier/1.0',
    };

    if (webhook.authToken) {
      headers['Authorization'] = webhook.authToken.startsWith('Bearer ')
        ? webhook.authToken
        : `Bearer ${webhook.authToken.trim()}`;
    }

    if (webhook.customHeaderName && webhook.customHeaderValue) {
      headers[webhook.customHeaderName.trim()] = webhook.customHeaderValue.trim();
    }

    const method = (webhook.httpMethod || 'POST').toUpperCase();
    let url = webhook.webhookUrl.trim();

    const requestBody = JSON.stringify({
      event: 'TRADE_SIGNAL_ALERT',
      message: payload.messageText,
      signal: payload.signalData || null,
      timestamp,
    });

    let res: Response;
    if (method === 'GET') {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}message=${encodeURIComponent(payload.messageText)}`;
      res = await fetch(url, { method: 'GET', headers });
    } else {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });
    }

    const resText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        provider: 'custom_webhook',
        statusText: `Webhook ${res.status}`,
        error: `Webhook returned status ${res.status}: ${resText.slice(0, 200)}`,
        timestamp,
      };
    }

    return {
      ok: true,
      provider: 'custom_webhook',
      statusText: `Webhook Success (${res.status})`,
      timestamp,
    };
  }

  /**
   * CallMeBot WhatsApp API
   * GET https://api.callmebot.com/whatsapp.php?phone={phone}&text={text}&apikey={apikey}
   */
  private async sendViaCallMeBot(
    payload: WhatsAppNotificationPayload,
    timestamp: number
  ): Promise<WhatsAppSendResult> {
    const cmb = payload.callmebotConfig;
    if (!cmb || !cmb.phoneNumber || !cmb.apiKey) {
      return {
        ok: false,
        provider: 'callmebot',
        statusText: 'Invalid Configuration',
        error: 'Missing phoneNumber or apiKey for CallMeBot',
        timestamp,
      };
    }

    // Clean phone number (remove + or whitespace)
    const cleanPhone = cmb.phoneNumber.replace(/[^\d]/g, '');
    const cleanApiKey = cmb.apiKey.trim();
    const encodedText = encodeURIComponent(payload.messageText);

    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedText}&apikey=${cleanApiKey}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'TradePulse-CallMeBot/1.0',
      },
    });

    const resText = await res.text();
    if (!res.ok || resText.toLowerCase().includes('error') || resText.toLowerCase().includes('failed')) {
      return {
        ok: false,
        provider: 'callmebot',
        statusText: `CallMeBot error`,
        error: resText.slice(0, 200) || `CallMeBot failed with HTTP ${res.status}`,
        timestamp,
      };
    }

    return {
      ok: true,
      provider: 'callmebot',
      statusText: 'Message queued to CallMeBot',
      timestamp,
    };
  }
}

export const whatsappNotificationService = WhatsAppNotificationService.getInstance();
