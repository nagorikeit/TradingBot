import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.resolve(__dirname, '../storage');

const USERS_FILE = path.join(STORAGE_DIR, 'users_db.json');
const SUBSCRIPTIONS_FILE = path.join(STORAGE_DIR, 'subscriptions_db.json');
const CONFIG_FILE = path.join(STORAGE_DIR, 'payment_config.json');
const PLAN_SETTINGS_FILE = path.join(STORAGE_DIR, 'plan_settings.json');

export interface BackendPlanSettings {
  freeTrialScans: number;
  trial7dName: string;
  trial7dDays: number;
  trial7dDailyLimit: number;
  trial7dPriceBdt: number;
  trial7dPriceUsdt: number;
  monthly1mName: string;
  monthly1mDays: number;
  monthly1mDailyLimit: number;
  monthly1mPriceBdt: number;
  monthly1mPriceUsdt: number;
  vip6mName: string;
  vip6mDays: number;
  vip6mDailyLimit: number;
  vip6mPriceBdt: number;
  vip6mPriceUsdt: number;
  lifetimeName: string;
  lifetimeDays: number;
  lifetimeDailyLimit: number;
  lifetimePriceBdt: number;
  lifetimePriceUsdt: number;
}

const DEFAULT_PLAN_SETTINGS: BackendPlanSettings = {
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
  lifetimeDailyLimit: 0,
  lifetimePriceBdt: 9999,
  lifetimePriceUsdt: 90,
};

function getDhakaDateKey(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function resolvePlanMeta(planId: string, settings: BackendPlanSettings) {
  switch (planId) {
    case 'trial_7d':
      return {
        name: settings.trial7dName,
        durationDays: settings.trial7dDays,
        dailyScanLimit: settings.trial7dDailyLimit,
        priceBdt: settings.trial7dPriceBdt,
        priceUsdt: settings.trial7dPriceUsdt,
      };
    case 'monthly_1m':
      return {
        name: settings.monthly1mName,
        durationDays: settings.monthly1mDays,
        dailyScanLimit: settings.monthly1mDailyLimit,
        priceBdt: settings.monthly1mPriceBdt,
        priceUsdt: settings.monthly1mPriceUsdt,
      };
    case 'vip_6m':
      return {
        name: settings.vip6mName,
        durationDays: settings.vip6mDays,
        dailyScanLimit: settings.vip6mDailyLimit,
        priceBdt: settings.vip6mPriceBdt,
        priceUsdt: settings.vip6mPriceUsdt,
      };
    case 'lifetime_vip':
      return {
        name: settings.lifetimeName,
        durationDays: settings.lifetimeDays,
        dailyScanLimit: settings.lifetimeDailyLimit,
        priceBdt: settings.lifetimePriceBdt,
        priceUsdt: settings.lifetimePriceUsdt,
      };
    default:
      return null;
  }
}

// Ensure storage files exist with master admin account
function initStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    const initialUsers = [
      {
        id: 'usr_owner_admin_001',
        name: 'Nagorik IT Admin',
        email: 'nagorikeitsheba@gmail.com',
        password: 'admin123456',
        phone: '+8801886888494',
        role: 'admin',
        status: 'active',
        subscription: {
          status: 'ACTIVE',
          planId: 'lifetime_vip',
          planName: 'Owner Admin VIP',
          dailyScanLimit: 0,
          startDate: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
        },
        scanQuota: {
          freeScansLimit: 5,
          freeScansUsed: 0,
          dailyScansUsed: 0,
          lastScanDate: getDhakaDateKey(),
          totalScansUsed: 0,
          dailyScanLimit: 0,
          customDailyScanLimit: 0,
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      },
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf8');
  }

  if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      bkashNumber: '01886888494',
      bkashType: 'Personal (Send Money)',
      nagadNumber: '01886888494',
      nagadType: 'Personal (Send Money)',
      rocketNumber: '018868884947',
      binanceUsdtAddress: 'TCZt7w9V2WvL9wLpYpQwerTyUiopASdfGh',
      binanceNetwork: 'TRC-20 (Tron Network)',
      instructionBn:
        'বিকাশ, নগদ, রকেট বা বাইন্যান্সের মাধ্যমে টাকা পাঠিয়ে নিচের বক্সে প্রেরক নম্বর ও TrxID দিন। অ্যাডমিন ভেরিফাই করে ৫-১৫ মিনিটের মধ্যে অ্যাক্সেস চালু করে দেবে।',
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
  }

  if (!fs.existsSync(PLAN_SETTINGS_FILE)) {
    fs.writeFileSync(PLAN_SETTINGS_FILE, JSON.stringify(DEFAULT_PLAN_SETTINGS, null, 2), 'utf8');
  }
}

