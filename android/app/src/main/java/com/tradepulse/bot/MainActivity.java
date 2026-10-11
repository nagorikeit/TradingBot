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
}
