package com.tradepulse.bot.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.io.ByteArrayOutputStream;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;
import org.json.JSONArray;

/**
 * TradePulseNativeScreenPlugin
 * Provides:
 * 1. Android MediaProjection continuous background capture (Foreground Service)
 * 2. SYSTEM_ALERT_WINDOW floating draggable HUD overlay showing UP/DOWN/WAIT, Duration & Reasons
 * 3. Real-time frame streaming into TradePulse Vision AI engine
 * 4. Android Native TextToSpeech engine for loud voice directions over floating HUD
 */
@CapacitorPlugin(name = "TradePulseNativeScreen")
public class TradePulseNativeScreenPlugin extends Plugin {

    private static final int REQUEST_MEDIA_PROJECTION = 9021;
    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private Handler captureHandler;
    private Runnable captureRunnable;
    private int captureIntervalMs = 3000; // 3 seconds default
    private int sequenceCounter = 0;

    // Real-time Frame Cache & Scan Toggle State
    private volatile String latestFrameBase64 = null;
    private volatile int latestFrameWidth = 720;
    private volatile int latestFrameHeight = 1280;
    private volatile long latestFrameTimestamp = 0;
    private volatile boolean isScanningActive = false;
    private volatile boolean isScanRequested = false;
    private volatile boolean isOneClickScanPending = false;
    private PluginCall pendingCaptureCall = null;
    private Runnable overlayCountdownRunnable = null;
    private int overlaySecondsRemaining = 0;
    private volatile boolean isPreparationPhase = false;
    private volatile String activeSignaledDirection = null;
    private volatile String activeSignaledSymbol = null;
    private volatile int activeSignaledConfidence = 0;
    private volatile String activeSignalId = null;
    private volatile boolean isTradeActiveAndLocked = false;
    private final java.util.List<Runnable> pendingScanProgressRunnables = new java.util.ArrayList<>();

    // Profile & 5-Step Audit HUD Cache
    private volatile String activeTradingProfile = "AUTO";
    private volatile String lastResolvedTradingProfile = "BINARY_OTC";
    private volatile String lastResolvedProfileLabelBn = "";
    private volatile int lastConfirmedPoints = 0;
    private volatile boolean[] lastStepResults = new boolean[]{false, false, false, false, false};
    private volatile String lastClosedCandleColor = "UNCERTAIN";
    private volatile String lastClosedCandleLabel = "ক্লোজ: --";

    private void cancelPendingScanProgress() {
        if (captureHandler != null) {
            for (Runnable r : pendingScanProgressRunnables) {
                captureHandler.removeCallbacks(r);
            }
        }
        pendingScanProgressRunnables.clear();
        isOneClickScanPending = false;
    }

    // Floating overlay window state
    private WindowManager windowManager;
    private View overlayView;
    private WindowManager.LayoutParams overlayParams;

    // Android Native Text-To-Speech engine for floating overlay audio guidance
    private TextToSpeech textToSpeech;
    private boolean isTtsInitialized = false;

