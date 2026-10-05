import React from 'react';
import { Activity, Play, RefreshCw, BarChart2, History, Sliders } from 'lucide-react';
import { TimeframeKey } from '../types';

interface HeaderProps {
  currentTab: 'terminal' | 'backtest' | 'history' | 'strategy';
  onSelectTab: (tab: 'terminal' | 'backtest' | 'history' | 'strategy') => void;
  onAdvanceCandle: () => void;
  onManualScan: () => void;
  isScanning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onAdvanceCandle,
  onManualScan,
  isScanning,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-base font-bold tracking-tight text-white font-mono">
              TradePulse
            </span>
          </div>
          <span className="hidden sm:inline text-xs text-slate-500 border-l border-slate-700/60 pl-3">
            Signal Engine
          </span>
        </div>

        {/* Zone 2: Navigation Links / View Switchers */}
        <nav className="flex items-center gap-1 sm:gap-4 text-xs font-medium">
          <button
            onClick={() => onSelectTab('terminal')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              currentTab === 'terminal'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => onSelectTab('backtest')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              currentTab === 'backtest'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Backtester</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              currentTab === 'history'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => onSelectTab('strategy')}
            className={`px-3 py-1.5 rounded-md transition-colors hidden md:flex items-center gap-1.5 ${
              currentTab === 'strategy'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>
        </nav>

        {/* Zone 3: Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAdvanceCandle}
            title="Advance 1 full candle to test signal progression"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors flex items-center gap-1"
          >
            <Play className="w-3 h-3 text-emerald-400 fill-emerald-400/40" />
            <span className="hidden sm:inline">Next Candle</span>
          </button>

          <button
            onClick={onManualScan}
            disabled={isScanning}
            title="Force immediate technical scan"
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>
      </div>
    </header>
  );
};
