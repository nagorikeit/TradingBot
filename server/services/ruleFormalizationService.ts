import crypto from 'crypto';
import {
  ResearchClaim,
  RuleCandidate,
  RuleCondition,
  RuleDirection,
  RuleComparisonResult,
} from '../types/claimRuleTypes';
import { claimRuleStorageService } from './claimRuleStorageService';

export class RuleFormalizationService {
  private static instance: RuleFormalizationService;

  private constructor() {
    this.seedFoundationalRules();
  }

  public static getInstance(): RuleFormalizationService {
    if (!RuleFormalizationService.instance) {
      RuleFormalizationService.instance = new RuleFormalizationService();
    }
    return RuleFormalizationService.instance;
  }

  /**
   * Transforms a TESTABLE ResearchClaim into a machine-testable RuleCandidate
   */
  public formalizeClaim(claim: ResearchClaim): {
    ok: boolean;
    rule?: RuleCandidate;
    comparison?: RuleComparisonResult;
    message: string;
  } {
    if (claim.testability !== 'TESTABLE') {
      return {
        ok: false,
        message: `Claim ${claim.claimId} is classified as ${claim.testability}. Only TESTABLE claims can be formalized into executable rules.`,
      };
    }

    const { conditions, direction, expiryCandles, parameters, name, description } =
      this.parseRuleLogicFromClaimText(claim.claimText);

    if (conditions.length === 0) {
      return {
        ok: false,
        message: 'Could not derive quantitative indicator conditions from claim text.',
      };
    }

    const ruleId = 'rule_' + crypto.createHash('sha256').update(claim.claimId).digest('hex').substring(0, 16);

    const candidate: RuleCandidate = {
      ruleId,
      sourceClaimId: claim.claimId,
      name,
      description,
      version: '1.0.0',
      direction,
      timeframe: '5m',
      expiryCandles,
      market: 'CRYPTO_PAIRS',
      conditions,
      targetRegimes: direction === 'CALL' ? ['RANGING', 'BULLISH'] : ['RANGING', 'BEARISH'],
      parameters,
      status: 'HYPOTHESIS',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Compare with existing rules to prevent duplicates / identify improvements
    const comparison = this.compareWithExistingRules(candidate);

    if (comparison.relationship === 'DUPLICATE') {
      return {
        ok: false,
        comparison,
        message: `Rule rejected as duplicate: exact match with existing rule ${comparison.matchedRuleId} (${comparison.matchedRuleName}).`,
      };
    }

    // Save formalized rule
    claimRuleStorageService.saveRule(candidate);

    // Update claim status
    claim.status = 'FORMALIZED';
    claim.ruleCandidateId = ruleId;
    claimRuleStorageService.saveClaim(claim);

    return {
      ok: true,
      rule: candidate,
      comparison,
      message: `Successfully formalized rule ${name} (v1.0.0) from claim ${claim.claimId}. Relationship: ${comparison.relationship}.`,
    };
  }

  /**
   * Compares candidate rule against all existing rules
   */
  public compareWithExistingRules(candidate: RuleCandidate): RuleComparisonResult {
    const existingRules = claimRuleStorageService.getRules().filter((r) => r.ruleId !== candidate.ruleId);

    for (const ex of existingRules) {
      // Check condition signature equality
      const exSig = ex.conditions
        .map((c) => `${c.indicator}_${c.operator}_${c.threshold || c.compareTo}`)
        .sort()
        .join('|');
      const candSig = candidate.conditions
        .map((c) => `${c.indicator}_${c.operator}_${c.threshold || c.compareTo}`)
        .sort()
        .join('|');

      if (exSig === candSig && ex.direction === candidate.direction) {
        return {
          relationship: 'DUPLICATE',
          matchedRuleId: ex.ruleId,
          matchedRuleName: ex.name,
          similarityScore: 1.0,
          rationale: 'Conditions, indicator thresholds, and trade direction are mathematically identical.',
        };
      }

      if (exSig === candSig && ex.direction !== candidate.direction) {
        return {
          relationship: 'CONTRADICTORY',
          matchedRuleId: ex.ruleId,
          matchedRuleName: ex.name,
          similarityScore: 0.9,
          rationale: 'Identical indicator conditions lead to opposite trade directions (CALL vs PUT).',
        };
      }

      // Check for partial overlap / improvement candidate
      const sameDirection = ex.direction === candidate.direction;
      const sharedIndicators = candidate.conditions.filter((cc) =>
        ex.conditions.some((ec) => ec.indicator === cc.indicator)
      );

      if (sameDirection && sharedIndicators.length > 0) {
        const similarity = sharedIndicators.length / Math.max(candidate.conditions.length, ex.conditions.length);
        if (similarity >= 0.6) {
          return {
            relationship: 'IMPROVEMENT_CANDIDATE',
            matchedRuleId: ex.ruleId,
            matchedRuleName: ex.name,
            similarityScore: Number(similarity.toFixed(2)),
            rationale: `Shares ${sharedIndicators.length} core indicators with ${ex.name}. May represent an improved variation.`,
          };
        }
      }
    }

    return {
      relationship: 'NEW_RULE',
      similarityScore: 0,
      rationale: 'Novel indicator hypothesis with no direct counterpart in current rule database.',
    };
  }

  /**
   * Parses natural text into structured indicators and thresholds
   */
  private parseRuleLogicFromClaimText(text: string): {
    conditions: RuleCondition[];
    direction: RuleDirection;
    expiryCandles: number;
    parameters: Record<string, number | string>;
    name: string;
    description: string;
  } {
    const lower = text.toLowerCase();
    const conditions: RuleCondition[] = [];
    const params: Record<string, number | string> = {};

    let direction: RuleDirection = 'CALL';
    if (lower.includes('short') || lower.includes('put') || lower.includes('bearish') || lower.includes('sell')) {
      direction = 'PUT';
    }

    // 1. RSI Condition
    if (lower.includes('rsi')) {
      if (lower.includes('oversold') || lower.includes('< 30') || lower.includes('below 30')) {
        conditions.push({
          indicator: 'RSI',
          operator: '<',
          threshold: 30,
          description: 'RSI 14 oversold below 30',
        });
        params.rsiPeriod = 14;
        params.rsiOversold = 30;
      } else if (lower.includes('overbought') || lower.includes('> 70') || lower.includes('above 70')) {
        conditions.push({
          indicator: 'RSI',
          operator: '>',
          threshold: 70,
          description: 'RSI 14 overbought above 70',
        });
        params.rsiPeriod = 14;
        params.rsiOverbought = 70;
      } else if (lower.includes('> 50') || lower.includes('above 50')) {
        conditions.push({
          indicator: 'RSI',
          operator: '>',
          threshold: 50,
          description: 'RSI 14 above 50 momentum line',
        });
        params.rsiPeriod = 14;
        params.rsiMidline = 50;
      }
    }

    // 2. EMA Condition
    if (lower.includes('ema 9') || lower.includes('ema 21') || lower.includes('ema')) {
      if (direction === 'CALL') {
        conditions.push({
          indicator: 'EMA',
          operator: '>',
          compareTo: 'EMA_SLOW',
          description: 'EMA 9 above EMA 21 (Bullish Trend Alignment)',
        });
      } else {
        conditions.push({
          indicator: 'EMA',
          operator: '<',
          compareTo: 'EMA_SLOW',
          description: 'EMA 9 below EMA 21 (Bearish Trend Alignment)',
        });
      }
      params.fastEma = 9;
      params.slowEma = 21;
    }

    // 3. Price vs EMA Support / Resistance
    if (lower.includes('price above ema') || lower.includes('support')) {
      conditions.push({
        indicator: 'PRICE_ACTION',
        operator: '>',
        compareTo: 'PRICE',
        description: 'Price candle closes above EMA 21 Support',
      });
    } else if (lower.includes('price below ema') || lower.includes('resistance')) {
      conditions.push({
        indicator: 'PRICE_ACTION',
        operator: '<',
        compareTo: 'PRICE',
        description: 'Price candle closes below EMA 21 Resistance',
      });
    }

    // 4. MACD Condition
    if (lower.includes('macd')) {
      if (direction === 'CALL') {
        conditions.push({
          indicator: 'MACD',
          operator: '>',
          compareTo: 'ZERO',
          description: 'MACD histogram above zero with positive momentum',
        });
      } else {
        conditions.push({
          indicator: 'MACD',
          operator: '<',
          compareTo: 'ZERO',
          description: 'MACD histogram below zero with negative momentum',
        });
      }
      params.macdFast = 12;
      params.macdSlow = 26;
      params.macdSignal = 9;
    }

    // Default expiration
    let expiry = 3;
    const matchExpiry = text.match(/(\d+)\s*(candle|bar|minute)/i);
    if (matchExpiry) {
      const parsed = parseInt(matchExpiry[1], 10);
      if (parsed >= 1 && parsed <= 10) expiry = parsed;
    }

    const name = `${direction} - ${conditions.map((c) => c.indicator).join(' + ')} Strategy`;
    const description = `Formalized quantitative rule derived from research claim. Direction: ${direction}, Expiry: ${expiry} candles.`;

    return {
      conditions,
      direction,
      expiryCandles: expiry,
      parameters: params,
      name,
      description,
    };
  }

  /**
   * Seeds foundational rules from the verified seed claims
   */
  private seedFoundationalRules(): void {
    const existing = claimRuleStorageService.getRules();
    if (existing.length > 0) return;

    const seedRules: RuleCandidate[] = [
      {
        ruleId: 'rule_rsi_oversold_ema_bounce',
        sourceClaimId: 'clm_rsi_oversold_ema_bullish',
        name: 'CALL - RSI Oversold + EMA Trend Filter Bounce',
        description: 'Mean reversion CALL signal triggered when RSI 14 < 30 and EMA 9 > EMA 21 on 5m timeframe.',
        version: '1.0.0',
        direction: 'CALL',
        timeframe: '5m',
        expiryCandles: 3,
        market: 'CRYPTO_PAIRS',
        conditions: [
          {
            indicator: 'RSI',
            operator: '<',
            threshold: 30,
            description: 'RSI 14 oversold below 30',
          },
          {
            indicator: 'EMA',
            operator: '>',
            compareTo: 'EMA_SLOW',
            description: 'EMA 9 above EMA 21 (Bullish Trend Alignment)',
          },
        ],
        targetRegimes: ['RANGING', 'BULLISH'],
        parameters: {
          rsiPeriod: 14,
          rsiThreshold: 30,
          fastEma: 9,
          slowEma: 21,
          expiryCandles: 3,
        },
        status: 'TRUSTED_CANDIDATE',
        createdAt: Date.now() - 3600000 * 20,
        updatedAt: Date.now() - 3600000 * 2,
      },
      {
        ruleId: 'rule_macd_momentum_breakout',
        sourceClaimId: 'clm_macd_momentum_breakout',
        name: 'CALL - MACD Histogram Breakout + Price Support',
        description: 'Trend continuation CALL signal when MACD histogram crosses above zero and price > EMA 21.',
        version: '1.0.0',
        direction: 'CALL',
        timeframe: '5m',
        expiryCandles: 3,
        market: 'CRYPTO_PAIRS',
        conditions: [
          {
            indicator: 'MACD',
            operator: '>',
            compareTo: 'ZERO',
            description: 'MACD histogram above zero',
          },
          {
            indicator: 'PRICE_ACTION',
            operator: '>',
            compareTo: 'PRICE',
            description: 'Price above EMA 21 Support',
          },
        ],
        targetRegimes: ['TRENDING', 'BULLISH'],
        parameters: {
          macdFast: 12,
          macdSlow: 26,
          macdSignal: 9,
          slowEma: 21,
          expiryCandles: 3,
        },
        status: 'BACKTESTED',
        createdAt: Date.now() - 3600000 * 16,
        updatedAt: Date.now() - 3600000 * 4,
      },
      {
        ruleId: 'rule_bearish_rsi_overbought_drop',
        sourceClaimId: 'clm_bearish_rejection_rsi_overbought',
        name: 'PUT - RSI Overbought Rejection',
        description: 'Exhaustion PUT signal when RSI 14 > 70 and EMA 9 < EMA 21.',
        version: '1.0.0',
        direction: 'PUT',
        timeframe: '5m',
        expiryCandles: 3,
        market: 'CRYPTO_PAIRS',
        conditions: [
          {
            indicator: 'RSI',
            operator: '>',
            threshold: 70,
            description: 'RSI 14 overbought above 70',
          },
          {
            indicator: 'EMA',
            operator: '<',
            compareTo: 'EMA_SLOW',
            description: 'EMA 9 below EMA 21 (Bearish Momentum)',
          },
        ],
        targetRegimes: ['RANGING', 'BEARISH'],
        parameters: {
          rsiPeriod: 14,
          rsiThreshold: 70,
          fastEma: 9,
          slowEma: 21,
          expiryCandles: 3,
        },
        status: 'HYPOTHESIS',
        createdAt: Date.now() - 3600000 * 10,
        updatedAt: Date.now() - 3600000 * 6,
      },
    ];

    for (const r of seedRules) {
      claimRuleStorageService.saveRule(r);
    }
  }
}

export const ruleFormalizationService = RuleFormalizationService.getInstance();
