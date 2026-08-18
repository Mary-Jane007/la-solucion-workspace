import { useEffect, useState } from "react";
import {
  downloadInzendingBijlage,
  fetchInzendingBijlageBlob,
  FinancieelInzendingBijlage
} from "../../api";

export function FinancieelFotos({
  bijlagen,
  fetchBlob,
  onDownload,
  onVerwijder
}: {
  bijlagen?: FinancieelInzendingBijlage[];
  fetchBlob: (id: string) => Promise<Blob>;
  onDownload: (id: string, naam: string) => void | Promise<void>;
  onVerwijder?: (id: string) => void;
}) {
  if (!bijlagen?.length) return null;
  return (
    <div className="inzending-fotos">
      {bijlagen.map((bijlage) => (
        <FinancieelFoto
          key={bijlage.id}
          bijlage={bijlage}
          fetchBlob={fetchBlob}
          onDownload={onDownload}
          onVerwijder={onVerwijder}
        />
      ))}
    </div>
  );
}

export function InzendingBijlagen({ bijlagen }: { bijlagen?: FinancieelInzendingBijlage[] }) {
  return (
    <FinancieelFotos
      bijlagen={bijlagen}
      fetchBlob={fetchInzendingBijlageBlob}
      onDownload={downloadInzendingBijlage}
    />
  );
}

function FinancieelFoto({
  bijlage,
  fetchBlob,
  onDownload,
  onVerwijder
}: {
  bijlage: FinancieelInzendingBijlage;
  fetchBlob: (id: string) => Promise<Blob>;
  onDownload: (id: string, naam: string) => void | Promise<void>;
  onVerwijder?: (id: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let stop = false;
    void fetchBlob(bijlage.id)
      .then((blob) => {
        const next = URL.createObjectURL(blob);
        if (stop) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => {
        if (!stop) setFout(true);
      });
    return () => {
      stop = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bijlage.id, fetchBlob]);

  return (
    <figure className="inzending-foto">
      {url ? (
        <button
          type="button"
          className="inzending-foto-btn"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          title={bijlage.origineleNaam}
        >
          <img src={url} alt={bijlage.origineleNaam} />
        </button>
      ) : (
        <div className="inzending-foto-placeholder">
          {fout ? "Foto niet geladen" : "Laden…"}
        </div>
      )}
      <figcaption>
        <span>{bijlage.origineleNaam}</span>
        <button
          type="button"
          className="link-btn"
          onClick={() => void onDownload(bijlage.id, bijlage.origineleNaam)}
        >
          Download
        </button>
        {onVerwijder && (
          <button type="button" className="link-btn" onClick={() => onVerwijder(bijlage.id)}>
            Verwijderen
          </button>
        )}
      </figcaption>
    </figure>
  );
}
