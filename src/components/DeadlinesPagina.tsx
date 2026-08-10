import { useMemo } from "react";
import { groepeerDeadlines } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { deadlineBadgeIds } from "../opdrachtenUtils";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

export function DeadlinesPagina({ werkruimte, userId, onGezien }: Props) {
  const { zichtbareOpdrachten, openOpdracht } = werkruimte;
  const groepen = useMemo(() => groepeerDeadlines(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const itemIds = useMemo(() => deadlineBadgeIds(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "deadlines",
    userId,
    itemIds,
    onGezien
  );

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
              {groep.opdrachten.map((o) => {
                const ongelezen = isOngelezen(o.id);
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`page-list-item${ongelezen ? " melding-ongelezen" : ""}`}
                      onClick={() => {
                        markeerGeopend(o.id);
                        openOpdracht(o);
                      }}
                    >
                      <div className="page-list-main">
                        <strong>{o.klantNaam}</strong>
                        <span className={`pill pill-prio-${o.prioriteit}`}>P{o.prioriteit}</span>
                      </div>
                      <span className={ongelezen ? "melding-ongelezen-sub" : "muted"}>
                        {o.omschrijving}
                      </span>
                      {o.datumDeadline && (
                        <span
                          className={`page-list-meta${ongelezen ? " melding-ongelezen-sub" : ""}`}
                        >
                          {new Date(o.datumDeadline).toLocaleDateString("nl-NL")}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
