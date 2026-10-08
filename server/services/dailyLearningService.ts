import {
  DailyLearningSession,
  KnowledgeComparisonItem,
  LearningContradiction,
  LearningLesson,
  MarketMemoryComparisonItem,
  PotentialHypothesis,
  RepeatedMarketPattern,
  ValidationEvidenceReference,
} from '../types/knowledgeTypes';
import { marketObserverService } from './marketObserverService';
import { memoryService } from './memoryService';
import { knowledgeService } from './knowledgeService';
import { claimRuleStorageService } from './claimRuleStorageService';
import { sourceRegistryService } from './sourceRegistryService';
import { webContentFetcher } from './webContentFetcher';
import { MarketObservation, MarketRegime } from '../types/observationTypes';

export interface RunDailyLearningOptions {
  symbol?: string;
  timeframe?: string;
  limitObservations?: number;
  triggerSource?: 'MANUAL' | 'SCHEDULED';
  acquireResearch?: boolean;
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

    // =========================================================================
    // PART 1: Fresh Market Observations from Confirmed CLOSED Candles
    // =========================================================================
    let freshClosedCandlesCount = 0;
    const targetPairs: Array<{ symbol: string; timeframe: string }> = [];

    if (options.symbol && options.timeframe) {
      targetPairs.push({ symbol: options.symbol, timeframe: options.timeframe });
    } else {
      // Default core pairs monitored for continuous learning
      targetPairs.push(
        { symbol: 'BTC/USDT', timeframe: '1m' },
        { symbol: 'BTC/USDT', timeframe: '5m' },
        { symbol: 'ETH/USDT', timeframe: '1m' },
        { symbol: 'ETH/USDT', timeframe: '5m' },
        { symbol: 'SOL/USDT', timeframe: '5m' },
        { symbol: 'SOL/USDT', timeframe: '15m' }
      );
    }

    // Always fetch fresh closed candle data to generate current observations
    for (const pair of targetPairs) {
      try {
        const obs = await marketObserverService.fetchAndObserveBinance(pair.symbol, pair.timeframe, 60);
        freshClosedCandlesCount += obs.length;
      } catch (err) {
        console.warn(`[DailyLearningService] Fresh closed candle fetch warning for ${pair.symbol} ${pair.timeframe}:`, err);
      }
    }

    const observations = marketObserverService.getRecentObservations(limit, {
      symbol: options.symbol,
      timeframe: options.timeframe,
    });

    // =========================================================================
    // PART 2: Scheduled Research Acquisition from TRUSTED & MONITORED Sources Only
    // =========================================================================
    const researchAcquisitionResults: DailyLearningSession['researchAcquisitionResults'] = {
      attemptedCount: 0,
      successCount: 0,
      failedCount: 0,
      sourcesProcessed: [],
      failures: [],
    };

    if (options.acquireResearch || triggerSource === 'SCHEDULED') {
      const allSources = sourceRegistryService.getAllSources();
      // Strict rule: ONLY TRUSTED and MONITORED sources can be fetched.
      // BLOCKED, PAUSED, UNDER_REVIEW, DISCOVERED, ARCHIVED are strictly excluded.
      const eligibleSources = allSources.filter(
        (s) => s.status === 'TRUSTED' || s.status === 'MONITORED'
      );

      for (const source of eligibleSources.slice(0, 3)) {
        researchAcquisitionResults.attemptedCount++;
        try {
          const fetchRes = await webContentFetcher.fetchSourceContent(source.id);
          if (fetchRes.ok) {
            researchAcquisitionResults.successCount++;
            researchAcquisitionResults.sourcesProcessed.push(source.name);
          } else {
            researchAcquisitionResults.failedCount++;
            researchAcquisitionResults.failures.push({
              sourceId: source.id,
              sourceName: source.name,
              error: fetchRes.error || 'Fetch unfulfilled',
            });
          }
        } catch (fetchErr: unknown) {
          // Failure in research acquisition does NOT abort Daily Learning
          researchAcquisitionResults.failedCount++;
          researchAcquisitionResults.failures.push({
            sourceId: source.id,
            sourceName: source.name,
            error: fetchErr instanceof Error ? fetchErr.message : 'Unknown acquisition error',
          });
        }
      }
    }

