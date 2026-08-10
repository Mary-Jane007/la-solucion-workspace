require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`
  );
  console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));
  for (const { table_name } of tables.rows) {
    const res = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [table_name]
    );
    console.log("\n" + table_name + ":", res.rows);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
