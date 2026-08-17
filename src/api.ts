import { Gebruiker, Opdracht } from "./types";

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
    throw new Error(
      "De server is niet bijgewerkt of niet bereikbaar. Vernieuw de pagina en probeer het opnieuw."
    );
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error("Ongeldig antwoord van de server.");
  }
}

export async function fetchMe(): Promise<Gebruiker> {
  const res = await apiFetch("/api/auth/me");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon gebruiker niet ophalen.");
  return data as Gebruiker;
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

/** Download een bestand via de beveiligde API (Authorization-header). */
export async function downloadBestand(bestandId: string, bestandsnaam: string): Promise<void> {
  const res = await apiFetch(`/api/bestanden/${bestandId}/download`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Download mislukt.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam || "document";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type FinancieelType = "INKOMST" | "UITGAVE" | "KASGELD" | "OVERDRACHT";
export type FinancieelStatus = "OPEN" | "BETAALD";
export type FinancieelValuta = "EUR" | "USD" | "SRD" | "XCG";
export type FinancieelBetalingswijze = "OPGEHAALD" | "OVERGEMAAKT" | "GESTORT";
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
  toelichting?: string;
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
  bank?: string;
  geldBijUserId?: string | null;
  geldBijNaam?: string;
  geldVanUserId?: string | null;
  geldVanNaam?: string;
  wisselkoers?: number | null;
  status: FinancieelStatus;
  notities?: string;
  gebruikingen?: FinancieelGebruik[];
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

export type FinancieelInzendingStatus = "NIEUW" | "GEZIEN" | "VERWERKT";

export interface FinancieelInzendingBijlage {
  id: string;
  origineleNaam: string;
  mimeType: string;
  grootte: number;
}

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
  const blob = await fetchInzendingBijlageBlob(bijlageId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchInzendingBijlageBlob(bijlageId: string): Promise<Blob> {
  const res = await apiFetch(`/api/financieel-inzendingen/bestanden/${bijlageId}/download`);
  if (!res.ok) {
    const data = await readApiJson(res).catch(() => ({ error: "Download mislukt." }));
    throw new Error(String(data.error || "Download mislukt."));
  }
  return res.blob();
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

