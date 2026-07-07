import { Opdracht, OpdrachtStatus } from "../types";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  isEigenaar: boolean;
  onNieuweOpdracht: () => void;
}

export function Dashboard({ werkruimte, isEigenaar, onNieuweOpdracht }: Props) {
  const { zichtbareOpdrachten, openOpdracht, opdrachtFout } = werkruimte;

  const belangrijksteOpdrachten = [...zichtbareOpdrachten]
    .filter((o) => o.status !== OpdrachtStatus.Afgerond && o.prioriteit === 1)
    .sort((a, b) => {
      if (a.datumDeadline && b.datumDeadline) return a.datumDeadline.localeCompare(b.datumDeadline);
      if (a.datumDeadline) return -1;
      if (b.datumDeadline) return 1;
      return a.klantNaam.localeCompare(b.klantNaam);
    });

  const aantallen = {
    totaal: zichtbareOpdrachten.length,
    nieuw: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Nieuw).length,
    lopend: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.InBehandeling).length,
    afgerond: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Afgerond).length
  };

  const vandaagIso = new Date().toISOString().slice(0, 10);
  const vandaagDue = zichtbareOpdrachten.filter((o) => o.datumDeadline === vandaagIso);

  return (
    <>
      {opdrachtFout && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="muted page-error">{opdrachtFout}</p>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="card metric-card metric-main">
          <div className="metric-header">
            <h2>Belangrijkste taken</h2>
            {isEigenaar && (
              <button type="button" className="btn-secondary" onClick={onNieuweOpdracht}>
                Opdracht toevoegen
              </button>
            )}
          </div>
          <p className="metric-subtitle">Alleen openstaande opdrachten met hoge prioriteit (P1).</p>
          <div className="important-list">
            {belangrijksteOpdrachten.map((o) => (
              <button key={o.id} type="button" className="important-item" onClick={() => openOpdracht(o)}>
                <div className="important-main">
                  <span className="important-client">{o.klantNaam}</span>
                  <span className={`pill pill-prio-${o.prioriteit}`}>Prioriteit {o.prioriteit}</span>
                </div>
                <div className="important-sub">
                  <span>{o.omschrijving}</span>
                  {o.datumDeadline && (
                    <span className="important-deadline">
                      Deadline: {new Date(o.datumDeadline).toLocaleDateString("nl-NL")}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {belangrijksteOpdrachten.length === 0 && (
              <p className="muted">Geen openstaande opdrachten met hoge prioriteit.</p>
            )}
          </div>
        </section>

        <section className="card metric-card">
          <h2>Overzicht opdrachten</h2>
          <div className="metric-row">
            <div className="metric-badge">
              <span className="metric-label">Totaal</span>
              <span className="metric-value">{aantallen.totaal}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Nieuw</span>
              <span className="metric-value">{aantallen.nieuw}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Lopend</span>
              <span className="metric-value">{aantallen.lopend}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Afgerond</span>
              <span className="metric-value">{aantallen.afgerond}</span>
            </div>
          </div>
        </section>

        <section className="card metric-card">
          <h2>Vandaag in de gaten houden</h2>
          {vandaagDue.length === 0 ? (
            <p className="muted">Geen opdrachten met deadline vandaag.</p>
          ) : (
            <ul className="today-list">
              {vandaagDue.map((o) => (
                <li key={o.id}>
                  <button type="button" className="link-btn" onClick={() => openOpdracht(o)}>
                    {o.klantNaam} – {o.omschrijving}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
