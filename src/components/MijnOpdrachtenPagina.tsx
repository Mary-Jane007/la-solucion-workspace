import { OpdrachtStatus } from "../types";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function MijnOpdrachtenPagina({ werkruimte }: Props) {
  const { mijnOpdrachten, openOpdracht } = werkruimte;
  const openstaand = mijnOpdrachten.filter((o) => o.status !== OpdrachtStatus.Afgerond);

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Toegewezen aan jou</h2>
        <p className="muted">{openstaand.length} openstaand van {mijnOpdrachten.length} totaal.</p>
      </div>
      {mijnOpdrachten.length === 0 ? (
        <p className="muted">Er zijn nog geen opdrachten aan jou toegewezen.</p>
      ) : (
        <ul className="page-list">
          {mijnOpdrachten.map((o) => (
            <li key={o.id}>
              <button type="button" className="page-list-item" onClick={() => openOpdracht(o)}>
                <div className="page-list-main">
                  <strong>{o.klantNaam}</strong>
                  <span className={`pill pill-prio-${o.prioriteit}`}>P{o.prioriteit}</span>
                </div>
                <span className="muted">{o.omschrijving}</span>
                <span className="page-list-meta">
                  {o.status.replace(/_/g, " ").toLowerCase()}
                  {o.datumDeadline &&
                    ` · Deadline ${new Date(o.datumDeadline).toLocaleDateString("nl-NL")}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
