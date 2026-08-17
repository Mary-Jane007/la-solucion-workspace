import { useEffect, useMemo, useState } from "react";
import { AppPagina } from "../appPages";
import { fetchFinancieel, FinancieelPost, FinancieelValuta } from "../api";
import {
  berekenDashboardKpis,
  berekenOpenstaandeBetalingen,
  berekenPeriode,
  filterOpValuta,
  filterPostenInPeriode,
  standaardValutaLaden,
  vorigePeriode
} from "../financieelDashboardUtils";
import { formatGeld, normalizeValuta, VALUTA_LABELS } from "../financieelUtils";
import { berekenStatistieken } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  onNavigeer?: (pagina: AppPagina) => void;
}

function StatKaart({ label, waarde, accent }: { label: string; waarde: number; accent?: string }) {
  return (
    <div className="stat-kaart" style={accent ? { borderColor: accent } : undefined}>
      <span className="stat-kaart-label">{label}</span>
      <span className="stat-kaart-waarde">{waarde}</span>
    </div>
  );
}

function GeldKaart({
  label,
  waarde,
  tone
}: {
  label: string;
  waarde: string;
  tone?: "groen" | "rood" | "oranje" | "blauw";
}) {
  return (
    <div className={`stat-kaart${tone ? ` stat-kaart-${tone}` : ""}`}>
      <span className="stat-kaart-label">{label}</span>
      <span className="stat-kaart-waarde stat-kaart-geld">{waarde}</span>
    </div>
  );
}

function StaafDiagram({
  items,
  max
}: {
  items: { label: string; waarde: number; kleur?: string }[];
  max: number;
}) {
  return (
    <div className="staaf-diagram">
      {items.map((item) => (
        <div key={item.label} className="staaf-row">
          <span className="staaf-label">{item.label}</span>
          <div className="staaf-track">
            <div
              className="staaf-fill"
              style={{
                width: max > 0 ? `${(item.waarde / max) * 100}%` : "0%",
                background: item.kleur || "var(--color-accent)"
              }}
            />
          </div>
          <span className="staaf-waarde">{item.waarde}</span>
        </div>
      ))}
    </div>
  );
}

