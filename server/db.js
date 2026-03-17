const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!DATABASE_URL) {
  if (NODE_ENV === "production") {
    throw new Error("DATABASE_URL ontbreekt. Stel DATABASE_URL in voor productie.");
  }
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    })
  : null;

async function query(text, params) {
  if (!pool) {
    throw new Error("Database niet geconfigureerd (DATABASE_URL ontbreekt).");
  }
  const res = await pool.query(text, params);
  return res;
}

async function migrate() {
  if (!pool) return;

  await query(
    `
    create table if not exists users (
      id uuid primary key,
      name text not null,
      email text not null unique,
      password_hash text not null,
      role text not null check (role in ('EIGENAAR','MEDEWERKER')),
      active boolean not null default true,
      created_at timestamptz not null default now()
    );

    create table if not exists opdrachten (
      id uuid primary key,
      klant_naam text not null,
      omschrijving text not null,
      datum_aangemaakt date not null,
      datum_deadline date,
      status text not null check (status in ('NIEUW','IN_BEHANDELING','AFGEROND')),
      prioriteit int not null check (prioriteit in (1,2,3)),
      behandelaar_user_id uuid references users(id),
      notities text,
      categorie text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists bestanden (
      id uuid primary key,
      opdracht_id uuid not null references opdrachten(id) on delete cascade,
      originele_naam text not null,
      opslag_naam text not null unique,
      mime_type text not null,
      grootte int not null,
      uploaded_by_user_id uuid references users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists password_reset_tokens (
      id uuid primary key,
      user_id uuid not null references users(id) on delete cascade,
      token_hash text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );

    create index if not exists idx_opdrachten_behandelaar on opdrachten(behandelaar_user_id);
    create index if not exists idx_bestanden_opdracht on bestanden(opdracht_id);
    `,
    []
  );
}

module.exports = {
  pool,
  query,
  migrate
};

