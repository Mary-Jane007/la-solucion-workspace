import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onSluit: () => void;
  onVastgelegd: (file: File) => void;
}

function canvasToJpegFile(canvas: HTMLCanvasElement, naam: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Foto kon niet worden gemaakt."));
          return;
        }
        resolve(new File([blob], naam, { type: "image/jpeg", lastModified: Date.now() }));
      },
      "image/jpeg",
      0.92
    );
  });
}

export function FotoCameraModal({ open, onSluit, onVastgelegd }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState(false);

  useEffect(() => {
    if (!open) {
      setFout(null);
      setKlaar(false);
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera wordt niet ondersteund in deze browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          setKlaar(true);
        }
      } catch {
        if (!cancelled) {
          setFout(
            "Camera niet beschikbaar. Geef cameratoegang of gebruik ‘Bestand kiezen’ om een foto te uploaden."
          );
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  const vastleggen = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      setFout(null);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Foto kon niet worden gemaakt.");
      ctx.drawImage(video, 0, 0);
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const file = await canvasToJpegFile(canvas, `foto-${ts}.jpg`);
      onVastgelegd(file);
      onSluit();
    } catch {
      setFout("Foto maken mislukt. Probeer opnieuw.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop foto-camera-backdrop" onClick={onSluit}>
      <div className="modal foto-camera-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Foto maken</h2>
            <p className="muted">Richt de camera op het document en maak een foto.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onSluit}>
            Sluiten
          </button>
        </header>
        <div className="foto-camera-body">
          {fout ? (
            <p className="help-text page-error">{fout}</p>
          ) : (
            <video
              ref={videoRef}
              className="foto-camera-preview"
              playsInline
              muted
              aria-label="Camerabeeld"
            />
          )}
          {!klaar && !fout && <p className="muted">Camera wordt gestart…</p>}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onSluit}>
            Annuleren
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!klaar || Boolean(fout)}
            onClick={() => void vastleggen()}
          >
            Foto vastleggen
          </button>
        </footer>
      </div>
    </div>
  );
}
