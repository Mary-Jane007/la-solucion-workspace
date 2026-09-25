const MIME_PER_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf"
};

export function normaliseerMime(mime?: string | null): string {
  return String(mime || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
}

export function mimeUitBestandsnaam(naam: string): string {
  const ext = (String(naam || "").match(/\.([a-z0-9]{1,8})$/i) || [])[1];
  return ext ? MIME_PER_EXT[ext.toLowerCase()] || "" : "";
}

export function mimeVanBestand(naam: string, mime?: string | null): string {
  const genormaliseerd = normaliseerMime(mime);
  if (genormaliseerd.startsWith("image/") || genormaliseerd === "application/pdf") {
    return genormaliseerd;
  }
  return mimeUitBestandsnaam(naam);
}

export function isAfbeeldingBestand(naam: string, mime?: string | null): boolean {
  const gevonden = mimeVanBestand(naam, mime);
  if (gevonden.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(naam);
}

export function isPdfBestand(naam: string, mime?: string | null): boolean {
  return mimeVanBestand(naam, mime) === "application/pdf" || /\.pdf$/i.test(naam);
}

export function isBekijkbaarBestand(naam: string, mime?: string | null): boolean {
  if (isAfbeeldingBestand(naam, mime) || isPdfBestand(naam, mime)) return true;
  const genormaliseerd = normaliseerMime(mime);
  if (genormaliseerd && genormaliseerd !== "application/octet-stream") return false;
  return !/\.(docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i.test(naam);
}

function mimeUitMagic(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  return "";
}

export async function normaliseerBestandBlob(
  blob: Blob,
  naam = "",
  mime?: string | null
): Promise<Blob> {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const type = mimeUitMagic(header) || mimeVanBestand(naam, mime || blob.type) || blob.type;
  if (type && type !== blob.type) {
    return new Blob([blob], { type });
  }
  return blob;
}
