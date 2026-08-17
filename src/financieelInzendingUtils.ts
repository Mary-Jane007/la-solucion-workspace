import { FinancieelInzending } from "./api";
import {
  BETALINGSWIJZE_LABELS,
  formatDatumTijd,
  formatGeld,
  typeLabel,
  VALUTA_LABELS
} from "./financieelUtils";

export const INZENDING_STATUS_LABEL: Record<FinancieelInzending["status"], string> = {
  NIEUW: "Nieuw",
  GEZIEN: "Gezien",
  VERWERKT: "Verwerkt"
};

export function inzendingSamenvatting(item: FinancieelInzending): string {
  return [
    `${typeLabel(item.type)} ${formatGeld(item.bedrag, item.valuta)}`,
    item.omschrijving,
    item.waaraan ? `Besteed: ${item.waaraan}` : "",
    item.geldBijNaam ? `Nu bij ${item.geldBijNaam}` : "",
    item.geldVanNaam ? `Van ${item.geldVanNaam}` : "",
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
    { veld: "Bij wie is het geld", waarde: item.geldBijNaam || "—" },
    { veld: "Geld van", waarde: item.geldVanNaam || "—" },
    { veld: "Waaraan besteed", waarde: item.waaraan || "—" },
    { veld: "Notities", waarde: item.notities || "—" }
  ];
}
