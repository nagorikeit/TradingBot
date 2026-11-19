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
  prevColor: 'GREEN' | 'RED' | 'DOJI' | 'NONE';
  formingColor: 'GREEN' | 'RED' | 'DOJI' | 'NONE';
  bodyPct: number;
  upperWickPct: number;
  lowerWickPct: number;
  closedBodyHeight: number;
  prevBodyHeight: number;
  isBodyDecelerating: boolean;
  isEngulfingBull: boolean;
  isEngulfingBear: boolean;
  isSpinningTop: boolean;
  sameColorStreak: number;
  alternatingFlips: number;
  nearRangeTop: boolean;
  nearRangeBottom: boolean;
  isBreakoutAbovePriorHigh: boolean;
  isBreakdownBelowPriorLow: boolean;
  inUpperSwingHalf: boolean;
  inLowerSwingHalf: boolean;
  microGreenPct: number;
  microRedPct: number;
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
  for (let endIdx = pool.length; endIdx - period >= 0; endIdx -= period) {
    const chunk = pool.slice(endIdx - period, endIdx);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
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
      bodyPct < 16 ? 'DOJI' : close >= open ? 'GREEN' : 'RED';
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

  const prevSpan = Math.max(2, prev.high - prev.low);
  const hhhl = latest.close > prev.close && latest.low >= prev.low - prevSpan * 0.12;
  const lhll = latest.close < prev.close && latest.high <= prev.high + prevSpan * 0.12;

  if (
    latest.color === 'GREEN' &&
    latest.bodyPct >= 18 &&
    ((greenCount >= 2 && latest.close > prev.close) || hhhl)
  ) {
    return 'UPTREND';
  }
  if (
    latest.color === 'RED' &&
    latest.bodyPct >= 18 &&
    ((redCount >= 2 && latest.close < prev.close) || lhll)
  ) {
    return 'DOWNTREND';
  }
  return 'SIDEWAYS';
}

/**
 * Decodes JPEG buffer and performs deterministic right-edge candlestick segmentation
 * with sub-panel separation, dominant-color-pure body detection, strict Y-localized
 * infant forming candle detection, and anti-text-screen protection.
 */
