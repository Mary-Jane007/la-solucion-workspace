import { loadOpenCV } from "./opencvLoader";
import type { Point } from "./types";
import { sorteerHoeken, standaardHoeken } from "./imageUtils";

export type DocumentDetectieResult = {
  corners: Point[];
  confidence: number;
  exacteContour: boolean;
};

function contourArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
}

function afstand(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isConvexQuad(corners: Point[]): boolean {
  const pts = sorteerHoeken(corners);
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % 4];
    const p2 = pts[(i + 2) % 4];
    const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (cross === 0) continue;
    if (sign === 0) sign = cross > 0 ? 1 : -1;
    else if ((cross > 0 ? 1 : -1) !== sign) return false;
  }
  return true;
}

function scoreQuadrilateral(corners: Point[], frameW: number, frameH: number): number {
  // Convexiteit niet verplicht — elk vierkant-achtig object telt
  const area = contourArea(corners);
  const frameArea = frameW * frameH;
  const areaRatio = area / frameArea;
  if (areaRatio < 0.02 || areaRatio > 0.97) return 0;

  let areaScore = 1;
  if (areaRatio < 0.06) areaScore = areaRatio / 0.06;
  else if (areaRatio > 0.88) areaScore = (1 - areaRatio) / 0.12;

  const [tl, tr, br, bl] = sorteerHoeken(corners);
  const widthTop = afstand(tl, tr);
  const widthBot = afstand(bl, br);
  const heightLeft = afstand(tl, bl);
  const heightRight = afstand(tr, br);
  const avgW = (widthTop + widthBot) / 2;
  const avgH = (heightLeft + heightRight) / 2;
  if (avgW < 12 || avgH < 12) return 0;

  const aspect = avgW / avgH;
  if (aspect < 0.1 || aspect > 10) return 0;

  const widthSym = Math.min(widthTop, widthBot) / Math.max(widthTop, widthBot);
  const heightSym = Math.min(heightLeft, heightRight) / Math.max(heightLeft, heightRight);
  const symmetryScore = (widthSym + heightSym) / 2;

  const convexBonus = isConvexQuad(corners) ? 0.15 : 0;

  return Math.min(1, areaScore * 0.4 + symmetryScore * 0.35 + convexBonus + 0.1);
}

function matNaarHoeken(cv: any, contour: any, scaleX: number, scaleY: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < 4; i++) {
    points.push({
      x: contour.data32S[i * 2] * scaleX,
      y: contour.data32S[i * 2 + 1] * scaleY
    });
  }
  return sorteerHoeken(points);
}

/**
 * Snelle contrast-gebaseerde detectie: kijkt of er genoeg randen zijn in het beeld.
 * Als er iets in het camerabeeld zit dat contrast heeft, geeft het een score.
 */
function snelleContrastDetectie(canvas: HTMLCanvasElement): DocumentDetectieResult {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { corners: standaardHoeken(canvas.width, canvas.height), confidence: 0.35 };

  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Bereken gemiddelde helderheid en variantie in het centrale deel
  const cx1 = Math.floor(w * 0.15);
  const cx2 = Math.floor(w * 0.85);
  const cy1 = Math.floor(h * 0.15);
  const cy2 = Math.floor(h * 0.85);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = cy1; y < cy2; y += 4) {
    for (let x = cx1; x < cx2; x += 4) {
      const idx = (y * w + x) * 4;
      const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
      sum += lum;
      sumSq += lum * lum;
      n++;
    }
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;

  const conf = variance > 200 ? 0.65 : variance > 80 ? 0.45 : variance > 30 ? 0.3 : 0.1;

  const m = 0.08;
  return {
    corners: [
      { x: w * m, y: h * m },
      { x: w * (1 - m), y: h * m },
      { x: w * (1 - m), y: h * (1 - m) },
      { x: w * m, y: h * (1 - m) }
    ],
    confidence: conf,
    exacteContour: false
  };
}

