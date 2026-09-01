import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentScanner } from "../documentScanner/DocumentScanner";

interface Props {
  disabled?: boolean;
  onBestanden: (files: File[]) => void;
}

export function DocumentenToevoegen({ disabled, onBestanden }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  useEffect(() => {
    setCameraSupported(
      Boolean(
        typeof navigator !== "undefined" &&
          navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === "function"
      )
    );
  }, []);

  const hint = useMemo(
    () =>
      cameraSupported
        ? "PDF, JPG, PNG of DOC — of scan een document met de camera."
        : "PDF, JPG, PNG of DOC. Op desktop kun je ook via de scanner uploaden.",
    [cameraSupported]
  );

  return (
    <div className="documenten-toevoegen">
      <label className="form-label">Documenten toevoegen</label>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="documenten-file-input"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif,image/*,application/pdf"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) onBestanden(Array.from(e.target.files));
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
      <div className="documenten-acties">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          Bestand kiezen
        </button>
        <button
          type="button"
          className="btn-primary documenten-scan-btn"
          disabled={disabled}
          onClick={() => setScannerOpen(true)}
        >
          📷 Scan document
        </button>
      </div>
      <span className="help-text">{hint}</span>
      <DocumentScanner
        open={scannerOpen}
        onSluit={() => setScannerOpen(false)}
        onPdfKlaar={(file) => {
          onBestanden([file]);
          setScannerOpen(false);
        }}
      />
    </div>
  );
}
