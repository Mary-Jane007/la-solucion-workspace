import { useMemo, useState } from "react";
import {
  BestandBron,
  bestandBekijkUrl,
  bestandPreviewUrl,
  downloadInzendingBijlage,
  fetchInzendingBijlageBlob,
  FinancieelInzendingBijlage
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
        bekijkUrl: bestandBekijkUrl(bijlage.id, bron, bijlage.origineleNaam),
        previewUrl: bestandPreviewUrl(bijlage.id, bron, bijlage.origineleNaam)
      })),
    [bijlagen, fetchBlob, bron]
  );
  const openBijlage = async (bijlage: FinancieelInzendingBijlage) => {
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
            bekijkUrl={bestandBekijkUrl(bijlage.id, bron, bijlage.origineleNaam)}
            previewUrl={bestandPreviewUrl(bijlage.id, bron, bijlage.origineleNaam)}
            onOpen={() => void openBijlage(bijlage)}
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
  bekijkUrl,
  previewUrl,
  onOpen,
  onDownload,
  onVerwijder
}: {
  bijlage: FinancieelInzendingBijlage;
  bekijkUrl?: string | null;
  previewUrl?: string | null;
  onOpen: () => void;
  onDownload: (id: string, naam: string) => void | Promise<void>;
  onVerwijder?: (id: string) => void;
}) {
  const [imgFout, setImgFout] = useState(false);
  const isPdf = isPdfBestand(bijlage.origineleNaam, bijlage.mimeType);
  const fotoSrc = previewUrl || bekijkUrl;

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
            event.preventDefault();
            onOpen();
          }}
        >
          <span aria-hidden>📄</span>
          <span>PDF</span>
        </a>
      ) : fotoSrc && !imgFout ? (
        <button
          type="button"
          className="inzending-foto-btn"
          onClick={onOpen}
          title={`Bekijk ${bijlage.origineleNaam}`}
        >
          <img
            src={fotoSrc}
            alt={bijlage.origineleNaam}
            referrerPolicy="no-referrer"
            onError={() => setImgFout(true)}
          />
        </button>
      ) : (
        <button type="button" className="inzending-foto-btn" onClick={onOpen} title={`Bekijk ${bijlage.origineleNaam}`}>
          <div className="inzending-foto-placeholder">{imgFout ? "Foto niet geladen" : "Laden…"}</div>
        </button>
      )}
      <figcaption>
        <span>{bijlage.origineleNaam}</span>
        {isPdf ? (
          <BestandBekijkLink
            href={bekijkUrl}
            onClick={(event) => {
              event.preventDefault();
              onOpen();
            }}
            onFallback={onOpen}
          />
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
