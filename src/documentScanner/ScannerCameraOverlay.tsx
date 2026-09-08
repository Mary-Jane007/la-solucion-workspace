import { berekenGuideHoeken } from "./liveDetection";
import { hoekenNaarPolygonString } from "./documentDetection";

interface Props {
  overlayW: number;
  overlayH: number;
  documentGevonden: boolean;
  maskId: string;
}

export function ScannerCameraOverlay({
  overlayW,
  overlayH,
  documentGevonden,
  maskId
}: Props) {
  const w = Math.max(overlayW, 1);
  const h = Math.max(overlayH, 1);
  const guideCorners = berekenGuideHoeken(w, h);
  const polygon = hoekenNaarPolygonString(guideCorners);
  const kleur = documentGevonden ? "groen" : "rood";

  return (
    <svg
      className="scanner-overlay"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white" />
          <polygon points={polygon} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" className="scanner-overlay-dim" mask={`url(#${maskId})`} />
      <polygon points={polygon} className={`scanner-doc-frame scan-${kleur}`} />
      {guideCorners.map((p, i) => (
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
