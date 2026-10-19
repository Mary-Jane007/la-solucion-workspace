import { BestandDropzone } from "./BestandDropzone";

interface Props {
  disabled?: boolean;
  onBestanden: (files: File[]) => void;
}

export function DocumentenToevoegen({ disabled, onBestanden }: Props) {
  return (
    <div className="documenten-toevoegen">
      <label className="form-label">Documenten toevoegen</label>
      <BestandDropzone
        disabled={disabled}
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif,image/*,application/pdf"
        knopLabel="Bestand kiezen"
        titel="Sleep bestanden hierheen"
        hint="PDF, JPG, PNG of DOC. Daarna kun je de naam aanpassen of een bestand verwijderen."
        onBestanden={onBestanden}
      />
    </div>
  );
}
