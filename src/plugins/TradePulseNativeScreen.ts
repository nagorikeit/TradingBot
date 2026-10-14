import { registerPlugin } from '@capacitor/core';

export interface FloatingOverlayConfig {
  showBadge?: boolean;
  initialX?: number;
  initialY?: number;
}

export interface FloatingOverlayData {
  direction: 'UP' | 'DOWN' | 'WAIT';
  confidence: number;
  durationText: string;
  verdictTitle: string;
  reasonText: string;
  latencyMs: number;
  symbol?: string;
  isStale?: boolean;
  frameCount?: number;
  lastFrameTime?: string;
  resolution?: string;
  captureState?: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'PERMISSION_REQ';
  aiState?: 'IDLE' | 'ANALYZING' | 'READY' | 'ERROR' | 'TIMEOUT';
  errorReason?: string;
}

export interface NativeCaptureFrameEvent {
  imageBase64: string;
  timestamp: number;
  sequenceId: number;
  width: number;
  height: number;
}

export interface TradePulseNativeScreenPlugin {
  /**
   * Checks if required permissions (Overlay & MediaProjection) are granted
   */
  checkPermissions(): Promise<{
    hasOverlayPermission: boolean;
    hasNotificationPermission: boolean;
  }>;

  /**
   * Requests SYSTEM_ALERT_WINDOW permission (opens device Settings page if needed)
   */
  requestOverlayPermission(): Promise<{ granted: boolean }>;

  /**
   * Prompts user with Android MediaProjection system dialog and starts ForegroundService
   */
  startScreenCapture(options?: {
    intervalSeconds?: number;
    targetWidth?: number;
    targetHeight?: number;
    quality?: number;
  }): Promise<{ success: boolean; message?: string }>;

  /**
   * Stops Native ForegroundService and MediaProjection capture
   */
  stopScreenCapture(): Promise<{ success: boolean }>;

  /**
   * Displays or updates the floating HUD overlay widget over all apps
   */
  showFloatingOverlay(data: FloatingOverlayData): Promise<{ success: boolean }>;

  /**
   * Updates data on active floating HUD overlay widget
   */
  updateFloatingOverlay(data: FloatingOverlayData): Promise<{ success: boolean }>;

  /**
   * Hides the floating HUD overlay widget
   */
  hideFloatingOverlay(): Promise<{ success: boolean }>;

  /**
   * Subscribes to frames emitted by Native Background Service
   */
  addListener(
    eventName: 'onFrameCaptured',
    listenerFunc: (frame: NativeCaptureFrameEvent) => void
  ): Promise<{ remove: () => void }>;

  /**
   * Synthesizes and plays spoken Bengali/English audio via Native OS Text-To-Speech engine
   * Works in background over other apps even when app is minimized or hidden.
   */
  speak(options: { text: string }): Promise<{ success: boolean; message?: string }>;

  /**
   * Stops any currently playing native audio speech
   */
  stopSpeaking(): Promise<{ success: boolean }>;
}

export const TradePulseNativeScreen = registerPlugin<TradePulseNativeScreenPlugin>(
  'TradePulseNativeScreen',
  {
    web: () => import('./webNativeFallback').then((m) => new m.TradePulseNativeScreenWeb()),
  }
);
