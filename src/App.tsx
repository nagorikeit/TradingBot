/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { marketService } from './services/marketService';
import { Candle, Signal, TimeframeKey } from './types';
import { MarketDataSourceMode } from './data/marketDataProvider';
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
import { ScannerView } from './components/ScannerView';
import { AgentCommandCenter } from './components/AgentCommandCenter';
import { LiveScreenAnalyzer } from './components/LiveScreenAnalyzer';
import { FloatingLiveScreenController } from './components/FloatingLiveScreenController';
import { BengaliKnowledgeHub } from './components/BengaliKnowledgeHub';
import { AdminPanel } from './components/AdminPanel';
import { AuthGatewayModal } from './components/AuthGatewayModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { authService } from './services/authService';
import { User, EffectiveScanQuotaStatus } from './types/authTypes';
import { scannerService } from './services/scannerService';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'live-screen' | 'terminal' | 'scanner' | 'backtest' | 'history' | 'strategy' | 'agent' | 'knowledge' | 'admin'>('live-screen');
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getUser());
  const [daysRemaining, setDaysRemaining] = useState<number>(() => authService.getDaysRemaining());
  const [scanQuota, setScanQuota] = useState<EffectiveScanQuotaStatus>(() => authService.getScanQuotaStatus());
  const [canEnterTerminal, setCanEnterTerminal] = useState<boolean>(() => authService.canEnterTerminal());
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [upgradePromptReason, setUpgradePromptReason] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string>(() => marketService.getSymbol());
  const [timeframe, setTimeframe] = useState<TimeframeKey>(() => marketService.getTimeframe());
  const [providerMode, setProviderMode] = useState<MarketDataSourceMode>(() => marketService.getProviderMode());
  const [candles, setCandles] = useState<Candle[]>(() => [...marketService.getCandles()]);
  const [activeSignal, setActiveSignal] = useState<Signal | null>(() => marketService.getActiveSignal());
  const [signalHistory, setSignalHistory] = useState<Signal[]>(() => [...marketService.getSignalHistory()]);
  const [isScanning, setIsScanning] = useState<boolean>(() => marketService.getIsScanning());
  const [isScannerBusy, setIsScannerBusy] = useState<boolean>(false);
  const [scannerSignalCount, setScannerSignalCount] = useState<number>(() => scannerService.getQualifiedSignals().length);

  useEffect(() => {
    const updateState = () => {
      setSymbol(marketService.getSymbol());
      setTimeframe(marketService.getTimeframe());
      setProviderMode(marketService.getProviderMode());
      setCandles([...marketService.getCandles()]);
      setActiveSignal(marketService.getActiveSignal());
      setSignalHistory([...marketService.getSignalHistory()]);
      setIsScanning(marketService.getIsScanning());
    };

    const updateScanner = () => {
      setScannerSignalCount(scannerService.getQualifiedSignals().length);
    };

    const updateAuth = (u: User | null) => {
      setCurrentUser(u);
      setDaysRemaining(authService.getDaysRemaining());
      setScanQuota(authService.getScanQuotaStatus());
      setCanEnterTerminal(authService.canEnterTerminal());
      if (authService.hasActiveSubscription() || u?.role === 'admin') {
        setShowUpgradeModal(false);
        setUpgradePromptReason(null);
      }
      if (u?.role !== 'admin' && currentTab === 'admin') {
        setCurrentTab('live-screen');
      }
    };

    updateState();
    updateScanner();

    const unsubscribeMarket = marketService.subscribe(updateState);
    const unsubscribeScanner = scannerService.subscribe(updateScanner);
    const unsubscribeAuth = authService.subscribe(updateAuth);
    const unsubscribePlans = authService.subscribePlans(() => {
      setScanQuota(authService.getScanQuotaStatus());
      setCanEnterTerminal(authService.canEnterTerminal());
    });
    const unsubscribeUpgrade = authService.subscribeUpgradePrompt((reason) => {
      setUpgradePromptReason(reason || null);
      setCanEnterTerminal(authService.canEnterTerminal());
      setShowUpgradeModal(true);
    });

    return () => {
      unsubscribeMarket();
      unsubscribeScanner();
      unsubscribeAuth();
      unsubscribePlans();
      unsubscribeUpgrade();
      marketService.stopLiveFeed();
    };
  }, [currentTab]);

  const handleSelectSymbol = (newSymbol: string) => {
    marketService.setSymbol(newSymbol);
  };

  const handleSelectTimeframe = (newTf: TimeframeKey) => {
    marketService.setTimeframe(newTf);
    scannerService.setTimeframe(newTf);
  };

  const handleSelectProvider = (mode: MarketDataSourceMode) => {
    marketService.setProviderMode(mode);
  };

  const handleAdvanceCandle = () => {
    marketService.advanceCandle();
  };

  const handleManualScan = async () => {
    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) return;

    if (currentTab === 'scanner') {
      setIsScannerBusy(true);
      try {
        await scannerService.reconcileAllWorkers();
        await authService.recordCompletedScan('header_scanner_scan');
      } finally {
        setIsScannerBusy(false);
      }
    } else {
      marketService.triggerManualScan();
      await authService.recordCompletedScan('header_terminal_scan');
    }
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
        isScanning={currentTab === 'scanner' ? isScannerBusy : isScanning}
        scannerSignalCount={scannerSignalCount}
        currentUser={currentUser}
        daysRemaining={daysRemaining}
        scanQuota={scanQuota}
        onOpenUpgrade={() => {
          setUpgradePromptReason(null);
          setShowUpgradeModal(true);
        }}
        onLogout={() => authService.logout()}
      />

      {/* Mandatory Login Gateway: Render AuthGatewayModal when user is not logged in */}
      {!currentUser && (
        <AuthGatewayModal onSuccess={() => {}} />
      )}

      {/* Hybrid Subscription Gateway: Opens when free starter scans are exhausted OR user triggers Upgrade */}
      {currentUser && currentUser.role === 'user' && (!canEnterTerminal || showUpgradeModal) && (
        <SubscriptionModal
          user={currentUser}
          quotaStatus={scanQuota}
          canClose={canEnterTerminal}
          blockReason={upgradePromptReason}
          onClose={() => {
            setShowUpgradeModal(false);
            setUpgradePromptReason(null);
          }}
          onLogout={() => authService.logout()}
        />
      )}

      {/* 3. Asset, Timeframe & Exchange Bar (Shown only on Terminal tab where it applies) */}
      {currentTab === 'terminal' && (
        <AssetSelectorBar
          selectedSymbol={symbol}
          selectedTimeframe={timeframe}
          providerMode={providerMode}
          onSelectSymbol={handleSelectSymbol}
          onSelectTimeframe={handleSelectTimeframe}
          onSelectProvider={handleSelectProvider}
          latestCandle={latestCandle}
          previousCandle={previousCandle}
        />
      )}

      {/* 4. Main Body Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {currentTab === 'admin' && currentUser?.role === 'admin' && (
          <AdminPanel onClose={() => setCurrentTab('live-screen')} />
        )}

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

        {currentTab === 'scanner' && (
          <ScannerView
            onSelectSymbolForTerminal={handleSelectSymbol}
            onNavigateToTerminal={() => setCurrentTab('terminal')}
          />
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

        {currentTab === 'agent' && (
          <AgentCommandCenter />
        )}

        {currentTab === 'live-screen' && (
          <LiveScreenAnalyzer />
        )}

        {currentTab === 'knowledge' && (
          <BengaliKnowledgeHub />
        )}
      </main>

      {/* 5. Minimal, Clean Terminal Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>TradePulse v1.0 · Technical Signal Analysis System</span>
          <span>Paper Analysis & Educational Research Only · Zero Broker Connectivity</span>
        </div>
      </footer>

      {/* 6. Persistent Floating Live Screen Controller */}
      <FloatingLiveScreenController
        currentTab={currentTab}
        onNavigateToLiveScreen={() => setCurrentTab('live-screen')}
      />
    </div>
  );
}
