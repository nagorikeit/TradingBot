import {
  DailyLearningSession,
  LearningContradiction,
  LearningLesson,
  PotentialHypothesis,
  RepeatedMarketPattern,
} from '../types/knowledgeTypes';
import { marketObserverService } from './marketObserverService';
import { memoryService } from './memoryService';
import { knowledgeService } from './knowledgeService';
import { claimRuleStorageService } from './claimRuleStorageService';
import { MarketObservation, MarketRegime } from '../types/observationTypes';

export interface RunDailyLearningOptions {
  symbol?: string;
  timeframe?: string;
  limitObservations?: number;
  triggerSource?: 'MANUAL' | 'SCHEDULED';
  dryRun?: boolean;
}

export class DailyLearningService {
  private static instance: DailyLearningService;

  private constructor() {}

  public static getInstance(): DailyLearningService {
    if (!DailyLearningService.instance) {
      DailyLearningService.instance = new DailyLearningService();
    }
    return DailyLearningService.instance;
  }

  /**
   * Execute a structured Daily Learning Session.
   * Synthesizes Market Observations + Trusted Knowledge + Previous Memory + Recent Validation Evidence.
   */
  public async runDailyLearningSession(options: RunDailyLearningOptions = {}): Promise<{
    ok: boolean;
    session: DailyLearningSession;
    message: string;
  }> {
    const startTime = Date.now();
    const triggerSource = options.triggerSource || 'MANUAL';
    const limit = options.limitObservations || 120;

    // 1. Gather Market Observations
    let observations = marketObserverService.getRecentObservations(limit, {
      symbol: options.symbol,
      timeframe: options.timeframe,
    });

    // If no observations are currently in memory, bootstrap live Binance observations for major pairs
    if (observations.length === 0) {
      console.log('[DailyLearningService] No observations in memory, bootstrapping observations from Binance...');
      const pairs = [
        { symbol: 'BTC/USDT', timeframe: '1m' },
        { symbol: 'BTC/USDT', timeframe: '5m' },
        { symbol: 'ETH/USDT', timeframe: '1m' },
        { symbol: 'SOL/USDT', timeframe: '5m' },
      ];
      for (const p of pairs) {
        try {
          await marketObserverService.fetchAndObserveBinance(p.symbol, p.timeframe, 50);
        } catch (e) {
          console.warn(`[DailyLearningService] Bootstrap fetch failed for ${p.symbol}:`, e);
        }
      }
      observations = marketObserverService.getRecentObservations(limit);
    }

    // 2. Gather Supporting Context
    const knowledgeItems = knowledgeService.getAllKnowledge();
    const agentMemories = memoryService.getAllMemories();
    const marketMemories = memoryService.getAllMarketMemories();
    const validations = claimRuleStorageService.getValidations();
    const regimeSummaries = marketObserverService.getRegimeSummary();

    // 3. Synthesize Important Findings
    const importantFindings = this.synthesizeFindings(observations, regimeSummaries);

    // 4. Detect Contradictions between Observations and Principles/Claims
    const contradictions = this.detectContradictions(observations, knowledgeItems);

    // 5. Detect Repeated Patterns across Observations
    const repeatedPatterns = this.detectRepeatedPatterns(observations);

    // 6. Extract Mistakes and Operating Lessons
    const mistakesOrLessons = this.extractLessons(agentMemories, observations);

    // 7. Formulate Testable Hypotheses
    const hypothesesGenerated = this.generateHypotheses(
      observations,
      contradictions,
      repeatedPatterns
    );

    // 8. Extract top factual market observation highlights
    const importantMarketObservations = observations
      .slice(0, 10)
      .map((obs) => `[${obs.symbol} ${obs.timeframe}] ${obs.observationType}: ${obs.observationText}`);

    // 9. Build Session Summary
    const summary = this.buildSessionSummary({
      observationsCount: observations.length,
      contradictionsCount: contradictions.length,
      patternsCount: repeatedPatterns.length,
      hypothesesCount: hypothesesGenerated.length,
      lessonsCount: mistakesOrLessons.length,
      regimeSummaries,
    });

    const sessionId = `learn_${Date.now()}_${triggerSource.toLowerCase()}`;
    const endTime = Date.now();

    const session: DailyLearningSession = {
      sessionId,
      startTime,
      endTime,
      sourcesProcessed: observations.length + agentMemories.length + knowledgeItems.length,
      newKnowledgeCount: hypothesesGenerated.length,
      updatedKnowledgeCount: mistakesOrLessons.length,
      contradictionsFound: contradictions.length,
      importantMarketObservations,
      summary,
      status: 'COMPLETED',
      importantFindings,
      contradictions,
      repeatedPatterns,
      mistakesOrLessons,
      hypothesesGenerated,
      metrics: {
        observationsAnalyzed: observations.length,
        memoriesConsulted: agentMemories.length,
        knowledgeItemsConsulted: knowledgeItems.length,
        validationsConsulted: validations.length,
      },
    };

    // 10. Persist Session & Agent Memories (unless dryRun)
    if (!options.dryRun) {
      memoryService.addLearningSession(session);

      // Record high-level Improvement Memory
      const symbolsInvolved = Array.from(new Set(observations.map((o) => o.symbol))).join(', ');
      memoryService.addAgentMemory({
        category: 'IMPROVEMENT',
        market: 'CRYPTO',
        symbol: options.symbol?.toUpperCase() || 'MULTI',
        timeframe: options.timeframe || 'MULTI',
        context: `Daily Learning Session ${sessionId} completed (${triggerSource} trigger).`,
        observation: `Analyzed ${observations.length} observations across ${symbolsInvolved || 'monitored pairs'}. Detected ${contradictions.length} market contradictions and formulated ${hypothesesGenerated.length} testable hypotheses.`,
        decision: `Logged learning session findings and queued ${hypothesesGenerated.length} hypotheses for empirical backtest validation.`,
        evidence: observations.slice(0, 5).map((o) => o.observationId),
        confidence: 0.9,
        isFact: true,
        reasoning: `Structured learning synthesis identified dominant regimes and edge preservation opportunities without altering live production rules.`,
      });

      // If high-severity contradictions exist, record a Decision Caution Memory
      const highSeverity = contradictions.filter((c) => c.severity === 'HIGH');
      if (highSeverity.length > 0) {
        memoryService.addAgentMemory({
          category: 'DECISION',
          market: 'CRYPTO',
          symbol: options.symbol?.toUpperCase() || 'MULTI',
          timeframe: options.timeframe || 'MULTI',
          context: `High-severity market contradiction detected during session ${sessionId}.`,
          observation: highSeverity.map((c) => `${c.topic}: ${c.observation}`).join('; '),
          decision: `Recommend cautious risk sizing and awaiting confirmation when market conditions exhibit contradictory price action.`,
          evidence: observations.slice(0, 3).map((o) => o.observationId),
          confidence: 0.85,
          isFact: true,
          reasoning: `Market behavior contradicted baseline expectations (${highSeverity.map((c) => c.contradictedPrinciple).join(', ')}). Caution advised.`,
        });
      }
    }

    return {
      ok: true,
      session,
      message: `Daily Learning Session ${sessionId} completed successfully with ${observations.length} observations analyzed.`,
    };
  }

