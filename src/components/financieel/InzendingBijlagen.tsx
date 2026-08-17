import { useEffect, useState } from "react";
import {
  downloadInzendingBijlage,
  fetchInzendingBijlageBlob,
  FinancieelInzendingBijlage
} from "../../api";

export function InzendingBijlagen({ bijlagen }: { bijlagen?: FinancieelInzendingBijlage[] }) {
  if (!bijlagen?.length) return null;
  return (
    <div className="inzending-fotos">
      {bijlagen.map((bijlage) => (
        <InzendingFoto key={bijlage.id} bijlage={bijlage} />
      ))}
    </div>
  );
}

function InzendingFoto({ bijlage }: { bijlage: FinancieelInzendingBijlage }) {
  const [url, setUrl] = useState<string | null>(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let stop = false;
    void fetchInzendingBijlageBlob(bijlage.id)
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
  }, [bijlage.id]);

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
          onClick={() => void downloadInzendingBijlage(bijlage.id, bijlage.origineleNaam)}
        >
          Download
        </button>
      </figcaption>
    </figure>
  );
}
