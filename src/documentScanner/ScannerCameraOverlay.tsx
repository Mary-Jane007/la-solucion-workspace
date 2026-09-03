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
  documentGevonden: boolean;
  maskId: string;
}

export function ScannerCameraOverlay({
  overlayW,
  overlayH,
  corners,
  guideCorners,
  fase,
  confidence,
  documentGevonden,
  maskId
}: Props) {
  const w = Math.max(overlayW, 1);
  const h = Math.max(overlayH, 1);
  const polygon = hoekenNaarPolygonString(corners);
  const guidePolygon = hoekenNaarPolygonString(guideCorners);

  const kleur = documentGevonden ? "groen" : "rood";
  const toonCutout = documentGevonden && confidence >= 0.28;
  const toonHoekpunten = confidence >= 0.2;

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
        <polygon points={guidePolygon} className="scanner-doc-frame scan-rood" />
      )}

      {fase !== "guide" && (
        <polygon
          points={polygon}
          className={`scanner-doc-frame scan-${kleur}`}
          style={{ opacity: 0.4 + confidence * 0.6 }}
        />
      )}

      {toonHoekpunten &&
        corners.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={documentGevonden ? 9 : 7}
              className={`scanner-corner-dot scan-dot-${kleur}`}
            />
            <circle cx={p.x} cy={p.y} r={3} className="scanner-corner-dot-core" />
          </g>
        ))}
    </svg>
  );
}
