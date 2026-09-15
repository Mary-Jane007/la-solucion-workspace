import { FinancieelInzending } from "./api";
import {
  BETALINGSWIJZE_LABELS,
  formatDatumTijd,
  formatGeld,
  isBankBetaling,
  KAS_EFFECT_LABELS,
  typeLabel,
  VALUTA_LABELS
} from "./financieelUtils";

export const INZENDING_STATUS_LABEL: Record<FinancieelInzending["status"], string> = {
  NIEUW: "Nieuw",
  GEZIEN: "Gezien",
  VERWERKT: "Verwerkt"
};

export function inzendingMatchtZoekterm(item: FinancieelInzending, zoekterm: string): boolean {
  const q = zoekterm.trim().toLowerCase();
  if (!q) return true;
  const velden = [
    item.vanNaam,
    item.klantNaam,
    item.omschrijving,
    item.categorie,
    item.referentie,
    item.notities,
    item.bank,
    item.kasEffect,
    item.kasEffect ? KAS_EFFECT_LABELS[item.kasEffect] : "",
    item.geldBijNaam,
    item.geldVanNaam,
    item.waaraan,
    typeLabel(item.type),
    VALUTA_LABELS[item.valuta],
    item.valuta,
    String(item.bedrag).replace(".", ","),
    String(item.bedrag),
    formatDatumTijd(item.datum),
    formatDatumTijd(item.createdAt),
    inzendingSamenvatting(item)
  ];
  return velden.some((v) => (v || "").toLowerCase().includes(q));
}

export function inzendingSamenvatting(item: FinancieelInzending): string {
  return [
    `${typeLabel(item.type)} ${formatGeld(item.bedrag, item.valuta)}`,
    item.omschrijving,
    item.waaraan ? `Besteed: ${item.waaraan}` : "",
    item.geldBijNaam ? `Nu bij ${item.geldBijNaam}` : "",
    item.geldVanNaam ? `Van ${item.geldVanNaam}` : "",
    item.kasEffect && isBankBetaling(item.betalingswijze)
      ? KAS_EFFECT_LABELS[item.kasEffect]
      : "",
    item.bijlagen?.length
      ? `${item.bijlagen.length} foto${item.bijlagen.length === 1 ? "" : "’s"}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

export function inzendingVelden(item: FinancieelInzending): Array<{ veld: string; waarde: string }> {
  return [
    { veld: "Van medewerker", waarde: item.vanNaam },
    { veld: "Verzonden", waarde: formatDatumTijd(item.createdAt) },
    { veld: "Datum gebeurtenis", waarde: formatDatumTijd(item.datum) },
    { veld: "Type", waarde: typeLabel(item.type) },
    { veld: "Bedrag", waarde: formatGeld(item.bedrag, item.valuta) },
    { veld: "Valuta", waarde: VALUTA_LABELS[item.valuta] },
    {
      veld: "Wisselkoers",
      waarde: item.wisselkoers == null ? "—" : String(item.wisselkoers).replace(".", ",")
    },
    { veld: "Omschrijving", waarde: item.omschrijving || "—" },
    { veld: "Categorie", waarde: item.categorie || "—" },
    { veld: "Klant", waarde: item.klantNaam || "—" },
    { veld: "Referentie", waarde: item.referentie || "—" },
    {
      veld: "Betalingswijze",
      waarde: item.betalingswijze ? BETALINGSWIJZE_LABELS[item.betalingswijze] : "—"
    },
    { veld: "Bank", waarde: item.bank || "—" },
    {
      veld: "Kas",
      waarde: isBankBetaling(item.betalingswijze)
        ? KAS_EFFECT_LABELS[item.kasEffect || "NEE"]
        : "—"
    },
    { veld: "Bij wie is het geld", waarde: item.geldBijNaam || "—" },
    { veld: "Geld van", waarde: item.geldVanNaam || "—" },
    { veld: "Waaraan besteed", waarde: item.waaraan || "—" },
    { veld: "Notities", waarde: item.notities || "—" }
  ];
}
