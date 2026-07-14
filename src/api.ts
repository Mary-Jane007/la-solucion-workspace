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
  return fetch(path, { cache: "no-store", ...init, headers });
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

export type FinancieelType = "INKOMST" | "UITGAVE";
export type FinancieelStatus = "OPEN" | "BETAALD";
export type FinancieelValuta = "EUR" | "USD" | "SRD" | "XCG";
export type FinancieelBetalingswijze = "OPGEHAALD" | "OVERGEMAAKT" | "GESTORT";

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
  status: FinancieelStatus;
  notities?: string;
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

