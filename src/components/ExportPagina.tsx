import { useEffect, useMemo, useState } from "react";
import { fetchFinancieel, FinancieelPost } from "../api";
import {
  berekenDossierSaldi,
  berekenKlantSaldi,
  exportDossierSaldiCsv,
  exportFinancieelPostenCsv,
  exportKlantSaldiCsv
} from "../financieelUtils";
import {
  exportFinancieelExcel,
  exportFinancieelPdf,
  exportFinancieelWord
} from "../financieelExport";
import { exportOpdrachtenCsv } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { Opdracht } from "../types";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function ExportPagina({ werkruimte }: Props) {
  const { alleOpdrachten } = werkruimte;
  const [posten, setPosten] = useState<FinancieelPost[]>([]);
  const [financieelFout, setFinancieelFout] = useState<string | null>(null);
  const [financieelLaden, setFinancieelLaden] = useState(true);

  const opdrachtenById = useMemo(() => {
    const map = new Map<string, Opdracht>();
    for (const o of alleOpdrachten) map.set(o.id, o);
    return map;
  }, [alleOpdrachten]);

  const klantSaldiCount = useMemo(() => berekenKlantSaldi(posten).length, [posten]);
  const dossierSaldiCount = useMemo(
    () => berekenDossierSaldi(posten, opdrachtenById).length,
    [posten, opdrachtenById]
  );

  useEffect(() => {
    let cancelled = false;
    const laad = async () => {
      try {
        setFinancieelLaden(true);
        setFinancieelFout(null);
        const data = await fetchFinancieel();
        if (!cancelled) setPosten(data);
      } catch (e) {
        if (!cancelled) {
          setFinancieelFout(
            e instanceof Error ? e.message : "Kon financiële gegevens niet laden."
          );
        }
      } finally {
        if (!cancelled) setFinancieelLaden(false);
      }
    };
    void laad();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="financieel-stack">
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

      <section className="card page-card">
        <div className="section-header">
          <h2>Financiën exporteren</h2>
          <p className="muted">
            Volledig dossier voor Excel, Word en PDF: overzicht, dagboek en alle vulvakken.
          </p>
        </div>
        {financieelFout && <p className="muted page-error">{financieelFout}</p>}
        {financieelLaden ? (
          <p className="muted">Financiële gegevens laden...</p>
        ) : (
          <>
            <div className="financieel-export-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={posten.length === 0}
                onClick={() => exportFinancieelExcel(posten, opdrachtenById)}
              >
                Excel (volledig)
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={posten.length === 0}
                onClick={() => exportFinancieelWord(posten, opdrachtenById)}
              >
                Word (volledig)
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={posten.length === 0}
                onClick={() => exportFinancieelPdf(posten, opdrachtenById)}
              >
                PDF / afdrukken
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              Excel: werkboek met tabbladen. Word: document. PDF: kies “Opslaan als PDF” in het
              printdialoog.
            </p>
            <div className="financieel-export-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={posten.length === 0}
                onClick={() => exportFinancieelPostenCsv(posten, opdrachtenById)}
              >
                CSV dagboek ({posten.length})
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={klantSaldiCount === 0}
                onClick={() => exportKlantSaldiCsv(posten)}
              >
                CSV klantsaldo’s ({klantSaldiCount})
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={dossierSaldiCount === 0}
                onClick={() => exportDossierSaldiCsv(posten, opdrachtenById)}
              >
                CSV dossiersaldo’s ({dossierSaldiCount})
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
