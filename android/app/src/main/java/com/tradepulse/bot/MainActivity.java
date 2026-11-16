package com.tradepulse.bot;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.tradepulse.bot.plugins.TradePulseNativeScreenPlugin;

public class MainActivity extends BridgeActivity {
    private void handleAuthCallbackIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null && "tradepulse".equals(data.getScheme())) {
            TradePulseNativeScreenPlugin.deliverAuthCallbackUri(data);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TradePulseNativeScreenPlugin.class);
        super.onCreate(savedInstanceState);
        handleAuthCallbackIntent(getIntent());
        
        try {
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (getBridge() != null && getBridge().getWebView() != null) {
                android.webkit.WebView webView = getBridge().getWebView();
                android.webkit.WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthCallbackIntent(intent);
    }

    /**
     * When user switches to another trading app (Quotex, Binomo, MT4, TradingView),
     * keep WebView JS execution and network stack active so frames are sent to AI
     * and the Floating HUD is updated continuously.
     */
    @Override
    public void onPause() {
        super.onPause();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
            getBridge().getWebView().resumeTimers();
        }
    }
}
