const { query } = require("./db");

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

async function listBestandenForOpdracht(opdrachtId) {
  if (!hasDb()) return [];
  const res = await query(
    `
    select
      b.id,
      b.opdracht_id as "opdrachtId",
      b.originele_naam as "origineleNaam",
      b.opslag_naam as "opslagNaam",
      b.mime_type as "mimeType",
      b.grootte,
      b.uploaded_by_user_id as "uploadedByUserId",
      u.name as "uploadedByNaam",
      b.created_at as "createdAt"
    from bestanden b
    left join users u on u.id::text = b.uploaded_by_user_id
    where b.opdracht_id = $1
    order by b.created_at desc
    `,
    [opdrachtId]
  );
  return res.rows;
}

async function getBestandById(id) {
  if (!hasDb()) return null;
  const res = await query(
    `
    select
      b.id,
      b.opdracht_id as "opdrachtId",
      b.originele_naam as "origineleNaam",
      b.opslag_naam as "opslagNaam",
      b.mime_type as "mimeType",
      b.grootte,
      b.uploaded_by_user_id as "uploadedByUserId",
      b.created_at as "createdAt"
    from bestanden b
    where b.id = $1
    limit 1
    `,
    [id]
  );
  return res.rows[0] || null;
}

async function createBestand(bestand) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query(
    `
    insert into bestanden
      (id, opdracht_id, originele_naam, opslag_naam, mime_type, grootte, uploaded_by_user_id, inhoud)
    values
      ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      bestand.id,
      bestand.opdrachtId,
      bestand.origineleNaam,
      bestand.opslagNaam,
      bestand.mimeType,
      bestand.grootte,
      bestand.uploadedByUserId || null,
      bestand.inhoud || null
    ]
  );
}

async function getBestandInhoudById(id) {
  if (!hasDb()) return null;
  const res = await query(`select inhoud from bestanden where id = $1 limit 1`, [id]);
  const raw = res.rows[0]?.inhoud;
  if (!raw) return null;
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
}

async function saveBestandInhoud(id, inhoud) {
  if (!hasDb() || !inhoud) return;
  await query(`update bestanden set inhoud = $2 where id = $1 and inhoud is null`, [id, inhoud]);
}

async function listBestandenForOpdrachtIds(opdrachtIds) {
  if (!hasDb() || !opdrachtIds.length) return [];
  const res = await query(
    `
    select
      b.id,
      b.opdracht_id as "opdrachtId",
      b.originele_naam as "origineleNaam",
      b.opslag_naam as "opslagNaam",
      b.mime_type as "mimeType",
      b.grootte,
      b.uploaded_by_user_id as "uploadedByUserId",
      b.created_at as "createdAt"
    from bestanden b
    where b.opdracht_id = any($1::text[])
    `,
    [opdrachtIds]
  );
  return res.rows;
}

async function deleteBestandenForOpdrachtIds(opdrachtIds) {
  if (!hasDb() || !opdrachtIds.length) return;
  await query("delete from bestanden where opdracht_id = any($1::text[])", [opdrachtIds]);
}

async function updateBestandNaam(id, origineleNaam) {
  if (!hasDb()) return null;
  const res = await query(
    `
    update bestanden
    set originele_naam = $2
    where id = $1
    returning
      id,
      originele_naam as "origineleNaam"
    `,
    [id, origineleNaam]
  );
  return res.rows[0] || null;
}

async function deleteBestandById(id) {
  if (!hasDb()) return null;
  const bestaande = await getBestandById(id);
  if (!bestaande) return null;
  await query("delete from bestanden where id = $1", [id]);
  return bestaande;
}

module.exports = {
  listBestandenForOpdracht,
  listBestandenForOpdrachtIds,
  getBestandById,
  getBestandInhoudById,
  saveBestandInhoud,
  createBestand,
  updateBestandNaam,
  deleteBestandById,
  deleteBestandenForOpdrachtIds
};

