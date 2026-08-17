import { useEffect, useState } from "react";
import { fetchFinancieelInzendingen, FinancieelInzending } from "../api";
import { APP_VERNIEUW_EVENT, FINANCIEEL_INZENDING_EVENT } from "../appPages";
import { inzendingSamenvatting, INZENDING_STATUS_LABEL } from "../financieelInzendingUtils";
import { formatDatumTijd } from "../financieelUtils";

export function EigenaarFinancieelNotificaties({
  onOpenFinancieel,
  toonLeeg = false
}: {
  onOpenFinancieel: () => void;
  toonLeeg?: boolean;
}) {
  const [inzendingen, setInzendingen] = useState<FinancieelInzending[]>([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    let stop = false;
    const laad = async () => {
      try {
        const data = await fetchFinancieelInzendingen();
        if (!stop) setInzendingen(data.inzendingen);
      } catch {
        if (!stop) setInzendingen([]);
      } finally {
        if (!stop) setLaden(false);
      }
    };
    void laad();
    const onVernieuw = () => void laad();
    window.addEventListener(APP_VERNIEUW_EVENT, onVernieuw);
    window.addEventListener(FINANCIEEL_INZENDING_EVENT, onVernieuw);
    const interval = window.setInterval(laad, 30000);
    return () => {
      stop = true;
      window.clearInterval(interval);
      window.removeEventListener(APP_VERNIEUW_EVENT, onVernieuw);
      window.removeEventListener(FINANCIEEL_INZENDING_EVENT, onVernieuw);
    };
  }, []);

  const nieuw = inzendingen.filter((item) => item.status === "NIEUW");
  if (laden) return null;
  if (nieuw.length === 0 && !toonLeeg) return null;

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Financiële info van medewerkers</h2>
        <p className="muted">
          {nieuw.length === 0
            ? "Geen nieuwe inzendingen."
            : `${nieuw.length} nieuwe inzending${nieuw.length === 1 ? "" : "en"} — open Financiën om te verwerken.`}
        </p>
      </div>
      {nieuw.length === 0 ? (
        <p className="muted">Medewerkers sturen kas- en transactie-info via Kas doorgeven.</p>
      ) : (
        <ul className="page-list">
          {nieuw.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="page-list-item melding-ongelezen"
                onClick={onOpenFinancieel}
              >
                <div className="page-list-main">
                  <strong>
                    {item.vanNaam}: {inzendingSamenvatting(item)}
                  </strong>
                  <span className="melding-tag melding-p1">{INZENDING_STATUS_LABEL[item.status]}</span>
                </div>
                <span className="melding-ongelezen-sub">
                  Verzonden {formatDatumTijd(item.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="financieel-row-actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn-primary" onClick={onOpenFinancieel}>
          Open Financiën
        </button>
      </div>
    </section>
  );
}