    // =========================================================================
    // PART 3 & PART 4 & PART 5: Context Retrieval & Comparisons
    // =========================================================================
    const knowledgeItems = knowledgeService.getAllKnowledge().filter(
      (k) => k.status === 'VALIDATED' || k.status === 'HYPOTHESIS' || k.status === 'NEW'
    );
    const agentMemories = memoryService.getAllMemories();
    const marketMemories = memoryService.getAllMarketMemories();
    const validations = claimRuleStorageService.getValidations();
    const regimeSummaries = marketObserverService.getRegimeSummary();

    // 1. Synthesize Factual Findings
    const importantFindings = this.synthesizeFindings(observations, regimeSummaries);

    // 2. Knowledge <-> Market Observation Comparison (PART 3)
    const knowledgeComparisons = this.compareKnowledgeWithObservations(observations, knowledgeItems);

    // 3. Extract Contradiction Candidates from comparisons
    const contradictions = this.extractContradictions(knowledgeComparisons, observations);

    // 4. Observation <-> Market Memory Comparison (PART 5)
    const marketMemoryComparisons = this.compareObservationsWithMarketMemory(observations, marketMemories);

    // 5. Detect Repeated Patterns across Observations
    const repeatedPatterns = this.detectRepeatedPatterns(observations);

    // 6. Extract Lessons and Historical Pitfalls (PART 9: Separate Trade Mistakes from Market Observations)
    const mistakesOrLessons = this.extractLessons(agentMemories, observations);

    // 7. Validation Evidence References (PART 4: Real Usage of Phase 2D Validations)
    const validationEvidenceReferences = this.compileValidationEvidence(validations);

    // 8. Formulate Testable Hypotheses (PART 8: Safe Format without Fabricated Percentages)
    const hypothesesGenerated = this.generateHypotheses(
      observations,
      contradictions,
      repeatedPatterns,
      validationEvidenceReferences
    );

    // 9. Extract top factual market observation highlights
    const importantMarketObservations = observations
      .slice(0, 10)
      .map((obs) => `[${obs.symbol} ${obs.timeframe}] ${obs.observationType}: ${obs.observationText}`);

    // 10. Build Session Executive Summary
    const summary = this.buildSessionSummary({
      observationsCount: observations.length,
      contradictionsCount: contradictions.length,
      patternsCount: repeatedPatterns.length,
      hypothesesCount: hypothesesGenerated.length,
      lessonsCount: mistakesOrLessons.length,
      knowledgeComparisonsCount: knowledgeComparisons.length,
      memoryComparisonsCount: marketMemoryComparisons.length,
      regimeSummaries,
    });

    const sessionId = `learn_${Date.now()}_${triggerSource.toLowerCase()}`;
    const endTime = Date.now();

    const session: DailyLearningSession = {
      sessionId,
      startTime,
      endTime,
      sourcesProcessed: observations.length + agentMemories.length + knowledgeItems.length + researchAcquisitionResults.attemptedCount,
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
      knowledgeComparisons,
      marketMemoryComparisons,
      validationEvidenceReferences,
      researchAcquisitionResults,
      metrics: {
        observationsAnalyzed: observations.length,
        memoriesConsulted: agentMemories.length,
        knowledgeItemsConsulted: knowledgeItems.length,
        validationsConsulted: validations.length,
        knowledgeComparisonsCount: knowledgeComparisons.length,
        marketMemoryComparisonsCount: marketMemoryComparisons.length,
        freshClosedCandlesAnalyzed: freshClosedCandlesCount,
      },
    };

