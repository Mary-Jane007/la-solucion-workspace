import { DragEvent, useRef, useState } from "react";
import { bestandPastBijAccept, bestandenUitDataTransfer } from "../bestandUtils";

type Props = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  knopLabel?: string;
  titel?: string;
  hint?: string;
  compact?: boolean;
  onBestanden: (files: File[]) => void;
};

export function BestandDropzone({
  accept,
  multiple = true,
  disabled,
  knopLabel = "Bestand kiezen",
  titel = "Sleep bestanden hierheen",
  hint,
  compact,
  onBestanden
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sleepDiepte = useRef(0);
  const [sleepActief, setSleepActief] = useState(false);

  const kiesBestanden = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const leverBestanden = (files: File[]) => {
    const toegestaan = files.filter((file) => bestandPastBijAccept(file, accept));
    const gekozen = multiple ? toegestaan : toegestaan.slice(0, 1);
    if (gekozen.length) onBestanden(gekozen);
  };

  const onSleepOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = disabled ? "none" : "copy";
  };

  const onSleepIn = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    sleepDiepte.current += 1;
    setSleepActief(true);
  };

  const onSleepUit = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    sleepDiepte.current = Math.max(0, sleepDiepte.current - 1);
    if (sleepDiepte.current === 0) setSleepActief(false);
  };

  const onNeerzetten = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    sleepDiepte.current = 0;
    setSleepActief(false);
    if (disabled) return;
    leverBestanden(bestandenUitDataTransfer(e.dataTransfer));
  };

  return (
    <div
      className={`bestand-dropzone${compact ? " bestand-dropzone-compact" : ""}${
        sleepActief ? " is-sleep" : ""
      }${disabled ? " is-disabled" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        kiesBestanden();
      }}
      onDragEnter={onSleepIn}
      onDragOver={onSleepOver}
      onDragLeave={onSleepUit}
      onDrop={onNeerzetten}
    >
      <input
        ref={inputRef}
        type="file"
        className="bestand-dropzone-input"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          leverBestanden(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <p className="bestand-dropzone-titel">{sleepActief ? "Laat los om toe te voegen" : titel}</p>
      <button type="button" className="btn-secondary" disabled={disabled} onClick={kiesBestanden}>
        {knopLabel}
      </button>
      {hint ? <p className="bestand-dropzone-hint">{hint}</p> : null}
    </div>
  );
}
