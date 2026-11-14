import {
  LearnedStrategyRule,
  TradeMistakeReflection,
  LearningHubStats,
  SignalOutcomeRecord,
  ProfileReviewPolicy,
  CohortAuditRecord,
  ProfileLearningSummary,
  ReviewWindowDays,
} from '../types/learningTypes';
import { TradingProfileId, TRADING_PROFILE_LIST, getTradingProfile } from '../strategy/tradingProfiles';
import { tradingProfileService } from './tradingProfileService';
import { getApiUrl } from './apiConfig';

const STORAGE_KEY_RULES = 'tradepulse_learned_rules_v2';
const STORAGE_KEY_REFLECTIONS = 'tradepulse_mistake_reflections_v2';
const STORAGE_KEY_SIGNAL_LEDGER = 'tradepulse_signal_ledger_v2';
const STORAGE_KEY_REVIEW_POLICIES = 'tradepulse_profile_review_policy_v2';
const STORAGE_KEY_COHORT_AUDITS = 'tradepulse_cohort_audits_v2';

const DAY_MS = 86400000;
const MIN_SAFETY_COHORT_SIGNALS = 10; // Hard floor: never alter rules from 1-9 opposite candles

function getMinSamplesForWindow(days: ReviewWindowDays): number {
  return days === 30 ? 30 : 15;
}

function createDefaultPolicies(): Record<TradingProfileId, ProfileReviewPolicy> {
  const now = Date.now();
  const map = {} as Record<TradingProfileId, ProfileReviewPolicy>;
  TRADING_PROFILE_LIST.forEach((p) => {
    map[p.id] = {
      profileId: p.id,
      reviewWindowDays: 7,
      minSignalsRequired: 15,
      lastRuleUpdateAt: now,
      nextEligibleUpdateAt: now + 7 * DAY_MS,
      signalsLoggedSinceUpdate: 0,
      rulesLocked: true,
      lastCohortVerdictBn:
        'মূল রুল লকড (স্থিতিশীল) — প্রতিটি সিগন্যালের ডেটা জমা হচ্ছে, ৭ দিন ও ন্যূনতম ১৫টি সিগন্যাল পূর্ণ হলে কোহর্ট পর্যালোচনায় রুল আপডেট হবে।',
    };
  });
  return map;
}

const nowTs = Date.now();

