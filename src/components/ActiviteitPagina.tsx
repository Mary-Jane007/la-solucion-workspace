import { useMemo } from "react";
import { berekenActiviteit } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { activiteitItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

export function ActiviteitPagina({ werkruimte, userId, onGezien }: Props) {
  const { alleOpdrachten, openOpdracht } = werkruimte;
  const activiteit = useMemo(() => berekenActiviteit(alleOpdrachten), [alleOpdrachten]);
  const itemIds = useMemo(() => activiteitItemIds(alleOpdrachten), [alleOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "activiteit",
    userId,
    itemIds,
    onGezien
  );

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Recente activiteit</h2>
        <p className="muted">Laatste wijzigingen en nieuwe opdrachten.</p>
      </div>
      {activiteit.length === 0 ? (
        <p className="muted">Nog geen activiteit geregistreerd.</p>
      ) : (
        <ul className="page-list">
          {activiteit.map((a) => {
            const ongelezen = isOngelezen(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  className={`page-list-item${ongelezen ? " melding-ongelezen" : ""}`}
                  onClick={() => {
                    markeerGeopend(a.id);
                    openOpdracht(a.opdracht);
                  }}
                >
                  <div className="page-list-main">
                    <strong>{a.opdracht.klantNaam}</strong>
                    <span className="activiteit-tag">
                      {a.type === "aangemaakt" ? "Nieuw" : "Bijgewerkt"}
                    </span>
                  </div>
                  <span className={ongelezen ? "melding-ongelezen-sub" : "muted"}>
                    {a.opdracht.omschrijving}
                  </span>
                  <span className={`page-list-meta${ongelezen ? " melding-ongelezen-sub" : ""}`}>
                    {new Date(a.datum).toLocaleString("nl-NL")}
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
