import { exportOpdrachtenCsv } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function ExportPagina({ werkruimte }: Props) {
  const { alleOpdrachten } = werkruimte;

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Opdrachten exporteren</h2>
        <p className="muted">
          Download een CSV-bestand met alle opdrachten voor rapportage of archief.
        </p>
      </div>
      <p className="muted settings-lead">
        Het bestand bevat klant, omschrijving, status, prioriteit, deadlines en behandelaar.
      </p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => exportOpdrachtenCsv(alleOpdrachten)}
      >
        Download CSV ({alleOpdrachten.length} opdrachten)
      </button>
    </section>
  );
}
