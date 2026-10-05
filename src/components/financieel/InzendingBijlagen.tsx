import { useEffect, useMemo, useState } from "react";
import {
  BestandBron,
  bestandBekijkUrl,
  downloadInzendingBijlage,
  fetchInzendingBijlageBlob,
  FinancieelInzendingBijlage,
  openBestandInNieuwTab
} from "../../api";
import { isPdfBestand } from "../../bestandUtils";
import { BestandBekijkLink, BestandViewer, BestandViewerItem } from "../BestandViewer";

export function FinancieelFotos({
  bijlagen,
  fetchBlob,
  onDownload,
  onVerwijder,
  bron = "financieel-inzending"
}: {
  bijlagen?: FinancieelInzendingBijlage[];
  fetchBlob: (id: string, naam?: string) => Promise<Blob>;
  onDownload: (id: string, naam: string) => void | Promise<void>;
  onVerwijder?: (id: string) => void;
  bron?: BestandBron;
}) {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const viewerItems = useMemo<BestandViewerItem[]>(
    () =>
      (bijlagen || []).map((bijlage) => ({
        id: bijlage.id,
        naam: bijlage.origineleNaam,
        mimeType: bijlage.mimeType,
        fetchBlob: () => fetchBlob(bijlage.id, bijlage.origineleNaam),
        bekijkUrl: bestandBekijkUrl(bijlage.id, bron, bijlage.origineleNaam)
      })),
    [bijlagen, fetchBlob, bron]
  );
  const openBijlage = (bijlage: FinancieelInzendingBijlage) => {
    if (isPdfBestand(bijlage.origineleNaam, bijlage.mimeType)) {
      const url = bestandBekijkUrl(bijlage.id, bron, bijlage.origineleNaam);
      if (url && openBestandInNieuwTab(url)) return;
    }
    setViewerId(bijlage.id);
  };

  if (!bijlagen?.length) return null;
  return (
    <>
      <div className="inzending-fotos">
        {bijlagen.map((bijlage) => (
          <FinancieelFoto
            key={bijlage.id}
            bijlage={bijlage}
            fetchBlob={fetchBlob}
            bekijkUrl={bestandBekijkUrl(bijlage.id, bron, bijlage.origineleNaam)}
            onOpen={() => openBijlage(bijlage)}
            onDownload={onDownload}
            onVerwijder={onVerwijder}
          />
        ))}
      </div>
      {viewerId && (
        <BestandViewer
          items={viewerItems}
          startId={viewerId}
          onClose={() => setViewerId(null)}
          onDownload={(item) => onDownload(item.id, item.naam)}
        />
      )}
    </>
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
  bekijkUrl,
  onOpen,
  onDownload,
  onVerwijder
}: {
  bijlage: FinancieelInzendingBijlage;
  fetchBlob: (id: string, naam?: string) => Promise<Blob>;
  bekijkUrl?: string | null;
  onOpen: () => void;
  onDownload: (id: string, naam: string) => void | Promise<void>;
  onVerwijder?: (id: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fout, setFout] = useState(false);
  const isPdf = isPdfBestand(bijlage.origineleNaam, bijlage.mimeType);

  useEffect(() => {
    if (isPdf) return;
    let objectUrl: string | null = null;
    let stop = false;
    void fetchBlob(bijlage.id, bijlage.origineleNaam)
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
  }, [bijlage.id, fetchBlob, isPdf]);

  return (
    <figure className="inzending-foto">
      {isPdf ? (
        <a
          className="inzending-foto-btn inzending-foto-pdf"
          href={bekijkUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${bijlage.origineleNaam} in Chrome`}
          onClick={(event) => {
            if (bekijkUrl) return;
            event.preventDefault();
            onOpen();
          }}
        >
          <span aria-hidden>📄</span>
          <span>PDF</span>
        </a>
      ) : url ? (
        <button
          type="button"
          className="inzending-foto-btn"
          onClick={onOpen}
          title={`Bekijk ${bijlage.origineleNaam}`}
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
        {isPdf ? (
          <BestandBekijkLink href={bekijkUrl} onFallback={onOpen} />
        ) : (
          <button type="button" className="link-btn" onClick={onOpen}>
            Bekijken
          </button>
        )}
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
