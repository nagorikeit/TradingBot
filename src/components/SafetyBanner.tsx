import React, { useState } from 'react';
import { ShieldAlert, Info, X } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 max-w-5xl">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong className="text-slate-200 font-medium">Educational Demo & Paper Analysis Mode:</strong> Signals are
          derived strictly from technical indicator rule scoring (EMA, RSI, MACD, BB, ATR). No guaranteed profits or
          financial certainty. Confidence score reflects strategy rule confirmation level, not market prediction guarantee.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-500 hover:text-slate-300 transition-colors p-1"
        aria-label="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
