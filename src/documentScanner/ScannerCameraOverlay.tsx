import type { DetectieFase } from "./liveDetection";
import type { Point } from "./types";
import { hoekenNaarPolygonString } from "./documentDetection";

interface Props {
  overlayW: number;
  overlayH: number;
  corners: Point[];
  guideCorners: Point[];
  fase: DetectieFase;
  confidence: number;
  maskId: string;
}

export function ScannerCameraOverlay({
  overlayW,
  overlayH,
  corners,
  guideCorners,
  fase,
  confidence,
  maskId
}: Props) {
  const w = Math.max(overlayW, 1);
  const h = Math.max(overlayH, 1);
  const polygon = hoekenNaarPolygonString(corners);
  const guidePolygon = hoekenNaarPolygonString(guideCorners);
  const toonCutout = fase !== "guide" && confidence >= 0.28;
  const toonHoekpunten = fase !== "guide" && confidence >= 0.35;

  return (
    <svg
      className="scanner-overlay"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {toonCutout ? (
        <>
          <defs>
            <mask id={maskId}>
              <rect width="100%" height="100%" fill="white" />
              <polygon points={polygon} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" className="scanner-overlay-dim" mask={`url(#${maskId})`} />
        </>
      ) : (
        <rect width="100%" height="100%" className="scanner-overlay-dim" />
      )}

      {fase === "guide" && (
        <polygon points={guidePolygon} className="scanner-doc-frame guide" />
      )}

      {fase !== "guide" && (
        <>
          <polygon
            points={polygon}
            className={`scanner-doc-frame detect-${fase}`}
            style={{ opacity: 0.35 + confidence * 0.65 }}
          />
          {fase === "tracking" && (
            <polygon points={guidePolygon} className="scanner-doc-frame guide faint" />
          )}
        </>
      )}

      {toonHoekpunten &&
        corners.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={fase === "locked" ? 9 : 7} className="scanner-corner-dot" />
            <circle cx={p.x} cy={p.y} r={3} className="scanner-corner-dot-core" />
          </g>
        ))}
    </svg>
  );
}
