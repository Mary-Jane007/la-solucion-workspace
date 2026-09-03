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
    const heeftDetectie = Boolean(detectedOverlay?.length === 4 && rawConfidence > 0.05);

    if (heeftDetectie && detectedOverlay) {
      // Snelle opbouw — 2-3 frames met detectie → groen
      const stijging = 0.2 + rawConfidence * 0.35;
      this.confidence = Math.min(1, this.confidence + stijging);
    } else {
      // Langzame afname zodat het niet direct terugspringt naar rood
      this.confidence = Math.max(0, this.confidence - 0.06);
    }

    const blend = easeOutCubic(Math.min(1, this.confidence * 1.3));
    const doel = heeftDetectie && detectedOverlay
      ? interpoleerHoeken(guide, detectedOverlay, blend)
      : guide;

    const smoothFactor = 0.15 + blend * 0.45;
    this.smoothed = smoothHoeken(this.smoothed, doel, smoothFactor);

    // Lage drempels: snel groen
    let fase: DetectieFase = "guide";
    if (this.confidence >= 0.3) {
      fase = "locked";
      this.lockedFrames++;
    } else if (this.confidence >= 0.1) {
      fase = "tracking";
      this.lockedFrames = 0;
    } else {
      fase = "guide";
      this.lockedFrames = 0;
    }

    const documentGevonden = this.confidence >= 0.2;

    return {
      corners: this.smoothed ?? guide,
      confidence: this.confidence,
      fase,
      documentGevonden
    };
  }

  kanScannen(): boolean {
    return this.confidence >= 0.2 && this.smoothed !== null;
  }

  getSmoothedCorners(): Point[] | null {
    return this.smoothed;
  }
}
