import {
  TradingProfileConfig,
  TradingProfileId,
  getTradingProfile,
  isValidTradingProfileId,
} from '../strategy/tradingProfiles';

const STORAGE_KEY_ACTIVE_PROFILE = 'tradepulse_active_trading_profile_v1';

class TradingProfileService {
  private static instance: TradingProfileService;
  private activeProfileId: TradingProfileId = 'BINARY_OTC';
  private listeners: Set<(profileId: TradingProfileId) => void> = new Set();

  private constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE);
      if (isValidTradingProfileId(saved)) {
        this.activeProfileId = saved;
      }
    } catch {
      this.activeProfileId = 'BINARY_OTC';
    }
  }

  public static getInstance(): TradingProfileService {
    if (!TradingProfileService.instance) {
      TradingProfileService.instance = new TradingProfileService();
    }
    return TradingProfileService.instance;
  }

  public getActiveProfileId(): TradingProfileId {
    return this.activeProfileId;
  }

  public getActiveProfile(): TradingProfileConfig {
    return getTradingProfile(this.activeProfileId);
  }

  public setActiveProfile(profileId: TradingProfileId): void {
    if (!isValidTradingProfileId(profileId)) return;
    const changed = this.activeProfileId !== profileId;
    this.activeProfileId = profileId;
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE, profileId);
    } catch {
      // Ignore storage quota exceptions
    }
    if (changed) {
      this.listeners.forEach((l) => l(profileId));
    }
  }

  public subscribe(listener: (profileId: TradingProfileId) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const tradingProfileService = TradingProfileService.getInstance();
