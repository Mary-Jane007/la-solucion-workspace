import { useMemo } from "react";
import { isOpdrachtOpen, klantWeergave, opdrachtLijstItemClassNaam, statusLabel } from "../opdrachtenUtils";
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
  const openstaand = mijnOpdrachten.filter((o) => isOpdrachtOpen(o.status));
  const itemIds = useMemo(() => mijnOpdrachtenItemIds(mijnOpdrachten), [mijnOpdrachten]);
  const { markeerGeopend } = useLijstGezienStatus(
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
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={opdrachtLijstItemClassNaam(o.status, o.prioriteit)}
                  onClick={() => {
                    markeerGeopend(o.id);
                    openOpdracht(o);
                  }}
                >
                  <div className="page-list-main">
                    <strong>{klantWeergave(o.klantNaam, o.klantNummer)}</strong>
                    <span className={`pill pill-prio-${o.prioriteit}`}>P{o.prioriteit}</span>
                  </div>
                  <span className="muted">{o.omschrijving}</span>
                  <span className="page-list-meta">
                    {statusLabel(o.status)}
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
