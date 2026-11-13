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

// Ensure storage files exist with pre-seeded master admin and demo user
function initStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    const initialUsers = [
      {
        id: 'usr_master_admin_001',
        name: 'Master Admin (TradePulse)',
        email: 'admin@tradepulse.io',
        password: 'admin123456',
        phone: '+8801700000000',
        role: 'admin',
        status: 'active',
        subscription: {
          status: 'ACTIVE',
          planId: 'lifetime_vip',
          planName: 'Master Admin Access',
          startDate: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      },
      {
        id: 'usr_owner_admin_002',
        name: 'Nagorik IT Admin',
        email: 'nagorikeitsheba@gmail.com',
        password: 'admin123456',
        phone: '+8801800000000',
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
      {
        id: 'usr_demo_vip_003',
        name: 'VIP Trader Demo',
        email: 'user@tradepulse.io',
        password: 'user123456',
        phone: '+8801900000000',
        role: 'user',
        status: 'active',
        subscription: {
          status: 'ACTIVE',
          planId: 'monthly_1m',
          planName: '১ মাস প্রিমিয়াম অ্যাক্সেস',
          startDate: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
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
      bkashNumber: '01700-000000',
      bkashType: 'Personal (Send Money)',
      nagadNumber: '01800-000000',
      nagadType: 'Personal (Send Money)',
      rocketNumber: '01900-000000',
      binanceUsdtAddress: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      binanceNetwork: 'USDT (TRC-20 / BEP-20)',
      instructionBn: 'বিকাশ বা নগদে সেন্ড মানি করে নিচের বক্সে আপনার প্রেরক নম্বর ও TrxID দিন। এডমিন ভেরিফাই করে ৫-১৫ মিনিটের মধ্যে অ্যাক্সেস চালু করে দেবে।',
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

// 1. User / Admin Registration
authRouter.post('/register', (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'নাম, ইমেইল এবং পাসওয়ার্ড আবশ্যক' });
  }

  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const exists = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (exists) {
    return res.status(400).json({ success: false, message: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে' });
  }

  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    email: normalizedEmail,
    password: password.trim(),
    phone: phone ? phone.trim() : '',
    role: 'user', // Default role is user
    status: 'active',
    subscription: {
      status: 'NONE', // Regular users must subscribe to unlock access
    },
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
  };

  users.push(newUser);
  saveUsers(users);

  // Exclude password from response
  const { password: _, ...userWithoutPass } = newUser;
  return res.json({ success: true, user: userWithoutPass, message: 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!' });
});

// 2. User / Admin Login
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'ইমেইল ও পাসওয়ার্ড প্রদান করুন' });
  }

  const users = getUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user || user.password !== password.trim()) {
    return res.status(401).json({ success: false, message: 'ভুল ইমেইল অথবা পাসওয়ার্ড!' });
  }

  if (user.status === 'banned' || user.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্টটি স্থগিত বা ব্লক করা হয়েছে। এডমিনের সাথে যোগাযোগ করুন।' });
  }

  // Update lastLoginAt
  user.lastLoginAt = Date.now();
  saveUsers(users);

  const { password: _, ...userWithoutPass } = user;
  return res.json({
    success: true,
    user: userWithoutPass,
    token: `tkn_${user.id}_${Date.now()}`,
    message: user.role === 'admin' ? 'এডমিন হিসেবে লগইন সফল হয়েছে' : 'লগইন সফল হয়েছে',
  });
});

// 3. User Submits Subscription Payment Request
authRouter.post('/subscribe', (req: Request, res: Response) => {
  const { userId, planId, planName, durationDays, priceBdt, priceUsdt, paymentMethod, senderNumber, trxId } = req.body;

  if (!userId || !planId || !paymentMethod || !trxId) {
    return res.status(400).json({ success: false, message: 'প্ল্যান, পেমেন্ট মাধ্যম ও ট্রানজেকশন আইডি প্রদান করুন' });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' });
  }

  const subReqs = getSubscriptions();
  const newReq = {
    id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone || '',
    planId,
    planName: planName || planId,
    durationDays: Number(durationDays) || 30,
    priceBdt: Number(priceBdt) || 0,
    priceUsdt: Number(priceUsdt) || 0,
    paymentMethod,
    senderNumber: senderNumber || '',
    trxId: trxId.trim(),
    status: 'PENDING',
    createdAt: Date.now(),
  };

  subReqs.unshift(newReq);
  saveSubscriptions(subReqs);

  // Update user subscription state to PENDING
  user.subscription = {
    status: 'PENDING',
    planId,
    planName: planName || planId,
    paymentMethod,
    senderNumber,
    trxId: trxId.trim(),
    requestedAt: Date.now(),
  };
  saveUsers(users);

  const { password: _, ...userWithoutPass } = user;
  return res.json({
    success: true,
    message: 'আপনার সাবস্ক্রিপশন আবেদনটি জমা হয়েছে! এডমিন ভেরিফাই করে ৫-১৫ মিনিটের মধ্যে অ্যাক্টিভ করে দেবে।',
    user: userWithoutPass,
    request: newReq,
  });
});

