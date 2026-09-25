import { useMemo, useState } from "react";
import { bestandBekijkUrl, downloadBestand, fetchBestandBlob, openBestandInNieuwTab } from "../api";
import { isBekijkbaarBestand, isPdfBestand } from "../bestandUtils";
import { flattenDocumenten } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { documentenItemIds } from "../badgeItems";
import { BestandMiniatuur, BestandViewer, BestandViewerItem } from "./BestandViewer";

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
  const [viewerId, setViewerId] = useState<string | null>(null);
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

  const viewerItems = useMemo<BestandViewerItem[]>(
    () =>
      documenten
        .filter((d) => isBekijkbaarBestand(d.origineleNaam, d.mimeType))
        .map((d) => ({
          id: d.id,
          naam: d.origineleNaam,
          mimeType: d.mimeType,
          fetchBlob: () => fetchBestandBlob(d.id, d.origineleNaam),
          bekijkUrl: bestandBekijkUrl(d.id)
        })),
    [documenten]
  );

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
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Download mislukt.");
    }
  };

  const openViewer = (id: string) => {
    markeerGeopend(id);
    const doc = documenten.find((item) => item.id === id);
    if (doc && isPdfBestand(doc.origineleNaam, doc.mimeType)) {
      const url = bestandBekijkUrl(id);
      if (url && openBestandInNieuwTab(url)) return;
    }
    setViewerId(id);
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
                <th></th>
                <th>Bestand</th>
                <th>Klant</th>
                <th>Grootte</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documenten.map((d) => {
                const ongelezen = isOngelezen(d.id);
                const bekijkbaar = isBekijkbaarBestand(d.origineleNaam, d.mimeType);
                return (
                  <tr
                    key={d.id}
                    className={ongelezen ? "prullenbak-rij-ongelezen" : undefined}
                    onClick={() => markeerGeopend(d.id)}
                  >
                    <td>
                      <BestandMiniatuur
                        naam={d.origineleNaam}
                        mimeType={d.mimeType}
                        fetchBlob={() => fetchBestandBlob(d.id, d.origineleNaam)}
                        onOpen={bekijkbaar ? () => openViewer(d.id) : undefined}
                      />
                    </td>
                    <td>{d.origineleNaam}</td>
                    <td>{d.klantNaam}</td>
                    <td>{formatGrootte(d.grootte)}</td>
                    <td>
                      {bekijkbaar && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openViewer(d.id);
                          }}
                        >
                          Bekijken
                        </button>
                      )}
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
      {viewerId && viewerItems.length > 0 && (
        <BestandViewer
          items={viewerItems}
          startId={viewerId}
          onClose={() => setViewerId(null)}
          onDownload={(item) => void handleDownload(item.id, item.naam)}
        />
      )}
    </section>
  );
}
