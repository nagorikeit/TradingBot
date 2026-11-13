export type UserRole = 'admin' | 'user';

export type SubscriptionStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'NONE';

export type PaymentMethodType = 'bkash' | 'nagad' | 'rocket' | 'binance';

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationDays: number;
  priceBdt: number;
  priceUsdt: number;
  badge?: string;
  description: string;
  features: string[];
}

export interface UserSubscription {
  status: SubscriptionStatus;
  planId?: string;
  planName?: string;
  startDate?: number;
  expiresAt?: number;
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
