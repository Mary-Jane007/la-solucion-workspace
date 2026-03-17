const { query } = require("./db");

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

async function listOpdrachtenForUser(user) {
  if (!hasDb()) return [];
  if (user.rol === "EIGENAAR") {
    const res = await query(
      `
      select
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
        o.categorie
      from opdrachten o
      left join users u on u.id = o.behandelaar_user_id
      order by o.created_at desc
      `,
      []
    );
    return res.rows;
  }

  const res = await query(
    `
    select
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
      o.categorie
    from opdrachten o
    left join users u on u.id = o.behandelaar_user_id
    where o.behandelaar_user_id = $1
    order by o.created_at desc
    `,
    [user.id]
  );
  return res.rows;
}

async function getOpdrachtById(id) {
  if (!hasDb()) return null;
  const res = await query(
    `
    select
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
      o.categorie
    from opdrachten o
    left join users u on u.id = o.behandelaar_user_id
    where o.id = $1
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
  listOpdrachtenForUser,
  getOpdrachtById,
  createOpdracht,
  updateOpdracht
};