initStorage();

function getPlanSettings(): BackendPlanSettings {
  try {
    const raw = JSON.parse(fs.readFileSync(PLAN_SETTINGS_FILE, 'utf8'));
    return { ...DEFAULT_PLAN_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_PLAN_SETTINGS };
  }
}

function savePlanSettings(cfg: BackendPlanSettings) {
  fs.writeFileSync(PLAN_SETTINGS_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function normalizeUserRecord(u: any, settings: BackendPlanSettings) {
  const today = getDhakaDateKey();
  const existingQuota = u.scanQuota || {};
  const lastScanDate = String(existingQuota.lastScanDate || today);
  const dailyScansUsed = lastScanDate === today ? Number(existingQuota.dailyScansUsed || 0) : 0;

  return {
    ...u,
    scanQuota: {
      freeScansLimit:
        typeof existingQuota.freeScansLimit === 'number'
          ? existingQuota.freeScansLimit
          : settings.freeTrialScans,
      freeScansUsed: Number(existingQuota.freeScansUsed || 0),
      dailyScansUsed,
      lastScanDate: today,
      totalScansUsed: Number(existingQuota.totalScansUsed || 0),
      dailyScanLimit:
        typeof existingQuota.dailyScanLimit === 'number'
          ? existingQuota.dailyScanLimit
          : typeof u.subscription?.dailyScanLimit === 'number'
          ? u.subscription.dailyScanLimit
          : 0,
      customDailyScanLimit:
        typeof existingQuota.customDailyScanLimit === 'number'
          ? existingQuota.customDailyScanLimit
          : -1,
    },
  };
}

function getUsers(): any[] {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsers(users: any[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function getSubscriptions(): any[] {
  try {
    return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSubscriptions(reqs: any[]) {
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(reqs, null, 2), 'utf8');
}

function getPaymentConfig(): any {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function savePaymentConfig(cfg: any) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

export const authRouter = Router();

// 1. User Registration
const handleRegister = (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক',
      message: 'নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক',
    });
  }

  if (String(password).trim().length < 6) {
    return res.status(400).json({
      success: false,
      error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
      message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে',
    });
  }

  const users = getUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (exists) {
    return res.status(400).json({
      success: false,
      error: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে',
      message: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে',
    });
  }

  const settings = getPlanSettings();
  const isAdmin = normalizedEmail === 'nagorikeitsheba@gmail.com';
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: String(name).trim(),
    email: normalizedEmail,
    password: String(password).trim(),
    phone: phone ? String(phone).trim() : '',
    role: isAdmin ? 'admin' : 'user',
    status: 'active',
    subscription: isAdmin
      ? {
          status: 'ACTIVE',
          planId: 'lifetime_vip',
          planName: 'Owner Admin VIP',
          dailyScanLimit: 0,
          startDate: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
        }
      : {
          status: 'NONE',
        },
    scanQuota: {
      freeScansLimit: settings.freeTrialScans,
      freeScansUsed: 0,
      dailyScansUsed: 0,
      lastScanDate: getDhakaDateKey(),
      totalScansUsed: 0,
      dailyScanLimit: 0,
      customDailyScanLimit: isAdmin ? 0 : -1,
    },
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  users.push(newUser);
  saveUsers(users);

  const { password: _, ...userWithoutPass } = newUser;
  const token = `tkn_${newUser.id}_${Date.now()}`;
  return res.json({
    success: true,
    user: userWithoutPass,
    token,
    message: `অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! আপনার জন্য ${settings.freeTrialScans}টি ফ্রি স্টার্টার স্ক্যান চালু করা হয়েছে।`,
  });
};

authRouter.post('/register', handleRegister);
authRouter.post('/auth/register', handleRegister);

// 2. User / Admin Login
const handleLogin = (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'ইমেইল ও পাসওয়ার্ড প্রদান করুন',
      message: 'ইমেইল ও পাসওয়ার্ড প্রদান করুন',
    });
  }

  const users = getUsers();
  const normalizedEmail = String(email).trim().toLowerCase();
  const idx = users.findIndex((u) => u.email.toLowerCase() === normalizedEmail);
  const user = idx >= 0 ? users[idx] : null;

  if (!user || user.password !== String(password).trim()) {
    return res.status(401).json({
      success: false,
      error: 'ভুল ইমেইল অথবা পাসওয়ার্ড!',
      message: 'ভুল ইমেইল অথবা পাসওয়ার্ড!',
    });
  }

  if (user.status === 'banned' || user.status === 'suspended') {
    return res.status(403).json({
      success: false,
      error: 'আপনার অ্যাকাউন্টটি স্থগিত বা ব্লক করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।',
      message: 'আপনার অ্যাকাউন্টটি স্থগিত বা ব্লক করা হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।',
    });
  }

  const settings = getPlanSettings();
  const normalized = normalizeUserRecord(user, settings);
  normalized.lastLoginAt = Date.now();
  users[idx] = normalized;
  saveUsers(users);

  const { password: _, ...userWithoutPass } = normalized;
  return res.json({
    success: true,
    user: userWithoutPass,
    token: `tkn_${normalized.id}_${Date.now()}`,
    message: normalized.role === 'admin' ? 'অ্যাডমিন হিসেবে লগইন সফল হয়েছে' : 'লগইন সফল হয়েছে',
  });
};

authRouter.post('/login', handleLogin);
authRouter.post('/auth/login', handleLogin);

// 2.5 Fetch current user profile
authRouter.get('/auth/me', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  const normalized = normalizeUserRecord(users[idx], getPlanSettings());
  users[idx] = normalized;
  saveUsers(users);
  const { password: _, ...userWithoutPass } = normalized;
  return res.json({ success: true, user: userWithoutPass });
});

