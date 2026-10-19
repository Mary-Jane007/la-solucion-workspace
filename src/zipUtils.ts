const CRC_TABEL = (() => {
  const tabel = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[i] = c >>> 0;
  }
  return tabel;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABEL[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(waarde: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = waarde & 0xff;
  buf[1] = (waarde >>> 8) & 0xff;
  return buf;
}

function u32(waarde: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = waarde & 0xff;
  buf[1] = (waarde >>> 8) & 0xff;
  buf[2] = (waarde >>> 16) & 0xff;
  buf[3] = (waarde >>> 24) & 0xff;
  return buf;
}

function concat(delen: Uint8Array[]): Uint8Array {
  const totaal = delen.reduce((n, deel) => n + deel.length, 0);
  const uit = new Uint8Array(totaal);
  let offset = 0;
  for (const deel of delen) {
    uit.set(deel, offset);
    offset += deel.length;
  }
  return uit;
}

export function veiligeDownloadNaam(naam: string, fallback = "document"): string {
  return String(naam || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || fallback;
}

export function uniekeZipNamen(namen: string[]): string[] {
  const gebruikt = new Map<string, number>();
  return namen.map((ruw) => {
    const naam = veiligeDownloadNaam(ruw);
    const sleutel = naam.toLowerCase();
    const n = gebruikt.get(sleutel) || 0;
    gebruikt.set(sleutel, n + 1);
    if (n === 0) return naam;
    const punt = naam.lastIndexOf(".");
    if (punt > 0) return `${naam.slice(0, punt)} (${n + 1})${naam.slice(punt)}`;
    return `${naam} (${n + 1})`;
  });
}

export async function maakZipBlob(bestanden: Array<{ naam: string; data: Blob | ArrayBuffer | Uint8Array }>): Promise<Blob> {
  const encoder = new TextEncoder();
  const lokale: Uint8Array[] = [];
  const centraal: Uint8Array[] = [];
  let offset = 0;
  const namen = uniekeZipNamen(bestanden.map((b) => b.naam));

  for (let i = 0; i < bestanden.length; i++) {
    const bron = bestanden[i].data;
    const bytes =
      bron instanceof Uint8Array
        ? bron
        : bron instanceof ArrayBuffer
          ? new Uint8Array(bron)
          : new Uint8Array(await bron.arrayBuffer());
    const naamBytes = encoder.encode(namen[i]);
    const crc = crc32(bytes);
    const vlag = 0x0800;
    const lokaleHeader = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(vlag),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(bytes.length),
      u32(bytes.length),
      u16(naamBytes.length),
      u16(0),
      naamBytes
    ]);
    lokale.push(lokaleHeader, bytes);
    centraal.push(
      concat([
        new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
        u16(20),
        u16(20),
        u16(vlag),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(bytes.length),
        u32(bytes.length),
        u16(naamBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        naamBytes
      ])
    );
    offset += lokaleHeader.length + bytes.length;
  }

  const centraleMap = concat(centraal);
  const eocd = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(bestanden.length),
    u16(bestanden.length),
    u32(centraleMap.length),
    u32(offset),
    u16(0)
  ]);
  return new Blob([concat([...lokale, centraleMap, eocd])], { type: "application/zip" });
}

export function startBestandDownload(blob: Blob, bestandsnaam: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = veiligeDownloadNaam(bestandsnaam);
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}
