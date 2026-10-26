package com.tradepulse.bot.plugins;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * ScreenCaptureService
 * Foreground Service required on Android 10+ and strictly enforced on Android 14/15
 * to allow continuous MediaProjection screen capture while the user operates other apps.
 */
public class ScreenCaptureService extends Service {

    private static final String CHANNEL_ID = "TradePulseScreenCaptureChannel";
    private static final int NOTIFICATION_ID = 4099;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireWakeLock();
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "TradePulse::ScreenCaptureWakeLock"
                );
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        wakeLock = null;
    }

    public interface ProjectionCallback {
        void onProjectionCreated(MediaProjection projection);
        void onProjectionFailed(Exception error);
    }

    private static volatile ProjectionCallback sCallback;

    public static void setCallback(ProjectionCallback callback) {
        sCallback = callback;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("TradePulse Screen AI Active")
                .setContentText("Reading trading chart and computing UP/DOWN signals in real-time.")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
            startForeground(NOTIFICATION_ID, notification, serviceType);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // Android 14+ requirement: startForeground() must be called BEFORE getMediaProjection().
        // Now that the service is running in the foreground with FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
        // we can safely obtain the MediaProjection without SecurityException.
        if (intent != null && intent.hasExtra("resultCode")) {
            int resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED);
            Intent resultData = null;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    resultData = intent.getParcelableExtra("resultData", Intent.class);
                } else {
                    resultData = intent.getParcelableExtra("resultData");
                }
            } catch (Exception e) {
                resultData = intent.getParcelableExtra("resultData");
            }

            if (resultCode == Activity.RESULT_OK && resultData != null) {
                try {
                    MediaProjectionManager projectionManager =
                            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                    if (projectionManager != null) {
                        MediaProjection projection = projectionManager.getMediaProjection(resultCode, resultData);
                        if (projection != null && sCallback != null) {
                            sCallback.onProjectionCreated(projection);
                        } else if (sCallback != null) {
                            sCallback.onProjectionFailed(new Exception("MediaProjectionManager returned null"));
                        }
                    } else if (sCallback != null) {
                        sCallback.onProjectionFailed(new Exception("MediaProjectionManager service is null"));
                    }
                } catch (Exception e) {
                    if (sCallback != null) {
                        sCallback.onProjectionFailed(e);
                    }
                }
            } else if (sCallback != null) {
                sCallback.onProjectionFailed(new Exception("Invalid result code: " + resultCode));
            }
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        sCallback = null;
        releaseWakeLock();
        stopForeground(true);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "TradePulse Screen Capture Service",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active status of real-time trading screen analysis");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
