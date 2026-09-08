import type { FinancieelInzending, FinancieelPost, FinancieelValuta } from "./api";
import { AfsluitingRapport, voegAfsluitingenSamen } from "./financieelDashboardUtils";

export const FINANCIEEL_BACKUP_KIND = "la-solucion-financieel-backup";
export const FINANCIEEL_BACKUP_VERSION = 1;

export type FinancieelBackupBijlage = {
  id: string;
  postId?: string;
  inzendingId?: string;
  origineleNaam: string;
  mimeType?: string;
  grootte?: number;
  inhoudBase64?: string;
  ontbreekt?: boolean;
};

export type FinancieelBackupBestand = {
  kind: typeof FINANCIEEL_BACKUP_KIND;
  version: typeof FINANCIEEL_BACKUP_VERSION;
  exportedAt?: string;
  posten: FinancieelPost[];
  postBijlagen?: FinancieelBackupBijlage[];
  inzendingen?: FinancieelInzending[];
  inzendingBijlagen?: FinancieelBackupBijlage[];
  afsluitingen?: AfsluitingRapport[];
  instellingen?: {
    standaardValuta?: FinancieelValuta;
  };
};

export function maakFinancieelBackupBestandsnaam(nu = new Date()): string {
  const iso = nu.toISOString().slice(0, 10);
  return `la-solucion-financieel-backup-${iso}.json`;
}

export function vulLokaleBackupGegevens(
  backup: FinancieelBackupBestand,
  lokaleAfsluitingen: AfsluitingRapport[],
  standaardValuta: FinancieelValuta
): FinancieelBackupBestand {
  return {
    ...backup,
    kind: FINANCIEEL_BACKUP_KIND,
    version: FINANCIEEL_BACKUP_VERSION,
    exportedAt: backup.exportedAt || new Date().toISOString(),
    afsluitingen: voegAfsluitingenSamen(backup.afsluitingen || [], lokaleAfsluitingen),
    instellingen: {
      ...(backup.instellingen || {}),
      standaardValuta
    }
  };
}

export function parseFinancieelBackupTekst(tekst: string): FinancieelBackupBestand {
  let parsed: unknown;
  try {
    parsed = JSON.parse(tekst);
  } catch {
    throw new Error("Dit is geen geldig backupbestand.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Dit is geen geldig backupbestand.");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.kind !== FINANCIEEL_BACKUP_KIND) {
    throw new Error("Dit bestand is geen financiële backup van La-Solución.");
  }
  if (obj.version !== FINANCIEEL_BACKUP_VERSION) {
    throw new Error("Dit backupbestand is van een andere app-versie.");
  }
  if (!Array.isArray(obj.posten)) {
    throw new Error("Het backupbestand mist de financiële posten.");
  }
  return parsed as FinancieelBackupBestand;
}

export function downloadFinancieelBackupBestand(backup: FinancieelBackupBestand): void {
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = maakFinancieelBackupBestandsnaam();
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
