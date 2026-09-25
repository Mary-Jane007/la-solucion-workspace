import { BestandsKoppeling, Gebruiker, Opdracht } from "./types";
import { normaliseerBestandBlob } from "./bestandUtils";
import type { AfsluitingRapport } from "./financieelDashboardUtils";
import type { FinancieelBackupBestand } from "./financieelBackup";

export function getToken() {
  return window.localStorage.getItem("la-solucion-token");
}

export function clearToken() {
  window.localStorage.removeItem("la-solucion-token");
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = getToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body instanceof FormData) {
    headers.delete("Content-Type");
  }
  return fetch(path, { cache: "no-store", ...init, headers });
}

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("<")) {
    throw new Error("De server is niet bereikbaar. Probeer het over een paar seconden opnieuw.");
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error("Ongeldig antwoord van de server.");
  }
}

export async function login(email: string, password: string): Promise<{
  token: string;
  user: Gebruiker;
}> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20000);
  let res: Response;
  try {
    res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
      signal: controller.signal
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Inloggen duurde te lang. Controleer of de backend draait (npm run dev).");
    }
    throw new Error("De server is niet bereikbaar. Start alles met npm run dev en probeer het opnieuw.");
  } finally {
    window.clearTimeout(timer);
  }
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Inloggen mislukt."));
  if (!data.token || !data.user || typeof data.user !== "object") {
    throw new Error("Ongeldig antwoord van de server bij inloggen.");
  }
  return data as { token: string; user: Gebruiker };
}

export async function fetchMe(): Promise<Gebruiker> {
  const res = await apiFetch("/api/auth/me");
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon gebruiker niet ophalen."));
  return data as unknown as Gebruiker;
}

export type AdminGebruiker = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

export async function fetchAdminUsers(): Promise<AdminGebruiker[]> {
  const res = await apiFetch("/api/admin/users");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon teamleden niet ophalen.");
  return (data.users || []) as AdminGebruiker[];
}

export async function fetchOpdrachten(): Promise<Opdracht[]> {
  const res = await apiFetch("/api/opdrachten");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon opdrachten niet ophalen.");
  return (data.opdrachten || []) as Opdracht[];
}

export async function createOpdracht(opdracht: Partial<Opdracht>): Promise<Opdracht> {
  const res = await apiFetch("/api/opdrachten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opdracht)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon opdracht niet aanmaken.");
  return data.opdracht as Opdracht;
}

export async function updateOpdracht(opdracht: Opdracht): Promise<Opdracht> {
  const res = await apiFetch(`/api/opdrachten/${opdracht.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opdracht)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon opdracht niet opslaan.");
  return data.opdracht as Opdracht;
}

export async function deleteOpdracht(id: string): Promise<void> {
  const res = await apiFetch(`/api/opdrachten/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Kon opdracht niet verwijderen.");
  }
}

export async function fetchPrullenbak(): Promise<Opdracht[]> {
  const res = await apiFetch("/api/opdrachten/prullenbak");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon prullenbak niet ophalen.");
  return (data.opdrachten || []) as Opdracht[];
}

