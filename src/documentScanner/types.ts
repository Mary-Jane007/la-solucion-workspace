export type Point = { x: number; y: number };

export type ScanFilterMode = "auto" | "original" | "bw" | "gray" | "color" | "enhanced";

export type ScanPage = {
  id: string;
  thumbnail: string;
  processedDataUrl: string;
  filter: ScanFilterMode;
  ocrText?: string;
};

export type ScanHistoryItem = {
  id: string;
  naam: string;
  datum: string;
  paginas: number;
  grootte: number;
  thumbnail: string;
};

export type ScannerStep =
  | "camera"
  | "processing"
  | "crop"
  | "filter"
  | "pages"
  | "preview"
  | "save"
  | "done"
  | "history";

export const FILTER_LABELS: Record<ScanFilterMode, string> = {
  auto: "Automatisch",
  original: "Origineel",
  bw: "Zwart-wit",
  gray: "Grijswaarden",
  color: "Kleur",
  enhanced: "Verbeterd"
};
