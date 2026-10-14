import { Capacitor } from '@capacitor/core';
import { TradePulseNativeScreen } from '../plugins/TradePulseNativeScreen';
import { ScreenAnalysisFinalResult } from '../types/screenTypes';

export type VoiceNotificationListener = (text: string, isSupported: boolean) => void;

export class VoiceAssistantService {
  private static instance: VoiceAssistantService;
  private isEnabled: boolean = true;
  private lastSpokenKey: string = '';
  private lastSpokenTimestamp: number = 0;
  private listeners: Set<VoiceNotificationListener> = new Set();
  private isSpeechSupported: boolean = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('tradingbot_voice_enabled');
      this.isEnabled = stored !== null ? stored === 'true' : true;
      this.isSpeechSupported =
        Capacitor.isNativePlatform() ||
        ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);

      if ('speechSynthesis' in window && window.speechSynthesis) {
        this.initVoice();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => this.initVoice();
        }
      }
    }
  }

  public static getInstance(): VoiceAssistantService {
    if (!VoiceAssistantService.instance) {
      VoiceAssistantService.instance = new VoiceAssistantService();
    }
    return VoiceAssistantService.instance;
  }

  private initVoice(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer Bengali voices (bn-BD, bn-IN, bn)
    const bnVoice = voices.find(
      (v) => v.lang.startsWith('bn') || v.name.toLowerCase().includes('bangla') || v.name.toLowerCase().includes('bengali')
    );
    this.selectedVoice = bnVoice || voices.find((v) => v.default) || (voices.length > 0 ? voices[0] : null);
  }

  public subscribe(listener: VoiceNotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(text: string): void {
    this.listeners.forEach((fn) => fn(text, this.isSpeechSupported));
  }

  public isVoiceEnabled(): boolean {
    return this.isEnabled;
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tradingbot_voice_enabled', String(enabled));
      if (!enabled) {
        if (Capacitor.isNativePlatform()) {
          TradePulseNativeScreen.stopSpeaking().catch(() => {});
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      }
    }
    this.notify(enabled ? 'ভয়েস সহকারী চালু করা হয়েছে' : 'ভয়েস সহকারী বন্ধ করা হয়েছে');
  }

  public toggleVoice(): boolean {
    this.setVoiceEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public isSupported(): boolean {
    return this.isSpeechSupported;
  }

  /**
   * Core speaking engine with de-duplication and cooldown
   * Directs speech to Native Android OS TextToSpeech if on device,
   * enabling background voice playback even while floating overlay is on top of broker apps.
   */
  public speak(text: string, dedupKey?: string, force: boolean = false): void {
    const now = Date.now();
    const key = dedupKey || text;

    // Prevent echoing identical messages or rapid repetitions
    if (!force && this.lastSpokenKey === key && now - this.lastSpokenTimestamp < 8000) {
      return;
    }

    this.lastSpokenKey = key;
    this.lastSpokenTimestamp = now;

    // Always broadcast notification to UI listeners
    this.notify(text);

    if (!this.isEnabled || typeof window === 'undefined') {
      return;
    }

    // 1. Android Native Text-To-Speech (background capable over Binomo/Quotex)
    if (Capacitor.isNativePlatform()) {
      TradePulseNativeScreen.speak({ text })
        .then((res) => {
          if (!res.success && 'speechSynthesis' in window && window.speechSynthesis) {
            this.speakViaWebSynthesis(text);
          }
        })
        .catch(() => {
          if ('speechSynthesis' in window && window.speechSynthesis) {
            this.speakViaWebSynthesis(text);
          }
        });
      return;
    }

    // 2. Standard Web Browser Speech Synthesis
    if ('speechSynthesis' in window && window.speechSynthesis) {
      this.speakViaWebSynthesis(text);
    }
  }

  private speakViaWebSynthesis(text: string): void {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang || 'bn-BD';
      } else {
        utterance.lang = 'bn-BD';
      }
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[VoiceAssistant] Speech synthesis error:', err);
    }
  }

  /**
   * 1. Screen capture missing / not connected
   */
  public announceNoScreenCapture(): void {
    this.speak(
      'আমি কোনো চার্ট দেখতে পাচ্ছি না। দয়া করে স্ক্রিন শেয়ার চালু করুন।',
      'NO_SCREEN_CAPTURE'
    );
  }

  /**
   * 2. Searching for chart actively
   */
  public announceSearchingForChart(): void {
    this.speak(
      'চার্ট খোঁজা হচ্ছে। দয়া করে ট্রেডিং চার্টটি স্ক্রিনে রাখুন।',
      'SEARCHING_FOR_CHART'
    );
  }

  /**
   * 3. Chart not found
   */
  public announceNoChartFound(): void {
    this.speak(
      'আমি চার্ট খুঁজে পাইনি। দয়া করে ট্রেডিং চার্টটি সামনে রাখুন।',
      'NO_CHART_FOUND'
    );
  }

  /**
   * 4. Chart identified and frame analyzing
   */
  public announceChartFoundAnalyzing(): void {
    this.speak(
      'আমি চার্ট খুঁজে পেয়েছি। টেকনিক্যাল ইন্ডিকেটর ও ক্যান্ডেলস্টিক বিশ্লেষণ করছি। অনুগ্রহ করে অপেক্ষা করুন।',
      'CHART_FOUND_ANALYZING'
    );
  }

  /**
   * 5. Image uploaded directly (for mobile or iframe environments)
   */
  public announceImageUploaded(): void {
    this.speak(
      'চার্টের ছবি পাওয়া গেছে। এখন বিশ্লেষণ করছি। অনুগ্রহ করে অপেক্ষা করুন।',
      'IMAGE_UPLOADED_ANALYZING'
    );
  }

  /**
   * 6. Full analysis result announced
   */
  public announceAnalysisResult(result: ScreenAnalysisFinalResult): void {
    if (!result) return;

    if (!result.visionData?.isClearTradingChart) {
      this.announceNoChartFound();
      return;
    }

    const { direction, confidence, marketVerification } = result;
    const dedupKey = `RESULT_${direction}_${marketVerification.status}_${confidence}`;

    if (direction === 'UP') {
      this.speak(
        `বিশ্লেষণ সম্পন্ন। দিকনির্দেশনা: কল অথবা আপ ট্রেড। কনফিডেন্স ${confidence} শতাংশ। এক্সপায়ারি কাউন্টডাউন শুরু হয়েছে।`,
        dedupKey
      );
    } else if (direction === 'DOWN') {
      this.speak(
        `বিশ্লেষণ সম্পন্ন। দিকনির্দেশনা: পুট অথবা ডাউন ট্রেড। কনফিডেন্স ${confidence} শতাংশ। এক্সপায়ারি কাউন্টডাউন শুরু হয়েছে।`,
        dedupKey
      );
    } else {
      // WAIT / Consolidation / Unsupported broker feed / Price mismatch / Stale data
      this.speak(
        'বিশ্লেষণ সম্পন্ন। মার্কেট সাইডওয়ে বা অনির্দিষ্ট থাকার কারণে অপেক্ষা করার পরামর্শ দেওয়া হচ্ছে।',
        dedupKey
      );
    }
  }

  /**
   * 7. Candle timer expired
   */
  public announceCandleExpired(): void {
    this.speak(
      'ক্যান্ডেলের সময় শেষ হয়েছে। পরবর্তী ক্যান্ডেলের জন্য নতুন বিশ্লেষণ চলছে।',
      'CANDLE_EXPIRED'
    );
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceAssistantService = VoiceAssistantService.getInstance();
