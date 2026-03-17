#!/usr/bin/env node
/**
 * Controleert of alle verplichte omgevingsvariabelen voor productie zijn gezet.
 * Gebruik: node scripts/check-env.js
 * Of: npm run check-env (als script in package.json staat).
 */
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const checks = [];
const vars = {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  APP_BASE_URL: process.env.APP_BASE_URL,
  DATABASE_URL: process.env.DATABASE_URL
};

if (NODE_ENV !== "production") {
  console.log("check-env: NODE_ENV is niet 'production'. Alleen productie-checks worden getoond.\n");
}

function ok(name, value, message) {
  const set = value != null && String(value).trim() !== "";
  checks.push({ name, set, message });
}

ok("NODE_ENV", vars.NODE_ENV, "Moet 'production' zijn op de server.");
ok("JWT_SECRET", vars.JWT_SECRET, "Min. 32 tekens, willekeurig geheim.");
ok("CORS_ORIGIN", vars.CORS_ORIGIN, "Exacte app-URL (https), geen trailing slash.");
ok("APP_BASE_URL", vars.APP_BASE_URL, "Zelfde als CORS_ORIGIN (voor reset-links).");
ok("DATABASE_URL", vars.DATABASE_URL, "PostgreSQL connection string.");

if (vars.JWT_SECRET && vars.JWT_SECRET.length < 32) {
  checks.find((c) => c.name === "JWT_SECRET").set = false;
  checks.find((c) => c.name === "JWT_SECRET").message = "Moet min. 32 tekens zijn.";
}
if (vars.CORS_ORIGIN && (vars.CORS_ORIGIN === "http://localhost:5173" || !vars.CORS_ORIGIN.startsWith("https"))) {
  if (NODE_ENV === "production") {
    checks.find((c) => c.name === "CORS_ORIGIN").set = false;
    checks.find((c) => c.name === "CORS_ORIGIN").message = "Moet je echte https-URL zijn in productie.";
  }
}

const required = NODE_ENV === "production" ? checks : checks.filter((c) => c.set);
const failed = required.filter((c) => !c.set);

required.forEach((c) => {
  const status = c.set ? "OK" : "ONTBREEKT";
  console.log(`  ${c.name}: ${status}  ${c.set ? "" : "– " + c.message}`);
});

if (failed.length > 0 && NODE_ENV === "production") {
  console.log("\nNiet alle verplichte variabelen zijn gezet. Zie .env.example en DEPLOY.md.");
  process.exit(1);
}

console.log("\nOmgevingsvariabelen zijn in orde voor deze omgeving.");
process.exit(0);
