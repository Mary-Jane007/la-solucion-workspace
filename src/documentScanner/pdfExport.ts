import { jsPDF } from "jspdf";
import type { ScanPage } from "./types";
import { canvasFromDataUrl } from "./perspectiveTransform";
import { canvasToDataUrl } from "./imageUtils";

export async function maakPdfUitPaginas(paginas: ScanPage[]): Promise<{ blob: Blob; dataUrl: string }> {
  if (!paginas.length) throw new Error("Geen pagina's om te exporteren.");

  let pdf: jsPDF | null = null;

  for (let i = 0; i < paginas.length; i++) {
    const canvas = await canvasFromDataUrl(paginas[i].processedDataUrl);
    const imgData = canvasToDataUrl(canvas, 0.92);
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    const wMm = orientation === "landscape" ? 297 : 210;
    const hMm = orientation === "landscape" ? 210 : 297;

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
    } else {
      pdf.addPage("a4", orientation);
    }

    pdf.addImage(imgData, "JPEG", 0, 0, wMm, hMm, undefined, "FAST");
  }

  if (!pdf) throw new Error("PDF kon niet worden gemaakt.");

  const blob = pdf.output("blob");
  const dataUrl = pdf.output("datauristring");
  return { blob, dataUrl };
}

export function pdfBlobNaarFile(blob: Blob, naam: string): File {
  return new File([blob], naam.endsWith(".pdf") ? naam : `${naam}.pdf`, {
    type: "application/pdf",
    lastModified: Date.now()
  });
}

export async function downloadPdf(blob: Blob, naam: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = naam.endsWith(".pdf") ? naam : `${naam}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deelPdf(blob: Blob, naam: string): Promise<boolean> {
  const file = pdfBlobNaarFile(blob, naam);
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: naam });
    return true;
  }
  return false;
}
