import {
  FinancieelBetalingswijze,
  FinancieelGebruik,
  FinancieelGebruikSoort,
  FinancieelPost,
  FinancieelValuta
} from "./api";
import { Opdracht } from "./types";

export const FINANCIEEL_VALUTAS: FinancieelValuta[] = ["EUR", "USD", "SRD", "XCG"];

export const VALUTA_LABELS: Record<FinancieelValuta, string> = {
  EUR: "Euro (EUR)",
  USD: "US dollar (USD)",
  SRD: "Surinaamse dollar (SRD)",
  XCG: "Caribische gulden (XCG)"
};

export const BETALINGSWIJZE_LABELS: Record<FinancieelBetalingswijze, string> = {
  OPGEHAALD: "Opgehaald door medewerker",
  OVERGEMAAKT: "Overgemaakt",
  GESTORT: "Gestort op bank"
};

/** Banken in Suriname (SBV-leden, verkorte namen). */
export const SURINAAME_BANKEN = [
  "De Surinaamsche Bank (DSB)",
  "Hakrinbank",
  "Republic Bank Suriname",
  "Finabank",
  "Surichange Bank",
  "Surinaamse Postspaarbank",
  "Volkscredietbank (VCB)",
  "Southern Commercial Bank",
  "Godo",
  "Finatrust / Trustbank",
  "Nationale Ontwikkelingsbank (NOB)",
  "Anders / overig"
] as const;

const VALUTA_SYMBOL: Record<FinancieelValuta, string> = {
  EUR: "€",
  USD: "US$",
  SRD: "SRD",
  XCG: "Cg"
};

export function normalizeValuta(waarde?: string | null): FinancieelValuta {
  const v = String(waarde || "EUR").toUpperCase();
  return FINANCIEEL_VALUTAS.includes(v as FinancieelValuta) ? (v as FinancieelValuta) : "EUR";
}

export type SaldoCijfers = {
  teOntvangen: number;
  ontvangen: number;
  teBetalen: number;
  uitbetaald: number;
};

export type KlantSaldo = SaldoCijfers & {
  klantNaam: string;
  valuta: FinancieelValuta;
  netto: number;
  statusLabel: string;
  statusClass: string;
};

export type DossierSaldo = SaldoCijfers & {
  opdrachtId: string;
  klantNaam: string;
  dossierLabel: string;
  valuta: FinancieelValuta;
  netto: number;
  statusLabel: string;
  statusClass: string;
};

export type FinancieelTotalen = {
  valuta: FinancieelValuta;
  inkomsten: number;
  kasgeld: number;
  uitgaven: number;
  saldo: number;
  teOntvangen: number;
  teBetalen: number;
};

