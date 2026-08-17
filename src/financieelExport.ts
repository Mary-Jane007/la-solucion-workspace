import { FinancieelGebruik, FinancieelPost } from "./api";
import { Opdracht } from "./types";
import {
  betalingsLabel,
  berekenDossierSaldi,
  berekenGeldBijTotalen,
  berekenKlantSaldi,
  berekenTotalenPerValuta,
  formatDatumTijd,
  formatGeld,
  gebruikWaaraanTekst,
  huidigKasSaldo,
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

function gebruikingenVanPost(p: FinancieelPost): FinancieelGebruik[] {
  return normaliseerGebruikingen(p.gebruikingen);
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
    { veld: "Type", waarde: typeLabel(p.type) },
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
      const richting = g.soort === "ERBIJ" ? "erbij" : "af";
      return `${formatDatumTijd(g.datum)} · ${richting} ${geldTekst(g.bedrag, p.valuta)}${
        waar ? ` · ${waar}` : ""
      }${g.toelichting ? ` (${g.toelichting})` : ""}`;
    })
    .join(" | ");
  return [
    formatDatumTijd(p.datum),
    typeLabel(p.type),
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
  opties: { voorWord?: boolean; printen?: boolean }
): string {
  const gesorteerd = sorteerPosten(posten);
  const totalen = berekenTotalenPerValuta(posten);
  const geldBij = berekenGeldBijTotalen(posten);
  const klantSaldi = berekenKlantSaldi(posten);
  const dossierSaldi = berekenDossierSaldi(posten, opdrachtenById);
  const stamp = new Date().toLocaleString("nl-NL");

  const overzichtRijen = totalen.map((t) => [
    VALUTA_LABELS[t.valuta],
    geldTekst(t.inkomsten, t.valuta),
    geldTekst(t.kasgeld, t.valuta),
    geldTekst(t.uitgaven, t.valuta),
    geldTekst(t.saldo, t.valuta),
    geldTekst(huidigKasSaldo(posten, t.valuta), t.valuta),
    geldTekst(t.teOntvangen, t.valuta),
    geldTekst(t.teBetalen, t.valuta)
  ]);

  const gebruikRijen: string[][] = [];
  for (const p of gesorteerd) {
    for (const g of gebruikingenVanPost(p)) {
      gebruikRijen.push([
        formatDatumTijd(g.datum),
        typeLabel(p.type),
        p.omschrijving || "",
        g.soort === "ERBIJ" ? "Erbij" : "Af / besteed",
        geldTekst(g.bedrag, p.valuta),
        gebruikWaaraanTekst(g) || "",
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
            ["Datum", "Soort", "Bedrag", "Waaraan / naar wie", "Bank", "Medewerker", "Toelichting"],
            gebruik.map((g) => [
              formatDatumTijd(g.datum),
              g.soort === "ERBIJ" ? "Erbij" : "Af / besteed",
              geldTekst(g.bedrag, p.valuta),
              gebruikWaaraanTekst(g) || "—",
              g.bank || "—",
              g.medewerker || "—",
              g.toelichting || "—"
            ])
          )
        : `<p class="muted">Geen gebruiksregels op dit bedrag.</p>`;
      return `<article class="kaart">
        <h3>${htmlEscape(formatDatumTijd(p.datum))} · ${htmlEscape(typeLabel(p.type))} · ${htmlEscape(
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
  </div>

  <h2>1. Overzicht</h2>
  ${
    overzichtRijen.length
      ? tabelHtml(
          [
            "Valuta",
            "Inkomsten",
            "Kasgeld-posten",
            "Uitgaven",
            "Saldo (P&L)",
            "Momenteel in kas",
            "Nog te ontvangen",
            "Nog te betalen"
          ],
          overzichtRijen
        )
      : "<p>Geen totalen.</p>"
  }

  <h2>2. Geld bij personen</h2>
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

  <h2>3. Klantsaldo’s</h2>
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

  <h2>4. Dossiersaldo’s</h2>
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

  <h2>5. Dagboek</h2>
  ${
    gesorteerd.length
      ? tabelHtml(
          [...DAGBOEK_KOLommen],
          gesorteerd.map((p) => dagboekRij(p, opdrachtenById))
        )
      : "<p>Geen posten.</p>"
  }

  <h2>6. Gebruiksregels (van dit bedrag gebruikt)</h2>
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
            "Bank",
            "Medewerker",
            "Toelichting",
            "Post-ID"
          ],
          gebruikRijen
        )
      : "<p>Geen gebruiksregels.</p>"
  }

  <h2>7. Alle posten met vulvakken</h2>
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
  opdrachtenById: Map<string, Opdracht>
) {
  const html = bouwRapportHtml(posten, opdrachtenById, { printen: true });
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
  opdrachtenById: Map<string, Opdracht>
) {
  const html = bouwRapportHtml(posten, opdrachtenById, { voorWord: true });
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
  opdrachtenById: Map<string, Opdracht>
) {
  const gesorteerd = sorteerPosten(posten);
  const totalen = berekenTotalenPerValuta(posten);
  const geldBij = berekenGeldBijTotalen(posten);
  const klantSaldi = berekenKlantSaldi(posten);
  const dossierSaldi = berekenDossierSaldi(posten, opdrachtenById);

  const overzicht = ssBlad(
    "Overzicht",
    [
      "Valuta",
      "Inkomsten",
      "Kasgeld-posten",
      "Uitgaven",
      "Saldo P&L",
      "Momenteel in kas",
      "Nog te ontvangen",
      "Nog te betalen"
    ],
    totalen.map((t) => [
      VALUTA_LABELS[t.valuta],
      geldTekst(t.inkomsten, t.valuta),
      geldTekst(t.kasgeld, t.valuta),
      geldTekst(t.uitgaven, t.valuta),
      geldTekst(t.saldo, t.valuta),
      geldTekst(huidigKasSaldo(posten, t.valuta), t.valuta),
      geldTekst(t.teOntvangen, t.valuta),
      geldTekst(t.teBetalen, t.valuta)
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
        typeLabel(p.type),
        p.omschrijving || "",
        g.soort === "ERBIJ" ? "Erbij" : "Af / besteed",
        geldTekst(g.bedrag, p.valuta),
        gebruikWaaraanTekst(g) || "",
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
  ${overzicht}
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