export function StatistiekenPagina({ werkruimte, onNavigeer }: Props) {
  const stats = berekenStatistieken(werkruimte.alleOpdrachten);
  const maxMedewerker = Math.max(...stats.perMedewerker.map((m) => m.open), 1);
  const maxMaand = Math.max(...stats.perMaand.map((m) => m.aantal), 1);
  const maxStatus = Math.max(...stats.perStatus.map((s) => s.waarde), 1);

  const [posten, setPosten] = useState<FinancieelPost[]>([]);
  const [financieelLaden, setFinancieelLaden] = useState(true);
  const [financieelFout, setFinancieelFout] = useState<string | null>(null);
  const [valuta] = useState<FinancieelValuta>(() => standaardValutaLaden());

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        setFinancieelLaden(true);
        setFinancieelFout(null);
        const lijst = await fetchFinancieel();
        if (actief) setPosten(lijst);
      } catch (e) {
        if (actief) {
          setFinancieelFout(e instanceof Error ? e.message : "Kon financiën niet laden.");
        }
      } finally {
        if (actief) setFinancieelLaden(false);
      }
    })();
    return () => {
      actief = false;
    };
  }, []);

  const financieel = useMemo(() => {
    const bereik = berekenPeriode("maand");
    const vorig = vorigePeriode(bereik);
    const periodePosten = filterOpValuta(filterPostenInPeriode(posten, bereik), valuta);
    const vorigePosten = filterOpValuta(filterPostenInPeriode(posten, vorig), valuta);
    const dagen = Math.max(
      1,
      Math.ceil((bereik.tot.getTime() - bereik.van.getTime()) / 86400000)
    );
    const kpis = berekenDashboardKpis(periodePosten, vorigePosten, valuta, dagen);
    const openstaand = berekenOpenstaandeBetalingen(posten).filter(
      (r) => normalizeValuta(r.post.valuta) === valuta
    );
    const achterstallig = openstaand
      .filter((r) => r.urgentie === "achterstallig")
      .reduce((s, r) => s + r.openstaand, 0);
    return { kpis, openAantal: openstaand.length, achterstallig, bereikLabel: bereik.label };
  }, [posten, valuta]);

  return (
    <div className="stats-page">
      <section className="card page-card">
        <div className="section-header">
          <h2>Kerncijfers</h2>
          <p className="muted">Live overzicht van alle opdrachten in het systeem.</p>
        </div>
        <div className="stat-grid">
          <StatKaart label="Totaal opdrachten" waarde={stats.totaal} />
          <StatKaart label="Nieuw" waarde={stats.nieuw} accent="#3b82f6" />
          <StatKaart label="Afwachting" waarde={stats.afwachting} accent="#a78bfa" />
          <StatKaart label="In behandeling" waarde={stats.lopend} accent="#f59e0b" />
          <StatKaart label="Afgerond" waarde={stats.afgerond} accent="#22c55e" />
          <StatKaart label="P1 open" waarde={stats.p1} accent="#ef4444" />
          <StatKaart label="Te laat" waarde={stats.teLaat} accent="#dc2626" />
          <StatKaart label="Deadline vandaag" waarde={stats.deadlineVandaag} />
          <StatKaart label="Deze week" waarde={stats.deadlineDezeWeek} />
          <StatKaart label="Klanten" waarde={stats.klanten} />
          <StatKaart label="Documenten" waarde={stats.documenten} />
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header section-header-row">
          <div>
            <h2>Financiën</h2>
            <p className="muted">
              {financieel.bereikLabel} · {VALUTA_LABELS[valuta]}. Volledig dashboard onder Beheer →
              Financiën.
            </p>
          </div>
          {onNavigeer && (
            <button type="button" className="btn-secondary" onClick={() => onNavigeer("financieel")}>
              Open Financiën
            </button>
          )}
        </div>
        {financieelLaden ? (
          <p className="muted">Financiële cijfers laden...</p>
        ) : financieelFout ? (
          <p className="muted page-error">{financieelFout}</p>
        ) : (
          <div className="stat-grid">
            <GeldKaart
              label="Inkomsten"
              waarde={formatGeld(financieel.kpis.inkomsten, valuta)}
              tone="groen"
            />
            <GeldKaart
              label="Uitgaven"
              waarde={formatGeld(financieel.kpis.uitgaven, valuta)}
              tone="rood"
            />
            <GeldKaart
              label="Nettoresultaat"
              waarde={formatGeld(financieel.kpis.netto, valuta)}
              tone={financieel.kpis.netto >= 0 ? "groen" : "rood"}
            />
            <GeldKaart
              label="Nog te ontvangen"
              waarde={formatGeld(financieel.kpis.teOntvangen, valuta)}
              tone="oranje"
            />
            <GeldKaart
              label="Ontvangen betalingen"
              waarde={formatGeld(financieel.kpis.ontvangen, valuta)}
              tone="groen"
            />
            <GeldKaart
              label="Achterstallig"
              waarde={formatGeld(financieel.achterstallig, valuta)}
              tone={financieel.achterstallig > 0 ? "rood" : "blauw"}
            />
            <StatKaart label="Transacties (periode)" waarde={financieel.kpis.transacties} />
            <StatKaart label="Openstaande posten" waarde={financieel.openAantal} accent="#fb923c" />
          </div>
        )}
      </section>

      <div className="stats-split">
        <section className="card page-card">
          <h2>Statusverdeling</h2>
          <StaafDiagram
            max={maxStatus}
            items={stats.perStatus.map((s) => ({
              label: s.label,
              waarde: s.waarde,
              kleur: s.kleur
            }))}
          />
        </section>

        <section className="card page-card">
          <h2>Open prioriteiten</h2>
          <StaafDiagram
            max={Math.max(stats.p1, stats.p2, stats.p3, 1)}
            items={[
              { label: "P1 – Hoog", waarde: stats.p1, kleur: "#ef4444" },
              { label: "P2 – Normaal", waarde: stats.p2, kleur: "#f59e0b" },
              { label: "P3 – Laag", waarde: stats.p3, kleur: "#6b7280" }
            ]}
          />
        </section>
      </div>

      <section className="card page-card">
        <h2>Werkdruk per medewerker</h2>
        {stats.perMedewerker.length === 0 ? (
          <p className="muted">Nog geen data beschikbaar.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Medewerker</th>
                  <th>Open</th>
                  <th>Afgerond</th>
                  <th>Totaal</th>
                  <th>Belasting</th>
                </tr>
              </thead>
              <tbody>
                {stats.perMedewerker.map((m) => (
                  <tr key={m.naam}>
                    <td>{m.naam}</td>
                    <td>{m.open}</td>
                    <td>{m.afgerond}</td>
                    <td>{m.totaal}</td>
                    <td className="stat-belasting-cell">
                      <div className="staaf-track staaf-track-inline">
                        <div
                          className="staaf-fill"
                          style={{ width: `${(m.open / maxMedewerker) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card page-card">
        <h2>Nieuwe opdrachten per maand</h2>
        {stats.perMaand.length === 0 ? (
          <p className="muted">Nog geen maanddata.</p>
        ) : (
          <StaafDiagram
            max={maxMaand}
            items={stats.perMaand.map((m) => ({
              label: m.label,
              waarde: m.aantal,
              kleur: "#3b82f6"
            }))}
          />
        )}
      </section>
    </div>
  );
}
