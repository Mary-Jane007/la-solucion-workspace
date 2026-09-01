import type { ScanHistoryItem } from "./types";
import { nieuwScanId } from "./imageUtils";

const STORAGE_KEY = "la-solucion-scan-geschiedenis";
const MAX_ITEMS = 40;

export function laadScanGeschiedenis(): ScanHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScanHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function bewaarInScanGeschiedenis(
  item: Omit<ScanHistoryItem, "id">
): ScanHistoryItem {
  const volledig: ScanHistoryItem = { ...item, id: nieuwScanId() };
  const bestaand = laadScanGeschiedenis();
  const next = [volledig, ...bestaand].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return volledig;
}

export function verwijderUitScanGeschiedenis(id: string): void {
  const next = laadScanGeschiedenis().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function zoekInScanGeschiedenis(items: ScanHistoryItem[], q: string): ScanHistoryItem[] {
  const term = q.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => item.naam.toLowerCase().includes(term));
}

export function formatScanDatum(iso: string): string {
  const d = new Date(iso);
  const vandaag = new Date();
  const gisteren = new Date();
  gisteren.setDate(gisteren.getDate() - 1);
  const dag = d.toISOString().slice(0, 10);
  const v = vandaag.toISOString().slice(0, 10);
  const g = gisteren.toISOString().slice(0, 10);
  if (dag === v) return "Vandaag";
  if (dag === g) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function formatGrootte(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
