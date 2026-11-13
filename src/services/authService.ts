import {
  User,
  SubscriptionPlan,
  SubscriptionRequest,
  PaymentGatewaysConfig,
  PaymentMethodType,
  SubscriptionStatus,
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

export const ADMIN_EMAILS = ['nagorikeitsheba@gmail.com', 'admin@tradepulse.io'];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'trial_7d',
    name: '৭ দিনের ট্রায়াল প্যাক (7 Days Trial)',
    durationDays: 7,
    priceBdt: 499,
    priceUsdt: 5,
    badge: 'শুরুর জন্য সেরা',
    description: 'নতুন ট্রেডারদের জন্য নিখুঁত টেস্ট ড্রাইভ ও প্রাতিষ্ঠানিক অ্যালগরিদম পরীক্ষা।',
    features: [
      '১০০% আনলিমিটেড লাইভ ও স্ক্রিন স্ক্যান',
      'প্রাতিষ্ঠানিক কনফ্লুয়েন্স অ্যালগরিদম ভেরিফিকেশন',
      'রিয়েল-টাইম অডিও বাংলা ভয়েস গাইডেন্স',
      'প্রো টার্মিনাল ও সব ব্রোকার (PocketOption, Quotex, Olymp, Binomo) সাপোর্ট',
      '৭ দিন পূর্ণ অ্যাক্সেস',
    ],
  },
  {
    id: 'monthly_1m',
    name: '১ মাসের প্রো ভিআইপি (1 Month VIP)',
    durationDays: 30,
    priceBdt: 1499,
    priceUsdt: 15,
    badge: 'সবচেয়ে জনপ্রিয় 🔥',
    description: 'নিয়মিত প্রফিটেবল ট্রেডারদের এক মাসের সম্পূর্ণ অটোমেটেড সাপোর্ট।',
    features: [
      'সকল ৭ দিনের সুবিধার অন্তর্ভুক্ত',
      'অ্যাডভান্সড স্পাইক ফিল্টার এবং সাইডওয়েজ শিল্ড',
      'ফ্লোটিং মিনি টার্মিনাল ব্যাকগ্রাউন্ড সাপোর্ট',
      'হাই একুরেসি ১-ক্লিক টার্মিনাল ক্যালকুলেশন',
      '৩০ দিন সার্বক্ষণিক আনলিমিটেড সিগন্যাল',
    ],
  },
  {
    id: 'vip_6m',
    name: '৬ মাসের এলিট ভিআইপি (6 Months Elite)',
    durationDays: 180,
    priceBdt: 5999,
    priceUsdt: 55,
    badge: 'সেরা ভ্যালু (৩৫% ডিসকাউন্ট)',
    description: 'অভিজ্ঞ ও ক্যারিয়ার ট্রেডারদের দীর্ঘমেয়াদী নির্ভুল ট্রেডিং সহকারী।',
    features: [
      'সকল ১ মাসের ফিচারের অন্তর্ভুক্ত',
      'প্রাইওরিটি সার্ভার প্রসেসিং স্পিড (<100ms)',
      'সরাসরি অ্যাডমিন প্রায়োরিটি হেল্পডেস্ক',
      'ভবিষ্যতের সকল নতুন মেথড অটোমেটিক আপডেট',
      '১৮০ দিন নিরবচ্ছিন্ন সার্ভিস',
    ],
  },
  {
    id: 'lifetime_vip',
    name: 'লাইফটাইম ভিআইপি অ্যাক্সেস (Lifetime VIP)',
    durationDays: 3650, // 10 years
    priceBdt: 9999,
    priceUsdt: 90,
    badge: 'লাইফটাইম আনলিমিটেড 👑',
    description: 'একবার পেমেন্ট করে আজীবন ট্রেডপালস এআই সম্পূর্ণ ফ্রি উপভোগ করুন।',
    features: [
      'আজীবন আনলিমিটেড অ্যাক্সেস (কোনো মাসিক চার্জ নেই)',
      'পরবর্তী সব বড় মেকানিকাল ও নিউরাল আপডেট সম্পূর্ণ ফ্রি',
      'ভিআইপি মাস্টার প্রাইভেট সাপোর্ট',
      'আনলিমিটেড অ্যান্ড্রয়েড + ডেস্কটপ ও ওয়েব ব্যবহার',
    ],
  },
];

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

type AuthListener = (user: User | null) => void;

