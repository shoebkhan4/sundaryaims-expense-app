/**
 * Document Scanner Engine
 * -----------------------
 * Pure TypeScript / Canvas implementation of the pipeline used by dedicated
 * scanner apps (CamScanner, Office Lens, iOS Notes):
 *
 *   1. Downscale + grayscale + blur              (fast working copy)
 *   2. Sobel gradient magnitude                  (edge energy)
 *   3. Two independent page-boundary detectors:
 *        a. largest bright/dark connected region -> convex hull -> max-area quad
 *        b. Hough line transform -> 2 opposing line pairs -> intersections
 *   4. Score candidates by edge support + area, keep the best
 *   5. Perspective warp (homography, bilinear sampled) -> flat rectangle
 *   6. Shadow removal + adaptive enhancement     (color / gray / B&W)
 *
 * No OpenCV.js dependency (it would add ~8 MB to a mobile-first bundle).
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners ordered clockwise starting top-left. */
export type Quad = [Point, Point, Point, Point];

export type EnhanceMode = 'original' | 'color' | 'gray' | 'bw';

/** Width the frame is reduced to before analysis, keeps live detection ~10fps. */
const DETECT_WIDTH = 360;

/** Longest edge of the produced document image. */
const MAX_OUTPUT_DIM = 1700;

/* ------------------------------------------------------------------ *
 * Low level image helpers
 * ------------------------------------------------------------------ */

interface GrayImage {
  gray: Uint8Array;
  w: number;
  h: number;
  /** detectionSize = originalSize * scale */
  scale: number;
}

/** Box-filter downscale of an ImageData into a single channel luma buffer. */
function downscaleToGray(src: ImageData, targetW: number): GrayImage {
  const scale = Math.min(1, targetW / src.width);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const gray = new Uint8Array(w * h);
  const data = src.data;

  const xStep = src.width / w;
  const yStep = src.height / h;

  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y * yStep);
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * yStep));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * xStep);
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * xStep));
      let sum = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        let idx = (sy * src.width + sx0) * 4;
        for (let sx = sx0; sx < sx1; sx++) {
          sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          idx += 4;
          n++;
        }
      }
      gray[y * w + x] = n > 0 ? sum / n : 0;
    }
  }

  return { gray, w, h, scale };
}

interface RgbImage {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  w: number;
  h: number;
  scale: number;
}

/** Box-filter downscale keeping colour, which luminance-only detection loses. */
function downscaleToRgb(src: ImageData, targetW: number): RgbImage {
  const scale = Math.min(1, targetW / src.width);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const r = new Uint8Array(w * h);
  const g = new Uint8Array(w * h);
  const b = new Uint8Array(w * h);
  const data = src.data;

  const xStep = src.width / w;
  const yStep = src.height / h;

  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y * yStep);
    const sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * yStep));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * xStep);
      const sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * xStep));
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        let idx = (sy * src.width + sx0) * 4;
        for (let sx = sx0; sx < sx1; sx++) {
          sr += data[idx];
          sg += data[idx + 1];
          sb += data[idx + 2];
          idx += 4;
          n++;
        }
      }
      const i = y * w + x;
      r[i] = n ? sr / n : 0;
      g[i] = n ? sg / n : 0;
      b[i] = n ? sb / n : 0;
    }
  }
  return { r, g, b, w, h, scale };
}

/**
 * How far each pixel's colour is from the surface the document lies on,
 * measured as chromaticity so it does not move with the light.
 *
 * A white receipt on a cream worktop can match the table in brightness — under
 * a light falloff the shaded end of the paper is no brighter than the lit end
 * of the table — and luminance-only detection then finds nothing. The hue
 * difference survives, because dividing by (R+G+B) cancels the illumination.
 */
function chromaDistanceFromSurface(rgb: RgbImage): Uint8Array {
  const { r, g, b, w, h } = rgb;
  const n = w * h;

  const chromaR = new Float32Array(n);
  const chromaG = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sum = r[i] + g[i] + b[i] || 1;
    chromaR[i] = r[i] / sum;
    chromaG[i] = g[i] / sum;
  }

  // The frame border is the surface: documents are framed, not bled off the edge.
  const ringR: number[] = [];
  const ringG: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
  const sample = (i: number) => { ringR.push(chromaR[i]); ringG.push(chromaG[i]); };
  for (let x = 0; x < w; x += step) { sample(x); sample((h - 1) * w + x); }
  for (let y = 0; y < h; y += step) { sample(y * w); sample(y * w + w - 1); }
  if (ringR.length < 8) return new Uint8Array(n);

  const median = (values: number[]) => {
    const sorted = values.slice().sort((p, q) => p - q);
    return sorted[sorted.length >> 1];
  };
  const surfaceR = median(ringR);
  const surfaceG = median(ringG);

  // 0.08 of chromaticity is a strong colour difference; scale that to full range.
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(chromaR[i] - surfaceR, chromaG[i] - surfaceG);
    out[i] = Math.min(255, Math.round((d / 0.08) * 255));
  }
  return out;
}

