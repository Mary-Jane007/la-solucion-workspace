import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

export function PdfPaginas({ src }: { src: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let stop = false;
    let pdfDoc: { destroy: () => Promise<unknown> } | null = null;

    const run = async () => {
      setLaden(true);
      setFout(null);
      host.replaceChildren();
      const data = await fetch(src).then((res) => {
        if (!res.ok) throw new Error("PDF ophalen mislukt.");
        return res.arrayBuffer();
      });
      if (stop) return;
      const pdf = await getDocument({ data, disableAutoFetch: true, disableStream: true }).promise;
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
      setLaden(false);
    };

    void run().catch((err) => {
      if (stop) return;
      setFout(err instanceof Error ? err.message : "Deze PDF kan hier niet worden getoond.");
      setLaden(false);
    });

    return () => {
      stop = true;
      void pdfDoc?.destroy();
    };
  }, [src]);

  return (
    <div className="bestand-viewer-pdf-scroll">
      {laden && <p className="bestand-viewer-status">PDF laden…</p>}
      {fout && (
        <p className="bestand-viewer-status">
          {fout} Gebruik Openen in Chrome als de pagina hier leeg blijft.
        </p>
      )}
      <div ref={hostRef} className="bestand-viewer-pdf-paginas" />
    </div>
  );
}
