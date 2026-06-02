const { app } = require("../server/app");
const { migrate } = require("../server/db");
const { ensureOwnerAccount } = require("../server/store");

let bootPromise = null;

function ensureBooted() {
  if (!bootPromise) {
    bootPromise = (async () => {
      await migrate();
      await ensureOwnerAccount();
    })().catch((err) => {
      bootPromise = null;
      throw err;
    });
  }
  return bootPromise;
}

module.exports = async (req, res) => {
  try {
    await ensureBooted();
  } catch (err) {
    console.error("[api] Opstarten mislukt:", err);
    if (!res.headersSent) {
      res.status(503).json({ error: "Database tijdelijk niet beschikbaar." });
    }
    return;
  }
  app(req, res);
};
