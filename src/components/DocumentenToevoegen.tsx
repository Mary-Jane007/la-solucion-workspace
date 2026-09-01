import { useEffect, useMemo, useRef, useState } from "react";
import { FotoCameraModal } from "./FotoCameraModal";

interface Props {
  disabled?: boolean;
  onBestanden: (files: File[]) => void;
}

export function DocumentenToevoegen({ disabled, onBestanden }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
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

  const kiesBestanden = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (files: FileList | null) => {
    if (!files?.length) return;
    onBestanden(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hint = useMemo(
    () =>
      cameraSupported
        ? "PDF, JPG, PNG of DOC — of maak direct een foto met de camera."
        : "PDF, JPG, PNG of DOC. Camera niet beschikbaar in deze browser.",
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
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*,application/pdf"
        disabled={disabled}
        onChange={(e) => handleFileChange(e.target.files)}
      />
      <div className="documenten-acties">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled}
          onClick={kiesBestanden}
        >
          Bestand kiezen
        </button>
        {cameraSupported && (
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled}
            onClick={() => setCameraOpen(true)}
          >
            Foto maken
          </button>
        )}
      </div>
      <span className="help-text">{hint}</span>
      <FotoCameraModal
        open={cameraOpen}
        onSluit={() => setCameraOpen(false)}
        onVastgelegd={(file) => onBestanden([file])}
      />
    </div>
  );
}
