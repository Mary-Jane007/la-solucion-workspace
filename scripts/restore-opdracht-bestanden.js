require("dotenv").config();
const fs = require("fs");
const os = require("os");
const path = require("path");
const { query } = require("../server/db");
const { saveBestandInhoud, getBestandInhoudById } = require("../server/bestandenStore");

const legacyUploadDir = path.join(__dirname, "..", "server", "uploads");
const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), "la-solucion-uploads")
  : path.join(process.env.LOCALAPPDATA || os.homedir(), "la-solucion", "uploads");

function uploadDirs() {
  return [...new Set([uploadDir, legacyUploadDir].filter(Boolean))];
}

function schijfPadVoor(opslagNaam) {
  const safe = path.basename(String(opslagNaam || ""));
  if (!safe || safe === "." || safe === "..") return [];
  return uploadDirs().map((dir) => path.join(dir, safe));
}

function leesVanSchijf(opslagNaam) {
  for (const filePath of schijfPadVoor(opslagNaam)) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const buffer = fs.readFileSync(filePath);
      if (buffer.length) return { filePath, buffer };
    } catch {
      /* volgende pad */
    }
  }
  return null;
}

function schrijfNaarSchijf(opslagNaam, buffer) {
  if (!buffer?.length) return false;
  const doel = schijfPadVoor(opslagNaam)[0];
  if (!doel) return false;
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, buffer);
  return true;
}

function listWeesbestanden(bekendeNamen) {
  const files = [];
  for (const dir of uploadDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const naam of fs.readdirSync(dir)) {
      if (naam.startsWith(".")) continue;
      if (bekendeNamen.has(naam)) continue;
      const full = path.join(dir, naam);
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (!st.isFile() || !st.size) continue;
      files.push({ naam, full, size: st.size });
    }
  }
  return files;
}

function uniekeGrootteMap(weesbestanden) {
  const map = new Map();
  for (const file of weesbestanden) {
    if (map.has(file.size)) map.set(file.size, null);
    else map.set(file.size, file);
  }
  return map;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const { rows } = await query(
    `
    select
      id,
      opslag_naam as "opslagNaam",
      originele_naam as "origineleNaam",
      grootte,
      inhoud is not null and octet_length(inhoud) > 0 as "heeftInhoud",
      octet_length(inhoud) as "inhoudLen"
    from bestanden
    order by created_at asc
    `
  );

  const diskNames = new Set();
  for (const dir of uploadDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const naam of fs.readdirSync(dir)) {
      if (naam.startsWith(".")) continue;
      diskNames.add(naam);
    }
  }

  const bekendeNamen = new Set(rows.map((r) => path.basename(r.opslagNaam)));
  const weesbestanden = listWeesbestanden(bekendeNamen);
  const weesOpGrootte = uniekeGrootteMap(weesbestanden);
  const gebruiktWees = new Set();

  const stats = {
    totaal: rows.length,
    schijfBestanden: diskNames.size,
    opSchijf: 0,
    inDb: 0,
    hersteldNaarDb: 0,
    hersteldNaarSchijf: 0,
    hersteldViaGrootte: 0,
    ontbreektOveral: 0
  };
  const ontbreekt = [];

  for (const rij of rows) {
    let vanSchijf = leesVanSchijf(rij.opslagNaam);
    if (vanSchijf) stats.opSchijf += 1;
    if (rij.heeftInhoud) stats.inDb += 1;

    if (!vanSchijf && !rij.heeftInhoud) {
      const kandidaat = weesOpGrootte.get(rij.grootte);
      if (kandidaat && !gebruiktWees.has(kandidaat.full)) {
        try {
          const buffer = fs.readFileSync(kandidaat.full);
          if (buffer.length) {
            vanSchijf = { filePath: kandidaat.full, buffer };
            gebruiktWees.add(kandidaat.full);
            if (!dry) {
              schrijfNaarSchijf(rij.opslagNaam, buffer);
              await saveBestandInhoud(rij.id, buffer);
            }
            stats.hersteldViaGrootte += 1;
            continue;
          }
        } catch {
          /* volgende rij */
        }
      }
    }

    if (vanSchijf && !rij.heeftInhoud) {
      if (!dry) await saveBestandInhoud(rij.id, vanSchijf.buffer);
      stats.hersteldNaarDb += 1;
      continue;
    }

    if (!vanSchijf && rij.heeftInhoud) {
      if (!dry) {
        const inhoud = await getBestandInhoudById(rij.id);
        if (inhoud) schrijfNaarSchijf(rij.opslagNaam, inhoud);
      }
      stats.hersteldNaarSchijf += 1;
      continue;
    }

    if (!vanSchijf && !rij.heeftInhoud) {
      stats.ontbreektOveral += 1;
      if (ontbreekt.length < 12) ontbreekt.push(rij.origineleNaam || rij.opslagNaam);
    }
  }

  const gekoppeld = rows.filter((r) => diskNames.has(path.basename(r.opslagNaam))).length;
  console.log(
    JSON.stringify(
      {
        dry,
        uploadDir,
        ...stats,
        weesbestanden: weesbestanden.length,
        schijfNamenGekoppeldAanDb: gekoppeld
      },
      null,
      2
    )
  );
  if (ontbreekt.length) {
    console.log("Voorbeelden zonder schijf en zonder database-inhoud:", ontbreekt.join(" | "));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Herstel mislukt:", err.message || err);
  process.exit(1);
});
