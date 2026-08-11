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

function normalizeWisselkoers(waarde) {
  if (waarde === null || waarde === undefined || waarde === "") return null;
  const n = Number(waarde);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function rowToPost(row) {
  const datum =
    row.datum instanceof Date
      ? row.datum.toISOString()
      : row.datum
        ? String(row.datum)
        : null;
  const wisselkoers =
    row.wisselkoers === null || row.wisselkoers === undefined
      ? null
      : Number(row.wisselkoers);
  return {
    id: row.id,
    datum,
    type: row.type,
    omschrijving: row.omschrijving,
    bedrag: Number(row.bedrag),
    valuta: normalizeValuta(row.valuta),
    wisselkoers: Number.isFinite(wisselkoers) ? wisselkoers : null,
    categorie: row.categorie || "",
    referentie: row.referentie || "",
    klantNaam: row.klant_naam || "",
    opdrachtId: row.opdracht_id || null,
    afgehandeldDoorUserId: row.afgehandeld_door_user_id || null,
    afgehandeldDoorNaam: row.afgehandeld_door_naam || "",
    betalingswijze: normalizeBetalingswijze(row.betalingswijze),
    bank: row.bank || "",
    geldBijUserId: row.geld_bij_user_id || null,
    geldBijNaam: row.geld_bij_naam || "",
    status: row.status,
    notities: row.notities || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listFinancielePosten() {
  if (!hasDb()) return [];
  const res = await query(
    `
    select
      id,
      datum,
      type,
      omschrijving,
      bedrag,
      valuta,
      wisselkoers,
      categorie,
      referentie,
      klant_naam,
      opdracht_id,
      afgehandeld_door_user_id,
      afgehandeld_door_naam,
      betalingswijze,
      bank,
      geld_bij_user_id,
      geld_bij_naam,
      status,
      notities,
      created_at,
      updated_at
    from financiele_posten
    order by datum desc, created_at desc
    `,
    []
  );
  return res.rows.map(rowToPost);
}

async function createFinancielePost(input) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  const id = uuidv4();
  const valuta = normalizeValuta(input.valuta);
  const betalingswijze = normalizeBetalingswijze(input.betalingswijze);
  const wisselkoers = normalizeWisselkoers(input.wisselkoers);
  const res = await query(
    `
    insert into financiele_posten
      (id, datum, type, omschrijving, bedrag, valuta, wisselkoers, categorie, referentie, klant_naam, opdracht_id,
       afgehandeld_door_user_id, afgehandeld_door_naam, betalingswijze, bank,
       geld_bij_user_id, geld_bij_naam, status, notities)
    values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    returning
      id, datum, type, omschrijving, bedrag, valuta, wisselkoers, categorie, referentie, klant_naam, opdracht_id,
      afgehandeld_door_user_id, afgehandeld_door_naam, betalingswijze, bank,
      geld_bij_user_id, geld_bij_naam, status, notities,
      created_at, updated_at
    `,
    [
      id,
      input.datum,
      input.type,
      input.omschrijving,
      input.bedrag,
      valuta,
      wisselkoers,
      input.categorie || "",
      input.referentie || "",
      input.klantNaam || "",
      input.opdrachtId || null,
      input.afgehandeldDoorUserId || null,
      input.afgehandeldDoorNaam || "",
      betalingswijze,
      input.bank || "",
      input.geldBijUserId || null,
      input.geldBijNaam || "",
      input.status,
      input.notities || ""
    ]
  );
  return rowToPost(res.rows[0]);
}

async function updateFinancielePost(id, input) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  const valuta = normalizeValuta(input.valuta);
  const betalingswijze = normalizeBetalingswijze(input.betalingswijze);
  const wisselkoers = normalizeWisselkoers(input.wisselkoers);
  const res = await query(
    `
    update financiele_posten set
      datum = $2,
      type = $3,
      omschrijving = $4,
      bedrag = $5,
      valuta = $6,
      wisselkoers = $7,
      categorie = $8,
      referentie = $9,
      klant_naam = $10,
      opdracht_id = $11,
      afgehandeld_door_user_id = $12,
      afgehandeld_door_naam = $13,
      betalingswijze = $14,
      bank = $15,
      geld_bij_user_id = $16,
      geld_bij_naam = $17,
      status = $18,
      notities = $19,
      updated_at = now()
    where id = $1
    returning
      id, datum, type, omschrijving, bedrag, valuta, wisselkoers, categorie, referentie, klant_naam, opdracht_id,
      afgehandeld_door_user_id, afgehandeld_door_naam, betalingswijze, bank,
      geld_bij_user_id, geld_bij_naam, status, notities,
      created_at, updated_at
    `,
    [
      id,
      input.datum,
      input.type,
      input.omschrijving,
      input.bedrag,
      valuta,
      wisselkoers,
      input.categorie || "",
      input.referentie || "",
      input.klantNaam || "",
      input.opdrachtId || null,
      input.afgehandeldDoorUserId || null,
      input.afgehandeldDoorNaam || "",
      betalingswijze,
      input.bank || "",
      input.geldBijUserId || null,
      input.geldBijNaam || "",
      input.status,
      input.notities || ""
    ]
  );
  return res.rows[0] ? rowToPost(res.rows[0]) : null;
}

async function deleteFinancielePost(id) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  const res = await query(`delete from financiele_posten where id = $1 returning id`, [id]);
  return Boolean(res.rows[0]);
}

module.exports = {
  listFinancielePosten,
  createFinancielePost,
  updateFinancielePost,
  deleteFinancielePost
};
