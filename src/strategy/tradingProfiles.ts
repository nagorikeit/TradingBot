export type TradingProfileId =
  | 'BINARY_OTC'
  | 'BINARY_LIVE'
  | 'CRYPTO_SPOT'
  | 'FOREX'
  | 'COMMODITY_INDEX';

export type ScreenProfileMode = 'AUTO' | TradingProfileId;

export interface TradingProfileRuleDoc {
  title: string;
  bullCondition: string;
  bearCondition: string;
}

export interface TradingProfileConfig {
  id: TradingProfileId;
  shortLabel: string;
  labelBn: string;
  platformsExample: string;
  outputMode: 'BINARY_EXPIRY' | 'SPOT_SL_TP';
  buyLabel: string;
  sellLabel: string;
  defaultTimeframeLabel: string;
  suggestedTargetText: string;
  summaryBn: string;
  noTradeFilterBn: string;
  aiFocusBn: string;
  rules: TradingProfileRuleDoc[];
}

export const TRADING_PROFILES: Record<TradingProfileId, TradingProfileConfig> = {
  BINARY_OTC: {
    id: 'BINARY_OTC',
    shortLabel: 'Binary OTC',
    labelBn: 'Binary OTC',
    platformsExample: 'Quotex OTC, Pocket Option OTC, Binomo OTC',
    outputMode: 'BINARY_EXPIRY',
    buyLabel: 'CALL / UP',
    sellLabel: 'PUT / DOWN',
    defaultTimeframeLabel: '1m - 2m',
    suggestedTargetText: '1 - 2 Min (OTC পরবর্তী ক্যান্ডেল)',
    summaryBn: 'OTC অ্যালগরিদমিক মার্কেটের জন্য উইক রিজেকশন, বলিঙ্গার ব্যান্ড টাচ ও ৩-ক্যান্ডেল এক্সজশন রিভার্সাল ফোকাসড রুলস।',
    noTradeFilterBn: 'ছোট দোজি/স্পিনিং টপ ও সমান-সমান কনফ্লিক্ট ক্যান্ডেল অটো ফিল্টার (WAIT)।',
    aiFocusBn: 'লম্বা উইক রিজেকশন, সাপোর্ট/রেজিস্ট্যান্স বাউন্স, ৩-ক্যান্ডেল এক্সজশন এবং দোজি/সাইডওয়েজ এড়িয়ে চলা।',
    rules: [
      {
        title: '1. Bollinger Band Value Zone',
        bullCondition: 'প্রাইস Bollinger লোয়ার ব্যান্ড বা মিডলের নিচে রিভার্সাল জোনে',
        bearCondition: 'প্রাইস Bollinger আপার ব্যান্ড বা মিডলের উপরে রিভার্সাল জোনে',
      },
      {
        title: '2. OTC RSI Exhaustion & Bounce',
        bullCondition: 'RSI (14) <= 45 থেকে ঘুরে উঠেছে অথবা ওভারসোল্ড বাউন্স',
        bearCondition: 'RSI (14) >= 55 থেকে নিচে নেমেছে অথবা ওভারবট রিজেকশন',
      },
      {
        title: '3. Wick Rejection / Pin Bar Action',
        bullCondition: 'লোয়ার উইক ক্যান্ডেল রেঞ্জের >= ৩২% (ক্রেতা রিজেকশন)',
        bearCondition: 'আপার উইক ক্যান্ডেল রেঞ্জের >= ৩২% (বিক্রেতা রিজেকশন)',
      },
      {
        title: '4. Anti-Doji Healthy Body Filter',
        bullCondition: 'ক্যান্ডেলের বডি >= ২৫% ও ক্লিয়ার বুলিশ ক্লোজ',
        bearCondition: 'ক্যান্ডেলের বডি >= ২৫% ও ক্লিয়ার বিয়ারিশ ক্লোজ',
      },
      {
        title: '5. Short-Term EMA Mean Alignment',
        bullCondition: 'ক্লোজ আগের ক্যান্ডেল হাই/মিড অতিক্রম করে বুলিশ মোমেন্টাম',
        bearCondition: 'ক্লোজ আগের ক্যান্ডেল লো/মিড অতিক্রম করে বিয়ারিশ মোমেন্টাম',
      },
    ],
  },
  BINARY_LIVE: {
    id: 'BINARY_LIVE',
    shortLabel: 'Binary Live',
    labelBn: 'Binary Live',
    platformsExample: 'Quotex Real, IQ Option, Olymp Trade, Deriv',
    outputMode: 'BINARY_EXPIRY',
    buyLabel: 'CALL / UP',
    sellLabel: 'PUT / DOWN',
    defaultTimeframeLabel: '1m - 5m',
    suggestedTargetText: '1 - 5 Min (লাইভ সেশন এক্সপায়ারি)',
    summaryBn: 'লাইভ মার্কেট লিকুইডিটির জন্য EMA 9/21 ট্রেন্ড, RSI মোমেন্টাম, MACD ও ডায়নামিক সাপোর্ট কনফ্লুয়েন্স।',
    noTradeFilterBn: 'EMA ফ্ল্যাট বা ৪/৫-এর নিচে দুর্বল কনফ্লুয়েন্স হলে WAIT থাকে।',
    aiFocusBn: 'রিয়েল মার্কেট ট্রেন্ড ফলো, ব্রেক অ্যান্ড রিটেস্ট, স্ট্রং বডি কন্টিনিউয়েশন ও EMA ক্রস।',
    rules: [
      {
        title: '1. EMA 9 / EMA 21 Trend Bias',
        bullCondition: 'EMA 9 > EMA 21 (আসল আপট্রেন্ড অ্যালাইনমেন্ট)',
        bearCondition: 'EMA 9 < EMA 21 (আসল ডাউনট্রেন্ড অ্যালাইনমেন্ট)',
      },
      {
        title: '2. RSI Momentum Threshold',
        bullCondition: 'RSI (14) > 52 ও পজিটিভ বায়ার্স জোন',
        bearCondition: 'RSI (14) < 48 ও শক্তিশালী সেলার্স জোন',
      },
      {
        title: '3. MACD Line & Signal',
        bullCondition: 'MACD Line > Signal অথবা হিস্টোগ্রাম পজিটিভ',
        bearCondition: 'MACD Line < Signal অথবা হিস্টোগ্রাম নেগেটিভ',
      },
      {
        title: '4. Dynamic EMA 21 Baseline',
        bullCondition: 'বর্তমান ক্লোজ প্রাইস EMA 21 সাপোর্টের উপরে',
        bearCondition: 'বর্তমান ক্লোজ প্রাইস EMA 21 রেজিস্ট্যান্সের নিচে',
      },
      {
        title: '5. Solid Candle Close Confirmation',
        bullCondition: 'Close > Open ও সবুজ ক্যান্ডেলে ক্রেতা নিয়ন্ত্রণ',
        bearCondition: 'Close < Open ও লাল ক্যান্ডেলে বিক্রেতা নিয়ন্ত্রণ',
      },
    ],
  },
  CRYPTO_SPOT: {
    id: 'CRYPTO_SPOT',
    shortLabel: 'Crypto Spot',
    labelBn: 'Crypto Spot',
    platformsExample: 'Binance, Bybit, OKX, Bitget',
    outputMode: 'SPOT_SL_TP',
    buyLabel: 'LONG / BUY',
    sellLabel: 'SHORT / SELL',
    defaultTimeframeLabel: '5m - 1h',
    suggestedTargetText: 'Entry / SL (1.5×ATR) / TP (3×ATR)',
    summaryBn: 'ক্রিপ্টো মার্কেটের হাই ভোলাটিলিটির জন্য ভলিউম স্পাইক, ট্রেন্ড কনটিনিউয়েশন ও ATR-ভিত্তিক SL/TP হিসাব।',
    noTradeFilterBn: 'কম ভলিউম বা রেঞ্জিং চপ মার্কেটে ফেইক ব্রেকআউট প্রতিরোধ।',
    aiFocusBn: 'ব্রেকআউট ভলিউম, EMA 21/50 ট্রেন্ড, মেজর সাপোর্ট-রেজিস্ট্যান্স ও LONG/SHORT SL-TP জোন।',
    rules: [
      {
        title: '1. Crypto EMA 9 > 21 Trend Expansion',
        bullCondition: 'EMA 9 > EMA 21 ও প্রাইস EMA 21-এর উপরে ধরে আছে',
        bearCondition: 'EMA 9 < EMA 21 ও প্রাইস EMA 21-এর নিচে রয়েছে',
      },
      {
        title: '2. Volume Surge Confirmation',
        bullCondition: 'বর্তমান ভলিউম ২০-ক্যান্ডেল গড় ভলিউমের >= ১.০৫x',
        bearCondition: 'বর্তমান ভলিউম ২০-ক্যান্ডেল গড় ভলিউমের >= ১.০৫x',
      },
      {
        title: '3. MACD Momentum Expansion',
        bullCondition: 'MACD > Signal এবং হিস্টোগ্রাম পজিটিভ',
        bearCondition: 'MACD < Signal এবং হিস্টোগ্রাম নেগেটিভ',
      },
      {
        title: '4. Healthy Trend RSI Zone',
        bullCondition: 'RSI 48–75 (অতিরিক্ত ওভারবট ছাড়া ট্রেন্ড শক্তি)',
        bearCondition: 'RSI 25–52 (অতিরিক্ত ওভারসোল্ড ছাড়া ডাউন ট্রেন্ড)',
      },
      {
        title: '5. Strong Breakout Candle Close',
        bullCondition: 'Close > Open এবং পূর্ববর্তী ক্যান্ডেলের হাইয়ের কাছাকাছি ক্লোজ',
        bearCondition: 'Close < Open এবং পূর্ববর্তী ক্যান্ডেলের লোয়ের কাছাকাছি ক্লোজ',
      },
    ],
  },
  FOREX: {
    id: 'FOREX',
    shortLabel: 'Forex FX',
    labelBn: 'Forex',
    platformsExample: 'Exness, XM, IC Markets, Octa, MT4/MT5',
    outputMode: 'SPOT_SL_TP',
    buyLabel: 'BUY (LONG)',
    sellLabel: 'SELL (SHORT)',
    defaultTimeframeLabel: '15m - 4h',
    suggestedTargetText: '1:2 Risk-Reward (SL / TP Pipes)',
    summaryBn: 'ফরেক্স সেশন ও লিকুইডিটি স্ট্রাকচার অনুযায়ী স্প্রেড-সেফ ATR ফিল্টার, স্ট্রাকচারাল ট্রেন্ড এবং ১:২ SL/TP রুল।',
    noTradeFilterBn: 'এশিয়ান ডেড সেশন বা খুব কম ATR ভোলাটিলিটি থাকলে ট্রেড ব্লক।',
    aiFocusBn: 'মার্কেট স্ট্রাকচার (BOS/CHoCH), লিকুইডিটি সুইপ, অর্ডার ব্লক ও Risk-Reward SL/TP।',
    rules: [
      {
        title: '1. Institutional Structure EMA Alignment',
        bullCondition: 'EMA 9 > EMA 21 এবং মিডল ব্যান্ডের উপরে প্রাইস স্ট্রাকচার',
        bearCondition: 'EMA 9 < EMA 21 এবং মিডল ব্যান্ডের নিচে প্রাইস স্ট্রাকচার',
      },
      {
        title: '2. Session ATR Volatility Gate',
        bullCondition: 'সক্রিয় ATR স্প্রেড ফিল্টার পাস (ফ্ল্যাট ডেড জোন নয়)',
        bearCondition: 'সক্রিয় ATR স্প্রেড ফিল্টার পাস (ফ্ল্যাট ডেড জোন নয়)',
      },
      {
        title: '3. FX RSI Directional Bias',
        bullCondition: 'RSI (14) > 51 ও < 72 (বুলিশ স্ট্রাকচার শক্তি)',
        bearCondition: 'RSI (14) < 49 ও > 28 (বিয়ারিশ স্ট্রাকচার শক্তি)',
      },
      {
        title: '4. MACD Institutional Flow',
        bullCondition: 'MACD > Signal ও পজিটিভ মোমেন্টাম',
        bearCondition: 'MACD < Signal ও নেগেটিভ মোমেন্টাম',
      },
      {
        title: '5. Clean Rejection / BOS Candle',
        bullCondition: 'বুলিশ ক্লোজ (Close > Open) ও সাপোর্টে বাউন্স',
        bearCondition: 'বিয়ারিশ ক্লোজ (Close < Open) ও রেজিস্ট্যান্সে রিজেকশন',
      },
    ],
  },
  COMMODITY_INDEX: {
    id: 'COMMODITY_INDEX',
    shortLabel: 'Gold & Index',
    labelBn: 'Gold & Index',
    platformsExample: 'Gold (XAU/USD), NASDAQ, US30, S&P500',
    outputMode: 'SPOT_SL_TP',
    buyLabel: 'BUY / UP',
    sellLabel: 'SELL / DOWN',
    defaultTimeframeLabel: '5m - 15m',
    suggestedTargetText: 'Momentum Breakout (SL / TP)',
    summaryBn: 'গোল্ড ও ইনডেক্সের দ্রুত মুভমেন্টের জন্য ভলাটিলিটি ব্রেকআউট, মোমেন্টাম বডি ও প্রটেক্টিভ উইক ফিল্টার।',
    noTradeFilterBn: 'হাই-ইমপ্যাক্ট নিউজ স্পাইক ও অতিরিক্ত লম্বা উভয়-দিকের উইক ক্যান্ডেল ফিল্টার।',
    aiFocusBn: 'XAU/USD ও ইনডেক্সের সেশন ওপেন ব্রেকআউট, ডিপ পুলব্যাক রিটেস্ট ও রিস্ক ম্যানেজড SL/TP।',
    rules: [
      {
        title: '1. Fast Momentum EMA Slope',
        bullCondition: 'EMA 9 > EMA 21 ও ক্লোজ উভয় EMA-এর উপরে',
        bearCondition: 'EMA 9 < EMA 21 ও ক্লোজ উভয় EMA-এর নিচে',
      },
      {
        title: '2. Breakout Expansion Range',
        bullCondition: 'ক্যান্ডেলের রেঞ্জ ও বডি শক্তিশালী (স্প্রেড ট্র্যাপ নয়)',
        bearCondition: 'ক্যান্ডেলের রেঞ্জ ও বডি শক্তিশালী (স্প্রেড ট্র্যাপ নয়)',
      },
      {
        title: '3. RSI Trend Thrust',
        bullCondition: 'RSI (14) > 53 (আগ্রেসিভ বায়ার্স মোমেন্টাম)',
        bearCondition: 'RSI (14) < 47 (আগ্রেসিভ সেলার্স মোমেন্টাম)',
      },
      {
        title: '4. MACD Momentum Confirmation',
        bullCondition: 'MACD > Signal এবং হিস্টোগ্রাম > 0',
        bearCondition: 'MACD < Signal এবং হিস্টোগ্রাম < 0',
      },
      {
        title: '5. Bollinger Dynamic Trend Push',
        bullCondition: 'প্রাইস Bollinger মিডলের উপরে শক্তিশালী বুলিশ ক্লোজ',
        bearCondition: 'প্রাইস Bollinger মিডলের নিচে শক্তিশালী বিয়ারিশ ক্লোজ',
      },
    ],
  },
};

export const TRADING_PROFILE_LIST: TradingProfileConfig[] = [
  TRADING_PROFILES.BINARY_OTC,
  TRADING_PROFILES.BINARY_LIVE,
  TRADING_PROFILES.CRYPTO_SPOT,
  TRADING_PROFILES.FOREX,
  TRADING_PROFILES.COMMODITY_INDEX,
];

export function isValidTradingProfileId(val: unknown): val is TradingProfileId {
  return typeof val === 'string' && val in TRADING_PROFILES;
}

export function getTradingProfile(id?: TradingProfileId | null): TradingProfileConfig {
  if (id && isValidTradingProfileId(id)) {
    return TRADING_PROFILES[id];
  }
  return TRADING_PROFILES.BINARY_OTC;
}