/** Segments the document by colour difference from the surface around it. */
function quadFromChromaContrast(distance: Uint8Array, w: number, h: number): Quad | null {
  const t = Math.max(18, otsuThreshold(distance));
  const mask = new Uint8Array(w * h);
  let foreground = 0;
  for (let i = 0; i < mask.length; i++) {
    if (distance[i] > t) {
      mask[i] = 1;
      foreground++;
    }
  }
  // Everything or nothing differs: the split carries no information.
  if (foreground < w * h * 0.08 || foreground > w * h * 0.9) return null;
  return quadFromMask(mask, w, h);
}

/** Summed-area table for O(1) rectangular means. */
function integralImage(src: Uint8Array | Float32Array, w: number, h: number): Float64Array {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      ii[(y + 1) * (w + 1) + (x + 1)] = ii[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  return ii;
}

function boxMean(ii: Float64Array, w: number, h: number, cx: number, cy: number, r: number): number {
  const x0 = Math.max(0, cx - r);
  const y0 = Math.max(0, cy - r);
  const x1 = Math.min(w - 1, cx + r);
  const y1 = Math.min(h - 1, cy + r);
  const stride = w + 1;
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  const sum =
    ii[(y1 + 1) * stride + (x1 + 1)] -
    ii[y0 * stride + (x1 + 1)] -
    ii[(y1 + 1) * stride + x0] +
    ii[y0 * stride + x0];
  return sum / area;
}

/** Fast box blur through a summed-area table. */
function boxBlurGray(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (radius < 1) return src;
  const ii = integralImage(src, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[y * w + x] = boxMean(ii, w, h, x, y, radius);
    }
  }
  return out;
}

/** Sobel gradient magnitude, normalised to 0..255. */
function sobelMagnitude(gray: Uint8Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1], t = gray[i - w], tr = gray[i - w + 1];
      const l = gray[i - 1], r = gray[i + 1];
      const bl = gray[i + w - 1], b = gray[i + w], br = gray[i + w + 1];

      const gx = tr + 2 * r + br - tl - 2 * l - bl;
      const gy = bl + 2 * b + br - tl - 2 * t - tr;
      mag[i] = Math.min(255, Math.hypot(gx, gy) / 4);
    }
  }
  return mag;
}

/** Intensity value above which only `1 - p` of the pixels remain. */
function percentileThreshold(values: Float32Array, p: number): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) hist[values[i] | 0]++;
  const target = values.length * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

/** Otsu's automatic threshold over a luma buffer. */
function otsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];

  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;

  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = v;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y);
  }
  return Math.abs(a / 2);
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Andrew's monotone chain convex hull (counter-clockwise). */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((p, q) => (p.x === q.x ? p.y - q.y : p.x - q.x));

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Visvalingam-style reduction: repeatedly drop the vertex whose removal
 * changes the polygon area the least. Keeps true corners, unlike uniform
 * subsampling.
 */
function reducePolygon(poly: Point[], maxPoints: number): Point[] {
  const pts = poly.slice();
  while (pts.length > maxPoints) {
    let bestIdx = 0;
    let bestArea = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const area = Math.abs(cross(prev, pts[i], next)) / 2;
      if (area < bestArea) {
        bestArea = area;
        bestIdx = i;
      }
    }
    pts.splice(bestIdx, 1);
  }
  return pts;
}

/**
 * Largest-area quadrilateral inscribed in a convex polygon.
 * Fixes each diagonal (i,k) then picks the best vertex on either side.
 */
function maxAreaQuad(hull: Point[]): Quad | null {
  const n = hull.length;
  if (n < 4) return null;

  let best: Quad | null = null;
  let bestArea = 0;

  for (let i = 0; i < n; i++) {
    for (let k = i + 2; k < n; k++) {
      let jBest = -1;
      let jArea = 0;
      for (let j = i + 1; j < k; j++) {
        const a = Math.abs(cross(hull[i], hull[j], hull[k])) / 2;
        if (a > jArea) {
          jArea = a;
          jBest = j;
        }
      }
      let lBest = -1;
      let lArea = 0;
      for (let l = k + 1; l < n + i; l++) {
        const a = Math.abs(cross(hull[k], hull[l % n], hull[i])) / 2;
        if (a > lArea) {
          lArea = a;
          lBest = l % n;
        }
      }
      if (jBest < 0 || lBest < 0) continue;
      const area = jArea + lArea;
      if (area > bestArea) {
        bestArea = area;
        best = [hull[i], hull[jBest], hull[k], hull[lBest]];
      }
    }
  }
  return best;
}

