const { v4: uuidv4 } = require("uuid");
const { query } = require("./db");

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function normalizeValuta(waarde) {
  const v = String(waarde || "EUR").toUpperCase();
  return ["EUR", "USD", "SRD", "XCG"].includes(v) ? v : "EUR";
}

function normalizeBetalingswijze(waarde) {
  const v = String(waarde || "").toUpperCase();
  return ["OPGEHAALD", "OVERGEMAAKT", "GESTORT"].includes(v) ? v : null;
}

function rowToInzending(row) {
  const datum =
    row.datum instanceof Date ? row.datum.toISOString() : row.datum ? String(row.datum) : null;
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at
        ? String(row.created_at)
        : null;
  const wisselkoers =
    row.wisselkoers === null || row.wisselkoers === undefined ? null : Number(row.wisselkoers);
  return {
    id: row.id,
    createdAt,
    vanUserId: row.van_user_id,
    vanNaam: row.van_naam,
    datum,
    type: row.type,
    omschrijving: row.omschrijving,
    bedrag: Number(row.bedrag),
    valuta: normalizeValuta(row.valuta),
    wisselkoers,
    categorie: row.categorie || "",
    referentie: row.referentie || "",
    klantNaam: row.klant_naam || "",
    betalingswijze: row.betalingswijze || null,
    bank: row.bank || "",
    geldBijNaam: row.geld_bij_naam || "",
    geldVanNaam: row.geld_van_naam || "",
    waaraan: row.waaraan || "",
    notities: row.notities || "",
    status: row.status
  };
}

const SELECT = `
  id, created_at, van_user_id, van_naam, datum, type, omschrijving, bedrag, valuta, wisselkoers,
  categorie, referentie, klant_naam, betalingswijze, bank, geld_bij_naam, geld_van_naam, waaraan,
  notities, status
`;

async function listInzendingen({ alleenUserId = null } = {}) {
  const sql = alleenUserId
    ? `select ${SELECT} from financiele_inzendingen where van_user_id = $1 order by created_at desc`
    : `select ${SELECT} from financiele_inzendingen order by created_at desc`;
  const { rows } = alleenUserId ? await query(sql, [alleenUserId]) : await query(sql, []);
  return withBijlagen(rows.map(rowToInzending));
}

async function countNieuweInzendingen() {
  const { rows } = await query(
    "select count(*)::int as aantal from financiele_inzendingen where status = 'NIEUW'"
  );
  return rows[0]?.aantal || 0;
}

async function createInzending(input, files = []) {
  const id = uuidv4();
  await query(
    `insert into financiele_inzendingen (
      id, van_user_id, van_naam, datum, type, omschrijving, bedrag, valuta, wisselkoers,
      categorie, referentie, klant_naam, betalingswijze, bank, geld_bij_naam, geld_van_naam,
      waaraan, notities, status
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'NIEUW')`,
    [
      id,
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
      input.notities || ""
    ]
  );
  await createInzendingBijlagen(id, files);
  const { rows } = await query(`select ${SELECT} from financiele_inzendingen where id = $1`, [id]);
  if (!rows[0]) return null;
  const [inzending] = await withBijlagen([rowToInzending(rows[0])]);
  return inzending;
}

async function listBijlagenByInzendingIds(ids) {
  if (!ids.length) return [];
  const { rows } = await query(
    `
    select
      id,
      inzending_id as "inzendingId",
      originele_naam as "origineleNaam",
      opslag_naam as "opslagNaam",
      mime_type as "mimeType",
      grootte,
      created_at as "createdAt"
    from financiele_inzending_bestanden
    where inzending_id = any($1::text[])
    order by created_at asc
    `,
    [ids]
  );
  return rows;
}

function publicBijlage(row) {
  return {
    id: row.id,
    origineleNaam: row.origineleNaam,
    mimeType: row.mimeType,
    grootte: Number(row.grootte) || 0
  };
}

async function withBijlagen(inzendingen) {
  const ids = inzendingen.map((item) => item.id).filter(Boolean);
  const rows = await listBijlagenByInzendingIds(ids);
  const byId = new Map();
  for (const row of rows) {
    const lijst = byId.get(row.inzendingId) || [];
    lijst.push(publicBijlage(row));
    byId.set(row.inzendingId, lijst);
  }
  return inzendingen.map((item) => ({
    ...item,
    bijlagen: byId.get(item.id) || []
  }));
}

async function getInzendingById(id) {
  const { rows } = await query(`select ${SELECT} from financiele_inzendingen where id = $1`, [id]);
  return rows[0] ? rowToInzending(rows[0]) : null;
}

async function getInzendingBijlageById(id) {
  const { rows } = await query(
    `
    select
      id,
      inzending_id as "inzendingId",
      originele_naam as "origineleNaam",
      opslag_naam as "opslagNaam",
      mime_type as "mimeType",
      grootte
    from financiele_inzending_bestanden
    where id = $1
    limit 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function createInzendingBijlagen(inzendingId, files) {
  for (const file of files || []) {
    await query(
      `
      insert into financiele_inzending_bestanden
        (id, inzending_id, originele_naam, opslag_naam, mime_type, grootte)
      values ($1,$2,$3,$4,$5,$6)
      `,
      [
        uuidv4(),
        inzendingId,
        file.originalname || "foto",
        file.filename,
        file.mimetype || "image/jpeg",
        file.size || 0
      ]
    );
  }
}

async function updateInzendingStatus(id, status) {
  const { rows } = await query(
    `update financiele_inzendingen set status = $2 where id = $1 returning ${SELECT}`,
    [id, status]
  );
  if (!rows[0]) return null;
  const [inzending] = await withBijlagen([rowToInzending(rows[0])]);
  return inzending;
}

module.exports = {
  hasDb,
  listInzendingen,
  countNieuweInzendingen,
  createInzending,
  createInzendingBijlagen,
  updateInzendingStatus,
  getInzendingById,
  getInzendingBijlageById
};
