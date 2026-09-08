import type { Point } from "./types";

export type DetectieFase = "guide" | "tracking" | "locked";

export type LiveDetectieState = {
  corners: Point[];
  confidence: number;
  fase: DetectieFase;
  documentGevonden: boolean;
};

type Rect = { x: number; y: number; w: number; h: number };

function boundingRect(points: Point[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function intersectArea(a: Rect, b: Rect): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

/**
 * Groen als het document in het kader zit — het hoeft het kader niet tot de randen te vullen.
 */
export function kaderBevatDocument(detected: Point[], guide: Point[]): boolean {
  if (detected.length !== 4 || guide.length !== 4) return false;
  const g = boundingRect(guide);
  const d = boundingRect(detected);
  const detectedArea = d.w * d.h;
  const guideArea = g.w * g.h;
  if (detectedArea < 16 || guideArea < 16) return false;

  const overlap = intersectArea(g, d);
  const inKader = overlap / detectedArea;
  const vulling = overlap / guideArea;
  return inKader >= 0.7 && vulling >= 0.12;
}

/** Document steekt duidelijk buiten het kader — dan blijft het rood. */
export function documentSteektBuitenKader(detected: Point[], guide: Point[]): boolean {
  if (detected.length !== 4 || guide.length !== 4) return false;
  const g = boundingRect(guide);
  const d = boundingRect(detected);
  const detectedArea = d.w * d.h;
  const guideArea = g.w * g.h;
  if (detectedArea < 16 || guideArea < 16) return false;
  const overlap = intersectArea(g, d);
  return overlap / guideArea > 0.18 && overlap / detectedArea < 0.62;
}

/** Vast scankader (A4-verhouding) — dit is ook het crop-gebied. */
export function berekenGuideHoeken(breedte: number, hoogte: number): Point[] {
  const padX = breedte * 0.07;
  const padTop = hoogte * 0.1;
  const padBot = hoogte * 0.16;
  const maxW = Math.max(1, breedte - padX * 2);
  const maxH = Math.max(1, hoogte - padTop - padBot);
  let w = maxW;
  let h = w * Math.SQRT2;
  if (h > maxH) {
    h = maxH;
    w = h / Math.SQRT2;
  }
  const x = (breedte - w) / 2;
  const y = padTop + (maxH - h) / 2;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h }
  ];
}

export class LiveDocumentTracker {
  private confidence = 0;
  private lockedFrames = 0;

  reset(): void {
    this.confidence = 0;
    this.lockedFrames = 0;
  }

  tick(guide: Point[], documentInKader: boolean): LiveDetectieState {
    if (documentInKader) {
      this.confidence = Math.min(1, this.confidence + 0.28);
    } else {
      this.confidence = Math.max(0, this.confidence - 0.12);
    }

    let fase: DetectieFase = "guide";
    if (this.confidence >= 0.42) {
      fase = "locked";
      this.lockedFrames++;
    } else if (this.confidence >= 0.18) {
      fase = "tracking";
      this.lockedFrames = 0;
    } else {
      fase = "guide";
      this.lockedFrames = 0;
    }

    return {
      corners: guide,
      confidence: this.confidence,
      fase,
      documentGevonden: this.confidence >= 0.38
    };
  }

  kanScannen(): boolean {
    return this.confidence >= 0.38;
  }

  getSmoothedCorners(): Point[] | null {
    return null;
  }
}