/** Reorders four corners clockwise beginning at the top-left one. */
export function orderCorners(pts: Point[]): Quad {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  const sorted = pts
    .slice()
    .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  // Rotate so the corner closest to the origin comes first.
  let startIdx = 0;
  let bestScore = Infinity;
  for (let i = 0; i < 4; i++) {
    const score = sorted[i].x + sorted[i].y;
    if (score < bestScore) {
      bestScore = score;
      startIdx = i;
    }
  }
  return [
    sorted[startIdx],
    sorted[(startIdx + 1) % 4],
    sorted[(startIdx + 2) % 4],
    sorted[(startIdx + 3) % 4]
  ];
}

/** Rejects self-intersecting, sliver, tiny or extremely skewed quads. */
function isPlausibleQuad(quad: Quad, w: number, h: number): boolean {
  const frameArea = w * h;
  const area = polygonArea(quad);
  if (area < frameArea * 0.10 || area > frameArea * 1.05) return false;

  const minEdge = Math.min(w, h) * 0.12;
  for (let i = 0; i < 4; i++) {
    if (dist(quad[i], quad[(i + 1) % 4]) < minEdge) return false;
  }

  // Convexity: all cross products share a sign.
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const c = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]);
    const s = Math.sign(c);
    if (s === 0) return false;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }

  // Corner angles must stay within a realistic perspective range.
  for (let i = 0; i < 4; i++) {
    const prev = quad[(i + 3) % 4];
    const cur = quad[i];
    const next = quad[(i + 1) % 4];
    const a1 = Math.atan2(prev.y - cur.y, prev.x - cur.x);
    const a2 = Math.atan2(next.y - cur.y, next.x - cur.x);
    let deg = Math.abs(((a1 - a2) * 180) / Math.PI);
    if (deg > 180) deg = 360 - deg;
    if (deg < 50 || deg > 130) return false;
  }
  return true;
}

/**
 * Fraction of the quad outline that sits on strong image gradients.
 * This is what separates a genuine page border from an arbitrary rectangle.
 */
function edgeSupport(quad: Quad, mag: Float32Array, threshold: number, w: number, h: number): number {
  let hits = 0;
  let samples = 0;

  for (let e = 0; e < 4; e++) {
    const a = quad[e];
    const b = quad[(e + 1) % 4];
    const len = dist(a, b);
    const steps = Math.max(8, Math.round(len / 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = Math.round(a.x + (b.x - a.x) * t);
      const py = Math.round(a.y + (b.y - a.y) * t);
      samples++;
      // Tolerate a couple of pixels of localisation error.
      let found = false;
      for (let dy = -2; dy <= 2 && !found; dy++) {
        for (let dx = -2; dx <= 2 && !found; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (mag[y * w + x] >= threshold) found = true;
        }
      }
      if (found) hits++;
    }
  }
  return samples > 0 ? hits / samples : 0;
}

/* ------------------------------------------------------------------ *
 * Detector A — largest uniform region
 * ------------------------------------------------------------------ */

function quadFromRegion(gray: Uint8Array, w: number, h: number, bright: boolean): Quad | null {
  const t = otsuThreshold(gray);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = (bright ? gray[i] > t : gray[i] <= t) ? 1 : 0;
  }
  return quadFromMask(mask, w, h);
}

/** Largest connected blob of `mask` -> convex hull -> largest inscribed quad. */
function quadFromMask(mask: Uint8Array, w: number, h: number): Quad | null {
  // Flood fill to find the biggest blob (iterative, typed stack).
  const labels = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let bestLabel = -1;
  let bestSize = 0;
  let label = 0;

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 0 || labels[start] !== -1) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    let size = 0;

    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const px = p % w;
      const py = (p / w) | 0;

      if (px > 0 && mask[p - 1] && labels[p - 1] === -1) { labels[p - 1] = label; stack[sp++] = p - 1; }
      if (px < w - 1 && mask[p + 1] && labels[p + 1] === -1) { labels[p + 1] = label; stack[sp++] = p + 1; }
      if (py > 0 && mask[p - w] && labels[p - w] === -1) { labels[p - w] = label; stack[sp++] = p - w; }
      if (py < h - 1 && mask[p + w] && labels[p + w] === -1) { labels[p + w] = label; stack[sp++] = p + w; }
    }

    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
    label++;
  }

  if (bestLabel < 0 || bestSize < w * h * 0.10) return null;

  // Outline = region pixels touching a non-region 4-neighbour or the frame.
  const border: Point[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (labels[i] !== bestLabel) continue;
      const isEdge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        labels[i - 1] !== bestLabel || labels[i + 1] !== bestLabel ||
        labels[i - w] !== bestLabel || labels[i + w] !== bestLabel;
      if (isEdge) border.push({ x, y });
    }
  }
  if (border.length < 8) return null;

  const hull = reducePolygon(convexHull(border), 40);
  const quad = maxAreaQuad(hull);
  return quad ? orderCorners(quad) : null;
}

/* ------------------------------------------------------------------ *
 * Detector B — Hough lines
 * ------------------------------------------------------------------ */

interface HoughLine {
  rho: number;
  theta: number;
  votes: number;
}

