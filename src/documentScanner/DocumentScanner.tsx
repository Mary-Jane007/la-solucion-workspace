import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScannerCropEditor } from "./ScannerCropEditor";
import { detectDocumentCorners, detectDocumentCornersMetFallback, hoekenNaarPolygonString, hoekenNaarVideoOverlay, overlayNaarVideoHoeken, smoothHoeken } from "./documentDetection";
import {
  canvasFromImage,
  canvasToDataUrl,
  canvasToThumbnail,
  loadImageFromFile,
  nieuwScanId,
  vandaagScanNaam,
  gemiddeldeHelderheid,
  schaalHoeken
} from "./imageUtils";
import { loadOpenCV } from "./opencvLoader";
import { canvasFromDataUrl, rotateCanvas, warpDocument } from "./perspectiveTransform";
import { applyScanFilter, filterPreview } from "./scanFilters";
import { downloadPdf, deelPdf, maakPdfUitPaginas, pdfBlobNaarFile } from "./pdfExport";
import {
  bewaarInScanGeschiedenis,
  formatGrootte,
  formatScanDatum,
  laadScanGeschiedenis,
  verwijderUitScanGeschiedenis,
  zoekInScanGeschiedenis
} from "./scanHistory";
import { herkenTekstUitCanvas } from "./ocr";
import {
  FILTER_LABELS,
  type Point,
  type ScanFilterMode,
  type ScanHistoryItem,
  type ScanPage,
  type ScannerStep
} from "./types";

const FILTER_MODES: ScanFilterMode[] = ["auto", "original", "bw", "gray", "color", "enhanced"];

interface Props {
  open: boolean;
  onSluit: () => void;
  onPdfKlaar: (file: File) => void;
}

