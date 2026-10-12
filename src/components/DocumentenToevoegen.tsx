import { useRef } from "react";

interface Props {
  disabled?: boolean;
  onBestanden: (files: File[]) => void;
}

export function DocumentenToevoegen({ disabled, onBestanden }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      </div>
      <span className="help-text">
        PDF, JPG, PNG of DOC. Daarna kun je de naam aanpassen of een bestand verwijderen.
      </span>
    </div>
  );
}