// 2.8 Consume 1 scan quota unit atomically (for local Express-backed accounts)
authRouter.post('/auth/consume-scan', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'ব্যবহারকারী পাওয়া যায়নি' });
  }

  const settings = getPlanSettings();
  const user = normalizeUserRecord(users[idx], settings);
  const today = getDhakaDateKey();

  if (user.status === 'banned' || user.status === 'suspended') {
    return res.status(403).json({
      success: false,
      error: 'আপনার অ্যাকাউন্টটি স্থগিত করা হয়েছে।',
    });
  }

  const quota = user.scanQuota;
  if (quota.lastScanDate !== today) {
    quota.dailyScansUsed = 0;
    quota.lastScanDate = today;
  }

  if (user.role === 'admin') {
    quota.dailyScansUsed += 1;
    quota.totalScansUsed += 1;
    users[idx] = user;
    saveUsers(users);
    const { password: _, ...userWithoutPass } = user;
    return res.json({ success: true, user: userWithoutPass, scanQuota: quota });
  }

  const isPaidActive =
    user.subscription?.status === 'ACTIVE' &&
    (!user.subscription?.expiresAt || Date.now() <= user.subscription.expiresAt);

  if (isPaidActive) {
    const effectiveLimit =
      quota.customDailyScanLimit >= 0 ? quota.customDailyScanLimit : quota.dailyScanLimit;

    if (effectiveLimit > 0 && quota.dailyScansUsed >= effectiveLimit) {
      return res.status(403).json({
        success: false,
        exhaustedType: 'DAILY_LIMIT',
        error: `আজকের দৈনিক স্ক্যান লিমিট (${effectiveLimit}টি) শেষ হয়েছে। রাত ১২টার পর পুনরায় রিসেট হবে অথবা প্ল্যান আপগ্রেড করুন।`,
      });
    }

    quota.dailyScansUsed += 1;
    quota.totalScansUsed += 1;
  } else {
    if (quota.freeScansUsed >= quota.freeScansLimit) {
      return res.status(403).json({
        success: false,
        exhaustedType: 'FREE_TRIAL',
        error: `আপনার ফ্রি ${quota.freeScansLimit}টি স্টার্টার স্ক্যান শেষ হয়েছে। আনলিমিটেড ও দৈনিক উচ্চ সীমার জন্য ভিআইপি প্ল্যান নিন।`,
      });
    }

    quota.freeScansUsed += 1;
    quota.totalScansUsed += 1;
  }

  users[idx] = user;
  saveUsers(users);
  const { password: _, ...userWithoutPass } = user;
  return res.json({ success: true, user: userWithoutPass, scanQuota: quota });
});

