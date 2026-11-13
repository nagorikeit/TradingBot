import {
  User,
  SubscriptionPlan,
  SubscriptionRequest,
  PaymentGatewaysConfig,
  PaymentMethodType,
  SubscriptionStatus,
  PlanSettingsConfig,
  UserScanQuota,
  EffectiveScanQuotaStatus,
} from '../types/authTypes';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { getApiUrl } from './apiConfig';

export const ADMIN_EMAILS = ['nagorikeitsheba@gmail.com', 'admin@tradepulse.io'];

export const DEFAULT_PLAN_SETTINGS: PlanSettingsConfig = {
  freeTrialScans: 5,
  trial7dName: '৭ দিনের ট্রায়াল প্যাক (7 Days Trial)',
  trial7dDays: 7,
  trial7dDailyLimit: 60,
  trial7dPriceBdt: 499,
  trial7dPriceUsdt: 5,
  monthly1mName: '১ মাসের প্রো ভিআইপি (1 Month VIP)',
  monthly1mDays: 30,
  monthly1mDailyLimit: 200,
  monthly1mPriceBdt: 1499,
  monthly1mPriceUsdt: 15,
  vip6mName: '৬ মাসের এলিট ভিআইপি (6 Months Elite)',
  vip6mDays: 180,
  vip6mDailyLimit: 500,
  vip6mPriceBdt: 5999,
  vip6mPriceUsdt: 55,
  lifetimeName: 'লাইফটাইম ভিআইপি অ্যাক্সেস (Lifetime VIP)',
  lifetimeDays: 3650,
  lifetimeDailyLimit: 0, // 0 = Unlimited
  lifetimePriceBdt: 9999,
  lifetimePriceUsdt: 90,
};

