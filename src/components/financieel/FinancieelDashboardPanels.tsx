import { FinancieelPost, FinancieelValuta } from "../../api";
import {
  AfsluitingRapport,
  AgingBucket,
  berekenFinancieleKalender,
  berekenPerCategorie,
  CashflowSamenvatting,
  CategorieTotaal,
  DagVerslag,
  DashboardKpis,
  FactuurRij,
  FollowMoneyDag,
  formatDatumTijd,
  formatGeld,
  GezondheidItem,
  INKOMST_DIENSTEN,
  OpenstaandePost,
  Signalering,
  TijdreeksPunt,
  UITGAVE_CATEGORIEEN,
  verschuifDag,
  WinstVerlies
} from "../../financieelDashboardUtils";
import {
  betalingsLabel,
  formatGeld as formatGeldUtil,
  GeldBijTotaal,
  gebruikingenSamenvatting,
  inkomstKasRegels,
  KlantSaldo,
  normalizeValuta,
  postStatusLabel,
  restantBedrag,
  typeLabel,
  VALUTA_LABELS
} from "../../financieelUtils";
import { Opdracht } from "../../types";

function KpiGrid({ kaarten }: { kaarten: DashboardKpis["kaarten"] }) {
  return (
    <div className="fin-kpi-grid">
      {kaarten.map((k) => (
        <article key={k.id} className={`fin-kpi fin-kpi-${k.tone}`}>
          <span className="fin-kpi-label">{k.label}</span>
          <strong className="fin-kpi-waarde">{k.waarde}</strong>
          {k.hint && <span className="fin-kpi-hint muted">{k.hint}</span>}
          {k.deltaLabel && <span className="fin-kpi-delta">{k.deltaLabel}</span>}
        </article>
      ))}
    </div>
  );
}

