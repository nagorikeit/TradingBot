import React, { useState, useEffect } from 'react';
import {
  User,
  PaymentGatewaysConfig,
  PaymentMethodType,
  SubscriptionPlan,
  EffectiveScanQuotaStatus,
} from '../types/authTypes';
import { authService } from '../services/authService';
import {
  ShieldCheck,
  Sparkles,
  Clock,
  AlertTriangle,
  Check,
  RefreshCw,
  Send,
  Copy,
  LogOut,
  X,
  Zap,
} from 'lucide-react';

interface SubscriptionModalProps {
  user: User;
  quotaStatus?: EffectiveScanQuotaStatus;
  canClose?: boolean;
  blockReason?: string | null;
  onClose?: () => void;
  onLogout?: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  user,
  quotaStatus,
  canClose = false,
  blockReason,
  onClose,
  onLogout,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => authService.getPlans());
  const [selectedPlanId, setSelectedPlanId] = useState<string>('monthly_1m');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('bkash');
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewaysConfig>({
    bkashNumber: '01886888494',
    bkashType: 'Personal (Send Money)',
    nagadNumber: '01886888494',
    nagadType: 'Personal (Send Money)',
    rocketNumber: '018868884947',
    binanceUsdtAddress: 'TCZt7w9V2WvL9wLpYpQwerTyUiopASdfGh',
    binanceNetwork: 'TRC-20 (Tron Network)',
    instructionBn:
      'বিকাশ, নগদ, রকেট বা বাইন্যান্সের মাধ্যমে টাকা পাঠিয়ে নিচে প্রেরক নম্বর ও TrxID লিখে সাবমিট করুন।',
  });

  useEffect(() => {
    authService.getPaymentConfig().then((cfg) => {
      if (cfg) setPaymentConfig(cfg);
    });
    authService.fetchPlanSettings().catch(() => {});
    const unsubPlans = authService.subscribePlans((_settings, updatedPlans) => {
      setPlans(updatedPlans);
    });
    return unsubPlans;
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[1] || plans[0];
  const isPending = user.subscription?.status === 'PENDING';
  const freeLimit = quotaStatus?.freeLimit ?? 5;
  const freeRemaining = quotaStatus?.freeRemaining ?? 0;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senderNumber.trim().length < 3 || trxId.trim().length < 3) {
      setErrorMessage('সঠিক প্রেরক নম্বর/অ্যাকাউন্ট এবং কমপক্ষে ৩ অক্ষরের TrxID দিন');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.submitSubscription(
        selectedPlanId,
        paymentMethod,
        senderNumber.trim(),
        trxId.trim()
      );

      if (res.success) {
        setSuccessMessage(
          'আপনার সাবস্ক্রিপশন রিকোয়েস্ট অ্যাডমিনের কাছে পাঠানো হয়েছে! দ্রুততম সময়ে ভেরিফাই করে অ্যাক্সেস খুলে দেওয়া হবে।'
        );
      } else {
        setErrorMessage(res.error || 'রিকোয়েস্ট সাবমিট করা যায়নি');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'রিকোয়েস্ট সাবমিট করা যায়নি';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await authService.refreshProfile();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/90 backdrop-blur-md">
      <div className="flex min-h-full items-center justify-center p-3 md:p-6">
        <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 md:p-8 text-zinc-100">
        {/* Top bar with user info, optional close, & logout */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100 flex flex-wrap items-center gap-2">
                <span>{user.name}</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  {quotaStatus?.mode === 'PAID'
                    ? `ভিআইপি (${quotaStatus.daysRemaining} দিন বাকি)`
                    : freeRemaining > 0
                    ? `ফ্রি বাকি: ${freeRemaining}/${freeLimit}`
                    : 'ফ্রি স্ক্যান শেষ'}
                </span>
              </div>
              <div className="text-xs text-zinc-400">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>পরে কিনব</span>
              </button>
            )}

            <button
              type="button"
              onClick={onLogout || (() => authService.logout())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>

        {/* Status Announcement / Quota Exhaustion Banner */}
        {blockReason && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{blockReason}</span>
          </div>
        )}

        {isPending ? (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <h4 className="text-sm font-bold text-amber-300">
                  আপনার সাবস্ক্রিপশন রিকোয়েস্ট যাচাই চলছে (Pending Approval)
                </h4>
                <p className="text-xs text-zinc-300 mt-0.5">
                  প্যাকেজ: {user.subscription?.planName || 'ভিআইপি মেম্বারশিপ'} • মাধ্যম:{' '}
                  {user.subscription?.paymentMethod?.toUpperCase()} • TrxID: {user.subscription?.trxId}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  অ্যাডমিন ট্রানজেকশন মিলিয়ে অনুমোদন দিলে স্বয়ংক্রিয়ভাবে টার্মিনাল খুলে যাবে।
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>স্ট্যাটাস রিফ্রেশ করুন</span>
            </button>
          </div>
        ) : (
          <div className="mb-6 text-center max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>হাইব্রিড ভিআইপি সাবস্ক্রিপশন মেম্বারশিপ</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {freeRemaining === 0 && quotaStatus?.mode !== 'PAID'
                ? `আপনার ফ্রি ${freeLimit}টি স্ক্যান শেষ হয়েছে — ভিআইপি প্ল্যান বেছে নিন`
                : 'ট্রেডপালস প্রো ব্যবহার করতে ভিআইপি প্ল্যান আপগ্রেড করুন'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              প্রতিটি প্ল্যানে নির্ধারিত মেয়াদ (দিন) এবং উচ্চ দৈনিক স্ক্যান লিমিট রয়েছে (প্রতিদিন রাত ১২টায় লিমিট রিসেট হয়)।
            </p>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`relative cursor-pointer rounded-xl p-4 transition-all border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-zinc-800/90 border-emerald-400 shadow-lg shadow-emerald-500/10'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-bold tracking-tight shadow">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-bold text-zinc-100">{plan.name}</h3>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center text-black shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-xl font-extrabold text-emerald-400">৳{plan.priceBdt}</span>
                    <span className="text-xs text-zinc-400">/ ${plan.priceUsdt} USDT</span>
                  </div>

                  {/* Highlighted Duration & Daily Limit Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-[10px] font-semibold text-zinc-200">
                      📅 {plan.durationDays >= 3650 ? 'আজীবন' : `${plan.durationDays} দিন`}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-semibold text-cyan-300 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {plan.dailyScanLimit === 0 ? 'আনলিমিটেড/দিন' : `${plan.dailyScanLimit} স্ক্যান/দিন`}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-zinc-800/80">
                  {plan.features.slice(0, 3).map((feat, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment & Submission Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800">
          {/* Payment method selector & Account details */}
          <div className="md:col-span-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>১. পেমেন্ট মেথড বেছে নিন ও টাকা পাঠান</span>
            </h4>

            <div className="grid grid-cols-4 gap-2">
              {(['bkash', 'nagad', 'rocket', 'binance'] as PaymentMethodType[]).map((method) => {
                const isActive = paymentMethod === method;
                const labels: Record<PaymentMethodType, string> = {
                  bkash: 'bKash বিকাশ',
                  nagad: 'Nagad নগদ',
                  rocket: 'Rocket রকেট',
                  binance: 'Binance USDT',
                };
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {labels[method]}
                  </button>
                );
              })}
            </div>

            {/* Account Details Box */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2">
              {paymentMethod === 'bkash' && (
                <div>
                  <div className="text-[11px] text-zinc-400">বিকাশ পার্সোনাল নম্বর (Send Money):</div>
                  <div className="flex items-center justify-between mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="font-mono text-sm font-bold text-pink-400">{paymentConfig.bkashNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentConfig.bkashNumber, 'bkash')}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                    >
                      {copiedField === 'bkash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'bkash' ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    মোট প্রদেয়: <strong className="text-emerald-400">৳{selectedPlan.priceBdt}</strong> (বিকাশ সেন্ড মানি করুন)
                  </p>
                </div>
              )}

              {paymentMethod === 'nagad' && (
                <div>
                  <div className="text-[11px] text-zinc-400">নগদ পার্সোনাল নম্বর (Send Money):</div>
                  <div className="flex items-center justify-between mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="font-mono text-sm font-bold text-amber-400">{paymentConfig.nagadNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentConfig.nagadNumber, 'nagad')}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                    >
                      {copiedField === 'nagad' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'nagad' ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    মোট প্রদেয়: <strong className="text-emerald-400">৳{selectedPlan.priceBdt}</strong> (নগদ সেন্ড মানি করুন)
                  </p>
                </div>
              )}

              {paymentMethod === 'rocket' && (
                <div>
                  <div className="text-[11px] text-zinc-400">রকেট নম্বর (Send Money):</div>
                  <div className="flex items-center justify-between mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="font-mono text-sm font-bold text-purple-400">{paymentConfig.rocketNumber}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentConfig.rocketNumber, 'rocket')}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                    >
                      {copiedField === 'rocket' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'rocket' ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    মোট প্রদেয়: <strong className="text-emerald-400">৳{selectedPlan.priceBdt}</strong> (রকেট সেন্ড মানি করুন)
                  </p>
                </div>
              )}

              {paymentMethod === 'binance' && (
                <div>
                  <div className="text-[11px] text-zinc-400">USDT Address ({paymentConfig.binanceNetwork}):</div>
                  <div className="flex items-center justify-between mt-1 p-2 rounded-lg bg-zinc-950 border border-zinc-800">
                    <span className="font-mono text-xs text-yellow-400 truncate max-w-[200px]">
                      {paymentConfig.binanceUsdtAddress}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(paymentConfig.binanceUsdtAddress, 'binance')}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 shrink-0"
                    >
                      {copiedField === 'binance' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'binance' ? 'কপি হয়েছে' : 'কপি'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    মোট প্রদেয়: <strong className="text-emerald-400">${selectedPlan.priceUsdt} USDT</strong> (নেটওয়ার্ক ফি বাদে)
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
              💡 {paymentConfig.instructionBn}
            </p>
          </div>

          {/* Form to submit TrxID */}
          <div className="md:col-span-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>২. ট্রানজেকশন তথ্য সাবমিট করুন</span>
            </h4>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  যে নম্বর বা অ্যাকাউন্ট থেকে টাকা পাঠিয়েছেন:
                </label>
                <input
                  type="text"
                  required
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  placeholder="যেমন: 017XXXXXXXX বা বাইন্যান্স পে আইডি"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  ট্রানজেকশন আইডি (TrxID / Hash):
                </label>
                <input
                  type="text"
                  required
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="যেমন: BKL9X8M7Q2"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 uppercase font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-1">
                <div className="flex justify-between text-zinc-400">
                  <span>নির্বাচিত প্ল্যান:</span>
                  <span className="font-semibold text-zinc-200">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>মেয়াদ ও দৈনিক সীমা:</span>
                  <span className="font-semibold text-emerald-400">
                    {selectedPlan.durationDays} দিন ·{' '}
                    {selectedPlan.dailyScanLimit === 0
                      ? 'আনলিমিটেড/দিন'
                      : `${selectedPlan.dailyScanLimit} স্ক্যান/দিন`}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>মোট টাকা:</span>
                  <span className="font-bold text-zinc-100">
                    ৳{selectedPlan.priceBdt} / ${selectedPlan.priceUsdt} USDT
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {loading ? (
                  <span>সাবমিট হচ্ছে...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>সাবস্ক্রিপশন নিশ্চিত করুন (Submit TrxID)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
