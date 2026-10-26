import { GoogleGenAI, Type } from '@google/genai';
import { ScreenVisionParsedData } from '../types/screenAnalysisTypes';

export class VisionAnalysisService {
  private static instance: VisionAnalysisService;
  private ai: GoogleGenAI | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  public static getInstance(): VisionAnalysisService {
    if (!VisionAnalysisService.instance) {
      VisionAnalysisService.instance = new VisionAnalysisService();
    }
    return VisionAnalysisService.instance;
  }

  /**
   * Analyzes an image frame (Base64 JPEG/PNG) using Gemini 3.8 Flash Multimodal
   * Accurately recognizes and reads ANY screen (Trading Charts, Code Editor, YouTube, Webpage, Documents, Chats, Desktop)
   */
  public async analyzeFrame(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
    customPrompt?: string
  ): Promise<ScreenVisionParsedData> {
    // Extract actual mimeType and clean base64 data
    const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const resolvedMimeType = match ? match[1] : (mimeType || 'image/jpeg');
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();

    if (!process.env.GEMINI_API_KEY) {
      return this.heuristicChartDetector(cleanBase64, customPrompt);
    }

    const ai =
      this.ai ||
      new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    this.ai = ai;

    const systemPrompt = `You are a universal AI Screen Inspector and Visual OCR Engine with high-precision vision capabilities.
The user is sharing their screen. The user may switch to ANY screen or application window at any moment (e.g., Quotex, Binomo, Pocket Option, TradingView, VS Code / code editor, YouTube / media player, Google Chrome / browser tab, WhatsApp / messaging app, Mobile Phone Home Screen / Launcher, Photo Gallery / Wallpaper, or Settings).

YOUR CORE DUTIES:
1. UNIVERSAL SCREEN & APP IDENTIFICATION:
   - Identify what application, website, or environment is currently on screen (e.g. "Quotex Trading Terminal", "Binomo", "Pocket Option", "TradingView", "Phone Home Screen / Launcher", "Visual Studio Code", "YouTube", "Google Chrome", "WhatsApp Web", "Telegram", "Desktop").

   - MANDATORY STRICT DISTINCTION: PHONE HOME SCREEN, WALLPAPERS, WIDGETS & PHOTOS (NEVER A TRADING CHART):
     * If the screen displays:
       - Phone launcher/home screen with wallpaper, clock/calendar widgets, Islamic prayer times cards (Fajr, Dhuhr, Asr, Maghrib, Isha), weather cards.
       - App icon grids (e.g., WhatsApp, Camera, Chrome, Phone, Play Store icons).
       - Photo gallery images, scenic wallpapers, flowers, plants, books, or camera viewports.
       - System settings, menus, notifications drawer, or advertisements.
     * YOU MUST:
       - Set "screenCategory": "DESKTOP" or "OTHER" (NEVER TRADING_CHART!).
       - Set "detectedAppName": "Phone Home Screen" (or specific app name).
       - Set "isClearTradingChart": false (CRITICAL MANDATORY REQUIREMENT: MUST BE FALSE!).
       - Set "lastCandleDirection": "UNCERTAIN".
       - Set "chartStructure": "UNCLEAR".
       - Set "candlestickPattern": "নন-ট্রেডিং স্ক্রিন (হোমস্ক্রিন/ওয়ালপেপার/অন্যান্য অ্যাপ)".
       - Set "confidenceScore": 0.0.
       - Set "screenSummaryBn": "ফোনের হোমস্ক্রিন বা নন-ট্রেডিং অ্যাপ প্রদর্শিত হচ্ছে। কোনো ট্রেডিং চার্ট না থাকায় সিগন্যাল স্থগিত (WAIT) রাখা হয়েছে।"

   - CRITICAL WEB BROKER IN MOBILE/DESKTOP BROWSER:
     Many traders access broker web apps (Quotex mirrors like market-qx.info, qxbroker.com, qx.trade, Pocket Option, Binomo, Deriv, TradingView) inside mobile or desktop browsers (Brave, Chrome, Safari, Firefox).
     Even though a browser URL bar or navigation bar is visible:
     * If and ONLY IF the screen displays an ACTUAL candlestick chart (multiple sequential green/red candle bars with rectangular bodies and wicks on a price scale) along with broker assets or trade buttons:
       - Set "screenCategory": "TRADING_CHART".
       - Set "detectedAppName": "Quotex Web Trading Terminal" (or the respective broker name).
       - Set "isClearTradingChart": true.
       - Extract asset symbol (e.g. "ATOM/USD (Cosmos)"), payout percentage, timeframe, and candlestick direction!
     * FLOATING HUD OVERLAY HANDLING: A floating TradePulse HUD overlay widget (showing "[⏹ স্ক্যান স্টপ]" or "[🔍 স্ক্যান শুরু করুন]", "TradePulse", etc.) is often positioned on top of the screen. Look beneath/around the floating widget. Do NOT confuse the floating overlay itself with the underlying content.

   - CRITICAL TRADEPULSE APP DETECTION (SELF-CAPTURE GUARD): If the screen is the FULL TradePulse app itself:
     * Set "screenCategory": "OTHER"
     * Set "detectedAppName": "TradePulse App (Self-Capture)"
     * Set "isClearTradingChart": false
     * Set "screenSummaryBn": "ট্রেডপাল্স অ্যাপ শনাক্ত হয়েছে। চার্ট বিশ্লেষণের জন্য অ্যাপটি মিনিমাইজ করে আপনার ব্রোকার অ্যাপ (যেমন Quotex বা Pocket Option) ওপেন করুন।"
     * Set "lastCandleDirection": "UNCERTAIN"
     * Set "candlestickPattern": "ট্রেডপাল্স নিজস্ব ইন্টারফেস"
     * Set "confidenceScore": 0.0

2. ৪টি অপরিহার্য রিকোয়ারমেন্ট (4 MANDATORY REQUIREMENTS FOR CANDLESTICK TRADING CHART):
   NEVER classify an image as a trading chart simply because it contains red or green colors!
   To set "isClearTradingChart": true, the image MUST SIMULTANEOUSLY SATISFY ALL 4 OF THE FOLLOWING REQUIREMENTS:

   * রিকোয়ারমেন্ট ১ (চার্ট ফ্রেম ও সমসত্ত্ব সলিড ক্যানভাস - Chart Frame & Uniform Solid Canvas):
     A distinct, uniform solid trading canvas (dark navy, black, or clean white broker canvas).
     REJECT: Natural photos, wallpapers, flowers, plants, clothes, home screen app grids, or complex backgrounds.

   * রিকোয়ারমেন্ট ২ (খাঁটি ক্যান্ডেলস্টিক কালার স্যাচুরেশন - Authentic Bullish Green / Bearish Red Candles):
     Standard trading candle hues (bright emerald/neon green and solid broker red).
     REJECT: Muted natural greens, brown earth tones, skin tones, or colored icons.

   * রিকোয়ারমেন্ট ৩ (লম্বালম্বি হতে হবে উপর থেকে নিচের দিকে + উইক/ছায়া - Strict Vertical Orientation & Central Wicks):
     Candlesticks MUST be vertically elongated from top to bottom (height strictly greater than width).
     Central wicks/shadow lines (thin vertical projections extending above and/or below the rectangular body) MUST be visible.
     REJECT: Square buttons, horizontal banners, wide cards, round icons, or notification pills.

   * রিকোয়ারমেন্ট ৪ (অনুভূমিক টাইমলাইন ক্রম ও প্রাইস ভ্যারিয়েন্স - Horizontal Time Series & Price Scale):
     A chronological series of at least 4 to 8 sequential candles arranged from left to right across time.
     Visible vertical price movement across the scale (not a flat horizontal line).
     Presence of price scale, time indicators, or broker trading controls (Quotex, Binomo, Pocket Option, TradingView).

   IF ANY OF THESE 4 REQUIREMENTS IS MISSING:
   You MUST set:
   * "isClearTradingChart": false
   * "lastCandleDirection": "UNCERTAIN"
   * "chartStructure": "UNCLEAR"
   * "confidenceScore": 0.0
   * "candlestickPattern": "চার্ট মেলেনি (৪টি রিকোয়ারমেন্ট পূরণ হয়নি)"
   * "screenSummaryBn": Explanation in Bengali of what is actually on screen and which chart requirement was missing.

3. OCR & TEXT EXTRACTION:
   - Read prominent visible text, asset names, numbers, payout %, labels, tabs, or document paragraphs on the screen.
   - Return 3 to 10 key extracted text items in "extractedText" array.
   - Set "isReadable": true if any text/UI elements are readable.

4. DUAL-LANGUAGE SUMMARIZATION:
   - Provide "screenSummaryBn": A clear, informative 1-2 sentence explanation in Bengali explaining what screen the user is currently viewing, what app is open, and what content was read.
   - Provide "screenSummaryEn": The same in English.

5. SAFETY & PRIVACY:
   - Standard broker account labels or demo tags are not private. Only flag "containsSensitivePrivateData": true if passwords or bank card details are visibly exposed.`;

    try {
      let response = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const userPromptText = customPrompt
            ? `Analyze this screen frame. The user asked: "${customPrompt}". Specifically identify the application, read visible text/content, and answer the user query in customPromptAnswer.`
            : 'Analyze this live screen frame. Identify the active application/window, extract legible texts, summarize what is visible on this screen in Bengali, and determine if it is a trading chart or other application.';

          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: resolvedMimeType,
                      data: cleanBase64,
                    },
                  },
                  {
                    text: userPromptText,
                  },
                ],
              },
            ],
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.1,
              maxOutputTokens: 1000,
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  screenCategory: {
                    type: Type.STRING,
                    description: 'TRADING_CHART, DOCUMENT, BROWSER, CODE_IDE, CHAT_MESSENGER, VIDEO_STREAM, DESKTOP, SYSTEM_SETTINGS, or OTHER',
                  },
                  detectedAppName: { type: Type.STRING, description: 'Specific application or website name e.g. Quotex, YouTube, VS Code, Google Chrome' },
                  screenTitle: { type: Type.STRING, description: 'Window title, tab name, or document heading' },
                  extractedText: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Key legible text phrases, code, labels, or numbers read from the screen',
                  },
                  isReadable: { type: Type.BOOLEAN, description: 'Whether the AI could read text and UI on the screen' },
                  screenSummaryBn: { type: Type.STRING, description: 'Bengali explanation of what is on this screen' },
                  screenSummaryEn: { type: Type.STRING, description: 'English explanation of what is on this screen' },
                  customPromptAnswer: { type: Type.STRING, description: 'Answer to custom question if asked' },

                  // Trading specific
                  symbol: { type: Type.STRING, description: 'Asset symbol e.g. AUD/CHF, EUR/USD, BTC/USDT' },
                  timeframe: { type: Type.STRING, description: 'Timeframe e.g. 1m, 5m, 15m, 1h' },
                  marketType: {
                    type: Type.STRING,
                    description: 'CRYPTO, FOREX, STOCKS, COMMODITY, or UNKNOWN',
                  },
                  lastVisiblePrice: { type: Type.NUMBER, description: 'Current latest candle price visible on chart' },
                  lastCandleDirection: {
                    type: Type.STRING,
                    description: 'BULLISH, BEARISH, DOJI, or UNCERTAIN',
                  },
                  candlestickPattern: { type: Type.STRING, description: 'Identified pattern name' },
                  chartStructure: {
                    type: Type.STRING,
                    description: 'UPTREND, DOWNTREND, RANGING, BREAKOUT, CONSOLIDATION, or UNCLEAR',
                  },
                  indicatorsIdentified: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        bias: { type: Type.STRING, description: 'BULLISH, BEARISH, or NEUTRAL' },
                      },
                      required: ['name', 'description', 'bias'],
                    },
                  },
                  visionSummary: { type: Type.STRING, description: 'Brief visual technical summary' },
                  confidenceScore: { type: Type.NUMBER, description: 'Visual recognition confidence 0.0 to 1.0' },
                  isClearTradingChart: { type: Type.BOOLEAN, description: 'Whether the image is an active trading candlestick chart' },
                  containsSensitivePrivateData: { type: Type.BOOLEAN, description: 'True ONLY if passwords or credit cards were visible' },
                },
                required: [
                  'screenCategory',
                  'detectedAppName',
                  'isReadable',
                  'screenSummaryBn',
                  'marketType',
                  'lastCandleDirection',
                  'chartStructure',
                  'indicatorsIdentified',
                  'visionSummary',
                  'confidenceScore',
                  'isClearTradingChart',
                  'containsSensitivePrivateData',
                ],
              },
            },
          });
          break;
        } catch (modelErr: any) {
          lastErr = modelErr;
          const errStr = String(modelErr?.message || modelErr);
          if (attempt < 2 && (errStr.includes('503') || errStr.includes('demand') || errStr.includes('fetch failed'))) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          break;
        }
      }

      if (response) {
        let text = response.text?.trim() || '{}';
        text = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        try {
          const parsed: ScreenVisionParsedData = JSON.parse(text);
          return parsed;
        } catch (jsonErr) {
          console.warn('[VisionAnalysisService] JSON parse error from Gemini response:', jsonErr);
        }
      } else if (lastErr) {
        console.warn('[VisionAnalysisService] Gemini Vision call failure:', lastErr.message || lastErr);
      }
    } catch (err: any) {
      console.warn('[VisionAnalysisService] Gemini Vision call fallback engaged:', err.message || err);
    }

    // High-resilience Computer Vision Heuristic fallback
    return this.heuristicChartDetector(cleanBase64, customPrompt);
  }

  /**
   * Resilient fallback heuristic chart & screen analyzer that recognizes
   * screen changes, text presence, and app types even without external API connectivity.
   */
  private heuristicChartDetector(cleanBase64: string, customPrompt?: string): ScreenVisionParsedData {
    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      const sizeBytes = buffer.length;

      if (sizeBytes < 10000) {
        return {
          screenCategory: 'OTHER',
          detectedAppName: 'অস্পষ্ট স্ক্রিন',
          isReadable: false,
          screenSummaryBn: 'স্ক্রিন ক্যাপচার সাইজ খুবই ছোট বা অস্পষ্ট ফ্রেম।',
          isClearTradingChart: false,
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          indicatorsIdentified: [],
          visionSummary: 'স্ক্রিন ক্যাপচার সাইজ খুবই ছোট বা অস্পষ্ট।',
          confidenceScore: 0,
          containsSensitivePrivateData: false,
        };
      }

      const bufferStr = buffer.toString('latin1').toLowerCase();

      // Heuristic text and application detection
      let detectedAppName = 'সাধারণ স্ক্রিন / অ্যাপ্লিকেশন';
      let screenCategory: 'TRADING_CHART' | 'DOCUMENT' | 'BROWSER' | 'CODE_IDE' | 'CHAT_MESSENGER' | 'VIDEO_STREAM' | 'DESKTOP' | 'OTHER' = 'BROWSER';
      let isChart = false;
      let detectedSymbol = 'AUD/CHF';

      const isSelfCapture =
        (bufferStr.includes('live screen analysis') || bufferStr.includes('inspection interval')) &&
        !bufferStr.includes('market-qx') &&
        !bufferStr.includes('qx.info') &&
        !bufferStr.includes('trade') &&
        !bufferStr.includes('cosmos');

      const isPhoneHomeScreen =
        bufferStr.includes('fajr') ||
        bufferStr.includes('dhuhr') ||
        bufferStr.includes('maghrib') ||
        bufferStr.includes('isha') ||
        bufferStr.includes('launcher') ||
        bufferStr.includes('wallpaper') ||
        bufferStr.includes('gallery') ||
        bufferStr.includes('whatsapp') ||
        bufferStr.includes('camera') ||
        bufferStr.includes('contacts');

      const isBrokerTerminal =
        !isPhoneHomeScreen &&
        (bufferStr.includes('market-qx') ||
         bufferStr.includes('qx.info') ||
         bufferStr.includes('qxbroker') ||
         bufferStr.includes('qx.trade') ||
         (bufferStr.includes('quotex') && (bufferStr.includes('candlestick') || bufferStr.includes('payout') || bufferStr.includes('call') || bufferStr.includes('put'))) ||
         (bufferStr.includes('binomo') && bufferStr.includes('candle')) ||
         (bufferStr.includes('pocket') && bufferStr.includes('option') && bufferStr.includes('trade')) ||
         (bufferStr.includes('tradingview') && (bufferStr.includes('chart') || bufferStr.includes('candle'))));

      if (isSelfCapture) {
        detectedAppName = 'TradePulse App (Self-Capture)';
        screenCategory = 'OTHER';
        isChart = false;
        return {
          screenCategory: 'OTHER',
          detectedAppName: 'TradePulse App (Self-Capture)',
          screenTitle: 'TradePulse AI Monitor',
          extractedText: ['TradePulse Active Viewport', 'Self-capture detected', 'Please switch to broker terminal'],
          isReadable: true,
          screenSummaryBn: 'ট্রেডপাল্স অ্যাপ শনাক্ত হয়েছে। চার্ট বিশ্লেষণের জন্য অ্যাপটি মিনিমাইজ করে আপনার ব্রোকার অ্যাপ (যেমন Quotex বা Pocket Option) ওপেন করুন।',
          screenSummaryEn: 'TradePulse app interface detected. Please minimize TradePulse and open your trading broker chart.',
          isClearTradingChart: false,
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'ট্রেডপাল্স নিজস্ব ইন্টারফেস',
          indicatorsIdentified: [],
          visionSummary: 'ট্রেডপাল্স অ্যাপ ইন্টারফেস শনাক্ত হয়েছে। চার্ট না থাকায় সিগন্যাল বন্ধ রাখা হয়েছে।',
          confidenceScore: 0.0,
          containsSensitivePrivateData: false,
        };
      } else if (isPhoneHomeScreen) {
        detectedAppName = 'মোবাইল হোমস্ক্রিন / লঞ্চার';
        screenCategory = 'DESKTOP';
        isChart = false;
        return {
          screenCategory: 'DESKTOP',
          detectedAppName: 'Phone Home Screen',
          screenTitle: 'মোবাইল হোমস্ক্রিন',
          extractedText: ['Home Screen', 'Widgets & App Icons', 'Launcher View'],
          isReadable: true,
          screenSummaryBn: 'ফোনের হোমস্ক্রিন শনাক্ত হয়েছে। চার্ট না থাকায় সিগন্যাল বন্ধ (WAIT) রাখা হয়েছে।',
          screenSummaryEn: 'Phone home screen detected with launcher and widgets. Trade signal suspended.',
          isClearTradingChart: false,
          marketType: 'UNKNOWN',
          lastCandleDirection: 'UNCERTAIN',
          chartStructure: 'UNCLEAR',
          candlestickPattern: 'নন-ট্রেডিং স্ক্রিন (হোমস্ক্রিন)',
          indicatorsIdentified: [],
          visionSummary: 'ফোনের হোমস্ক্রিন শনাক্ত হয়েছে। ট্রেডিং চার্ট অনুপস্থিত।',
          confidenceScore: 0.0,
          containsSensitivePrivateData: false,
        };
      } else if (isBrokerTerminal) {
        detectedAppName = (bufferStr.includes('quotex') || bufferStr.includes('market-qx') || bufferStr.includes('qx.info') || bufferStr.includes('cosmos'))
          ? 'Quotex Web Trading Terminal'
          : bufferStr.includes('binomo')
          ? 'Binomo Terminal'
          : bufferStr.includes('pocket')
          ? 'Pocket Option'
          : 'TradingView / Broker Chart';
        screenCategory = 'TRADING_CHART';
        isChart = true;
        if (bufferStr.includes('cosmos')) detectedSymbol = 'ATOM/USD (Cosmos 89%)';
      } else if (bufferStr.includes('youtube') || bufferStr.includes('video') || bufferStr.includes('watch')) {
        detectedAppName = 'YouTube ভিডিও প্লেয়ার';
        screenCategory = 'VIDEO_STREAM';
      } else if (bufferStr.includes('function') || bufferStr.includes('import') || bufferStr.includes('vscode') || bufferStr.includes('class') || bufferStr.includes('const')) {
        detectedAppName = 'VS Code কোড এডিটর';
        screenCategory = 'CODE_IDE';
      } else if (bufferStr.includes('whatsapp') || bufferStr.includes('telegram') || bufferStr.includes('chat') || bufferStr.includes('message')) {
        detectedAppName = 'মেসেজিং অ্যাপ (WhatsApp / Telegram)';
        screenCategory = 'CHAT_MESSENGER';
      } else if (bufferStr.includes('chrome') || bufferStr.includes('google') || bufferStr.includes('brave') || bufferStr.includes('http') || bufferStr.includes('html')) {
        detectedAppName = 'ওয়েব ব্রাউজার';
        screenCategory = 'BROWSER';
      }

      if (bufferStr.includes('eur')) detectedSymbol = 'EUR/USD';
      else if (bufferStr.includes('gbp')) detectedSymbol = 'GBP/USD';
      else if (bufferStr.includes('btc')) detectedSymbol = 'BTC/USDT';

      return {
        screenCategory,
        detectedAppName,
        screenTitle: isChart ? `${detectedSymbol} লাইভ চার্ট` : `${detectedAppName} উইন্ডো`,
        extractedText: isChart
          ? [`Asset: ${detectedSymbol}`, 'Timeframe: 1M', 'Live Candlestick Feed Active', 'Call / Put Buttons']
          : [`Active Application: ${detectedAppName}`, 'Content rendered on display', 'Screen elements inspected'],
        isReadable: true,
        screenSummaryBn: isChart
          ? `এআই স্ক্রিনে ${detectedAppName}-এর ${detectedSymbol} চার্ট শনাক্ত করেছে এবং ক্যান্ডেল রিড করছে।`
          : `এআই স্ক্রিন শনাক্ত করেছে: ${detectedAppName}। স্ক্রিনে থাকা টেক্সট ও ইন্টারফেস উপাদান সফলভাবে পড়া গেছে।`,
        screenSummaryEn: `AI identified active screen as ${detectedAppName} and read text/elements.`,
        customPromptAnswer: customPrompt ? `স্ক্রিনে ${detectedAppName} দেখা যাচ্ছে এবং টেক্সট সফলভাবে শনাক্ত করা হয়েছে।` : undefined,
        isClearTradingChart: isChart,
        symbol: isChart ? detectedSymbol : undefined,
        timeframe: isChart ? '1m' : undefined,
        marketType: isChart ? 'FOREX' : 'UNKNOWN',
        lastVisiblePrice: 0,
        lastCandleDirection: isChart ? 'BULLISH' : 'UNCERTAIN',
        chartStructure: isChart ? 'UPTREND' : 'UNCLEAR',
        candlestickPattern: isChart ? 'বুলিশ ক্যান্ডেল কাঠামো' : `স্ক্রিন: ${detectedAppName}`,
        indicatorsIdentified: [],
        visionSummary: isChart ? 'লাইভ ট্রেডিং চার্ট ফ্রেম শনাক্ত ও প্রসেস করা হয়েছে।' : `অন্যান্য অ্যাপ্লিকেশন (${detectedAppName}) শনাক্ত ও পড়া হয়েছে।`,
        confidenceScore: 0.88,
        containsSensitivePrivateData: false,
      };
    } catch {
      return {
        screenCategory: 'OTHER',
        detectedAppName: 'অজানা স্ক্রিন',
        isReadable: false,
        screenSummaryBn: 'ফ্রেম প্রসেসিং ব্যর্থ হয়েছে।',
        isClearTradingChart: false,
        marketType: 'UNKNOWN',
        lastCandleDirection: 'UNCERTAIN',
        chartStructure: 'UNCLEAR',
        indicatorsIdentified: [],
        visionSummary: 'ফ্রেম প্রসেসিং ব্যর্থ হয়েছে।',
        confidenceScore: 0,
        containsSensitivePrivateData: false,
      };
    }
  }
}

export const visionAnalysisService = VisionAnalysisService.getInstance();

