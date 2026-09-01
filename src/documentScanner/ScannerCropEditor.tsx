import { useEffect, useRef, useState } from "react";
import type { Point } from "./types";

interface Props {
  imageDataUrl: string;
  corners: Point[];
  imageWidth: number;
  imageHeight: number;
  onGereed: (corners: Point[]) => void;
  onAnnuleren: () => void;
  onOpnieuw: () => void;
}

const HANDLE_R = 14;

export function ScannerCropEditor({
  imageDataUrl,
  corners,
  imageWidth,
  imageHeight,
  onGereed,
  onAnnuleren,
  onOpnieuw
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pts, setPts] = useState<Point[]>(corners);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setPts(corners);
  }, [corners, imageDataUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(rect.width / imageWidth, (rect.height || 400) / imageHeight, 1);
      setDisplaySize({ w: imageWidth * ratio, h: imageHeight * ratio });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [imageWidth, imageHeight]);

  const scaleX = displaySize.w / imageWidth;
  const scaleY = displaySize.h / imageHeight;

  const toDisplay = (p: Point) => ({ x: p.x * scaleX, y: p.y * scaleY });
  const toImage = (p: Point) => ({
    x: Math.max(0, Math.min(imageWidth, p.x / scaleX)),
    y: Math.max(0, Math.min(imageHeight, p.y / scaleY))
  });

  const startDrag = (index: number, clientX: number, clientY: number) => {
    setDragIndex(index);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const move = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      setPts((prev) => {
        const next = [...prev];
        next[index] = toImage({ x, y });
        return next;
      });
    };
    const up = () => {
      setDragIndex(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    move({ clientX, clientY } as PointerEvent);
  };

  const polygonPoints = pts.map((p) => {
    const d = toDisplay(p);
    return `${d.x},${d.y}`;
  }).join(" ");

  return (
    <div className="scanner-crop">
      <p className="scanner-hint">Sleep de hoeken zodat ze het document raakken.</p>
      <div ref={containerRef} className="scanner-crop-stage">
        <img src={imageDataUrl} alt="Scan" className="scanner-crop-image" style={{ width: displaySize.w, height: displaySize.h }} />
        <svg
          className="scanner-crop-overlay"
          width={displaySize.w}
          height={displaySize.h}
          viewBox={`0 0 ${displaySize.w} ${displaySize.h}`}
        >
          <polygon points={polygonPoints} className="scanner-crop-poly" />
          {pts.map((p, i) => {
            const d = toDisplay(p);
            return (
              <circle
                key={i}
                cx={d.x}
                cy={d.y}
                r={HANDLE_R}
                className={`scanner-crop-handle${dragIndex === i ? " active" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  startDrag(i, e.clientX, e.clientY);
                }}
              />
            );
          })}
        </svg>
      </div>
      <footer className="scanner-bottom-bar">
        <button type="button" className="scanner-btn ghost" onClick={onAnnuleren}>
          Annuleren
        </button>
        <button type="button" className="scanner-btn ghost" onClick={onOpnieuw}>
          Opnieuw
        </button>
        <button type="button" className="scanner-btn primary" onClick={() => onGereed(pts)}>
          Gereed
        </button>
      </footer>
    </div>
  );
}