export async function detectDocumentWithConfidence(
  canvas: HTMLCanvasElement
): Promise<DocumentDetectieResult> {
  // Probeer OpenCV detectie
  try {
    const cv = await loadOpenCV();
    const maxSide = 800;
    const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
    const work = document.createElement("canvas");
    work.width = Math.round(canvas.width * scale);
    work.height = Math.round(canvas.height * scale);
    const wctx = work.getContext("2d");
    if (!wctx) return snelleContrastDetectie(canvas);
    wctx.drawImage(canvas, 0, 0, work.width, work.height);

    const src = cv.imread(work);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    let best: DocumentDetectieResult | null = null;
    const minArea = work.width * work.height * 0.02;

    for (const [low, high] of [
      [15, 60],
      [20, 80],
      [30, 100],
      [40, 120],
      [50, 150],
      [70, 200]
    ] as const) {
      cv.Canny(blurred, edges, low, high);
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const peri = cv.arcLength(contour, true);
        for (const eps of [0.01, 0.015, 0.02, 0.03, 0.04, 0.05]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, eps * peri, true);
          if (approx.rows === 4) {
            const pts = matNaarHoeken(cv, approx, 1 / scale, 1 / scale);
            const area = contourArea(pts);
            if (area >= minArea / (scale * scale)) {
              const conf = scoreQuadrilateral(pts, canvas.width, canvas.height);
              if (conf > 0 && (!best || conf > best.confidence)) {
                best = { corners: pts, confidence: conf, exacteContour: true };
              }
            }
          }
          approx.delete();
        }
        contour.delete();
      }
    }

    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    // Als OpenCV iets vond, gebruik dat. Anders fallback op contrast-detectie.
    return best ?? snelleContrastDetectie(canvas);
  } catch {
    return snelleContrastDetectie(canvas);
  }
}

export async function detectDocumentCorners(canvas: HTMLCanvasElement): Promise<Point[] | null> {
  const result = await detectDocumentWithConfidence(canvas);
  return result?.corners ?? null;
}

export async function detectDocumentCornersMetFallback(
  canvas: HTMLCanvasElement
): Promise<{ corners: Point[]; auto: boolean }> {
  const detected = await detectDocumentCorners(canvas);
  if (detected && detected.length === 4) {
    return { corners: detected, auto: true };
  }
  return {
    corners: standaardHoeken(canvas.width, canvas.height),
    auto: false
  };
}

export function hoekenNaarOverlay(
  corners: Point[],
  bronW: number,
  bronH: number,
  overlayW: number,
  overlayH: number
): Point[] {
  const sx = overlayW / bronW;
  const sy = overlayH / bronH;
  return corners.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}

/** Map hoeken van videoframe naar zichtbaar camerabeeld (object-fit: cover). */
export function hoekenNaarVideoOverlay(
  corners: Point[],
  videoW: number,
  videoH: number,
  displayW: number,
  displayH: number
): Point[] {
  if (!videoW || !videoH || !displayW || !displayH) return corners;
  const scale = Math.max(displayW / videoW, displayH / videoH);
  const renderedW = videoW * scale;
  const renderedH = videoH * scale;
  const offsetX = (displayW - renderedW) / 2;
  const offsetY = (displayH - renderedH) / 2;
  return corners.map((p) => ({
    x: p.x * scale + offsetX,
    y: p.y * scale + offsetY
  }));
}

/** Vloeiende overgang zodat het kader het document volgt zonder te schokken. */
export function smoothHoeken(vorige: Point[] | null, volgende: Point[], factor = 0.38): Point[] {
  if (!vorige || vorige.length !== 4) return volgende;
  return volgende.map((p, i) => ({
    x: vorige[i].x + (p.x - vorige[i].x) * factor,
    y: vorige[i].y + (p.y - vorige[i].y) * factor
  }));
}

/** Omgekeerde mapping: van overlay-coördinaten terug naar videoframe. */
export function overlayNaarVideoHoeken(
  corners: Point[],
  videoW: number,
  videoH: number,
  displayW: number,
  displayH: number
): Point[] {
  const scale = Math.max(displayW / videoW, displayH / videoH);
  const offsetX = (displayW - videoW * scale) / 2;
  const offsetY = (displayH - videoH * scale) / 2;
  return corners.map((p) => ({
    x: (p.x - offsetX) / scale,
    y: (p.y - offsetY) / scale
  }));
}

export function hoekenNaarPolygonString(corners: Point[]): string {
  return corners.map((p) => `${p.x},${p.y}`).join(" ");
}
