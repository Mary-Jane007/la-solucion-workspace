const { v4: uuidv4 } = require("uuid");
const { query } = require("./db");

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function rowToPost(row) {
  return {
    id: row.id,
    datum: row.datum,
    type: row.type,
    omschrijving: row.omschrijving,
    bedrag: Number(row.bedrag),
    categorie: row.categorie || "",
    referentie: row.referentie || "",
    klantNaam: row.klant_naam || "",
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
      categorie,
      referentie,
      klant_naam,
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
  const res = await query(
    `
    insert into financiele_posten
      (id, datum, type, omschrijving, bedrag, categorie, referentie, klant_naam, status, notities)
    values
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    returning
      id, datum, type, omschrijving, bedrag, categorie, referentie, klant_naam, status, notities,
      created_at, updated_at
    `,
    [
      id,
      input.datum,
      input.type,
      input.omschrijving,
      input.bedrag,
      input.categorie || "",
      input.referentie || "",
      input.klantNaam || "",
      input.status,
      input.notities || ""
    ]
  );
  return rowToPost(res.rows[0]);
}

async function updateFinancielePost(id, input) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  const res = await query(
    `
    update financiele_posten set
      datum = $2,
      type = $3,
      omschrijving = $4,
      bedrag = $5,
      categorie = $6,
      referentie = $7,
      klant_naam = $8,
      status = $9,
      notities = $10,
      updated_at = now()
    where id = $1
    returning
      id, datum, type, omschrijving, bedrag, categorie, referentie, klant_naam, status, notities,
      created_at, updated_at
    `,
    [
      id,
      input.datum,
      input.type,
      input.omschrijving,
      input.bedrag,
      input.categorie || "",
      input.referentie || "",
      input.klantNaam || "",
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
