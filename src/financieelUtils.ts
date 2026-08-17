import { FinancieelBetalingswijze, FinancieelPost, FinancieelValuta } from "./api";
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

export function typeLabel(type: FinancieelPost["type"] | string): string {
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
    if (p.type === "INKOMST") {
      t.inkomsten += p.bedrag;
      if (p.status === "OPEN") t.teOntvangen += p.bedrag;
    } else if (p.type === "KASGELD") {
      t.kasgeld += p.bedrag;
    } else if (p.type === "UITGAVE") {
      t.uitgaven += p.bedrag;
      if (p.status === "OPEN") t.teBetalen += p.bedrag;
    }
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
    if (p.type !== "KASGELD" && p.type !== "OVERDRACHT" && p.status !== "BETAALD") continue;
    const valuta = normalizeValuta(p.valuta);
    if (p.type === "INKOMST") {
      const naar = geldNaarPersoon(p);
      if (naar) bumpPersoon(map, naar, valuta, "inkomsten", p.bedrag);
    } else if (p.type === "KASGELD") {
      const naar = geldNaarPersoon(p);
      if (naar) bumpPersoon(map, naar, valuta, "kasgeld", p.bedrag);
    } else if (p.type === "UITGAVE") {
      const van = geldVanPersoon(p);
      if (van) bumpPersoon(map, van, valuta, "uitgaven", p.bedrag);
    } else if (p.type === "OVERDRACHT") {
      const van = geldVanPersoon(p);
      const naar = geldNaarPersoon(p);
      if (van) bumpPersoon(map, van, valuta, "gegevenOverdracht", p.bedrag);
      if (naar) bumpPersoon(map, naar, valuta, "ontvangenOverdracht", p.bedrag);
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
    typeLabel(p.type),
    postStatusLabel(p),
    betalingsLabel(p),
    normalizeValuta(p.valuta),
    String(p.bedrag).replace(".", ","),
    ...extra
  ];
  return velden.some((v) => (v || "").toLowerCase().includes(q));
}