export function DocumentScanner({ open, onSluit, onPdfKlaar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraWrapRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectTimer = useRef<number | null>(null);
  const smoothCornersRef = useRef<Point[] | null>(null);
  const maskId = useId().replace(/:/g, "");

  const [step, setStep] = useState<ScannerStep>("camera");
  const [cameraFout, setCameraFout] = useState<string | null>(null);
  const [cameraKlaar, setCameraKlaar] = useState(false);
  const [flashAan, setFlashAan] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [waarschuwing, setWaarschuwing] = useState<string | null>(null);
  const [documentGevonden, setDocumentGevonden] = useState(false);
  const [liveCorners, setLiveCorners] = useState<Point[] | null>(null);
  const [overlaySize, setOverlaySize] = useState({ w: 0, h: 0 });

  const [rawDataUrl, setRawDataUrl] = useState<string | null>(null);
  const [rawSize, setRawSize] = useState({ w: 0, h: 0 });
  const [cropCorners, setCropCorners] = useState<Point[]>([]);
  const [warpedDataUrl, setWarpedDataUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScanFilterMode>("auto");
  const [filterPreviews, setFilterPreviews] = useState<Record<string, string>>({});

  const [paginas, setPaginas] = useState<ScanPage[]>([]);
  const [bewerkPaginaId, setBewerkPaginaId] = useState<string | null>(null);
  const [scanNaam, setScanNaam] = useState(vandaagScanNaam());
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [bezig, setBezig] = useState(false);
  const [ocrBezig, setOcrBezig] = useState(false);
  const [ocrTekst, setOcrTekst] = useState<string | null>(null);

  const [geschiedenis, setGeschiedenis] = useState<ScanHistoryItem[]>([]);
  const [zoekterm, setZoekterm] = useState("");

  const [cameraSupported, setCameraSupported] = useState(true);

  const resetScanner = useCallback(() => {
    setStep("camera");
    setRawDataUrl(null);
    setWarpedDataUrl(null);
    setCropCorners([]);
    setFilter("auto");
    setPaginas([]);
    setBewerkPaginaId(null);
    setScanNaam(vandaagScanNaam());
    setPdfBlob(null);
    setFeedback(null);
    setWaarschuwing(null);
    setDocumentGevonden(false);
    setLiveCorners(null);
    smoothCornersRef.current = null;
    setOcrTekst(null);
    setFilterPreviews({});
  }, []);

  const sluitScanner = useCallback(() => {
    if (detectTimer.current) {
      window.clearInterval(detectTimer.current);
      detectTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    smoothCornersRef.current = null;
    setCameraKlaar(false);
    onSluit();
  }, [onSluit]);

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (detectTimer.current) window.clearInterval(detectTimer.current);
      return;
    }
    resetScanner();
    setGeschiedenis(laadScanGeschiedenis());
    setCameraSupported(Boolean(navigator.mediaDevices?.getUserMedia));
    void loadOpenCV().catch(() => undefined);
  }, [open, resetScanner]);

  useEffect(() => {
    if (!open || step !== "camera" || !cameraSupported) return;

    let cancelled = false;

    const start = async () => {
      try {
        setCameraFout(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setCameraKlaar(true);
          setOverlaySize({ w: video.clientWidth, h: video.clientHeight });
        }
      } catch {
        if (!cancelled) {
          setCameraFout("Cameratoegang geweigerd of niet beschikbaar.");
          setCameraSupported(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [open, step, cameraSupported]);

  useEffect(() => {
    if (!open || step !== "camera") return;
    const wrap = cameraWrapRef.current;
    const video = videoRef.current;
    if (!wrap) return;

    const updateSize = () => {
      const w = video?.clientWidth || wrap.clientWidth;
      const h = video?.clientHeight || wrap.clientHeight;
      if (w > 0 && h > 0) setOverlaySize({ w, h });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(wrap);
    if (video) observer.observe(video);
    return () => observer.disconnect();
  }, [open, step, cameraKlaar]);

  useEffect(() => {
    if (!open || step !== "camera" || !cameraKlaar) return;

    detectTimer.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video?.videoWidth) return;
      try {
        const canvas = canvasFromImage(video, 640);
        const corners = await detectDocumentCorners(canvas);
        const displayW = video.clientWidth;
        const displayH = video.clientHeight;
        if (displayW > 0 && displayH > 0) {
          setOverlaySize({ w: displayW, h: displayH });
        }
        if (corners?.length === 4) {
          const inVideoSpace = schaalHoeken(
            corners,
            canvas.width,
            canvas.height,
            video.videoWidth,
            video.videoHeight
          );
          const mapped = hoekenNaarVideoOverlay(
            inVideoSpace,
            video.videoWidth,
            video.videoHeight,
            displayW,
            displayH
          );
          const smoothed = smoothHoeken(smoothCornersRef.current, mapped);
          smoothCornersRef.current = smoothed;
          setLiveCorners(smoothed);
          setDocumentGevonden(true);
          setFeedback("Document gevonden");
        } else {
          smoothCornersRef.current = null;
          setLiveCorners(null);
          setDocumentGevonden(false);
          setFeedback(null);
        }
        const helder = gemiddeldeHelderheid(canvas);
        if (helder < 70) setWaarschuwing("⚠️ Meer licht nodig");
        else if (helder > 230) setWaarschuwing("⚠️ Minder direct licht op het document");
        else setWaarschuwing(null);
      } catch {
        /* stille detectie */
      }
    }, 450);

    return () => {
      if (detectTimer.current) window.clearInterval(detectTimer.current);
    };
  }, [open, step, cameraKlaar]);

  useEffect(() => {
    if (!warpedDataUrl) return;
    void (async () => {
      const canvas = await canvasFromDataUrl(warpedDataUrl);
      const previews: Record<string, string> = {};
      for (const mode of FILTER_MODES) {
        previews[mode] = filterPreview(canvas, mode);
      }
      setFilterPreviews(previews);
    })();
  }, [warpedDataUrl]);

  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      if (capabilities?.torch) {
        await track.applyConstraints({ advanced: [{ torch: !flashAan } as MediaTrackConstraintSet] });
        setFlashAan(!flashAan);
      } else {
        setWaarschuwing("Flash niet beschikbaar op dit apparaat.");
      }
    } catch {
      setWaarschuwing("Flash kon niet worden ingeschakeld.");
    }
  };

  const maakScan = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    setBezig(true);
    setFeedback(null);
    try {
      const canvas = canvasFromImage(video, 2400);
      setRawSize({ w: canvas.width, h: canvas.height });
      setRawDataUrl(canvasToDataUrl(canvas));

      let corners: Point[] | null = null;
      if (documentGevonden && smoothCornersRef.current?.length === 4) {
        const inVideoSpace = overlayNaarVideoHoeken(
          smoothCornersRef.current,
          video.videoWidth,
          video.videoHeight,
          video.clientWidth,
          video.clientHeight
        );
        corners = schaalHoeken(
          inVideoSpace,
          video.videoWidth,
          video.videoHeight,
          canvas.width,
          canvas.height
        );
      }

      setStep("processing");
      if (corners) {
        setCropCorners(corners);
        setStep("crop");
      } else {
        const { corners: detected, auto } = await detectDocumentCornersMetFallback(canvas);
        setCropCorners(detected);
        if (!auto) {
          setWaarschuwing(
            "We konden het document niet goed herkennen. Pas de hoeken handmatig aan of plaats het document vlakker en beter verlicht."
          );
        }
        setStep("crop");
      }
    } catch {
      setCameraFout("Scan maken mislukt. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };

  const verwerkCrop = async (corners: Point[]) => {
    if (!rawDataUrl) return;
    setBezig(true);
    try {
      const src = await canvasFromDataUrl(rawDataUrl);
      const warped = await warpDocument(src, corners);
      setWarpedDataUrl(canvasToDataUrl(warped));
      setStep("filter");
      setFeedback("Scan gemaakt");
    } catch {
      setWaarschuwing("Perspectiefcorrectie mislukt. Probeer opnieuw of kies Handmatig doorgaan.");
    } finally {
      setBezig(false);
    }
  };

  const slaPaginaOp = async () => {
    if (!warpedDataUrl) return;
    setBezig(true);
    try {
      const base = await canvasFromDataUrl(warpedDataUrl);
      const filtered = applyScanFilter(base, filter);
      const dataUrl = canvasToDataUrl(filtered);
      const page: ScanPage = {
        id: nieuwScanId(),
        thumbnail: canvasToThumbnail(filtered),
        processedDataUrl: dataUrl,
        filter
      };
      if (bewerkPaginaId) {
        setPaginas((prev) => prev.map((p) => (p.id === bewerkPaginaId ? page : p)));
        setBewerkPaginaId(null);
      } else {
        setPaginas((prev) => [...prev, page]);
      }
      setFeedback("Pagina toegevoegd");
      setStep("pages");
      setRawDataUrl(null);
      setWarpedDataUrl(null);
    } finally {
      setBezig(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.type === "application/pdf") {
      onPdfKlaar(file);
      sluitScanner();
      return;
    }
    setBezig(true);
    try {
      const img = await loadImageFromFile(file);
      const canvas = canvasFromImage(img, 2400);
      setRawSize({ w: canvas.width, h: canvas.height });
      setRawDataUrl(canvasToDataUrl(canvas));
      const { corners } = await detectDocumentCornersMetFallback(canvas);
      setCropCorners(corners);
      setStep("crop");
    } catch {
      setCameraFout("Bestand kon niet worden geladen.");
    } finally {
      setBezig(false);
    }
  };

  const genereerPdf = async () => {
    if (!paginas.length) return;
    setBezig(true);
    setFeedback("PDF wordt gemaakt…");
    try {
      const { blob } = await maakPdfUitPaginas(paginas);
      setPdfBlob(blob);
      setStep("save");
    } catch {
      setWaarschuwing("PDF maken mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const opslaanPdf = async (doel: "opdracht" | "lokaal" | "beide") => {
    if (!pdfBlob) return;
    setBezig(true);
    try {
      const file = pdfBlobNaarFile(pdfBlob, scanNaam);
      if (doel === "lokaal" || doel === "beide") {
        await downloadPdf(pdfBlob, scanNaam);
      }
      if (doel === "opdracht" || doel === "beide") {
        onPdfKlaar(file);
      }
      bewaarInScanGeschiedenis({
        naam: scanNaam,
        datum: new Date().toISOString(),
        paginas: paginas.length,
        grootte: pdfBlob.size,
        thumbnail: paginas[0]?.thumbnail || ""
      });
      setStep("done");
      setFeedback("✓ Document opgeslagen");
    } finally {
      setBezig(false);
    }
  };

  const startOcr = async () => {
    if (!paginas.length) return;
    setOcrBezig(true);
    setFeedback("Tekst wordt herkend…");
    try {
      const canvas = await canvasFromDataUrl(paginas[0].processedDataUrl);
      const text = await herkenTekstUitCanvas(canvas);
      setOcrTekst(text || "Geen tekst herkend.");
      setFeedback(text ? "✓ Tekst herkend" : null);
    } finally {
      setOcrBezig(false);
    }
  };

  const startNieuwePagina = () => {
    setRawDataUrl(null);
    setWarpedDataUrl(null);
    setCropCorners([]);
    setFilter("auto");
    setBewerkPaginaId(null);
    setFeedback(null);
    setWaarschuwing(null);
    setStep("camera");
  };

  const verplaatsPagina = (from: number, to: number) => {
    setPaginas((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  if (!open) return null;

  const overlayPolygon =
    liveCorners?.length === 4 ? hoekenNaarPolygonString(liveCorners) : null;

  const scannerUi = (
    <div
      className="document-scanner"
      role="dialog"
      aria-modal="true"
      aria-label="Document scanner"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {step === "camera" && cameraSupported && !cameraFout && (
        <div className="scanner-screen scanner-camera-screen">
          <header className="scanner-top">
            <button
              type="button"
              className="scanner-icon-btn"
              onClick={sluitScanner}
              aria-label="Terug"
            >
              ←
            </button>
            <span className="scanner-title">Scan document</span>
            <div className="scanner-top-actions">
              <button type="button" className="scanner-icon-btn" onClick={() => void toggleFlash()} aria-label="Flash">
                {flashAan ? "🔦" : "💡"}
              </button>
              <button type="button" className="scanner-icon-btn" onClick={() => setStep("history")} aria-label="Mijn scans">
                📋
              </button>
            </div>
          </header>
          <p className="scanner-instructie">Plaats het document binnen het kader</p>
          {feedback && documentGevonden && <p className="scanner-feedback success">{feedback}</p>}
          {waarschuwing && <p className="scanner-feedback warn">{waarschuwing}</p>}
          <div className="scanner-camera-wrap" ref={cameraWrapRef}>
            <video ref={videoRef} className="scanner-video" playsInline muted />
            <svg
              className="scanner-overlay"
              viewBox={`0 0 ${Math.max(overlaySize.w, 1)} ${Math.max(overlaySize.h, 1)}`}
              preserveAspectRatio="none"
            >
              {overlayPolygon && documentGevonden ? (
                <>
                  <defs>
                    <mask id={maskId}>
                      <rect width="100%" height="100%" fill="white" />
                      <polygon points={overlayPolygon} fill="black" />
                    </mask>
                  </defs>
                  <rect
                    width="100%"
                    height="100%"
                    className="scanner-overlay-dim"
                    mask={`url(#${maskId})`}
                  />
                  <polygon points={overlayPolygon} className="scanner-doc-frame found" />
                  {liveCorners?.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="7" className="scanner-corner-dot" />
                  ))}
                </>
              ) : (
                <>
                  <rect width="100%" height="100%" className="scanner-overlay-dim" />
                  <rect
                    x={overlaySize.w * 0.08}
                    y={overlaySize.h * 0.18}
                    width={overlaySize.w * 0.84}
                    height={overlaySize.h * 0.55}
                    rx="12"
                    className="scanner-doc-frame guide"
                  />
                </>
              )}
            </svg>
          </div>
          <footer className="scanner-shutter-bar">
            <button type="button" className="scanner-shutter" disabled={!cameraKlaar || bezig} onClick={() => void maakScan()} aria-label="Scan maken">
              <span className="scanner-shutter-inner" />
            </button>
          </footer>
        </div>
      )}

      {(step === "camera" && (!cameraSupported || cameraFout)) && (
        <div className="scanner-screen scanner-fallback">
          <header className="scanner-top">
            <button type="button" className="scanner-icon-btn" onClick={sluitScanner} aria-label="Terug">
              ←
            </button>
            <span className="scanner-title">Document uploaden</span>
          </header>
          <div className="scanner-fallback-body">
            <p className="scanner-fallback-icon">📄</p>
            <p>{cameraFout || "Geen camera beschikbaar op dit apparaat."}</p>
            <label className="scanner-upload-btn">
              Bestand kiezen
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.heif,.pdf,image/*,application/pdf"
                hidden
                onChange={(e) => void handleUpload(e.target.files)}
              />
            </label>
            {cameraFout && (
              <button type="button" className="scanner-btn ghost" onClick={() => { setCameraFout(null); setCameraSupported(true); }}>
                Camera opnieuw proberen
              </button>
            )}
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="scanner-screen scanner-processing">
          <p className="scanner-spinner" />
          <p>Document verwerken…</p>
        </div>
      )}

      {step === "crop" && rawDataUrl && (
        <div className="scanner-screen">
          <header className="scanner-top">
            <button type="button" className="scanner-icon-btn" onClick={() => { resetScanner(); setStep("camera"); }}>←</button>
            <span className="scanner-title">Bijsnijden</span>
          </header>
          {waarschuwing && (
            <p className="scanner-feedback warn">
              {waarschuwing}{" "}
              <button type="button" className="link-btn" onClick={() => void verwerkCrop(cropCorners)}>
                Handmatig doorgaan
              </button>
            </p>
          )}
          <ScannerCropEditor
            imageDataUrl={rawDataUrl}
            corners={cropCorners}
            imageWidth={rawSize.w}
            imageHeight={rawSize.h}
            onGereed={(c) => void verwerkCrop(c)}
            onAnnuleren={() => {
              setRawDataUrl(null);
              setStep(paginas.length ? "pages" : "camera");
            }}
            onOpnieuw={startNieuwePagina}
          />
        </div>
      )}

      {step === "filter" && warpedDataUrl && (
        <div className="scanner-screen">
          <header className="scanner-top">
            <button type="button" className="scanner-icon-btn" onClick={() => setStep("crop")}>←</button>
            <span className="scanner-title">Scan verbeteren</span>
          </header>
          <div className="scanner-filter-body">
            <img src={filterPreviews[filter] || warpedDataUrl} alt="Preview" className="scanner-filter-preview" />
            <div className="scanner-filter-options">
              {FILTER_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`scanner-filter-chip${filter === mode ? " active" : ""}`}
                  onClick={() => setFilter(mode)}
                >
                  {filterPreviews[mode] && <img src={filterPreviews[mode]} alt="" />}
                  <span>{FILTER_LABELS[mode]}</span>
                </button>
              ))}
            </div>
          </div>
          <footer className="scanner-bottom-bar">
            <button type="button" className="scanner-btn ghost" onClick={() => setStep("crop")}>Opnieuw</button>
            <button type="button" className="scanner-btn primary" disabled={bezig} onClick={() => void slaPaginaOp()}>
              {bewerkPaginaId ? "Pagina bijwerken" : "Gereed"}
            </button>
          </footer>
        </div>
      )}

      {(step === "pages" || step === "preview") && (
        <div className="scanner-screen">
          <header className="scanner-top">
            <button type="button" className="scanner-icon-btn" onClick={sluitScanner} aria-label="Terug">
              ←
            </button>
            <span className="scanner-title">{step === "preview" ? "Document bekijken" : "Document"}</span>
            {step === "pages" && (
              <button type="button" className="scanner-btn primary small" disabled={!paginas.length || bezig} onClick={() => void genereerPdf()}>
                Volgende
              </button>
            )}
          </header>

          <div className="scanner-pages-grid">
            {paginas.map((p, index) => (
              <div
                key={p.id}
                className="scanner-page-thumb"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", String(index))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData("text/plain"));
                  if (!Number.isNaN(from)) verplaatsPagina(from, index);
                }}
              >
                <img src={p.thumbnail} alt={`Pagina ${index + 1}`} />
                <div className="scanner-page-meta">
                  <span>Pagina {index + 1}</span>
                  <div className="scanner-page-actions">
                    <button type="button" className="link-btn" onClick={async () => {
                      setBewerkPaginaId(p.id);
                      setWarpedDataUrl(p.processedDataUrl);
                      setFilter(p.filter);
                      setStep("filter");
                    }}>Bewerken</button>
                    <button type="button" className="link-btn" onClick={async () => {
                      const c = await canvasFromDataUrl(p.processedDataUrl);
                      const r = rotateCanvas(c, 90);
                      const url = canvasToDataUrl(r);
                      setPaginas((prev) => prev.map((x) => x.id === p.id ? { ...x, processedDataUrl: url, thumbnail: canvasToThumbnail(r) } : x));
                    }}>↻</button>
                    <button type="button" className="link-btn" onClick={() => setPaginas((prev) => prev.filter((x) => x.id !== p.id))}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {step === "preview" && paginas.map((p, i) => (
            <img key={p.id} src={p.processedDataUrl} alt={`Pagina ${i + 1}`} className="scanner-preview-page" />
          ))}

          <footer className="scanner-bottom-bar stacked">
            <button type="button" className="scanner-btn secondary" onClick={startNieuwePagina}>
              + Pagina toevoegen
            </button>
            {step === "pages" ? (
              <button type="button" className="scanner-btn ghost" onClick={() => setStep("preview")}>Preview</button>
            ) : (
              <button type="button" className="scanner-btn primary" disabled={!paginas.length || bezig} onClick={() => void genereerPdf()}>
                Opslaan als PDF
              </button>
            )}
          </footer>
        </div>
      )}

      {step === "save" && pdfBlob && (
        <div className="scanner-screen scanner-save">
          <header className="scanner-top">
            <button type="button" className="scanner-icon-btn" onClick={() => setStep("preview")}>←</button>
            <span className="scanner-title">Opslaan</span>
          </header>
          <div className="scanner-save-body">
            <label className="form-label">
              Bestandsnaam
              <input className="form-input" value={scanNaam} onChange={(e) => setScanNaam(e.target.value)} />
            </label>
            <p className="muted">{paginas.length} pagina&apos;s · {formatGrootte(pdfBlob.size)}</p>
            <p className="scanner-save-question">Waar wil je het document opslaan?</p>
            <div className="scanner-save-options">
              <button type="button" className="scanner-btn primary" disabled={bezig} onClick={() => void opslaanPdf("opdracht")}>
                Aan opdracht koppelen
              </button>
              <button type="button" className="scanner-btn secondary" disabled={bezig} onClick={() => void opslaanPdf("lokaal")}>
                Download PDF
              </button>
              <button type="button" className="scanner-btn secondary" disabled={bezig} onClick={() => void opslaanPdf("beide")}>
                Beide
              </button>
            </div>
            <button type="button" className="scanner-btn ghost" disabled={ocrBezig} onClick={() => void startOcr()}>
              {ocrBezig ? "Tekst wordt herkend…" : "Tekst herkennen (OCR)"}
            </button>
            {ocrTekst && <textarea className="form-input scanner-ocr" readOnly value={ocrTekst} rows={4} />}
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="scanner-screen scanner-done">
          <p className="scanner-done-icon">✓</p>
          <h2>Document opgeslagen</h2>
          <p className="muted">{scanNaam}</p>
          <div className="scanner-done-actions">
            <button type="button" className="scanner-btn primary" onClick={() => pdfBlob && void downloadPdf(pdfBlob, scanNaam)}>Openen</button>
            <button type="button" className="scanner-btn secondary" onClick={() => pdfBlob && void deelPdf(pdfBlob, scanNaam)}>Delen</button>
            <button type="button" className="scanner-btn ghost" onClick={() => { resetScanner(); setStep("camera"); }}>Nieuwe scan</button>
            <button type="button" className="scanner-btn ghost" onClick={sluitScanner}>
              Sluiten
            </button>
          </div>
        </div>
      )}

      {step === "history" && (
        <div className="scanner-screen">
          <header className="scanner-top">
            <button type="button" className="scanner-icon-btn" onClick={() => setStep("camera")}>←</button>
            <span className="scanner-title">Mijn scans</span>
          </header>
          <input
            className="form-input scanner-search"
            placeholder="Zoeken…"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
          />
          <ul className="scanner-history-list">
            {zoekInScanGeschiedenis(geschiedenis, zoekterm).map((item) => (
              <li key={item.id} className="scanner-history-item">
                {item.thumbnail && <img src={item.thumbnail} alt="" />}
                <div>
                  <strong>📄 {item.naam}</strong>
                  <p className="muted">{item.paginas} pagina&apos;s · {formatScanDatum(item.datum)} · {formatGrootte(item.grootte)}</p>
                </div>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    verwijderUitScanGeschiedenis(item.id);
                    setGeschiedenis(laadScanGeschiedenis());
                  }}
                >
                  Verwijderen
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return createPortal(scannerUi, document.body);
}