// 3. User Submits Subscription Payment Request
const handleSubscribe = (req: Request, res: Response) => {
  const { userId, planId, planName, durationDays, dailyScanLimit, priceBdt, priceUsdt, paymentMethod, senderNumber, trxId } = req.body;

  if (!userId || !planId || !paymentMethod || !trxId) {
    return res.status(400).json({
      success: false,
      error: 'প্ল্যান, পেমেন্ট মাধ্যম ও ট্রানজেকশন আইডি প্রদান করুন',
      message: 'প্ল্যান, পেমেন্ট মাধ্যম ও ট্রানজেকশন আইডি প্রদান করুন',
    });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি',
      message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি',
    });
  }

  const settings = getPlanSettings();
  const planMeta = resolvePlanMeta(planId, settings);
  const resolvedPlanName = planName || planMeta?.name || planId;
  const resolvedDays = Number(durationDays) || planMeta?.durationDays || 30;
  const resolvedDailyLimit =
    typeof dailyScanLimit === 'number' ? dailyScanLimit : (planMeta?.dailyScanLimit ?? 200);
  const resolvedBdt = Number(priceBdt) || planMeta?.priceBdt || 0;
  const resolvedUsdt = Number(priceUsdt) || planMeta?.priceUsdt || 0;

  const subReqs = getSubscriptions();
  const newReq = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone || '',
    planId,
    planName: resolvedPlanName,
    durationDays: resolvedDays,
    dailyScanLimit: resolvedDailyLimit,
    priceBdt: resolvedBdt,
    priceUsdt: resolvedUsdt,
    paymentMethod,
    senderNumber: senderNumber || '',
    trxId: String(trxId).trim(),
    status: 'PENDING',
    createdAt: Date.now(),
  };

  subReqs.unshift(newReq);
  saveSubscriptions(subReqs);

  user.subscription = {
    status: 'PENDING',
    planId,
    planName: resolvedPlanName,
    dailyScanLimit: resolvedDailyLimit,
    paymentMethod,
    senderNumber: senderNumber || '',
    trxId: String(trxId).trim(),
    requestedAt: Date.now(),
  };
  saveUsers(users);

  const { password: _, ...userWithoutPass } = normalizeUserRecord(user, settings);
  return res.json({
    success: true,
    message: 'আপনার সাবস্ক্রিপশন আবেদনটি জমা হয়েছে! অ্যাডমিন ভেরিফাই করে ৫-১৫ মিনিটের মধ্যে অ্যাক্টিভ করে দেবে।',
    user: userWithoutPass,
    subscription: user.subscription,
    request: newReq,
  });
};

