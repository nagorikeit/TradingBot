package com.tradepulse.bot.plugins;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
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
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.Locale;

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
    private PluginCall pendingCaptureCall = null;

    // Floating overlay window state
    private WindowManager windowManager;
    private View overlayView;
    private WindowManager.LayoutParams overlayParams;

    // Android Native Text-To-Speech engine for floating overlay audio guidance
    private TextToSpeech textToSpeech;
    private boolean isTtsInitialized = false;

    @Override
    public void load() {
        super.load();
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

        // Scale to 720 width while preserving true device aspect ratio
        float scale = Math.min(1.0f, 720.0f / (float) screenWidth);
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

                    Bitmap bitmap = Bitmap.createBitmap(
                            w + rowPadding / pixelStride,
                            h,
                            Bitmap.Config.ARGB_8888
                    );
                    bitmap.copyPixelsFromBuffer(buffer);

                    Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, w, h);
                    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
                    cropped.compress(Bitmap.CompressFormat.JPEG, 75, byteArrayOutputStream);
                    byte[] byteArray = byteArrayOutputStream.toByteArray();

                    latestFrameBase64 = "data:image/jpeg;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP);
                    latestFrameWidth = w;
                    latestFrameHeight = h;
                    latestFrameTimestamp = System.currentTimeMillis();

                    bitmap.recycle();
                    cropped.recycle();

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
    }

    private void captureAndEmitLatestFrame() {
        if (latestFrameBase64 != null) {
            emitCachedFrame();
            return;
        }
        isScanRequested = true;
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

                        notifyListeners("onFrameCaptured", res);

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
                                        res.put("timestamp", System.currentTimeMillis());
                                        res.put("sequenceId", sequenceCounter);
                                        res.put("width", latestFrameWidth);
                                        res.put("height", latestFrameHeight);

                                        notifyListeners("onFrameCaptured", res);
                                        pendingCaptureCall.resolve(res);
                                    } else {
                                        pendingCaptureCall.reject("No frame available from screen");
                                    }
                                    pendingCaptureCall = null;
                                }
                            }
                        }, 400);
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
        if (captureHandler != null && captureRunnable != null) {
            captureHandler.removeCallbacks(captureRunnable);
        }
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

        // Subtle close button to dismiss if user explicitly wants to close
        TextView closeBtn = new TextView(getContext());
        closeBtn.setText("✕");
        closeBtn.setTextSize(13);
        closeBtn.setTextColor(0xFF94A3B8);
        closeBtn.setPadding(12, 4, 12, 4);
        closeBtn.setClickable(true);
        closeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                notifyListeners("onOverlayStopClicked", new JSObject());
                stopScreenCapture(null);
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

        layout.addView(dragContainer);

        // Bottom Action Button Row with ONE SINGLE Scan / Stop Toggle Button
        android.widget.LinearLayout buttonRow = new android.widget.LinearLayout(getContext());
        buttonRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        buttonRow.setGravity(Gravity.CENTER);
        buttonRow.setPadding(0, 16, 0, 4);

        final TextView scanToggleBtn = new TextView(getContext());
        scanToggleBtn.setId(android.view.View.generateViewId());
        scanToggleBtn.setTag("scanToggleBtn");
        scanToggleBtn.setTextSize(13);
        scanToggleBtn.setTextColor(0xFFFFFFFF);
        scanToggleBtn.setTypeface(null, android.graphics.Typeface.BOLD);
        scanToggleBtn.setPadding(46, 14, 46, 14);
        scanToggleBtn.setClickable(true);
        updateScanButtonVisual(scanToggleBtn, isScanningActive);

        scanToggleBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isScanningActive = !isScanningActive;
                updateScanButtonVisual(scanToggleBtn, isScanningActive);

                JSObject data = new JSObject();
                data.put("isScanning", isScanningActive);
                notifyListeners("onOverlayScanToggle", data);

                if (isScanningActive) {
                    captureAndEmitLatestFrame();
                }
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

    private void updateScanButtonVisual(TextView btn, boolean isScanning) {
        if (btn == null) return;
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        bg.setCornerRadius(24f);

        if (isScanning) {
            btn.setText("⏹ স্ক্যান স্টপ");
            bg.setColor(0xFFDC2626); // Rose red
            bg.setStroke(2, 0xFFEF4444);
        } else {
            btn.setText("🔍 স্ক্যান শুরু করুন");
            bg.setColor(0xFF059669); // Emerald green
            bg.setStroke(2, 0xFF10B981);
        }
        btn.setBackground(bg);
    }

    private void updateOverlayContent(PluginCall call) {
        if (overlayView == null) return;

        String direction = call.getString("direction", "WAIT");
        int confidence = call.getInt("confidence", 0);
        String durationText = call.getString("durationText", "--:--");
        String verdictTitle = call.getString("verdictTitle", "ANALYZING");
        String reasonText = call.getString("reasonText", "");
        String symbol = call.getString("symbol", "CHART");

        int frameCount = call.getInt("frameCount", sequenceCounter);
        String lastFrameTime = call.getString("lastFrameTime", "");
        String resolution = call.getString("resolution", "720p");
        int latencyMs = call.getInt("latencyMs", 0);
        String errorReason = call.getString("errorReason", "");
        String aiState = call.getString("aiState", "IDLE");

        TextView dirView = overlayView.findViewWithTag("directionText");
        TextView detView = overlayView.findViewWithTag("detailsText");

        boolean hasError = errorReason != null && !errorReason.trim().isEmpty();

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

        boolean isScanning = call.getBoolean("isScanning", isScanningActive);
        isScanningActive = isScanning;
        TextView toggleBtn = overlayView.findViewWithTag("scanToggleBtn");
        if (toggleBtn != null) {
            updateScanButtonVisual(toggleBtn, isScanningActive);
        }

        if (dirView != null && detView != null) {
            if (hasError) {
                dirView.setTextColor(0xFFEF4444);
                dirView.setText("⚠️ " + errorReason);
                detView.setVisibility(View.VISIBLE);
                detView.setText("Frame #" + frameCount + " • ⏱ " + latencyMs + "ms • State: WAIT");
            } else if ("ANALYZING".equalsIgnoreCase(aiState)) {
                dirView.setTextColor(0xFF38BDF8);
                dirView.setText("🔍 স্ক্যান করা হচ্ছে...");
                detView.setVisibility(View.VISIBLE);
                detView.setText("স্ক্রিন ফ্রেম রিয়েল-টাইম প্রসেসিং...");
            } else if ("WAIT".equalsIgnoreCase(direction)) {
                dirView.setTextColor(0xFFF59E0B);
                if (verdictTitle != null && !verdictTitle.isEmpty()) {
                    dirView.setText(verdictTitle);
                } else {
                    dirView.setText("⏸ চার্ট পাওয়া যায়নি");
                }
                detView.setVisibility(View.VISIBLE);
                String sub = (reasonText != null && !reasonText.trim().isEmpty())
                        ? reasonText
                        : "স্ক্যান করতে স্ক্যান বাটনে চাপুন";
                if (sub.length() > 36) sub = sub.substring(0, 34) + "..";
                detView.setText(sub);
            } else {
                // When chart analyzed: UP / DOWN
                detView.setVisibility(View.VISIBLE);
                String badgeText = "UP".equalsIgnoreCase(direction) ? "▲ CALL (UP)" : "DOWN".equalsIgnoreCase(direction) ? "▼ PUT (DOWN)" : "● WAIT";
                dirView.setTextColor(strokeColor);
                dirView.setText(badgeText + "  •  " + confidence + "%");

                String shortReason = (reasonText != null && !reasonText.isEmpty()) ? reasonText : "মোমেন্টাম নিশ্চিত";
                if (shortReason.length() > 34) shortReason = shortReason.substring(0, 32) + "..";
                detView.setText(symbol + " • " + shortReason);
            }
        }
    }
}