function houghLines(mag: Float32Array, w: number, h: number, threshold: number): HoughLine[] {
  const thetaSteps = 180;
  const diag = Math.ceil(Math.hypot(w, h));
  const rhoOffset = diag;
  const rhoSize = diag * 2 + 1;
  const acc = new Float32Array(thetaSteps * rhoSize);

  const cosT = new Float32Array(thetaSteps);
  const sinT = new Float32Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t++) {
    const a = (t * Math.PI) / thetaSteps;
    cosT[t] = Math.cos(a);
    sinT[t] = Math.sin(a);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = mag[y * w + x];
      if (m < threshold) continue;
      const weight = m / 255;
      for (let t = 0; t < thetaSteps; t++) {
        const rho = Math.round(x * cosT[t] + y * sinT[t]) + rhoOffset;
        acc[t * rhoSize + rho] += weight;
      }
    }
  }

  // Peak picking with non-maximum suppression.
  let peak = 0;
  for (let i = 0; i < acc.length; i++) if (acc[i] > peak) peak = acc[i];
  if (peak <= 0) return [];

  const minVotes = Math.max(peak * 0.25, Math.min(w, h) * 0.15);
  const candidates: HoughLine[] = [];
  for (let t = 0; t < thetaSteps; t++) {
    for (let r = 1; r < rhoSize - 1; r++) {
      const v = acc[t * rhoSize + r];
      if (v < minVotes) continue;
      if (v < acc[t * rhoSize + r - 1] || v < acc[t * rhoSize + r + 1]) continue;
      candidates.push({ rho: r - rhoOffset, theta: (t * Math.PI) / thetaSteps, votes: v });
    }
  }

  candidates.sort((a, b) => b.votes - a.votes);

  const kept: HoughLine[] = [];
  for (const c of candidates) {
    let suppressed = false;
    for (const k of kept) {
      let dTheta = Math.abs(c.theta - k.theta);
      if (dTheta > Math.PI / 2) dTheta = Math.PI - dTheta;
      if (dTheta < 0.18 && Math.abs(c.rho - k.rho) < Math.min(w, h) * 0.12) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(c);
    if (kept.length >= 16) break;
  }
  return kept;
}

function lineIntersection(a: HoughLine, b: HoughLine): Point | null {
  const ca = Math.cos(a.theta), sa = Math.sin(a.theta);
  const cb = Math.cos(b.theta), sb = Math.sin(b.theta);
  const det = ca * sb - sa * cb;
  if (Math.abs(det) < 1e-6) return null;
  return {
    x: (a.rho * sb - b.rho * sa) / det,
    y: (b.rho * ca - a.rho * cb) / det
  };
}