export type GeldBijTotaal = {
  naam: string;
  userId: string | null;
  valuta: FinancieelValuta;
  inkomsten: number;
  kasgeld: number;
  uitgaven: number;
  totaal: number;
  aantalPosten: number;
};

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Waarde voor `<input type="datetime-local">` in lokale tijd. */
export function naarDateTimeLocal(waarde: string | Date): string {
  const d = waarde instanceof Date ? waarde : new Date(waarde);
  if (Number.isNaN(d.getTime())) {
    const alleenDatum = String(waarde).slice(0, 10);
    return alleenDatum.length === 10 ? `${alleenDatum}T12:00` : "";
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function nuDateTimeLocal(): string {
  return naarDateTimeLocal(new Date());
}

function geldRondCents(bedrag: number): number {
  return Math.round((Number(bedrag) || 0) * 100) / 100;
}

export const GEBRUIK_BANKSTORTING = "Bankstorting";
export const GEBRUIK_OVERDRACHT_MEDEWERKER = "Overdracht medewerker";
export const GEBRUIK_INKOMST_KAS = "Inkomst kas";
export const GEBRUIK_VALUTA_OMZETTING = "Valuta omzetten";
export const CATEGORIE_OPENINGSKAS = "Beginsaldo dag";

export function isBankstorting(waaraan?: string | null): boolean {
  return (waaraan || "").trim().toLowerCase().startsWith("bankstorting");
}

export function isOverdrachtMedewerker(waaraan?: string | null): boolean {
  return (waaraan || "").trim().toLowerCase().startsWith("overdracht medewerker");
}

export function isInkomstKas(waaraan?: string | null): boolean {
  return (waaraan || "").trim().toLowerCase().startsWith("inkomst kas");
}

export function isValutaOmzetting(waaraan?: string | null): boolean {
  return (waaraan || "").trim().toLowerCase().startsWith("valuta omzetten");
}

export function isOpeningsKas(p: { type?: string; categorie?: string | null }): boolean {
  return p.type === "KASGELD" && (p.categorie || "").trim().toLowerCase().startsWith("beginsaldo");
}

export function totaalOpeningsKas(posten: FinancieelPost[]): number {
  return geldRondCents(
    posten.filter((p) => isOpeningsKas(p)).reduce((s, p) => s + (Number(p.bedrag) || 0), 0)
  );
}

export function normaliseerHeeftSaldo(waarde: unknown): "JA" | "NEE" | "" {
  const v = String(waarde || "").trim().toUpperCase();
  if (v === "JA" || v === "NEE") return v;
  return "";
}

export function bankUitWaaraan(waaraan?: string | null): string {
  const tekst = (waaraan || "").trim();
  if (!isBankstorting(tekst)) return "";
  const delen = tekst.split("·").map((d) => d.trim());
  return delen.length > 1 ? delen.slice(1).join(" · ") : "";
}

export function medewerkerUitWaaraan(waaraan?: string | null): string {
  const tekst = (waaraan || "").trim();
  if (!isOverdrachtMedewerker(tekst)) return "";
  const delen = tekst.split("·").map((d) => d.trim());
  return delen.length > 1 ? delen.slice(1).join(" · ") : "";
}

export function medewerkerUitGebruik(g: {
  waaraan?: string;
  medewerker?: string;
}): string {
  return (g.medewerker || "").trim() || medewerkerUitWaaraan(g.waaraan);
}

export function gebruikWaaraanTekst(g: {
  waaraan?: string;
  bank?: string;
  medewerker?: string;
  doelValuta?: string;
  wisselkoers?: number | null;
  doelBedrag?: number | null;
  klantNaam?: string;
}): string {
  const waar = (g.waaraan || "").trim();
  const bank = (g.bank || "").trim() || bankUitWaaraan(waar);
  const medewerker = medewerkerUitGebruik(g);
  const klant = (g.klantNaam || "").trim();
  if (isBankstorting(waar) && bank) return `${GEBRUIK_BANKSTORTING} · ${bank}`;
  if (isBankstorting(waar)) return GEBRUIK_BANKSTORTING;
  if (isOverdrachtMedewerker(waar) && medewerker) {
    return `${GEBRUIK_OVERDRACHT_MEDEWERKER} · ${medewerker}`;
  }
  if (isOverdrachtMedewerker(waar)) return GEBRUIK_OVERDRACHT_MEDEWERKER;
  if (isValutaOmzetting(waar)) {
    const doelRaw = String(g.doelValuta || "").toUpperCase();
    const doel = ["EUR", "USD", "SRD", "XCG"].includes(doelRaw) ? (doelRaw as FinancieelValuta) : "";
    const koers = Number(g.wisselkoers);
    const doelBedrag = Number(g.doelBedrag);
    if (doel && Number.isFinite(koers) && koers > 0) {
      const doelTekst = Number.isFinite(doelBedrag) && doelBedrag > 0
        ? ` · ${doel} (${geldRondCents(doelBedrag)})`
        : ` · ${doel}`;
      return `${GEBRUIK_VALUTA_OMZETTING}${doelTekst} · koers ${koers}`;
    }
    if (doel) return `${GEBRUIK_VALUTA_OMZETTING} · ${doel}`;
    return GEBRUIK_VALUTA_OMZETTING;
  }
  if (isInkomstKas(waar) && klant) return `${GEBRUIK_INKOMST_KAS} · ${klant}`;
  if (isInkomstKas(waar)) return GEBRUIK_INKOMST_KAS;
  return waar;
}

export function omzettingDoelBedrag(g: {
  bedrag?: number;
  wisselkoers?: number | null;
  doelBedrag?: number | null;
}): number {
  const direct = Number(g.doelBedrag);
  if (Number.isFinite(direct) && direct > 0) return geldRondCents(direct);
  const bedrag = Number(g.bedrag);
  const koers = Number(g.wisselkoers);
  if (!Number.isFinite(bedrag) || bedrag <= 0 || !Number.isFinite(koers) || koers <= 0) return 0;
  return geldRondCents(bedrag * koers);
}

export function nieuweGebruikId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `g-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normaliseerGebruikingen(waarde: unknown): FinancieelGebruik[] {
  if (!Array.isArray(waarde)) return [];
  const uit: FinancieelGebruik[] = [];
  for (const raw of waarde) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<FinancieelGebruik>;
    const bedrag = Number(item.bedrag);
    const soort: FinancieelGebruikSoort = item.soort === "ERBIJ" ? "ERBIJ" : "AF";
    if (!Number.isFinite(bedrag) || bedrag <= 0) continue;
    const datum = String(item.datum || "").trim();
    const waaraan = String(item.waaraan || "").trim();
    uit.push({
      id: String(item.id || nieuweGebruikId()),
      datum: datum || new Date().toISOString(),
      soort,
      bedrag: geldRondCents(bedrag),
      waaraan: isInkomstKas(waaraan) ? GEBRUIK_INKOMST_KAS : waaraan,
      bank: String(item.bank || "").trim() || bankUitWaaraan(waaraan),
      medewerker:
        String(item.medewerker || "").trim() || medewerkerUitWaaraan(waaraan),
      doelValuta: ["EUR", "USD", "SRD", "XCG"].includes(String(item.doelValuta || "").toUpperCase())
        ? String(item.doelValuta || "").toUpperCase()
        : "",
      wisselkoers: Number.isFinite(Number(item.wisselkoers)) && Number(item.wisselkoers) > 0
        ? Number(item.wisselkoers)
        : null,
      doelBedrag: Number.isFinite(Number(item.doelBedrag)) && Number(item.doelBedrag) > 0
        ? geldRondCents(Number(item.doelBedrag))
        : null,
      klantNaam: String(item.klantNaam || "").trim(),
      heeftSaldo: normaliseerHeeftSaldo(item.heeftSaldo),
      toelichting: String(item.toelichting || "").trim()
    });
  }
  return uit.sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
}

export function totaalGebruikAf(p: { gebruikingen?: FinancieelGebruik[] }): number {
  return geldRondCents(
    normaliseerGebruikingen(p.gebruikingen)
      .filter((g) => g.soort === "AF")
      .reduce((s, g) => s + g.bedrag, 0)
  );
}

export function totaalGebruikErbij(p: { gebruikingen?: FinancieelGebruik[] }): number {
  return geldRondCents(
    normaliseerGebruikingen(p.gebruikingen)
      .filter((g) => g.soort === "ERBIJ")
      .reduce((s, g) => s + g.bedrag, 0)
  );
}

export function inkomstKasRegels(p: { gebruikingen?: FinancieelGebruik[] }): FinancieelGebruik[] {
  return normaliseerGebruikingen(p.gebruikingen).filter(
    (g) => g.soort === "ERBIJ" && isInkomstKas(g.waaraan)
  );
}

export function totaalInkomstKas(p: { gebruikingen?: FinancieelGebruik[] }): number {
  return geldRondCents(inkomstKasRegels(p).reduce((s, g) => s + g.bedrag, 0));
}

export function isBesteedGebruik(g: { soort?: string; waaraan?: string }): boolean {
  if (g.soort !== "AF") return false;
  if (isOverdrachtMedewerker(g.waaraan)) return false;
  if (isBankstorting(g.waaraan)) return false;
  if (isValutaOmzetting(g.waaraan)) return false;
  return true;
}

export function omzettingRegelsNaarValuta(
  p: { gebruikingen?: FinancieelGebruik[] },
  valuta: FinancieelValuta
): FinancieelGebruik[] {
  const doel = normalizeValuta(valuta);
  return normaliseerGebruikingen(p.gebruikingen).filter(
    (g) =>
      g.soort === "AF" &&
      isValutaOmzetting(g.waaraan) &&
      String(g.doelValuta || "").toUpperCase() === doel
  );
}

export function totaalOmzettingNaarValuta(
  p: { gebruikingen?: FinancieelGebruik[] },
  valuta: FinancieelValuta
): number {
  return geldRondCents(
    omzettingRegelsNaarValuta(p, valuta).reduce((s, g) => s + omzettingDoelBedrag(g), 0)
  );
}

export function besteedRegels(p: { gebruikingen?: FinancieelGebruik[] }): FinancieelGebruik[] {
  return normaliseerGebruikingen(p.gebruikingen).filter(isBesteedGebruik);
}

export function totaalBesteedUitGebruik(p: { gebruikingen?: FinancieelGebruik[] }): number {
  return geldRondCents(besteedRegels(p).reduce((s, g) => s + g.bedrag, 0));
}

/** Besteed/eraf-regels die extra uitgave zijn (niet al geteld via een UITGAVE-post). */
export function extraUitgaveUitGebruik(p: FinancieelPost): number {
  const besteed = totaalBesteedUitGebruik(p);
  if (!besteed) return 0;
  if (p.type === "UITGAVE") return 0;
  return besteed;
}

/** Extra inkomst bovenop een bestaande INKOMST-post (betaling op andere post telt volledig). */
export function extraInkomstUitGebruik(p: FinancieelPost): number {
  return extraInkomstUitGebruikVoorValuta(p, normalizeValuta(p.valuta));
}

export function extraInkomstUitGebruikVoorValuta(
  p: FinancieelPost,
  valuta: FinancieelValuta
): number {
  const postValuta = normalizeValuta(p.valuta);
  const eigenValuta = postValuta === normalizeValuta(valuta);
  const kas = eigenValuta ? totaalInkomstKas(p) : 0;
  const omzetting = totaalOmzettingNaarValuta(p, normalizeValuta(valuta));
  if (!eigenValuta) return omzetting;
  if (!kas) return 0;
  if (p.type === "INKOMST" && p.status === "OPEN") {
    return geldRondCents(Math.max(0, kas - (Number(p.bedrag) || 0)) + omzetting);
  }
  if (p.type === "INKOMST") return geldRondCents(kas + omzetting);
  return geldRondCents(kas + omzetting);
}

/** Origineel bedrag plus erbij, minus afgetrokken — het origineel zelf blijft ongewijzigd. */
export function restantBedrag(p: { bedrag?: number; gebruikingen?: FinancieelGebruik[] }): number {
  return geldRondCents((Number(p.bedrag) || 0) + totaalGebruikErbij(p) - totaalGebruikAf(p));
}

export function gebruikingenSamenvatting(p: { gebruikingen?: FinancieelGebruik[] }): string {
  const items = normaliseerGebruikingen(p.gebruikingen);
  if (items.length === 0) return "";
  return items
    .map((g) => {
      const waar = gebruikWaaraanTekst(g);
      const richting = g.soort === "ERBIJ" ? (isInkomstKas(g.waaraan) ? "inkomst in kas" : "erbij") : "af";
      const saldo = g.heeftSaldo === "JA" ? "op saldo" : g.heeftSaldo === "NEE" ? "geen saldo" : "";
      return [richting, String(g.bedrag), waar, saldo].filter(Boolean).join(" · ");
    })
    .join("; ");
}

/** Opslaan als ISO-string (lokale datetime-local → UTC). */
export function dateTimeLocalNaarIso(waarde: string): string {
  const d = new Date(waarde);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Ongeldige datum/tijd.");
  }
  return d.toISOString();
}

export function formatDatumTijd(waarde: string): string {
  const d = new Date(waarde);
  if (Number.isNaN(d.getTime())) return waarde;
  return d.toLocaleString("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export function formatGeld(bedrag: number, valuta: FinancieelValuta | string = "EUR"): string {
  const code = normalizeValuta(valuta);
  try {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: code,
      currencyDisplay: "symbol"
    }).format(bedrag);
  } catch {
    return `${VALUTA_SYMBOL[code]} ${bedrag.toLocaleString("nl-NL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}

/** @deprecated Gebruik formatGeld */
export function formatEuro(bedrag: number): string {
  return formatGeld(bedrag, "EUR");
}

export function opdrachtDossierLabel(o: Opdracht): string {
  const desc = (o.omschrijving || "Geen omschrijving").trim();
  const short = desc.length > 55 ? `${desc.slice(0, 52)}…` : desc;
  return `${o.klantNaam} – ${short}`;
}

export function saldoStatus(s: SaldoCijfers): { statusLabel: string; statusClass: string } {
  if (s.teOntvangen > 0 && s.teBetalen > 0) {
    return { statusLabel: "Open posten beide kanten", statusClass: "saldo-mix" };
  }
  if (s.teOntvangen > 0) {
    return { statusLabel: "Klant moet nog betalen", statusClass: "saldo-te-ontvangen" };
  }
  if (s.teBetalen > 0) {
    return { statusLabel: "Wij moeten nog betalen", statusClass: "saldo-te-betalen" };
  }
  return { statusLabel: "Alles betaald", statusClass: "saldo-ok" };
}

function leegSaldo(): SaldoCijfers {
  return { teOntvangen: 0, ontvangen: 0, teBetalen: 0, uitbetaald: 0 };
}

function telPostOp(entry: SaldoCijfers, p: FinancieelPost): SaldoCijfers {
  const next = { ...entry };
  if (p.type === "KASGELD" || p.type === "OVERDRACHT") return next;
  if (p.type === "INKOMST") {
    if (p.status === "OPEN") next.teOntvangen += p.bedrag;
    else next.ontvangen += p.bedrag;
  } else if (p.status === "OPEN") {
    next.teBetalen += p.bedrag;
  } else {
    next.uitbetaald += p.bedrag;
  }
  return next;
}

export function typeLabel(type: FinancieelPost["type"] | string, post?: Pick<FinancieelPost, "categorie">): string {
  if (type === "KASGELD" && post && isOpeningsKas({ type, categorie: post.categorie })) {
    return "Openingskas";
  }
  if (type === "INKOMST") return "Inkomst";
  if (type === "UITGAVE") return "Uitgave";
  if (type === "KASGELD") return "Kasgeld";
  if (type === "OVERDRACHT") return "Overdracht";
  return String(type || "");
}

export function berekenTotalenPerValuta(posten: FinancieelPost[]): FinancieelTotalen[] {
  const map = new Map<FinancieelValuta, FinancieelTotalen>();
  for (const code of FINANCIEEL_VALUTAS) {
    map.set(code, {
      valuta: code,
      inkomsten: 0,
      kasgeld: 0,
      uitgaven: 0,
      saldo: 0,
      teOntvangen: 0,
      teBetalen: 0
    });
  }

  for (const p of posten) {
    const valuta = normalizeValuta(p.valuta);
    const t = map.get(valuta)!;
    const extra = extraInkomstUitGebruik(p);
    const betaaldViaRegel = totaalInkomstKas(p);
    if (p.type === "INKOMST") {
      t.inkomsten += p.bedrag + extra;
      if (p.status === "OPEN") {
        t.teOntvangen += Math.max(0, p.bedrag - betaaldViaRegel);
      }
    } else if (p.type === "KASGELD") {
      t.kasgeld += p.bedrag;
      t.inkomsten += extra;
    } else if (p.type === "UITGAVE") {
      t.uitgaven += p.bedrag;
      t.inkomsten += extra;
      if (p.status === "OPEN") t.teBetalen += p.bedrag;
    } else {
      t.inkomsten += extra;
    }
    t.uitgaven += extraUitgaveUitGebruik(p);
  }

  for (const t of map.values()) {
    t.saldo = t.inkomsten + t.kasgeld - t.uitgaven;
  }

  return FINANCIEEL_VALUTAS.map((v) => map.get(v)!).filter(
    (t) =>
      t.inkomsten > 0 ||
      t.kasgeld > 0 ||
      t.uitgaven > 0 ||
      t.teOntvangen > 0 ||
      t.teBetalen > 0
  );
}

type GeldPersoon = { naam: string; userId: string | null };

function geldPersoon(naam?: string | null, userId?: string | null): GeldPersoon | null {
  const n = (naam || "").trim();
  const id = (userId || "").trim() || null;
  if (!n && !id) return null;
  return { naam: n || "Onbekend", userId: id };
}

export function geldVanPersoon(p: FinancieelPost): GeldPersoon | null {
  const expliciet = geldPersoon(p.geldVanNaam, p.geldVanUserId);
  if (expliciet) return expliciet;
  if (p.type === "UITGAVE") {
    return geldPersoon(p.geldBijNaam, p.geldBijUserId) || geldPersoon(p.afgehandeldDoorNaam, p.afgehandeldDoorUserId);
  }
  return null;
}

export function geldNaarPersoon(p: FinancieelPost): GeldPersoon | null {
  const expliciet = geldPersoon(p.geldBijNaam, p.geldBijUserId);
  if (expliciet) return expliciet;
  if (p.type === "INKOMST" || p.type === "KASGELD") {
    return geldPersoon(p.afgehandeldDoorNaam, p.afgehandeldDoorUserId);
  }
  return null;
}

function geldBijIdentiteit(p: FinancieelPost): GeldPersoon | null {
  return geldNaarPersoon(p);
}

function persoonSleutel(wie: GeldPersoon, valuta: FinancieelValuta): string {
  return `${wie.userId || wie.naam.toLowerCase()}||${valuta}`;
}

function bumpPersoon(
  map: Map<
    string,
    {
      naam: string;
      userId: string | null;
      valuta: FinancieelValuta;
      inkomsten: number;
      kasgeld: number;
      uitgaven: number;
      ontvangenOverdracht: number;
      gegevenOverdracht: number;
      aantalPosten: number;
    }
  >,
  wie: GeldPersoon,
  valuta: FinancieelValuta,
  veld: "inkomsten" | "kasgeld" | "uitgaven" | "ontvangenOverdracht" | "gegevenOverdracht",
  bedrag: number
) {
  const key = persoonSleutel(wie, valuta);
  const bestaand = map.get(key) || {
    naam: wie.naam,
    userId: wie.userId,
    valuta,
    inkomsten: 0,
    kasgeld: 0,
    uitgaven: 0,
    ontvangenOverdracht: 0,
    gegevenOverdracht: 0,
    aantalPosten: 0
  };
  bestaand[veld] += bedrag;
  bestaand.aantalPosten += 1;
  if (!bestaand.naam || bestaand.naam === "Onbekend") bestaand.naam = wie.naam;
  map.set(key, bestaand);
}

/** Totaal geld dat nu bij iemand is, per persoon en valuta. */
export function berekenGeldBijTotalen(posten: FinancieelPost[]): GeldBijTotaal[] {
  const map = new Map<
    string,
    {
      naam: string;
      userId: string | null;
      valuta: FinancieelValuta;
      inkomsten: number;
      kasgeld: number;
      uitgaven: number;
      ontvangenOverdracht: number;
      gegevenOverdracht: number;
      aantalPosten: number;
    }
  >();

  for (const p of posten) {
    const valuta = normalizeValuta(p.valuta);
    const teltAlsKas = p.type === "KASGELD" || p.type === "OVERDRACHT" || p.status === "BETAALD";
    if (teltAlsKas) {
      if (p.type === "INKOMST") {
        const naar = geldNaarPersoon(p);
        if (naar) bumpPersoon(map, naar, valuta, "inkomsten", restantBedrag(p));
      } else if (p.type === "KASGELD") {
        const naar = geldNaarPersoon(p);
        if (naar) bumpPersoon(map, naar, valuta, "kasgeld", restantBedrag(p));
      } else if (p.type === "UITGAVE") {
        const van = geldVanPersoon(p);
        if (van) bumpPersoon(map, van, valuta, "uitgaven", restantBedrag(p));
      } else if (p.type === "OVERDRACHT") {
        const van = geldVanPersoon(p);
        const naar = geldNaarPersoon(p);
        const restant = restantBedrag(p);
        if (van) bumpPersoon(map, van, valuta, "gegevenOverdracht", restant);
        if (naar) bumpPersoon(map, naar, valuta, "ontvangenOverdracht", restant);
      }

      // Overdracht naar medewerker vanuit gebruiksregels: kas blijft gelijk, geld verplaatst.
      for (const g of normaliseerGebruikingen(p.gebruikingen)) {
        if (g.soort !== "AF" || !isOverdrachtMedewerker(g.waaraan)) continue;
        const naam = medewerkerUitGebruik(g);
        if (!naam) continue;
        bumpPersoon(map, { naam, userId: null }, valuta, "ontvangenOverdracht", g.bedrag);
      }
      for (const g of normaliseerGebruikingen(p.gebruikingen)) {
        if (g.soort !== "AF" || !isValutaOmzetting(g.waaraan)) continue;
        const doelValuta = String(g.doelValuta || "").toUpperCase();
        if (!["EUR", "USD", "SRD", "XCG"].includes(doelValuta)) continue;
        const doelBedrag = omzettingDoelBedrag(g);
        if (!doelBedrag) continue;
        const naar = geldNaarPersoon(p) || geldVanPersoon(p);
        if (naar) bumpPersoon(map, naar, doelValuta as FinancieelValuta, "kasgeld", doelBedrag);
      }
    } else {
      // Open post: inkomst-regels tellen wél mee in de kas.
      for (const g of normaliseerGebruikingen(p.gebruikingen)) {
        if (g.soort !== "ERBIJ" || !isInkomstKas(g.waaraan)) continue;
        const naar = geldNaarPersoon(p) || geldVanPersoon(p);
        if (naar) bumpPersoon(map, naar, valuta, "inkomsten", g.bedrag);
      }
      for (const g of normaliseerGebruikingen(p.gebruikingen)) {
        if (g.soort !== "AF" || !isValutaOmzetting(g.waaraan)) continue;
        const doelValuta = String(g.doelValuta || "").toUpperCase();
        if (!["EUR", "USD", "SRD", "XCG"].includes(doelValuta)) continue;
        const doelBedrag = omzettingDoelBedrag(g);
        if (!doelBedrag) continue;
        const naar = geldNaarPersoon(p) || geldVanPersoon(p);
        if (naar) bumpPersoon(map, naar, doelValuta as FinancieelValuta, "kasgeld", doelBedrag);
      }
    }
  }

  return [...map.values()]
    .map((s) => ({
      naam: s.naam,
      userId: s.userId,
      valuta: s.valuta,
      inkomsten: s.inkomsten,
      kasgeld: s.kasgeld,
      uitgaven: s.uitgaven,
      aantalPosten: s.aantalPosten,
      totaal: s.inkomsten + s.kasgeld + s.ontvangenOverdracht - s.uitgaven - s.gegevenOverdracht
    }))
    .sort((a, b) => {
      if (a.totaal !== b.totaal) return b.totaal - a.totaal;
      const naam = a.naam.localeCompare(b.naam, "nl");
      if (naam !== 0) return naam;
      return a.valuta.localeCompare(b.valuta);
    });
}

/** Contant dat nu bij medewerkers/kas is (restanten + overdrachten, geen openstaande posten). */
export function huidigKasSaldo(posten: FinancieelPost[], valuta: FinancieelValuta): number {
  return geldRondCents(
    berekenGeldBijTotalen(posten)
      .filter((r) => r.valuta === valuta)
      .reduce((s, r) => s + r.totaal, 0)
  );
}

export function financieelPostMatchtZoekterm(
  p: FinancieelPost,
  zoekterm: string,
  extra: string[] = []
): boolean {
  const q = zoekterm.trim().toLowerCase();
  if (!q) return true;
  const velden = [
    p.klantNaam,
    p.geldBijNaam,
    p.geldVanNaam,
    p.afgehandeldDoorNaam,
    p.omschrijving,
    p.categorie,
    p.referentie,
    p.notities,
    p.bank,
    gebruikingenSamenvatting(p),
    typeLabel(p.type),
    postStatusLabel(p),
    betalingsLabel(p),
    normalizeValuta(p.valuta),
    String(p.bedrag).replace(".", ","),
    ...extra
  ];
  return velden.some((v) => (v || "").toLowerCase().includes(q));
}

function bumpKlantSaldo(
  map: Map<string, SaldoCijfers & { klantNaam: string; valuta: FinancieelValuta }>,
  klantNaam: string,
  valuta: FinancieelValuta
) {
  const key = `${klantNaam.toLowerCase()}||${valuta}`;
  return {
    key,
    bestaand: map.get(key) || { klantNaam, valuta, ...leegSaldo() }
  };
}

export function berekenKlantSaldi(posten: FinancieelPost[]): KlantSaldo[] {
  const map = new Map<string, SaldoCijfers & { klantNaam: string; valuta: FinancieelValuta }>();

  for (const p of posten) {
    const valuta = normalizeValuta(p.valuta);
    const naam = (p.klantNaam || "").trim();
    if (naam) {
      const { key, bestaand } = bumpKlantSaldo(map, naam, valuta);
      map.set(key, { ...telPostOp(bestaand, p), klantNaam: naam, valuta });
    }
    for (const g of normaliseerGebruikingen(p.gebruikingen)) {
      if (g.soort !== "ERBIJ" || !isInkomstKas(g.waaraan)) continue;
      const klant = (g.klantNaam || "").trim();
      if (!klant) continue;
      const { key, bestaand } = bumpKlantSaldo(map, klant, valuta);
      bestaand.ontvangen += g.bedrag;
      const settle = Math.min(bestaand.teOntvangen, g.bedrag);
      bestaand.teOntvangen = geldRondCents(bestaand.teOntvangen - settle);
      map.set(key, { ...bestaand, klantNaam: klant, valuta });
    }
  }

  return [...map.values()]
    .map((s) => {
      const netto = s.teOntvangen - s.teBetalen;
      return { ...s, netto, ...saldoStatus(s) };
    })
    .sort((a, b) => {
      const aOpen = a.teOntvangen + a.teBetalen;
      const bOpen = b.teOntvangen + b.teBetalen;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const naam = a.klantNaam.localeCompare(b.klantNaam, "nl");
      if (naam !== 0) return naam;
      return a.valuta.localeCompare(b.valuta);
    });
}

export function berekenDossierSaldi(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>
): DossierSaldo[] {
  const map = new Map<
    string,
    SaldoCijfers & { opdrachtId: string; valuta: FinancieelValuta }
  >();

  for (const p of posten) {
    const id = (p.opdrachtId || "").trim();
    if (!id) continue;
    const valuta = normalizeValuta(p.valuta);
    const key = `${id}||${valuta}`;
    const bestaand = map.get(key) || { opdrachtId: id, valuta, ...leegSaldo() };
    map.set(key, { ...telPostOp(bestaand, p), opdrachtId: id, valuta });
  }

  return [...map.values()]
    .map((s) => {
      const opdracht = opdrachtenById.get(s.opdrachtId);
      const klantNaam =
        opdracht?.klantNaam?.trim() ||
        posten.find((p) => p.opdrachtId === s.opdrachtId)?.klantNaam?.trim() ||
        "Onbekende klant";
      const dossierLabel = opdracht
        ? opdrachtDossierLabel(opdracht)
        : `${klantNaam} – (dossier niet meer beschikbaar)`;
      const netto = s.teOntvangen - s.teBetalen;
      return {
        ...s,
        klantNaam,
        dossierLabel,
        netto,
        ...saldoStatus(s)
      };
    })
    .sort((a, b) => {
      const aOpen = a.teOntvangen + a.teBetalen;
      const bOpen = b.teOntvangen + b.teBetalen;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const label = a.dossierLabel.localeCompare(b.dossierLabel, "nl");
      if (label !== 0) return label;
      return a.valuta.localeCompare(b.valuta);
    });
}

export function postStatusLabel(p: FinancieelPost): string {
  if (p.type === "KASGELD") return "In kas";
  if (p.type === "OVERDRACHT") return "Overgedragen";
  if (p.status === "BETAALD") {
    return p.type === "INKOMST" ? "Betaald door klant" : "Uitbetaald";
  }
  return p.type === "INKOMST" ? "Klant moet nog betalen" : "Wij moeten nog betalen";
}

export function betalingsLabel(p: FinancieelPost): string {
  const wijze = p.betalingswijze;
  if (!wijze) {
    return p.afgehandeldDoorNaam ? `Afgehandeld · ${p.afgehandeldDoorNaam}` : "";
  }
  if (wijze === "OPGEHAALD") {
    return p.afgehandeldDoorNaam
      ? `Opgehaald · ${p.afgehandeldDoorNaam}`
      : BETALINGSWIJZE_LABELS.OPGEHAALD;
  }
  const bank = (p.bank || "").trim();
  if (wijze === "OVERGEMAAKT") {
    return bank ? `Overgemaakt · ${bank}` : BETALINGSWIJZE_LABELS.OVERGEMAAKT;
  }
  return bank ? `Gestort · ${bank}` : BETALINGSWIJZE_LABELS.GESTORT;
}

export function klantSaldoVoor(
  saldi: KlantSaldo[],
  klantNaam: string,
  valuta: FinancieelValuta
): KlantSaldo | undefined {
  const naam = klantNaam.trim().toLowerCase();
  if (!naam) return undefined;
  return saldi.find((s) => s.klantNaam.trim().toLowerCase() === naam && s.valuta === valuta);
}

export function klantSaldoSamenvatting(saldo: KlantSaldo | undefined, valuta: FinancieelValuta): string {
  if (!saldo) return `Nog geen saldo voor deze klant in ${valuta}.`;
  const delen: string[] = [];
  if (saldo.teOntvangen > 0) {
    delen.push(`nog te ontvangen ${formatGeld(saldo.teOntvangen, valuta)}`);
  }
  if (saldo.teBetalen > 0) {
    delen.push(`nog te betalen door ons ${formatGeld(saldo.teBetalen, valuta)}`);
  }
  if (delen.length === 0) {
    return `Geen open saldo (${valuta}). Netto open: ${formatGeld(saldo.netto, valuta)}.`;
  }
  return `Open saldo (${valuta}): ${delen.join(" · ")}.`;
}

function csvEscape(waarde: string | number): string {
  return `"${String(waarde).replace(/"/g, '""')}"`;
}

function downloadCsv(bestandsnaam: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");
  // BOM voor correcte weergave van € en tekens in Excel.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);
}

function dossierLabelVoorPost(
  p: FinancieelPost,
  opdrachtenById: Map<string, Opdracht>
): string {
  if (!p.opdrachtId) return "";
  const o = opdrachtenById.get(p.opdrachtId);
  return o ? opdrachtDossierLabel(o) : "Dossier niet beschikbaar";
}

export function exportFinancieelPostenCsv(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>
) {
  const headers = [
    "Datum",
    "Type",
    "Valuta",
    "Wisselkoers",
    "Klant",
    "Dossier",
    "Omschrijving",
    "Categorie",
    "Referentie",
    "Bedrag",
    "Afgetrokken",
    "Erbij",
    "Restant",
    "Gebruik van dit bedrag",
    "Status",
    "Betalingswijze",
    "Bank",
    "Afgehandeld door",
    "Geld van",
    "Bij wie is het geld",
    "Notities",
    "ID"
  ];
  const rows = posten.map((p) => [
    p.datum.includes("T") ? formatDatumTijd(p.datum) : p.datum.slice(0, 10),
    typeLabel(p.type),
    normalizeValuta(p.valuta),
    p.wisselkoers == null ? "" : String(p.wisselkoers).replace(".", ","),
    p.klantNaam || "",
    dossierLabelVoorPost(p, opdrachtenById),
    p.omschrijving,
    p.categorie || "",
    p.referentie || "",
    String(p.bedrag).replace(".", ","),
    String(totaalGebruikAf(p)).replace(".", ","),
    String(totaalGebruikErbij(p)).replace(".", ","),
    String(restantBedrag(p)).replace(".", ","),
    gebruikingenSamenvatting(p),
    postStatusLabel(p),
    p.betalingswijze ? BETALINGSWIJZE_LABELS[p.betalingswijze] : "",
    p.bank || "",
    p.afgehandeldDoorNaam || "",
    p.geldVanNaam || "",
    p.geldBijNaam || "",
    p.notities || "",
    p.id
  ]);
  downloadCsv(`financieel-posten-${vandaagIso()}.csv`, headers, rows);
}

export function exportKlantSaldiCsv(posten: FinancieelPost[]) {
  const saldi = berekenKlantSaldi(posten);
  const headers = [
    "Klant",
    "Valuta",
    "Nog te betalen (klant)",
    "Al betaald (klant)",
    "Nog te betalen (wij)",
    "Al uitbetaald",
    "Netto open",
    "Status"
  ];
  const rows = saldi.map((s) => [
    s.klantNaam,
    s.valuta,
    String(s.teOntvangen).replace(".", ","),
    String(s.ontvangen).replace(".", ","),
    String(s.teBetalen).replace(".", ","),
    String(s.uitbetaald).replace(".", ","),
    String(s.netto).replace(".", ","),
    s.statusLabel
  ]);
  downloadCsv(`financieel-klantsaldi-${vandaagIso()}.csv`, headers, rows);
}

export function exportDossierSaldiCsv(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>
) {
  const saldi = berekenDossierSaldi(posten, opdrachtenById);
  const headers = [
    "Klant",
    "Dossier",
    "Valuta",
    "Nog te betalen (klant)",
    "Al betaald (klant)",
    "Nog te betalen (wij)",
    "Al uitbetaald",
    "Netto open",
    "Status"
  ];
  const rows = saldi.map((s) => [
    s.klantNaam,
    s.dossierLabel,
    s.valuta,
    String(s.teOntvangen).replace(".", ","),
    String(s.ontvangen).replace(".", ","),
    String(s.teBetalen).replace(".", ","),
    String(s.uitbetaald).replace(".", ","),
    String(s.netto).replace(".", ","),
    s.statusLabel
  ]);
  downloadCsv(`financieel-dossiersaldi-${vandaagIso()}.csv`, headers, rows);
}