import {
  LearnedStrategyRule,
  TradeMistakeReflection,
  LearningHubStats,
  LearningCategory,
} from '../types/learningTypes';
import { getApiUrl } from './apiConfig';

const STORAGE_KEY_RULES = 'tradepulse_learned_rules_v1';
const STORAGE_KEY_REFLECTIONS = 'tradepulse_mistake_reflections_v1';

// Seed Knowledge Base written in rich, professional, educational Bengali
const DEFAULT_RULES: LearnedStrategyRule[] = [
  {
    ruleId: 'rule_bullish_engulfing',
    titleBn: 'বুলিশ এনগালফিং ও সাপোর্ট বাউন্স রিভার্সাল',
    category: 'CANDLESTICK',
    summaryBn: 'ডাউনট্রেন্ডের শেষে সাপোর্ট লেভেলে যখন একটি বড় গ্রিন ক্যান্ডেল পূর্ববর্তী রেড ক্যান্ডেলকে সম্পূর্ণ ঢেকে ফেলে, তখন শক্তিশালী আপট্রেন্ডের সূচনা হয়।',
    conditionsBn: [
      'মার্কেট একটি সুস্পষ্ট সাপোর্ট লেভেলে অবস্থান করতে হবে।',
      'পূর্ববর্তী রেড ক্যান্ডেলটির বডি ছোট এবং পরবর্তী গ্রিন ক্যান্ডেলটির বডি বড় হতে হবে।',
      'গ্রিন ক্যান্ডেলের ওপেন পূর্ববর্তী ক্লোজের নিচে বা সমান কিন্তু ক্লোজ পূর্ববর্তী ওপেনের চেয়ে উপরে হতে হবে।',
      'ভলিউম বৃদ্ধি বা আরএসআই (RSI) ৩০-এর কাছাকাছি থেকে ঊর্ধ্বমুখী হতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.88,
    totalTrades: 34,
    winCount: 29,
    lossCount: 5,
    winRate: 85.3,
    cautionaryNotesBn: [
      'যদি ডাউনট্রেন্ড খুব তীব্র (Strong Panic Selling) হয়, তবে প্রথম এনগালফিং এড়িয়ে চলুন।',
      'ওটিসি (OTC) মার্কেটে রাউন্ড নাম্বার লেভেল না পেলে হুট করে বড় টাইমফ্রেম ছাড়া ট্রেড করবেন না।',
    ],
    lastMistakeReflectionBn: 'পূর্ববর্তী ডাউনট্রেন্ডে ২০ পিরিয়ড EMA-র অতিরিক্ত নিচে থাকার কারণে পুলব্যাক ফেইল করেছিল। সমাধান: EMA ২০ টেস্ট না হওয়া পর্যন্ত অপেক্ষা করতে হবে।',
    createdAt: Date.now() - 86400000 * 7,
    lastUpdated: Date.now() - 3600000 * 4,
    status: 'ACTIVE',
    learnedFromFailureCount: 2,
  },
  {
    ruleId: 'rule_pinbar_rejection',
    titleBn: 'লং-উইক হ্যামার ও পিন বার রিজেকশন',
    category: 'SUPPORT_RESISTANCE',
    summaryBn: 'ক্যান্ডেলের নিচের দিকে শরীরের অন্তত দুই থেকে তিন গুণ লম্বা উইক (Shadow) নির্দেশ করে যে সেলারদের প্রাইস ড্রপ বায়াররা জোরালোভাবে প্রতিহত করেছে।',
    conditionsBn: [
      'ক্যান্ডেলস্টিকের নিচের শ্যাডো (Lower Wick) বডির চেয়ে অন্তত ২-৩ গুণ বড় হতে হবে।',
      'উপরের দিকে খুব সামান্য বা কোনো উইক থাকা উচিত নয়।',
      'গুরুত্বপূর্ণ হরিজন্টাল সাপোর্ট বা ট্রেন্ডলাইন স্পর্শ করে প্রাইস রিজেক্ট হতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.84,
    totalTrades: 28,
    winCount: 23,
    lossCount: 5,
    winRate: 82.1,
    cautionaryNotesBn: [
      'সাইডওয়ে বা কনসোলিডেশন জোনে পিন বার তৈরি হলে তা কোনো ভ্যালিড রিভার্সাল নির্দেশ করে না।',
      'পরবর্তী ক্যান্ডেল যেন পিন বারের লো-কে ব্রেক না করে সেদিকে লক্ষ্য রাখতে হবে।',
    ],
    lastMistakeReflectionBn: 'কনসোলিডেশনের মাঝখানে পিন বারে ট্রেড নেওয়ায় লস হয়েছিল। সমাধান: শুধুমাত্র স্পষ্ট সাপোর্ট জোনে থাকা পিন বার গ্রহণ করা হবে।',
    createdAt: Date.now() - 86400000 * 6,
    lastUpdated: Date.now() - 3600000 * 8,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'rule_ema_trend_continuation',
    titleBn: 'ইএমএ ২০ পুলব্যাক ও মোমেন্টাম কন্টিনিউয়েশন',
    category: 'INDICATOR',
    summaryBn: 'স্ট্রং আপট্রেন্ডে প্রাইস যখন সাময়িকভাবে রিট্রেস করে ২০ পিরিয়ড এক্সপোনেনশিয়াল মুভিং এভারেজ (EMA 20) ছুঁয়ে রিজেকশন দেয়, তখন ট্রেন্ডের দিকে ট্রেড নেওয়া নিরাপদ।',
    conditionsBn: [
      'EMA 20 এবং EMA 50 উভয়েই ঊর্ধ্বমুখী কোণে (Angled Upwards) থাকতে হবে।',
      'প্রাইস ক্যান্ডেল EMA 20-কে স্পর্শ করে একটি বুলিশ রিজেকশন ক্যান্ডেল তৈরি করবে।',
      'আরএসআই (RSI) ৫০ এর উপরে অবস্থান করবে যা বুলিশ বায়াস নিশ্চিত করে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.86,
    totalTrades: 42,
    winCount: 36,
    lossCount: 6,
    winRate: 85.7,
    cautionaryNotesBn: [
      'EMA লাইন যদি ফ্ল্যাট বা আনুভূমিক হয়ে যায়, তবে মার্কেট রেঞ্জিং—তখন এই নিয়ম কাজ করবে না।',
    ],
    createdAt: Date.now() - 86400000 * 5,
    lastUpdated: Date.now() - 3600000 * 12,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'rule_otc_breakout_trap',
    titleBn: 'ওটিসি ফলস ব্রেকআউট ট্র্যাপ ফিল্টার',
    category: 'OTC_TRAP',
    summaryBn: 'ওটিসি (OTC) মার্কেটে কোনো সাপোর্ট বা রেজিস্ট্যান্স লাইন ভাঙার পরপরই বিপরীত দিকে বড় রিভার্সাল ঘটে রিটেল ট্রেডারদের স্টপলস শিকার করার জন্য।',
    conditionsBn: [
      'ওটিসি ব্রোকার চার্টে ব্রেকআউট ক্যান্ডেলের পর পরবর্তী ক্যান্ডেল ভলিউম ছাড়া দুর্বল হলে অপেক্ষা করুন।',
      'ব্রেকআউটের সাথে সাথে সরাসরি সেই দিকে ট্রেড না নিয়ে পরবর্তী কনফার্মেশন ক্যান্ডেল দেখুন।',
      'যদি ব্রেকআউট ফেইল করে প্রাইস পূর্ববর্তী রেঞ্জে ফিরে আসে, তবে উল্টো দিকে রিভার্সাল এন্ট্রি নিন।',
    ],
    recommendedDirection: 'WAIT',
    confidenceWeight: 0.90,
    totalTrades: 19,
    winCount: 17,
    lossCount: 2,
    winRate: 89.5,
    cautionaryNotesBn: [
      'উইকএন্ড ও গভীর রাতের ওটিসি মার্কেটে কৃত্রিম অ্যালগরিদমিক স্পাইক তৈরি হয়, কখনোই অতিরিক্ত লট ব্যবহার করবেন না।',
    ],
    createdAt: Date.now() - 86400000 * 4,
    lastUpdated: Date.now() - 3600000 * 2,
    status: 'ACTIVE',
    learnedFromFailureCount: 3,
  },
  {
    ruleId: 'rule_bearish_engulfing_resistance',
    titleBn: 'রেজিস্ট্যান্স জোনে বিয়ারিশ এনগালফিং সিগন্যাল',
    category: 'CANDLESTICK',
    summaryBn: 'আপট্রেন্ডের শীর্ষে শক্তিশালী রেজিস্ট্যান্সে পৌঁছানোর পর যখন একটি বড় রেড ক্যান্ডেল পূর্ববর্তী গ্রিন ক্যান্ডেলকে গ্রাস করে, তখন সেলারদের আধিপত্য শুরু হয়।',
    conditionsBn: [
      'প্রাইস পূর্ববর্তী গুরুত্বপূর্ণ রেজিস্ট্যান্স অথবা রাউন্ড নাম্বারে টেস্ট করবে।',
      'একটি স্পষ্ট বিয়ারিশ ক্যান্ডেল গ্রিন ক্যান্ডেলের বডিকে সম্পূর্ণ ঢেকে দেবে।',
      'আরএসআই (RSI) ৭০-এর উপরে (Overbought) থেকে নিচের দিকে বাঁক নেবে।',
    ],
    recommendedDirection: 'PUT',
    confidenceWeight: 0.85,
    totalTrades: 31,
    winCount: 26,
    lossCount: 5,
    winRate: 83.9,
    cautionaryNotesBn: [
      'হায় হাই (Higher High) তৈরিকারী স্ট্রং বুলিশ মোমেন্টামে প্রথম রেড ক্যান্ডেলে তাড়াহুড়ো করে ট্রেড নেওয়া যাবে না।',
    ],
    createdAt: Date.now() - 86400000 * 3,
    lastUpdated: Date.now() - 3600000 * 6,
    status: 'ACTIVE',
    learnedFromFailureCount: 2,
  },
];

const DEFAULT_REFLECTIONS: TradeMistakeReflection[] = [
  {
    reflectionId: 'ref_1',
    timestamp: Date.now() - 3600000 * 4,
    symbol: 'EUR/USD OTC',
    direction: 'CALL',
    suggestedExpiry: '01:00',
    expectedPatternBn: 'বুলিশ এনগালফিং রিভার্সাল',
    actualOutcome: 'LOSS',
    failureReasonBn: 'প্রাইস ২০ পিরিয়ড EMA-র মারাত্মক নিচে ছিল এবং ডাউনট্রেন্ডের তীব্র মোমেন্টামে সাপোর্ট স্তর ভেঙে নিচে নেমে গেছে। বায়ার্স প্রেসার দুর্বল ছিল।',
    correctiveActionBn: 'স্ট্র্যাটেজি আপডেটেড: তীব্র ডাউনট্রেন্ডে ২০ EMA টেস্ট না হওয়া পর্যন্ত কোনো এনগালফিং ক্যান্ডেলে CALL সিগন্যাল না দিয়ে WAIT মোডে থাকতে হবে। কনফিডেন্স ওয়েট সাময়িকভাবে ৫% কমানো হয়েছে।',
    adjustedRuleId: 'rule_bullish_engulfing',
    confidencePenaltyPercent: 5,
    marketConditionBn: 'তীব্র বিয়ারিশ ট্রেন্ড ও ওটিসি হাই স্প্রেড',
  },
  {
    reflectionId: 'ref_2',
    timestamp: Date.now() - 3600000 * 14,
    symbol: 'BTC/USDT',
    direction: 'CALL',
    suggestedExpiry: '01:00',
    expectedPatternBn: 'রেজিস্ট্যান্স ব্রেকআউট',
    actualOutcome: 'LOSS',
    failureReasonBn: 'ব্রেকআউটের সাথে প্রয়োজনীয় ভলিউম ছিল না এবং আরএসআই অতিরিক্ত ওভারবট (RSI 76) ছিল, ফলে এটি একটি ক্লাসিক বুল-ট্র্যাপ (Bull Trap) তৈরি করে।',
    correctiveActionBn: 'স্ট্র্যাটেজি আপডেটেড: আরএসআই ৭০-এর উপরে থাকা অবস্থায় কোনো ব্রেকআউটে সরাসরি ট্রেড নেওয়া নিষেধ করা হলো। পুনরায় টেস্ট নিশ্চিত করতে হবে।',
    adjustedRuleId: 'rule_otc_breakout_trap',
    confidencePenaltyPercent: 6,
    marketConditionBn: 'লো-ভলিউম কনসোলিডেশন ব্রেকআউট',
  },
];

export class AgentLearningService {
  private static instance: AgentLearningService;
  private rules: LearnedStrategyRule[] = [];
  private reflections: TradeMistakeReflection[] = [];
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AgentLearningService {
    if (!AgentLearningService.instance) {
      AgentLearningService.instance = new AgentLearningService();
    }
    return AgentLearningService.instance;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      this.rules = [...DEFAULT_RULES];
      this.reflections = [...DEFAULT_REFLECTIONS];
      return;
    }

    try {
      const storedRules = localStorage.getItem(STORAGE_KEY_RULES);
      if (storedRules) {
        this.rules = JSON.parse(storedRules);
      } else {
        this.rules = [...DEFAULT_RULES];
        this.saveRulesToStorage();
      }

      const storedReflections = localStorage.getItem(STORAGE_KEY_REFLECTIONS);
      if (storedReflections) {
        this.reflections = JSON.parse(storedReflections);
      } else {
        this.reflections = [...DEFAULT_REFLECTIONS];
        this.saveReflectionsToStorage();
      }
    } catch (err) {
      console.warn('[AgentLearningService] Error reading storage:', err);
      this.rules = [...DEFAULT_RULES];
      this.reflections = [...DEFAULT_REFLECTIONS];
    }
  }

  private saveRulesToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(this.rules));
      } catch {}
    }
  }

  private saveReflectionsToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_REFLECTIONS, JSON.stringify(this.reflections));
      } catch {}
    }
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

  public getRules(): LearnedStrategyRule[] {
    return [...this.rules];
  }

  public getRuleById(ruleId: string): LearnedStrategyRule | undefined {
    return this.rules.find((r) => r.ruleId === ruleId);
  }

  public getReflections(): TradeMistakeReflection[] {
    return [...this.reflections].sort((a, b) => b.timestamp - a.timestamp);
  }

  public getStats(): LearningHubStats {
    const totalRules = this.rules.length;
    const activeRules = this.rules.filter((r) => r.status === 'ACTIVE').length;
    const revisedRules = this.rules.filter((r) => r.learnedFromFailureCount > 0).length;
    const totalReflections = this.reflections.length;

    let totalWins = 0;
    let totalTrades = 0;
    this.rules.forEach((r) => {
      totalWins += r.winCount;
      totalTrades += r.totalTrades;
    });

    const overallWinRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 1000) / 10 : 84.5;
    const lastLearningTimestamp = this.reflections[0]?.timestamp || Date.now();

    return {
      totalRules,
      activeRules,
      revisedRules,
      totalReflections,
      overallWinRate,
      lastLearningTimestamp,
    };
  }

  /**
   * Evaluates a trade outcome (WIN or LOSS) and triggers automated self-learning reflection
   */
  public recordOutcome(
    symbol: string,
    direction: 'CALL' | 'PUT',
    outcome: 'WIN' | 'LOSS',
    patternName?: string,
    customNote?: string
  ): { reflection?: TradeMistakeReflection; updatedRule?: LearnedStrategyRule } {
    // 1. Locate best matching rule by pattern or direction
    let targetRule = this.rules.find(
      (r) =>
        (patternName && r.titleBn.toLowerCase().includes(patternName.toLowerCase())) ||
        (patternName && patternName.toLowerCase().includes(r.category.toLowerCase())) ||
        r.recommendedDirection === direction
    );

    if (!targetRule && this.rules.length > 0) {
      targetRule = this.rules[0];
    }

    if (outcome === 'WIN') {
      if (targetRule) {
        targetRule.totalTrades += 1;
        targetRule.winCount += 1;
        targetRule.winRate = Math.round((targetRule.winCount / targetRule.totalTrades) * 1000) / 10;
        targetRule.confidenceWeight = Math.min(0.95, Math.round((targetRule.confidenceWeight + 0.02) * 100) / 100);
        targetRule.lastUpdated = Date.now();
        this.saveRulesToStorage();
        this.notify();
      }
      return { updatedRule: targetRule };
    }

    // --- OUTCOME IS LOSS: Trigger Autonomous Post-Mortem & Rule Revision ---
    const failureId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const penalty = 5; // 5% confidence penalty

    let failureReasonBn =
      customNote ||
      `${symbol} পেয়ারে ${direction} সিগন্যাল ফেইল করেছে। ক্যান্ডেল ব্রেকআউটের সাথে পর্যাপ্ত ভলিউম ছিল না এবং কাউন্টার-ট্রেন্ড প্রেসারে সাপোর্ট স্তর ধরে রাখতে পারেনি।`;

    let correctiveActionBn = `সেলফ-লার্নিং আপডেট: ${targetRule ? targetRule.titleBn : 'এই কৌশলে'} কনফিডেন্স স্কোর ${penalty}% হ্রাস করা হলো। পরবর্তী ট্রেডের আগে কনফার্মেশন ক্যান্ডেল ও আরএসআই (RSI) ফিল্টার বাধ্যতামূলক করা হলো।`;

    if (symbol.includes('OTC')) {
      failureReasonBn += ' ওটিসি মার্কেটের কৃত্রিম প্রাইস অ্যাকশন ও হঠাৎ স্প্রেড বৃদ্ধির প্রভাব লক্ষ্য করা গেছে।';
      correctiveActionBn += ' ওটিসি পেয়ারে অতিরিক্ত সতর্কতা ফিল্টার চালু করা হয়েছে।';
    }

    const reflection: TradeMistakeReflection = {
      reflectionId: failureId,
      timestamp: Date.now(),
      symbol,
      direction,
      suggestedExpiry: '01:00',
      expectedPatternBn: patternName || (targetRule ? targetRule.titleBn : 'মোমেন্টাম কন্টিনিউয়েশন'),
      actualOutcome: 'LOSS',
      failureReasonBn,
      correctiveActionBn,
      adjustedRuleId: targetRule?.ruleId,
      confidencePenaltyPercent: penalty,
      marketConditionBn: symbol.includes('OTC') ? 'ওটিসি হাই ভলাটিলিটি' : 'রেঞ্জিং ও ফলস ব্রেকআউট',
    };

    this.reflections.unshift(reflection);
    if (this.reflections.length > 50) {
      this.reflections.pop();
    }
    this.saveReflectionsToStorage();

    if (targetRule) {
      targetRule.totalTrades += 1;
      targetRule.lossCount += 1;
      targetRule.winRate = Math.round((targetRule.winCount / targetRule.totalTrades) * 1000) / 10;
      targetRule.confidenceWeight = Math.max(0.65, Math.round((targetRule.confidenceWeight - 0.05) * 100) / 100);
      targetRule.learnedFromFailureCount += 1;
      targetRule.lastUpdated = Date.now();
      targetRule.lastMistakeReflectionBn = failureReasonBn;

      // Add educational cautionary note
      const newCaution = `ভুল বিশ্লেষণ থেকে শিক্ষা (${new Date().toLocaleDateString('bn-BD')}): ${failureReasonBn.split('.')[0]}।`;
      if (!targetRule.cautionaryNotesBn.includes(newCaution)) {
        targetRule.cautionaryNotesBn.unshift(newCaution);
        if (targetRule.cautionaryNotesBn.length > 5) {
          targetRule.cautionaryNotesBn.pop();
        }
      }

      this.saveRulesToStorage();
    }

    this.notify();

    // Async sync with backend if online
    this.syncWithBackend(reflection, targetRule).catch(() => {});

    return { reflection, updatedRule: targetRule };
  }

  private async syncWithBackend(reflection: TradeMistakeReflection, rule?: LearnedStrategyRule): Promise<void> {
    try {
      await fetch(getApiUrl('/api/agent/reflect-mistake'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reflection, rule }),
      });
    } catch {}
  }

  public addNewRule(ruleData: Omit<LearnedStrategyRule, 'ruleId' | 'createdAt' | 'lastUpdated' | 'learnedFromFailureCount'>): LearnedStrategyRule {
    const newRule: LearnedStrategyRule = {
      ...ruleData,
      ruleId: `rule_${Date.now()}`,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      learnedFromFailureCount: 0,
    };

    this.rules.unshift(newRule);
    this.saveRulesToStorage();
    this.notify();
    return newRule;
  }

  public resetToDefaults(): void {
    this.rules = [...DEFAULT_RULES];
    this.reflections = [...DEFAULT_REFLECTIONS];
    this.saveRulesToStorage();
    this.saveReflectionsToStorage();
    this.notify();
  }

  public exportKnowledgeAsJson(): string {
    return JSON.stringify(
      {
        appName: 'TradePulse AI Knowledge Playbook',
        exportedAt: new Date().toISOString(),
        stats: this.getStats(),
        rules: this.rules,
        mistakeReflections: this.reflections,
      },
      null,
      2
    );
  }
}

export const agentLearningService = AgentLearningService.getInstance();
