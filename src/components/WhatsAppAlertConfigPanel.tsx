import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Smartphone,
  Key,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Sliders,
  Power,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  HelpCircle,
  Check,
  Copy,
  Zap,
  Info,
} from 'lucide-react';
import {
  whatsappAlertService,
  WhatsAppConfig,
  WhatsAppAlertLog,
  WhatsAppProviderType,
} from '../services/whatsappAlertService';

export const WhatsAppAlertConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<WhatsAppConfig>(whatsappAlertService.getConfig());
  const [logs, setLogs] = useState<WhatsAppAlertLog[]>(whatsappAlertService.getLogs());
  const [showToken, setShowToken] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copiedSample, setCopiedSample] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = whatsappAlertService.subscribe(() => {
      setConfig(whatsappAlertService.getConfig());
      setLogs(whatsappAlertService.getLogs());
    });
    return unsubscribe;
  }, []);

  const handleToggleMaster = () => {
    const updated = { ...config, enabled: !config.enabled };
    setConfig(updated);
    whatsappAlertService.updateConfig(updated);
    flashSave();
  };

  const handleProviderChange = (provider: WhatsAppProviderType) => {
    const updated = { ...config, provider };
    setConfig(updated);
    whatsappAlertService.updateConfig(updated);
    flashSave();
  };

  const handleTwilioChange = (field: keyof WhatsAppConfig['twilio'], value: string) => {
    const updated: WhatsAppConfig = {
      ...config,
      twilio: {
        ...config.twilio,
        [field]: value,
      },
    };
    setConfig(updated);
    whatsappAlertService.updateConfig(updated);
  };

  const handleCallMeBotChange = (field: keyof WhatsAppConfig['callmebot'], value: string) => {
    const updated: WhatsAppConfig = {
      ...config,
      callmebot: {
        ...config.callmebot,
        [field]: value,
      },
    };
    setConfig(updated);
    whatsappAlertService.updateConfig(updated);
  };

  const handleWebhookChange = (field: keyof WhatsAppConfig['webhook'], value: string) => {
    const updated: WhatsAppConfig = {
      ...config,
      webhook: {
        ...config.webhook,
        [field]: value,
      },
    };
    setConfig(updated);
    whatsappAlertService.updateConfig(updated);
  };

  const handleFilterChange = (field: keyof WhatsAppConfig['filters'], value: any) => {
    const updated: WhatsAppConfig = {
      ...config,
      filters: {
        ...config.filters,
        [field]: value,
      },
    };
    setConfig(updated);
    whatsappAlertService.updateConfig(updated);
    flashSave();
  };

  const flashSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSendTestAlert = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await whatsappAlertService.sendTestAlert();
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Error triggering test',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearLogs = () => {
    whatsappAlertService.clearLogs();
  };

  const samplePreviewMessage = [
    `🤖 *TradePulse AI Agent — Trade Alert*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🎯 *Asset:* BTC/USDT (1m)`,
    `📊 *Direction:* 📈 🟢 *CALL (BUY)*`,
    `💰 *Entry Price:* 68,450.20`,
    `⭐ *Pattern Score:* 84% (4/5 Confirmed)`,
    `⏰ *Time:* ${new Date().toLocaleTimeString()}`,
    `📡 *Data Source:* Binance Live Feed`,
    ``,
    `🔍 *Technical Triggers:*`,
    `  • EMA 9 > EMA 21 (Bullish Trend)`,
    `  • RSI 14 at 58.4 (> 50 Bullish)`,
    `  • Price above EMA 21 Support`,
    ``,
    `⚠️ *Risk Disclaimer:* Educational research & paper analysis only.`,
  ].join('\n');

  const copySampleText = () => {
    navigator.clipboard.writeText(samplePreviewMessage);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Master Toggle */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
              config.enabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/40'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white tracking-tight">WhatsApp Trade Signal Alerts</h3>
                <span
                  className={`px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full border ${
                    config.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {config.enabled ? '● ACTIVE & READY' : '○ DISABLED'}
                </span>
                {saveSuccess && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                AI এজেন্ট যখন চার্ট বা মার্কেট ফিড বিশ্লেষণ করে নিশ্চিত সিগন্যাল শনাক্ত করবে, তখন সরাসরি আপনার হোয়াটসঅ্যাপে রিয়েল-টাইম বিস্তারিত নোটিফিকেশন পৌঁছে দেবে।
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMaster}
              className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center gap-2 transition-all shadow-md ${
                config.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              <Power className={`w-4 h-4 ${config.enabled ? 'text-white' : 'text-slate-400'}`} />
              <span>{config.enabled ? 'অ্যালার্ট চালু আছে (Enabled)' : 'অ্যালার্ট চালু করুন (Turn ON)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Provider Selection Tabs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">হোয়াটসঅ্যাপ সার্ভিস প্রোভাইডার নির্বাচন করুন</h4>
          </div>
          <span className="text-xs text-slate-400">৩টি নির্ভরযোগ্য পদ্ধতি সমর্থিত</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Option 1: CallMeBot (Instant / Free) */}
          <button
            type="button"
            onClick={() => handleProviderChange('callmebot')}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              config.provider === 'callmebot'
                ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            {config.provider === 'callmebot' && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm text-white">CallMeBot (বিনামূল্যে / সহজ)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              সবচেয়ে সহজ পদ্ধতি। কোনো অ্যাকাউন্ট সাইনআপ বা বিলিং প্রয়োজন নেই। হোয়াটসঅ্যাপে বটকে ১টি মেসেজ পাঠিয়ে বিনামূল্যে API কী পাওয়া যায়।
            </p>
            <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Personal Free Alert
            </span>
          </button>

          {/* Option 2: Twilio WhatsApp API */}
          <button
            type="button"
            onClick={() => handleProviderChange('twilio')}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              config.provider === 'twilio'
                ? 'bg-cyan-950/20 border-cyan-500/60 shadow-lg shadow-cyan-950/30'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            {config.provider === 'twilio' && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-sm text-white">Twilio WhatsApp API</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              অফিসিয়াল এন্টারপ্রাইজ টুইলিও গেটওয়ে। টুইলিও স্যান্ডবক্স বা প্রোডাকশন নম্বর ব্যবহার করে উচ্চ ডেলিভারি রেটে মেসেজ পাঠানো যায়।
            </p>
            <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Twilio Business Cloud
            </span>
          </button>

          {/* Option 3: Custom Webhook / Gateway */}
          <button
            type="button"
            onClick={() => handleProviderChange('custom_webhook')}
            className={`p-4 rounded-xl border text-left transition-all relative ${
              config.provider === 'custom_webhook'
                ? 'bg-purple-950/20 border-purple-500/60 shadow-lg shadow-purple-950/30'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            {config.provider === 'custom_webhook' && (
              <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            )}
            <div className="flex items-center gap-2 mb-1.5">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-sm text-white">Custom Webhook / HTTP</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              যেকোনো কাস্টম গেটওয়ে যেমন Green API, UltraMsg, WPPConnect, Baileys, নতুবা আপনার নিজস্ব নোটিফিকেশন সার্ভার বা ডিসকর্ড/টেলিগ্রাম রিলে।
            </p>
            <span className="inline-block mt-3 px-2 py-0.5 text-[10px] font-mono rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              REST / Webhook Relay
            </span>
          </button>
        </div>
      </div>

      {/* 3. API Keys & Configuration Form Based on Provider */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Inputs */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-white">
                {config.provider === 'callmebot' && 'CallMeBot সেটিংস ও API কী'}
                {config.provider === 'twilio' && 'Twilio API ক্রেডেনশিয়াল ও ফোন নম্বর'}
                {config.provider === 'custom_webhook' && 'Custom Webhook URL ও অথেন্টিকেশন'}
              </h4>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Auto-saved to Browser</span>
          </div>

          {/* CALLMEBOT FORM */}
          {config.provider === 'callmebot' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3.5 text-xs text-emerald-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-200">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>CallMeBot কীভাবে সেটআপ করবেন? (মাত্র ২ মিনিট)</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 ml-1">
                  <li>আপনার ফোনে <span className="font-mono text-emerald-300">+34 644 68 00 24</span> নম্বরটি Contacts-এ সংরক্ষণ করুন।</li>
                  <li>হোয়াটসঅ্যাপে ঐ নম্বরে মেসেজ পাঠান: <span className="font-mono text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">I allow callmebot to send me messages</span></li>
                  <li>বট সাথে সাথে রিপ্লাই দিয়ে আপনার নিজস্ব <strong>API Key</strong> জানিয়ে দেবে। নিচের ঘরে নম্বর ও কী বসিয়ে দিন!</li>
                </ol>
                <div className="pt-1">
                  <a
                    href="https://www.callmebot.com/blog/free-api-whatsapp-messages/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                  >
                    <span>অফিসিয়াল CallMeBot ডিরেক্ট গাইড দেখুন</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  আপনার হোয়াটসঅ্যাপ নম্বর (কান্ট্রি কোড সহ, যেমন: +88017XXXXXXXX বা 88017XXXXXXXX)
                </label>
                <input
                  type="text"
                  placeholder="+8801700000000"
                  value={config.callmebot.phoneNumber}
                  onChange={(e) => handleCallMeBotChange('phoneNumber', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  CallMeBot API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="e.g. 1234567"
                    value={config.callmebot.apiKey}
                    onChange={(e) => handleCallMeBotChange('apiKey', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TWILIO FORM */}
          {config.provider === 'twilio' && (
            <div className="space-y-4">
              <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-3 text-xs text-cyan-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <p>
                  টুইলিও ব্যবহার করতে আপনার <a href="https://console.twilio.com/" target="_blank" rel="noopener noreferrer" className="underline font-semibold text-cyan-200">Twilio Console</a> থেকে Account SID ও Auth Token সংগ্রহ করুন। স্যান্ডবক্স নম্বরের ফরম্যাট সাধারণত <span className="font-mono bg-slate-950 px-1 py-0.5 rounded text-white">whatsapp:+14155238886</span> হয়ে থাকে।
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Twilio Account SID
                </label>
                <input
                  type="text"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={config.twilio.accountSid}
                  onChange={(e) => handleTwilioChange('accountSid', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Twilio Auth Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={config.twilio.authToken}
                    onChange={(e) => handleTwilioChange('authToken', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    From WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="whatsapp:+14155238886"
                    value={config.twilio.fromNumber}
                    onChange={(e) => handleTwilioChange('fromNumber', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Twilio স্যান্ডবক্স বা প্রেরক নম্বর</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    To WhatsApp Number (আপনার নম্বর)
                  </label>
                  <input
                    type="text"
                    placeholder="whatsapp:+8801700000000"
                    value={config.twilio.toNumber}
                    onChange={(e) => handleTwilioChange('toNumber', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">যে নম্বরে অ্যালার্ট পাঠাতে চান</span>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM WEBHOOK FORM */}
          {config.provider === 'custom_webhook' && (
            <div className="space-y-4">
              <div className="bg-purple-950/20 border border-purple-500/30 rounded-lg p-3 text-xs text-purple-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <p>
                  আপনার যেকোনো কাস্টম নোটিফিকেশন গেটওয়ে (Green API, UltraMsg, WPPConnect বা আপনার লোকাল সার্ভার) এর URL দিন। সিগন্যাল তৈরি হলে সরাসরি JSON পে-লোড পোস্ট করা হবে।
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Webhook Endpoint URL
                </label>
                <input
                  type="url"
                  placeholder="https://api.yourgateway.com/send-whatsapp-message"
                  value={config.webhook.webhookUrl}
                  onChange={(e) => handleWebhookChange('webhookUrl', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    HTTP Method
                  </label>
                  <select
                    value={config.webhook.httpMethod}
                    onChange={(e) => handleWebhookChange('httpMethod', e.target.value as 'POST' | 'GET')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="POST">POST (JSON Body Payload)</option>
                    <option value="GET">GET (URL Query Param)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Bearer Token / API Key (ঐচ্ছিক)
                  </label>
                  <input
                    type="password"
                    placeholder="Bearer token or secret..."
                    value={config.webhook.authToken}
                    onChange={(e) => handleWebhookChange('authToken', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Custom Header Name (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. x-api-key"
                    value={config.webhook.customHeaderName}
                    onChange={(e) => handleWebhookChange('customHeaderName', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Custom Header Value (ঐচ্ছিক)
                  </label>
                  <input
                    type="password"
                    placeholder="Secret header value..."
                    value={config.webhook.customHeaderValue}
                    onChange={(e) => handleWebhookChange('customHeaderValue', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Test Dispatch Button */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSendTestAlert}
              disabled={testing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span>পাঠানো হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>টেস্ট মেসেজ পাঠান (Send Test Alert)</span>
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                  testResult.ok
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="truncate max-w-xs">{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Form: Filter Settings & Live WhatsApp Preview */}
        <div className="lg:col-span-5 space-y-5">
          {/* Filters & Rules */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">সিগন্যাল ফিল্টার ও নিরাপত্তা নীতি</h4>
              </div>
            </div>

            {/* Minimum Pattern Score Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300">ন্যূনতম কনফিডেন্স / প্যাটার্ন স্কোর:</span>
                <span className="font-mono font-bold text-emerald-400">{config.filters.minConfidence}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={config.filters.minConfidence}
                onChange={(e) => handleFilterChange('minConfidence', Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-850 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>50% (নমনীয়)</span>
                <span>75% (প্রস্তাবিত)</span>
                <span>95% (কঠোর)</span>
              </div>
            </div>

            {/* Allowed Directions */}
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">সিগন্যালের ধরন নির্বাচন:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'ALL', label: 'সকল (CALL & PUT)' },
                  { id: 'CALL_ONLY', label: 'শুধু CALL (Buy)' },
                  { id: 'PUT_ONLY', label: 'শুধু PUT (Sell)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleFilterChange('allowedDirections', item.id)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                      config.filters.allowedDirections === item.id
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert Sources */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.filters.includeTechnicalSignals}
                  onChange={(e) => handleFilterChange('includeTechnicalSignals', e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950 w-4 h-4"
                />
                <span>টেকনিক্যাল মার্কেট স্ক্যানার সিগন্যাল অন্তর্ভুক্ত করুন</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.filters.includeScreenAnalysis}
                  onChange={(e) => handleFilterChange('includeScreenAnalysis', e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950 w-4 h-4"
                />
                <span>AI লাইভ স্ক্রিন বিশ্লেষণ (Vision) সিগন্যাল অন্তর্ভুক্ত করুন</span>
              </label>
            </div>

            {/* Cooldown Timer */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300">অ্যান্টি-স্প্যাম কুলডাউন সময়:</span>
                <span className="font-mono text-cyan-400">{config.filters.cooldownSeconds} সেকেন্ড</span>
              </div>
              <select
                value={config.filters.cooldownSeconds}
                onChange={(e) => handleFilterChange('cooldownSeconds', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value={30}>৩০ সেকেন্ড (দ্রুততম)</option>
                <option value={60}>৬০ সেকেন্ড (প্রস্তাবিত)</option>
                <option value={120}>২ মিনিট (মাঝারি)</option>
                <option value={300}>৫ মিনিট (শান্ত)</option>
              </select>
            </div>
          </div>

          {/* Realistic WhatsApp Chat Bubble Preview */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-white">মেসেজ প্রিভিউ (WhatsApp Chat)</h4>
              </div>
              <button
                type="button"
                onClick={copySampleText}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                {copiedSample ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSample ? 'কপি হয়েছে' : 'কপি টেক্সট'}</span>
              </button>
            </div>

            {/* Simulated WhatsApp Bubble */}
            <div className="bg-[#0b141a] p-3.5 rounded-2xl border border-emerald-500/20 shadow-inner text-slate-200">
              <div className="bg-[#005c4b]/80 p-3 rounded-xl rounded-tl-none text-[11px] font-sans leading-relaxed text-white space-y-1 shadow">
                <div className="font-bold flex items-center justify-between border-b border-emerald-400/20 pb-1 mb-1">
                  <span>🤖 TradePulse AI Agent — Trade Alert</span>
                  <span className="text-[9px] text-emerald-200 font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="font-mono text-emerald-100">
                  🎯 <strong className="text-white">BTC/USDT</strong> (1m) · 📈 🟢 <strong className="text-emerald-200">CALL (BUY)</strong>
                </div>
                <div className="text-[10px] text-emerald-100">
                  💰 Entry: 68,450.20 · ⭐ Score: 84% (4/5)
                </div>
                <div className="text-[10px] text-slate-200/90 pt-1">
                  🔍 Triggers: EMA 9 &gt; EMA 21, RSI 58.4 Bullish, Support Holds
                </div>
                <div className="text-[9px] text-emerald-300/80 pt-1 italic border-t border-emerald-400/20 mt-1">
                  ⚠️ Educational paper analysis only. Zero broker execution.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Sent Alert History & Execution Log */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">সাম্প্রতিক প্রেরিত WhatsApp অ্যালার্ট লগ</h4>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {logs.length} টি রেকর্ড
            </span>
          </div>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>লগ মুছুন</span>
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            এখনো কোনো WhatsApp অ্যালার্ট পাঠানো হয়নি। ওপরের "টেস্ট মেসেজ পাঠান" বোতামে ক্লিক করে পরীক্ষা করতে পারেন।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">সময়</th>
                  <th className="py-2 px-3">ধরন</th>
                  <th className="py-2 px-3">অ্যাসেট</th>
                  <th className="py-2 px-3">দিক</th>
                  <th className="py-2 px-3">প্রোভাইডার</th>
                  <th className="py-2 px-3">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {log.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-white">{log.symbol}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          log.direction === 'CALL' || log.direction === 'UP'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : log.direction === 'PUT' || log.direction === 'DOWN'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {log.direction}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{log.provider.toUpperCase()}</td>
                    <td className="py-2 px-3">
                      {log.status === 'SENT' ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SENT
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1" title={log.error}>
                          <AlertTriangle className="w-3.5 h-3.5" /> FAILED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