function quadsFromHough(mag: Float32Array, w: number, h: number, threshold: number): Quad[] {
  const lines = houghLines(mag, w, h, threshold);
  if (lines.length < 4) return [];

  // Split into two roughly perpendicular orientation families.
  const groupA: HoughLine[] = [lines[0]];
  const groupB: HoughLine[] = [];
  for (let i = 1; i < lines.length; i++) {
    let d = Math.abs(lines[i].theta - lines[0].theta);
    if (d > Math.PI / 2) d = Math.PI - d;
    if (d < Math.PI / 5) groupA.push(lines[i]);
    else groupB.push(lines[i]);
  }
  if (groupA.length < 2 || groupB.length < 2) return [];

  const limit = 7;
  const a = groupA.slice(0, limit);
  const b = groupB.slice(0, limit);

  const out: Quad[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      for (let k = 0; k < b.length; k++) {
        for (let l = k + 1; l < b.length; l++) {
          const corners = [
            lineIntersection(a[i], b[k]),
            lineIntersection(a[i], b[l]),
            lineIntersection(a[j], b[l]),
            lineIntersection(a[j], b[k])
          ];
          if (corners.some((c) => c === null)) continue;
          const pts = corners as Point[];
          // Allow a small overshoot outside the frame, reject wild ones.
          const margin = Math.min(w, h) * 0.2;
          if (pts.some((p) => p.x < -margin || p.y < -margin || p.x > w + margin || p.y > h + margin)) continue;
          out.push(orderCorners(pts));
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Public detection API
 * ------------------------------------------------------------------ */

export interface DetectionResult {
  quad: Quad;
  /** 0..1 — how convincingly the outline matches real image edges. */
  score: number;
}

/**
 * Locates the page/receipt boundary inside a frame.
 * Coordinates are returned in the ImageData's own pixel space.
 */
export function detectDocumentQuad(src: ImageData): DetectionResult | null {
  const { gray, w, h, scale } = downscaleToGray(src, DETECT_WIDTH);
  if (w < 32 || h < 32) return null;

  const blurred = boxBlurGray(gray, w, h, 2);
  const mag = sobelMagnitude(blurred, w, h);

  /** Scores a set of candidates against a gradient field, keeping the best. */
  const pickBest = (candidates: Quad[], field: Float32Array, threshold: number) => {
    let best: Quad | null = null;
    let bestScore = 0;

    for (const quad of candidates) {
      const clamped = quad.map((p) => ({
        x: Math.min(w - 1, Math.max(0, p.x)),
        y: Math.min(h - 1, Math.max(0, p.y))
      })) as Quad;

      if (!isPlausibleQuad(clamped, w, h)) continue;

      const support = edgeSupport(clamped, field, threshold, w, h);
      // Prefer larger pages when edge support is comparable.
      const areaRatio = polygonArea(clamped) / (w * h);
      const score = support * (0.75 + 0.25 * Math.min(1, areaRatio / 0.6));

      if (score > bestScore) {
        bestScore = score;
        best = clamped;
      }
    }
    return { best, bestScore };
  };

  const lumaThreshold = Math.max(18, percentileThreshold(mag, 0.9));
  const lumaCandidates: Quad[] = [];
  const bright = quadFromRegion(blurred, w, h, true);
  if (bright) lumaCandidates.push(bright);
  const dark = quadFromRegion(blurred, w, h, false);
  if (dark) lumaCandidates.push(dark);
  lumaCandidates.push(...quadsFromHough(mag, w, h, lumaThreshold));

  let { best, bestScore } = pickBest(lumaCandidates, mag, lumaThreshold);

  // Brightness alone was enough; skip the colour pass, which costs about as
  // much again and only matters when the page and the surface are equally lit.
  const CONFIDENT_WITHOUT_COLOUR = 0.75;
  if (!best || bestScore < CONFIDENT_WITHOUT_COLOUR) {
    const rgb = downscaleToRgb(src, DETECT_WIDTH);
    const chroma = boxBlurGray(chromaDistanceFromSurface(rgb), w, h, 2);
    const chromaMag = sobelMagnitude(chroma, w, h);

    // An edge is an edge whether it shows in brightness or only in colour.
    const combinedMag = new Float32Array(w * h);
    for (let i = 0; i < combinedMag.length; i++) {
      combinedMag[i] = Math.max(mag[i], chromaMag[i]);
    }
    const combinedThreshold = Math.max(18, percentileThreshold(combinedMag, 0.9));

    const colourCandidates = [...lumaCandidates];
    const coloured = quadFromChromaContrast(chroma, w, h);
    if (coloured) colourCandidates.push(coloured);
    colourCandidates.push(...quadsFromHough(combinedMag, w, h, combinedThreshold));

    const withColour = pickBest(colourCandidates, combinedMag, combinedThreshold);
    if (withColour.best && withColour.bestScore > bestScore) {
      best = withColour.best;
      bestScore = withColour.bestScore;
    }
  }

  if (!best || bestScore < 0.55) return null;

  const inv = 1 / scale;
  return {
    quad: best.map((p) => ({ x: p.x * inv, y: p.y * inv })) as Quad,
    score: bestScore
  };
}

/**
 * How sharp the document area is, as the standard deviation of its Laplacian.
 *
 * The auto-shutter otherwise fires on any steady outline, and a phone held
 * still while it is still hunting focus is perfectly steady — it just produces
 * an unreadable frame. Blur collapses this figure by more than an order of
 * magnitude, so it separates "focused" from "focusing" cleanly.
 */
export function estimateFocus(src: ImageData, quad?: Quad | null): number {
  const { gray, w, h, scale } = downscaleToGray(src, 320);
  if (w < 16 || h < 16) return 0;

  // Measure inside the page, away from the high-contrast paper edge.
  let x0 = 0;
  let y0 = 0;
  let x1 = w - 1;
  let y1 = h - 1;

  if (quad) {
    const xs = quad.map((p) => p.x * scale);
    const ys = quad.map((p) => p.y * scale);
    const insetX = (Math.max(...xs) - Math.min(...xs)) * 0.12;
    const insetY = (Math.max(...ys) - Math.min(...ys)) * 0.12;
    x0 = Math.max(0, Math.round(Math.min(...xs) + insetX));
    x1 = Math.min(w - 1, Math.round(Math.max(...xs) - insetX));
    y0 = Math.max(0, Math.round(Math.min(...ys) + insetY));
    y1 = Math.min(h - 1, Math.round(Math.max(...ys) - insetY));
  }
  if (x1 - x0 < 8 || y1 - y0 < 8) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = Math.max(1, y0); y < Math.min(h - 1, y1); y++) {
    for (let x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  return Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2));
}

/** Full-frame quad, used when nothing is detected or the user cancels a crop. */
export function fullFrameQuad(w: number, h: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];
}

/**
 * Maximum corner displacement between two quads, as a fraction of the frame.
 * Drives the "hold still" auto-shutter.
 */
export function quadDrift(a: Quad, b: Quad, frameDiag: number): number {
  let max = 0;
  for (let i = 0; i < 4; i++) {
    max = Math.max(max, dist(a[i], b[i]));
  }
  return max / frameDiag;
}

/* ------------------------------------------------------------------ *
 * Perspective correction
 * ------------------------------------------------------------------ */

/** Solves the 8x8 system with partial pivoting. */
function solveLinearSystem(m: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = m.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  const solution = new Array<number>(n);
  for (let i = 0; i < n; i++) solution[i] = a[i][n] / a[i][i];
  return solution;
}

/**
 * Homography mapping destination rectangle coordinates back into the source
 * quad, i.e. the inverse map used for resampling.
 */
function destToSrcHomography(quad: Quad, outW: number, outH: number): number[] | null {
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH }
  ];

  const m: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i];
    const { x, y } = quad[i];
    m.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    rhs.push(x);
    m.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    rhs.push(y);
  }
  return solveLinearSystem(m, rhs);
}

