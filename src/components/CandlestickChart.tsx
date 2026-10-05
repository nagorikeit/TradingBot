import React, { useState, useRef, useMemo } from 'react';
import { Candle, Signal, TimeframeKey } from '../types';
import { calculateEMA, calculateRSI, calculateMACD, calculateBollingerBands } from '../indicators';
import { getAssetInfo } from '../data/marketDataProvider';
import { formatPrice, formatTime } from '../utils/formatters';
import { Layers, Eye, Crosshair } from 'lucide-react';

interface CandlestickChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: TimeframeKey;
  signals?: Signal[];
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  symbol,
  timeframe,
  signals = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showEMA9, setShowEMA9] = useState(true);
  const [showEMA21, setShowEMA21] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [activeSubPanel, setActiveSubPanel] = useState<'rsi' | 'macd' | 'none'>('rsi');

  const asset = getAssetInfo(symbol);

  // We display the last N candles (e.g. 50 on mobile, 65 on desktop)
  const visibleCandles = useMemo(() => {
    return candles.slice(-55);
  }, [candles]);

  const closes = useMemo(() => visibleCandles.map((c) => c.close), [visibleCandles]);

  // Compute indicator series for the visible candles
  const ema9Series = useMemo(() => calculateEMA(closes, 9), [closes]);
  const ema21Series = useMemo(() => calculateEMA(closes, 21), [closes]);
  const bbSeries = useMemo(() => calculateBollingerBands(closes, 20, 2), [closes]);
  const rsiSeries = useMemo(() => calculateRSI(closes, 14), [closes]);
  const macdSeries = useMemo(() => calculateMACD(closes, 12, 26, 9), [closes]);

  // Price Extents
  const { minPrice, maxPrice, maxVolume } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 1, maxPrice: 1, maxVolume: 100 };
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    visibleCandles.forEach((c, idx) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;

      if (showBB) {
        if (bbSeries.upper[idx] > max) max = bbSeries.upper[idx];
        if (bbSeries.lower[idx] < min) min = bbSeries.lower[idx];
      }
    });

    // Add 10% padding
    const range = max - min || 0.001;
    return {
      minPrice: min - range * 0.08,
      maxPrice: max + range * 0.08,
      maxVolume: maxVol || 1,
    };
  }, [visibleCandles, showBB, bbSeries]);

  // Chart Dimensions
  const chartWidth = 900;
  const mainChartHeight = 280;
  const subChartHeight = activeSubPanel !== 'none' ? 90 : 0;
  const totalSvgHeight = mainChartHeight + subChartHeight + 25; // 25 for time axis

  const candleCount = visibleCandles.length;
  const candleSlotWidth = chartWidth / Math.max(1, candleCount);
  const candleBodyWidth = Math.max(3, candleSlotWidth * 0.65);

  const priceToY = (price: number): number => {
    const range = maxPrice - minPrice || 1;
    return mainChartHeight - ((price - minPrice) / range) * (mainChartHeight - 20) - 10;
  };

  const indexToX = (index: number): number => {
    return index * candleSlotWidth + candleSlotWidth / 2;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const svgX = (x / rect.width) * chartWidth;
    const idx = Math.floor(svgX / candleSlotWidth);
    if (idx >= 0 && idx < candleCount) {
      setHoverIndex(idx);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activeCandle = hoverIndex !== null ? visibleCandles[hoverIndex] : visibleCandles[visibleCandles.length - 1];
  const activeEMA9 = (hoverIndex !== null ? ema9Series[hoverIndex] : ema9Series[ema9Series.length - 1]) ?? 0;
  const activeEMA21 = (hoverIndex !== null ? ema21Series[hoverIndex] : ema21Series[ema21Series.length - 1]) ?? 0;
  const activeRSI = (hoverIndex !== null ? rsiSeries[hoverIndex] : rsiSeries[rsiSeries.length - 1]) ?? 50;
  const activeMACD = (hoverIndex !== null ? macdSeries.histogram[hoverIndex] : macdSeries.histogram[macdSeries.histogram.length - 1]) ?? 0;

  if (!visibleCandles || visibleCandles.length === 0) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-lg p-10 flex flex-col items-center justify-center min-h-[360px] text-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-400">Loading chart candles and technical feeds...</span>
      </div>
    );
  }

  // Helper to build SVG polyline points
  const buildPolyline = (series: number[]) => {
    return series
      .map((val, idx) => {
        if (isNaN(val) || val === 0) return null;
        return `${indexToX(idx)},${priceToY(val)}`;
      })
      .filter(Boolean)
      .join(' ');
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      {/* Chart Top Controls & Legends */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Active Candle Telemetry */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          {activeCandle && (
            <>
              <span className="text-slate-400">{formatTime(activeCandle.timestamp)}</span>
              <span>
                <span className="text-slate-500">O: </span>
                <span className="text-slate-200">{formatPrice(activeCandle.open, asset.pipDecimals)}</span>
              </span>
              <span>
                <span className="text-slate-500">H: </span>
                <span className="text-emerald-400">{formatPrice(activeCandle.high, asset.pipDecimals)}</span>
              </span>
              <span>
                <span className="text-slate-500">L: </span>
                <span className="text-rose-400">{formatPrice(activeCandle.low, asset.pipDecimals)}</span>
              </span>
              <span>
                <span className="text-slate-500">C: </span>
                <span
                  className={activeCandle.close >= activeCandle.open ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
                >
                  {formatPrice(activeCandle.close, asset.pipDecimals)}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Overlay Toggles & Sub-panel Selector */}
        <div className="flex items-center gap-2">
          {/* EMA 9 Toggle */}
          <button
            onClick={() => setShowEMA9(!showEMA9)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
              showEMA9
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            EMA 9
          </button>

          {/* EMA 21 Toggle */}
          <button
            onClick={() => setShowEMA21(!showEMA21)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
              showEMA21
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            EMA 21
          </button>

          {/* Bollinger Bands Toggle */}
          <button
            onClick={() => setShowBB(!showBB)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors ${
              showBB
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            BB (20,2)
          </button>

          <span className="text-slate-700">|</span>

          {/* Subpanel Toggles */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setActiveSubPanel(activeSubPanel === 'rsi' ? 'none' : 'rsi')}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                activeSubPanel === 'rsi' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RSI (14)
            </button>
            <button
              onClick={() => setActiveSubPanel(activeSubPanel === 'macd' ? 'none' : 'macd')}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                activeSubPanel === 'macd' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MACD
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none bg-[#090d16]">
        <svg
          viewBox={`0 0 ${chartWidth} ${totalSvgHeight}`}
          className="w-full h-auto cursor-crosshair block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="bbAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="bullVolGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="bearVolGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((pct) => {
            const y = mainChartHeight * pct;
            const priceVal = maxPrice - (pct * (maxPrice - minPrice));
            return (
              <g key={pct}>
                <line
                  x1="0"
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={chartWidth - 8}
                  y={y - 4}
                  fill="#475569"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {formatPrice(priceVal, asset.pipDecimals)}
                </text>
              </g>
            );
          })}

          {/* Volume bars in background */}
          {visibleCandles.map((c, i) => {
            const x = indexToX(i);
            const volHeight = (c.volume / maxVolume) * 45;
            const isBull = c.close >= c.open;
            return (
              <rect
                key={`vol_${i}`}
                x={x - candleBodyWidth / 2}
                y={mainChartHeight - volHeight}
                width={candleBodyWidth}
                height={volHeight}
                fill={isBull ? 'url(#bullVolGrad)' : 'url(#bearVolGrad)'}
              />
            );
          })}

          {/* Bollinger Bands Shading & Lines */}
          {showBB && (
            <>
              {/* Upper band */}
              <polyline
                points={buildPolyline(bbSeries.upper)}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.7"
              />
              {/* Middle band (SMA 20) */}
              <polyline
                points={buildPolyline(bbSeries.middle)}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1"
                opacity="0.4"
              />
              {/* Lower band */}
              <polyline
                points={buildPolyline(bbSeries.lower)}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                opacity="0.7"
              />
            </>
          )}

          {/* EMA Lines */}
          {showEMA21 && (
            <polyline
              points={buildPolyline(ema21Series)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {showEMA9 && (
            <polyline
              points={buildPolyline(ema9Series)}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Candlesticks */}
          {visibleCandles.map((c, i) => {
            const x = indexToX(i);
            const isBull = c.close >= c.open;
            const candleColor = isBull ? '#10b981' : '#f43f5e';
            const openY = priceToY(c.open);
            const closeY = priceToY(c.close);
            const highY = priceToY(c.high);
            const lowY = priceToY(c.low);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

            return (
              <g key={`candle_${c.timestamp}_${i}`}>
                {/* Wick High-Low line */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={candleColor}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />

                {/* Candle Body */}
                <rect
                  x={x - candleBodyWidth / 2}
                  y={bodyTop}
                  width={candleBodyWidth}
                  height={bodyHeight}
                  fill={candleColor}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Signal Entry Markers on Chart */}
          {signals.map((sig) => {
            const matchIndex = visibleCandles.findIndex(
              (c) => Math.abs(c.timestamp - sig.signalTime) < 35000
            );
            if (matchIndex === -1) return null;

            const x = indexToX(matchIndex);
            const candle = visibleCandles[matchIndex];
            const isCall = sig.direction === 'CALL';
            const isPut = sig.direction === 'PUT';
            if (!isCall && !isPut) return null;

            const yPos = isCall ? priceToY(candle.low) + 16 : priceToY(candle.high) - 16;

            return (
              <g key={`sig_marker_${sig.id}`}>
                {isCall ? (
                  <g transform={`translate(${x - 7}, ${yPos - 5})`}>
                    <polygon points="7,0 14,12 0,12" fill="#10b981" />
                    <text x="7" y="21" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">
                      CALL
                    </text>
                  </g>
                ) : (
                  <g transform={`translate(${x - 7}, ${yPos - 12})`}>
                    <polygon points="7,12 14,0 0,0" fill="#f43f5e" />
                    <text x="7" y="-3" fill="#f43f5e" fontSize="8" fontWeight="bold" textAnchor="middle">
                      PUT
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Current Live Price Line */}
          {visibleCandles.length > 0 && (
            <g>
              <line
                x1="0"
                y1={priceToY(visibleCandles[visibleCandles.length - 1].close)}
                x2={chartWidth}
                y2={priceToY(visibleCandles[visibleCandles.length - 1].close)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <rect
                x={chartWidth - 65}
                y={priceToY(visibleCandles[visibleCandles.length - 1].close) - 9}
                width="62"
                height="18"
                fill="#10b981"
                rx="3"
              />
              <text
                x={chartWidth - 34}
                y={priceToY(visibleCandles[visibleCandles.length - 1].close) + 3}
                fill="#022c22"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {formatPrice(visibleCandles[visibleCandles.length - 1].close, asset.pipDecimals)}
              </text>
            </g>
          )}

          {/* Subpanel Divider & Indicator Panels */}
          {activeSubPanel !== 'none' && (
            <g transform={`translate(0, ${mainChartHeight})`}>
              {/* Divider */}
              <line x1="0" y1="0" x2={chartWidth} y2="0" stroke="#334155" strokeWidth="1" />

              {/* RSI Panel */}
              {activeSubPanel === 'rsi' && (
                <g>
                  {/* Label */}
                  <text x="12" y="15" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    RSI (14) · Current: {typeof activeRSI === 'number' && !isNaN(activeRSI) ? activeRSI.toFixed(1) : '50.0'}
                  </text>

                  {/* 70 Overbought, 50 Center, 30 Oversold guides */}
                  {[70, 50, 30].map((level) => {
                    const y = subChartHeight - ((level - 10) / 80) * (subChartHeight - 20) - 10;
                    return (
                      <g key={level}>
                        <line
                          x1="0"
                          y1={y}
                          x2={chartWidth}
                          y2={y}
                          stroke="#1e293b"
                          strokeWidth="1"
                          strokeDasharray={level === 50 ? '3 3' : '1 1'}
                        />
                        <text x={chartWidth - 8} y={y - 2} fill="#475569" fontSize="8" fontFamily="monospace" textAnchor="end">
                          {level}
                        </text>
                      </g>
                    );
                  })}

                  {/* RSI Polyline */}
                  <polyline
                    points={rsiSeries
                      .map((val, idx) => {
                        const y = subChartHeight - ((val - 10) / 80) * (subChartHeight - 20) - 10;
                        return `${indexToX(idx)},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.6"
                  />
                </g>
              )}

              {/* MACD Panel */}
              {activeSubPanel === 'macd' && (
                <g>
                  <text x="12" y="15" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    MACD (12, 26, 9) · Hist: {typeof activeMACD === 'number' && !isNaN(activeMACD) ? activeMACD.toFixed(asset.pipDecimals) : '0.00000'}
                  </text>

                  {/* Zero line */}
                  <line
                    x1="0"
                    y1={subChartHeight / 2}
                    x2={chartWidth}
                    y2={subChartHeight / 2}
                    stroke="#334155"
                    strokeWidth="1"
                  />

                  {/* Histogram bars */}
                  {macdSeries.histogram.map((val, idx) => {
                    const x = indexToX(idx);
                    const zeroY = subChartHeight / 2;
                    // Max amplitude normalization
                    const maxHist = 0.0006;
                    const barH = Math.min(35, (Math.abs(val) / maxHist) * 30);
                    const isPositive = val >= 0;

                    return (
                      <rect
                        key={`hist_${idx}`}
                        x={x - candleBodyWidth / 2}
                        y={isPositive ? zeroY - barH : zeroY}
                        width={candleBodyWidth}
                        height={Math.max(1, barH)}
                        fill={isPositive ? '#10b981' : '#f43f5e'}
                        opacity="0.8"
                      />
                    );
                  })}
                </g>
              )}
            </g>
          )}

          {/* Crosshair Cursor & Info */}
          {hoverIndex !== null && (
            <g>
              {/* Vertical line */}
              <line
                x1={indexToX(hoverIndex)}
                y1="0"
                x2={indexToX(hoverIndex)}
                y2={totalSvgHeight - 20}
                stroke="#64748b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {/* Time pill on axis */}
              <rect
                x={indexToX(hoverIndex) - 30}
                y={totalSvgHeight - 18}
                width="60"
                height="16"
                fill="#334155"
                rx="2"
              />
              <text
                x={indexToX(hoverIndex)}
                y={totalSvgHeight - 6}
                fill="#f8fafc"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {formatTime(visibleCandles[hoverIndex].timestamp)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Footer Legend */}
      <div className="bg-slate-950 px-4 py-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-cyan-400 rounded-sm" /> EMA 9
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-amber-400 rounded-sm" /> EMA 21
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-purple-400 rounded-sm" /> Bollinger Bands
          </span>
        </div>
        <span className="hidden sm:inline">Timezone: UTC · Live Ticks: ON</span>
      </div>
    </div>
  );
};
