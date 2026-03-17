import { Opdracht } from "../types";

interface Props {
  opdrachten: Opdracht[];
  onSelectOpdracht: (opdracht: Opdracht) => void;
}

const WEEKDAGEN = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export function Kalender({ opdrachten, onSelectOpdracht }: Props) {
  const vandaag = new Date();
  const jaar = vandaag.getFullYear();
  const maand = vandaag.getMonth(); // 0-based

  const eersteDag = new Date(jaar, maand, 1);
  const laatsteDag = new Date(jaar, maand + 1, 0);
  const firstWeekday = (eersteDag.getDay() + 6) % 7; // Ma=0

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

  const opdrachtenPerDag = (dag: number) => {
    const iso = new Date(jaar, maand, dag).toISOString().slice(0, 10);
    return opdrachten.filter((o) => o.datumDeadline === iso);
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <h3>{maandNaam}</h3>
        <p className="muted">
          Klik op een taak in de kalender om de opdracht te openen.
        </p>
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
            <div
              key={idx}
              className={`calendar-cell${isToday ? " today" : ""}${
                items.length ? " busy" : ""
              }`}
            >
              <div className="calendar-day-number">{dag}</div>
              <div className="calendar-items">
                {items.map((o) => (
                  <button
                    key={o.id}
                    className="calendar-item"
                    onClick={() => onSelectOpdracht(o)}
                  >
                    <span className="calendar-item-client">{o.klantNaam}</span>
                    <span className="calendar-item-title">{o.omschrijving}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