/** Output size that preserves the physical proportions of the detected page. */
function outputSizeFor(quad: Quad): { w: number; h: number } {
  const wTop = dist(quad[0], quad[1]);
  const wBottom = dist(quad[3], quad[2]);
  const hLeft = dist(quad[0], quad[3]);
  const hRight = dist(quad[1], quad[2]);

  let w = Math.max(wTop, wBottom);
  let h = Math.max(hLeft, hRight);

  const longest = Math.max(w, h);
  if (longest > MAX_OUTPUT_DIM) {
    const k = MAX_OUTPUT_DIM / longest;
    w *= k;
    h *= k;
  }
  return { w: Math.max(64, Math.round(w)), h: Math.max(64, Math.round(h)) };
}

/**
 * Warps the quad region of `source` into an upright rectangle
 * (keystone / perspective correction) using bilinear resampling.
 */
export function warpPerspective(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const srcCtx = source.getContext('2d', { willReadFrequently: true });
  const out = document.createElement('canvas');
  const { w: outW, h: outH } = outputSizeFor(quad);
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext('2d');
  if (!srcCtx || !outCtx) return source;

  const H = destToSrcHomography(quad, outW, outH);
  if (!H) {
    outCtx.drawImage(source, 0, 0, outW, outH);
    return out;
  }

  const srcData = srcCtx.getImageData(0, 0, source.width, source.height);
  const sd = srcData.data;
  const sw = source.width;
  const sh = source.height;

  const dstData = outCtx.createImageData(outW, outH);
  const dd = dstData.data;

  const [a, b, c, d, e, f, g, i] = H;

  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const denom = g * u + i * v + 1;
      const sx = (a * u + b * v + c) / denom;
      const sy = (d * u + e * v + f) / denom;
      const o = (v * outW + u) * 4;

      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        dd[o] = dd[o + 1] = dd[o + 2] = 255;
        dd[o + 3] = 255;
        continue;
      }

      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;

      for (let ch = 0; ch < 3; ch++) {
        const top = sd[i00 + ch] + (sd[i10 + ch] - sd[i00 + ch]) * fx;
        const bottom = sd[i01 + ch] + (sd[i11 + ch] - sd[i01 + ch]) * fx;
        dd[o + ch] = top + (bottom - top) * fy;
      }
      dd[o + 3] = 255;
    }
  }

  outCtx.putImageData(dstData, 0, 0);
  return out;
}

/**
 * Shaves dark slivers of background left inside the crop.
 *
 * The crop is a straight quadrilateral, but paper curls: along a bowed edge the
 * quad keeps a wedge of table top. Enhancement then renders that wedge as a
 * solid black band, and — worse — the dark pixels drag the white-point and
 * threshold statistics for the whole page.
 */
