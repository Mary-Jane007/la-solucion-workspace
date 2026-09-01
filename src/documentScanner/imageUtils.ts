import type { Point } from "./types";

export function nieuwScanId(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Afbeelding kon niet worden geladen."));
    };
    img.src = url;
  });
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Afbeelding kon niet worden geladen."));
    img.src = dataUrl;
  });
}

export function canvasFromImage(img: HTMLImageElement | HTMLVideoElement, maxSide = 2400): HTMLCanvasElement {
  const w = "videoWidth" in img ? img.videoWidth : img.naturalWidth;
  const h = "videoHeight" in img ? img.videoHeight : img.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  return canvas.toDataURL("image/jpeg", quality);
}

export function canvasToThumbnail(canvas: HTMLCanvasElement, maxWidth = 160): string {
  const ratio = maxWidth / canvas.width;
  const thumb = document.createElement("canvas");
  thumb.width = maxWidth;
  thumb.height = Math.round(canvas.height * ratio);
  const ctx = thumb.getContext("2d");
  if (!ctx) return canvasToDataUrl(canvas, 0.7);
  ctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
  return thumb.toDataURL("image/jpeg", 0.75);
}

export function dataUrlToFile(dataUrl: string, naam: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], naam, { type: mime, lastModified: Date.now() });
}

export function standaardHoeken(width: number, height: number, marge = 0.06): Point[] {
  const mx = width * marge;
  const my = height * marge;
  return [
    { x: mx, y: my },
    { x: width - mx, y: my },
    { x: width - mx, y: height - my },
    { x: mx, y: height - my }
  ];
}

export function sorteerHoeken(points: Point[]): Point[] {
  if (points.length !== 4) return points;
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

export function schaalHoeken(points: Point[], vanW: number, vanH: number, naarW: number, naarH: number): Point[] {
  const sx = naarW / vanW;
  const sy = naarH / vanH;
  return points.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}

export function gemiddeldeHelderheid(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 128;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let sum = 0;
  const step = Math.max(1, Math.floor((width * height) / 5000));
  let count = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    count++;
  }
  return count ? sum / count : 128;
}

export function vandaagScanNaam(): string {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10);
  return `Scan_${iso}.pdf`;
}
