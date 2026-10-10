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
      this.isSpeechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

      if (this.isSpeechSupported) {
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
      if (!enabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
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

    if (!this.isEnabled || !this.isSpeechSupported || typeof window === 'undefined') {
      return;
    }

    try {
      // Clear pending speech queue to avoid backlog delay
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
      'আমি কোনো চার্ট দেখতে পাচ্ছি না। দয়া করে চার্টটি খুলুন এবং স্ক্রিন শেয়ার চালু করুন।',
      'NO_SCREEN_CAPTURE'
    );
  }

  /**
   * 2. Chart identified and frame analyzing
   */
  public announceChartFoundAnalyzing(): void {
    this.speak(
      'আমি চার্ট খুঁজে পেয়েছি। এখন বিশ্লেষণ করছি। অনুগ্রহ করে অপেক্ষা করুন।',
      'CHART_FOUND_ANALYZING'
    );
  }

  /**
   * 3. Image uploaded directly (for mobile or iframe environments)
   */
  public announceImageUploaded(): void {
    this.speak(
      'চার্টের ছবি পাওয়া গেছে। এখন বিশ্লেষণ করছি। অনুগ্রহ করে অপেক্ষা করুন।',
      'IMAGE_UPLOADED_ANALYZING'
    );
  }

  /**
   * 4. Full analysis result announced
   */
  public announceAnalysisResult(result: ScreenAnalysisFinalResult): void {
    if (!result) return;

    if (!result.visionData?.isClearTradingChart) {
      this.speak(
        'স্পষ্ট কোনো ক্যান্ডেলস্টিক চার্ট পাওয়া যায়নি। অনুগ্রহ করে চার্ট উইন্ডো সামনে রাখুন।',
        'NO_CLEAR_CHART_DETECTED'
      );
      return;
    }

    const { direction, confidence, marketVerification } = result;
    const dedupKey = `RESULT_${direction}_${marketVerification.status}_${confidence}`;

    if (direction === 'UP' && marketVerification.isVerified && marketVerification.status === 'MATCHED') {
      this.speak(
        `বিশ্লেষণ সম্পন্ন। আপ সিগন্যাল পাওয়া গেছে। কনফিডেন্স ${confidence} শতাংশ। মার্কেট ভেরিফাইড।`,
        dedupKey
      );
    } else if (direction === 'DOWN' && marketVerification.isVerified && marketVerification.status === 'MATCHED') {
      this.speak(
        `বিশ্লেষণ সম্পন্ন। ডাউন সিগন্যাল পাওয়া গেছে। কনফিডেন্স ${confidence} শতাংশ। মার্কেট ভেরিফাইড।`,
        dedupKey
      );
    } else {
      // WAIT / Consolidation / Unsupported broker feed / Price mismatch / Stale data
      this.speak(
        'বিশ্লেষণ সম্পন্ন। মার্কেট অসঙ্গতি বা আনভেরিফাইড ফিডের কারণে অপেক্ষা করার পরামর্শ দেওয়া হচ্ছে।',
        dedupKey
      );
    }
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const voiceAssistantService = VoiceAssistantService.getInstance();
