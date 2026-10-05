/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { marketService } from './services/marketService';
import { Candle, Signal, TimeframeKey } from './types';
import { computeSignalStatistics } from './strategy/signalEvaluator';
import { SafetyBanner } from './components/SafetyBanner';
import { Header } from './components/Header';
import { AssetSelectorBar } from './components/AssetSelectorBar';
import { SignalHeroCard } from './components/SignalHeroCard';
import { CandlestickChart } from './components/CandlestickChart';
import { StatsSummaryBar } from './components/StatsSummaryBar';
import { SignalHistoryTable } from './components/SignalHistoryTable';
import { BacktestView } from './components/BacktestView';
import { StrategyRulesView } from './components/StrategyRulesView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'terminal' | 'backtest' | 'history' | 'strategy'>('terminal');
  const [symbol, setSymbol] = useState<string>(() => marketService.getSymbol());
  const [timeframe, setTimeframe] = useState<TimeframeKey>(() => marketService.getTimeframe());
  const [candles, setCandles] = useState<Candle[]>(() => [...marketService.getCandles()]);
  const [activeSignal, setActiveSignal] = useState<Signal | null>(() => marketService.getActiveSignal());
  const [signalHistory, setSignalHistory] = useState<Signal[]>(() => [...marketService.getSignalHistory()]);
  const [isScanning, setIsScanning] = useState<boolean>(() => marketService.getIsScanning());

  useEffect(() => {
    // Initialize market service with default EUR/USD and 1m timeframe
    marketService.init('EUR/USD', '1m');

    const updateState = () => {
      setSymbol(marketService.getSymbol());
      setTimeframe(marketService.getTimeframe());
      setCandles([...marketService.getCandles()]);
      setActiveSignal(marketService.getActiveSignal());
      setSignalHistory([...marketService.getSignalHistory()]);
      setIsScanning(marketService.getIsScanning());
    };

    updateState();
    const unsubscribe = marketService.subscribe(updateState);

    return () => {
      unsubscribe();
      marketService.stopLiveFeed();
    };
  }, []);

  const handleSelectSymbol = (newSymbol: string) => {
    marketService.setSymbol(newSymbol);
  };

  const handleSelectTimeframe = (newTf: TimeframeKey) => {
    marketService.setTimeframe(newTf);
  };

  const handleAdvanceCandle = () => {
    marketService.advanceCandle();
  };

  const handleManualScan = () => {
    marketService.triggerManualScan();
  };

  const handleClearHistory = () => {
    marketService.clearHistory();
  };

  const stats = computeSignalStatistics(signalHistory);
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const previousCandle = candles.length > 1 ? candles[candles.length - 2] : null;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* 1. Regulatory & Paper Analysis Banner */}
      <SafetyBanner />

      {/* 2. Top Header (Brand, Navigation, Quick Actions) */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onAdvanceCandle={handleAdvanceCandle}
        onManualScan={handleManualScan}
        isScanning={isScanning}
      />

      {/* 3. Asset and Timeframe Bar */}
      <AssetSelectorBar
        selectedSymbol={symbol}
        selectedTimeframe={timeframe}
        onSelectSymbol={handleSelectSymbol}
        onSelectTimeframe={handleSelectTimeframe}
        latestCandle={latestCandle}
        previousCandle={previousCandle}
      />

      {/* 4. Main Body Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {currentTab === 'terminal' && (
          <div className="space-y-6">
            {/* Top Grid: Signal Hero Card & Candlestick Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Signal Hero Card (Module 1, 4, 5, 8) */}
              <div className="lg:col-span-5 w-full">
                <SignalHeroCard
                  signal={activeSignal}
                  latestCandle={latestCandle}
                  isScanning={isScanning}
                  timeframe={timeframe}
                />
              </div>

              {/* Right Column: Interactive Candlestick Chart */}
              <div className="lg:col-span-7 w-full">
                <CandlestickChart
                  candles={candles}
                  symbol={symbol}
                  timeframe={timeframe}
                  signals={signalHistory}
                />
              </div>
            </div>

            {/* Performance Statistics Bar */}
            <StatsSummaryBar stats={stats} />

            {/* Signal Verification & History */}
            <SignalHistoryTable
              signals={signalHistory}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}

        {currentTab === 'backtest' && (
          <BacktestView />
        )}

        {currentTab === 'history' && (
          <div className="space-y-6">
            <StatsSummaryBar stats={stats} />
            <SignalHistoryTable
              signals={signalHistory}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}

        {currentTab === 'strategy' && (
          <StrategyRulesView />
        )}
      </main>

      {/* 5. Minimal, Clean Terminal Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>TradePulse v1.0 · Technical Signal Analysis System</span>
          <span>Paper Analysis & Educational Research Only · Zero Broker Connectivity</span>
        </div>
      </footer>
    </div>
  );
}
