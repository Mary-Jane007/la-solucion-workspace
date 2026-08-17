import { FinancieelInzending } from "../../api";
import { inzendingSamenvatting, inzendingVelden, INZENDING_STATUS_LABEL } from "../../financieelInzendingUtils";
import { InzendingBijlagen } from "./InzendingBijlagen";

export function FinancieelInzendingenPanel({
  inzendingen,
  onMarkeer,
  onNeemOver,
  bezigId
}: {
  inzendingen: FinancieelInzending[];
  onMarkeer: (id: string, status: FinancieelInzending["status"]) => void;
  onNeemOver: (item: FinancieelInzending) => void;
  bezigId?: string | null;
}) {
  if (inzendingen.length === 0) {
    return (
      <section className="card page-card">
        <div className="section-header">
          <h2>Inzendingen van medewerkers</h2>
          <p className="muted">Medewerkers sturen hier kas- en transactie-info naartoe.</p>
        </div>
        <p className="muted">Nog geen inzendingen.</p>
      </section>
    );
  }

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Inzendingen van medewerkers</h2>
        <p className="muted">
          {inzendingen.filter((i) => i.status === "NIEUW").length} nieuw
          {" · "}
          {inzendingen.length} totaal
        </p>
      </div>
      <ul className="page-list">
        {inzendingen.map((item) => {
          const nieuw = item.status === "NIEUW";
          return (
            <li key={item.id}>
              <article className={`page-list-item${nieuw ? " melding-ongelezen" : ""}`}>
                <div className="page-list-main">
                  <strong>
                    {item.vanNaam}: {inzendingSamenvatting(item)}
                  </strong>
                  <span className={`melding-tag${nieuw ? " melding-p1" : ""}`}>
                    {INZENDING_STATUS_LABEL[item.status]}
                  </span>
                </div>
                <dl className="inzending-velden">
                  {inzendingVelden(item).map((v) => (
                    <div key={v.veld}>
                      <dt>{v.veld}</dt>
                      <dd>{v.waarde}</dd>
                    </div>
                  ))}
                </dl>
                <InzendingBijlagen bijlagen={item.bijlagen} />
                <div className="financieel-row-actions">
                  {nieuw && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={bezigId === item.id}
                      onClick={() => onMarkeer(item.id, "GEZIEN")}
                    >
                      Markeer als gezien
                    </button>
                  )}
                  {item.status !== "VERWERKT" && (
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={bezigId === item.id}
                      onClick={() => onMarkeer(item.id, "VERWERKT")}
                    >
                      Markeer als verwerkt
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onNeemOver(item)}
                  >
                    Overzetten naar dagboek
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
