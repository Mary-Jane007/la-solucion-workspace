import { berekenStatistieken } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

function StatKaart({ label, waarde, accent }: { label: string; waarde: number; accent?: string }) {
  return (
    <div className="stat-kaart" style={accent ? { borderColor: accent } : undefined}>
      <span className="stat-kaart-label">{label}</span>
      <span className="stat-kaart-waarde">{waarde}</span>
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

export function StatistiekenPagina({ werkruimte }: Props) {
  const stats = berekenStatistieken(werkruimte.alleOpdrachten);
  const maxMedewerker = Math.max(...stats.perMedewerker.map((m) => m.open), 1);
  const maxMaand = Math.max(...stats.perMaand.map((m) => m.aantal), 1);
  const maxStatus = Math.max(...stats.perStatus.map((s) => s.waarde), 1);

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
