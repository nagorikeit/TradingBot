import {
  TradingProfileConfig,
  TradingProfileId,
  ScreenProfileMode,
  getTradingProfile,
  isValidTradingProfileId,
} from '../strategy/tradingProfiles';

const STORAGE_KEY_ACTIVE_PROFILE = 'tradepulse_active_trading_profile_v1';
const STORAGE_KEY_SCREEN_MODE = 'tradepulse_screen_profile_mode_v1';

class TradingProfileService {
  private static instance: TradingProfileService;
  private activeProfileId: TradingProfileId = 'BINARY_OTC';
  private screenProfileMode: ScreenProfileMode = 'AUTO';
  private listeners: Set<(profileId: TradingProfileId) => void> = new Set();

  private constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_PROFILE);
      if (isValidTradingProfileId(saved)) {
        this.activeProfileId = saved;
      }
      const savedScreenMode = localStorage.getItem(STORAGE_KEY_SCREEN_MODE);
      if (savedScreenMode === 'AUTO' || isValidTradingProfileId(savedScreenMode)) {
        this.screenProfileMode = savedScreenMode;
      }
    } catch {
      this.activeProfileId = 'BINARY_OTC';
      this.screenProfileMode = 'AUTO';
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

  public getScreenProfileMode(): ScreenProfileMode {
    return this.screenProfileMode;
  }

  public setScreenProfileMode(mode: ScreenProfileMode): void {
    if (mode !== 'AUTO' && !isValidTradingProfileId(mode)) return;
    const changed = this.screenProfileMode !== mode;
    this.screenProfileMode = mode;
    if (mode !== 'AUTO') {
      this.activeProfileId = mode;
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_PROFILE, mode);
      } catch {}
    }
    try {
      localStorage.setItem(STORAGE_KEY_SCREEN_MODE, mode);
    } catch {}
    if (changed) {
      this.listeners.forEach((l) => l(this.activeProfileId));
    }
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