function BarChart({ punten, valuta }: { punten: TijdreeksPunt[]; valuta: FinancieelValuta }) {
  if (punten.length === 0) return <p className="muted">Nog geen data voor deze grafiek.</p>;
  const max = Math.max(...punten.map((p) => Math.max(p.inkomsten, p.uitgaven, 1)));
  return (
    <div className="fin-bar-chart" role="img" aria-label="Inkomsten versus uitgaven">
      {punten.map((p) => (
        <div key={p.key} className="fin-bar-col">
          <div className="fin-bar-tracks">
            <div
              className="fin-bar fin-bar-in"
              style={{ height: `${Math.max(4, (p.inkomsten / max) * 100)}%` }}
              title={`Inkomsten ${formatGeld(p.inkomsten, valuta)}`}
            />
            <div
              className="fin-bar fin-bar-uit"
              style={{ height: `${Math.max(4, (p.uitgaven / max) * 100)}%` }}
              title={`Uitgaven ${formatGeld(p.uitgaven, valuta)}`}
            />
          </div>
          <span className="fin-bar-label">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutLegend({ items, valuta }: { items: CategorieTotaal[]; valuta: FinancieelValuta }) {
  if (items.length === 0) return <p className="muted">Geen categorieën.</p>;
  return (
    <ul className="fin-donut-legend">
      {items.map((item) => (
        <li key={item.categorie}>
          <span className="fin-donut-swatch" style={{ width: `${Math.max(8, item.aandeel)}%` }} />
          <div>
            <strong>{item.categorie}</strong>
            <span className="muted">
              {formatGeld(item.bedrag, valuta)} · {item.aandeel}% · {item.aantal} posten
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function HorizontalBars({
  items,
  valuta
}: {
  items: Array<{ bedrag: number; label?: string; categorie?: string; id?: string }>;
  valuta: FinancieelValuta;
}) {
  const max = Math.max(...items.map((i) => i.bedrag), 1);
  return (
    <div className="fin-hbars">
      {items.map((item, idx) => {
        const label = item.label || item.categorie || "—";
        const key = item.id || item.categorie || String(idx);
        return (
          <div key={key} className="fin-hbar-row">
            <span className="fin-hbar-label">{label}</span>
            <div className="fin-hbar-track">
              <div className="fin-hbar-fill" style={{ width: `${(item.bedrag / max) * 100}%` }} />
            </div>
            <span className="fin-hbar-waarde">{formatGeld(item.bedrag, valuta)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function OverzichtPanel({
  kpis,
  gezondheid,
  signaleringen,
  dag,
  tijdreeks,
  overzichtDag,
  onOverzichtDag,
  onOpenTab
}: {
  kpis: DashboardKpis;
  gezondheid: GezondheidItem[];
  signaleringen: Signalering[];
  dag: DagVerslag;
  tijdreeks: TijdreeksPunt[];
  overzichtDag: string;
  onOverzichtDag: (dag: string) => void;
  onOpenTab: (tab: string) => void;
}) {
  return (
    <div className="fin-panel-stack">
      <section className="card page-card fin-today-strip">
        <div className="section-header section-header-row">
          <div>
            <h2>Overzicht per dag</h2>
            <p className="muted">{dag.datumLabel}</p>
          </div>
          <label className="form-label">
            Datum
            <input
              type="date"
              className="form-input"
              value={overzichtDag}
              onChange={(e) => onOverzichtDag(e.target.value)}
            />
          </label>
        </div>
        <div className="fin-today-metrics">
          <div>
            <span className="muted">Beginsaldo / Begon met</span>
            <strong>{formatGeld(dag.beginsaldo, kpis.valuta)}</strong>
          </div>
          <div>
            <span className="muted">Deze dag erbij</span>
            <strong className="financieel-inkomst">{formatGeld(dag.ontvangen, kpis.valuta)}</strong>
          </div>
          <div>
            <span className="muted">Deze dag eruit</span>
            <strong className="financieel-uitgave">{formatGeld(dag.uitgaven, kpis.valuta)}</strong>
          </div>
          <div>
            <span className="muted">Totaal in kas (alle medewerkers)</span>
            <strong className={dag.eindbalans >= 0 ? "financieel-inkomst" : "financieel-uitgave"}>
              {formatGeld(dag.eindbalans, kpis.valuta)}
            </strong>
          </div>
          <div>
            <span className="muted">Mutatie deze dag</span>
            <strong className={dag.netto >= 0 ? "financieel-inkomst" : "financieel-uitgave"}>
              {formatGeld(dag.netto, kpis.valuta)}
            </strong>
          </div>
          <div>
            <span className="muted">Nog te ontvangen</span>
            <strong>{formatGeld(dag.openstaand, kpis.valuta)}</strong>
          </div>
        </div>
        <div className="ftm-day-nav">
          <button type="button" className="btn-secondary" onClick={() => onOpenTab("vandaag")}>
            Open dagverslag
          </button>
          <button type="button" className="btn-secondary" onClick={() => onOpenTab("followmoney")}>
            Follow the money
          </button>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Financieel overzicht</h2>
          <p className="muted">KPI’s voor de geselecteerde periode ({VALUTA_LABELS[kpis.valuta]}).</p>
        </div>
        <KpiGrid kaarten={kpis.kaarten} />
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Financiële gezondheid</h2>
          <p className="muted">Automatische indicatoren op basis van de periode.</p>
        </div>
        <div className="fin-health-grid">
          {gezondheid.map((g) => (
            <article key={g.id} className={`fin-health fin-health-${g.status}`}>
              <div className="fin-health-top">
                <strong>{g.label}</strong>
                <span className="fin-health-badge">{g.statusLabel}</span>
              </div>
              <p className="muted">{g.uitleg}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header section-header-row">
          <div>
            <h2>Financiële aandachtspunten</h2>
            <p className="muted">Signaleringen die actie kunnen vragen.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={() => onOpenTab("analyses")}>
            Alle analyses
          </button>
        </div>
        {signaleringen.length === 0 ? (
          <p className="muted">Geen aandachtspunten voor deze periode.</p>
        ) : (
          <ul className="fin-alerts">
            {signaleringen.slice(0, 8).map((s) => (
              <li key={s.id} className={`fin-alert fin-alert-${s.ernst}`}>
                <div>
                  <strong>{s.onderwerp}</strong>
                  <span className="muted"> · {formatDatumTijd(s.datum)}</span>
                </div>
                <p>{s.uitleg}</p>
                {s.actie && <p className="fin-alert-actie">{s.actie}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Inkomsten vs. uitgaven</h2>
          <p className="muted">Ontwikkeling in de geselecteerde periode.</p>
        </div>
        <BarChart punten={tijdreeks} valuta={kpis.valuta} />
      </section>
    </div>
  );
}

export function VandaagPanel({
  dag,
  valuta,
  geselecteerdeDag,
  onGeselecteerdeDag
}: {
  dag: DagVerslag;
  valuta: FinancieelValuta;
  geselecteerdeDag: string;
  onGeselecteerdeDag: (dag: string) => void;
}) {
  const vorigeDag = () => onGeselecteerdeDag(verschuifDag(geselecteerdeDag, -1));
  const volgendeDag = () => onGeselecteerdeDag(verschuifDag(geselecteerdeDag, 1));
  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="section-header section-header-row">
          <div>
            <h2>Dagelijks financieel verslag</h2>
            <p className="muted">{dag.datumLabel}</p>
          </div>
          <label className="form-label">
            Datum
            <input
              type="date"
              className="form-input"
              value={geselecteerdeDag}
              onChange={(e) => onGeselecteerdeDag(e.target.value)}
            />
          </label>
        </div>
        <div className="ftm-day-nav">
          <button type="button" className="btn-secondary" onClick={vorigeDag}>
            ← Vorige dag
          </button>
          <button type="button" className="btn-secondary" onClick={volgendeDag}>
            Volgende dag →
          </button>
        </div>
        <div className="fin-kpi-grid fin-kpi-grid-compact">
          {(
            [
              ["Beginsaldo / Begon met", dag.beginsaldo, "blauw", true],
              ["Binnen (ontvangen)", dag.ontvangen, "groen", true],
              ["Uitgaven vandaag", dag.uitgaven, "rood", true],
              ["Inkomsten totaal", dag.inkomsten, "groen", true],
              ["Openstaande betalingen", dag.openstaand, "oranje", true],
              ["Nettoresultaat vandaag", dag.netto, dag.netto >= 0 ? "groen" : "rood", true],
              ["Over (eindbalans)", dag.eindbalans, "blauw", true],
              ["Aantal transacties", dag.transacties, "blauw", false]
            ] as const
          ).map(([label, waarde, tone, isGeld]) => (
            <article key={label} className={`fin-kpi fin-kpi-${tone}`}>
              <span className="fin-kpi-label">{label}</span>
              <strong className="fin-kpi-waarde">
                {isGeld ? formatGeld(waarde, valuta) : String(waarde)}
              </strong>
            </article>
          ))}
        </div>
        <div className="fin-two-col">
          <div>
            <h3>Grootste posten</h3>
            <p className="muted">
              Inkomst:{" "}
              {dag.grootsteInkomst
                ? `${dag.grootsteInkomst.omschrijving} (${formatGeld(dag.grootsteInkomst.bedrag, dag.grootsteInkomst.valuta)})`
                : "—"}
            </p>
            <p className="muted">
              Uitgave:{" "}
              {dag.grootsteUitgave
                ? `${dag.grootsteUitgave.omschrijving} (${formatGeld(dag.grootsteUitgave.bedrag, dag.grootsteUitgave.valuta)})`
                : "—"}
            </p>
          </div>
          <div>
            <h3>Geld bij medewerkers op deze dag</h3>
            {dag.geldBijVandaag.length === 0 ? (
              <p className="muted">Nog geen “bij wie”-registraties op deze dag.</p>
            ) : (
              <ul className="fin-simple-list">
                {dag.geldBijVandaag.map((g) => (
                  <li key={`${g.naam}-${g.valuta}`}>
                    <strong>{g.naam}</strong>
                    <span>{formatGeld(g.totaal, g.valuta)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Tijdlijn van de dag</h2>
          <p className="muted">Chronologisch overzicht van alle posten.</p>
        </div>
        {dag.tijdlijn.length === 0 ? (
          <p className="muted">Nog geen transacties op deze dag.</p>
        ) : (
          <ol className="fin-timeline">
            {dag.tijdlijn.map((t) => (
              <li key={t.id}>
                <time>{t.tijd}</time>
                <div>
                  <span>{t.tekst}</span>
                  <strong className={t.positief ? "financieel-inkomst" : "financieel-uitgave"}>
                    {t.bedragLabel}
                  </strong>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="fin-dagresultaat">
          Dagresultaat:{" "}
          <strong className={dag.netto >= 0 ? "financieel-inkomst" : "financieel-uitgave"}>
            {dag.netto >= 0 ? "+" : ""}
            {formatGeld(dag.netto, valuta)}
          </strong>
        </p>
      </section>
    </div>
  );
}

export function PostenTabel({
  posten,
  opdrachtenById,
  onBewerk,
  onDelete,
  emptyText
}: {
  posten: FinancieelPost[];
  opdrachtenById: Map<string, Opdracht>;
  onBewerk: (p: FinancieelPost) => void;
  onDelete: (id: string) => void;
  emptyText: string;
}) {
  if (posten.length === 0) return <p className="muted">{emptyText}</p>;
  return (
    <div className="owner-table-wrapper">
      <table className="owner-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Tijd</th>
            <th>Type</th>
            <th>Categorie</th>
            <th>Omschrijving</th>
            <th>Klant</th>
            <th>Dossier</th>
            <th>Bedrag</th>
            <th>Restant</th>
            <th>Valuta</th>
            <th>Betaling</th>
            <th>Status</th>
            <th>Referentie</th>
            <th>Opmerking</th>
            <th>Van dit bedrag</th>
            <th>Afgehandeld</th>
            <th>Gewijzigd</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posten.map((p) => {
            const d = new Date(p.datum);
            const tijd = Number.isNaN(d.getTime())
              ? "—"
              : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            const dossier = p.opdrachtId
              ? opdrachtenById.get(p.opdrachtId)?.omschrijving || "Dossier"
              : "—";
            return (
              <tr key={p.id}>
                <td>{formatDatumTijd(p.datum).split(",")[0] || formatDatumTijd(p.datum)}</td>
                <td>{tijd}</td>
                <td>
                  <span
                    className={
                      p.type === "UITGAVE"
                        ? "financieel-pill uitgave"
                        : p.type === "OVERDRACHT"
                          ? "financieel-pill overdracht"
                          : "financieel-pill inkomst"
                    }
                  >
                    {typeLabel(p.type, p)}
                  </span>
                </td>
                <td>{p.categorie || "—"}</td>
                <td>{p.omschrijving}{p.bijlagen?.length ? ` · ${p.bijlagen.length} foto${p.bijlagen.length === 1 ? "" : "’s"}` : ""}</td>
                <td>
                  {p.klantNaam ||
                    inkomstKasRegels(p)
                      .map((g) => g.klantNaam)
                      .filter(Boolean)
                      .join(", ") ||
                    "—"}
                </td>
                <td>{dossier}</td>
                <td className={p.type === "UITGAVE" ? "financieel-uitgave" : p.type === "OVERDRACHT" ? "" : "financieel-inkomst"}>
                  {formatGeldUtil(p.bedrag, p.valuta)}
                </td>
                <td>
                  {formatGeldUtil(restantBedrag(p), p.valuta)}
                </td>
                <td>{normalizeValuta(p.valuta)}</td>
                <td>{betalingsLabel(p) || "—"}</td>
                <td>{postStatusLabel(p)}</td>
                <td>{p.referentie || "—"}</td>
                <td>{p.notities || "—"}</td>
                <td>{gebruikingenSamenvatting(p) || "—"}</td>
                <td>{p.afgehandeldDoorNaam || "—"}</td>
                <td>{p.updatedAt ? formatDatumTijd(p.updatedAt) : "—"}</td>
                <td className="financieel-row-actions">
                  <button type="button" className="btn-secondary" onClick={() => onBewerk(p)}>
                    Bewerken
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-danger"
                    onClick={() => onDelete(p.id)}
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OpenstaandPanel({
  rijen,
  valuta
}: {
  rijen: OpenstaandePost[];
  valuta: FinancieelValuta;
}) {
  const inValuta = rijen.filter((r) => normalizeValuta(r.post.valuta) === valuta);
  const totaal = inValuta.reduce((s, r) => s + r.openstaand, 0);
  const achterstallig = inValuta
    .filter((r) => r.urgentie === "achterstallig")
    .reduce((s, r) => s + r.openstaand, 0);

  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="fin-today-metrics">
          <div>
            <span className="muted">Totaal nog te ontvangen</span>
            <strong className="financieel-inkomst">{formatGeld(totaal, valuta)}</strong>
          </div>
          <div>
            <span className="muted">Totaal achterstallig</span>
            <strong className="financieel-uitgave">{formatGeld(achterstallig, valuta)}</strong>
          </div>
        </div>
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Openstaande betalingen</h2>
          <p className="muted">Gesorteerd op urgentie.</p>
        </div>
        {inValuta.length === 0 ? (
          <p className="muted">Geen openstaande klantbetalingen.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th>Omschrijving</th>
                  <th>Factuur</th>
                  <th>Bedrag</th>
                  <th>Dagen open</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inValuta.map((r) => (
                  <tr key={r.post.id}>
                    <td>{r.post.klantNaam || "—"}</td>
                    <td>{r.post.omschrijving}</td>
                    <td>{r.post.referentie || "—"}</td>
                    <td className="financieel-inkomst">{formatGeld(r.openstaand, r.post.valuta)}</td>
                    <td>{r.dagenOpen}</td>
                    <td>
                      <span className={`fin-status fin-status-${r.urgentie}`}>{r.urgentieLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function FacturenPanel({ facturen }: { facturen: FactuurRij[] }) {
  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Facturen</h2>
        <p className="muted">
          Gebaseerd op het veld “referentie / factuurnummer” bij inkomsten. Vul een factuurnummer in
          om hier te verschijnen.
        </p>
      </div>
      {facturen.length === 0 ? (
        <p className="muted">Nog geen factuurnummers geregistreerd.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Factuurnummer</th>
                <th>Klant</th>
                <th>Datum</th>
                <th>Bedrag</th>
                <th>Betaald</th>
                <th>Openstaand</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {facturen.map((f) => (
                <tr key={`${f.factuurnummer}-${f.valuta}`}>
                  <td>{f.factuurnummer}</td>
                  <td>{f.klantNaam}</td>
                  <td>{formatDatumTijd(f.datum)}</td>
                  <td>{formatGeld(f.bedrag, f.valuta)}</td>
                  <td className="financieel-inkomst">{formatGeld(f.betaald, f.valuta)}</td>
                  <td>{formatGeld(f.openstaand, f.valuta)}</td>
                  <td>
                    <span className={`fin-status fin-status-${f.status}`}>{f.statusLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function WinstVerliesPanel({ wv }: { wv: WinstVerlies }) {
  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Winst & verlies</h2>
        <p className="muted">Automatisch berekend voor {VALUTA_LABELS[wv.valuta]}.</p>
      </div>
      <div className="fin-pl">
        <h3>Inkomsten</h3>
        <ul>
          <li>
            <span>Dienstverlening</span>
            <strong className="financieel-inkomst">{formatGeld(wv.dienstverlening, wv.valuta)}</strong>
          </li>
          <li>
            <span>Overige inkomsten</span>
            <strong className="financieel-inkomst">{formatGeld(wv.overigeInkomsten, wv.valuta)}</strong>
          </li>
          <li className="fin-pl-total">
            <span>Totale inkomsten</span>
            <strong>{formatGeld(wv.totaleInkomsten, wv.valuta)}</strong>
          </li>
        </ul>
        <h3>Uitgaven</h3>
        <ul>
          <li>
            <span>Operationele kosten</span>
            <strong className="financieel-uitgave">{formatGeld(wv.operationeel, wv.valuta)}</strong>
          </li>
          <li>
            <span>Personeelskosten</span>
            <strong className="financieel-uitgave">{formatGeld(wv.personeel, wv.valuta)}</strong>
          </li>
          <li>
            <span>Administratie</span>
            <strong className="financieel-uitgave">{formatGeld(wv.administratie, wv.valuta)}</strong>
          </li>
          <li>
            <span>Marketing</span>
            <strong className="financieel-uitgave">{formatGeld(wv.marketing, wv.valuta)}</strong>
          </li>
          <li>
            <span>Transport</span>
            <strong className="financieel-uitgave">{formatGeld(wv.transport, wv.valuta)}</strong>
          </li>
          <li>
            <span>Overige kosten</span>
            <strong className="financieel-uitgave">{formatGeld(wv.overigeKosten, wv.valuta)}</strong>
          </li>
          <li className="fin-pl-total">
            <span>Totale uitgaven</span>
            <strong>{formatGeld(wv.totaleUitgaven, wv.valuta)}</strong>
          </li>
        </ul>
        <ul className="fin-pl-result">
          <li>
            <span>Brutowinst</span>
            <strong>{formatGeld(wv.brutowinst, wv.valuta)}</strong>
          </li>
          <li>
            <span>Nettoresultaat</span>
            <strong className={wv.nettoresultaat >= 0 ? "financieel-inkomst" : "financieel-uitgave"}>
              {formatGeld(wv.nettoresultaat, wv.valuta)}
            </strong>
          </li>
          <li>
            <span>Winstmarge</span>
            <strong>{wv.winstmarge == null ? "—" : `${wv.winstmarge}%`}</strong>
          </li>
        </ul>
      </div>
    </section>
  );
}

export function CashflowPanel({
  cf,
  tijdreeks
}: {
  cf: CashflowSamenvatting;
  tijdreeks: TijdreeksPunt[];
}) {
  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="section-header">
          <h2>Cashflow</h2>
          <p className="muted">Geldstromen in de geselecteerde periode.</p>
        </div>
        <div className="fin-kpi-grid fin-kpi-grid-compact">
          <article className="fin-kpi fin-kpi-groen">
            <span className="fin-kpi-label">Geld binnen</span>
            <strong className="fin-kpi-waarde">{formatGeld(cf.geldBinnen, cf.valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-rood">
            <span className="fin-kpi-label">Geld buiten</span>
            <strong className="fin-kpi-waarde">{formatGeld(cf.geldBuiten, cf.valuta)}</strong>
          </article>
          <article className={`fin-kpi fin-kpi-${cf.netto >= 0 ? "groen" : "rood"}`}>
            <span className="fin-kpi-label">Netto cashflow</span>
            <strong className="fin-kpi-waarde">{formatGeld(cf.netto, cf.valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-blauw">
            <span className="fin-kpi-label">Beginsaldo</span>
            <strong className="fin-kpi-waarde">{formatGeld(cf.beginsaldo, cf.valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-blauw">
            <span className="fin-kpi-label">Eindpositie</span>
            <strong className="fin-kpi-waarde">{formatGeld(cf.eindpositie, cf.valuta)}</strong>
          </article>
        </div>
        {cf.waarschuwingen.length > 0 && (
          <ul className="fin-alerts">
            {cf.waarschuwingen.map((w) => (
              <li key={w} className="fin-alert fin-alert-waarschuwing">
                <p>{w}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Cashflow over tijd</h2>
        </div>
        <BarChart punten={tijdreeks} valuta={cf.valuta} />
      </section>
    </div>
  );
}

export function AnalysesPanel({
  tijdreeks,
  kosten,
  diensten,
  aging,
  kalender,
  signaleringen,
  valuta,
  onDagKlik
}: {
  tijdreeks: TijdreeksPunt[];
  kosten: CategorieTotaal[];
  diensten: CategorieTotaal[];
  aging: AgingBucket[];
  kalender: ReturnType<typeof berekenFinancieleKalender>;
  signaleringen: Signalering[];
  valuta: FinancieelValuta;
  onDagKlik: (datum: string) => void;
}) {
  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="section-header">
          <h2>Inkomsten vs. uitgaven</h2>
        </div>
        <BarChart punten={tijdreeks} valuta={valuta} />
      </section>
      <div className="fin-two-col">
        <section className="card page-card">
          <div className="section-header">
            <h2>Uitgaven per categorie</h2>
          </div>
          <DonutLegend items={kosten} valuta={valuta} />
        </section>
        <section className="card page-card">
          <div className="section-header">
            <h2>Inkomsten per dienst</h2>
          </div>
          <DonutLegend items={diensten} valuta={valuta} />
        </section>
      </div>
      <section className="card page-card">
        <div className="section-header">
          <h2>Openstaande betalingen naar ouderdom</h2>
        </div>
        <HorizontalBars items={aging} valuta={valuta} />
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Financiële kalender</h2>
          <p className="muted">Kleur toont het type activiteit per dag.</p>
        </div>
        <div className="fin-calendar">
          {kalender.map((d) => (
            <button
              key={d.datum}
              type="button"
              className={`fin-cal-day fin-cal-${d.tone}`}
              title={`${d.label}: in ${formatGeld(d.inkomsten, valuta)} / uit ${formatGeld(d.uitgaven, valuta)}`}
              onClick={() => onDagKlik(d.datum)}
            >
              <span>{Number(d.datum.slice(8, 10))}</span>
              <span className="fin-cal-dot" aria-hidden />
            </button>
          ))}
        </div>
        <div className="fin-cal-legend muted">
          <span>Groen: inkomsten</span>
          <span>Rood: uitgaven</span>
          <span>Oranje: openstaand</span>
          <span>Blauw: normaal/geen</span>
        </div>
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Alle signaleringen</h2>
        </div>
        {signaleringen.length === 0 ? (
          <p className="muted">Geen signaleringen.</p>
        ) : (
          <ul className="fin-alerts">
            {signaleringen.map((s) => (
              <li key={s.id} className={`fin-alert fin-alert-${s.ernst}`}>
                <div>
                  <strong>{s.onderwerp}</strong>
                  <span className="muted"> · {formatDatumTijd(s.datum)}</span>
                </div>
                <p>{s.uitleg}</p>
                {s.actie && <p className="fin-alert-actie">{s.actie}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function KostenPanel({ items, valuta }: { items: CategorieTotaal[]; valuta: FinancieelValuta }) {
  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Kosten per categorie</h2>
        <p className="muted">Suggesties: {UITGAVE_CATEGORIEEN.slice(0, 6).join(", ")}, …</p>
      </div>
      <HorizontalBars items={items} valuta={valuta} />
      <DonutLegend items={items} valuta={valuta} />
    </section>
  );
}

export function InkomstenStats({
  valuta,
  kpis,
  posten
}: {
  posten: FinancieelPost[];
  valuta: FinancieelValuta;
  kpis: DashboardKpis;
}) {
  const diensten = berekenPerCategorie(posten, "INKOMST", valuta);
  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="fin-kpi-grid fin-kpi-grid-compact">
          <article className="fin-kpi fin-kpi-groen">
            <span className="fin-kpi-label">Totale inkomsten</span>
            <strong className="fin-kpi-waarde">{formatGeld(kpis.inkomsten, valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-groen">
            <span className="fin-kpi-label">Ontvangen</span>
            <strong className="fin-kpi-waarde">{formatGeld(kpis.ontvangen, valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-oranje">
            <span className="fin-kpi-label">Nog te ontvangen</span>
            <strong className="fin-kpi-waarde">{formatGeld(kpis.teOntvangen, valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-blauw">
            <span className="fin-kpi-label">Gem. / dag</span>
            <strong className="fin-kpi-waarde">{formatGeld(kpis.gemPerDag, valuta)}</strong>
          </article>
          <article className="fin-kpi fin-kpi-blauw">
            <span className="fin-kpi-label">Gem. / klant</span>
            <strong className="fin-kpi-waarde">{formatGeld(kpis.gemPerKlant, valuta)}</strong>
          </article>
        </div>
        <p className="muted">
          Diensten (categorie): {INKOMST_DIENSTEN.join(", ")}. Vul categorie in bij registratie.
        </p>
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Inkomsten per dienst</h2>
        </div>
        <DonutLegend items={diensten} valuta={valuta} />
      </section>
    </div>
  );
}

export function RapportagesPanel({
  afsluitingen,
  onDagAfsluiten,
  onMaandAfsluiten,
  onExportPosten,
  onExportKlant,
  onExportDossier,
  onExportExcel,
  onExportWord,
  onExportPdf,
  disabled
}: {
  afsluitingen: AfsluitingRapport[];
  onDagAfsluiten: () => void;
  onMaandAfsluiten: () => void;
  onExportPosten: () => void;
  onExportKlant: () => void;
  onExportDossier: () => void;
  onExportExcel: () => void;
  onExportWord: () => void;
  onExportPdf: () => void;
  disabled: boolean;
}) {
  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="section-header">
          <h2>Rapportages & export</h2>
          <p className="muted">
            Volledig financieel dossier: overzicht, dagboek, alle vulvakken en gebruiksregels.
          </p>
        </div>
        <div className="financieel-export-actions">
          <button type="button" className="btn-primary" disabled={disabled} onClick={onExportExcel}>
            Excel (volledig)
          </button>
          <button type="button" className="btn-primary" disabled={disabled} onClick={onExportWord}>
            Word (volledig)
          </button>
          <button type="button" className="btn-primary" disabled={disabled} onClick={onExportPdf}>
            PDF / afdrukken
          </button>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          Excel opent als werkboek met tabbladen. Word als document. Bij PDF: kies in het
          printdialoog “Opslaan als PDF”.
        </p>
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Losse tabellen (CSV)</h2>
          <p className="muted">Alleen één tabel, handig om verder te filteren.</p>
        </div>
        <div className="financieel-export-actions">
          <button type="button" className="btn-secondary" disabled={disabled} onClick={onExportPosten}>
            CSV dagboek
          </button>
          <button type="button" className="btn-secondary" disabled={disabled} onClick={onExportKlant}>
            CSV klantbetalingen
          </button>
          <button type="button" className="btn-secondary" disabled={disabled} onClick={onExportDossier}>
            CSV dossiers
          </button>
        </div>
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Dag- en maandafsluiting</h2>
          <p className="muted">
            Sla een snapshot op van vandaag of de huidige maand. Eerdere afsluitingen blijven
            terugvindbaar.
          </p>
        </div>
        <div className="financieel-export-actions">
          <button type="button" className="btn-primary" onClick={onDagAfsluiten}>
            Dag afsluiten
          </button>
          <button type="button" className="btn-secondary" onClick={onMaandAfsluiten}>
            Maand afsluiten
          </button>
        </div>
        {afsluitingen.length === 0 ? (
          <p className="muted">Nog geen afsluitingen bewaard.</p>
        ) : (
          <div className="owner-table-wrapper" style={{ marginTop: 12 }}>
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Periode</th>
                  <th>Opgeslagen</th>
                  <th>Inkomsten</th>
                  <th>Uitgaven</th>
                  <th>Netto</th>
                  <th>Transacties</th>
                </tr>
              </thead>
              <tbody>
                {afsluitingen.map((a) => (
                  <tr key={a.id}>
                    <td>{a.type === "dag" ? "Dag" : "Maand"}</td>
                    <td>{a.periodeLabel}</td>
                    <td>{formatDatumTijd(a.opgeslagenOp)}</td>
                    <td className="financieel-inkomst">{formatGeld(a.inkomsten, a.valuta)}</td>
                    <td className="financieel-uitgave">{formatGeld(a.uitgaven, a.valuta)}</td>
                    <td>{formatGeld(a.netto, a.valuta)}</td>
                    <td>{a.transacties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function InstellingenPanel({
  standaardValuta,
  onValuta,
  geldBij
}: {
  standaardValuta: FinancieelValuta;
  onValuta: (v: FinancieelValuta) => void;
  geldBij: GeldBijTotaal[];
}) {
  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="section-header">
          <h2>Financiële instellingen</h2>
          <p className="muted">Lokale voorkeuren. Originele bedragen/valuta blijven altijd behouden.</p>
        </div>
        <label className="form-label">
          Standaardvaluta (dashboard)
          <select
            className="form-input"
            value={standaardValuta}
            onChange={(e) => onValuta(e.target.value as FinancieelValuta)}
          >
            {(["EUR", "USD", "SRD", "XCG"] as FinancieelValuta[]).map((v) => (
              <option key={v} value={v}>
                {VALUTA_LABELS[v]}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" style={{ marginTop: 12 }}>
          Uitgavencategorieën: {UITGAVE_CATEGORIEEN.join(", ")}.
        </p>
        <p className="muted">Inkomstdiensten: {INKOMST_DIENSTEN.join(", ")}.</p>
        <p className="muted">
          Betalingswijzen: Opgehaald (contant), Overgemaakt (bank), Gestort. Banklijst is uitbreidbaar
          in het registratieformulier.
        </p>
      </section>
      <section className="card page-card">
        <div className="section-header">
          <h2>Geld bij personen (totaal)</h2>
        </div>
        {geldBij.length === 0 ? (
          <p className="muted">Nog geen registraties.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Bij wie</th>
                  <th>Valuta</th>
                  <th>Totaal</th>
                </tr>
              </thead>
              <tbody>
                {geldBij.map((g) => (
                  <tr key={`${g.naam}-${g.valuta}`}>
                    <td>{g.naam}</td>
                    <td>{g.valuta}</td>
                    <td>
                      <strong>{formatGeld(g.totaal, g.valuta)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function KlantbetalingenPanel({ saldi }: { saldi: KlantSaldo[] }) {
  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Klantbetalingen</h2>
        <p className="muted">Saldo per klant en valuta.</p>
      </div>
      {saldi.length === 0 ? (
        <p className="muted">Nog geen klantbetalingen.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Klant</th>
                <th>Valuta</th>
                <th>Nog te ontvangen</th>
                <th>Ontvangen</th>
                <th>Nog te betalen (wij)</th>
                <th>Uitbetaald</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {saldi.map((s) => (
                <tr key={`${s.klantNaam}-${s.valuta}`}>
                  <td>{s.klantNaam}</td>
                  <td>{s.valuta}</td>
                  <td className="financieel-inkomst">{formatGeldUtil(s.teOntvangen, s.valuta)}</td>
                  <td>{formatGeldUtil(s.ontvangen, s.valuta)}</td>
                  <td className="financieel-uitgave">{formatGeldUtil(s.teBetalen, s.valuta)}</td>
                  <td>{formatGeldUtil(s.uitbetaald, s.valuta)}</td>
                  <td>
                    <span className={`financieel-pill ${s.statusClass}`}>{s.statusLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FollowTheMoneyPanel({
  dag,
  onDagWissel
}: {
  dag: FollowMoneyDag;
  onDagWissel: (iso: string) => void;
}) {
  const vorigeDag = () => onDagWissel(verschuifDag(dag.datum, -1));
  const volgendeDag = () => onDagWissel(verschuifDag(dag.datum, 1));

  return (
    <div className="fin-panel-stack">
      <section className="card page-card">
        <div className="section-header section-header-row">
          <div>
            <h2>Follow the money</h2>
            <p className="muted">
              Waar het geld vandaan kwam, bij wie het was, en elk bedrag apart — {dag.datumLabel}.
            </p>
          </div>
          <div className="ftm-day-nav">
            <button type="button" className="btn-secondary" onClick={vorigeDag}>
              Vorige dag
            </button>
            <input
              type="date"
              className="form-input"
              value={dag.datum}
              onChange={(e) => e.target.value && onDagWissel(e.target.value)}
              aria-label="Kies een dag"
            />
            <button type="button" className="btn-secondary" onClick={volgendeDag}>
              Volgende dag
            </button>
          </div>
        </div>
        <div className="fin-today-metrics">
          <div className="fin-metric-primary">
            <span className="muted">Totaal in kas (alle medewerkers)</span>
            <strong className="financieel-inkomst">{formatGeld(dag.totaalInKas, dag.valuta)}</strong>
            <span className="fin-kpi-hint muted">
              Einde van deze dag · opgeteld per medewerker · niet de hele maand/periode
            </span>
          </div>
          <div>
            <span className="muted">Beginsaldo / Begon met</span>
            <strong>{formatGeld(dag.totaalBegin, dag.valuta)}</strong>
            <span className="fin-kpi-hint muted">start van deze dag</span>
          </div>
          <div>
            <span className="muted">Deze dag erbij</span>
            <strong className="financieel-inkomst">{formatGeld(dag.totaalOntvangen, dag.valuta)}</strong>
          </div>
          <div>
            <span className="muted">Deze dag eruit</span>
            <strong className="financieel-uitgave">{formatGeld(dag.totaalBesteed, dag.valuta)}</strong>
          </div>
          <div>
            <span className="muted">Overgedragen intern</span>
            <strong>{formatGeld(dag.totaalOverdracht, dag.valuta)}</strong>
            <span className="fin-kpi-hint muted">verplaatst tussen medewerkers · kas totaal blijft gelijk</span>
          </div>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Bij wie ligt het geld?</h2>
          <p className="muted">
            Beginsaldo is hetzelfde als “Begon met”. Wat je niet besteedt, blijft automatisch in Over en gaat door naar morgen.
          </p>
        </div>
        {dag.personen.length === 0 ? (
          <p className="muted">Deze dag geen kasbewegingen en geen beginsaldo.</p>
        ) : (
          <div className="ftm-personen">
            {dag.personen.map((p) => (
              <article key={p.key} className="ftm-persoon">
                <h3>{p.naam}</h3>
                <dl>
                  <div>
                    <dt>Beginsaldo / Begon met</dt>
                    <dd>{formatGeld(p.beginsaldo, dag.valuta)}</dd>
                  </div>
                  <div>
                    <dt>Erbij</dt>
                    <dd className="financieel-inkomst">+{formatGeld(p.binnen, dag.valuta)}</dd>
                  </div>
                  <div>
                    <dt>Eruit</dt>
                    <dd className="financieel-uitgave">−{formatGeld(p.uit, dag.valuta)}</dd>
                  </div>
                  <div>
                    <dt>Over (→ volgende dag)</dt>
                    <dd>
                      <strong>{formatGeld(p.over, dag.valuta)}</strong>
                    </dd>
                  </div>
                </dl>
                {p.bewegingen.length > 0 && (
                  <ul className="ftm-bewegingen">
                    {p.bewegingen.map((b) => (
                      <li key={b.id} className={`ftm-beweging ftm-beweging-${b.soort}`}>
                        <span>{b.titel}</span>
                        <em>{b.bedragLabel}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Het spoor van vandaag</h2>
          <p className="muted">Elk bedrag apart: beginsaldo, inkomsten, betalingen, uitgaven en overdrachten.</p>
        </div>
        {dag.gebeurtenissen.length === 0 ? (
          <p className="muted">Geen kasbewegingen op deze dag. Blader terug of registreer een post.</p>
        ) : (
          <ol className="ftm-lijn">
            {dag.gebeurtenissen.map((g) => (
              <li key={g.id} className={`ftm-node ftm-node-${g.soort}`}>
                <time>{g.tijd}</time>
                <div className="ftm-node-body">
                  <strong>{g.titel}</strong>
                  <span>{g.uitleg}</span>
                </div>
                <em>{g.bedragLabel}</em>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Waaraan besteed</h2>
        </div>
        {dag.besteed.length === 0 ? (
          <p className="muted">Geen uitgaven op deze dag.</p>
        ) : (
          <ul className="fin-simple-list">
            {dag.besteed.map((b) => (
              <li key={b.categorie}>
                <strong>{b.categorie}</strong>
                <span className="financieel-uitgave">{formatGeld(b.bedrag, dag.valuta)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
