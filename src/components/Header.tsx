import React from 'react';
import { Activity, Play, RefreshCw, BarChart2, History, Sliders, Radio, Cpu } from 'lucide-react';
import { TimeframeKey } from '../types';

interface HeaderProps {
  currentTab: 'terminal' | 'scanner' | 'backtest' | 'history' | 'strategy' | 'agent' | 'live-screen';
  onSelectTab: (tab: 'terminal' | 'scanner' | 'backtest' | 'history' | 'strategy' | 'agent' | 'live-screen') => void;
  onAdvanceCandle: () => void;
  onManualScan: () => void;
  isScanning: boolean;
  scannerSignalCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onAdvanceCandle,
  onManualScan,
  isScanning,
  scannerSignalCount = 0,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap scrollbar-thin scroll-smooth flex-nowrap">
        {/* Zone 1: Wordmark brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-base font-bold tracking-tight text-white font-mono">
              TradePulse
            </span>
          </div>
          <span className="hidden sm:inline text-xs text-slate-500 border-l border-slate-700/60 pl-2.5">
            Signal Engine
          </span>
        </div>

        {/* Zone 2: Navigation Links / View Switchers */}
        <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium shrink-0 flex-nowrap">
          <button
            onClick={() => onSelectTab('terminal')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'terminal'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
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
                ? 'bg-slate-800 text-amber-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Scanner</span>
            {scannerSignalCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                {scannerSignalCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('backtest')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
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
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
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
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              currentTab === 'strategy'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => onSelectTab('agent')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 border border-slate-700/60 ${
              currentTab === 'agent'
                ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Agent</span>
            <span className="px-1 py-0.2 text-[9px] rounded bg-cyan-500/10 text-cyan-300 font-mono">2E</span>
          </button>

          <button
            onClick={() => onSelectTab('live-screen')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 border border-slate-700/60 ${
              currentTab === 'live-screen'
                ? 'bg-slate-800 text-cyan-400 font-semibold shadow-sm border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Live Screen</span>
            <span className="px-1 py-0.2 text-[9px] rounded bg-cyan-500/20 text-cyan-300 font-mono">VISION</span>
          </button>
        </nav>

        {/* Zone 3: Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onAdvanceCandle}
            title="Advance 1 full candle to test signal progression"
            className="px-2 sm:px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors flex items-center gap-1 shrink-0"
          >
            <Play className="w-3 h-3 text-emerald-400 fill-emerald-400/40" />
            <span className="hidden sm:inline">Next Candle</span>
          </button>

          <button
            onClick={onManualScan}
            disabled={isScanning}
            title="Force immediate technical scan"
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Scan</span>
          </button>
        </div>
      </div>
    </header>
  );
};
