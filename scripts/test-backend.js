require("dotenv").config();
const { Pool } = require("pg");

function pool() {
  const raw = process.env.DATABASE_URL;
  const u = new URL(raw);
  u.searchParams.delete("channel_binding");
  return new Pool({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
}

async function main() {
  const p = pool();
  const users = await p.query("select id, email, role from users");
  console.log("users:", users.rows);
  const opdrachten = await p.query("select count(*)::int as c from opdrachten");
  console.log("opdrachten count:", opdrachten.rows[0].c);
  try {
    const list = await p.query(`
      select o.id, o.klant_naam, u.name
      from opdrachten o
      left join users u on u.id::text = o.behandelaar_user_id
      limit 3
    `);
    console.log("join ok:", list.rows);
  } catch (e) {
    console.error("join fail:", e.message);
  }
  await p.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
