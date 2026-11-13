import React, { useEffect, useState } from 'react';
import {
  Plug,
  PlugZap,
  RefreshCw,
  Edit3,
  Plus,
  Trash2,
  Search,
  Activity,
  CheckCircle2,
  XCircle,
  Globe,
  Shield,
  Terminal,
  Bell,
  Database,
  Play,
  RotateCcw,
  Save,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ApiCategory, ApiEndpointItem, ApiHttpMethod } from '../types/apiHubTypes';
import { apiHubService } from '../services/apiHubService';
import { getCustomApiUrl, setCustomApiUrl } from '../services/apiConfig';

const CATEGORY_LABELS: Record<'ALL' | ApiCategory, string> = {
  ALL: 'সব API',
  MARKET_DATA: 'মার্কেট এক্সচেঞ্জ',
  BACKEND_AI: 'ভিশন ও ব্যাকএন্ড',
  AUTH_CLOUD: 'অথ ও ক্লাউড DB',
  NOTIFICATIONS: 'অ্যালার্ট ও ওয়েবহুক',
  CUSTOM: 'কাস্টম API',
};

const METHOD_COLORS: Record<ApiHttpMethod, string> = {
  GET: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  POST: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  PUT: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DELETE: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  CLOUD: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

export const ApiHubView: React.FC = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpointItem[]>(() => apiHubService.getItems());
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ApiCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [testingAll, setTestingAll] = useState(false);
  const [backendGatewayInput, setBackendGatewayInput] = useState(() => getCustomApiUrl());
  const [gatewaySavedMsg, setGatewaySavedMsg] = useState<string | null>(null);
  const [expandedResponseId, setExpandedResponseId] = useState<string | null>(null);

  // Edit / Add modal state
  const [editingItem, setEditingItem] = useState<ApiEndpointItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ApiCategory>('CUSTOM');
  const [formMethod, setFormMethod] = useState<ApiHttpMethod>('GET');
  const [formUrl, setFormUrl] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [formTimeout, setFormTimeout] = useState(6000);
  const [formDescription, setFormDescription] = useState('');
  const [formSampleBody, setFormSampleBody] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);

  useEffect(() => {
    const unsub = apiHubService.subscribe((items) => {
      setEndpoints(items);
    });
    return () => unsub();
  }, []);

  const openEditModal = (item: ApiEndpointItem) => {
    setIsCreatingNew(false);
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormMethod(item.method);
    setFormUrl(item.url);
    setFormBaseUrl(item.baseUrl || '');
    setFormTimeout(item.timeoutMs || 6000);
    setFormDescription(item.description || '');
    setFormSampleBody(item.sampleBody || '');
    setFormEnabled(item.enabled);
    setFormError(null);
  };

  const openCreateModal = () => {
    setIsCreatingNew(true);
    setEditingItem(null);
    setFormName('');
    setFormCategory('CUSTOM');
    setFormMethod('GET');
    setFormUrl('https://');
    setFormBaseUrl('');
    setFormTimeout(6000);
    setFormDescription('');
    setFormSampleBody('');
    setFormEnabled(true);
    setFormError(null);
  };

  const closeModal = () => {
    setEditingItem(null);
    setIsCreatingNew(false);
    setFormError(null);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) {
      setFormError('API নাম এবং URL / Endpoint অবশ্যই দিতে হবে।');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (isCreatingNew) {
        await apiHubService.addCustomEndpoint({
          name: formName,
          category: formCategory,
          method: formMethod,
          url: formUrl,
          baseUrl: formBaseUrl,
          description: formDescription || 'কাস্টম API ইন্টিগ্রেশন',
          timeoutMs: Number(formTimeout) || 6000,
          sampleBody: formSampleBody || undefined,
        });
      } else if (editingItem) {
        const updated: ApiEndpointItem = {
          ...editingItem,
          name: formName.trim(),
          category: formCategory,
          method: formMethod,
          url: formUrl.trim(),
          baseUrl: formBaseUrl.trim(),
          timeoutMs: Math.min(120000, Math.max(500, Number(formTimeout) || 6000)),
          description: formDescription.trim(),
          sampleBody: formSampleBody.trim() || undefined,
          enabled: formEnabled,
        };
        await apiHubService.saveEndpoint(updated);
        if (updated.isBackendGateway) {
          setBackendGatewayInput(updated.baseUrl || '');
        }
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGatewayUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiUrl(backendGatewayInput);
    const gatewayItem = endpoints.find((i) => i.isBackendGateway);
    if (gatewayItem) {
      await apiHubService.saveEndpoint({ ...gatewayItem, baseUrl: backendGatewayInput.trim() });
      await apiHubService.testEndpoint(gatewayItem.id);
    }
    setGatewaySavedMsg('সার্ভার গেটওয়ে URL সেভ ও টেস্ট করা হয়েছে');
    setTimeout(() => setGatewaySavedMsg(null), 3000);
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    try {
      await apiHubService.testAllEndpoints();
    } finally {
      setTestingAll(false);
    }
  };

  const handleTestSingle = async (id: string) => {
    await apiHubService.testEndpoint(id);
    setExpandedResponseId(id);
  };

  const filteredEndpoints = endpoints.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.url.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const connectedCount = endpoints.filter((e) => e.enabled && e.lastStatus !== 'ERROR').length;
  const errorCount = endpoints.filter((e) => e.lastStatus === 'ERROR').length;

  const getCategoryIcon = (cat: ApiCategory) => {
    switch (cat) {
      case 'MARKET_DATA':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'BACKEND_AI':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'AUTH_CLOUD':
        return <Database className="w-4 h-4 text-purple-400" />;
      case 'NOTIFICATIONS':
        return <Bell className="w-4 h-4 text-amber-400" />;
      default:
        return <Globe className="w-4 h-4 text-slate-300" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Global Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <PlugZap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span>API কন্ট্রোল ও ইন্টিগ্রেশন হাব</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                    {endpoints.length} APIs
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  অ্যাপ্লিকেশনের সব মার্কেট, এআই ভিশন, ক্লাউড ডাটাবেস ও ওয়েবহুক API এক জায়গা থেকে দেখুন, কানেক্ট করুন ও এডিট করুন
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestAll}
              disabled={testingAll}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingAll ? 'animate-spin' : ''}`} />
              <span>{testingAll ? 'সব API টেস্ট হচ্ছে...' : 'সবগুলো টেস্ট করুন'}</span>
            </button>

            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন API যোগ করুন</span>
            </button>

            <button
              onClick={() => apiHubService.resetAllToDefault()}
              title="ডিফল্ট API কনফিগারেশনে ফিরুন"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>রিসেট</span>
            </button>
          </div>
        </div>

        {/* Metrics & Backend Base URL Override Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-5 pt-5 border-t border-slate-800/80 items-center">
          <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-slate-400">মোট API</div>
              <div className="text-lg font-bold text-white font-mono mt-0.5">{endpoints.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/20">
              <div className="text-[11px] text-emerald-400">সক্রিয় / কানেক্টেড</div>
              <div className="text-lg font-bold text-emerald-300 font-mono mt-0.5">{connectedCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/20">
              <div className="text-[11px] text-rose-400">ত্রুটি (Error)</div>
              <div className="text-lg font-bold text-rose-300 font-mono mt-0.5">{errorCount}</div>
            </div>
          </div>

          <form onSubmit={handleSaveGatewayUrl} className="lg:col-span-7 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="flex-1">
              <label className="block text-[11px] text-slate-400 mb-1">
                গ্লোবাল ব্যাকএন্ড API গেটওয়ে বেজ URL (ফাঁকা রাখলে ডিফল্ট ওয়েব সার্ভার ব্যবহৃত হবে):
              </label>
              <input
                type="text"
                value={backendGatewayInput}
                onChange={(e) => setBackendGatewayInput(e.target.value)}
                placeholder="যেমন: https://your-backend-server.com (অ্যান্ড্রয়েড বা কাস্টম সার্ভারের জন্য)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              className="sm:mt-5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>সেভ ও টেস্ট</span>
            </button>
          </form>
        </div>

        {gatewaySavedMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{gatewaySavedMsg}</span>
          </div>
        )}
      </div>

      {/* Category Filter & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(CATEGORY_LABELS) as Array<'ALL' | ApiCategory>).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="API নাম বা URL খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* API Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredEndpoints.map((item) => {
          const isTesting = item.lastStatus === 'TESTING';
          const isError = item.lastStatus === 'ERROR';
          const isConnected = item.enabled && !isError;
          const isExpanded = expandedResponseId === item.id;

          return (
            <div
              key={item.id}
              className={`bg-slate-900/90 border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                !item.enabled
                  ? 'border-slate-800/70 opacity-75'
                  : isError
                    ? 'border-rose-500/40'
                    : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Row: Name + Status */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                            METHOD_COLORS[item.method]
                          }`}
                        >
                          {item.method}
                        </span>
                        <h3 className="text-sm font-bold text-white truncate">{item.name}</h3>
                        {item.isCustom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            CUSTOM
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Status pill */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {isTesting ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>টেস্ট হচ্ছে</span>
                      </span>
                    ) : !item.enabled ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-semibold">
                        ডিসকানেক্টেড
                      </span>
                    ) : isError ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-semibold flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>ত্রুটি</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>কানেক্টেড</span>
                      </span>
                    )}

                    {typeof item.lastLatencyMs === 'number' && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.lastLatencyMs} ms {item.lastHttpCode ? `· HTTP ${item.lastHttpCode}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Endpoint URL box */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 mb-3">
                  <div className="text-[11px] font-mono text-cyan-300 break-all select-all">
                    {item.baseUrl ? `${item.baseUrl}${item.url}` : item.url}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-[10px] text-slate-500">
                    <span>Timeout: {item.timeoutMs} ms</span>
                    {item.isServerProxyManaged && (
                      <span className="flex items-center gap-1 text-emerald-400/90">
                        <Shield className="w-3 h-3" />
                        <span>সার্ভার প্রক্সি দ্বারা সুরক্ষিত</span>
                      </span>
                    )}
                    {item.exchangeMode && (
                      <span className="text-amber-300/90">
                        এক্সচেঞ্জ ফিড: {item.exchangeMode}
                      </span>
                    )}
                  </div>
                </div>

                {item.lastError && (
                  <div className="mb-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono">
                    Error: {item.lastError}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => apiHubService.toggleConnect(item.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                      isConnected
                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Plug className="w-3.5 h-3.5" />
                    <span>{item.enabled ? 'ডিসকানেক্ট' : 'কানেক্ট করুন'}</span>
                  </button>

                  <button
                    onClick={() => handleTestSingle(item.id)}
                    disabled={isTesting}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    <span>টেস্ট</span>
                  </button>

                  <button
                    onClick={() => openEditModal(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>এডিট</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.lastResponsePreview && (
                    <button
                      onClick={() => setExpandedResponseId(isExpanded ? null : item.id)}
                      className="px-2 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1"
                    >
                      <span>রেসপন্স</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}

                  {item.isCustom && (
                    <button
                      onClick={() => apiHubService.deleteCustomEndpoint(item.id)}
                      title="কাস্টম API ডিলিট করুন"
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable Live Response Drawer */}
              {isExpanded && item.lastResponsePreview && (
                <div className="mt-3 p-3 rounded-xl bg-black/60 border border-slate-800 text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-48">
                  <pre className="whitespace-pre-wrap break-all">{item.lastResponsePreview}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit API Modal */}
      {(editingItem || isCreatingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 md:p-6 text-slate-100 my-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>{isCreatingNew ? 'নতুন API এন্ডপয়েন্ট যোগ করুন' : 'API কনফিগারেশন এডিট করুন'}</span>
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">API নাম</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="যেমন: Custom Signal Webhook"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">ক্যাটাগরি</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ApiCategory)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MARKET_DATA">মার্কেট এক্সচেঞ্জ</option>
                    <option value="BACKEND_AI">ভিশন ও ব্যাকএন্ড</option>
                    <option value="AUTH_CLOUD">অথ ও ক্লাউড DB</option>
                    <option value="NOTIFICATIONS">অ্যালার্ট ও ওয়েবহুক</option>
                    <option value="CUSTOM">কাস্টম API</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">HTTP Method</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as ApiHttpMethod)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="CLOUD">CLOUD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  এন্ডপয়েন্ট URL / পাথ
                </label>
                <input
                  type="text"
                  required
                  maxLength={500}
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://... অথবা /api/..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    বেজ URL ওভাররাইড (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="https://custom-host.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    টাইমআউট (ms)
                  </label>
                  <input
                    type="number"
                    min={500}
                    max={120000}
                    value={formTimeout}
                    onChange={(e) => setFormTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">বর্ণনা</label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="এই API কী কাজে ব্যবহৃত হয়..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {formMethod !== 'GET' && formMethod !== 'CLOUD' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    টেস্ট পেলোড (JSON Body - ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={formSampleBody}
                    onChange={(e) => setFormSampleBody(e.target.value)}
                    placeholder='{ "key": "value" }'
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-300 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>API সক্রিয় (Connected) রাখুন</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'সেভ হচ্ছে...' : 'পরিবর্তন সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
