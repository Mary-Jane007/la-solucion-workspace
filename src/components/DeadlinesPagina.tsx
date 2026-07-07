import { groepeerDeadlines } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function DeadlinesPagina({ werkruimte }: Props) {
  const { zichtbareOpdrachten, openOpdracht } = werkruimte;
  const groepen = groepeerDeadlines(zichtbareOpdrachten);

  return (
    <div className="deadlines-stack">
      {groepen.length === 0 ? (
        <section className="card page-card">
          <p className="muted">Geen deadlines gepland voor openstaande opdrachten.</p>
        </section>
      ) : (
        groepen.map((groep) => (
          <section key={groep.label} className="card page-card">
            <h2>{groep.label}</h2>
            <ul className="page-list">
              {groep.opdrachten.map((o) => (
                <li key={o.id}>
                  <button type="button" className="page-list-item" onClick={() => openOpdracht(o)}>
                    <div className="page-list-main">
                      <strong>{o.klantNaam}</strong>
                      <span className={`pill pill-prio-${o.prioriteit}`}>P{o.prioriteit}</span>
                    </div>
                    <span className="muted">{o.omschrijving}</span>
                    {o.datumDeadline && (
                      <span className="page-list-meta">
                        {new Date(o.datumDeadline).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