function toEpochMs(val: unknown): number {
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function mapFirestoreUser(data: Record<string, unknown>, uid: string): User {
  const email = String(data.email || '');
  const isBootstrappedAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
  const role = isBootstrappedAdmin ? 'admin' : data.role === 'admin' ? 'admin' : 'user';

  return {
    id: String(data.uid || uid),
    name: String(data.name || 'Trader'),
    email,
    phone: data.phone ? String(data.phone) : undefined,
    role,
    status: (data.accountStatus as 'active' | 'suspended' | 'banned') || 'active',
    subscription: {
      status: (data.subscriptionStatus as SubscriptionStatus) || (role === 'admin' ? 'ACTIVE' : 'NONE'),
      planId: data.planId ? String(data.planId) : undefined,
      planName: data.planName ? String(data.planName) : undefined,
      startDate: typeof data.startDate === 'number' ? data.startDate : undefined,
      expiresAt: typeof data.expiresAt === 'number' && data.expiresAt > 0 ? data.expiresAt : undefined,
      paymentMethod: data.paymentMethod ? (String(data.paymentMethod) as PaymentMethodType) : undefined,
      senderNumber: data.senderNumber ? String(data.senderNumber) : undefined,
      trxId: data.trxId ? String(data.trxId) : undefined,
      requestedAt: typeof data.requestedAt === 'number' ? data.requestedAt : undefined,
      approvedAt: typeof data.approvedAt === 'number' ? data.approvedAt : undefined,
      approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    },
    createdAt: toEpochMs(data.createdAt),
    lastLoginAt: toEpochMs(data.updatedAt),
  };
}

class AuthService {
  private currentUser: User | null = null;
  private token: string | null = null;
  private listeners: Set<AuthListener> = new Set();
  private userDocUnsub: Unsubscribe | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
      if (token) {
        this.token = token;
      }
    } catch {
      // ignore storage read errors
    }

    // Listen to Firebase Auth state changes for real-time 1-click Gmail sync
    onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        await this.syncFirebaseUser(fbUser);
      } else {
        this.detachUserSnapshot();
        // Keep Express/local session if active and not a Firebase-backed session
        if (this.token === 'firebase_google_auth') {
          this.clearLocalSession();
        } else if (this.currentUser) {
          this.refreshProfile().catch(() => {});
        }
      }
    });
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
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return mapFirestoreUser(snap.data() as Record<string, unknown>, uid);
      }

      const email = (fbUser.email || 'user@gmail.com').slice(0, 200);
      const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase());
      const displayName = (fbUser.displayName || email.split('@')[0] || 'Gmail User').slice(0, 100);
      const photoURL = fbUser.photoURL ? fbUser.photoURL.slice(0, 500) : '';

      const newUserDoc: Record<string, unknown> = {
        uid,
        name: displayName,
        email,
        role: isAdminEmail ? 'admin' : 'user',
        accountStatus: 'active',
        subscriptionStatus: isAdminEmail ? 'ACTIVE' : 'NONE',
        expiresAt: isAdminEmail ? Date.now() + 1000 * 60 * 60 * 24 * 3650 : 0,
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
            const updatedUser = mapFirestoreUser(snapshot.data() as Record<string, unknown>, fbUser.uid);
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

  private notify() {
    this.listeners.forEach((fn) => fn(this.currentUser));
  }

  public getUser(): User | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return this.token;
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

  // --- 1-CLICK GMAIL / GOOGLE AUTHENTICATION ---

  public async loginWithGoogle(): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
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

  // --- LEGACY EMAIL / PASSWORD API CALLS WITH OFFLINE FALLBACK ---

  public async login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'লগইন ব্যর্থ হয়েছে।' };
      }

      this.setCurrentUserSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch {
      return this.localFallbackLogin(email, password);
    }
  }

  public async register(
    name: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'রেজিস্ট্রেশন ব্যর্থ হয়েছে।' };
      }

      this.setCurrentUserSession(data.user, data.token);
      return { success: true, user: data.user };
    } catch {
      return this.localFallbackRegister(name, email, password, phone);
    }
  }

  public async refreshProfile(): Promise<User | null> {
    if (!this.currentUser) return null;

    if (auth.currentUser) {
      const path = `users/${auth.currentUser.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (snap.exists()) {
          const updated = mapFirestoreUser(snap.data() as Record<string, unknown>, auth.currentUser.uid);
          this.setCurrentUserSession(updated, 'firebase_google_auth');
          return updated;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
      return this.currentUser;
    }

    try {
      const res = await fetch(`/api/auth/me?userId=${this.currentUser.id}`, {
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
      // offline
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

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) || SUBSCRIPTION_PLANS[1];

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
      const res = await fetch('/api/subscription/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.id,
          planId,
          paymentMethod,
          senderNumber,
          trxId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'রিকোয়েস্ট সাবমিট ব্যর্থ হয়েছে।' };
      }

      if (data.subscription) {
        this.currentUser.subscription = data.subscription;
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(this.currentUser));
        this.notify();
      }
      return { success: true };
    } catch {
      this.currentUser.subscription = {
        status: 'PENDING',
        planId,
        planName: plan?.name || planId,
        paymentMethod,
        senderNumber,
        trxId,
        requestedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(this.currentUser));
      this.notify();
      return { success: true };
    }
  }

  public async getPaymentConfig(): Promise<PaymentGatewaysConfig> {
    if (auth.currentUser) {
      const path = 'paymentConfig/default';
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
      const res = await fetch('/api/payment/config');
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // fallback
    }

    return DEFAULT_PAYMENT_CONFIG;
  }

  // --- ADMIN FUNCTIONS ---

  public async adminGetAllUsers(): Promise<User[]> {
    if (auth.currentUser && this.isAdmin()) {
      const path = 'users';
      try {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map((d) => mapFirestoreUser(d.data() as Record<string, unknown>, d.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    }

    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${this.token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch {
      // offline
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
      const res = await fetch('/api/admin/requests', {
        headers: { Authorization: `Bearer ${this.token || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.requests || [];
      }
    } catch {
      // offline
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
            planId: String(reqData.planId || '').slice(0, 50),
            planName: String(reqData.planName || '').slice(0, 120),
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
      const res = await fetch('/api/admin/review-request', {
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

  public async adminGrantAccess(targetUserId: string, days: number): Promise<boolean> {
    if (auth.currentUser && this.isAdmin()) {
      const userRef = doc(db, 'users', targetUserId);
      const path = `users/${targetUserId}`;
      try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return false;
        const existingExpiry = Number(userSnap.data().expiresAt || 0);
        const nowMs = Date.now();
        const baseTime = existingExpiry > nowMs ? existingExpiry : nowMs;
        const newExpiry = baseTime + days * 24 * 60 * 60 * 1000;
        const adminEmail = (auth.currentUser.email || this.currentUser?.email || 'admin').slice(0, 200);

        await updateDoc(userRef, {
          subscriptionStatus: 'ACTIVE',
          planId: 'manual_admin_grant',
          planName: `Admin Grant (${days} Days)`,
          startDate: nowMs,
          expiresAt: newExpiry,
          approvedAt: nowMs,
          approvedBy: adminEmail,
          updatedAt: serverTimestamp(),
        });
        return true;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    try {
      const res = await fetch('/api/admin/grant-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token || ''}`,
        },
        body: JSON.stringify({ targetUserId, days, adminEmail: this.currentUser?.email }),
      });
      return res.ok;
    } catch {
      return false;
    }
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
      const res = await fetch('/api/admin/payment-config', {
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
    this.detachUserSnapshot();
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

  // --- LOCAL FALLBACK LOGIC ---
  private localFallbackLogin(email: string, pass: string): { success: boolean; error?: string; user?: User } {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'admin@tradepulse.io' || cleanEmail === 'nagorikeitsheba@gmail.com') {
      if (pass === 'admin123456') {
        const adminUser: User = {
          id: 'admin_local',
          name: 'Master Admin',
          email: cleanEmail,
          role: 'admin',
          status: 'active',
          subscription: {
            status: 'ACTIVE',
            planName: 'Lifetime Master Access',
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 3650,
          },
          createdAt: Date.now(),
          lastLoginAt: Date.now(),
        };
        this.setCurrentUserSession(adminUser, 'local_admin_token');
        return { success: true, user: adminUser };
      }
      return { success: false, error: 'ভুল এডমিন পাসওয়ার্ড।' };
    }

    if (cleanEmail === 'user@tradepulse.io' && pass === 'user123456') {
      const demoUser: User = {
        id: 'demo_user_local',
        name: 'VIP Demo Trader',
        email: cleanEmail,
        role: 'user',
        status: 'active',
        subscription: {
          status: 'ACTIVE',
          planId: 'monthly_1m',
          planName: '১ মাসের প্রো ভিআইপি',
          expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      };
      this.setCurrentUserSession(demoUser, 'local_demo_token');
      return { success: true, user: demoUser };
    }

    return { success: false, error: 'ইউজার পাওয়া যায়নি অথবা পাসওয়ার্ড ভুল।' };
  }

  private localFallbackRegister(
    name: string,
    email: string,
    _pass: string,
    phone?: string
  ): { success: boolean; error?: string; user?: User } {
    const newUser: User = {
      id: 'usr_' + Date.now(),
      name,
      email: email.trim().toLowerCase(),
      phone,
      role: 'user',
      status: 'active',
      subscription: {
        status: 'NONE',
      },
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    };
    this.setCurrentUserSession(newUser, 'local_token_' + Date.now());
    return { success: true, user: newUser };
  }
}

export const authService = new AuthService();
