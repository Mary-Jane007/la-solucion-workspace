import { useState } from "react";
import { Opdracht, Prioriteit } from "../types";

interface Props {
  opdrachten: Opdracht[];
  onSelectOpdracht: (opdracht: Opdracht) => void;
}

const WEEKDAGEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

const PRIO_LABELS: Record<Prioriteit, string> = {
  1: "Hoog",
  2: "Normaal",
  3: "Laag"
};

const STATUS_LABELS: Record<string, string> = {
  NIEUW: "Nieuw",
  IN_BEHANDELING: "In behandeling",
  AFGEROND: "Afgerond"
};

function naarIsoDatum(jaar: number, maand: number, dag: number): string {
  const maandStr = String(maand + 1).padStart(2, "0");
  const dagStr = String(dag).padStart(2, "0");
  return `${jaar}-${maandStr}-${dagStr}`;
}

function formatDagLabel(jaar: number, maand: number, dag: number): string {
  return new Date(jaar, maand, dag).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function naarDagIso(datum?: string | null): string | null {
  if (!datum) return null;
  return datum.slice(0, 10);
}

interface KalenderDagOpdracht {
  opdracht: Opdracht;
  isAangemaakt: boolean;
  isDeadline: boolean;
}

function dagRedenLabel(item: KalenderDagOpdracht): string {
  if (item.isAangemaakt && item.isDeadline) return "Aangemaakt · Deadline";
  if (item.isAangemaakt) return "Aangemaakt op deze dag";
  return "Deadline op deze dag";
}

export function Kalender({ opdrachten, onSelectOpdracht }: Props) {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = vandaag.getMonth();

  const [geselecteerdeDag, setGeselecteerdeDag] = useState<{
    label: string;
    items: KalenderDagOpdracht[];
  } | null>(null);

  const eersteDag = new Date(jaar, maand, 1);
  const laatsteDag = new Date(jaar, maand + 1, 0);
  const firstWeekday = (eersteDag.getDay() + 6) % 7;

  const dagen: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    dagen.push(null);
  }
  for (let d = 1; d <= laatsteDag.getDate(); d++) {
    dagen.push(d);
  }

  const maandNaam = vandaag.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric"
  });

  const opdrachtenPerDag = (dag: number): KalenderDagOpdracht[] => {
    const iso = naarIsoDatum(jaar, maand, dag);
    const perId = new Map<string, KalenderDagOpdracht>();

    for (const opdracht of opdrachten) {
      const isAangemaakt = naarDagIso(opdracht.datumAangemaakt) === iso;
      const isDeadline = naarDagIso(opdracht.datumDeadline) === iso;
      if (!isAangemaakt && !isDeadline) continue;

      const bestaand = perId.get(opdracht.id);
      if (bestaand) {
        perId.set(opdracht.id, {
          opdracht,
          isAangemaakt: bestaand.isAangemaakt || isAangemaakt,
          isDeadline: bestaand.isDeadline || isDeadline
        });
      } else {
        perId.set(opdracht.id, { opdracht, isAangemaakt, isDeadline });
      }
    }

    return [...perId.values()].sort(
      (a, b) =>
        a.opdracht.prioriteit - b.opdracht.prioriteit ||
        a.opdracht.klantNaam.localeCompare(b.opdracht.klantNaam)
    );
  };

  const openDag = (dag: number) => {
    setGeselecteerdeDag({
      label: formatDagLabel(jaar, maand, dag),
      items: opdrachtenPerDag(dag)
    });
  };

  const openOpdracht = (opdracht: Opdracht) => {
    setGeselecteerdeDag(null);
    onSelectOpdracht(opdracht);
  };

  return (
    <>
      <div className="calendar">
        <div className="calendar-header">
          <h3>{maandNaam}</h3>
          <p className="muted">
            Elk gekleurd puntje is een opdracht die op die dag is aangemaakt en/of een deadline
            heeft. Klik op een dag voor het volledige overzicht.
          </p>
          <div className="calendar-legend" aria-label="Prioriteitskleuren">
            <span className="calendar-legend-item">
              <span className="calendar-prio-dot prio-1" /> Hoog
            </span>
            <span className="calendar-legend-item">
              <span className="calendar-prio-dot prio-2" /> Normaal
            </span>
            <span className="calendar-legend-item">
              <span className="calendar-prio-dot prio-3" /> Laag
            </span>
          </div>
        </div>
        <div className="calendar-grid">
          {WEEKDAGEN.map((w) => (
            <div key={w} className="calendar-weekday">
              {w}
            </div>
          ))}
          {dagen.map((dag, idx) => {
            if (!dag) {
              return <div key={idx} className="calendar-cell empty" />;
            }
            const items = opdrachtenPerDag(dag);
            const isToday = dag === vandaag.getDate();
            return (
              <button
                key={idx}
                type="button"
                className={`calendar-cell calendar-day-btn${isToday ? " today" : ""}${
                  items.length ? " busy" : ""
                }`}
                onClick={() => openDag(dag)}
                aria-label={`${formatDagLabel(jaar, maand, dag)}, ${items.length} opdrachten`}
              >
                <div className="calendar-day-number">{dag}</div>
                {items.length > 0 && (
                  <div className="calendar-prio-dots">
                    {items.map(({ opdracht: o, isAangemaakt, isDeadline }) => (
                      <span
                        key={o.id}
                        className={`calendar-prio-dot prio-${o.prioriteit}`}
                        title={`${o.klantNaam} – ${dagRedenLabel({
                          opdracht: o,
                          isAangemaakt,
                          isDeadline
                        })}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {geselecteerdeDag && (
        <div className="modal-backdrop" onClick={() => setGeselecteerdeDag(null)}>
          <div
            className="modal calendar-day-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="calendar-day-title"
          >
            <header className="modal-header">
              <div>
                <h2 id="calendar-day-title">Opdrachten op {geselecteerdeDag.label}</h2>
                <p className="muted">
                  {geselecteerdeDag.items.length === 0
                    ? "Geen opdrachten aangemaakt of met deadline op deze datum."
                    : `${geselecteerdeDag.items.length} ${
                        geselecteerdeDag.items.length === 1 ? "opdracht" : "opdrachten"
                      } op deze datum.`}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setGeselecteerdeDag(null)}
              >
                Sluiten
              </button>
            </header>
            <div className="modal-body">
              {geselecteerdeDag.items.length === 0 ? (
                <p className="muted">
                  Kies een andere dag of maak een opdracht aan met deze datum.
                </p>
              ) : (
                <ul className="calendar-day-list">
                  {geselecteerdeDag.items.map(({ opdracht: o, isAangemaakt, isDeadline }) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className={`calendar-day-opdracht calendar-item-prio-${o.prioriteit}`}
                        onClick={() => openOpdracht(o)}
                      >
                        <span className="calendar-day-opdracht-top">
                          <span className="calendar-day-opdracht-client">{o.klantNaam}</span>
                          <span className={`calendar-item-prio prio-${o.prioriteit}`}>
                            P{o.prioriteit} · {PRIO_LABELS[o.prioriteit]}
                          </span>
                        </span>
                        <span className="calendar-day-opdracht-title">{o.omschrijving}</span>
                        <span className="calendar-day-opdracht-meta">
                          {dagRedenLabel({ opdracht: o, isAangemaakt, isDeadline })}
                          {" · "}
                          {STATUS_LABELS[o.status] || o.status}
                          {o.categorie ? ` · ${o.categorie}` : ""}
                          {o.behandelaarNaam ? ` · ${o.behandelaarNaam}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
