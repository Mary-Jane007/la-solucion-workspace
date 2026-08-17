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
  return rows.map(rowToInzending);
}

async function countNieuweInzendingen() {
  const { rows } = await query(
    "select count(*)::int as aantal from financiele_inzendingen where status = 'NIEUW'"
  );
  return rows[0]?.aantal || 0;
}

async function createInzending(input) {
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
  const { rows } = await query(`select ${SELECT} from financiele_inzendingen where id = $1`, [id]);
  return rowToInzending(rows[0]);
}

async function updateInzendingStatus(id, status) {
  const { rows } = await query(
    `update financiele_inzendingen set status = $2 where id = $1 returning ${SELECT}`,
    [id, status]
  );
  return rows[0] ? rowToInzending(rows[0]) : null;
}

module.exports = {
  hasDb,
  listInzendingen,
  countNieuweInzendingen,
  createInzending,
  updateInzendingStatus
};
