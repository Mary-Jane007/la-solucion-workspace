import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isAfbeeldingBestand, isPdfBestand, normaliseerBestandBlob } from "../bestandUtils";

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
  const ids = items.map((item) => item.id).join("|");
  const startIndex = Math.max(
    0,
    items.findIndex((item) => item.id === startId)
  );
  const [index, setIndex] = useState(startIndex);
  const [geladenUrl, setGeladenUrl] = useState<string | null>(null);
  const [soort, setSoort] = useState<"foto" | "pdf">("foto");
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const fetchRef = useRef<BestandViewerItem["fetchBlob"]>();

  const item = items[index] ?? items[0];
  const heeftVorige = items.length > 1;
  fetchRef.current = item?.fetchBlob;

  const vorige = () => setIndex((huidig) => (huidig - 1 + items.length) % items.length);
  const volgende = () => setIndex((huidig) => (huidig + 1) % items.length);

  useEffect(() => {
    const next = items.findIndex((kandidaat) => kandidaat.id === startId);
    if (next >= 0) setIndex(next);
  }, [ids, startId]);

  useEffect(() => {
    if (!item) return;
    if (item.url) {
      setGeladenUrl(item.url);
      setSoort(isPdfBestand(item.naam, item.mimeType) ? "pdf" : "foto");
      setLaden(false);
      setFout(null);
      return;
    }
    const ladenBlob = fetchRef.current;
    if (!ladenBlob) {
      setGeladenUrl(null);
      setFout("Dit bestand kan hier niet worden getoond.");
      return;
    }
    let objectUrl: string | null = null;
    let stop = false;
    setLaden(true);
    setFout(null);
    setGeladenUrl(null);
    void ladenBlob()
      .then((ruw) => normaliseerBestandBlob(ruw, item.naam, item.mimeType))
      .then((blob) => {
        const next = URL.createObjectURL(blob);
        if (stop) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setSoort(isPdfBestand(item.naam, blob.type) ? "pdf" : "foto");
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
  }, [item?.id, item?.url, item?.naam, item?.mimeType]);

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
          {!laden && !fout && geladenUrl && soort === "pdf" && (
            <iframe src={geladenUrl} title={item.naam} />
          )}
          {!laden && !fout && geladenUrl && soort !== "pdf" && (
            <img
              src={geladenUrl}
              alt={item.naam}
              onError={() => setFout("Deze foto kan in de browser niet worden getoond.")}
            />
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

export function BestandMiniatuur({
  naam,
  mimeType,
  url,
  fetchBlob,
  onOpen
}: {
  naam: string;
  mimeType?: string | null;
  url?: string;
  fetchBlob?: () => Promise<Blob>;
  onOpen?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(url || null);
  const fetchRef = useRef(fetchBlob);
  fetchRef.current = fetchBlob;

  useEffect(() => {
    if (url) {
      setSrc(url);
      return;
    }
    const ladenBlob = fetchRef.current;
    if (!ladenBlob || !isAfbeeldingBestand(naam, mimeType)) return;
    let objectUrl: string | null = null;
    let stop = false;
    void ladenBlob()
      .then((ruw) => normaliseerBestandBlob(ruw, naam, mimeType))
      .then((blob) => {
        const next = URL.createObjectURL(blob);
        if (stop) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setSrc(next);
      })
      .catch(() => {
        /* icoon blijft staan */
      });
    return () => {
      stop = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, naam, mimeType]);

  if (!src) {
    return (
      <span className="file-row-icon" aria-hidden>
        {isAfbeeldingBestand(naam, mimeType) ? "🖼" : "📄"}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="file-row-thumb-btn"
      onClick={onOpen}
      title={`Bekijk ${naam}`}
    >
      <img className="file-row-thumb" src={src} alt={naam} />
    </button>
  );
}
