const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { z } = require("zod");
const { pool, query } = require("./db");
const {
  listFinancielePosten,
  normalizeValuta,
  normalizeBetalingswijze,
  normalizeWisselkoers,
  normalizeGebruikingen
} = require("./financieStore");
const { listInzendingen } = require("./financieInzendingStore");

const BACKUP_KIND = "la-solucion-financieel-backup";
const BACKUP_VERSION = 1;
const AFSLUITING_SETTINGS_KEY = "financieel-afsluitingen";
const VALUTA_SETTINGS_KEY = "financieel-standaard-valuta";
const MAX_DECODED_FILE_BYTES = 12 * 1024 * 1024;

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9._:-]+$/, "Ongeldig id in backup.");

const gebruikSchema = z.object({
  id: z.string().optional(),
  datum: z.string().min(8),
  soort: z.enum(["AF", "ERBIJ"]),
  bedrag: z.number().finite().positive(),
  waaraan: z.string().optional().nullable(),
  bank: z.string().optional().nullable(),
  medewerker: z.string().optional().nullable(),
  doelValuta: z.enum(["EUR", "USD", "SRD", "XCG", ""]).optional().nullable(),
  wisselkoers: z.number().finite().positive().optional().nullable(),
  doelBedrag: z.number().finite().positive().optional().nullable(),
  klantNaam: z.string().optional().nullable(),
  heeftSaldo: z.enum(["JA", "NEE", ""]).optional().nullable(),
  saldoBedrag: z.number().finite().nonnegative().optional().nullable(),
  toelichting: z.string().optional().nullable()
});

const postSchema = z.object({
  id: idSchema,
  datum: z.string().min(10),
  type: z.enum(["INKOMST", "UITGAVE", "KASGELD", "OVERDRACHT"]),
  omschrijving: z.string().min(1),
  bedrag: z.number().finite().nonnegative(),
  valuta: z.enum(["EUR", "USD", "SRD", "XCG"]).optional().nullable(),
  categorie: z.string().optional().nullable(),
  referentie: z.string().optional().nullable(),
  klantNaam: z.string().optional().nullable(),
  opdrachtId: z.string().optional().nullable(),
  afgehandeldDoorUserId: z.string().optional().nullable(),
  afgehandeldDoorNaam: z.string().optional().nullable(),
  betalingswijze: z.enum(["OPGEHAALD", "PINPAS", "OVERGEMAAKT", "GESTORT"]).optional().nullable(),
  bank: z.string().optional().nullable(),
  geldBijUserId: z.string().optional().nullable(),
  geldBijNaam: z.string().optional().nullable(),
  geldVanUserId: z.string().optional().nullable(),
  geldVanNaam: z.string().optional().nullable(),
  wisselkoers: z.number().finite().nonnegative().optional().nullable(),
  status: z.enum(["OPEN", "BETAALD"]),
  notities: z.string().optional().nullable(),
  gebruikingen: z.array(gebruikSchema).optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable()
});

const inzendingSchema = z.object({
  id: idSchema,
  createdAt: z.string().optional().nullable(),
  vanUserId: z.string().min(1).max(80),
  vanNaam: z.string().min(1).max(200),
  datum: z.string().min(10),
  type: z.enum(["INKOMST", "UITGAVE", "KASGELD", "OVERDRACHT"]),
  omschrijving: z.string().min(1),
  bedrag: z.number().finite().nonnegative(),
  valuta: z.enum(["EUR", "USD", "SRD", "XCG"]).optional().nullable(),
  wisselkoers: z.number().finite().nonnegative().optional().nullable(),
  categorie: z.string().optional().nullable(),
  referentie: z.string().optional().nullable(),
  klantNaam: z.string().optional().nullable(),
  betalingswijze: z.enum(["OPGEHAALD", "PINPAS", "OVERGEMAAKT", "GESTORT"]).optional().nullable(),
  bank: z.string().optional().nullable(),
  geldBijNaam: z.string().optional().nullable(),
  geldVanNaam: z.string().optional().nullable(),
  waaraan: z.string().optional().nullable(),
  notities: z.string().optional().nullable(),
  status: z.enum(["NIEUW", "GEZIEN", "VERWERKT"]).optional().nullable()
});