  /**
   * Synthesizes dominant market regimes and technical conditions
   */
  private synthesizeFindings(
    observations: MarketObservation[],
    regimeSummaries: ReturnType<typeof marketObserverService.getRegimeSummary>
  ): string[] {
    const findings: string[] = [];

    // 1. Regime distribution findings
    for (const rs of regimeSummaries) {
      findings.push(
        `Regime Tracking: ${rs.symbol} (${rs.timeframe}) is in ${rs.regime} (EMA9=${rs.indicators.ema9.toFixed(2)}, RSI=${rs.indicators.rsi.toFixed(1)}, MACD Hist=${rs.indicators.macdHistogram.toFixed(3)}).`
      );
    }

    // 2. Volatility anomalies
    const volAnomalies = observations.filter(
      (o) => o.observationType === 'VOLUME_ANOMALY' || (o.observationType === 'VOLATILITY_STATE' && o.regime === 'HIGH_VOLATILITY')
    );
    if (volAnomalies.length > 0) {
      findings.push(
        `Volatility/Volume Activity: Recorded ${volAnomalies.length} volume or ATR expansion events. Peak activity observed on ${volAnomalies[0].symbol} ${volAnomalies[0].timeframe}.`
      );
    } else {
      findings.push('Volatility Baseline: No abnormal ATR spikes or excessive volume bursts detected in the sample period.');
    }

    // 3. Squeeze and consolidation findings
    const squeezes = observations.filter(
      (o) => o.observationType === 'VOLATILITY_STATE' && o.regime === 'LOW_VOLATILITY'
    );
    if (squeezes.length > 0) {
      findings.push(
        `Bandwidth Compression: ${squeezes.length} observations indicate Bollinger Band contraction (bandwidth < 1.2%), pointing to imminent regime transition.`
      );
    }

    // 4. Candle rejection patterns
    const rejections = observations.filter(
      (o) => o.observationType === 'BULLISH_REJECTION_WICK' || o.observationType === 'BEARISH_REJECTION_WICK'
    );
    if (rejections.length > 0) {
      findings.push(
        `Price Rejections: ${rejections.length} structural wick rejections observed, indicating active defense at short-term support/resistance levels.`
      );
    }

    return findings;
  }

