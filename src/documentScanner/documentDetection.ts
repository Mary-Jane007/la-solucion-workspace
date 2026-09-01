import { loadOpenCV } from "./opencvLoader";
import type { Point } from "./types";
import { sorteerHoeken, standaardHoeken } from "./imageUtils";

export type DocumentDetectieResult = {
  corners: Point[];
  confidence: number;
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
  if (!isConvexQuad(corners)) return 0;

  const area = contourArea(corners);
  const frameArea = frameW * frameH;
  const areaRatio = area / frameArea;
  if (areaRatio < 0.05 || areaRatio > 0.94) return 0;

  let areaScore = 1;
  if (areaRatio < 0.1) areaScore = areaRatio / 0.1;
  else if (areaRatio > 0.82) areaScore = (1 - areaRatio) / 0.18;

  const [tl, tr, br, bl] = sorteerHoeken(corners);
  const widthTop = afstand(tl, tr);
  const widthBot = afstand(bl, br);
  const heightLeft = afstand(tl, bl);
  const heightRight = afstand(tr, br);
  const avgW = (widthTop + widthBot) / 2;
  const avgH = (heightLeft + heightRight) / 2;
  if (avgW < 20 || avgH < 20) return 0;

  const aspect = avgW / avgH;
  if (aspect < 0.2 || aspect > 5) return 0;
  const aspectScore = aspect < 0.45 || aspect > 2.2 ? 0.65 : 1;

  const widthSym = Math.min(widthTop, widthBot) / Math.max(widthTop, widthBot);
  const heightSym = Math.min(heightLeft, heightRight) / Math.max(heightLeft, heightRight);
  const symmetryScore = (widthSym + heightSym) / 2;

  const diag1 = afstand(tl, br);
  const diag2 = afstand(tr, bl);
  const diagSym = Math.min(diag1, diag2) / Math.max(diag1, diag2);

  return Math.min(
    1,
    areaScore * 0.35 + symmetryScore * 0.3 + diagSym * 0.15 + aspectScore * 0.2
  );
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

export async function detectDocumentWithConfidence(
  canvas: HTMLCanvasElement
): Promise<DocumentDetectieResult | null> {
  try {
    const cv = await loadOpenCV();
    const maxSide = 800;
    const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
    const work = document.createElement("canvas");
    work.width = Math.round(canvas.width * scale);
    work.height = Math.round(canvas.height * scale);
    const wctx = work.getContext("2d");
    if (!wctx) return null;
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
    const minArea = work.width * work.height * 0.06;

    for (const [low, high] of [
      [40, 120],
      [50, 150],
      [60, 180]
    ] as const) {
      cv.Canny(blurred, edges, low, high);
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const peri = cv.arcLength(contour, true);
        for (const eps of [0.015, 0.02, 0.03]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, eps * peri, true);
          if (approx.rows === 4) {
            const pts = matNaarHoeken(cv, approx, 1 / scale, 1 / scale);
            const area = contourArea(pts);
            if (area >= minArea / (scale * scale)) {
              const conf = scoreQuadrilateral(pts, canvas.width, canvas.height);
              if (conf > 0 && (!best || conf > best.confidence)) {
                best = { corners: pts, confidence: conf };
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

    return best;
  } catch {
    return null;
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
