import { Gebruiker, Opdracht } from "./types";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL && (import.meta as any).env.VITE_API_BASE_URL !== "undefined"
    ? (import.meta as any).env.VITE_API_BASE_URL
    : "";

export function getToken() {
  return window.localStorage.getItem("la-solucion-token");
}

export function clearToken() {
  window.localStorage.removeItem("la-solucion-token");
}

async function apiFetch(path: string, init?: RequestInit) {
  const url = `${API_BASE}${path}`;
  const token = getToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function fetchMe(): Promise<Gebruiker> {
  const res = await apiFetch("/api/auth/me");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Kon gebruiker niet ophalen.");
  return data as Gebruiker;
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
  const res = await apiFetch(`/api/opdrachten/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || "Kon opdracht niet verwijderen.");
  }
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

