import { berekenMeldingen } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

const TYPE_LABELS: Record<string, string> = {
  p1: "Hoge prioriteit",
  "deadline-vandaag": "Deadline vandaag",
  "deadline-morgen": "Deadline morgen",
  "te-laat": "Te laat"
};

export function MeldingenPagina({ werkruimte }: Props) {
  const { zichtbareOpdrachten, openOpdracht } = werkruimte;
  const meldingen = berekenMeldingen(zichtbareOpdrachten);

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
          {meldingen.map((m) => (
            <li key={m.id}>
              <button type="button" className="page-list-item" onClick={() => openOpdracht(m.opdracht)}>
                <div className="page-list-main">
                  <strong>{m.titel}</strong>
                  <span className={`melding-tag melding-${m.type}`}>{TYPE_LABELS[m.type]}</span>
                </div>
                <span className="muted">{m.opdracht.omschrijving}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
