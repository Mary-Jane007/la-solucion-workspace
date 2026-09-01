import type { Point } from "./types";
import { smoothHoeken } from "./documentDetection";

export type DetectieFase = "guide" | "tracking" | "locked";

export type LiveDetectieState = {
  corners: Point[];
  confidence: number;
  fase: DetectieFase;
  documentGevonden: boolean;
};

/** Subtiel blauw hulpkader in het midden — geen detectie. */
export function berekenGuideHoeken(breedte: number, hoogte: number): Point[] {
  const mx = breedte * 0.1;
  const my = hoogte * 0.2;
  const w = breedte - mx * 2;
  const h = hoogte * 0.52;
  const y = hoogte * 0.18;
  return [
    { x: mx, y },
    { x: mx + w, y },
    { x: mx + w, y: y + h },
    { x: mx, y: y + h }
  ];
}

export function interpoleerHoeken(guide: Point[], detected: Point[], t: number): Point[] {
  const k = Math.max(0, Math.min(1, t));
  return guide.map((g, i) => ({
    x: g.x + (detected[i].x - g.x) * k,
    y: g.y + (detected[i].y - g.y) * k
  }));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export class LiveDocumentTracker {
  private smoothed: Point[] | null = null;
  private confidence = 0;
  private lockedFrames = 0;

  reset(): void {
    this.smoothed = null;
    this.confidence = 0;
    this.lockedFrames = 0;
  }

  tick(
    guide: Point[],
    detectedOverlay: Point[] | null,
    rawConfidence: number
  ): LiveDetectieState {
    const heeftDetectie = Boolean(detectedOverlay?.length === 4 && rawConfidence > 0.12);

    if (heeftDetectie && detectedOverlay) {
      const stijging = 0.08 + rawConfidence * 0.22;
      this.confidence = Math.min(1, this.confidence + stijging);
    } else {
      this.confidence = Math.max(0, this.confidence - 0.1);
    }

    const blend = easeOutCubic(Math.min(1, this.confidence * 1.15));
    const doel = heeftDetectie && detectedOverlay
      ? interpoleerHoeken(guide, detectedOverlay, blend)
      : guide;

    const smoothFactor = 0.12 + blend * 0.38;
    this.smoothed = smoothHoeken(this.smoothed, doel, smoothFactor);

    let fase: DetectieFase = "guide";
    if (this.confidence >= 0.62) {
      fase = "locked";
      this.lockedFrames++;
    } else if (this.confidence >= 0.22) {
      fase = "tracking";
      this.lockedFrames = 0;
    } else {
      fase = "guide";
      this.lockedFrames = 0;
    }

    const documentGevonden = fase === "locked" || (fase === "tracking" && this.confidence >= 0.38);

    return {
      corners: this.smoothed ?? guide,
      confidence: this.confidence,
      fase,
      documentGevonden
    };
  }

  kanScannen(): boolean {
    return this.confidence >= 0.42 && this.smoothed !== null;
  }

  getSmoothedCorners(): Point[] | null {
    return this.smoothed;
  }
}
