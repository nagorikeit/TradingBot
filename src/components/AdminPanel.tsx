import React, { useState, useEffect } from 'react';
import { User, SubscriptionRequest, PaymentGatewaysConfig } from '../types/authTypes';
import { authService, SUBSCRIPTION_PLANS } from '../services/authService';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Settings, 
  Clock, 
  DollarSign, 
  Calendar, 
  ShieldAlert, 
  RefreshCw, 
  Save, 
  Search,
  PlusCircle
} from 'lucide-react';

interface AdminPanelProps {
  onClose?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'settings'>('requests');
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
    instructionBn: ''
  });
  const [configSaved, setConfigSaved] = useState(false);

  // Manual Grant days state
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [grantDays, setGrantDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqs, usrs, cfg] = await Promise.all([
        authService.adminGetRequests(),
        authService.adminGetAllUsers(),
        authService.getPaymentConfig()
      ]);
      setRequests(reqs);
      setUsers(usrs);
      if (cfg) setPaymentConfig(cfg);
    } catch (err) {
      console.error('Admin fetchData error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleGrant = async () => {
    if (!grantUserId) return;
    setLoading(true);
    try {
      const ok = await authService.adminGrantAccess(grantUserId, grantDays);
      if (ok) {
        setGrantUserId(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Admin handleGrant error:', err);
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

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const filteredUsers = users.filter(u => 
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
            ইউজার সাবস্ক্রিপশন অনুমোদন, ম্যানুয়াল অ্যাক্সেস প্রদান এবং বিকাশ/নগদ পেমেন্ট গেটওয়ে কন্ট্রোল
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
      <div className="flex border-b border-zinc-800 mb-6">
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
          <span>সকল ইউজার ডিরেক্টরি ({users.length})</span>
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
                    <th className="p-3">প্ল্যান</th>
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
                        {req.planName} ({req.durationDays} দিন)
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

      {/* Tab 2: Users List & Manual Grant */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="ইউজার খুঁজুন (নাম, ইমেইল)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
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
                  <th className="p-3">রোল</th>
                  <th className="p-3">সাবস্ক্রিপশন স্ট্যাটাস</th>
                  <th className="p-3">প্যাকেজ</th>
                  <th className="p-3">মেয়াদ উত্তীর্ণ</th>
                  <th className="p-3 text-right">ম্যানুয়াল দিন প্রদান</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-900/30">
                {filteredUsers.map((u) => {
                  const isActive = u.role === 'admin' || (u.subscription?.status === 'ACTIVE' && (!u.subscription.expiresAt || Date.now() < u.subscription.expiresAt));
                  const daysLeft = u.role === 'admin' ? 9999 : (u.subscription?.expiresAt ? Math.ceil((u.subscription.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)) : 0);
                  return (
                    <tr key={u.id} className="hover:bg-zinc-800/30">
                      <td className="p-3">
                        <div className="font-semibold text-zinc-200">{u.name}</div>
                        <div className="text-[11px] text-zinc-400">{u.email}</div>
                        {u.phone && <div className="text-[10px] text-zinc-500">{u.phone}</div>}
                      </td>
                      <td className="p-3">
                        {u.role === 'admin' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            এডমিন 👑
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                            ইউজার
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>সক্রিয় ({daysLeft} দিন বাকি)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            <span>নিষ্ক্রিয় ({u.subscription?.status || 'NONE'})</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-zinc-300 font-medium">
                        {u.subscription?.planName || 'নাই'}
                      </td>
                      <td className="p-3 text-zinc-400 font-mono text-[11px]">
                        {u.role === 'admin'
                          ? 'আজীবন (Lifetime)'
                          : u.subscription?.expiresAt
                            ? new Date(u.subscription.expiresAt).toLocaleDateString('bn-BD')
                            : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => {
                              setGrantUserId(u.id);
                              setGrantDays(30);
                            }}
                            className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>দিন যোগ করুন</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Modal for manual grant */}
          {grantUserId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="w-full max-w-sm p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl">
                <h4 className="text-sm font-bold text-zinc-100 mb-2">
                  ইউজারের অ্যাক্সেস বৃদ্ধি করুন
                </h4>
                <p className="text-xs text-zinc-400 mb-4">
                  কত দিনের জন্য ভিআইপি অ্যাক্সেস সক্রিয় করতে চান তা নির্বাচন করুন:
                </p>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[7, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setGrantDays(d)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        grantDays === d
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      {d} দিন
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setGrantUserId(null)}
                    className="flex-1 py-2 text-xs rounded-xl bg-zinc-800 text-zinc-300"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleGrant}
                    className="flex-1 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-black shadow"
                  >
                    নিশ্চিত করুন
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Payment Gateway Settings */}
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
                onChange={e => setPaymentConfig({ ...paymentConfig, bkashNumber: e.target.value })}
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
                onChange={e => setPaymentConfig({ ...paymentConfig, nagadNumber: e.target.value })}
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
                onChange={e => setPaymentConfig({ ...paymentConfig, rocketNumber: e.target.value })}
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
                onChange={e => setPaymentConfig({ ...paymentConfig, binanceNetwork: e.target.value })}
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
              onChange={e => setPaymentConfig({ ...paymentConfig, binanceUsdtAddress: e.target.value })}
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
              onChange={e => setPaymentConfig({ ...paymentConfig, instructionBn: e.target.value })}
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
