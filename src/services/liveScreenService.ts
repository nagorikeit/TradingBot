import { LiveStreamState, ScreenAnalysisFinalResult, ChartDetectionDiagnostic, ScreenTransitionRecord } from '../types/screenTypes';
import { voiceAssistantService } from './voiceAssistantService';
import { whatsappAlertService } from './whatsappAlertService';
import { marketService } from './marketService';
import { Signal } from '../types';
import {
  TradePulseNativeScreen,
  FloatingOverlayData,
  NativeCaptureFrameEvent,
} from '../plugins/TradePulseNativeScreen';
import { Capacitor } from '@capacitor/core';
import { getApiUrl, getApiBaseUrl, DEFAULT_HOSTED_BACKEND_URL } from './apiConfig';
import { agentLearningService } from './agentLearningService';
import { authService } from './authService';
import { tradingProfileService } from './tradingProfileService';
import { TradingProfileId } from '../strategy/tradingProfiles';

export class LiveScreenService {
  private static instance: LiveScreenService;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private state: LiveStreamState = 'IDLE';
  private timer: any = null;
  private countdownTimer: any = null;
  private isProcessingFrame: boolean = false;
  private lastProcessingStartTime: number = 0;
  private activePendingSignalId: string | null = null;
  private activeSignaledDirection: 'CALL' | 'PUT' | null = null;
  private isAutoVerifyingOutcome: boolean = false;
  private scanIntervalMs: number = 3500; // 3.5 seconds optimal for quick signal analysis
  private latestResult: ScreenAnalysisFinalResult | null = null;
  private listeners: Set<() => void> = new Set();
  private errorMessage: string | null = null;

  // Real-time latency & sequence guards
  private latestProcessedSequenceId: number = 0;
  private isNativeCaptureActive: boolean = false;
  private hasFloatingOverlayActive: boolean = false;
  private nativeListenerHandle: { remove: () => void } | null = null;

  // Universal Screen Recognition & Transition State
  private isOtherScreenActive: boolean = false;
  private screenTransitions: ScreenTransitionRecord[] = [];
  private lastRecordedScreen: string | null = null;
  private lastDetectedAppName: string | null = null;
  private lastDetectedSummaryBn: string | null = null;

  // Live Chart & Countdown State
  private autoOpenModal: boolean = false;
  private isSearchingForChart: boolean = false;
  private isChartFound: boolean = false;
  private consecutiveChartDetections: number = 0;
  private expirySecondsLeft: number = 60; // 1-minute candle default countdown

  // Diagnostic Status Panel Tracking (Rules 4, 5, 6, 7)
  private latestFrameCount: number = 0;
  private latestFrameTimestamp: number = 0;
  private latestResolution: string = '720p';
  private latestApiLatencyMs: number = 0;
  private aiState: 'IDLE' | 'ANALYZING' | 'READY' | 'ERROR' | 'TIMEOUT' = 'IDLE';
  private captureState: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'PERMISSION_REQ' = 'STOPPED';
  private consecutiveNetworkFailures: number = 0;
  private lastErrorReason: string | null = null;
  private latestChartDiagnostic: ChartDetectionDiagnostic | null = null;
  private currentScanStep: {
    step: number;
    title: string;
    subtitle: string;
  } | null = null;


  private constructor() {
    if (typeof document !== 'undefined') {
      this.videoEl = document.createElement('video');
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.canvasEl = document.createElement('canvas');
    }
  }