export function inspectChartPixels(imageBase64: string): PixelChartAudit | null {
  try {
    if (!imageBase64 || typeof imageBase64 !== 'string') return null;
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '').trim();
    if (cleanBase64.length < 4000) return null;

    const buf = Buffer.from(cleanBase64, 'base64');
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

    const step = srcW > 1440 ? 2 : 1;
    const w = Math.floor(srcW / step);
    const h = Math.floor(srcH / step);
    const isPortrait = h > w;

    const yStart = Math.floor(h * (isPortrait ? 0.14 : 0.05));
    const yEnd = Math.floor(h * (isPortrait ? 0.74 : 0.94));
    const xStart = Math.floor(w * 0.03);
    const xEnd = Math.floor(w * (isPortrait ? 0.84 : 0.88));

    if (xEnd - xStart < 60 || yEnd - yStart < 60) return null;

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

    const rawGrid = new Uint8Array(grid);

    const colCounts = new Int32Array(w);
    const colGreen = new Int32Array(w);
    const colRed = new Int32Array(w);

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
            }
          } else if (runLen > 0) {
            for (let ry = runStart; ry < runStart + runLen; ry++) {
              grid[ry * w + x] = 0;
            }
          }
          runLen = 0;
        }
      }
    }

    const rawBands: PixelCandleBand[] = [];
    let hasGiantUiButton = false;
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
        if (width > 120) {
          let blobMass = 0;
          for (let bx = bandStart; bx <= endX; bx++) blobMass += colCounts[bx];
          if (isPortrait && blobMass > width * 20) {
            hasGiantUiButton = true;
          }
        }
        if (width >= 2 && width <= 95) {
          let sumGreen = 0;
          let sumRed = 0;
          for (let bx = bandStart; bx <= endX; bx++) {
            sumGreen += colGreen[bx];
            sumRed += colRed[bx];
          }
          const dominantCode = sumGreen >= sumRed ? 1 : 2;
          const mass = sumGreen + sumRed;

          // Isolate largest vertical cluster of dominant color (separates bottom MACD/AO/Volume sub-panels >= 14px away!)
          let clusterStart = yStart;
          let clusterEnd = yEnd - 1;
          let bestClusterMass = -1;
          let curStart = -1;
          let curMass = 0;
          let emptyGap = 0;

          for (let y = yStart; y <= yEnd; y++) {
            let rowHits = 0;
            if (y < yEnd) {
              for (let bx = bandStart; bx <= endX; bx++) {
                if (grid[y * w + bx] === dominantCode) rowHits++;
              }
            }
            if (rowHits > 0) {
              if (curStart === -1) curStart = y;
              curMass += rowHits;
              emptyGap = 0;
            } else if (curStart !== -1) {
              emptyGap++;
              if (emptyGap >= 14 || y === yEnd) {
                const segEnd = y - emptyGap;
                if (curMass > bestClusterMass) {
                  bestClusterMass = curMass;
                  clusterStart = curStart;
                  clusterEnd = segEnd;
                }
                curStart = -1;
                curMass = 0;
                emptyGap = 0;
              }
            }
          }

          if (bestClusterMass < 4) continue;

          let bMinY = 99999;
          let bMaxY = 0;
          let maxColPx = 0;
          const nonEmptyMins: number[] = [];
          const nonEmptyMaxs: number[] = [];

          for (let bx = bandStart; bx <= endX; bx++) {
            let bxCount = 0;
            let bxMin = 99999;
            let bxMax = 0;
            for (let y = clusterStart; y <= clusterEnd; y++) {
              if (grid[y * w + bx] === dominantCode) {
                bxCount++;
                if (y < bMinY) bMinY = y;
                if (y > bMaxY) bMaxY = y;
                if (y < bxMin) bxMin = y;
                if (y > bxMax) bxMax = y;
              }
            }
            if (bxCount > maxColPx) maxColPx = bxCount;
            if (bxCount >= 4) {
              nonEmptyMins.push(bxMin);
              nonEmptyMaxs.push(bxMax);
            }
          }

          if (bMaxY < bMinY) continue;

          const centerX = Math.round((bandStart + endX) / 2);
          let bodyTop = bMinY;
          let bodyBottom = bMaxY;
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
              let bxCount = 0;
              let bxMin = 99999;
              let bxMax = 0;
              for (let y = clusterStart; y <= clusterEnd; y++) {
                if (grid[y * w + bx] === dominantCode) {
                  bxCount++;
                  if (y < bxMin) bxMin = y;
                  if (y > bxMax) bxMax = y;
                }
              }
              if (bxCount >= bodyThresh) {
                if (bxMin < bodyTop) bodyTop = bxMin;
                if (bxMax > bodyBottom) bodyBottom = bxMax;
              }
            }
          }
          if (bodyBottom < bodyTop) {
            bodyTop = bMinY;
            bodyBottom = bMaxY;
          }

          // Recover thin 1-2px anti-aliased vertical wicks from rawGrid of the same dominant color
          let wickTopY = bMinY;
          let wickBottomY = bMaxY;
          for (let dy = 1; dy <= 45; dy++) {
            const checkY = bodyTop - dy;
            if (checkY < yStart || checkY < clusterStart - 45) break;
            let hit = false;
            for (let wx = Math.max(xStart, centerX - 1); wx <= Math.min(xEnd - 1, centerX + 1); wx++) {
              if (grid[checkY * w + wx] === dominantCode) {
                hit = true;
                break;
              }
              if (rawGrid[checkY * w + wx] === dominantCode) {
                const lx = Math.max(xStart, wx - 4);
                const rx = Math.min(xEnd - 1, wx + 4);
                const isContLine = rawGrid[checkY * w + lx] > 0 && rawGrid[checkY * w + rx] > 0;
                if (!isContLine) {
                  hit = true;
                  break;
                }
              }
            }
            if (hit && checkY < wickTopY) wickTopY = checkY;
            else if (!hit && dy > 3 && checkY < bMinY) break;
          }
          for (let dy = 1; dy <= 45; dy++) {
            const checkY = bodyBottom + dy;
            if (checkY >= yEnd || checkY > clusterEnd + 45) break;
            let hit = false;
            for (let wx = Math.max(xStart, centerX - 1); wx <= Math.min(xEnd - 1, centerX + 1); wx++) {
              if (grid[checkY * w + wx] === dominantCode) {
                hit = true;
                break;
              }
              if (rawGrid[checkY * w + wx] === dominantCode) {
                const lx = Math.max(xStart, wx - 4);
                const rx = Math.min(xEnd - 1, wx + 4);
                const isContLine = rawGrid[checkY * w + lx] > 0 && rawGrid[checkY * w + rx] > 0;
                if (!isContLine) {
                  hit = true;
                  break;
                }
              }
            }
            if (hit && checkY > wickBottomY) wickBottomY = checkY;
            else if (!hit && dy > 3 && checkY > bMaxY) break;
          }

          const finalMinY = Math.min(bMinY, wickTopY);
          const finalMaxY = Math.max(bMaxY, wickBottomY);
          const height = Math.max(1, finalMaxY - finalMinY + 1);
          const upperWickPx = Math.max(0, bodyTop - finalMinY);
          const lowerWickPx = Math.max(0, finalMaxY - bodyBottom);
          const bodyHeight = Math.max(2, bodyBottom - bodyTop + 1);
          const fillDensity = bestClusterMass / Math.max(1, width * height);

          let bodyPixels = 0;
          for (let py = bodyTop; py <= bodyBottom; py++) {
            for (let px = bandStart; px <= endX; px++) {
              if (grid[py * w + px] === dominantCode) bodyPixels++;
            }
          }
          const bodyFillDensity = bodyPixels / Math.max(1, width * bodyHeight);

          const isHollowOrPill =
            (width > 12 && fillDensity < 0.16 && (upperWickPx + lowerWickPx) < height * 0.72) ||
            (width > 12 && fillDensity < 0.25 && bodyFillDensity < 0.48);
          const hasValidMorphology =
            height >= width * 0.45 || width <= 8 || bodyHeight >= 5 || upperWickPx >= 4 || lowerWickPx >= 4;

          if (height >= 7 && !isHollowOrPill && hasValidMorphology) {
            rawBands.push({
              startX: bandStart,
              endX,
              centerX,
              width,
              minY: finalMinY,
              maxY: finalMaxY,
              height: Math.max(height, bodyHeight + upperWickPx + lowerWickPx),
              bodyTop,
              bodyBottom,
              bodyHeight,
              upperWickPx,
              lowerWickPx,
              color: dominantCode === 1 ? 'GREEN' : 'RED',
              pixelMass: mass,
            });
          }
        }
      }
    }

    if (hasGiantUiButton || rawBands.length < 5) return null;

    // Reject UI error-log / alert-box screenshots where bands lack real candlestick wicks
    const wickBandsCount = rawBands.filter((b) => b.upperWickPx >= 3 || b.lowerWickPx >= 3).length;
    if (wickBandsCount < Math.max(2, Math.ceil(rawBands.length * 0.28))) {
      return null;
    }

    // Compute median candle body width & horizontal center spacing
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

    // Strip right-edge UI price pills/widgets while preserving genuine zoomed-in rightmost candles
    const verified = [...rawBands];
    while (verified.length >= 5) {
      const tail = verified[verified.length - 1];
      const prev = verified[verified.length - 2];
      const tailGap = tail.centerX - prev.centerX;
      const tailDensity = tail.pixelMass / Math.max(1, tail.width * tail.height);
      const isSolidUiPill =
        tail.width > Math.max(medianW * 1.55, 24) &&
        tail.upperWickPx < 3 &&
        tail.lowerWickPx < 3 &&
        tailDensity > 0.8;
      if (
        tailGap > Math.max(medianStep * 2.0, 34) ||
        tail.width > Math.max(medianW * 2.1, 52) ||
        isSolidUiPill
      ) {
        verified.pop();
      } else {
        break;
      }
    }

    if (verified.length < 5) return null;

    // Require a coherent cluster of >= 4 candles on regular horizontal spacing (blocks scattered UI widgets)
    let contiguousClusterCount = 1;
    let maxContiguousCluster = 1;
    const maxNeighborGap = Math.min(115, Math.max(medianStep * 2.2, 42));
    for (let i = 1; i < verified.length; i++) {
      if (verified[i].centerX - verified[i - 1].centerX <= maxNeighborGap) {
        contiguousClusterCount++;
        if (contiguousClusterCount > maxContiguousCluster) maxContiguousCluster = contiguousClusterCount;
      } else {
        contiguousClusterCount = 1;
      }
    }
    if (maxContiguousCluster < 4) return null;

    // Strict Y-localized infant forming candle detection (ignores distant dots, dashed price lines, or sub-panel bars)
    const lastBand = verified[verified.length - 1];
    let hasInfantTickToRight = false;
    let infantGreenPx = 0;
    let infantRedPx = 0;
    const tickScanStart = Math.min(xEnd - 1, lastBand.endX + Math.max(2, Math.round(medianStep * 0.45)));
    const tickScanEnd = Math.min(xEnd - 1, lastBand.centerX + Math.round(medianStep * 1.55));
    const yTickMin = Math.max(yStart, lastBand.minY - 35);
    const yTickMax = Math.min(yEnd - 1, lastBand.maxY + 35);
    let tickCols = 0;
    let totalTickHeight = 0;

    for (let tx = tickScanStart; tx <= tickScanEnd; tx++) {
      let colHasTick = false;
      let colG = 0;
      let colR = 0;
      let rawRun = 0;
      let runG = 0;
      let runR = 0;
      let maxRun = 0;
      let runTopY = -1;

      for (let ty = yTickMin; ty <= yTickMax + 1; ty++) {
        const v = ty <= yTickMax ? rawGrid[ty * w + tx] : 0;
        if (v > 0) {
          if (rawRun === 0) runTopY = ty;
          rawRun++;
          if (v === 1) runG++;
          else runR++;
        } else {
          if (rawRun >= 2) {
            const midY = runTopY + Math.floor(rawRun / 2);
            let leftHits = 0;
            let rightHits = 0;
            for (let dx = 1; dx <= 5; dx++) {
              if (tx - dx >= xStart && rawGrid[midY * w + (tx - dx)] > 0) leftHits++;
              if (tx + dx < xEnd && rawGrid[midY * w + (tx + dx)] > 0) rightHits++;
            }
            const isHorizontalOrDashedLine = leftHits >= 2 && rightHits >= 2 && rawRun <= 4;
            if (!isHorizontalOrDashedLine) {
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
      if (maxRun >= 2 && maxRun <= Math.max(36, lastBand.height * 1.25)) {
        colHasTick = true;
        totalTickHeight = Math.max(totalTickHeight, maxRun);
      }
      if (colHasTick) {
        tickCols++;
        infantGreenPx += colG;
        infantRedPx += colR;
      }
    }

    if (
      tickCols >= 1 &&
      tickCols <= 4 &&
      tickScanEnd > tickScanStart &&
      totalTickHeight >= 2 &&
      lastBand.width >= Math.max(3, Math.round(medianW * 0.65))
    ) {
      hasInfantTickToRight = true;
    }

    const closedBand = hasInfantTickToRight ? lastBand : verified[verified.length - 2];
    const formingBand = hasInfantTickToRight ? null : lastBand;
    const closedIndex = hasInfantTickToRight ? verified.length - 1 : verified.length - 2;
    const closedPool = verified.slice(0, closedIndex + 1);
    const prevBand = closedIndex >= 1 ? closedPool[closedIndex - 1] : null;

    const totalSpan = Math.max(1, closedBand.bodyHeight + closedBand.upperWickPx + closedBand.lowerWickPx);
    const bodyPct = Math.round((closedBand.bodyHeight / totalSpan) * 100);
    const upperWickPct = Math.round((closedBand.upperWickPx / totalSpan) * 100);
    const lowerWickPct = Math.round((closedBand.lowerWickPx / totalSpan) * 100);

    const isSpinningTop = upperWickPct >= 26 && lowerWickPct >= 26 && bodyPct <= 30;
    const isDoji = isSpinningTop || (bodyPct <= 19 && (upperWickPct >= 20 || lowerWickPct >= 20));
    const closedColor: 'GREEN' | 'RED' | 'DOJI' = isDoji ? 'DOJI' : closedBand.color;

    const prevColor: 'GREEN' | 'RED' | 'DOJI' | 'NONE' = !prevBand
      ? 'NONE'
      : Math.round((prevBand.bodyHeight / Math.max(1, prevBand.height)) * 100) <= 18
      ? 'DOJI'
      : prevBand.color;
    const prevBodyHeight = prevBand ? prevBand.bodyHeight : 0;
    const closedBodyHeight = closedBand.bodyHeight;

    const isBodyDecelerating = Boolean(
      prevBand &&
        prevBand.color === closedBand.color &&
        prevBand.bodyHeight >= 8 &&
        closedBand.bodyHeight < prevBand.bodyHeight * 0.55
    );
    const isEngulfingBull = Boolean(
      prevBand &&
        closedColor === 'GREEN' &&
        prevBand.color === 'RED' &&
        closedBand.bodyHeight >= prevBand.bodyHeight * 1.25 &&
        bodyPct >= 38 &&
        upperWickPct <= 18
    );
    const isEngulfingBear = Boolean(
      prevBand &&
        closedColor === 'RED' &&
        prevBand.color === 'GREEN' &&
        closedBand.bodyHeight >= prevBand.bodyHeight * 1.25 &&
        bodyPct >= 38 &&
        lowerWickPct <= 18
    );

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

    let sameColorStreak = 1;
    for (let i = closedPool.length - 2; i >= 0; i--) {
      if (closedPool[i].color === closedBand.color) {
        sameColorStreak++;
      } else {
        break;
      }
    }

    const recentForChop = closedPool.slice(-6);
    let alternatingFlips = 0;
    for (let i = 1; i < recentForChop.length; i++) {
      if (recentForChop[i].color !== recentForChop[i - 1].color) {
        alternatingFlips++;
      }
    }

    const microSlice = closedPool.slice(-4);
    let mGreen = 0;
    let mRed = 0;
    for (const c of microSlice) {
      if (c.color === 'GREEN') mGreen += c.pixelMass;
      else mRed += c.pixelMass;
    }
    const mTotal = Math.max(1, mGreen + mRed);
    const microGreenPct = Math.round((mGreen / mTotal) * 100);
    const microRedPct = 100 - microGreenPct;

    const lookback = closedPool.slice(-14);
    let rangeMinY = 99999;
    let rangeMaxY = 0;
    for (const c of lookback) {
      if (c.minY < rangeMinY) rangeMinY = c.minY;
      if (c.maxY > rangeMaxY) rangeMaxY = c.maxY;
    }
    const rangeHeight = Math.max(20, rangeMaxY - rangeMinY);
    const closedMidY = (closedBand.bodyTop + closedBand.bodyBottom) * 0.5;
    const inUpperSwingHalf = closedMidY <= rangeMinY + rangeHeight * 0.42;
    const inLowerSwingHalf = closedMidY >= rangeMaxY - rangeHeight * 0.42;

    const priorLookback = closedPool.slice(Math.max(0, closedPool.length - 16), Math.max(0, closedPool.length - 2));
    let nearRangeTop = false;
    let nearRangeBottom = false;
    let isBreakoutAbovePriorHigh = false;
    let isBreakdownBelowPriorLow = false;

    if (priorLookback.length >= 4) {
      let priorMinY = 99999;
      let priorMaxY = 0;
      for (const c of priorLookback) {
        if (c.minY < priorMinY) priorMinY = c.minY;
        if (c.maxY > priorMaxY) priorMaxY = c.maxY;
      }
      const priorSpan = Math.max(20, priorMaxY - priorMinY);
      nearRangeTop =
        closedBand.bodyTop <= priorMinY + priorSpan * 0.16 &&
        closedBand.bodyTop >= priorMinY - priorSpan * 0.18;
      nearRangeBottom =
        closedBand.bodyBottom >= priorMaxY - priorSpan * 0.16 &&
        closedBand.bodyBottom <= priorMaxY + priorSpan * 0.18;

      isBreakoutAbovePriorHigh =
        closedColor === 'GREEN' &&
        closedBand.bodyTop < priorMinY - Math.max(3, priorSpan * 0.03) &&
        upperWickPct <= 14 &&
        bodyPct >= 45;
      isBreakdownBelowPriorLow =
        closedColor === 'RED' &&
        closedBand.bodyBottom > priorMaxY + Math.max(3, priorSpan * 0.03) &&
        lowerWickPct <= 14 &&
        bodyPct >= 45;
    }

    const slopePool = closedPool.slice(-12);
    let slope12: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    if (slopePool.length >= 6) {
      const firstHalf = slopePool.slice(0, Math.floor(slopePool.length / 2));
      const secondHalf = slopePool.slice(Math.floor(slopePool.length / 2));
      const avgMid = (arr: PixelCandleBand[]) =>
        arr.reduce((acc, b) => acc + (b.bodyTop + b.bodyBottom) / 2, 0) / Math.max(1, arr.length);
      const mid1 = avgMid(firstHalf);
      const mid2 = avgMid(secondHalf);
      const diff = mid1 - mid2;
      if (diff > rangeHeight * 0.14) slope12 = 'UP';
      else if (diff < -rangeHeight * 0.14) slope12 = 'DOWN';
    }

    const bars3m = aggregateBackwardOhlc(closedPool, 3);
    const bars5m = aggregateBackwardOhlc(closedPool, 5);
    const bars15m =
      closedPool.length >= 15
        ? aggregateBackwardOhlc(closedPool, 15)
        : closedPool.length >= 10
        ? aggregateBackwardOhlc(closedPool, closedPool.length)
        : [];

    const tf3m = classifySyntheticTf(bars3m, 26);
    const tf5m = classifySyntheticTf(bars5m, 28);
    const tf15m = classifySyntheticTf(bars15m, 28);

    const fmtTfBn = (t: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS') =>
      t === 'UPTREND' ? 'আপ' : t === 'DOWNTREND' ? 'ডাউন' : 'রেঞ্জ';
    const ohlcSummaryBn = `১৫M ${fmtTfBn(tf15m)} • ৫M ${fmtTfBn(tf5m)} • ৩M ${fmtTfBn(tf3m)}`;

    return {
      candleCount: verified.length,
      closedColor,
      prevColor,
      formingColor,
      bodyPct,
      upperWickPct,
      lowerWickPct,
      closedBodyHeight,
      prevBodyHeight,
      isBodyDecelerating,
      isEngulfingBull,
      isEngulfingBear,
      isSpinningTop,
      sameColorStreak,
      alternatingFlips,
      nearRangeTop,
      nearRangeBottom,
      isBreakoutAbovePriorHigh,
      isBreakdownBelowPriorLow,
      inUpperSwingHalf,
      inLowerSwingHalf,
      microGreenPct,
      microRedPct,
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
