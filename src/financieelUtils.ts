import { FinancieelPost } from "./api";
import { Opdracht } from "./types";

export type SaldoCijfers = {
  teOntvangen: number;
  ontvangen: number;
  teBetalen: number;
  uitbetaald: number;
};

export type KlantSaldo = SaldoCijfers & {
  klantNaam: string;
  netto: number;
  statusLabel: string;
  statusClass: string;
};

export type DossierSaldo = SaldoCijfers & {
  opdrachtId: string;
  klantNaam: string;
  dossierLabel: string;
  netto: number;
  statusLabel: string;
  statusClass: string;
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

export function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR"
  }).format(bedrag);
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

export function berekenKlantSaldi(posten: FinancieelPost[]): KlantSaldo[] {
  const map = new Map<string, SaldoCijfers>();

  for (const p of posten) {
    const naam = (p.klantNaam || "").trim();
    if (!naam) continue;
    map.set(naam, telPostOp(map.get(naam) || leegSaldo(), p));
  }

  return [...map.entries()]
    .map(([klantNaam, s]) => {
      const netto = s.teOntvangen - s.teBetalen;
      return { klantNaam, ...s, netto, ...saldoStatus(s) };
    })
    .sort((a, b) => {
      const aOpen = a.teOntvangen + a.teBetalen;
      const bOpen = b.teOntvangen + b.teBetalen;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return a.klantNaam.localeCompare(b.klantNaam, "nl");
    });
}

export function berekenDossierSaldi(
  posten: FinancieelPost[],
  opdrachtenById: Map<string, Opdracht>
): DossierSaldo[] {
  const map = new Map<string, SaldoCijfers>();

  for (const p of posten) {
    const id = (p.opdrachtId || "").trim();
    if (!id) continue;
    map.set(id, telPostOp(map.get(id) || leegSaldo(), p));
  }

  return [...map.entries()]
    .map(([opdrachtId, s]) => {
      const opdracht = opdrachtenById.get(opdrachtId);
      const klantNaam =
        opdracht?.klantNaam?.trim() ||
        posten.find((p) => p.opdrachtId === opdrachtId)?.klantNaam?.trim() ||
        "Onbekende klant";
      const dossierLabel = opdracht
        ? opdrachtDossierLabel(opdracht)
        : `${klantNaam} – (dossier niet meer beschikbaar)`;
      const netto = s.teOntvangen - s.teBetalen;
      return {
        opdrachtId,
        klantNaam,
        dossierLabel,
        ...s,
        netto,
        ...saldoStatus(s)
      };
    })
    .sort((a, b) => {
      const aOpen = a.teOntvangen + a.teBetalen;
      const bOpen = b.teOntvangen + b.teBetalen;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return a.dossierLabel.localeCompare(b.dossierLabel, "nl");
    });
}

export function postStatusLabel(p: FinancieelPost): string {
  if (p.status === "BETAALD") {
    return p.type === "INKOMST" ? "Betaald door klant" : "Uitbetaald";
  }
  return p.type === "INKOMST" ? "Klant moet nog betalen" : "Wij moeten nog betalen";
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
    "Klant",
    "Dossier",
    "Omschrijving",
    "Categorie",
    "Referentie",
    "Bedrag",
    "Status",
    "Afgehandeld door",
    "Notities"
  ];
  const rows = posten.map((p) => [
    p.datum.includes("T") ? formatDatumTijd(p.datum) : p.datum.slice(0, 10),
    p.type === "INKOMST" ? "Inkomst" : "Uitgave",
    p.klantNaam || "",
    dossierLabelVoorPost(p, opdrachtenById),
    p.omschrijving,
    p.categorie || "",
    p.referentie || "",
    String(p.bedrag).replace(".", ","),
    postStatusLabel(p),
    p.afgehandeldDoorNaam || "",
    p.notities || ""
  ]);
  downloadCsv(`financieel-posten-${vandaagIso()}.csv`, headers, rows);
}

export function exportKlantSaldiCsv(posten: FinancieelPost[]) {
  const saldi = berekenKlantSaldi(posten);
  const headers = [
    "Klant",
    "Nog te betalen (klant)",
    "Al betaald (klant)",
    "Nog te betalen (wij)",
    "Al uitbetaald",
    "Netto open",
    "Status"
  ];
  const rows = saldi.map((s) => [
    s.klantNaam,
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
  const inkomsten = posten.filter((p) => p.type === "INKOMST").reduce((s, p) => s + p.bedrag, 0);
  const uitgaven = posten.filter((p) => p.type === "UITGAVE").reduce((s, p) => s + p.bedrag, 0);

  const postenTabel = tabelHtml(
    ["Datum", "Type", "Klant", "Dossier", "Omschrijving", "Bedrag", "Status", "Afgehandeld door"],
    posten.map((p) => [
      formatDatumTijd(p.datum),
      p.type === "INKOMST" ? "Inkomst" : "Uitgave",
      p.klantNaam || "—",
      dossierLabelVoorPost(p, opdrachtenById) || "—",
      p.omschrijving,
      formatEuro(p.bedrag),
      postStatusLabel(p),
      p.afgehandeldDoorNaam || "—"
    ])
  );

  const klantTabel = tabelHtml(
    [
      "Klant",
      "Nog te betalen (klant)",
      "Al betaald",
      "Nog te betalen (wij)",
      "Uitbetaald",
      "Netto",
      "Status"
    ],
    klantSaldi.map((s) => [
      s.klantNaam,
      formatEuro(s.teOntvangen),
      formatEuro(s.ontvangen),
      formatEuro(s.teBetalen),
      formatEuro(s.uitbetaald),
      formatEuro(s.netto),
      s.statusLabel
    ])
  );

  const dossierTabel = tabelHtml(
    [
      "Dossier",
      "Nog te betalen (klant)",
      "Al betaald",
      "Nog te betalen (wij)",
      "Uitbetaald",
      "Netto",
      "Status"
    ],
    dossierSaldi.map((s) => [
      s.dossierLabel,
      formatEuro(s.teOntvangen),
      formatEuro(s.ontvangen),
      formatEuro(s.teBetalen),
      formatEuro(s.uitbetaald),
      formatEuro(s.netto),
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
    .totals span { display: inline-block; margin-right: 18px; }
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
    <p class="totals">
      <span>Inkomsten: <strong>${htmlEscape(formatEuro(inkomsten))}</strong></span>
      <span>Uitgaven: <strong>${htmlEscape(formatEuro(uitgaven))}</strong></span>
      <span>Saldo: <strong>${htmlEscape(formatEuro(inkomsten - uitgaven))}</strong></span>
      <span>Posten: <strong>${posten.length}</strong></span>
    </p>
  </div>
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
