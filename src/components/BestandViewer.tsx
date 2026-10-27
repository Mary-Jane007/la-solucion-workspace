import { MouseEvent, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openBestandInNieuwTab } from "../api";
import {
  isAfbeeldingBestand,
  isAfbeeldingBlob,
  isHeicBestand,
  isPdfBestand,
  normaliseerBestandBlob,
  normaliseerMime,
  probeerAfbeeldingUrl
} from "../bestandUtils";
import { PdfPaginas } from "./PdfPaginas";

export interface BestandViewerItem {
  id: string;
  naam: string;
  mimeType?: string | null;
  url?: string;
  bekijkUrl?: string | null;
  previewUrl?: string | null;
  fetchBlob?: () => Promise<Blob>;
}

interface Props {
  items: BestandViewerItem[];
  startId: string;
  onClose: () => void;
  onDownload?: (item: BestandViewerItem) => void | Promise<void>;
}

export function BestandBekijkLink({
  href,
  className = "link-btn file-download-btn",
  children = "Bekijken",
  onClick,
  onFallback
}: {
  href?: string | null;
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onFallback?: () => void;
}) {
  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  if (onFallback) {
    return (
      <button type="button" className={className} onClick={onFallback}>
        {children}
      </button>
    );
  }
  return null;
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
    let objectUrl: string | null = null;
    let stop = false;

    const toon = (src: string, soortNext: "foto" | "pdf") => {
      if (stop) return;
      setGeladenUrl(src);
      setSoort(soortNext);
      setLaden(false);
      setFout(null);
    };

    const toonBlob = (blob: Blob) => {
      const pdf = isPdfBestand(item.naam, blob.type) || normaliseerMime(blob.type) === "application/pdf";
      const typed = pdf && blob.type !== "application/pdf"
        ? new Blob([blob], { type: "application/pdf" })
        : blob;
      const next = URL.createObjectURL(typed);
      if (stop) {
        URL.revokeObjectURL(next);
        return;
      }
      objectUrl = next;
      if (!pdf && isAfbeeldingBlob(typed)) {
        toon(next, "foto");
        return;
      }
      toon(next, pdf ? "pdf" : "foto");
    };

    const run = async () => {
      if (item.url) {
        toon(item.url, isPdfBestand(item.naam, item.mimeType) ? "pdf" : "foto");
        return;
      }

      setLaden(true);
      setFout(null);
      setGeladenUrl(null);

      const ladenBlob = fetchRef.current;
      if (ladenBlob) {
        try {
          const blob = await normaliseerBestandBlob(await ladenBlob(), item.naam, item.mimeType);
          toonBlob(blob);
          return;
        } catch (err) {
          if (stop) return;
          if (isPdfBestand(item.naam, item.mimeType) && item.bekijkUrl) {
            toon(item.bekijkUrl, "pdf");
            return;
          }
          const preview = item.previewUrl || (item.bekijkUrl ? `${item.bekijkUrl}&preview=1` : null);
          if (preview && (await probeerAfbeeldingUrl(preview))) {
            toon(preview, "foto");
            return;
          }
          setFout(err instanceof Error ? err.message : "Kon het bestand niet laden.");
          setLaden(false);
          return;
        }
      }

      if (isPdfBestand(item.naam, item.mimeType) && item.bekijkUrl) {
        toon(item.bekijkUrl, "pdf");
        return;
      }

      const preview = item.previewUrl || (item.bekijkUrl ? `${item.bekijkUrl}&preview=1` : null);
      if (preview && (await probeerAfbeeldingUrl(preview))) {
        toon(preview, "foto");
        return;
      }

      if (!stop) {
        setGeladenUrl(null);
        setFout("Dit bestand kan hier niet worden getoond.");
        setLaden(false);
      }
    };

    void run();
    return () => {
      stop = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item?.id, item?.url, item?.previewUrl, item?.bekijkUrl, item?.naam, item?.mimeType]);

  const openPdfInBrowser = () => {
    const url = item?.bekijkUrl || geladenUrl;
    if (url) openBestandInNieuwTab(url);
    onClose();
  };

  const handleImgError = () => {
    const ladenBlob = fetchRef.current;
    if (ladenBlob) {
      setLaden(true);
      setFout(null);
      void ladenBlob()
        .then((ruw) => normaliseerBestandBlob(ruw, item?.naam || "", item?.mimeType))
        .then((blob) => {
          if (isAfbeeldingBlob(blob)) {
            setGeladenUrl(URL.createObjectURL(blob));
            setSoort("foto");
            setFout(null);
            setLaden(false);
            return;
          }
          if (isPdfBestand(item?.naam || "", blob.type) && (item?.bekijkUrl || geladenUrl)) {
            openPdfInBrowser();
            return;
          }
          setFout("Dit bestand kan hier niet worden getoond.");
          setLaden(false);
        })
        .catch((err) => {
          setFout(err instanceof Error ? err.message : "Kon het bestand niet laden.");
          setLaden(false);
        });
      return;
    }
    if (isPdfBestand(item?.naam || "", item?.mimeType) && (item?.bekijkUrl || geladenUrl)) {
      openPdfInBrowser();
      return;
    }
    if (isHeicBestand(item?.naam || "", item?.mimeType)) {
      setFout("Deze iPhone-foto (HEIC) kan Chrome niet tonen. Download het bestand of sla het op als JPG.");
      return;
    }
    setFout("Deze foto kan hier niet worden getoond.");
  };

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
            {soort === "pdf" && (item.bekijkUrl || geladenUrl) && (
              <a
                className="btn-secondary"
                href={item.bekijkUrl || geladenUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Openen in Chrome
              </a>
            )}
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
        <div className={`bestand-viewer-stage${soort === "pdf" ? " bestand-viewer-stage-pdf" : ""}`}>
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
          {!laden && !fout && geladenUrl && soort === "pdf" && <PdfPaginas src={geladenUrl} />}
          {!laden && !fout && geladenUrl && soort !== "pdf" && (
            <img
              src={geladenUrl}
              alt={item.naam}
              referrerPolicy="no-referrer"
              onError={handleImgError}
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
  previewUrl,
  fetchBlob,
  onOpen
}: {
  naam: string;
  mimeType?: string | null;
  url?: string;
  previewUrl?: string | null;
  fetchBlob?: () => Promise<Blob>;
  onOpen?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(url || previewUrl || null);
  const [imgFout, setImgFout] = useState(false);
  const fetchRef = useRef(fetchBlob);
  fetchRef.current = fetchBlob;

  useEffect(() => {
    setImgFout(false);
    if (url) {
      setSrc(url);
      return;
    }
    if (previewUrl) {
      setSrc(previewUrl);
      return;
    }
    const ladenBlob = fetchRef.current;
    if (!ladenBlob || !isAfbeeldingBestand(naam, mimeType)) {
      setSrc(null);
      return;
    }
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
  }, [url, previewUrl, naam, mimeType]);

  if (!src || imgFout) {
    const icoon = (
      <span className="file-row-icon" aria-hidden>
        {isAfbeeldingBestand(naam, mimeType) ? "🖼" : "📄"}
      </span>
    );
    if (!onOpen) return icoon;
    return (
      <button type="button" className="file-row-thumb-btn" onClick={onOpen} title={`Bekijk ${naam}`}>
        {icoon}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="file-row-thumb-btn"
      onClick={onOpen}
      title={`Bekijk ${naam}`}
    >
      <img
        className="file-row-thumb"
        src={src}
        alt={naam}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setImgFout(true)}
      />
    </button>
  );
}