function trimDarkBorders(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const { width: w, height: h } = canvas;
  if (w < 32 || h < 32) return canvas;

  const data = ctx.getImageData(0, 0, w, h).data;
  const luma = (x: number, y: number) => {
    const o = (y * w + x) * 4;
    return 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  };

  // Page level from the middle, where background never reaches.
  const samples: number[] = [];
  const stepX = Math.max(1, Math.floor(w / 80));
  const stepY = Math.max(1, Math.floor(h / 80));
  for (let y = Math.floor(h * 0.25); y < h * 0.75; y += stepY) {
    for (let x = Math.floor(w * 0.25); x < w * 0.75; x += stepX) samples.push(luma(x, y));
  }
  if (samples.length === 0) return canvas;
  samples.sort((a, b) => a - b);
  const pageLevel = samples[samples.length >> 1];
  const darkLimit = pageLevel * 0.6;

  /**
   * A background sliver is dark, featureless, and — decisively — the page
   * resumes right after it. A dark header bar is also dark and its solid part
   * is featureless, but what follows is more content, not paper. Requiring the
   * next line to be paper is what stops the trim eating a logo band.
   */
  const DARK_SHARE = 0.45;
  const MAX_TRIM = 0.06;
  const FLAT_LIMIT = 26;
  const PAPER_RESUMES = pageLevel * 0.8;

  const lineStats = (read: (i: number) => number, length: number) => {
    let dark = 0;
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < length; i += 2) {
      const v = read(i);
      if (v < darkLimit) dark++;
      sum += v;
      sumSq += v * v;
      n++;
    }
    const mean = n ? sum / n : 0;
    const std = n ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 0;
    return { darkShare: n ? dark / n : 0, mean, std };
  };

  /** Depth of background to remove from one edge, 0 when it is not background. */
  const trimDepth = (
    lineAt: (offset: number) => { darkShare: number; mean: number; std: number },
    limit: number
  ) => {
    let depth = 0;
    while (depth < limit) {
      const line = lineAt(depth);
      if (line.darkShare > DARK_SHARE && line.std < FLAT_LIMIT) depth++;
      else break;
    }
    if (depth === 0) return 0;
    // Only background if the page itself starts where the dark strip ends.
    return lineAt(depth).mean >= PAPER_RESUMES ? depth : 0;
  };

  const left = trimDepth((o) => lineStats((y) => luma(o, y), h), Math.floor(w * MAX_TRIM));
  const right =
    w - 1 - trimDepth((o) => lineStats((y) => luma(w - 1 - o, y), h), Math.floor(w * MAX_TRIM));
  const top = trimDepth((o) => lineStats((x) => luma(x, o), w), Math.floor(h * MAX_TRIM));
  const bottom =
    h - 1 - trimDepth((o) => lineStats((x) => luma(x, h - 1 - o), w), Math.floor(h * MAX_TRIM));

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW === w && cropH === h) return canvas;
  if (cropW < w * 0.5 || cropH < h * 0.5) return canvas;

  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return canvas;
  outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

/** Perspective-corrects the quad, then removes any background left at the edges. */
function warpDocument(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  return trimDarkBorders(warpPerspective(source, quad));
}

/* ------------------------------------------------------------------ *
 * Enhancement
 * ------------------------------------------------------------------ */

/**
 * Divides the image by a heavily blurred copy of itself. This is what removes
 * the shadow of the phone/hand and evens out uneven lighting on the paper.
 */
function removeShadows(img: ImageData): void {
  const { width: w, height: h, data } = img;
  const lum = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const radius = Math.max(8, Math.round(Math.max(w, h) / 18));
  const ii = integralImage(lum, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const bg = Math.max(24, boxMean(ii, w, h, x, y, radius));
      const corrected = Math.min(255, (lum[p] / bg) * 235);
      const gain = corrected / Math.max(1, lum[p]);
      const o = p * 4;
      data[o] = Math.min(255, data[o] * gain);
      data[o + 1] = Math.min(255, data[o + 1] * gain);
      data[o + 2] = Math.min(255, data[o + 2] * gain);
    }
  }
}

/**
 * Neutralises the light source and lifts the paper to true white.
 *
 * Shadow removal derives a single gain from luminance and applies it to all
 * three channels, which preserves — and by amplifying, worsens — the colour
 * cast of the room light: warm bulbs come out yellow, shade comes out blue.
 * Balancing each channel against its own paper white point is what makes a
 * photo look like it came off a scanner.
 */
function neutralisePaperWhite(img: ImageData): void {
  const data = img.data;
  const pixels = img.width * img.height;

  // Split ink from paper, then measure the paper itself. A global percentile
  // would be dragged around by how much ink the bill happens to carry, and by
  // any specular glare; the paper class is what should end up neutral white.
  const luma = new Uint8Array(pixels);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const inkThreshold = otsuThreshold(luma);

  const sums = [0, 0, 0];
  let count = 0;
  for (let p = 0; p < pixels; p++) {
    if (luma[p] <= inkThreshold) continue;
    const o = p * 4;
    sums[0] += data[o];
    sums[1] += data[o + 1];
    sums[2] += data[o + 2];
    count++;
  }
  if (count < pixels * 0.05) return; // Barely any paper: leave it alone.

  const TARGET_WHITE = 248;
  const gains = sums.map((sum) => {
    const mean = sum / count;
    // Clamped so a dark or genuinely coloured document cannot be blown out.
    return Math.min(2.2, Math.max(0.7, TARGET_WHITE / Math.max(48, mean)));
  });

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] * gains[0]);
    data[i + 1] = Math.min(255, data[i + 1] * gains[1]);
    data[i + 2] = Math.min(255, data[i + 2] * gains[2]);
  }
}

/** Percentile-based contrast stretch — the "paper looks white" step. */
function stretchContrast(img: ImageData, lowP = 0.02, highP = 0.99): void {
  const data = img.data;
  const hist = new Uint32Array(256);
  const n = img.width * img.height;

  for (let i = 0; i < data.length; i += 4) {
    hist[(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0]++;
  }

  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * lowP) { lo = v; break; }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * highP) { hi = v; break; }
  }
  if (hi - lo < 24) return;

  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = Math.min(255, Math.max(0, ((v - lo) * 255) / (hi - lo)));
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

function toGrayscaleInPlace(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
}

