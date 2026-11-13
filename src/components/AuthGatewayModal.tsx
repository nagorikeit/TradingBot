import React, { useState } from 'react';
import { authService } from '../services/authService';
import { Shield, Lock, Mail, User as UserIcon, Phone, CheckCircle2, ArrowRight, Zap, Sparkles } from 'lucide-react';

interface AuthGatewayModalProps {
  onSuccess?: () => void;
}

export const AuthGatewayModal: React.FC<AuthGatewayModalProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const res = await authService.loginWithGoogle();
    setGoogleLoading(false);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'জিমেইল লগইন ব্যর্থ হয়েছে');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('ইমেইল ও পাসওয়ার্ড দিন');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await authService.login(email, password);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'লগইন ব্যর্থ হয়েছে');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('সবগুলো প্রয়োজনীয় ঘর পূরণ করুন');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await authService.register(name, email, password, phone);
    setLoading(false);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে');
    }
  };

  const fillQuickDemo = (role: 'admin' | 'user') => {
    setTab('login');
    if (role === 'admin') {
      setEmail('admin@tradepulse.io');
      setPassword('admin123456');
    } else {
      setEmail('user@tradepulse.io');
      setPassword('user123456');
    }
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 md:p-8 text-zinc-100 my-8">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/20 mb-3 border border-emerald-400/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            ট্রেডপালস প্রো এআই
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            প্রাতিষ্ঠানিক কোয়ান্ট সিগন্যাল ও সিকিউর ট্রেডিং টার্মিনাল
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[11px] text-zinc-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>সুরক্ষিত লগইন গেটওয়ে বাধ্যতামূলক</span>
          </div>
        </div>

        {/* 1-Click Gmail / Google Registration & Login */}
        <div className="mb-5">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-3 px-4 bg-white hover:bg-zinc-100 disabled:opacity-60 text-zinc-900 font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all border border-zinc-300 cursor-pointer"
          >
            {/* Official Google "G" SVG Mark */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>
              {googleLoading
                ? 'জিমেইল ভেরিফাই হচ্ছে...'
                : 'জিমেইল (Gmail) দিয়ে ১-ক্লিকে লগইন / রেজিস্ট্রেশন'}
            </span>
          </button>
          <p className="text-[11px] text-emerald-400/90 text-center mt-1.5">
            এক ক্লিকেই আপনার জিমেইল দিয়ে নতুন অ্যাকাউন্ট তৈরি ও লগইন হবে
          </p>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="border-t border-zinc-800 w-full" />
          <span className="px-3 text-[11px] text-zinc-500 bg-zinc-900 shrink-0">
            অথবা ইমেইল ও পাসওয়ার্ড দিয়ে
          </span>
          <div className="border-t border-zinc-800 w-full" />
        </div>

        {/* 1-Click Quick Demo Buttons for Instant Evaluation */}
        <div className="mb-5 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> ১-ক্লিক ইনস্ট্যান্ট টেস্ট অ্যাক্সেস:
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillQuickDemo('admin')}
              className="py-1.5 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              👑 এডমিন ডেমো
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('user')}
              className="py-1.5 px-2.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              👤 ভিআইপি ডেমো
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 transition-colors ${
              tab === 'login'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            লগইন করুন
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 transition-colors ${
              tab === 'register'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            নতুন অ্যাকাউন্ট খুলুন
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                ইমেইল ঠিকানা (Email)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="আপনার ইমেইল লিখুন"
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-950/70 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                পাসওয়ার্ড (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-950/70 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <span>লগইন হচ্ছে...</span>
              ) : (
                <>
                  <span>লগইন করে প্রবেশ করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                আপনার নাম (Full Name)
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মোঃ সাকিব হাসান"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                ইমেইল (Email)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                মোবাইল নম্বর (ঐচ্ছিক)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                পাসওয়ার্ড (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950/70 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <span>অ্যাকাউন্ট তৈরি হচ্ছে...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>অ্যাকাউন্ট তৈরি করুন</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-2 text-[11px] text-zinc-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>২৫৬-বিট এনক্রিপশন • Firebase Google ও সিকিউর অ্যাক্সেস</span>
        </div>
      </div>
    </div>
  );
};
