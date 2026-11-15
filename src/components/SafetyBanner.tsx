import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

export const SafetyBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 px-4 py-1.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 truncate">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="truncate">
          <strong className="text-slate-200 font-medium">Paper Analysis Mode</strong> · Technical signals only (no financial advice)
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 shrink-0"
        aria-label="Dismiss notice"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
