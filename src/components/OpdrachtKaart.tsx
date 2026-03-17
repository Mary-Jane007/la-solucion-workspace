import { Opdracht, OpdrachtStatus } from "../types";

interface Props {
  opdracht: Opdracht;
  isEigenaar: boolean;
  onKlik: () => void;
  onStatusWijzig: (status: OpdrachtStatus) => void;
}

export function OpdrachtKaart({ opdracht, isEigenaar, onKlik, onStatusWijzig }: Props) {
  const created = new Date(opdracht.datumAangemaakt).toLocaleDateString("nl-NL");
  const isOpgeslagen = Boolean(opdracht.id);

  return (
    <div className="card opdracht-card">
      <button className="opdracht-main" onClick={onKlik} type="button">
        <div className="opdracht-header">
          <span className="opdracht-client">{opdracht.klantNaam || "Nieuwe klant"}</span>
          <span className={`pill pill-prio-${opdracht.prioriteit}`}>
            P{opdracht.prioriteit}
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
        <select
          className="form-input small"
          value={opdracht.status}
          onChange={(e) => onStatusWijzig(e.target.value as OpdrachtStatus)}
        >
          <option value={OpdrachtStatus.Nieuw}>Nieuw</option>
          <option value={OpdrachtStatus.InBehandeling}>In behandeling</option>
          <option value={OpdrachtStatus.Afgerond}>Afgerond</option>
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

