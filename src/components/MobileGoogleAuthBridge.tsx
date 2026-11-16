import React, { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  UserCredential,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export const MobileGoogleAuthBridge: React.FC = () => {
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  const buildDeepLinkFromResult = (res: UserCredential): string | null => {
    const cred = GoogleAuthProvider.credentialFromResult(res);
    const idToken = cred?.idToken || '';
    const accessToken = cred?.accessToken || '';
    if (!idToken && !accessToken) {
      return null;
    }
    const params = new URLSearchParams();
    if (idToken) params.set('idToken', idToken);
    if (accessToken) params.set('accessToken', accessToken);
    return `tradepulse://auth-callback?${params.toString()}`;
  };

  const finishWithResult = (res: UserCredential) => {
    const url = buildDeepLinkFromResult(res);
    if (!url) {
      setStatus('error');
      setErrorMsg('Google টোকেন পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      return;
    }
    setDeepLinkUrl(url);
    setStatus('success');
    try {
      window.location.href = url;
    } catch {
      // User can tap the return button below
    }
  };

  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then((res) => {
        if (active && res) {
          finishWithResult(res);
        }
      })
      .catch((err) => {
        if (active) {
          setStatus('error');
          setErrorMsg(err?.message || 'Google লগইন যাচাই ব্যর্থ হয়েছে');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleStartGoogleLogin = async () => {
    setErrorMsg(null);
    setStatus('loading');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      finishWithResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-blocked') || msg.includes('operation-not-supported')) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: unknown) {
          setStatus('error');
          setErrorMsg(redirectErr instanceof Error ? redirectErr.message : String(redirectErr));
          return;
        }
      }
      setStatus('error');
      if (msg.includes('popup-closed-by-user')) {
        setErrorMsg('Google পপআপ বন্ধ করা হয়েছিল। আবার নিচের বাটনে চাপুন।');
      } else if (msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setErrorMsg(
          `Firebase-এ এই ডোমেইনটি (${host}) Authorized Domains-এ যুক্ত করা নেই। Firebase Console -> Authentication -> Settings -> Authorized domains-এ "${host}" যোগ করুন।`
        );
      } else {
        setErrorMsg(msg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white">
            TradePulse <span className="text-emerald-400">AI</span>
          </h1>
          <p className="text-xs text-slate-400">মোবাইল অ্যাপ Google অ্যাকাউন্ট যাচাই</p>
        </div>

        {status === 'success' && deepLinkUrl ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span className="font-bold text-sm text-white">Google লগইন সফল হয়েছে!</span>
              <span>স্বয়ংক্রিয়ভাবে অ্যাপে ফিরে না গেলে নিচের বাটনে চাপুন।</span>
            </div>
            <a
              href={deepLinkUrl}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>TradePulse অ্যাপে ফিরে যান</span>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              মোবাইল অ্যাপে নিরাপদভাবে প্রবেশ করতে নিচের বাটনে ট্যাপ করে আপনার Google/Gmail অ্যাকাউন্ট নির্বাচন করুন।
            </p>

            <button
              type="button"
              onClick={handleStartGoogleLogin}
              disabled={status === 'loading'}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-colors border border-slate-200"
            >
              {status === 'loading' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-700" />
                  <span>Google যাচাই চলছে...</span>
                </>
              ) : (
                <>
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
                  <span>Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
