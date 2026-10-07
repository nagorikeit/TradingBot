import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SchedulerConfig,
  SchedulerStatusResponse,
} from '../types/sourceTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, '../storage');
const CONFIG_FILE = path.join(STORAGE_DIR, 'scheduler_config.json');

export class ResearchSchedulerService {
  private static instance: ResearchSchedulerService;

  private config: SchedulerConfig = {
    enabled: true,
    dailyRunTime: '02:00',
    timezone: 'Asia/Dhaka',
    lastStatus: 'IDLE',
  };

  private isLocked: boolean = false;
  private lockAcquiredAt?: number;
  private checkIntervalTimer: NodeJS.Timeout | null = null;
  private serviceStartedAt: number = Date.now();

  private constructor() {
    this.ensureStorageDir();
    this.loadConfig();
    this.recalculateNextRun();
    this.startHeartbeat();
    console.log('[SCHEDULER] schedule loaded and heartbeat active');
  }

  public static getInstance(): ResearchSchedulerService {
    if (!ResearchSchedulerService.instance) {
      ResearchSchedulerService.instance = new ResearchSchedulerService();
    }
    return ResearchSchedulerService.instance;
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const saved = JSON.parse(raw) as Partial<SchedulerConfig>;
        this.config = {
          ...this.config,
          ...saved,
          // Release any stale locks preserved from previous server crash
          lastStatus: saved.lastStatus === 'RUNNING' ? 'FAILED' : saved.lastStatus || 'IDLE',
        };
      }
      this.isLocked = false;
      this.lockAcquiredAt = undefined;
    } catch (err) {
      console.error('[SCHEDULER] Error loading config:', err);
    }
  }

  private saveConfig(): void {
    try {
      this.ensureStorageDir();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SCHEDULER] Error saving config:', err);
    }
  }

  /**
   * Recalculates nextRunAt based on dailyRunTime (HH:MM) and IANA timezone
   */
  public recalculateNextRun(): void {
    if (!this.config.enabled) {
      this.config.nextRunAt = undefined;
      this.config.lastStatus = 'IDLE';
      this.saveConfig();
      return;
    }

    try {
      const nextRunMs = this.calculateNextOccurrenceMs(
        this.config.dailyRunTime,
        this.config.timezone
      );
      this.config.nextRunAt = nextRunMs;
      if (this.config.lastStatus === 'IDLE') {
        this.config.lastStatus = 'SCHEDULED';
      }
      this.saveConfig();
    } catch (err) {
      console.error('[SCHEDULER] Error calculating next run time:', err);
      // Fallback: 24h from now
      this.config.nextRunAt = Date.now() + 86400000;
      this.saveConfig();
    }
  }

  /**
   * Safe IANA timezone occurrence calculator
   */
  private calculateNextOccurrenceMs(timeStr: string, timeZone: string): number {
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    const targetH = isNaN(parts[0]) ? 2 : Math.min(23, Math.max(0, parts[0]));
    const targetM = isNaN(parts[1]) ? 0 : Math.min(59, Math.max(0, parts[1]));

    const now = new Date();

    // Check current local time in target timezone
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
    } catch {
      // Fallback to UTC if invalid timezone passed
      timeZone = 'UTC';
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
    }

    const formattedParts = formatter.formatToParts(now);
    const getVal = (type: string) => parseInt(formattedParts.find((p) => p.type === type)?.value || '0', 10);
    const currentH = getVal('hour') % 24;
    const currentM = getVal('minute');

    let daysToAdd = 0;
    if (currentH > targetH || (currentH === targetH && currentM >= targetM)) {
      daysToAdd = 1;
    }

    // Rough UTC target
    const targetInTz = new Date(now.getTime() + daysToAdd * 86400000);
    const tzString = targetInTz.toLocaleString('en-US', { timeZone });
    const localInTz = new Date(tzString);
    const offsetDiff = targetInTz.getTime() - localInTz.getTime();

    const targetBase = new Date(tzString);
    targetBase.setHours(targetH, targetM, 0, 0);

    let nextTimestamp = targetBase.getTime() + offsetDiff;
    if (nextTimestamp <= now.getTime()) {
      nextTimestamp += 86400000;
    }

    return nextTimestamp;
  }

  /**
   * Heartbeat scheduler loop running every 60 seconds
   */
  private startHeartbeat(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
    }

    this.checkIntervalTimer = setInterval(() => {
      this.evaluateScheduledRun();
    }, 60000);
  }

  /**
   * Check if schedule is due
   */
  private evaluateScheduledRun(): void {
    if (!this.config.enabled || !this.config.nextRunAt) {
      return;
    }

    const now = Date.now();
    // If schedule time reached or passed by less than 1 hour
    if (now >= this.config.nextRunAt) {
      const overdueMs = now - this.config.nextRunAt;
      if (overdueMs > 3600000) {
        console.log(`[SCHEDULER] missed schedule detected (overdue by ${Math.floor(overdueMs / 60000)} mins). Rescheduling.`);
        this.recalculateNextRun();
        return;
      }

      console.log('[SCHEDULER] scheduled job due, triggering execution');
      this.executeRun('SCHEDULED');
    }
  }

  /**
   * Execute research session with Single-Run Mutex Lock
   */
  public async executeRun(triggerSource: 'MANUAL' | 'SCHEDULED'): Promise<{
    ok: boolean;
    message: string;
    durationMs?: number;
    error?: string;
  }> {
    // 1. Single-run Mutex Guard: Prevent concurrent or duplicate executions
    if (this.isLocked) {
      console.log('[SCHEDULER] duplicate run prevented: job already locked and running');
      return {
        ok: false,
        message: 'Duplicate run prevented: Another research session is currently running.',
        error: 'MUTEX_LOCKED',
      };
    }

    // 2. Acquire Mutex Lock
    this.isLocked = true;
    this.lockAcquiredAt = Date.now();
    this.config.lastStatus = 'RUNNING';
    this.config.lastError = undefined;
    this.saveConfig();

    console.log(`[SCHEDULER] job started (${triggerSource.toLowerCase()} trigger)`);

    const startTime = Date.now();

    try {
      // 3. Controlled Foundation Execution:
      // Note: Phase 2A deliberately does NOT execute external web scraping or AI calls.
      // This establishes the verified execution lifecycle for future Phase 2B-2E.
      await new Promise((resolve) => setTimeout(resolve, 350));

      const durationMs = Date.now() - startTime;

      // 4. Update Success State
      this.config.lastRunAt = Date.now();
      this.config.lastStatus = 'COMPLETED';
      this.config.lastExecutionDurationMs = durationMs;
      this.config.lastError = undefined;

      // Calculate next scheduled run
      this.recalculateNextRun();

      console.log(`[SCHEDULER] job completed in ${durationMs}ms`);

      return {
        ok: true,
        message: `Research session foundation executed successfully (${triggerSource}).`,
        durationMs,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown execution error';
      this.config.lastStatus = 'FAILED';
      this.config.lastError = errorMsg;
      this.saveConfig();
      console.error('[SCHEDULER] job failed:', errorMsg);

      return {
        ok: false,
        message: 'Research session execution failed',
        error: errorMsg,
      };
    } finally {
      // 5. Release Mutex Lock
      this.isLocked = false;
      this.lockAcquiredAt = undefined;
      this.saveConfig();
    }
  }

  /**
   * Update scheduler configuration
   */
  public updateConfig(updates: Partial<Pick<SchedulerConfig, 'enabled' | 'dailyRunTime' | 'timezone'>>): SchedulerConfig {
    if (updates.dailyRunTime !== undefined) {
      const isValidTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(updates.dailyRunTime.trim());
      if (!isValidTime) {
        throw new Error('Invalid dailyRunTime format: Must be HH:MM in 24-hour format (e.g. "02:00")');
      }
      this.config.dailyRunTime = updates.dailyRunTime.trim();
    }

    if (updates.timezone !== undefined) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: updates.timezone.trim() });
        this.config.timezone = updates.timezone.trim();
      } catch {
        throw new Error(`Invalid IANA timezone string: "${updates.timezone}"`);
      }
    }

    if (typeof updates.enabled === 'boolean') {
      this.config.enabled = updates.enabled;
    }

    this.recalculateNextRun();
    console.log(`[SCHEDULER] config updated: enabled=${this.config.enabled}, time=${this.config.dailyRunTime}, tz=${this.config.timezone}`);
    return { ...this.config };
  }

  public getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  public getStatus(): SchedulerStatusResponse {
    const nextScheduledInMs = this.config.nextRunAt ? Math.max(0, this.config.nextRunAt - Date.now()) : undefined;

    return {
      config: { ...this.config },
      isRunning: this.config.lastStatus === 'RUNNING',
      isLocked: this.isLocked,
      lockAcquiredAt: this.lockAcquiredAt,
      nextScheduledInMs,
      uptimeSeconds: Math.floor((Date.now() - this.serviceStartedAt) / 1000),
    };
  }

  public destroy(): void {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }
  }
}

export const researchSchedulerService = ResearchSchedulerService.getInstance();
