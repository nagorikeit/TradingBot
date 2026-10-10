import { GoogleGenAI, Type } from '@google/genai';
import { ScreenVisionParsedData } from '../types/screenAnalysisTypes';

export class VisionAnalysisService {
  private static instance: VisionAnalysisService;
  private ai: GoogleGenAI | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
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
   */
  public async analyzeFrame(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<ScreenVisionParsedData> {
    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    if (!process.env.GEMINI_API_KEY) {
      // Graceful fallback simulation if GEMINI_API_KEY is not configured
      return {
        isClearTradingChart: false,
        marketType: 'UNKNOWN',
        lastCandleDirection: 'UNCERTAIN',
        chartStructure: 'UNCLEAR',
        indicatorsIdentified: [],
        visionSummary: 'GEMINI_API_KEY is not configured in server environment.',
        confidenceScore: 0,
        containsSensitivePrivateData: false,
      };
    }

    const ai = this.ai || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.ai = ai;

    const systemPrompt = `You are a financial chart visual inspector.
Your sole job is to inspect the provided screen capture of a trading chart and extract structured technical details.
CRITICAL SAFETY & PRIVACY RULES:
1. NEVER output or log account balances, portfolio balances, wallet addresses, user IDs, or login credentials. If such text is visible in the frame, set "containsSensitivePrivateData": true and completely omit those numbers from the output.
2. Only focus on the candlestick/price chart, asset symbol, timeframe, visible indicators (RSI, Moving Averages, MACD, Bollinger Bands), and visible price axis.
3. If the image is not a trading chart or is illegible, set "isClearTradingChart": false.
4. Normalize symbol names to standard uppercase with or without slash (e.g. BTC/USDT, ETHUSDT, EURUSD, XAUUSD).
5. Normalize timeframe (e.g. 1m, 5m, 15m, 30m, 1h, 4h, 1D).`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: 'Inspect this live trading chart screen capture. Extract symbol, timeframe, market type, current visible price, last candle bias, visible indicators, chart trend structure, and candlestick patterns in JSON.',
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              symbol: { type: Type.STRING, description: 'Asset symbol e.g. BTC/USDT or EURUSD' },
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
              candlestickPattern: { type: Type.STRING, description: 'Identified pattern name if any' },
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
              keyLevels: {
                type: Type.OBJECT,
                properties: {
                  support: { type: Type.NUMBER },
                  resistance: { type: Type.NUMBER },
                },
              },
              visionSummary: { type: Type.STRING, description: 'Brief 1-2 sentence visual technical summary' },
              confidenceScore: { type: Type.NUMBER, description: 'Visual recognition confidence 0.0 to 1.0' },
              isClearTradingChart: { type: Type.BOOLEAN, description: 'Whether the image is a legible trading chart' },
              containsSensitivePrivateData: { type: Type.BOOLEAN, description: 'True if personal balances or IDs were visible' },
            },
            required: [
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

      const text = response.text?.trim() || '{}';
      const parsed: ScreenVisionParsedData = JSON.parse(text);
      return parsed;
    } catch (err: any) {
      console.error('[VisionAnalysisService] Gemini Vision analysis error:', err);
      return {
        isClearTradingChart: false,
        marketType: 'UNKNOWN',
        lastCandleDirection: 'UNCERTAIN',
        chartStructure: 'UNCLEAR',
        indicatorsIdentified: [],
        visionSummary: `Vision analysis failed: ${err.message || 'Unknown error'}`,
        confidenceScore: 0,
        containsSensitivePrivateData: false,
      };
    }
  }
}

export const visionAnalysisService = VisionAnalysisService.getInstance();