    // Native Background Executor & API Endpoint for continuous connectivity over other apps
    private String backendUrl = "https://ais-dev-2mn2ktc74egyugovwwvzoy-634716608323.asia-east1.run.app";
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean isAnalyzingNativeFrame = new AtomicBoolean(false);
    private volatile boolean isTradePulseActivityInForeground = true;
    private static java.lang.ref.WeakReference<TradePulseNativeScreenPlugin> activeInstanceRef = null;
    private static volatile String pendingAuthCallbackUri = null;

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        isTradePulseActivityInForeground = true;
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        isTradePulseActivityInForeground = false;
    }

    @Override
    public void load() {
        super.load();
        activeInstanceRef = new java.lang.ref.WeakReference<>(this);
        Context context = getContext();
        projectionManager = (MediaProjectionManager) context.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        captureHandler = new Handler(Looper.getMainLooper());
        initTextToSpeech(context);
    }

    private void initTextToSpeech(final Context context) {
        try {
            textToSpeech = new TextToSpeech(context.getApplicationContext(), new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && textToSpeech != null) {
                        isTtsInitialized = true;
                        try {
                            Locale bn = new Locale("bn", "BD");
                            int res = textToSpeech.setLanguage(bn);
                            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                                textToSpeech.setLanguage(Locale.US);
                            }
                        } catch (Exception ignored) {
                            textToSpeech.setLanguage(Locale.US);
                        }
                    }
                }
            });
        } catch (Exception e) {
            Log.w("TradePulseNativeScreen", "Failed to initialize TextToSpeech: " + e.getMessage());
        }
    }

    @PluginMethod
    public void speak(final PluginCall call) {
        final String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Text cannot be empty");
            return;
        }

        if (textToSpeech != null && isTtsInitialized) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "TradePulseTTS_" + System.currentTimeMillis());
                        } else {
                            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null);
                        }
                        JSObject res = new JSObject();
                        res.put("success", true);
                        call.resolve(res);
                    } catch (Exception e) {
                        call.reject("Speech playback failed: " + e.getMessage());
                    }
                }
            });
        } else {
            // Re-init if needed and resolve gracefully
            if (textToSpeech == null) {
                initTextToSpeech(getContext());
            }
            call.resolve(new JSObject().put("success", false).put("message", "TTS initializing"));
        }
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
        call.resolve(new JSObject().put("success", true));
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            try {
                textToSpeech.stop();
                textToSpeech.shutdown();
            } catch (Exception ignored) {}
            textToSpeech = null;
            isTtsInitialized = false;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject ret = new JSObject();
        boolean hasOverlay = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            hasOverlay = Settings.canDrawOverlays(getContext());
        }
        ret.put("hasOverlayPermission", hasOverlay);
        ret.put("hasNotificationPermission", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(getContext())) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName())
                );
                getActivity().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("granted", false);
                ret.put("message", "Opened system Overlay Permission settings");
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void startScreenCapture(PluginCall call) {
        try {
            int intervalSec = call.getInt("intervalSeconds", 3);
            this.captureIntervalMs = Math.max(2, intervalSec) * 1000;

            String customUrl = call.getString("backendUrl", "");
            if (customUrl != null && !customUrl.trim().isEmpty()) {
                this.backendUrl = customUrl.trim().replaceAll("/+$", "");
            }

            String profile = call.getString("tradingProfile", "");
            if (profile != null && !profile.trim().isEmpty()) {
                this.activeTradingProfile = profile.trim();
            }

            if (projectionManager == null) {
                call.reject("MediaProjectionManager not available on this device");
                return;
            }

            // Prompt system dialog to capture screen
            Intent captureIntent = projectionManager.createScreenCaptureIntent();
            startActivityForResult(call, captureIntent, "handleProjectionResult");
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to request screen capture: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void handleProjectionResult(final PluginCall call, final ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User declined screen projection permission");
            return;
        }

        // Set callback to receive the active MediaProjection from ScreenCaptureService
        // strictly AFTER startForeground() has been executed on the foreground service.
        ScreenCaptureService.setCallback(new ScreenCaptureService.ProjectionCallback() {
            @Override
            public void onProjectionCreated(final MediaProjection projection) {
                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            mediaProjection = projection;
                            if (mediaProjection == null) {
                                call.reject("Failed to obtain MediaProjection instance");
                                return;
                            }

                            if (Build.VERSION.SDK_INT >= 34) {
                                mediaProjection.registerCallback(new MediaProjection.Callback() {
                                    @Override
                                    public void onStop() {
                                        super.onStop();
                                        mediaProjection = null;
                                    }
                                }, captureHandler);
                            }

                            setupVirtualDisplay();
                            // Do NOT start automatic frame loop - wait for user to click Scan button!

                            JSObject res = new JSObject();
                            res.put("success", true);
                            call.resolve(res);
                        } catch (Exception e) {
                            e.printStackTrace();
                            call.reject("Failed during virtual display setup: " + e.getMessage());
                        }
                    }
                });
            }

            @Override
            public void onProjectionFailed(final Exception error) {
                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        call.reject("Failed to initialize MediaProjection: " + error.getMessage());
                    }
                });
            }
        });

        // Start Foreground Service with MEDIA_PROJECTION type and pass intent extras
        try {
            Intent serviceIntent = new Intent(getContext(), ScreenCaptureService.class);
            serviceIntent.putExtra("resultCode", result.getResultCode());
            serviceIntent.putExtra("resultData", result.getData());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to start ScreenCaptureService: " + e.getMessage());
        }
    }

    private void setupVirtualDisplay() {
        DisplayMetrics metrics = getContext().getResources().getDisplayMetrics();
        int screenWidth = metrics.widthPixels > 0 ? metrics.widthPixels : 720;
        int screenHeight = metrics.heightPixels > 0 ? metrics.heightPixels : 1280;

        // Scale to 1080 width while preserving true device aspect ratio for crisp candle wicks & timers
        float scale = Math.min(1.0f, 1080.0f / (float) screenWidth);
        int width = Math.round(screenWidth * scale);
        int height = Math.round(screenHeight * scale);
        if (width % 2 != 0) width++;
        if (height % 2 != 0) height++;
        int density = metrics.densityDpi > 0 ? metrics.densityDpi : DisplayMetrics.DENSITY_DEFAULT;

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(new ImageReader.OnImageAvailableListener() {
            @Override
            public void onImageAvailable(ImageReader reader) {
                Image image = null;
                try {
                    image = reader.acquireLatestImage();
                    if (image == null) return;

                    Image.Plane[] planes = image.getPlanes();
                    ByteBuffer buffer = planes[0].getBuffer();
                    int pixelStride = planes[0].getPixelStride();
                    int rowStride = planes[0].getRowStride();
                    int w = image.getWidth();
                    int h = image.getHeight();
                    int rowPadding = rowStride - pixelStride * w;
                    int safeWidth = (pixelStride > 0) ? (w + rowPadding / pixelStride) : w;
                    int requiredBytes = safeWidth * h * 4;

                    Bitmap bitmap = Bitmap.createBitmap(
                            safeWidth,
                            h,
                            Bitmap.Config.ARGB_8888
                    );
                    if (buffer.remaining() >= requiredBytes) {
                        bitmap.copyPixelsFromBuffer(buffer);
                    } else {
                        // Resilient padding fix for Tecno / Infinix / MediaTek drivers
                        ByteBuffer paddedBuffer = ByteBuffer.allocateDirect(requiredBytes);
                        buffer.rewind();
                        paddedBuffer.put(buffer);
                        paddedBuffer.rewind();
                        bitmap.copyPixelsFromBuffer(paddedBuffer);
                    }

                    Bitmap cropped = (safeWidth == w) ? bitmap : Bitmap.createBitmap(bitmap, 0, 0, w, h);
                    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
                    cropped.compress(Bitmap.CompressFormat.JPEG, 85, byteArrayOutputStream);
                    byte[] byteArray = byteArrayOutputStream.toByteArray();

                    latestFrameBase64 = "data:image/jpeg;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP);
                    latestFrameWidth = w;
                    latestFrameHeight = h;
                    latestFrameTimestamp = System.currentTimeMillis();

                    if (cropped != bitmap) {
                        cropped.recycle();
                    }
                    bitmap.recycle();

                    // If a pending captureSingleFrame call was waiting for a fresh frame
                    if (pendingCaptureCall != null) {
                        sequenceCounter++;
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("imageBase64", latestFrameBase64);
                        res.put("timestamp", latestFrameTimestamp);
                        res.put("sequenceId", sequenceCounter);
                        res.put("width", latestFrameWidth);
                        res.put("height", latestFrameHeight);
                        pendingCaptureCall.resolve(res);
                        pendingCaptureCall = null;
                    }

                    // If a scan was requested
                    if (isScanRequested) {
                        isScanRequested = false;
                        emitCachedFrame();
                    }

                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    if (image != null) {
                        image.close();
                    }
                }
            }
        }, captureHandler);

        virtualDisplay = mediaProjection.createVirtualDisplay(
                "TradePulseLiveCapture",
                width,
                height,
                density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader.getSurface(),
                null,
                null
        );
    }

    private void emitCachedFrame() {
        if (latestFrameBase64 == null) return;
        sequenceCounter++;
        JSObject event = new JSObject();
        event.put("imageBase64", latestFrameBase64);
        event.put("timestamp", latestFrameTimestamp > 0 ? latestFrameTimestamp : System.currentTimeMillis());
        event.put("sequenceId", sequenceCounter);
        event.put("width", latestFrameWidth);
        event.put("height", latestFrameHeight);

        notifyListeners("onFrameCaptured", event);
        // Do NOT nullify latestFrameBase64 - preserve current screen state for instant resumption
    }

    private void captureAndEmitLatestFrame() {
        if (latestFrameBase64 != null) {
            emitCachedFrame();
            executeNativeAnalysis(latestFrameBase64, latestFrameTimestamp);
            return;
        }
        isScanRequested = true;
    }

    private void analyzeNativeFrameInBackground(final String frameBase64, final long timestamp) {
        executeNativeAnalysis(frameBase64, timestamp);
    }

    public void executeNativeAnalysis(final String frameBase64, final long timestamp) {
        if (frameBase64 == null) {
            showAnalysisErrorOnOverlay("স্ক্রিন ফ্রেম লোড হয়নি — আবার চেষ্টা করুন");
            return;
        }

        // STRICT TRADE LOCK GUARD:
        // Do not allow background auto-scans to mutate a running locked trade, unless user explicitly clicked scan
        if (isTradeActiveAndLocked && overlaySecondsRemaining > 0 && !isOneClickScanPending) {
            return;
        }

        if (!isAnalyzingNativeFrame.compareAndSet(false, true)) {
            return; // Analysis already running
        }

        networkExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    // Priority 1: Cloud Gemini Vision 5-Step Analyzer
                    if (tryBackendVisionAnalysis(frameBase64, timestamp)) {
                        return;
                    }
                    // Priority 2: On-Device Fallback Computer Vision Analyzer (Offline resilience)
                    analyzeFrameLocallyNative(frameBase64);
                } catch (Exception e) {
                    Log.e("TradePulseNativeScreen", "Native analysis exception: " + e.getMessage(), e);
                    showAnalysisErrorOnOverlay("বিশ্লেষণ ব্যর্থ হয়েছে — আবার চাপুন");
                } finally {
                    isAnalyzingNativeFrame.set(false);
                }
            }
        });
    }

    private String buildZoomedCandleCrop(final String frameBase64) {
        try {
            if (frameBase64 == null || frameBase64.isEmpty()) return null;
            String raw = frameBase64;
            int commaIdx = raw.indexOf(",");
            if (commaIdx != -1) raw = raw.substring(commaIdx + 1);
            byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
            Bitmap src = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (src == null) return null;

            int w = src.getWidth();
            int h = src.getHeight();
            if (w < 120 || h < 120) {
                src.recycle();
                return null;
            }
            boolean isPortrait = h > w;
            int sx = (int) (w * (isPortrait ? 0.44f : 0.54f));
            int sy = (int) (h * (isPortrait ? 0.16f : 0.08f));
            int sw = Math.max(80, Math.min(w - sx, (int) (w * (isPortrait ? 0.54f : 0.44f))));
            int sh = Math.max(80, Math.min(h - sy, (int) (h * (isPortrait ? 0.58f : 0.80f))));

            Bitmap cropped = Bitmap.createBitmap(src, sx, sy, sw, sh);
            src.recycle();

            int outW = Math.min(1200, Math.max(sw, Math.round(sw * 2.2f)));
            int outH = Math.max(80, Math.round(((float) sh / (float) sw) * outW));
            Bitmap scaled = (outW == sw) ? cropped : Bitmap.createScaledBitmap(cropped, outW, outH, true);
            if (scaled != cropped) cropped.recycle();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.JPEG, 92, baos);
            scaled.recycle();
            return "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean tryBackendVisionAnalysis(final String frameBase64, final long timestamp) {
        HttpURLConnection conn = null;
        try {
            if (backendUrl == null || backendUrl.trim().isEmpty()) {
                return false;
            }
            URL url = new URL(backendUrl + "/api/agent/vision/analyze-frame");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(20000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

            JSONObject payload = new JSONObject();
            payload.put("imageBase64", frameBase64);
            String zoomedCrop = buildZoomedCandleCrop(frameBase64);
            if (zoomedCrop != null) {
                payload.put("zoomedCandleBase64", zoomedCrop);
            }
            payload.put("mimeType", "image/jpeg");
            payload.put("frameCapturedAt", timestamp > 0 ? timestamp : System.currentTimeMillis());
            payload.put("tradingProfile", activeTradingProfile != null ? activeTradingProfile : "AUTO");

            byte[] out = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(out);
            }

            int status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                Log.w("TradePulseNativeScreen", "Backend vision non-200: " + status);
                return false;
            }

            StringBuilder sb = new StringBuilder();
            try (InputStream is = conn.getInputStream();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            JSONObject json = new JSONObject(sb.toString());
            if (!json.optBoolean("ok", false) || !json.has("result")) {
                return false;
            }
            JSONObject result = json.getJSONObject("result");
            String direction = result.optString("direction", "WAIT");
            int confidence = result.optInt("confidence", 0);
            String verdictTitle = result.optString("verdictTitle", direction);

            JSONObject vision = result.optJSONObject("visionData");
            String symbol = (vision != null && !vision.optString("symbol", "").isEmpty())
                    ? vision.optString("symbol", "CHART")
                    : "CHART";

            String finalReason = "";
            JSONArray reasoningArr = result.optJSONArray("reasoning");
            if (reasoningArr != null && reasoningArr.length() > 0) {
                finalReason = reasoningArr.optString(0, "");
            }
            if ((finalReason == null || finalReason.isEmpty()) && vision != null) {
                finalReason = vision.optString("candlestickPattern", verdictTitle);
            }

            // Parse 5-step audit metrics & closed candle color
            boolean[] steps = new boolean[]{false, false, false, false, false};
            int pts = 0;
            String closedColor = (vision != null) ? vision.optString("closedCandleColor", "UNCERTAIN") : "UNCERTAIN";
            String closedLabel = "ক্লোজ: --";
            JSObject flowJs = null;

            JSONObject flowJson = result.optJSONObject("signalFlow");
            if (flowJson != null) {
                flowJs = new JSObject(flowJson.toString());
                pts = flowJson.optInt("confirmedPoints", 0);
                JSONArray stepChecks = flowJson.optJSONArray("stepChecks");
                if (stepChecks != null && stepChecks.length() == 5) {
                    int counted = 0;
                    for (int i = 0; i < 5; i++) {
                        JSONObject sc = stepChecks.optJSONObject(i);
                        boolean passed = sc != null && sc.optBoolean("passed", false);
                        steps[i] = passed;
                        if (passed) counted++;
                    }
                    if (pts == 0) pts = counted;
                }
                JSONObject cData = flowJson.optJSONObject("candleData");
                if (cData != null) {
                    JSONObject cClosed = cData.optJSONObject("closedCandle");
                    if (cClosed != null) {
                        String t = cClosed.optString("type", "");
                        if ("UNCERTAIN".equals(closedColor)) {
                            if ("BULLISH".equals(t)) closedColor = "GREEN";
                            else if ("BEARISH".equals(t)) closedColor = "RED";
                            else if ("DOJI".equals(t)) closedColor = "DOJI";
                        }
                        String lbl = cClosed.optString("labelBn", "");
                        if (lbl != null && !lbl.isEmpty()) {
                            closedLabel = "ক্লোজ: " + lbl;
                        }
                    }
                }
            }

            if ("ক্লোজ: --".equals(closedLabel)) {
                if ("GREEN".equalsIgnoreCase(closedColor)) closedLabel = "ক্লোজ: সবুজ";
                else if ("RED".equalsIgnoreCase(closedColor)) closedLabel = "ক্লোজ: লাল";
                else if ("DOJI".equalsIgnoreCase(closedColor)) closedLabel = "ক্লোজ: ডোজি";
                else closedLabel = "ক্লোজ: অস্পষ্ট";
            }

            String resolvedProf = result.optString("tradingProfileId", "BINARY_OTC");
            String resolvedLabelBn = result.optString("profileLabelBn", "");
            this.lastResolvedTradingProfile = (resolvedProf != null && !resolvedProf.isEmpty()) ? resolvedProf : "BINARY_OTC";
            this.lastResolvedProfileLabelBn = resolvedLabelBn != null ? resolvedLabelBn : "";
            this.lastConfirmedPoints = pts;
            this.lastStepResults = steps;
            this.lastClosedCandleColor = closedColor;
            this.lastClosedCandleLabel = closedLabel;

            String displaySymbol = (resolvedLabelBn != null && !resolvedLabelBn.isEmpty())
                    ? (symbol + " · " + resolvedLabelBn)
                    : symbol;
            updateOverlayUI(direction, confidence, verdictTitle, finalReason, displaySymbol, flowJs);
            return true;
        } catch (Exception e) {
            Log.w("TradePulseNativeScreen", "Backend vision fallback to local: " + e.getMessage());
            return false;
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Exception ignored) {}
            }
        }
    }

    private static class CandleBand {
        int startX;
        int endX;
        int centerX;
        boolean isGreen;
        int greenCount;
        int redCount;
        int minY = 9999;
        int maxY = 0;
        int height = 0;
        int upperWickPx = 0;
        int lowerWickPx = 0;
        int bodyHeight = 0;
        boolean isHammer = false;
        boolean isShootingStar = false;
        boolean isDoji = false;
    }

    private static String classifyAggregatedOhlc(java.util.List<CandleBand> bands, int poolSize, int period, int singleMinBodyPct) {
        if (poolSize < period || period <= 0) return "SIDEWAYS";
        java.util.List<int[]> bars = new java.util.ArrayList<>(); // [open, high, low, close, colorFlag(1=G,-1=R,0=D), bodyPct]
        for (int end = poolSize; end - period >= 0; end -= period) {
            CandleBand first = bands.get(end - period);
            CandleBand last = bands.get(end - 1);
            int firstBodyTop = first.minY + first.upperWickPx;
            int firstBodyBottom = first.maxY - first.lowerWickPx;
            int lastBodyTop = last.minY + last.upperWickPx;
            int lastBodyBottom = last.maxY - last.lowerWickPx;
            int open = first.isGreen ? -firstBodyBottom : -firstBodyTop;
            int close = last.isGreen ? -lastBodyTop : -lastBodyBottom;
            int high = -999999;
            int low = 999999;
            for (int i = end - period; i < end; i++) {
                CandleBand c = bands.get(i);
                if (-c.minY > high) high = -c.minY;
                if (-c.maxY < low) low = -c.maxY;
            }
            int span = Math.max(1, high - low);
            int bodyPct = Math.round(100f * Math.abs(close - open) / span);
            int colorFlag = (bodyPct < 15) ? 0 : (close >= open ? 1 : -1);
            bars.add(0, new int[]{open, high, low, close, colorFlag, bodyPct});
        }
        if (bars.isEmpty()) return "SIDEWAYS";
        int[] latest = bars.get(bars.size() - 1);
        if (bars.size() == 1) {
            if (latest[4] == 1 && latest[5] >= singleMinBodyPct) return "UPTREND";
            if (latest[4] == -1 && latest[5] >= singleMinBodyPct) return "DOWNTREND";
            return "SIDEWAYS";
        }
        int[] prev = bars.get(bars.size() - 2);
        int recentStart = Math.max(0, bars.size() - 3);
        int greens = 0, reds = 0;
        for (int i = recentStart; i < bars.size(); i++) {
            if (bars.get(i)[4] == 1) greens++;
            else if (bars.get(i)[4] == -1) reds++;
        }
        int prevSpan = Math.max(2, prev[1] - prev[2]);
        boolean hhhl = latest[3] > prev[3] && latest[2] >= prev[2] - (int) (prevSpan * 0.15f);
        boolean lhll = latest[3] < prev[3] && latest[1] <= prev[1] + (int) (prevSpan * 0.15f);
        if (latest[4] == 1 && latest[5] >= 14 && (greens >= 2 || hhhl || latest[3] > prev[0])) return "UPTREND";
        if (latest[4] == -1 && latest[5] >= 14 && (reds >= 2 || lhll || latest[3] < prev[0])) return "DOWNTREND";
        return "SIDEWAYS";
    }

    private static boolean isRecentHighBreakout(java.util.List<CandleBand> bands, int count, CandleBand target) {
        int checkStart = Math.max(0, count - 6);
        for (int i = checkStart; i < count; i++) {
            CandleBand b = bands.get(i);
            if (b != target && b.minY < target.minY) {
                return false;
            }
        }
        return true;
    }

    private static boolean isRecentLowBreakdown(java.util.List<CandleBand> bands, int count, CandleBand target) {
        int checkStart = Math.max(0, count - 6);
        for (int i = checkStart; i < count; i++) {
            CandleBand b = bands.get(i);
            if (b != target && b.maxY > target.maxY) {
                return false;
            }
        }
        return true;
    }

    private void analyzeFrameLocallyNative(final String frameBase64) {
        try {
            if (isTradeActiveAndLocked && overlaySecondsRemaining > 0 && !isOneClickScanPending) {
                return;
            }

            if (frameBase64 == null || frameBase64.trim().isEmpty()) {
                showAnalysisErrorOnOverlay("স্ক্রিন ফ্রেম লোড হয়নি — আবার চাপুন");
                return;
            }

            String cleanBase64 = frameBase64;
            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex != -1) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
            if (bitmap == null) {
                showAnalysisErrorOnOverlay("ফ্রেম ডিকোড করা যায়নি — আবার চাপুন");
                return;
            }

            int width = bitmap.getWidth();
            int height = bitmap.getHeight();

            // 1. Adaptive Chart Canvas ROI (Region of Interest)
            // Top ~22% is browser address bar, deposit header & floating HUD overlay
            // Bottom ~28% is trade panel (Investment %, Timer, and huge green Buy / red Sell buttons)
            // Central ~22% to 70% is the true candlestick chart canvas
            // Right edge (from 85% to 100%) has the vertical price scale & current price badge
            boolean isPortraitFrame = height > width;
            int startY = (int) (height * (isPortraitFrame ? 0.14f : 0.05f));
            int endY = (int) (height * (isPortraitFrame ? 0.78f : 0.95f));
            int startX = (int) (width * (isPortraitFrame ? 0.05f : 0.03f)); // Starts past left sidebar/briefcase icon
            int endX = (int) (width * (isPortraitFrame ? 0.84f : 0.88f)); // Excludes right price axis & live price pill

            // Determine Floating Overlay's exact on-screen position so we can MASK IT OUT!
            // This prevents the overlay's own green "১-ক্লিক স্ক্যান" button and border from contaminating candles!
            int ovLeft = -1, ovTop = -1, ovRight = -1, ovBottom = -1;
            if (overlayView != null) {
                int[] loc = new int[2];
                overlayView.getLocationOnScreen(loc);
                DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
                float sX = (float) width / (float) (dm.widthPixels > 0 ? dm.widthPixels : width);
                float sY = (float) height / (float) (dm.heightPixels > 0 ? dm.heightPixels : height);
                ovLeft = (int) (loc[0] * sX);
                ovTop = (int) (loc[1] * sY);
                ovRight = (int) ((loc[0] + overlayView.getWidth()) * sX);
                ovBottom = (int) ((loc[1] + overlayView.getHeight()) * sY);
            }

            int greenPixels = 0;
            int redPixels = 0;
            int[] colGreen = new int[width];
            int[] colRed = new int[width];
            int[] colMinY = new int[width];
            int[] colMaxY = new int[width];
            java.util.Arrays.fill(colMinY, 9999);

            // Sample pixels per column with vertical continuity check so thin horizontal EMA/Bollinger lines
            // (height < 4px at step=2) don't bridge adjacent candles or create phantom bands.
            for (int x = startX; x < endX; x++) {
                int runLen = 0;
                int runGreen = 0;
                int runRed = 0;
                int runMinY = 9999;
                int runMaxY = 0;

                for (int y = startY; y <= endY; y += 2) {
                    boolean inOverlay = ovLeft >= 0 && x >= ovLeft - 10 && x <= ovRight + 10 && y >= ovTop - 10 && y <= ovBottom + 10;
                    int hitType = 0; // 1 = green, 2 = red
                    if (y < endY && !inOverlay) {
                        int pixel = bitmap.getPixel(x, y);
                        int r = (pixel >> 16) & 0xff;
                        int g = (pixel >> 8) & 0xff;
                        int b = pixel & 0xff;

                        int max = Math.max(r, Math.max(g, b));
                        int min = Math.min(r, Math.min(g, b));
                        int delta = max - min;

                        if (delta >= 14 && max >= 50) {
                            float hue;
                            if (max == r) {
                                hue = (60f * ((float)(g - b) / delta) + 360f) % 360f;
                            } else if (max == g) {
                                hue = (60f * ((float)(b - r) / delta) + 120f) % 360f;
                            } else {
                                hue = (60f * ((float)(r - g) / delta) + 240f) % 360f;
                            }
                            float sat = (float) delta / (float) max;

                            boolean isGreen = (g >= 48 && g > r + 8 && g >= b - 18 && hue >= 100f && hue <= 195f && sat >= 0.12f);
                            boolean isRed = (r >= 55 && r > g + 16 && r > b + 12 && (hue >= 335f || hue <= 25f) && sat >= 0.14f);
                            if (isGreen) hitType = 1;
                            else if (isRed) hitType = 2;
                        }
                    }

                    if (hitType > 0) {
                        runLen++;
                        if (hitType == 1) runGreen++;
                        else runRed++;
                        if (y < runMinY) runMinY = y;
                        if (y > runMaxY) runMaxY = y;
                    } else {
                        if (runLen >= 3) {
                            greenPixels += runGreen;
                            redPixels += runRed;
                            colGreen[x] += runGreen;
                            colRed[x] += runRed;
                            if (runMinY < colMinY[x]) colMinY[x] = runMinY;
                            if (runMaxY > colMaxY[x]) colMaxY[x] = runMaxY;
                        }
                        runLen = 0;
                        runGreen = 0;
                        runRed = 0;
                        runMinY = 9999;
                        runMaxY = 0;
                    }
                }
            }

            // 2. Real-Time Screen Environment & Background Diagnostics
            int bgNavyDark = 0;
            int bgWhiteLight = 0;
            int pureBlackPixels = 0;
            int totalBgSampled = 0;
            int bgStep = 4;
            for (int y = startY; y < endY; y += bgStep) {
                for (int x = startX; x < endX; x += bgStep) {
                    if (ovLeft >= 0 && x >= ovLeft - 10 && x <= ovRight + 10 && y >= ovTop - 10 && y <= ovBottom + 10) {
                        continue;
                    }

                    int pixel = bitmap.getPixel(x, y);
                    int r = (pixel >> 16) & 0xff;
                    int g = (pixel >> 8) & 0xff;
                    int b = pixel & 0xff;
                    totalBgSampled++;

                    if (r <= 15 && g <= 15 && b <= 15) {
                        pureBlackPixels++;
                    }
                    if ((r <= 85 && g <= 90 && b <= 125) || (r <= 65 && g <= 65 && b <= 65)) {
                        bgNavyDark++;
                    } else if (r >= 200 && g >= 200 && b >= 200) {
                        bgWhiteLight++;
                    }
                }
            }

            // Broker Signature Diagnostics:
            // Check for broker trading controls (Green Buy + Red Sell buttons at bottom panel)
            int bottomGreen = 0;
            int bottomRed = 0;
            int bStart = (int) (height * 0.74f);
            int bEnd = (int) (height * 0.94f);
            for (int y = bStart; y < bEnd; y += 4) {
                for (int x = 0; x < width; x += 4) {
                    int p = bitmap.getPixel(x, y);
                    int pr = (p >> 16) & 0xff;
                    int pg = (p >> 8) & 0xff;
                    int pb = p & 0xff;
                    if (pg >= 120 && pg > pr + 30 && pg > pb + 20) bottomGreen++;
                    if (pr >= 150 && pr > pg + 40 && pr > pb + 40) bottomRed++;
                }
            }

            // Check for right-edge vertical price axis and active price badge
            int rightAxisDigits = 0;
            int rXStart = (int) (width * 0.82f);
            for (int y = startY; y < endY; y += 4) {
                for (int x = rXStart; x < width; x += 4) {
                    int p = bitmap.getPixel(x, y);
                    int pr = (p >> 16) & 0xff;
                    int pg = (p >> 8) & 0xff;
                    int pb = p & 0xff;
                    if ((pb > 150 && pb > pr + 20) || (pr > 200 && pg > 200 && pb > 200)) {
                        rightAxisDigits++;
                    }
                }
            }

            float blackRatio = (float) pureBlackPixels / (float) Math.max(1, totalBgSampled);
            int totalCandlePixels = greenPixels + redPixels;

            // Display is off or locked
            if (blackRatio > 0.90f) {
                updateOverlayUI(
                        "WAIT",
                        0,
                        "⬛ পর্দা অন্ধকার / লকড",
                        "স্ক্রিন অন করে ব্রোকার চার্ট সামনে রাখুন",
                        "NO_SCREEN"
                );
                bitmap.recycle();
                return;
            }

            // Web page open, but completely no candle visible
            if (totalCandlePixels < 15) {
                updateOverlayUI(
                        "WAIT",
                        0,
                        "🌐 ক্যান্ডেল পাওয়া যায়নি",
                        "ক্যান্ডেলস্টিক চার্ট স্ক্রিনের মাঝখানে রেখে স্ক্যান করুন",
                        "NO_CANDLE"
                );
                bitmap.recycle();
                return;
            }

            // 3. Candlestick Band Segmentation across X axis with gap-tolerance
            java.util.List<CandleBand> bands = new java.util.ArrayList<>();
            boolean inBand = false;
            int bandStart = 0;
            int bandGreen = 0;
            int bandRed = 0;
            int emptyCols = 0;

            for (int x = startX; x < endX; x++) {
                int colTotal = colGreen[x] + colRed[x];
                if (colTotal >= 2) {
                    if (!inBand) {
                        inBand = true;
                        bandStart = x;
                        bandGreen = 0;
                        bandRed = 0;
                    }
                    bandGreen += colGreen[x];
                    bandRed += colRed[x];
                    emptyCols = 0;
                } else {
                    if (inBand) {
                        emptyCols++;
                        if (emptyCols >= 3 || x == endX - 1) {
                            inBand = false;
                            int bandWidth = (x - emptyCols) - bandStart + 1;
                            if (bandWidth >= 2 && bandWidth <= 150) {
                                CandleBand cb = new CandleBand();
                                cb.startX = bandStart;
                                cb.endX = x - emptyCols;
                                cb.centerX = (cb.startX + cb.endX) / 2;
                                cb.isGreen = bandGreen >= bandRed;
                                cb.greenCount = bandGreen;
                                cb.redCount = bandRed;

                                int bMinY = 9999;
                                int bMaxY = 0;
                                int maxColCount = 0;
                                for (int bx = cb.startX; bx <= cb.endX; bx++) {
                                    int colCount = colGreen[bx] + colRed[bx];
                                    if (colCount > 0) {
                                        if (colMinY[bx] < bMinY) bMinY = colMinY[bx];
                                        if (colMaxY[bx] > bMaxY) bMaxY = colMaxY[bx];
                                        if (colCount > maxColCount) maxColCount = colCount;
                                    }
                                }
                                cb.minY = bMinY;
                                cb.maxY = bMaxY;
                                cb.height = Math.max(0, bMaxY - bMinY + 1);

                                // Distinguish Body vs Wicks:
                                // Body columns have high pixel density. Central columns with wicks extend higher and lower.
                                int bodyTop = bMaxY;
                                int bodyBottom = bMinY;
                                int thresh = Math.max(3, (int)(maxColCount * 0.40f));
                                for (int bx = cb.startX; bx <= cb.endX; bx++) {
                                    int count = colGreen[bx] + colRed[bx];
                                    if (count >= thresh) {
                                        if (colMinY[bx] < bodyTop) bodyTop = colMinY[bx];
                                        if (colMaxY[bx] > bodyBottom) bodyBottom = colMaxY[bx];
                                    }
                                }
                                if (bodyBottom < bodyTop) {
                                    bodyTop = bMinY;
                                    bodyBottom = bMaxY;
                                }
                                cb.upperWickPx = Math.max(0, bodyTop - bMinY);
                                cb.lowerWickPx = Math.max(0, bMaxY - bodyBottom);
                                cb.bodyHeight = Math.max(2, bodyBottom - bodyTop + 1);

                                float body = (float) cb.bodyHeight;
                                float upWick = (float) cb.upperWickPx;
                                float downWick = (float) cb.lowerWickPx;
                                cb.isHammer = (downWick >= body * 1.5f && upWick <= body * 0.5f && downWick >= 6);
                                cb.isShootingStar = (upWick >= body * 1.5f && downWick <= body * 0.5f && upWick >= 6);
                                cb.isDoji = (body <= 4 && (upWick >= 4 || downWick >= 4));

                                boolean isCandleShape = cb.height >= 7
                                        && (cb.height >= bandWidth * 0.45f || cb.bodyHeight >= 5 || cb.upperWickPx >= 3 || cb.lowerWickPx >= 3);
                                float fillDensity = (float) (bandGreen + bandRed) * 2.0f / (float) (Math.max(1, bandWidth) * Math.max(1, cb.height));
                                boolean isHollowBox = (bandWidth > 20 && cb.upperWickPx < 3 && cb.lowerWickPx < 3 && cb.bodyHeight < 5 && fillDensity < 0.25f);
                                if (isCandleShape && !isHollowBox) {
                                    bands.add(cb);
                                }
                            }
                            emptyCols = 0;
                        }
                    }
                }
            }

            // Close trailing in-progress band at the right edge if present
            if (inBand) {
                int bandWidth = (endX - emptyCols) - bandStart;
                if (bandWidth >= 2 && bandWidth <= 150) {
                    CandleBand cb = new CandleBand();
                    cb.startX = bandStart;
                    cb.endX = endX - 1 - emptyCols;
                    cb.centerX = (cb.startX + cb.endX) / 2;
                    cb.isGreen = bandGreen >= bandRed;
                    cb.greenCount = bandGreen;
                    cb.redCount = bandRed;

                    int bMinY = 9999;
                    int bMaxY = 0;
                    int maxColCount = 0;
                    for (int bx = cb.startX; bx <= cb.endX; bx++) {
                        int colCount = colGreen[bx] + colRed[bx];
                        if (colCount > 0) {
                            if (colMinY[bx] < bMinY) bMinY = colMinY[bx];
                            if (colMaxY[bx] > bMaxY) bMaxY = colMaxY[bx];
                            if (colCount > maxColCount) maxColCount = colCount;
                        }
                    }
                    cb.minY = bMinY;
                    cb.maxY = bMaxY;
                    cb.height = Math.max(0, bMaxY - bMinY + 1);

                    int bodyTop = bMaxY;
                    int bodyBottom = bMinY;
                    int thresh = Math.max(3, (int)(maxColCount * 0.40f));
                    for (int bx = cb.startX; bx <= cb.endX; bx++) {
                        int count = colGreen[bx] + colRed[bx];
                        if (count >= thresh) {
                            if (colMinY[bx] < bodyTop) bodyTop = colMinY[bx];
                            if (colMaxY[bx] > bodyBottom) bodyBottom = colMaxY[bx];
                        }
                    }
                    if (bodyBottom < bodyTop) {
                        bodyTop = bMinY;
                        bodyBottom = bMaxY;
                    }
                    cb.upperWickPx = Math.max(0, bodyTop - bMinY);
                    cb.lowerWickPx = Math.max(0, bMaxY - bodyBottom);
                    cb.bodyHeight = Math.max(2, bodyBottom - bodyTop + 1);

                    float body = (float) cb.bodyHeight;
                    float upWick = (float) cb.upperWickPx;
                    float downWick = (float) cb.lowerWickPx;
                    cb.isHammer = (downWick >= body * 1.5f && upWick <= body * 0.5f && downWick >= 6);
                    cb.isShootingStar = (upWick >= body * 1.5f && downWick <= body * 0.5f && upWick >= 6);
                    cb.isDoji = (body <= 4 && (upWick >= 4 || downWick >= 4));

                    boolean isCandleShape = cb.height >= 7
                            && (cb.height >= bandWidth * 0.45f || cb.bodyHeight >= 5 || cb.upperWickPx >= 3 || cb.lowerWickPx >= 3);
                    float fillDensity = (float) (bandGreen + bandRed) * 2.0f / (float) (Math.max(1, bandWidth) * Math.max(1, cb.height));
                    boolean isHollowBox = (bandWidth > 20 && cb.upperWickPx < 3 && cb.lowerWickPx < 3 && cb.bodyHeight < 5 && fillDensity < 0.25f);
                    if (isCandleShape && !isHollowBox) {
                        bands.add(cb);
                    }
                }
            }

            // =========================================================================
            // STRICT ANTI-NON-CHART FILTER:
            // Must have genuine broker background canvas AND at least 4 distinct candlestick bars,
            // with authentic wicks, and confirmation of broker price scale or trading controls.
            // When user taps scan on Home Screen, WhatsApp, YouTube, Settings, or Chrome, REJECT!
            // =========================================================================
            boolean hasBrokerControls = (bottomGreen >= 40 && bottomRed >= 40);
            boolean hasPriceScale = rightAxisDigits >= 25;
            int wickCount = 0;
            for (CandleBand b : bands) {
                if (b.upperWickPx >= 3 || b.lowerWickPx >= 3) {
                    wickCount++;
                }
            }

            boolean isAuthenticChart = (hasBrokerControls || (hasPriceScale && wickCount >= 1))
                    && (bgNavyDark + bgWhiteLight) >= (int)(totalBgSampled * 0.12f)
                    && bands.size() >= 3;

            if (!isAuthenticChart) {
                updateOverlayUI(
                        "WAIT",
                        0,
                        "📱 চার্ট সনাক্ত হয়নি",
                        "ব্রোকার চার্ট (Quotex/Pocket Option) স্ক্রিনে রেখে স্ক্যান করুন",
                        "NO_CHART"
                );
                bitmap.recycle();
                return;
            }

            // =========================================================================
            // INSTITUTIONAL 5-STEP SIGNAL FLOW (NON-VIOLABLE CONFLUENCE ENGINE)
            // ধাপ ১: Chart Verification (চার্ট, Asset, Timeframe ও ডেটা যাচাই)
            // ধাপ ২: Candle Data Collection (OHLC, Closed Candle ও Timer যাচাই)
            // ধাপ ৩: Multi-Timeframe Analysis (১৫M + ৫M + ১M Trend Alignment)
            // ধাপ ৪: Market Condition Filter (Chop, Doji, Volatility, Spike Kill-Switches)
            // ধাপ ৫: High-Probability Institutional Setup Matching (Zero Guessing)
            // =========================================================================

            // Strip right-edge floating price pill/badge if it slipped into bands (wider or far outside regular candle pitch)
            int medianW = 8;
            int medianStep = 14;
            if (bands.size() >= 5) {
                int sampleCount = Math.min(8, bands.size() - 1);
                int sampleStart = bands.size() - 1 - sampleCount;
                int[] sampleWidths = new int[sampleCount];
                for (int i = 0; i < sampleCount; i++) {
                    CandleBand sb = bands.get(sampleStart + i);
                    sampleWidths[i] = Math.max(1, sb.endX - sb.startX + 1);
                }
                java.util.Arrays.sort(sampleWidths);
                medianW = sampleWidths[sampleWidths.length / 2];

                int gapCount = Math.max(0, sampleCount - 1);
                medianStep = Math.max(8, (int) (medianW * 1.5f));
                if (gapCount > 0) {
                    int[] sampleGaps = new int[gapCount];
                    for (int i = 0; i < gapCount; i++) {
                        sampleGaps[i] = bands.get(sampleStart + i + 1).centerX - bands.get(sampleStart + i).centerX;
                    }
                    java.util.Arrays.sort(sampleGaps);
                    medianStep = Math.max(6, sampleGaps[sampleGaps.length / 2]);
                }

                while (bands.size() >= 5) {
                    CandleBand tailBand = bands.get(bands.size() - 1);
                    CandleBand prevTailBand = bands.get(bands.size() - 2);
                    int tailWidth = tailBand.endX - tailBand.startX + 1;
                    int tailGap = tailBand.centerX - prevTailBand.centerX;
                    if (tailGap > Math.max((int) (medianStep * 1.85f), 28) || tailWidth > Math.max((int) (medianW * 1.8f), 22)) {
                        bands.remove(bands.size() - 1);
                    } else {
                        break;
                    }
                }
            }

            int candleCount = bands.size();
            String verifiedSymbol = "QUOTEX • OTC";

            int currentSec = java.util.Calendar.getInstance().get(java.util.Calendar.SECOND);
            int candleSecondsLeft = 60 - currentSec;

            // ধাপ ২: Candle Data Collection & Precise Closed Candle Identification (with infant open-tick check)
            CandleBand rightmost = bands.get(candleCount - 1);
            boolean hasInfantTickRight = false;
            if (candleCount >= 4) {
                int tStart = Math.min(endX - 1, rightmost.endX + Math.max(2, (int) (medianStep * 0.40f)));
                int tEnd = Math.min(endX - 1, rightmost.centerX + (int) (medianStep * 1.55f));
                int tickCols = 0;
                for (int tx = tStart; tx <= tEnd; tx++) {
                    if (colGreen[tx] + colRed[tx] >= 2) tickCols++;
                }
                int rWidth = rightmost.endX - rightmost.startX + 1;
                if (tickCols >= 1 && tickCols <= 4 && rWidth >= Math.max(2, (int) (medianW * 0.65f))) {
                    hasInfantTickRight = true;
                }
            }

            int closedIndex = hasInfantTickRight ? (candleCount - 1) : Math.max(0, candleCount - 2);
            CandleBand runningCandle = hasInfantTickRight ? null : rightmost;
            CandleBand closedSignalCandle = bands.get(closedIndex);
            CandleBand prevCandle = (closedIndex >= 1) ? bands.get(closedIndex - 1) : null;

            // For compatibility with JSObject flow reporting
            CandleBand lastClosedCandle = closedSignalCandle;

            // ধাপ ৩: 4-Layer Mathematical Backward OHLC Multi-Timeframe Analysis (15M, 5M, 3M, 1M)
            int closedPoolSize = closedIndex + 1;
            int macroPeriod = (closedPoolSize >= 15) ? 15 : (closedPoolSize >= 10 ? closedPoolSize : 999);
            String macroTrend15M = (macroPeriod <= closedPoolSize) ? classifyAggregatedOhlc(bands, closedPoolSize, macroPeriod, 22) : "SIDEWAYS";
            String secTrend5M = classifyAggregatedOhlc(bands, closedPoolSize, 5, 22);
            String momentum3M = classifyAggregatedOhlc(bands, closedPoolSize, 3, 20);
            String microTrend1M = closedSignalCandle.isDoji ? "SIDEWAYS" : (closedSignalCandle.isGreen ? "UPTREND" : "DOWNTREND");

            int microStart = Math.max(0, closedPoolSize - 4);
            int microGreenVol = 0, microRedVol = 0;
            for (int i = microStart; i < closedPoolSize; i++) {
                microGreenVol += bands.get(i).greenCount;
                microRedVol += bands.get(i).redCount;
            }
            int microTotalVol = microGreenVol + microRedVol;
            int microGreenPct = (int) (100f * microGreenVol / Math.max(1, microTotalVol));
            int microRedPct = 100 - microGreenPct;

            String ohlcSummaryBn = "১৫M " + ("UPTREND".equals(macroTrend15M) ? "আপ" : ("DOWNTREND".equals(macroTrend15M) ? "ডাউন" : "রেঞ্জ"))
                    + " • ৫M " + ("UPTREND".equals(secTrend5M) ? "আপ" : ("DOWNTREND".equals(secTrend5M) ? "ডাউন" : "রেঞ্জ"))
                    + " • ৩M " + ("UPTREND".equals(momentum3M) ? "আপ" : ("DOWNTREND".equals(momentum3M) ? "ডাউন" : "রেঞ্জ"));

            // ধাপ ৪: Market Condition Filter (Chop, Doji, Spinning Top, Volatility, Exhaustion & S/R Wall Guard)
            int totalClosedSpan = Math.max(1, closedSignalCandle.bodyHeight + closedSignalCandle.upperWickPx + closedSignalCandle.lowerWickPx);
            int bodyPct = Math.round(100f * closedSignalCandle.bodyHeight / totalClosedSpan);
            int upWickPct = Math.round(100f * closedSignalCandle.upperWickPx / totalClosedSpan);
            int downWickPct = Math.round(100f * closedSignalCandle.lowerWickPx / totalClosedSpan);

            boolean isSpinningTop = (upWickPct >= 30 && downWickPct >= 30 && bodyPct <= 26);
            boolean isDojiIndecision = (closedSignalCandle.isDoji || bodyPct <= 18 || isSpinningTop);

            boolean isAlternatingChop = false;
            if (closedPoolSize >= 5) {
                boolean c1 = bands.get(closedIndex).isGreen;
                boolean c2 = bands.get(closedIndex - 1).isGreen;
                boolean c3 = bands.get(closedIndex - 2).isGreen;
                boolean c4 = bands.get(closedIndex - 3).isGreen;
                boolean c5 = bands.get(closedIndex - 4).isGreen;
                boolean has5m3mTrend = !"SIDEWAYS".equals(secTrend5M) && secTrend5M.equals(momentum3M);
                if ((c1 != c2) && (c2 != c3) && (c3 != c4) && (c4 != c5) && !has5m3mTrend) {
                    isAlternatingChop = true;
                }
            }

            // Same-color streak & prior-swing S/R wall check (strictly excludes last 2 candles!)
            int sameColorStreak = 1;
            for (int i = closedIndex - 1; i >= 0; i--) {
                if (bands.get(i).isGreen == closedSignalCandle.isGreen) sameColorStreak++;
                else break;
            }
            int srStart = Math.max(0, closedPoolSize - 16);
            int srEnd = Math.max(0, closedPoolSize - 2);
            boolean nearTop = false;
            boolean nearBottom = false;
            if (srEnd - srStart >= 4) {
                int srMinY = 9999, srMaxY = 0;
                for (int i = srStart; i < srEnd; i++) {
                    CandleBand b = bands.get(i);
                    if (b.minY < srMinY) srMinY = b.minY;
                    if (b.maxY > srMaxY) srMaxY = b.maxY;
                }
                int srSpan = Math.max(20, srMaxY - srMinY);
                nearTop = closedSignalCandle.minY <= srMinY + (int)(srSpan * 0.14f) && closedSignalCandle.minY >= srMinY - (int)(srSpan * 0.06f);
                nearBottom = closedSignalCandle.maxY >= srMaxY - (int)(srSpan * 0.14f) && closedSignalCandle.maxY <= srMaxY + (int)(srSpan * 0.06f);
            }

            int prevBodiesSum = 0;
            int prevBodiesCount = 0;
            int avgStart = Math.max(0, closedPoolSize - 5);
            for (int i = avgStart; i < closedIndex; i++) {
                prevBodiesSum += bands.get(i).bodyHeight;
                prevBodiesCount++;
            }
            int avgPrevBody = prevBodiesCount > 0 ? (prevBodiesSum / prevBodiesCount) : 15;
            boolean isExhaustionSpike = (closedSignalCandle.bodyHeight >= Math.max(32, avgPrevBody * 3.2f));

            boolean isTrueHammer = !isSpinningTop && downWickPct >= 38 && upWickPct <= 22 && downWickPct >= (int)(upWickPct * 1.7f) && closedSignalCandle.lowerWickPx >= 8;
            boolean isTrueShootingStar = !isSpinningTop && upWickPct >= 38 && downWickPct <= 22 && upWickPct >= (int)(downWickPct * 1.7f) && closedSignalCandle.upperWickPx >= 8;

            // ধাপ ৫: Conservative Offline CV Setup Matching (Zero Chasing / Strict Anti-Loss Filter)
            String proposedDirection = "WAIT";
            int confidence = 0;
            String verdictTitle = "⏸ ফিল্টার্ড [অফলাইন CV] (WAIT)";
            String finalReason = "";

            if (isSpinningTop) {
                finalReason = "[অফলাইন CV · ফিল্টার] স্পিনিং টপ (দ্বিমুখী উইক) — সিদ্ধান্তহীন মার্কেট, এন্ট্রি বন্ধ (WAIT)";
            } else if (isDojiIndecision) {
                finalReason = "[অফলাইন CV · ফিল্টার] ডোজি ক্যান্ডেল (সিদ্ধান্তহীনতা) — কোনো অনুমান নয় (WAIT)";
            } else if (isAlternatingChop) {
                finalReason = "[অফলাইন CV · ফিল্টার] সাইডওয়েজ চপি রেঞ্জ — ফেকআউট ঝুঁকি (WAIT)";
            } else if (isExhaustionSpike) {
                finalReason = "[অফলাইন CV · ফিল্টার] এক্সহশন ক্লাইম্যাক্স স্পাইক — রিভার্সাল ঝুঁকি (WAIT)";
            } else {
                boolean callPermitted = !"DOWNTREND".equals(macroTrend15M) && ("UPTREND".equals(secTrend5M) || isTrueHammer);
                boolean putPermitted = !"UPTREND".equals(macroTrend15M) && ("DOWNTREND".equals(secTrend5M) || isTrueShootingStar);

                // Setup 1: True Single-Sided S/R Wick Rejection (Hammer / Shooting Star)
                if (callPermitted && isTrueHammer) {
                    proposedDirection = "UP";
                    confidence = 87;
                    verdictTitle = "▲ CALL (সবুজ) [অফলাইন CV]";
                    finalReason = "[অফলাইন CV] সাপোর্ট হ্যামার উইক রিজেকশন (নিচের বাউন্স নিশ্চিত)";
                } else if (putPermitted && isTrueShootingStar) {
                    proposedDirection = "DOWN";
                    confidence = 87;
                    verdictTitle = "▼ PUT (লাল) [অফলাইন CV]";
                    finalReason = "[অফলাইন CV] রেজিস্ট্যান্স শুটিং স্টার রিজেকশন (সেলার প্রেসার)";
                }
                // Setup 2: Aligned Trend Engulfing (Never at prior resistance/support wall)
                else if ("UPTREND".equals(macroTrend15M) && !nearTop && closedSignalCandle.isGreen && prevCandle != null && !prevCandle.isGreen
                    && closedSignalCandle.bodyHeight >= (int)(prevCandle.bodyHeight * 1.25f) && bodyPct >= 35) {
                    proposedDirection = "UP";
                    confidence = 85;
                    verdictTitle = "▲ CALL (সবুজ) [অফলাইন CV]";
                    finalReason = "[অফলাইন CV] আপট্রেন্ড বুলিশ এনগালফিং নিশ্চিত";
                } else if ("DOWNTREND".equals(macroTrend15M) && !nearBottom && !closedSignalCandle.isGreen && prevCandle != null && prevCandle.isGreen
                    && closedSignalCandle.bodyHeight >= (int)(prevCandle.bodyHeight * 1.25f) && bodyPct >= 35) {
                    proposedDirection = "DOWN";
                    confidence = 85;
                    verdictTitle = "▼ PUT (লাল) [অফলাইন CV]";
                    finalReason = "[অফলাইন CV] ডাউনট্রেন্ড বিয়ারিশ এনগালফিং নিশ্চিত";
                }
                // Setup 3: Healthy Pullback/Momentum Continuation (allows streak 2-3, blocks 4+ exhaustion or hitting prior S/R wall!)
                else if (("UPTREND".equals(macroTrend15M) || ("SIDEWAYS".equals(macroTrend15M) && "UPTREND".equals(momentum3M)))
                    && "UPTREND".equals(secTrend5M) && microGreenPct >= 58
                    && sameColorStreak <= 3 && !nearTop && bodyPct >= 35
                    && closedSignalCandle.isGreen && prevCandle != null && prevCandle.isGreen) {
                    proposedDirection = "UP";
                    confidence = "UPTREND".equals(macroTrend15M) ? 84 : 82;
                    verdictTitle = "▲ CALL (সবুজ) [অফলাইন CV]";
                    finalReason = "[অফলাইন CV] হেলদি বুলিশ ট্রেন্ড কনটিনিউয়েশন (এক্সহশন-মুক্ত)";
                } else if (("DOWNTREND".equals(macroTrend15M) || ("SIDEWAYS".equals(macroTrend15M) && "DOWNTREND".equals(momentum3M)))
                    && "DOWNTREND".equals(secTrend5M) && microRedPct >= 58
                    && sameColorStreak <= 3 && !nearBottom && bodyPct >= 35
                    && !closedSignalCandle.isGreen && prevCandle != null && !prevCandle.isGreen) {
                    proposedDirection = "DOWN";
                    confidence = "DOWNTREND".equals(macroTrend15M) ? 84 : 82;
                    verdictTitle = "▼ PUT (লাল) [অফলাইন CV]";
                    finalReason = "[অফলাইন CV] হেলদি বিয়ারিশ ট্রেন্ড কনটিনিউয়েশন (এক্সহশন-মুক্ত)";
                } else if (sameColorStreak >= 4 || (sameColorStreak >= 3 && (nearTop || nearBottom))) {
                    proposedDirection = "WAIT";
                    confidence = 0;
                    verdictTitle = "⏸ এক্সহশন/S-R গার্ড (WAIT)";
                    finalReason = "[অফলাইন CV] টানা " + sameColorStreak + "x ক্যান্ডেল বা পূর্বের S/R দেয়ালের কাছে ঝুঁকি — WAIT";
                } else {
                    proposedDirection = "WAIT";
                    confidence = 0;
                    verdictTitle = "⏸ ফিল্টার্ড [অফলাইন CV] (WAIT)";
                    finalReason = "[অফলাইন CV] শক্তিশালী ৫-ধাপ কনফার্মেশন নেই — নিরাপদ WAIT";
                }
            }

            String direction = proposedDirection;

            boolean has5m3mMomentum = !"SIDEWAYS".equals(secTrend5M) && secTrend5M.equals(momentum3M)
                    && (secTrend5M.equals(macroTrend15M) || "SIDEWAYS".equals(macroTrend15M));
            boolean step1Passed = isAuthenticChart;
            boolean step2Passed = (lastClosedCandle != null && !isDojiIndecision);
            boolean step3Passed = (!"SIDEWAYS".equals(macroTrend15M) && macroTrend15M.equals(secTrend5M))
                    || has5m3mMomentum
                    || isTrueHammer
                    || isTrueShootingStar;
            boolean step4Passed = !isDojiIndecision && !isAlternatingChop && !isSpinningTop && !isExhaustionSpike
                    && (sameColorStreak < 4 || isTrueHammer || isTrueShootingStar);
            boolean step5Passed = !"WAIT".equals(direction) && step2Passed && step3Passed && step4Passed;
            int confirmedPoints = (step1Passed ? 1 : 0) + (step2Passed ? 1 : 0) + (step3Passed ? 1 : 0) + (step4Passed ? 1 : 0) + (step5Passed ? 1 : 0);

            String closedTypeStr = (lastClosedCandle != null && lastClosedCandle.isDoji)
                    ? "DOJI"
                    : (lastClosedCandle != null && lastClosedCandle.isGreen ? "BULLISH" : "BEARISH");
            String closedColorStr = (lastClosedCandle != null && lastClosedCandle.isDoji)
                    ? "DOJI"
                    : (lastClosedCandle != null && lastClosedCandle.isGreen ? "GREEN" : "RED");
            String closedShortBn = "GREEN".equals(closedColorStr)
                    ? "সবুজ (বুলিশ)"
                    : ("RED".equals(closedColorStr) ? "লাল (বিয়ারিশ)" : "ডোজি");

            this.lastConfirmedPoints = confirmedPoints;
            this.lastStepResults = new boolean[]{step1Passed, step2Passed, step3Passed, step4Passed, step5Passed};
            this.lastClosedCandleColor = closedColorStr;
            this.lastClosedCandleLabel = "ক্লোজ: " + ("GREEN".equals(closedColorStr) ? "সবুজ" : ("RED".equals(closedColorStr) ? "লাল" : "ডোজি"));

            JSObject flowObj = new JSObject();
            flowObj.put("confirmedPoints", confirmedPoints);
            flowObj.put("totalPoints", 5);

            try {
                JSONArray stepChecksArr = new JSONArray();
                String[] keys = new String[]{"CHART", "CLOSED_CANDLE", "MTF_TREND", "MARKET_FILTER", "SETUP_SCORE"};
                String[] labels = new String[]{"১. চার্ট", "২. ক্লোজ ক্যান্ডেল", "৩. মাল্টি-TF", "৪. ফিল্টার", "৫. স্কোর"};
                boolean[] passedArr = new boolean[]{step1Passed, step2Passed, step3Passed, step4Passed, step5Passed};
                for (int i = 0; i < 5; i++) {
                    JSONObject sc = new JSONObject();
                    sc.put("step", i + 1);
                    sc.put("key", keys[i]);
                    sc.put("labelBn", labels[i]);
                    sc.put("passed", passedArr[i]);
                    stepChecksArr.put(sc);
                }
                flowObj.put("stepChecks", stepChecksArr);
            } catch (Exception ignored) {}

            JSObject cVer = new JSObject();
            cVer.put("isChartValid", step1Passed);
            cVer.put("detectedAsset", verifiedSymbol);
            cVer.put("detectedTimeframe", "1M");
            cVer.put("candleBarsCount", candleCount);
            cVer.put("notes", "১/৫ চার্ট ও ডেটা যাচাই সম্পন্ন");
            flowObj.put("chartVerification", cVer);

            JSObject cData = new JSObject();
            cData.put("candleCount", candleCount);
            JSObject cClosed = new JSObject();
            cClosed.put("type", closedTypeStr);
            cClosed.put("bodySizePx", lastClosedCandle != null ? (lastClosedCandle.bodyHeight > 0 ? lastClosedCandle.bodyHeight : lastClosedCandle.height) : 0);
            cClosed.put("upperWickPx", lastClosedCandle != null ? lastClosedCandle.upperWickPx : 0);
            cClosed.put("lowerWickPx", lastClosedCandle != null ? lastClosedCandle.lowerWickPx : 0);
            cClosed.put("isRejection", lastClosedCandle != null && (lastClosedCandle.isHammer || lastClosedCandle.isShootingStar));
            cClosed.put("labelBn", closedShortBn);
            cClosed.put("isHammer", lastClosedCandle != null && lastClosedCandle.isHammer);
            cClosed.put("isShootingStar", lastClosedCandle != null && lastClosedCandle.isShootingStar);
            cClosed.put("isDoji", lastClosedCandle != null && lastClosedCandle.isDoji);
            cData.put("closedCandle", cClosed);
            JSObject cRunning = new JSObject();
            cRunning.put("isForming", true);
            cRunning.put("intraBarBias", runningCandle != null ? (runningCandle.isGreen ? "BUYING" : "SELLING") : "NEUTRAL");
            cData.put("runningCandle", cRunning);
            cData.put("candleTimerSecondsLeft", candleSecondsLeft);
            flowObj.put("candleData", cData);

            JSObject cMtf = new JSObject();
            cMtf.put("macroTrend15m", macroTrend15M);
            cMtf.put("secondaryTrend5m", secTrend5M);
            cMtf.put("momentum3m", momentum3M);
            cMtf.put("microTrend1m", microTrend1M);
            cMtf.put("confluenceStatus", step3Passed ? "ALIGNED" : "CONFLICT");
            cMtf.put("ohlcAggregationSummaryBn", ohlcSummaryBn);
            flowObj.put("multiTimeframe", cMtf);

            JSObject cFilter = new JSObject();
            cFilter.put("regime", isAlternatingChop ? "SIDEWAYS" : (isSpinningTop || isExhaustionSpike ? "HIGH_VOLATILITY_SPIKE" : "TRENDING"));
            cFilter.put("passed", step4Passed);
            cFilter.put("blockReason", step4Passed ? "" : finalReason);
            flowObj.put("marketFilter", cFilter);

            JSObject cScore = new JSObject();
            cScore.put("priceActionScore", step2Passed ? 4.5 : 2.0);
            cScore.put("indicatorMomentumScore", microGreenPct >= 60 || microRedPct >= 60 ? 2.8 : 1.5);
            cScore.put("trendAlignmentScore", step3Passed ? 1.8 : 0.6);
            cScore.put("totalScore", confidence > 0 ? (confidence / 10.0f) : ((confirmedPoints / 5.0f) * 8.0f));
            cScore.put("thresholdRequired", 8.0);
            cScore.put("finalVerdict", "UP".equals(direction) ? "CALL" : ("DOWN".equals(direction) ? "PUT" : "WAIT"));
            flowObj.put("signalScoring", cScore);

            this.lastResolvedTradingProfile = "BINARY_OTC";
            this.lastResolvedProfileLabelBn = "AUTO".equalsIgnoreCase(activeTradingProfile) ? "Binary OTC (অটো CV)" : "";
            updateOverlayUI(direction, confidence, verdictTitle, finalReason, verifiedSymbol, flowObj);
            bitmap.recycle();

        } catch (Exception ex) {
            Log.e("TradePulseNativeScreen", "Local analysis exception: " + ex.getMessage());
            showAnalysisErrorOnOverlay("বিশ্লেষণ ব্যর্থ হয়েছে — আবার চাপুন");
        }
    }

    private void updateOverlayUI(final String direction, final int confidence, final String verdictTitle, final String finalReason, final String finalSymbol) {
        updateOverlayUI(direction, confidence, verdictTitle, finalReason, finalSymbol, null);
    }

    private void updateOverlayUI(final String direction, final int confidence, final String verdictTitle, final String finalReason, final String finalSymbol, final JSObject flowObj) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    applySignalToOverlay(direction, confidence, verdictTitle, finalReason, finalSymbol);
                }
            });
        }

        if (isTtsInitialized && textToSpeech != null) {
            String ttsMsg = null;
            if ("UP".equalsIgnoreCase(direction)) {
                ttsMsg = "কল আপ সিগন্যাল। পয়েন্ট " + lastConfirmedPoints + "। কনফিডেন্স " + confidence + " পারসেন্ট।";
            } else if ("DOWN".equalsIgnoreCase(direction)) {
                ttsMsg = "পুট ডাউন সিগন্যাল। পয়েন্ট " + lastConfirmedPoints + "। কনফিডেন্স " + confidence + " পারসেন্ট।";
            } else {
                ttsMsg = "মার্কেট রেঞ্জিং। পয়েন্ট ৫ এর মধ্যে " + lastConfirmedPoints + "। অপেক্ষা করুন।";
            }
            if (ttsMsg != null) {
                final String msg = ttsMsg;
                if (getActivity() != null) {
                    getActivity().runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            if (textToSpeech != null) {
                                textToSpeech.speak(msg, TextToSpeech.QUEUE_FLUSH, null, "TradePulseTTS_" + System.currentTimeMillis());
                            }
                        }
                    });
                }
            }
        }

        JSObject nativeResult = new JSObject();
        nativeResult.put("direction", direction);
        nativeResult.put("confidence", confidence);
        nativeResult.put("verdictTitle", verdictTitle);
        nativeResult.put("reasonText", finalReason);
        nativeResult.put("symbol", finalSymbol);
        nativeResult.put("confirmedPoints", lastConfirmedPoints);
        nativeResult.put("closedCandleColor", lastClosedCandleColor);
        nativeResult.put("closedCandleLabel", lastClosedCandleLabel);
        String emittedProfile = "AUTO".equalsIgnoreCase(activeTradingProfile)
                ? (lastResolvedTradingProfile != null && !lastResolvedTradingProfile.isEmpty() ? lastResolvedTradingProfile : "BINARY_OTC")
                : activeTradingProfile;
        nativeResult.put("tradingProfile", emittedProfile);
        if (lastResolvedProfileLabelBn != null && !lastResolvedProfileLabelBn.isEmpty()) {
            nativeResult.put("profileLabelBn", lastResolvedProfileLabelBn);
        } else if ("AUTO".equalsIgnoreCase(activeTradingProfile)) {
            nativeResult.put("profileLabelBn", "Binary OTC (অটো CV)");
        }
        if (flowObj != null) {
            nativeResult.put("signalFlow", flowObj);
        }
        notifyListeners("onNativeAnalysisComplete", nativeResult);
    }

    private void updateOverlayAuditWidgets(int confirmedPoints, boolean[] stepResults, String closedLabel, String closedColor) {
        if (overlayView == null) return;
        TextView pointsView = (TextView) overlayView.findViewWithTag("pointsText");
        if (pointsView != null) {
            if (confirmedPoints <= 0 && ("UNCERTAIN".equalsIgnoreCase(closedColor) || closedLabel == null || closedLabel.endsWith("--"))) {
                pointsView.setVisibility(View.GONE);
            } else {
                pointsView.setVisibility(View.VISIBLE);
                String cText = (closedLabel != null && !closedLabel.isEmpty()) ? closedLabel : "ক্লোজ: --";
                pointsView.setText("পয়েন্ট: " + confirmedPoints + "/৫  ·  " + cText);
                int ptsColor = confirmedPoints >= 4 ? 0xFF34D399 : (confirmedPoints == 3 ? 0xFFFBBF24 : 0xFFFB7185);
                pointsView.setTextColor(ptsColor);
            }
        }

        android.view.ViewGroup stepsRow = (android.view.ViewGroup) overlayView.findViewWithTag("stepsRow");
        if (stepsRow != null) {
            if (confirmedPoints <= 0 && (stepResults == null || !stepResults[0])) {
                stepsRow.setVisibility(View.GONE);
            } else {
                stepsRow.setVisibility(View.VISIBLE);
                for (int i = 0; i < 5; i++) {
                    TextView pill = (TextView) overlayView.findViewWithTag("stepPill_" + (i + 1));
                    if (pill != null) {
                        boolean ok = stepResults != null && i < stepResults.length && stepResults[i];
                        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
                        bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
                        bg.setCornerRadius(12f);
                        bg.setColor(ok ? 0x3310B981 : 0x22EF4444);
                        bg.setStroke(2, ok ? 0xFF10B981 : 0x88EF4444);
                        pill.setBackground(bg);
                        pill.setTextColor(ok ? 0xFF34D399 : 0xFFFDA4AF);
                    }
                }
            }
        }
    }

    private void applySignalToOverlay(String direction, int confidence, String verdictTitle, String reason, String symbol) {
        isOneClickScanPending = false;
        cancelPendingScanProgress();
        if (overlayView == null) return;
        TextView dirView = (TextView) overlayView.findViewWithTag("directionText");
        TextView detView = (TextView) overlayView.findViewWithTag("detailsText");
        TextView toggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");

        boolean hasSignal = "UP".equalsIgnoreCase(direction) || "DOWN".equalsIgnoreCase(direction);
        int strokeColor = 0xFFF59E0B; // Amber
        String badgeText = "⏸ WAIT";

        if ("UP".equalsIgnoreCase(direction)) {
            strokeColor = 0xFF10B981; // Emerald Green
            badgeText = "▲ CALL (সবুজ)";
        } else if ("DOWN".equalsIgnoreCase(direction)) {
            strokeColor = 0xFFEF4444; // Rose Red
            badgeText = "▼ PUT (লাল)";
        }

        // 1. Update rounded border of overlay bubble
        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        shape.setCornerRadius(42f);
        shape.setColor(0xF50F172A);
        shape.setStroke(3, strokeColor);
        overlayView.setBackground(shape);

        // 2. Update Direction & Confidence
        if (dirView != null) {
            dirView.setTextColor(strokeColor);
            if (hasSignal) {
                int sec = java.util.Calendar.getInstance().get(java.util.Calendar.SECOND);
                int initSecs = 60 - sec;
                if (initSecs < 4) initSecs += 60;
                String initTimeStr = String.format(Locale.US, "%02d:%02d", initSecs / 60, initSecs % 60);
                dirView.setText(badgeText + "  " + confidence + "%  ⏱ " + initTimeStr);
            } else {
                dirView.setText(verdictTitle != null && !verdictTitle.isEmpty() ? verdictTitle : "⏸ WAIT (" + lastConfirmedPoints + "/৫)");
            }
        }

        // 3. Update Details Text & Audit Row + 5 Step Pills
        if (detView != null) {
            String shortReason = (reason != null && !reason.isEmpty()) ? reason : "মোমেন্টাম নিশ্চিত";
            if (shortReason.length() > 62) shortReason = shortReason.substring(0, 60) + "..";
            if (hasSignal) {
                detView.setText(symbol + " · " + shortReason + " • 🔒");
            } else {
                detView.setText(shortReason);
            }
        }

        updateOverlayAuditWidgets(lastConfirmedPoints, lastStepResults, lastClosedCandleLabel, lastClosedCandleColor);

        // 4. Update Button visual to 'New Scan' button!
        if (toggleBtn != null) {
            updateScanButtonVisual(toggleBtn, false, hasSignal);
        }

        // 5. Start live countdown timer on the overlay bubble
        if (hasSignal) {
            activeSignaledDirection = direction;
            activeSignaledSymbol = symbol != null ? symbol : "CHART";
            activeSignaledConfidence = confidence;
            activeSignalId = "sig_native_" + System.currentTimeMillis();
            isTradeActiveAndLocked = true;
            startOverlayCountdown(direction, badgeText, confidence, symbol != null ? symbol : "CHART", reason != null ? reason : "মোমেন্টাম নিশ্চিত");
        } else {
            isTradeActiveAndLocked = false;
            activeSignaledDirection = null;
            stopOverlayCountdown();
        }
    }

    private void showAnalysisErrorOnOverlay(final String errorMsg) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    isOneClickScanPending = false;
                    cancelPendingScanProgress();
                    if (overlayView == null) return;
                    TextView dirView = (TextView) overlayView.findViewWithTag("directionText");
                    TextView detView = (TextView) overlayView.findViewWithTag("detailsText");
                    TextView toggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");

                    if (dirView != null) {
                        dirView.setTextColor(0xFFEF4444);
                        dirView.setText("⚠️ " + errorMsg);
                    }
                    if (detView != null) {
                        detView.setText("পুনরায় স্ক্যান করতে বাটনে চাপুন");
                    }
                    if (toggleBtn != null) {
                        updateScanButtonVisual(toggleBtn, false, false);
                    }
                }
            });
        }
    }

    private void startOverlayCountdown(final String direction, final String badgeText, final int confidence, final String symbol, final String reason) {
        if (captureHandler != null && overlayCountdownRunnable != null) {
            captureHandler.removeCallbacks(overlayCountdownRunnable);
            overlayCountdownRunnable = null;
        }
        isTradeActiveAndLocked = true;
        activeSignaledDirection = direction;
        activeSignaledSymbol = symbol != null ? symbol : "CHART";
        activeSignaledConfidence = confidence;
        
        // Two-Phase Trading Clock:
        // Phase 1 (Preparation): If scanned mid-candle (e.g. at 45s), count down remaining 15s to candle close so user prepares entry!
        // Phase 2 (Active Trade): When candle closes (:00), count down the FULL 1-MINUTE (60s) TRADE duration until trade expires!
        java.util.Calendar cal = java.util.Calendar.getInstance();
        int sec = cal.get(java.util.Calendar.SECOND);
        int remainingInCurrentCandle = 60 - sec;

        if (sec <= 8) {
            // Candle just opened within last 8 seconds: start active 1-minute trade immediately!
            isPreparationPhase = false;
            overlaySecondsRemaining = remainingInCurrentCandle;
        } else {
            // Mid-candle: Phase 1 is waiting for the new candle to open!
            isPreparationPhase = true;
            overlaySecondsRemaining = remainingInCurrentCandle;
        }

        // Trade signal is now locked! Halt recurring scanning loops so the signal never mutates, repeats, or flickers
        isScanningActive = false;
        stopNativeScanningLoop();

        if (overlayView != null) {
            TextView toggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");
            if (toggleBtn != null) {
                int mins = overlaySecondsRemaining / 60;
                int secs = overlaySecondsRemaining % 60;
                String timeStr = String.format(Locale.US, "%02d:%02d", mins, secs);
                toggleBtn.setText("⚡ রি-স্ক্যান (" + timeStr + ")");
            }
        }

        overlayCountdownRunnable = new Runnable() {
            @Override
            public void run() {
                if (overlayView == null) return;
                overlaySecondsRemaining--;
                TextView dirView = (TextView) overlayView.findViewWithTag("directionText");
                TextView detView = (TextView) overlayView.findViewWithTag("detailsText");
                TextView toggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");

                if (overlaySecondsRemaining > 0) {
                    int mins = overlaySecondsRemaining / 60;
                    int secs = overlaySecondsRemaining % 60;
                    String timeStr = String.format(Locale.US, "%02d:%02d", mins, secs);

                    if (toggleBtn != null) {
                        toggleBtn.setText("⚡ রি-স্ক্যান (" + timeStr + ")");
                    }

                    if (isPreparationPhase) {
                        if (dirView != null) {
                            dirView.setText(badgeText + "  " + confidence + "%  ⏳ এন্ট্রি: " + timeStr);
                        }
                        if (detView != null) {
                            detView.setText("রানিং ক্যান্ডেল শেষ হলে " + timeStr + " পর নতুন ক্যান্ডেলে ট্রেড নিন");
                        }
                        // Audio warning 2 seconds before new candle
                        if (overlaySecondsRemaining == 2 && isTtsInitialized && textToSpeech != null) {
                            textToSpeech.speak("প্রস্তুত হোন, এখনই ট্রেড নিন", TextToSpeech.QUEUE_FLUSH, null, "TP_READY_" + System.currentTimeMillis());
                        }
                    } else {
                        if (dirView != null) {
                            dirView.setText(badgeText + "  " + confidence + "%  ⏱ ট্রেড: " + timeStr);
                        }
                        if (detView != null) {
                            detView.setText(symbol + " • ১-মিনিট ট্রেড চলমান • এক্সপায়ারি অপেক্ষা");
                        }
                    }

                    if (captureHandler != null) {
                        captureHandler.postDelayed(this, 1000);
                    }
                } else {
                    // Counter reached zero:
                    if (isPreparationPhase) {
                        // TRANSITION FROM PREPARATION TO ACTIVE 1-MINUTE TRADE!
                        isPreparationPhase = false;
                        overlaySecondsRemaining = 60; // Start full 60s trade countdown!

                        if (dirView != null) {
                            dirView.setText(badgeText + "  " + confidence + "%  🚀 এখনই ট্রেড নিন!");
                        }
                        if (detView != null) {
                            detView.setText("১-মিনিট ট্রেড ওপেন করুন • এক্সপায়ারি ৬০ সেকেন্ড");
                        }
                        if (toggleBtn != null) {
                            toggleBtn.setText("⚡ রি-স্ক্যান (01:00)");
                        }
                        if (isTtsInitialized && textToSpeech != null) {
                            textToSpeech.speak("এখনই ট্রেড ওপেন করুন", TextToSpeech.QUEUE_FLUSH, null, "TP_GO_" + System.currentTimeMillis());
                        }

                        if (captureHandler != null) {
                            captureHandler.postDelayed(this, 1000);
                        }
                    } else {
                        // Active 1-minute trade is officially complete!
                        // 1. Force fresh screen capture from VirtualDisplay
                        isScanRequested = true;
                        if (toggleBtn != null) {
                            updateScanButtonVisual(toggleBtn, false, false);
                        }
                        if (captureHandler != null) {
                            captureHandler.postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    verifyFinishedTradeOutcome(direction, badgeText, confidence, symbol);
                                }
                            }, 2500);
                        } else {
                            verifyFinishedTradeOutcome(direction, badgeText, confidence, symbol);
                        }
                    }
                }
            }
        };
        if (captureHandler != null) {
            captureHandler.postDelayed(overlayCountdownRunnable, 1000);
        }
    }

    private void verifyFinishedTradeOutcome(final String targetDirection, final String badgeText, final int confidence, final String symbol) {
        final String signalId = activeSignalId != null ? activeSignalId : "sig_native_" + System.currentTimeMillis();

        isTradeActiveAndLocked = false;
        activeSignaledDirection = null;
        stopNativeScanningLoop();
        isScanningActive = false;

        boolean isCandleGreen = false;
        boolean hasVerifiedFrame = false;
        String candleColorName = "অনির্ধারিত";

        Bitmap bitmap = null;
        try {
            // Priority 1: Acquire freshest live image directly from imageReader
            if (imageReader != null) {
                Image liveImg = null;
                try {
                    liveImg = imageReader.acquireLatestImage();
                    if (liveImg != null) {
                        Image.Plane[] planes = liveImg.getPlanes();
                        ByteBuffer buffer = planes[0].getBuffer();
                        int pixelStride = planes[0].getPixelStride();
                        int rowStride = planes[0].getRowStride();
                        int w = liveImg.getWidth();
                        int h = liveImg.getHeight();
                        int rowPadding = rowStride - pixelStride * w;
                        int safeWidth = (pixelStride > 0) ? (w + rowPadding / pixelStride) : w;
                        int requiredBytes = safeWidth * h * 4;

                        Bitmap b = Bitmap.createBitmap(safeWidth, h, Bitmap.Config.ARGB_8888);
                        if (buffer.remaining() >= requiredBytes) {
                            b.copyPixelsFromBuffer(buffer);
                        } else {
                            ByteBuffer padded = ByteBuffer.allocateDirect(requiredBytes);
                            buffer.rewind();
                            padded.put(buffer);
                            padded.rewind();
                            b.copyPixelsFromBuffer(padded);
                        }
                        bitmap = (safeWidth == w) ? b : Bitmap.createBitmap(b, 0, 0, w, h);
                        if (bitmap != b) {
                            b.recycle();
                        }
                        Log.i("TradePulseNativeScreen", "Verified trade outcome with FRESH direct camera frame!");
                    }
                } catch (Exception ex) {
                    Log.w("TradePulseNativeScreen", "Direct imageReader acquisition fallback: " + ex.getMessage());
                } finally {
                    if (liveImg != null) {
                        liveImg.close();
                    }
                }
            }

            // Priority 2: Fall back to latestFrameBase64 cache if direct buffer was empty
            if (bitmap == null && latestFrameBase64 != null) {
                String cleanB64 = latestFrameBase64;
                int commaIdx = cleanB64.indexOf(",");
                if (commaIdx != -1) {
                    cleanB64 = cleanB64.substring(commaIdx + 1);
                }
                byte[] decoded = Base64.decode(cleanB64, Base64.DEFAULT);
                bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            }

            if (bitmap != null) {
                int width = bitmap.getWidth();
                int height = bitmap.getHeight();
                int startY = (int) (height * 0.22f);
                int endY = (int) (height * 0.70f);
                int startX = (int) (width * 0.08f);
                int endX = (int) (width * 0.81f); // Excludes right price axis & live current-price label pill

                int ovLeft = -1, ovTop = -1, ovRight = -1, ovBottom = -1;
                if (overlayView != null) {
                    int[] loc = new int[2];
                    overlayView.getLocationOnScreen(loc);
                    DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
                    float sX = (float) width / (float) (dm.widthPixels > 0 ? dm.widthPixels : width);
                    float sY = (float) height / (float) (dm.heightPixels > 0 ? dm.heightPixels : height);
                    ovLeft = (int) (loc[0] * sX);
                    ovTop = (int) (loc[1] * sY);
                    ovRight = (int) ((loc[0] + overlayView.getWidth()) * sX);
                    ovBottom = (int) ((loc[1] + overlayView.getHeight()) * sY);
                }

                int[] colGreen = new int[width];
                int[] colRed = new int[width];

                for (int y = startY; y < endY; y += 2) {
                    for (int x = startX; x < endX; x++) {
                        if (ovLeft >= 0 && x >= ovLeft - 10 && x <= ovRight + 10 && y >= ovTop - 10 && y <= ovBottom + 10) {
                            continue;
                        }

                        int pixel = bitmap.getPixel(x, y);
                        int r = (pixel >> 16) & 0xff;
                        int g = (pixel >> 8) & 0xff;
                        int b = pixel & 0xff;

                        int max = Math.max(r, Math.max(g, b));
                        int min = Math.min(r, Math.min(g, b));
                        int delta = max - min;
                        if (delta < 14 || max < 50) continue;

                        float hue;
                        if (max == r) {
                            hue = (60f * ((float)(g - b) / delta) + 360f) % 360f;
                        } else if (max == g) {
                            hue = (60f * ((float)(b - r) / delta) + 120f) % 360f;
                        } else {
                            hue = (60f * ((float)(r - g) / delta) + 240f) % 360f;
                        }
                        float sat = (float) delta / (float) max;

                        boolean isGreen = (g >= 48 && g > r + 8 && g >= b - 18 && hue >= 100f && hue <= 195f && sat >= 0.12f);
                        boolean isRed = (r >= 55 && r > g + 16 && r > b + 12 && (hue >= 335f || hue <= 25f) && sat >= 0.14f);

                        if (isGreen) {
                            colGreen[x]++;
                        } else if (isRed) {
                            colRed[x]++;
                        }
                    }
                }

                // Candlestick Band Segmentation across X axis
                java.util.List<CandleBand> bands = new java.util.ArrayList<>();
                boolean inBand = false;
                int bandStart = 0;
                int bandGreen = 0;
                int bandRed = 0;
                int emptyCols = 0;

                for (int x = startX; x < endX; x++) {
                    int colTotal = colGreen[x] + colRed[x];
                    if (colTotal >= 2) {
                        if (!inBand) {
                            inBand = true;
                            bandStart = x;
                            bandGreen = 0;
                            bandRed = 0;
                        }
                        bandGreen += colGreen[x];
                        bandRed += colRed[x];
                        emptyCols = 0;
                    } else {
                        if (inBand) {
                            emptyCols++;
                            if (emptyCols >= 3 || x == endX - 1) {
                                inBand = false;
                                int bandWidth = (x - emptyCols) - bandStart + 1;
                                if (bandWidth >= 2 && bandWidth <= 150) {
                                    CandleBand cb = new CandleBand();
                                    cb.startX = bandStart;
                                    cb.endX = x - emptyCols;
                                    cb.centerX = (cb.startX + cb.endX) / 2;
                                    cb.isGreen = bandGreen >= bandRed;
                                    cb.greenCount = bandGreen;
                                    cb.redCount = bandRed;
                                    cb.height = Math.max(bandGreen, bandRed);
                                    bands.add(cb);
                                }
                                emptyCols = 0;
                            }
                        }
                    }
                }

                // Close trailing in-progress band at the right edge if present
                if (inBand) {
                    int bandWidth = (endX - emptyCols) - bandStart;
                    if (bandWidth >= 2 && bandWidth <= 150) {
                        CandleBand cb = new CandleBand();
                        cb.startX = bandStart;
                        cb.endX = endX - 1 - emptyCols;
                        cb.centerX = (cb.startX + cb.endX) / 2;
                        cb.isGreen = bandGreen >= bandRed;
                        cb.greenCount = bandGreen;
                        cb.redCount = bandRed;
                        cb.height = Math.max(bandGreen, bandRed);
                        bands.add(cb);
                    }
                }

                    if (!bands.isEmpty()) {
                        CandleBand tradeCandle;
                        if (bands.size() >= 2) {
                            CandleBand rightmost = bands.get(bands.size() - 1);
                            CandleBand penultimate = bands.get(bands.size() - 2);

                            int rightTotal = rightmost.greenCount + rightmost.redCount;
                            int penTotal = penultimate.greenCount + penultimate.redCount;
                            int rightWidth = rightmost.endX - rightmost.startX + 1;

                            // When 60s trade ends and broker spawned new candle (2.5s into new minute):
                            // The new candle is thin (width <= 14 or has < 35% of penultimate pixels).
                            // The completed trade candle is the penultimate candle!
                            boolean isRightmostBaby = (rightWidth <= 14 || rightTotal < 120 || rightTotal < (int)(penTotal * 0.35f));

                            if (isRightmostBaby) {
                                tradeCandle = penultimate;
                                Log.i("TradePulseNativeScreen", String.format(Locale.US,
                                    "Outcome: Rightmost is baby candle (total=%d, w=%d). Evaluating penultimate as trade candle: isGreen=%b (G:%d, R:%d)",
                                    rightTotal, rightWidth, penultimate.isGreen, penultimate.greenCount, penultimate.redCount));
                            } else {
                                // Rightmost is fully developed (wide and has full pixel mass).
                                // That means the broker has NOT spawned a separate new candle yet; the rightmost IS the completed trade candle!
                                tradeCandle = rightmost;
                                Log.i("TradePulseNativeScreen", String.format(Locale.US,
                                    "Outcome: Rightmost is fully developed (total=%d, w=%d). Evaluating rightmost as trade candle: isGreen=%b (G:%d, R:%d)",
                                    rightTotal, rightWidth, rightmost.isGreen, rightmost.greenCount, rightmost.redCount));
                            }
                        } else {
                            tradeCandle = bands.get(0);
                        }

                        tradeCandle.isGreen = (tradeCandle.greenCount > tradeCandle.redCount);
                        isCandleGreen = tradeCandle.isGreen;
                        candleColorName = isCandleGreen ? "সবুজ" : "লাল";
                        hasVerifiedFrame = true;
                    }

                    bitmap.recycle();
                }
        } catch (Exception ex) {
            Log.e("TradePulseNativeScreen", "Outcome verification exception: " + ex.getMessage());
        }

        final boolean isWin;
        if (hasVerifiedFrame && targetDirection != null) {
            boolean isCallDirection = "UP".equalsIgnoreCase(targetDirection) || "CALL".equalsIgnoreCase(targetDirection);
            boolean isPutDirection = "DOWN".equalsIgnoreCase(targetDirection) || "PUT".equalsIgnoreCase(targetDirection);
            if (isCallDirection) {
                isWin = isCandleGreen;
            } else if (isPutDirection) {
                isWin = !isCandleGreen;
            } else {
                isWin = false;
            }
        } else {
            isWin = false;
        }

        final String resultOutcome = isWin ? "WIN" : "LOSS";
        final int outcomeColor = isWin ? 0xFF10B981 : 0xFFEF4444;
        final String outcomeBadge = isWin ? "🎉 WIN! লাভ (+৮৫%)" : "⚠️ LOSS (ভুল/লস)";
        final String outcomeDetail = hasVerifiedFrame
                ? (isWin
                    ? "সফল সিগন্যাল! ক্লোজড ক্যান্ডেল ছিল " + candleColorName + " • ফলাফল হিস্ট্রিতে রেকর্ড হয়েছে"
                    : "বিপরীত ক্যান্ডেল ক্লোজ হয়েছে (ক্লোজড ক্যান্ডেল ছিল " + candleColorName + ") • ফলাফল হিস্ট্রিতে সংরক্ষিত")
                : "ফলাফল নিশ্চিত করা যায়নি (স্ক্রিন ফ্রেম মেলেনি)";

        if (getActivity() != null) {
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (overlayView == null) return;
                    TextView dirView = (TextView) overlayView.findViewWithTag("directionText");
                    TextView detView = (TextView) overlayView.findViewWithTag("detailsText");
                    TextView toggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");

                    android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
                    shape.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
                    shape.setCornerRadius(42f);
                    shape.setColor(0xF50F172A);
                    shape.setStroke(3, outcomeColor);
                    overlayView.setBackground(shape);

                    if (dirView != null) {
                        dirView.setTextColor(outcomeColor);
                        dirView.setText(outcomeBadge + "  ⏱ সমাপ্ত");
                    }
                    if (detView != null) {
                        detView.setText(outcomeDetail);
                    }
                    if (toggleBtn != null) {
                        updateScanButtonVisual(toggleBtn, false, false);
                    }
                }
            });
        }

        if (isTtsInitialized && textToSpeech != null) {
            String ttsMsg = isWin
                    ? "১ মিনিটের ট্রেড সমাপ্ত। ফলাফল: উইন! ক্লোজড ক্যান্ডেলটি ছিল " + candleColorName + "।"
                    : "১ মিনিটের ট্রেড সমাপ্ত। ফলাফল: লস। ক্লোজড ক্যান্ডেলটি ছিল " + candleColorName + "।";
            textToSpeech.speak(ttsMsg, TextToSpeech.QUEUE_FLUSH, null, "TP_OUTCOME_" + System.currentTimeMillis());
        }

        JSObject resolveEvent = new JSObject();
        resolveEvent.put("signalId", signalId);
        resolveEvent.put("direction", targetDirection);
        resolveEvent.put("symbol", symbol);
        resolveEvent.put("result", resultOutcome);
        resolveEvent.put("isCandleGreen", isCandleGreen);
        resolveEvent.put("candleColor", candleColorName);
        resolveEvent.put("timestamp", System.currentTimeMillis());
        notifyListeners("onTradeOutcomeResolved", resolveEvent);
    }

    private void stopOverlayCountdown() {
        if (captureHandler != null && overlayCountdownRunnable != null) {
            captureHandler.removeCallbacks(overlayCountdownRunnable);
            overlayCountdownRunnable = null;
        }
        isTradeActiveAndLocked = false;
        overlaySecondsRemaining = 0;
        activeSignaledDirection = null;
        if (overlayView != null) {
            TextView toggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");
            if (toggleBtn != null && !isOneClickScanPending) {
                updateScanButtonVisual(toggleBtn, false, false);
            }
        }
    }

    private void startNativeScanningLoop() {
        if (captureHandler == null) {
            captureHandler = new Handler(Looper.getMainLooper());
        }
        stopNativeScanningLoop();
        captureRunnable = new Runnable() {
            @Override
            public void run() {
                if (isScanningActive) {
                    captureAndEmitLatestFrame();
                    if (captureHandler != null) {
                        captureHandler.postDelayed(this, captureIntervalMs);
                    }
                }
            }
        };
        captureHandler.post(captureRunnable);
    }

    private void stopNativeScanningLoop() {
        if (captureHandler != null && captureRunnable != null) {
            captureHandler.removeCallbacks(captureRunnable);
            captureRunnable = null;
        }
    }

    @PluginMethod
    public void captureSingleFrame(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (latestFrameBase64 != null) {
                        sequenceCounter++;
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("imageBase64", latestFrameBase64);
                        res.put("timestamp", latestFrameTimestamp > 0 ? latestFrameTimestamp : System.currentTimeMillis());
                        res.put("sequenceId", sequenceCounter);
                        res.put("width", latestFrameWidth);
                        res.put("height", latestFrameHeight);

                        if (call != null) {
                            call.resolve(res);
                        }
                    } else {
                        isScanRequested = true;
                        pendingCaptureCall = call;
                        captureHandler.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                if (pendingCaptureCall != null) {
                                    if (latestFrameBase64 != null) {
                                        sequenceCounter++;
                                        JSObject res = new JSObject();
                                        res.put("success", true);
                                        res.put("imageBase64", latestFrameBase64);
                                        res.put("timestamp", latestFrameTimestamp > 0 ? latestFrameTimestamp : System.currentTimeMillis());
                                        res.put("sequenceId", sequenceCounter);
                                        res.put("width", latestFrameWidth);
                                        res.put("height", latestFrameHeight);
                                        pendingCaptureCall.resolve(res);
                                    } else {
                                        pendingCaptureCall.reject("No frame available from screen");
                                    }
                                    pendingCaptureCall = null;
                                }
                            }
                        }, 2500);
                    }
                } catch (Exception e) {
                    if (call != null) {
                        call.reject("Single frame capture failed: " + e.getMessage());
                    }
                }
            }
        });
    }

    @PluginMethod
    public void stopScreenCapture(PluginCall call) {
        stopNativeScanningLoop();
        isScanningActive = false;
        latestFrameBase64 = null;
        latestFrameTimestamp = 0;
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }

        // Stop Foreground Service
        try {
            Intent serviceIntent = new Intent(getContext(), ScreenCaptureService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception ignored) {}

        if (call != null) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void showFloatingOverlay(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
                    try {
                        Intent intent = new Intent(
                                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:" + getContext().getPackageName())
                        );
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                    } catch (Exception ignored) {}
                    call.reject("Overlay permission not granted. Opened Android Settings for 'Display over other apps'.");
                    return;
                }

                if (overlayView == null) {
                    createOverlayView();
                }
                updateOverlayContent(call);
                call.resolve(new JSObject().put("success", true));
            }
        });
    }

    @PluginMethod
    public void updateFloatingOverlay(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (overlayView != null) {
                    updateOverlayContent(call);
                    call.resolve(new JSObject().put("success", true));
                } else {
                    call.reject("Overlay view is not currently showing");
                }
            }
        });
    }

    @PluginMethod
    public void hideFloatingOverlay(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                cancelPendingScanProgress();
                stopOverlayCountdown();
                if (overlayView != null && windowManager != null) {
                    try {
                        windowManager.removeView(overlayView);
                    } catch (Exception ignored) {}
                    overlayView = null;
                }
                if (call != null) {
                    call.resolve(new JSObject().put("success", true));
                }
            }
        });
    }

    private void createOverlayView() {
        if (overlayView != null && windowManager != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {}
            overlayView = null;
        }

        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        overlayParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );

        overlayParams.gravity = Gravity.TOP | Gravity.END;
        overlayParams.x = 24;
        overlayParams.y = 120;

        // Dynamic simple programmatically constructed card view
        final android.widget.LinearLayout layout = new android.widget.LinearLayout(getContext());
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(32, 20, 32, 20);

        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        shape.setCornerRadius(38f);
        shape.setColor(0xF50F172A);
        shape.setStroke(3, 0xFF38BDF8);
        layout.setBackground(shape);
        layout.setElevation(30f);

        // Top drag handle container
        final android.widget.LinearLayout dragContainer = new android.widget.LinearLayout(getContext());
        dragContainer.setOrientation(android.widget.LinearLayout.VERTICAL);

        android.widget.LinearLayout headerRow = new android.widget.LinearLayout(getContext());
        headerRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView titleView = new TextView(getContext());
        titleView.setId(android.view.View.generateViewId());
        titleView.setTextSize(13);
        titleView.setTextColor(0xFF38BDF8);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setTag("directionText");
        titleView.setText("⚡ প্রস্তুত (Ready)");
        android.widget.LinearLayout.LayoutParams titleParams = new android.widget.LinearLayout.LayoutParams(
                0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
        );
        headerRow.addView(titleView, titleParams);

        // Subtle close button to dismiss: completely disconnects screen sharing & hides overlay
        TextView closeBtn = new TextView(getContext());
        closeBtn.setText("✕");
        closeBtn.setTextSize(13);
        closeBtn.setTextColor(0xFF94A3B8);
        closeBtn.setPadding(12, 4, 12, 4);
        closeBtn.setClickable(true);
        closeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // 1. Fully disconnect and stop screen capture, media projection & foreground service
                stopScreenCapture(null);

                // 2. Announce disconnect if TTS is enabled
                if (isTtsInitialized && textToSpeech != null) {
                    textToSpeech.speak("স্ক্রিন শেয়ার ডিসকানেক্ট করা হয়েছে", TextToSpeech.QUEUE_FLUSH, null, "TP_STOP_" + System.currentTimeMillis());
                }

                // 3. Notify JS frontend
                notifyListeners("onOverlayStopClicked", new JSObject());
                notifyListeners("onScreenCaptureStopped", new JSObject());

                // 4. Hide overlay
                hideFloatingOverlay(null);
            }
        });
        headerRow.addView(closeBtn);
        dragContainer.addView(headerRow);

        TextView detailsView = new TextView(getContext());
        detailsView.setId(android.view.View.generateViewId());
        detailsView.setTextSize(11);
        detailsView.setTextColor(0xFFCBD5E1);
        detailsView.setTag("detailsText");
        detailsView.setText("স্ক্যান করতে বাটনে চাপুন");
        dragContainer.addView(detailsView);

        TextView pointsView = new TextView(getContext());
        pointsView.setId(android.view.View.generateViewId());
        pointsView.setTextSize(10);
        pointsView.setTextColor(0xFF38BDF8);
        pointsView.setTypeface(null, android.graphics.Typeface.BOLD);
        pointsView.setTag("pointsText");
        pointsView.setPadding(0, 6, 0, 2);
        pointsView.setVisibility(View.GONE);
        dragContainer.addView(pointsView);

        android.widget.LinearLayout stepsRow = new android.widget.LinearLayout(getContext());
        stepsRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        stepsRow.setTag("stepsRow");
        stepsRow.setPadding(0, 4, 0, 2);
        stepsRow.setVisibility(View.GONE);
        String[] stepTitles = new String[]{"১.চার্ট", "২.ক্লোজ", "৩.TF", "৪.ফিল্টার", "৫.স্কোর"};
        for (int i = 0; i < 5; i++) {
            TextView pill = new TextView(getContext());
            pill.setTag("stepPill_" + (i + 1));
            pill.setText(stepTitles[i]);
            pill.setTextSize(9);
            pill.setTypeface(null, android.graphics.Typeface.BOLD);
            pill.setGravity(Gravity.CENTER);
            pill.setPadding(8, 4, 8, 4);
            android.widget.LinearLayout.LayoutParams lp = new android.widget.LinearLayout.LayoutParams(
                    0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f
            );
            if (i > 0) lp.setMargins(4, 0, 0, 0);
            stepsRow.addView(pill, lp);
        }
        dragContainer.addView(stepsRow);

        layout.addView(dragContainer);

        // Bottom Action Button Row with ONE-CLICK SCAN BUTTON (Controlled directly from Floating Bubble)
        android.widget.LinearLayout buttonRow = new android.widget.LinearLayout(getContext());
        buttonRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        buttonRow.setGravity(Gravity.CENTER);
        buttonRow.setPadding(0, 14, 0, 4);

        final TextView scanToggleBtn = new TextView(getContext());
        scanToggleBtn.setId(android.view.View.generateViewId());
        scanToggleBtn.setTag("scanToggleBtn");
        scanToggleBtn.setTextSize(13);
        scanToggleBtn.setTextColor(0xFFFFFFFF);
        scanToggleBtn.setTypeface(null, android.graphics.Typeface.BOLD);
        scanToggleBtn.setPadding(42, 14, 42, 14);
        scanToggleBtn.setClickable(true);
        updateScanButtonVisual(scanToggleBtn, false, false);

        scanToggleBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // One-Click, One-Scan triggered directly from the Floating Bubble!
                // Instantly re-scans screen on demand
                performOneClickScanNative();
            }
        });
        buttonRow.addView(scanToggleBtn);

        layout.addView(buttonRow);

        // Touch listener on dragContainer for dragging overlay across screen
        dragContainer.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = overlayParams.x;
                        initialY = overlayParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        overlayParams.x = initialX - (int) (event.getRawX() - initialTouchX);
                        overlayParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(overlayView, overlayParams);
                        return true;
                }
                return false;
            }
        });

        overlayView = layout;
        windowManager.addView(overlayView, overlayParams);
    }

    private void updateScanButtonVisual(TextView btn, boolean isBusy, boolean hasResult) {
        if (btn == null) return;
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        bg.setCornerRadius(24f);

        if (isBusy) {
            btn.setText("⏳ বিশ্লেষণ হচ্ছে...");
            bg.setColor(0xFF0369A1); // Cyan-700
            bg.setStroke(2, 0xFF38BDF8);
        } else if (hasResult) {
            btn.setText("⚡ নতুন স্ক্যান করুন");
            bg.setColor(0xFF2563EB); // Vibrant Blue
            bg.setStroke(2, 0xFF60A5FA);
        } else {
            btn.setText("⚡ ১-ক্লিক স্ক্যান");
            bg.setColor(0xFF059669); // Emerald-600
            bg.setStroke(2, 0xFF34D399);
        }
        btn.setBackground(bg);
    }

    private void performOneClickScanNative() {
        if (overlayView == null) return;
        final TextView dirView = (TextView) overlayView.findViewWithTag("directionText");
        final TextView detView = (TextView) overlayView.findViewWithTag("detailsText");
        final TextView scanToggleBtn = (TextView) overlayView.findViewWithTag("scanToggleBtn");

        cancelPendingScanProgress();
        stopOverlayCountdown();
        isTradeActiveAndLocked = false;
        overlaySecondsRemaining = 0;
        activeSignaledDirection = null;
        isScanningActive = false;
        stopNativeScanningLoop();

        // ১/৫: Chart Verification চলছে (চার্ট, Asset, Timeframe ও ডেটা যাচাই)
        if (dirView != null) {
            dirView.setTextColor(0xFF38BDF8);
            dirView.setText("১/৫: Chart Verification চলছে");
        }
        if (detView != null) {
            detView.setText("চার্ট, Asset, Timeframe ও ডেটা যাচাই...");
        }
        if (scanToggleBtn != null) {
            updateScanButtonVisual(scanToggleBtn, true, false);
        }

        // Notify JavaScript listeners in case app is foregrounded or for state sync
        JSObject data = new JSObject();
        data.put("action", "scanAndLock");
        notifyListeners("onOverlayScanToggle", data);

        // Capture a clean, unobstructed broker chart frame by hiding overlayView for ~120ms first
        final String backupFrame = latestFrameBase64;
        final long backupTs = latestFrameTimestamp;
        isScanRequested = true;
        isOneClickScanPending = true;
        overlayView.setVisibility(View.INVISIBLE);

        if (captureHandler != null) {
            // Start real analysis immediately after clean bubble-free capture (~120ms) while showing step progress
            Runnable immediateAnalyzeRunnable = new Runnable() {
                @Override
                public void run() {
                    if (overlayView != null) {
                        overlayView.setVisibility(View.VISIBLE);
                    }
                    if (!isOneClickScanPending) return;
                    isAnalyzingNativeFrame.set(false);
                    String frameToAnalyze = (latestFrameBase64 != null) ? latestFrameBase64 : backupFrame;
                    long ts = (latestFrameBase64 != null) ? latestFrameTimestamp : backupTs;
                    if (frameToAnalyze != null) {
                        executeNativeAnalysis(frameToAnalyze, ts);
                    } else {
                        isOneClickScanPending = false;
                        cancelPendingScanProgress();
                        if (dirView != null) {
                            dirView.setTextColor(0xFFF59E0B);
                            dirView.setText("⚠️ ফ্রেম প্রস্তুত হয়নি");
                        }
                        if (detView != null) {
                            detView.setText("স্ক্রিন শেয়ার পারমিশন চালু আছে কি না পরীক্ষা করুন");
                        }
                        if (scanToggleBtn != null) {
                            updateScanButtonVisual(scanToggleBtn, false, false);
                        }
                    }
                }
            };
            pendingScanProgressRunnables.add(immediateAnalyzeRunnable);
            captureHandler.postDelayed(immediateAnalyzeRunnable, 120);

            // Live step progress feedback while Gemini / CV analysis is executing
            Runnable stage2Runnable = new Runnable() {
                @Override
                public void run() {
                    if (!isOneClickScanPending || overlayView == null) return;
                    if (dirView != null) {
                        dirView.setTextColor(0xFF38BDF8);
                        dirView.setText("২/৫: Candle Data Collection চলছে");
                    }
                    if (detView != null) {
                        detView.setText("OHLC, Closed Candle ও Timer যাচাই...");
                    }
                }
            };
            pendingScanProgressRunnables.add(stage2Runnable);
            captureHandler.postDelayed(stage2Runnable, 420);

            Runnable stage3Runnable = new Runnable() {
                @Override
                public void run() {
                    if (!isOneClickScanPending || overlayView == null) return;
                    if (dirView != null) {
                        dirView.setTextColor(0xFF38BDF8);
                        dirView.setText("৩/৫: Multi-Timeframe Analysis চলছে");
                    }
                    if (detView != null) {
                        detView.setText("১৫M + ৫M + ১M Trend কাঠামো যাচাই...");
                    }
                }
            };
            pendingScanProgressRunnables.add(stage3Runnable);
            captureHandler.postDelayed(stage3Runnable, 820);

            Runnable stage4Runnable = new Runnable() {
                @Override
                public void run() {
                    if (!isOneClickScanPending || overlayView == null) return;
                    if (dirView != null) {
                        dirView.setTextColor(0xFF38BDF8);
                        dirView.setText("৪/৫: Market Condition Filter করা হচ্ছে");
                    }
                    if (detView != null) {
                        detView.setText("Trend, Sideways, Volatility ও Spike ফিল্টার...");
                    }
                }
            };
            pendingScanProgressRunnables.add(stage4Runnable);
            captureHandler.postDelayed(stage4Runnable, 1220);

            Runnable stage5Runnable = new Runnable() {
                @Override
                public void run() {
                    if (!isOneClickScanPending || overlayView == null) return;
                    if (dirView != null) {
                        dirView.setTextColor(0xFF38BDF8);
                        dirView.setText("৫/৫: Signal Scoring চলছে");
                    }
                    if (detView != null) {
                        detView.setText("Indicator ও Price Action মিলিয়ে Score...");
                    }
                }
            };
            pendingScanProgressRunnables.add(stage5Runnable);
            captureHandler.postDelayed(stage5Runnable, 1620);
        } else {
            overlayView.setVisibility(View.VISIBLE);
        }
    }

    private void updateOverlayContent(PluginCall call) {
        if (overlayView == null) return;

        // If an active trade is currently locked and counting down, ignore external idle/wait updates
        if (isTradeActiveAndLocked && overlaySecondsRemaining > 0) {
            String err = call.getString("errorReason", "");
            if (err == null || err.trim().isEmpty()) {
                return;
            }
        }

        String customUrl = call.getString("backendUrl", "");
        if (customUrl != null && !customUrl.trim().isEmpty()) {
            this.backendUrl = customUrl.trim().replaceAll("/+$", "");
        }

        String profile = call.getString("tradingProfile", "");
        if (profile != null && !profile.trim().isEmpty()) {
            this.activeTradingProfile = profile.trim();
        }

        if (call.hasOption("confirmedPoints")) {
            this.lastConfirmedPoints = call.getInt("confirmedPoints", this.lastConfirmedPoints);
        }
        if (call.hasOption("closedCandleColor")) {
            this.lastClosedCandleColor = call.getString("closedCandleColor", this.lastClosedCandleColor);
        }
        if (call.hasOption("closedCandleLabel")) {
            this.lastClosedCandleLabel = call.getString("closedCandleLabel", this.lastClosedCandleLabel);
        }
        if (call.hasOption("stepResults")) {
            com.getcapacitor.JSArray arr = call.getArray("stepResults");
            if (arr != null && arr.length() >= 5) {
                boolean[] parsed = new boolean[5];
                for (int i = 0; i < 5; i++) {
                    parsed[i] = arr.optBoolean(i, false);
                }
                this.lastStepResults = parsed;
            }
        }

        String direction = call.getString("direction", "WAIT");
        int confidence = call.getInt("confidence", 0);
        String durationText = call.getString("durationText", "--:--");
        String verdictTitle = call.getString("verdictTitle", "ANALYZING");
        String reasonText = call.getString("reasonText", "");
        String symbol = call.getString("symbol", "CHART");

        int frameCount = call.getInt("frameCount", sequenceCounter);
        String lastFrameTime = call.getString("lastFrameTime", "");
        String resolution = call.getString("resolution", "1080p");
        int latencyMs = call.getInt("latencyMs", 0);
        String errorReason = call.getString("errorReason", "");
        String aiState = call.getString("aiState", "IDLE");

        TextView dirView = overlayView.findViewWithTag("directionText");
        TextView detView = overlayView.findViewWithTag("detailsText");
        TextView toggleBtn = overlayView.findViewWithTag("scanToggleBtn");

        boolean hasError = errorReason != null && !errorReason.trim().isEmpty();
        boolean hasSignal = "UP".equalsIgnoreCase(direction) || "DOWN".equalsIgnoreCase(direction);
        boolean isBusy = "ANALYZING".equalsIgnoreCase(aiState);

        int strokeColor = 0xFFF59E0B; // Amber
        if (hasError) strokeColor = 0xFFEF4444; // Rose Red
        else if ("UP".equalsIgnoreCase(direction)) strokeColor = 0xFF10B981; // Emerald Green
        else if ("DOWN".equalsIgnoreCase(direction)) strokeColor = 0xFFEF4444; // Rose Red

        // Update rounded shape border dynamically
        android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
        shape.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        shape.setCornerRadius(42f);
        shape.setColor(0xF50F172A);
        shape.setStroke(3, strokeColor);
        overlayView.setBackground(shape);

        if (toggleBtn != null) {
            updateScanButtonVisual(toggleBtn, isBusy, hasSignal);
        }

        if (dirView != null && detView != null) {
            if (hasError) {
                dirView.setTextColor(0xFFEF4444);
                dirView.setText("⚠️ " + errorReason);
                detView.setVisibility(View.VISIBLE);
                detView.setText("Frame #" + frameCount + " • ⏱ " + latencyMs + "ms • State: WAIT");
                updateOverlayAuditWidgets(0, new boolean[]{false,false,false,false,false}, "ক্লোজ: --", "UNCERTAIN");
            } else if (isBusy) {
                dirView.setTextColor(0xFF38BDF8);
                dirView.setText("⚡ ১-ক্লিক স্ক্যান হচ্ছে...");
                detView.setVisibility(View.VISIBLE);
                detView.setText("ফ্রেম বিশ্লেষণ চলছে — ৫-ধাপ যাচাই");
                updateOverlayAuditWidgets(0, new boolean[]{false,false,false,false,false}, "ক্লোজ: --", "UNCERTAIN");
            } else if (hasSignal) {
                detView.setVisibility(View.VISIBLE);
                String badgeText = "UP".equalsIgnoreCase(direction) ? "▲ CALL (সবুজ)" : "▼ PUT (লাল)";
                dirView.setTextColor(strokeColor);

                String timerBadge = "";
                if (overlaySecondsRemaining > 0) {
                    int mins = overlaySecondsRemaining / 60;
                    int secs = overlaySecondsRemaining % 60;
                    timerBadge = String.format(Locale.US, "  ⏱ %02d:%02d", mins, secs);
                } else if (durationText != null && !durationText.equals("--:--") && !durationText.trim().isEmpty()) {
                    timerBadge = "  ⏱ " + durationText;
                }
                dirView.setText(badgeText + "  " + confidence + "%" + timerBadge);

                String shortReason = (reasonText != null && !reasonText.isEmpty()) ? reasonText : "মোমেন্টাম নিশ্চিত";
                if (shortReason.length() > 34) shortReason = shortReason.substring(0, 32) + "..";
                detView.setText(symbol + " • " + shortReason + " • 🔒");
                updateOverlayAuditWidgets(lastConfirmedPoints, lastStepResults, lastClosedCandleLabel, lastClosedCandleColor);
            } else if ("WAIT".equalsIgnoreCase(direction)) {
                dirView.setTextColor(0xFFF59E0B);
                if (verdictTitle != null && !verdictTitle.isEmpty()) {
                    dirView.setText(verdictTitle);
                } else {
                    dirView.setText("⏸ WAIT (" + lastConfirmedPoints + "/৫)");
                }
                detView.setVisibility(View.VISIBLE);
                String sub = (reasonText != null && !reasonText.trim().isEmpty())
                        ? reasonText
                        : "ক্যান্ডেল স্পষ্ট রাখুন বা বাবলটি একপাশে সরান";
                if (sub.length() > 36) sub = sub.substring(0, 34) + "..";
                detView.setText(sub);
                updateOverlayAuditWidgets(lastConfirmedPoints, lastStepResults, lastClosedCandleLabel, lastClosedCandleColor);
            } else {
                dirView.setTextColor(0xFF38BDF8);
                dirView.setText("⚡ প্রস্তুত (Ready)");
                detView.setVisibility(View.VISIBLE);
                detView.setText("স্ক্যান করতে নিচের বাটনে ট্যাপ করুন");
                updateOverlayAuditWidgets(0, new boolean[]{false,false,false,false,false}, "ক্লোজ: --", "UNCERTAIN");
            }
        }
    }

    public static void deliverAuthCallbackUri(Uri uri) {
        if (uri == null) return;
        final String uriStr = uri.toString();
        pendingAuthCallbackUri = uriStr;
        TradePulseNativeScreenPlugin instance = activeInstanceRef != null ? activeInstanceRef.get() : null;
        if (instance != null) {
            JSObject payload = new JSObject();
            payload.put("url", uriStr);
            instance.notifyListeners("onGoogleAuthCallback", payload);
        }
    }

    private String getAppSigningFingerprint(String algorithm) {
        try {
            Context ctx = getContext();
            if (ctx == null) return "";
            PackageManager pm = ctx.getPackageManager();
            String pkg = ctx.getPackageName();
            Signature[] signatures = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo pkgInfo = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES);
                if (pkgInfo != null && pkgInfo.signingInfo != null) {
                    SigningInfo signingInfo = pkgInfo.signingInfo;
                    signatures = signingInfo.hasMultipleSigners()
                            ? signingInfo.getApkContentsSigners()
                            : signingInfo.getSigningCertificateHistory();
                }
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo pkgInfo = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES);
                if (pkgInfo != null) {
                    signatures = pkgInfo.signatures;
                }
            }
            if (signatures == null || signatures.length == 0) return "";
            MessageDigest md = MessageDigest.getInstance(algorithm);
            byte[] digest = md.digest(signatures[0].toByteArray());
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < digest.length; i++) {
                if (i > 0) sb.append(':');
                sb.append(String.format(Locale.US, "%02X", digest[i] & 0xFF));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    @PluginMethod
    public void signInWithGoogleNative(PluginCall call) {
        final String serverClientId = call.getString(
                "serverClientId",
                "1074453942803-a3p076amqntv9oblaq01fb6aclbf5c7r.apps.googleusercontent.com"
        );
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            JSObject errRes = new JSObject();
            errRes.put("success", false);
            errRes.put("errorCode", "NO_ACTIVITY");
            errRes.put("error", "অ্যাপ অ্যাক্টিভিটি প্রস্তুত নয়।");
            call.resolve(errRes);
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                CredentialManager credentialManager = CredentialManager.create(activity);
                GetSignInWithGoogleOption signInWithGoogleOption =
                        new GetSignInWithGoogleOption.Builder(serverClientId).build();
                GetCredentialRequest request = new GetCredentialRequest.Builder()
                        .addCredentialOption(signInWithGoogleOption)
                        .build();

                credentialManager.getCredentialAsync(
                        activity,
                        request,
                        null,
                        ContextCompat.getMainExecutor(activity),
                        new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                            @Override
                            public void onResult(@NonNull GetCredentialResponse response) {
                                Credential credential = response.getCredential();
                                if (credential instanceof CustomCredential
                                        && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                    try {
                                        GoogleIdTokenCredential googleCred =
                                                GoogleIdTokenCredential.createFrom(credential.getData());
                                        JSObject ok = new JSObject();
                                        ok.put("success", true);
                                        ok.put("idToken", googleCred.getIdToken());
                                        ok.put("email", googleCred.getId());
                                        ok.put("displayName", googleCred.getDisplayName() != null ? googleCred.getDisplayName() : "");
                                        call.resolve(ok);
                                    } catch (Exception parseEx) {
                                        JSObject fail = new JSObject();
                                        fail.put("success", false);
                                        fail.put("errorCode", "TOKEN_PARSE_ERROR");
                                        fail.put("error", "Google ID টোকেন পার্স করা যায়নি: " + parseEx.getMessage());
                                        call.resolve(fail);
                                    }
                                } else {
                                    JSObject fail = new JSObject();
                                    fail.put("success", false);
                                    fail.put("errorCode", "UNEXPECTED_CREDENTIAL");
                                    fail.put("error", "অপ্রত্যাশিত Google ক্রেডেনশিয়াল ধরন পাওয়া গেছে।");
                                    call.resolve(fail);
                                }
                            }

                            @Override
                            public void onError(@NonNull GetCredentialException e) {
                                JSObject fail = new JSObject();
                                fail.put("success", false);
                                if (e instanceof GetCredentialCancellationException) {
                                    fail.put("cancelled", true);
                                    fail.put("errorCode", "CANCELLED");
                                    fail.put("error", "Google অ্যাকাউন্ট বাছাই বাতিল করা হয়েছে।");
                                    call.resolve(fail);
                                    return;
                                }

                                String rawMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                                String lower = rawMsg.toLowerCase(Locale.US);
                                boolean likelyShaOrConfig = (e instanceof NoCredentialException)
                                        || (e instanceof GetCredentialProviderConfigurationException)
                                        || lower.contains("developer")
                                        || lower.contains("28444")
                                        || lower.contains("10:")
                                        || lower.contains("caller has no access")
                                        || lower.contains("sha")
                                        || lower.contains("configuration");

                                fail.put("errorCode", likelyShaOrConfig ? "NEEDS_ANDROID_SHA1" : "NATIVE_ERROR");
                                fail.put("error", rawMsg);
                                fail.put("packageName", getContext() != null ? getContext().getPackageName() : "com.tradepulse.bot");
                                fail.put("sha1", getAppSigningFingerprint("SHA-1"));
                                fail.put("sha256", getAppSigningFingerprint("SHA-256"));
                                call.resolve(fail);
                            }
                        }
                );
            } catch (Exception ex) {
                JSObject fail = new JSObject();
                fail.put("success", false);
                fail.put("errorCode", "NATIVE_INIT_ERROR");
                fail.put("error", ex.getMessage() != null ? ex.getMessage() : "Native Google Sign-In init failed");
                fail.put("packageName", getContext() != null ? getContext().getPackageName() : "com.tradepulse.bot");
                fail.put("sha1", getAppSigningFingerprint("SHA-1"));
                fail.put("sha256", getAppSigningFingerprint("SHA-256"));
                call.resolve(fail);
            }
        });
    }

    @PluginMethod
    public void openGoogleAuthInBrowser(PluginCall call) {
        final String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Auth URL is required");
            return;
        }
        pendingAuthCallbackUri = null;
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                CustomTabColorSchemeParams colorParams = new CustomTabColorSchemeParams.Builder()
                        .setToolbarColor(0xFF0F172A)
                        .build();
                CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                        .setDefaultColorSchemeParams(colorParams)
                        .setShowTitle(false)
                        .setUrlBarHidingEnabled(true)
                        .build();
                customTabsIntent.launchUrl(activity, Uri.parse(url));
                JSObject res = new JSObject();
                res.put("opened", true);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("ইন-অ্যাপ লগইন ট্যাব খোলা যায়নি: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void consumePendingAuthCallback(PluginCall call) {
        JSObject res = new JSObject();
        res.put("url", pendingAuthCallbackUri != null ? pendingAuthCallbackUri : "");
        pendingAuthCallbackUri = null;
        call.resolve(res);
    }
}
