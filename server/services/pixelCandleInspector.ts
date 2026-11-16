import jpeg from 'jpeg-js';

export interface PixelCandleBand {
  startX: number;
  endX: number;
  centerX: number;
  width: number;
  minY: number;
  maxY: number;
  height: number;
  bodyTop: number;
  bodyBottom: number;
  bodyHeight: number;
  upperWickPx: number;
  lowerWickPx: number;
  color: 'GREEN' | 'RED';
  pixelMass: number;
}

export interface PixelChartAudit {
  candleCount: number;
  closedColor: 'GREEN' | 'RED' | 'DOJI';
  formingColor: 'GREEN' | 'RED' | 'DOJI' | 'NONE';
  bodyPct: number;
  upperWickPct: number;
  lowerWickPct: number;
  isSpinningTop: boolean;
  sameColorStreak: number;
  alternatingFlips: number;
  nearRangeTop: boolean;
  nearRangeBottom: boolean;
  slope12: 'UP' | 'DOWN' | 'FLAT';
}

/**
 * Decodes JPEG buffer and performs deterministic right-edge candlestick segmentation
 * to cross-check Gemini Vision's closed-candle identification, chop, spinning tops,
 * and consecutive exhaustion streaks. Returns null gracefully for non-JPEG or unclear frames.
 */
