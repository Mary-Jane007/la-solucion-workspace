import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { isAfbeeldingBestand, isPdfBestand } from "../bestandUtils";

export interface BestandViewerItem {
  id: string;
  naam: string;
  mimeType?: string | null;
  url?: string;
  fetchBlob?: () => Promise<Blob>;
}

interface Props {
  items: BestandViewerItem[];
  startId: string;
  onClose: () => void;
  onDownload?: (item: BestandViewerItem) => void | Promise<void>;
}

export function BestandViewer({ items, startId, onClose, onDownload }: Props) {
  const startIndex = Math.max(
    0,
    items.findIndex((item) => item.id === startId)
  );
  const [index, setIndex] = useState(startIndex);
  const [geladenUrl, setGeladenUrl] = useState<string | null>(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const item = items[index] ?? items[0];
  const heeftVorige = items.length > 1;
  const vorige = () => setIndex((huidig) => (huidig - 1 + items.length) % items.length);
  const volgende = () => setIndex((huidig) => (huidig + 1) % items.length);

  const kind = useMemo(() => {
    if (!item) return "onbekend";
    if (isAfbeeldingBestand(item.naam, item.mimeType)) return "foto";
    if (isPdfBestand(item.naam, item.mimeType)) return "pdf";
    return "onbekend";
  }, [item]);

  useEffect(() => {
    setIndex(Math.max(0, items.findIndex((kandidaat) => kandidaat.id === startId)));
  }, [items, startId]);

  useEffect(() => {
    if (!item) return;
    if (item.url) {
      setGeladenUrl(item.url);
      setLaden(false);
      setFout(null);
      return;
    }
    if (!item.fetchBlob) {
      setGeladenUrl(null);
      setFout("Dit bestand kan hier niet worden getoond.");
      return;
    }
    let objectUrl: string | null = null;
    let stop = false;
    setLaden(true);
    setFout(null);
    setGeladenUrl(null);
    void item
      .fetchBlob()
      .then((blob) => {
        const next = URL.createObjectURL(blob);
        if (stop) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setGeladenUrl(next);
        setLaden(false);
      })
      .catch(() => {
        if (!stop) {
          setFout("Kon het bestand niet laden.");
          setLaden(false);
        }
      });
    return () => {
      stop = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item?.id, item?.url, item?.fetchBlob]);

  useEffect(() => {
    const vorigeOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && items.length > 1) {
        event.preventDefault();
        setIndex((huidig) => (huidig - 1 + items.length) % items.length);
      } else if (event.key === "ArrowRight" && items.length > 1) {
        event.preventDefault();
        setIndex((huidig) => (huidig + 1) % items.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = vorigeOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [items.length, onClose]);

  if (!item || typeof document === "undefined") return null;

  return createPortal(
    <div className="bestand-viewer-backdrop" onClick={onClose} role="presentation">
      <div
        className="bestand-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={item.naam}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bestand-viewer-header">
          <div>
            <h2>{item.naam}</h2>
            {items.length > 1 && (
              <p>
                {index + 1} van {items.length}
              </p>
            )}
          </div>
          <div className="bestand-viewer-acties">
            {onDownload && item.fetchBlob && (
              <button type="button" className="btn-secondary" onClick={() => void onDownload(item)}>
                Download
              </button>
            )}
            <button type="button" className="btn-ghost bestand-viewer-sluiten" onClick={onClose}>
              Sluiten
            </button>
          </div>
        </header>
        <div className="bestand-viewer-stage">
          {heeftVorige && (
            <button
              type="button"
              className="bestand-viewer-nav bestand-viewer-nav-prev"
              onClick={vorige}
              aria-label="Vorige"
            >
              ‹
            </button>
          )}
          {laden && <p className="bestand-viewer-status">Laden…</p>}
          {fout && <p className="bestand-viewer-status">{fout}</p>}
          {!laden && !fout && geladenUrl && kind === "foto" && (
            <img
              src={geladenUrl}
              alt={item.naam}
              onError={() => setFout("Deze foto kan in de browser niet worden getoond.")}
            />
          )}
          {!laden && !fout && geladenUrl && kind === "pdf" && (
            <iframe src={geladenUrl} title={item.naam} />
          )}
          {heeftVorige && (
            <button
              type="button"
              className="bestand-viewer-nav bestand-viewer-nav-next"
              onClick={volgende}
              aria-label="Volgende"
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
