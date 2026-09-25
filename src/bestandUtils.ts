export function isAfbeeldingBestand(naam: string, mime?: string | null): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(naam);
}

export function isPdfBestand(naam: string, mime?: string | null): boolean {
  if (mime === "application/pdf") return true;
  return /\.pdf$/i.test(naam);
}

export function isBekijkbaarBestand(naam: string, mime?: string | null): boolean {
  return isAfbeeldingBestand(naam, mime) || isPdfBestand(naam, mime);
}
