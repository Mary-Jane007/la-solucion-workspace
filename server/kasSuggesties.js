const { query } = require("./db");

const SKIP = new Set([
  "",
  "(leeg)",
  "nvt",
  "overdracht medewerker",
  "valuta omzetten",
  "bankstorting",
  "muntenbak",
  "inkomst kas",
  "gestort op la solucion"
]);

const ALIAS = {
  benzine: "Benzine",
  "benzine sol": "Benzine",
  uitprinten: "Uitprinten",
  uitprint: "Uitprinten",
  copy: "Uitprinten",
  medilab: "Medilab",
  bankkosten: "Bankkosten",
  "professionele diensten": "Professionele diensten",
  belkaart: "Belkaart",
  ebs: "EBS",
  szf: "SZF",
  taxi: "Taxi",
  transport: "Taxi",
  eten: "Eten"
};

const STANDAARD = new Set(["benzine", "uitprinten", "taxi", "eten", "overig", "iets anders"]);

function mooieNaam(waarde) {
  const ruw = String(waarde || "").trim();
  const sleutel = ruw.toLowerCase();
  if (ALIAS[sleutel]) return ALIAS[sleutel];
  if (!ruw) return "";
  return ruw.charAt(0).toUpperCase() + ruw.slice(1);
}

function slaOver(sleutel) {
  if (!sleutel || SKIP.has(sleutel)) return true;
  if (sleutel.startsWith("bankstorting")) return true;
  if (sleutel.startsWith("overdracht")) return true;
  if (sleutel.startsWith("gestort")) return true;
  return false;
}

function telBij(scores, rijen, gewicht) {
  for (const rij of rijen) {
    const sleutel = String(rij.sleutel || "")
      .trim()
      .toLowerCase();
    if (slaOver(sleutel) || STANDAARD.has(sleutel)) continue;
    const label = mooieNaam(ALIAS[sleutel] || rij.voorbeeld || sleutel);
    const canon = label.toLowerCase();
    if (!label || label.length > 24 || STANDAARD.has(canon) || slaOver(canon)) continue;
    const vorige = scores.get(canon) || { label, n: 0, score: 0 };
    const aantal = Number(rij.n || 0);
    vorige.n += aantal;
    vorige.score += aantal * gewicht;
    scores.set(canon, vorige);
  }
}

async function listKasSuggestieTegels() {
  if (!process.env.DATABASE_URL) return [];
  const [waaraan, omschrijving, inzendingen] = await Promise.all([
    query(
      `
      select lower(trim(g->>'waaraan')) as sleutel,
             min(trim(g->>'waaraan')) as voorbeeld,
             count(*)::int as n
      from financiele_posten p
      cross join lateral jsonb_array_elements(coalesce(p.gebruikingen, '[]'::jsonb)) g
      where g->>'soort' = 'AF'
        and coalesce(trim(g->>'waaraan'), '') <> ''
      group by 1
      `
    ),
    query(
      `
      select lower(trim(omschrijving)) as sleutel,
             min(trim(omschrijving)) as voorbeeld,
             count(*)::int as n
      from financiele_posten
      where type = 'UITGAVE'
        and coalesce(trim(omschrijving), '') <> ''
      group by 1
      `
    ),
    query(
      `
      select lower(trim(omschrijving)) as sleutel,
             min(trim(omschrijving)) as voorbeeld,
             count(*)::int as n
      from financiele_inzendingen
      where type = 'UITGAVE'
        and coalesce(trim(omschrijving), '') <> ''
      group by 1
      `
    )
  ]);

  const scores = new Map();
  telBij(scores, waaraan.rows, 2);
  telBij(scores, omschrijving.rows, 1);
  telBij(scores, inzendingen.rows, 1);

  return [...scores.values()]
    .filter((item) => item.n >= 2)
    .sort((a, b) => b.score - a.score || b.n - a.n)
    .slice(0, 6)
    .map((item) => ({
      id: `slim-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      label: item.label,
      soort: "UITGAVE"
    }));
}

module.exports = { listKasSuggestieTegels };
