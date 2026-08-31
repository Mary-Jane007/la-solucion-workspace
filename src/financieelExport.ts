import { FinancieelGebruik, FinancieelPost, FinancieelValuta } from "./api";
import { Opdracht } from "./types";
import {
  berekenFinancieExportOverzicht,
  berekenFollowTheMoney,
  DashboardKpis,
  FollowMoneyDag,
  lokaleDatumIso
} from "./financieelDashboardUtils";
import {
  betalingsLabel,
  berekenDossierSaldi,
  berekenGeldBijTotalen,
  berekenKlantSaldi,
  formatDatumTijd,
  formatGeld,
  gebruikWaaraanTekst,
  isInkomstKas,
  normaliseerGebruikingen,
  normalizeValuta,
  opdrachtDossierLabel,
  postStatusLabel,
  restantBedrag,
  totaalGebruikAf,
  totaalGebruikErbij,
  typeLabel,
  VALUTA_LABELS
} from "./financieelUtils";

export type FinancieelExportOpties = {
  /** Geselecteerde dag voor Follow the money (ISO yyyy-mm-dd). */
  ftmDagIso?: string;
  /** Valuta zoals in het dashboard. */
  valuta?: FinancieelValuta;
  /** Label van de geselecteerde periode in Financiën. */
  periodeLabel?: string;
  /** KPI's van de geselecteerde periode — exact zoals op het scherm. */
  kpis?: Pick<
    DashboardKpis,
    "inkomsten" | "uitgaven" | "inKas" | "netto" | "ontvangen" | "teOntvangen" | "openstaand"
  >;
  /** Follow-the-money snapshot van de geselecteerde dag. */
  followTheMoney?: FollowMoneyDag;
};

function gebruikingenVanPost(p: FinancieelPost): FinancieelGebruik[] {
  return normaliseerGebruikingen(p.gebruikingen);
}

function gebruikSoortLabel(g: FinancieelGebruik): string {
  if (g.soort === "ERBIJ") return isInkomstKas(g.waaraan) ? "Inkomst in kas" : "Erbij";
  return "Af / besteed";
}