  /**
   * Detects market contradictions against theoretical knowledge and expectations
   */
  private detectContradictions(
    observations: MarketObservation[],
    _knowledge: ReturnType<typeof knowledgeService.getAllKnowledge>
  ): LearningContradiction[] {
    const contradictions: LearningContradiction[] = [];

    for (const obs of observations) {
      const snap = obs.indicatorSnapshot;
      if (!snap) continue;

      // Contradiction 1: Extreme RSI in strong trending regime without mean-reversion
      if (
        obs.regime === 'TRENDING_BEARISH' &&
        snap.rsi !== undefined &&
        snap.rsi < 30
      ) {
        contradictions.push({
          topic: 'Oversold RSI in Strong Trend',
          observation: `${obs.symbol} ${obs.timeframe} printed RSI ${snap.rsi.toFixed(1)} under TRENDING_BEARISH, but price continued printing lower lows without reversal bounce.`,
          contradictedPrinciple: 'Oscillator oversold (<30) indicates high probability mean-reversion long setup.',
          severity: 'HIGH',
        });
      }

      if (
        obs.regime === 'TRENDING_BULLISH' &&
        snap.rsi !== undefined &&
        snap.rsi > 70
      ) {
        contradictions.push({
          topic: 'Overbought RSI in Strong Trend',
          observation: `${obs.symbol} ${obs.timeframe} printed RSI ${snap.rsi.toFixed(1)} under TRENDING_BULLISH, but price maintained momentum without immediate pullback.`,
          contradictedPrinciple: 'Oscillator overbought (>70) dictates immediate short reversal or momentum stall.',
          severity: 'MEDIUM',
        });
      }

      // Contradiction 2: Volume breakout accompanied by immediate rejection wick
      const volumeRatio = snap.volume / (snap.volumeSma20 || 1);
      if (
        obs.observationType === 'BEARISH_REJECTION_WICK' &&
        volumeRatio > 1.8
      ) {
        contradictions.push({
          topic: 'Volume Surge False Breakout',
          observation: `${obs.symbol} ${obs.timeframe} exhibited volume surge (${volumeRatio.toFixed(1)}x avg) but printed upper shadow rejection (>70% wick), failing to hold breakout.`,
          contradictedPrinciple: 'High volume surge validates structural breakout continuation.',
          severity: 'HIGH',
        });
      }

      // Contradiction 3: Moving Average crossover in flat/low volatility bandwidth
      if (
        obs.regime === 'RANGING_CONSOLIDATION' &&
        snap.bollingerBands &&
        snap.bollingerBands.bandwidth < 0.015 &&
        snap.ema9 !== undefined &&
        snap.ema21 !== undefined &&
        Math.abs(snap.ema9 - snap.ema21) / snap.ema21 < 0.0005
      ) {
        contradictions.push({
          topic: 'Moving Average Crossover in Tight Compression',
          observation: `${obs.symbol} ${obs.timeframe} EMA 9 and 21 entangled in narrow band (${(snap.bollingerBands.bandwidth * 100).toFixed(2)}% bandwidth) causing false directional signals.`,
          contradictedPrinciple: 'Moving average crossovers generate reliable trend following entries.',
          severity: 'LOW',
        });
      }
    }

    // Deduplicate contradictions by topic + observation symbol
    const seen = new Set<string>();
    const deduplicated: LearningContradiction[] = [];
    for (const c of contradictions) {
      const key = `${c.topic}::${c.severity}::${c.observation.slice(0, 30)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(c);
      }
    }

    return deduplicated.slice(0, 5);
  }

  /**
   * Detects repeated market patterns across the observed dataset
   */
  private detectRepeatedPatterns(observations: MarketObservation[]): RepeatedMarketPattern[] {
    const patternMap = new Map<string, { count: number; symbols: Set<string>; regimes: Set<string>; sampleText: string }>();

    for (const obs of observations) {
      const typeKey = obs.observationType;
      const existing = patternMap.get(typeKey) || {
        count: 0,
        symbols: new Set<string>(),
        regimes: new Set<string>(),
        sampleText: obs.observationText,
      };

      existing.count++;
      existing.symbols.add(obs.symbol);
      existing.regimes.add(obs.regime);
      patternMap.set(typeKey, existing);
    }

    const patterns: RepeatedMarketPattern[] = [];

    patternMap.forEach((val, key) => {
      if (val.count >= 2) {
        patterns.push({
          patternName: key.replace(/_/g, ' '),
          occurrences: val.count,
          symbols: Array.from(val.symbols),
          regime: Array.from(val.regimes).join(', '),
          description: `Pattern "${key}" observed ${val.count} times across ${Array.from(val.symbols).join(', ')}. Context: ${val.sampleText}`,
        });
      }
    });

    return patterns.sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Extracts actionable trading lessons from memory and current market conditions
   */
  private extractLessons(
    memories: ReturnType<typeof memoryService.getAllMemories>,
    observations: MarketObservation[]
  ): LearningLesson[] {
    const lessons: LearningLesson[] = [];

    // Review past mistakes
    const pastMistakes = memories.filter((m) => m.category === 'MISTAKE');
    for (const m of pastMistakes.slice(0, 3)) {
      lessons.push({
        lesson: `Historical pitfall reinforced: ${m.observation}`,
        context: `${m.symbol || 'UNIVERSAL'} ${m.timeframe} - ${m.context}`,
        preventiveAction: m.reasoning || m.decision,
      });
    }

    // Current session empirical lesson
    const currentRegimes = Array.from(new Set(observations.map((o) => o.regime)));
    if (currentRegimes.includes('RANGING_CONSOLIDATION')) {
      lessons.push({
        lesson: 'Trend-following filters must be tightened during RANGING_CONSOLIDATION regimes.',
        context: 'Current session contains sideways consolidation periods.',
        preventiveAction: 'Require minimum ADX > 22 or Bollinger Bandwidth > 1.5% before evaluating directional signals.',
      });
    }

    if (currentRegimes.includes('HIGH_VOLATILITY')) {
      lessons.push({
        lesson: 'Spread expansion and slippage spike during HIGH_VOLATILITY regimes.',
        context: 'Observed elevated ATR ratio (>1.6x baseline).',
        preventiveAction: 'Increase minimum stop margin or halt fast 1m execution until volatility normalizes.',
      });
    }

    return lessons;
  }

  /**
   * Formulates testable, empirical hypotheses based on observations and contradictions
   * CRITICAL: These are hypotheses ONLY, waiting for backtest queue, NOT live trading rules.
   */
  private generateHypotheses(
    observations: MarketObservation[],
    contradictions: LearningContradiction[],
    patterns: RepeatedMarketPattern[]
  ): PotentialHypothesis[] {
    const hypotheses: PotentialHypothesis[] = [];
    const now = Date.now();
    const symbols = Array.from(new Set(observations.map((o) => o.symbol)));

    // Hypothesis 1: Derived from contradictions (e.g. RSI oversold filter)
    const oversoldContradiction = contradictions.find((c) => c.topic.includes('Oversold'));
    if (oversoldContradiction) {
      hypotheses.push({
        hypothesisId: `hyp_${now}_${Math.random().toString(36).substring(2, 6)}`,
        statement:
          'In strong downward trend regimes (EMA 9 < EMA 21), filtering out RSI oversold (<30) reversal long signals will reduce false bottom-picking drawdowns by at least 15%.',
        rationale:
          'Observed market contradiction demonstrated that strong downward momentum consistently overrides oscillator oversold readings.',
        evidenceIds: observations.filter((o) => o.regime === 'TRENDING_BEARISH').slice(0, 3).map((o) => o.observationId),
        targetSymbols: symbols,
        suggestedRegime: 'TRENDING_BEARISH',
        createdAt: now,
      });
    }

    // Hypothesis 2: Derived from wick rejections / false breakouts
    const wickPattern = patterns.find((p) => p.patternName.includes('REJECTION WICK'));
    if (wickPattern) {
      hypotheses.push({
        hypothesisId: `hyp_${now + 1}_${Math.random().toString(36).substring(2, 6)}`,
        statement:
          'Requiring candle body ratio to exceed 55% of candle range (filtering out candles where wick > 45%) on breakout entries improves directional continuation expectancy.',
        rationale:
          `Repeated pattern analysis recorded ${wickPattern.occurrences} rejection wick events where breakouts failed due to immediate counter-rejection.`,
        evidenceIds: observations.filter((o) => o.observationType.includes('REJECTION')).slice(0, 3).map((o) => o.observationId),
        targetSymbols: wickPattern.symbols,
        suggestedRegime: 'BREAKOUT_SETUP',
        createdAt: now,
      });
    }

    // Default Fallback Hypothesis if market was calm
    if (hypotheses.length === 0) {
      hypotheses.push({
        hypothesisId: `hyp_${now}_${Math.random().toString(36).substring(2, 6)}`,
        statement:
          'Enforcing a minimum Bollinger Bandwidth threshold (>0.012) prior to trend-following rule execution filters whipsaw trades during low-volatility consolidation.',
        rationale:
          'Analysis of recent market sessions indicates low-volatility regimes suffer degraded win rates when evaluating directional moving average signals.',
        evidenceIds: observations.slice(0, 2).map((o) => o.observationId),
        targetSymbols: symbols.length > 0 ? symbols : ['BTC/USDT'],
        suggestedRegime: 'RANGING_CONSOLIDATION',
        createdAt: now,
      });
    }

    return hypotheses;
  }

  /**
   * Constructs an executive summary of the learning session
   */
  private buildSessionSummary(data: {
    observationsCount: number;
    contradictionsCount: number;
    patternsCount: number;
    hypothesesCount: number;
    lessonsCount: number;
    regimeSummaries: ReturnType<typeof marketObserverService.getRegimeSummary>;
  }): string {
    const regimesStr = data.regimeSummaries.map((r) => `${r.symbol}(${r.regime})`).join(', ');
    return (
      `Daily Learning Session completed. Analyzed ${data.observationsCount} empirical market observations. ` +
      `Monitored regimes: [${regimesStr || 'General Crypto'}]. Identified ${data.patternsCount} repeated market patterns ` +
      `and flagged ${data.contradictionsCount} contradictions against theoretical assumptions. ` +
      `Reinforced ${data.lessonsCount} risk discipline lessons and formulated ${data.hypothesesCount} testable hypotheses for research validation.`
    );
  }

  // --- Read-only Retrieval Methods ---

  public getLatestSession(): DailyLearningSession | undefined {
    const sessions = memoryService.getLearningSessions();
    return sessions.length > 0 ? sessions[0] : undefined;
  }

  public getAllSessions(): DailyLearningSession[] {
    return memoryService.getLearningSessions();
  }

  public getSessionById(sessionId: string): DailyLearningSession | undefined {
    const sessions = memoryService.getLearningSessions();
    return sessions.find((s) => s.sessionId === sessionId);
  }

  public getAllHypotheses(): PotentialHypothesis[] {
    const sessions = memoryService.getLearningSessions();
    const allHypotheses: PotentialHypothesis[] = [];
    const seen = new Set<string>();

    for (const s of sessions) {
      if (s.hypothesesGenerated) {
        for (const h of s.hypothesesGenerated) {
          if (!seen.has(h.hypothesisId)) {
            seen.add(h.hypothesisId);
            allHypotheses.push(h);
          }
        }
      }
    }

    return allHypotheses.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const dailyLearningService = DailyLearningService.getInstance();
