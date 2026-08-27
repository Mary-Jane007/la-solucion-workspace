import { FinancieelPost, FinancieelValuta } from "./api";
import {
  berekenGeldBijTotalen,
  betalingsLabel,
  huidigKasSaldo,
  FINANCIEEL_VALUTAS,
  extraInkomstUitGebruik,
  extraUitgaveUitGebruik,
  formatDatumTijd,
  formatGeld,
  geldNaarPersoon,
  geldVanPersoon,
  gebruikingenSamenvatting,
  gebruikWaaraanTekst,
  inkomstKasRegels,
  besteedRegels,
  isBesteedGebruik,
  isInkomstKas,
  isValutaOmzetting,
  isOpeningsKas,
  isOverdrachtMedewerker,
  medewerkerUitGebruik,
  normaliseerGebruikingen,
  normalizeValuta,
  omzettingDoelBedrag,
  postStatusLabel,
  totaalInkomstKas,
  totaalBesteedUitGebruik,
  typeLabel
} from "./financieelUtils";
import { Opdracht } from "./types";

export type FinancieelTabId =
  | "overzicht"
  | "inzendingen"
  | "vandaag"
  | "inkomsten"
  | "uitgaven"
  | "openstaand"
  | "facturen"
  | "klantbetalingen"
  | "kosten"
  | "winstverlies"
  | "cashflow"
  | "analyses"
  | "rapportages"
  | "instellingen"
  | "dagboek"
  | "followmoney";

export const FINANCIEEL_TABS: Array<{ id: FinancieelTabId; label: string; hint: string }> = [
  { id: "overzicht", label: "Overzicht", hint: "KPI’s en gezondheid" },
  { id: "inzendingen", label: "Inzendingen", hint: "Info van medewerkers" },
  { id: "vandaag", label: "Vandaag", hint: "Dagelijks verslag" },
  { id: "followmoney", label: "Follow the money", hint: "Geldspoor per dag" },
  { id: "dagboek", label: "Dagboek", hint: "Alle transacties" },
  { id: "inkomsten", label: "Inkomsten", hint: "Ontvangsten" },
  { id: "uitgaven", label: "Uitgaven", hint: "Kostenposten" },
  { id: "openstaand", label: "Openstaand", hint: "Nog te ontvangen" },
  { id: "facturen", label: "Facturen", hint: "Via referentie" },
  { id: "klantbetalingen", label: "Klantbetalingen", hint: "Per klant" },
  { id: "kosten", label: "Kosten", hint: "Per categorie" },
  { id: "winstverlies", label: "Winst & verlies", hint: "Resultaat" },
  { id: "cashflow", label: "Cashflow", hint: "Geld in/uit" },
  { id: "analyses", label: "Analyses", hint: "Grafieken" },
  { id: "rapportages", label: "Rapportages", hint: "Export & afsluiting" },
  { id: "instellingen", label: "Instellingen", hint: "Voorkeuren" }
];

export type PeriodeSleutel =
  | "vandaag"
  | "week"
  | "maand"
  | "vorige_maand"
  | "kwartaal"
  | "jaar"
  | "aangepast";

export const PERIODE_OPTIES: Array<{ id: PeriodeSleutel; label: string }> = [
  { id: "vandaag", label: "Vandaag" },
  { id: "week", label: "Deze week" },
  { id: "maand", label: "Deze maand" },
  { id: "vorige_maand", label: "Vorige maand" },
  { id: "kwartaal", label: "Dit kwartaal" },
  { id: "jaar", label: "Dit jaar" },
  { id: "aangepast", label: "Aangepaste periode" }
];

export const UITGAVE_CATEGORIEEN = [
  "Kantoor",
  "Personeel",
  "Software",
  "Marketing",
  "Transport",
  "Communicatie",
  "Huur",
  "Apparatuur",
  "Administratie",
  "Bankkosten",
  "Belastingen",
  "Professionele diensten",
  "Overige"
] as const;

export const INKOMST_DIENSTEN = [
  "Visa",
  "Vergunning",
  "Legalisatie",
  "Advies",
  "Vertaling",
  "Overige dienstverlening"
] as const;

export type DatumBereik = { van: Date; tot: Date; label: string };

