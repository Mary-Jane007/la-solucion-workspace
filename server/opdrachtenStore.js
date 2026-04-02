const fs = require("fs");
const path = require("path");
const { query, isDbAvailable } = require("./db");

function hasDb() {
  return isDbAvailable();
}

const DATA_PATH = path.join(__dirname, "data.json");
const defaultData = { users: [], opdrachten: [], bestanden: [] };

function readFallback() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { ...defaultData };
  }
}

function writeFallback(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function listOpdrachtenForUser(user) {
  if (!hasDb()) {
    const data = readFallback();
    const opdrachten = data.opdrachten || [];
    if (user.rol === "EIGENAAR") return opdrachten;
    return opdrachten.filter(
      (o) =>
        o.behandelaarUserId === user.id ||
        (o.behandelaarNaam &&
          typeof o.behandelaarNaam === "string" &&
          o.behandelaarNaam.toLocaleLowerCase() === user.name.toLocaleLowerCase())
    );
  }
  try {
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
  } catch (err) {
    if (process.env.NODE_ENV !== "production") return [];
    throw err;
  }
}

async function getOpdrachtById(id) {
  if (!hasDb()) {
    const data = readFallback();
    return (data.opdrachten || []).find((o) => o.id === id) || null;
  }
  try {
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
  } catch (err) {
    if (process.env.NODE_ENV !== "production") return null;
    throw err;
  }
}

async function createOpdracht(opdracht) {
  if (!hasDb()) {
    const data = readFallback();
    const opdrachten = data.opdrachten || [];
    const nieuw = {
      ...opdracht,
      bestanden: opdracht.bestanden || []
    };
    data.opdrachten = [nieuw, ...opdrachten];
    writeFallback(data);
    return;
  }
  try {
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
  } catch (err) {
    if (process.env.NODE_ENV !== "production") throw new Error("Database niet beschikbaar (dev).");
    throw err;
  }
}

async function updateOpdracht(opdracht) {
  if (!hasDb()) {
    const data = readFallback();
    const opdrachten = data.opdrachten || [];
    const idx = opdrachten.findIndex((o) => o.id === opdracht.id);
    if (idx === -1) {
      data.opdrachten = [opdracht, ...opdrachten];
    } else {
      data.opdrachten[idx] = {
        ...opdrachten[idx],
        ...opdracht
      };
    }
    writeFallback(data);
    return;
  }
  try {
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
  } catch (err) {
    if (process.env.NODE_ENV !== "production") throw new Error("Database niet beschikbaar (dev).");
    throw err;
  }
}

async function deleteOpdracht(id) {
  if (!hasDb()) {
    const data = readFallback();
    const opdrachten = data.opdrachten || [];
    data.opdrachten = opdrachten.filter((o) => o.id !== id);
    data.bestanden = (data.bestanden || []).filter((b) => b.opdrachtId !== id);
    writeFallback(data);
    return;
  }
  try {
    await query("delete from opdrachten where id=$1", [id]);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") throw new Error("Database niet beschikbaar (dev).");
    throw err;
  }
}

module.exports = {
  listOpdrachtenForUser,
  getOpdrachtById,
  createOpdracht,
  updateOpdracht,
  deleteOpdracht
};