export function getDhakaDateKey(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function buildPlansFromSettings(cfg: PlanSettingsConfig): SubscriptionPlan[] {
  const formatDailyFeature = (limit: number) =>
    limit === 0 ? 'দৈনিক আনলিমিটেড AI ও স্ক্রিন স্ক্যান' : `প্রতিদিন সর্বোচ্চ ${limit}টি AI ও স্ক্রিন স্ক্যান`;

  return [
    {
      id: 'trial_7d',
      name: cfg.trial7dName,
      durationDays: cfg.trial7dDays,
      dailyScanLimit: cfg.trial7dDailyLimit,
      priceBdt: cfg.trial7dPriceBdt,
      priceUsdt: cfg.trial7dPriceUsdt,
      badge: 'শুরুর জন্য সেরা',
      description: 'নতুন ট্রেডারদের জন্য নিখুঁত টেস্ট ড্রাইভ ও প্রাতিষ্ঠানিক অ্যালগরিদম পরীক্ষা।',
      features: [
        formatDailyFeature(cfg.trial7dDailyLimit),
        `${cfg.trial7dDays} দিন মেয়াদ (রাত ১২টায় ডেইলি লিমিট রিসেট)`,
        'প্রাতিষ্ঠানিক কনফ্লুয়েন্স অ্যালগরিদম ভেরিফিকেশন',
        'রিয়েল-টাইম অডিও বাংলা ভয়েস গাইডেন্স',
      ],
    },
    {
      id: 'monthly_1m',
      name: cfg.monthly1mName,
      durationDays: cfg.monthly1mDays,
      dailyScanLimit: cfg.monthly1mDailyLimit,
      priceBdt: cfg.monthly1mPriceBdt,
      priceUsdt: cfg.monthly1mPriceUsdt,
      badge: 'সবচেয়ে জনপ্রিয় 🔥',
      description: 'নিয়মিত প্রফিটেবল ট্রেডারদের এক মাসের সম্পূর্ণ অটোমেটেড সাপোর্ট।',
      features: [
        formatDailyFeature(cfg.monthly1mDailyLimit),
        `${cfg.monthly1mDays} দিন মেয়াদ ও ফ্লোটিং মিনি বাবল`,
        'অ্যাডভান্সড স্পাইক ফিল্টার এবং সাইডওয়েজ শিল্ড',
        'হাই একুরেসি ১-ক্লিক টার্মিনাল ক্যালকুলেশন',
      ],
    },
    {
      id: 'vip_6m',
      name: cfg.vip6mName,
      durationDays: cfg.vip6mDays,
      dailyScanLimit: cfg.vip6mDailyLimit,
      priceBdt: cfg.vip6mPriceBdt,
      priceUsdt: cfg.vip6mPriceUsdt,
      badge: 'সেরা ভ্যালু (৩৫% ডিসকাউন্ট)',
      description: 'অভিজ্ঞ ও ক্যারিয়ার ট্রেডারদের দীর্ঘমেয়াদী নির্ভুল ট্রেডিং সহকারী।',
      features: [
        formatDailyFeature(cfg.vip6mDailyLimit),
        `${cfg.vip6mDays} দিন নিরবচ্ছিন্ন প্রো সার্ভিস`,
        'প্রাইওরিটি সার্ভার প্রসেসিং স্পিড (<100ms)',
        'সরাসরি অ্যাডমিন প্রায়োরিটি হেল্পডেস্ক',
      ],
    },
    {
      id: 'lifetime_vip',
      name: cfg.lifetimeName,
      durationDays: cfg.lifetimeDays,
      dailyScanLimit: cfg.lifetimeDailyLimit,
      priceBdt: cfg.lifetimePriceBdt,
      priceUsdt: cfg.lifetimePriceUsdt,
      badge: 'লাইফটাইম ভিআইপি 👑',
      description: 'একবার পেমেন্ট করে দীর্ঘমেয়াদে ট্রেডপালস এআই প্রিমিয়াম সুবিধা উপভোগ করুন।',
      features: [
        formatDailyFeature(cfg.lifetimeDailyLimit),
        `${cfg.lifetimeDays >= 3650 ? 'আজীবন' : `${cfg.lifetimeDays} দিন`} প্রাইভেট ভিআইপি অ্যাক্সেস`,
        'পরবর্তী সব বড় মেকানিকাল ও নিউরাল আপডেট ফ্রি',
        'অ্যান্ড্রয়েড + পিসি বাবল ও ক্রোম এক্সটেনশন সাপোর্ট',
      ],
    },
  ];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = buildPlansFromSettings(DEFAULT_PLAN_SETTINGS);

const DEFAULT_PAYMENT_CONFIG: PaymentGatewaysConfig = {
  bkashNumber: '01886888494',
  bkashType: 'Personal (Send Money)',
  nagadNumber: '01886888494',
  nagadType: 'Personal (Send Money)',
  rocketNumber: '018868884947',
  binanceUsdtAddress: 'TCZt7w9V2WvL9wLpYpQwerTyUiopASdfGh',
  binanceNetwork: 'TRC-20 (Tron Network)',
  instructionBn:
    'যেকোনো মাধ্যমে টাকা পাঠিয়ে ফর্মটিতে প্রেরক নম্বর ও TrxID লিখে সাবমিট করুন। অ্যাডমিন ভেরিফাই করে ৫-১৫ মিনিটের মধ্যে অ্যাক্সেস সক্রিয় করবেন।',
};

const STORAGE_KEY_AUTH = 'tradepulse_current_user_session';
const STORAGE_KEY_TOKEN = 'tradepulse_auth_token';
const STORAGE_KEY_PLANS = 'tradepulse_plan_settings_cache';

type AuthListener = (user: User | null) => void;
type PlanListener = (settings: PlanSettingsConfig, plans: SubscriptionPlan[]) => void;
type UpgradeListener = (reason?: string) => void;

function toEpochMs(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function mapPlanSettingsDoc(d: Record<string, unknown>): PlanSettingsConfig {
  return {
    freeTrialScans: typeof d.freeTrialScans === 'number' ? d.freeTrialScans : DEFAULT_PLAN_SETTINGS.freeTrialScans,
    trial7dName: String(d.trial7dName || DEFAULT_PLAN_SETTINGS.trial7dName),
    trial7dDays: typeof d.trial7dDays === 'number' ? d.trial7dDays : DEFAULT_PLAN_SETTINGS.trial7dDays,
    trial7dDailyLimit: typeof d.trial7dDailyLimit === 'number' ? d.trial7dDailyLimit : DEFAULT_PLAN_SETTINGS.trial7dDailyLimit,
    trial7dPriceBdt: typeof d.trial7dPriceBdt === 'number' ? d.trial7dPriceBdt : DEFAULT_PLAN_SETTINGS.trial7dPriceBdt,
    trial7dPriceUsdt: typeof d.trial7dPriceUsdt === 'number' ? d.trial7dPriceUsdt : DEFAULT_PLAN_SETTINGS.trial7dPriceUsdt,
    monthly1mName: String(d.monthly1mName || DEFAULT_PLAN_SETTINGS.monthly1mName),
    monthly1mDays: typeof d.monthly1mDays === 'number' ? d.monthly1mDays : DEFAULT_PLAN_SETTINGS.monthly1mDays,
    monthly1mDailyLimit: typeof d.monthly1mDailyLimit === 'number' ? d.monthly1mDailyLimit : DEFAULT_PLAN_SETTINGS.monthly1mDailyLimit,
    monthly1mPriceBdt: typeof d.monthly1mPriceBdt === 'number' ? d.monthly1mPriceBdt : DEFAULT_PLAN_SETTINGS.monthly1mPriceBdt,
    monthly1mPriceUsdt: typeof d.monthly1mPriceUsdt === 'number' ? d.monthly1mPriceUsdt : DEFAULT_PLAN_SETTINGS.monthly1mPriceUsdt,
    vip6mName: String(d.vip6mName || DEFAULT_PLAN_SETTINGS.vip6mName),
    vip6mDays: typeof d.vip6mDays === 'number' ? d.vip6mDays : DEFAULT_PLAN_SETTINGS.vip6mDays,
    vip6mDailyLimit: typeof d.vip6mDailyLimit === 'number' ? d.vip6mDailyLimit : DEFAULT_PLAN_SETTINGS.vip6mDailyLimit,
    vip6mPriceBdt: typeof d.vip6mPriceBdt === 'number' ? d.vip6mPriceBdt : DEFAULT_PLAN_SETTINGS.vip6mPriceBdt,
    vip6mPriceUsdt: typeof d.vip6mPriceUsdt === 'number' ? d.vip6mPriceUsdt : DEFAULT_PLAN_SETTINGS.vip6mPriceUsdt,
    lifetimeName: String(d.lifetimeName || DEFAULT_PLAN_SETTINGS.lifetimeName),
    lifetimeDays: typeof d.lifetimeDays === 'number' ? d.lifetimeDays : DEFAULT_PLAN_SETTINGS.lifetimeDays,
    lifetimeDailyLimit: typeof d.lifetimeDailyLimit === 'number' ? d.lifetimeDailyLimit : DEFAULT_PLAN_SETTINGS.lifetimeDailyLimit,
    lifetimePriceBdt: typeof d.lifetimePriceBdt === 'number' ? d.lifetimePriceBdt : DEFAULT_PLAN_SETTINGS.lifetimePriceBdt,
    lifetimePriceUsdt: typeof d.lifetimePriceUsdt === 'number' ? d.lifetimePriceUsdt : DEFAULT_PLAN_SETTINGS.lifetimePriceUsdt,
  };
}

function mapFirestoreUser(
  data: Record<string, unknown>,
  uid: string,
  planSettings: PlanSettingsConfig = DEFAULT_PLAN_SETTINGS
): User {
  const email = String(data.email || '');
  const isBootstrappedAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
  const role = isBootstrappedAdmin ? 'admin' : data.role === 'admin' ? 'admin' : 'user';
  const today = getDhakaDateKey();
  const storedDate = typeof data.lastScanDate === 'string' ? data.lastScanDate : today;
  const rawDailyUsed = typeof data.dailyScansUsed === 'number' ? data.dailyScansUsed : 0;
  const effectiveDailyUsed = storedDate === today ? rawDailyUsed : 0;

  const planId = data.planId ? String(data.planId) : undefined;
  let inferredPlanDailyLimit = 200;
  if (planId === 'trial_7d') inferredPlanDailyLimit = planSettings.trial7dDailyLimit;
  else if (planId === 'monthly_1m') inferredPlanDailyLimit = planSettings.monthly1mDailyLimit;
  else if (planId === 'vip_6m') inferredPlanDailyLimit = planSettings.vip6mDailyLimit;
  else if (planId === 'lifetime_vip') inferredPlanDailyLimit = planSettings.lifetimeDailyLimit;
  else if (role === 'admin') inferredPlanDailyLimit = 0;

  const dailyScanLimit =
    typeof data.dailyScanLimit === 'number' ? data.dailyScanLimit : inferredPlanDailyLimit;

  const scanQuota: UserScanQuota = {
    freeScansLimit:
      typeof data.freeScansLimit === 'number'
        ? data.freeScansLimit
        : planSettings.freeTrialScans,
    freeScansUsed: typeof data.freeScansUsed === 'number' ? data.freeScansUsed : 0,
    dailyScansUsed: effectiveDailyUsed,
    lastScanDate: storedDate,
    totalScansUsed: typeof data.totalScansUsed === 'number' ? data.totalScansUsed : 0,
    dailyScanLimit,
    customDailyScanLimit:
      typeof data.customDailyScanLimit === 'number'
        ? data.customDailyScanLimit
        : role === 'admin'
        ? 0
        : -1,
  };

  return {
    id: String(data.uid || uid),
    name: String(data.name || 'Trader'),
    email,
    phone: data.phone ? String(data.phone) : undefined,
    role,
    status: (data.accountStatus as 'active' | 'suspended' | 'banned') || 'active',
    subscription: {
      status: (data.subscriptionStatus as SubscriptionStatus) || (role === 'admin' ? 'ACTIVE' : 'NONE'),
      planId,
      planName: data.planName ? String(data.planName) : undefined,
      startDate: typeof data.startDate === 'number' ? data.startDate : undefined,
      expiresAt: typeof data.expiresAt === 'number' && data.expiresAt > 0 ? data.expiresAt : undefined,
      dailyScanLimit,
      paymentMethod: data.paymentMethod ? (String(data.paymentMethod) as PaymentMethodType) : undefined,
      senderNumber: data.senderNumber ? String(data.senderNumber) : undefined,
      trxId: data.trxId ? String(data.trxId) : undefined,
      requestedAt: typeof data.requestedAt === 'number' ? data.requestedAt : undefined,
      approvedAt: typeof data.approvedAt === 'number' ? data.approvedAt : undefined,
      approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    },
    scanQuota,
    createdAt: toEpochMs(data.createdAt),
    lastLoginAt: toEpochMs(data.updatedAt),
  };
}

class AuthService {
  private currentUser: User | null = null;
  private token: string | null = null;
  private planSettings: PlanSettingsConfig = DEFAULT_PLAN_SETTINGS;
  private listeners: Set<AuthListener> = new Set();
  private planListeners: Set<PlanListener> = new Set();
  private upgradeListeners: Set<UpgradeListener> = new Set();
  private userDocUnsub: Unsubscribe | null = null;
  private planDocUnsub: Unsubscribe | null = null;
  private scanWriteQueue: Promise<unknown> = Promise.resolve();
  private keepTerminalUnlockedUntilNextClick: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      const cachedPlans = localStorage.getItem(STORAGE_KEY_PLANS);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
      if (token) {
        this.token = token;
      }
      if (cachedPlans) {
        this.planSettings = { ...DEFAULT_PLAN_SETTINGS, ...JSON.parse(cachedPlans) };
      }
    } catch {
      // ignore storage read errors
    }

    // Load live plan settings from backend REST first (works even before login)
    this.fetchBackendPlanSettings().catch(() => {});

    // Listen to Firebase Auth state changes for real-time 1-click Gmail sync
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        this.attachPlanSettingsSnapshot();
        await this.syncFirebaseUser(fbUser);
      } else {
        this.detachUserSnapshot();
        this.detachPlanSnapshot();
        // Keep Express/local session if active and not a Firebase-backed session
        if (this.token === 'firebase_google_auth') {
          this.clearLocalSession();
        } else if (this.currentUser) {
          this.refreshProfile().catch(() => {});
        }
      }
    });
  }

  private async fetchBackendPlanSettings(): Promise<PlanSettingsConfig> {
    try {
      const res = await fetch(getApiUrl('/api/plans/config'));
      if (res.ok) {
        const data = await res.json();
        if (data?.config) {
          this.updateLocalPlanSettings(mapPlanSettingsDoc(data.config));
        }
      }
    } catch {
      // ignore offline cache fallback
    }
    return this.planSettings;
  }

  private updateLocalPlanSettings(cfg: PlanSettingsConfig) {
    this.planSettings = cfg;
    try {
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(cfg));
    } catch {
      // ignore storage quota errors
    }
    const plans = buildPlansFromSettings(cfg);
    this.planListeners.forEach((fn) => fn(cfg, plans));
    this.notify();
  }

  private attachPlanSettingsSnapshot() {
    if (this.planDocUnsub) return;
    const path = 'planSettings/default';
    this.planDocUnsub = onSnapshot(
      doc(db, 'planSettings', 'default'),
      (snap) => {
        if (snap.exists()) {
          this.updateLocalPlanSettings(mapPlanSettingsDoc(snap.data() as Record<string, unknown>));
        }
      },
      (err) => {
        console.warn(`Firestore ${path} listener fallback:`, err);
      }
    );
  }

  private detachPlanSnapshot() {
    if (this.planDocUnsub) {
      this.planDocUnsub();
      this.planDocUnsub = null;
    }
  }

  private detachUserSnapshot() {
    if (this.userDocUnsub) {
      this.userDocUnsub();
      this.userDocUnsub = null;
    }
  }

  private async ensureFirestoreUserDoc(fbUser: FirebaseUser): Promise<User> {
    const uid = fbUser.uid.slice(0, 128);
    const userRef = doc(db, 'users', uid);
    const path = `users/${uid}`;

    try {
      // Ensure we know the admin-configured freeTrialScans before creating user doc
      try {
        const planSnap = await getDoc(doc(db, 'planSettings', 'default'));
        if (planSnap.exists()) {
          this.updateLocalPlanSettings(mapPlanSettingsDoc(planSnap.data() as Record<string, unknown>));
        }
      } catch {
        // use cached planSettings
      }

      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return mapFirestoreUser(snap.data() as Record<string, unknown>, uid, this.planSettings);
      }

      const email = (fbUser.email || 'user@gmail.com').slice(0, 200);
      const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());
      const displayName = (fbUser.displayName || email.split('@')[0] || 'Gmail User').slice(0, 100);
      const photoURL = fbUser.photoURL ? fbUser.photoURL.slice(0, 500) : '';
      const today = getDhakaDateKey();
      const freeLimit = this.planSettings.freeTrialScans;

      const newUserDoc: Record<string, unknown> = {
        uid,
        name: displayName,
        email,
        role: isAdminEmail ? 'admin' : 'user',
        accountStatus: 'active',
        subscriptionStatus: isAdminEmail ? 'ACTIVE' : 'NONE',
        expiresAt: isAdminEmail ? Date.now() + 1000 * 60 * 60 * 24 * 3650 : 0,
        freeScansLimit: freeLimit,
        freeScansUsed: 0,
        dailyScansUsed: 0,
        lastScanDate: today,
        totalScansUsed: 0,
        dailyScanLimit: 0,
        customDailyScanLimit: isAdminEmail ? 0 : -1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (photoURL) {
        newUserDoc.photoURL = photoURL;
      }
      if (isAdminEmail) {
        newUserDoc.planName = 'Master Admin Access';
      }

      await setDoc(userRef, newUserDoc);

      return {
        id: uid,
        name: displayName,
        email,
        role: isAdminEmail ? 'admin' : 'user',
        status: 'active',
        subscription: {
          status: isAdminEmail ? 'ACTIVE' : 'NONE',
          planName: isAdminEmail ? 'Master Admin Access' : undefined,
          expiresAt: isAdminEmail ? Date.now() + 1000 * 60 * 60 * 24 * 3650 : undefined,
          dailyScanLimit: 0,
        },
        scanQuota: {
          freeScansLimit: freeLimit,
          freeScansUsed: 0,
          dailyScansUsed: 0,
          lastScanDate: today,
          totalScansUsed: 0,
          dailyScanLimit: 0,
          customDailyScanLimit: isAdminEmail ? 0 : -1,
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  private async syncFirebaseUser(fbUser: FirebaseUser) {
    try {
      const user = await this.ensureFirestoreUserDoc(fbUser);
      this.setCurrentUserSession(user, 'firebase_google_auth');

      this.detachUserSnapshot();
      const path = `users/${fbUser.uid}`;
      this.userDocUnsub = onSnapshot(
        doc(db, 'users', fbUser.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const updatedUser = mapFirestoreUser(
              snapshot.data() as Record<string, unknown>,
              fbUser.uid,
              this.planSettings
            );
            this.setCurrentUserSession(updatedUser, 'firebase_google_auth');
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, path);
        }
      );
    } catch (err) {
      console.error('Failed to sync Firebase user:', err);
    }
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.currentUser);
    return () => this.listeners.delete(listener);
  }

  public subscribePlans(listener: PlanListener): () => void {
    this.planListeners.add(listener);
    listener(this.planSettings, this.getPlans());
    return () => this.planListeners.delete(listener);
  }

  public subscribeUpgradePrompt(listener: UpgradeListener): () => void {
    this.upgradeListeners.add(listener);
    return () => this.upgradeListeners.delete(listener);
  }

  public requestUpgradeModal(reason?: string): void {
    this.upgradeListeners.forEach((fn) => fn(reason));
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentUser));
  }

  public getUser(): User | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return this.token;
  }

  public getPlanSettings(): PlanSettingsConfig {
    return this.planSettings;
  }

  public getPlans(): SubscriptionPlan[] {
    return buildPlansFromSettings(this.planSettings);
  }

  public isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  public hasActiveSubscription(): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;

    const sub = this.currentUser.subscription;
    if (!sub) return false;
    if (sub.status !== 'ACTIVE') return false;

    if (sub.expiresAt && Date.now() > sub.expiresAt) {
      return false;
    }
    return true;
  }

  public getDaysRemaining(): number {
    if (!this.currentUser) return 0;
    if (this.currentUser.role === 'admin') return 9999;
    const expiresAt = this.currentUser.subscription?.expiresAt;
    if (!expiresAt) return 0;
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  public getScanQuotaStatus(): EffectiveScanQuotaStatus {
    const u = this.currentUser;
    const defaultFree = this.planSettings.freeTrialScans;

    if (!u) {
      return {
        mode: 'EXHAUSTED',
        canScan: false,
        freeLimit: defaultFree,
        freeUsed: 0,
        freeRemaining: defaultFree,
        dailyLimit: 0,
        dailyUsed: 0,
        dailyRemaining: null,
        totalScansUsed: 0,
        daysRemaining: 0,
        blockReasonBn: 'স্ক্যান শুরু করতে প্রথমে লগইন করুন।',
      };
    }

    const q = u.scanQuota || {
      freeScansLimit: defaultFree,
      freeScansUsed: 0,
      dailyScansUsed: 0,
      lastScanDate: getDhakaDateKey(),
      totalScansUsed: 0,
      dailyScanLimit: 0,
      customDailyScanLimit: u.role === 'admin' ? 0 : -1,
    };

    const today = getDhakaDateKey();
    const dailyUsed = q.lastScanDate === today ? q.dailyScansUsed : 0;
    const freeLimit = typeof q.freeScansLimit === 'number' ? q.freeScansLimit : defaultFree;
    const freeUsed = q.freeScansUsed || 0;
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const totalScansUsed = q.totalScansUsed || 0;

    if (u.role === 'admin') {
      return {
        mode: 'ADMIN',
        canScan: true,
        freeLimit,
        freeUsed,
        freeRemaining,
        dailyLimit: 0,
        dailyUsed,
        dailyRemaining: null,
        totalScansUsed,
        daysRemaining: 9999,
      };
    }

    if (u.status === 'banned' || u.status === 'suspended') {
      return {
        mode: 'EXHAUSTED',
        canScan: false,
        freeLimit,
        freeUsed,
        freeRemaining: 0,
        dailyLimit: 0,
        dailyUsed,
        dailyRemaining: 0,
        totalScansUsed,
        daysRemaining: 0,
        blockReasonBn: 'আপনার অ্যাকাউন্টটি স্থগিত করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।',
      };
    }

    const isPaidActive = this.hasActiveSubscription();
    if (isPaidActive) {
      const effectiveDailyLimit =
        q.customDailyScanLimit >= 0 ? q.customDailyScanLimit : (q.dailyScanLimit || u.subscription?.dailyScanLimit || 0);
      const dailyRemaining =
        effectiveDailyLimit === 0 ? null : Math.max(0, effectiveDailyLimit - dailyUsed);
      const canScan = effectiveDailyLimit === 0 || dailyUsed < effectiveDailyLimit;

      return {
        mode: canScan ? 'PAID' : 'EXHAUSTED',
        canScan,
        freeLimit,
        freeUsed,
        freeRemaining,
        dailyLimit: effectiveDailyLimit,
        dailyUsed,
        dailyRemaining,
        totalScansUsed,
        daysRemaining: this.getDaysRemaining(),
        blockReasonBn: canScan
          ? undefined
          : `আজকের দৈনিক স্ক্যান লিমিট (${effectiveDailyLimit}টি) শেষ হয়েছে! রাত ১২:০০টায় (বাংলাদেশ সময়) পুনরায় রিসেট হবে।`,
      };
    }

    // Non-paid user -> Free Starter Scans
    const canScanFree = freeUsed < freeLimit;
    return {
      mode: canScanFree ? 'FREE_TRIAL' : 'EXHAUSTED',
      canScan: canScanFree,
      freeLimit,
      freeUsed,
      freeRemaining,
      dailyLimit: 0,
      dailyUsed,
      dailyRemaining: null,
      totalScansUsed,
      daysRemaining: 0,
      blockReasonBn: canScanFree
        ? undefined
        : `আপনার ফ্রি ${freeLimit}টি স্টার্টার স্ক্যান শেষ হয়েছে। চালিয়ে যেতে একটি ভিআইপি সাবস্ক্রিপশন প্ল্যান নিন।`,
    };
  }

  public canEnterTerminal(): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;
    if (this.hasActiveSubscription()) return true;
    if (this.keepTerminalUnlockedUntilNextClick) return true;
    const quota = this.getScanQuotaStatus();
    return quota.freeRemaining > 0;
  }

  public checkScanAllowance(): {
    allowed: boolean;
    mode: EffectiveScanQuotaStatus['mode'];
    reasonBn?: string;
  } {
    const status = this.getScanQuotaStatus();
    if (!status.canScan) {
      this.keepTerminalUnlockedUntilNextClick = false;
      this.requestUpgradeModal(status.blockReasonBn);
      return {
        allowed: false,
        mode: status.mode,
        reasonBn: status.blockReasonBn,
      };
    }
    return {
      allowed: true,
      mode: status.mode,
    };
  }

  /**
   * Atomically deducts +1 scan count AFTER a genuine scan completes.
   * Serialized via queue to guarantee zero double-counting or race conditions.
   */
  public async recordCompletedScan(_source: string = 'scan'): Promise<{
    success: boolean;
    error?: string;
    exhaustedAfter?: boolean;
  }> {
    const task = this.scanWriteQueue.then(() => this.performRecordScan());
    this.scanWriteQueue = task.catch(() => {});
    return task;
  }

  private async performRecordScan(): Promise<{
    success: boolean;
    error?: string;
    exhaustedAfter?: boolean;
  }> {
    if (!this.currentUser) {
      return { success: false, error: 'লগইন করা নেই' };
    }

    const today = getDhakaDateKey();

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      const userRef = doc(db, 'users', uid);
      const path = `users/${uid}`;

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          return { success: false, error: 'প্রোফাইল পাওয়া যায়নি' };
        }
        const raw = snap.data() as Record<string, unknown>;
        const prevTotal = typeof raw.totalScansUsed === 'number' ? raw.totalScansUsed : 0;
        const prevFreeUsed = typeof raw.freeScansUsed === 'number' ? raw.freeScansUsed : 0;
        const prevFreeLimit =
          typeof raw.freeScansLimit === 'number'
            ? raw.freeScansLimit
            : this.planSettings.freeTrialScans;
        const prevDailyUsed = typeof raw.dailyScansUsed === 'number' ? raw.dailyScansUsed : 0;
        const prevDate = typeof raw.lastScanDate === 'string' ? raw.lastScanDate : '';
        const customLimit =
          typeof raw.customDailyScanLimit === 'number' ? raw.customDailyScanLimit : -1;
        const planLimit = typeof raw.dailyScanLimit === 'number' ? raw.dailyScanLimit : 0;
        const effectiveDailyLimit = customLimit >= 0 ? customLimit : planLimit;

        const isAdminUser =
          ADMIN_EMAILS.includes(String(raw.email || '').toLowerCase()) || raw.role === 'admin';
        const expiresAt = typeof raw.expiresAt === 'number' ? raw.expiresAt : 0;
        const isPaidActive = raw.subscriptionStatus === 'ACTIVE' && expiresAt > Date.now();

        if (isAdminUser) {
          const nextDaily = prevDate === today ? prevDailyUsed + 1 : 1;
          await updateDoc(userRef, {
            dailyScansUsed: nextDaily,
            lastScanDate: today,
            totalScansUsed: prevTotal + 1,
            updatedAt: serverTimestamp(),
          });
          return { success: true, exhaustedAfter: false };
        }

        if (isPaidActive) {
          const nextDaily = prevDate === today ? prevDailyUsed + 1 : 1;
          if (effectiveDailyLimit > 0 && nextDaily > effectiveDailyLimit) {
            return {
              success: false,
              error: `আজকের দৈনিক স্ক্যান লিমিট (${effectiveDailyLimit}টি) শেষ হয়েছে।`,
            };
          }

          await updateDoc(userRef, {
            freeScansUsed: prevFreeUsed,
            dailyScansUsed: nextDaily,
            lastScanDate: today,
            totalScansUsed: prevTotal + 1,
            updatedAt: serverTimestamp(),
          });

          const exhaustedAfter = effectiveDailyLimit > 0 && nextDaily >= effectiveDailyLimit;
          return { success: true, exhaustedAfter };
        } else {
          if (prevFreeUsed >= prevFreeLimit) {
            return {
              success: false,
              error: `আপনার ফ্রি ${prevFreeLimit}টি স্টার্টার স্ক্যান শেষ হয়েছে।`,
            };
          }

          const nextFreeUsed = prevFreeUsed + 1;
          // Allow user to inspect the last free scan result until they try clicking again or reload
          if (nextFreeUsed >= prevFreeLimit) {
            this.keepTerminalUnlockedUntilNextClick = true;
          }

          await updateDoc(userRef, {
            freeScansUsed: nextFreeUsed,
            dailyScansUsed: prevDailyUsed,
            lastScanDate: today,
            totalScansUsed: prevTotal + 1,
            updatedAt: serverTimestamp(),
          });

          return { success: true, exhaustedAfter: nextFreeUsed >= prevFreeLimit };
        }
      } catch (error) {
        console.error('Firestore scan increment error:', error);
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    // Express backend session path
    try {
      const res = await fetch(getApiUrl('/api/auth/consume-scan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token || ''}`,
        },
        body: JSON.stringify({ userId: this.currentUser.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data?.error || 'স্ক্যান লিমিট শেষ হয়েছে' };
      }

      if (data.user) {
        const updatedUser: User = data.user;
        const q = updatedUser.scanQuota;
        const isLastFree =
          updatedUser.role !== 'admin' &&
          !this.hasActiveSubscription() &&
          q &&
          q.freeScansUsed >= q.freeScansLimit;
        if (isLastFree) {
          this.keepTerminalUnlockedUntilNextClick = true;
        }
        this.setCurrentUserSession(updatedUser, this.token || '');
      }
      const statusAfter = this.getScanQuotaStatus();
      return { success: true, exhaustedAfter: !statusAfter.canScan };
    } catch {
      return { success: false, error: 'স্ক্যান কাউন্ট আপডেট করতে সমস্যা হয়েছে' };
    }
  }

  // --- 1-CLICK GMAIL / GOOGLE AUTHENTICATION ---

  public async loginWithGoogle(): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      this.keepTerminalUnlockedUntilNextClick = false;
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const user = await this.ensureFirestoreUserDoc(fbUser);
      this.setCurrentUserSession(user, 'firebase_google_auth');
      return { success: true, user };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('popup-closed-by-user')) {
        return { success: false, error: 'জিমেইল লগইন পপআপটি বন্ধ করা হয়েছে। আবার চেষ্টা করুন।' };
      }
      if (msg.includes('popup-blocked')) {
        return { success: false, error: 'ব্রাউজারে পপআপ ব্লক করা আছে। অনুগ্রহ করে পপআপ অনুমতি দিন।' };
      }
      return { success: false, error: 'জিমেইল দিয়ে লগইন ব্যর্থ হয়েছে: ' + msg };
    }
  }

  // --- REAL EMAIL / PASSWORD AUTHENTICATION API CALLS ---

  public async login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      this.keepTerminalUnlockedUntilNextClick = false;
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || data.message || 'লগইন ব্যর্থ হয়েছে।' };
      }

      this.setCurrentUserSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch {
      return {
        success: false,
        error: 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন অথবা জিমেইল দিয়ে লগইন করুন।',
      };
    }
  }

  public async register(
    name: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      this.keepTerminalUnlockedUntilNextClick = false;
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || data.message || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।' };
      }

      this.setCurrentUserSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch {
      return {
        success: false,
        error: 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করুন অথবা জিমেইল দিয়ে রেজিস্ট্রেশন করুন।',
      };
    }
  }

  public async refreshProfile(): Promise<User | null> {
    if (!this.currentUser) return null;

    if (auth.currentUser) {
      const path = `users/${auth.currentUser.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (snap.exists()) {
          const updated = mapFirestoreUser(
            snap.data() as Record<string, unknown>,
            auth.currentUser.uid,
            this.planSettings
          );
          this.setCurrentUserSession(updated, 'firebase_google_auth');
          return updated;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      return this.currentUser;
    }

    try {
      const res = await fetch(getApiUrl(`/api/auth/me?userId=${encodeURIComponent(this.currentUser.id)}`), {
        headers: {
          Authorization: `Bearer ${this.token || ''}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.currentUser = data.user;
          localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(this.currentUser));
          this.notify();
          return this.currentUser;
        }
      }
    } catch {
      // ignore transient network check
    }
    return this.currentUser;
  }

  public async submitSubscription(
    planId: string,
    paymentMethod: PaymentMethodType,
    senderNumber: string,
    trxId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) return { success: false, error: 'অনুগ্রহ করে প্রথমে লগইন করুন' };

    const plans = this.getPlans();
    const plan = plans.find((p) => p.id === planId) || plans[1];

    // If signed in with Firebase Google Auth, persist to Firestore directly
    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      const reqId = `req_${Date.now()}_${uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8)}`;
      const reqPath = `subscriptionRequests/${reqId}`;

      try {
        const batch = writeBatch(db);
        const nowMs = Date.now();
        const cleanSender = senderNumber.trim().slice(0, 80);
        const cleanTrx = trxId.trim().slice(0, 100);

        const reqPayload: Record<string, unknown> = {
          id: reqId,
          userId: uid,
          userName: this.currentUser.name.slice(0, 100),
          userEmail: this.currentUser.email.slice(0, 200),
          planId: plan.id.slice(0, 50),
          planName: plan.name.slice(0, 120),
          durationDays: plan.durationDays,
          dailyScanLimit: plan.dailyScanLimit,
          priceBdt: plan.priceBdt,
          priceUsdt: plan.priceUsdt,
          paymentMethod,
          senderNumber: cleanSender,
          trxId: cleanTrx,
          status: 'PENDING',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (this.currentUser.phone) {
          reqPayload.userPhone = this.currentUser.phone.slice(0, 30);
        }

        batch.set(doc(db, 'subscriptionRequests', reqId), reqPayload);
        batch.update(doc(db, 'users', uid), {
          subscriptionStatus: 'PENDING',
          planId: plan.id.slice(0, 50),
          planName: plan.name.slice(0, 120),
          paymentMethod,
          senderNumber: cleanSender,
          trxId: cleanTrx,
          requestedAt: nowMs,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        return { success: true };
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, reqPath);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/subscription/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.id,
          planId: plan.id,
          planName: plan.name,
          durationDays: plan.durationDays,
          dailyScanLimit: plan.dailyScanLimit,
          priceBdt: plan.priceBdt,
          priceUsdt: plan.priceUsdt,
          paymentMethod,
          senderNumber,
          trxId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || data.message || 'রিকোয়েস্ট সাবমিট ব্যর্থ হয়েছে।' };
      }

      if (data.subscription) {
        this.currentUser.subscription = data.subscription;
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(this.currentUser));
        this.notify();
      }
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
      };
    }
  }

  public async getPaymentConfig(): Promise<PaymentGatewaysConfig> {
    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, 'paymentConfig', 'default'));
        if (snap.exists()) {
          const d = snap.data();
          return {
            bkashNumber: String(d.bkashNumber || DEFAULT_PAYMENT_CONFIG.bkashNumber),
            bkashType: String(d.bkashType || DEFAULT_PAYMENT_CONFIG.bkashType),
            nagadNumber: String(d.nagadNumber || DEFAULT_PAYMENT_CONFIG.nagadNumber),
            nagadType: String(d.nagadType || DEFAULT_PAYMENT_CONFIG.nagadType),
            rocketNumber: String(d.rocketNumber || DEFAULT_PAYMENT_CONFIG.rocketNumber),
            binanceUsdtAddress: String(d.binanceUsdtAddress || DEFAULT_PAYMENT_CONFIG.binanceUsdtAddress),
            binanceNetwork: String(d.binanceNetwork || DEFAULT_PAYMENT_CONFIG.binanceNetwork),
            instructionBn: String(d.instructionBn || DEFAULT_PAYMENT_CONFIG.instructionBn),
          };
        }
      } catch (error) {
        console.warn('Firestore paymentConfig read fallback:', error);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/payment/config'));
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // fallback to default payment numbers
    }

    return DEFAULT_PAYMENT_CONFIG;
  }

  public async fetchPlanSettings(): Promise<PlanSettingsConfig> {
    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, 'planSettings', 'default'));
        if (snap.exists()) {
          const mapped = mapPlanSettingsDoc(snap.data() as Record<string, unknown>);
          this.updateLocalPlanSettings(mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Firestore planSettings fetch fallback:', err);
      }
    }
    return this.fetchBackendPlanSettings();
  }

  // --- ADMIN FUNCTIONS ---

  public async adminGetAllUsers(): Promise<User[]> {
    if (auth.currentUser && this.isAdmin()) {
      const path = 'users';
      try {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map((d) =>
          mapFirestoreUser(d.data() as Record<string, unknown>, d.id, this.planSettings)
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/users'), {
        headers: { Authorization: `Bearer ${this.token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch {
      // ignore error
    }
    return this.currentUser ? [this.currentUser] : [];
  }

  public async adminGetRequests(): Promise<SubscriptionRequest[]> {
    if (auth.currentUser && this.isAdmin()) {
      const path = 'subscriptionRequests';
      try {
        const q = query(collection(db, 'subscriptionRequests'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            userId: String(data.userId || ''),
            userName: String(data.userName || ''),
            userEmail: String(data.userEmail || ''),
            userPhone: data.userPhone ? String(data.userPhone) : undefined,
            planId: String(data.planId || ''),
            planName: String(data.planName || ''),
            durationDays: Number(data.durationDays || 30),
            dailyScanLimit: typeof data.dailyScanLimit === 'number' ? data.dailyScanLimit : undefined,
            priceBdt: Number(data.priceBdt || 0),
            priceUsdt: Number(data.priceUsdt || 0),
            paymentMethod: (data.paymentMethod || 'bkash') as PaymentMethodType,
            senderNumber: String(data.senderNumber || ''),
            trxId: String(data.trxId || ''),
            status: (data.status || 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
            createdAt: toEpochMs(data.createdAt),
            reviewedAt: data.updatedAt ? toEpochMs(data.updatedAt) : undefined,
            reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
            notes: data.notes ? String(data.notes) : undefined,
          };
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/requests'), {
        headers: { Authorization: `Bearer ${this.token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.requests || [];
      }
    } catch {
      // ignore error
    }
    return [];
  }

  public async adminReviewRequest(
    requestId: string,
    action: 'approve' | 'reject',
    notes?: string
  ): Promise<boolean> {
    if (auth.currentUser && this.isAdmin()) {
      const reqRef = doc(db, 'subscriptionRequests', requestId);
      const path = `subscriptionRequests/${requestId}`;
      try {
        const reqSnap = await getDoc(reqRef);
        if (!reqSnap.exists()) return false;
        const reqData = reqSnap.data();
        const userId = String(reqData.userId);
        const durationDays = Number(reqData.durationDays || 30);
        const planId = String(reqData.planId || '').slice(0, 50);
        const matchingPlan = this.getPlans().find((p) => p.id === planId);
        const resolvedDailyLimit =
          typeof reqData.dailyScanLimit === 'number'
            ? reqData.dailyScanLimit
            : (matchingPlan?.dailyScanLimit ?? 200);
        const adminEmail = (auth.currentUser.email || this.currentUser?.email || 'admin').slice(0, 200);

        const batch = writeBatch(db);
        const reqUpdate: Record<string, unknown> = {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          reviewedBy: adminEmail,
          updatedAt: serverTimestamp(),
        };
        if (notes) {
          reqUpdate.notes = notes.slice(0, 300);
        }
        batch.update(reqRef, reqUpdate);

        if (action === 'approve') {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          const existingExpiry = userSnap.exists() ? Number(userSnap.data().expiresAt || 0) : 0;
          const nowMs = Date.now();
          const baseTime = existingExpiry > nowMs ? existingExpiry : nowMs;
          const newExpiry = baseTime + durationDays * 24 * 60 * 60 * 1000;

          batch.update(userRef, {
            subscriptionStatus: 'ACTIVE',
            planId,
            planName: String(reqData.planName || '').slice(0, 120),
            dailyScanLimit: resolvedDailyLimit,
            dailyScansUsed: 0,
            lastScanDate: getDhakaDateKey(),
            startDate: nowMs,
            expiresAt: newExpiry,
            approvedAt: nowMs,
            approvedBy: adminEmail,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(doc(db, 'users', userId), {
            subscriptionStatus: 'NONE',
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/review-request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token || ''}`,
        },
        body: JSON.stringify({ requestId, action, notes, adminEmail: this.currentUser?.email }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async adminGrantAccess(targetUserId: string, days: number, dailyScanLimit?: number): Promise<boolean> {
    return this.adminUpdateUserQuota(targetUserId, {
      addDays: days,
      dailyScanLimit,
    });
  }

  public async adminUpdateUserQuota(
    targetUserId: string,
    updates: {
      addDays?: number;
      freeScansLimit?: number;
      freeScansUsed?: number;
      dailyScansUsed?: number;
      customDailyScanLimit?: number;
      dailyScanLimit?: number;
      resetFreeScans?: boolean;
      resetDailyScans?: boolean;
      revokeSubscription?: boolean;
    }
  ): Promise<boolean> {
    if (auth.currentUser && this.isAdmin()) {
      const userRef = doc(db, 'users', targetUserId);
      const path = `users/${targetUserId}`;
      try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return false;
        const data = userSnap.data();
        const nowMs = Date.now();
        const adminEmail = (auth.currentUser.email || this.currentUser?.email || 'admin').slice(0, 200);
        const payload: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };

        if (updates.revokeSubscription) {
          payload.subscriptionStatus = 'NONE';
          payload.expiresAt = 0;
          payload.dailyScanLimit = 0;
        } else if (updates.addDays && updates.addDays > 0) {
          const existingExpiry = Number(data.expiresAt || 0);
          const baseTime = existingExpiry > nowMs ? existingExpiry : nowMs;
          const newExpiry = baseTime + updates.addDays * 24 * 60 * 60 * 1000;
          const resolvedDaily =
            typeof updates.dailyScanLimit === 'number'
              ? updates.dailyScanLimit
              : typeof data.dailyScanLimit === 'number' && data.dailyScanLimit > 0
              ? data.dailyScanLimit
              : this.planSettings.monthly1mDailyLimit;

          payload.subscriptionStatus = 'ACTIVE';
          payload.planId = 'manual_admin_grant';
          payload.planName = `Admin Grant (${updates.addDays} Days)`;
          payload.dailyScanLimit = resolvedDaily;
          payload.startDate = nowMs;
          payload.expiresAt = newExpiry;
          payload.approvedAt = nowMs;
          payload.approvedBy = adminEmail;
        }

        if (typeof updates.freeScansLimit === 'number' && updates.freeScansLimit >= 0) {
          payload.freeScansLimit = Math.round(updates.freeScansLimit);
        }
        if (updates.resetFreeScans) {
          payload.freeScansUsed = 0;
        } else if (typeof updates.freeScansUsed === 'number' && updates.freeScansUsed >= 0) {
          payload.freeScansUsed = Math.round(updates.freeScansUsed);
        }
        if (updates.resetDailyScans) {
          payload.dailyScansUsed = 0;
          payload.lastScanDate = getDhakaDateKey();
        } else if (typeof updates.dailyScansUsed === 'number' && updates.dailyScansUsed >= 0) {
          payload.dailyScansUsed = Math.round(updates.dailyScansUsed);
        }
        if (typeof updates.customDailyScanLimit === 'number' && updates.customDailyScanLimit >= -1) {
          payload.customDailyScanLimit = Math.round(updates.customDailyScanLimit);
        }
        if (typeof updates.dailyScanLimit === 'number' && updates.dailyScanLimit >= 0) {
          payload.dailyScanLimit = Math.round(updates.dailyScanLimit);
        }

        await updateDoc(userRef, payload);
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/users/update'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token || ''}`,
        },
        body: JSON.stringify({
          targetUserId,
          ...updates,
          adminEmail: this.currentUser?.email,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async adminUpdatePlanSettings(config: PlanSettingsConfig): Promise<boolean> {
    const clean: PlanSettingsConfig = {
      freeTrialScans: Math.max(0, Math.min(1000, Math.round(config.freeTrialScans))),
      trial7dName: config.trial7dName.trim().slice(0, 120) || DEFAULT_PLAN_SETTINGS.trial7dName,
      trial7dDays: Math.max(1, Math.min(36500, Math.round(config.trial7dDays))),
      trial7dDailyLimit: Math.max(0, Math.min(100000, Math.round(config.trial7dDailyLimit))),
      trial7dPriceBdt: Math.max(0, Number(config.trial7dPriceBdt)),
      trial7dPriceUsdt: Math.max(0, Number(config.trial7dPriceUsdt)),
      monthly1mName: config.monthly1mName.trim().slice(0, 120) || DEFAULT_PLAN_SETTINGS.monthly1mName,
      monthly1mDays: Math.max(1, Math.min(36500, Math.round(config.monthly1mDays))),
      monthly1mDailyLimit: Math.max(0, Math.min(100000, Math.round(config.monthly1mDailyLimit))),
      monthly1mPriceBdt: Math.max(0, Number(config.monthly1mPriceBdt)),
      monthly1mPriceUsdt: Math.max(0, Number(config.monthly1mPriceUsdt)),
      vip6mName: config.vip6mName.trim().slice(0, 120) || DEFAULT_PLAN_SETTINGS.vip6mName,
      vip6mDays: Math.max(1, Math.min(36500, Math.round(config.vip6mDays))),
      vip6mDailyLimit: Math.max(0, Math.min(100000, Math.round(config.vip6mDailyLimit))),
      vip6mPriceBdt: Math.max(0, Number(config.vip6mPriceBdt)),
      vip6mPriceUsdt: Math.max(0, Number(config.vip6mPriceUsdt)),
      lifetimeName: config.lifetimeName.trim().slice(0, 120) || DEFAULT_PLAN_SETTINGS.lifetimeName,
      lifetimeDays: Math.max(1, Math.min(36500, Math.round(config.lifetimeDays))),
      lifetimeDailyLimit: Math.max(0, Math.min(100000, Math.round(config.lifetimeDailyLimit))),
      lifetimePriceBdt: Math.max(0, Number(config.lifetimePriceBdt)),
      lifetimePriceUsdt: Math.max(0, Number(config.lifetimePriceUsdt)),
    };

    let saved = false;

    if (auth.currentUser && this.isAdmin()) {
      const path = 'planSettings/default';
      try {
        await setDoc(doc(db, 'planSettings', 'default'), {
          ...clean,
          updatedAt: serverTimestamp(),
        });
        saved = true;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/plans-config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token || ''}`,
        },
        body: JSON.stringify(clean),
      });
      if (res.ok) saved = true;
    } catch {
      // ignore if Firestore already succeeded
    }

    if (saved) {
      this.updateLocalPlanSettings(clean);
    }
    return saved;
  }

  public async adminUpdatePaymentConfig(config: Partial<PaymentGatewaysConfig>): Promise<boolean> {
    if (auth.currentUser && this.isAdmin()) {
      const path = 'paymentConfig/default';
      try {
        const payload = {
          bkashNumber: String(config.bkashNumber ?? DEFAULT_PAYMENT_CONFIG.bkashNumber).slice(0, 40),
          bkashType: String(config.bkashType ?? DEFAULT_PAYMENT_CONFIG.bkashType).slice(0, 60),
          nagadNumber: String(config.nagadNumber ?? DEFAULT_PAYMENT_CONFIG.nagadNumber).slice(0, 40),
          nagadType: String(config.nagadType ?? DEFAULT_PAYMENT_CONFIG.nagadType).slice(0, 60),
          rocketNumber: String(config.rocketNumber ?? DEFAULT_PAYMENT_CONFIG.rocketNumber).slice(0, 40),
          binanceUsdtAddress: String(config.binanceUsdtAddress ?? DEFAULT_PAYMENT_CONFIG.binanceUsdtAddress).slice(0, 150),
          binanceNetwork: String(config.binanceNetwork ?? DEFAULT_PAYMENT_CONFIG.binanceNetwork).slice(0, 80),
          instructionBn: String(config.instructionBn ?? DEFAULT_PAYMENT_CONFIG.instructionBn).slice(0, 500),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'paymentConfig', 'default'), payload);
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }

    try {
      const res = await fetch(getApiUrl('/api/admin/payment-config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token || ''}`,
        },
        body: JSON.stringify(config),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async logout() {
    this.keepTerminalUnlockedUntilNextClick = false;
    this.detachUserSnapshot();
    this.detachPlanSnapshot();
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch {
        // ignore signOut errors
      }
    }
    this.clearLocalSession();
  }

  private clearLocalSession() {
    this.currentUser = null;
    this.token = null;
    localStorage.removeItem(STORAGE_KEY_AUTH);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    this.notify();
  }

  private setCurrentUserSession(user: User, token: string) {
    this.currentUser = user;
    this.token = token;
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
    this.notify();
  }
}

export const authService = new AuthService();