authRouter.post('/subscribe', handleSubscribe);
authRouter.post('/subscription/request', handleSubscribe);

// 4. Admin API: Get All Users
authRouter.get('/admin/users', (_req: Request, res: Response) => {
  const settings = getPlanSettings();
  const users = getUsers().map((u) => {
    const { password: _, ...rest } = normalizeUserRecord(u, settings);
    return rest;
  });
  return res.json({ success: true, users });
});

// 5. Admin API: Update User Role, Status, Grant Days, or Edit Scan Quotas
const handleAdminUpdateUser = (req: Request, res: Response) => {
  const targetId = req.body.userId || req.body.targetUserId;
  const {
    role,
    status,
    setPlanName,
    makeLifetime,
    adminEmail,
    freeScansLimit,
    freeScansUsed,
    dailyScansUsed,
    customDailyScanLimit,
    dailyScanLimit,
    resetFreeScans,
    resetDailyScans,
    revokeSubscription,
  } = req.body;
  const days = req.body.addDays ?? req.body.days;

  const users = getUsers();
  const idx = users.findIndex((u) => u.id === targetId);
  if (idx < 0) {
    return res.status(404).json({ success: false, error: 'ব্যবহারকারী পাওয়া যায়নি' });
  }

  const settings = getPlanSettings();
  const user = normalizeUserRecord(users[idx], settings);

  if (role) user.role = role;
  if (status) user.status = status;

  if (revokeSubscription) {
    user.subscription = {
      status: 'NONE',
      expiresAt: 0,
    };
    user.scanQuota.dailyScanLimit = 0;
  } else if (makeLifetime) {
    user.subscription = {
      status: 'ACTIVE',
      planId: 'lifetime_vip',
      planName: settings.lifetimeName,
      dailyScanLimit: settings.lifetimeDailyLimit,
      startDate: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
      approvedAt: Date.now(),
      approvedBy: adminEmail || 'Admin',
    };
    user.scanQuota.dailyScanLimit = settings.lifetimeDailyLimit;
  } else if (days && Number(days) > 0) {
    const currentExpiry =
      user.subscription && user.subscription.expiresAt && user.subscription.expiresAt > Date.now()
        ? user.subscription.expiresAt
        : Date.now();
    const newExpiry = currentExpiry + Number(days) * 24 * 60 * 60 * 1000;
    const resolvedDaily =
      typeof dailyScanLimit === 'number'
        ? dailyScanLimit
        : user.scanQuota.dailyScanLimit || settings.monthly1mDailyLimit;

    user.subscription = {
      ...user.subscription,
      status: 'ACTIVE',
      planName: setPlanName || user.subscription?.planName || `${days} দিনের ভিআইপি অ্যাক্সেস`,
      dailyScanLimit: resolvedDaily,
      expiresAt: newExpiry,
      approvedAt: Date.now(),
      approvedBy: adminEmail || 'Admin',
    };
    user.scanQuota.dailyScanLimit = resolvedDaily;
  }

  if (typeof freeScansLimit === 'number' && freeScansLimit >= 0) {
    user.scanQuota.freeScansLimit = Math.round(freeScansLimit);
  }
  if (resetFreeScans) {
    user.scanQuota.freeScansUsed = 0;
  } else if (typeof freeScansUsed === 'number' && freeScansUsed >= 0) {
    user.scanQuota.freeScansUsed = Math.round(freeScansUsed);
  }
  if (resetDailyScans) {
    user.scanQuota.dailyScansUsed = 0;
    user.scanQuota.lastScanDate = getDhakaDateKey();
  } else if (typeof dailyScansUsed === 'number' && dailyScansUsed >= 0) {
    user.scanQuota.dailyScansUsed = Math.round(dailyScansUsed);
  }
  if (typeof customDailyScanLimit === 'number' && customDailyScanLimit >= -1) {
    user.scanQuota.customDailyScanLimit = Math.round(customDailyScanLimit);
  }
  if (typeof dailyScanLimit === 'number' && dailyScanLimit >= 0) {
    user.scanQuota.dailyScanLimit = Math.round(dailyScanLimit);
  }

  users[idx] = user;
  saveUsers(users);
  const { password: _, ...userWithoutPass } = user;
  return res.json({ success: true, user: userWithoutPass, message: 'ইউজার সফলভাবে আপডেট হয়েছে' });
};

