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
import android.util.Base64;
import android.util.DisplayMetrics;
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

/**
 * TradePulseNativeScreenPlugin
 * Provides:
 * 1. Android MediaProjection continuous background capture (Foreground Service)
 * 2. SYSTEM_ALERT_WINDOW floating draggable HUD overlay showing UP/DOWN/WAIT, Duration & Reasons
 * 3. Real-time frame streaming into TradePulse Vision AI engine
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

    // Floating overlay window state
    private WindowManager windowManager;
    private View overlayView;
    private WindowManager.LayoutParams overlayParams;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        projectionManager = (MediaProjectionManager) context.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        captureHandler = new Handler(Looper.getMainLooper());
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
        int intervalSec = call.getInt("intervalSeconds", 3);
        this.captureIntervalMs = Math.max(2, intervalSec) * 1000;

        if (projectionManager == null) {
            call.reject("MediaProjectionManager not available on this device");
            return;
        }

        // Prompt system dialog to capture screen
        Intent captureIntent = projectionManager.createScreenCaptureIntent();
        startActivityForResult(call, captureIntent, "handleProjectionResult");
    }

    @ActivityCallback
    private void handleProjectionResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User declined screen projection permission");
            return;
        }

        // Start Foreground Service with MEDIA_PROJECTION type (Android 14+ requires consent prior to service start)
        try {
            Intent serviceIntent = new Intent(getContext(), ScreenCaptureService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        mediaProjection = projectionManager.getMediaProjection(result.getResultCode(), result.getData());
        if (mediaProjection == null) {
            call.reject("Failed to obtain MediaProjection instance");
            return;
        }

        setupVirtualDisplay();
        startFrameCaptureLoop();

        JSObject res = new JSObject();
        res.put("success", true);
        call.resolve(res);
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

    private void startFrameCaptureLoop() {
        captureRunnable = new Runnable() {
            @Override
            public void run() {
                captureAndEmitLatestFrame();
                if (mediaProjection != null) {
                    captureHandler.postDelayed(this, captureIntervalMs);
                }
            }
        };
        captureHandler.postDelayed(captureRunnable, 1000);
    }

    private void captureAndEmitLatestFrame() {
        if (imageReader == null) return;
        Image image = null;
        try {
            image = imageReader.acquireLatestImage();
            if (image == null) return;

            Image.Plane[] planes = image.getPlanes();
            ByteBuffer buffer = planes[0].getBuffer();
            int pixelStride = planes[0].getPixelStride();
            int rowStride = planes[0].getRowStride();
            int width = image.getWidth();
            int height = image.getHeight();
            int rowPadding = rowStride - pixelStride * width;

            Bitmap bitmap = Bitmap.createBitmap(
                    width + rowPadding / pixelStride,
                    height,
                    Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);

            // Crop excess row padding
            Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height);
            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            cropped.compress(Bitmap.CompressFormat.JPEG, 75, byteArrayOutputStream);
            byte[] byteArray = byteArrayOutputStream.toByteArray();
            String base64Image = "data:image/jpeg;base64," + Base64.encodeToString(byteArray, Base64.NO_WRAP);

            sequenceCounter++;
            JSObject event = new JSObject();
            event.put("imageBase64", base64Image);
            event.put("timestamp", System.currentTimeMillis());
            event.put("sequenceId", sequenceCounter);
            event.put("width", width);
            event.put("height", height);

            notifyListeners("onFrameCaptured", event);

            bitmap.recycle();
            cropped.recycle();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (image != null) {
                image.close();
            }
        }
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
        Intent serviceIntent = new Intent(getContext(), ScreenCaptureService.class);
        getContext().stopService(serviceIntent);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showFloatingOverlay(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
                    call.reject("Overlay permission not granted. Request overlay permission first.");
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
                    windowManager.removeView(overlayView);
                    overlayView = null;
                }
                call.resolve(new JSObject().put("success", true));
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
        layout.setPadding(30, 24, 30, 24);
        layout.setBackgroundColor(0xE60F172A); // Dark slate

        TextView titleView = new TextView(getContext());
        titleView.setId(android.view.View.generateViewId());
        titleView.setTextSize(14);
        titleView.setTextColor(0xFF38BDF8);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setTag("directionText");
        layout.addView(titleView);

        TextView detailsView = new TextView(getContext());
        detailsView.setId(android.view.View.generateViewId());
        detailsView.setTextSize(12);
        detailsView.setTextColor(0xFFE2E8F0);
        detailsView.setTag("detailsText");
        layout.addView(detailsView);

        // Touch listener for dragging overlay across screen
        layout.setOnTouchListener(new View.OnTouchListener() {
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

    private void updateOverlayContent(PluginCall call) {
        if (overlayView == null) return;

        String direction = call.getString("direction", "WAIT");
        int confidence = call.getInt("confidence", 0);
        String durationText = call.getString("durationText", "1-3 min");
        String verdictTitle = call.getString("verdictTitle", "ANALYZING");
        String reasonText = call.getString("reasonText", "");
        int latencyMs = call.getInt("latencyMs", 0);

        TextView dirView = overlayView.findViewWithTag("directionText");
        TextView detView = overlayView.findViewWithTag("detailsText");

        if (dirView != null) {
            int color = 0xFFF59E0B; // Yellow for WAIT
            if ("UP".equalsIgnoreCase(direction)) color = 0xFF10B981; // Green
            if ("DOWN".equalsIgnoreCase(direction)) color = 0xFFEF4444; // Red
            dirView.setTextColor(color);
            dirView.setText("● " + direction + " (" + confidence + "% Conf) • " + latencyMs + "ms");
        }

        if (detView != null) {
            String shortReason = reasonText.length() > 60 ? reasonText.substring(0, 57) + "..." : reasonText;
            detView.setText(verdictTitle + "\nExpiry: " + durationText + "\n" + shortReason);
        }
    }
}
