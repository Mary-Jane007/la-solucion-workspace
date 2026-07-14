export type BadgeLijst =
  | "home"
  | "bord"
  | "kalender"
  | "mijn-opdrachten"
  | "meldingen"
  | "deadlines"
  | "activiteit"
  | "klanten"
  | "documenten"
  | "prullenbak";

function gezienKey(lijst: BadgeLijst, userId: string) {
  return `la-solucion-${lijst}-gezien:${userId}`;
}

function geopendKey(lijst: BadgeLijst, userId: string) {
  return `la-solucion-${lijst}-geopend:${userId}`;
}

function leesIds(key: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function schrijfIds(key: string, ids: Set<string>) {
  window.localStorage.setItem(key, JSON.stringify([...ids]));
}

export function leesGezieneIds(lijst: BadgeLijst, userId: string): Set<string> {
  return leesIds(gezienKey(lijst, userId));
}

export function leesGeopendeIds(lijst: BadgeLijst, userId: string): Set<string> {
  return leesIds(geopendKey(lijst, userId));
}

export function markeerIdsGezien(lijst: BadgeLijst, userId: string, itemIds: string[]): Set<string> {
  const ids = leesGezieneIds(lijst, userId);
  for (const id of itemIds) ids.add(id);
  schrijfIds(gezienKey(lijst, userId), ids);
  return ids;
}

export function markeerIdGeopend(lijst: BadgeLijst, userId: string, itemId: string): Set<string> {
  const ids = leesGeopendeIds(lijst, userId);
  ids.add(itemId);
  schrijfIds(geopendKey(lijst, userId), ids);
  return ids;
}

export function telNieuweIds(itemIds: string[], gezien: Set<string>): number {
  return itemIds.filter((id) => !gezien.has(id)).length;
}

export function leesGezieneMeldingIds(userId: string) {
  return leesGezieneIds("meldingen", userId);
}

export function leesGeopendeMeldingIds(userId: string) {
  return leesGeopendeIds("meldingen", userId);
}

export function markeerMeldingenGezien(userId: string, meldingIds: string[]) {
  return markeerIdsGezien("meldingen", userId, meldingIds);
}

export function markeerMeldingGeopend(userId: string, meldingId: string) {
  return markeerIdGeopend("meldingen", userId, meldingId);
}

export function telNieuweMeldingen(meldingIds: string[], gezien: Set<string>) {
  return telNieuweIds(meldingIds, gezien);
}
