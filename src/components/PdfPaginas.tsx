import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import PdfJsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
try {
  GlobalWorkerOptions.workerPort = new PdfJsWorker();
} catch {
  /* workerSrc volstaat als Vite-worker niet start */
}

async function bytesVanBron(src: string, data?: ArrayBuffer | null): Promise<Uint8Array> {
  if (data && data.byteLength) return new Uint8Array(data.slice(0));
  const res = await fetch(src);
  if (!res.ok) throw new Error("PDF ophalen mislukt.");
  return new Uint8Array(await res.arrayBuffer());
}

export function PdfPaginas({ src, data }: { src: string; data?: ArrayBuffer | null }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pdfjsOk, setPdfjsOk] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let stop = false;
    let pdfDoc: { destroy: () => Promise<unknown> } | null = null;
    setPdfjsOk(false);
    setLaden(true);
    setFout(null);
    host.replaceChildren();

    const run = async () => {
      const bytes = await bytesVanBron(src, data);
      if (stop) return;
      const pdf = await getDocument({
        data: bytes,
        disableAutoFetch: true,
        disableStream: true
      }).promise;
      pdfDoc = pdf;
      if (stop) {
        await pdf.destroy();
        return;
      }
      const maxWidth = Math.max(320, host.clientWidth || 800);
      const pixelRatio = window.devicePixelRatio || 1;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        if (stop) return;
        const basis = page.getViewport({ scale: 1 });
        const schaal = Math.min(2.2, (maxWidth - 8) / basis.width);
        const viewport = page.getViewport({ scale: schaal * pixelRatio });
        const canvas = document.createElement("canvas");
        canvas.className = "bestand-viewer-pdf-pagina";
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width / pixelRatio)}px`;
        canvas.setAttribute("aria-label", `Pagina ${n} van ${pdf.numPages}`);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (stop) return;
        host.appendChild(canvas);
      }
      if (!host.childElementCount) throw new Error("PDF heeft geen zichtbare pagina's.");
      setPdfjsOk(true);
      setLaden(false);
    };

    void run().catch((err) => {
      if (stop) return;
      setPdfjsOk(false);
      setFout(err instanceof Error ? err.message : "PDF-weergave via canvas mislukt.");
      setLaden(false);
    });

    return () => {
      stop = true;
      void pdfDoc?.destroy();
    };
  }, [src, data]);

  return (
    <div className="bestand-viewer-pdf-scroll">
      {laden && !pdfjsOk && <p className="bestand-viewer-status">PDF laden…</p>}
      <div ref={hostRef} className="bestand-viewer-pdf-paginas" hidden={!pdfjsOk} />
      {!pdfjsOk && src && (
        <iframe className="bestand-viewer-pdf" title="PDF-document" src={src} />
      )}
      {fout && !pdfjsOk && (
        <p className="bestand-viewer-status muted">
          Als de pagina leeg blijft, gebruik Openen in Chrome.
        </p>
      )}
    </div>
  );
}
