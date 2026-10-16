import { FinancieelInzending, FinancieelType, FinancieelValuta, KasSuggestieTegel } from "./api";
import {
  CATEGORIE_MUNTENBAK,
  CATEGORIE_OPENINGSKAS,
  GEBRUIK_MUNTENBAK,
  GEBRUIK_OVERDRACHT_MEDEWERKER,
  parseGeldInvoer
} from "./financieelUtils";
import { UITGAVE_CATEGORIEEN } from "./financieelDashboardUtils";

export const MAX_KAS_FOTOS = 5;
export const MAX_KAS_FOTO_BYTES = 8 * 1024 * 1024;
export const KAS_DAG_VALUTAS: FinancieelValuta[] = ["SRD", "USD", "EUR", "XCG"];

export type KasSoort = "UITGAVE" | "INKOMST" | "MUNTENBAK" | "OVERDRACHT";

export type KasTegel = {
  id: string;
  label: string;
  hint: string;
  soort: KasSoort;
  icoon: string;
  slim?: boolean;
};

export type KasDagRegel = {
  id: string;
  tegelId: string;
  label: string;
  soort: KasSoort;
  bedrag: string;
  extra: string;
  notitie: string;
  verzondenId?: string;
};

export type KasDagConcept = {
  dag: string;
  valuta: FinancieelValuta;
  openingskas: string;
  eindkas: string;
  regels: KasDagRegel[];
  openingVerzonden?: boolean;
  tellingVerzonden?: boolean;
};

export const VASTE_UITGAVE_TEGELS: KasTegel[] = [
  { id: "benzine", label: "Benzine", hint: "Tankbon", soort: "UITGAVE", icoon: "⛽" },
  { id: "uitprinten", label: "Uitprinten", hint: "Printen of kopie", soort: "UITGAVE", icoon: "🖨" },
  { id: "taxi", label: "Taxi", hint: "Vervoer", soort: "UITGAVE", icoon: "🚕" },
  { id: "eten", label: "Eten", hint: "Lunch of snack", soort: "UITGAVE", icoon: "🍽" }
];

const SLIM_ICOON: Record<string, string> = {
  medilab: "🏥",
  bankkosten: "🏦",
  "professionele diensten": "💼",
  belkaart: "📱",
  ebs: "💡",
  szf: "🏥"
};

export const VASTE_ANDERE_TEGELS: KasTegel[] = [
  { id: "inkomst", label: "Klant betaalde", hint: "Geld ontvangen", soort: "INKOMST", icoon: "💵" },
  { id: "muntenbak", label: "Naar muntenbak", hint: "Muntgeld weggelegd", soort: "MUNTENBAK", icoon: "🪙" },
  { id: "overdracht", label: "Geld overgedragen", hint: "Aan een collega", soort: "OVERDRACHT", icoon: "🤝" },
  { id: "overig", label: "Iets anders", hint: "Zelf opschrijven", soort: "UITGAVE", icoon: "📝" }
];