// 4. Admin API: Get All Users
authRouter.get('/admin/users', (_req: Request, res: Response) => {
  const users = getUsers().map(({ password, ...u }) => u);
  return res.json({ success: true, users });
});

// 5. Admin API: Update User Role, Status or Grant Days
authRouter.post('/admin/users/update', (req: Request, res: Response) => {
  const { userId, role, status, addDays, setPlanName, makeLifetime } = req.body;

  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'ব্যবহারকারী পাওয়া যায়নি' });
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
    };
  } else if (addDays) {
    const currentExpiry = (user.subscription && user.subscription.expiresAt && user.subscription.expiresAt > Date.now())
      ? user.subscription.expiresAt
      : Date.now();
    const newExpiry = currentExpiry + Number(addDays) * 24 * 60 * 60 * 1000;
    user.subscription = {
      ...user.subscription,
      status: 'ACTIVE',
      planName: setPlanName || user.subscription?.planName || `${addDays} দিনের অ্যাক্সেস`,
      expiresAt: newExpiry,
      approvedAt: Date.now(),
    };
  }

  saveUsers(users);
  const { password: _, ...userWithoutPass } = user;
  return res.json({ success: true, user: userWithoutPass, message: 'ইউজার সফলভাবে আপডেট হয়েছে' });
});

// 6. Admin API: Get Subscription Requests
authRouter.get('/admin/subscription-requests', (_req: Request, res: Response) => {
  const requests = getSubscriptions();
  return res.json({ success: true, requests });
});

// 7. Admin API: Review Subscription Request (Approve / Reject)
authRouter.post('/admin/subscription-requests/review', (req: Request, res: Response) => {
  const { requestId, action, notes, adminName } = req.body; // action: 'approve' | 'reject'

  const subReqs = getSubscriptions();
  const targetReq = subReqs.find((r) => r.id === requestId);
  if (!targetReq) {
    return res.status(404).json({ success: false, message: 'রিকোয়েস্ট পাওয়া যায়নি' });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === targetReq.userId);

  if (action === 'approve') {
    targetReq.status = 'APPROVED';
    targetReq.reviewedAt = Date.now();
    targetReq.reviewedBy = adminName || 'Admin';
    targetReq.notes = notes || 'পেমেন্ট ভেরিফাইড ও অ্যাক্টিভেটেড';

    if (user) {
      const days = targetReq.durationDays || 30;
      const isLifetime = targetReq.planId === 'lifetime_vip' || days >= 365 * 5;
      const expiresAt = isLifetime
        ? Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
        : Date.now() + days * 24 * 60 * 60 * 1000;

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
        approvedBy: adminName || 'Admin',
      };
    }
  } else {
    targetReq.status = 'REJECTED';
    targetReq.reviewedAt = Date.now();
    targetReq.reviewedBy = adminName || 'Admin';
    targetReq.notes = notes || 'পেমেন্ট ট্রানজেকশন মেলেনি';

    if (user && user.subscription?.status === 'PENDING') {
      user.subscription.status = 'NONE';
    }
  }

  saveSubscriptions(subReqs);
  saveUsers(users);

  return res.json({
    success: true,
    message: action === 'approve' ? 'সাবস্ক্রিপশন সফলভাবে অনুমোদন করা হয়েছে!' : 'সাবস্ক্রিপশন বাতিল করা হয়েছে।',
    request: targetReq,
  });
});

// 8. Payment Config API
authRouter.get('/admin/payment-config', (_req: Request, res: Response) => {
  return res.json({ success: true, config: getPaymentConfig() });
});

authRouter.post('/admin/payment-config', (req: Request, res: Response) => {
  const newConfig = req.body;
  savePaymentConfig(newConfig);
  return res.json({ success: true, config: newConfig, message: 'পেমেন্ট নম্বরসমূহ আপডেট হয়েছে' });
});