export async function herstelOpdracht(id: string): Promise<Opdracht> {
  const res = await apiFetch(`/api/opdrachten/${id}/herstel`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon opdracht niet herstellen.");
  return data.opdracht as Opdracht;
}

export async function uploadBestand(opdrachtId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`/api/opdrachten/${opdrachtId}/bestanden`, {
    method: "POST",
    body: form
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload mislukt.");
  return data as { ok: true; bestandId: string };
}

export async function hernoemBestand(bestandId: string, origineleNaam: string) {
  const res = await apiFetch(`/api/bestanden/${bestandId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origineleNaam })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Hernoemen mislukt.");
  return data as { ok: true; bestand: BestandsKoppeling };
}

export async function verwijderBestand(bestandId: string) {
  const res = await apiFetch(`/api/bestanden/${bestandId}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Verwijderen mislukt.");
}

function triggerBrowserDownload(blob: Blob, bestandsnaam: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam.replace(/[\\/:*?"<>|]/g, "_").trim() || "document";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

export type BestandBron = "opdracht" | "financieel-post" | "financieel-inzending";

export function bestandBekijkUrl(
  bestandId: string,
  bron: BestandBron = "opdracht"
): string | null {
  const token = getToken();
  if (!token) return null;
  const pad =
    bron === "financieel-post"
      ? `/api/admin/financieel/bestanden/${encodeURIComponent(bestandId)}/download`
      : bron === "financieel-inzending"
        ? `/api/financieel-inzendingen/bestanden/${encodeURIComponent(bestandId)}/download`
        : `/api/bestanden/${encodeURIComponent(bestandId)}/download`;
  return `${pad}?access_token=${encodeURIComponent(token)}&inline=1`;
}

export function openBestandInNieuwTab(url: string): boolean {
  const win = window.open(url, "_blank");
  return Boolean(win);
}

export async function fetchBestandBlob(bestandId: string, bestandsnaam = ""): Promise<Blob> {
  const res = await apiFetch(`/api/bestanden/${encodeURIComponent(bestandId)}/download`);
  if (!res.ok) {
    const data = await readApiJson(res).catch(() => ({ error: "Kon bestand niet ophalen." }));
    throw new Error(String(data.error || "Kon bestand niet ophalen."));
  }
  return normaliseerBestandBlob(await res.blob(), bestandsnaam, res.headers.get("content-type"));
}

/** Download een bestand via de beveiligde API (Authorization-header). */
export async function downloadBestand(bestandId: string, bestandsnaam: string): Promise<void> {
  const blob = await fetchBestandBlob(bestandId, bestandsnaam);
  if (blob.size) {
    triggerBrowserDownload(blob, bestandsnaam || "document");
    return;
  }
  const token = getToken();
  if (!token) throw new Error("Download mislukt: het bestand is leeg.");
  const a = document.createElement("a");
  a.href = `/api/bestanden/${encodeURIComponent(bestandId)}/download?access_token=${encodeURIComponent(token)}`;
  a.download = (bestandsnaam || "document").replace(/[\\/:*?"<>|]/g, "_").trim() || "document";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type FinancieelType = "INKOMST" | "UITGAVE" | "KASGELD" | "OVERDRACHT";
export type FinancieelStatus = "OPEN" | "BETAALD";
export type FinancieelValuta = "EUR" | "USD" | "SRD" | "XCG";
export type FinancieelBetalingswijze = "OPGEHAALD" | "PINPAS" | "OVERGEMAAKT" | "GESTORT";
export type FinancieelKasEffect = "NEE" | "ERBIJ" | "AF";
export type FinancieelGebruikSoort = "AF" | "ERBIJ";

export interface FinancieelGebruik {
  id: string;
  datum: string;
  soort: FinancieelGebruikSoort;
  bedrag: number;
  waaraan: string;
  bank?: string;
  /** Naam van medewerker bij overdracht vanuit dit bedrag. */
  medewerker?: string;
  /** Doelvaluta bij "Valuta omzetten". */
  doelValuta?: FinancieelValuta | "";
  /** Wisselkoers voor omzetting (bron -> doel). */
  wisselkoers?: number | null;
  /** Berekend doelbedrag in doelvaluta. */
  doelBedrag?: number | null;
  /** Klant bij inkomst die in de kas erbij komt. */
  klantNaam?: string;
  /** JA = betaling op bestaand klantsaldo, NEE = nieuwe inkomst. */
  heeftSaldo?: "JA" | "NEE" | "";
  /** Openstaand saldo dat later nog betaald moet worden. */
  saldoBedrag?: number | null;
  toelichting?: string;
}

export interface FinancieelInzendingBijlage {
  id: string;
  origineleNaam: string;
  mimeType: string;
  grootte: number;
}

export interface FinancieelPost {
  id: string;
  datum: string;
  type: FinancieelType;
  omschrijving: string;
  bedrag: number;
  valuta?: FinancieelValuta;
  categorie?: string;
  referentie?: string;
  klantNaam?: string;
  opdrachtId?: string | null;
  afgehandeldDoorUserId?: string | null;
  afgehandeldDoorNaam?: string;
  betalingswijze?: FinancieelBetalingswijze | null;
  kasEffect?: FinancieelKasEffect | null;
  bank?: string;
  geldBijUserId?: string | null;
  geldBijNaam?: string;
  geldVanUserId?: string | null;
  geldVanNaam?: string;
  wisselkoers?: number | null;
  status: FinancieelStatus;
  notities?: string;
  gebruikingen?: FinancieelGebruik[];
  bijlagen?: FinancieelInzendingBijlage[];
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchFinancieel(): Promise<FinancieelPost[]> {
  const res = await apiFetch("/api/admin/financieel");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon financiële administratie niet ophalen.");
  return (data.posten || []) as FinancieelPost[];
}

export async function createFinancieelPost(
  post: Omit<FinancieelPost, "id" | "createdAt" | "updatedAt">
): Promise<FinancieelPost> {
  const res = await apiFetch("/api/admin/financieel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon financiële post niet aanmaken.");
  return data.post as FinancieelPost;
}

export async function updateFinancieelPost(
  id: string,
  post: Omit<FinancieelPost, "id" | "createdAt" | "updatedAt">
): Promise<FinancieelPost> {
  const res = await apiFetch(`/api/admin/financieel/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon financiële post niet opslaan.");
  return data.post as FinancieelPost;
}

export async function deleteFinancieelPost(id: string): Promise<void> {
  const res = await apiFetch(`/api/admin/financieel/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Kon financiële post niet verwijderen.");
  }
}

export async function fetchFinancieelBackup(): Promise<FinancieelBackupBestand> {
  const res = await apiFetch("/api/admin/financieel/backup");
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon financiële backup niet maken."));
  return data as unknown as FinancieelBackupBestand;
}

export async function restoreFinancieelBackup(backup: FinancieelBackupBestand): Promise<{
  posten: number;
  postBijlagen: number;
  inzendingen: number;
  inzendingBijlagen: number;
  afsluitingen?: AfsluitingRapport[];
  instellingen?: { standaardValuta?: FinancieelValuta };
}> {
  const res = await apiFetch("/api/admin/financieel/backup/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(backup)
  });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon financiële backup niet terugzetten."));
  return {
    posten: Number(data.posten) || 0,
    postBijlagen: Number(data.postBijlagen) || 0,
    inzendingen: Number(data.inzendingen) || 0,
    inzendingBijlagen: Number(data.inzendingBijlagen) || 0,
    afsluitingen: (data.afsluitingen || []) as AfsluitingRapport[],
    instellingen: (data.instellingen || {}) as { standaardValuta?: FinancieelValuta }
  };
}

export async function uploadFinancieelPostBestanden(
  postId: string,
  bestanden: File[]
): Promise<FinancieelPost> {
  const form = new FormData();
  for (const file of bestanden) form.append("bestanden", file);
  const res = await apiFetch(`/api/admin/financieel/${postId}/bestanden`, {
    method: "POST",
    body: form
  });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon foto’s niet toevoegen."));
  return data.post as FinancieelPost;
}

export async function fetchFinancieelPostBijlageBlob(bijlageId: string, bestandsnaam = ""): Promise<Blob> {
  const res = await apiFetch(`/api/admin/financieel/bestanden/${bijlageId}/download`);
  if (!res.ok) {
    const data = await readApiJson(res).catch(() => ({ error: "Download mislukt." }));
    throw new Error(String(data.error || "Download mislukt."));
  }
  return normaliseerBestandBlob(await res.blob(), bestandsnaam, res.headers.get("content-type"));
}

export async function downloadFinancieelPostBijlage(bijlageId: string, bestandsnaam = "foto"): Promise<void> {
  const blob = await fetchFinancieelPostBijlageBlob(bijlageId, bestandsnaam);
  triggerBrowserDownload(blob, bestandsnaam);
}

export async function deleteFinancieelPostBijlage(bijlageId: string): Promise<void> {
  const res = await apiFetch(`/api/admin/financieel/bestanden/${bijlageId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await readApiJson(res).catch(() => ({ error: "Verwijderen mislukt." }));
    throw new Error(String(data.error || "Kon foto niet verwijderen."));
  }
}

export type FinancieelInzendingStatus = "NIEUW" | "GEZIEN" | "VERWERKT";

export interface FinancieelInzending {
  id: string;
  createdAt: string;
  vanUserId: string;
  vanNaam: string;
  datum: string;
  type: FinancieelType;
  omschrijving: string;
  bedrag: number;
  valuta: FinancieelValuta;
  wisselkoers?: number | null;
  categorie?: string;
  referentie?: string;
  klantNaam?: string;
  betalingswijze?: FinancieelBetalingswijze | null;
  kasEffect?: FinancieelKasEffect | null;
  bank?: string;
  geldBijNaam?: string;
  geldVanNaam?: string;
  waaraan?: string;
  notities?: string;
  status: FinancieelInzendingStatus;
  bijlagen?: FinancieelInzendingBijlage[];
}

export async function fetchFinancieelInzendingen(): Promise<{
  inzendingen: FinancieelInzending[];
  ongelezen: number;
}> {
  const res = await apiFetch("/api/financieel-inzendingen");
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon financiële inzendingen niet ophalen."));
  return {
    inzendingen: (data.inzendingen || []) as FinancieelInzending[],
    ongelezen: Number(data.ongelezen) || 0
  };
}

export async function createFinancieelInzending(
  inzending: Omit<FinancieelInzending, "id" | "createdAt" | "vanUserId" | "vanNaam" | "status" | "bijlagen">,
  bestanden: File[] = []
): Promise<FinancieelInzending> {
  const form = new FormData();
  form.append("datum", inzending.datum);
  form.append("type", inzending.type);
  form.append("omschrijving", inzending.omschrijving);
  form.append("bedrag", String(inzending.bedrag));
  form.append("valuta", inzending.valuta);
  if (inzending.wisselkoers != null) form.append("wisselkoers", String(inzending.wisselkoers));
  if (inzending.categorie) form.append("categorie", inzending.categorie);
  if (inzending.referentie) form.append("referentie", inzending.referentie);
  if (inzending.klantNaam) form.append("klantNaam", inzending.klantNaam);
  if (inzending.betalingswijze) form.append("betalingswijze", inzending.betalingswijze);
  if (inzending.kasEffect) form.append("kasEffect", inzending.kasEffect);
  if (inzending.bank) form.append("bank", inzending.bank);
  if (inzending.geldBijNaam) form.append("geldBijNaam", inzending.geldBijNaam);
  if (inzending.geldVanNaam) form.append("geldVanNaam", inzending.geldVanNaam);
  if (inzending.waaraan) form.append("waaraan", inzending.waaraan);
  if (inzending.notities) form.append("notities", inzending.notities);
  for (const file of bestanden) form.append("bestanden", file);
  const res = await apiFetch("/api/financieel-inzendingen", {
    method: "POST",
    body: form
  });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon financiële info niet versturen."));
  return data.inzending as FinancieelInzending;
}

export async function downloadInzendingBijlage(bijlageId: string, bestandsnaam = "foto"): Promise<void> {
  const blob = await fetchInzendingBijlageBlob(bijlageId, bestandsnaam);
  triggerBrowserDownload(blob, bestandsnaam);
}

export async function fetchInzendingBijlageBlob(bijlageId: string, bestandsnaam = ""): Promise<Blob> {
  const res = await apiFetch(`/api/financieel-inzendingen/bestanden/${bijlageId}/download`);
  if (!res.ok) {
    const data = await readApiJson(res).catch(() => ({ error: "Download mislukt." }));
    throw new Error(String(data.error || "Download mislukt."));
  }
  return normaliseerBestandBlob(await res.blob(), bestandsnaam, res.headers.get("content-type"));
}

export async function updateFinancieelInzendingStatus(
  id: string,
  status: FinancieelInzendingStatus
): Promise<FinancieelInzending> {
  const res = await apiFetch(`/api/financieel-inzendingen/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon inzending niet bijwerken."));
  return data.inzending as FinancieelInzending;
}

import { HelpVideoInfo } from "./helpConfig";

export function helpVideoStreamUrl(): string {
  const token = getToken();
  if (!token) return "/api/help/video/stream";
  return `/api/help/video/stream?access_token=${encodeURIComponent(token)}`;
}

export function helpVideoDownloadUrl(): string {
  const token = getToken();
  if (!token) return "/api/help/video/download";
  return `/api/help/video/download?access_token=${encodeURIComponent(token)}`;
}

export async function downloadHelpVideo(bestandsnaam: string): Promise<void> {
  const res = await apiFetch("/api/help/video/download");
  if (!res.ok) {
    const data = await readApiJson(res).catch(() => ({ error: "Download mislukt." }));
    throw new Error(String(data.error || "Download mislukt."));
  }
  const blob = await res.blob();
  if (blob.size) {
    triggerBrowserDownload(blob, bestandsnaam || "uitlegvideo.mp4");
    return;
  }
  const a = document.createElement("a");
  a.href = helpVideoDownloadUrl();
  a.download = (bestandsnaam || "uitlegvideo.mp4").replace(/[\\/:*?"<>|]/g, "_").trim() || "uitlegvideo.mp4";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fetchHelpVideo(): Promise<HelpVideoInfo | null> {
  const res = await apiFetch("/api/help/video");
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon uitlegvideo niet ophalen."));
  const video = data.video as HelpVideoInfo | null | undefined;
  if (video?.playbackUrl) return video;
  const legacyUrl = String(data.url || "").trim();
  if (legacyUrl) {
    return { source: legacyUrl.includes("/api/help/video/stream") ? "file" : "link", playbackUrl: legacyUrl };
  }
  return null;
}

/** @deprecated gebruik fetchHelpVideo */
export async function fetchHelpVideoUrl(): Promise<string> {
  const video = await fetchHelpVideo();
  return video?.playbackUrl || "";
}

export async function saveHelpVideoUrl(url: string): Promise<HelpVideoInfo | null> {
  const res = await apiFetch("/api/admin/help/video", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon uitlegvideo niet opslaan."));
  return (data.video as HelpVideoInfo | null) || null;
}

export async function uploadHelpVideoFile(file: File): Promise<HelpVideoInfo | null> {
  const form = new FormData();
  form.append("video", file);
  const res = await apiFetch("/api/admin/help/video/upload", {
    method: "POST",
    body: form
  });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon videobestand niet uploaden."));
  return (data.video as HelpVideoInfo | null) || null;
}

export async function deleteHelpVideo(): Promise<void> {
  const res = await apiFetch("/api/admin/help/video", { method: "DELETE" });
  const data = await readApiJson(res);
  if (!res.ok) throw new Error(String(data.error || "Kon uitlegvideo niet verwijderen."));
}

/** @deprecated gebruik deleteHelpVideo */
export async function deleteHelpVideoUrl(): Promise<void> {
  await deleteHelpVideo();
}

