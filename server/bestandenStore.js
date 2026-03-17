const { query, isDbAvailable } = require("./db");

function hasDb() {
  return isDbAvailable();
}

async function listBestandenForOpdracht(opdrachtId) {
  if (!hasDb()) return [];
  try {
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
      left join users u on u.id = b.uploaded_by_user_id
      where b.opdracht_id = $1
      order by b.created_at desc
      `,
      [opdrachtId]
    );
    return res.rows;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") return [];
    throw err;
  }
}

async function getBestandById(id) {
  if (!hasDb()) return null;
  try {
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
  } catch (err) {
    if (process.env.NODE_ENV !== "production") return null;
    throw err;
  }
}

async function createBestand(bestand) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  try {
    await query(
      `
      insert into bestanden
        (id, opdracht_id, originele_naam, opslag_naam, mime_type, grootte, uploaded_by_user_id)
      values
        ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        bestand.id,
        bestand.opdrachtId,
        bestand.origineleNaam,
        bestand.opslagNaam,
        bestand.mimeType,
        bestand.grootte,
        bestand.uploadedByUserId || null
      ]
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") throw new Error("Database niet beschikbaar (dev).");
    throw err;
  }
}

module.exports = {
  listBestandenForOpdracht,
  getBestandById,
  createBestand
};

