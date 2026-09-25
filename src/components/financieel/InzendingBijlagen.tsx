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
import { BestandViewer, BestandViewerItem } from "../BestandViewer";

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
        bekijkUrl: bestandBekijkUrl(bijlage.id, bron)
      })),
    [bijlagen, fetchBlob, bron]
  );
  const openBijlage = (bijlage: FinancieelInzendingBijlage) => {
    if (isPdfBestand(bijlage.origineleNaam, bijlage.mimeType)) {
      const url = bestandBekijkUrl(bijlage.id, bron);
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
  onOpen,
  onDownload,
  onVerwijder
}: {
  bijlage: FinancieelInzendingBijlage;
  fetchBlob: (id: string, naam?: string) => Promise<Blob>;
  onOpen: () => void;
  onDownload: (id: string, naam: string) => void | Promise<void>;
  onVerwijder?: (id: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
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
  }, [bijlage.id, fetchBlob]);

  return (
    <figure className="inzending-foto">
      {url ? (
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
        <button type="button" className="link-btn" onClick={onOpen}>
          Bekijken
        </button>
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
