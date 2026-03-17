const { query, isDbAvailable } = require("./db");

function hasDb() {
  return isDbAvailable();
}

async function createResetToken({ id, userId, tokenHash, expiresAt }) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query(
    "insert into password_reset_tokens (id, user_id, token_hash, expires_at) values ($1,$2,$3,$4)",
    [id, userId, tokenHash, expiresAt]
  );
}

async function getValidResetTokenByHash(tokenHash) {
  if (!hasDb()) return null;
  try {
    const res = await query(
      `
      select id, user_id as "userId", token_hash as "tokenHash", expires_at as "expiresAt", used_at as "usedAt"
      from password_reset_tokens
      where token_hash = $1
        and used_at is null
        and expires_at > now()
      limit 1
      `,
      [tokenHash]
    );
    return res.rows[0] || null;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") return null;
    throw err;
  }
}

async function markResetTokenUsed(id) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query("update password_reset_tokens set used_at=now() where id=$1", [id]);
}

async function updateUserPasswordHash(userId, passwordHash) {
  if (!hasDb()) throw new Error("Database niet geconfigureerd.");
  await query("update users set password_hash=$2 where id=$1", [userId, passwordHash]);
}

module.exports = {
  createResetToken,
  getValidResetTokenByHash,
  markResetTokenUsed,
  updateUserPasswordHash
};