export function inspectChartPixels(imageBase64: string): PixelChartAudit | null {
  try {
    if (!imageBase64 || typeof imageBase64 !== 'string') return null;
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
    if (cleanBase64.length < 4000) return null;

    const buf = Buffer.from(cleanBase64, 'base64');
    // Check JPEG magic bytes (FF D8)
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
      return null;
    }

    const decoded = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    if (!decoded || !decoded.data || decoded.width < 180 || decoded.height < 160) {
      return null;
    }

    const srcW = decoded.width;
    const srcH = decoded.height;
    const src = decoded.data;

    // Normalize width up to ~720px for fast, consistent pixel geometry
    const step = srcW > 900 ? 2 : 1;
    const w = Math.floor(srcW / step);
    const h = Math.floor(srcH / step);
    const isPortrait = h > w;

    const yStart = Math.floor(h * (isPortrait ? 0.19 : 0.08));
    const yEnd = Math.floor(h * (isPortrait ? 0.72 : 0.88));
    const xStart = Math.floor(w * 0.05);
    const xEnd = Math.floor(w * (isPortrait ? 0.83 : 0.87));

    if (xEnd - xStart < 60 || yEnd - yStart < 60) return null;

    // Classify green (1) and red (2) chart pixels in ROI
    const grid = new Uint8Array(w * h);
    for (let y = yStart; y < yEnd; y++) {
      const sy = y * step;
      for (let x = xStart; x < xEnd; x++) {
        const sx = x * step;
        const idx = (sy * srcW + sx) * 4;
        const r = src[idx];
        const g = src[idx + 1];
        const b = src[idx + 2];

        const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
        const delta = max - min;
        if (delta < 16 || max < 50) continue;

        const isGreen = g >= 52 && g > r + 10 && g >= b - 14;
        const isRed = r >= 60 && r > g + 16 && r > b + 12;

        if (isGreen) grid[y * w + x] = 1;
        else if (isRed) grid[y * w + x] = 2;
      }
    }

    // Strip thin horizontal indicator lines (EMA/SMA/Bollinger/H-lines) by requiring
    // vertical continuity >= 4px per column so horizontal lines don't bridge gaps between candles.
    const colCounts = new Int32Array(w);
    const colGreen = new Int32Array(w);
    const colRed = new Int32Array(w);
    const colMinY = new Int32Array(w).fill(99999);
    const colMaxY = new Int32Array(w).fill(0);

    for (let x = xStart; x < xEnd; x++) {
      let runLen = 0;
      let runStart = yStart;
      for (let y = yStart; y <= yEnd; y++) {
        const val = y < yEnd ? grid[y * w + x] : 0;
        if (val > 0) {
          if (runLen === 0) runStart = y;
          runLen++;
        } else {
          if (runLen >= 4) {
            for (let ry = runStart; ry < runStart + runLen; ry++) {
              const rv = grid[ry * w + x];
              colCounts[x]++;
              if (rv === 1) colGreen[x]++;
              else if (rv === 2) colRed[x]++;
              if (ry < colMinY[x]) colMinY[x] = ry;
              if (ry > colMaxY[x]) colMaxY[x] = ry;
            }
          } else if (runLen > 0) {
            // Erase isolated 1-3px horizontal line pixel runs from grid
            for (let ry = runStart; ry < runStart + runLen; ry++) {
              grid[ry * w + x] = 0;
            }
          }
          runLen = 0;
        }
      }
    }

    // Segment into candidate candlestick bands
    const rawBands: PixelCandleBand[] = [];
    let inBand = false;
    let bandStart = 0;

    for (let x = xStart; x <= xEnd; x++) {
      const hasVerticalSegment = x < xEnd && colCounts[x] >= 4;
      if (hasVerticalSegment) {
        if (!inBand) {
          inBand = true;
          bandStart = x;
        }
      } else if (inBand) {
        inBand = false;
        const endX = x - 1;
        const width = endX - bandStart + 1;
        if (width >= 2 && width <= 60) {
          let bMinY = 99999;
          let bMaxY = 0;
          let maxColPx = 0;
          let sumGreen = 0;
          let sumRed = 0;

          for (let bx = bandStart; bx <= endX; bx++) {
            sumGreen += colGreen[bx];
            sumRed += colRed[bx];
            if (colCounts[bx] > maxColPx) maxColPx = colCounts[bx];
            if (colMinY[bx] < bMinY) bMinY = colMinY[bx];
            if (colMaxY[bx] > bMaxY) bMaxY = colMaxY[bx];
          }

          const height = bMaxY - bMinY + 1;
          const mass = sumGreen + sumRed;
          const fillDensity = mass / Math.max(1, width * height);

          // Reject wide hollow boxes / flat price pills
          const isHollowOrPill = width > 20 && fillDensity < 0.28;
          if (height >= 8 && !isHollowOrPill && (height >= width * 0.85 || width <= 8)) {
            let bodyTop = bMaxY;
            let bodyBottom = bMinY;
            const bodyThresh = Math.max(3, Math.round(maxColPx * 0.45));

            for (let bx = bandStart; bx <= endX; bx++) {
              if (colCounts[bx] >= bodyThresh) {
                if (colMinY[bx] < bodyTop) bodyTop = colMinY[bx];
                if (colMaxY[bx] > bodyBottom) bodyBottom = colMaxY[bx];
              }
            }
            if (bodyBottom < bodyTop) {
              bodyTop = bMinY;
              bodyBottom = bMaxY;
            }

            const centerX = Math.round((bandStart + endX) / 2);
            const upperWickPx = Math.max(0, bodyTop - bMinY);
            const lowerWickPx = Math.max(0, bMaxY - bodyBottom);
            const bodyHeight = Math.max(2, bodyBottom - bodyTop + 1);

            rawBands.push({
              startX: bandStart,
              endX,
              centerX,
              width,
              minY: bMinY,
              maxY: bMaxY,
              height: Math.max(height, bodyHeight + upperWickPx + lowerWickPx),
              bodyTop,
              bodyBottom,
              bodyHeight,
              upperWickPx,
              lowerWickPx,
              color: sumGreen >= sumRed ? 'GREEN' : 'RED',
              pixelMass: mass,
            });
          }
        }
      }
    }

    if (rawBands.length < 5) return null;

    // Filter outliers using median candle width and pitch gap (strips right-edge Y-axis badges)
    const sampleForPitch = rawBands.slice(-Math.min(10, rawBands.length - 1), -1);
    const widths = sampleForPitch.map((b) => b.width).sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length / 2)] || 8;
    const gaps: number[] = [];
    for (let i = 1; i < sampleForPitch.length; i++) {
      gaps.push(sampleForPitch[i].centerX - sampleForPitch[i - 1].centerX);
    }
    gaps.sort((a, b) => a - b);
    const medianStep = gaps.length > 0 ? Math.max(4, gaps[Math.floor(gaps.length / 2)]) : Math.max(6, medianW * 1.4);

    let verified = [...rawBands];
    while (verified.length >= 5) {
      const tail = verified[verified.length - 1];
      const prev = verified[verified.length - 2];
      const tailGap = tail.centerX - prev.centerX;
      if (tailGap > Math.max(medianStep * 2.25, 32) || tail.width > Math.max(medianW * 2.3, 28)) {
        verified.pop();
      } else {
        break;
      }
    }

    if (verified.length < 5) return null;

    // Check if an infant just-opened forming candle (thin 1-3px tick) exists ~1 step right of the last verified band
    const lastBand = verified[verified.length - 1];
    let hasInfantTickToRight = false;
    const tickScanStart = Math.min(xEnd - 1, lastBand.endX + Math.max(2, Math.round(medianStep * 0.45)));
    const tickScanEnd = Math.min(xEnd - 1, lastBand.centerX + Math.round(medianStep * 1.55));
    let tickCols = 0;
    for (let tx = tickScanStart; tx <= tickScanEnd; tx++) {
      if (colCounts[tx] >= 2) tickCols++;
    }
    if (tickCols >= 1 && tickCols <= 2 && tickScanEnd > tickScanStart) {
      // Only treat as infant candle if lastBand already looks like a full-width completed candle
      if (lastBand.width >= Math.max(3, Math.round(medianW * 0.75))) {
        hasInfantTickToRight = true;
      }
    }

    const closedBand = hasInfantTickToRight ? lastBand : verified[verified.length - 2];
    const formingBand = hasInfantTickToRight ? null : lastBand;
    const closedIndex = hasInfantTickToRight ? verified.length - 1 : verified.length - 2;
    const closedPool = verified.slice(0, closedIndex + 1);

    const totalSpan = Math.max(1, closedBand.bodyHeight + closedBand.upperWickPx + closedBand.lowerWickPx);
    const bodyPct = Math.round((closedBand.bodyHeight / totalSpan) * 100);
    const upperWickPct = Math.round((closedBand.upperWickPx / totalSpan) * 100);
    const lowerWickPct = Math.round((closedBand.lowerWickPx / totalSpan) * 100);

    const isDoji = bodyPct <= 18 && (upperWickPct >= 22 || lowerWickPct >= 22);
    const isSpinningTop = upperWickPct >= 30 && lowerWickPct >= 30 && bodyPct <= 26;

    const closedColor: 'GREEN' | 'RED' | 'DOJI' = isDoji ? 'DOJI' : closedBand.color;

    let formingColor: 'GREEN' | 'RED' | 'DOJI' | 'NONE' = 'NONE';
    if (hasInfantTickToRight) {
      formingColor = 'DOJI';
    } else if (formingBand) {
      const fSpan = Math.max(1, formingBand.bodyHeight + formingBand.upperWickPx + formingBand.lowerWickPx);
      const fBodyPct = (formingBand.bodyHeight / fSpan) * 100;
      formingColor = fBodyPct <= 18 ? 'DOJI' : formingBand.color;
    }

    // Same-color streak ending at closed candle
    let sameColorStreak = 1;
    for (let i = closedPool.length - 2; i >= 0; i--) {
      if (closedPool[i].color === closedBand.color) {
        sameColorStreak++;
      } else {
        break;
      }
    }

    // Alternating color flips across last 6 closed candles (detects choppy ranging)
    const recentForChop = closedPool.slice(-6);
    let alternatingFlips = 0;
    for (let i = 1; i < recentForChop.length; i++) {
      if (recentForChop[i].color !== recentForChop[i - 1].color) {
        alternatingFlips++;
      }
    }

    // Prior-swing S/R wall check (strictly excludes last 2 candles so active trend highs/lows aren't flagged as walls!)
    const lookback = closedPool.slice(-16);
    let rangeMinY = 99999;
    let rangeMaxY = 0;
    for (const c of lookback) {
      if (c.minY < rangeMinY) rangeMinY = c.minY;
      if (c.maxY > rangeMaxY) rangeMaxY = c.maxY;
    }
    const rangeHeight = Math.max(20, rangeMaxY - rangeMinY);

    const priorLookback = closedPool.slice(Math.max(0, closedPool.length - 16), Math.max(0, closedPool.length - 2));
    let nearRangeTop = false;
    let nearRangeBottom = false;
    if (priorLookback.length >= 4) {
      let priorMinY = 99999;
      let priorMaxY = 0;
      for (const c of priorLookback) {
        if (c.minY < priorMinY) priorMinY = c.minY;
        if (c.maxY > priorMaxY) priorMaxY = c.maxY;
      }
      const priorSpan = Math.max(20, priorMaxY - priorMinY);
      // True overhead resistance wall: closed body stopped inside old resistance band without clean breakout above it
      nearRangeTop =
        closedBand.bodyTop <= priorMinY + priorSpan * 0.14 &&
        closedBand.bodyTop >= priorMinY - priorSpan * 0.06;
      // True floor support wall: closed body stopped inside old support band without clean breakdown below it
      nearRangeBottom =
        closedBand.bodyBottom >= priorMaxY - priorSpan * 0.14 &&
        closedBand.bodyBottom <= priorMaxY + priorSpan * 0.06;
    }

    // 12-candle midpoint slope
    const slopePool = closedPool.slice(-12);
    let slope12: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    if (slopePool.length >= 6) {
      const firstHalf = slopePool.slice(0, Math.floor(slopePool.length / 2));
      const secondHalf = slopePool.slice(Math.floor(slopePool.length / 2));
      const avgMid = (arr: PixelCandleBand[]) =>
        arr.reduce((acc, b) => acc + (b.bodyTop + b.bodyBottom) / 2, 0) / Math.max(1, arr.length);
      const mid1 = avgMid(firstHalf);
      const mid2 = avgMid(secondHalf);
      const diff = mid1 - mid2; // positive means price moved UP (lower Y)
      if (diff > rangeHeight * 0.12) slope12 = 'UP';
      else if (diff < -rangeHeight * 0.12) slope12 = 'DOWN';
    }

    return {
      candleCount: verified.length,
      closedColor,
      formingColor,
      bodyPct,
      upperWickPct,
      lowerWickPct,
      isSpinningTop,
      sameColorStreak,
      alternatingFlips,
      nearRangeTop,
      nearRangeBottom,
      slope12,
    };
  } catch {
    return null;
  }
}
