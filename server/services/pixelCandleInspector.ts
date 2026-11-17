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
  tf3m: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  tf5m: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  tf15m: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  ohlcSummaryBn: string;
}

interface SyntheticOhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  color: 'GREEN' | 'RED' | 'DOJI';
  bodyPct: number;
}

function aggregateBackwardOhlc(pool: PixelCandleBand[], period: number): SyntheticOhlcBar[] {
  const bars: SyntheticOhlcBar[] = [];
  if (pool.length < period) return bars;
  // Build complete N-candle blocks backward from the newest closed candle so latest bar is always complete
  for (let endIdx = pool.length; endIdx - period >= 0; endIdx -= period) {
    const chunk = pool.slice(endIdx - period, endIdx);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    // Convert screen Y (downward positive) to standard price coordinates (upward positive)
    const open = first.color === 'GREEN' ? -first.bodyBottom : -first.bodyTop;
    const close = last.color === 'GREEN' ? -last.bodyTop : -last.bodyBottom;
    let high = -999999;
    let low = 999999;
    for (const c of chunk) {
      if (-c.minY > high) high = -c.minY;
      if (-c.maxY < low) low = -c.maxY;
    }
    const span = Math.max(1, high - low);
    const body = Math.abs(close - open);
    const bodyPct = Math.round((body / span) * 100);
    const color: 'GREEN' | 'RED' | 'DOJI' =
      bodyPct < 15 ? 'DOJI' : close >= open ? 'GREEN' : 'RED';
    bars.unshift({ open, high, low, close, color, bodyPct });
  }
  return bars;
}