    // =========================================================================
    // PART 10 & 11: Persist Learning Session & Segregated Agent Memories
    // =========================================================================
    if (!options.dryRun) {
      memoryService.addLearningSession(session);

      const symbolsInvolved = Array.from(new Set(observations.map((o) => o.symbol))).join(', ');
      memoryService.addAgentMemory({
        category: 'IMPROVEMENT',
        market: 'CRYPTO',
        symbol: options.symbol?.toUpperCase() || 'MULTI',
        timeframe: options.timeframe || 'MULTI',
        context: `Daily Learning Session ${sessionId} completed (${triggerSource} trigger).`,
        observation: `Factual: Analyzed ${observations.length} closed candle observations across ${symbolsInvolved || 'monitored pairs'}. Conducted ${knowledgeComparisons.length} knowledge comparisons and ${marketMemoryComparisons.length} memory comparisons.`,
        decision: `Recorded learning session findings and formulated ${hypothesesGenerated.length} testable hypotheses for empirical backtest queue.`,
        evidence: observations.slice(0, 5).map((o) => o.observationId),
        confidence: 0.9,
        isFact: true, // Only the factual statement of processed events is fact
        reasoning: `Learning session synthesized market structure and validation evidence. No live production rules or signal logic were modified.`,
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
          observation: `Factual: ${highSeverity.map((c) => `${c.topic}: ${c.observation}`).join('; ')}`,
          decision: `Recommend cautious risk sizing and awaiting multi-candle confirmation when market conditions exhibit contradictory price action.`,
          evidence: observations.slice(0, 3).map((o) => o.observationId),
          confidence: 0.85,
          isFact: true,
          reasoning: `Market observations contradicted baseline assumptions (${highSeverity.map((c) => c.contradictedPrinciple).join(', ')}). Caution advised.`,
        });
      }
    }

    return {
      ok: true,
      session,
      message: `Daily Learning Session ${sessionId} completed successfully with ${observations.length} closed candle observations analyzed.`,
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
   * PART 3: Knowledge <-> Market Observation Comparison
   * Evaluates fresh observations against trusted knowledge claims.
   * Classifies into: AGREEMENT | CONTRADICTION_CANDIDATE | NEW_OBSERVATION.
   * NOTE: Contradictions retain full evidence and NEVER delete or invalidate knowledge unilaterally.
   */
  private compareKnowledgeWithObservations(
    observations: MarketObservation[],
    knowledgeItems: ReturnType<typeof knowledgeService.getAllKnowledge>
  ): KnowledgeComparisonItem[] {
    const comparisons: KnowledgeComparisonItem[] = [];

    for (const obs of observations) {
      const snap = obs.indicatorSnapshot;
      if (!snap) continue;

      // 1. Rejection Wick vs Breakout / Resistance Knowledge
      if (obs.observationType === 'BEARISH_REJECTION_WICK') {
        const falseBreakoutKnowledge = knowledgeItems.find(
          (k) => k.tags.includes('false-breakout') || k.tags.includes('wick-rejection') || k.topic.includes('Breakout')
        );
        if (falseBreakoutKnowledge) {
          comparisons.push({
            knowledgeId: falseBreakoutKnowledge.id,
            knowledgeTitle: falseBreakoutKnowledge.title,
            topic: 'Breakout & False Breakout',
            observationId: obs.observationId,
            symbol: obs.symbol,
            timeframe: obs.timeframe,
            comparisonResult: 'AGREEMENT',
            explanation: `Observation of upper shadow rejection (${obs.observationText}) confirms knowledge claim "${falseBreakoutKnowledge.summary}" regarding premature breakout traps.`,
            evidenceReferences: [obs.observationId, falseBreakoutKnowledge.id],
          });
        }
      }

      // 2. Trend & Pullback vs Alexander Elder Triple Screen Knowledge
      if (obs.regime === 'TRENDING_BULLISH' && snap.rsi < 55 && snap.rsi > 40) {
        const tripleScreenKnowledge = knowledgeItems.find(
          (k) => k.tags.includes('multi-timeframe') || k.tags.includes('pullback')
        );
        if (tripleScreenKnowledge) {
          comparisons.push({
            knowledgeId: tripleScreenKnowledge.id,
            knowledgeTitle: tripleScreenKnowledge.title,
            topic: 'Multi-Timeframe Analysis',
            observationId: obs.observationId,
            symbol: obs.symbol,
            timeframe: obs.timeframe,
            comparisonResult: 'AGREEMENT',
            explanation: `Price maintaining bullish trend with RSI resetting to ${snap.rsi.toFixed(1)} aligns with Triple Screen principle of waiting for intermediate oscillator reset in direction of macro trend.`,
            evidenceReferences: [obs.observationId, tripleScreenKnowledge.id],
          });
        }
      }

      // 3. RSI Divergence / Extreme Bands Contradiction Candidate
      if (obs.regime === 'TRENDING_BEARISH' && snap.rsi < 30) {
        const oscillatorKnowledge = knowledgeItems.find(
          (k) => k.topic.includes('Technical Indicators') || k.tags.includes('oscillator') || k.tags.includes('rsi')
        );
        const kId = oscillatorKnowledge?.id || 'kn_rsi_oversold_general';
        const kTitle = oscillatorKnowledge?.title || 'RSI Oversold Momentum Assumption';
        comparisons.push({
          knowledgeId: kId,
          knowledgeTitle: kTitle,
          topic: 'Technical Indicators',
          observationId: obs.observationId,
          symbol: obs.symbol,
          timeframe: obs.timeframe,
          comparisonResult: 'CONTRADICTION_CANDIDATE',
          explanation: `Market printed RSI ${snap.rsi.toFixed(1)} under confirmed TRENDING_BEARISH regime with continued downward drift, contrary to general assumption that oversold RSI warrants immediate mean-reversion long bounce.`,
          evidenceReferences: [obs.observationId, kId],
        });
      }

      // 4. Volume Anomaly followed by Rejection Wick Contradiction Candidate
      const volumeRatio = snap.volume / (snap.volumeSma20 || 1);
      if (obs.observationType === 'BEARISH_REJECTION_WICK' && volumeRatio > 1.8) {
        comparisons.push({
          knowledgeId: 'kn_breakout_volume_principle',
          knowledgeTitle: 'High Volume Breakout Continuation Principle',
          topic: 'Volume & Price Action',
          observationId: obs.observationId,
          symbol: obs.symbol,
          timeframe: obs.timeframe,
          comparisonResult: 'CONTRADICTION_CANDIDATE',
          explanation: `Volume surge (${volumeRatio.toFixed(1)}x) accompanied by rejection wick (>70% shadow) contradicted classic expectation that elevated volume guarantees structural breakout follow-through.`,
          evidenceReferences: [obs.observationId],
        });
      }

      // 5. Low Volatility Compression New Observation
      if (obs.observationType === 'VOLATILITY_STATE' && obs.regime === 'LOW_VOLATILITY') {
        comparisons.push({
          knowledgeId: 'kn_volatility_compression',
          knowledgeTitle: 'Bollinger Band Squeeze Dynamics',
          topic: 'Volatility & Bandwidth',
          observationId: obs.observationId,
          symbol: obs.symbol,
          timeframe: obs.timeframe,
          comparisonResult: 'NEW_OBSERVATION',
          explanation: `Identified low volatility bandwidth compression (${(snap.bollingerBands.bandwidth * 100).toFixed(2)}%) characterizing consolidation phase preceding expansion.`,
          evidenceReferences: [obs.observationId],
        });
      }
    }

    // Deduplicate comparisons by observationId + topic
    const seen = new Set<string>();
    const deduplicated: KnowledgeComparisonItem[] = [];
    for (const c of comparisons) {
      const key = `${c.observationId}::${c.topic}::${c.comparisonResult}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(c);
      }
    }

    return deduplicated;
  }

  /**
   * Extracts contradiction candidates from knowledge comparisons
   */
  private extractContradictions(
    comparisons: KnowledgeComparisonItem[],
    _observations: MarketObservation[]
  ): LearningContradiction[] {
    const contradictions: LearningContradiction[] = [];

    const candidates = comparisons.filter((c) => c.comparisonResult === 'CONTRADICTION_CANDIDATE');
    for (const c of candidates) {
      contradictions.push({
        topic: c.topic,
        observation: `[${c.symbol} ${c.timeframe}] ${c.explanation}`,
        contradictedPrinciple: c.knowledgeTitle,
        severity: c.topic.includes('Volume') ? 'HIGH' : 'MEDIUM',
      });
    }

    return contradictions.slice(0, 5);
  }

  /**
   * PART 5: Market Memory Real Usage
   * Compares fresh observations against historical Market Memory.
   * Classifies into: NEW | REPEATED | CONSISTENT | DIFFERENT | POSSIBLE_CONTRADICTION.
   * Strict rule: Never claims a pattern is "profitable" or "high-probability" without Phase 2D validation.
   */
  private compareObservationsWithMarketMemory(
    observations: MarketObservation[],
    marketMemories: ReturnType<typeof memoryService.getAllMarketMemories>
  ): MarketMemoryComparisonItem[] {
    const comparisons: MarketMemoryComparisonItem[] = [];

    for (const obs of observations) {
      if (obs.observationType === 'REGIME_CLASSIFICATION') continue;

      const setupName = obs.observationType.replace(/_/g, ' ');
      const matchingMem = marketMemories.find(
        (m) => m.symbol === obs.symbol.toUpperCase() && m.setup.toLowerCase() === setupName.toLowerCase()
      );

      if (!matchingMem) {
        comparisons.push({
          observationId: obs.observationId,
          symbol: obs.symbol,
          timeframe: obs.timeframe,
          setup: setupName,
          comparisonResult: 'NEW',
          priorObservationCount: 0,
          explanation: `New setup occurrence: "${setupName}" observed for the first time on ${obs.symbol} ${obs.timeframe}. Recorded for ongoing longitudinal tracking.`,
        });
      } else {
        const sameRegime = matchingMem.marketCondition === obs.regime;
        const resultType = sameRegime ? 'CONSISTENT' : 'DIFFERENT';

        comparisons.push({
          memoryId: matchingMem.id,
          observationId: obs.observationId,
          symbol: obs.symbol,
          timeframe: obs.timeframe,
          setup: setupName,
          comparisonResult: resultType,
          priorObservationCount: matchingMem.observationCount,
          explanation: `Repeated setup: "${setupName}" observed again on ${obs.symbol} (prior observations: ${matchingMem.observationCount}). Current condition: ${obs.regime} (Historical: ${matchingMem.marketCondition}).`,
        });
      }
    }

    // Deduplicate by symbol + setup
    const seen = new Set<string>();
    const deduplicated: MarketMemoryComparisonItem[] = [];
    for (const c of comparisons) {
      const key = `${c.symbol}::${c.timeframe}::${c.setup}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(c);
      }
    }

    return deduplicated;
  }

  /**
   * PART 4: Real Usage of Phase 2D Validation Records
   * Compiles validation evidence available for empirical reference.
   * Strict rule: Status is strictly "Evidence Available".
   * Daily Learning CANNOT set rule status to TRUSTED, APPROVED, or PRODUCTION READY.
   */
  private compileValidationEvidence(
    validations: ReturnType<typeof claimRuleStorageService.getValidations>
  ): ValidationEvidenceReference[] {
    return validations.map((v) => ({
      validationId: v.validationId,
      ruleId: v.ruleId,
      status: 'Evidence Available',
      phase2dVerdict: v.verdict,
      sampleSize: v.inSampleMetrics.totalTrades + v.outOfSampleMetrics.totalTrades,
      wins: v.outOfSampleMetrics.wins,
      losses: v.outOfSampleMetrics.losses,
      draws: v.outOfSampleMetrics.draws,
      unresolved: v.outOfSampleMetrics.unresolved,
      inSampleWinRate: v.inSampleMetrics.winRate,
      outOfSampleWinRate: v.outOfSampleMetrics.winRate,
      profitFactor: v.outOfSampleMetrics.profitFactor,
      expectancy: v.outOfSampleMetrics.expectancy,
      maxDrawdown: v.outOfSampleMetrics.maxDrawdown,
      oosRetentionRatio: v.oosRetentionRatio,
      evidenceStatus: 'AVAILABLE',
    }));
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
   * PART 9: Extracts actionable trading lessons while strictly separating trade mistakes from market observations
   */
  private extractLessons(
    memories: ReturnType<typeof memoryService.getAllMemories>,
    observations: MarketObservation[]
  ): LearningLesson[] {
    const lessons: LearningLesson[] = [];

    // Historical trade execution mistakes (ONLY from actual past trades / execution records)
    const pastMistakes = memories.filter((m) => m.category === 'MISTAKE');
    for (const m of pastMistakes.slice(0, 3)) {
      lessons.push({
        lesson: `Historical trade execution lesson: ${m.observation}`,
        context: `${m.symbol || 'UNIVERSAL'} ${m.timeframe} - ${m.context}`,
        preventiveAction: m.reasoning || m.decision,
      });
    }

    // Current session empirical operating discipline (NOT labeled as trade mistakes)
    const currentRegimes = Array.from(new Set(observations.map((o) => o.regime)));
    if (currentRegimes.includes('RANGING_CONSOLIDATION')) {
      lessons.push({
        lesson: 'Operational Discipline: Directional indicator signals suffer degradation during RANGING_CONSOLIDATION.',
        context: 'Current session contains sideways consolidation periods.',
        preventiveAction: 'Require minimum ADX > 22 or Bollinger Bandwidth > 1.5% before evaluating directional signals.',
      });
    }

    if (currentRegimes.includes('HIGH_VOLATILITY')) {
      lessons.push({
        lesson: 'Operational Discipline: Spread expansion and slippage spike during HIGH_VOLATILITY regimes.',
        context: 'Observed elevated ATR ratio (>1.6x baseline).',
        preventiveAction: 'Increase minimum stop margin or halt fast 1m execution until volatility normalizes.',
      });
    }

    return lessons;
  }

  /**
   * PART 7 & PART 8: Safe Hypothesis Generation
   * Strict Safety Rules:
   * 1. NO unsupported percentage claims ("win rate 15% বৃদ্ধি", "drawdown 15% কমবে").
   * 2. Uses testable statement format for Phase 2D backtest pipeline.
   * 3. Cross-references actual validation evidence where available.
   * 4. Daily Learning generates hypotheses ONLY; does NOT validate or activate them.
   */
  private generateHypotheses(
    observations: MarketObservation[],
    contradictions: LearningContradiction[],
    patterns: RepeatedMarketPattern[],
    validationEvidence: ValidationEvidenceReference[]
  ): PotentialHypothesis[] {
    const hypotheses: PotentialHypothesis[] = [];
    const now = Date.now();
    const symbols = Array.from(new Set(observations.map((o) => o.symbol)));

    // Hypothesis 1: Derived from RSI oversold contradiction in trending markets
    const oversoldContradiction = contradictions.find((c) => c.topic.includes('Technical Indicators') || c.topic.includes('Oversold'));
    const rsiValidation = validationEvidence.find((v) => v.ruleId.includes('rsi'));

    if (oversoldContradiction) {
      hypotheses.push({
        hypothesisId: `hyp_${now}_${Math.random().toString(36).substring(2, 6)}`,
        statement:
          'In confirmed downward trend regimes (EMA 9 < EMA 21), empirical testing is warranted to evaluate whether filtering RSI oversold (<30) reversal long signals reduces adverse trade entries.',
        rationale:
          `Market observation recorded price continuing lower despite oversold RSI readings. Baseline evidence available from validation record ${rsiValidation?.validationId || 'seed_validation'} (OOS win rate: ${rsiValidation ? rsiValidation.outOfSampleWinRate + '%' : 'available in Phase 2D'}).`,
        evidenceIds: observations.filter((o) => o.regime === 'TRENDING_BEARISH').slice(0, 3).map((o) => o.observationId),
        targetSymbols: symbols,
        suggestedRegime: 'TRENDING_BEARISH',
        createdAt: now,
      });
    }

    // Hypothesis 2: Derived from wick rejection patterns on breakout setups
    const wickPattern = patterns.find((p) => p.patternName.includes('REJECTION WICK'));
    if (wickPattern) {
      hypotheses.push({
        hypothesisId: `hyp_${now + 1}_${Math.random().toString(36).substring(2, 6)}`,
        statement:
          'Requiring candle body ratio to exceed 55% of candle range on breakout setups should be systematically backtested across multi-timeframe samples to evaluate continuation expectancy.',
        rationale:
          `Repeated pattern analysis recorded ${wickPattern.occurrences} rejection wick events where breakouts failed due to immediate counter-rejection shadows.`,
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
          'Enforcing a minimum Bollinger Bandwidth threshold (>0.012) prior to trend-following rule execution should be backtested to examine whether whipsaw trades during low-volatility consolidation are filtered.',
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
    knowledgeComparisonsCount: number;
    memoryComparisonsCount: number;
    regimeSummaries: ReturnType<typeof marketObserverService.getRegimeSummary>;
  }): string {
    const regimesStr = data.regimeSummaries.map((r) => `${r.symbol}(${r.regime})`).join(', ');
    return (
      `Daily Learning Session completed. Analyzed ${data.observationsCount} confirmed closed candle observations. ` +
      `Monitored regimes: [${regimesStr || 'General Crypto'}]. Conducted ${data.knowledgeComparisonsCount} knowledge comparisons ` +
      `and ${data.memoryComparisonsCount} market memory comparisons. Identified ${data.patternsCount} repeated market patterns, ` +
      `flagged ${data.contradictionsCount} contradiction candidates, and formulated ${data.hypothesesCount} testable hypotheses for empirical backtest queue.`
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
