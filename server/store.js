const fs = require("fs");
const path = require("path");
const { query } = require("./db");

// Fallback store (alleen dev) als DATABASE_URL ontbreekt.
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

function hasDb() {
  return Boolean(process.env.DATABASE_URL);
}

async function getUsers() {
  if (!hasDb()) return readFallback().users || [];
  const res = await query(
    "select id, name, email, password_hash as \"passwordHash\", role, active from users order by created_at asc",
    []
  );
  return res.rows;
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash ?? row.password_hash,
    role: row.role,
    active: row.active
  };
}

async function getUserByEmail(email) {
  if (!hasDb()) return (readFallback().users || []).find((u) => u.email === email) || null;
  const res = await query(
    "select id, name, email, password_hash as \"passwordHash\", role, active from users where email=$1 limit 1",
    [email]
  );
  return rowToUser(res.rows[0]);
}

async function getUserById(id) {
  if (!hasDb()) return (readFallback().users || []).find((u) => u.id === id) || null;
  const res = await query(
    "select id, name, email, password_hash as \"passwordHash\", role, active from users where id=$1 limit 1",
    [id]
  );
  return rowToUser(res.rows[0]);
}

async function createUser(user) {
  if (!hasDb()) {
    const data = readFallback();
    data.users = [...(data.users || []), user];
    writeFallback(data);
    return;
  }
  await query(
    "insert into users (id, name, email, password_hash, role, active) values ($1,$2,$3,$4,$5,$6)",
    [user.id, user.name, user.email, user.passwordHash, user.role, user.active !== false]
  );
}

async function setUserActive(id, active) {
  if (!hasDb()) {
    const data = readFallback();
    const users = data.users || [];
    const u = users.find((x) => x.id === id);
    if (u) u.active = active;
    data.users = users;
    writeFallback(data);
    return;
  }
  await query("update users set active=$2 where id=$1", [id, active]);
}

module.exports = {
  hasDb,
  getUsers,
  getUserByEmail,
  getUserById,
  createUser,
  setUserActive
};