const bijlageSchema = z.object({
  id: idSchema,
  postId: z.string().optional(),
  inzendingId: z.string().optional(),
  origineleNaam: z.string().min(1).max(300),
  mimeType: z.string().max(120).optional().nullable(),
  grootte: z.number().finite().nonnegative().optional().nullable(),
  inhoudBase64: z.string().optional().nullable(),
  ontbreekt: z.boolean().optional()
});

const afsluitingSchema = z.object({
  id: z.string().min(1).max(160),
  type: z.enum(["dag", "maand"]),
  periodeLabel: z.string().max(200),
  opgeslagenOp: z.string().max(40),
  valuta: z.enum(["EUR", "USD", "SRD", "XCG"]),
  beginsaldo: z.number().finite(),
  inkomsten: z.number().finite(),
  uitgaven: z.number().finite(),
  netto: z.number().finite(),
  openstaand: z.number().finite(),
  eindbalans: z.number().finite(),
  transacties: z.number().finite(),
  winstmarge: z.number().finite().nullable().optional()
});

const backupSchema = z.object({
  kind: z.literal(BACKUP_KIND),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  posten: z.array(postSchema).max(8000),
  postBijlagen: z.array(bijlageSchema).max(4000).optional().default([]),
  inzendingen: z.array(inzendingSchema).max(8000).optional().default([]),
  inzendingBijlagen: z.array(bijlageSchema).max(4000).optional().default([]),
  afsluitingen: z.array(afsluitingSchema).max(120).optional().default([]),
  instellingen: z
    .object({
      standaardValuta: z.enum(["EUR", "USD", "SRD", "XCG"]).optional()
    })
    .optional()
    .nullable()
});

function isoOrNow(waarde) {
  if (!waarde) return new Date().toISOString();
  const d = new Date(waarde);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function extFromName(naam, mime) {
  const ext = path.extname(String(naam || "")).slice(0, 10);
  if (ext && /^\.[a-zA-Z0-9]+$/.test(ext)) return ext.toLowerCase();
  const m = String(mime || "").toLowerCase();
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "image/heic" || m === "image/heif") return ".heic";
  if (m === "application/pdf") return ".pdf";
  return ".jpg";
}

function decodeBase64File(inhoudBase64) {
  const raw = String(inhoudBase64 || "").replace(/\s/g, "");
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (!buf.length) return null;
  if (buf.length > MAX_DECODED_FILE_BYTES) {
    throw new Error("Een bijlage in het backupbestand is te groot om terug te zetten.");
  }
  return buf;
}

async function readSetting(key) {
  const res = await query("select value from app_settings where key=$1 limit 1", [key]);
  return String(res.rows[0]?.value || "").trim();
}

async function writeSetting(clientOrQuery, key, value) {
  const run = clientOrQuery.query.bind(clientOrQuery);
  await run(
    `
    insert into app_settings (key, value, updated_at)
    values ($1, $2, now())
    on conflict (key) do update
    set value = excluded.value, updated_at = now()
    `,
    [key, value]
  );
}

