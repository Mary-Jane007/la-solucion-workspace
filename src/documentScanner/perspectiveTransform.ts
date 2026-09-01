import { loadOpenCV } from "./opencvLoader";
import type { Point } from "./types";
import { sorteerHoeken } from "./imageUtils";

function afstand(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function outputAfmetingen(corners: Point[]): { width: number; height: number } {
  const [tl, tr, br, bl] = sorteerHoeken(corners);
  const width = Math.max(afstand(tl, tr), afstand(bl, br));
  const height = Math.max(afstand(tl, bl), afstand(tr, br));
  return {
    width: Math.max(320, Math.round(width)),
    height: Math.max(320, Math.round(height))
  };
}

export async function warpDocument(
  source: HTMLCanvasElement,
  corners: Point[]
): Promise<HTMLCanvasElement> {
  const pts = sorteerHoeken(corners);
  const { width, height } = outputAfmetingen(pts);

  try {
    const cv = await loadOpenCV();
    const src = cv.imread(source);
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      pts[0].x, pts[0].y,
      pts[1].x, pts[1].y,
      pts[2].x, pts[2].y,
      pts[3].x, pts[3].y
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      width, 0,
      width, height,
      0, height
    ]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const dst = new cv.Mat();
    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(width, height),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    cv.imshow(out, dst);

    src.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
    dst.delete();

    return out;
  } catch {
    return fallbackWarp(source, pts, width, height);
  }
}

function fallbackWarp(
  source: HTMLCanvasElement,
  pts: Point[],
  width: number,
  height: number
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  return out;
}

export function rotateCanvas(source: HTMLCanvasElement, graden: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  if (graden === 180) {
    out.width = source.width;
    out.height = source.height;
    ctx.translate(out.width, out.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, 0, 0);
    return out;
  }

  out.width = source.height;
  out.height = source.width;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((graden * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

export function canvasFromDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas niet beschikbaar."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Afbeelding kon niet worden geladen."));
    img.src = dataUrl;
  });
}