function classifySyntheticTf(
  bars: SyntheticOhlcBar[],
  singleBarMinBodyPct: number
): 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' {
  if (bars.length === 0) return 'SIDEWAYS';
  const latest = bars[bars.length - 1];
  if (bars.length === 1) {
    if (latest.color === 'GREEN' && latest.bodyPct >= singleBarMinBodyPct) return 'UPTREND';
    if (latest.color === 'RED' && latest.bodyPct >= singleBarMinBodyPct) return 'DOWNTREND';
    return 'SIDEWAYS';
  }
  const prev = bars[bars.length - 2];
  const recent = bars.slice(-3);
  const greenCount = recent.filter((b) => b.color === 'GREEN').length;
  const redCount = recent.filter((b) => b.color === 'RED').length;

  const hhhl = latest.close > prev.close && latest.low >= prev.low - Math.max(2, (prev.high - prev.low) * 0.15);
  const lhll = latest.close < prev.close && latest.high <= prev.high + Math.max(2, (prev.high - prev.low) * 0.15);

  if (latest.color === 'GREEN' && latest.bodyPct >= 14 && (greenCount >= 2 || hhhl || latest.close > prev.open)) {
    return 'UPTREND';
  }
  if (latest.color === 'RED' && latest.bodyPct >= 14 && (redCount >= 2 || lhll || latest.close < prev.open)) {
    return 'DOWNTREND';
  }
  return 'SIDEWAYS';
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

    // Preserve 1:1 pixel fidelity up to 1440px width so thin 1-2px wicks & infant forming candles aren't blurred out
    const step = srcW > 1440 ? 2 : 1;
    const w = Math.floor(srcW / step);
    const h = Math.floor(srcH / step);
    const isPortrait = h > w;

    const yStart = Math.floor(h * (isPortrait ? 0.14 : 0.05));
    const yEnd = Math.floor(h * (isPortrait ? 0.78 : 0.95));
    const xStart = Math.floor(w * 0.03);
    const xEnd = Math.floor(w * (isPortrait ? 0.84 : 0.88));

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

        const isGreen = g >= 52 && g > r + 12 && g >= b - 4;
        const isRed = r >= 60 && r > g + 16 && r > b + 12;

        if (isGreen) grid[y * w + x] = 1;
        else if (isRed) grid[y * w + x] = 2;
      }
    }

    // Preserve pre-strip raw pixel grid to detect 1-7px infant forming candles in the rightmost slot
    const rawGrid = new Uint8Array(grid);

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
        if (width >= 2 && width <= 65) {
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

          let bodyTop = bMinY;
          let bodyBottom = bMaxY;
          const nonEmptyMins: number[] = [];
          const nonEmptyMaxs: number[] = [];
          for (let bx = bandStart; bx <= endX; bx++) {
            if (colCounts[bx] >= 4) {
              nonEmptyMins.push(colMinY[bx]);
              nonEmptyMaxs.push(colMaxY[bx]);
            }
          }
          if (width >= 5 && nonEmptyMins.length >= 3) {
            nonEmptyMins.sort((a, b) => a - b);
            nonEmptyMaxs.sort((a, b) => a - b);
            bodyTop = nonEmptyMins[Math.floor(nonEmptyMins.length / 2)];
            bodyBottom = nonEmptyMaxs[Math.floor(nonEmptyMaxs.length / 2)];
          } else {
            bodyTop = bMaxY;
            bodyBottom = bMinY;
            const bodyThresh = Math.max(3, Math.round(maxColPx * 0.45));
            for (let bx = bandStart; bx <= endX; bx++) {
              if (colCounts[bx] >= bodyThresh) {
                if (colMinY[bx] < bodyTop) bodyTop = colMinY[bx];
                if (colMaxY[bx] > bodyBottom) bodyBottom = colMaxY[bx];
              }
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

          let bodyPixels = 0;
          for (let py = bodyTop; py <= bodyBottom; py++) {
            for (let px = bandStart; px <= endX; px++) {
              if (grid[py * w + px] > 0) bodyPixels++;
            }
          }
          const bodyFillDensity = bodyPixels / Math.max(1, width * bodyHeight);

          // Reject wide hollow drawing boxes (empty interior) while keeping zoomed-in Hammer/Pin-bar candles with solid bodies
          const isHollowOrPill = width > 18 && fillDensity < 0.28 && bodyFillDensity < 0.48;
          const hasValidMorphology =
            height >= width * 0.45 || width <= 8 || bodyHeight >= 5 || upperWickPx >= 4 || lowerWickPx >= 4;

          if (height >= 7 && !isHollowOrPill && hasValidMorphology) {
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

    // Filter outliers using median candle width (ignoring 1-3px Doji wicks) and pitch gap
    const sampleForPitch = rawBands.slice(-Math.min(12, rawBands.length - 1), -1);
    const bodyWidths = sampleForPitch.filter((b) => b.width >= 4).map((b) => b.width).sort((a, b) => a - b);
    const allWidths = sampleForPitch.map((b) => b.width).sort((a, b) => a - b);
    const medianW =
      (bodyWidths.length > 0 ? bodyWidths[Math.floor(bodyWidths.length / 2)] : allWidths[Math.floor(allWidths.length / 2)]) ||
      8;
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
      const tailDensity = tail.pixelMass / Math.max(1, tail.width * tail.height);
      const isSolidUiPill =
        tail.width > Math.max(medianW * 1.45, 16) &&
        tail.upperWickPx === 0 &&
        tail.lowerWickPx === 0 &&
        tailDensity > 0.78;
      if (
        tailGap > Math.max(medianStep * 1.85, 28) ||
        tail.width > Math.max(medianW * 1.8, 22) ||
        isSolidUiPill
      ) {
        verified.pop();
      } else {
        break;
      }
    }

    if (verified.length < 5) return null;

    // Check if an infant just-opened forming candle (1-7px tick, flat doji, or thin 1px wick) exists ~1 step right of lastBand.
    // Inspect BOTH colCounts AND rawGrid around the expected forming X slot while ignoring continuous horizontal EMA lines.
    const lastBand = verified[verified.length - 1];
    let hasInfantTickToRight = false;
    let infantGreenPx = 0;
    let infantRedPx = 0;
    const tickScanStart = Math.min(xEnd - 1, lastBand.endX + Math.max(2, Math.round(medianStep * 0.4)));
    const tickScanEnd = Math.min(xEnd - 1, lastBand.centerX + Math.round(medianStep * 1.55));
    let tickCols = 0;
    for (let tx = tickScanStart; tx <= tickScanEnd; tx++) {
      let colHasTick = colCounts[tx] >= 2;
      let colG = colGreen[tx];
      let colR = colRed[tx];
      if (!colHasTick) {
        let rawRun = 0;
        let runG = 0;
        let runR = 0;
        let maxRun = 0;
        let runTopY = -1;
        for (let ty = yStart; ty <= yEnd; ty++) {
          const v = ty < yEnd ? rawGrid[ty * w + tx] : 0;
          if (v > 0) {
            if (rawRun === 0) runTopY = ty;
            rawRun++;
            if (v === 1) runG++;
            else runR++;
          } else {
            if (rawRun >= 2) {
              // Ensure it's not part of a continuous horizontal indicator line extending from left of tx
              const midY = runTopY + Math.floor(rawRun / 2);
              const leftX = Math.max(xStart, tx - 3);
              const rightX = Math.min(xEnd - 1, tx + 3);
              const isContinuousLine = rawGrid[midY * w + leftX] > 0 && rawGrid[midY * w + rightX] > 0;
              if (!isContinuousLine) {
                maxRun = Math.max(maxRun, rawRun);
                colG += runG;
                colR += runR;
              }
            }
            rawRun = 0;
            runG = 0;
            runR = 0;
          }
        }
        if (maxRun >= 2) colHasTick = true;
      }
      if (colHasTick) {
        tickCols++;
        infantGreenPx += colG;
        infantRedPx += colR;
      }
    }
    if (tickCols >= 1 && tickCols <= 4 && tickScanEnd > tickScanStart) {
      // Only treat as infant candle if lastBand already looks like a completed candle
      if (lastBand.width >= Math.max(2, Math.round(medianW * 0.65))) {
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
      const totalInfant = infantGreenPx + infantRedPx;
      formingColor =
        totalInfant < 6
          ? 'DOJI'
          : infantGreenPx > infantRedPx * 1.2
          ? 'GREEN'
          : infantRedPx > infantGreenPx * 1.2
          ? 'RED'
          : 'DOJI';
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

    // Mathematical Backward OHLC Aggregation: 1M -> 3M, 5M, and 15M synthetic candles
    const bars3m = aggregateBackwardOhlc(closedPool, 3);
    const bars5m = aggregateBackwardOhlc(closedPool, 5);
    const bars15m =
      closedPool.length >= 15
        ? aggregateBackwardOhlc(closedPool, 15)
        : closedPool.length >= 10
        ? aggregateBackwardOhlc(closedPool, closedPool.length)
        : [];

    const tf3m = classifySyntheticTf(bars3m, 20);
    const tf5m = classifySyntheticTf(bars5m, 22);
    const tf15m = classifySyntheticTf(bars15m, 22);

    const fmtTfBn = (t: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS') =>
      t === 'UPTREND' ? 'আপ' : t === 'DOWNTREND' ? 'ডাউন' : 'রেঞ্জ';
    const ohlcSummaryBn = `১৫M ${fmtTfBn(tf15m)} • ৫M ${fmtTfBn(tf5m)} • ৩M ${fmtTfBn(tf3m)}`;

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
      tf3m,
      tf5m,
      tf15m,
      ohlcSummaryBn,
    };
  } catch {
    return null;
  }
}
