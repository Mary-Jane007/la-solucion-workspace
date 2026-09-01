import { loadOpenCV } from "./opencvLoader";
import type { Point } from "./types";
import { sorteerHoeken, standaardHoeken } from "./imageUtils";

function contourArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
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

export async function detectDocumentCorners(canvas: HTMLCanvasElement): Promise<Point[] | null> {
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
    cv.Canny(blurred, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let best: Point[] | null = null;
    let bestArea = 0;
    const minArea = work.width * work.height * 0.08;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);
      if (approx.rows === 4) {
        const pts = matNaarHoeken(cv, approx, 1 / scale, 1 / scale);
        const area = contourArea(pts);
        if (area > bestArea && area >= minArea / (scale * scale)) {
          bestArea = area;
          best = pts;
        }
      }
      approx.delete();
      contour.delete();
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
