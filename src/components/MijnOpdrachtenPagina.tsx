import { useMemo } from "react";
import { OpdrachtStatus } from "../types";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { mijnOpdrachtenItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

export function MijnOpdrachtenPagina({ werkruimte, userId, onGezien }: Props) {
  const { mijnOpdrachten, openOpdracht } = werkruimte;
  const openstaand = mijnOpdrachten.filter((o) => o.status !== OpdrachtStatus.Afgerond);
  const itemIds = useMemo(() => mijnOpdrachtenItemIds(mijnOpdrachten), [mijnOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "mijn-opdrachten",
    userId,
    itemIds,
    onGezien
  );

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
          {mijnOpdrachten.map((o) => {
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
                  <span className={`page-list-meta${ongelezen ? " melding-ongelezen-sub" : ""}`}>
                    {o.status.replace(/_/g, " ").toLowerCase()}
                    {o.datumDeadline &&
                      ` · Deadline ${new Date(o.datumDeadline).toLocaleDateString("nl-NL")}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
