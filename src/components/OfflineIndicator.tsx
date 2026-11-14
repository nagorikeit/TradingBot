import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500/95 border border-amber-400/50 px-3 py-2 text-xs font-semibold text-slate-950 shadow-xl backdrop-blur-sm">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>অফলাইন মোড — ক্যাশ করা ডেটা চালু আছে</span>
    </div>
  );
};
