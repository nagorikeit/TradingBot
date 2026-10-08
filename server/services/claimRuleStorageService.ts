import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ResearchClaim,
  RuleCandidate,
  RuleValidationRecord,
} from '../types/claimRuleTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, '../storage');
const CLAIMS_FILE = path.join(STORAGE_DIR, 'claims_db.json');
const RULES_FILE = path.join(STORAGE_DIR, 'rules_db.json');
const VALIDATIONS_FILE = path.join(STORAGE_DIR, 'validations_db.json');

export class ClaimRuleStorageService {
  private static instance: ClaimRuleStorageService;
  private claims: Map<string, ResearchClaim> = new Map();
  private rules: Map<string, RuleCandidate> = new Map();
  private validations: Map<string, RuleValidationRecord> = new Map();

  private constructor() {
    this.ensureStorageDir();
    this.loadFromStorage();
  }

  public static getInstance(): ClaimRuleStorageService {
    if (!ClaimRuleStorageService.instance) {
      ClaimRuleStorageService.instance = new ClaimRuleStorageService();
    }
    return ClaimRuleStorageService.instance;
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  private loadFromStorage(): void {
    try {
      if (fs.existsSync(CLAIMS_FILE)) {
        const raw = fs.readFileSync(CLAIMS_FILE, 'utf-8');
        const list: ResearchClaim[] = JSON.parse(raw);
        list.forEach((c) => this.claims.set(c.claimId, c));
      }
      if (fs.existsSync(RULES_FILE)) {
        const raw = fs.readFileSync(RULES_FILE, 'utf-8');
        const list: RuleCandidate[] = JSON.parse(raw);
        list.forEach((r) => this.rules.set(r.ruleId, r));
      }
      if (fs.existsSync(VALIDATIONS_FILE)) {
        const raw = fs.readFileSync(VALIDATIONS_FILE, 'utf-8');
        const list: RuleValidationRecord[] = JSON.parse(raw);
        list.forEach((v) => this.validations.set(v.ruleId, v));
      }
    } catch (err) {
      console.error('[ClaimRuleStorageService] Error loading storage:', err);
    }
  }

  public saveToStorage(): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(
        CLAIMS_FILE,
        JSON.stringify(Array.from(this.claims.values()), null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        RULES_FILE,
        JSON.stringify(Array.from(this.rules.values()), null, 2),
        'utf-8'
      );
      fs.writeFileSync(
        VALIDATIONS_FILE,
        JSON.stringify(Array.from(this.validations.values()), null, 2),
        'utf-8'
      );
    } catch (err) {
      console.error('[ClaimRuleStorageService] Error writing storage:', err);
    }
  }

  // --- Claims CRUD ---
  public getClaims(): ResearchClaim[] {
    return Array.from(this.claims.values()).sort((a, b) => b.extractedAt - a.extractedAt);
  }

  public getClaimById(id: string): ResearchClaim | undefined {
    return this.claims.get(id);
  }

  public saveClaim(claim: ResearchClaim): void {
    this.claims.set(claim.claimId, claim);
    this.saveToStorage();
  }

  // --- Rules CRUD ---
  public getRules(): RuleCandidate[] {
    return Array.from(this.rules.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getRuleById(id: string): RuleCandidate | undefined {
    return this.rules.get(id);
  }

  public saveRule(rule: RuleCandidate): void {
    this.rules.set(rule.ruleId, rule);
    this.saveToStorage();
  }

  // --- Validations CRUD ---
  public getValidationByRuleId(ruleId: string): RuleValidationRecord | undefined {
    return this.validations.get(ruleId);
  }

  public saveValidation(record: RuleValidationRecord): void {
    this.validations.set(record.ruleId, record);
    this.saveToStorage();
  }

  public getStats() {
    const claims = Array.from(this.claims.values());
    const rules = Array.from(this.rules.values());
    return {
      totalClaims: claims.length,
      testableClaims: claims.filter((c) => c.testability === 'TESTABLE').length,
      notTestableClaims: claims.filter((c) => c.testability === 'NOT_TESTABLE').length,
      insufficientDataClaims: claims.filter((c) => c.testability === 'INSUFFICIENT_DATA').length,
      totalRules: rules.length,
      trustedCandidates: rules.filter((r) => r.status === 'TRUSTED_CANDIDATE').length,
      approvedRules: rules.filter((r) => r.status === 'APPROVED').length,
      rejectedRules: rules.filter((r) => r.status === 'REJECTED').length,
    };
  }
}

export const claimRuleStorageService = ClaimRuleStorageService.getInstance();