async function loadAfsluitingenFromSettings() {
  try {
    const raw = await readSetting(AFSLUITING_SETTINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadInstellingenFromSettings() {
  const valuta = await readSetting(VALUTA_SETTINGS_KEY);
  return {
    standaardValuta: ["EUR", "USD", "SRD", "XCG"].includes(valuta) ? valuta : undefined
  };
}

async function listOpslagNamen(tabel) {
  const res = await query(`select opslag_naam as "opslagNaam" from ${tabel}`, []);
  return res.rows.map((r) => r.opslagNaam).filter(Boolean);
}

async function encodeTabelBijlagen(tabel, parentKey, uploadDir) {
  const parentCol = parentKey === "postId" ? "post_id" : "inzending_id";
  const res = await query(
    `
    select
      id,
      ${parentCol} as "parentId",
      originele_naam as "origineleNaam",
      mime_type as "mimeType",
      grootte,
      opslag_naam as "opslagNaam"
    from ${tabel}
    order by created_at asc
    `,
    []
  );
  return res.rows.map((row) => {
    const filePath = path.join(uploadDir, row.opslagNaam);
    let inhoudBase64 = "";
    let ontbreekt = false;
    try {
      if (fs.existsSync(filePath)) {
        inhoudBase64 = fs.readFileSync(filePath).toString("base64");
      } else {
        ontbreekt = true;
      }
    } catch {
      ontbreekt = true;
    }
    const item = {
      id: row.id,
      origineleNaam: row.origineleNaam,
      mimeType: row.mimeType,
      grootte: Number(row.grootte) || 0,
      inhoudBase64,
      ontbreekt
    };
    item[parentKey] = row.parentId;
    return item;
  });
}

function backupPost(post) {
  const { bijlagen: _bijlagen, ...rest } = post;
  return rest;
}

function backupInzending(item) {
  const { bijlagen: _bijlagen, ...rest } = item;
  return rest;
}

async function buildBackup(uploadDir) {
  const [posten, inzendingen, postBijlagen, inzendingBijlagen, afsluitingen, instellingen] =
    await Promise.all([
      listFinancielePosten(),
      listInzendingen(),
      encodeTabelBijlagen("financiele_post_bestanden", "postId", uploadDir),
      encodeTabelBijlagen("financiele_inzending_bestanden", "inzendingId", uploadDir),
      loadAfsluitingenFromSettings(),
      loadInstellingenFromSettings()
    ]);
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    posten: posten.map(backupPost),
    postBijlagen,
    inzendingen: inzendingen.map(backupInzending),
    inzendingBijlagen,
    afsluitingen,
    instellingen
  };
}

function schrijfNieuweBestanden(bijlagen, parentKey, bekendeIds, uploadDir) {
  const geschreven = [];
  for (const bijlage of bijlagen || []) {
    const parentId = String(bijlage[parentKey] || "").trim();
    if (!parentId || !bekendeIds.has(parentId)) continue;
    const buf = decodeBase64File(bijlage.inhoudBase64);
    if (!buf) continue;
    const opslagNaam = `${uuidv4()}${extFromName(bijlage.origineleNaam, bijlage.mimeType)}`;
    const filePath = path.join(uploadDir, opslagNaam);
    fs.writeFileSync(filePath, buf);
    geschreven.push({
      id: bijlage.id,
      parentId,
      origineleNaam: bijlage.origineleNaam,
      mimeType: bijlage.mimeType || "application/octet-stream",
      grootte: buf.length,
      opslagNaam,
      filePath
    });
  }
  return geschreven;
}

function verwijderBestanden(filePaths) {
  for (const filePath of filePaths) {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

async function insertPost(client, input) {
  const id = input.id;
  const gebruikingen = JSON.stringify(normalizeGebruikingen(input.gebruikingen));
  const status =
    input.type === "OVERDRACHT" || input.type === "KASGELD" ? "BETAALD" : input.status;
  await client.query(
    `
    insert into financiele_posten
      (id, datum, type, omschrijving, bedrag, valuta, wisselkoers, categorie, referentie, klant_naam, opdracht_id,
       afgehandeld_door_user_id, afgehandeld_door_naam, betalingswijze, bank,
       geld_bij_user_id, geld_bij_naam, geld_van_user_id, geld_van_naam, status, notities, gebruikingen,
       created_at, updated_at)
    values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$24)
    `,
    [
      id,
      input.datum,
      input.type,
      input.omschrijving,
      input.bedrag,
      normalizeValuta(input.valuta),
      normalizeWisselkoers(input.wisselkoers),
      input.categorie || "",
      input.referentie || "",
      input.klantNaam || "",
      input.opdrachtId || null,
      input.afgehandeldDoorUserId || null,
      input.afgehandeldDoorNaam || "",
      normalizeBetalingswijze(input.betalingswijze),
      input.bank || "",
      input.geldBijUserId || null,
      input.geldBijNaam || "",
      input.geldVanUserId || null,
      input.geldVanNaam || "",
      status,
      input.notities || "",
      gebruikingen,
      isoOrNow(input.createdAt),
      isoOrNow(input.updatedAt)
    ]
  );
}

async function insertInzending(client, input) {
  await client.query(
    `
    insert into financiele_inzendingen (
      id, created_at, van_user_id, van_naam, datum, type, omschrijving, bedrag, valuta, wisselkoers,
      categorie, referentie, klant_naam, betalingswijze, bank, geld_bij_naam, geld_van_naam,
      waaraan, notities, status
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    `,
    [
      input.id,
      isoOrNow(input.createdAt),
      input.vanUserId,
      input.vanNaam,
      input.datum,
      input.type,
      input.omschrijving,
      input.bedrag,
      normalizeValuta(input.valuta),
      input.wisselkoers ?? null,
      input.categorie || "",
      input.referentie || "",
      input.klantNaam || "",
      normalizeBetalingswijze(input.betalingswijze),
      input.bank || "",
      input.geldBijNaam || "",
      input.geldVanNaam || "",
      input.waaraan || "",
      input.notities || "",
      ["NIEUW", "GEZIEN", "VERWERKT"].includes(input.status) ? input.status : "NIEUW"
    ]
  );
}

async function restoreBackup(payload, uploadDir) {
  if (!pool) throw new Error("Database niet geconfigureerd.");
  const parsed = backupSchema.parse(payload);
  const postIds = new Set(parsed.posten.map((p) => p.id));
  const inzendingIds = new Set(parsed.inzendingen.map((p) => p.id));

  const oudePostBestanden = await listOpslagNamen("financiele_post_bestanden");
  const oudeInzendingBestanden = await listOpslagNamen("financiele_inzending_bestanden");

  const nieuwePostBestanden = schrijfNieuweBestanden(
    parsed.postBijlagen,
    "postId",
    postIds,
    uploadDir
  );
  const nieuweInzendingBestanden = schrijfNieuweBestanden(
    parsed.inzendingBijlagen,
    "inzendingId",
    inzendingIds,
    uploadDir
  );
  const nieuwePaden = [...nieuwePostBestanden, ...nieuweInzendingBestanden].map((f) => f.filePath);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from financiele_posten");
    await client.query("delete from financiele_inzendingen");
    for (const post of parsed.posten) {
      await insertPost(client, post);
    }
    for (const inzending of parsed.inzendingen) {
      await insertInzending(client, inzending);
    }
    for (const bestand of nieuwePostBestanden) {
      await client.query(
        `
        insert into financiele_post_bestanden
          (id, post_id, originele_naam, opslag_naam, mime_type, grootte)
        values ($1,$2,$3,$4,$5,$6)
        `,
        [
          bestand.id,
          bestand.parentId,
          bestand.origineleNaam,
          bestand.opslagNaam,
          bestand.mimeType,
          bestand.grootte
        ]
      );
    }
    for (const bestand of nieuweInzendingBestanden) {
      await client.query(
        `
        insert into financiele_inzending_bestanden
          (id, inzending_id, originele_naam, opslag_naam, mime_type, grootte)
        values ($1,$2,$3,$4,$5,$6)
        `,
        [
          bestand.id,
          bestand.parentId,
          bestand.origineleNaam,
          bestand.opslagNaam,
          bestand.mimeType,
          bestand.grootte
        ]
      );
    }
    await writeSetting(client, AFSLUITING_SETTINGS_KEY, JSON.stringify(parsed.afsluitingen.slice(0, 120)));
    const valuta = parsed.instellingen?.standaardValuta;
    if (valuta) await writeSetting(client, VALUTA_SETTINGS_KEY, valuta);
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    verwijderBestanden(nieuwePaden);
    throw err;
  } finally {
    client.release();
  }

  verwijderBestanden(
    [...oudePostBestanden, ...oudeInzendingBestanden].map((naam) => path.join(uploadDir, naam))
  );

  return {
    posten: parsed.posten.length,
    postBijlagen: nieuwePostBestanden.length,
    inzendingen: parsed.inzendingen.length,
    inzendingBijlagen: nieuweInzendingBestanden.length,
    afsluitingen: parsed.afsluitingen,
    instellingen: parsed.instellingen || {}
  };
}

function parseBackupError(err) {
  if (err instanceof z.ZodError) {
    return {
      status: 400,
      message: err.issues.map((i) => i.message).join(" ") || "Ongeldig backupbestand."
    };
  }
  const message = err instanceof Error ? err.message : "Terugzetten mislukt.";
  if (/backupbestand|bijlage|Ongeldig id|too large|te groot/i.test(message)) {
    return { status: 400, message };
  }
  return { status: 500, message: "Terugzetten mislukt." };
}

module.exports = {
  BACKUP_KIND,
  BACKUP_VERSION,
  buildBackup,
  restoreBackup,
  parseBackupError,
  backupSchema
};