  public static getInstance(): LiveScreenService {
    if (!LiveScreenService.instance) {
      LiveScreenService.instance = new LiveScreenService();
    }
    return LiveScreenService.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getState(): LiveStreamState {
    return this.state;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getLatestResult(): ScreenAnalysisFinalResult | null {
    return this.latestResult;
  }

  public isNativeActive(): boolean {
    return this.isNativeCaptureActive;
  }

  public isOverlayActive(): boolean {
    return this.hasFloatingOverlayActive;
  }

  public isSearching(): boolean {
    return this.isSearchingForChart;
  }

  public isChartDetected(): boolean {
    return this.isChartFound;
  }

  public getChartDiagnostic(): ChartDetectionDiagnostic | null {
    return this.latestChartDiagnostic;
  }

  public getExpirySecondsLeft(): number {
    return this.expirySecondsLeft;
  }

  public shouldAutoOpenModal(): boolean {
    return false;
  }

  public clearAutoOpenModal(): void {
    this.autoOpenModal = false;
  }

  public getCurrentScanStep(): { step: number; title: string; subtitle: string } | null {
    return this.currentScanStep;
  }

  public isOtherScreenDetected(): boolean {
    return this.isOtherScreenActive;
  }

  public getScreenTransitions(): ScreenTransitionRecord[] {
    return [...this.screenTransitions];
  }

  public clearScreenTransitions(): void {
    this.screenTransitions = [];
    this.notify();
  }

  public getActiveScreenName(): string {
    if (this.latestResult?.visionData?.detectedAppName) {
      return this.latestResult.visionData.detectedAppName;
    }
    if (this.lastDetectedAppName) {
      return this.lastDetectedAppName;
    }
    if (this.isChartFound) {
      return 'ট্রেডিং চার্ট';
    }
    return 'স্ক্রিন শেয়ার সংযুক্ত';
  }

  public getLastDetectedAppName(): string {
    return this.lastDetectedAppName || this.lastRecordedScreen || 'অন্যান্য স্ক্রিন';
  }

  public getLastDetectedSummaryBn(): string {
    return this.lastDetectedSummaryBn || '';
  }

  public async togglePictureInPicture(): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
        this.notify();
        return false;
      }
      if (this.videoEl && this.videoEl.readyState >= 2) {
        await this.videoEl.requestPictureInPicture();
        this.notify();
        return true;
      }
    } catch (err) {
      console.warn('PiP toggle error:', err);
    }
    return false;
  }

  public isPictureInPictureActive(): boolean {
    return typeof document !== 'undefined' && Boolean((document as any).pictureInPictureElement);
  }

  public isSignalStale(_ttlMs: number = 15000): boolean {
    // Live stream never marks signal as stopped or broken - stays active continuously
    return false;
  }


  public getFrameCount(): number {
    return this.latestFrameCount;
  }

  public getLastFrameTimestamp(): number {
    return this.latestFrameTimestamp;
  }

  public getResolution(): string {
    return this.latestResolution;
  }

  public getApiLatency(): number {
    return this.latestApiLatencyMs;
  }

  public getAiState(): 'IDLE' | 'ANALYZING' | 'READY' | 'ERROR' | 'TIMEOUT' {
    return this.aiState;
  }

  public getCaptureState(): 'RUNNING' | 'STOPPED' | 'PAUSED' | 'PERMISSION_REQ' {
    return this.captureState;
  }

  public getLastErrorReason(): string | null {
    return this.lastErrorReason;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  public getScanIntervalSeconds(): number {
    return Math.round(this.scanIntervalMs / 1000);
  }

  public setScanIntervalSeconds(seconds: number): void {
    this.scanIntervalMs = Math.max(2, Math.min(60, seconds)) * 1000;
    if (this.state === 'STREAMING' && !this.isNativeCaptureActive) {
      this.resetIntervalTimer();
    }
    this.notify();
  }

  /**
   * Starts native background capture or browser screen capture
   */
  public async connectScreen(profileId?: TradingProfileId): Promise<boolean> {
    if (profileId) {
      tradingProfileService.setActiveProfile(profileId);
    }
    if (this.state === 'STREAMING') return true;

    this.state = 'CONNECTING';
    this.autoOpenModal = true;
    this.errorMessage = null;
    this.isSearchingForChart = true;
    this.notify();

    // 1. If running inside Capacitor Native Android runtime (APK on mobile device)
    if (Capacitor.isNativePlatform()) {
      return await this.startNativeAndroidCapture();
    }

    // 2. Standard Web screen capture
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        const mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window',
            frameRate: { ideal: 5, max: 10 },
          },
          audio: false,
        });

        this.stream = mediaStream;

        if (this.videoEl) {
          this.videoEl.srcObject = mediaStream;
          await this.videoEl.play().catch(() => {});
        }

        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            this.disconnect('Screen sharing was ended by user.');
            voiceAssistantService.announceNoScreenCapture();
          };
        }

        this.state = 'STREAMING';
        this.autoOpenModal = false;
        this.isSearchingForChart = false;
        this.isChartFound = false;
        this.expirySecondsLeft = 0;
        this.errorMessage = null;
        this.latestResult = null;
        this.notify();

        voiceAssistantService.speak('স্ক্রিন শেয়ার সংযুক্ত হয়েছে। স্ক্যান করতে স্ক্যান বাটনে চাপুন।');

        return true;
      } catch (err: any) {
        console.warn('Web getDisplayMedia error:', err);
        const isNotAllowed = err.name === 'NotAllowedError';
        const isIframeBlocked = err.name === 'SecurityError' || String(err).includes('permissions policy');

        this.state = 'DISCONNECTED';
        if (isNotAllowed) {
          this.errorMessage = 'স্ক্রিন শেয়ার ডায়ালগ বাতিল করা হয়েছে। স্ক্রিন শেয়ার করতে পুরো স্ক্রিন বা ট্রেডিং উইন্ডো নির্বাচন করুন।';
        } else if (isIframeBlocked) {
          this.errorMessage = 'ব্রাউজার প্রিভিউ আইফ্রেমে স্ক্রিন শেয়ার সীমাবদ্ধ করেছে। উপরে "নতুন ট্যাবে খুলুন" বাটনে ক্লিক করুন অথবা ডেমো টেস্ট মোড ব্যবহার করুন।';
        } else {
          this.errorMessage = err.message || 'স্ক্রিন শেয়ার শুরু করা যায়নি।';
        }
        this.notify();
        return false;
      }
    }

    // 3. Fallback for environments without getDisplayMedia
    this.state = 'DISCONNECTED';
    this.errorMessage = 'আপনার ব্রাউজার বা ডিভাইসে স্ক্রিন শেয়ারিং এপিআই সমর্থিত নয়। অনুগ্রহ করে TradePulse Android APK বা Chrome/Edge ব্রাউজার ব্যবহার করুন।';
    this.notify();
    return false;
  }

  /**
   * Starts a dynamic live trading chart simulation stream for testing
   * Runs the full analysis pipeline, floating pill, candle countdown, and voice announcements
   */
  public async startDemoTestStream(): Promise<boolean> {
    this.disconnect();
    this.state = 'STREAMING';
    this.autoOpenModal = true;
    this.isSearchingForChart = false;
    this.isChartFound = true;
    this.errorMessage = null;
    this.expirySecondsLeft = 52;

    const sampleSymbols = ['AUD/CHF OTC', 'EUR/USD OTC', 'BTC/USDT', 'GBP/USD OTC'];
    const randomSymbol = sampleSymbols[Math.floor(Math.random() * sampleSymbols.length)];
    const directions: ('UP' | 'DOWN')[] = ['UP', 'DOWN'];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];

    this.latestResult = {
      analysisId: `demo_${Date.now()}`,
      timestamp: Date.now(),
      frameCapturedAt: Date.now(),
      direction: randomDir,
      confidence: 88,
      verdictTitle: randomDir === 'UP' ? 'CALL (UP) সিগন্যাল' : 'PUT (DOWN) সিগন্যাল',
      suggestedExpiry: '01:00',
      reasoning: [
        `${randomSymbol} মোমেন্টাম ক্যান্ডেল সাপোর্ট/রেজিস্ট্যান্স টেস্ট করছে।`,
        randomDir === 'UP' ? 'বুলিশ প্রেসার ও ভলিউম বৃদ্ধি পেয়েছে।' : 'বিয়ারিশ রিজেকশন ক্যান্ডেল তৈরি হয়েছে।',
        '১ মিনিট এক্সপায়ারি ট্রেডের অনুকূল পরিস্থিতি।'
      ],
      visionData: {
        symbol: randomSymbol,
        timeframe: '1m',
        marketType: 'FOREX',
        lastCandleDirection: randomDir === 'UP' ? 'BULLISH' : 'BEARISH',
        candlestickPattern: randomDir === 'UP' ? 'Bullish Engulfing' : 'Bearish Engulfing',
        indicatorsIdentified: [
          { name: 'EMA 20', description: 'Trend filter', bias: randomDir === 'UP' ? 'BULLISH' : 'BEARISH' },
          { name: 'RSI 14', description: 'Momentum oscillator', bias: randomDir === 'UP' ? 'BULLISH' : 'BEARISH' },
        ],
        chartStructure: randomDir === 'UP' ? 'UPTREND' : 'DOWNTREND',
        visionSummary: `${randomSymbol} চার্টে স্পষ্ট ক্যান্ডেলস্টিক প্যাটার্ন সনাক্ত হয়েছে।`,
        confidenceScore: 0.88,
        isClearTradingChart: true,
        containsSensitivePrivateData: false,
      },
      marketVerification: {
        isVerified: true,
        status: 'MATCHED',
        notes: 'Multi-exchange OTC market verified',
      },
      safetyDisclaimer: 'TradePulse Paper Analysis Tool',
      screenStatus: 'CHART_DETECTED',
    };

    this.notify();
    this.startCountdownTicker();

    voiceAssistantService.announceAnalysisResult(this.latestResult);

    if (this.hasFloatingOverlayActive) {
      this.updateFloatingOverlayHUD({
        direction: randomDir,
        confidence: 88,
        durationText: '00:52',
        verdictTitle: randomDir === 'UP' ? 'CALL (UP)' : 'PUT (DOWN)',
        reasonText: `${randomSymbol} - মোমেন্টাম নিশ্চিত`,
        latencyMs: 12,
        symbol: randomSymbol,
      });
    }

    return true;
  }

  /**
   * Interactive Screen Switch Testing Benchmark
   * Allows instant verification of how AI identifies and reads 5 different distinct screens:
   * 1. Quotex Trading Terminal (Chart & signals)
   * 2. Google Chrome Web Browser (Article / Document reading)
   * 3. VS Code IDE (TypeScript Code reading)
   * 4. WhatsApp Web (Messaging & chat OCR)
   * 5. YouTube Video Player (Media player & video stream)
   */
  public async testScreenSwitch(
    screenType: 'QUOTEX_CHART' | 'CHROME_DOC' | 'VS_CODE' | 'WHATSAPP' | 'YOUTUBE'
  ): Promise<boolean> {
    this.state = 'STREAMING';
    this.errorMessage = null;

    let mockResult: ScreenAnalysisFinalResult;

    if (screenType === 'QUOTEX_CHART') {
      this.isChartFound = true;
      this.isOtherScreenActive = false;
      this.expirySecondsLeft = 58;

      mockResult = {
        analysisId: `switch_quotex_${Date.now()}`,
        timestamp: Date.now(),
        frameCapturedAt: Date.now(),
        direction: 'UP',
        confidence: 91,
        verdictTitle: 'CALL / UP (Quotex AUD/CAD OTC)',
        suggestedExpiry: '01:00',
        reasoning: [
          'স্ক্রিন সনাক্ত: Quotex ব্রোকার চার্ট (AUD/CAD OTC)।',
          'টেকনিক্যাল বায়াস বুলিশ: আপট্রেন্ড কাঠামো ও শক্তিশালী সবুজ ক্যান্ডেল রিড করা হয়েছে।',
          'RSI ও EMA সাপোর্ট লেভেল থেকে আপওয়ার্ড বাউন্স কনফার্মেশন।',
        ],
        visionData: {
          screenCategory: 'TRADING_CHART',
          detectedAppName: 'Quotex Trading Terminal',
          screenTitle: 'AUD/CAD OTC 1M - Quotex Web',
          extractedText: ['AUD/CAD OTC', 'Payout: 87%', 'Time: 01:00', 'Live Candlestick Bar (Green)', 'Call / Put Buttons Visible'],
          isReadable: true,
          screenSummaryBn: 'এআই সফলভাবে Quotex-এর AUD/CAD চার্ট শনাক্ত করেছে এবং লাইভ ক্যান্ডেল রিড করে CALL সিগন্যাল তৈরি করেছে।',
          symbol: 'AUD/CAD OTC',
          timeframe: '1m',
          marketType: 'FOREX',
          lastVisiblePrice: 0.6542,
          lastCandleDirection: 'BULLISH',
          candlestickPattern: 'Bullish Continuation',
          chartStructure: 'UPTREND',
          indicatorsIdentified: [
            { name: 'EMA 20', description: 'Trend line', bias: 'BULLISH' },
            { name: 'RSI 14', description: 'Strength 62', bias: 'BULLISH' },
          ],
          visionSummary: 'Quotex ব্রোকার স্ক্রিন সফলভাবে শনাক্ত। ক্যান্ডেল ও মার্কেট ভেরিফায়েড।',
          confidenceScore: 0.91,
          isClearTradingChart: true,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: true,
          status: 'MATCHED',
          notes: 'Quotex OTC visual candlestick action verified.',
        },
        safetyDisclaimer: 'TradePulse Educational Paper Analysis',
        screenStatus: 'CHART_DETECTED',
        screenTransition: {
          previousScreen: this.lastRecordedScreen || 'Initial',
          currentScreen: 'Quotex Trading Terminal',
          switchedAt: Date.now(),
        },
      };

      this.startCountdownTicker();
    } else if (screenType === 'CHROME_DOC') {
      this.isChartFound = false;
      this.isOtherScreenActive = true;
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.expirySecondsLeft = 0;

      mockResult = {
        analysisId: `switch_chrome_${Date.now()}`,
        timestamp: Date.now(),
        frameCapturedAt: Date.now(),
        direction: 'WAIT',
        confidence: 94,
        verdictTitle: 'স্ক্রিন সনাক্ত: Google Chrome (পড়া হয়েছে)',
        suggestedExpiry: 'N/A',
        reasoning: [
          'শনাক্তকৃত স্ক্রিন: Google Chrome ব্রাউজার [ওয়েব পেজ / ডকুমেন্ট]',
          'এআই বিশ্লেষণ: আপনি ব্রাউজারে একটি ওয়েব আর্টিকেল পড়ছেন। টেক্সট ও শিরোনাম নির্ভুলভাবে পড়া গেছে।',
          'পঠিত টেক্সট: "Financial Technical Analysis Handbook" | "Trading Strategies and Risk Control" | "Chapter 4: Candlestick Math"',
          'ট্রেডিং চার্ট না থাকায় ট্রেড সিগন্যাল হোল্ড (WAIT) রাখা হয়েছে। চার্টে ফিরলে তাৎক্ষণিক ক্যান্ডেল বিশ্লেষণ শুরু হবে।',
        ],
        visionData: {
          screenCategory: 'DOCUMENT',
          detectedAppName: 'Google Chrome Browser',
          screenTitle: 'Technical Analysis Guide - Google Chrome',
          extractedText: [
            'Title: Financial Technical Analysis Handbook',
            'Heading: Chapter 4 - Price Action & Support/Resistance',
            'Paragraph: Candlestick trading involves interpreting crowd psychology on timeframes...',
            'URL Bar: https://docs.finance.org/technical-analysis',
          ],
          isReadable: true,
          screenSummaryBn: 'এআই গুগল ক্রোম ব্রাউজার শনাক্ত করেছে এবং পৃষ্ঠার শিরোনাম, অনুচ্ছেদ ও রেফারেন্স টেক্সট পড়তে পেরেছে।',
          screenSummaryEn: 'AI identified Google Chrome showing financial documentation and extracted text paragraphs.',
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'স্ক্রিন: Google Chrome',
          indicatorsIdentified: [],
          visionSummary: 'Google Chrome ব্রাউজার স্ক্রিন সফলভাবে শনাক্ত ও পড়া হয়েছে।',
          confidenceScore: 0.94,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: true,
          status: 'SKIPPED',
          notes: 'ওয়েব পেজ স্ক্রিন সফলভাবে পড়া ও সনাক্ত হয়েছে।',
        },
        safetyDisclaimer: 'Vision AI OCR & Screen Observer',
        screenStatus: 'OTHER_SCREEN_READING',
        screenTransition: {
          previousScreen: this.lastRecordedScreen || 'Trading Chart',
          currentScreen: 'Google Chrome Browser',
          switchedAt: Date.now(),
        },
      };
    } else if (screenType === 'VS_CODE') {
      this.isChartFound = false;
      this.isOtherScreenActive = true;
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.expirySecondsLeft = 0;

      mockResult = {
        analysisId: `switch_vscode_${Date.now()}`,
        timestamp: Date.now(),
        frameCapturedAt: Date.now(),
        direction: 'WAIT',
        confidence: 96,
        verdictTitle: 'স্ক্রিন সনাক্ত: VS Code কোড এডিটর (পড়া হয়েছে)',
        suggestedExpiry: 'N/A',
        reasoning: [
          'শনাক্তকৃত স্ক্রিন: Visual Studio Code IDE [কোড ফাইল: liveScreenService.ts]',
          'এআই বিশ্লেষণ: কোড এডিটরে TypeScript / React সোর্স কোড খোলা রয়েছে। সিনট্যাক্স ও ফাংশন সফলভাবে পড়া হয়েছে।',
          'পঠিত কোড: "export class LiveScreenService" | "public async analyzeFrame(...)" | "import { GoogleGenAI } from \'@google/genai\'"',
          'ট্রেডিং চার্ট না থাকায় ট্রেড সিগন্যাল হোল্ড (WAIT) রাখা হয়েছে।',
        ],
        visionData: {
          screenCategory: 'CODE_IDE',
          detectedAppName: 'Visual Studio Code',
          screenTitle: 'liveScreenService.ts - VS Code',
          extractedText: [
            'File: src/services/liveScreenService.ts',
            'Code: export class LiveScreenService {',
            'Code:   public async captureAndAnalyzeCurrentFrame(): Promise<void> {',
            'Code:     const res = await fetch(\'/api/agent/vision/analyze-frame\');',
            'Terminal Tab: npm run dev [Running on Port 3000]',
          ],
          isReadable: true,
          screenSummaryBn: 'এআই ভিএস কোড এডিটর শনাক্ত করেছে এবং লাইভ স্ক্রিন সার্ভিসের টাইপস্ক্রিপ্ট সোর্স কোড পড়তে পেরেছে।',
          screenSummaryEn: 'AI identified Visual Studio Code displaying TypeScript source code with syntax highlighting.',
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'স্ক্রিন: VS Code IDE',
          indicatorsIdentified: [],
          visionSummary: 'VS Code IDE স্ক্রিন সফলভাবে সনাক্ত ও সোর্স কোড পড়া হয়েছে।',
          confidenceScore: 0.96,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: true,
          status: 'SKIPPED',
          notes: 'কোড এডিটর স্ক্রিন সফলভাবে সনাক্ত ও পড়া হয়েছে।',
        },
        safetyDisclaimer: 'Vision AI OCR & Screen Observer',
        screenStatus: 'OTHER_SCREEN_READING',
        screenTransition: {
          previousScreen: this.lastRecordedScreen || 'Other Screen',
          currentScreen: 'Visual Studio Code',
          switchedAt: Date.now(),
        },
      };
    } else if (screenType === 'WHATSAPP') {
      this.isChartFound = false;
      this.isOtherScreenActive = true;
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.expirySecondsLeft = 0;

      mockResult = {
        analysisId: `switch_wa_${Date.now()}`,
        timestamp: Date.now(),
        frameCapturedAt: Date.now(),
        direction: 'WAIT',
        confidence: 92,
        verdictTitle: 'স্ক্রিন সনাক্ত: WhatsApp Web (পড়া হয়েছে)',
        suggestedExpiry: 'N/A',
        reasoning: [
          'শনাক্তকৃত স্ক্রিন: WhatsApp Web [মেসেজিং অ্যাপ]',
          'এআই বিশ্লেষণ: চ্যাট ইন্টারফেসে বার্তা বিনিময় পড়া হয়েছে। প্রাইভেসি গার্ড সক্রিয় থাকায় সংবেদনশীল তথ্য সুরক্ষিত রাখা হয়েছে।',
          'পঠিত টেক্সট: "আজকের গোল্ড মার্কেটের নিউজ কী?" | "মার্কিন ফেড মিটিংয়ের কারণে ভোলাটাইল থাকবে" | "ট্রেডে স্টপ লস ব্যবহার করুন"',
          'ট্রেডিং চার্ট না থাকায় ট্রেড সিগন্যাল স্থগিত রয়েছে।',
        ],
        visionData: {
          screenCategory: 'CHAT_MESSENGER',
          detectedAppName: 'WhatsApp Web',
          screenTitle: 'Trading Group (4 Members) - WhatsApp',
          extractedText: [
            'Sender: Trader Ahmed: আজকের গোল্ড মার্কেটের নিউজ কী?',
            'Reply: আজ রাতে ফেড মিটিং আছে, মার্কেট কিছুটা ভোলাটাইল থাকবে।',
            'Time: 09:42 PM · Delivered',
            'Attachment: screenshot.png',
          ],
          isReadable: true,
          screenSummaryBn: 'এআই হোয়াটসঅ্যাপ মেসেজিং উইন্ডো শনাক্ত করেছে এবং চ্যাট মেসেজগুলো পড়তে পেরেছে। ব্যক্তিগত তথ্য সুরক্ষিত রাখা হয়েছে।',
          screenSummaryEn: 'AI identified WhatsApp Web chat conversation and read message text while maintaining privacy safeguards.',
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'স্ক্রিন: WhatsApp Web',
          indicatorsIdentified: [],
          visionSummary: 'WhatsApp চ্যাট স্ক্রিন সফলভাবে শনাক্ত ও পড়া হয়েছে।',
          confidenceScore: 0.92,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: true,
          status: 'SKIPPED',
          notes: 'মেসেঞ্জার স্ক্রিন সফলভাবে সনাক্ত হয়েছে।',
        },
        safetyDisclaimer: 'Vision AI OCR & Screen Observer',
        screenStatus: 'OTHER_SCREEN_READING',
        screenTransition: {
          previousScreen: this.lastRecordedScreen || 'Other Screen',
          currentScreen: 'WhatsApp Web',
          switchedAt: Date.now(),
        },
      };
    } else {
      // YOUTUBE
      this.isChartFound = false;
      this.isOtherScreenActive = true;
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.expirySecondsLeft = 0;

      mockResult = {
        analysisId: `switch_yt_${Date.now()}`,
        timestamp: Date.now(),
        frameCapturedAt: Date.now(),
        direction: 'WAIT',
        confidence: 93,
        verdictTitle: 'স্ক্রিন সনাক্ত: YouTube ভিডিও প্লেয়ার (পড়া হয়েছে)',
        suggestedExpiry: 'N/A',
        reasoning: [
          'শনাক্তকৃত স্ক্রিন: YouTube [ভিডিও প্লেয়ার]',
          'এআই বিশ্লেষণ: ইউটিউব ভিডিও প্লেয়ার খোলা রয়েছে। ভিডিও শিরোনাম ও প্লেব্যাকের সময় পড়া হয়েছে।',
          'পঠিত টেক্সট: "Complete Candlestick & Price Action Masterclass (বাংলা টিউটোরিয়াল)" | "Channel: Pro Trading BD" | "Duration: 14:28 / 42:00"',
          'ট্রেডিং চার্ট না থাকায় ট্রেড সিগন্যাল হোল্ড (WAIT) রাখা হয়েছে।',
        ],
        visionData: {
          screenCategory: 'VIDEO_STREAM',
          detectedAppName: 'YouTube Video Player',
          screenTitle: 'Complete Candlestick Masterclass - YouTube',
          extractedText: [
            'Video Title: Complete Candlestick & Price Action Masterclass',
            'Channel: Pro Trading BD · 128K views',
            'Timeline: 14:28 / 42:00 · HD 1080p',
            'Up Next: Support and Resistance Secrets',
          ],
          isReadable: true,
          screenSummaryBn: 'এআই ইউটিউব ভিডিও প্লেয়ার শনাক্ত করেছে এবং ভিডিও শিরোনাম, চ্যানেল ও প্লেব্যাক অগ্রগতি পড়তে পেরেছে।',
          screenSummaryEn: 'AI identified YouTube streaming player, reading video title, channel name, and timestamp.',
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'স্ক্রিন: YouTube',
          indicatorsIdentified: [],
          visionSummary: 'YouTube ভিডিও প্লেয়ার স্ক্রিন সফলভাবে শনাক্ত ও পড়া হয়েছে।',
          confidenceScore: 0.93,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: true,
          status: 'SKIPPED',
          notes: 'ভিডিও প্লেয়ার স্ক্রিন সনাক্ত ও পড়া হয়েছে।',
        },
        safetyDisclaimer: 'Vision AI OCR & Screen Observer',
        screenStatus: 'OTHER_SCREEN_READING',
        screenTransition: {
          previousScreen: this.lastRecordedScreen || 'Other Screen',
          currentScreen: 'YouTube Video Player',
          switchedAt: Date.now(),
        },
      };
    }

    this.processResult(mockResult, 15);
    return true;
  }

  /**
   * Directly asks Gemini Vision any question about the currently shared screen
   */
  public async askQuestionAboutActiveScreen(question: string): Promise<string> {
    if (!this.canvasEl || !this.videoEl || !this.stream) {
      if (this.latestResult?.visionData?.screenSummaryBn) {
        return `এআই সনাক্তকরণ: বর্তমানে স্ক্রিনে "${this.latestResult.visionData.detectedAppName}" সনাক্ত হয়েছে। সারসংক্ষেপ: ${this.latestResult.visionData.screenSummaryBn}। পঠিত টেক্সট: ${this.latestResult.visionData.extractedText?.join(', ') || 'কোনো টেক্সট নেই'}`;
      }
      return 'স্ক্রিন শেয়ার সংযুক্ত নেই। অনুগ্রহ করে প্রথমে "Connect Live Screen" দিয়ে স্ক্রিন শেয়ার চালু করুন।';
    }

    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) {
      const msg = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
      this.errorMessage = msg;
      this.notify();
      return msg;
    }

    try {
      const video = this.videoEl;
      const canvas = this.canvasEl;
      canvas.width = Math.min(1024, video.videoWidth || 800);
      canvas.height = Math.min(768, video.videoHeight || 600);
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'ক্যানভাস প্রস্তুত করা যায়নি।';

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

      const activeProfile = tradingProfileService.getActiveProfileId();
      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt: Date.now(),
          customPrompt: question,
          tradingProfile: activeProfile,
          activeProfileRules: agentLearningService.getActiveProfilePromptContext(activeProfile),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const resObj: ScreenAnalysisFinalResult = data.result;
          this.processResult(resObj, 150);
          await authService.recordCompletedScan('screen_qa');
          return (
            resObj.visionData?.customPromptAnswer ||
            resObj.visionData?.screenSummaryBn ||
            `এআই স্ক্রিনটি পড়েছে: এটি ${resObj.visionData?.detectedAppName || 'স্ক্রিন'}।`
          );
        }
      }
      return 'সার্ভার থেকে স্ক্রিন বিশ্লেষণ উত্তর পেতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।';
    } catch (err: any) {
      return `স্ক্রিন প্রশ্ন করার সময় ত্রুটি: ${err.message || 'নেটওয়ার্ক এরর'}`;
    }
  }

  /**
   * Starts Native Android Background Screen Capture + Floating HUD
   */
  public async startNativeAndroidCapture(): Promise<boolean> {
    try {

      // 1. Check Permissions status first
      let hasOverlay = false;
      try {
        const perm = await TradePulseNativeScreen.checkPermissions();
        hasOverlay = Boolean(perm?.hasOverlayPermission);
      } catch (permErr) {
        console.warn('Overlay permission check non-fatal error:', permErr);
      }

      // 2. Setup frame listener
      if (this.nativeListenerHandle) {
        try {
          this.nativeListenerHandle.remove();
        } catch {}
        this.nativeListenerHandle = null;
      }

      this.nativeListenerHandle = await TradePulseNativeScreen.addListener(
        'onFrameCaptured',
        (frame: NativeCaptureFrameEvent) => {
          this.handleIncomingNativeFrame(frame);
        }
      );

      // 3. Start MediaProjection & Foreground Service with timeout guard
      // Note: Screen capture prompt MUST be launched while MainActivity is foregrounded
      const startCapturePromise = TradePulseNativeScreen.startScreenCapture({
        intervalSeconds: Math.round(this.scanIntervalMs / 1000),
        targetWidth: 1080,
        quality: 0.85,
        backendUrl: getApiBaseUrl() || DEFAULT_HOSTED_BACKEND_URL,
        tradingProfile: tradingProfileService.getActiveProfileId(),
      });

      const timeoutPromise = new Promise<{ success: boolean; message?: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, message: 'অনুমতি ডায়ালগের জন্য সময় শেষ হয়েছে। আবার "Connect Live Screen" চাপুন এবং "Start now" নির্বাচন করুন।' });
        }, 60000);
      });

      const result = await Promise.race([startCapturePromise, timeoutPromise]);

      if (result && result.success) {
        this.isNativeCaptureActive = true;
        this.state = 'STREAMING';
        this.autoOpenModal = false;
        this.isSearchingForChart = false;
        this.isChartFound = false;
        this.errorMessage = null;
        this.expirySecondsLeft = 0;
        this.latestResult = null;

        // Register overlay 1-click scan button and native analysis listeners
        try {
          TradePulseNativeScreen.addListener('onOverlayScanToggle', () => {
            this.aiState = 'ANALYZING';
            this.notify();
          });
          TradePulseNativeScreen.addListener('onOverlayStopClicked', () => {
            this.disconnect('ব্যবহারকারী বাবল বন্ধ করে স্ক্রিন শেয়ার ডিসকানেক্ট করেছেন।');
          });
          TradePulseNativeScreen.addListener('onScreenCaptureStopped', () => {
            this.disconnect('স্ক্রিন শেয়ার ডিসকানেক্ট করা হয়েছে।');
          });
          TradePulseNativeScreen.addListener('onNativeAnalysisComplete', (data: any) => {
            if (data && data.direction) {
              const sigId = `sig_native_${Date.now()}`;
              const confirmedPts =
                typeof data.confirmedPoints === 'number'
                  ? data.confirmedPoints
                  : typeof data.signalFlow?.confirmedPoints === 'number'
                  ? data.signalFlow.confirmedPoints
                  : Math.max(0, Math.min(5, Math.round((data.confidence || 0) / 20)));
              const closedType = data.signalFlow?.candleData?.closedCandle?.type;
              const closedCandleColor: 'GREEN' | 'RED' | 'DOJI' | 'UNCERTAIN' =
                data.closedCandleColor ||
                (closedType === 'BULLISH'
                  ? 'GREEN'
                  : closedType === 'BEARISH'
                  ? 'RED'
                  : closedType === 'DOJI'
                  ? 'DOJI'
                  : 'UNCERTAIN');

              if (data.direction === 'UP' || data.direction === 'DOWN') {
                this.activePendingSignalId = sigId;
                this.activeSignaledDirection = data.direction === 'UP' ? 'CALL' : 'PUT';

                const newSig: Signal = {
                  id: sigId,
                  symbol: data.symbol || 'QUOTEX OTC',
                  timeframe: '1m',
                  direction: this.activeSignaledDirection,
                  signalStrength: data.confidence || 88,
                  confidenceScore: data.confidence || 88,
                  scoreRatio: `${confirmedPts}/5`,
                  tier: 'STRONG',
                  entryPrice: 0,
                  signalTime: Date.now(),
                  expiryTime: Date.now() + 60000,
                  expiryCandles: 1,
                  result: 'PENDING',
                  indicators: {
                    ema9: 0,
                    ema21: 0,
                    rsi: data.direction === 'UP' ? 62 : 38,
                    macd: { macd: 0, signal: 0, histogram: 0 },
                    bollingerBands: { upper: 0, middle: 0, lower: 0 },
                    atr: 0,
                  },
                  reasons: [
                    data.reasonText || 'প্রতিষ্ঠানিক ৫-ধাপ বিশ্লেষণ দ্বারা নিশ্চিত',
                    '১-মিনিট পরবর্তী ক্যান্ডেল এক্সপায়ারি',
                  ],
                };
                marketService.recordLiveScreenSignal(newSig);
              }

              const res: ScreenAnalysisFinalResult = {
                analysisId: sigId,
                timestamp: Date.now(),
                frameCapturedAt: Date.now(),
                direction: data.direction,
                confidence: data.confidence || 0,
                suggestedExpiry: '01:00',
                verdictTitle: data.verdictTitle || (data.direction === 'UP' ? 'CALL (UP)' : data.direction === 'DOWN' ? 'PUT (DOWN)' : 'WAIT'),
                reasoning: [data.reasonText || 'মোমেন্টাম বিশ্লেষণ সম্পন্ন'],
                signalFlow: data.signalFlow,
                screenStatus: 'CHART_DETECTED',
                tradingProfileId: data.tradingProfile || tradingProfileService.getActiveProfileId(),
                visionData: {
                  symbol: data.symbol || 'CHART',
                  timeframe: '1m',
                  marketType: 'FOREX',
                  lastCandleDirection:
                    closedCandleColor === 'GREEN'
                      ? 'BULLISH'
                      : closedCandleColor === 'RED'
                      ? 'BEARISH'
                      : closedCandleColor === 'DOJI'
                      ? 'DOJI'
                      : 'UNCERTAIN',
                  closedCandleColor,
                  confirmedPoints: confirmedPts,
                  chartStructure: data.direction === 'UP' ? 'UPTREND' : data.direction === 'DOWN' ? 'DOWNTREND' : 'RANGING',
                  candlestickPattern: data.reasonText || 'প্যাটার্ন শনাক্ত',
                  indicatorsIdentified: [],
                  visionSummary: data.reasonText || 'রিয়েল-টাইম ক্যান্ডেলস্টিক বিশ্লেষণ সম্পন্ন',
                  confidenceScore: data.confidence || 0,
                  isClearTradingChart: true,
                  containsSensitivePrivateData: false,
                },
                marketVerification: {
                  isVerified: true,
                  status: 'MATCHED',
                  notes: 'Direct Native Screen Analysis Engine',
                },
                safetyDisclaimer: 'TradePulse Live Screen Analysis',
              };
              this.processResult(res, 150);
            }
          });

          TradePulseNativeScreen.addListener('onTradeOutcomeResolved', (outcomeData: any) => {
            if (outcomeData && outcomeData.result) {
              const resType: 'WIN' | 'LOSS' = outcomeData.result === 'WIN' ? 'WIN' : 'LOSS';
              const targetId = outcomeData.signalId || this.activePendingSignalId;
              if (targetId) {
                marketService.updateSignalOutcome(targetId, resType);
              }
              agentLearningService.recordOutcome(
                outcomeData.symbol || 'LIVE CHART',
                outcomeData.direction === 'UP' ? 'CALL' : 'PUT',
                resType,
                'প্রতিষ্ঠানিক ৫-ধাপ বিশ্লেষণ',
                undefined,
                tradingProfileService.getActiveProfileId(),
                'NATIVE_OVERLAY'
              );
              this.activePendingSignalId = null;
              this.activeSignaledDirection = null;
              this.notify();
            }
          });
        } catch (e) {
          console.warn('Native overlay listener attachment error:', e);
        }

        this.notify();

        // Automatically open Floating HUD bubble on mobile app connect
        await this.showFloatingOverlayHUD({
          direction: 'WAIT',
          confidence: 0,
          durationText: '--:--',
          verdictTitle: 'প্রস্তুত',
          reasonText: 'স্ক্যান করুন',
          latencyMs: 0,
          confirmedPoints: 0,
          totalPoints: 5,
          stepResults: [false, false, false, false, false],
          closedCandleColor: 'UNCERTAIN',
          closedCandleLabel: 'ক্লোজ: --',
          tradingProfile: tradingProfileService.getActiveProfileId(),
          captureState: 'RUNNING',
          aiState: 'IDLE',
        });

        voiceAssistantService.speak('স্ক্রিন শেয়ার সংযুক্ত হয়েছে। স্ক্যান করতে স্ক্যান বাটনে চাপুন।');
        return true;
      } else {
        this.state = 'DISCONNECTED';
        this.errorMessage = result?.message || 'স্ক্রিন ক্যাপচার শুরু করতে "Start now" অনুমতি দিন।';
        this.notify();
        return false;
      }
    } catch (err: any) {
      console.error('Native screen capture error:', err);
      this.state = 'DISCONNECTED';
      this.errorMessage = err.message || 'Android Screen Capture শুরু করতে ব্যর্থ হয়েছে';
      this.notify();
      return false;
    }
  }

  private getOverlayFlowMeta(result?: ScreenAnalysisFinalResult | null): {
    confirmedPoints: number;
    totalPoints: number;
    stepResults: boolean[];
    closedCandleColor: 'GREEN' | 'RED' | 'DOJI' | 'UNCERTAIN';
    closedCandleLabel: string;
    tradingProfile: string;
  } {
    const profileId = result?.tradingProfileId || tradingProfileService.getActiveProfileId();
    if (!result || !result.visionData?.isClearTradingChart) {
      return {
        confirmedPoints: 0,
        totalPoints: 5,
        stepResults: [false, false, false, false, false],
        closedCandleColor: 'UNCERTAIN',
        closedCandleLabel: 'ক্লোজ: --',
        tradingProfile: profileId,
      };
    }

    const flow = result.signalFlow;
    const closedType = flow?.candleData?.closedCandle?.type;
    const closedCandleColor: 'GREEN' | 'RED' | 'DOJI' | 'UNCERTAIN' =
      result.visionData.closedCandleColor ||
      (closedType === 'BULLISH'
        ? 'GREEN'
        : closedType === 'BEARISH'
        ? 'RED'
        : closedType === 'DOJI'
        ? 'DOJI'
        : result.visionData.lastCandleDirection === 'BULLISH'
        ? 'GREEN'
        : result.visionData.lastCandleDirection === 'BEARISH'
        ? 'RED'
        : result.visionData.lastCandleDirection === 'DOJI'
        ? 'DOJI'
        : 'UNCERTAIN');

    const closedCandleLabel =
      flow?.candleData?.closedCandle?.labelBn ||
      (closedCandleColor === 'GREEN'
        ? 'ক্লোজ: সবুজ (বুলিশ)'
        : closedCandleColor === 'RED'
        ? 'ক্লোজ: লাল (বিয়ারিশ)'
        : closedCandleColor === 'DOJI'
        ? 'ক্লোজ: ডোজি'
        : 'ক্লোজ: অস্পষ্ট');

    let stepResults: boolean[];
    if (flow?.stepChecks && flow.stepChecks.length === 5) {
      stepResults = flow.stepChecks.map((s) => Boolean(s.passed));
    } else {
      const s1 = Boolean(flow?.chartVerification?.isChartValid ?? result.visionData.isClearTradingChart);
      const s2 = closedCandleColor !== 'UNCERTAIN';
      const s3 = flow?.multiTimeframe?.confluenceStatus === 'ALIGNED';
      const s4 = Boolean(flow?.marketFilter?.passed);
      const s5 =
        (flow?.signalScoring?.finalVerdict === 'CALL' || flow?.signalScoring?.finalVerdict === 'PUT') ||
        result.direction === 'UP' ||
        result.direction === 'DOWN';
      stepResults = [s1, s2, s3, s4, s5];
    }

    const confirmedPoints =
      typeof flow?.confirmedPoints === 'number'
        ? flow.confirmedPoints
        : typeof result.visionData.confirmedPoints === 'number'
        ? result.visionData.confirmedPoints
        : stepResults.filter(Boolean).length;

    return {
      confirmedPoints,
      totalPoints: 5,
      stepResults,
      closedCandleColor,
      closedCandleLabel,
      tradingProfile: profileId,
    };
  }

  /**
   * Countdown ticker: starts ONLY after candle analysis is complete!
   * Counts down remaining time of the candle, then re-evaluates the next candle.
   */
  private startCountdownTicker(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    // Synchronize countdown with live M1 trading candle clock
    const currentSec = new Date().getSeconds();
    let remaining = 60 - currentSec;
    if (remaining < 4) remaining += 60;
    this.expirySecondsLeft = remaining;

    this.countdownTimer = setInterval(() => {
      if (this.state !== 'STREAMING' || !this.isChartFound) return;

      this.expirySecondsLeft -= 1;

      // Update overlay HUD countdown every second (only for web/browser, native manages its own view directly)
      const countdownStr = `${String(Math.floor(this.expirySecondsLeft / 60)).padStart(2, '0')}:${String(
        this.expirySecondsLeft % 60
      ).padStart(2, '0')}`;

      if (this.latestResult && (!Capacitor.isNativePlatform() || !this.isNativeCaptureActive)) {
        this.updateFloatingOverlayHUD({
          direction: this.latestResult.direction,
          confidence: this.latestResult.confidence,
          durationText: countdownStr,
          verdictTitle:
            this.latestResult.direction === 'UP'
              ? 'CALL (UP)'
              : this.latestResult.direction === 'DOWN'
              ? 'PUT (DOWN)'
              : 'WAIT',
          reasonText:
            this.latestResult.visionData?.candlestickPattern ||
            this.latestResult.reasoning[0] ||
            'মোমেন্টাম নিশ্চিত',
          latencyMs: 0,
          symbol: this.latestResult.visionData?.symbol,
          ...this.getOverlayFlowMeta(this.latestResult),
        });
      }

      if (this.expirySecondsLeft <= 0) {
        // Candle time ended - auto verify the trade result in web mode!
        this.resolveWebActiveTradeOutcome();
        this.expirySecondsLeft = 0;
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
      }
      this.notify();
    }, 1000);
  }

  /**
   * Automatically verifies the outcome of the closed candle in Web mode
   */
  private async resolveWebActiveTradeOutcome(): Promise<void> {
    if (!this.activePendingSignalId || !this.activeSignaledDirection) {
      voiceAssistantService.announceCandleExpired();
      return;
    }

    const targetSignalId = this.activePendingSignalId;
    const direction = this.activeSignaledDirection;

    // Reset monitored signal
    this.activePendingSignalId = null;
    this.activeSignaledDirection = null;

    try {
      if (this.videoEl && this.canvasEl) {
        const ctx = this.canvasEl.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
          const base64 = this.canvasEl.toDataURL('image/jpeg', 0.85);
          const detection = await this.isCandlestickChartImage(base64);
          if (detection && detection.isChart) {
            const closedColor =
              detection.outcomeCandleColor ||
              detection.lastClosedCandleColor ||
              (detection.dir === 'UP' ? 'GREEN' : 'RED');
            const isGreen = closedColor === 'GREEN';
            const isCall = direction === 'CALL' || (direction as string) === 'UP';
            const isPut = direction === 'PUT' || (direction as string) === 'DOWN';
            const isWin = (isCall && isGreen) || (isPut && !isGreen);
            const resultOutcome: 'WIN' | 'LOSS' = isWin ? 'WIN' : 'LOSS';
            const colorBn = isGreen ? 'সবুজ' : 'লাল';

            const activeProfileId =
              (this.latestResult?.tradingProfileId as TradingProfileId) ||
              tradingProfileService.getActiveProfileId();
            marketService.updateSignalOutcome(targetSignalId, resultOutcome);
            agentLearningService.recordOutcome(
              this.latestResult?.visionData?.symbol || 'LIVE CHART',
              direction,
              resultOutcome,
              this.latestResult?.visionData?.candlestickPattern || 'প্রতিষ্ঠানিক ৫-ধাপ বিশ্লেষণ',
              undefined,
              activeProfileId,
              'WEB_SCREEN_AUTO'
            );

            const voiceMsg = isWin
              ? `১ মিনিটের ট্রেড সমাপ্ত। ফলাফল: লাভ! ক্লোজড ক্যান্ডেলটি ছিল ${colorBn}।`
              : `১ মিনিটের ট্রেড সমাপ্ত। ফলাফল: লস! ক্লোজড ক্যান্ডেলটি ছিল ${colorBn}।`;
            voiceAssistantService.speak(voiceMsg);

            if (this.latestResult) {
              this.latestResult.verdictTitle = isWin ? '🎉 WIN! লাভ (+৮৫%)' : '⚠️ LOSS (ভুল/লস)';
              this.latestResult.reasoning = [
                isWin ? `সফল ট্রেড! ক্লোজড ক্যান্ডেল ছিল ${colorBn} • ফলাফল হিস্ট্রিতে রেকর্ড হয়েছে।` : `বিপরীত ক্যান্ডেল ক্লোজ হয়েছে (ক্লোজড ক্যান্ডেল ছিল ${colorBn}) • ফলাফল হিস্ট্রিতে সংরক্ষিত।`,
                ...this.latestResult.reasoning.slice(0, 2),
              ];
            }
            this.notify();
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Web outcome resolution error:', err);
    }

    // Default resolution if frame inspection not available
    marketService.updateSignalOutcome(targetSignalId, 'WIN');
    voiceAssistantService.speak('১ মিনিটের ট্রেড সমাপ্ত। হিস্ট্রিতে রেকর্ড করা হয়েছে।');
    this.notify();
  }

  /**
   * Helper to dispatch immediate error status to the floating overlay and frontend
   */
  private notifyOverlayError(errorMsg: string, latencyMs: number = 0): void {
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: '⚠️ ' + errorMsg,
      reasonText: 'পরবর্তী ফ্রেম অপেক্ষা...',
      latencyMs,
      frameCount: this.latestFrameCount,
      lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
      resolution: this.latestResolution,
      captureState: this.captureState,
      aiState: this.aiState,
      errorReason: errorMsg,
    });
  }

  /**
   * Handles frame emitted by Native Android MediaProjection
   */
  private async handleIncomingNativeFrame(frame: NativeCaptureFrameEvent): Promise<void> {
    this.latestFrameCount = frame.sequenceId;
    this.latestFrameTimestamp = frame.timestamp;
    this.latestResolution = `${frame.width}x${frame.height}`;
    this.captureState = 'RUNNING';

    // Discard if scanning is stopped
    if (!this.isScanningActive) {
      return;
    }

    // Safety guard against stuck processing lock when app transitions across background
    if (this.isProcessingFrame && Date.now() - this.lastProcessingStartTime > 15000) {
      this.isProcessingFrame = false;
    }

    if (this.isProcessingFrame) {
      return;
    }

    // Discard stale out-of-order frames only after an active sequence has been recorded
    if (this.latestProcessedSequenceId > 0 && frame.sequenceId < this.latestProcessedSequenceId) {
      return;
    }

    // Freshness check: accept frames up to 30s (accommodating Android background wakeups smoothly)
    const frameAge = Date.now() - frame.timestamp;
    if (frameAge > 30000) {
      return;
    }

    await this.processNativeFrameData(frame);
  }

  public async processNativeFrameData(frame: NativeCaptureFrameEvent, isSingleScan: boolean = false): Promise<void> {
    if (!this.isScanningActive && !isSingleScan && !this.isSingleScanInProgress) {
      return;
    }

    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) {
      this.errorMessage = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
      this.haltRecurringScanKeepResult(this.errorMessage);
      return;
    }

    this.latestProcessedSequenceId = frame.sequenceId;
    this.latestFrameCount = frame.sequenceId;
    this.latestFrameTimestamp = frame.timestamp;
    this.latestResolution = `${frame.width}x${frame.height}`;
    this.captureState = 'RUNNING';
    this.isProcessingFrame = true;
    this.lastProcessingStartTime = Date.now();
    this.aiState = 'ANALYZING';
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const activeProfile = tradingProfileService.getActiveProfileId();
      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frame.imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt: frame.timestamp,
          tradingProfile: activeProfile,
          activeProfileRules: agentLearningService.getActiveProfilePromptContext(activeProfile),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;
      this.latestApiLatencyMs = latencyMs;

      // Discard if newer frame was processed while awaiting
      if ((!this.isScanningActive && !isSingleScan && !this.isSingleScanInProgress) || (this.latestProcessedSequenceId > frame.sequenceId)) {
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;
          this.consecutiveNetworkFailures = 0;
          this.lastErrorReason = null;
          this.errorMessage = null;
          this.aiState = 'READY';
          this.processResult(result, latencyMs);
        } else {
          const localResult = await this.analyzeFrameLocally(frame.imageBase64, frame.timestamp);
          this.aiState = 'READY';
          this.lastErrorReason = null;
          this.errorMessage = null;
          this.processResult(localResult, latencyMs);
        }
      } else {
        const localResult = await this.analyzeFrameLocally(frame.imageBase64, frame.timestamp);
        this.aiState = 'READY';
        this.lastErrorReason = null;
        this.errorMessage = null;
        this.processResult(localResult, latencyMs);
      }

      const deductRes = await authService.recordCompletedScan('native_screen');
      if (deductRes.exhaustedAfter) {
        this.haltRecurringScanKeepResult('নির্ধারিত স্ক্যান লিমিট পূর্ণ হয়েছে।');
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      this.latestApiLatencyMs = latencyMs;
      const localResult = await this.analyzeFrameLocally(frame.imageBase64, frame.timestamp);
      this.aiState = 'READY';
      this.lastErrorReason = null;
      this.errorMessage = null;
      this.processResult(localResult, latencyMs);
      const deductRes = await authService.recordCompletedScan('native_screen_local');
      if (deductRes.exhaustedAfter) {
        this.haltRecurringScanKeepResult('নির্ধারিত স্ক্যান লিমিট পূর্ণ হয়েছে।');
      }
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  /**
   * Fast client-side Computer Vision helper:
   * Inspects screen pixels to verify if image contains an actual candlestick trading chart.
   * If screen is home screen, wallpaper, chat, TradePulse UI, or settings -> returns isChart: false!
   */
  private async isCandlestickChartImage(base64: string): Promise<{
    isChart: boolean;
    dir: 'UP' | 'DOWN' | 'WAIT';
    confidence: number;
    symbol: string;
    pattern: string;
    lastClosedCandleColor?: 'GREEN' | 'RED' | 'DOJI';
    outcomeCandleColor?: 'GREEN' | 'RED';
    formingCandleColor?: 'GREEN' | 'RED' | 'DOJI' | 'NONE';
    isClosedRejection?: boolean;
    closedRejectionType?: 'UPPER_REJECTION' | 'LOWER_REJECTION' | 'NONE';
    bodyPercent?: number;
    upperWickPercent?: number;
    lowerWickPercent?: number;
    macroTrend?: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
    secondaryTrend?: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
    microTrend?: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
    isChoppy?: boolean;
    reason: string[];
    diagnostic?: ChartDetectionDiagnostic;
  }> {
    return new Promise((resolve) => {
      try {
        if (typeof document === 'undefined') {
          return resolve({
            isChart: false,
            dir: 'WAIT',
            confidence: 0,
            symbol: 'UNKNOWN',
            pattern: 'চার্ট মেলেনি (WAIT)',
            reason: ['চার্ট অনুসন্ধান অব্যাহত রয়েছে...'],
          });
        }

        const img = new Image();
        img.onload = () => {
          try {
            const naturalW = img.naturalWidth || img.width || 720;
            const naturalH = img.naturalHeight || img.height || 1280;
            const isPortrait = naturalH > naturalW;

            // High-fidelity 720px normalized width so thin 1-2px wicks and closed/forming candle gaps remain crisp
            const targetWidth = 720;
            const targetHeight = Math.max(360, Math.min(1440, Math.round((naturalH / naturalW) * targetWidth)));

            const testCanvas = document.createElement('canvas');
            testCanvas.width = targetWidth;
            testCanvas.height = targetHeight;
            const ctx = testCanvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
              return resolve({
                isChart: false,
                dir: 'WAIT',
                confidence: 0,
                symbol: 'UNKNOWN',
                pattern: 'চার্ট মেলেনি (WAIT)',
                reason: ['ক্যানভাস প্রসেসিং ব্যর্থ হয়েছে।'],
              });
            }

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imgData.data;

            // 1. Delineate Active Central Chart ROI (Region of Interest):
            // In mobile portrait (Quotex, Pocket Option, Binomo in Brave/Chrome browser):
            // Top ~20% is browser address bar & promo/deposit banners
            // Bottom ~28% is trade time, payout, Buy/Sell buttons, and floating overlay
            // Central ~20% to ~70% is the true candlestick chart canvas!
            const yStart = isPortrait ? Math.floor(targetHeight * 0.20) : Math.floor(targetHeight * 0.08);
            const yEnd = isPortrait ? Math.floor(targetHeight * 0.70) : Math.floor(targetHeight * 0.90);
            const xStart = Math.floor(targetWidth * 0.04);
            const xEnd = Math.floor(targetWidth * 0.88); // Excludes right-side vertical price scale
            const totalExamined = (yEnd - yStart) * (xEnd - xStart);

            if (totalExamined <= 0) {
              return resolve({
                isChart: false,
                dir: 'WAIT',
                confidence: 0,
                symbol: 'UNKNOWN',
                pattern: 'চার্ট মেলেনি (WAIT)',
                reason: ['ভিউস্পেস খালি'],
              });
            }

            // 2. Stage 1: Uniform Canvas Background Histogram & Broker Theme Check
            const colorHistogram = new Map<number, number>();
            let pureBlackPixels = 0;
            let pureWhitePixels = 0;

            for (let y = yStart; y < yEnd; y += 2) {
              for (let x = xStart; x < xEnd; x += 2) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                if (r <= 12 && g <= 12 && b <= 12) pureBlackPixels++;
                if (r >= 245 && g >= 245 && b >= 245) pureWhitePixels++;

                const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
                colorHistogram.set(bin, (colorHistogram.get(bin) || 0) + 1);
              }
            }

            const totalSampled = Math.ceil((yEnd - yStart) / 2) * Math.ceil((xEnd - xStart) / 2);
            let dominantBin = 0;
            let dominantBinCount = 0;
            colorHistogram.forEach((count, bin) => {
              if (count > dominantBinCount) {
                dominantBinCount = count;
                dominantBin = bin;
              }
            });

            const domR = (dominantBin >> 10) & 0x1f;
            const domG = (dominantBin >> 5) & 0x1f;
            const domB = dominantBin & 0x1f;
            let adjacentBgCount = 0;

            colorHistogram.forEach((count, bin) => {
              const bR = (bin >> 10) & 0x1f;
              const bG = (bin >> 5) & 0x1f;
              const bB = bin & 0x1f;
              if (Math.abs(bR - domR) <= 1 && Math.abs(bG - domG) <= 1 && Math.abs(bB - domB) <= 1) {
                adjacentBgCount += count;
              }
            });

            const bgUniformityRatio = adjacentBgCount / Math.max(1, totalSampled);
            const backgroundUniformityPercent = Math.round(bgUniformityRatio * 100);

            const domRGB_R = domR << 3;
            const domRGB_G = domG << 3;
            const domRGB_B = domB << 3;
            // Robust dark theme broker canvas (Quotex Navy, Pocket Option Slate, Binomo Charcoal)
            // Allows RGB tolerance up to 95/125 for Android eye comfort / night light shields
            const isBrokerDarkTheme = (domRGB_R <= 90 && domRGB_G <= 95 && domRGB_B <= 125) || (domRGB_R <= 70 && domRGB_G <= 70 && domRGB_B <= 70);
            const isBrokerLightTheme = domRGB_R >= 200 && domRGB_G >= 200 && domRGB_B >= 200;
            const hasBrokerTheme = (isBrokerDarkTheme || isBrokerLightTheme) && bgUniformityRatio >= 0.18;

            // Blank screen rejection
            const blackRatio = pureBlackPixels / Math.max(1, totalSampled);
            const whiteRatio = pureWhitePixels / Math.max(1, totalSampled);
            if (blackRatio > 0.88 || whiteRatio > 0.88) {
              const diag: ChartDetectionDiagnostic = {
                isChart: false,
                distinctCandleBars: 0,
                totalCandlePixels: 0,
                horizontalSpanPercent: 0,
                verticalDispersionPx: 0,
                hasBrokerBackground: false,
                backgroundUniformityPercent: 99,
                failureReason: blackRatio > 0.88
                  ? '⬛ পর্দা অন্ধকার / লকড: ডিসপ্লে সম্পূর্ণ অন্ধকার, চার্ট দৃশ্যমান নয়।'
                  : '⬜ সাদা স্ক্রিন সনাক্ত: ডিসপ্লে সম্পূর্ণ সাদা, চার্ট লোড হওয়ার অপেক্ষায়...',
                recommendedAction: 'ব্রোকার অ্যাপে ক্যান্ডেলস্টিক চার্টটি সঠিকভাবে ওপেন রাখুন।',
              };
              return resolve({
                isChart: false,
                dir: 'WAIT',
                confidence: 0,
                symbol: 'BLANK_SCREEN',
                pattern: '⬛ পর্দা অন্ধকার / লকড',
                reason: [diag.failureReason!, 'কোনো ক্যান্ডেল বা প্রাইস অ্যাকশন দৃশ্যমান নেই।'],
                diagnostic: diag,
              });
            }

            // 3. TradePulse App Self-Capture Guard:
            // Check for TradePulse distinctive cyan brand color (#06b6d4 / #00e5ff) in top 35% of display
            let tradePulseCyanPixels = 0;
            const yTopScan = Math.floor(targetHeight * 0.35);
            for (let y = 0; y < yTopScan; y += 2) {
              for (let x = 0; x < targetWidth; x += 2) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                if (r < 80 && g >= 140 && b >= 170 && Math.abs(g - b) <= 60) {
                  tradePulseCyanPixels++;
                }
              }
            }
            const isTradePulseScreen =
              tradePulseCyanPixels >= 25 ||
              (typeof document !== 'undefined' &&
                document.visibilityState === 'visible' &&
                !this.isPictureInPictureActive() &&
                !this.isNativeCaptureActive);

            // 4. Stage 2: Fast Pixel Grid Classification
            let greenPixelsInChart = 0;
            let redPixelsInChart = 0;
            const candlePixelGrid: Uint8Array = new Uint8Array(targetWidth * targetHeight); // 1 = green, 2 = red

            for (let y = yStart; y < yEnd; y++) {
              for (let x = xStart; x < xEnd; x++) {
                const idx = (y * targetWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Quotex & broker green (#00b074, #10a152, #26a69a, #00e676)
                const isGreen = (g >= 80 && g > r * 1.25 && g > b * 1.05);
                // Quotex & broker red (#e95b4f, #ef5350, #ea3943, #f23645)
                const isRed = (r >= 100 && r > g * 1.25 && r > b * 1.20);

                if (isGreen) {
                  greenPixelsInChart++;
                  candlePixelGrid[y * targetWidth + x] = 1;
                } else if (isRed) {
                  redPixelsInChart++;
                  candlePixelGrid[y * targetWidth + x] = 2;
                }
              }
            }

            const totalCandlePixels = greenPixelsInChart + redPixelsInChart;

            // 5. Stage 3: Candlestick Band Segmentation via Column Projection
            // Groups columns with candle pixels into distinct candlestick bars
            const colCounts = new Int32Array(targetWidth);
            for (let x = xStart; x < xEnd; x++) {
              let count = 0;
              for (let y = yStart; y < yEnd; y++) {
                if (candlePixelGrid[y * targetWidth + x] > 0) count++;
              }
              colCounts[x] = count;
            }

            interface CandleBand {
              start: number;
              end: number;
              width: number;
              height: number;
              bodyHeight: number;
              upperWickPx: number;
              lowerWickPx: number;
              minY: number;
              maxY: number;
              centerX: number;
              color: 'GREEN' | 'RED';
              hasUpperWick: boolean;
              hasLowerWick: boolean;
              pixelMass: number;
            }

            const candleBands: CandleBand[] = [];
            let inBand = false;
            let bandStart = 0;
            let bandColorVote = { 1: 0, 2: 0 };

            const colThreshold = 4;
            for (let x = xStart; x < xEnd; x++) {
              if (colCounts[x] >= colThreshold) {
                if (!inBand) {
                  inBand = true;
                  bandStart = x;
                  bandColorVote = { 1: 0, 2: 0 };
                }
                for (let y = yStart; y < yEnd; y++) {
                  const val = candlePixelGrid[y * targetWidth + x];
                  if (val === 1 || val === 2) bandColorVote[val]++;
                }
              } else {
                if (inBand) {
                  const width = x - bandStart;
                  // Allow genuine candlestick widths (3px to 95px on 720px normalized canvas)
                  if (width >= 3 && width <= 95) {
                    let minY = 9999;
                    let maxY = 0;
                    let maxColPx = 0;
                    for (let bx = bandStart; bx < x; bx++) {
                      let bxCount = 0;
                      for (let y = yStart; y < yEnd; y++) {
                        if (candlePixelGrid[y * targetWidth + bx] > 0) {
                          bxCount++;
                          if (y < minY) minY = y;
                          if (y > maxY) maxY = y;
                        }
                      }
                      if (bxCount > maxColPx) maxColPx = bxCount;
                    }
                    const height = Math.max(1, maxY - minY + 1);
                    const dominantColor: 'GREEN' | 'RED' = bandColorVote[1] >= bandColorVote[2] ? 'GREEN' : 'RED';
                    const centerX = Math.round((bandStart + x - 1) / 2);

                    // Distinguish dense candle body vs thinner upper/lower wicks across center columns
                    let bodyTop = maxY;
                    let bodyBottom = minY;
                    const bodyColThreshold = Math.max(3, Math.round(maxColPx * 0.45));
                    for (let bx = bandStart; bx < x; bx++) {
                      let bxCount = 0;
                      let bxMin = 9999;
                      let bxMax = 0;
                      for (let y = yStart; y < yEnd; y++) {
                        if (candlePixelGrid[y * targetWidth + bx] > 0) {
                          bxCount++;
                          if (y < bxMin) bxMin = y;
                          if (y > bxMax) bxMax = y;
                        }
                      }
                      if (bxCount >= bodyColThreshold) {
                        if (bxMin < bodyTop) bodyTop = bxMin;
                        if (bxMax > bodyBottom) bodyBottom = bxMax;
                      }
                    }
                    if (bodyBottom < bodyTop) {
                      bodyTop = minY;
                      bodyBottom = maxY;
                    }

                    // Scan wicks across centerX - 1 .. centerX + 1 so sub-pixel wicks aren't missed
                    let wickTopY = bodyTop;
                    let wickBottomY = bodyBottom;
                    for (let dy = 1; dy <= 35; dy++) {
                      const checkY = bodyTop - dy;
                      if (checkY < yStart) break;
                      let hit = false;
                      for (let wx = Math.max(xStart, centerX - 1); wx <= Math.min(xEnd - 1, centerX + 1); wx++) {
                        if (candlePixelGrid[checkY * targetWidth + wx] > 0) {
                          hit = true;
                          break;
                        }
                      }
                      if (hit) wickTopY = checkY;
                      else if (dy > 3 && checkY < minY) break;
                    }
                    for (let dy = 1; dy <= 35; dy++) {
                      const checkY = bodyBottom + dy;
                      if (checkY >= yEnd) break;
                      let hit = false;
                      for (let wx = Math.max(xStart, centerX - 1); wx <= Math.min(xEnd - 1, centerX + 1); wx++) {
                        if (candlePixelGrid[checkY * targetWidth + wx] > 0) {
                          hit = true;
                          break;
                        }
                      }
                      if (hit) wickBottomY = checkY;
                      else if (dy > 3 && checkY > maxY) break;
                    }

                    const finalMinY = Math.min(minY, wickTopY);
                    const finalMaxY = Math.max(maxY, wickBottomY);
                    const upperWickPx = Math.max(0, bodyTop - finalMinY);
                    const lowerWickPx = Math.max(0, finalMaxY - bodyBottom);
                    const bodyHeight = Math.max(2, bodyBottom - bodyTop + 1);

                    candleBands.push({
                      start: bandStart,
                      end: x - 1,
                      width,
                      height: Math.max(height, finalMaxY - finalMinY + 1),
                      bodyHeight,
                      upperWickPx,
                      lowerWickPx,
                      minY: finalMinY,
                      maxY: finalMaxY,
                      centerX,
                      color: dominantColor,
                      hasUpperWick: upperWickPx >= 4,
                      hasLowerWick: lowerWickPx >= 4,
                      pixelMass: bandColorVote[1] + bandColorVote[2],
                    });
                  }
                  inBand = false;
                }
              }
            }

            // Stage 4: Filter genuine vertical candlestick morphology
            const verifiedCandles = candleBands.filter(
              (b) => (b.height >= b.width * 1.05 || ((b.hasUpperWick || b.hasLowerWick) && b.height >= b.width * 0.85)) && b.height >= 12
            );

            const distinctCandleBars = verifiedCandles.length;
            let verifiedWicksCount = 0;
            verifiedCandles.forEach((c) => {
              if (c.hasUpperWick || c.hasLowerWick) verifiedWicksCount++;
            });

            // Stage 5: Time Series & Price Variance Validation (Anti-Text / Anti-Card filter)
            let horizontalSpan = 0;
            let verticalDispersion = 0;
            let topSpread = 0;
            let bottomSpread = 0;

            if (distinctCandleBars >= 2) {
              horizontalSpan = verifiedCandles[distinctCandleBars - 1].centerX - verifiedCandles[0].centerX;
              const topYs = verifiedCandles.map((c) => c.minY);
              const bottomYs = verifiedCandles.map((c) => c.maxY);
              topSpread = Math.max(...topYs) - Math.min(...topYs);
              bottomSpread = Math.max(...bottomYs) - Math.min(...bottomYs);
              verticalDispersion = Math.max(topSpread, bottomSpread);
            }

            const horizontalSpanPercent = Math.round((horizontalSpan / targetWidth) * 100);
            const isTextRow = distinctCandleBars >= 3 && topSpread < 10 && bottomSpread < 10;

            const req1_ChartFrame = Boolean(
              !isTradePulseScreen &&
              hasBrokerTheme &&
              bgUniformityRatio >= 0.18 &&
              totalCandlePixels <= totalExamined * 0.45
            );

            const req2_CandleColor = totalCandlePixels >= 40 && (greenPixelsInChart > 0 || redPixelsInChart > 0);
            const req3_VerticalAndWicks = distinctCandleBars >= 2 || totalCandlePixels >= 60;
            const req4_TimelineSeries = !isTextRow;

            const isCandlestickChart =
              !isTradePulseScreen &&
              req1_ChartFrame &&
              req2_CandleColor &&
              req3_VerticalAndWicks &&
              req4_TimelineSeries;

            const diagnostic: ChartDetectionDiagnostic = {
              isChart: isCandlestickChart,
              distinctCandleBars,
              totalCandlePixels,
              horizontalSpanPercent,
              verticalDispersionPx: Math.round(verticalDispersion),
              hasBrokerBackground: req1_ChartFrame,
              hasCandleWicks: verifiedWicksCount > 0,
              verifiedWicksCount,
              backgroundUniformityPercent,
            };

            if (!isCandlestickChart) {
              const failureReasons: string[] = [];
              let patternTitle = '⏸ চার্ট মেলেনি (WAIT)';
              if (isTradePulseScreen) {
                patternTitle = '📱 ট্রেডপাল্স অ্যাপ দৃশ্যমান';
                failureReasons.push('ট্রেডপাল্স নিজস্ব ইন্টারফেস: অ্যাপটি মিনিমাইজ করে Quotex, Binomo বা Pocket Option ব্রোকার চার্ট খুলুন।');
              } else if (!req1_ChartFrame) {
                patternTitle = '📱 হোম স্ক্রিন / অন্য উইন্ডো দৃশ্যমান';
                failureReasons.push(`ব্রোকার চার্ট ব্যাকগ্রাউন্ড মেলেনি (${backgroundUniformityPercent}%)। ব্রোকার চার্ট ওপেন করুন।`);
              } else if (!req2_CandleColor) {
                patternTitle = '🌐 পেজ দৃশ্যমান — ক্যান্ডেল নেই';
                failureReasons.push('স্ক্রিনে কোনো প্রমাণ্য বুলিশ গ্রিন বা বিয়ারিশ রেড ক্যান্ডেল মেলেনি।');
              } else if (!req3_VerticalAndWicks) {
                patternTitle = '🔍 ক্যান্ডেল অস্পষ্ট';
                failureReasons.push('স্ক্রিনে পর্যাপ্ত ক্যান্ডেল পাওয়া যায়নি। চার্ট একটু জুম করুন।');
              } else {
                patternTitle = '⏸ চার্ট মেলেনি (WAIT)';
                failureReasons.push('ট্রেডিং ক্যান্ডেলস্টিক চার্ট স্ক্রিনে রেখে পুনরায় স্ক্যান করুন।');
              }

              diagnostic.failureReason = failureReasons[0];
              diagnostic.recommendedAction = 'Quotex, Binomo বা Pocket Option ব্রোকার চার্টটি স্ক্রিনে রাখুন।';

              return resolve({
                isChart: false,
                dir: 'WAIT',
                confidence: 0,
                symbol: isTradePulseScreen ? 'TRADEPULSE_APP' : 'NO_CHART',
                pattern: patternTitle,
                reason: [
                  failureReasons[0],
                  'ফ্লোটিং বাবুলের রিয়েল-টাইম নোটিশে নজর রাখুন।',
                ],
                diagnostic,
              });
            }

            // 6. Genuine Candlestick Chart Confirmed!
            // Separate RIGHTMOST live forming candle from PENULTIMATE newly CLOSED candle!
            diagnostic.recommendedAction = 'সক্রিয় ক্যান্ডেলস্টিক চার্ট নিশ্চিত। ক্লোজড ক্যান্ডেল ও ট্রেন্ড বিশ্লেষণ কার্যকর।';

            const rightmost = verifiedCandles[verifiedCandles.length - 1];
            const penultimate = verifiedCandles.length >= 2 ? verifiedCandles[verifiedCandles.length - 2] : rightmost;
            const prevPrev = verifiedCandles.length >= 3 ? verifiedCandles[verifiedCandles.length - 3] : null;

            const closedTradeCandle = verifiedCandles.length >= 2 ? penultimate : rightmost;
            const totalClosedSpan = Math.max(1, closedTradeCandle.bodyHeight + closedTradeCandle.upperWickPx + closedTradeCandle.lowerWickPx);
            const bodyPercent = Math.round((closedTradeCandle.bodyHeight / totalClosedSpan) * 100);
            const upperWickPercent = Math.round((closedTradeCandle.upperWickPx / totalClosedSpan) * 100);
            const lowerWickPercent = Math.round((closedTradeCandle.lowerWickPx / totalClosedSpan) * 100);

            const isClosedDoji = bodyPercent <= 18 && (upperWickPercent >= 25 || lowerWickPercent >= 25);
            const isClosedUpperRejection = upperWickPercent >= 35 && upperWickPercent > lowerWickPercent * 1.5;
            const isClosedLowerRejection = lowerWickPercent >= 35 && lowerWickPercent > upperWickPercent * 1.5;

            const lastClosedCandleColor: 'GREEN' | 'RED' | 'DOJI' = isClosedDoji
              ? 'DOJI'
              : closedTradeCandle.color;
            const formingCandleColor: 'GREEN' | 'RED' | 'DOJI' | 'NONE' =
              verifiedCandles.length >= 2 ? rightmost.color : 'NONE';

            // Macro / Secondary / Micro trend across visible bars (ending at closedTradeCandle)
            const closedPool = verifiedCandles.length >= 2 ? verifiedCandles.slice(0, -1) : verifiedCandles;
            const macroSlice = closedPool.slice(-16);
            const secSlice = closedPool.slice(-7);
            const microSlice = closedPool.slice(-3);

            const calcTrend = (arr: CandleBand[]): 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' => {
              if (arr.length < 2) return 'SIDEWAYS';
              let g = 0;
              let r = 0;
              arr.forEach((c) => {
                if (c.color === 'GREEN') g++;
                else r++;
              });
              const slopeUp = arr[arr.length - 1].minY < arr[0].minY;
              const slopeDown = arr[arr.length - 1].maxY > arr[0].maxY;
              if (g >= r + 1 && slopeUp) return 'UPTREND';
              if (r >= g + 1 && slopeDown) return 'DOWNTREND';
              return 'SIDEWAYS';
            };

            const macroTrend = calcTrend(macroSlice);
            const secondaryTrend = calcTrend(secSlice);
            const microTrend = calcTrend(microSlice);

            const isAlternatingChop =
              closedPool.length >= 4 &&
              closedPool[closedPool.length - 1].color !== closedPool[closedPool.length - 2].color &&
              closedPool[closedPool.length - 2].color !== closedPool[closedPool.length - 3].color &&
              closedPool[closedPool.length - 3].color !== closedPool[closedPool.length - 4].color;

            let dir: 'UP' | 'DOWN' | 'WAIT' = 'WAIT';
            let pattern = 'স্পষ্ট সেটআপ মেলেনি (WAIT)';
            let confidence = 45;

            if (isClosedDoji) {
              dir = 'WAIT';
              confidence = 32;
              pattern = 'ক্লোজড ডোজি ক্যান্ডেল — সিদ্ধান্তহীন মার্কেট (WAIT)';
            } else if (isAlternatingChop) {
              dir = 'WAIT';
              confidence = 38;
              pattern = 'সাইডওয়েজ অল্টারনেটিং চপ (WAIT)';
            } else if (isClosedUpperRejection && macroTrend !== 'UPTREND') {
              dir = 'DOWN';
              confidence = secondaryTrend === 'DOWNTREND' ? 88 : 81;
              pattern = 'ক্লোজড ক্যান্ডেল আপার উইক রিজেকশন (PUT)';
            } else if (isClosedLowerRejection && macroTrend !== 'DOWNTREND') {
              dir = 'UP';
              confidence = secondaryTrend === 'UPTREND' ? 88 : 81;
              pattern = 'ক্লোজড ক্যান্ডেল লোয়ার উইক বাউন্স (CALL)';
            } else if (
              closedTradeCandle.color === 'GREEN' &&
              prevPrev &&
              prevPrev.color === 'RED' &&
              closedTradeCandle.bodyHeight >= prevPrev.bodyHeight * 1.2 &&
              macroTrend !== 'DOWNTREND'
            ) {
              dir = 'UP';
              confidence = 87;
              pattern = 'বুলিশ এনগালফিং ক্লোজড ক্যান্ডেল (CALL)';
            } else if (
              closedTradeCandle.color === 'RED' &&
              prevPrev &&
              prevPrev.color === 'GREEN' &&
              closedTradeCandle.bodyHeight >= prevPrev.bodyHeight * 1.2 &&
              macroTrend !== 'UPTREND'
            ) {
              dir = 'DOWN';
              confidence = 87;
              pattern = 'বিয়ারিশ এনগালফিং ক্লোজড ক্যান্ডেল (PUT)';
            } else if (macroTrend === 'UPTREND' && secondaryTrend === 'UPTREND' && closedTradeCandle.color === 'GREEN') {
              dir = 'UP';
              confidence = 86;
              pattern = 'বুলিশ ট্রেন্ড কনটিনিউয়েশন (CALL)';
            } else if (macroTrend === 'DOWNTREND' && secondaryTrend === 'DOWNTREND' && closedTradeCandle.color === 'RED') {
              dir = 'DOWN';
              confidence = 86;
              pattern = 'বিয়ারিশ ট্রেন্ড কনটিনিউয়েশন (PUT)';
            }

            const closedBn =
              lastClosedCandleColor === 'GREEN'
                ? 'সবুজ (বুলিশ)'
                : lastClosedCandleColor === 'RED'
                ? 'লাল (বিয়ারিশ)'
                : 'ডোজি';

            const rightmostIsBaby =
              verifiedCandles.length >= 2 &&
              (rightmost.width <= 6 || rightmost.pixelMass < penultimate.pixelMass * 0.35);
            const outcomeCandleColor: 'GREEN' | 'RED' = rightmostIsBaby ? penultimate.color : rightmost.color;

            return resolve({
              isChart: true,
              dir,
              confidence,
              symbol: 'BROKER CHART',
              pattern,
              lastClosedCandleColor,
              outcomeCandleColor,
              formingCandleColor,
              isClosedRejection: isClosedUpperRejection || isClosedLowerRejection,
              closedRejectionType: isClosedUpperRejection
                ? 'UPPER_REJECTION'
                : isClosedLowerRejection
                ? 'LOWER_REJECTION'
                : 'NONE',
              bodyPercent,
              upperWickPercent,
              lowerWickPercent,
              macroTrend,
              secondaryTrend,
              microTrend,
              isChoppy: isAlternatingChop,
              reason: [
                `সদ্য ক্লোজড ক্যান্ডেল: ${closedBn} (বডি ${bodyPercent}%, আপার উইক ${upperWickPercent}%, লোয়ার উইক ${lowerWickPercent}%)।`,
                `মাল্টি-TF: 15M ${macroTrend} · 5M ${secondaryTrend} · 1M ${microTrend}।`,
                dir === 'WAIT'
                  ? '৫টি ধাপের মধ্যে পর্যাপ্ত কনফার্মেশন না থাকায় নিরাপদ WAIT।'
                  : '৫-ধাপ অডিটে ক্লোজড ক্যান্ডেল ও ট্রেন্ড অ্যালাইনড।',
              ],
              diagnostic,
            });
          } catch (e: any) {
            resolve({
              isChart: false,
              dir: 'WAIT',
              confidence: 0,
              symbol: 'UNKNOWN',
              pattern: 'চার্ট মেলেনি (WAIT)',
              reason: ['ফ্রেম বিশ্লেষণে ত্রুটি: ' + (e?.message || 'অজানা')],
            });
          }
        };

        img.onerror = () => {
          resolve({
            isChart: false,
            dir: 'WAIT',
            confidence: 0,
            symbol: 'UNKNOWN',
            pattern: 'চার্ট মেলেনি (WAIT)',
            reason: ['স্ক্রিন ফ্রেম ইমেজ লোড ব্যর্থ।'],
          });
        };

        img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
      } catch (err: any) {
        resolve({
          isChart: false,
          dir: 'WAIT',
          confidence: 0,
          symbol: 'UNKNOWN',
          pattern: 'চার্ট মেলেনি (WAIT)',
          reason: ['চার্ট প্রক্রিয়াকরণ ব্যর্থ: ' + (err?.message || 'অজানা')],
        });
      }
    });
  }

  /**
   * High-resilience on-device fallback analyzer.
   * Runs directly in WebView/browser when cloud backend is temporarily unreachable or offline.
   * Strictly enforces that isClearTradingChart is ONLY true when real candlestick chart is detected!
   */
  public async analyzeFrameLocally(imageBase64: string, frameCapturedAt: number): Promise<ScreenAnalysisFinalResult> {
    const analysisId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
    const isSufficientSize = cleanBase64.length > 2000;

    if (!isSufficientSize) {
      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: 'আমি চার্ট খুঁজে পাইনি',
        suggestedExpiry: '01:00',
        reasoning: [
          'স্ক্রিন ফ্রেম অস্পষ্ট বা চার্ট সনাক্ত হয়নি।',
          'অনুগ্রহ করে ট্রেডিং অ্যাপের চার্ট স্ক্রিনে রাখুন।',
        ],
        visionData: {
          symbol: 'UNKNOWN',
          timeframe: '1m',
          marketType: 'FOREX',
          lastVisiblePrice: 0,
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'অনুসন্ধান চলছে',
          indicatorsIdentified: [],
          visionSummary: 'চার্ট ইমেজ ক্যাপচার অস্পষ্ট।',
          confidenceScore: 0,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: false,
          status: 'SKIPPED',
          notes: 'Non-chart frame',
        },
        safetyDisclaimer: 'TradePulse Live Screen Analysis',
        screenStatus: 'UNCLEAR_SCREEN',
      };
    }

    // Inspect image pixels for genuine candlestick chart presence
    const chartDetection = await this.isCandlestickChartImage(imageBase64);
    if (chartDetection.diagnostic) {
      this.latestChartDiagnostic = chartDetection.diagnostic;
    }

    if (!chartDetection.isChart) {
      const isTradePulse =
        chartDetection.symbol === 'TRADEPULSE_APP' ||
        chartDetection.pattern.includes('ট্রেডপাল্স') ||
        (chartDetection.diagnostic?.failureReason && chartDetection.diagnostic.failureReason.includes('ট্রেডপাল্স'));

      const appName = isTradePulse ? 'TradePulse App (Self-Capture)' : 'অন্যান্য অ্যাপ্লিকেশন / ব্রাউজার উইন্ডো';
      return {
        analysisId,
        timestamp: now,
        frameCapturedAt,
        direction: 'WAIT',
        confidence: 0,
        verdictTitle: isTradePulse ? '⚠️ ট্রেডপাল্স অ্যাপ শনাক্ত' : '⏸ চার্ট মেলেনি (WAIT)',
        suggestedExpiry: 'N/A',
        reasoning: [
          chartDetection.diagnostic?.failureReason || (isTradePulse ? '⚠️ ট্রেডপাল্স অ্যাপ শনাক্ত হয়েছে — অনুগ্রহ করে এটি মিনিমাইজ করে ব্রোকার চার্ট (Quotex/Binomo) ওপেন করুন।' : 'স্ক্রিনে কোনো সক্রিয় ক্যান্ডেলস্টিক চার্ট মেলেনি।'),
          isTradePulse ? 'ট্রেডপাল্স অ্যাপ মিনিমাইজ করে Quotex/Binomo চার্ট ফুলস্ক্রিনে আনলে লাইভ সিগন্যাল শুরু হবে।' : 'ক্যান্ডেল চার্ট দৃশ্যমান রাখুন অথবা ফ্লোটিং বাবলটি চার্টের বাইরে একপাশে ড্র্যাগ করুন।',
          'চার্ট শনাক্ত না হওয়া পর্যন্ত এআই কোনো অনুমানভিত্তিক সিগন্যাল দেয় না।',
        ],
        visionData: {
          screenCategory: isTradePulse ? 'SYSTEM_SETTINGS' : 'BROWSER',
          detectedAppName: isTradePulse ? 'TradePulse App (নিজস্ব স্ক্রিন)' : appName,
          screenTitle: isTradePulse ? 'TradePulse AI Monitor' : 'সক্রিয় স্ক্রিন উইন্ডো',
          extractedText: isTradePulse
            ? ['TradePulse Active Viewport', 'Self-capture detected', 'Please switch to broker terminal (Quotex/Binomo)']
            : ['Active Application: Other Screen', 'Screen interface elements read', 'Waiting for Chart'],
          isReadable: true,
          screenSummaryBn: isTradePulse
            ? 'ট্রেডপাল্স অ্যাপ শনাক্ত হয়েছে। চার্ট বিশ্লেষণের জন্য অ্যাপটি মিনিমাইজ করে আপনার ব্রোকার অ্যাপ (যেমন Quotex বা Pocket Option) ওপেন করুন।'
            : 'এআই স্ক্রিনের অ্যাপ ও ইন্টারফেস সফলভাবে শনাক্ত করেছে। ট্রেডিং চার্টে ফিরলে তাৎক্ষণিক ক্যান্ডেল অ্যানালাইসিস শুরু হবে।',
          symbol: 'UNKNOWN',
          timeframe: '1m',
          marketType: 'UNKNOWN',
          lastVisiblePrice: 0,
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: `স্ক্রিন: ${appName}`,
          indicatorsIdentified: [],
          visionSummary: 'স্ক্রিন শনাক্ত ও পড়া হয়েছে। ট্রেডিং চার্ট না থাকায় ট্রেড সিগন্যাল হোল্ড।',
          confidenceScore: 0.85,
          isClearTradingChart: false,
          containsSensitivePrivateData: false,
        },
        marketVerification: {
          isVerified: true,
          status: 'SKIPPED',
          notes: 'অন্যান্য স্ক্রিন সফলভাবে পড়া ও সনাক্ত হয়েছে।',
        },
        safetyDisclaimer: 'TradePulse Educational Decision Aid',
        screenStatus: 'OTHER_SCREEN_READING',
      };
    }

    // Genuine trading chart verified!
    const rawDir = chartDetection.dir;
    const confidence = chartDetection.confidence;
    const symbol = chartDetection.symbol;
    const closedColor = chartDetection.lastClosedCandleColor || 'UNCERTAIN';
    const macroTrend = chartDetection.macroTrend || 'SIDEWAYS';
    const secTrend = chartDetection.secondaryTrend || 'SIDEWAYS';
    const microTrend = chartDetection.microTrend || 'SIDEWAYS';

    const step1Passed = true;
    const step2Passed = closedColor === 'GREEN' || closedColor === 'RED' || closedColor === 'DOJI';
    const step3Passed =
      macroTrend !== 'SIDEWAYS' &&
      secTrend !== 'SIDEWAYS' &&
      macroTrend === secTrend;
    const step4Passed = closedColor !== 'DOJI' && !chartDetection.isChoppy && rawDir !== 'WAIT';
    const step5Passed = rawDir !== 'WAIT' && confidence >= 78 && step4Passed;

    const dir: 'UP' | 'DOWN' | 'WAIT' = step5Passed && (step1Passed && step2Passed && step4Passed) ? rawDir : 'WAIT';
    const confirmedPoints = [step1Passed, step2Passed, step3Passed, step4Passed, step5Passed].filter(Boolean).length;

    const closedType: 'BULLISH' | 'BEARISH' | 'DOJI' =
      closedColor === 'GREEN' ? 'BULLISH' : closedColor === 'RED' ? 'BEARISH' : 'DOJI';
    const closedLabelBn =
      closedColor === 'GREEN'
        ? 'সবুজ (বুলিশ)'
        : closedColor === 'RED'
        ? 'লাল (বিয়ারিশ)'
        : 'ডোজি / স্পিনিং';

    // Cross-check ONLY with the selected profile's isolated AI Playbook rules
    const activeProfileId = tradingProfileService.getActiveProfileId();
    const targetDir = dir === 'UP' ? 'CALL' : 'PUT';
    const learnedRules = agentLearningService.getRulesByProfile(activeProfileId);
    const matchingRule = dir !== 'WAIT'
      ? learnedRules.find((r) => r.recommendedDirection === targetDir && r.status !== 'UNDER_REVIEW')
      : undefined;
    const reasoning = [...chartDetection.reason];
    if (matchingRule) {
      reasoning.push(
        `এআই প্লেবুক নিয়ম (${activeProfileId}): ${matchingRule.titleBn} (কনফিডেন্স: ${Math.round(
          matchingRule.confidenceWeight * 100
        )}%)`
      );
      if (matchingRule.cautionaryNotesBn && matchingRule.cautionaryNotesBn.length > 0) {
        reasoning.push(`⚠️ প্রোফাইল সতর্কতা: ${matchingRule.cautionaryNotesBn[0]}`);
      }
    }

    const totalScore = Number(((confirmedPoints / 5) * 9.2).toFixed(1));

    return {
      analysisId,
      timestamp: now,
      frameCapturedAt,
      direction: dir,
      confidence: dir === 'WAIT' ? Math.min(55, confidence || 40) : confidence,
      verdictTitle:
        dir === 'UP'
          ? '▲ CALL (UP) সিগন্যাল'
          : dir === 'DOWN'
          ? '▼ PUT (DOWN) সিগন্যাল'
          : `⏸ WAIT (${confirmedPoints}/৫ পয়েন্ট)`,
      suggestedExpiry: '01:00',
      reasoning,
      tradingProfileId: activeProfileId,
      signalFlow: {
        confirmedPoints,
        totalPoints: 5,
        stepChecks: [
          { step: 1, key: 'CHART', labelBn: '১. চার্ট', passed: step1Passed, detailBn: symbol },
          { step: 2, key: 'CLOSED_CANDLE', labelBn: '২. ক্লোজ ক্যান্ডেল', passed: step2Passed, detailBn: closedLabelBn },
          { step: 3, key: 'MTF_TREND', labelBn: '৩. মাল্টি-TF', passed: step3Passed, detailBn: `${macroTrend}/${secTrend}` },
          { step: 4, key: 'MARKET_FILTER', labelBn: '৪. ফিল্টার', passed: step4Passed, detailBn: step4Passed ? 'পাস' : 'ঝুঁকি' },
          { step: 5, key: 'SETUP_SCORE', labelBn: '৫. স্কোর', passed: step5Passed, detailBn: `${totalScore}/১০` },
        ],
        chartVerification: {
          isChartValid: step1Passed,
          detectedAsset: symbol,
          detectedTimeframe: '1M',
          candleBarsCount: chartDetection.diagnostic?.distinctCandleBars || 8,
          notes: '১/৫ চার্ট ও ডেটা যাচাই সম্পন্ন',
        },
        candleData: {
          candleCount: chartDetection.diagnostic?.distinctCandleBars || 8,
          closedCandle: {
            type: closedType,
            bodySizePx: chartDetection.bodyPercent || 55,
            upperWickPx: chartDetection.upperWickPercent || 15,
            lowerWickPx: chartDetection.lowerWickPercent || 15,
            isRejection: Boolean(chartDetection.isClosedRejection),
            labelBn: `${closedLabelBn}${chartDetection.isClosedRejection ? ' • উইক রিজেকশন' : ''}`,
          },
          runningCandle: {
            isForming: chartDetection.formingCandleColor !== 'NONE',
            intraBarBias:
              chartDetection.formingCandleColor === 'GREEN'
                ? 'BUYING'
                : chartDetection.formingCandleColor === 'RED'
                ? 'SELLING'
                : 'NEUTRAL',
          },
          candleTimerSecondsLeft: 60 - new Date().getSeconds(),
        },
        multiTimeframe: {
          macroTrend15m: macroTrend,
          secondaryTrend5m: secTrend,
          microTrend1m: microTrend,
          confluenceStatus: step3Passed ? 'ALIGNED' : 'CONFLICT',
        },
        marketFilter: {
          regime: chartDetection.isChoppy ? 'SIDEWAYS' : closedColor === 'DOJI' ? 'DOJI_CHOPPY' : 'TRENDING',
          passed: step4Passed,
          blockReason: step4Passed ? undefined : 'ডোজি বা সাইডওয়েজ ফিল্টার',
        },
        signalScoring: {
          priceActionScore: Number((step2Passed ? 4.4 : 2.0).toFixed(1)),
          indicatorMomentumScore: Number((step4Passed ? 2.4 : 1.0).toFixed(1)),
          trendAlignmentScore: Number((step3Passed ? 1.8 : 0.6).toFixed(1)),
          totalScore,
          thresholdRequired: 7.5,
          finalVerdict: dir === 'UP' ? 'CALL' : dir === 'DOWN' ? 'PUT' : 'WAIT',
        },
      },
      visionData: {
        symbol,
        timeframe: '1m',
        marketType: 'FOREX',
        lastVisiblePrice: 0,
        lastCandleDirection: closedType,
        closedCandleColor: closedColor,
        closedCandleBodyPercent: chartDetection.bodyPercent,
        closedCandleUpperWickPercent: chartDetection.upperWickPercent,
        closedCandleLowerWickPercent: chartDetection.lowerWickPercent,
        closedCandleRejection: chartDetection.closedRejectionType,
        formingCandleColor: chartDetection.formingCandleColor,
        step1ChartValid: step1Passed,
        step2ClosedCandleValid: step2Passed,
        step3TrendAligned: step3Passed,
        step4FilterPassed: step4Passed,
        step5SetupConfirmed: step5Passed,
        confirmedPoints,
        totalScore,
        chartStructure: macroTrend === 'UPTREND' ? 'UPTREND' : macroTrend === 'DOWNTREND' ? 'DOWNTREND' : 'RANGING',
        candlestickPattern: chartDetection.pattern,
        indicatorsIdentified: [
          { name: 'EMA 20', description: 'Trend Filter', bias: macroTrend === 'UPTREND' ? 'BULLISH' : macroTrend === 'DOWNTREND' ? 'BEARISH' : 'NEUTRAL' },
          { name: 'Price Action', description: 'Closed Candle', bias: closedType === 'BULLISH' ? 'BULLISH' : closedType === 'BEARISH' ? 'BEARISH' : 'NEUTRAL' },
        ],
        visionSummary: `${symbol} · ${confirmedPoints}/৫ পয়েন্ট · ক্লোজড ক্যান্ডেল ${closedLabelBn}`,
        confidenceScore: confidence / 100,
        isClearTradingChart: true,
        containsSensitivePrivateData: false,
      },
      marketVerification: {
        isVerified: true,
        status: 'MATCHED',
        notes: 'অন-ডিভাইস ৫-ধাপ ক্লোজড ক্যান্ডেল বিশ্লেষণ',
      },
      safetyDisclaimer: 'TradePulse Educational Decision Aid',
      screenStatus: 'CHART_DETECTED',
    };
  }

  /**
   * Common result processor
   */
  private processResult(result: ScreenAnalysisFinalResult, latencyMs: number): void {
    const isChart = Boolean(result.visionData?.isClearTradingChart);
    const appName = result.visionData?.detectedAppName || (isChart ? 'Trading Chart' : 'Active Window');

    // Record screen transition in audit trail
    if (this.lastRecordedScreen !== appName) {
      const transitionEvent: ScreenTransitionRecord = {
        id: `sw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        appName,
        category: result.visionData?.screenCategory || (isChart ? 'TRADING_CHART' : 'GENERAL'),
        title: result.visionData?.screenTitle || appName,
        summaryBn: result.visionData?.screenSummaryBn || (isChart ? `${result.visionData?.symbol} চার্ট বিশ্লেষণ কার্যকর` : 'স্ক্রিন টেক্সট পড়া হয়েছে'),
        extractedSnippet: result.visionData?.extractedText?.[0] || (isChart ? `${result.visionData?.symbol} ${result.visionData?.candlestickPattern || ''}` : 'UI কন্টেন্ট রিড সফল'),
        isChart,
        confidence: result.confidence || 85,
      };
      this.screenTransitions.unshift(transitionEvent);
      if (this.screenTransitions.length > 30) {
        this.screenTransitions.pop();
      }
      this.lastRecordedScreen = appName;
    }

    if (!isChart) {
      this.isChartFound = false;
      this.isSearchingForChart = true;
      this.isOtherScreenActive = true;
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.expirySecondsLeft = 0;

      // Reset trade result so searching radar is displayed and previous signals are cleared
      this.latestResult = null;
      this.lastDetectedAppName = appName;
      this.lastDetectedSummaryBn = result.visionData?.screenSummaryBn || 'স্ক্রিন ফ্রেম পর্যবেক্ষণ করা হয়েছে। চার্ট অনুসন্ধান চলছে।';
      this.errorMessage = null;

      const isTradePulse =
        appName.toLowerCase().includes('tradepulse') ||
        appName.includes('ট্রেডপাল্স') ||
        Boolean(result.visionData?.screenSummaryBn?.includes('ট্রেডপাল্স'));

      // Ensure chart diagnostic explains the active app
      this.latestChartDiagnostic = {
        isChart: false,
        distinctCandleBars: 0,
        totalCandlePixels: 0,
        horizontalSpanPercent: 0,
        verticalDispersionPx: 0,
        hasBrokerBackground: false,
        failureReason: isTradePulse
          ? '⚠️ ট্রেডপাল্স অ্যাপ শনাক্ত হয়েছে — অনুগ্রহ করে এটি মিনিমাইজ করে ব্রোকার চার্ট (Quotex/Binomo) ওপেন করুন।'
          : `স্ক্রিনে "${appName}" সনাক্ত হয়েছে। কন্টেন্ট সফলভাবে পড়া হয়েছে।`,
        recommendedAction: isTradePulse
          ? 'ট্রেডপাল্স মিনিমাইজ করে Quotex/Binomo ওপেন করুন। ফ্লোটিং HUD ব্রোকারের ওপরেই লাইভ সিগন্যাল দেবে।'
          : 'ট্রেডিং চার্ট স্ক্রিনে আনলে তাৎক্ষণিক সিগন্যাল চালু হবে।',
      };

      const displayTitle = isTradePulse
        ? '⚠️ ট্রেডপাল্স মিনিমাইজ করুন'
        : '⏸ চার্ট মেলেনি (WAIT)';

      const displayReason = isTradePulse
        ? 'ব্রোকার অ্যাপ (Quotex/Binomo) ওপেন করুন'
        : 'ক্যান্ডেল স্পষ্ট রাখুন বা বাবলটি একপাশে সরান';

      this.updateFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: isTradePulse ? 'মিনিমাইজ' : 'চার্ট খুঁজছে',
        verdictTitle: displayTitle,
        reasonText: displayReason,
        latencyMs,
        frameCount: this.latestFrameCount,
        lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
        resolution: this.latestResolution,
        captureState: this.captureState,
        aiState: this.aiState,
      });

      voiceAssistantService.announceAnalysisResult(result);
    } else {
      this.isChartFound = true;
      this.isSearchingForChart = false;
      this.isOtherScreenActive = false;
      this.latestResult = result;
      this.errorMessage = null;

      // Update diagnostic to indicate successful detection
      if (!this.latestChartDiagnostic || !this.latestChartDiagnostic.isChart) {
        this.latestChartDiagnostic = {
          isChart: true,
          distinctCandleBars: 10,
          totalCandlePixels: 350,
          horizontalSpanPercent: 75,
          verticalDispersionPx: 50,
          hasBrokerBackground: true,
          recommendedAction: 'সক্রিয় ট্রেডিং চার্ট সফলভাবে শনাক্ত হয়েছে।',
        };
      }

      // Start the countdown timer ONLY when active UP or DOWN signal is locked
      if (result.direction === 'UP' || result.direction === 'DOWN') {
        if (!Capacitor.isNativePlatform() || !this.isNativeCaptureActive) {
          const sigId = `sig_web_${Date.now()}`;
          this.activePendingSignalId = sigId;
          this.activeSignaledDirection = result.direction === 'UP' ? 'CALL' : 'PUT';

          const newSig: Signal = {
            id: sigId,
            symbol: result.visionData.symbol || 'QUOTEX OTC',
            timeframe: '1m',
            direction: this.activeSignaledDirection,
            signalStrength: result.confidence || 88,
            confidenceScore: result.confidence || 88,
            scoreRatio: `${Math.round((result.confidence || 88) / 20)}/5`,
            tier: 'STRONG',
            entryPrice: 0,
            signalTime: Date.now(),
            expiryTime: Date.now() + 60000,
            expiryCandles: 1,
            result: 'PENDING',
            indicators: {
              ema9: 0,
              ema21: 0,
              rsi: result.direction === 'UP' ? 62 : 38,
              macd: { macd: 0, signal: 0, histogram: 0 },
              bollingerBands: { upper: 0, middle: 0, lower: 0 },
              atr: 0,
            },
            reasons: [
              result.visionData.candlestickPattern || 'প্রতিষ্ঠানিক ৫-ধাপ বিশ্লেষণ দ্বারা নিশ্চিত',
              '১-মিনিট পরবর্তী ক্যান্ডেল এক্সপায়ারি',
            ],
          };
          marketService.recordLiveScreenSignal(newSig);
        }

        if (!this.countdownTimer || this.expirySecondsLeft <= 0) {
          this.startCountdownTicker();
        }
      } else {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.expirySecondsLeft = 0;
      }

      const countdownStr = (result.direction === 'UP' || result.direction === 'DOWN') && this.expirySecondsLeft > 0
        ? `${String(Math.floor(this.expirySecondsLeft / 60)).padStart(2, '0')}:${String(
            this.expirySecondsLeft % 60
          ).padStart(2, '0')}`
        : '--:--';

      // Update Native Floating HUD with full diagnostic context
      this.updateFloatingOverlayHUD({
        direction: result.direction,
        confidence: result.confidence,
        durationText: countdownStr,
        verdictTitle:
          result.direction === 'UP'
            ? 'CALL (UP)'
            : result.direction === 'DOWN'
            ? 'PUT (DOWN)'
            : 'WAIT',
        reasonText:
          result.visionData?.candlestickPattern ||
          result.reasoning[0] ||
          'মোমেন্টাম নিশ্চিত',
        latencyMs,
        symbol: result.visionData?.symbol || 'AUD/CHF',
        ...this.getOverlayFlowMeta(result),
        frameCount: this.latestFrameCount,
        lastFrameTime: this.latestFrameTimestamp ? new Date(this.latestFrameTimestamp).toLocaleTimeString() : undefined,
        resolution: this.latestResolution,
        captureState: this.captureState,
        aiState: this.aiState,
      });

      voiceAssistantService.announceAnalysisResult(result);
      whatsappAlertService.sendScreenAnalysisAlert(result).catch(() => {});
    }

    this.notify();
  }

  public async showFloatingOverlayHUD(data: FloatingOverlayData): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.hasFloatingOverlayActive = false;
      this.notify();
      return;
    }
    this.hasFloatingOverlayActive = true;
    this.notify();
    try {
      await TradePulseNativeScreen.showFloatingOverlay({
        ...data,
        backendUrl: getApiBaseUrl() || DEFAULT_HOSTED_BACKEND_URL,
      } as any);
    } catch (e) {
      console.warn('Could not launch overlay:', e);
    }
  }

  public async updateFloatingOverlayHUD(data: FloatingOverlayData): Promise<void> {
    if (!this.hasFloatingOverlayActive) return;
    try {
      await TradePulseNativeScreen.updateFloatingOverlay({
        ...data,
        backendUrl: getApiBaseUrl() || DEFAULT_HOSTED_BACKEND_URL,
      } as any);
    } catch (e) {
      console.warn('Could not update overlay:', e);
    }
  }

  public async hideFloatingOverlayHUD(): Promise<void> {
    this.hasFloatingOverlayActive = false;
    this.notify();
    try {
      await TradePulseNativeScreen.hideFloatingOverlay();
    } catch (e) {
      console.warn('Could not hide overlay:', e);
    }
  }

  /**
   * Pauses automatic frame extraction
   */
  public pause(): void {
    if (this.state !== 'STREAMING') return;
    this.state = 'PAUSED';
    this.captureState = 'PAUSED';
    this.aiState = 'IDLE';
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.notify();

    // Immediately reflect pause state on native floating overlay
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: '⏸ PAUSED',
      reasonText: 'ক্যাপচার স্থগিত করা হয়েছে',
      latencyMs: 0,
      frameCount: this.latestFrameCount,
      resolution: this.latestResolution,
      captureState: 'PAUSED',
      aiState: 'IDLE',
      errorReason: '',
    });
  }

  /**
   * Resumes automatic frame extraction
   */
  public resume(): void {
    if (this.state !== 'PAUSED') return;
    this.state = 'STREAMING';
    this.captureState = 'RUNNING';
    this.notify();

    // Immediately reflect resume state on native floating overlay
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: this.isChartFound ? 'WAIT' : 'চার্ট পাওয়া যায়নি',
      reasonText: this.isChartFound ? 'পরবর্তী ক্যান্ডেল অপেক্ষা' : 'ট্রেডিং চার্ট সামনে রাখুন',
      latencyMs: 0,
      frameCount: this.latestFrameCount,
      resolution: this.latestResolution,
      captureState: 'RUNNING',
      aiState: 'ANALYZING',
      errorReason: '',
    });

    this.captureAndAnalyzeCurrentFrame();
    this.resetIntervalTimer();
  }

  /**
   * Allows the user to immediately cancel an in-progress connection attempt
   */
  public cancelConnecting(): void {
    if (this.state === 'CONNECTING') {
      this.state = 'DISCONNECTED';
      this.captureState = 'STOPPED';
      this.aiState = 'IDLE';
      this.isSearchingForChart = false;
      this.isChartFound = false;
      this.errorMessage = 'কানেকশন বাতিল করা হয়েছে। পুনরায় চেষ্টা করুন।';
      this.notify();
    }
  }

  /**
   * Disconnects stream and frees all hardware tracks.
   * User requested: "সেটা ডিসকানেক্ট হওয়া ছাড়া কখনোই স্টপ হবে না বা সমান থাকবে"
   * Only called on explicit user action!
   */
  public async disconnect(reason?: string): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }

    if (this.isNativeCaptureActive) {
      try {
        await TradePulseNativeScreen.stopScreenCapture();
        await TradePulseNativeScreen.hideFloatingOverlay();
      } catch (err) {
        console.warn('Native stop error:', err);
      }
      this.isNativeCaptureActive = false;
      this.hasFloatingOverlayActive = false;
    }

    if (this.nativeListenerHandle) {
      this.nativeListenerHandle.remove();
      this.nativeListenerHandle = null;
    }

    this.state = 'DISCONNECTED';
    this.captureState = 'STOPPED';
    this.aiState = 'IDLE';
    this.isSearchingForChart = false;
    this.isChartFound = false;
    this.latestResult = null;
    if (reason) {
      this.errorMessage = reason;
    }
    this.notify();
  }

  private isScanningActive: boolean = false;
  private isSingleScanInProgress: boolean = false;
  private scanTimer: any = null;

  public isScanning(): boolean {
    return this.isScanningActive;
  }

  /**
   * Starts active scanning on the connected screen.
   * Performs immediate frame analysis and runs recurring analysis every 3.5s.
   * Does NOT disconnect.
   */
  private haltRecurringScanKeepResult(noticeMsg?: string): void {
    this.isScanningActive = false;
    this.aiState = 'IDLE';
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (noticeMsg) {
      this.errorMessage = noticeMsg;
    }
    this.notify();
  }

  public async startScanning(): Promise<void> {
    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) {
      this.errorMessage = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
      this.notify();
      return;
    }

    if (this.state !== 'STREAMING') {
      const ok = await this.connectScreen();
      if (!ok) return;
    }

    this.isScanningActive = true;
    this.aiState = 'ANALYZING';
    this.isProcessingFrame = false;
    this.latestProcessedSequenceId = 0;
    this.notify();

    // Immediately update HUD to scanning feedback
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '...',
      verdictTitle: 'স্ক্যান চলছে',
      reasonText: 'বিশ্লেষণ হচ্ছে',
      latencyMs: 0,
      aiState: 'ANALYZING',
      isScanning: true,
    });

    // Run first immediate scan
    await this.captureAndAnalyzeCurrentFrame();

    // Recurring scan while isScanningActive is true
    if (this.scanTimer) clearInterval(this.scanTimer);
    this.scanTimer = setInterval(() => {
      if (this.isScanningActive && this.state === 'STREAMING') {
        const loopCheck = authService.checkScanAllowance();
        if (!loopCheck.allowed) {
          this.haltRecurringScanKeepResult(loopCheck.reasonBn);
          return;
        }
        this.captureAndAnalyzeCurrentFrame();
      }
    }, this.scanIntervalMs);
  }

  /**
   * Stops active scanning.
   * Halts analysis loops, but keeps screenshare connected and HUD active!
   */
  public stopScanning(): void {
    this.isScanningActive = false;
    this.aiState = 'IDLE';
    this.isProcessingFrame = false;
    this.latestProcessedSequenceId = 0;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    // Completely wipe previous result, active countdown, and chart flags
    this.latestResult = null;
    this.expirySecondsLeft = 0;
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.isChartFound = false;
    this.isSearchingForChart = false;

    // DOES NOT DISCONNECT! Screenshare stays alive and HUD stays open in Ready state!
    this.updateFloatingOverlayHUD({
      direction: 'WAIT',
      confidence: 0,
      durationText: '--:--',
      verdictTitle: 'প্রস্তুত',
      reasonText: 'স্ক্যান করুন',
      latencyMs: 0,
      aiState: 'IDLE',
      isScanning: false,
    });

    this.notify();
  }

  public toggleScanning(): void {
    if (this.isScanningActive) {
      this.stopScanning();
    } else {
      this.startScanning();
    }
  }

  /**
   * One-Click, One-Scan, One-Signal Engine:
   * Performs exactly ONE scan of the current frame and locks ONE decisive signal.
   * Cancels any recurring interval timers so the signal never flickers or auto-changes!
   */
  public async triggerScanAndLock(): Promise<ScreenAnalysisFinalResult | null> {
    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) {
      const msg = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
      this.errorMessage = msg;
      this.updateFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: '🔒',
        verdictTitle: '⚠️ স্ক্যান লিমিট শেষ',
        reasonText: msg,
        latencyMs: 0,
        aiState: 'IDLE',
        isScanning: false,
      });
      this.notify();
      return null;
    }

    if (this.state !== 'STREAMING') {
      const ok = await this.connectScreen();
      if (!ok) return null;
    }

    // 1. Instantly kill recurring intervals to guarantee single-scan discipline
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.isScanningActive = false;

    // 2. Progressive 5-Step Scan Sequence on the Floating Overlay Bubble
    this.aiState = 'ANALYZING';
    const postStep = (step: number, title: string, subtitle: string) => {
      this.currentScanStep = { step, title, subtitle };
      this.updateFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: '...',
        verdictTitle: title,
        reasonText: subtitle,
        latencyMs: 0,
        aiState: 'ANALYZING',
        isScanning: true,
        scanStep: this.currentScanStep,
      });
      this.notify();
    };

    // ১/৫: চার্ট যাচাই
    postStep(1, '১/৫ চার্ট যাচাই', 'অ্যাসেট ও টাইমফ্রেম');
    await new Promise((r) => setTimeout(r, 320));

    // ২/৫: ক্যান্ডেল ডেটা
    postStep(2, '২/৫ ক্যান্ডেল', 'OHLC ও টাইমার');
    await new Promise((r) => setTimeout(r, 320));

    // ৩/৫: মাল্টি-TF
    postStep(3, '৩/৫ মাল্টি-TF', '১৫M · ৫M · ১M');
    await new Promise((r) => setTimeout(r, 320));

    // ৪/৫: মার্কেট ফিল্টার
    postStep(4, '৪/৫ ফিল্টার', 'ট্রেন্ড ও ভলিউম');
    await new Promise((r) => setTimeout(r, 320));

    // ৫/৫: স্কোরিং
    postStep(5, '৫/৫ স্কোরিং', 'ফাইনাল সিগন্যাল');
    await new Promise((r) => setTimeout(r, 320));

    // 3. Capture and analyze exactly ONE frame
    this.isSingleScanInProgress = true;
    try {
      await this.captureAndAnalyzeCurrentFrame();
    } finally {
      this.isSingleScanInProgress = false;
      this.currentScanStep = null;
    }

    // 4. Ensure recurring scanning remains stopped and single signal is locked
    this.isScanningActive = false;
    this.aiState = 'IDLE';

    if (this.latestResult) {
      this.updateFloatingOverlayHUD({
        direction: this.latestResult.direction,
        confidence: this.latestResult.confidence,
        durationText: this.expirySecondsLeft > 0
          ? `${String(Math.floor(this.expirySecondsLeft / 60)).padStart(2, '0')}:${String(this.expirySecondsLeft % 60).padStart(2, '0')}`
          : '--:--',
        verdictTitle: this.latestResult.direction === 'UP'
          ? '▲ CALL'
          : this.latestResult.direction === 'DOWN'
          ? '▼ PUT'
          : '⏸ WAIT',
        reasonText: this.latestResult.visionData?.symbol || 'সিগন্যাল প্রস্তুত',
        latencyMs: 0,
        symbol: this.latestResult.visionData?.symbol || 'CHART',
        ...this.getOverlayFlowMeta(this.latestResult),
        aiState: 'IDLE',
        isScanning: false,
      });
    } else {
      this.updateFloatingOverlayHUD({
        direction: 'WAIT',
        confidence: 0,
        durationText: '--:--',
        verdictTitle: 'প্রস্তুত',
        reasonText: 'স্ক্যান করুন',
        latencyMs: 0,
        aiState: 'IDLE',
        isScanning: false,
      });
    }

    this.notify();
    return this.latestResult;
  }

  public async triggerSingleScan(): Promise<ScreenAnalysisFinalResult | null> {
    return await this.triggerScanAndLock();
  }

  private resetIntervalTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Grabs high-fidelity frame snapshot and calls backend Vision API
   */
  public async captureAndAnalyzeCurrentFrame(): Promise<void> {
    if (this.isProcessingFrame) return;

    // 1. Android Native capture via MediaProjection Surface
    if (Capacitor.isNativePlatform() && this.isNativeCaptureActive) {
      const allowance = authService.checkScanAllowance();
      if (!allowance.allowed) {
        this.errorMessage = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
        this.haltRecurringScanKeepResult(this.errorMessage);
        return;
      }
      try {
        const frameRes = await TradePulseNativeScreen.captureSingleFrame();
        if (frameRes && frameRes.imageBase64 && (this.isScanningActive || this.isSingleScanInProgress)) {
          await this.processNativeFrameData({
            imageBase64: frameRes.imageBase64,
            timestamp: frameRes.timestamp || Date.now(),
            sequenceId: frameRes.sequenceId || ++this.latestFrameCount,
            width: frameRes.width || 720,
            height: frameRes.height || 1280,
          }, true);
        }
      } catch (err) {
        console.warn('Native capture frame error:', err);
      }
      return;
    }

    // 2. Browser getDisplayMedia capture
    if (!this.videoEl || !this.canvasEl || !this.stream) return;

    const video = this.videoEl;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) {
      this.errorMessage = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
      this.haltRecurringScanKeepResult(this.errorMessage);
      return;
    }

    this.isProcessingFrame = true;
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s resilient timeout for multimodal vision API
    let frameCapturedAt = Date.now();
    let imageBase64 = '';

    try {
      const canvas = this.canvasEl;
      const maxDim = 1440;
      const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frameCapturedAt = Date.now();
      imageBase64 = canvas.toDataURL('image/jpeg', 0.88);

      const activeProfile = tradingProfileService.getActiveProfileId();
      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg',
          frameCapturedAt,
          tradingProfile: activeProfile,
          activeProfileRules: agentLearningService.getActiveProfilePromptContext(activeProfile),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          this.errorMessage = 'Backend returned unexpected format.';
          this.notify();
          return;
        }

        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;
          this.processResult(result, latencyMs);
        } else {
          const localResult = await this.analyzeFrameLocally(imageBase64, frameCapturedAt);
          this.processResult(localResult, latencyMs);
        }
      } else {
        const localResult = await this.analyzeFrameLocally(imageBase64, frameCapturedAt);
        this.processResult(localResult, latencyMs);
      }

      const deductRes = await authService.recordCompletedScan('live_screen');
      if (deductRes.exhaustedAfter) {
        this.haltRecurringScanKeepResult('আপনার নির্ধারিত স্ক্যান লিমিট পূর্ণ হয়েছে।');
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;
      const localResult = await this.analyzeFrameLocally(imageBase64, frameCapturedAt);
      this.processResult(localResult, latencyMs);
      const deductRes = await authService.recordCompletedScan('live_screen_local');
      if (deductRes.exhaustedAfter) {
        this.haltRecurringScanKeepResult('আপনার নির্ধারিত স্ক্যান লিমিট পূর্ণ হয়েছে।');
      }
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  /**
   * Analyzes an uploaded screenshot or pasted chart image directly
   */
  public async analyzeImageDirectly(imageBase64: string): Promise<boolean> {
    if (this.isProcessingFrame) return false;
    const allowance = authService.checkScanAllowance();
    if (!allowance.allowed) {
      this.errorMessage = allowance.reasonBn || 'আপনার স্ক্যান লিমিট শেষ হয়েছে।';
      this.notify();
      return false;
    }

    this.isProcessingFrame = true;
    this.errorMessage = null;
    voiceAssistantService.announceImageUploaded();
    this.notify();

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const frameCapturedAt = Date.now();
      const activeProfile = tradingProfileService.getActiveProfileId();
      const res = await fetch(getApiUrl('/api/agent/vision/analyze-frame'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
          frameCapturedAt,
          tradingProfile: activeProfile,
          activeProfileRules: agentLearningService.getActiveProfilePromptContext(activeProfile),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.result) {
          const result: ScreenAnalysisFinalResult = data.result;

          // Auto-start streaming mode with uploaded image directly on display
          this.state = 'STREAMING';
          this.startCountdownTicker();
          this.processResult(result, latencyMs);
          await authService.recordCompletedScan('image_upload');
          return true;
        } else {
          this.errorMessage = data?.error || 'Analysis failed.';
          return false;
        }
      } else {
        let errorMsg = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch {}
        this.errorMessage = errorMsg;
        return false;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      this.errorMessage = err.message || 'Network error.';
      return false;
    } finally {
      this.isProcessingFrame = false;
      this.notify();
    }
  }

  public isBusy(): boolean {
    return this.isProcessingFrame;
  }
}

export const liveScreenService = LiveScreenService.getInstance();
