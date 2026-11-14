import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isNativeApp, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Suppress inside installed standalone PWA or inside native Android APK
  if (isInstalled || isNativeApp) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        return;
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title={isInstallable ? 'অ্যাপ হিসেবে ডিভাইসে ইনস্টল করুন' : 'PWA ইনস্টল নির্দেশনা দেখুন'}
        className="px-2.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400" />
        <span>ইনস্টল</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/75 backdrop-blur-sm p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-md rounded-2xl bg-[#111827] border border-slate-700/80 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">TradePulse অ্যাপ ইনস্টল</h3>
                    <p className="text-[11px] text-slate-400">মোবাইল ও ডেস্কটপের জন্য PWA সেটআপ</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 text-xs text-slate-300">
                {isIOS ? (
                  <div className="space-y-3">
                    <p className="text-slate-200 font-medium">
                      iPhone বা iPad (Safari)-এ ইনস্টল করতে নিচের ধাপগুলো অনুসরণ করুন:
                    </p>
                    <div className="space-y-2.5 bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0">১</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>Safari ব্রাউজারের নিচের</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                            <Share className="w-3 h-3" /> Share
                          </span>
                          <span>বাটনে ট্যাপ করুন।</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0">২</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>নিচে স্ক্রল করে</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono">
                            <PlusSquare className="w-3 h-3" /> Add to Home Screen
                          </span>
                          <span>সিলেক্ট করে Add চাপুন।</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-slate-200 font-medium">
                      সরাসরি ব্রাউজার থেকে TradePulse অ্যাপ হিসেবে ইনস্টল করতে:
                    </p>
                    <div className="space-y-2.5 bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center shrink-0">১</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>Chrome বা Edge ব্রাউজারের ডানদিকে</span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">
                            <MoreVertical className="w-3 h-3" /> Menu
                          </span>
                          <span>বা এড্রেস বারের ইনস্টল আইকনে ক্লিক করুন।</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center shrink-0">২</span>
                        <span>
                          <strong className="text-emerald-300">Install App / Add to Home Screen</strong> সিলেক্ট করুন।
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-[11px] text-amber-200">
                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        প্রিভিউ ফ্রেমের ভেতর থাকলে ডাইরেক্ট ইনস্টল পপআপ আসে না—লিংকটি সরাসরি ব্রাউজার ট্যাবে খুললে ইনস্টল বাটন থেকে এক ক্লিকেই ইনস্টল হবে।
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
                >
                  বুঝেছি
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
