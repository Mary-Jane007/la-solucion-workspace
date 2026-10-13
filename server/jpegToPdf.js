function jpegSofAt(buf, i) {
  const marker = buf[i + 1];
  return marker === 0xc0 || marker === 0xc1 || marker === 0xc2;
}

function walkJpegMarkers(buf, onSof) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (jpegSofAt(buf, i)) {
      const result = onSof(i, marker);
      if (result) return result;
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 3 >= buf.length) break;
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function jpegSize(buf) {
  return walkJpegMarkers(buf, (i) => ({
    h: buf.readUInt16BE(i + 5),
    w: buf.readUInt16BE(i + 7),
    components: buf[i + 9]
  }));
}

function jpegSofMarker(buf) {
  return walkJpegMarkers(buf, (_i, marker) => marker);
}

function jpegColorSpace(components) {
  if (components === 1) return "/DeviceGray";
  if (components === 4) return "/DeviceCMYK";
  return "/DeviceRGB";
}

function jpegToPdf(jpeg) {
  const dim = jpegSize(jpeg);
  if (!dim || !dim.w || !dim.h) throw new Error("JPEG-afmeting onleesbaar");
  const maxW = 595;
  const maxH = 842;
  const scale = Math.min(maxW / dim.w, maxH / dim.h, 1);
  const dw = Math.max(1, Math.round(dim.w * scale));
  const dh = Math.max(1, Math.round(dim.h * scale));
  const color = jpegColorSpace(dim.components);

  const content = `q\n${dw} 0 0 ${dh} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBuf = Buffer.from(content, "ascii");

  const objs = [];
  const add = (body) => {
    objs.push(Buffer.isBuffer(body) ? body : Buffer.from(body, "ascii"));
    return objs.length;
  };

  add("<< /Type /Catalog /Pages 2 0 R >>\n");
  add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${dw} ${dh}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n`
  );
  add(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${dim.w} /Height ${dim.h} /ColorSpace ${color} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        "ascii"
      ),
      jpeg,
      Buffer.from("\nendstream\n", "ascii")
    ])
  );
  add(
    Buffer.concat([
      Buffer.from(`<< /Length ${contentBuf.length} >>\nstream\n`, "ascii"),
      contentBuf,
      Buffer.from("endstream\n", "ascii")
    ])
  );

  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
  const chunks = [header];
  const offsets = [0];
  let pos = header.length;
  for (let i = 0; i < objs.length; i += 1) {
    offsets.push(pos);
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "ascii"), objs[i], Buffer.from("endobj\n", "ascii")]);
    chunks.push(obj);
    pos += obj.length;
  }
  const xrefStart = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, "ascii"));
  return Buffer.concat(chunks);
}

function extractJpegFromPdf(buf) {
  if (!buf || buf.length < 8) return null;
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) return null;
  const marker = Buffer.from("/Length ");
  const streamMarker = Buffer.from("stream\n");
  let searchFrom = 0;
  while (searchFrom < buf.length) {
    const lengthAt = buf.indexOf(marker, searchFrom);
    const streamAt = buf.indexOf(streamMarker, searchFrom);
    if (lengthAt < 0 || streamAt < 0) return null;
    if (lengthAt > streamAt) {
      searchFrom = streamAt + streamMarker.length;
      continue;
    }
    let nStart = lengthAt + marker.length;
    while (nStart < buf.length && buf[nStart] === 0x20) nStart += 1;
    let nEnd = nStart;
    while (nEnd < buf.length && buf[nEnd] >= 0x30 && buf[nEnd] <= 0x39) nEnd += 1;
    const jpegLen = Number(buf.slice(nStart, nEnd).toString("ascii"));
    const jpegStart = streamAt + streamMarker.length;
    if (!jpegLen || jpegStart + jpegLen > buf.length) {
      searchFrom = streamAt + streamMarker.length;
      continue;
    }
    const jpeg = buf.slice(jpegStart, jpegStart + jpegLen);
    if (jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg[2] === 0xff) return jpeg;
    searchFrom = streamAt + streamMarker.length;
  }
  return null;
}

function isJpeg(buf) {
  return Boolean(buf && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff);
}

function looksLikePdfNaam(naam, mime) {
  return /\.pdf$/i.test(String(naam || "")) || String(mime || "").toLowerCase().includes("pdf");
}

/**
 * JPEG bytes stored as .pdf cannot be opened by Chrome's PDF viewer.
 * Wrap baseline JPEGs as PDF; progressive JPEGs are served as images instead.
 */
function herstelJpegPdfVoorWeergave(origineleNaam, mimeType, buffer) {
  if (!buffer || !looksLikePdfNaam(origineleNaam, mimeType) || !isJpeg(buffer)) {
    return null;
  }
  if (jpegSofMarker(buffer) === 0xc2) {
    const naam = String(origineleNaam || "document.pdf").replace(/\.pdf$/i, ".jpg");
    return { buffer, naam, mime: "image/jpeg" };
  }
  try {
    return { buffer: jpegToPdf(buffer), naam: origineleNaam, mime: "application/pdf" };
  } catch {
    const naam = String(origineleNaam || "document.pdf").replace(/\.pdf$/i, ".jpg");
    return { buffer, naam, mime: "image/jpeg" };
  }
}

module.exports = {
  jpegToPdf,
  jpegSize,
  jpegSofMarker,
  extractJpegFromPdf,
  herstelJpegPdfVoorWeergave,
  isJpeg
};
