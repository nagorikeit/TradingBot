export type UserRole = 'admin' | 'user';

export type SubscriptionStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'NONE';

export type PaymentMethodType = 'bkash' | 'nagad' | 'rocket' | 'binance';

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationDays: number;
  dailyScanLimit: number; // 0 = Unlimited
  priceBdt: number;
  priceUsdt: number;
  badge?: string;
  description: string;
  features: string[];
}

export interface PlanSettingsConfig {
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

export interface UserScanQuota {
  freeScansLimit: number;
  freeScansUsed: number;
  dailyScansUsed: number;
  lastScanDate: string; // YYYY-MM-DD in Asia/Dhaka
  totalScansUsed: number;
  dailyScanLimit: number; // 0 = Unlimited (from active plan)
  customDailyScanLimit: number; // -1 = use plan default, 0 = unlimited, >0 = custom override
}

export interface EffectiveScanQuotaStatus {
  mode: 'ADMIN' | 'PAID' | 'FREE_TRIAL' | 'EXHAUSTED';
  canScan: boolean;
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
  dailyLimit: number; // 0 = unlimited
  dailyUsed: number;
  dailyRemaining: number | null; // null = unlimited
  totalScansUsed: number;
  daysRemaining: number;
  blockReasonBn?: string;
}

export interface UserSubscription {
  status: SubscriptionStatus;
  planId?: string;
  planName?: string;
  startDate?: number;
  expiresAt?: number;
  dailyScanLimit?: number;
  paymentMethod?: PaymentMethodType;
  senderNumber?: string;
  trxId?: string;
  requestedAt?: number;
  approvedAt?: number;
  approvedBy?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'banned';
  subscription: UserSubscription;
  scanQuota?: UserScanQuota;
  createdAt: number;
  lastLoginAt: number;
}

export interface SubscriptionRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  planId: string;
  planName: string;
  durationDays: number;
  dailyScanLimit?: number;
  priceBdt: number;
  priceUsdt: number;
  paymentMethod: PaymentMethodType;
  senderNumber: string;
  trxId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  notes?: string;
}

export interface PaymentGatewaysConfig {
  bkashNumber: string;
  bkashType: string;
  nagadNumber: string;
  nagadType: string;
  rocketNumber: string;
  binanceUsdtAddress: string;
  binanceNetwork: string;
  instructionBn: string;
}