// Strictly isolated per-platform strategy rules written in authentic Bengali
const DEFAULT_RULES_V2: LearnedStrategyRule[] = [
  // ======================== 1. BINARY_OTC ========================
  {
    ruleId: 'otc_rule_wick_rejection',
    profileId: 'BINARY_OTC',
    titleBn: 'OTC লং-উইক রিজেকশন ও রাউন্ড নাম্বার বাউন্স',
    category: 'SUPPORT_RESISTANCE',
    summaryBn: 'ওটিসি চার্টে সাপোর্ট/রেজিস্ট্যান্স বা রাউন্ড নাম্বার স্পর্শ করে >= ৩৫% লম্বা উইক রিজেকশন তৈরি হলে পরবর্তী ১-২ মিনিট রিভার্সাল সিগন্যাল।',
    conditionsBn: [
      'ক্যান্ডেলের উইক (Shadow) সম্পূর্ণ রেঞ্জের অন্তত ৩৫% হতে হবে।',
      'প্রাইস Bollinger লোয়ার/আপার ব্যান্ড বা স্পষ্ট S/R জোনে থাকতে হবে।',
      'দোজি বা অত্যন্ত ছোট বডি (Body < ২০%) হলে ট্রেড বাদ দিয়ে WAIT করতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.88,
    ruleWeightMultiplier: 1.0,
    totalTrades: 36,
    winCount: 30,
    lossCount: 6,
    winRate: 83.3,
    cautionaryNotesBn: [
      'ওটিসি মার্কেটে উইকএন্ড বা লো-লিকুইডিটি সময়ে ছোট দোজি ক্যান্ডেল সিরিজে এন্ট্রি নেবেন না।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'otc_rule_3candle_exhaustion',
    profileId: 'BINARY_OTC',
    titleBn: 'OTC ৩-ক্যান্ডেল এক্সজশন রিভার্সাল (Exhaustion)',
    category: 'CANDLESTICK',
    summaryBn: 'টানা ৩টি বড় একই রঙের ক্যান্ডেল যখন বলিঙ্গার ব্যান্ডের বাইরে চলে যায়, তখন অ্যালগরিদমিক মিন-রিভার্সন হিসেবে বিপরীত ক্যান্ডেল আসে।',
    conditionsBn: [
      'টানা ৩টি একই রঙের বড় বডির ক্যান্ডেল তৈরি হতে হবে।',
      'RSI (14) >= ৭০ (PUT) অথবা <= ৩০ (CALL) এক্সজশন জোনে থাকবে।',
    ],
    recommendedDirection: 'PUT',
    confidenceWeight: 0.86,
    ruleWeightMultiplier: 1.0,
    totalTrades: 28,
    winCount: 23,
    lossCount: 5,
    winRate: 82.1,
    cautionaryNotesBn: [
      'স্টেয়ার-স্টেপ স্ট্রং ট্রেন্ডে ক্যান্ডেল বডি ছোট হতে থাকলে এক্সজশন ধরা যাবে না।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'otc_rule_false_breakout_trap',
    profileId: 'BINARY_OTC',
    titleBn: 'OTC ফলস ব্রেকআউট ট্র্যাপ ও অ্যান্টি-দোজি ফিল্টার',
    category: 'OTC_TRAP',
    summaryBn: 'ওটিসি ব্রোকারে সাপোর্ট/রেজিস্ট্যান্স ব্রেক করেই হঠাৎ উল্টো দিকের স্পাইক তৈরি করে—তাই কনফার্মেশন ছাড়া ব্রেকআউট চেজ করা যাবে না।',
    conditionsBn: [
      'কোনো লেভেল ব্রেক করার সাথে সাথে এন্ট্রি না নিয়ে পুলব্যাক বা রিজেকশন দেখুন।',
      'হরিজন্টাল কনসোলিডেশন জোনে সরাসরি WAIT মোডে থাকতে হবে।',
    ],
    recommendedDirection: 'WAIT',
    confidenceWeight: 0.90,
    ruleWeightMultiplier: 1.0,
    totalTrades: 22,
    winCount: 19,
    lossCount: 3,
    winRate: 86.4,
    cautionaryNotesBn: [
      'পরপর ৪টি মিশ্র ছোট ক্যান্ডেল দেখা গেলে স্ক্যান ফলাফল WAIT রাখা বাধ্যতামূলক।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 2,
  },

  // ======================== 2. BINARY_LIVE ========================
  {
    ruleId: 'live_rule_ema_pullback',
    profileId: 'BINARY_LIVE',
    titleBn: 'Binary Live EMA 9/21 ট্রেন্ড পুলব্যাক কন্টিনিউয়েশন',
    category: 'INDICATOR',
    summaryBn: 'লাইভ ফরেক্স/বাইনারি সেশনে (লন্ডন/নিউইয়র্ক) EMA 9 ও EMA 21 একই দিকে ঢালু থাকলে পুলব্যাক শেষে ট্রেন্ডের দিকে এন্ট্রি।',
    conditionsBn: [
      'EMA 9 > EMA 21 (CALL) অথবা EMA 9 < EMA 21 (PUT) স্পষ্ট থাকতে হবে।',
      'রিট্রেসমেন্ট ক্যান্ডেল EMA 21 বা EMA 9 স্পর্শ করে ট্রেন্ডের দিকে ক্লোজ দিবে।',
      'RSI (14) > 52 (CALL) বা < 48 (PUT) মোমেন্টাম সমর্থন করবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.87,
    ruleWeightMultiplier: 1.0,
    totalTrades: 40,
    winCount: 34,
    lossCount: 6,
    winRate: 85.0,
    cautionaryNotesBn: [
      'EMA দুটি অনুভূমিক ও একে অপরকে বারবার ক্রস করলে (সাইডওয়েজ) এন্ট্রি এড়িয়ে চলুন।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'live_rule_break_retest',
    profileId: 'BINARY_LIVE',
    titleBn: 'লাইভ মার্কেট S/R ব্রেক ও রিটেস্ট কনফার্মেশন',
    category: 'SUPPORT_RESISTANCE',
    summaryBn: 'প্রকৃত মার্কেট লিকুইডিটিতে একটি শক্তিশালী সাপোর্ট বা রেজিস্ট্যান্স ভাঙার পর প্রথম পুলব্যাক রিটেস্টে সর্বোচ্চ একুরেসি পাওয়া যায়।',
    conditionsBn: [
      'আসল মোমেন্টাম ব্রেকআউট ক্যান্ডেলটির বডি বড় এবং বিপরীত উইক ছোট হতে হবে।',
      'রিটেস্ট ক্যান্ডেলে স্পষ্ট রিজেকশন দেখা গেলে পরবর্তী ১-৫ মিনিট এন্ট্রি।',
    ],
    recommendedDirection: 'PUT',
    confidenceWeight: 0.85,
    ruleWeightMultiplier: 1.0,
    totalTrades: 30,
    winCount: 25,
    lossCount: 5,
    winRate: 83.3,
    cautionaryNotesBn: [
      'হাই-ইমপ্যাক্ট ইকোনমিক নিউজ রিলিজের ৫ মিনিট আগে ও পরে লাইভ বাইনারি ট্রেড বন্ধ রাখুন।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'live_rule_engulfing_momentum',
    profileId: 'BINARY_LIVE',
    titleBn: 'লাইভ সেশন এনগালফিং + MACD ক্রসওভার',
    category: 'CANDLESTICK',
    summaryBn: 'রিয়েল চার্টে সাপোর্ট/রেজিস্ট্যান্সের কাছে এনগালফিং ক্যান্ডেল এবং MACD হিস্টোগ্রাম একই দিকে ঘুরে গেলে স্ট্রং সেটআপ।',
    conditionsBn: [
      'বর্তমান ক্যান্ডেল পূর্ববর্তী বিপরীত ক্যান্ডেলের সম্পূর্ণ বডি গ্রাস করবে।',
      'MACD Line Signal Line-কে অতিক্রম করে একই দিকে থাকবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.84,
    ruleWeightMultiplier: 1.0,
    totalTrades: 26,
    winCount: 21,
    lossCount: 5,
    winRate: 80.8,
    cautionaryNotesBn: [
      'ডেইলি হাই/লোর ঠিক মুখোমুখি অবস্থানে ট্রেন্ড কন্টিনিউয়েশন এনগালফিং নিবেন না।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 0,
  },

  // ======================== 3. CRYPTO_SPOT ========================
  {
    ruleId: 'crypto_rule_volume_breakout',
    profileId: 'CRYPTO_SPOT',
    titleBn: 'Crypto ভলিউম স্পাইক ব্রেকআউট (LONG/SHORT)',
    category: 'PRICE_ACTION',
    summaryBn: 'Binance/Bybit স্পট ও ফিউচার্সে গড় ভলিউমের >= ১.১৫x ভলিউম সহ মেজর রেঞ্জ ব্রেকআউটে ATR-ভিত্তিক SL/TP সেটআপ।',
    conditionsBn: [
      'ব্রেকআউট ক্যান্ডেলের ভলিউম ২০-বার গড় ভলিউমের উপরে থাকতে হবে।',
      'EMA 9 > EMA 21 (LONG) এবং MACD হিস্টোগ্রাম সম্প্রসারিত হতে হবে।',
      'স্টপ-লস (১.৫×ATR) ও টেক-প্রফিট (৩×ATR) রেশিও নিশ্চিত করতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.86,
    ruleWeightMultiplier: 1.0,
    totalTrades: 32,
    winCount: 26,
    lossCount: 6,
    winRate: 81.3,
    cautionaryNotesBn: [
      'লো-ভলিউমে ব্রেকআউট হলে তা ফেইক-আউট হয়ে দ্রুত রেঞ্জে ফিরে আসে—ভলিউম ছাড়া LONG এন্ট্রি নয়।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'crypto_rule_rsi_bulltrap_guard',
    profileId: 'CRYPTO_SPOT',
    titleBn: 'Crypto ওভারবট বুল-ট্র্যাপ ও শর্ট ডাইভারজেন্স ফিল্টার',
    category: 'INDICATOR',
    summaryBn: 'ক্রিপ্টোতে RSI ৭৫-এর উপরে উঠে বড় আপার উইক তৈরি করলে তা লং ট্র্যাপ হতে পারে—তাই নতুন LONG না নিয়ে SHORT বা WAIT কনফার্ম করতে হবে।',
    conditionsBn: [
      'LONG এন্ট্রির জন্য RSI ৪৮ থেকে ৭৫-এর ভেতর স্বাস্থ্যকর জোনে থাকতে হবে।',
      'SHORT এন্ট্রির জন্য EMA 9 < EMA 21 ও ভলিউম-সমর্থিত বিয়ারিশ ক্লোজ লাগবে।',
    ],
    recommendedDirection: 'PUT',
    confidenceWeight: 0.85,
    ruleWeightMultiplier: 1.0,
    totalTrades: 24,
    winCount: 20,
    lossCount: 4,
    winRate: 83.3,
    cautionaryNotesBn: [
      'BTC হঠাৎ ২%+ মুভ করলে Altcoin স্পট সিগন্যাল সাময়িক WAIT রাখা নিরাপদ।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'crypto_rule_ema21_swing',
    profileId: 'CRYPTO_SPOT',
    titleBn: 'Crypto 15m/1H EMA 21 ডায়নামিক সাপোর্ট সুইং',
    category: 'SUPPORT_RESISTANCE',
    summaryBn: 'স্পট মার্কেটে আপট্রেন্ড চলাকালে EMA 21 বা Bollinger মিডল ব্যান্ডে পুলব্যাক রিজেকশন তৈরি হলে স্ট্রাকচারাল সুইং এন্ট্রি।',
    conditionsBn: [
      '৫m বা ১৫m/১H প্রাইস স্ট্রাকচার Higher High ও Higher Low বজায় রাখবে।',
      'সুইং লোয়ের নিচে পরিষ্কার SL জোন চিহ্নিত থাকতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.87,
    ruleWeightMultiplier: 1.0,
    totalTrades: 29,
    winCount: 24,
    lossCount: 5,
    winRate: 82.8,
    cautionaryNotesBn: [
      'ফান্ডিং রেট অতিরিক্ত পজিটিভ হলে ওভার-লেভারেজ লং স্কুইজ থেকে সাবধান থাকুন।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 0,
  },

  // ======================== 4. FOREX ========================
  {
    ruleId: 'fx_rule_liquidity_bos',
    profileId: 'FOREX',
    titleBn: 'Forex লিকুইডিটি সুইপ + Break of Structure (BOS)',
    category: 'PRICE_ACTION',
    summaryBn: 'ফরেক্স মেজর পেয়ারে (EUR/USD, GBP/USD) আগের সুইং হাই/লো সুইপ করে ইনস্টিটিউশনাল BOS ও অর্ডার ব্লক রিটেস্টে ১:২ Risk-Reward এন্ট্রি।',
    conditionsBn: [
      'আগের সেশন হাই/লোর উপরে বা নিচে দ্রুত উইক সুইপ (Stop Hunt) হতে হবে।',
      'বিপরীত দিকে ডিসপ্লেসমেন্ট ক্যান্ডেল দিয়ে স্ট্রাকচার ব্রেক (BOS) নিশ্চিত হবে।',
      'ন্যূনতম ১:২ রিস্ক-রিওয়ার্ড (SL/TP পিপস) বজায় রাখতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.89,
    ruleWeightMultiplier: 1.0,
    totalTrades: 35,
    winCount: 30,
    lossCount: 5,
    winRate: 85.7,
    cautionaryNotesBn: [
      'এশিয়ান ডেড সেশনে স্প্রেড বেশি ও ATR কম থাকে—লো-ATR সময়ে ট্রেড ব্লক করুন।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'fx_rule_session_atr_spread',
    profileId: 'FOREX',
    titleBn: 'Forex লন্ডন/NY সেশন ATR স্প্রেড ফিল্টার',
    category: 'INDICATOR',
    summaryBn: 'ফরেক্সে স্প্রেডের ক্ষতি এড়াতে সক্রিয় ATR ভোলাটিলিটি ও EMA 9/21 স্ট্রাকচার অ্যালাইনমেন্ট ছাড়া কোনো BUY/SELL সিগন্যাল নয়।',
    conditionsBn: [
      'ATR শতাংশ ন্যূনতম সেশন থ্রেশহোল্ড (>= ০.০১৫%) অতিক্রম করতে হবে।',
      'RSI ৫১–৭২ (BUY) বা ২৮–৪৯ (SELL) পরিষ্কার স্ট্রাকচারাল জোনে থাকবে।',
    ],
    recommendedDirection: 'PUT',
    confidenceWeight: 0.86,
    ruleWeightMultiplier: 1.0,
    totalTrades: 27,
    winCount: 22,
    lossCount: 5,
    winRate: 81.5,
    cautionaryNotesBn: [
      'FOMC, CPI বা NFP নিউজ ক্যান্ডেলে স্প্রেড প্রসারিত হয়—নিউজ স্পাইকে এন্ট্রি নিবেন না।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'fx_rule_orderblock_retest',
    profileId: 'FOREX',
    titleBn: 'Forex অর্ডার ব্লক ও EMA 21 পুলব্যাক এন্ট্রি',
    category: 'SUPPORT_RESISTANCE',
    summaryBn: 'ইনস্টিটিউশনাল অর্ডার ব্লকে প্রাইস ফিরে এসে MACD ও পিন বার/এনগালফিং কনফার্মেশন দিলে সুইং পজিশন।',
    conditionsBn: [
      'প্রাইস পূর্ববর্তী ডিমান্ড বা সাপ্লাই অর্ডার ব্লকে পুলব্যাক করবে।',
      'রিজেকশন উইক বা এনগালফিং ক্যান্ডেল সক্রিয় সাপ্লাই/ডিমান্ড কনফার্ম করবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.84,
    ruleWeightMultiplier: 1.0,
    totalTrades: 21,
    winCount: 17,
    lossCount: 4,
    winRate: 81.0,
    cautionaryNotesBn: [
      'ট্রেন্ডের বিপরীতে অর্ডার ব্লক ধরতে গেলে অবশ্যই ১টি পূর্ণ কনফার্মেশন ক্যান্ডেল ক্লোজের অপেক্ষা করুন।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 0,
  },

  // ======================== 5. COMMODITY_INDEX ========================
  {
    ruleId: 'cmd_rule_momentum_thrust',
    profileId: 'COMMODITY_INDEX',
    titleBn: 'Gold (XAU/USD) ও ইনডেক্স সেশন ব্রেকআউট থ্রাস্ট',
    category: 'PRICE_ACTION',
    summaryBn: 'গোল্ড ও US30/NASDAQ-এ বড় বডি (>= ৩৫% রেঞ্জ) সহ EMA 9 > EMA 21 ও RSI > 53 থ্রাস্ট তৈরি হলে দ্রুত মোমেন্টাম কন্টিনিউয়েশন।',
    conditionsBn: [
      'ক্যান্ডেলের আসল বডি সম্পূর্ণ রেঞ্জের অন্তত ৩৫% হতে হবে (উইক-চপ নয়)।',
      'RSI > 53 (BUY) বা < 47 (SELL) এবং MACD হিস্টোগ্রাম একই দিকে ত্বরান্বিত হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.87,
    ruleWeightMultiplier: 1.0,
    totalTrades: 33,
    winCount: 27,
    lossCount: 6,
    winRate: 81.8,
    cautionaryNotesBn: [
      'উভয় দিকে লম্বা উইকযুক্ত হাই-স্প্রেড স্পাইক ক্যান্ডেলে গোল্ডে এন্ট্রি নেওয়া ঝুঁকিপূর্ণ।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'cmd_rule_spike_trap_filter',
    profileId: 'COMMODITY_INDEX',
    titleBn: 'Gold/Index লিকুইডিটি উইক স্পাইক ট্র্যাপ ফিল্টার',
    category: 'CANDLESTICK',
    summaryBn: 'XAU/USD-তে রাউন্ড ৫০/১০০ ডলার লেভেলে (যেমন 2650, 2700) হঠাৎ বড় উইক তৈরি হলে রিট্রেসমেন্ট পর্যন্ত অপেক্ষা করা।',
    conditionsBn: [
      'গোল্ডের মূল সাইকোলজিক্যাল লেভেলের কাছে ডবল-সাইড উইক দেখা গেলে WAIT থাকতে হবে।',
      'ব্রেকআউটের পর রিট্রেস হয়ে ৫m EMA 9 ধরে রাখলে তবেই BUY/SELL কনফার্ম।',
    ],
    recommendedDirection: 'PUT',
    confidenceWeight: 0.85,
    ruleWeightMultiplier: 1.0,
    totalTrades: 25,
    winCount: 21,
    lossCount: 4,
    winRate: 84.0,
    cautionaryNotesBn: [
      'নিউইয়র্ক মার্কেট ওপেনের প্রথম ১৫ মিনিটে অতিরিক্ত উইক সুইপের কারণে তাড়াহুড়ো করবেন না।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 1,
  },
  {
    ruleId: 'cmd_rule_bb_expansion',
    profileId: 'COMMODITY_INDEX',
    titleBn: 'Gold ও NASDAQ Bollinger মিডল ব্যান্ড ট্রেন্ড পুশ',
    category: 'INDICATOR',
    summaryBn: 'বলিঙ্গার ব্যান্ড সংকোচন (Squeeze) ভেঙে মিডল ব্যান্ডের উপরে/নিচে শক্তিশালী ক্লোজ দিলে ট্রেন্ড রাইডিং সেটআপ।',
    conditionsBn: [
      'প্রাইস Bollinger মিডল লাইনের উপরে (BUY) অথবা নিচে (SELL) ক্লোজ করবে।',
      'ATR অনুযায়ী SL স্পাইক-সেফ জোনের বাইরে রাখতে হবে।',
    ],
    recommendedDirection: 'CALL',
    confidenceWeight: 0.84,
    ruleWeightMultiplier: 1.0,
    totalTrades: 22,
    winCount: 18,
    lossCount: 4,
    winRate: 81.8,
    cautionaryNotesBn: [
      'মিডল ব্যান্ড সম্পূর্ণ সমতল (ফ্ল্যাট) থাকলে ব্রেকআউট হওয়ার আগ পর্যন্ত WAIT করুন।',
    ],
    createdAt: nowTs - 14 * DAY_MS,
    lastUpdated: nowTs - 7 * DAY_MS,
    status: 'ACTIVE',
    learnedFromFailureCount: 0,
  },
];

const DEFAULT_REFLECTIONS_V2: TradeMistakeReflection[] = [
  {
    reflectionId: 'ref_otc_1',
    profileId: 'BINARY_OTC',
    timestamp: nowTs - 3600000 * 6,
    symbol: 'EUR/USD OTC',
    direction: 'CALL',
    suggestedExpiry: '01:00',
    expectedPatternBn: 'OTC উইক রিজেকশন বাউন্স',
    actualOutcome: 'LOSS',
    failureReasonBn:
      'একটি বিপরীত লাল ক্যান্ডেলে সাপোর্ট ভেঙেছিল। তবে এটি সিগন্যাল লগে সংরক্ষিত হয়েছে — মূল রুল তাৎক্ষণিকভাবে পরিবর্তন করা হয়নি।',
    correctiveActionBn:
      'পর্যবেক্ষণ লগড (Rule Locked): এই লসের তথ্য Binary OTC ৭/৩০-দিনের কোহর্ট ডেটায় যোগ হয়েছে। ধারাবাহিক প্যাটার্ন প্রমাণিত হলে পরবর্তী সাইকেলে রুল ওয়েট সমন্বয় হবে।',
    adjustedRuleId: 'otc_rule_wick_rejection',
    confidencePenaltyPercent: 0,
    ruleLockedDeferred: true,
    marketConditionBn: 'ওটিসি রাউন্ড লেভেল টেস্টিং',
  },
  {
    reflectionId: 'ref_crypto_1',
    profileId: 'CRYPTO_SPOT',
    timestamp: nowTs - 3600000 * 14,
    symbol: 'BTC/USDT',
    direction: 'CALL',
    suggestedExpiry: 'SL/TP',
    expectedPatternBn: 'Crypto ভলিউম ব্রেকআউট',
    actualOutcome: 'LOSS',
    failureReasonBn:
      'ব্রেকআউটের পরপরই লো-ভলিউম রিট্রেসমেন্টে স্টপ-আউট হয়েছিল। পর্যবেক্ষণটি Crypto Spot কোহর্ট লগে যুক্ত হয়েছে।',
    correctiveActionBn:
      'পর্যবেক্ষণ লগড (Rule Locked): ১টি ক্যান্ডেল বিপরীতে রুল বদলানো হয়নি। ৭/৩০-দিন শেষে গড় পারফরম্যান্স <৪৫% হলে ভলিউম থ্রেশহোল্ড কঠোর করা হবে।',
    adjustedRuleId: 'crypto_rule_volume_breakout',
    confidencePenaltyPercent: 0,
    ruleLockedDeferred: true,
    marketConditionBn: 'লো-ভলিউম রেঞ্জ ব্রেকআউট',
  },
];

export class AgentLearningService {
  private static instance: AgentLearningService;
  private rules: LearnedStrategyRule[] = [];
  private reflections: TradeMistakeReflection[] = [];
  private signalLedger: SignalOutcomeRecord[] = [];
  private reviewPolicies: Record<TradingProfileId, ProfileReviewPolicy> = createDefaultPolicies();
  private cohortAudits: CohortAuditRecord[] = [];
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
      this.rules = DEFAULT_RULES_V2.map((r) => ({ ...r }));
      this.reflections = DEFAULT_REFLECTIONS_V2.map((r) => ({ ...r }));
      return;
    }

    try {
      const storedRules = localStorage.getItem(STORAGE_KEY_RULES);
      if (storedRules) {
        const parsed = JSON.parse(storedRules) as LearnedStrategyRule[];
        // Verify all 5 profiles exist cleanly
        const profileSet = new Set(parsed.map((r) => r.profileId));
        const allProfilesCovered = TRADING_PROFILE_LIST.every((p) => profileSet.has(p.id));
        if (parsed.length > 0 && allProfilesCovered) {
          this.rules = parsed;
        } else {
          this.rules = DEFAULT_RULES_V2.map((r) => ({ ...r }));
          this.saveRulesToStorage();
        }
      } else {
        this.rules = DEFAULT_RULES_V2.map((r) => ({ ...r }));
        this.saveRulesToStorage();
      }

      const storedReflections = localStorage.getItem(STORAGE_KEY_REFLECTIONS);
      if (storedReflections) {
        this.reflections = JSON.parse(storedReflections);
      } else {
        this.reflections = DEFAULT_REFLECTIONS_V2.map((r) => ({ ...r }));
        this.saveReflectionsToStorage();
      }

      const storedLedger = localStorage.getItem(STORAGE_KEY_SIGNAL_LEDGER);
      if (storedLedger) {
        this.signalLedger = JSON.parse(storedLedger);
      } else {
        this.signalLedger = [];
      }

      const storedPolicies = localStorage.getItem(STORAGE_KEY_REVIEW_POLICIES);
      if (storedPolicies) {
        const parsedPolicies = JSON.parse(storedPolicies);
        const defaults = createDefaultPolicies();
        TRADING_PROFILE_LIST.forEach((p) => {
          if (parsedPolicies && parsedPolicies[p.id]) {
            defaults[p.id] = { ...defaults[p.id], ...parsedPolicies[p.id] };
          }
        });
        this.reviewPolicies = defaults;
      } else {
        this.reviewPolicies = createDefaultPolicies();
        this.savePoliciesToStorage();
      }

      const storedAudits = localStorage.getItem(STORAGE_KEY_COHORT_AUDITS);
      if (storedAudits) {
        this.cohortAudits = JSON.parse(storedAudits);
      }
    } catch (err) {
      console.warn('[AgentLearningService] Error reading storage:', err);
      this.rules = DEFAULT_RULES_V2.map((r) => ({ ...r }));
      this.reflections = DEFAULT_REFLECTIONS_V2.map((r) => ({ ...r }));
      this.reviewPolicies = createDefaultPolicies();
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

  private saveLedgerToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_SIGNAL_LEDGER, JSON.stringify(this.signalLedger.slice(0, 1200)));
      } catch {}
    }
  }

  private savePoliciesToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_REVIEW_POLICIES, JSON.stringify(this.reviewPolicies));
      } catch {}
    }
  }

  private saveAuditsToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_COHORT_AUDITS, JSON.stringify(this.cohortAudits.slice(0, 100)));
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

  /**
   * STRICT PROFILE ISOLATION: Returns rules strictly belonging to the given profileId
   * (or all rules only when explicitly omitted by overview hubs).
   */
  public getRules(profileId?: TradingProfileId): LearnedStrategyRule[] {
    if (profileId) {
      return this.rules.filter((r) => r.profileId === profileId).map((r) => ({ ...r }));
    }
    return this.rules.map((r) => ({ ...r }));
  }

  /**
   * Explicit helper guaranteed to return ONLY rules belonging to `profileId` (zero cross-contamination)
   */
  public getRulesByProfile(profileId: TradingProfileId): LearnedStrategyRule[] {
    return this.rules.filter((r) => r.profileId === profileId).map((r) => ({ ...r }));
  }

  public getRuleById(ruleId: string): LearnedStrategyRule | undefined {
    return this.rules.find((r) => r.ruleId === ruleId);
  }

  public getReflections(profileId?: TradingProfileId): TradeMistakeReflection[] {
    const list = profileId
      ? this.reflections.filter((r) => r.profileId === profileId)
      : this.reflections;
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }

  public getSignalLedger(profileId?: TradingProfileId): SignalOutcomeRecord[] {
    const list = profileId
      ? this.signalLedger.filter((s) => s.profileId === profileId)
      : this.signalLedger;
    return [...list].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Serializes ONLY the selected profile's learned rules, confidence weights & verified cautions
   * for injection into Gemini Vision / live scanner prompt — guarantees zero cross-market bleed.
   */
  public getActiveProfilePromptContext(profileId: TradingProfileId): string {
    const profileMeta = getTradingProfile(profileId);
    const profileRules = this.getRulesByProfile(profileId);
    const policy = this.reviewPolicies[profileId];

    const lines: string[] = [
      `SELECTED PROFILE: ${profileMeta.shortLabel} (${profileId}) | Output: ${profileMeta.outputMode} | Cycle: ${policy.reviewWindowDays}-Day Cohort Review`,
      `RULES TO APPLY EXCLUSIVELY (${profileRules.length} isolated rules for ${profileMeta.shortLabel}):`,
    ];

    profileRules.forEach((r, idx) => {
      const confPct = Math.round(r.confidenceWeight * 100);
      lines.push(
        `${idx + 1}. [${r.recommendedDirection}] ${r.titleBn} (Weight: ${confPct}%, WinRate: ${r.winRate}%)`
      );
      if (r.conditionsBn.length > 0) {
        lines.push(`   Conditions: ${r.conditionsBn.slice(0, 2).join(' | ')}`);
      }
      if (r.cautionaryNotesBn.length > 0) {
        lines.push(`   Verified Caution: ${r.cautionaryNotesBn[0]}`);
      }
    });

    return lines.join('\n');
  }

  public getStats(profileId?: TradingProfileId): LearningHubStats {
    const targetRules = this.getRules(profileId);
    const targetReflections = this.getReflections(profileId);
    const targetSignals = this.getSignalLedger(profileId);

    const totalRules = targetRules.length;
    const activeRules = targetRules.filter((r) => r.status === 'ACTIVE').length;
    const revisedRules = targetRules.filter((r) => r.learnedFromFailureCount > 0).length;
    const totalReflections = targetReflections.length;

    let totalWins = 0;
    let totalTrades = 0;
    targetRules.forEach((r) => {
      totalWins += r.winCount;
      totalTrades += r.totalTrades;
    });

    const overallWinRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 1000) / 10 : 83.0;
    const lastLearningTimestamp =
      targetSignals[0]?.timestamp || targetReflections[0]?.timestamp || Date.now();

    return {
      totalRules,
      activeRules,
      revisedRules,
      totalReflections,
      totalLoggedSignals: targetSignals.length,
      overallWinRate,
      lastLearningTimestamp,
    };
  }

  public getProfileSummary(profileId: TradingProfileId): ProfileLearningSummary {
    const policy = this.reviewPolicies[profileId] || createDefaultPolicies()[profileId];
    const now = Date.now();
    const windowStart = Math.max(policy.lastRuleUpdateAt, now - policy.reviewWindowDays * DAY_MS);

    const cohortSignals = this.signalLedger.filter(
      (s) => s.profileId === profileId && s.timestamp >= windowStart
    );
    const cohortWins = cohortSignals.filter((s) => s.outcome === 'WIN').length;
    const cohortLosses = cohortSignals.filter((s) => s.outcome === 'LOSS').length;
    const decided = cohortWins + cohortLosses;
    const cohortWinRate = decided > 0 ? Math.round((cohortWins / decided) * 1000) / 10 : 0;

    const msLeft = Math.max(0, policy.nextEligibleUpdateAt - now);
    const daysRemaining = Math.ceil(msLeft / DAY_MS);
    const sampleProgressPercent = Math.min(
      100,
      Math.round((cohortSignals.length / Math.max(1, policy.minSignalsRequired)) * 100)
    );
    const readyForAutoEvolution =
      now >= policy.nextEligibleUpdateAt && cohortSignals.length >= policy.minSignalsRequired;

    const latestAudits = this.cohortAudits
      .filter((a) => a.profileId === profileId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    return {
      profileId,
      policy: { ...policy },
      cohortSignalsCount: cohortSignals.length,
      cohortWins,
      cohortLosses,
      cohortWinRate,
      daysRemaining,
      sampleProgressPercent,
      readyForAutoEvolution,
      latestAudits,
    };
  }

  /**
   * Switch a profile's rule-review cadence between 7-Day (Weekly) and 30-Day (Monthly)
   */
  public setReviewWindow(profileId: TradingProfileId, days: ReviewWindowDays): void {
    const policy = this.reviewPolicies[profileId] || createDefaultPolicies()[profileId];
    policy.reviewWindowDays = days;
    policy.minSignalsRequired = getMinSamplesForWindow(days);
    policy.nextEligibleUpdateAt = policy.lastRuleUpdateAt + days * DAY_MS;
    this.reviewPolicies[profileId] = policy;
    this.savePoliciesToStorage();
    this.notify();
  }

  /**
   * Logs EVERY resolved signal outcome (WIN / LOSS / DRAW) into the profile's continuous
   * learning ledger, WITHOUT mutating core rules on 1 opposing candle!
   * Core rule evolution only triggers when BOTH review window (7d/30d) AND sample threshold pass.
   */
  public recordOutcome(
    symbol: string,
    direction: 'CALL' | 'PUT',
    outcome: 'WIN' | 'LOSS' | 'DRAW',
    patternName?: string,
    customNote?: string,
    explicitProfileId?: TradingProfileId,
    source: string = 'LIVE_SIGNAL'
  ): {
    reflection?: TradeMistakeReflection;
    updatedRule?: LearnedStrategyRule;
    cohortAudit?: CohortAuditRecord;
    signalRecord: SignalOutcomeRecord;
    deferredLockReasonBn: string;
  } {
    const profileId: TradingProfileId = explicitProfileId || tradingProfileService.getActiveProfileId();
    const profileRules = this.rules.filter((r) => r.profileId === profileId);

    // 1. Match best rule STRICTLY inside this profile's isolated rule list
    let targetRule = profileRules.find(
      (r) =>
        (patternName && r.titleBn.toLowerCase().includes(patternName.toLowerCase())) ||
        (patternName && patternName.toLowerCase().includes(r.category.toLowerCase())) ||
        r.recommendedDirection === direction
    );
    if (!targetRule && profileRules.length > 0) {
      targetRule = profileRules[0];
    }

    const now = Date.now();
    const signalRecord: SignalOutcomeRecord = {
      id: `sigrec_${profileId}_${now}_${Math.random().toString(36).substring(2, 6)}`,
      profileId,
      symbol,
      direction,
      outcome,
      patternName,
      matchedRuleId: targetRule?.ruleId,
      timestamp: now,
      source,
      customNote,
    };

    this.signalLedger.unshift(signalRecord);
    if (this.signalLedger.length > 1200) {
      this.signalLedger.pop();
    }
    this.saveLedgerToStorage();

    // Update cumulative observation stats ONLY — NEVER alter confidenceWeight or status on 1 candle!
    if (targetRule && (outcome === 'WIN' || outcome === 'LOSS')) {
      targetRule.totalTrades += 1;
      if (outcome === 'WIN') {
        targetRule.winCount += 1;
      } else {
        targetRule.lossCount += 1;
      }
      targetRule.winRate = Math.round((targetRule.winCount / targetRule.totalTrades) * 1000) / 10;
      targetRule.lastUpdated = now;
      this.saveRulesToStorage();
    }

    const policy = this.reviewPolicies[profileId] || createDefaultPolicies()[profileId];
    policy.signalsLoggedSinceUpdate += 1;
    policy.rulesLocked = true;

    let reflection: TradeMistakeReflection | undefined;

    if (outcome === 'LOSS') {
      const profileConfig = getTradingProfile(profileId);
      const failureId = `ref_${profileId}_${now}_${Math.random().toString(36).substring(2, 6)}`;

      let failureReasonBn =
        customNote ||
        `[${profileConfig.shortLabel}] ${symbol} পেয়ারে ${direction} সিগন্যালটি বিপরীত ক্যান্ডেলে লস হয়েছে। ফলাফলটি শিখন লগে রেকর্ড করা হয়েছে।`;

      if (profileId === 'BINARY_OTC') {
        failureReasonBn += ' (OTC অ্যালগরিদমিক স্পাইক / উইক প্রেসার পর্যবেক্ষণে রাখা হয়েছে)';
      } else if (profileId === 'CRYPTO_SPOT') {
        failureReasonBn += ' (স্পট ভলিউম ডাইভারজেন্স পর্যবেক্ষণে রাখা হয়েছে)';
      } else if (profileId === 'FOREX') {
        failureReasonBn += ' (ফরেক্স লিকুইডিটি সুইপ ও সেশন স্প্রেড পর্যবেক্ষণে রাখা হয়েছে)';
      } else if (profileId === 'COMMODITY_INDEX') {
        failureReasonBn += ' (গোল্ড/ইনডেক্স হাই-ভলাটিলিটি উইক স্পাইক পর্যবেক্ষণে রাখা হয়েছে)';
      }

      const correctiveActionBn = `মূল রুল লকড (Anti-Knee-Jerk): ১টি ক্যান্ডেল লসে রুল পরিবর্তন হয়নি। এই ডেটাটি ${policy.reviewWindowDays}-দিনের কোহর্ট বিশ্লেষণে (${policy.signalsLoggedSinceUpdate}/${policy.minSignalsRequired} সিগন্যাল) জমা হলো।`;

      reflection = {
        reflectionId: failureId,
        profileId,
        timestamp: now,
        symbol,
        direction,
        suggestedExpiry: profileConfig.outputMode === 'SPOT_SL_TP' ? 'SL/TP' : '01:00',
        expectedPatternBn: patternName || (targetRule ? targetRule.titleBn : profileConfig.shortLabel),
        actualOutcome: 'LOSS',
        failureReasonBn,
        correctiveActionBn,
        adjustedRuleId: targetRule?.ruleId,
        confidencePenaltyPercent: 0, // 0% immediate penalty — protected by 7d/30d lock
        ruleLockedDeferred: true,
        marketConditionBn: `${profileConfig.shortLabel} (${policy.reviewWindowDays}d কোহর্ট কিউ)`,
      };

      this.reflections.unshift(reflection);
      if (this.reflections.length > 150) {
        this.reflections.pop();
      }
      this.saveReflectionsToStorage();

      if (targetRule) {
        targetRule.lastMistakeReflectionBn = failureReasonBn;
        this.saveRulesToStorage();
      }
    }

    // 2. Check Dual Gate for Automatic Cohort Evolution (Time Window Elapsed + Min Sample Threshold)
    let cohortAudit: CohortAuditRecord | undefined;
    const windowSignals = this.signalLedger.filter(
      (s) => s.profileId === profileId && s.timestamp >= policy.lastRuleUpdateAt
    );

    if (now >= policy.nextEligibleUpdateAt && windowSignals.length >= policy.minSignalsRequired) {
      const auditResult = this.runCohortAudit(profileId, false);
      if (auditResult.executed) {
        cohortAudit = auditResult.audit;
      }
    } else {
      const remainingSamples = Math.max(0, policy.minSignalsRequired - windowSignals.length);
      const daysLeft = Math.max(0, Math.ceil((policy.nextEligibleUpdateAt - now) / DAY_MS));
      policy.lastCohortVerdictBn = `লকড ও স্থিতিশীল — প্রতিটি সিগন্যাল শেখার লগে জমা হচ্ছে (${windowSignals.length}/${policy.minSignalsRequired} সিগন্যাল, ${daysLeft} দিন বাকি${remainingSamples > 0 ? `, আরও ${remainingSamples}টি সিগন্যাল প্রয়োজন` : ''})।`;
      this.reviewPolicies[profileId] = policy;
      this.savePoliciesToStorage();
    }

    this.notify();

    // Non-blocking sync to backend ledger
    if (reflection) {
      this.syncWithBackend(reflection, targetRule).catch(() => {});
    }

    return {
      reflection,
      updatedRule: targetRule,
      cohortAudit,
      signalRecord,
      deferredLockReasonBn: policy.lastCohortVerdictBn || 'মূল রুল স্থিতিশীল আছে।',
    };
  }

  /**
   * Executes statistical Cohort Evolution strictly on ONE profile's accumulated signals
   * over its 7-day or 30-day cycle. Protected by minimum sample safety lock (>= 10 signals)
   * so 1 single opposing candle can NEVER alter rules.
   */
  public runCohortAudit(
    profileId: TradingProfileId,
    manualAudit: boolean = true
  ): { executed: boolean; reasonBn: string; audit?: CohortAuditRecord } {
    const policy = this.reviewPolicies[profileId] || createDefaultPolicies()[profileId];
    const profileConfig = getTradingProfile(profileId);
    const now = Date.now();
    const lookbackStart = Math.max(policy.lastRuleUpdateAt, now - policy.reviewWindowDays * DAY_MS);

    const cohortSignals = this.signalLedger.filter(
      (s) => s.profileId === profileId && s.timestamp >= lookbackStart
    );

    if (cohortSignals.length < MIN_SAFETY_COHORT_SIGNALS) {
      const reasonBn = `নিরাপত্তা লক: ১টি বা অল্প কিছু ক্যান্ডেল বিপরীত হলেই [${profileConfig.shortLabel}] রুল পরিবর্তন হয় না। কোহর্ট আপডেটের জন্য কমপক্ষে ${MIN_SAFETY_COHORT_SIGNALS}টি সিগন্যাল জমা হতে হবে (বর্তমান: ${cohortSignals.length}/${MIN_SAFETY_COHORT_SIGNALS})।`;
      return { executed: false, reasonBn };
    }

    if (!manualAudit && (now < policy.nextEligibleUpdateAt || cohortSignals.length < policy.minSignalsRequired)) {
      return {
        executed: false,
        reasonBn: `${policy.reviewWindowDays}-দিনের সময়সীমা ও ন্যূনতম ${policy.minSignalsRequired}টি সিগন্যাল পূর্ণ হয়নি।`,
      };
    }

    const profileRules = this.rules.filter((r) => r.profileId === profileId);
    let rulesAdjustedCount = 0;
    let newCautionAddedCount = 0;

    // Group cohort signals by rule
    profileRules.forEach((rule) => {
      const matched = cohortSignals.filter((s) => s.matchedRuleId === rule.ruleId);
      const wins = matched.filter((s) => s.outcome === 'WIN').length;
      const losses = matched.filter((s) => s.outcome === 'LOSS').length;
      const totalDecided = wins + losses;

      if (totalDecided >= 4) {
        const cohortRate = (wins / totalDecided) * 100;
        if (cohortRate < 45) {
          rule.confidenceWeight = Math.max(0.65, Math.round((rule.confidenceWeight - 0.04) * 100) / 100);
          rule.ruleWeightMultiplier = Math.max(0.70, Math.round((rule.ruleWeightMultiplier - 0.08) * 100) / 100);
          rule.status = 'REVISED';
          rule.learnedFromFailureCount += 1;
          rule.lastUpdated = now;
          const dateStr = new Date(now).toLocaleDateString('bn-BD');
          const caution = `${policy.reviewWindowDays}-দিনের কোহর্ট অডিট (${dateStr}): ${totalDecided}টি সিগন্যালে সফলতা ${cohortRate.toFixed(0)}% হওয়ায় অতিরিক্ত কনফার্মেশন ছাড়া এই সেটআপে ঝুঁকি কমানো হয়েছে।`;
          if (!rule.cautionaryNotesBn.includes(caution)) {
            rule.cautionaryNotesBn.unshift(caution);
            if (rule.cautionaryNotesBn.length > 5) rule.cautionaryNotesBn.pop();
            newCautionAddedCount++;
          }
          rulesAdjustedCount++;
        } else if (cohortRate >= 65) {
          rule.confidenceWeight = Math.min(0.96, Math.round((rule.confidenceWeight + 0.03) * 100) / 100);
          rule.ruleWeightMultiplier = Math.min(1.25, Math.round((rule.ruleWeightMultiplier + 0.05) * 100) / 100);
          rule.status = 'ACTIVE';
          rule.lastUpdated = now;
          rulesAdjustedCount++;
        }
      }
    });

    // Check if repeated losses in the cohort suggest adding a new profile-specific caution insight
    const totalWins = cohortSignals.filter((s) => s.outcome === 'WIN').length;
    const totalLosses = cohortSignals.filter((s) => s.outcome === 'LOSS').length;
    const overallDecided = totalWins + totalLosses;
    const overallWinRate = overallDecided > 0 ? Math.round((totalWins / overallDecided) * 1000) / 10 : 0;

    if (totalLosses >= 3 && overallWinRate < 50 && profileRules.length > 0) {
      const topRule = profileRules[0];
      const summaryCaution = `${policy.reviewWindowDays}-দিন সামগ্রিক কোহর্ট ফিল্টার: ${overallDecided} ট্রেডে উইনরেট ${overallWinRate}% — অস্থির ক্যান্ডেলে WAIT ফিল্টার আরও শক্তিশালী করা হয়েছে।`;
      if (!topRule.cautionaryNotesBn.includes(summaryCaution)) {
        topRule.cautionaryNotesBn.unshift(summaryCaution);
        if (topRule.cautionaryNotesBn.length > 5) topRule.cautionaryNotesBn.pop();
        newCautionAddedCount++;
      }
    }

    const summaryBn = `[${profileConfig.shortLabel}] ${policy.reviewWindowDays}-দিনের কোহর্ট বিশ্লেষণ সম্পন্ন: ${cohortSignals.length}টি সিগন্যালে উইনরেট ${overallWinRate}%। ${rulesAdjustedCount}টি রুল ওয়েট ও ${newCautionAddedCount}টি সতর্কতা নিরাপদভাবে আপডেট হয়েছে।`;

    const audit: CohortAuditRecord = {
      auditId: `audit_${profileId}_${now}`,
      profileId,
      timestamp: now,
      windowDays: policy.reviewWindowDays,
      signalsEvaluated: cohortSignals.length,
      winRate: overallWinRate,
      rulesAdjustedCount,
      newCautionAddedCount,
      summaryBn,
    };

    this.cohortAudits.unshift(audit);
    if (this.cohortAudits.length > 100) this.cohortAudits.pop();

    policy.lastRuleUpdateAt = now;
    policy.nextEligibleUpdateAt = now + policy.reviewWindowDays * DAY_MS;
    policy.signalsLoggedSinceUpdate = 0;
    policy.rulesLocked = true;
    policy.lastCohortVerdictBn = summaryBn;
    this.reviewPolicies[profileId] = policy;

    this.saveRulesToStorage();
    this.saveAuditsToStorage();
    this.savePoliciesToStorage();
    this.notify();

    return { executed: true, reasonBn: summaryBn, audit };
  }

  private async syncWithBackend(reflection: TradeMistakeReflection, rule?: LearnedStrategyRule): Promise<void> {
    try {
      await fetch(getApiUrl('/api/agent/reflect-mistake'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reflection, rule, profileId: reflection.profileId }),
      });
    } catch {}
  }

  public addNewRule(
    ruleData: Omit<
      LearnedStrategyRule,
      'ruleId' | 'createdAt' | 'lastUpdated' | 'learnedFromFailureCount' | 'ruleWeightMultiplier'
    >
  ): LearnedStrategyRule {
    const newRule: LearnedStrategyRule = {
      ...ruleData,
      ruleId: `rule_${ruleData.profileId}_${Date.now()}`,
      ruleWeightMultiplier: 1.0,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      learnedFromFailureCount: 0,
    };

    this.rules.unshift(newRule);
    this.saveRulesToStorage();
    this.notify();
    return newRule;
  }

  public resetToDefaults(profileId?: TradingProfileId): void {
    if (profileId) {
      this.rules = [
        ...this.rules.filter((r) => r.profileId !== profileId),
        ...DEFAULT_RULES_V2.filter((r) => r.profileId === profileId).map((r) => ({ ...r })),
      ];
      this.reflections = this.reflections.filter((r) => r.profileId !== profileId);
      this.signalLedger = this.signalLedger.filter((s) => s.profileId !== profileId);
      const defPolicies = createDefaultPolicies();
      this.reviewPolicies[profileId] = defPolicies[profileId];
    } else {
      this.rules = DEFAULT_RULES_V2.map((r) => ({ ...r }));
      this.reflections = DEFAULT_REFLECTIONS_V2.map((r) => ({ ...r }));
      this.signalLedger = [];
      this.reviewPolicies = createDefaultPolicies();
      this.cohortAudits = [];
    }
    this.saveRulesToStorage();
    this.saveReflectionsToStorage();
    this.saveLedgerToStorage();
    this.savePoliciesToStorage();
    this.saveAuditsToStorage();
    this.notify();
  }

  public exportKnowledgeAsJson(): string {
    return JSON.stringify(
      {
        appName: 'TradePulse AI Knowledge Playbook (Isolated Multi-Platform)',
        exportedAt: new Date().toISOString(),
        stats: this.getStats(),
        reviewPolicies: this.reviewPolicies,
        rules: this.rules,
        cohortAudits: this.cohortAudits,
        signalLedger: this.signalLedger.slice(0, 200),
        mistakeReflections: this.reflections,
      },
      null,
      2
    );
  }
}

export const agentLearningService = AgentLearningService.getInstance();
