const { query } = require("./db");

const TRASH_RETENTION_DAYS = 30;

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

const OPORDER_SELECT = `
  o.id,
  o.klant_naam as "klantNaam",
  o.omschrijving,
  o.datum_aangemaakt as "datumAangemaakt",
  o.datum_deadline as "datumDeadline",
  o.status,
  o.prioriteit,
  o.behandelaar_user_id as "behandelaarUserId",
  u.name as "behandelaarNaam",
  o.notities,
  o.categorie,
  o.deleted_at as "verwijderdOp",
  o.updated_at as "bijgewerktOp"
`;

async function listOpdrachtenForUser(user) {
  if (!hasDb()) return [];
  if (user.rol === "EIGENAAR") {
    const res = await query(
      `
      select ${OPORDER_SELECT}
      from opdrachten o
      left join users u on u.id::text = o.behandelaar_user_id
      where o.deleted_at is null
      order by o.created_at desc
      `,
      []
    );
    return res.rows;
  }

  const res = await query(
    `
    select ${OPORDER_SELECT}
    from opdrachten o
    left join users u on u.id::text = o.behandelaar_user_id
    where o.behandelaar_user_id = $1::text
      and o.deleted_at is null
    order by o.created_at desc
    `,
    [user.id]
  );
  return res.rows;
}

async function listPrullenbakForUser(user) {
  if (!hasDb()) return [];
  if (user.rol !== "EIGENAAR") return [];

  const res = await query(
    `
    select ${OPORDER_SELECT}
    from opdrachten o
    left join users u on u.id::text = o.behandelaar_user_id
    where o.deleted_at is not null
      and o.deleted_at > now() - interval '${TRASH_RETENTION_DAYS} days'
    order by o.deleted_at desc
    `,
    []
  );
  return res.rows;
}

async function getOpdrachtById(id, { includeDeleted = false } = {}) {
  if (!hasDb()) return null;
  const deletedClause = includeDeleted ? "" : "and o.deleted_at is null";
  const res = await query(
    `
    select ${OPORDER_SELECT}
    from opdrachten o
    left join users u on u.id::text = o.behandelaar_user_id
    where o.id = $1
      ${deletedClause}
    limit 1
    `,
    [id]
  );
  return res.rows[0] || null;
}

async function getOpdrachtInPrullenbakById(id) {
  if (!hasDb()) return null;
  const res = await query(
    `
    select ${OPORDER_SELECT}
    from opdrachten o
    left join users u on u.id::text = o.behandelaar_user_id
    where o.id = $1
      and o.deleted_at is not null
      and o.deleted_at > now() - interval '${TRASH_RETENTION_DAYS} days'
    limit 1
    `,
    [id]
  );
  return res.rows[0] || null;
}

async function createOpdracht(opdracht) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query(
    `
    insert into opdrachten
      (id, klant_naam, omschrijving, datum_aangemaakt, datum_deadline, status, prioriteit, behandelaar_user_id, notities, categorie)
    values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      opdracht.id,
      opdracht.klantNaam,
      opdracht.omschrijving,
      opdracht.datumAangemaakt,
      opdracht.datumDeadline || null,
      opdracht.status,
      opdracht.prioriteit,
      opdracht.behandelaarUserId || null,
      opdracht.notities || null,
      opdracht.categorie || null
    ]
  );
}

async function softDeleteOpdracht(id) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query(
    `
    update opdrachten
    set deleted_at = now(), updated_at = now()
    where id = $1 and deleted_at is null
    `,
    [id]
  );
}

async function restoreOpdracht(id) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query(
    `
    update opdrachten
    set deleted_at = null, updated_at = now()
    where id = $1
      and deleted_at is not null
      and deleted_at > now() - interval '${TRASH_RETENTION_DAYS} days'
    `,
    [id]
  );
}

async function getExpiredOpdrachtIds() {
  if (!hasDb()) return [];
  const res = await query(
    `
    select id
    from opdrachten
    where deleted_at is not null
      and deleted_at <= now() - interval '${TRASH_RETENTION_DAYS} days'
    `,
    []
  );
  return res.rows.map((row) => row.id);
}

async function permanentDeleteOpdrachten(ids) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  if (!ids.length) return;
  await query("delete from opdrachten where id = any($1::text[])", [ids]);
}

async function updateOpdracht(opdracht) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query(
    `
    update opdrachten set
      klant_naam=$2,
      omschrijving=$3,
      datum_aangemaakt=$4,
      datum_deadline=$5,
      status=$6,
      prioriteit=$7,
      behandelaar_user_id=$8,
      notities=$9,
      categorie=$10,
      updated_at=now()
    where id=$1
      and deleted_at is null
    `,
    [
      opdracht.id,
      opdracht.klantNaam,
      opdracht.omschrijving,
      opdracht.datumAangemaakt,
      opdracht.datumDeadline || null,
      opdracht.status,
      opdracht.prioriteit,
      opdracht.behandelaarUserId || null,
      opdracht.notities || null,
      opdracht.categorie || null
    ]
  );
}

module.exports = {
  TRASH_RETENTION_DAYS,
  listOpdrachtenForUser,
  listPrullenbakForUser,
  getOpdrachtById,
  getOpdrachtInPrullenbakById,
  createOpdracht,
  updateOpdracht,
  softDeleteOpdracht,
  restoreOpdracht,
  getExpiredOpdrachtIds,
  permanentDeleteOpdrachten
};
