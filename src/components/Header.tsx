import React from 'react';
import { Activity, Play, RefreshCw, BarChart2, History, Sliders, Radio, Cpu, BookOpen, LogOut, Crown } from 'lucide-react';
import { User, EffectiveScanQuotaStatus } from '../types/authTypes';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentTab: 'live-screen' | 'terminal' | 'scanner' | 'backtest' | 'history' | 'strategy' | 'agent' | 'knowledge' | 'admin';
  onSelectTab: (tab: 'live-screen' | 'terminal' | 'scanner' | 'backtest' | 'history' | 'strategy' | 'agent' | 'knowledge' | 'admin') => void;
  onAdvanceCandle: () => void;
  onManualScan: () => void;
  isScanning: boolean;
  scannerSignalCount?: number;
  currentUser?: User | null;
  daysRemaining?: number;
  scanQuota?: EffectiveScanQuotaStatus;
  onOpenUpgrade?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onAdvanceCandle,
  onManualScan,
  isScanning,
  scannerSignalCount = 0,
  currentUser,
  daysRemaining = 0,
  scanQuota,
  onOpenUpgrade,
  onLogout,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-13 flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap scrollbar-thin scroll-smooth flex-nowrap">
        {/* Zone 1: Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm sm:text-base font-bold tracking-tight text-white font-mono">
            TradePulse
          </span>
        </div>

        {/* Zone 2: Clean Single-Line Smart Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5 text-xs font-medium shrink-0 flex-nowrap">
          <button
            onClick={() => onSelectTab('live-screen')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'live-screen'
                ? 'bg-slate-800 text-cyan-400 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Live Screen</span>
          </button>

          <button
            onClick={() => onSelectTab('terminal')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'terminal'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => onSelectTab('scanner')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 relative shrink-0 ${
              currentTab === 'scanner'
                ? 'bg-slate-800 text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Scanner</span>
            {scannerSignalCount > 0 && (
              <span className="px-1.5 text-[10px] rounded bg-amber-500/20 text-amber-300 font-mono">
                {scannerSignalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('backtest')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'backtest'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Backtest</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'history'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => onSelectTab('strategy')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'strategy'
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => onSelectTab('agent')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'agent'
                ? 'bg-slate-800 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Agent</span>
          </button>

          <button
            onClick={() => onSelectTab('knowledge')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'knowledge'
                ? 'bg-slate-800 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Knowledge</span>
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 border ${
                currentTab === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 font-bold border-amber-500/50'
                  : 'text-amber-400/90 border-amber-500/30 hover:bg-amber-500/10'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Zone 3: Quick Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUser && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${currentUser.role === 'admin' ? 'bg-amber-400' : scanQuota?.canScan === false ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              {currentUser.role === 'admin' ? (
                <span className="text-[10px] font-mono font-bold text-amber-300">ADMIN · ∞</span>
              ) : scanQuota?.mode === 'FREE_TRIAL' ? (
                <button
                  type="button"
                  onClick={onOpenUpgrade}
                  className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
                >
                  ফ্রি {scanQuota.freeRemaining}/{scanQuota.freeLimit} · আপগ্রেড
                </button>
              ) : scanQuota?.mode === 'PAID' ? (
                <button
                  type="button"
                  onClick={onOpenUpgrade}
                  className="text-[10px] font-mono font-bold text-emerald-300"
                >
                  {daysRemaining}d · {scanQuota.dailyLimit === 0 ? '∞' : `${scanQuota.dailyRemaining}/${scanQuota.dailyLimit}`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenUpgrade}
                  className="text-[10px] font-bold text-rose-300"
                >
                  আপগ্রেড
                </button>
              )}
            </div>
          )}

          <button
            onClick={onAdvanceCandle}
            title="Next Candle"
            className="px-2 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors flex items-center gap-1 shrink-0"
          >
            <Play className="w-3 h-3 text-emerald-400 fill-emerald-400/40" />
            <span className="hidden sm:inline">Next</span>
          </button>

          <button
            onClick={onManualScan}
            disabled={isScanning}
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Scan</span>
          </button>

          <PWAInstallButton />

          {onLogout && currentUser && (
            <button
              onClick={onLogout}
              title="লগআউট"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