authRouter.post('/admin/users/update', handleAdminUpdateUser);
authRouter.post('/admin/grant-access', handleAdminUpdateUser);

// 6. Admin API: Get Subscription Requests
const handleGetRequests = (_req: Request, res: Response) => {
  const requests = getSubscriptions();
  return res.json({ success: true, requests });
};

authRouter.get('/admin/subscription-requests', handleGetRequests);
authRouter.get('/admin/requests', handleGetRequests);

// 7. Admin API: Review Subscription Request (Approve / Reject)
const handleReviewRequest = (req: Request, res: Response) => {
  const { requestId, action, notes, adminName, adminEmail } = req.body;

  const subReqs = getSubscriptions();
  const targetReq = subReqs.find((r) => r.id === requestId);
  if (!targetReq) {
    return res.status(404).json({ success: false, error: 'রিকোয়েস্ট পাওয়া যায়নি' });
  }

  const reviewer = adminEmail || adminName || 'Admin';
  const settings = getPlanSettings();
  const users = getUsers();
  const userIdx = users.findIndex((u) => u.id === targetReq.userId);

  if (action === 'approve') {
    targetReq.status = 'APPROVED';
    targetReq.reviewedAt = Date.now();
    targetReq.reviewedBy = reviewer;
    targetReq.notes = notes || 'পেমেন্ট ভেরিফাইড ও অ্যাক্টিভেটেড';

    if (userIdx >= 0) {
      const user = normalizeUserRecord(users[userIdx], settings);
      const planMeta = resolvePlanMeta(targetReq.planId, settings);
      const days = targetReq.durationDays || planMeta?.durationDays || 30;
      const dailyLimit =
        typeof targetReq.dailyScanLimit === 'number'
          ? targetReq.dailyScanLimit
          : (planMeta?.dailyScanLimit ?? 200);
      const isLifetime = targetReq.planId === 'lifetime_vip' || days >= 365 * 5;
      const baseTime =
        user.subscription?.expiresAt && user.subscription.expiresAt > Date.now()
          ? user.subscription.expiresAt
          : Date.now();
      const expiresAt = isLifetime
        ? Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
        : baseTime + days * 24 * 60 * 60 * 1000;

      user.subscription = {
        status: 'ACTIVE',
        planId: targetReq.planId,
        planName: targetReq.planName,
        dailyScanLimit: dailyLimit,
        startDate: Date.now(),
        expiresAt,
        paymentMethod: targetReq.paymentMethod,
        senderNumber: targetReq.senderNumber,
        trxId: targetReq.trxId,
        approvedAt: Date.now(),
        approvedBy: reviewer,
      };
      user.scanQuota.dailyScanLimit = dailyLimit;
      user.scanQuota.dailyScansUsed = 0;
      user.scanQuota.lastScanDate = getDhakaDateKey();
      users[userIdx] = user;
    }
  } else {
    targetReq.status = 'REJECTED';
    targetReq.reviewedAt = Date.now();
    targetReq.reviewedBy = reviewer;
    targetReq.notes = notes || 'পেমেন্ট ট্রানজেকশন মেলেনি';

    if (userIdx >= 0 && users[userIdx].subscription?.status === 'PENDING') {
      users[userIdx].subscription.status = 'NONE';
    }
  }

  saveSubscriptions(subReqs);
  saveUsers(users);

  return res.json({
    success: true,
    message: action === 'approve' ? 'সাবস্ক্রিপশন সফলভাবে অনুমোদন করা হয়েছে!' : 'সাবস্ক্রিপশন বাতিল করা হয়েছে।',
    request: targetReq,
  });
};

