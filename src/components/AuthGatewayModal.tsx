import React, { useState } from 'react';
import { authService } from '../services/authService';
import { Lock, Mail, User as UserIcon, Phone, ArrowRight, AlertCircle, Copy, Check } from 'lucide-react';

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
  const [sha1Info, setSha1Info] = useState<{ sha1: string; packageName: string } | null>(null);
  const [canUseCustomTab, setCanUseCustomTab] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSha1Info(null);
    setCanUseCustomTab(false);
    setGoogleLoading(true);
    const res = await authService.loginWithGoogle();
    setGoogleLoading(false);

    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'Google লগইন ব্যর্থ হয়েছে');
      if (res.sha1) {
        setSha1Info({
          sha1: res.sha1,
          packageName: res.packageName || 'com.tradepulse.bot',
        });
      }
      if (res.canUseCustomTabFallback) {
        setCanUseCustomTab(true);
      }
    }
  };

  const handleCustomTabFallback = async () => {
    setError(null);
    setGoogleLoading(true);
    const res = await authService.loginWithGoogleCustomTabFallback();
    setGoogleLoading(false);
    if (res.success) {
      onSuccess?.();
    } else {
      setError(res.error || 'Google লগইন ব্যর্থ হয়েছে');
    }
  };

  const handleCopySha1 = async () => {
    if (!sha1Info?.sha1) return;
    try {
      await navigator.clipboard.writeText(sha1Info.sha1);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    } catch {}
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
      setError('প্রয়োজনীয় সব ঘর পূরণ করুন');
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#070b14]/90 backdrop-blur-md">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-7 text-slate-100">
          {/* Brand Header */}
          <div className="text-center mb-4 sm:mb-5">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              TradePulse <span className="text-emerald-400">AI</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'login' ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
            </p>
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-semibold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-colors border border-slate-200 cursor-pointer whitespace-nowrap"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
            <span>{googleLoading ? 'Google যাচাই চলছে...' : 'Google দিয়ে প্রবেশ করুন'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4 sm:my-5">
            <div className="border-t border-slate-800 w-full" />
            <span className="px-3 text-xs text-slate-500 bg-[#0f172a] shrink-0">অথবা</span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl mb-4 sm:mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === 'login'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            লগইন
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === 'register'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            রেজিস্ট্রেশন
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>

            {sha1Info && (
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-1.5 text-[11px] text-slate-300">
                <div className="font-semibold text-amber-300">
                  Firebase Console → Project Settings → Android App ({sha1Info.packageName})-এ এই SHA-1 যোগ করুন:
                </div>
                <div className="flex items-center justify-between gap-2 bg-slate-900 px-2 py-1.5 rounded border border-slate-700 font-mono text-[10px] text-emerald-300 break-all">
                  <span>{sha1Info.sha1}</span>
                  <button
                    type="button"
                    onClick={handleCopySha1}
                    className="shrink-0 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                  >
                    {copiedSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSha ? 'কপিড' : 'কপি'}</span>
                  </button>
                </div>
              </div>
            )}

            {canUseCustomTab && (
              <button
                type="button"
                onClick={handleCustomTabFallback}
                disabled={googleLoading || loading}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                বিকল্প: ইন-অ্যাপ সিকিউর ট্যাব দিয়ে প্রবেশ করুন
              </button>
            )}
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">ইমেইল</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">পাসওয়ার্ড</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড দিন"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              {loading ? (
                <span>প্রবেশ হচ্ছে...</span>
              ) : (
                <>
                  <span>প্রবেশ করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">পুরো নাম</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="আপনার নাম লিখুন"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ইমেইল</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">মোবাইল (ঐচ্ছিক)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">পাসওয়ার্ড</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              {loading ? (
                <span>তৈরি হচ্ছে...</span>
              ) : (
                <>
                  <span>অ্যাকাউন্ট তৈরি করুন</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