function startVanDag(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function eindeVanDag(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startVanWeek(d: Date): Date {
  const x = startVanDag(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function startVanMaand(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function eindeVanMaand(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startVanKwartaal(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1, 0, 0, 0, 0);
}

/** Cent-nauwkeurige som (vermijdt float-drift). */
export function geldSom(bedragen: number[]): number {
  let cents = 0;
  for (const b of bedragen) {
    cents += Math.round((Number(b) || 0) * 100);
  }
  return cents / 100;
}

export function geldRond(bedrag: number): number {
  return Math.round((Number(bedrag) || 0) * 100) / 100;
}

export function postDatum(p: FinancieelPost): Date {
  const d = new Date(p.datum);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function isZelfdeLokaleDag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function berekenPeriode(
  sleutel: PeriodeSleutel,
  nu = new Date(),
  custom?: { van: string; tot: string }
): DatumBereik {
  if (sleutel === "aangepast" && custom?.van && custom?.tot) {
    return {
      van: startVanDag(new Date(custom.van)),
      tot: eindeVanDag(new Date(custom.tot)),
      label: `${custom.van} – ${custom.tot}`
    };
  }
  switch (sleutel) {
    case "vandaag":
      return { van: startVanDag(nu), tot: eindeVanDag(nu), label: "Vandaag" };
    case "week":
      return { van: startVanWeek(nu), tot: eindeVanDag(nu), label: "Deze week" };
    case "vorige_maand": {
      const vorige = new Date(nu.getFullYear(), nu.getMonth() - 1, 15);
      return {
        van: startVanMaand(vorige),
        tot: eindeVanMaand(vorige),
        label: "Vorige maand"
      };
    }
    case "kwartaal":
      return { van: startVanKwartaal(nu), tot: eindeVanDag(nu), label: "Dit kwartaal" };
    case "jaar":
      return {
        van: new Date(nu.getFullYear(), 0, 1, 0, 0, 0, 0),
        tot: eindeVanDag(nu),
        label: "Dit jaar"
      };
    case "maand":
    default:
      return { van: startVanMaand(nu), tot: eindeVanDag(nu), label: "Deze maand" };
  }
}

/** Vorige vergelijkbare periode van dezelfde lengte. */
export function vorigePeriode(bereik: DatumBereik): DatumBereik {
  const ms = bereik.tot.getTime() - bereik.van.getTime();
  const tot = new Date(bereik.van.getTime() - 1);
  const van = new Date(tot.getTime() - ms);
  return { van, tot, label: "Vorige periode" };
}

export function filterPostenInPeriode(posten: FinancieelPost[], bereik: DatumBereik): FinancieelPost[] {
  const vanMs = bereik.van.getTime();
  const totMs = bereik.tot.getTime();
  return posten.filter((p) => {
    const t = postDatum(p).getTime();
    return t >= vanMs && t <= totMs;
  });
}

export function filterOpValuta(
  posten: FinancieelPost[],
  valuta: "ALLE" | FinancieelValuta
): FinancieelPost[] {
  if (valuta === "ALLE") return posten;
  return posten.filter((p) => normalizeValuta(p.valuta) === valuta);
}

export type KpiKaart = {
  id: string;
  label: string;
  waarde: string;
  hint?: string;
  tone: "groen" | "rood" | "oranje" | "blauw" | "neutraal";
  deltaPct: number | null;
  deltaLabel: string | null;
};

export type DashboardKpis = {
  valuta: FinancieelValuta;
  inkomsten: number;
  uitgaven: number;
  kasgeld: number;
  inKas: number;
  netto: number;
  openstaand: number;
  ontvangen: number;
  teOntvangen: number;
  transacties: number;
  gemPerDag: number;
  gemPerKlant: number;
  grootsteUitgave: FinancieelPost | null;
  grootsteInkomst: FinancieelPost | null;
  kaarten: KpiKaart[];
};

function deltaPct(huidig: number, vorig: number): number | null {
  if (vorig === 0) return huidig === 0 ? 0 : null;
  return Math.round(((huidig - vorig) / Math.abs(vorig)) * 1000) / 10;
}

function formatDelta(pct: number | null, omgekeerd = false): string | null {
  if (pct == null) return null;
  const teken = pct > 0 ? "+" : "";
  return `${teken}${pct.toLocaleString("nl-NL")}% t.o.v. vorige periode`;
}

function kpiToneVoorDelta(
  pct: number | null,
  omgekeerd = false
): "groen" | "rood" | "neutraal" {
  if (pct == null || pct === 0) return "neutraal";
  const positief = omgekeerd ? pct < 0 : pct > 0;
  return positief ? "groen" : "rood";
}

function basisTotalen(posten: FinancieelPost[]) {
  let inkomsten = 0;
  let uitgaven = 0;
  let kasgeld = 0;
  let openstaand = 0;
  let ontvangen = 0;
  let teOntvangen = 0;
  const klanten = new Set<string>();

  for (const p of posten) {
    if (p.type === "INKOMST") {
      inkomsten = geldRond(inkomsten + p.bedrag);
      if (p.status === "BETAALD") ontvangen = geldRond(ontvangen + p.bedrag);
      else {
        teOntvangen = geldRond(teOntvangen + p.bedrag);
        openstaand = geldRond(openstaand + p.bedrag);
      }
      if (p.klantNaam?.trim()) klanten.add(p.klantNaam.trim().toLowerCase());
    } else if (p.type === "KASGELD") {
      kasgeld = geldRond(kasgeld + p.bedrag);
    } else if (p.type === "UITGAVE") {
      uitgaven = geldRond(uitgaven + p.bedrag);
      if (p.status === "OPEN") openstaand = geldRond(openstaand + p.bedrag);
    }

    const extra = extraInkomstUitGebruik(p);
    const extraUit = extraUitgaveUitGebruik(p);
    const betaaldViaRegel = totaalInkomstKas(p);
    if (extra) inkomsten = geldRond(inkomsten + extra);
    if (extraUit) uitgaven = geldRond(uitgaven + extraUit);
    if (betaaldViaRegel) {
      ontvangen = geldRond(ontvangen + betaaldViaRegel);
      if (p.type === "INKOMST" && p.status === "OPEN") {
        const settle = Math.min(p.bedrag, betaaldViaRegel);
        teOntvangen = geldRond(Math.max(0, teOntvangen - settle));
        openstaand = geldRond(Math.max(0, openstaand - settle));
      }
    }
    for (const g of inkomstKasRegels(p)) {
      if (g.klantNaam?.trim()) klanten.add(g.klantNaam.trim().toLowerCase());
    }
  }

  return {
    inkomsten,
    uitgaven,
    kasgeld,
    openstaand,
    ontvangen,
    teOntvangen,
    netto: geldRond(inkomsten + kasgeld - uitgaven),
    klanten: klanten.size,
    transacties: posten.length
  };
}

export function berekenDashboardKpis(
  posten: FinancieelPost[],
  vorigePosten: FinancieelPost[],
  valuta: FinancieelValuta,
  dagenInPeriode: number,
  kasPosten: FinancieelPost[] = posten
): DashboardKpis {
  const hBasis = basisTotalen(posten);
  const vBasis = basisTotalen(vorigePosten);
  const inKas = huidigKasSaldo(kasPosten, valuta);
  const vInKas = huidigKasSaldo(vorigePosten, valuta);
  const h = {
    ...hBasis,
    kasgeld: inKas,
    netto: geldRond(hBasis.inkomsten + inKas - hBasis.uitgaven)
  };
  const v = {
    ...vBasis,
    kasgeld: vInKas,
    netto: geldRond(vBasis.inkomsten + vInKas - vBasis.uitgaven)
  };
  const dagen = Math.max(1, dagenInPeriode);
  const gemPerDag = geldRond(h.inkomsten / dagen);
  const gemPerKlant = h.klanten > 0 ? geldRond(h.inkomsten / h.klanten) : 0;

  const grootsteUitgave =
    posten
      .map((p) => ({
        p,
        bedrag: p.type === "UITGAVE" ? p.bedrag : extraUitgaveUitGebruik(p)
      }))
      .filter((x) => x.bedrag > 0)
      .sort((a, b) => b.bedrag - a.bedrag)[0]?.p || null;
  const grootsteInkomst =
    posten
      .filter((p) => p.type === "INKOMST" || p.type === "KASGELD")
      .sort((a, b) => b.bedrag - a.bedrag)[0] || null;

  const dIn = deltaPct(h.inkomsten, v.inkomsten);
  const dUit = deltaPct(h.uitgaven, v.uitgaven);
  const dNetto = deltaPct(h.netto, v.netto);
  const dOpen = deltaPct(h.teOntvangen, v.teOntvangen);
  const dOntv = deltaPct(h.ontvangen, v.ontvangen);

  const kaarten: KpiKaart[] = [
    {
      id: "inkomsten",
      label: "Totale inkomsten",
      waarde: formatGeld(h.inkomsten, valuta),
      tone: "groen",
      deltaPct: dIn,
      deltaLabel: formatDelta(dIn)
    },
    {
      id: "uitgaven",
      label: "Totale uitgaven",
      waarde: formatGeld(h.uitgaven, valuta),
      tone: "rood",
      deltaPct: dUit,
      deltaLabel: formatDelta(dUit, true)
    },
    {
      id: "netto",
      label: "Nettoresultaat",
      waarde: formatGeld(h.netto, valuta),
      tone: h.netto >= 0 ? "groen" : "rood",
      deltaPct: dNetto,
      deltaLabel: formatDelta(dNetto)
    },
    {
      id: "in-kas",
      label: "Momenteel in kas",
      waarde: formatGeld(inKas, valuta),
      hint: "Contant nu bij medewerkers, na bestedingen en overdrachten",
      tone: inKas >= 0 ? "blauw" : "rood",
      deltaPct: null,
      deltaLabel: null
    },
    {
      id: "open",
      label: "Openstaande bedragen",
      waarde: formatGeld(h.openstaand, valuta),
      tone: h.openstaand > 0 ? "oranje" : "blauw",
      deltaPct: dOpen,
      deltaLabel: formatDelta(dOpen, true)
    },
    {
      id: "ontvangen",
      label: "Ontvangen betalingen",
      waarde: formatGeld(h.ontvangen, valuta),
      tone: "groen",
      deltaPct: dOntv,
      deltaLabel: formatDelta(dOntv)
    },
    {
      id: "te-ontvangen",
      label: "Nog te ontvangen",
      waarde: formatGeld(h.teOntvangen, valuta),
      tone: h.teOntvangen > 0 ? "oranje" : "blauw",
      deltaPct: dOpen,
      deltaLabel: formatDelta(dOpen, true)
    },
    {
      id: "transacties",
      label: "Aantal transacties",
      waarde: String(h.transacties),
      tone: "blauw",
      deltaPct: deltaPct(h.transacties, v.transacties),
      deltaLabel: formatDelta(deltaPct(h.transacties, v.transacties))
    },
    {
      id: "gem-dag",
      label: "Gem. inkomsten / dag",
      waarde: formatGeld(gemPerDag, valuta),
      tone: "blauw",
      deltaPct: null,
      deltaLabel: null
    },
    {
      id: "gem-klant",
      label: "Gem. inkomsten / klant",
      waarde: formatGeld(gemPerKlant, valuta),
      tone: "blauw",
      deltaPct: null,
      deltaLabel: null
    },
    {
      id: "grootste-uit",
      label: "Grootste uitgave",
      waarde: grootsteUitgave
        ? formatGeld(grootsteUitgave.bedrag, grootsteUitgave.valuta)
        : "—",
      hint: grootsteUitgave?.omschrijving,
      tone: "rood",
      deltaPct: null,
      deltaLabel: null
    },
    {
      id: "grootste-in",
      label: "Grootste inkomstenbron",
      waarde: grootsteInkomst
        ? formatGeld(grootsteInkomst.bedrag, grootsteInkomst.valuta)
        : "—",
      hint: grootsteInkomst?.omschrijving || grootsteInkomst?.categorie,
      tone: "groen",
      deltaPct: null,
      deltaLabel: null
    }
  ];

  return {
    valuta,
    inkomsten: h.inkomsten,
    uitgaven: h.uitgaven,
    kasgeld: h.kasgeld,
    inKas,
    netto: h.netto,
    openstaand: h.openstaand,
    ontvangen: h.ontvangen,
    teOntvangen: h.teOntvangen,
    transacties: h.transacties,
    gemPerDag,
    gemPerKlant,
    grootsteUitgave,
    grootsteInkomst,
    kaarten
  };
}

export type DagTijdlijnItem = {
  id: string;
  tijd: string;
  tekst: string;
  bedragLabel: string;
  positief: boolean;
  post: FinancieelPost;
};

export type DagVerslag = {
  datumLabel: string;
  beginsaldo: number;
  inkomsten: number;
  uitgaven: number;
  kasgeld: number;
  ontvangen: number;
  openstaand: number;
  netto: number;
  eindbalans: number;
  transacties: number;
  grootsteInkomst: FinancieelPost | null;
  grootsteUitgave: FinancieelPost | null;
  geldBijVandaag: Array<{ naam: string; totaal: number; valuta: FinancieelValuta }>;
  tijdlijn: DagTijdlijnItem[];
};

export function berekenDagVerslag(
  allePosten: FinancieelPost[],
  dag = new Date(),
  voorkeurValuta: FinancieelValuta = "EUR"
): DagVerslag {
  const dagPosten = allePosten.filter((p) => isZelfdeLokaleDag(postDatum(p), dag));
  const inValuta = dagPosten.filter((p) => normalizeValuta(p.valuta) === voorkeurValuta);
  const bron = inValuta.length ? inValuta : dagPosten;
  const valuta = inValuta.length ? voorkeurValuta : normalizeValuta(dagPosten[0]?.valuta);
  const h = basisTotalen(bron);
  const follow = berekenFollowTheMoney(allePosten, lokaleDatumIso(dag), valuta);
  h.inkomsten = follow.totaalOntvangen;
  h.uitgaven = follow.totaalBesteed;
  h.kasgeld = follow.totaalOver;
  h.ontvangen = follow.totaalOntvangen;
  h.netto = geldRond(follow.totaalOver - follow.totaalBegin);
  const beginsaldo = follow.totaalBegin;
  const eindbalans = follow.totaalOver;

  const sorted = [...(inValuta.length ? inValuta : dagPosten)].sort(
    (a, b) => postDatum(a).getTime() - postDatum(b).getTime()
  );

  const tijdlijn: DagTijdlijnItem[] = [];
  for (const p of sorted) {
    const d = postDatum(p);
    const tijd = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const positief = p.type !== "UITGAVE";
    const teken = positief ? "+" : "−";
    tijdlijn.push({
      id: p.id,
      tijd,
      tekst: `${typeLabel(p.type, p)} · ${
        isOpeningsKas(p) ? "beginsaldo van de dag" : p.omschrijving
      }${p.klantNaam ? ` · ${p.klantNaam}` : ""}`,
      bedragLabel: `${teken}${formatGeld(p.bedrag, p.valuta)}`,
      positief,
      post: p
    });
    for (const g of inkomstKasRegels(p)) {
      const gd = new Date(g.datum);
      const gTijd = Number.isNaN(gd.getTime())
        ? tijd
        : `${String(gd.getHours()).padStart(2, "0")}:${String(gd.getMinutes()).padStart(2, "0")}`;
      const klant = (g.klantNaam || p.klantNaam || "").trim();
      tijdlijn.push({
        id: `${p.id}:${g.id}`,
        tijd: gTijd,
        tekst: `Betaald door klant${klant ? ` · ${klant}` : ""} · ${p.omschrijving}`,
        bedragLabel: `+${formatGeld(g.bedrag, p.valuta)}`,
        positief: true,
        post: p
      });
    }
    if (p.type !== "UITGAVE") {
      for (const g of besteedRegels(p)) {
        const gd = new Date(g.datum);
        const gTijd = Number.isNaN(gd.getTime())
          ? tijd
          : `${String(gd.getHours()).padStart(2, "0")}:${String(gd.getMinutes()).padStart(2, "0")}`;
        const waar = gebruikWaaraanTekst(g) || g.toelichting || "onbekend";
        tijdlijn.push({
          id: `${p.id}:${g.id}:af`,
          tijd: gTijd,
          tekst: `Besteed / eraf · ${waar} · ${p.omschrijving}`,
          bedragLabel: `−${formatGeld(g.bedrag, p.valuta)}`,
          positief: false,
          post: p
        });
      }
    }
  }

  const geldBij = berekenGeldBijTotalen(inValuta.length ? inValuta : dagPosten).map((g) => ({
    naam: g.naam,
    totaal: g.totaal,
    valuta: g.valuta
  }));

  return {
    datumLabel: dag.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }),
    beginsaldo,
    inkomsten: h.inkomsten,
    uitgaven: h.uitgaven,
    kasgeld: h.kasgeld,
    ontvangen: h.ontvangen,
    openstaand: h.teOntvangen,
    netto: h.netto,
    eindbalans,
    transacties: h.transacties,
    grootsteInkomst:
      sorted.filter((p) => (p.type === "INKOMST" || p.type === "KASGELD") && !isOpeningsKas(p)).sort((a, b) => b.bedrag - a.bedrag)[0] ||
      null,
    grootsteUitgave:
      sorted
        .map((p) => ({
          p,
          bedrag: p.type === "UITGAVE" ? p.bedrag : extraUitgaveUitGebruik(p)
        }))
        .filter((x) => x.bedrag > 0)
        .sort((a, b) => b.bedrag - a.bedrag)[0]?.p || null,
    geldBijVandaag: geldBij,
    tijdlijn
  };
}

export type OpenstaandePost = {
  post: FinancieelPost;
  openstaand: number;
  dagenOpen: number;
  urgentie: "betaald" | "open" | "bijna" | "achterstallig";
  urgentieLabel: string;
};

export function berekenOpenstaandeBetalingen(
  posten: FinancieelPost[],
  nu = new Date()
): OpenstaandePost[] {
  const open = posten.filter((p) => p.type === "INKOMST" && p.status === "OPEN");
  return open
    .map((p) => {
      const dagen = Math.max(
        0,
        Math.floor((startVanDag(nu).getTime() - startVanDag(postDatum(p)).getTime()) / 86400000)
      );
      let urgentie: OpenstaandePost["urgentie"] = "open";
      let urgentieLabel = "Open";
      if (dagen >= 31) {
        urgentie = "achterstallig";
        urgentieLabel = "Achterstallig";
      } else if (dagen >= 14) {
        urgentie = "bijna";
        urgentieLabel = "Bijna vervallen";
      }
      return {
        post: p,
        openstaand: geldRond(Math.max(0, p.bedrag - totaalInkomstKas(p))),
        dagenOpen: dagen,
        urgentie,
        urgentieLabel
      };
    })
    .filter((r) => r.openstaand > 0)
    .sort((a, b) => {
      const rank = { achterstallig: 0, bijna: 1, open: 2, betaald: 3 };
      if (rank[a.urgentie] !== rank[b.urgentie]) return rank[a.urgentie] - rank[b.urgentie];
      return b.dagenOpen - a.dagenOpen;
    });
}

export type FactuurRij = {
  factuurnummer: string;
  klantNaam: string;
  datum: string;
  bedrag: number;
  betaald: number;
  openstaand: number;
  valuta: FinancieelValuta;
  status: "concept" | "verstuurd" | "gedeeltelijk" | "betaald" | "vervallen" | "geannuleerd";
  statusLabel: string;
  posten: FinancieelPost[];
};

export function berekenFacturen(posten: FinancieelPost[]): FactuurRij[] {
  const map = new Map<string, FinancieelPost[]>();
  for (const p of posten) {
    if (p.type !== "INKOMST") continue;
    const ref = (p.referentie || "").trim();
    if (!ref) continue;
    const key = `${ref.toLowerCase()}||${normalizeValuta(p.valuta)}`;
    const list = map.get(key) || [];
    list.push(p);
    map.set(key, list);
  }

  const rijen: FactuurRij[] = [];
  for (const list of map.values()) {
    const eerste = [...list].sort((a, b) => postDatum(a).getTime() - postDatum(b).getTime())[0];
    const valuta = normalizeValuta(eerste.valuta);
    const bedrag = geldSom(list.map((p) => p.bedrag));
    const betaald = geldSom(
      list.map((p) =>
        p.status === "BETAALD" ? p.bedrag : totaalInkomstKas(p)
      )
    );
    const openstaand = geldRond(bedrag - betaald);
    const dagen = Math.floor(
      (Date.now() - postDatum(eerste).getTime()) / 86400000
    );
    let status: FactuurRij["status"] = "verstuurd";
    let statusLabel = "Verstuurd";
    if (openstaand <= 0) {
      status = "betaald";
      statusLabel = "Betaald";
    } else if (betaald > 0) {
      status = "gedeeltelijk";
      statusLabel = "Gedeeltelijk betaald";
    } else if (dagen >= 31) {
      status = "vervallen";
      statusLabel = "Vervallen";
    }
    rijen.push({
      factuurnummer: (eerste.referentie || "").trim(),
      klantNaam: eerste.klantNaam || "—",
      datum: eerste.datum,
      bedrag,
      betaald,
      openstaand,
      valuta,
      status,
      statusLabel,
      posten: list
    });
  }

  return rijen.sort((a, b) => postDatum({ datum: b.datum } as FinancieelPost).getTime() - postDatum({ datum: a.datum } as FinancieelPost).getTime());
}

export type CategorieTotaal = {
  categorie: string;
  bedrag: number;
  aantal: number;
  valuta: FinancieelValuta;
  aandeel: number;
};

export function berekenPerCategorie(
  posten: FinancieelPost[],
  type: "UITGAVE" | "INKOMST",
  valuta: FinancieelValuta
): CategorieTotaal[] {
  const filtered = posten.filter(
    (p) => p.type === type && normalizeValuta(p.valuta) === valuta
  );
  const map = new Map<string, { bedrag: number; aantal: number }>();
  for (const p of filtered) {
    const cat = (p.categorie || "").trim() || "Overige";
    const cur = map.get(cat) || { bedrag: 0, aantal: 0 };
    cur.bedrag = geldRond(cur.bedrag + p.bedrag);
    cur.aantal += 1;
    map.set(cat, cur);
  }
  if (type === "INKOMST") {
    for (const p of posten) {
      if (normalizeValuta(p.valuta) !== valuta) continue;
      const extra = extraInkomstUitGebruik(p);
      if (!extra) continue;
      const cat = "Betaald door klant";
      const cur = map.get(cat) || { bedrag: 0, aantal: 0 };
      cur.bedrag = geldRond(cur.bedrag + extra);
      cur.aantal += inkomstKasRegels(p).length;
      map.set(cat, cur);
    }
  }
  if (type === "UITGAVE") {
    for (const p of posten) {
      if (normalizeValuta(p.valuta) !== valuta) continue;
      if (p.type === "UITGAVE") continue;
      for (const g of besteedRegels(p)) {
        const cat = (g.waaraan || "").trim() || "Overige";
        const cur = map.get(cat) || { bedrag: 0, aantal: 0 };
        cur.bedrag = geldRond(cur.bedrag + g.bedrag);
        cur.aantal += 1;
        map.set(cat, cur);
      }
    }
  }
  const totaal = geldSom([...map.values()].map((v) => v.bedrag)) || 1;
  return [...map.entries()]
    .map(([categorie, v]) => ({
      categorie,
      bedrag: v.bedrag,
      aantal: v.aantal,
      valuta,
      aandeel: Math.round((v.bedrag / totaal) * 1000) / 10
    }))
    .sort((a, b) => b.bedrag - a.bedrag);
}

export type WinstVerlies = {
  valuta: FinancieelValuta;
  dienstverlening: number;
  overigeInkomsten: number;
  totaleInkomsten: number;
  operationeel: number;
  personeel: number;
  administratie: number;
  marketing: number;
  transport: number;
  overigeKosten: number;
  totaleUitgaven: number;
  brutowinst: number;
  nettoresultaat: number;
  winstmarge: number | null;
};

function catMatch(cat: string, keywords: string[]): boolean {
  const c = cat.toLowerCase();
  return keywords.some((k) => c.includes(k));
}

export function berekenWinstVerlies(
  posten: FinancieelPost[],
  valuta: FinancieelValuta
): WinstVerlies {
  const inScope = posten.filter((p) => normalizeValuta(p.valuta) === valuta);
  let dienstverlening = 0;
  let overigeInkomsten = 0;
  let operationeel = 0;
  let personeel = 0;
  let administratie = 0;
  let marketing = 0;
  let transport = 0;
  let overigeKosten = 0;

  for (const p of inScope) {
    const cat = (p.categorie || "").trim();
    if (p.type === "INKOMST" || (p.type === "KASGELD" && !isOpeningsKas(p))) {
      const extra = extraInkomstUitGebruik(p);
      const som = geldRond((isOpeningsKas(p) ? 0 : p.bedrag) + extra);
      if (catMatch(cat, ["visa", "vergunning", "legalisatie", "advies", "vertaling", "dienst"])) {
        dienstverlening = geldRond(dienstverlening + som);
      } else if (p.type === "KASGELD") {
        overigeInkomsten = geldRond(overigeInkomsten + som);
      } else if (!cat) {
        dienstverlening = geldRond(dienstverlening + som);
      } else {
        overigeInkomsten = geldRond(overigeInkomsten + som);
      }
    } else if (p.type === "UITGAVE") {
      if (catMatch(cat, ["personeel", "salaris", "loon"])) {
        personeel = geldRond(personeel + p.bedrag);
      } else if (catMatch(cat, ["admin", "bank", "belasting"])) {
        administratie = geldRond(administratie + p.bedrag);
      } else if (catMatch(cat, ["marketing", "reclame"])) {
        marketing = geldRond(marketing + p.bedrag);
      } else if (catMatch(cat, ["transport", "reis", "brandstof"])) {
        transport = geldRond(transport + p.bedrag);
      } else if (catMatch(cat, ["kantoor", "huur", "software", "apparatuur", "communicatie"])) {
        operationeel = geldRond(operationeel + p.bedrag);
      } else {
        overigeKosten = geldRond(overigeKosten + p.bedrag);
      }
    }
    if (p.type !== "INKOMST" && p.type !== "KASGELD") {
      const extra = extraInkomstUitGebruik(p);
      if (extra) overigeInkomsten = geldRond(overigeInkomsten + extra);
    }
    if (isOpeningsKas(p)) {
      const extra = extraInkomstUitGebruik(p);
      if (extra) overigeInkomsten = geldRond(overigeInkomsten + extra);
    }
    const extraUit = extraUitgaveUitGebruik(p);
    if (extraUit) {
      for (const g of besteedRegels(p)) {
        const cat = (g.waaraan || "").trim() || "Overige";
        if (catMatch(cat, ["personeel", "salaris", "loon"])) {
          personeel = geldRond(personeel + g.bedrag);
        } else if (catMatch(cat, ["admin", "bank", "belasting"])) {
          administratie = geldRond(administratie + g.bedrag);
        } else if (catMatch(cat, ["marketing", "reclame"])) {
          marketing = geldRond(marketing + g.bedrag);
        } else if (catMatch(cat, ["transport", "reis", "brandstof"])) {
          transport = geldRond(transport + g.bedrag);
        } else if (catMatch(cat, ["kantoor", "huur", "software", "apparatuur", "communicatie"])) {
          operationeel = geldRond(operationeel + g.bedrag);
        } else {
          overigeKosten = geldRond(overigeKosten + g.bedrag);
        }
      }
    }
  }

  const totaleInkomsten = geldRond(dienstverlening + overigeInkomsten);
  const totaleUitgaven = geldRond(
    operationeel + personeel + administratie + marketing + transport + overigeKosten
  );
  const brutowinst = geldRond(totaleInkomsten - operationeel);
  const nettoresultaat = geldRond(totaleInkomsten - totaleUitgaven);
  const winstmarge =
    totaleInkomsten > 0 ? Math.round((nettoresultaat / totaleInkomsten) * 1000) / 10 : null;

  return {
    valuta,
    dienstverlening,
    overigeInkomsten,
    totaleInkomsten,
    operationeel,
    personeel,
    administratie,
    marketing,
    transport,
    overigeKosten,
    totaleUitgaven,
    brutowinst,
    nettoresultaat,
    winstmarge
  };
}

export type CashflowSamenvatting = {
  valuta: FinancieelValuta;
  geldBinnen: number;
  geldBuiten: number;
  netto: number;
  beginsaldo: number;
  eindpositie: number;
  waarschuwingen: string[];
};

export function berekenCashflow(
  periodePosten: FinancieelPost[],
  allePosten: FinancieelPost[],
  bereik: DatumBereik,
  valuta: FinancieelValuta
): CashflowSamenvatting {
  const inScope = periodePosten.filter((p) => normalizeValuta(p.valuta) === valuta);
  let geldBinnen = 0;
  let geldBuiten = 0;
  for (const p of inScope) {
    if (p.type === "UITGAVE") {
      if (p.status === "BETAALD") geldBuiten = geldRond(geldBuiten + p.bedrag);
    } else if (p.type === "KASGELD" || p.status === "BETAALD") {
      if (!isOpeningsKas(p)) geldBinnen = geldRond(geldBinnen + p.bedrag);
    }
    const extra = extraInkomstUitGebruik(p);
    if (extra) geldBinnen = geldRond(geldBinnen + extra);
    if (p.type === "INKOMST" && p.status === "OPEN") {
      const betaaldViaRegel = totaalInkomstKas(p);
      if (betaaldViaRegel) geldBinnen = geldRond(geldBinnen + Math.min(p.bedrag, betaaldViaRegel));
    }
    const extraUit = extraUitgaveUitGebruik(p);
    if (extraUit) geldBuiten = geldRond(geldBuiten + extraUit);
  }
  const voor = allePosten.filter(
    (p) => postDatum(p) < bereik.van && normalizeValuta(p.valuta) === valuta
  );
  const beginsaldo = basisTotalen(voor).netto;
  const netto = geldRond(geldBinnen - geldBuiten);
  const eindpositie = geldRond(beginsaldo + netto);

  const waarschuwingen: string[] = [];
  if (netto < 0) waarschuwingen.push("Cashflow is negatief in deze periode.");
  if (geldBuiten > geldBinnen * 1.25 && geldBinnen > 0) {
    waarschuwingen.push("Uitgaande geldstroom is sterk hoger dan inkomsten.");
  }
  const open = inScope.filter((p) => p.type === "INKOMST" && p.status === "OPEN");
  if (open.length >= 5) {
    waarschuwingen.push("Aantal openstaande betalingen loopt op.");
  }

  return { valuta, geldBinnen, geldBuiten, netto, beginsaldo, eindpositie, waarschuwingen };
}

export type TijdreeksPunt = {
  label: string;
  key: string;
  inkomsten: number;
  uitgaven: number;
  netto: number;
};

export function berekenTijdreeks(
  posten: FinancieelPost[],
  valuta: FinancieelValuta,
  modus: "dag" | "week" | "maand" = "dag"
): TijdreeksPunt[] {
  const map = new Map<string, TijdreeksPunt>();
  for (const p of posten) {
    if (normalizeValuta(p.valuta) !== valuta) continue;
    const d = postDatum(p);
    let key: string;
    let label: string;
    if (modus === "maand") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = d.toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
    } else if (modus === "week") {
      const start = startVanWeek(d);
      key = start.toISOString().slice(0, 10);
      label = `Week ${start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`;
    } else {
      key = d.toISOString().slice(0, 10);
      label = d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    }
    const punt = map.get(key) || { label, key, inkomsten: 0, uitgaven: 0, netto: 0 };
    if (p.type === "UITGAVE") punt.uitgaven = geldRond(punt.uitgaven + p.bedrag);
    else if (!isOpeningsKas(p)) punt.inkomsten = geldRond(punt.inkomsten + p.bedrag);
    const extra = extraInkomstUitGebruik(p);
    if (extra) punt.inkomsten = geldRond(punt.inkomsten + extra);
    const extraUit = extraUitgaveUitGebruik(p);
    if (extraUit) punt.uitgaven = geldRond(punt.uitgaven + extraUit);
    punt.netto = geldRond(punt.inkomsten - punt.uitgaven);
    map.set(key, punt);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export type AgingBucket = {
  id: string;
  label: string;
  bedrag: number;
  aantal: number;
};

export function berekenAging(openstaand: OpenstaandePost[], valuta: FinancieelValuta): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { id: "0-7", label: "0–7 dagen", bedrag: 0, aantal: 0 },
    { id: "8-30", label: "8–30 dagen", bedrag: 0, aantal: 0 },
    { id: "31-60", label: "31–60 dagen", bedrag: 0, aantal: 0 },
    { id: "60+", label: "60+ dagen", bedrag: 0, aantal: 0 }
  ];
  for (const o of openstaand) {
    if (normalizeValuta(o.post.valuta) !== valuta) continue;
    let b = buckets[0];
    if (o.dagenOpen >= 60) b = buckets[3];
    else if (o.dagenOpen >= 31) b = buckets[2];
    else if (o.dagenOpen >= 8) b = buckets[1];
    b.bedrag = geldRond(b.bedrag + o.openstaand);
    b.aantal += 1;
  }
  return buckets;
}

export type GezondheidItem = {
  id: string;
  label: string;
  status: "gezond" | "aandacht" | "actie";
  statusLabel: string;
  uitleg: string;
};

export function berekenFinancieleGezondheid(
  wv: WinstVerlies,
  cashflow: CashflowSamenvatting,
  openstaandTotaal: number,
  vorigOpenstaand: number,
  inkomstenDelta: number | null,
  uitgavenDelta: number | null
): GezondheidItem[] {
  const items: GezondheidItem[] = [];

  const marge = wv.winstmarge;
  items.push({
    id: "marge",
    label: "Winstmarge",
    status: marge == null ? "aandacht" : marge >= 20 ? "gezond" : marge >= 5 ? "aandacht" : "actie",
    statusLabel:
      marge == null ? "Aandacht nodig" : marge >= 20 ? "Gezond" : marge >= 5 ? "Aandacht nodig" : "Actie nodig",
    uitleg:
      marge == null
        ? "Nog geen inkomsten in deze periode om een marge te berekenen."
        : `Winstmarge is ${marge}% (netto / inkomsten).`
  });

  const kostenratio =
    wv.totaleInkomsten > 0
      ? Math.round((wv.totaleUitgaven / wv.totaleInkomsten) * 1000) / 10
      : null;
  items.push({
    id: "kosten",
    label: "Kostenratio",
    status:
      kostenratio == null ? "aandacht" : kostenratio <= 70 ? "gezond" : kostenratio <= 90 ? "aandacht" : "actie",
    statusLabel:
      kostenratio == null
        ? "Aandacht nodig"
        : kostenratio <= 70
          ? "Gezond"
          : kostenratio <= 90
            ? "Aandacht nodig"
            : "Actie nodig",
    uitleg:
      kostenratio == null
        ? "Kostenratio kan nog niet worden berekend."
        : `Uitgaven zijn ${kostenratio}% van de inkomsten.`
  });

  items.push({
    id: "inkomsten",
    label: "Inkomstenontwikkeling",
    status:
      inkomstenDelta == null
        ? "aandacht"
        : inkomstenDelta >= 0
          ? "gezond"
          : inkomstenDelta > -15
            ? "aandacht"
            : "actie",
    statusLabel:
      inkomstenDelta == null
        ? "Aandacht nodig"
        : inkomstenDelta >= 0
          ? "Gezond"
          : inkomstenDelta > -15
            ? "Aandacht nodig"
            : "Actie nodig",
    uitleg:
      inkomstenDelta == null
        ? "Geen vorige periode om mee te vergelijken."
        : `Inkomsten ${inkomstenDelta >= 0 ? "stegen" : "daalden"} met ${Math.abs(inkomstenDelta)}% t.o.v. vorige periode.`
  });

  items.push({
    id: "uitgaven",
    label: "Uitgavenontwikkeling",
    status:
      uitgavenDelta == null
        ? "aandacht"
        : uitgavenDelta <= 10
          ? "gezond"
          : uitgavenDelta <= 25
            ? "aandacht"
            : "actie",
    statusLabel:
      uitgavenDelta == null
        ? "Aandacht nodig"
        : uitgavenDelta <= 10
          ? "Gezond"
          : uitgavenDelta <= 25
            ? "Aandacht nodig"
            : "Actie nodig",
    uitleg:
      uitgavenDelta == null
        ? "Geen vorige periode om mee te vergelijken."
        : `Uitgaven ${uitgavenDelta >= 0 ? "stegen" : "daalden"} met ${Math.abs(uitgavenDelta)}% t.o.v. vorige periode.`
  });

  const openDelta = deltaPct(openstaandTotaal, vorigOpenstaand);
  items.push({
    id: "open",
    label: "Openstaande betalingen",
    status:
      openstaandTotaal === 0
        ? "gezond"
        : openDelta != null && openDelta > 15
          ? "actie"
          : openstaandTotaal > 0
            ? "aandacht"
            : "gezond",
    statusLabel:
      openstaandTotaal === 0
        ? "Gezond"
        : openDelta != null && openDelta > 15
          ? "Actie nodig"
          : "Aandacht nodig",
    uitleg:
      openstaandTotaal === 0
        ? "Er staan geen klantbetalingen open."
        : openDelta != null && openDelta > 0
          ? `Openstaande betalingen zijn ${openDelta}% hoger dan vorige periode.`
          : `Er staat nog ${formatGeld(openstaandTotaal, wv.valuta)} open.`
  });

  items.push({
    id: "cashflow",
    label: "Cashflowtrend",
    status: cashflow.netto >= 0 ? "gezond" : cashflow.eindpositie >= 0 ? "aandacht" : "actie",
    statusLabel: cashflow.netto >= 0 ? "Gezond" : cashflow.eindpositie >= 0 ? "Aandacht nodig" : "Actie nodig",
    uitleg:
      cashflow.netto >= 0
        ? "Netto cashflow is positief."
        : "Netto cashflow is negatief — let op liquiditeit."
  });

  return items;
}

export type Signalering = {
  id: string;
  ernst: "info" | "waarschuwing" | "kritiek";
  datum: string;
  onderwerp: string;
  uitleg: string;
  actie?: string;
};

export function berekenSignaleringen(
  posten: FinancieelPost[],
  periodePosten: FinancieelPost[],
  valuta: FinancieelValuta
): Signalering[] {
  const items: Signalering[] = [];
  const inValuta = periodePosten.filter((p) => normalizeValuta(p.valuta) === valuta);
  const uitgaven = inValuta.filter((p) => p.type === "UITGAVE");
  const inkomsten = inValuta.filter((p) => p.type === "INKOMST");
  const gemUit =
    uitgaven.length > 0 ? geldSom(uitgaven.map((p) => p.bedrag)) / uitgaven.length : 0;

  for (const p of uitgaven) {
    if (gemUit > 0 && p.bedrag >= gemUit * 3 && p.bedrag >= 500) {
      items.push({
        id: `hoge-uit-${p.id}`,
        ernst: "waarschuwing",
        datum: p.datum,
        onderwerp: "Ongebruikelijk hoge uitgave",
        uitleg: `${p.omschrijving}: ${formatGeld(p.bedrag, p.valuta)} is veel hoger dan gemiddeld.`,
        actie: "Controleer of deze uitgave klopt."
      });
    }
  }

  const open = berekenOpenstaandeBetalingen(posten);
  for (const o of open) {
    if (normalizeValuta(o.post.valuta) !== valuta) continue;
    if (o.urgentie === "achterstallig") {
      items.push({
        id: `open-${o.post.id}`,
        ernst: "kritiek",
        datum: o.post.datum,
        onderwerp: "Betaling lang openstaand",
        uitleg: `${o.post.klantNaam || "Klant"}: ${formatGeld(o.openstaand, o.post.valuta)} open sinds ${o.dagenOpen} dagen.`,
        actie: "Neem contact op met de klant."
      });
    } else if (o.urgentie === "bijna") {
      items.push({
        id: `bijna-${o.post.id}`,
        ernst: "waarschuwing",
        datum: o.post.datum,
        onderwerp: "Betaling bijna vervallen",
        uitleg: `${o.post.klantNaam || "Klant"}: openstaand ${formatGeld(o.openstaand, o.post.valuta)} (${o.dagenOpen} dagen).`,
        actie: "Stuur een herinnering."
      });
    }
  }

  const cat = berekenPerCategorie(inValuta, "UITGAVE", valuta);
  if (cat[0] && cat[0].aandeel >= 50 && cat[0].bedrag > 0) {
    items.push({
      id: `cat-${cat[0].categorie}`,
      ernst: "info",
      datum: new Date().toISOString(),
      onderwerp: "Veel uitgaven in één categorie",
      uitleg: `${cat[0].aandeel}% van de uitgaven valt onder “${cat[0].categorie}”.`
    });
  }

  // Dubbele transacties (zelfde dag, bedrag, omschrijving)
  const seen = new Map<string, string>();
  for (const p of inValuta) {
    const key = `${p.type}|${normalizeValuta(p.valuta)}|${p.bedrag}|${(p.omschrijving || "").trim().toLowerCase()}|${postDatum(p).toISOString().slice(0, 10)}`;
    if (seen.has(key)) {
      items.push({
        id: `dubbel-${p.id}`,
        ernst: "waarschuwing",
        datum: p.datum,
        onderwerp: "Mogelijke dubbele transactie",
        uitleg: `Zelfde type, bedrag en omschrijving op dezelfde dag: ${p.omschrijving}.`,
        actie: "Controleer of dit een duplicaat is."
      });
    } else {
      seen.set(key, p.id);
    }
  }

  if (inkomsten.length === 0 && uitgaven.length > 0) {
    items.push({
      id: "geen-inkomsten",
      ernst: "waarschuwing",
      datum: new Date().toISOString(),
      onderwerp: "Geen inkomsten in periode",
      uitleg: "Er zijn wel uitgaven, maar geen inkomsten in de geselecteerde periode."
    });
  }

  const cf = berekenCashflow(periodePosten, posten, berekenPeriode("maand"), valuta);
  if (cf.netto < 0) {
    items.push({
      id: "neg-cf",
      ernst: "kritiek",
      datum: new Date().toISOString(),
      onderwerp: "Negatieve cashflow",
      uitleg: `Netto cashflow: ${formatGeld(cf.netto, valuta)}.`,
      actie: "Bekijk uitgaven en openstaande betalingen."
    });
  }

  return items.slice(0, 25);
}

export type KalenderDag = {
  datum: string;
  inkomsten: number;
  uitgaven: number;
  open: number;
  tone: "groen" | "rood" | "oranje" | "blauw";
  label: string;
};

export function berekenFinancieleKalender(
  posten: FinancieelPost[],
  valuta: FinancieelValuta,
  maand = new Date()
): KalenderDag[] {
  const start = startVanMaand(maand);
  const eind = eindeVanMaand(maand);
  const dagen: KalenderDag[] = [];
  for (let d = new Date(start); d <= eind; d.setDate(d.getDate() + 1)) {
    const dagPosten = posten.filter(
      (p) => isZelfdeLokaleDag(postDatum(p), d) && normalizeValuta(p.valuta) === valuta
    );
    const h = basisTotalen(dagPosten);
    let tone: KalenderDag["tone"] = "blauw";
    let label = "Normale activiteit";
    if (h.teOntvangen > 0 && h.teOntvangen >= h.inkomsten * 0.5) {
      tone = "oranje";
      label = "Openstaande betalingen";
    } else if (h.uitgaven > h.inkomsten && h.uitgaven > 0) {
      tone = "rood";
      label = "Veel uitgaven";
    } else if (h.inkomsten > h.uitgaven && h.inkomsten > 0) {
      tone = "groen";
      label = "Veel inkomsten";
    } else if (dagPosten.length === 0) {
      tone = "blauw";
      label = "Geen activiteit";
    }
    dagen.push({
      datum: d.toISOString().slice(0, 10),
      inkomsten: h.inkomsten,
      uitgaven: h.uitgaven,
      open: h.teOntvangen,
      tone,
      label
    });
  }
  return dagen;
}

const AFSLUITING_KEY = "la-solucion-financieel-afsluitingen";

export type AfsluitingRapport = {
  id: string;
  type: "dag" | "maand";
  periodeLabel: string;
  opgeslagenOp: string;
  valuta: FinancieelValuta;
  beginsaldo: number;
  inkomsten: number;
  uitgaven: number;
  netto: number;
  openstaand: number;
  eindbalans: number;
  transacties: number;
  winstmarge?: number | null;
};

export function laadAfsluitingen(): AfsluitingRapport[] {
  try {
    const raw = localStorage.getItem(AFSLUITING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function bewaarAfsluiting(rapport: AfsluitingRapport): AfsluitingRapport[] {
  const all = laadAfsluitingen().filter((r) => r.id !== rapport.id);
  all.unshift(rapport);
  localStorage.setItem(AFSLUITING_KEY, JSON.stringify(all.slice(0, 120)));
  return all;
}

export function maakDagAfsluiting(verslag: DagVerslag, valuta: FinancieelValuta): AfsluitingRapport {
  const id = `dag-${new Date().toISOString().slice(0, 10)}-${valuta}`;
  return {
    id,
    type: "dag",
    periodeLabel: verslag.datumLabel,
    opgeslagenOp: new Date().toISOString(),
    valuta,
    beginsaldo: verslag.beginsaldo,
    inkomsten: verslag.inkomsten,
    uitgaven: verslag.uitgaven,
    netto: verslag.netto,
    openstaand: verslag.openstaand,
    eindbalans: verslag.eindbalans,
    transacties: verslag.transacties
  };
}

export function maakMaandAfsluiting(
  kpis: DashboardKpis,
  wv: WinstVerlies,
  label: string
): AfsluitingRapport {
  const id = `maand-${label}-${kpis.valuta}`;
  return {
    id,
    type: "maand",
    periodeLabel: label,
    opgeslagenOp: new Date().toISOString(),
    valuta: kpis.valuta,
    beginsaldo: 0,
    inkomsten: kpis.inkomsten,
    uitgaven: kpis.uitgaven,
    netto: kpis.netto,
    openstaand: kpis.teOntvangen,
    eindbalans: kpis.netto,
    transacties: kpis.transacties,
    winstmarge: wv.winstmarge
  };
}

export function standaardValutaOpslaan(valuta: FinancieelValuta) {
  localStorage.setItem("la-solucion-financieel-standaard-valuta", valuta);
}

export function standaardValutaLaden(): FinancieelValuta {
  const v = localStorage.getItem("la-solucion-financieel-standaard-valuta");
  return FINANCIEEL_VALUTAS.includes(v as FinancieelValuta)
    ? (v as FinancieelValuta)
    : "EUR";
}

export function dossierLabelKort(
  p: FinancieelPost,
  opdrachtenById: Map<string, Opdracht>
): string {
  if (!p.opdrachtId) return "—";
  const o = opdrachtenById.get(p.opdrachtId);
  if (!o) return "Dossier verwijderd";
  const desc = (o.omschrijving || "").trim();
  return desc.length > 40 ? `${desc.slice(0, 37)}…` : desc || "Geen omschrijving";
}

export function postZoekTekst(p: FinancieelPost, dossier = ""): string {
  return [
    p.klantNaam,
    p.geldBijNaam,
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
    dossier,
    String(p.bedrag)
  ]
    .join(" ")
    .toLowerCase();
}

export { formatDatumTijd, formatGeld, typeLabel, postStatusLabel, betalingsLabel };

export type FollowMoneyEvent = {
  id: string;
  tijd: string;
  soort: "begin" | "binnen" | "uit" | "overdracht";
  titel: string;
  uitleg: string;
  bedragLabel: string;
  post: FinancieelPost;
};

export type FollowMoneyBeweging = {
  id: string;
  titel: string;
  bedragLabel: string;
  soort: FollowMoneyEvent["soort"];
};

export type FollowMoneyPersoon = {
  key: string;
  naam: string;
  beginsaldo: number;
  binnen: number;
  uit: number;
  over: number;
  bewegingen: FollowMoneyBeweging[];
};

export type FollowMoneyDag = {
  datum: string;
  datumLabel: string;
  valuta: FinancieelValuta;
  personen: FollowMoneyPersoon[];
  gebeurtenissen: FollowMoneyEvent[];
  besteed: Array<{ categorie: string; bedrag: number }>;
  totaalBegin: number;
  totaalOntvangen: number;
  totaalBesteed: number;
  totaalOverdracht: number;
  totaalOver: number;
};

function followSleutel(naam: string, userId: string | null): string {
  return (userId || naam.trim().toLowerCase() || "onbekend").toString();
}

function isCashBeweging(p: FinancieelPost): boolean {
  if (p.type === "KASGELD" || p.type === "OVERDRACHT") return true;
  return p.status === "BETAALD" && (p.type === "INKOMST" || p.type === "UITGAVE");
}

function heeftInkomstKasGebruik(p: FinancieelPost): boolean {
  return normaliseerGebruikingen(p.gebruikingen).some(
    (g) => g.soort === "ERBIJ" && isInkomstKas(g.waaraan)
  );
}

function heeftFollowAfGebruik(p: FinancieelPost): boolean {
  return normaliseerGebruikingen(p.gebruikingen).some((g) => g.soort === "AF");
}

function heeftValutaOmzettingNaar(p: FinancieelPost, valuta: FinancieelValuta): boolean {
  const doel = normalizeValuta(valuta);
  return normaliseerGebruikingen(p.gebruikingen).some(
    (g) =>
      g.soort === "AF" &&
      isValutaOmzetting(g.waaraan) &&
      String(g.doelValuta || "").toUpperCase() === doel &&
      omzettingDoelBedrag(g) > 0
  );
}

type FollowSaldo = { naam: string; saldo: number };

function bumpFollowSaldo(saldi: Map<string, FollowSaldo>, wie: { naam: string; userId: string | null }, delta: number) {
  const key = followSleutel(wie.naam, wie.userId);
  const cur = saldi.get(key) || { naam: wie.naam, saldo: 0 };
  if (!cur.naam || cur.naam === "Onbekend") cur.naam = wie.naam;
  cur.saldo = geldRond(cur.saldo + delta);
  saldi.set(key, cur);
}

function zetFollowSaldo(saldi: Map<string, FollowSaldo>, wie: { naam: string; userId: string | null }, saldo: number) {
  const key = followSleutel(wie.naam, wie.userId);
  const cur = saldi.get(key) || { naam: wie.naam, saldo: 0 };
  if (!cur.naam || cur.naam === "Onbekend") cur.naam = wie.naam;
  cur.saldo = geldRond(saldo);
  saldi.set(key, cur);
}

function applyFollowSaldo(saldi: Map<string, FollowSaldo>, p: FinancieelPost, bedrag = p.bedrag) {
  const amount = geldRond(bedrag);
  if (amount === 0) return;
  if (p.type === "INKOMST" || p.type === "KASGELD") {
    const naar = geldNaarPersoon(p);
    if (naar) bumpFollowSaldo(saldi, naar, amount);
  } else if (p.type === "UITGAVE") {
    const van = geldVanPersoon(p);
    if (van) bumpFollowSaldo(saldi, van, -amount);
  } else if (p.type === "OVERDRACHT") {
    const van = geldVanPersoon(p);
    const naar = geldNaarPersoon(p);
    if (van) bumpFollowSaldo(saldi, van, -amount);
    if (naar) bumpFollowSaldo(saldi, naar, amount);
  }
}

function followPersoonDeltas(p: FinancieelPost, bedrag: number): Array<{ key: string; naam: string; delta: number }> {
  const amount = geldRond(bedrag);
  if (amount === 0) return [];
  const uit: Array<{ key: string; naam: string; delta: number }> = [];
  if (p.type === "INKOMST" || p.type === "KASGELD") {
    const naar = geldNaarPersoon(p);
    if (naar) uit.push({ key: followSleutel(naar.naam, naar.userId), naam: naar.naam, delta: amount });
  } else if (p.type === "UITGAVE") {
    const van = geldVanPersoon(p);
    if (van) uit.push({ key: followSleutel(van.naam, van.userId), naam: van.naam, delta: -amount });
  } else if (p.type === "OVERDRACHT") {
    const van = geldVanPersoon(p);
    const naar = geldNaarPersoon(p);
    if (van) uit.push({ key: followSleutel(van.naam, van.userId), naam: van.naam, delta: -amount });
    if (naar) uit.push({ key: followSleutel(naar.naam, naar.userId), naam: naar.naam, delta: amount });
  }
  return uit;
}

type FollowOp = {
  at: Date;
  post: FinancieelPost;
  bedrag: number;
  id: string;
  titel: string;
  uitleg: string;
  soort: FollowMoneyEvent["soort"];
  bedragLabel: string;
  besteedCategorie: string | null;
  /** Als gezet: gebruik deze saldo-wijzigingen i.p.v. standaard post-logica. */
  handmatigeDeltas?: Array<{ naam: string; userId: string | null; delta: number }>;
};

export function lokaleDatumIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLokaleDatum(iso: string): Date {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function verschuifDag(iso: string, delta: number): string {
  const d = parseLokaleDatum(iso);
  d.setDate(d.getDate() + delta);
  return lokaleDatumIso(d);
}

function followOpsVanPost(p: FinancieelPost, valuta: FinancieelValuta): FollowOp[] {
  const ops: FollowOp[] = [];
  const naar = geldNaarPersoon(p);
  const van = geldVanPersoon(p);
  const postValuta = normalizeValuta(p.valuta);
  const zelfdeValuta = postValuta === normalizeValuta(valuta);
  if (zelfdeValuta && isCashBeweging(p)) {
    if (isOpeningsKas(p)) {
      const deltas: NonNullable<FollowOp["handmatigeDeltas"]> = [];
      if (naar) deltas.push({ naam: naar.naam, userId: naar.userId, delta: p.bedrag });
      ops.push({
        at: postDatum(p),
        post: p,
        bedrag: p.bedrag,
        id: p.id,
        soort: "begin",
        titel: "Beginsaldo / Begon met",
        uitleg: [
          `Dit is het beginsaldo van de dag`,
          naar ? `bij ${naar.naam}` : null,
          p.omschrijving
        ]
          .filter(Boolean)
          .join(" · "),
        bedragLabel: formatGeld(p.bedrag, valuta),
        besteedCategorie: null,
        handmatigeDeltas: deltas.length ? deltas : undefined
      });
    } else if (p.type === "INKOMST" || p.type === "KASGELD") {
      ops.push({
        at: postDatum(p),
        post: p,
        bedrag: p.bedrag,
        id: p.id,
        soort: "binnen",
        titel: p.type === "KASGELD" ? "Kasgeld erbij" : "Geld ontvangen",
        uitleg: [
          p.klantNaam ? `Van klant ${p.klantNaam}` : "Bron onbekend",
          naar ? `nu bij ${naar.naam}` : null,
          p.omschrijving
        ]
          .filter(Boolean)
          .join(" · "),
        bedragLabel: `+${formatGeld(p.bedrag, valuta)}`,
        besteedCategorie: null
      });
    } else if (p.type === "UITGAVE") {
      const cat = (p.categorie || "").trim() || "Overige";
      const alBesteed = totaalBesteedUitGebruik(p);
      const rest = geldRond(Math.max(0, p.bedrag - alBesteed));
      if (rest > 0) {
        ops.push({
          at: postDatum(p),
          post: p,
          bedrag: rest,
          id: p.id,
          soort: "uit",
          titel: `Besteed · ${cat}`,
          uitleg: [
            van ? `Uit kas van ${van.naam}` : "Uit kas onbekend",
            alBesteed > 0 ? `restant na bestedingsregels` : null,
            p.omschrijving
          ]
            .filter(Boolean)
            .join(" · "),
          bedragLabel: `−${formatGeld(rest, valuta)}`,
          besteedCategorie: cat
        });
      }
    } else if (p.type === "OVERDRACHT") {
      ops.push({
        at: postDatum(p),
        post: p,
        bedrag: p.bedrag,
        id: p.id,
        soort: "overdracht",
        titel: "Overdracht",
        uitleg: `${van?.naam || "Onbekend"} → ${naar?.naam || "Onbekend"}${
          p.omschrijving ? ` · ${p.omschrijving}` : ""
        }`,
        bedragLabel: formatGeld(p.bedrag, valuta),
        besteedCategorie: null
      });
    }
  }

  for (const g of normaliseerGebruikingen(p.gebruikingen)) {
    const at = new Date(g.datum);
    const wanneer = Number.isNaN(at.getTime()) ? postDatum(p) : at;
    const waar = gebruikWaaraanTekst(g) || g.toelichting || p.omschrijving;
    if (!zelfdeValuta) {
      if (
        g.soort === "AF" &&
        isValutaOmzetting(g.waaraan) &&
        String(g.doelValuta || "").toUpperCase() === normalizeValuta(valuta)
      ) {
        const doelBedrag = omzettingDoelBedrag(g);
        if (doelBedrag > 0) {
          const kasHouder = naar || van;
          const deltas: NonNullable<FollowOp["handmatigeDeltas"]> = [];
          if (kasHouder) deltas.push({ naam: kasHouder.naam, userId: kasHouder.userId, delta: doelBedrag });
          ops.push({
            at: wanneer,
            post: p,
            bedrag: doelBedrag,
            id: `${p.id}:${g.id}:fx-in`,
            soort: "binnen",
            titel: `Valuta omgezet · ${postValuta} → ${normalizeValuta(valuta)}`,
            uitleg: [
              `van ${formatGeld(g.bedrag, postValuta)} naar ${formatGeld(doelBedrag, valuta)}`,
              kasHouder ? `nu bij ${kasHouder.naam}` : null,
              `bij post “${p.omschrijving}”`
            ]
              .filter(Boolean)
              .join(" · "),
            bedragLabel: `+${formatGeld(doelBedrag, valuta)}`,
            besteedCategorie: null,
            handmatigeDeltas: deltas.length ? deltas : undefined
          });
        }
      }
      continue;
    }
    if (g.soort === "AF" && isOverdrachtMedewerker(g.waaraan)) {
      const medewerker = medewerkerUitGebruik(g) || "Onbekende medewerker";
      const bron = geldNaarPersoon(p) || geldVanPersoon(p);
      const deltas: NonNullable<FollowOp["handmatigeDeltas"]> = [];
      if (bron) deltas.push({ naam: bron.naam, userId: bron.userId, delta: -g.bedrag });
      deltas.push({ naam: medewerker, userId: null, delta: g.bedrag });
      ops.push({
        at: wanneer,
        post: p,
        bedrag: g.bedrag,
        id: `${p.id}:${g.id}`,
        soort: "overdracht",
        titel: `Overdracht medewerker · ${medewerker}`,
        uitleg: [
          bron ? `Van ${bron.naam}` : null,
          `naar ${medewerker}`,
          `van post “${p.omschrijving}”`,
          g.toelichting || null
        ]
          .filter(Boolean)
          .join(" · "),
        bedragLabel: formatGeld(g.bedrag, valuta),
        besteedCategorie: null,
        handmatigeDeltas: deltas
      });
      continue;
    }
    if (g.soort === "ERBIJ" && isInkomstKas(g.waaraan)) {
      const klant = (g.klantNaam || "").trim();
      const kasHouder = naar || van;
      const deltas: NonNullable<FollowOp["handmatigeDeltas"]> = [];
      if (kasHouder) deltas.push({ naam: kasHouder.naam, userId: kasHouder.userId, delta: g.bedrag });
      const saldoLabel =
        g.heeftSaldo === "JA"
          ? "Betaling op saldo"
          : g.heeftSaldo === "NEE"
            ? "Nieuwe inkomst"
            : "Inkomst in kas";
      ops.push({
        at: wanneer,
        post: p,
        bedrag: g.bedrag,
        id: `${p.id}:${g.id}`,
        soort: "binnen",
        titel: klant ? `${saldoLabel} · ${klant}` : saldoLabel,
        uitleg: [
          klant ? `Van klant ${klant}` : null,
          g.heeftSaldo === "JA" ? "openstaand saldo verrekend" : null,
          kasHouder ? `nu bij ${kasHouder.naam}` : null,
          `bedrag ${formatGeld(g.bedrag, valuta)}`,
          `bij post “${p.omschrijving}”`,
          g.toelichting || null
        ]
          .filter(Boolean)
          .join(" · "),
        bedragLabel: `+${formatGeld(g.bedrag, valuta)}`,
        besteedCategorie: null,
        handmatigeDeltas: deltas.length ? deltas : undefined
      });
      continue;
    }
    if (g.soort === "AF") {
      if (isValutaOmzetting(g.waaraan)) {
        const doelValuta = String(g.doelValuta || "").toUpperCase() || "onbekend";
        const doelBedrag = omzettingDoelBedrag(g);
        const kasHouder = naar || van;
        const deltas: NonNullable<FollowOp["handmatigeDeltas"]> = [];
        if (kasHouder) deltas.push({ naam: kasHouder.naam, userId: kasHouder.userId, delta: -g.bedrag });
        ops.push({
          at: wanneer,
          post: p,
          bedrag: g.bedrag,
          id: `${p.id}:${g.id}:fx-out`,
          soort: "uit",
          titel: `Valuta omgezet · ${postValuta} → ${doelValuta}`,
          uitleg: [
            `−${formatGeld(g.bedrag, valuta)}`,
            doelBedrag > 0 ? `doel ${formatGeld(doelBedrag, doelValuta)}` : null,
            kasHouder ? `uit kas van ${kasHouder.naam}` : null,
            `bij post “${p.omschrijving}”`
          ]
            .filter(Boolean)
            .join(" · "),
          bedragLabel: `−${formatGeld(g.bedrag, valuta)}`,
          besteedCategorie: null,
          handmatigeDeltas: deltas.length ? deltas : undefined
        });
        continue;
      }
      const kasHouder = naar || van;
      const deltas: NonNullable<FollowOp["handmatigeDeltas"]> = [];
      if (kasHouder) deltas.push({ naam: kasHouder.naam, userId: kasHouder.userId, delta: -g.bedrag });
      const isSpend = isBesteedGebruik(g);
      ops.push({
        at: wanneer,
        post: p,
        bedrag: g.bedrag,
        id: `${p.id}:${g.id}`,
        soort: "uit",
        titel: isSpend ? `Besteed · ${waar || "onbekend"}` : `Eraf · ${waar || "onbekend"}`,
        uitleg: [
          `−${formatGeld(g.bedrag, valuta)}`,
          kasHouder ? `uit kas van ${kasHouder.naam}` : null,
          `van post “${p.omschrijving}”`,
          g.toelichting || null
        ]
          .filter(Boolean)
          .join(" · "),
        bedragLabel: `−${formatGeld(g.bedrag, valuta)}`,
        besteedCategorie: isSpend ? waar || p.categorie || "Overige" : null,
        handmatigeDeltas: deltas.length ? deltas : undefined
      });
    } else {
      ops.push({
        at: wanneer,
        post: p,
        bedrag: g.bedrag,
        id: `${p.id}:${g.id}`,
        soort: p.type === "UITGAVE" ? "uit" : p.type === "OVERDRACHT" ? "overdracht" : "binnen",
        titel: `Extra bij origineel · ${waar || "onbekend"}`,
        uitleg: `Bij post “${p.omschrijving}” (${formatGeld(p.bedrag, valuta)} blijft het origineel)`,
        bedragLabel: `+${formatGeld(g.bedrag, valuta)}`,
        besteedCategorie: p.type === "UITGAVE" ? waar || p.categorie || "Overige" : null
      });
    }
  }
  return ops;
}

export function berekenFollowTheMoney(
  allePosten: FinancieelPost[],
  dagIso: string,
  valuta: FinancieelValuta
): FollowMoneyDag {
  const dag = parseLokaleDatum(dagIso);
  const ops = allePosten
    .filter(
      (p) =>
        ((normalizeValuta(p.valuta) === valuta &&
          (isCashBeweging(p) || heeftInkomstKasGebruik(p) || heeftFollowAfGebruik(p))) ||
          heeftValutaOmzettingNaar(p, valuta))
    )
    .flatMap((p) => followOpsVanPost(p, valuta))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const opening = new Map<string, FollowSaldo>();
  const dagOps: FollowOp[] = [];

  // Beginsaldo-registratie (= Begon met) zet het beginsaldo.
  // Zonder registratie blijft beginsaldo het restant (Over) van eerdere dagen.
  // Niet verbruikt beginsaldo blijft in Over via: over = beginsaldo + erbij − eruit.
  for (const op of ops) {
    const beginOp = op.soort === "begin";
    const beginVandaag = beginOp && isZelfdeLokaleDag(op.at, dag);

    if (op.at < startVanDag(dag)) {
      if (beginOp) {
        if (op.handmatigeDeltas) {
          for (const delta of op.handmatigeDeltas) {
            zetFollowSaldo(opening, { naam: delta.naam, userId: delta.userId }, delta.delta);
          }
        } else {
          const wie = geldNaarPersoon(op.post);
          if (wie) zetFollowSaldo(opening, wie, op.bedrag);
        }
      } else if (op.handmatigeDeltas) {
        for (const delta of op.handmatigeDeltas) {
          bumpFollowSaldo(opening, { naam: delta.naam, userId: delta.userId }, delta.delta);
        }
      } else {
        applyFollowSaldo(opening, op.post, op.bedrag);
      }
    } else if (beginVandaag) {
      if (op.handmatigeDeltas) {
        for (const delta of op.handmatigeDeltas) {
          zetFollowSaldo(opening, { naam: delta.naam, userId: delta.userId }, delta.delta);
        }
      } else {
        const wie = geldNaarPersoon(op.post);
        if (wie) zetFollowSaldo(opening, wie, op.bedrag);
      }
      dagOps.push(op);
    } else if (isZelfdeLokaleDag(op.at, dag)) {
      dagOps.push(op);
    }
  }

  const running = new Map([...opening.entries()].map(([k, v]) => [k, { ...v }]));
  const gebeurtenissen: FollowMoneyEvent[] = [];
  const binnenPer = new Map<string, number>();
  const uitPer = new Map<string, number>();
  const bewegingenPer = new Map<string, FollowMoneyBeweging[]>();
  const besteedMap = new Map<string, number>();
  let totaalOntvangen = 0;
  let totaalBesteed = 0;
  let totaalOverdracht = 0;

  const pushBeweging = (key: string, beweging: FollowMoneyBeweging) => {
    const list = bewegingenPer.get(key) || [];
    list.push(beweging);
    bewegingenPer.set(key, list);
  };

  for (const op of dagOps) {
    const tijd = `${String(op.at.getHours()).padStart(2, "0")}:${String(op.at.getMinutes()).padStart(2, "0")}`;
    const beweging: FollowMoneyBeweging = {
      id: op.id,
      titel: `${tijd} · ${op.titel}`,
      bedragLabel: op.bedragLabel,
      soort: op.soort
    };
    gebeurtenissen.push({
      id: op.id,
      tijd,
      soort: op.soort,
      titel: op.titel,
      uitleg: op.uitleg,
      bedragLabel: op.bedragLabel,
      post: op.post
    });

    const deltas = op.handmatigeDeltas
      ? op.handmatigeDeltas.map((d) => ({
          key: followSleutel(d.naam, d.userId),
          naam: d.naam,
          delta: d.delta
        }))
      : followPersoonDeltas(op.post, op.bedrag);

    for (const delta of deltas) {
      pushBeweging(delta.key, beweging);
    }

    if (op.soort === "begin") continue;

    if (op.soort === "overdracht") {
      totaalOverdracht = geldRond(totaalOverdracht + Math.abs(op.bedrag));
    } else if (op.soort === "binnen") {
      totaalOntvangen = geldRond(totaalOntvangen + Math.abs(op.bedrag));
    } else if (op.soort === "uit") {
      totaalBesteed = geldRond(totaalBesteed + Math.abs(op.bedrag));
    }
    if (op.besteedCategorie && op.bedrag !== 0 && op.soort !== "overdracht" && op.soort !== "begin") {
      const cat = op.besteedCategorie;
      const extra = op.bedrag < 0 ? -op.bedrag : op.bedrag;
      besteedMap.set(cat, geldRond((besteedMap.get(cat) || 0) + extra));
    }
    if (op.handmatigeDeltas) {
      for (const delta of op.handmatigeDeltas) {
        const key = followSleutel(delta.naam, delta.userId);
        if (delta.delta > 0) binnenPer.set(key, geldRond((binnenPer.get(key) || 0) + delta.delta));
        else if (delta.delta < 0) uitPer.set(key, geldRond((uitPer.get(key) || 0) - delta.delta));
        bumpFollowSaldo(running, { naam: delta.naam, userId: delta.userId }, delta.delta);
      }
    } else {
      for (const delta of followPersoonDeltas(op.post, op.bedrag)) {
        if (delta.delta > 0) binnenPer.set(delta.key, geldRond((binnenPer.get(delta.key) || 0) + delta.delta));
        else if (delta.delta < 0) uitPer.set(delta.key, geldRond((uitPer.get(delta.key) || 0) - delta.delta));
      }
      applyFollowSaldo(running, op.post, op.bedrag);
    }
  }

  const keys = new Set([...opening.keys(), ...running.keys(), ...binnenPer.keys(), ...uitPer.keys(), ...bewegingenPer.keys()]);
  const personen: FollowMoneyPersoon[] = [...keys]
    .map((key) => {
      const naam = running.get(key)?.naam || opening.get(key)?.naam || key;
      const beginsaldo = opening.get(key)?.saldo || 0;
      const binnen = binnenPer.get(key) || 0;
      const uit = uitPer.get(key) || 0;
      // Niet verbruikt beginsaldo blijft automatisch in Over.
      const over = geldRond(beginsaldo + binnen - uit);
      return {
        key,
        naam,
        beginsaldo,
        binnen,
        uit,
        over,
        bewegingen: bewegingenPer.get(key) || []
      };
    })
    .filter((p) => p.beginsaldo !== 0 || p.binnen !== 0 || p.uit !== 0 || p.over !== 0 || p.bewegingen.length > 0)
    .sort((a, b) => Math.abs(b.over) - Math.abs(a.over) || a.naam.localeCompare(b.naam, "nl"));

  return {
    datum: dagIso,
    datumLabel: dag.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }),
    valuta,
    personen,
    gebeurtenissen,
    besteed: [...besteedMap.entries()]
      .map(([categorie, bedrag]) => ({ categorie, bedrag }))
      .filter((b) => b.bedrag > 0)
      .sort((a, b) => b.bedrag - a.bedrag),
    totaalBegin: geldRond(personen.reduce((s, p) => s + p.beginsaldo, 0)),
    totaalOntvangen,
    totaalBesteed: Math.max(0, totaalBesteed),
    totaalOverdracht,
    totaalOver: geldRond(personen.reduce((s, p) => s + p.over, 0))
  };
}