authRouter.post('/admin/subscription-requests/review', handleReviewRequest);
authRouter.post('/admin/review-request', handleReviewRequest);

// 8. Payment Config API
authRouter.get('/payment/config', (_req: Request, res: Response) => {
  return res.json(getPaymentConfig());
});

authRouter.get('/admin/payment-config', (_req: Request, res: Response) => {
  return res.json({ success: true, config: getPaymentConfig() });
});

authRouter.post('/admin/payment-config', (req: Request, res: Response) => {
  const newConfig = req.body;
  savePaymentConfig(newConfig);
  return res.json({ success: true, config: newConfig, message: 'পেমেন্ট নম্বরসমূহ আপডেট হয়েছে' });
});

// 9. Plan & Scan Quota Config API
authRouter.get('/plans/config', (_req: Request, res: Response) => {
  return res.json({ success: true, config: getPlanSettings() });
});

authRouter.post('/admin/plans-config', (req: Request, res: Response) => {
  const current = getPlanSettings();
  const body = req.body || {};
  const next: BackendPlanSettings = {
    freeTrialScans: Math.max(0, Math.min(1000, Number(body.freeTrialScans ?? current.freeTrialScans))),
    trial7dName: String(body.trial7dName ?? current.trial7dName).slice(0, 120),
    trial7dDays: Math.max(1, Number(body.trial7dDays ?? current.trial7dDays)),
    trial7dDailyLimit: Math.max(0, Number(body.trial7dDailyLimit ?? current.trial7dDailyLimit)),
    trial7dPriceBdt: Math.max(0, Number(body.trial7dPriceBdt ?? current.trial7dPriceBdt)),
    trial7dPriceUsdt: Math.max(0, Number(body.trial7dPriceUsdt ?? current.trial7dPriceUsdt)),
    monthly1mName: String(body.monthly1mName ?? current.monthly1mName).slice(0, 120),
    monthly1mDays: Math.max(1, Number(body.monthly1mDays ?? current.monthly1mDays)),
    monthly1mDailyLimit: Math.max(0, Number(body.monthly1mDailyLimit ?? current.monthly1mDailyLimit)),
    monthly1mPriceBdt: Math.max(0, Number(body.monthly1mPriceBdt ?? current.monthly1mPriceBdt)),
    monthly1mPriceUsdt: Math.max(0, Number(body.monthly1mPriceUsdt ?? current.monthly1mPriceUsdt)),
    vip6mName: String(body.vip6mName ?? current.vip6mName).slice(0, 120),
    vip6mDays: Math.max(1, Number(body.vip6mDays ?? current.vip6mDays)),
    vip6mDailyLimit: Math.max(0, Number(body.vip6mDailyLimit ?? current.vip6mDailyLimit)),
    vip6mPriceBdt: Math.max(0, Number(body.vip6mPriceBdt ?? current.vip6mPriceBdt)),
    vip6mPriceUsdt: Math.max(0, Number(body.vip6mPriceUsdt ?? current.vip6mPriceUsdt)),
    lifetimeName: String(body.lifetimeName ?? current.lifetimeName).slice(0, 120),
    lifetimeDays: Math.max(1, Number(body.lifetimeDays ?? current.lifetimeDays)),
    lifetimeDailyLimit: Math.max(0, Number(body.lifetimeDailyLimit ?? current.lifetimeDailyLimit)),
    lifetimePriceBdt: Math.max(0, Number(body.lifetimePriceBdt ?? current.lifetimePriceBdt)),
    lifetimePriceUsdt: Math.max(0, Number(body.lifetimePriceUsdt ?? current.lifetimePriceUsdt)),
  };
  savePlanSettings(next);
  return res.json({ success: true, config: next, message: 'প্ল্যান ও স্ক্যান লিমিট সফলভাবে আপডেট হয়েছে' });
});
