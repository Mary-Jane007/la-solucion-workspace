import { useMemo } from "react";
import { berekenMeldingen } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { meldingenItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  p1: "Hoge prioriteit",
  "deadline-vandaag": "Deadline vandaag",
  "deadline-morgen": "Deadline morgen",
  "te-laat": "Te laat"
};

export function MeldingenPagina({ werkruimte, userId, onGezien }: Props) {
  const { zichtbareOpdrachten, openOpdracht } = werkruimte;
  const meldingen = useMemo(() => berekenMeldingen(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const itemIds = useMemo(() => meldingenItemIds(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "meldingen",
    userId,
    itemIds,
    onGezien
  );

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Actie vereist</h2>
        <p className="muted">{meldingen.length} melding{meldingen.length === 1 ? "" : "en"}.</p>
      </div>
      {meldingen.length === 0 ? (
        <p className="muted">Geen open meldingen. Alles loopt op schema.</p>
      ) : (
        <ul className="page-list">
          {meldingen.map((m) => {
            const ongelezen = isOngelezen(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className={`page-list-item${ongelezen ? " melding-ongelezen" : ""}`}
                  onClick={() => {
                    markeerGeopend(m.id);
                    openOpdracht(m.opdracht);
                  }}
                >
                  <div className="page-list-main">
                    <strong>{m.titel}</strong>
                    <span className={`melding-tag melding-${m.type}`}>{TYPE_LABELS[m.type]}</span>
                  </div>
                  <span className={ongelezen ? "melding-ongelezen-sub" : "muted"}>
                    {m.opdracht.omschrijving}
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
