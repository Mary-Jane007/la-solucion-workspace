const { query } = require("./db");

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

function normKlantNaam(naam) {
  return String(naam || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function ensureKlantNummer(naam) {
  if (!hasDb()) return null;
  const raw = String(naam || "").trim() || "Naam klant";
  const norm = normKlantNaam(raw);
  const bestaande = await query(`select nummer from klanten where naam_norm = $1 limit 1`, [norm]);
  if (bestaande.rows[0]) return Number(bestaande.rows[0].nummer);

  try {
    const inserted = await query(
      `
      insert into klanten (nummer, naam, naam_norm)
      values (nextval('klanten_nummer_seq'), $1, $2)
      returning nummer
      `,
      [raw, norm]
    );
    return Number(inserted.rows[0].nummer);
  } catch (err) {
    if (err && err.code === "23505") {
      const opnieuw = await query(`select nummer from klanten where naam_norm = $1 limit 1`, [norm]);
      if (opnieuw.rows[0]) return Number(opnieuw.rows[0].nummer);
    }
    throw err;
  }
}

module.exports = {
  normKlantNaam,
  ensureKlantNummer
};
