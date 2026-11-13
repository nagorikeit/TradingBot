import React, { useState, useEffect } from 'react';
import {
  User,
  SubscriptionRequest,
  PaymentGatewaysConfig,
  PlanSettingsConfig,
} from '../types/authTypes';
import { authService, DEFAULT_PLAN_SETTINGS } from '../services/authService';
import {
  Users,
  CheckCircle2,
  Settings,
  Clock,
  RefreshCw,
  Save,
  Search,
  Sliders,
  Edit3,
  RotateCcw,
} from 'lucide-react';

interface AdminPanelProps {
  onClose?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'plans' | 'settings'>('requests');
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewaysConfig>({
    bkashNumber: '',
    bkashType: '',
    nagadNumber: '',
    nagadType: '',
    rocketNumber: '',
    binanceUsdtAddress: '',
    binanceNetwork: '',
    instructionBn: '',
  });
  const [planSettings, setPlanSettings] = useState<PlanSettingsConfig>(
    () => authService.getPlanSettings() || DEFAULT_PLAN_SETTINGS
  );
  const [configSaved, setConfigSaved] = useState(false);
  const [plansSaved, setPlansSaved] = useState(false);

  // Per-User Access & Scan Quota Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editAddDays, setEditAddDays] = useState<number>(0);
  const [editFreeLimit, setEditFreeLimit] = useState<number>(5);
  const [editCustomDailyLimit, setEditCustomDailyLimit] = useState<number>(-1);
  const [editPlanDailyLimit, setEditPlanDailyLimit] = useState<number>(200);
  const [editResetFree, setEditResetFree] = useState<boolean>(false);
  const [editResetDaily, setEditResetDaily] = useState<boolean>(false);
  const [editRevokeSub, setEditRevokeSub] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqs, usrs, cfg, pCfg] = await Promise.all([
        authService.adminGetRequests(),
        authService.adminGetAllUsers(),
        authService.getPaymentConfig(),
        authService.fetchPlanSettings(),
      ]);
      setRequests(reqs);
      setUsers(usrs);
      if (cfg) setPaymentConfig(cfg);
      if (pCfg) setPlanSettings(pCfg);
    } catch (err) {
      console.error('Admin fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setEditAddDays(0);
    setEditFreeLimit(u.scanQuota?.freeScansLimit ?? planSettings.freeTrialScans);
    setEditCustomDailyLimit(u.scanQuota?.customDailyScanLimit ?? -1);
    setEditPlanDailyLimit(u.scanQuota?.dailyScanLimit ?? u.subscription?.dailyScanLimit ?? 200);
    setEditResetFree(false);
    setEditResetDaily(false);
    setEditRevokeSub(false);
  };

  const handleSaveUserQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    try {
      const ok = await authService.adminUpdateUserQuota(editingUser.id, {
        addDays: editAddDays > 0 ? editAddDays : undefined,
        freeScansLimit: editFreeLimit,
        customDailyScanLimit: editCustomDailyLimit,
        dailyScanLimit: editPlanDailyLimit,
        resetFreeScans: editResetFree,
        resetDailyScans: editResetDaily,
        revokeSubscription: editRevokeSub,
      });
      if (ok) {
        setEditingUser(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Admin handleSaveUserQuota error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      const success = await authService.adminReviewRequest(requestId, action);
      if (success) {
        await fetchData();
      }
    } catch (err) {
      console.error('Admin handleReview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlanSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await authService.adminUpdatePlanSettings(planSettings);
      if (ok) {
        setPlansSaved(true);
        setTimeout(() => setPlansSaved(false), 3000);
      }
    } catch (err) {
      console.error('Admin save plans error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await authService.adminUpdatePaymentConfig(paymentConfig);
      if (ok) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2500);
      }
    } catch (err) {
      console.error('Admin save config error:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery))
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 bg-zinc-950/80 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-md text-zinc-100 my-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              অ্যাডমিন কন্ট্রোল সেন্টার (Admin Control Center)
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            ইউজার সাবস্ক্রিপশন অনুমোদন, ফ্রি ও দৈনিক স্ক্যান লিমিট এডিট এবং পেমেন্ট গেটওয়ে কন্ট্রোল
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>রিফ্রেশ</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"
            >
              বন্ধ করুন
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-zinc-800 mb-6">
        <button
          onClick={() => setActiveTab('requests')}
          className={`relative px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'requests'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>পেন্ডিং অনুমোদন</span>
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'users'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ইউজার ও স্ক্যান কোটা ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'plans'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>প্ল্যান ও স্ক্যান লিমিট</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'settings'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>পেমেন্ট গেটওয়ে সেটিংস</span>
        </button>
      </div>

      {/* Tab 1: Pending & All Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <span>পেন্ডিং পেমেন্ট রিকোয়েস্ট সমূহ</span>
              <span className="text-xs text-zinc-500 font-normal">
                (বিকাশ, নগদ বা বাইন্যান্সের TrxID মিলিয়ে এক ক্লিকে এক্টিভ করুন)
              </span>
            </h3>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-500 text-xs">
              এখনও কোনো পেমেন্ট রিকোয়েস্ট আসেনি। ইউজার সাবমিট করলে এখানে দৃশ্যমান হবে।
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="p-3">ইউজার / কন্টাক্ট</th>
                    <th className="p-3">প্ল্যান ও লিমিট</th>
                    <th className="p-3">পদ্ধতি</th>
                    <th className="p-3">প্রেরক নম্বর</th>
                    <th className="p-3">TrxID / Hash</th>
                    <th className="p-3">মূল্য</th>
                    <th className="p-3">স্ট্যাটাস</th>
                    <th className="p-3 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                  {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-zinc-800/30">
                      <td className="p-3">
                        <div className="font-semibold text-zinc-200">{req.userName}</div>
                        <div className="text-[11px] text-zinc-400">{req.userEmail}</div>
                      </td>
                      <td className="p-3 font-medium text-emerald-400">
                        <div>{req.planName} ({req.durationDays} দিন)</div>
                        {typeof req.dailyScanLimit === 'number' && (
                          <div className="text-[10px] text-cyan-300">
                            দৈনিক সীমা: {req.dailyScanLimit === 0 ? 'আনলিমিটেড' : `${req.dailyScanLimit}টি`}
                          </div>
                        )}
                      </td>
                      <td className="p-3 uppercase font-mono font-bold text-zinc-300">
                        {req.paymentMethod}
                      </td>
                      <td className="p-3 font-mono text-zinc-300">{req.senderNumber}</td>
                      <td className="p-3 font-mono font-bold text-amber-300 select-all">
                        {req.trxId}
                      </td>
                      <td className="p-3 font-semibold text-zinc-200">
                        ৳{req.priceBdt} / ${req.priceUsdt}
                      </td>
                      <td className="p-3">
                        {req.status === 'PENDING' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[10px]">
                            অপেক্ষমান
                          </span>
                        )}
                        {req.status === 'APPROVED' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-[10px]">
                            অনুমোদিত
                          </span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-[10px]">
                            বাতিল
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReview(req.id, 'approve')}
                              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] flex items-center gap-1 shadow"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>অনুমোদন দিন</span>
                            </button>
                            <button
                              onClick={() => handleReview(req.id, 'reject')}
                              className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] border border-rose-500/30"
                            >
                              বাতিল
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-[11px]">সম্পন্ন</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Users List & Per-User Quota Editor */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="ইউজার খুঁজুন (নাম, ইমেইল)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-xs text-zinc-400">
              মোট ইউজার: <strong className="text-zinc-200">{users.length}</strong>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="p-3">ইউজার</th>
                  <th className="p-3">সাবস্ক্রিপশন</th>
                  <th className="p-3">ফ্রি স্ক্যান</th>
                  <th className="p-3">আজকের স্ক্যান</th>
                  <th className="p-3">মোট স্ক্যান</th>
                  <th className="p-3">মেয়াদ</th>
                  <th className="p-3 text-right">অ্যাক্সেস / কোটা এডিট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                {filteredUsers.map((u) => {
                  const isActive =
                    u.role === 'admin' ||
                    (u.subscription?.status === 'ACTIVE' &&
                      (!u.subscription.expiresAt || Date.now() < u.subscription.expiresAt));
                  const daysLeft =
                    u.role === 'admin'
                      ? 9999
                      : u.subscription?.expiresAt
                      ? Math.max(0, Math.ceil((u.subscription.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
                      : 0;
                  const q = u.scanQuota;
                  const freeUsed = q?.freeScansUsed ?? 0;
                  const freeLimit = q?.freeScansLimit ?? planSettings.freeTrialScans;
                  const dailyUsed = q?.dailyScansUsed ?? 0;
                  const effDailyLimit =
                    q && q.customDailyScanLimit >= 0
                      ? q.customDailyScanLimit
                      : q?.dailyScanLimit ?? u.subscription?.dailyScanLimit ?? 0;
                  const totalUsed = q?.totalScansUsed ?? 0;

                  return (
                    <tr key={u.id} className="hover:bg-zinc-800/30">
                      <td className="p-3">
                        <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {u.role === 'admin' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30">
                              এডমিন 👑
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">{u.email}</div>
                      </td>
                      <td className="p-3">
                        {isActive ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>{u.role === 'admin' ? 'মাস্টার' : `সক্রিয় (${daysLeft}d)`}</span>
                            </span>
                            <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[140px]">
                              {u.subscription?.planName || 'VIP'}
                            </div>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            <span>ফ্রি ট্রায়াল ({u.subscription?.status || 'NONE'})</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-cyan-300">
                        {u.role === 'admin' ? '∞' : `${freeUsed} / ${freeLimit}`}
                      </td>
                      <td className="p-3 font-mono text-emerald-300">
                        {u.role === 'admin'
                          ? `${dailyUsed} / ∞`
                          : `${dailyUsed} / ${effDailyLimit === 0 ? '∞' : effDailyLimit}`}
                      </td>
                      <td className="p-3 font-mono text-zinc-300">{totalUsed}</td>
                      <td className="p-3 text-zinc-400 font-mono text-[11px]">
                        {u.role === 'admin'
                          ? 'আজীবন'
                          : u.subscription?.expiresAt
                          ? new Date(u.subscription.expiresAt).toLocaleDateString('bn-BD')
                          : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>এডিট / কোটা</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Modal for comprehensive Per-User Quota & Subscription Edit */}
          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
              <form
                onSubmit={handleSaveUserQuota}
                className="w-full max-w-md p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl space-y-4 my-auto"
              >
                <div className="border-b border-zinc-800 pb-3">
                  <h4 className="text-sm font-bold text-zinc-100">
                    ইউজার অ্যাক্সেস ও স্ক্যান কোটা এডিট
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {editingUser.name} ({editingUser.email})
                  </p>
                </div>

                {/* Add Subscription Days */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-amber-300">
                    মেয়াদ (দিন) যোগ করুন (০ দিলে অপরিবর্তিত থাকবে):
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 7, 30, 90, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setEditAddDays(d)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          editAddDays === d
                            ? 'bg-amber-500 text-black border-amber-400'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        {d === 0 ? 'না' : `+${d}d`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={36500}
                    value={editAddDays}
                    onChange={(e) => setEditAddDays(Math.max(0, Number(e.target.value)))}
                    placeholder="কাস্টম দিন লিখুন"
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono"
                  />
                </div>

                {/* Free Scans Limit & Reset */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                  <div>
                    <label className="block text-[11px] font-medium text-cyan-300 mb-1">
                      ফ্রি স্টার্টার স্ক্যান লিমিট
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={editFreeLimit}
                      onChange={(e) => setEditFreeLimit(Math.max(0, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 font-mono"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={() => setEditResetFree((prev) => !prev)}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                        editResetFree
                          ? 'bg-cyan-500 text-black border-cyan-400'
                          : 'bg-zinc-900 text-cyan-300 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{editResetFree ? 'ফ্রি রিসেট হবে (0)' : 'ফ্রি কাউন্ট রিসেট (0)'}</span>
                    </button>
                  </div>
                </div>

                {/* Daily Scan Limit Override & Reset */}
                <div className="space-y-2.5 p-3 rounded-xl bg-zinc-950/70 border border-zinc-800">
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-300 mb-1">
                      কাস্টম দৈনিক স্ক্যান লিমিট (-1 = প্ল্যান ডিফল্ট, 0 = আনলিমিটেড):
                    </label>
                    <input
                      type="number"
                      min={-1}
                      max={100000}
                      value={editCustomDailyLimit}
                      onChange={(e) => setEditCustomDailyLimit(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 font-mono"
                    />
                  </div>

                  {editAddDays > 0 && (
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        নতুন প্ল্যান দৈনিক লিমিট (0 = আনলিমিটেড):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={editPlanDailyLimit}
                        onChange={(e) => setEditPlanDailyLimit(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 font-mono"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditResetDaily((prev) => !prev)}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                        editResetDaily
                          ? 'bg-emerald-500 text-black border-emerald-400'
                          : 'bg-zinc-900 text-emerald-300 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{editResetDaily ? 'আজকের লিমিট রিসেট হবে' : 'আজকের স্ক্যান রিসেট (0)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditRevokeSub((prev) => !prev)}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border ${
                        editRevokeSub
                          ? 'bg-rose-500 text-white border-rose-400'
                          : 'bg-zinc-900 text-rose-300 border-rose-500/30 hover:bg-rose-950/50'
                      }`}
                    >
                      {editRevokeSub ? 'সাবস্ক্রিপশন বাতিল হবে' : 'সাবস্ক্রিপশন বাতিল'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-2 text-xs rounded-xl bg-zinc-800 text-zinc-300"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-black shadow"
                  >
                    সেভ করুন
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Plans & Hybrid Scan Quota Editor */}
      {activeTab === 'plans' && (
        <form onSubmit={handleSavePlanSettings} className="space-y-6">
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-cyan-300">
                🎁 নতুন একাউন্ট ফ্রি স্টার্টার স্ক্যান লিমিট
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                নতুন প্রতিটি ব্যবহারকারী একাউন্ট খোলার পর কতটি ফ্রি স্ক্যান পাবে তা এখান থেকে নির্ধারণ করুন (ডিফল্ট: ৫টি)।
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={0}
                max={1000}
                value={planSettings.freeTrialScans}
                onChange={(e) =>
                  setPlanSettings({
                    ...planSettings,
                    freeTrialScans: Math.max(0, Number(e.target.value)),
                  })
                }
                className="w-24 px-3 py-2 bg-zinc-950 border border-cyan-500/50 rounded-xl text-sm font-bold font-mono text-cyan-300 text-center"
              />
              <span className="text-xs text-zinc-300">টি ফ্রি স্ক্যান</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan 1: 7 Days Trial */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-emerald-400">প্যাকেজ ১ (Trial Pack)</div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">প্ল্যানের নাম</label>
                <input
                  type="text"
                  value={planSettings.trial7dName}
                  onChange={(e) => setPlanSettings({ ...planSettings, trial7dName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মেয়াদ (দিন)</label>
                  <input
                    type="number"
                    min={1}
                    value={planSettings.trial7dDays}
                    onChange={(e) => setPlanSettings({ ...planSettings, trial7dDays: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-cyan-300 mb-1">দৈনিক স্ক্যান (0=∞)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.trial7dDailyLimit}
                    onChange={(e) => setPlanSettings({ ...planSettings, trial7dDailyLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (BDT ৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.trial7dPriceBdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, trial7dPriceBdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (USDT $)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.trial7dPriceUsdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, trial7dPriceUsdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Plan 2: 1 Month VIP */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-emerald-400">প্যাকেজ ২ (Monthly VIP)</div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">প্ল্যানের নাম</label>
                <input
                  type="text"
                  value={planSettings.monthly1mName}
                  onChange={(e) => setPlanSettings({ ...planSettings, monthly1mName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মেয়াদ (দিন)</label>
                  <input
                    type="number"
                    min={1}
                    value={planSettings.monthly1mDays}
                    onChange={(e) => setPlanSettings({ ...planSettings, monthly1mDays: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-cyan-300 mb-1">দৈনিক স্ক্যান (0=∞)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.monthly1mDailyLimit}
                    onChange={(e) => setPlanSettings({ ...planSettings, monthly1mDailyLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (BDT ৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.monthly1mPriceBdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, monthly1mPriceBdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (USDT $)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.monthly1mPriceUsdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, monthly1mPriceUsdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Plan 3: 6 Months Elite */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-amber-400">প্যাকেজ ৩ (6 Months Elite)</div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">প্ল্যানের নাম</label>
                <input
                  type="text"
                  value={planSettings.vip6mName}
                  onChange={(e) => setPlanSettings({ ...planSettings, vip6mName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মেয়াদ (দিন)</label>
                  <input
                    type="number"
                    min={1}
                    value={planSettings.vip6mDays}
                    onChange={(e) => setPlanSettings({ ...planSettings, vip6mDays: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-cyan-300 mb-1">দৈনিক স্ক্যান (0=∞)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.vip6mDailyLimit}
                    onChange={(e) => setPlanSettings({ ...planSettings, vip6mDailyLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (BDT ৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.vip6mPriceBdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, vip6mPriceBdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (USDT $)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.vip6mPriceUsdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, vip6mPriceUsdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Plan 4: Lifetime VIP */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
              <div className="text-xs font-bold text-amber-300">প্যাকেজ ৪ (Lifetime VIP)</div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">প্ল্যানের নাম</label>
                <input
                  type="text"
                  value={planSettings.lifetimeName}
                  onChange={(e) => setPlanSettings({ ...planSettings, lifetimeName: e.target.value })}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মেয়াদ (দিন)</label>
                  <input
                    type="number"
                    min={1}
                    value={planSettings.lifetimeDays}
                    onChange={(e) => setPlanSettings({ ...planSettings, lifetimeDays: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-cyan-300 mb-1">দৈনিক স্ক্যান (0=∞)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.lifetimeDailyLimit}
                    onChange={(e) => setPlanSettings({ ...planSettings, lifetimeDailyLimit: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (BDT ৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.lifetimePriceBdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, lifetimePriceBdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">মূল্য (USDT $)</label>
                  <input
                    type="number"
                    min={0}
                    value={planSettings.lifetimePriceUsdt}
                    onChange={(e) => setPlanSettings({ ...planSettings, lifetimePriceUsdt: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>প্ল্যান ও স্ক্যান লিমিট সেভ করুন</span>
            </button>

            {plansSaved && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>সফলভাবে আপডেট ও সিঙ্ক হয়েছে!</span>
              </span>
            )}
          </div>
        </form>
      )}

      {/* Tab 4: Payment Gateway Settings */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSavePaymentConfig} className="max-w-2xl space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200">
            বিকাশ, নগদ, রকেট ও বাইন্যান্স পেমেন্ট অ্যাকাউন্ট কনফিগারেশন
          </h3>
          <p className="text-xs text-zinc-400">
            এখানে আপনার নিজের পার্সোনাল বা মার্চেন্ট নম্বর ও USDT ওয়ালেট অ্যাড্রেস লিখুন। ইউজাররা সাবস্ক্রিপশন স্ক্রিনে এই নম্বরগুলো দেখতে পাবে।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-pink-400 mb-1">
                বিকাশ নম্বর (bKash)
              </label>
              <input
                type="text"
                value={paymentConfig.bkashNumber}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, bkashNumber: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-400 mb-1">
                নগদ নম্বর (Nagad)
              </label>
              <input
                type="text"
                value={paymentConfig.nagadNumber}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, nagadNumber: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-purple-400 mb-1">
                রকেট নম্বর (Rocket)
              </label>
              <input
                type="text"
                value={paymentConfig.rocketNumber}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, rocketNumber: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-yellow-400 mb-1">
                বাইন্যান্স নেটওয়ার্ক (USDT Network)
              </label>
              <input
                type="text"
                value={paymentConfig.binanceNetwork}
                onChange={(e) => setPaymentConfig({ ...paymentConfig, binanceNetwork: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-yellow-400 mb-1">
              বাইন্যান্স USDT ওয়ালেট অ্যাড্রেস
            </label>
            <input
              type="text"
              value={paymentConfig.binanceUsdtAddress}
              onChange={(e) => setPaymentConfig({ ...paymentConfig, binanceUsdtAddress: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              ব্যবহারকারীদের জন্য নির্দেশনাবলি (বাংলা)
            </label>
            <textarea
              rows={2}
              value={paymentConfig.instructionBn}
              onChange={(e) => setPaymentConfig({ ...paymentConfig, instructionBn: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>পেমেন্ট সেটিংস সেভ করুন</span>
            </button>

            {configSaved && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>সফলভাবে সংরক্ষিত হয়েছে!</span>
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