export function lokaleDagIso(datum = new Date()): string {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`;
}

export function gisterenIso(vanaf = new Date()): string {
  const d = new Date(vanaf);
  d.setDate(d.getDate() - 1);
  return lokaleDagIso(d);
}

export function formatDagLang(dag: string): string {
  const [jaar, maand, dagNr] = dag.split("-").map(Number);
  const d = new Date(jaar, (maand || 1) - 1, dagNr || 1);
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

export function kasOpslagSleutel(userId: string, dag: string): string {
  return `la-solucion-kas-dag-${userId}-${dag}`;
}

export function leesKasConcept(userId: string, dag: string): KasDagConcept | null {
  try {
    const ruw = window.localStorage.getItem(kasOpslagSleutel(userId, dag));
    if (!ruw) return null;
    const data = JSON.parse(ruw) as KasDagConcept;
    if (!data || data.dag !== dag || !Array.isArray(data.regels)) return null;
    return data;
  } catch {
    return null;
  }
}

export function bewaarKasConcept(userId: string, concept: KasDagConcept): void {
  try {
    window.localStorage.setItem(kasOpslagSleutel(userId, concept.dag), JSON.stringify(concept));
  } catch {
    /* quota of privémodus: concept blijft in geheugen */
  }
}

export function leegKasConcept(dag: string, valuta: FinancieelValuta = "SRD"): KasDagConcept {
  return { dag, valuta, openingskas: "", eindkas: "", regels: [] };
}

export function bouwTegels(slim: KasSuggestieTegel[]): { vaak: KasTegel[]; ook: KasTegel[] } {
  const gezien = new Set(VASTE_UITGAVE_TEGELS.map((t) => t.label.toLowerCase()));
  const extra: KasTegel[] = [];
  for (const item of slim) {
    const label = String(item.label || "").trim();
    if (!label) continue;
    const sleutel = label.toLowerCase();
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    extra.push({
      id: item.id || `slim-${sleutel.replace(/\s+/g, "-")}`,
      label,
      hint: "Vaak bij jullie",
      soort: "UITGAVE",
      icoon: SLIM_ICOON[sleutel] || "📌",
      slim: true
    });
  }
  return {
    vaak: [...VASTE_UITGAVE_TEGELS, ...extra],
    ook: VASTE_ANDERE_TEGELS
  };
}

function uitgaveCategorie(label: string): string {
  const match = UITGAVE_CATEGORIEEN.find((c) => c.toLowerCase() === label.toLowerCase());
  return match || "Overige";
}

export function isKasTellingInzending(item: Pick<FinancieelInzending, "omschrijving" | "categorie" | "type">): boolean {
  const tekst = `${item.omschrijving} ${item.categorie || ""}`.toLowerCase();
  return (
    item.type === "KASGELD" &&
    (tekst.includes("openingskas") ||
      tekst.includes("beginsaldo") ||
      tekst.includes("eindtelling") ||
      tekst.includes("kas-telling"))
  );
}

export type KasInzendingPayload = {
  datum: string;
  type: FinancieelType;
  omschrijving: string;
  bedrag: number;
  valuta: FinancieelValuta;
  categorie: string;
  referentie: string;
  klantNaam: string;
  betalingswijze: "OPGEHAALD" | null;
  kasEffect: null;
  bank: string;
  geldBijNaam: string;
  geldVanNaam: string;
  waaraan: string;
  notities: string;
};

export function regelNaarPayload(
  regel: KasDagRegel,
  opties: { datum: string; valuta: FinancieelValuta; medewerkerNaam: string }
): KasInzendingPayload | { fout: string } {
  const bedrag = parseGeldInvoer(regel.bedrag);
  if (bedrag === null || bedrag < 0) return { fout: "Vul een geldig bedrag in." };
  const extra = regel.extra.trim();
  const notitie = regel.notitie.trim();
  const naam = opties.medewerkerNaam;
  const basis = {
    datum: opties.datum,
    bedrag,
    valuta: opties.valuta,
    referentie: "",
    betalingswijze: "OPGEHAALD" as const,
    kasEffect: null,
    bank: "",
    notities: notitie
  };

  if (regel.soort === "INKOMST") {
    return {
      ...basis,
      type: "INKOMST",
      omschrijving: extra || "Inkomst kas",
      categorie: "",
      klantNaam: extra,
      geldBijNaam: naam,
      geldVanNaam: "",
      waaraan: ""
    };
  }
  if (regel.soort === "MUNTENBAK") {
    return {
      ...basis,
      type: "KASGELD",
      omschrijving: "Muntenbak",
      categorie: CATEGORIE_MUNTENBAK,
      klantNaam: "",
      geldBijNaam: "",
      geldVanNaam: naam,
      waaraan: GEBRUIK_MUNTENBAK
    };
  }
  if (regel.soort === "OVERDRACHT") {
    if (!extra) return { fout: "Zeg aan wie je het geld gaf." };
    return {
      ...basis,
      type: "OVERDRACHT",
      omschrijving: `Overdracht aan ${extra}`,
      categorie: "",
      klantNaam: "",
      geldBijNaam: extra,
      geldVanNaam: naam,
      waaraan: GEBRUIK_OVERDRACHT_MEDEWERKER
    };
  }
  const label = regel.tegelId === "overig" ? extra || regel.label : regel.label;
  if (regel.tegelId === "overig" && !extra) return { fout: "Schrijf kort op wat het was." };
  return {
    ...basis,
    type: "UITGAVE",
    omschrijving: label,
    categorie: uitgaveCategorie(label),
    klantNaam: "",
    geldBijNaam: "",
    geldVanNaam: naam,
    waaraan: label
  };
}

export function tellingNaarPayload(
  soort: "opening" | "einde",
  bedragTekst: string,
  opties: { datum: string; valuta: FinancieelValuta; medewerkerNaam: string; notitie?: string }
): KasInzendingPayload | { fout: string } {
  const bedrag = parseGeldInvoer(bedragTekst);
  if (bedrag === null || bedrag < 0) return { fout: "Vul een geldig kasbedrag in." };
  const opening = soort === "opening";
  return {
    datum: opties.datum,
    type: "KASGELD",
    omschrijving: opening ? "Openingskas vanochtend" : "Eindtelling kas",
    bedrag,
    valuta: opties.valuta,
    categorie: opening ? CATEGORIE_OPENINGSKAS : "Eindtelling kas",
    referentie: "",
    klantNaam: "",
    betalingswijze: null,
    kasEffect: null,
    bank: "",
    geldBijNaam: opties.medewerkerNaam,
    geldVanNaam: "",
    waaraan: "",
    notities: opties.notitie || ""
  };
}

export function kasEffectVanRegel(soort: KasSoort): number {
  if (soort === "INKOMST") return 1;
  return -1;
}

export function verwachtRestant(concept: KasDagConcept): number | null {
  const start = parseGeldInvoer(concept.openingskas);
  if (start === null) return null;
  let rest = start;
  for (const regel of concept.regels) {
    const bedrag = parseGeldInvoer(regel.bedrag);
    if (bedrag === null) continue;
    rest += bedrag * kasEffectVanRegel(regel.soort);
  }
  return Math.round(rest * 100) / 100;
}

export function inzendingNaarRegel(item: FinancieelInzending): KasDagRegel | null {
  if (isKasTellingInzending(item)) return null;
  const soort: KasSoort =
    item.type === "INKOMST"
      ? "INKOMST"
      : item.type === "OVERDRACHT"
        ? "OVERDRACHT"
        : String(item.categorie || item.waaraan || "").toLowerCase().includes("muntenbak")
          ? "MUNTENBAK"
          : "UITGAVE";
  const label =
    soort === "MUNTENBAK"
      ? "Naar muntenbak"
      : soort === "OVERDRACHT"
        ? "Geld overgedragen"
        : soort === "INKOMST"
          ? "Klant betaalde"
          : item.omschrijving || item.waaraan || "Uitgave";
  const match = [...VASTE_UITGAVE_TEGELS, ...VASTE_ANDERE_TEGELS].find(
    (tegel) => tegel.label.toLowerCase() === label.toLowerCase()
  );
  return {
    id: `kopie-${item.id}`,
    tegelId: match?.id || (soort === "UITGAVE" ? "overig" : soort.toLowerCase()),
    label,
    soort,
    bedrag: "",
    extra:
      soort === "OVERDRACHT"
        ? item.geldBijNaam || ""
        : soort === "INKOMST"
          ? item.klantNaam || ""
          : match && match.id !== "overig"
            ? ""
            : soort === "UITGAVE"
              ? item.omschrijving || ""
              : "",
    notitie: ""
  };
}
