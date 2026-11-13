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

const PLANS_LOOKUP: Record<string, { name: string; durationDays: number; priceBdt: number; priceUsdt: number }> = {
  trial_7d: { name: '৭ দিনের ট্রায়াল প্যাক (7 Days Trial)', durationDays: 7, priceBdt: 499, priceUsdt: 5 },
  monthly_1m: { name: '১ মাসের প্রো ভিআইপি (1 Month VIP)', durationDays: 30, priceBdt: 1499, priceUsdt: 15 },
  vip_6m: { name: '৬ মাসের এলিট ভিআইপি (6 Months Elite)', durationDays: 180, priceBdt: 5999, priceUsdt: 55 },
  lifetime_vip: { name: 'লাইফটাইম ভিআইপি অ্যাক্সেস (Lifetime VIP)', durationDays: 3650, priceBdt: 9999, priceUsdt: 90 },
};

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
          startDate: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
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
}

initStorage();

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
          startDate: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
        }
      : {
          status: 'NONE',
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
    message: 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!',
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
  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

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

  user.lastLoginAt = Date.now();
  saveUsers(users);

  const { password: _, ...userWithoutPass } = user;
  return res.json({
    success: true,
    user: userWithoutPass,
    token: `tkn_${user.id}_${Date.now()}`,
    message: user.role === 'admin' ? 'অ্যাডমিন হিসেবে লগইন সফল হয়েছে' : 'লগইন সফল হয়েছে',
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
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  const { password: _, ...userWithoutPass } = user;
  return res.json({ success: true, user: userWithoutPass });
});

// 3. User Submits Subscription Payment Request
const handleSubscribe = (req: Request, res: Response) => {
  const { userId, planId, planName, durationDays, priceBdt, priceUsdt, paymentMethod, senderNumber, trxId } = req.body;

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

  const planMeta = PLANS_LOOKUP[planId];
  const resolvedPlanName = planName || planMeta?.name || planId;
  const resolvedDays = Number(durationDays) || planMeta?.durationDays || 30;
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
    paymentMethod,
    senderNumber: senderNumber || '',
    trxId: String(trxId).trim(),
    requestedAt: Date.now(),
  };
  saveUsers(users);

  const { password: _, ...userWithoutPass } = user;
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
  const users = getUsers().map(({ password: _, ...u }) => u);
  return res.json({ success: true, users });
});

// 5. Admin API: Update User Role, Status or Grant Days
const handleAdminUpdateUser = (req: Request, res: Response) => {
  const targetId = req.body.userId || req.body.targetUserId;
  const { role, status, setPlanName, makeLifetime, adminEmail } = req.body;
  const days = req.body.addDays ?? req.body.days;

  const users = getUsers();
  const user = users.find((u) => u.id === targetId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'ব্যবহারকারী পাওয়া যায়নি' });
  }

  if (role) user.role = role;
  if (status) user.status = status;

  if (makeLifetime) {
    user.subscription = {
      status: 'ACTIVE',
      planId: 'lifetime_vip',
      planName: 'লাইফটাইম ভিআইপি অ্যাক্সেস',
      startDate: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
      approvedAt: Date.now(),
      approvedBy: adminEmail || 'Admin',
    };
  } else if (days) {
    const currentExpiry =
      user.subscription && user.subscription.expiresAt && user.subscription.expiresAt > Date.now()
        ? user.subscription.expiresAt
        : Date.now();
    const newExpiry = currentExpiry + Number(days) * 24 * 60 * 60 * 1000;
    user.subscription = {
      ...user.subscription,
      status: 'ACTIVE',
      planName: setPlanName || user.subscription?.planName || `${days} দিনের অ্যাক্সেস`,
      expiresAt: newExpiry,
      approvedAt: Date.now(),
      approvedBy: adminEmail || 'Admin',
    };
  }

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
  const users = getUsers();
  const user = users.find((u) => u.id === targetReq.userId);

  if (action === 'approve') {
    targetReq.status = 'APPROVED';
    targetReq.reviewedAt = Date.now();
    targetReq.reviewedBy = reviewer;
    targetReq.notes = notes || 'পেমেন্ট ভেরিফাইড ও অ্যাক্টিভেটেড';

    if (user) {
      const days = targetReq.durationDays || 30;
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
        startDate: Date.now(),
        expiresAt,
        paymentMethod: targetReq.paymentMethod,
        senderNumber: targetReq.senderNumber,
        trxId: targetReq.trxId,
        approvedAt: Date.now(),
        approvedBy: reviewer,
      };
    }
  } else {
    targetReq.status = 'REJECTED';
    targetReq.reviewedAt = Date.now();
    targetReq.reviewedBy = reviewer;
    targetReq.notes = notes || 'পেমেন্ট ট্রানজেকশন মেলেনি';

    if (user && user.subscription?.status === 'PENDING') {
      user.subscription.status = 'NONE';
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
