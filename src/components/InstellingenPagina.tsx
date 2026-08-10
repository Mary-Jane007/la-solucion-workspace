import { useState } from "react";
import { Thema } from "../theme";

interface Props {
  thema: Thema;
  onThemaKies: (thema: Thema) => void;
  onVernieuwOpdrachten: () => Promise<void>;
}

export function InstellingenPagina({ thema, onThemaKies, onVernieuwOpdrachten }: Props) {
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  const handleVernieuwen = async () => {
    try {
      setBezig(true);
      setMelding(null);
      await onVernieuwOpdrachten();
      setMelding("Opdrachten zijn vernieuwd.");
    } catch {
      setMelding("Vernieuwen mislukt. Controleer je verbinding.");
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="settings-grid">
      <section className="card page-card">
        <h2>Weergave</h2>
        <p className="muted settings-lead">Kies een licht of donker thema voor het hele portaal.</p>
        <div className="settings-theme-options">
          <button
            type="button"
            className={`settings-theme-btn${thema === "donker" ? " is-active" : ""}`}
            onClick={() => onThemaKies("donker")}
          >
            Donker
          </button>
          <button
            type="button"
            className={`settings-theme-btn${thema === "licht" ? " is-active" : ""}`}
            onClick={() => onThemaKies("licht")}
          >
            Licht
          </button>
        </div>
      </section>

      <section className="card page-card">
        <h2>Gegevens</h2>
        <p className="muted settings-lead">
          Haal de nieuwste opdrachten op als iets niet klopt na een wijziging elders.
        </p>
        <button
          type="button"
          className="btn-secondary"
          disabled={bezig}
          onClick={() => void handleVernieuwen()}
        >
          {bezig ? "Bezig..." : "Opdrachten vernieuwen"}
        </button>
        {melding && <p className="muted settings-note">{melding}</p>}
      </section>
    </div>
  );
}
