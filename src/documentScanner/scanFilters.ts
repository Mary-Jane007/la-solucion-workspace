import type { ScanFilterMode } from "./types";
import { gemiddeldeHelderheid } from "./imageUtils";

function clamp(v: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, v));
}

function pasFilterToe(data: Uint8ClampedArray, mode: ScanFilterMode, avgBrightness: number): void {
  const contrast = mode === "enhanced" ? 1.25 : mode === "auto" ? 1.15 : 1;
  const brightnessOffset = mode === "enhanced" || mode === "auto" ? (128 - avgBrightness) * 0.15 : 0;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    if (mode === "original" || mode === "color") {
      continue;
    }

    if (mode === "gray" || mode === "bw" || mode === "auto" || mode === "enhanced") {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gray;
    }

    if (mode === "bw" || (mode === "auto" && avgBrightness > 90)) {
      const t = avgBrightness < 100 ? 120 : 155;
      const v = r >= t ? 255 : 0;
      r = g = b = v;
    } else {
      r = clamp((r - 128) * contrast + 128 + brightnessOffset);
      g = clamp((g - 128) * contrast + 128 + brightnessOffset);
      b = clamp((b - 128) * contrast + 128 + brightnessOffset);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

export function applyScanFilter(canvas: HTMLCanvasElement, mode: ScanFilterMode): HTMLCanvasElement {
  if (mode === "original" || mode === "color") {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d")?.drawImage(canvas, 0, 0);
    return copy;
  }

  const resolved = mode === "auto" ? kiesAutoModus(canvas) : mode;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;

  ctx.drawImage(canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const avg = gemiddeldeHelderheid(canvas);
  pasFilterToe(imageData.data, resolved, avg);
  ctx.putImageData(imageData, 0, 0);
  return out;
}

function kiesAutoModus(canvas: HTMLCanvasElement): ScanFilterMode {
  const avg = gemiddeldeHelderheid(canvas);
  if (avg < 85) return "enhanced";
  if (avg > 200) return "gray";
  return "enhanced";
}

export function filterPreview(canvas: HTMLCanvasElement, mode: ScanFilterMode, size = 72): string {
  const ratio = size / canvas.width;
  const thumb = document.createElement("canvas");
  thumb.width = size;
  thumb.height = Math.max(1, Math.round(canvas.height * ratio));
  const ctx = thumb.getContext("2d");
  if (!ctx) return "";
  const filtered = applyScanFilter(canvas, mode);
  ctx.drawImage(filtered, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL("image/jpeg", 0.8);
}