function htmlEscape(waarde: string): string {
  return waarde
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlEscape(waarde: string): string {
  return htmlEscape(waarde).replace(/'/g, "&apos;");
}

function leeg(waarde?: string | null): string {
  const t = (waarde || "").trim();
  return t || "—";
}

function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBestand(bestandsnaam: string, mime: string, inhoud: string) {
  const blob = new Blob(["\uFEFF" + inhoud], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);
}

function dossierLabelVoorPost(p: FinancieelPost, opdrachtenById: Map<string, Opdracht>): string {
  if (!p.opdrachtId) return "";
  const o = opdrachtenById.get(p.opdrachtId);
  return o ? opdrachtDossierLabel(o) : "Dossier niet beschikbaar";
}

function sorteerPosten(posten: FinancieelPost[]): FinancieelPost[] {
  return [...posten].sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
}

function geldTekst(bedrag: number, valuta?: FinancieelValuta | string): string {
  return formatGeld(bedrag, valuta);
}

function postVulvakken(
  p: FinancieelPost,
  opdrachtenById: Map<string, Opdracht>
): Array<{ veld: string; waarde: string }> {
  return [
    { veld: "ID", waarde: p.id },
    { veld: "Datum & tijd", waarde: formatDatumTijd(p.datum) },
    { veld: "Type", waarde: typeLabel(p.type, p) },
    { veld: "Omschrijving", waarde: leeg(p.omschrijving) },
    { veld: "Origineel bedrag", waarde: geldTekst(p.bedrag, p.valuta) },
    { veld: "Afgetrokken / besteed", waarde: geldTekst(totaalGebruikAf(p), p.valuta) },
    { veld: "Erbij gekomen", waarde: geldTekst(totaalGebruikErbij(p), p.valuta) },
    { veld: "Restant", waarde: geldTekst(restantBedrag(p), p.valuta) },
    { veld: "Valuta", waarde: VALUTA_LABELS[normalizeValuta(p.valuta)] },
    {
      veld: "Wisselkoers",
      waarde: p.wisselkoers == null ? "—" : String(p.wisselkoers).replace(".", ",")
    },
    { veld: "Status", waarde: postStatusLabel(p) },
    { veld: "Categorie / dienst", waarde: leeg(p.categorie) },
    { veld: "Referentie / factuurnr.", waarde: leeg(p.referentie) },
    { veld: "Klant", waarde: leeg(p.klantNaam) },
    { veld: "Dossier", waarde: leeg(dossierLabelVoorPost(p, opdrachtenById)) },
    { veld: "Betalingswijze", waarde: leeg(betalingsLabel(p)) },
    { veld: "Bank", waarde: leeg(p.bank) },
    { veld: "Afgehandeld door", waarde: leeg(p.afgehandeldDoorNaam) },
    { veld: "Geld van", waarde: leeg(p.geldVanNaam) },
    { veld: "Bij wie is het geld", waarde: leeg(p.geldBijNaam) },
    { veld: "Notities", waarde: leeg(p.notities) },
    { veld: "Aangemaakt", waarde: p.createdAt ? formatDatumTijd(p.createdAt) : "—" },
    { veld: "Laatst gewijzigd", waarde: p.updatedAt ? formatDatumTijd(p.updatedAt) : "—" }
  ];
}

const DAGBOEK_KOLommen = [
  "Datum",
  "Type",
  "Omschrijving",
  "Origineel bedrag",
  "Afgetrokken",
  "Erbij",
  "Restant",
  "Valuta",
  "Wisselkoers",
  "Status",
  "Categorie",
  "Referentie",
  "Klant",
  "Dossier",
  "Betalingswijze",
  "Bank",
  "Afgehandeld door",
  "Geld van",
  "Bij wie is het geld",
  "Notities",
  "Gebruik van dit bedrag",
  "ID"
] as const;

function dagboekRij(p: FinancieelPost, opdrachtenById: Map<string, Opdracht>): string[] {
  const gebruik = gebruikingenVanPost(p)
    .map((g) => {
      const waar = gebruikWaaraanTekst(g);
      const richting = g.soort === "ERBIJ" ? (isInkomstKas(g.waaraan) ? "inkomst in kas" : "erbij") : "af";
      return `${formatDatumTijd(g.datum)} · ${richting} ${geldTekst(g.bedrag, p.valuta)}${
        waar ? ` · ${waar}` : ""
      }${g.toelichting ? ` (${g.toelichting})` : ""}`;
    })
    .join(" | ");
  return [
    formatDatumTijd(p.datum),
    typeLabel(p.type, p),
    p.omschrijving || "",
    geldTekst(p.bedrag, p.valuta),
    geldTekst(totaalGebruikAf(p), p.valuta),
    geldTekst(totaalGebruikErbij(p), p.valuta),
    geldTekst(restantBedrag(p), p.valuta),
    normalizeValuta(p.valuta),
    p.wisselkoers == null ? "" : String(p.wisselkoers).replace(".", ","),
    postStatusLabel(p),
    p.categorie || "",
    p.referentie || "",
    p.klantNaam || "",
    dossierLabelVoorPost(p, opdrachtenById),
    betalingsLabel(p),
    p.bank || "",
    p.afgehandeldDoorNaam || "",
    p.geldVanNaam || "",
    p.geldBijNaam || "",
    p.notities || "",
    gebruik,
    p.id
  ];
}

function tabelHtml(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${row.map((c) => `<td>${htmlEscape(c || "—")}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function veldenTabelHtml(velden: Array<{ veld: string; waarde: string }>): string {
  const rijen = velden
    .map(
      (v) =>
        `<tr><th>${htmlEscape(v.veld)}</th><td>${htmlEscape(v.waarde)}</td></tr>`
    )
    .join("");
  return `<table class="velden">${rijen}</table>`;
}

function rapportStijl(): string {
  return `
    body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #10203a; margin: 18px; font-size: 11pt; }
    h1 { font-size: 22pt; margin: 0 0 4px; color: #0f2547; }
    h2 { font-size: 14pt; margin: 28px 0 10px; border-bottom: 1.5pt solid #1d4ed8; padding-bottom: 4px; color: #1e3a8a; page-break-after: avoid; }
    h3 { font-size: 12pt; margin: 0 0 8px; color: #0f2547; }
    p, li { margin: 0 0 6px; color: #334155; }
    .meta { margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 0 0 12px; }
    th, td { border: 1px solid #c5d0e0; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #e8eef8; font-weight: 700; color: #0f2547; }
    table.velden { width: 100%; }
    table.velden th { width: 32%; background: #f3f6fb; font-weight: 600; }
    .kaart { border: 1px solid #c5d0e0; border-radius: 6px; padding: 10px 12px; margin: 0 0 14px; page-break-inside: avoid; }
    .kpi { margin: 0 0 4px; }
    .muted { color: #64748b; font-size: 10pt; }
    @page { size: A4 landscape; margin: 12mm; }
    @media print {
      body { margin: 0; }
      h2 { break-after: avoid; }
      .kaart, tr { break-inside: avoid; }
    }
  `;
}

function bouwRapportHtml(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>,
  opties: { voorWord?: boolean; printen?: boolean },
  exportOpties?: FinancieelExportOpties
): string {
  const gesorteerd = sorteerPosten(posten);
  const ftmDagIso = exportOpties?.ftmDagIso || lokaleDatumIso(new Date());
  const overzicht = berekenFinancieExportOverzicht(posten, ftmDagIso);
  const valuta = exportOpties?.valuta;
  const follow =
    exportOpties?.followTheMoney ??
    (valuta ? berekenFollowTheMoney(posten, ftmDagIso, valuta) : null);
  const geldBij = berekenGeldBijTotalen(posten);
  const klantSaldi = berekenKlantSaldi(posten);
  const dossierSaldi = berekenDossierSaldi(posten, opdrachtenById);
  const stamp = new Date().toLocaleString("nl-NL");

  const huidigeStandHtml =
    valuta && (exportOpties?.kpis || follow)
      ? `<h2>1. Huidige stand</h2>
  <p class="muted">Zelfde bedragen als in Financiën · ${
    exportOpties?.periodeLabel ? `periode <strong>${htmlEscape(exportOpties.periodeLabel)}</strong> · ` : ""
  }valuta <strong>${htmlEscape(VALUTA_LABELS[valuta])}</strong>${
    follow ? ` · Follow the money: <strong>${htmlEscape(follow.datumLabel)}</strong>` : ""
  }</p>
  ${
    exportOpties?.kpis
      ? `<table>
    <tbody>
      <tr><th>Inkomsten (periode)</th><td>${geldTekst(exportOpties.kpis.inkomsten, valuta)}</td></tr>
      <tr><th>Uitgaven (periode)</th><td>${geldTekst(exportOpties.kpis.uitgaven, valuta)}</td></tr>
      <tr><th>Momenteel in kas</th><td>${geldTekst(exportOpties.kpis.inKas, valuta)}</td></tr>
      <tr><th>Nettoresultaat (periode)</th><td>${geldTekst(exportOpties.kpis.netto, valuta)}</td></tr>
      <tr><th>Ontvangen</th><td>${geldTekst(exportOpties.kpis.ontvangen, valuta)}</td></tr>
      <tr><th>Nog te ontvangen</th><td>${geldTekst(exportOpties.kpis.teOntvangen, valuta)}</td></tr>
      <tr><th>Openstaand</th><td>${geldTekst(exportOpties.kpis.openstaand, valuta)}</td></tr>
    </tbody>
  </table>`
      : ""
  }
  ${
    follow
      ? `<table>
    <caption class="muted">Follow the money — einde van de geselecteerde dag</caption>
    <tbody>
      <tr><th>Totaal in kas (alle medewerkers)</th><td><strong>${geldTekst(follow.totaalInKas, follow.valuta)}</strong></td></tr>
      <tr><th>Beginsaldo / Begon met</th><td>${geldTekst(follow.totaalBegin, follow.valuta)}</td></tr>
      <tr><th>Deze dag erbij</th><td>${geldTekst(follow.totaalOntvangen, follow.valuta)}</td></tr>
      <tr><th>Deze dag eruit</th><td>${geldTekst(follow.totaalBesteed, follow.valuta)}</td></tr>
      <tr><th>Overgedragen intern</th><td>${geldTekst(follow.totaalOverdracht, follow.valuta)}</td></tr>
    </tbody>
  </table>`
      : ""
  }`
      : "";

  const overzichtRijen = overzicht.map((t) => [
    VALUTA_LABELS[t.valuta],
    geldTekst(t.inkomsten, t.valuta),
    geldTekst(t.uitgaven, t.valuta),
    geldTekst(t.ontvangen, t.valuta),
    geldTekst(t.momenteelInKas, t.valuta),
    geldTekst(t.nettoResultaat, t.valuta),
    geldTekst(t.nogTeOntvangen, t.valuta),
    geldTekst(t.nogTeBetalen, t.valuta)
  ]);

  const ftmRijen = overzicht.map((t) => [
    VALUTA_LABELS[t.valuta],
    t.ftmDatumLabel,
    geldTekst(t.ftmBeginsaldo, t.valuta),
    geldTekst(t.ftmErbij, t.valuta),
    geldTekst(t.ftmEruit, t.valuta),
    geldTekst(t.ftmOverdracht, t.valuta),
    geldTekst(t.ftmTotaalInKas, t.valuta)
  ]);

  const gebruikRijen: string[][] = [];
  for (const p of gesorteerd) {
    for (const g of gebruikingenVanPost(p)) {
      gebruikRijen.push([
        formatDatumTijd(g.datum),
        typeLabel(p.type, p),
        p.omschrijving || "",
        gebruikSoortLabel(g),
        geldTekst(g.bedrag, p.valuta),
        gebruikWaaraanTekst(g) || "",
        g.klantNaam || "",
        g.bank || "",
        g.medewerker || "",
        g.toelichting || "",
        p.id
      ]);
    }
  }

  const detailHtml = gesorteerd
    .map((p) => {
      const gebruik = gebruikingenVanPost(p);
      const gebruikTabel = gebruik.length
        ? tabelHtml(
            ["Datum", "Soort", "Bedrag", "Waaraan / naar wie", "Klant", "Bank", "Medewerker", "Toelichting"],
            gebruik.map((g) => [
              formatDatumTijd(g.datum),
              gebruikSoortLabel(g),
              geldTekst(g.bedrag, p.valuta),
              gebruikWaaraanTekst(g) || "—",
              g.klantNaam || "—",
              g.bank || "—",
              g.medewerker || "—",
              g.toelichting || "—"
            ])
          )
        : `<p class="muted">Geen gebruiksregels op dit bedrag.</p>`;
      return `<article class="kaart">
        <h3>${htmlEscape(formatDatumTijd(p.datum))} · ${htmlEscape(typeLabel(p.type, p))} · ${htmlEscape(
          p.omschrijving || "(geen omschrijving)"
        )}</h3>
        ${veldenTabelHtml(postVulvakken(p, opdrachtenById))}
        <p><strong>Van dit bedrag gebruikt</strong></p>
        ${gebruikTabel}
      </article>`;
    })
    .join("");

  const wordMeta = opties.voorWord
    ? `xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"`
    : "";

  return `<!doctype html>
<html lang="nl" ${wordMeta}>
<head>
  <meta charset="utf-8" />
  <title>La-Solución – Financiële administratie</title>
  <style>${rapportStijl()}</style>
</head>
<body>
  <h1>La-Solución – Financiële administratie</h1>
  <div class="meta">
    <p>Volledig rapport: overzicht, dagboek en alle ingevulde velden per post.</p>
    <p>Exportdatum: <strong>${htmlEscape(stamp)}</strong> · Posten: <strong>${gesorteerd.length}</strong></p>
    <p class="muted">Totalen en kasbedragen gebruiken dezelfde berekening als het Financiën-dashboard.</p>
  </div>

  ${huidigeStandHtml}

  <h2>${huidigeStandHtml ? "2" : "1"}. Overzicht per valuta</h2>
  ${
    overzichtRijen.length
      ? tabelHtml(
          [
            "Valuta",
            "Inkomsten",
            "Uitgaven",
            "Ontvangen",
            "Momenteel in kas",
            "Nettoresultaat",
            "Nog te ontvangen",
            "Nog te betalen"
          ],
          overzichtRijen
        )
      : "<p>Geen totalen.</p>"
  }

  <h2>${huidigeStandHtml ? "3" : "2"}. Follow the money per valuta</h2>
  <p class="muted">Kasstand einde dag ${htmlEscape(ftmDagIso)} — opgeteld per medewerker, niet de hele periode.</p>
  ${
    ftmRijen.length
      ? tabelHtml(
          [
            "Valuta",
            "Dag",
            "Beginsaldo",
            "Deze dag erbij",
            "Deze dag eruit",
            "Overgedragen intern",
            "Totaal in kas"
          ],
          ftmRijen
        )
      : "<p>Geen kasbewegingen.</p>"
  }

  <h2>${huidigeStandHtml ? "4" : "3"}. Geld bij personen</h2>
  ${
    geldBij.length
      ? tabelHtml(
          ["Bij wie", "Valuta", "Inkomsten", "Kasgeld", "Uitgaven", "Totaal nu", "Posten"],
          geldBij.map((s) => [
            s.naam,
            s.valuta,
            geldTekst(s.inkomsten, s.valuta),
            geldTekst(s.kasgeld, s.valuta),
            geldTekst(s.uitgaven, s.valuta),
            geldTekst(s.totaal, s.valuta),
            String(s.aantalPosten)
          ])
        )
      : "<p>Geen bedragen bij personen.</p>"
  }

  <h2>${huidigeStandHtml ? "5" : "4"}. Klantsaldo’s</h2>
  ${
    klantSaldi.length
      ? tabelHtml(
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
            geldTekst(s.teOntvangen, s.valuta),
            geldTekst(s.ontvangen, s.valuta),
            geldTekst(s.teBetalen, s.valuta),
            geldTekst(s.uitbetaald, s.valuta),
            geldTekst(s.netto, s.valuta),
            s.statusLabel
          ])
        )
      : "<p>Geen klantsaldo’s.</p>"
  }

  <h2>${huidigeStandHtml ? "6" : "5"}. Dossiersaldo’s</h2>
  ${
    dossierSaldi.length
      ? tabelHtml(
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
            geldTekst(s.teOntvangen, s.valuta),
            geldTekst(s.ontvangen, s.valuta),
            geldTekst(s.teBetalen, s.valuta),
            geldTekst(s.uitbetaald, s.valuta),
            geldTekst(s.netto, s.valuta),
            s.statusLabel
          ])
        )
      : "<p>Geen dossiersaldo’s.</p>"
  }

  <h2>${huidigeStandHtml ? "7" : "6"}. Dagboek</h2>
  ${
    gesorteerd.length
      ? tabelHtml(
          [...DAGBOEK_KOLommen],
          gesorteerd.map((p) => dagboekRij(p, opdrachtenById))
        )
      : "<p>Geen posten.</p>"
  }

  <h2>${huidigeStandHtml ? "8" : "7"}. Gebruiksregels (van dit bedrag gebruikt)</h2>
  ${
    gebruikRijen.length
      ? tabelHtml(
          [
            "Datum",
            "Type post",
            "Post",
            "Soort",
            "Bedrag",
            "Waaraan / naar wie",
            "Klant",
            "Bank",
            "Medewerker",
            "Toelichting",
            "Post-ID"
          ],
          gebruikRijen
        )
      : "<p>Geen gebruiksregels.</p>"
  }

  <h2>${huidigeStandHtml ? "9" : "8"}. Alle posten met vulvakken</h2>
  ${detailHtml || "<p>Geen posten.</p>"}

  ${
    opties.printen
      ? `<script>window.onload = function () { window.focus(); window.print(); };</script>`
      : ""
  }
</body>
</html>`;
}

export function exportFinancieelPdf(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>,
  exportOpties?: FinancieelExportOpties
) {
  const html = bouwRapportHtml(posten, opdrachtenById, { printen: true }, exportOpties);
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("Pop-up geblokkeerd. Sta pop-ups toe om de PDF-export te openen.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

export function exportFinancieelWord(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>,
  exportOpties?: FinancieelExportOpties
) {
  const html = bouwRapportHtml(posten, opdrachtenById, { voorWord: true }, exportOpties);
  downloadBestand(
    `La-Solucion-financieel-${vandaagIso()}.doc`,
    "application/msword",
    html
  );
}

function ssRij(cellen: Array<{ waarde: string; getal?: boolean }>): string {
  return `<Row>${cellen
    .map((c) => {
      if (c.getal) {
        const n = Number(String(c.waarde).replace(",", "."));
        if (Number.isFinite(n) && c.waarde !== "") {
          return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
        }
      }
      return `<Cell><Data ss:Type="String">${xmlEscape(c.waarde)}</Data></Cell>`;
    })
    .join("")}</Row>`;
}

function ssBlad(naam: string, headers: string[], rijen: string[][], getalKolommen: number[] = []): string {
  const kop = `<Row>${headers
    .map(
      (h) =>
        `<Cell ss:StyleID="kop"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`
    )
    .join("")}</Row>`;
  const body = rijen
    .map((row) =>
      ssRij(
        row.map((waarde, i) => ({
          waarde,
          getal: getalKolommen.includes(i)
        }))
      )
    )
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(naam)}"><Table>${kop}${body}</Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions>
  </Worksheet>`;
}

export function exportFinancieelExcel(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>,
  exportOpties?: FinancieelExportOpties
) {
  const gesorteerd = sorteerPosten(posten);
  const ftmDagIso = exportOpties?.ftmDagIso || lokaleDatumIso(new Date());
  const overzicht = berekenFinancieExportOverzicht(posten, ftmDagIso);
  const valuta = exportOpties?.valuta;
  const follow =
    exportOpties?.followTheMoney ??
    (valuta ? berekenFollowTheMoney(posten, ftmDagIso, valuta) : null);
  const geldBij = berekenGeldBijTotalen(posten);
  const klantSaldi = berekenKlantSaldi(posten);
  const dossierSaldi = berekenDossierSaldi(posten, opdrachtenById);

  const huidigeStand =
    valuta && exportOpties?.kpis
      ? ssBlad(
          "Huidige stand",
          ["Onderdeel", "Bedrag"],
          [
            ...(exportOpties.periodeLabel
              ? [["Periode", exportOpties.periodeLabel]]
              : []),
            ["Valuta", VALUTA_LABELS[valuta]],
            ...(follow ? [["Follow the money-dag", follow.datumLabel]] : []),
            ["Inkomsten (periode)", geldTekst(exportOpties.kpis.inkomsten, valuta)],
            ["Uitgaven (periode)", geldTekst(exportOpties.kpis.uitgaven, valuta)],
            ["Momenteel in kas", geldTekst(exportOpties.kpis.inKas, valuta)],
            ["Nettoresultaat (periode)", geldTekst(exportOpties.kpis.netto, valuta)],
            ["Ontvangen", geldTekst(exportOpties.kpis.ontvangen, valuta)],
            ["Nog te ontvangen", geldTekst(exportOpties.kpis.teOntvangen, valuta)],
            ["Openstaand", geldTekst(exportOpties.kpis.openstaand, valuta)],
            ...(follow
              ? [
                  ["FTM — Totaal in kas", geldTekst(follow.totaalInKas, follow.valuta)],
                  ["FTM — Beginsaldo", geldTekst(follow.totaalBegin, follow.valuta)],
                  ["FTM — Deze dag erbij", geldTekst(follow.totaalOntvangen, follow.valuta)],
                  ["FTM — Deze dag eruit", geldTekst(follow.totaalBesteed, follow.valuta)],
                  ["FTM — Overgedragen intern", geldTekst(follow.totaalOverdracht, follow.valuta)]
                ]
              : [])
          ]
        )
      : "";

  const overzichtBlad = ssBlad(
    "Overzicht",
    [
      "Valuta",
      "Inkomsten",
      "Uitgaven",
      "Ontvangen",
      "Momenteel in kas",
      "Nettoresultaat",
      "Nog te ontvangen",
      "Nog te betalen"
    ],
    overzicht.map((t) => [
      VALUTA_LABELS[t.valuta],
      geldTekst(t.inkomsten, t.valuta),
      geldTekst(t.uitgaven, t.valuta),
      geldTekst(t.ontvangen, t.valuta),
      geldTekst(t.momenteelInKas, t.valuta),
      geldTekst(t.nettoResultaat, t.valuta),
      geldTekst(t.nogTeOntvangen, t.valuta),
      geldTekst(t.nogTeBetalen, t.valuta)
    ])
  );

  const ftmBlad = ssBlad(
    "Follow the money",
    [
      "Valuta",
      "Dag",
      "Beginsaldo",
      "Deze dag erbij",
      "Deze dag eruit",
      "Overgedragen intern",
      "Totaal in kas"
    ],
    overzicht.map((t) => [
      VALUTA_LABELS[t.valuta],
      t.ftmDatumLabel,
      geldTekst(t.ftmBeginsaldo, t.valuta),
      geldTekst(t.ftmErbij, t.valuta),
      geldTekst(t.ftmEruit, t.valuta),
      geldTekst(t.ftmOverdracht, t.valuta),
      geldTekst(t.ftmTotaalInKas, t.valuta)
    ])
  );

  const dagboek = ssBlad(
    "Dagboek",
    [...DAGBOEK_KOLommen],
    gesorteerd.map((p) => dagboekRij(p, opdrachtenById))
  );

  const vulvakKoppen = [
    "Post-ID",
    ...(gesorteerd[0] ? postVulvakken(gesorteerd[0], opdrachtenById).map((v) => v.veld) : [])
  ];
  const vulvakken = ssBlad(
    "Vulvakken per post",
    vulvakKoppen.length > 1
      ? vulvakKoppen
      : ["Post-ID", "Datum & tijd", "Type", "Omschrijving"],
    gesorteerd.map((p) => {
      const velden = postVulvakken(p, opdrachtenById);
      return [p.id, ...velden.map((v) => v.waarde)];
    })
  );

  const gebruikRijen: string[][] = [];
  for (const p of gesorteerd) {
    for (const g of gebruikingenVanPost(p)) {
      gebruikRijen.push([
        formatDatumTijd(g.datum),
        typeLabel(p.type, p),
        p.omschrijving || "",
        gebruikSoortLabel(g),
        geldTekst(g.bedrag, p.valuta),
        gebruikWaaraanTekst(g) || "",
        g.klantNaam || "",
        g.bank || "",
        g.medewerker || "",
        g.toelichting || "",
        p.id
      ]);
    }
  }
  const gebruik = ssBlad(
    "Gebruiksregels",
    [
      "Datum",
      "Type post",
      "Post",
      "Soort",
      "Bedrag",
      "Waaraan / naar wie",
      "Klant",
      "Bank",
      "Medewerker",
      "Toelichting",
      "Post-ID"
    ],
    gebruikRijen
  );

  const personen = ssBlad(
    "Geld bij personen",
    ["Bij wie", "Valuta", "Inkomsten", "Kasgeld", "Uitgaven", "Totaal nu", "Posten"],
    geldBij.map((s) => [
      s.naam,
      s.valuta,
      geldTekst(s.inkomsten, s.valuta),
      geldTekst(s.kasgeld, s.valuta),
      geldTekst(s.uitgaven, s.valuta),
      geldTekst(s.totaal, s.valuta),
      String(s.aantalPosten)
    ])
  );

  const klanten = ssBlad(
    "Klantsaldi",
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
      geldTekst(s.teOntvangen, s.valuta),
      geldTekst(s.ontvangen, s.valuta),
      geldTekst(s.teBetalen, s.valuta),
      geldTekst(s.uitbetaald, s.valuta),
      geldTekst(s.netto, s.valuta),
      s.statusLabel
    ])
  );

  const dossiers = ssBlad(
    "Dossiersaldi",
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
      geldTekst(s.teOntvangen, s.valuta),
      geldTekst(s.ontvangen, s.valuta),
      geldTekst(s.teBetalen, s.valuta),
      geldTekst(s.uitbetaald, s.valuta),
      geldTekst(s.netto, s.valuta),
      s.statusLabel
    ])
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="kop"><Font ss:Bold="1"/><Interior ss:Color="#E8EEF8" ss:Pattern="Solid"/></Style>
  </Styles>
  ${huidigeStand}
  ${overzichtBlad}
  ${ftmBlad}
  ${dagboek}
  ${vulvakken}
  ${gebruik}
  ${personen}
  ${klanten}
  ${dossiers}
</Workbook>`;

  downloadBestand(
    `La-Solucion-financieel-${vandaagIso()}.xls`,
    "application/vnd.ms-excel",
    xml
  );
}
