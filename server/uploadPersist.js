const fs = require("fs");
const os = require("os");
const path = require("path");
const { query } = require("./db");

const TABELLEN = [
  { tabel: "bestanden", label: "opdrachten" },
  { tabel: "financiele_post_bestanden", label: "financiën" },
  { tabel: "financiele_inzending_bestanden", label: "kasfoto's" }
];

const legacyUploadDir = path.join(__dirname, "uploads");
const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "la-solucion-uploads")
  : path.join(process.env.LOCALAPPDATA || os.homedir(), "la-solucion", "uploads");

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function uploadDirs() {
  return [...new Set([uploadDir, legacyUploadDir].filter(Boolean))];
}

function ensureUploadDir() {
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn("Kon uploadmap niet aanmaken:", err.message);
  }
  return uploadDir;
}

function schijfPadenVoor(opslagNaam) {
  const safe = path.basename(String(opslagNaam || ""));
  if (!safe || safe === "." || safe === "..") return [];
  return uploadDirs().map((dir) => path.join(dir, safe));
}

function naarBuffer(waarde) {
  if (!waarde) return null;
  if (Buffer.isBuffer(waarde)) return waarde.length ? waarde : null;
  if (waarde instanceof Uint8Array) return waarde.length ? Buffer.from(waarde) : null;
  try {
    const buf = Buffer.from(waarde);
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

function leesVanSchijf(opslagNaam) {
  for (const filePath of schijfPadenVoor(opslagNaam)) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const buffer = fs.readFileSync(filePath);
      if (buffer.length) return buffer;
    } catch (err) {
      console.warn("Kon bestand niet van schijf lezen:", filePath, err.message);
    }
  }
  return null;
}

function schrijfNaarSchijf(opslagNaam, buffer) {
  const body = naarBuffer(buffer);
  if (!body) return false;
  const doel = schijfPadenVoor(opslagNaam)[0];
  if (!doel) return false;
  try {
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    if (fs.existsSync(doel)) {
      try {
        if (fs.statSync(doel).size === body.length) return true;
      } catch {
        /* overschrijf hieronder */
      }
    }
    fs.writeFileSync(doel, body);
    return true;
  } catch (err) {
    console.warn("Kon upload niet op schijf zetten:", err.message);
    return false;
  }
}

function leesMulterBuffer(file) {
  if (!file) return null;
  const uitGeheugen = naarBuffer(file.buffer);
  if (uitGeheugen) return uitGeheugen;
  if (file.path && fs.existsSync(file.path)) {
    try {
      const vanPad = fs.readFileSync(file.path);
      return vanPad.length ? vanPad : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function getInhoudUitDb(tabel, id) {
  if (!hasDb() || !TABELLEN.some((t) => t.tabel === tabel)) return null;
  const res = await query(`select inhoud from ${tabel} where id = $1 limit 1`, [id]);
  return naarBuffer(res.rows[0]?.inhoud);
}

async function vulLegeInhoud(tabel, id, buffer) {
  if (!hasDb() || !TABELLEN.some((t) => t.tabel === tabel)) return;
  const body = naarBuffer(buffer);
  if (!body) return;
  await query(
    `update ${tabel} set inhoud = $2 where id = $1 and (inhoud is null or octet_length(inhoud) = 0)`,
    [id, body]
  );
}

async function laadBestandBuffer(tabel, id, opslagNaam) {
  const vanDb = await getInhoudUitDb(tabel, id);
  if (vanDb) {
    schrijfNaarSchijf(opslagNaam, vanDb);
    return vanDb;
  }
  const vanSchijf = leesVanSchijf(opslagNaam);
  if (vanSchijf) {
    await vulLegeInhoud(tabel, id, vanSchijf);
    return vanSchijf;
  }
  return null;
}

async function bewaarUpload({ tabel, id, opslagNaam, buffer }) {
  const body = naarBuffer(buffer);
  if (!body) return null;
  schrijfNaarSchijf(opslagNaam, body);
  await vulLegeInhoud(tabel, id, body);
  return body;
}

async function syncTabel(tabel, label) {
  const res = await query(
    `
    select
      id,
      opslag_naam as "opslagNaam",
      inhoud is not null and octet_length(inhoud) > 0 as "heeftInhoud"
    from ${tabel}
    `,
    []
  );
  let naarDb = 0;
  let naarSchijf = 0;
  let compleet = 0;
  for (const rij of res.rows) {
    const vanSchijf = leesVanSchijf(rij.opslagNaam);
    if (vanSchijf && !rij.heeftInhoud) {
      await vulLegeInhoud(tabel, rij.id, vanSchijf);
      naarDb += 1;
      continue;
    }
    if (!vanSchijf && rij.heeftInhoud) {
      const inhoud = await getInhoudUitDb(tabel, rij.id);
      if (inhoud && schrijfNaarSchijf(rij.opslagNaam, inhoud)) naarSchijf += 1;
      continue;
    }
    if (vanSchijf || rij.heeftInhoud) compleet += 1;
  }
  return { tabel: label, totaal: res.rows.length, naarDb, naarSchijf, compleet };
}

async function syncUploadsNaarDatabase() {
  if (!hasDb()) return;
  ensureUploadDir();
  const resultaten = [];
  for (const item of TABELLEN) {
    try {
      resultaten.push(await syncTabel(item.tabel, item.label));
    } catch (err) {
      console.warn(`Uploads ${item.label} bijwerken mislukt:`, err.message);
    }
  }
  const som = resultaten.reduce(
    (acc, r) => ({
      totaal: acc.totaal + r.totaal,
      naarDb: acc.naarDb + r.naarDb,
      naarSchijf: acc.naarSchijf + r.naarSchijf
    }),
    { totaal: 0, naarDb: 0, naarSchijf: 0 }
  );
  console.log(
    `Uploads bewaard in database: ${som.totaal} bestanden` +
      (som.naarDb || som.naarSchijf
        ? ` (nieuw in database: ${som.naarDb}, cache aangevuld: ${som.naarSchijf}).`
        : ".")
  );
  return resultaten;
}

module.exports = {
  uploadDir,
  legacyUploadDir,
  uploadDirs,
  ensureUploadDir,
  schijfPadenVoor,
  leesVanSchijf,
  schrijfNaarSchijf,
  leesMulterBuffer,
  naarBuffer,
  laadBestandBuffer,
  bewaarUpload,
  vulLegeInhoud,
  syncUploadsNaarDatabase
};
