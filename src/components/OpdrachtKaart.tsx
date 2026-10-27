import { Opdracht, OpdrachtStatus } from "../types";
import {
  klantNummerLabel,
  opdrachtKaartClassNaam,
  OPDRACHT_SNEL_STATUS_ACTIES,
  OPDRACHT_STATUS_OPTIES,
  statusLabel,
  statusPillClass
} from "../opdrachtenUtils";

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
  const kaartKleur = opdrachtKaartClassNaam(opdracht.status, opdracht.prioriteit, isOngelezen);

  return (
    <div className={`card opdracht-card${kaartKleur ? ` ${kaartKleur}` : ""}`}>
      <button className="opdracht-main" onClick={onKlik} type="button">
        <div className="opdracht-header">
          <span className="opdracht-client">
            {opdracht.klantNummer ? (
              <span className="klant-nummer-pill">{klantNummerLabel(opdracht.klantNummer)}</span>
            ) : null}
            {opdracht.klantNaam || "Nieuwe klant"}
          </span>
          <span className="opdracht-header-pills">
            <span className={statusPillClass(opdracht.status)}>
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
            {OPDRACHT_SNEL_STATUS_ACTIES.map((actie) => (
              <button
                key={actie.value}
                type="button"
                className={`btn-klaar${opdracht.status === actie.value ? ` ${actie.actiefClass}` : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusWijzig(actie.value);
                }}
              >
                {actie.label}
              </button>
            ))}
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
