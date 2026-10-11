package com.tradepulse.bot;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.tradepulse.bot.plugins.TradePulseNativeScreenPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TradePulseNativeScreenPlugin.class);
        super.onCreate(savedInstanceState);
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
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().onResume();
        }
    }
}