export function berekenKlantSaldi(posten: FinancieelPost[]): KlantSaldo[] {
  const map = new Map<string, SaldoCijfers & { klantNaam: string; valuta: FinancieelValuta }>();

  for (const p of posten) {
    const naam = (p.klantNaam || "").trim();
    if (!naam) continue;
    const valuta = normalizeValuta(p.valuta);
    const key = `${naam.toLowerCase()}||${valuta}`;
    const bestaand = map.get(key) || { klantNaam: naam, valuta, ...leegSaldo() };
    map.set(key, { ...telPostOp(bestaand, p), klantNaam: naam, valuta });
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
    "Status",
    "Betalingswijze",
    "Bank",
    "Afgehandeld door",
    "Bij wie is het geld",
    "Notities"
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
    postStatusLabel(p),
    p.betalingswijze ? BETALINGSWIJZE_LABELS[p.betalingswijze] : "",
    p.bank || "",
    p.afgehandeldDoorNaam || "",
    p.geldBijNaam || "",
    p.notities || ""
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

function htmlEscape(waarde: string): string {
  return waarde
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tabelHtml(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Opent een printvenster; kies “Opslaan als PDF” in het printdialoog. */
export function exportFinancieelPdf(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>
) {
  const klantSaldi = berekenKlantSaldi(posten);
  const dossierSaldi = berekenDossierSaldi(posten, opdrachtenById);
  const geldBij = berekenGeldBijTotalen(posten);
  const totalen = berekenTotalenPerValuta(posten);

  const totalenHtml = totalen.length
    ? `<ul>${totalen
        .map(
          (t) =>
            `<li><strong>${htmlEscape(VALUTA_LABELS[t.valuta])}</strong>: inkomsten ${htmlEscape(
              formatGeld(t.inkomsten, t.valuta)
            )}, uitgaven ${htmlEscape(formatGeld(t.uitgaven, t.valuta))}, saldo ${htmlEscape(
              formatGeld(t.saldo, t.valuta)
            )}</li>`
        )
        .join("")}</ul>`
    : "<p>Geen totalen.</p>";

  const postenTabel = tabelHtml(
    [
      "Datum",
      "Type",
      "Valuta",
      "Wisselkoers",
      "Klant",
      "Dossier",
      "Omschrijving",
      "Bedrag",
      "Status",
      "Betaling",
      "Bij wie"
    ],
    posten.map((p) => [
      formatDatumTijd(p.datum),
      typeLabel(p.type),
      normalizeValuta(p.valuta),
      p.wisselkoers == null ? "—" : String(p.wisselkoers).replace(".", ","),
      p.klantNaam || "—",
      dossierLabelVoorPost(p, opdrachtenById) || "—",
      p.omschrijving,
      formatGeld(p.bedrag, p.valuta),
      postStatusLabel(p),
      betalingsLabel(p) || "—",
      p.geldBijNaam || "—"
    ])
  );

  const geldBijTabel = tabelHtml(
    ["Bij wie", "Valuta", "Inkomsten", "Kasgeld", "Uitgaven", "Totaal", "Posten"],
    geldBij.map((s) => [
      s.naam,
      s.valuta,
      formatGeld(s.inkomsten, s.valuta),
      formatGeld(s.kasgeld, s.valuta),
      formatGeld(s.uitgaven, s.valuta),
      formatGeld(s.totaal, s.valuta),
      String(s.aantalPosten)
    ])
  );

  const klantTabel = tabelHtml(
    [
      "Klant",
      "Valuta",
      "Nog te betalen (klant)",
      "Al betaald",
      "Nog te betalen (wij)",
      "Uitbetaald",
      "Netto",
      "Status"
    ],
    klantSaldi.map((s) => [
      s.klantNaam,
      s.valuta,
      formatGeld(s.teOntvangen, s.valuta),
      formatGeld(s.ontvangen, s.valuta),
      formatGeld(s.teBetalen, s.valuta),
      formatGeld(s.uitbetaald, s.valuta),
      formatGeld(s.netto, s.valuta),
      s.statusLabel
    ])
  );

  const dossierTabel = tabelHtml(
    [
      "Dossier",
      "Valuta",
      "Nog te betalen (klant)",
      "Al betaald",
      "Nog te betalen (wij)",
      "Uitbetaald",
      "Netto",
      "Status"
    ],
    dossierSaldi.map((s) => [
      s.dossierLabel,
      s.valuta,
      formatGeld(s.teOntvangen, s.valuta),
      formatGeld(s.ontvangen, s.valuta),
      formatGeld(s.teBetalen, s.valuta),
      formatGeld(s.uitbetaald, s.valuta),
      formatGeld(s.netto, s.valuta),
      s.statusLabel
    ])
  );

  const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Financiële export – La-Solución</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #10203a; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 1px solid #ccd5e3; padding-bottom: 4px; }
    p { margin: 0 0 8px; color: #44506a; font-size: 13px; }
    .meta { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
    th, td { border: 1px solid #c9d3e2; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #eef3fa; }
    ul { margin: 8px 0; padding-left: 18px; font-size: 13px; }
    @media print {
      body { margin: 12mm; }
      h2 { break-after: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>La-Solución – Financiële administratie</h1>
  <div class="meta">
    <p>Exportdatum: ${htmlEscape(new Date().toLocaleString("nl-NL"))}</p>
    <p>Posten: <strong>${posten.length}</strong></p>
    ${totalenHtml}
  </div>
  <h2>Geld bij personen</h2>
  ${geldBij.length ? geldBijTabel : "<p>Geen bedragen bij personen.</p>"}
  <h2>Klantsaldo’s</h2>
  ${klantSaldi.length ? klantTabel : "<p>Geen klantsaldo’s.</p>"}
  <h2>Dossiersaldo’s</h2>
  ${dossierSaldi.length ? dossierTabel : "<p>Geen dossiersaldo’s.</p>"}
  <h2>Alle posten</h2>
  ${posten.length ? postenTabel : "<p>Geen posten.</p>"}
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Pop-up geblokkeerd. Sta pop-ups toe om de PDF-export te openen.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
