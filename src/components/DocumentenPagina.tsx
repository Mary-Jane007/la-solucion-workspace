import { useMemo, useState } from "react";
import { downloadBestand } from "../api";
import { flattenDocumenten } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { documentenItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

function formatGrootte(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentenPagina({ werkruimte, userId, onGezien }: Props) {
  const [zoekterm, setZoekterm] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const { alleOpdrachten } = werkruimte;

  const documenten = useMemo(() => {
    const lijst = flattenDocumenten(alleOpdrachten);
    const q = zoekterm.trim().toLowerCase();
    if (!q) return lijst;
    return lijst.filter(
      (d) =>
        d.origineleNaam.toLowerCase().includes(q) ||
        d.klantNaam.toLowerCase().includes(q) ||
        d.omschrijving.toLowerCase().includes(q)
    );
  }, [alleOpdrachten, zoekterm]);

  const itemIds = useMemo(() => documentenItemIds(alleOpdrachten), [alleOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "documenten",
    userId,
    itemIds,
    onGezien
  );

  const handleDownload = async (id: string, naam: string) => {
    try {
      setFout(null);
      markeerGeopend(id);
      await downloadBestand(id, naam);
    } catch {
      setFout("Download mislukt.");
    }
  };

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Alle documenten</h2>
        <p className="muted">{documenten.length} bestand{documenten.length === 1 ? "" : "en"}.</p>
      </div>
      {fout && <p className="muted page-error">{fout}</p>}
      <input
        type="search"
        className="form-input board-search-input"
        placeholder="Zoek op bestandsnaam, klant of omschrijving..."
        value={zoekterm}
        onChange={(e) => setZoekterm(e.target.value)}
      />
      {documenten.length === 0 ? (
        <p className="muted">Geen documenten gevonden.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Bestand</th>
                <th>Klant</th>
                <th>Grootte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documenten.map((d) => {
                const ongelezen = isOngelezen(d.id);
                return (
                  <tr
                    key={d.id}
                    className={ongelezen ? "prullenbak-rij-ongelezen" : undefined}
                    onClick={() => markeerGeopend(d.id)}
                  >
                    <td>{d.origineleNaam}</td>
                    <td>{d.klantNaam}</td>
                    <td>{formatGrootte(d.grootte)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDownload(d.id, d.origineleNaam);
                        }}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
