import { berekenActiviteit } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function ActiviteitPagina({ werkruimte }: Props) {
  const { alleOpdrachten, openOpdracht } = werkruimte;
  const activiteit = berekenActiviteit(alleOpdrachten);

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
          {activiteit.map((a) => (
            <li key={a.id}>
              <button type="button" className="page-list-item" onClick={() => openOpdracht(a.opdracht)}>
                <div className="page-list-main">
                  <strong>{a.opdracht.klantNaam}</strong>
                  <span className="activiteit-tag">
                    {a.type === "aangemaakt" ? "Nieuw" : "Bijgewerkt"}
                  </span>
                </div>
                <span className="muted">{a.opdracht.omschrijving}</span>
                <span className="page-list-meta">
                  {new Date(a.datum).toLocaleString("nl-NL")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