/**
 * Bradley-Roth adaptive threshold. Unlike a fixed cutoff it keeps faint
 * thermal-print receipts readable and does not black out shadowed corners.
 */
function adaptiveThreshold(img: ImageData): void {
  const { width: w, height: h, data } = img;
  const lum = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const radius = Math.max(6, Math.round(Math.max(w, h) / 40));
  const ii = integralImage(lum, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const mean = boxMean(ii, w, h, x, y, radius);
      const value = lum[p] < mean * 0.87 ? 0 : 255;
      const o = p * 4;
      data[o] = data[o + 1] = data[o + 2] = value;
    }
  }
}

/** Light unsharp mask — recovers stroke definition lost to resampling. */
function sharpen(img: ImageData, amount = 0.55): void {
  const { width: w, height: h, data } = img;
  const lum = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const blur = boxBlurGray(lum, w, h, 1);

  for (let p = 0; p < lum.length; p++) {
    const delta = (lum[p] - blur[p]) * amount;
    if (delta === 0) continue;
    const o = p * 4;
    data[o] = Math.min(255, Math.max(0, data[o] + delta));
    data[o + 1] = Math.min(255, Math.max(0, data[o + 1] + delta));
    data[o + 2] = Math.min(255, Math.max(0, data[o + 2] + delta));
  }
}

/** Applies the selected scanner look to a canvas, in place. */
export function enhanceCanvas(canvas: HTMLCanvasElement, mode: EnhanceMode): HTMLCanvasElement {
  if (mode === 'original') return canvas;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  removeShadows(img);

  if (mode === 'bw') {
    // Adaptive thresholding is already illumination- and colour-invariant.
    adaptiveThreshold(img);
  } else {
    if (mode === 'gray') toGrayscaleInPlace(img);
    stretchContrast(img);
    // Balanced last: the contrast stretch applies one luminance-derived curve to
    // all three channels, so balancing before it would be partly undone.
    neutralisePaperWhite(img);
    sharpen(img);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = src;
  });
}

export function imageToCanvas(img: HTMLImageElement, maxDim = 2200): HTMLCanvasElement {
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const longest = Math.max(w, h);
  if (longest > maxDim) {
    const k = maxDim / longest;
    w = Math.round(w * k);
    h = Math.round(h * k);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  }
  return canvas;
}

function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const deg = ((degrees % 360) + 360) % 360;
  if (deg === 0) return canvas;

  const swap = deg === 90 || deg === 270;
  const out = document.createElement('canvas');
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;

  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export interface ProcessOptions {
  quad?: Quad | null;
  mode?: EnhanceMode;
  rotation?: number;
  quality?: number;
}

/**
 * Crop (perspective-correct) + enhance + rotate, returning a JPEG data URL.
 */
export function processDocument(source: HTMLCanvasElement, options: ProcessOptions = {}): string {
  const { quad, mode = 'color', rotation = 0, quality = 0.86 } = options;

  let canvas = source;
  if (quad) {
    canvas = warpDocument(source, quad);
  }
  canvas = enhanceCanvas(canvas, mode);
  canvas = rotateCanvas(canvas, rotation);
  return canvas.toDataURL('image/jpeg', quality);
}

export interface AutoScanResult {
  /** Cropped + enhanced document, ready to display and store. */
  dataUrl: string;
  /** Grayscale, contrast-normalised variant that OCRs noticeably better. */
  ocrDataUrl: string;
  /** Corners in the source image's coordinate space, for later re-editing. */
  quad: Quad;
  /** True when a page boundary was actually found (vs. full-frame fallback). */
  detected: boolean;
}

/**
 * One-shot pipeline for an image that is already captured (gallery pick,
 * shared file, or a frozen camera frame).
 */
export async function autoScanImage(
  src: string,
  options: { mode?: EnhanceMode; rotation?: number; quad?: Quad | null } = {}
): Promise<AutoScanResult> {
  const img = await loadImage(src);
  const canvas = imageToCanvas(img);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let quad = options.quad ?? null;
  let detected = Boolean(options.quad);

  if (!quad && ctx) {
    const detection = detectDocumentQuad(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (detection) {
      quad = detection.quad;
      detected = true;
    }
  }

  const effectiveQuad = quad ?? fullFrameQuad(canvas.width, canvas.height);
  const warped = warpDocument(canvas, effectiveQuad);

  const display = enhanceCanvas(cloneCanvas(warped), options.mode ?? 'color');
  const ocr = enhanceCanvas(cloneCanvas(warped), 'gray');

  const rotation = options.rotation ?? 0;

  return {
    dataUrl: rotateCanvas(display, rotation).toDataURL('image/jpeg', 0.86),
    ocrDataUrl: rotateCanvas(ocr, rotation).toDataURL('image/jpeg', 0.92),
    quad: effectiveQuad,
    detected
  };
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (ctx) ctx.drawImage(source, 0, 0);
  return out;
}
