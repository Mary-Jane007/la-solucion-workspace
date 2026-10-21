import { Opdracht, OpdrachtStatus } from "../types";
import { isOpdrachtGroen, OPDRACHT_STATUS_OPTIES, statusLabel } from "../opdrachtenUtils";

interface Props {
  opdracht: Opdracht;
  isEigenaar: boolean;
  isOngelezen?: boolean;
  onKlik: () => void;
  onStatusWijzig: (status: OpdrachtStatus) => void;
  onVerwijder?: () => void;
}

export function OpdrachtKaart({
  opdracht,
  isEigenaar,
  isOngelezen = false,
  onKlik,
  onStatusWijzig,
  onVerwijder
}: Props) {
  const created = new Date(opdracht.datumAangemaakt).toLocaleDateString("nl-NL");
  const isOpgeslagen = Boolean(opdracht.id);
  const groen = isOpdrachtGroen(opdracht.status);

  return (
    <div
      className={`card opdracht-card${groen ? " opdracht-card-groen" : ""}${
        isOngelezen && !groen ? " opdracht-card-ongelezen" : ""
      }`}
    >
      <button className="opdracht-main" onClick={onKlik} type="button">
        <div className="opdracht-header">
          <span className="opdracht-client">{opdracht.klantNaam || "Nieuwe klant"}</span>
          <span className="opdracht-header-pills">
            <span className={`pill${groen ? " pill-status-groen" : " pill-status"}`}>
              {statusLabel(opdracht.status)}
            </span>
            <span className={`pill pill-prio-${opdracht.prioriteit}`}>
              P{opdracht.prioriteit}
            </span>
          </span>
        </div>
        <p className="opdracht-body">{opdracht.omschrijving || "Nog geen omschrijving"}</p>
        <div className="opdracht-meta">
          <span>Aangemaakt {created}</span>
          {opdracht.datumDeadline && (
            <span>
              Deadline: {new Date(opdracht.datumDeadline).toLocaleDateString("nl-NL")}
            </span>
          )}
        </div>
      </button>
      <div className="opdracht-footer">
        {isEigenaar && isOpgeslagen && (
          <button
            type="button"
            className="btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              onKlik();
            }}
          >
            Bewerken
          </button>
        )}
        {isEigenaar && isOpgeslagen && onVerwijder && (
          <button
            type="button"
            className="btn-secondary btn-danger"
            onClick={(e) => {
              e.stopPropagation();
              onVerwijder();
            }}
          >
            Verwijderen
          </button>
        )}
        {isEigenaar && isOpgeslagen && (
          <div className="opdracht-klaar-acties">
            <button
              type="button"
              className={`btn-klaar${opdracht.status === OpdrachtStatus.Ingediend ? " actief" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onStatusWijzig(OpdrachtStatus.Ingediend);
              }}
            >
              Ingediend
            </button>
            <button
              type="button"
              className={`btn-klaar${opdracht.status === OpdrachtStatus.Afgerond ? " actief" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onStatusWijzig(OpdrachtStatus.Afgerond);
              }}
            >
              Afgerond
            </button>
          </div>
        )}
        <select
          className="form-input small"
          value={opdracht.status}
          aria-label="Status"
          onChange={(e) => onStatusWijzig(e.target.value as OpdrachtStatus)}
        >
          {OPDRACHT_STATUS_OPTIES.map((optie) => (
            <option key={optie.value} value={optie.value}>
              {optie.label}
            </option>
          ))}
        </select>
        <span className="opdracht-handler">
          {opdracht.behandelaarNaam
            ? `Toegewezen aan: ${opdracht.behandelaarNaam}`
            : "Nog niet toegewezen"}
        </span>
      </div>
    </div>
  );
}
