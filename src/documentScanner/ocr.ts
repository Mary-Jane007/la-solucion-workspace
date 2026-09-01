export async function herkenTekstUitCanvas(canvas: HTMLCanvasElement): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("nld");
    const {
      data: { text }
    } = await worker.recognize(canvas);
    await worker.terminate();
    return text.trim();
  } catch {
    return "";
  }
}
